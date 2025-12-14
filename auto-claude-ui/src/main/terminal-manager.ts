import * as pty from 'node-pty';
import { BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '../shared/constants';
import type { TerminalCreateOptions } from '../shared/types';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { getTerminalSessionStore, type TerminalSession } from './terminal-session-store';

/**
 * Get the Claude project slug from a project path.
 * Claude uses a hash-based slug for project directories.
 */
function getClaudeProjectSlug(projectPath: string): string {
  // Claude uses the absolute path to create a slug
  // Format: {basename}-{hash of full path}
  const basename = path.basename(projectPath);
  const hash = crypto.createHash('sha256').update(projectPath).digest('hex').slice(0, 8);
  return `${basename}-${hash}`;
}

/**
 * Find the most recent Claude session file for a project.
 * Returns the session ID (filename without .jsonl extension) or null if not found.
 */
function findMostRecentClaudeSession(projectPath: string): string | null {
  const slug = getClaudeProjectSlug(projectPath);
  const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', slug);

  try {
    if (!fs.existsSync(claudeProjectDir)) {
      console.log('[TerminalManager] Claude project directory not found:', claudeProjectDir);
      return null;
    }

    const files = fs.readdirSync(claudeProjectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        path: path.join(claudeProjectDir, f),
        mtime: fs.statSync(path.join(claudeProjectDir, f)).mtime.getTime()
      }))
      .sort((a, b) => b.mtime - a.mtime);  // Most recent first

    if (files.length === 0) {
      console.log('[TerminalManager] No Claude session files found in:', claudeProjectDir);
      return null;
    }

    // Return session ID (filename without .jsonl)
    const sessionId = files[0].name.replace('.jsonl', '');
    console.log('[TerminalManager] Found most recent Claude session:', sessionId);
    return sessionId;
  } catch (error) {
    console.error('[TerminalManager] Error finding Claude session:', error);
    return null;
  }
}

/**
 * Find a Claude session that was created/modified after a given timestamp.
 * This helps us find the session that was just started.
 */
function findClaudeSessionAfter(projectPath: string, afterTimestamp: number): string | null {
  const slug = getClaudeProjectSlug(projectPath);
  const claudeProjectDir = path.join(os.homedir(), '.claude', 'projects', slug);

  try {
    if (!fs.existsSync(claudeProjectDir)) {
      return null;
    }

    const files = fs.readdirSync(claudeProjectDir)
      .filter(f => f.endsWith('.jsonl'))
      .map(f => ({
        name: f,
        path: path.join(claudeProjectDir, f),
        mtime: fs.statSync(path.join(claudeProjectDir, f)).mtime.getTime()
      }))
      .filter(f => f.mtime > afterTimestamp)
      .sort((a, b) => b.mtime - a.mtime);

    if (files.length === 0) {
      return null;
    }

    return files[0].name.replace('.jsonl', '');
  } catch (error) {
    console.error('[TerminalManager] Error finding Claude session:', error);
    return null;
  }
}

interface TerminalProcess {
  id: string;
  pty: pty.IPty;
  isClaudeMode: boolean;
  projectPath?: string;
  cwd: string;  // Working directory for the terminal
  claudeSessionId?: string;
  outputBuffer: string;  // Track output for session persistence
  title: string;
}

// Regex patterns to capture Claude session ID from output
// Claude Code outputs something like "Session: abc123" or stores it in the init message
const CLAUDE_SESSION_PATTERNS = [
  // Direct session display (if Claude shows it)
  /Session(?:\s+ID)?:\s*([a-zA-Z0-9_-]+)/i,
  // From the JSONL filename pattern that Claude uses internally
  /session[_-]?id["\s:=]+([a-zA-Z0-9_-]+)/i,
  // From Claude Code's init output
  /Resuming session:\s*([a-zA-Z0-9_-]+)/i,
  // From conversation ID in output
  /conversation[_-]?id["\s:=]+([a-zA-Z0-9_-]+)/i,
];

// Regex pattern to detect Claude Code rate limit messages
// Matches: "Limit reached · resets Dec 17 at 6am (Europe/Oslo)"
const RATE_LIMIT_PATTERN = /Limit reached\s*[·•]\s*resets\s+(.+?)$/m;

export class TerminalManager {
  private terminals: Map<string, TerminalProcess> = new Map();
  private getWindow: () => BrowserWindow | null;
  private saveTimer: NodeJS.Timeout | null = null;
  // Track rate limit notifications per terminal to avoid spamming (reset after 60 seconds)
  private rateLimitNotifiedAt: Map<string, number> = new Map();

  constructor(getWindow: () => BrowserWindow | null) {
    this.getWindow = getWindow;

    // Periodically save session data (every 30 seconds)
    this.saveTimer = setInterval(() => {
      this.persistAllSessions();
    }, 30000);
  }

  /**
   * Persist all current sessions to disk
   */
  private persistAllSessions(): void {
    const store = getTerminalSessionStore();

    for (const [, terminal] of this.terminals) {
      if (terminal.projectPath) {
        const session: TerminalSession = {
          id: terminal.id,
          title: terminal.title,
          cwd: terminal.cwd,  // Use the terminal's working directory
          projectPath: terminal.projectPath,
          isClaudeMode: terminal.isClaudeMode,
          claudeSessionId: terminal.claudeSessionId,
          outputBuffer: terminal.outputBuffer,
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        };
        store.saveSession(session);
      }
    }
  }

  /**
   * Try to extract Claude session ID from output
   */
  private extractClaudeSessionId(data: string): string | null {
    for (const pattern of CLAUDE_SESSION_PATTERNS) {
      const match = data.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    return null;
  }

  /**
   * Create a new terminal process
   */
  async create(options: TerminalCreateOptions & { projectPath?: string }): Promise<{ success: boolean; error?: string }> {
    const { id, cwd, cols = 80, rows = 24, projectPath } = options;

    console.log('[TerminalManager] Creating terminal:', { id, cwd, cols, rows, projectPath });

    // Check if terminal already exists - return success instead of error
    // This handles React StrictMode double-render gracefully
    if (this.terminals.has(id)) {
      console.log('[TerminalManager] Terminal already exists, returning success:', id);
      return { success: true };
    }

    try {
      // Determine shell based on platform
      const shell = process.platform === 'win32'
        ? process.env.COMSPEC || 'cmd.exe'
        : process.env.SHELL || '/bin/zsh';

      // Get shell args
      const shellArgs = process.platform === 'win32' ? [] : ['-l'];

      console.log('[TerminalManager] Spawning shell:', shell, shellArgs);

      // Spawn the pty process
      const ptyProcess = pty.spawn(shell, shellArgs, {
        name: 'xterm-256color',
        cols,
        rows,
        cwd: cwd || os.homedir(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
        },
      });

      console.log('[TerminalManager] PTY process spawned, pid:', ptyProcess.pid);

      // Store the terminal with its working directory
      const terminalCwd = cwd || os.homedir();
      const terminal: TerminalProcess = {
        id,
        pty: ptyProcess,
        isClaudeMode: false,
        projectPath,
        cwd: terminalCwd,
        outputBuffer: '',
        title: `Terminal ${this.terminals.size + 1}`
      };
      this.terminals.set(id, terminal);

      // Handle data from terminal
      ptyProcess.onData((data) => {
        // Append to output buffer (limit to 100KB)
        terminal.outputBuffer = (terminal.outputBuffer + data).slice(-100000);

        // Try to extract Claude session ID if in Claude mode
        if (terminal.isClaudeMode && !terminal.claudeSessionId) {
          const sessionId = this.extractClaudeSessionId(data);
          if (sessionId) {
            terminal.claudeSessionId = sessionId;
            console.log('[TerminalManager] Captured Claude session ID:', sessionId);

            // Save to persistent store
            if (terminal.projectPath) {
              const store = getTerminalSessionStore();
              store.updateClaudeSessionId(terminal.projectPath, id, sessionId);
            }

            // Notify renderer
            const win = this.getWindow();
            if (win) {
              win.webContents.send(IPC_CHANNELS.TERMINAL_CLAUDE_SESSION, id, sessionId);
            }
          }
        }

        // Check for rate limit messages
        if (terminal.isClaudeMode) {
          const rateLimitMatch = data.match(RATE_LIMIT_PATTERN);
          if (rateLimitMatch) {
            const resetTime = rateLimitMatch[1].trim();
            const now = Date.now();
            const lastNotified = this.rateLimitNotifiedAt.get(id) || 0;

            // Only notify once per 60 seconds to avoid spamming
            if (now - lastNotified > 60000) {
              this.rateLimitNotifiedAt.set(id, now);
              console.log('[TerminalManager] Rate limit detected, reset:', resetTime);

              const win = this.getWindow();
              if (win) {
                win.webContents.send(IPC_CHANNELS.TERMINAL_RATE_LIMIT, {
                  terminalId: id,
                  resetTime,
                  detectedAt: new Date().toISOString()
                });
              }
            }
          }
        }

        const win = this.getWindow();
        if (win) {
          win.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, id, data);
        }
      });

      // Handle terminal exit
      ptyProcess.onExit(({ exitCode }) => {
        console.log('[TerminalManager] Terminal exited:', id, 'code:', exitCode);
        const win = this.getWindow();
        if (win) {
          win.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, id, exitCode);
        }

        // Remove session from persistent store when terminal exits
        if (terminal.projectPath) {
          const store = getTerminalSessionStore();
          store.removeSession(terminal.projectPath, id);
        }

        this.terminals.delete(id);
      });

      // Save initial session state
      if (projectPath) {
        const store = getTerminalSessionStore();
        store.saveSession({
          id,
          title: terminal.title,
          cwd: cwd || os.homedir(),
          projectPath,
          isClaudeMode: false,
          outputBuffer: '',
          createdAt: new Date().toISOString(),
          lastActiveAt: new Date().toISOString()
        });
      }

      console.log('[TerminalManager] Terminal created successfully:', id);
      return { success: true };
    } catch (error) {
      console.error('[TerminalManager] Error creating terminal:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create terminal',
      };
    }
  }

  /**
   * Restore a terminal session (create PTY and optionally resume Claude)
   */
  async restore(session: TerminalSession, cols = 80, rows = 24): Promise<{ success: boolean; error?: string; outputBuffer?: string }> {
    console.log('[TerminalManager] Restoring terminal session:', session.id, 'Claude mode:', session.isClaudeMode);

    // First create the base terminal
    const result = await this.create({
      id: session.id,
      cwd: session.cwd,
      cols,
      rows,
      projectPath: session.projectPath
    });

    if (!result.success) {
      return result;
    }

    const terminal = this.terminals.get(session.id);
    if (!terminal) {
      return { success: false, error: 'Terminal not found after creation' };
    }

    // Set the title
    terminal.title = session.title;

    // If it was a Claude session, try to resume
    if (session.isClaudeMode) {
      // Wait for shell to fully initialize (shell frameworks like oh-my-zsh need time)
      await new Promise(resolve => setTimeout(resolve, 1000));

      terminal.isClaudeMode = true;
      terminal.claudeSessionId = session.claudeSessionId;

      // Build the resume command - always cd to the project directory first
      // because Claude sessions are stored per-project in ~/.claude/projects/{project-slug}/
      const projectDir = session.cwd || session.projectPath;
      const startTime = Date.now();
      let resumeCommand: string;

      if (session.claudeSessionId) {
        // Resume specific session with explicit directory
        // Clear screen first to avoid mixing old output replay with new session
        resumeCommand = `clear && cd "${projectDir}" && claude --resume "${session.claudeSessionId}"`;
        console.log('[TerminalManager] Resuming Claude with session ID:', session.claudeSessionId, 'in', projectDir);
      } else {
        // No specific session ID - use --resume to show session picker
        // This lets user choose which session to resume for this terminal
        // (Using --continue would resume the same session in all terminals)
        resumeCommand = `clear && cd "${projectDir}" && claude --resume`;
        console.log('[TerminalManager] Opening Claude session picker in', projectDir);
      }

      terminal.pty.write(`${resumeCommand}\r`);

      // Notify renderer about title change
      const win = this.getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, session.id, 'Claude');
      }

      // If we don't have a session ID, try to capture it after user selects from picker
      if (!session.claudeSessionId && projectDir) {
        this.captureClaudeSessionId(session.id, projectDir, startTime);
      }
    }

    return {
      success: true,
      outputBuffer: session.outputBuffer  // Return buffer for replay in UI
    };
  }

  /**
   * Destroy a terminal process
   */
  async destroy(id: string): Promise<{ success: boolean; error?: string }> {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    try {
      // Remove from persistent store
      if (terminal.projectPath) {
        const store = getTerminalSessionStore();
        store.removeSession(terminal.projectPath, id);
      }

      terminal.pty.kill();
      this.terminals.delete(id);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to destroy terminal',
      };
    }
  }

  /**
   * Send input to a terminal
   */
  write(id: string, data: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.pty.write(data);
    }
  }

  /**
   * Resize a terminal
   */
  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.pty.resize(cols, rows);
    }
  }

  /**
   * Invoke Claude in a terminal
   */
  invokeClaude(id: string, cwd?: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.isClaudeMode = true;
      terminal.claudeSessionId = undefined;

      // Record timestamp before starting Claude
      const startTime = Date.now();
      const projectPath = cwd || terminal.projectPath || terminal.cwd;

      // Clear the terminal and invoke claude
      const cwdCommand = cwd ? `cd "${cwd}" && ` : '';
      terminal.pty.write(`${cwdCommand}claude\r`);

      // Notify the renderer about title change
      const win = this.getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, id, 'Claude');
      }

      // Update persistent store
      if (terminal.projectPath) {
        const store = getTerminalSessionStore();
        const session = store.getSession(terminal.projectPath, id);
        if (session) {
          store.saveSession({
            ...session,
            isClaudeMode: true,
            lastActiveAt: new Date().toISOString()
          });
        }
      }

      // Capture Claude session ID after a delay (give Claude time to create the session file)
      if (projectPath) {
        this.captureClaudeSessionId(id, projectPath, startTime);
      }
    }
  }

  /**
   * Attempt to capture Claude session ID by scanning the session directory.
   * Polls periodically until a new session is found or timeout.
   */
  private captureClaudeSessionId(terminalId: string, projectPath: string, startTime: number): void {
    const terminal = this.terminals.get(terminalId);
    if (!terminal) return;

    let attempts = 0;
    const maxAttempts = 10;  // Try for up to 10 seconds

    const checkForSession = () => {
      attempts++;

      // Check if terminal still exists and is in Claude mode
      const currentTerminal = this.terminals.get(terminalId);
      if (!currentTerminal || !currentTerminal.isClaudeMode) {
        return;  // Terminal closed or Claude exited
      }

      // Already have a session ID (maybe captured from output)
      if (currentTerminal.claudeSessionId) {
        return;
      }

      // Look for a session file created after we started Claude
      const sessionId = findClaudeSessionAfter(projectPath, startTime);

      if (sessionId) {
        currentTerminal.claudeSessionId = sessionId;
        console.log('[TerminalManager] Captured Claude session ID from directory:', sessionId);

        // Save to persistent store
        if (currentTerminal.projectPath) {
          const store = getTerminalSessionStore();
          store.updateClaudeSessionId(currentTerminal.projectPath, terminalId, sessionId);
        }

        // Notify renderer
        const win = this.getWindow();
        if (win) {
          win.webContents.send(IPC_CHANNELS.TERMINAL_CLAUDE_SESSION, terminalId, sessionId);
        }
      } else if (attempts < maxAttempts) {
        // Try again in 1 second
        setTimeout(checkForSession, 1000);
      } else {
        console.log('[TerminalManager] Could not capture Claude session ID after', maxAttempts, 'attempts');
      }
    };

    // First check after 2 seconds (give Claude time to start)
    setTimeout(checkForSession, 2000);
  }

  /**
   * Resume Claude in a terminal with a specific session ID
   */
  resumeClaude(id: string, sessionId?: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.isClaudeMode = true;

      let command: string;
      if (sessionId) {
        command = `claude --resume "${sessionId}"`;
        terminal.claudeSessionId = sessionId;
      } else {
        command = 'claude --continue';
      }

      terminal.pty.write(`${command}\r`);

      // Notify the renderer about title change
      const win = this.getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, id, 'Claude');
      }
    }
  }

  /**
   * Get saved sessions for a project
   */
  getSavedSessions(projectPath: string): TerminalSession[] {
    const store = getTerminalSessionStore();
    return store.getSessions(projectPath);
  }

  /**
   * Clear saved sessions for a project
   */
  clearSavedSessions(projectPath: string): void {
    const store = getTerminalSessionStore();
    store.clearProjectSessions(projectPath);
  }

  /**
   * Get available session dates for a project
   */
  getAvailableSessionDates(projectPath?: string): import('./terminal-session-store').SessionDateInfo[] {
    const store = getTerminalSessionStore();
    return store.getAvailableDates(projectPath);
  }

  /**
   * Get sessions for a specific date and project
   */
  getSessionsForDate(date: string, projectPath: string): TerminalSession[] {
    const store = getTerminalSessionStore();
    return store.getSessionsForDate(date, projectPath);
  }

  /**
   * Restore all sessions from a specific date for a project
   */
  async restoreSessionsFromDate(
    date: string,
    projectPath: string,
    cols = 80,
    rows = 24
  ): Promise<{ restored: number; failed: number; sessions: Array<{ id: string; success: boolean; error?: string }> }> {
    const store = getTerminalSessionStore();
    const sessions = store.getSessionsForDate(date, projectPath);

    const results: Array<{ id: string; success: boolean; error?: string }> = [];

    for (const session of sessions) {
      const result = await this.restore(session, cols, rows);
      results.push({
        id: session.id,
        success: result.success,
        error: result.error
      });
    }

    return {
      restored: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      sessions: results
    };
  }

  /**
   * Kill all terminal processes
   */
  async killAll(): Promise<void> {
    // Save all sessions before killing
    this.persistAllSessions();

    // Clear the save timer
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    const promises: Promise<void>[] = [];

    for (const [id, terminal] of this.terminals) {
      promises.push(
        new Promise((resolve) => {
          try {
            terminal.pty.kill();
          } catch {
            // Ignore errors during cleanup
          }
          resolve();
        })
      );
    }

    await Promise.all(promises);
    this.terminals.clear();
  }

  /**
   * Get all active terminal IDs
   */
  getActiveTerminalIds(): string[] {
    return Array.from(this.terminals.keys());
  }

  /**
   * Check if a terminal is in Claude mode
   */
  isClaudeMode(id: string): boolean {
    const terminal = this.terminals.get(id);
    return terminal?.isClaudeMode ?? false;
  }

  /**
   * Get Claude session ID for a terminal
   */
  getClaudeSessionId(id: string): string | undefined {
    const terminal = this.terminals.get(id);
    return terminal?.claudeSessionId;
  }

  /**
   * Update terminal title
   */
  setTitle(id: string, title: string): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      terminal.title = title;
    }
  }
}
