/**
 * PTY Manager Module
 * Handles low-level PTY process creation and lifecycle
 */

import * as pty from '@lydell/node-pty';
import * as os from 'os';
import * as path from 'path';
import { existsSync, readFileSync } from 'fs';
import type { TerminalProcess, WindowGetter } from './types';
import { IPC_CHANNELS } from '../../shared/constants';
import { getClaudeProfileManager } from '../claude-profile-manager';
import { readSettingsFile } from '../settings-utils';
import type { SupportedTerminal } from '../../shared/types/settings';
import type { CondaActivationResult, CondaActivationError } from '../../shared/types/conda';
import { getCondaPythonPath } from '../python-path-utils';

/**
 * Windows shell paths for different terminal preferences
 */
const WINDOWS_SHELL_PATHS: Record<string, string[]> = {
  powershell: [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',  // PowerShell 7 (Core)
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',  // Windows PowerShell 5.1
  ],
  windowsterminal: [
    'C:\\Program Files\\PowerShell\\7\\pwsh.exe',  // Prefer PowerShell Core in Windows Terminal
    'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
  ],
  cmd: [
    'C:\\Windows\\System32\\cmd.exe',
  ],
  gitbash: [
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe',
  ],
  cygwin: [
    'C:\\cygwin64\\bin\\bash.exe',
    'C:\\cygwin\\bin\\bash.exe',
  ],
  msys2: [
    'C:\\msys64\\usr\\bin\\bash.exe',
    'C:\\msys32\\usr\\bin\\bash.exe',
  ],
};

/**
 * Get the Windows shell executable based on preferred terminal setting
 */
function getWindowsShell(preferredTerminal: SupportedTerminal | undefined): string {
  // If no preference or 'system', use COMSPEC (usually cmd.exe)
  if (!preferredTerminal || preferredTerminal === 'system') {
    return process.env.COMSPEC || 'cmd.exe';
  }

  // Check if we have paths defined for this terminal type
  const paths = WINDOWS_SHELL_PATHS[preferredTerminal];
  if (paths) {
    // Find the first existing shell
    for (const shellPath of paths) {
      if (existsSync(shellPath)) {
        return shellPath;
      }
    }
  }

  // Fallback to COMSPEC for unrecognized terminals
  return process.env.COMSPEC || 'cmd.exe';
}

/**
 * Spawn a new PTY process with appropriate shell and environment
 */
export function spawnPtyProcess(
  cwd: string,
  cols: number,
  rows: number,
  profileEnv?: Record<string, string>
): { pty: pty.IPty; initCommand?: string } {
  // Read user's preferred terminal setting
  const settings = readSettingsFile();
  const preferredTerminal = settings?.preferredTerminal as SupportedTerminal | undefined;

  const shell = process.platform === 'win32'
    ? getWindowsShell(preferredTerminal)
    : process.env.SHELL || '/bin/zsh';

  // On Windows, use -NoProfile to prevent user profile scripts from running
  // (which can spawn external windows or run slow/failing commands)
  // On Unix, use -l for login shell
  const shellArgs = process.platform === 'win32' ? ['-NoProfile'] : ['-l'];

  console.warn('[PtyManager] Spawning shell:', shell, shellArgs, '(preferred:', preferredTerminal || 'system', ')');

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

  // Read activation script from settings
  const activationScript = settings?.pythonActivationScript;

  let initCommand: string | undefined;
  if (activationScript && existsSync(activationScript)) {
    // Detect if the spawned shell is bash-type (Git Bash, Cygwin, MSYS2)
    const isBashShell = shell.toLowerCase().includes('bash.exe');

    if (process.platform === 'win32') {
      if (isBashShell) {
        // For bash shells on Windows, skip PowerShell .ps1 scripts
        // They can't execute .ps1 files. Only .bat files might work via cmd /c
        if (!activationScript.toLowerCase().endsWith('.ps1')) {
          // Try to execute .bat file via cmd
          initCommand = `cmd.exe /c "${activationScript}"\r`;
        } else {
          // Skip .ps1 activation for bash terminals
          console.warn('[PtyManager] Skipping PowerShell activation script for bash shell:', shell);
        }
      } else {
        // For cmd/PowerShell terminals
        if (activationScript.toLowerCase().endsWith('.ps1')) {
          // PowerShell script
          initCommand = `powershell -NoProfile -Command "& '${activationScript}'"\r`;
        } else {
          // Batch file
          initCommand = `call "${activationScript}"\r`;
        }
      }
    } else {
      // Unix-like systems
      initCommand = `source "${activationScript}"\n`;
    }
  }

  return { pty: ptyProcess, initCommand };
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
    console.warn('[PtyManager] Terminal exited:', id, 'code:', exitCode);

    const win = getWindow();
    if (win) {
      win.webContents.send(IPC_CHANNELS.TERMINAL_EXIT, id, exitCode);
    }

    // Call custom exit handler
    onExitCallback(terminal);

    terminals.delete(id);
  });
}

/**
 * Write data to a PTY process
 */
export function writeToPty(terminal: TerminalProcess, data: string): void {
  terminal.pty.write(data);
}

/**
 * Resize a PTY process
 */
export function resizePty(terminal: TerminalProcess, cols: number, rows: number): void {
  terminal.pty.resize(cols, rows);
}

/**
 * Kill a PTY process
 */
export function killPty(terminal: TerminalProcess): void {
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
