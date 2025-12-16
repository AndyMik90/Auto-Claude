/**
 * Terminal Lifecycle
 * Handles terminal creation, restoration, and destruction operations
 */

import * as os from 'os';
import type { TerminalCreateOptions } from '../../shared/types';
import { IPC_CHANNELS } from '../../shared/constants';
import type { TerminalSession } from '../terminal-session-store';
import * as PtyManager from './pty-manager';
import * as SessionHandler from './session-handler';
import * as TerminalEventHandler from './terminal-event-handler';
import type {
  TerminalProcess,
  WindowGetter,
  TerminalOperationResult
} from './types';

/**
 * Options for terminal restoration
 */
export interface RestoreOptions {
  resumeClaudeSession: boolean;
  captureSessionId: (terminalId: string, projectPath: string, startTime: number) => void;
}

/**
 * Data handler function type
 */
export type DataHandlerFn = (terminal: TerminalProcess, data: string) => void;

/**
 * Create a new terminal process
 */
export async function createTerminal(
  options: TerminalCreateOptions & { projectPath?: string },
  terminals: Map<string, TerminalProcess>,
  getWindow: WindowGetter,
  dataHandler: DataHandlerFn
): Promise<TerminalOperationResult> {
  const { id, cwd, cols = 80, rows = 24, projectPath } = options;

  console.log('[TerminalLifecycle] Creating terminal:', { id, cwd, cols, rows, projectPath });

  if (terminals.has(id)) {
    console.log('[TerminalLifecycle] Terminal already exists, returning success:', id);
    return { success: true };
  }

  try {
    const profileEnv = PtyManager.getActiveProfileEnv();

    if (profileEnv.CLAUDE_CODE_OAUTH_TOKEN) {
      console.log('[TerminalLifecycle] Injecting OAuth token from active profile');
    }

    const ptyProcess = PtyManager.spawnPtyProcess(
      cwd || os.homedir(),
      cols,
      rows,
      profileEnv
    );

    console.log('[TerminalLifecycle] PTY process spawned, pid:', ptyProcess.pid);

    const terminalCwd = cwd || os.homedir();
    const terminal: TerminalProcess = {
      id,
      pty: ptyProcess,
      isClaudeMode: false,
      projectPath,
      cwd: terminalCwd,
      outputBuffer: '',
      title: `Terminal ${terminals.size + 1}`
    };

    terminals.set(id, terminal);

    PtyManager.setupPtyHandlers(
      terminal,
      terminals,
      getWindow,
      (term, data) => dataHandler(term, data),
      (term) => handleTerminalExit(term, terminals)
    );

    if (projectPath) {
      SessionHandler.persistSession(terminal);
    }

    console.log('[TerminalLifecycle] Terminal created successfully:', id);
    return { success: true };
  } catch (error) {
    console.error('[TerminalLifecycle] Error creating terminal:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create terminal',
    };
  }
}

/**
 * Restore a terminal session
 */
export async function restoreTerminal(
  session: TerminalSession,
  terminals: Map<string, TerminalProcess>,
  getWindow: WindowGetter,
  dataHandler: DataHandlerFn,
  options: RestoreOptions,
  cols = 80,
  rows = 24
): Promise<TerminalOperationResult> {
  console.log('[TerminalLifecycle] Restoring terminal session:', session.id, 'Claude mode:', session.isClaudeMode);

  const result = await createTerminal(
    {
      id: session.id,
      cwd: session.cwd,
      cols,
      rows,
      projectPath: session.projectPath
    },
    terminals,
    getWindow,
    dataHandler
  );

  if (!result.success) {
    return result;
  }

  const terminal = terminals.get(session.id);
  if (!terminal) {
    return { success: false, error: 'Terminal not found after creation' };
  }

  terminal.title = session.title;

  if (session.isClaudeMode && options.resumeClaudeSession) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    terminal.isClaudeMode = true;
    terminal.claudeSessionId = session.claudeSessionId;

    const projectDir = session.cwd || session.projectPath;
    const startTime = Date.now();
    const clearCmd = process.platform === 'win32' ? 'cls' : 'clear';

    let resumeCommand: string;
    if (session.claudeSessionId) {
      resumeCommand = `${clearCmd} && cd "${projectDir}" && claude --resume "${session.claudeSessionId}"`;
      console.log('[TerminalLifecycle] Resuming Claude with session ID:', session.claudeSessionId, 'in', projectDir);
    } else {
      resumeCommand = `${clearCmd} && cd "${projectDir}" && claude --resume`;
      console.log('[TerminalLifecycle] Opening Claude session picker in', projectDir);
    }

    terminal.pty.write(`${resumeCommand}\r`);

    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_TITLE_CHANGE, session.id, 'Claude');
    }

    if (!session.claudeSessionId && projectDir) {
      options.captureSessionId(session.id, projectDir, startTime);
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
export async function destroyTerminal(
  id: string,
  terminals: Map<string, TerminalProcess>,
  onCleanup: (terminalId: string) => void
): Promise<TerminalOperationResult> {
  const terminal = terminals.get(id);
  if (!terminal) {
    return { success: false, error: 'Terminal not found' };
  }

  try {
    SessionHandler.removePersistedSession(terminal);
    onCleanup(id);
    PtyManager.killPty(terminal);
    terminals.delete(id);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to destroy terminal',
    };
  }
}

/**
 * Kill all terminal processes
 */
export async function destroyAllTerminals(
  terminals: Map<string, TerminalProcess>,
  saveTimer: NodeJS.Timeout | null
): Promise<NodeJS.Timeout | null> {
  SessionHandler.persistAllSessions(terminals);

  if (saveTimer) {
    clearInterval(saveTimer);
    saveTimer = null;
  }

  const promises: Promise<void>[] = [];

  terminals.forEach((terminal) => {
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
  terminals.clear();

  return saveTimer;
}

/**
 * Handle terminal exit event
 */
function handleTerminalExit(
  terminal: TerminalProcess,
  terminals: Map<string, TerminalProcess>
): void {
  SessionHandler.removePersistedSession(terminal);
}

/**
 * Restore multiple sessions from a specific date
 */
export async function restoreSessionsFromDate(
  date: string,
  projectPath: string,
  terminals: Map<string, TerminalProcess>,
  getWindow: WindowGetter,
  dataHandler: DataHandlerFn,
  options: RestoreOptions,
  cols = 80,
  rows = 24
): Promise<{ restored: number; failed: number; sessions: Array<{ id: string; success: boolean; error?: string }> }> {
  const sessions = SessionHandler.getSessionsForDate(date, projectPath);
  const results: Array<{ id: string; success: boolean; error?: string }> = [];

  for (const session of sessions) {
    const result = await restoreTerminal(
      session,
      terminals,
      getWindow,
      dataHandler,
      options,
      cols,
      rows
    );
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
