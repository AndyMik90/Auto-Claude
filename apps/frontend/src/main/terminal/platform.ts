/**
 * Platform abstraction for terminal operations.
 *
 * This module re-exports the shared platform abstraction for convenience
 * in terminal-specific code. The actual implementation is in shared/platform.ts
 * to allow it to be used by both main process code and shared utilities.
 */

export {
  getCurrentPlatform,
  isWindows,
  isMac,
  isLinux,
  isUnix,
  type Platform
} from '../../shared/platform';
