/**
 * Platform abstraction for cross-platform operations.
 *
 * This module provides a centralized way to check the current platform
 * that can be easily mocked in tests. Tests can mock the getCurrentPlatform
 * function to test platform-specific behavior without relying on the
 * actual runtime platform.
 *
 * IMPORTANT: This file must not import from ../main/platform to avoid
 * pulling Node.js modules (fs, os, path, child_process) into the renderer
 * bundle, where they are not available. All functions here must use only
 * process.platform and process.env, which are available in the renderer.
 */

/**
 * Supported platform identifiers
 */
export type Platform = 'win32' | 'darwin' | 'linux' | 'unknown';

/**
 * Get the current platform identifier.
 *
 * In production, this returns the actual Node.js process.platform.
 * In tests, this can be mocked to test platform-specific behavior.
 *
 * @returns The current platform identifier
 */
export function getCurrentPlatform(): Platform {
  const p = process.platform;
  if (p === 'win32' || p === 'darwin' || p === 'linux') {
    return p;
  }
  return 'unknown';
}

/**
 * Check if the current platform is Windows.
 *
 * @returns true if running on Windows
 */
export function isWindows(): boolean {
  return getCurrentPlatform() === 'win32';
}

/**
 * Check if the current platform is macOS.
 *
 * @returns true if running on macOS
 */
export function isMacOS(): boolean {
  return getCurrentPlatform() === 'darwin';
}

/**
 * Check if the current platform is Linux.
 *
 * @returns true if running on Linux
 */
export function isLinux(): boolean {
  return getCurrentPlatform() === 'linux';
}

/**
 * Check if the current platform is Unix-like (macOS or Linux).
 *
 * @returns true if running on a Unix-like platform
 */
export function isUnix(): boolean {
  return isMacOS() || isLinux();
}

/**
 * Get a platform-specific environment variable value.
 *
 * Provides case-insensitive environment variable access on Windows,
 * where environment variable names are case-insensitive (e.g., PATH, Path, path).
 * On Unix systems, environment variable names are case-sensitive.
 *
 * This is a copy of the same function in ../main/platform/index.ts to avoid
 * pulling Node.js dependencies into the renderer bundle. Keep both in sync.
 *
 * @param name - Environment variable name
 * @returns The environment variable value, or undefined if not found
 */
export function getEnvVar(name: string): string | undefined {
  if (isWindows()) {
    // Try exact match first
    if (process.env[name] !== undefined) {
      return process.env[name];
    }
    // Fall back to case-insensitive search
    const lowerKey = Object.keys(process.env).find(
      (key) => key.toLowerCase() === name.toLowerCase()
    );
    return lowerKey !== undefined ? process.env[lowerKey] : undefined;
  }

  return process.env[name];
}
