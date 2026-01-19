// CommonJS wrapper for build scripts that cannot import TypeScript directly.
'use strict';

function getCurrentPlatform() {
  const p = process.platform;
  if (p === 'win32' || p === 'darwin' || p === 'linux') {
    return p;
  }
  return 'unknown';
}

function isWindows() {
  return getCurrentPlatform() === 'win32';
}

function isMacOS() {
  return getCurrentPlatform() === 'darwin';
}

function isLinux() {
  return getCurrentPlatform() === 'linux';
}

function isUnix() {
  return isMacOS() || isLinux();
}

module.exports = {
  getCurrentPlatform,
  isWindows,
  isMacOS,
  isLinux,
  isUnix,
};
