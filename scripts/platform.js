/**
 * Platform Abstraction for Node.js Scripts
 *
 * Centralized platform detection for scripts in this directory.
 * Mirrors the frontend platform module but for standalone Node.js scripts.
 */

const os = require('os');

/**
 * Check if running on Windows
 */
function isWindows() {
  return os.platform() === 'win32';
}

/**
 * Check if running on macOS
 */
function isMac() {
  return os.platform() === 'darwin';
}

/**
 * Check if running on Linux
 */
function isLinux() {
  return os.platform() === 'linux';
}

module.exports = {
  isWindows,
  isMac,
  isLinux,
};
