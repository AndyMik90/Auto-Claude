/**
 * Configuration Paths Module
 *
 * Provides XDG Base Directory Specification compliant paths for storing
 * application configuration and data. This is essential for AppImage,
 * Flatpak, and Snap installations where the application runs in a
 * sandboxed or immutable filesystem environment.
 *
 * XDG Base Directory Specification:
 * - $XDG_CONFIG_HOME: User configuration (default: ~/.config)
 * - $XDG_DATA_HOME: User data (default: ~/.local/share)
 * - $XDG_CACHE_HOME: User cache (default: ~/.cache)
 *
 * @see https://specifications.freedesktop.org/basedir-spec/basedir-spec-latest.html
 */

import * as path from 'path';
import * as os from 'os';
import { isLinux, getEnvVar } from './platform';

const APP_NAME = 'auto-claude';

/**
 * Join path components using forward slashes (XDG standard).
 * XDG paths always use forward slashes, even on Windows.
 */
function joinXdgPath(...segments: string[]): string {
  // Replace backslashes in each segment, then join with forward slashes
  const normalizedSegments = segments.map(s => s.replace(/\\/g, '/'));
  return normalizedSegments.join('/');
}

/**
 * Get the XDG config home directory
 * Uses $XDG_CONFIG_HOME if set, otherwise defaults to ~/.config
 * Returns normalized XDG-style path with forward slashes.
 */
export function getXdgConfigHome(): string {
  const envValue = getEnvVar('XDG_CONFIG_HOME');
  if (envValue) {
    return joinXdgPath(envValue);
  }
  return joinXdgPath(os.homedir(), '.config');
}

/**
 * Get the XDG data home directory
 * Uses $XDG_DATA_HOME if set, otherwise defaults to ~/.local/share
 * Returns normalized XDG-style path with forward slashes.
 */
export function getXdgDataHome(): string {
  const envValue = getEnvVar('XDG_DATA_HOME');
  if (envValue) {
    return joinXdgPath(envValue);
  }
  return joinXdgPath(os.homedir(), '.local', 'share');
}

/**
 * Get the XDG cache home directory
 * Uses $XDG_CACHE_HOME if set, otherwise defaults to ~/.cache
 * Returns normalized XDG-style path with forward slashes.
 */
export function getXdgCacheHome(): string {
  const envValue = getEnvVar('XDG_CACHE_HOME');
  if (envValue) {
    return joinXdgPath(envValue);
  }
  return joinXdgPath(os.homedir(), '.cache');
}

/**
 * Get the application config directory
 * Returns the XDG-compliant path for storing configuration files
 */
export function getAppConfigDir(): string {
  return joinXdgPath(getXdgConfigHome(), APP_NAME);
}

/**
 * Get the application data directory
 * Returns the XDG-compliant path for storing application data
 */
export function getAppDataDir(): string {
  return joinXdgPath(getXdgDataHome(), APP_NAME);
}

/**
 * Get the application cache directory
 * Returns the XDG-compliant path for storing cache files
 */
export function getAppCacheDir(): string {
  return joinXdgPath(getXdgCacheHome(), APP_NAME);
}

/**
 * Get the memories storage directory
 * This is where graph databases are stored (previously ~/.auto-claude/memories)
 */
export function getMemoriesDir(): string {
  // For compatibility, we still support the legacy path
  const legacyPath = path.join(os.homedir(), '.auto-claude', 'memories');

  // On Linux with XDG variables set (AppImage, Flatpak, Snap), use XDG path
  // Use getEnvVar for consistent environment variable access pattern
  if (isLinux() && (getEnvVar('XDG_DATA_HOME') || getEnvVar('APPIMAGE') || getEnvVar('SNAP') || getEnvVar('FLATPAK_ID'))) {
    return joinXdgPath(getXdgDataHome(), APP_NAME, 'memories');
  }

  // Default to legacy path for backwards compatibility
  return legacyPath;
}

/**
 * Get the graphs storage directory (alias for memories)
 */
export function getGraphsDir(): string {
  return getMemoriesDir();
}

/**
 * Check if running in an immutable filesystem environment
 * (AppImage, Flatpak, Snap, etc.)
 */
export function isImmutableEnvironment(): boolean {
  // Use getEnvVar for consistent environment variable access pattern
  return !!(
    getEnvVar('APPIMAGE') ||
    getEnvVar('SNAP') ||
    getEnvVar('FLATPAK_ID')
  );
}

/**
 * Get environment-appropriate path for a given type
 * Handles the differences between regular installs and sandboxed environments
 *
 * @param type - The type of path needed: 'config', 'data', 'cache', 'memories'
 * @returns The appropriate path for the current environment
 */
export function getAppPath(type: 'config' | 'data' | 'cache' | 'memories'): string {
  switch (type) {
    case 'config':
      return getAppConfigDir();
    case 'data':
      return getAppDataDir();
    case 'cache':
      return getAppCacheDir();
    case 'memories':
      return getMemoriesDir();
    default:
      return getAppDataDir();
  }
}
