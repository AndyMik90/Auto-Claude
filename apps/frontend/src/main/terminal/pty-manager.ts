/**
 * PTY Manager Module
 * Handles low-level PTY process creation and lifecycle
 */

import * as pty from '@lydell/node-pty';
import * as os from 'os';
import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import type { TerminalProcess, WindowGetter, WindowsShellType } from './types';
import { isWindows, getWindowsShellPaths } from '../platform';
import { IPC_CHANNELS } from '../../shared/constants';
import { getClaudeProfileManager } from '../claude-profile-manager';
import { readSettingsFile } from '../settings-utils';
import { debugLog, debugError } from '../../shared/utils/debug-logger';
import type { SupportedTerminal } from '../../shared/types/settings';
import type { CondaActivationResult, CondaActivationError } from '../../shared/types/conda';
import { getCondaPythonPath } from '../python-path-utils';

// Windows shell paths are now imported from the platform module via getWindowsShellPaths()

/**
 * Result of spawning a PTY process
 */
export interface SpawnPtyResult {
  pty: pty.IPty;
  /** Shell type for Windows (affects command chaining syntax) */
  shellType?: WindowsShellType;
}

/**
 * Result of Windows shell detection
 */
interface WindowsShellResult {
  shell: string;
  shellType: WindowsShellType;
}

/**
 * Track pending exit promises for terminals being destroyed.
 * Used to wait for PTY process exit on Windows where termination is async.
 */
const pendingExitPromises = new Map<string, {
  resolve: () => void;
  timeoutId: NodeJS.Timeout;
}>();

/**
 * Default timeouts for waiting for PTY exit (in milliseconds).
 * Windows needs longer timeout due to slower process termination.
 */
const PTY_EXIT_TIMEOUT_WINDOWS = 2000;
const PTY_EXIT_TIMEOUT_UNIX = 500;

/**
 * Wait for a PTY process to exit.
 * Returns a promise that resolves when the PTY's onExit event fires.
 * Has a timeout fallback in case the exit event never fires.
 */
export function waitForPtyExit(terminalId: string, timeoutMs?: number): Promise<void> {
  const timeout = timeoutMs ?? (isWindows() ? PTY_EXIT_TIMEOUT_WINDOWS : PTY_EXIT_TIMEOUT_UNIX);

  return new Promise<void>((resolve) => {
    // Set up timeout fallback
    const timeoutId = setTimeout(() => {
      debugLog('[PtyManager] PTY exit timeout for terminal:', terminalId);
      pendingExitPromises.delete(terminalId);
      resolve();
    }, timeout);

    // Store the promise resolver
    pendingExitPromises.set(terminalId, { resolve, timeoutId });
  });
}

/**
 * Determine shell type from shell path.
 * Only PowerShell 5.1 (powershell.exe) needs special handling with ';' separator.
 * PowerShell 7+ (pwsh.exe) supports '&&' like cmd.exe.
 */
function detectShellType(shellPath: string): WindowsShellType {
  // Extract just the filename from the path
  const filename = shellPath.split(/[/\\]/).pop()?.toLowerCase() || '';
  // Only powershell.exe (PS 5.1) needs ';' separator
  // pwsh.exe (PS 7+) supports '&&' so we treat it like cmd
  if (filename === 'powershell.exe') {
    return 'powershell';
  }
  // Everything else (cmd, pwsh, bash, etc.) uses && syntax
  return 'cmd';
}

/**
 * Get the Windows shell executable based on preferred terminal setting
 */
function getWindowsShell(preferredTerminal: SupportedTerminal | undefined): WindowsShellResult {
  // If no preference or 'system', use COMSPEC (usually cmd.exe)
  if (!preferredTerminal || preferredTerminal === 'system') {
    const shell = process.env.COMSPEC || 'cmd.exe';
    return { shell, shellType: detectShellType(shell) };
  }

  // Check if we have paths defined for this terminal type (from platform module)
  const windowsShellPaths = getWindowsShellPaths();
  const paths = windowsShellPaths[preferredTerminal];
  if (paths) {
    // Find the first existing shell
    for (const shellPath of paths) {
      if (existsSync(shellPath)) {
        return { shell: shellPath, shellType: detectShellType(shellPath) };
      }
    }
  }

  // Fallback to COMSPEC for unrecognized terminals
  const shell = process.env.COMSPEC || 'cmd.exe';
  return { shell, shellType: detectShellType(shell) };
}

/**
 * Spawn a new PTY process with appropriate shell and environment
 */
export function spawnPtyProcess(
  cwd: string,
  cols: number,
  rows: number,
  profileEnv?: Record<string, string>
): SpawnPtyResult {
  // Read user's preferred terminal setting
  const settings = readSettingsFile();
  const preferredTerminal = settings?.preferredTerminal as SupportedTerminal | undefined;

  let shell: string;
  let shellType: WindowsShellType | undefined;

  if (isWindows()) {
    const windowsShell = getWindowsShell(preferredTerminal);
    shell = windowsShell.shell;
    shellType = windowsShell.shellType;
  } else {
    shell = process.env.SHELL || '/bin/zsh';
    shellType = undefined; // Not applicable on Unix
  }

  const shellArgs = isWindows() ? [] : ['-l'];

  debugLog('[PtyManager] Spawning shell:', shell, shellArgs, '(preferred:', preferredTerminal || 'system', ', shellType:', shellType, ')');

  // Create a clean environment without DEBUG to prevent Claude Code from
  // enabling debug mode when the Electron app is run in development mode.
  // Also remove ANTHROPIC_API_KEY to ensure Claude Code uses OAuth tokens
  // (CLAUDE_CODE_OAUTH_TOKEN from profileEnv) instead of API keys that may
  // be present in the shell environment. Without this, Claude Code would
  // show "Claude API" instead of "Claude Max" when ANTHROPIC_API_KEY is set.
  const { DEBUG: _DEBUG, ANTHROPIC_API_KEY: _ANTHROPIC_API_KEY, ...cleanEnv } = process.env;

  const ptyProcess = pty.spawn(shell, shellArgs, {
    name: 'xterm-256color',
    cols,
    rows,
    cwd: cwd || os.homedir(),
    env: {
      ...cleanEnv,
      ...profileEnv,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
    },
  });

  return { pty: ptyProcess, shellType };
}

/**
 * Setup PTY event handlers for a terminal process
 */
export function setupPtyHandlers(
  terminal: TerminalProcess,
  terminals: Map<string, TerminalProcess>,
  getWindow: WindowGetter,
  onDataCallback: (terminal: TerminalProcess, data: string) => void,
  onExitCallback: (terminal: TerminalProcess) => void
): void {
  const { id, pty: ptyProcess } = terminal;

  // Handle data from terminal
  ptyProcess.onData((data) => {
    // Append to output buffer (limit to 100KB)
    terminal.outputBuffer = (terminal.outputBuffer + data).slice(-100000);

    // Call custom data handler
    onDataCallback(terminal, data);

    // Send to renderer
    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_OUTPUT, id, data);
    }
  });

  // Handle terminal exit
  ptyProcess.onExit(({ exitCode }) => {
    debugLog('[PtyManager] Terminal exited:', id, 'code:', exitCode);

    // Resolve any pending exit promise FIRST (before other cleanup)
    const pendingExit = pendingExitPromises.get(id);
    if (pendingExit) {
      clearTimeout(pendingExit.timeoutId);
      pendingExitPromises.delete(id);
      pendingExit.resolve();
    }

    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, id, exitCode);
    }

    // Call custom exit handler
    onExitCallback(terminal);

    // Only delete if this is the SAME terminal object (not a newly created one with same ID).
    // This prevents a race where destroyTerminal() awaits PTY exit, a new terminal is created
    // with the same ID during the await, and then the old PTY's onExit deletes the new terminal.
    if (terminals.get(id) === terminal) {
      terminals.delete(id);
    }
  });
}

/**
 * Constants for chunked write behavior
 * CHUNKED_WRITE_THRESHOLD: Data larger than this (bytes) will be written in chunks
 * CHUNK_SIZE: Size of each chunk - smaller chunks yield to event loop more frequently
 */
const CHUNKED_WRITE_THRESHOLD = 1000;
const CHUNK_SIZE = 100;

/**
 * Write queue per terminal to prevent interleaving of concurrent writes.
 * Maps terminal ID to the last write Promise in the queue.
 */
const pendingWrites = new Map<string, Promise<void>>();

/**
 * Internal function to perform the actual write (chunked or direct)
 * Returns a Promise that resolves when the write is complete
 */
function performWrite(terminal: TerminalProcess, data: string): Promise<void> {
  return new Promise((resolve) => {
    // For large commands, write in chunks to prevent blocking
    if (data.length > CHUNKED_WRITE_THRESHOLD) {
      debugLog('[PtyManager:writeToPty] Large write detected, using chunked write');
      let offset = 0;
      let chunkNum = 0;

      const writeChunk = () => {
        // Check if terminal is still valid before writing
        if (!terminal.pty) {
          debugError('[PtyManager:writeToPty] Terminal PTY no longer valid, aborting chunked write');
          resolve();
          return;
        }

        if (offset >= data.length) {
          debugLog('[PtyManager:writeToPty] Chunked write completed, total chunks:', chunkNum);
          resolve();
          return;
        }

        const chunk = data.slice(offset, offset + CHUNK_SIZE);
        chunkNum++;
        try {
          terminal.pty.write(chunk);
          offset += CHUNK_SIZE;
          // Use setImmediate to yield to the event loop between chunks
          setImmediate(writeChunk);
        } catch (error) {
          debugError('[PtyManager:writeToPty] Chunked write FAILED at chunk', chunkNum, ':', error);
          resolve(); // Resolve anyway - fire-and-forget semantics
        }
      };

      // Start the chunked write after yielding
      setImmediate(writeChunk);
    } else {
      try {
        terminal.pty.write(data);
        debugLog('[PtyManager:writeToPty] Write completed successfully');
      } catch (error) {
        debugError('[PtyManager:writeToPty] Write FAILED:', error);
      }
      resolve();
    }
  });
}

/**
 * Write data to a PTY process
 * Uses setImmediate to prevent blocking the event loop on large writes.
 * Serializes writes per terminal to prevent interleaving of concurrent writes.
 */
export function writeToPty(terminal: TerminalProcess, data: string): void {
  debugLog('[PtyManager:writeToPty] About to write to pty, data length:', data.length);

  // Get the previous write Promise for this terminal (if any)
  const previousWrite = pendingWrites.get(terminal.id) || Promise.resolve();

  // Chain this write after the previous one completes
  const currentWrite = previousWrite.then(() => performWrite(terminal, data));

  // Update the pending write for this terminal
  pendingWrites.set(terminal.id, currentWrite);

  // Clean up the Map entry when done to prevent memory leaks
  currentWrite.finally(() => {
    // Only clean up if this is still the latest write
    if (pendingWrites.get(terminal.id) === currentWrite) {
      pendingWrites.delete(terminal.id);
    }
  });
}

/**
 * Resize a PTY process
 */
export function resizePty(terminal: TerminalProcess, cols: number, rows: number): void {
  terminal.pty.resize(cols, rows);
}

/**
 * Kill a PTY process.
 * @param terminal The terminal process to kill
 * @param waitForExit If true, returns a promise that resolves when the PTY exits.
 *                    Used on Windows where PTY termination is async.
 */
export function killPty(terminal: TerminalProcess, waitForExit: true): Promise<void>;
export function killPty(terminal: TerminalProcess, waitForExit?: false): void;
export function killPty(terminal: TerminalProcess, waitForExit?: boolean): Promise<void> | void {
  if (waitForExit) {
    const exitPromise = waitForPtyExit(terminal.id);
    try {
      terminal.pty.kill();
    } catch (error) {
      // Clean up the pending promise if kill() throws
      const pending = pendingExitPromises.get(terminal.id);
      if (pending) {
        clearTimeout(pending.timeoutId);
        pendingExitPromises.delete(terminal.id);
        pending.resolve();
      }
      throw error;
    }
    return exitPromise;
  }
  terminal.pty.kill();
}

/**
 * Get the active Claude profile environment variables
 */
export function getActiveProfileEnv(): Record<string, string> {
  const profileManager = getClaudeProfileManager();
  return profileManager.getActiveProfileEnv();
}

// ============================================================================
// Conda Environment Activation
// ============================================================================

/**
 * Read the conda base path from the .conda_base file in an environment
 * This file is created during environment setup and stores the path to the
 * Conda installation used to create the environment.
 * The file is located at {envPath}/activate/.conda_base
 */
export function readCondaBase(envPath: string): string | null {
  // The .conda_base file is in the activate subdirectory
  const condaBasePath = path.join(envPath, 'activate', '.conda_base');
  if (existsSync(condaBasePath)) {
    try {
      return readFileSync(condaBasePath, 'utf-8').trim();
    } catch (error) {
      console.warn('[PtyManager] Failed to read .conda_base:', error);
      return null;
    }
  }
  return null;
}

/**
 * Options for getting activation command
 */
export interface ActivationOptions {
  /** Path to the conda environment */
  envPath: string;
  /** Path to the python root (where scripts/ directory is located) */
  pythonRoot?: string;
  /** Project name (used in init script filename) */
  projectName?: string;
}

/**
 * Get the shell command to activate a conda environment
 * Uses the generated init scripts in {pythonRoot}/scripts/
 */
export function getActivationCommand(options: ActivationOptions, platform: NodeJS.Platform): string | null {
  const { envPath, pythonRoot, projectName } = options;

  const condaBase = readCondaBase(envPath);
  if (!condaBase) {
    return null;
  }

  if (platform === 'win32') {
    // Windows: Use the generated PowerShell init script
    // This script is at {pythonRoot}/scripts/init-{projectName}.ps1
    if (pythonRoot && projectName) {
      const initScript = path.join(pythonRoot, 'scripts', `init-${projectName}.ps1`);
      if (existsSync(initScript)) {
        // Use & to invoke the script in PowerShell
        return `& "${initScript}"`;
      }
    }

    // Fallback: Try the activate script in the environment
    const ps1Script = path.join(envPath, 'activate', 'activate.ps1');
    if (existsSync(ps1Script)) {
      return `& "${ps1Script}"`;
    }

    // Last resort: Use conda hook for PowerShell activation
    return `& "${condaBase}\\shell\\condabin\\conda-hook.ps1" ; conda activate "${envPath}"`;
  } else {
    // Unix: Use the generated shell init script
    if (pythonRoot && projectName) {
      const initScript = path.join(pythonRoot, 'scripts', `init-${projectName}.sh`);
      if (existsSync(initScript)) {
        return `source "${initScript}"`;
      }
    }

    // Fallback: Try the activate script in the environment
    const shScript = path.join(envPath, 'activate', 'activate.sh');
    if (existsSync(shScript)) {
      return `source "${shScript}"`;
    }

    // Last resort: Source conda.sh and then activate the environment
    return `source "${condaBase}/etc/profile.d/conda.sh" && conda activate "${envPath}"`;
  }
}

/**
 * Validate that a conda environment exists and is usable
 */
export async function validateCondaEnv(envPath: string): Promise<CondaActivationResult> {
  // Check if environment directory exists
  if (!existsSync(envPath)) {
    return {
      success: false,
      error: 'env_not_found',
      message: `Environment directory not found: ${envPath}`
    };
  }

  // Check if .conda_base file exists (required for activation)
  const condaBase = readCondaBase(envPath);
  if (!condaBase) {
    return {
      success: false,
      error: 'env_broken',
      message: 'Missing .conda_base file - environment may need to be recreated'
    };
  }

  // Check if conda base installation still exists
  if (!existsSync(condaBase)) {
    return {
      success: false,
      error: 'conda_not_found',
      message: `Conda installation not found: ${condaBase}`
    };
  }

  // Check for Python executable in the environment
  const pythonPath = getCondaPythonPath(envPath);

  if (!existsSync(pythonPath)) {
    return {
      success: false,
      error: 'env_broken',
      message: 'Python executable not found in environment'
    };
  }

  return {
    success: true,
    message: 'Environment is valid and ready for activation'
  };
}

/**
 * Write conda activation warning to PTY
 * Uses shell-specific echo commands to safely output warnings without
 * the text being interpreted as commands (e.g., PowerShell [!] syntax)
 */
export function writeCondaWarning(
  ptyProcess: pty.IPty,
  error: CondaActivationError,
  envPath: string
): void {
  const errorMessages: Record<CondaActivationError, string> = {
    'env_not_found': 'Environment directory not found',
    'env_broken': 'Environment is broken or corrupted',
    'conda_not_found': 'Conda installation not found',
    'activation_failed': 'Failed to activate environment',
    'script_not_found': 'Activation script not found'
  };

  const message = errorMessages[error] || 'Unknown error';

  // Use shell-specific echo to output warning without interpretation
  // PowerShell interprets [!] as an invocation expression causing parse errors
  if (process.platform === 'win32') {
    // On Windows, use Write-Host to output warnings safely
    // Escape single quotes in paths for PowerShell
    const escapedPath = envPath.replace(/'/g, "''");
    ptyProcess.write(`Write-Host -ForegroundColor Yellow '(!) Conda environment not available: ${message}'\r`);
    ptyProcess.write(`Write-Host -ForegroundColor Yellow '    Path: ${escapedPath}'\r`);
    ptyProcess.write(`Write-Host -ForegroundColor Yellow '    Run setup in Project Settings > Python Env to fix.'\r`);
  } else {
    // On Unix, use ANSI escape codes with echo
    ptyProcess.write(`echo -e '\\033[33m[!] Conda environment not available: ${message}\\033[0m'\r`);
    ptyProcess.write(`echo -e '\\033[33m    Path: ${envPath}\\033[0m'\r`);
    ptyProcess.write(`echo -e '\\033[33m    Run setup in Project Settings > Python Env to fix.\\033[0m'\r`);
  }
}

/**
 * Options for conda activation injection
 */
export interface CondaActivationOptions {
  /** Path to the conda environment */
  envPath: string;
  /** Path to the python root (where scripts/ directory is located) */
  pythonRoot?: string;
  /** Project name (used in init script filename) */
  projectName?: string;
}

/**
 * Inject conda activation command into PTY after shell initialization
 * Returns true if activation was injected, false if validation failed
 */
export async function injectCondaActivation(
  ptyProcess: pty.IPty,
  options: CondaActivationOptions
): Promise<boolean> {
  const { envPath, pythonRoot, projectName } = options;

  // Validate the environment first
  const validation = await validateCondaEnv(envPath);

  if (!validation.success) {
    console.warn('[PtyManager] Conda environment validation failed:', validation.message);
    writeCondaWarning(ptyProcess, validation.error!, envPath);
    return false;
  }

  // Get the activation command
  const command = getActivationCommand({ envPath, pythonRoot, projectName }, process.platform);
  if (!command) {
    writeCondaWarning(ptyProcess, 'activation_failed', envPath);
    return false;
  }

  // Small delay to let shell initialize before injecting activation
  setTimeout(() => {
    console.warn('[PtyManager] Injecting conda activation command:', command);
    ptyProcess.write(command + '\r');
  }, 500);

  return true;
}
