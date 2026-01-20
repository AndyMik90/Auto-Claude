/**
 * Platform-Specific Path Resolvers
 *
 * Handles detection of tool paths across platforms.
 * Each tool has a dedicated resolver function.
 */

import * as path from 'path';
import * as os from 'os';
import { existsSync, readdirSync } from 'fs';
import { isWindows, isMacOS, getHomebrewPath, joinPaths, getExecutableExtension, getEnvVar } from './index';

/**
 * Resolve Claude CLI executable path
 *
 * Searches in platform-specific installation directories:
 * - Windows: Program Files, AppData, npm
 * - macOS: Homebrew, /usr/local/bin
 * - Linux: ~/.local/bin, /usr/bin
 */
export function getClaudeExecutablePath(): string[] {
  const homeDir = os.homedir();
  const paths: string[] = [];

  if (isWindows()) {
    // Note: path.join('C:', 'foo') produces 'C:foo' (relative to C: drive), not 'C:\foo'
    // We must use 'C:\\' or raw paths like 'C:\\Program Files' to get absolute paths
    paths.push(
      joinPaths(homeDir, 'AppData', 'Local', 'Programs', 'claude', `claude${getExecutableExtension()}`),
      joinPaths(homeDir, 'AppData', 'Roaming', 'npm', 'claude.cmd'),
      joinPaths(homeDir, '.local', 'bin', `claude${getExecutableExtension()}`),
      joinPaths('C:\\Program Files', 'Claude', `claude${getExecutableExtension()}`),
      joinPaths('C:\\Program Files (x86)', 'Claude', `claude${getExecutableExtension()}`)
    );
  } else {
    paths.push(
      joinPaths(homeDir, '.local', 'bin', 'claude'),
      joinPaths(homeDir, 'bin', 'claude')
    );

    // Add Homebrew paths on macOS
    if (isMacOS()) {
      const brewPath = getHomebrewPath();
      if (brewPath) {
        paths.push(joinPaths(brewPath, 'claude'));
      }
    }
  }

  return paths;
}

/**
 * Resolve Python executable path
 *
 * Returns command arguments as sequences so callers can pass each entry
 * directly to spawn/exec or use cmd[0] for executable lookup.
 *
 * Returns platform-specific command variations:
 * - Windows: ["py", "-3"], ["python"], ["python3"], ["py"]
 * - Unix: ["python3"], ["python"]
 */
export function getPythonCommands(): string[][] {
  if (isWindows()) {
    return [['py', '-3'], ['python'], ['python3'], ['py']];
  }
  return [['python3'], ['python']];
}

/**
 * Expand a directory pattern like "Python3*" by scanning the parent directory
 * Returns matching directory paths or empty array if none found
 */
function expandDirPattern(parentDir: string, pattern: string): string[] {
  if (!existsSync(parentDir)) {
    return [];
  }

  try {
    // Convert glob pattern to regex (only support simple * wildcard)
    const regexPattern = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$', 'i');
    const entries = readdirSync(parentDir, { withFileTypes: true });

    return entries
      .filter((entry) => entry.isDirectory() && regexPattern.test(entry.name))
      .map((entry) => joinPaths(parentDir, entry.name));
  } catch {
    return [];
  }
}

/**
 * Resolve Python installation paths
 *
 * Returns actual existing directory paths (expands glob patterns on Windows)
 */
export function getPythonPaths(): string[] {
  const homeDir = os.homedir();
  const paths: string[] = [];

  if (isWindows()) {
    // User-local Python installation
    const userPythonPath = joinPaths(homeDir, 'AppData', 'Local', 'Programs', 'Python');
    if (existsSync(userPythonPath)) {
      paths.push(userPythonPath);
    }

    // System Python installations (expand Python3* patterns)
    // Use getEnvVar for case-insensitive Windows environment variable access
    const programFiles = getEnvVar('ProgramFiles') || 'C:\\Program Files';
    const programFilesX86 = getEnvVar('ProgramFiles(x86)') || 'C:\\Program Files (x86)';

    paths.push(...expandDirPattern(programFiles, 'Python3*'));
    paths.push(...expandDirPattern(programFilesX86, 'Python3*'));
  } else if (isMacOS()) {
    const brewPath = getHomebrewPath();
    if (brewPath) {
      paths.push(brewPath);
    }
  } else {
    // Linux: Add common Python installation directories
    paths.push(
      '/usr/bin',
      '/usr/local/bin',
      path.join(homeDir, '.local', 'bin')
    );
  }

  return paths;
}

/**
 * Resolve Git executable path
 */
export function getGitExecutablePath(): string {
  if (isWindows()) {
    // Git for Windows installs to standard locations
    const candidates = [
      joinPaths('C:\\Program Files', 'Git', 'bin', 'git.exe'),
      joinPaths('C:\\Program Files (x86)', 'Git', 'bin', 'git.exe'),
      joinPaths(os.homedir(), 'AppData', 'Local', 'Programs', 'Git', 'bin', 'git.exe')
    ];

    for (const candidate of candidates) {
      if (existsSync(candidate)) {
        return candidate;
      }
    }
  }

  return 'git';
}

/**
 * Resolve Node.js executable path
 */
export function getNodeExecutablePath(): string {
  if (isWindows()) {
    return 'node.exe';
  }
  return 'node';
}

/**
 * Resolve npm executable path
 */
export function getNpmExecutablePath(): string {
  if (isWindows()) {
    return 'npm.cmd';
  }
  return 'npm';
}

/**
 * Get all Windows shell paths for terminal selection
 *
 * Returns a map of shell types to their possible installation paths.
 * Only applies to Windows; returns empty object for other platforms.
 */
export function getWindowsShellPaths(): Record<string, string[]> {
  if (!isWindows()) {
    return {};
  }

  // Use getEnvVar for case-insensitive Windows environment variable access
  const systemRoot = getEnvVar('SystemRoot') || 'C:\\Windows';

  // Note: path.join('C:', 'foo') produces 'C:foo' (relative to C: drive), not 'C:\foo'
  // We must use 'C:\\' or raw paths like 'C:\\Program Files' to get absolute paths
  return {
    powershell: [
      path.join('C:\\Program Files', 'PowerShell', '7', 'pwsh.exe'),
      path.join(systemRoot, 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe')
    ],
    windowsterminal: [
      path.join('C:\\Program Files', 'WindowsApps', 'Microsoft.WindowsTerminal_*', 'WindowsTerminal.exe')
    ],
    cmd: [
      path.join(systemRoot, 'System32', 'cmd.exe')
    ],
    gitbash: [
      path.join('C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join('C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe')
    ],
    cygwin: [
      path.join('C:\\cygwin64', 'bin', 'bash.exe')
    ],
    msys2: [
      path.join('C:\\msys64', 'usr', 'bin', 'bash.exe')
    ],
    wsl: [
      path.join(systemRoot, 'System32', 'wsl.exe')
    ]
  };
}

/**
 * Expand Windows environment variables in a path
 *
 * Replaces patterns like %PROGRAMFILES% with actual values.
 * Only applies to Windows; returns original path for other platforms.
 */
export function expandWindowsEnvVars(pathPattern: string): string {
  if (!isWindows()) {
    return pathPattern;
  }

  const homeDir = os.homedir();
  // Use getEnvVar for case-insensitive Windows environment variable access
  const envVars: Record<string, string | undefined> = {
    '%PROGRAMFILES%': getEnvVar('ProgramFiles') || 'C:\\Program Files',
    '%PROGRAMFILES(X86)%': getEnvVar('ProgramFiles(x86)') || 'C:\\Program Files (x86)',
    '%LOCALAPPDATA%': getEnvVar('LOCALAPPDATA') || path.join(homeDir, 'AppData', 'Local'),
    '%APPDATA%': getEnvVar('APPDATA') || path.join(homeDir, 'AppData', 'Roaming'),
    '%USERPROFILE%': getEnvVar('USERPROFILE') || homeDir,
    '%PROGRAMDATA%': getEnvVar('ProgramData') || getEnvVar('PROGRAMDATA') || 'C:\\ProgramData',
    '%SYSTEMROOT%': getEnvVar('SystemRoot') || 'C:\\Windows',
    '%TEMP%': getEnvVar('TEMP') || getEnvVar('TMP') || path.join(homeDir, 'AppData', 'Local', 'Temp'),
    '%TMP%': getEnvVar('TMP') || getEnvVar('TEMP') || path.join(homeDir, 'AppData', 'Local', 'Temp')
  };

  let expanded = pathPattern;
  for (const [pattern, value] of Object.entries(envVars)) {
    // Only replace if we have a valid value (skip replacement if empty)
    if (value) {
      // Escape special regex characters in the pattern (e.g., parentheses in %PROGRAMFILES(X86)%)
      const escapedPattern = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expanded = expanded.replace(new RegExp(escapedPattern, 'gi'), value);
    }
  }

  return expanded;
}

/**
 * Get Windows-specific installation paths for a tool
 *
 * @param toolName - Name of the tool (e.g., 'claude', 'python')
 * @param subPath - Optional subdirectory within Program Files
 */
export function getWindowsToolPath(toolName: string, subPath?: string): string[] {
  if (!isWindows()) {
    return [];
  }

  const homeDir = os.homedir();
  // Use getEnvVar for case-insensitive Windows environment variable access
  const programFiles = getEnvVar('ProgramFiles') || 'C:\\Program Files';
  const programFilesX86 = getEnvVar('ProgramFiles(x86)') || 'C:\\Program Files (x86)';
  const appData = getEnvVar('LOCALAPPDATA') || path.join(homeDir, 'AppData', 'Local');

  const paths: string[] = [];

  // Program Files locations
  if (subPath) {
    paths.push(
      path.join(programFiles, subPath),
      path.join(programFilesX86, subPath)
    );
  } else {
    paths.push(
      path.join(programFiles, toolName),
      path.join(programFilesX86, toolName)
    );
  }

  // AppData location
  paths.push(path.join(appData, toolName));

  // Roaming AppData (for npm)
  // Use getEnvVar for case-insensitive Windows environment variable access
  const roamingAppData = getEnvVar('APPDATA') || path.join(homeDir, 'AppData', 'Roaming');
  paths.push(path.join(roamingAppData, 'npm'));

  return paths;
}

/**
 * Get Homebrew binary directory paths for the current platform
 *
 * Returns paths to Homebrew installation directories. Only applies to macOS,
 * as Homebrew is macOS-specific. Returns empty array on other platforms.
 *
 * @returns Array of Homebrew binary paths (empty on non-macOS)
 */
export function getHomebrewBinPaths(): string[] {
  if (!isMacOS()) {
    return [];
  }

  // Homebrew default installation paths
  // Apple Silicon (M1/M2/M3/M4): /opt/homebrew/bin
  // Intel Mac: /usr/local/bin
  return ['/opt/homebrew/bin', '/usr/local/bin'];
}

/**
 * Get bash executable paths for the current platform
 *
 * Returns paths to bash executables in their standard installation locations.
 * On Windows, searches Git Bash, Cygwin, MSYS2, and WSL.
 * On Unix, returns standard bash locations.
 *
 * @returns Array of possible bash executable paths
 */
export function getBashExecutablePaths(): string[] {
  const paths: string[] = [];

  if (isWindows()) {
    const systemRoot = getEnvVar('SystemRoot') || 'C:\\Windows';
    const homeDir = os.homedir();

    // Git for Windows (most common on Windows)
    paths.push(
      path.join('C:\\Program Files', 'Git', 'bin', 'bash.exe'),
      path.join('C:\\Program Files (x86)', 'Git', 'bin', 'bash.exe')
    );

    // User-specific Git installations
    paths.push(
      path.join(homeDir, 'AppData', 'Local', 'Programs', 'Git', 'bin', 'bash.exe')
    );

    // MSYS2
    paths.push(path.join('C:\\msys64', 'usr', 'bin', 'bash.exe'));

    // Cygwin
    paths.push(path.join('C:\\cygwin64', 'bin', 'bash.exe'));

    // WSL bash (via wsl.exe)
    paths.push(path.join(systemRoot, 'System32', 'wsl.exe'));

    // Scoop bash
    const scoopPath = path.join(homeDir, 'scoop', 'shims', 'bash.exe');
    paths.push(scoopPath);
  } else {
    // Unix: bash is typically in standard locations
    paths.push('/bin/bash', '/usr/bin/bash', '/usr/local/bin/bash');

    // Homebrew on macOS
    if (isMacOS()) {
      paths.push('/opt/homebrew/bin/bash', '/usr/local/bin/bash');
    }
  }

  return paths;
}

/**
 * Get cmd.exe path for Windows
 *
 * Returns the path to cmd.exe on Windows, or a fallback shell on Unix.
 * Uses the COMSPEC environment variable if available (standard Windows convention).
 *
 * @returns Path to cmd.exe on Windows, 'sh' on Unix
 */
export function getCmdExecutablePath(): string {
  if (!isWindows()) {
    return 'sh';
  }

  // Use COMSPEC environment variable (points to cmd.exe on Windows)
  // This is the standard Windows convention for finding cmd.exe
  const comspec = getEnvVar('COMSPEC');
  if (comspec) {
    return comspec;
  }

  // Fallback: construct from SystemRoot
  const systemRoot = getEnvVar('SystemRoot') || 'C:\\Windows';
  return path.join(systemRoot, 'System32', 'cmd.exe');
}

/**
 * Get terminal launcher paths for Windows (Cygwin, MSYS2)
 *
 * Returns paths to terminal emulator executables for Cygwin and MSYS2.
 * These are used to launch terminal sessions with bash commands.
 *
 * @returns Array of terminal launcher paths (empty on non-Windows)
 */
export function getTerminalLauncherPaths(): string[] {
  if (!isWindows()) {
    return [];
  }

  return [
    // Cygwin mintty (terminal emulator)
    path.join('C:\\cygwin64', 'bin', 'mintty.exe'),
    path.join('C:\\cygwin', 'bin', 'mintty.exe'),
    // MSYS2 launchers
    path.join('C:\\msys64', 'msys2_shell.cmd'),
    path.join('C:\\msys64', 'mingw64.exe'),
    path.join('C:\\msys64', 'usr', 'bin', 'mintty.exe'),
  ];
}

/**
 * Get GitLab CLI (glab) executable paths for the current platform
 *
 * Returns paths to glab executables in their standard installation locations.
 * glab is the official CLI tool for GitLab.
 *
 * @returns Array of possible glab executable paths
 */
export function getGitLabCliPaths(): string[] {
  const paths: string[] = [];
  const homeDir = os.homedir();
  const ext = getExecutableExtension();

  if (isWindows()) {
    // Windows installation locations
    const programFiles = getEnvVar('ProgramFiles') || 'C:\\Program Files';
    const programFilesX86 = getEnvVar('ProgramFiles(x86)') || 'C:\\Program Files (x86)';
    const appData = getEnvVar('LOCALAPPDATA') || path.join(homeDir, 'AppData', 'Local');
    const roamingAppData = getEnvVar('APPDATA') || path.join(homeDir, 'AppData', 'Roaming');

    paths.push(
      // GitLab default installation
      path.join(programFiles, 'GitLab', 'glab', `glab${ext}`),
      path.join(programFilesX86, 'GitLab', 'glab', `glab${ext}`),
      // Scoop
      path.join(homeDir, 'scoop', 'apps', 'glab', 'current', `glab${ext}`),
      // npm global
      path.join(roamingAppData, 'npm', `glab${ext.replace('.', 'cmd')}`),
      // User-local installation
      path.join(appData, 'Programs', 'glab', `glab${ext}`)
    );
  } else {
    // Unix (macOS/Linux) installation locations
    paths.push(
      // Standard system locations
      '/usr/bin/glab',
      '/usr/local/bin/glab',
      // Snap (Linux)
      '/snap/bin/glab',
      // Homebrew (macOS)
      '/opt/homebrew/bin/glab',
      '/usr/local/bin/glab',
      // User local bin
      path.join(homeDir, '.local', 'bin', 'glab')
    );
  }

  return paths;
}
