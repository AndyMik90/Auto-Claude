/**
 * Claude Code CLI Handlers
 *
 * IPC handlers for Claude Code CLI version checking and installation.
 * Provides functionality to:
 * - Check installed vs latest version
 * - Open terminal with installation command
 */

import { ipcMain } from 'electron';
import { exec, execFileSync, spawn, execFile } from 'child_process';
import { existsSync, readFileSync, promises as fsPromises } from 'fs';
import { mkdir, rename, unlink } from 'fs/promises';
import path from 'path';
import os from 'os';
import { promisify } from 'util';
import { IPC_CHANNELS, DEFAULT_APP_SETTINGS } from '../../shared/constants';
import type { IPCResult } from '../../shared/types';
import type { ClaudeCodeVersionInfo, ClaudeInstallationList, ClaudeInstallationInfo } from '../../shared/types/cli';
import { getToolInfo, configureTools, sortNvmVersionDirs, getClaudeDetectionPaths, type ExecFileAsyncOptionsWithVerbatim } from '../cli-tool-manager';
import { readSettingsFile, writeSettingsFile } from '../settings-utils';
import { isSecurePath, isWindows as platformIsWindows, isMacOS, isLinux, getCurrentOS, normalizeExecutablePath, expandWindowsEnvVars, joinPaths, getEnvVar, findExecutable, getPathDelimiter, getTerminalLauncherPaths } from '../platform';
import { getClaudeProfileManager } from '../claude-profile-manager';
import { isValidConfigDir } from '../utils/config-path-validator';
import semver from 'semver';

const execFileAsync = promisify(execFile);

// Cache for latest version (avoid hammering npm registry)
let cachedLatestVersion: { version: string; timestamp: number } | null = null;
let cachedVersionList: { versions: string[]; timestamp: number } | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const VERSION_LIST_CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour for version list

/**
 * Validate a Claude CLI path and get its version
 * @param cliPath - Path to the Claude CLI executable
 * @returns Tuple of [isValid, version or null]
 */
async function validateClaudeCliAsync(cliPath: string): Promise<[boolean, string | null]> {
  try {
    const isWindows = platformIsWindows();

    // Normalize the path on Windows to handle missing extensions
    // e.g., C:\...\npm\claude -> C:\...\npm\claude.cmd
    const normalizedCliPath = normalizeExecutablePath(cliPath);

    // Security validation: reject paths with shell metacharacters or directory traversal
    if (isWindows && !isSecurePath(normalizedCliPath)) {
      throw new Error(`Claude CLI path failed security validation: ${normalizedCliPath}`);
    }

    // Augment PATH with the CLI directory for proper resolution
    const cliDir = path.dirname(normalizedCliPath);
    // Use getEnvVar for case-insensitive Windows environment variable access
    const pathValue = getEnvVar('PATH') || '';
    const env = {
      ...process.env,
      PATH: cliDir ? `${cliDir}${getPathDelimiter()}${pathValue}` : pathValue,
    };

    let stdout: string;
    // For Windows .cmd/.bat files, use cmd.exe with proper quoting
    // /d = disable AutoRun registry commands
    // /s = strip first and last quotes, preserving inner quotes
    // /c = run command then terminate
    if (isWindows && /\.(cmd|bat)$/i.test(normalizedCliPath)) {
      // Get cmd.exe path from environment or use default
      // Use expandWindowsEnvVars for proper SystemRoot/ComSpec resolution with fallback
      const systemRoot = expandWindowsEnvVars('%SYSTEMROOT%');
      const cmdExe = expandWindowsEnvVars('%COMSPEC%') || joinPaths(systemRoot, 'System32', 'cmd.exe');
      // Use double-quoted command line for paths with spaces
      const cmdLine = `""${normalizedCliPath}" --version"`;
      const execOptions: ExecFileAsyncOptionsWithVerbatim = {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
        windowsVerbatimArguments: true,
        env,
      };
      const result = await execFileAsync(cmdExe, ['/d', '/s', '/c', cmdLine], execOptions);
      stdout = result.stdout;
    } else {
      const result = await execFileAsync(normalizedCliPath, ['--version'], {
        encoding: 'utf-8',
        timeout: 5000,
        windowsHide: true,
        env,
      });
      stdout = result.stdout;
    }

    const version = String(stdout).trim();
    const match = version.match(/(\d+\.\d+\.\d+)/);
    return [true, match ? match[1] : version.split('\n')[0]];
  } catch (error) {
    // Log validation errors to help debug CLI detection issues
    console.warn('[Claude Code] CLI validation failed for', cliPath, ':', error);
    return [false, null];
  }
}

/**
 * Scan all known locations for Claude CLI installations.
 * Returns all found installations with their paths, versions, and sources.
 *
 * Uses getClaudeDetectionPaths() from cli-tool-manager.ts as the single source
 * of truth for detection paths to avoid duplication and ensure consistency.
 *
 * @see cli-tool-manager.ts getClaudeDetectionPaths() for path configuration
 */
async function scanClaudeInstallations(activePath: string | null): Promise<ClaudeInstallationInfo[]> {
  const installations: ClaudeInstallationInfo[] = [];
  const seenPaths = new Set<string>();
  const homeDir = os.homedir();
  const isWindows = platformIsWindows();

  // Normalize activePath for comparison and existence checks (Windows extension handling)
  const normalizedActivePath = activePath
    ? path.resolve(normalizeExecutablePath(activePath))
    : null;

  // Get detection paths from cli-tool-manager (single source of truth)
  const detectionPaths = getClaudeDetectionPaths(homeDir);

  const addInstallation = async (
    cliPath: string,
    source: ClaudeInstallationInfo['source']
  ) => {
    // Normalize path for comparison and extension handling on Windows
    const resolvedPath = path.resolve(cliPath);
    const normalizedCandidate = normalizeExecutablePath(resolvedPath);
    const normalizedPath = path.resolve(normalizedCandidate);
    if (seenPaths.has(normalizedPath)) return;

    if (!existsSync(normalizedCandidate)) return;

    // Security validation: reject paths with shell metacharacters or directory traversal
    if (!isSecurePath(normalizedCandidate)) {
      console.warn('[Claude Code] Rejecting insecure path:', normalizedCandidate);
      return;
    }

    const [isValid, version] = await validateClaudeCliAsync(normalizedCandidate);
    if (!isValid) return;

    seenPaths.add(normalizedPath);
    installations.push({
      path: normalizedPath,
      version,
      source,
      isActive: normalizedActivePath ? normalizedActivePath === normalizedPath : false,
    });
  };

  // 1. Check user-configured path first (if set)
  if (activePath) {
    await addInstallation(activePath, 'user-config');
  }

  // 2. Check system PATH via which/where
  try {
    if (isWindows) {
      const wherePath = findExecutable('where') || 'where';
      const result = await execFileAsync(wherePath, ['claude'], { timeout: 5000 });
      const paths = result.stdout.trim().split('\n').filter(p => p.trim());
      for (const p of paths) {
        await addInstallation(p.trim(), 'system-path');
      }
    } else {
      const whichPath = findExecutable('which') || 'which';
      const result = await execFileAsync(whichPath, ['-a', 'claude'], { timeout: 5000 });
      const paths = result.stdout.trim().split('\n').filter(p => p.trim());
      for (const p of paths) {
        await addInstallation(p.trim(), 'system-path');
      }
    }
  } catch {
    // which/where failed, continue with other methods
  }

  // 3. Homebrew paths (macOS) - from getClaudeDetectionPaths
  if (isMacOS()) {
    for (const p of detectionPaths.homebrewPaths) {
      await addInstallation(p, 'homebrew');
    }
  }

  // 4. NVM paths (Unix) - check Node.js version manager
  if (!isWindows && existsSync(detectionPaths.nvmVersionsDir)) {
    try {
      const entries = await fsPromises.readdir(detectionPaths.nvmVersionsDir, { withFileTypes: true });
      const versionDirs = sortNvmVersionDirs(entries);
      for (const versionName of versionDirs) {
        const nvmClaudePath = path.join(detectionPaths.nvmVersionsDir, versionName, 'bin', 'claude');
        await addInstallation(nvmClaudePath, 'nvm');
      }
    } catch {
      // Failed to read NVM directory
    }
  }

  // 5. Platform-specific standard locations - from getClaudeDetectionPaths
  for (const p of detectionPaths.platformPaths) {
    await addInstallation(p, 'system-path');
  }

  // 6. Additional common paths not in getClaudeDetectionPaths (for broader scanning)
  const additionalPaths = isWindows
    ? [] // Windows paths are well covered by detectionPaths.platformPaths
    : [
        path.join(homeDir, '.npm-global', 'bin', 'claude'),
        path.join(homeDir, '.yarn', 'bin', 'claude'),
        path.join(homeDir, '.claude', 'local', 'claude'),
        path.join(homeDir, 'node_modules', '.bin', 'claude'),
      ];

  for (const p of additionalPaths) {
    await addInstallation(p, 'system-path');
  }

  // Mark the first installation as active if none is explicitly active
  if (installations.length > 0 && !installations.some(i => i.isActive)) {
    installations[0].isActive = true;
  }

  return installations;
}

/**
 * Fetch the latest version of Claude Code from npm registry
 */
async function fetchLatestVersion(): Promise<string> {
  // Check cache first
  if (cachedLatestVersion && Date.now() - cachedLatestVersion.timestamp < CACHE_DURATION_MS) {
    return cachedLatestVersion.version;
  }

  try {
    const response = await fetch('https://registry.npmjs.org/@anthropic-ai/claude-code/latest', {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000), // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const version = data.version;

    if (!version || typeof version !== 'string') {
      throw new Error('Invalid version format from npm registry');
    }

    // Cache the result
    cachedLatestVersion = { version, timestamp: Date.now() };
    return version;
  } catch (error) {
    console.error('[Claude Code] Failed to fetch latest version:', error);
    // Return cached version if available, even if expired
    if (cachedLatestVersion) {
      return cachedLatestVersion.version;
    }
    throw error;
  }
}

/**
 * Fetch available versions of Claude Code from npm registry
 * Returns versions sorted by semver descending (newest first)
 * Limited to last 20 versions for performance
 */
async function fetchAvailableVersions(): Promise<string[]> {
  // Check cache first
  if (cachedVersionList && Date.now() - cachedVersionList.timestamp < VERSION_LIST_CACHE_DURATION_MS) {
    return cachedVersionList.versions;
  }

  try {
    const response = await fetch('https://registry.npmjs.org/@anthropic-ai/claude-code', {
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(15000), // 15 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    const versions = Object.keys(data.versions || {});

    if (!versions.length) {
      throw new Error('No versions found in npm registry');
    }

    // Sort by semver descending (newest first) and take last 20
    const sortedVersions = versions
      .filter(v => semver.valid(v)) // Only valid semver versions
      .sort((a, b) => semver.rcompare(a, b)) // Sort descending
      .slice(0, 20); // Limit to 20 versions

    // Validate we have versions after filtering
    if (sortedVersions.length === 0) {
      throw new Error('No valid semver versions found in npm registry');
    }

    // Cache the result
    cachedVersionList = { versions: sortedVersions, timestamp: Date.now() };
    return sortedVersions;
  } catch (error) {
    console.error('[Claude Code] Failed to fetch available versions:', error);
    // Return cached versions if available, even if expired
    if (cachedVersionList) {
      return cachedVersionList.versions;
    }
    throw error;
  }
}

/**
 * Get the platform-specific install command for a specific version of Claude Code
 * @param version - The version to install (e.g., "1.0.5")
 */
function getInstallVersionCommand(version: string): string {
  if (platformIsWindows()) {
    // Windows: kill running Claude processes first, then install specific version
    return `taskkill /IM claude.exe /F 2>nul; claude install --force ${version}`;
  } else {
    // macOS/Linux: kill running Claude processes first, then install specific version
    return `pkill -x claude 2>/dev/null; sleep 1; claude install --force ${version}`;
  }
}

/**
 * Get the platform-specific install command for Claude Code
 * @param isUpdate - If true, Claude is already installed and we just need to update
 */
function getInstallCommand(isUpdate: boolean): string {
  if (platformIsWindows()) {
    if (isUpdate) {
      // Update: kill running Claude processes first, then update with --force
      return 'taskkill /IM claude.exe /F 2>nul; claude install --force latest';
    }
    return 'irm https://claude.ai/install.ps1 | iex';
  } else {
    if (isUpdate) {
      // Update: kill running Claude processes first, then update with --force
      // pkill sends SIGTERM to gracefully stop Claude processes
      return 'pkill -x claude 2>/dev/null; sleep 1; claude install --force latest';
    }
    // Fresh install: use the full install script
    return 'curl -fsSL https://claude.ai/install.sh | bash -s -- latest';
  }
}

/**
 * Escape a string for use inside AppleScript double-quoted strings.
 * In AppleScript:
 * - Backslashes must be escaped: \ → \\
 * - Double quotes must be escaped: " → \"
 * - Single quotes do NOT need escaping inside double-quoted strings
 */
export function escapeAppleScriptString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')  // Escape backslashes first
    .replace(/"/g, '\\"');   // Escape double quotes
}

/**
 * Escape a string for safe use in PowerShell -Command context.
 * PowerShell requires escaping backticks, double quotes, dollar signs,
 * parentheses, semicolons, and ampersands.
 */
export function escapePowerShellCommand(str: string): string {
  return str
    .replace(/`/g, '``')      // Escape backticks (PowerShell escape char)
    .replace(/"/g, '`"')      // Escape double quotes
    .replace(/\$/g, '`$')     // Escape dollar signs (variable expansion)
    .replace(/\(/g, '`(')     // Escape opening parentheses
    .replace(/\)/g, '`)')     // Escape closing parentheses
    .replace(/;/g, '`;')      // Escape semicolons (statement separator)
    .replace(/&/g, '`&')      // Escape ampersands (call operator)
    .replace(/\r/g, '`r')     // Escape carriage returns
    .replace(/\n/g, '`n');    // Escape newlines
}

/**
 * Escape a string for safe use in Git Bash -c context.
 * Bash requires escaping single quotes, double quotes, backslashes, and other metacharacters.
 */
export function escapeGitBashCommand(str: string): string {
  // For bash -c with double quotes, escape: backslash, double quote, dollar, backtick,
  // semicolon, pipe, and exclamation mark (all bash metacharacters that could allow command injection)
  return str
    .replace(/\\/g, '\\\\')   // Escape backslashes first
    .replace(/"/g, '\\"')     // Escape double quotes
    .replace(/\$/g, '\\$')    // Escape dollar signs
    .replace(/`/g, '\\`')     // Escape backticks
    .replace(/;/g, '\\;')     // Escape semicolons (command separator)
    .replace(/\|/g, '\\|')    // Escape pipes (command piping)
    .replace(/!/g, '\\!');    // Escape exclamation marks (history expansion)
}

/**
 * Escape a string for safe use in bash -c context (Linux terminals).
 * Uses the same escaping rules as escapeGitBashCommand for consistency.
 * Defense-in-depth: Currently all commands come from trusted sources (getInstallCommand,
 * getInstallVersionCommand), but this prevents potential command injection if future
 * code adds new call sites with less controlled input.
 */
export function escapeBashCommand(str: string): string {
  // Reuse the same escaping logic as Git Bash
  return escapeGitBashCommand(str);
}

/**
 * Open a terminal with the given command
 * Uses the user's preferred terminal from settings
 * Supports macOS, Windows, and Linux terminals
 */

/**
 * Helper function to spawn a terminal emulator with proper path resolution
 * Uses findExecutable() to cross-platform compatibility
 */
function spawnTerminal(
  command: string,
  args: string[],
  options?: { detached?: boolean; stdio?: 'ignore' | 'inherit' | 'pipe' }
): boolean {
  try {
    const resolvedCmd = findExecutable(command);
    if (!resolvedCmd) {
      console.warn(`[Claude Code] Terminal not found in PATH: ${command}`);
      return false;
    }
    const child = spawn(resolvedCmd, args, { detached: true, stdio: 'ignore', ...options });
    child.on('error', (err) => {
      console.warn(`[Claude Code] Failed to spawn terminal ${resolvedCmd}:`, err);
    });
    child.unref();
    return true;
  } catch (err) {
    console.warn(`[Claude Code] Failed to spawn terminal ${command}:`, err);
    return false;
  }
}

export async function openTerminalWithCommand(command: string): Promise<void> {
  const platform = getCurrentOS();
  const settings = readSettingsFile();
  const preferredTerminal = settings?.preferredTerminal as string | undefined;

  console.warn('[Claude Code] Platform:', platform);
  console.warn('[Claude Code] Preferred terminal:', preferredTerminal);

  if (isMacOS()) {
    // macOS: Use AppleScript to open terminal with command
    const escapedCommand = escapeAppleScriptString(command);
    let script: string;

    // Map SupportedTerminal values to terminal handling
    // Values come from settings.preferredTerminal (SupportedTerminal type)
    const terminalId = preferredTerminal?.toLowerCase() || 'terminal';

    console.warn('[Claude Code] Using terminal:', terminalId);

    if (terminalId === 'iterm2') {
      // iTerm2 - handle both running and not-running cases to prevent double windows
      script = `
        if application "iTerm" is running then
          tell application "iTerm"
            create window with default profile
            tell current session of current window
              write text "${escapedCommand}"
            end tell
            activate
          end tell
        else
          tell application "iTerm"
            activate
          end tell
          delay 0.5
          tell application "iTerm"
            tell current session of current window
              write text "${escapedCommand}"
            end tell
          end tell
        end if
      `;
    } else if (terminalId === 'warp') {
      // Warp - open and send command
      script = `
        tell application "Warp"
          activate
        end tell
        delay 0.5
        tell application "System Events"
          keystroke "${escapedCommand}"
          keystroke return
        end tell
      `;
    } else if (terminalId === 'kitty') {
      // Kitty - use command line
      spawnTerminal('kitty', ['--', 'bash', '-c', command]);
      return;
    } else if (terminalId === 'alacritty') {
      // Alacritty - use command line
      const openPath = findExecutable('open') || 'open';
      spawn(openPath, ['-a', 'Alacritty', '--args', '-e', 'bash', '-c', command], { detached: true, stdio: 'ignore' }).unref();
      return;
    } else if (terminalId === 'wezterm') {
      // WezTerm - use command line
      spawnTerminal('wezterm', ['start', '--', 'bash', '-c', command]);
      return;
    } else if (terminalId === 'ghostty') {
      // Ghostty
      script = `
        tell application "Ghostty"
          activate
        end tell
        delay 0.3
        tell application "System Events"
          keystroke "${escapedCommand}"
          keystroke return
        end tell
      `;
    } else if (terminalId === 'hyper') {
      // Hyper
      script = `
        tell application "Hyper"
          activate
        end tell
        delay 0.3
        tell application "System Events"
          keystroke "${escapedCommand}"
          keystroke return
        end tell
      `;
    } else if (terminalId === 'tabby') {
      // Tabby (formerly Terminus)
      script = `
        tell application "Tabby"
          activate
        end tell
        delay 0.3
        tell application "System Events"
          keystroke "${escapedCommand}"
          keystroke return
        end tell
      `;
    } else {
      // Default: Terminal.app (handles 'terminal', 'system', or any unknown value)
      // IMPORTANT: do script FIRST, then activate - this prevents opening a blank default window
      // when Terminal.app isn't already running
      script = `
        tell application "Terminal"
          do script "${escapedCommand}"
          activate
        end tell
      `;
    }

    console.warn('[Claude Code] Running AppleScript...');
    const osascriptPath = findExecutable('osascript') || 'osascript';
    execFileSync(osascriptPath, ['-e', script], { stdio: 'pipe' });

  } else if (platformIsWindows()) {
    // Windows: Use appropriate terminal
    // Values match SupportedTerminal type: 'windowsterminal', 'powershell', 'cmd', 'conemu', 'cmder',
    // 'gitbash', 'alacritty', 'wezterm', 'hyper', 'tabby', 'cygwin', 'msys2'
    const terminalId = preferredTerminal?.toLowerCase() || 'powershell';

    console.warn('[Claude Code] Using terminal:', terminalId);
    console.warn('[Claude Code] Command to run:', command);

    // For Windows, use exec with a properly formed command string
    // This is more reliable than spawn for complex PowerShell commands with pipes
    const runWindowsCommand = (cmdString: string): Promise<void> => {
      return new Promise((resolve) => {
        console.warn(`[Claude Code] Executing: ${cmdString}`);
        // Fire and forget - don't wait for the terminal to close
        // The -NoExit flag keeps the terminal open, so we can't wait for exec to complete
        const child = exec(cmdString, { windowsHide: false });

        // Detach from the child process so we don't wait for it
        child.unref?.();

        // Resolve immediately after starting the process
        // Give it a brief moment to ensure the window opens
        setTimeout(() => resolve(), 300);
      });
    };

    try {
      // Escape command for PowerShell context to prevent command injection
      const escapedCommand = escapePowerShellCommand(command);

      if (terminalId === 'windowsterminal') {
        // Windows Terminal - open new tab with PowerShell
        await runWindowsCommand(`wt new-tab powershell -NoExit -Command "${escapedCommand}"`);
      } else if (terminalId === 'gitbash') {
        // Git Bash - use the passed command (escaped for bash context)
        const escapedBashCommand = escapeGitBashCommand(command);
        const programFiles = expandWindowsEnvVars('%PROGRAMFILES%');
        const programFilesX86 = expandWindowsEnvVars('%PROGRAMFILES(X86)%');
        const gitBashPaths = [
          joinPaths(programFiles, 'Git', 'git-bash.exe'),
          joinPaths(programFilesX86, 'Git', 'git-bash.exe'),
        ];
        const gitBashPath = gitBashPaths.find(p => existsSync(p));
        if (gitBashPath) {
          await runWindowsCommand(`"${gitBashPath}" -c "${escapedBashCommand}"`);
        } else {
          throw new Error('Git Bash not found');
        }
      } else if (terminalId === 'alacritty') {
        // Alacritty
        await runWindowsCommand(`start alacritty -e powershell -NoExit -Command "${escapedCommand}"`);
      } else if (terminalId === 'wezterm') {
        // WezTerm
        await runWindowsCommand(`start wezterm start -- powershell -NoExit -Command "${escapedCommand}"`);
      } else if (terminalId === 'cmd') {
        // Command Prompt - use cmd /k to run command and keep window open
        // Note: cmd.exe uses its own escaping rules, so we pass the raw command
        // and let cmd handle it. The command is typically PowerShell-formatted
        // for install scripts, so we run PowerShell from cmd.
        await runWindowsCommand(`start cmd /k "powershell -NoExit -Command ${escapedCommand}"`);
      } else if (terminalId === 'conemu') {
        // ConEmu - open with PowerShell tab running the command
        const conemuPaths = [
          joinPaths(expandWindowsEnvVars('%PROGRAMFILES%'), 'ConEmu', 'ConEmu64.exe'),
          joinPaths(expandWindowsEnvVars('%PROGRAMFILES(X86)%'), 'ConEmu', 'ConEmu.exe'),
        ];
        const conemuPath = conemuPaths.find(p => existsSync(p));
        if (conemuPath) {
          // ConEmu uses -run to specify the command to execute
          await runWindowsCommand(`start "" "${conemuPath}" -run "powershell -NoExit -Command ${escapedCommand}"`);
        } else {
          // Fall back to PowerShell if ConEmu not found
          console.warn('[Claude Code] ConEmu not found, falling back to PowerShell');
          await runWindowsCommand(`start powershell -NoExit -Command "${escapedCommand}"`);
        }
      } else if (terminalId === 'cmder') {
        // Cmder - portable console emulator for Windows
        const homeDir = os.homedir();
        const cmderPaths = [
          joinPaths(homeDir, 'cmder', 'Cmder.exe'),
          joinPaths(homeDir, 'tools', 'cmder', 'Cmder.exe'),
          joinPaths(getEnvVar('CMDER_ROOT') || '', 'Cmder.exe'),
        ].filter(p => p); // Remove empty paths
        const cmderPath = cmderPaths.find(p => existsSync(p));
        if (cmderPath) {
          // Cmder uses /TASK for predefined tasks or /START for directory, but we can use /C for command
          await runWindowsCommand(`start "" "${cmderPath}" /SINGLE /START "" /TASK "powershell -NoExit -Command ${escapedCommand}"`);
        } else {
          // Fall back to PowerShell if Cmder not found
          console.warn('[Claude Code] Cmder not found, falling back to PowerShell');
          await runWindowsCommand(`start powershell -NoExit -Command "${escapedCommand}"`);
        }
      } else if (terminalId === 'hyper') {
        // Hyper - Electron-based terminal
        const homeDir = os.homedir();
        // Use expandWindowsEnvVars for cross-platform compatibility
        const localAppData = expandWindowsEnvVars('%LOCALAPPDATA%') || joinPaths(homeDir, 'AppData', 'Local');
        const hyperPaths = [
          joinPaths(localAppData, 'Programs', 'Hyper', 'Hyper.exe'),
          joinPaths(homeDir, 'AppData', 'Local', 'Programs', 'Hyper', 'Hyper.exe'),
        ];
        const hyperPath = hyperPaths.find(p => existsSync(p));
        if (hyperPath) {
          // Launch Hyper and it will pick up the shell; send command via PowerShell since Hyper
          // doesn't have a built-in way to run commands on startup
          await runWindowsCommand(`start "" "${hyperPath}"`);
          console.warn('[Claude Code] Hyper opened - command must be pasted manually');
        } else {
          console.warn('[Claude Code] Hyper not found, falling back to PowerShell');
          await runWindowsCommand(`start powershell -NoExit -Command "${escapedCommand}"`);
        }
      } else if (terminalId === 'tabby') {
        // Tabby (formerly Terminus) - modern terminal for Windows
        const homeDir = os.homedir();
        // Use expandWindowsEnvVars for cross-platform compatibility
        const localAppData = expandWindowsEnvVars('%LOCALAPPDATA%') || joinPaths(homeDir, 'AppData', 'Local');
        const tabbyPaths = [
          joinPaths(localAppData, 'Programs', 'Tabby', 'Tabby.exe'),
          joinPaths(homeDir, 'AppData', 'Local', 'Programs', 'Tabby', 'Tabby.exe'),
        ];
        const tabbyPath = tabbyPaths.find(p => existsSync(p));
        if (tabbyPath) {
          // Tabby opens with default shell; similar to Hyper, no command line arg for running commands
          await runWindowsCommand(`start "" "${tabbyPath}"`);
          console.warn('[Claude Code] Tabby opened - command must be pasted manually');
        } else {
          console.warn('[Claude Code] Tabby not found, falling back to PowerShell');
          await runWindowsCommand(`start powershell -NoExit -Command "${escapedCommand}"`);
        }
      } else if (terminalId === 'cygwin') {
        // Cygwin terminal - use centralized terminal launcher paths
        const allTerminalPaths = getTerminalLauncherPaths();
        const cygwinPaths = allTerminalPaths.filter(p => p.includes('cygwin'));
        const cygwinPath = cygwinPaths.find(p => existsSync(p));
        if (cygwinPath) {
          // mintty with bash, escaping for bash context
          const escapedBashCommand = escapeGitBashCommand(command);
          await runWindowsCommand(`"${cygwinPath}" -e /bin/bash -lc "${escapedBashCommand}"`);
        } else {
          console.warn('[Claude Code] Cygwin not found, falling back to PowerShell');
          await runWindowsCommand(`start powershell -NoExit -Command "${escapedCommand}"`);
        }
      } else if (terminalId === 'msys2') {
        // MSYS2 terminal - use centralized terminal launcher paths
        const allTerminalPaths = getTerminalLauncherPaths();
        const msys2Paths = allTerminalPaths.filter(p => p.includes('msys64'));
        const msys2Path = msys2Paths.find(p => existsSync(p));
        if (msys2Path) {
          const escapedBashCommand = escapeGitBashCommand(command);
          if (msys2Path.endsWith('.cmd')) {
            // Use the shell launcher script
            await runWindowsCommand(`"${msys2Path}" -mingw64 -c "${escapedBashCommand}"`);
          } else {
            // Use mintty directly
            await runWindowsCommand(`"${msys2Path}" -e /bin/bash -lc "${escapedBashCommand}"`);
          }
        } else {
          console.warn('[Claude Code] MSYS2 not found, falling back to PowerShell');
          await runWindowsCommand(`start powershell -NoExit -Command "${escapedCommand}"`);
        }
      } else {
        // Default: PowerShell (handles 'powershell', 'system', or any unknown value)
        // Use 'start' command to open a new PowerShell window
        // The command is wrapped in double quotes and passed via -Command
        await runWindowsCommand(`start powershell -NoExit -Command "${escapedCommand}"`);
      }
    } catch (err) {
      console.error('[Claude Code] Terminal execution failed:', err);
      throw new Error(`Failed to open terminal: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  } else {
    // Linux: Use preferred terminal or try common emulators
    // Values match SupportedTerminal type: 'gnometerminal', 'konsole', 'xfce4terminal', 'tilix', etc.
    const terminalId = preferredTerminal?.toLowerCase() || '';

    console.warn('[Claude Code] Using terminal:', terminalId || 'auto-detect');

    // Command to run (keep terminal open after execution)
    // Note: Currently all commands come from trusted sources (getInstallCommand, getInstallVersionCommand),
    // which return multi-statement commands with semicolons as separators.
    // We do NOT escape these commands to preserve the semicolon command separators.
    // If future code needs to pass user input here, that input must be pre-sanitized.
    const bashCommand = `${command}; exec bash`;

    // Try to use preferred terminal if specified
    if (terminalId === 'gnometerminal') {
      spawnTerminal('gnome-terminal', ['--', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'konsole') {
      spawnTerminal('konsole', ['-e', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'xfce4terminal') {
      spawnTerminal('xfce4-terminal', ['-e', `bash -c "${bashCommand}"`]);
      return;
    } else if (terminalId === 'lxterminal') {
      spawnTerminal('lxterminal', ['-e', `bash -c "${bashCommand}"`]);
      return;
    } else if (terminalId === 'mate-terminal') {
      spawnTerminal('mate-terminal', ['-e', `bash -c "${bashCommand}"`]);
      return;
    } else if (terminalId === 'tilix') {
      spawnTerminal('tilix', ['-e', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'terminator') {
      spawnTerminal('terminator', ['-e', `bash -c "${bashCommand}"`]);
      return;
    } else if (terminalId === 'guake') {
      spawnTerminal('guake', ['-e', bashCommand]);
      return;
    } else if (terminalId === 'yakuake') {
      spawnTerminal('yakuake', ['-e', bashCommand]);
      return;
    } else if (terminalId === 'kitty') {
      spawnTerminal('kitty', ['--', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'alacritty') {
      spawnTerminal('alacritty', ['-e', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'wezterm') {
      spawnTerminal('wezterm', ['start', '--', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'hyper') {
      spawnTerminal('hyper', []);
      return;
    } else if (terminalId === 'tabby') {
      spawnTerminal('tabby', []);
      return;
    } else if (terminalId === 'xterm') {
      spawnTerminal('xterm', ['-e', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'urxvt') {
      spawnTerminal('urxvt', ['-e', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'st') {
      spawnTerminal('st', ['-e', 'bash', '-c', bashCommand]);
      return;
    } else if (terminalId === 'foot') {
      spawnTerminal('foot', ['bash', '-c', bashCommand]);
      return;
    }

    // Auto-detect (for 'system' or no preference): try common terminal emulators in order
    const terminals: Array<{ cmd: string; args: string[] }> = [
      { cmd: 'gnome-terminal', args: ['--', 'bash', '-c', bashCommand] },
      { cmd: 'konsole', args: ['-e', 'bash', '-c', bashCommand] },
      { cmd: 'xfce4-terminal', args: ['-e', `bash -c "${bashCommand}"`] },
      { cmd: 'tilix', args: ['-e', 'bash', '-c', bashCommand] },
      { cmd: 'terminator', args: ['-e', `bash -c "${bashCommand}"`] },
      { cmd: 'kitty', args: ['--', 'bash', '-c', bashCommand] },
      { cmd: 'alacritty', args: ['-e', 'bash', '-c', bashCommand] },
      { cmd: 'xterm', args: ['-e', 'bash', '-c', bashCommand] },
    ];

    let opened = false;
    for (const { cmd, args } of terminals) {
      if (spawnTerminal(cmd, args)) {
        opened = true;
        console.warn('[Claude Code] Opened terminal:', cmd);
        break;
      }
    }

    if (!opened) {
      throw new Error('No supported terminal emulator found');
    }
  }
}

/**
 * Result of authentication check
 */
interface AuthCheckResult {
  authenticated: boolean;
  email?: string;
  /** The full oauthAccount data from .claude.json (if available) */
  oauthAccount?: {
    emailAddress?: string;
    accessToken?: string;
    refreshToken?: string;
    expiresAt?: string;
    [key: string]: unknown;
  };
}

/**
 * Check if a profile's config directory has authentication.
 * Checks multiple locations based on platform:
 * - macOS: .claude.json with oauthAccount containing emailAddress
 * - Linux: .credentials.json OR .claude.json (Claude uses different storage on Linux)
 * - Windows: .claude.json with oauthAccount containing emailAddress
 *
 * Also returns the full oauthAccount data so we can update the profile token.
 */
function checkProfileAuthentication(configDir: string): AuthCheckResult {
  // Validate path to prevent reading arbitrary files
  if (!isValidConfigDir(configDir)) {
    console.error('[Claude Code] Security: Rejected authentication check for invalid configDir:', configDir);
    return { authenticated: false };
  }

  // Expand ~ to home directory
  const expandedConfigDir = configDir.startsWith('~')
    ? path.join(os.homedir(), configDir.slice(1))
    : configDir;

  const claudeJsonPath = path.join(expandedConfigDir, '.claude.json');
  const credentialsJsonPath = path.join(expandedConfigDir, '.credentials.json');

  try {
    // First check .claude.json (primary on macOS/Windows, also used on some Linux setups)
    if (existsSync(claudeJsonPath)) {
      const content = readFileSync(claudeJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // Check for oauthAccount with emailAddress
      if (data.oauthAccount?.emailAddress) {
        return {
          authenticated: true,
          email: data.oauthAccount.emailAddress,
          oauthAccount: data.oauthAccount
        };
      }
    }

    // On Linux, also check .credentials.json (Claude CLI may store tokens here)
    if (isLinux() && existsSync(credentialsJsonPath)) {
      const content = readFileSync(credentialsJsonPath, 'utf-8');
      const data = JSON.parse(content);

      // .credentials.json may have different structure
      // Check for claudeAiOauth or oauthAccount
      if (data.claudeAiOauth) {
        // Extract email from claudeAiOauth if available
        const email = data.claudeAiOauth.email || data.claudeAiOauth.emailAddress;
        return {
          authenticated: true,
          email: email,
          oauthAccount: data.claudeAiOauth
        };
      }

      if (data.oauthAccount?.emailAddress) {
        return {
          authenticated: true,
          email: data.oauthAccount.emailAddress,
          oauthAccount: data.oauthAccount
        };
      }

      // If .credentials.json exists with any oauth-related content, consider it authenticated
      if (data.accessToken || data.refreshToken || data.token) {
        return {
          authenticated: true,
          email: undefined, // Email might not be available in this format
          oauthAccount: {
            accessToken: data.accessToken || data.token,
            refreshToken: data.refreshToken
          }
        };
      }
    }

    return { authenticated: false };
  } catch (error) {
    console.error('[Claude Code] Error checking authentication:', error);
    return { authenticated: false };
  }
}

/**
 * Register Claude Code IPC handlers
 */
export function registerClaudeCodeHandlers(): void {
  // Check Claude Code version
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_CODE_CHECK_VERSION,
    async (): Promise<IPCResult<ClaudeCodeVersionInfo>> => {
      try {
        console.warn('[Claude Code] Checking version...');

        // Get installed version via cli-tool-manager
        let detectionResult: ReturnType<typeof getToolInfo>;
        try {
          detectionResult = getToolInfo('claude');
          console.warn('[Claude Code] Detection result:', JSON.stringify(detectionResult, null, 2));
        } catch (detectionError) {
          console.error('[Claude Code] Detection error:', detectionError);
          throw new Error(`Detection failed: ${detectionError instanceof Error ? detectionError.message : 'Unknown error'}`);
        }

        const installed = detectionResult.found ? detectionResult.version || null : null;
        console.warn('[Claude Code] Installed version:', installed);

        // Fetch latest version from npm
        let latest: string;
        try {
          console.warn('[Claude Code] Fetching latest version from npm...');
          latest = await fetchLatestVersion();
          console.warn('[Claude Code] Latest version:', latest);
        } catch (error) {
          console.warn('[Claude Code] Failed to fetch latest version, continuing with unknown:', error);
          // If we can't fetch latest, still return installed info
          return {
            success: true,
            data: {
              installed,
              latest: 'unknown',
              isOutdated: false,
              path: detectionResult.path,
              detectionResult,
            },
          };
        }

        // Compare versions
        let isOutdated = false;
        if (installed && latest !== 'unknown') {
          try {
            // Clean version strings (remove 'v' prefix if present)
            const cleanInstalled = installed.replace(/^v/, '');
            const cleanLatest = latest.replace(/^v/, '');
            isOutdated = semver.lt(cleanInstalled, cleanLatest);
          } catch {
            // If semver comparison fails, assume not outdated
            isOutdated = false;
          }
        }

        console.warn('[Claude Code] Check complete:', { installed, latest, isOutdated });
        return {
          success: true,
          data: {
            installed,
            latest,
            isOutdated,
            path: detectionResult.path,
            detectionResult,
          },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Check failed:', errorMsg, error);
        return {
          success: false,
          error: `Failed to check Claude Code version: ${errorMsg}`,
        };
      }
    }
  );

  // Install Claude Code (open terminal with install command)
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_CODE_INSTALL,
    async (): Promise<IPCResult<{ command: string }>> => {
      try {
        // Check if Claude is already installed to determine if this is an update
        let isUpdate = false;
        try {
          const detectionResult = getToolInfo('claude');
          isUpdate = detectionResult.found && !!detectionResult.version;
          console.warn('[Claude Code] Is update:', isUpdate, 'detected version:', detectionResult.version);
        } catch {
          // Detection failed, assume fresh install
          isUpdate = false;
        }

        const command = getInstallCommand(isUpdate);
        console.warn('[Claude Code] Install command:', command);
        console.warn('[Claude Code] Opening terminal...');
        await openTerminalWithCommand(command);
        console.warn('[Claude Code] Terminal opened successfully');

        return {
          success: true,
          data: { command },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Install failed:', errorMsg, error);
        return {
          success: false,
          error: `Failed to open terminal for installation: ${errorMsg}`,
        };
      }
    }
  );

  // Get available Claude Code versions
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_CODE_GET_VERSIONS,
    async (): Promise<IPCResult<{ versions: string[] }>> => {
      try {
        console.log('[Claude Code] Fetching available versions...');
        const versions = await fetchAvailableVersions();
        console.log('[Claude Code] Found', versions.length, 'versions');
        return {
          success: true,
          data: { versions },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Failed to fetch versions:', errorMsg, error);
        return {
          success: false,
          error: `Failed to fetch available versions: ${errorMsg}`,
        };
      }
    }
  );

  // Install a specific version of Claude Code
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_CODE_INSTALL_VERSION,
    async (_event, version: string): Promise<IPCResult<{ command: string; version: string }>> => {
      try {
        // Validate version format
        if (!version || typeof version !== 'string') {
          throw new Error('Invalid version specified');
        }

        // Basic semver validation
        if (!semver.valid(version)) {
          throw new Error(`Invalid version format: ${version}`);
        }

        console.log('[Claude Code] Installing version:', version);
        const command = getInstallVersionCommand(version);
        console.log('[Claude Code] Install command:', command);
        console.log('[Claude Code] Opening terminal...');
        await openTerminalWithCommand(command);
        console.log('[Claude Code] Terminal opened successfully');

        return {
          success: true,
          data: { command, version },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Install version failed:', errorMsg, error);
        return {
          success: false,
          error: `Failed to install version: ${errorMsg}`,
        };
      }
    }
  );

  // Get all Claude CLI installations found on the system
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_CODE_GET_INSTALLATIONS,
    async (): Promise<IPCResult<ClaudeInstallationList>> => {
      try {
        console.log('[Claude Code] Scanning for installations...');

        // Get current active path from settings
        const settings = readSettingsFile();
        const activePath = settings?.claudePath as string | undefined;

        const installations = await scanClaudeInstallations(activePath || null);
        console.log('[Claude Code] Found', installations.length, 'installations');

        return {
          success: true,
          data: {
            installations,
            activePath: activePath || (installations.length > 0 ? installations[0].path : null),
          },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Failed to scan installations:', errorMsg, error);
        return {
          success: false,
          error: `Failed to scan Claude CLI installations: ${errorMsg}`,
        };
      }
    }
  );

  // Set the active Claude CLI path
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_CODE_SET_ACTIVE_PATH,
    async (_event, cliPath: string): Promise<IPCResult<{ path: string }>> => {
      try {
        console.log('[Claude Code] Setting active path:', cliPath);

        // Security validation: reject paths with shell metacharacters or directory traversal
        if (!isSecurePath(cliPath)) {
          throw new Error('Invalid path: contains potentially unsafe characters');
        }

        // Normalize path to handle missing Windows extensions
        const resolvedPath = path.resolve(cliPath);
        const normalizedPath = normalizeExecutablePath(resolvedPath);

        // Validate the path exists and is executable
        if (!existsSync(normalizedPath)) {
          throw new Error('Claude CLI not found at specified path');
        }

        const [isValid, version] = await validateClaudeCliAsync(normalizedPath);
        if (!isValid) {
          throw new Error('Claude CLI at specified path is not valid or not executable');
        }

        // Save to settings using established pattern: merge with DEFAULT_APP_SETTINGS
        const currentSettings = readSettingsFile() || {};
        const mergedSettings = {
          ...DEFAULT_APP_SETTINGS,
          ...currentSettings,
          claudePath: normalizedPath,
        } as Record<string, unknown>;
        writeSettingsFile(mergedSettings);

        // Update CLI tool manager cache
        configureTools({ claudePath: normalizedPath });

        console.log('[Claude Code] Active path set:', normalizedPath, 'version:', version);

        return {
          success: true,
          data: { path: normalizedPath },
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Failed to set active path:', errorMsg, error);
        return {
          success: false,
          error: `Failed to set active Claude CLI path: ${errorMsg}`,
        };
      }
    }
  );

  // Authenticate Claude profile - returns terminal config for embedded terminal
  // The frontend creates an embedded terminal with CLAUDE_CONFIG_DIR set,
  // and the terminal ID pattern enables automatic token capture on /login
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_PROFILE_AUTHENTICATE,
    async (_event, profileId: string): Promise<IPCResult<{ terminalId: string; configDir: string }>> => {
      try {
        console.warn('[Claude Code] Authenticating profile:', profileId);

        const profileManager = getClaudeProfileManager();
        const profile = profileManager.getProfile(profileId);

        if (!profile) {
          return {
            success: false,
            error: `Profile not found: ${profileId}`
          };
        }

        // For default profile, use the default Claude config dir
        const configDir = profile.configDir || '~/.claude';

        // Validate path to prevent operations on arbitrary directories
        if (!isValidConfigDir(configDir)) {
          return {
            success: false,
            error: `Invalid config directory path: ${configDir}. Config directories must be within the user's home directory.`
          };
        }

        // Ensure the config directory exists
        const expandedConfigDir = configDir.startsWith('~')
          ? path.join(os.homedir(), configDir.slice(1))
          : configDir;

        // Create directory if it doesn't exist
        await mkdir(expandedConfigDir, { recursive: true });

        console.warn('[Claude Code] Config directory:', expandedConfigDir);

        // Backwards compatibility: If re-authenticating an existing profile that was
        // set up with the old setup-token system, we need to clear the existing
        // credentials so that /login opens the browser for fresh OAuth.
        // We back up the existing .claude.json to .claude.json.bak
        const claudeJsonPath = path.join(expandedConfigDir, '.claude.json');
        const claudeJsonBakPath = path.join(expandedConfigDir, '.claude.json.bak');

        // NOTE: We intentionally do NOT clean up .claude.json.bak here.
        // If both files exist, we cannot assume the previous auth succeeded - the app
        // may have crashed after /login wrote an incomplete .claude.json but before
        // VERIFY_AUTH ran. The backup may contain valid credentials needed for rollback.
        //
        // Backup cleanup happens safely in two places:
        // 1. VERIFY_AUTH handler (lines ~1339-1347): After confirming valid credentials
        // 2. Below (lines ~1229-1231): When creating a new backup (removes old backup first)

        if (existsSync(claudeJsonPath)) {
          try {
            const content = readFileSync(claudeJsonPath, 'utf-8');
            const data = JSON.parse(content);

            // Check if this has OAuth credentials (old setup-token or previous /login)
            if (data.oauthAccount) {
              console.warn('[Claude Code] Found existing OAuth credentials, backing up for re-authentication');

              // Remove old backup if exists
              if (existsSync(claudeJsonBakPath)) {
                await unlink(claudeJsonBakPath);
              }

              // Backup current credentials
              await rename(claudeJsonPath, claudeJsonBakPath);
              console.warn('[Claude Code] Backed up .claude.json to .claude.json.bak');
            }
          } catch (backupError) {
            // Non-fatal: if backup fails, /login might still work or show "already logged in"
            console.warn('[Claude Code] Could not backup existing credentials:', backupError);
          }
        }

        // Generate terminal ID with pattern: claude-login-{profileId}-{timestamp}
        // This pattern is used by claude-integration-handler.ts to identify
        // which profile to save captured OAuth tokens to
        const terminalId = `claude-login-${profileId}-${Date.now()}`;
        console.warn('[Claude Code] Generated terminal ID:', terminalId);

        return {
          success: true,
          data: {
            terminalId,
            configDir: expandedConfigDir
          }
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Authentication failed:', errorMsg, error);
        return {
          success: false,
          error: `Failed to prepare authentication: ${errorMsg}`
        };
      }
    }
  );

  // Verify if a profile has been authenticated
  ipcMain.handle(
    IPC_CHANNELS.CLAUDE_PROFILE_VERIFY_AUTH,
    async (_event, profileId: string): Promise<IPCResult<{ authenticated: boolean; email?: string }>> => {
      try {
        console.warn('[Claude Code] Verifying auth for profile:', profileId);

        const profileManager = getClaudeProfileManager();
        const profile = profileManager.getProfile(profileId);

        if (!profile) {
          return {
            success: false,
            error: `Profile not found: ${profileId}`
          };
        }

        const configDir = profile.configDir || '~/.claude';
        const result = checkProfileAuthentication(configDir);

        console.warn('[Claude Code] Auth verification result:', result);

        // Expand configDir for backup restoration check
        const expandedConfigDir = configDir.startsWith('~')
          ? path.join(os.homedir(), configDir.slice(1))
          : configDir;

        const claudeJsonPath = path.join(expandedConfigDir, '.claude.json');
        const claudeJsonBakPath = path.join(expandedConfigDir, '.claude.json.bak');

        // If NOT authenticated AND backup exists, restore the backup
        // This handles cases where authentication was cancelled or failed
        if (!result.authenticated && existsSync(claudeJsonBakPath)) {
          try {
            console.warn('[Claude Code] Authentication failed and backup exists, restoring .claude.json.bak');

            // Remove incomplete .claude.json if it exists
            if (existsSync(claudeJsonPath)) {
              await unlink(claudeJsonPath);
            }

            // Restore the backup
            await rename(claudeJsonBakPath, claudeJsonPath);
            console.warn('[Claude Code] Restored .claude.json from backup');
          } catch (restoreError) {
            console.warn('[Claude Code] Failed to restore backup:', restoreError);
            // Non-fatal: user can manually restore from .claude.json.bak
          }
        }

        // If authenticated, update the profile with the email and OAuth token
        if (result.authenticated) {
          profile.isAuthenticated = true;

          if (result.email) {
            profile.email = result.email;
          }

          // Save the OAuth token if available (critical for re-authentication)
          if (result.oauthAccount?.accessToken) {
            console.warn('[Claude Code] Saving OAuth token for profile:', profileId);
            profileManager.setProfileToken(
              profileId,
              result.oauthAccount.accessToken,
              result.email
            );
          } else {
            // No OAuth token, just save the email update
            profileManager.saveProfile(profile);
          }

          // Clean up backup file after successful authentication
          if (existsSync(claudeJsonBakPath)) {
            try {
              await unlink(claudeJsonBakPath);
              console.warn('[Claude Code] Cleaned up .claude.json.bak after successful auth');
            } catch (cleanupError) {
              console.warn('[Claude Code] Failed to clean up backup:', cleanupError);
              // Non-fatal: backup file can remain for safety
            }
          }
        }

        return {
          success: true,
          data: result
        };
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error('[Claude Code] Auth verification failed:', errorMsg, error);
        return {
          success: false,
          error: `Failed to verify authentication: ${errorMsg}`
        };
      }
    }
  );

  console.warn('[IPC] Claude Code handlers registered');
}
