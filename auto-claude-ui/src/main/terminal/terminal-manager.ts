/**
 * Terminal Manager
 * Main orchestrator for terminal lifecycle, Claude integration, and profile management
 */

import { BrowserWindow } from 'electron';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import type { TerminalCreateOptions } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/constants';
import { getClaudeProfileManager } from '../claude-profile-manager';
import type { TerminalSession } from '../terminal-session-store';

// Internal modules
import type {
  TerminalProcess,
  WindowGetter,
  TerminalOperationResult,
  RateLimitEvent,
  OAuthTokenEvent
} from './types';
import * as OutputParser from './output-parser';
import * as PtyManager from './pty-manager';
import * as SessionHandler from './session-handler';

export class TerminalManager {
  private terminals: Map<string, TerminalProcess> = new Map();
  private getWindow: WindowGetter;
  private saveTimer: NodeJS.Timeout | null = null;
  private lastNotifiedRateLimitReset: Map<string, string> = new Map();

  constructor(getWindow: WindowGetter) {
    this.getWindow = getWindow;

    // Periodically save session data (every 30 seconds)
    this.saveTimer = setInterval(() => {
      SessionHandler.persistAllSessions(this.terminals);
    }, 30000);
  }

  /**
   * Create a new terminal process
   */
  async create(
    options: TerminalCreateOptions & { projectPath?: string }
  ): Promise<TerminalOperationResult> {
    const { id, cwd, cols = 80, rows = 24, projectPath } = options;

    console.log('[TerminalManager] Creating terminal:', { id, cwd, cols, rows, projectPath });

    if (this.terminals.has(id)) {
      console.log('[TerminalManager] Terminal already exists, returning success:', id);
      return { success: true };
    }

    try {
      const profileEnv = PtyManager.getActiveProfileEnv();

      if (profileEnv.CLAUDE_CODE_OAUTH_TOKEN) {
        console.log('[TerminalManager] Injecting OAuth token from active profile');
      }

      const ptyProcess = PtyManager.spawnPtyProcess(
        cwd || os.homedir(),
        cols,
        rows,
        profileEnv
      );

      console.log('[TerminalManager] PTY process spawned, pid:', ptyProcess.pid);

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

      PtyManager.setupPtyHandlers(
        terminal,
        this.terminals,
        this.getWindow,
        (term, data) => this.handleTerminalData(term, data),
        (term) => this.handleTerminalExit(term)
      );

      if (projectPath) {
        SessionHandler.persistSession(terminal);
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
   * Handle data output from terminal
   */
  private handleTerminalData(terminal: TerminalProcess, data: string): void {
    // Try to extract Claude session ID
    if (terminal.isClaudeMode && !terminal.claudeSessionId) {
      const sessionId = OutputParser.extractClaudeSessionId(data);
      if (sessionId) {
        this.handleClaudeSessionIdCaptured(terminal, sessionId);
      }
    }

    // Check for rate limit messages
    if (terminal.isClaudeMode) {
      this.checkForRateLimit(terminal, data);
    }

    // Check for OAuth token
    this.checkForOAuthToken(terminal, data);
  }

  /**
   * Handle terminal exit event
   */
  private handleTerminalExit(terminal: TerminalProcess): void {
    SessionHandler.removePersistedSession(terminal);
    this.lastNotifiedRateLimitReset.delete(terminal.id);
  }

  /**
   * Handle Claude session ID capture
   */
  private handleClaudeSessionIdCaptured(terminal: TerminalProcess, sessionId: string): void {
    terminal.claudeSessionId = sessionId;
    console.log('[TerminalManager] Captured Claude session ID:', sessionId);

    if (terminal.projectPath) {
      SessionHandler.updateClaudeSessionId(terminal.projectPath, terminal.id, sessionId);
    }

    const win = this.getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_CLAUDE_SESSION, terminal.id, sessionId);
    }
  }

  /**
   * Check for rate limit messages and handle profile switching
   */
  private checkForRateLimit(terminal: TerminalProcess, data: string): void {
    const resetTime = OutputParser.extractRateLimitReset(data);
    if (!resetTime) {
      return;
    }

    const lastNotifiedReset = this.lastNotifiedRateLimitReset.get(terminal.id);
    if (resetTime === lastNotifiedReset) {
      return;
    }

    this.lastNotifiedRateLimitReset.set(terminal.id, resetTime);
    console.log('[TerminalManager] Rate limit detected, reset:', resetTime);

    const profileManager = getClaudeProfileManager();
    const currentProfileId = terminal.claudeProfileId || 'default';

    try {
      const rateLimitEvent = profileManager.recordRateLimitEvent(currentProfileId, resetTime);
      console.log('[TerminalManager] Recorded rate limit event:', rateLimitEvent.type);
    } catch (err) {
      console.error('[TerminalManager] Failed to record rate limit event:', err);
    }

    const autoSwitchSettings = profileManager.getAutoSwitchSettings();
    const bestProfile = profileManager.getBestAvailableProfile(currentProfileId);

    const win = this.getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_RATE_LIMIT, {
        terminalId: terminal.id,
        resetTime,
        detectedAt: new Date().toISOString(),
        profileId: currentProfileId,
        suggestedProfileId: bestProfile?.id,
        suggestedProfileName: bestProfile?.name,
        autoSwitchEnabled: autoSwitchSettings.autoSwitchOnRateLimit
      } as RateLimitEvent);
    }

    if (autoSwitchSettings.enabled && autoSwitchSettings.autoSwitchOnRateLimit && bestProfile) {
      console.log('[TerminalManager] Auto-switching to profile:', bestProfile.name);
      this.switchClaudeProfile(terminal.id, bestProfile.id).then(result => {
        if (result.success) {
          console.log('[TerminalManager] Auto-switch successful');
        } else {
          console.error('[TerminalManager] Auto-switch failed:', result.error);
        }
      });
    }
  }

  /**
   * Check for OAuth token and auto-save to profile
   */
  private checkForOAuthToken(terminal: TerminalProcess, data: string): void {
    const token = OutputParser.extractOAuthToken(data);
    if (!token) {
      return;
    }

    console.log('[TerminalManager] OAuth token detected, length:', token.length);

    const email = OutputParser.extractEmail(terminal.outputBuffer);
    const profileIdMatch = terminal.id.match(/claude-login-(profile-\d+)-/);

    if (profileIdMatch) {
      const profileId = profileIdMatch[1];
      const profileManager = getClaudeProfileManager();
      const success = profileManager.setProfileToken(profileId, token, email || undefined);

      if (success) {
        console.log('[TerminalManager] OAuth token auto-saved to profile:', profileId);

        const win = this.getWindow();
        if (win) {
          win.webContents.send(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, {
            terminalId: terminal.id,
            profileId,
            email,
            success: true,
            detectedAt: new Date().toISOString()
          } as OAuthTokenEvent);
        }
      } else {
        console.error('[TerminalManager] Failed to save OAuth token to profile:', profileId);
      }
    } else {
      console.log('[TerminalManager] OAuth token detected but not in a profile login terminal');
      const win = this.getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_OAUTH_TOKEN, {
          terminalId: terminal.id,
          email,
          success: false,
          message: 'Token detected but no profile associated with this terminal',
          detectedAt: new Date().toISOString()
        } as OAuthTokenEvent);
      }
    }
  }

  /**
   * Restore a terminal session
   */
  async restore(
    session: TerminalSession,
    cols = 80,
    rows = 24
  ): Promise<TerminalOperationResult> {
    console.log('[TerminalManager] Restoring terminal session:', session.id, 'Claude mode:', session.isClaudeMode);

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

    terminal.title = session.title;

    if (session.isClaudeMode) {
      await new Promise(resolve => setTimeout(resolve, 1000));

      terminal.isClaudeMode = true;
      terminal.claudeSessionId = session.claudeSessionId;

      const projectDir = session.cwd || session.projectPath;
      const startTime = Date.now();
      const clearCmd = process.platform === 'win32' ? 'cls' : 'clear';

      let resumeCommand: string;
      if (session.claudeSessionId) {
        resumeCommand = `${clearCmd} && cd "${projectDir}" && claude --resume "${session.claudeSessionId}"`;
        console.log('[TerminalManager] Resuming Claude with session ID:', session.claudeSessionId, 'in', projectDir);
      } else {
        resumeCommand = `${clearCmd} && cd "${projectDir}" && claude --resume`;
        console.log('[TerminalManager] Opening Claude session picker in', projectDir);
      }

      terminal.pty.write(`${resumeCommand}\r`);

      const win = this.getWindow();
      if (win) {
        win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, session.id, 'Claude');
      }

      if (!session.claudeSessionId && projectDir) {
        SessionHandler.captureClaudeSessionId(
          session.id,
          projectDir,
          startTime,
          this.terminals,
          this.getWindow
        );
      }
    }

    return {
      success: true,
      outputBuffer: session.outputBuffer
    };
  }

  /**
   * Destroy a terminal process
   */
  async destroy(id: string): Promise<TerminalOperationResult> {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    try {
      SessionHandler.removePersistedSession(terminal);
      this.lastNotifiedRateLimitReset.delete(id);
      PtyManager.killPty(terminal);
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
      PtyManager.writeToPty(terminal, data);
    }
  }

  /**
   * Resize a terminal
   */
  resize(id: string, cols: number, rows: number): void {
    const terminal = this.terminals.get(id);
    if (terminal) {
      PtyManager.resizePty(terminal, cols, rows);
    }
  }

  /**
   * Invoke Claude in a terminal with optional profile override
   */
  invokeClaude(id: string, cwd?: string, profileId?: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return;
    }

    terminal.isClaudeMode = true;
    terminal.claudeSessionId = undefined;

    const startTime = Date.now();
    const projectPath = cwd || terminal.projectPath || terminal.cwd;

    const profileManager = getClaudeProfileManager();
    const activeProfile = profileId
      ? profileManager.getProfile(profileId)
      : profileManager.getActiveProfile();

    const previousProfileId = terminal.claudeProfileId;
    terminal.claudeProfileId = activeProfile?.id;

    const cwdCommand = cwd ? `cd "${cwd}" && ` : '';
    const needsEnvOverride = profileId && profileId !== previousProfileId;

    if (needsEnvOverride && activeProfile && !activeProfile.isDefault) {
      const token = profileManager.getProfileToken(activeProfile.id);

      if (token) {
        const tempFile = path.join(os.tmpdir(), `.claude-token-${Date.now()}`);
        fs.writeFileSync(tempFile, `export CLAUDE_CODE_OAUTH_TOKEN="${token}"\n`, { mode: 0o600 });

        terminal.pty.write(`${cwdCommand}source "${tempFile}" && rm -f "${tempFile}" && claude\r`);
        console.log('[TerminalManager] Switching to Claude profile:', activeProfile.name, '(via secure temp file)');
        return;
      } else if (activeProfile.configDir) {
        terminal.pty.write(`${cwdCommand}CLAUDE_CONFIG_DIR="${activeProfile.configDir}" claude\r`);
        console.log('[TerminalManager] Using Claude profile:', activeProfile.name, 'config:', activeProfile.configDir);
        return;
      }
    }

    if (activeProfile && !activeProfile.isDefault) {
      console.log('[TerminalManager] Using Claude profile:', activeProfile.name, '(from terminal environment)');
    }

    terminal.pty.write(`${cwdCommand}claude\r`);

    if (activeProfile) {
      profileManager.markProfileUsed(activeProfile.id);
    }

    const win = this.getWindow();
    if (win) {
      const title = activeProfile && !activeProfile.isDefault
        ? `Claude (${activeProfile.name})`
        : 'Claude';
      win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, id, title);
    }

    if (terminal.projectPath) {
      SessionHandler.persistSession(terminal);
    }

    if (projectPath) {
      SessionHandler.captureClaudeSessionId(
        id,
        projectPath,
        startTime,
        this.terminals,
        this.getWindow
      );
    }
  }

  /**
   * Switch a terminal to a different Claude profile
   */
  async switchClaudeProfile(id: string, profileId: string): Promise<TerminalOperationResult> {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return { success: false, error: 'Terminal not found' };
    }

    const profileManager = getClaudeProfileManager();
    const profile = profileManager.getProfile(profileId);
    if (!profile) {
      return { success: false, error: 'Profile not found' };
    }

    console.log('[TerminalManager] Switching to Claude profile:', profile.name);

    if (terminal.isClaudeMode) {
      terminal.pty.write('\x03');
      await new Promise(resolve => setTimeout(resolve, 500));
      terminal.pty.write('/exit\r');
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    this.lastNotifiedRateLimitReset.delete(id);

    const projectPath = terminal.projectPath || terminal.cwd;
    this.invokeClaude(id, projectPath, profileId);

    profileManager.setActiveProfile(profileId);

    return { success: true };
  }

  /**
   * Resume Claude in a terminal with a specific session ID
   */
  resumeClaude(id: string, sessionId?: string): void {
    const terminal = this.terminals.get(id);
    if (!terminal) {
      return;
    }

    terminal.isClaudeMode = true;

    let command: string;
    if (sessionId) {
      command = `claude --resume "${sessionId}"`;
      terminal.claudeSessionId = sessionId;
    } else {
      command = 'claude --continue';
    }

    terminal.pty.write(`${command}\r`);

    const win = this.getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, id, 'Claude');
    }
  }

  /**
   * Get saved sessions for a project
   */
  getSavedSessions(projectPath: string): TerminalSession[] {
    return SessionHandler.getSavedSessions(projectPath);
  }

  /**
   * Clear saved sessions for a project
   */
  clearSavedSessions(projectPath: string): void {
    SessionHandler.clearSavedSessions(projectPath);
  }

  /**
   * Get available session dates
   */
  getAvailableSessionDates(projectPath?: string): import('../terminal-session-store').SessionDateInfo[] {
    return SessionHandler.getAvailableSessionDates(projectPath);
  }

  /**
   * Get sessions for a specific date
   */
  getSessionsForDate(date: string, projectPath: string): TerminalSession[] {
    return SessionHandler.getSessionsForDate(date, projectPath);
  }

  /**
   * Restore all sessions from a specific date
   */
  async restoreSessionsFromDate(
    date: string,
    projectPath: string,
    cols = 80,
    rows = 24
  ): Promise<{ restored: number; failed: number; sessions: Array<{ id: string; success: boolean; error?: string }> }> {
    const sessions = SessionHandler.getSessionsForDate(date, projectPath);
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
    SessionHandler.persistAllSessions(this.terminals);

    if (this.saveTimer) {
      clearInterval(this.saveTimer);
      this.saveTimer = null;
    }

    const promises: Promise<void>[] = [];

    this.terminals.forEach((terminal) => {
      promises.push(
        new Promise((resolve) => {
          try {
            PtyManager.killPty(terminal);
          } catch {
            // Ignore errors during cleanup
          }
          resolve();
        })
      );
    });

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
