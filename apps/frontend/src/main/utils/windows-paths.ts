/**
 * Windows Executable Path Discovery Utility
 *
 * Provides reusable logic for finding Windows executables in common installation
 * locations. Handles environment variable expansion and security validation.
 *
 * Used by cli-tool-manager.ts for Git, GitHub CLI, Claude CLI, etc.
 * Follows the same pattern as homebrew-python.ts for platform-specific detection.
 */

import { existsSync } from 'fs';
import { access, constants } from 'fs/promises';
import { execFileSync, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import os from 'os';
import { isWindows, expandWindowsEnvVars } from '../platform';

const execFileAsync = promisify(execFile);

export interface WindowsToolPaths {
  toolName: string;
  executable: string;
  patterns: string[];
}

export const WINDOWS_GIT_PATHS: WindowsToolPaths = {
  toolName: 'Git',
  executable: 'git.exe',
  patterns: [
    '%PROGRAMFILES%\\Git\\cmd',
    '%PROGRAMFILES(X86)%\\Git\\cmd',
    '%LOCALAPPDATA%\\Programs\\Git\\cmd',
    '%USERPROFILE%\\scoop\\apps\\git\\current\\cmd',
    '%PROGRAMFILES%\\Git\\bin',
    '%PROGRAMFILES(X86)%\\Git\\bin',
    '%PROGRAMFILES%\\Git\\mingw64\\bin',
  ],
};

export function isSecurePath(pathStr: string): boolean {
  const dangerousPatterns = [
    /[;&|`${}[\]<>!"^]/,  // Shell metacharacters (parentheses removed - safe when quoted)
    /%[^%]+%/,              // Windows environment variable expansion (e.g., %PATH%)
    /\.\.\//,               // Unix directory traversal
    /\.\.\\/,               // Windows directory traversal
    /[\r\n]/,               // Newlines (command injection)
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(pathStr)) {
      return false;
    }
  }

  return true;
}

/**
 * Expand Windows environment variables in a path pattern
 * Uses centralized expandWindowsEnvVars from platform module for consistency
 * @param pathPattern - Path pattern with %VARIABLE% placeholders
 * @returns Expanded path, or null if expansion fails and path contains unexpanded variables
 */
function expandWindowsPath(pathPattern: string): string | null {
  const expanded = expandWindowsEnvVars(pathPattern);
  // Check if any unexpanded placeholders remain (indicates missing env vars)
  if (/%[^%]+%/.test(expanded)) {
    return null;
  }
  // Normalize the path (resolve double backslashes, etc.)
  return path.normalize(expanded);
}

export function getWindowsExecutablePaths(
  toolPaths: WindowsToolPaths,
  logPrefix: string = '[Windows Paths]'
): string[] {
  // Only run on Windows
  if (!isWindows()) {
    return [];
  }

  const validPaths: string[] = [];

  for (const pattern of toolPaths.patterns) {
    const expandedDir = expandWindowsPath(pattern);

    if (!expandedDir) {
      console.warn(`${logPrefix} Could not expand path pattern: ${pattern}`);
      continue;
    }

    const fullPath = path.join(expandedDir, toolPaths.executable);

    // Security validation - reject potentially dangerous paths
    if (!isSecurePath(fullPath)) {
      console.warn(`${logPrefix} Path failed security validation: ${fullPath}`);
      continue;
    }

    if (existsSync(fullPath)) {
      validPaths.push(fullPath);
    }
  }

  return validPaths;
}

/**
 * Find a Windows executable using the `where` command.
 * This is the most reliable method as it searches:
 * - All directories in PATH
 * - App Paths registry entries
 * - Current directory
 *
 * Works regardless of where the tool is installed (custom paths, different drives, etc.)
 *
 * @param executable - The executable name (e.g., 'git', 'gh', 'python')
 * @param logPrefix - Prefix for console logging
 * @returns The full path to the executable, or null if not found
 */
export function findWindowsExecutableViaWhere(
  executable: string,
  logPrefix: string = '[Windows Where]'
): string | null {
  if (!isWindows()) {
    return null;
  }

  // Security: Only allow simple executable names (alphanumeric, dash, underscore, dot)
  if (!/^[\w.-]+$/.test(executable)) {
    console.warn(`${logPrefix} Invalid executable name: ${executable}`);
    return null;
  }

  try {
    // Use 'where' command to find the executable
    // where.exe is a built-in Windows command that finds executables
    const result = execFileSync('where.exe', [executable], {
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true,
    }).trim();

    // 'where' returns multiple paths separated by newlines if found in multiple locations
    // Prefer paths with .cmd or .exe extensions (executable files)
    const paths = result.split(/\r?\n/).filter(p => p.trim());

    if (paths.length > 0) {
      // Prefer .cmd, .bat, or .exe extensions, otherwise take first path
      const foundPath = (paths.find(p => /\.(cmd|bat|exe)$/i.test(p)) || paths[0]).trim();

      // Validate the path exists and is secure
      if (existsSync(foundPath) && isSecurePath(foundPath)) {
        console.log(`${logPrefix} Found via where: ${foundPath}`);
        return foundPath;
      }
    }

    return null;
  } catch {
    // 'where' returns exit code 1 if not found, which throws an error
    return null;
  }
}

/**
 * Async version of getWindowsExecutablePaths.
 * Use this in async contexts to avoid blocking the main process.
 */
export async function getWindowsExecutablePathsAsync(
  toolPaths: WindowsToolPaths,
  logPrefix: string = '[Windows Paths]'
): Promise<string[]> {
  // Only run on Windows
  if (!isWindows()) {
    return [];
  }

  const validPaths: string[] = [];

  for (const pattern of toolPaths.patterns) {
    const expandedDir = expandWindowsPath(pattern);

    if (!expandedDir) {
      console.warn(`${logPrefix} Could not expand path pattern: ${pattern}`);
      continue;
    }

    const fullPath = path.join(expandedDir, toolPaths.executable);

    // Security validation - reject potentially dangerous paths
    if (!isSecurePath(fullPath)) {
      console.warn(`${logPrefix} Path failed security validation: ${fullPath}`);
      continue;
    }

    try {
      await access(fullPath, constants.F_OK);
      validPaths.push(fullPath);
    } catch {
      // File doesn't exist, skip
    }
  }

  return validPaths;
}

/**
 * Async version of findWindowsExecutableViaWhere.
 * Use this in async contexts to avoid blocking the main process.
 *
 * Find a Windows executable using the `where` command.
 * This is the most reliable method as it searches:
 * - All directories in PATH
 * - App Paths registry entries
 * - Current directory
 *
 * Works regardless of where the tool is installed (custom paths, different drives, etc.)
 *
 * @param executable - The executable name (e.g., 'git', 'gh', 'python')
 * @param logPrefix - Prefix for console logging
 * @returns The full path to the executable, or null if not found
 */
export async function findWindowsExecutableViaWhereAsync(
  executable: string,
  logPrefix: string = '[Windows Where]'
): Promise<string | null> {
  if (!isWindows()) {
    return null;
  }

  // Security: Only allow simple executable names (alphanumeric, dash, underscore, dot)
  if (!/^[\w.-]+$/.test(executable)) {
    console.warn(`${logPrefix} Invalid executable name: ${executable}`);
    return null;
  }

  try {
    // Use 'where' command to find the executable
    // where.exe is a built-in Windows command that finds executables
    const { stdout } = await execFileAsync('where.exe', [executable], {
      encoding: 'utf-8',
      timeout: 5000,
      windowsHide: true,
    });

    // 'where' returns multiple paths separated by newlines if found in multiple locations
    // Prefer paths with .cmd, .bat, or .exe extensions (executable files)
    const paths = stdout.trim().split(/\r?\n/).filter(p => p.trim());

    if (paths.length > 0) {
      // Prefer .cmd, .bat, or .exe extensions, otherwise take first path
      const foundPath = (paths.find(p => /\.(cmd|bat|exe)$/i.test(p)) || paths[0]).trim();

      // Validate the path exists and is secure
      try {
        await access(foundPath, constants.F_OK);
        if (isSecurePath(foundPath)) {
          console.log(`${logPrefix} Found via where: ${foundPath}`);
          return foundPath;
        }
      } catch {
        // Path doesn't exist
      }
    }

    return null;
  } catch {
    // 'where' returns exit code 1 if not found, which throws an error
    return null;
  }
}
