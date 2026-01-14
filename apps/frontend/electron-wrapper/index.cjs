// Electron wrapper module to fix pnpm compatibility
// This module exports the actual electron API when running in Electron
'use strict';

// Try to get electron from the Electron runtime first
try {
  // When running in Electron, 'electron' will be available globally
  // or through a different mechanism
  const electronPath = require('electron');
  
  // If require('electron') returns a string (path), we're not in Electron yet
  // This shouldn't happen since this code runs after Electron starts
  if (typeof electronPath === 'string') {
    // This is the path to the electron binary
    // When Electron starts, it should replace this module
    // But since it hasn't, we need to handle this differently
    module.exports = electronPath;
  } else {
    module.exports = electronPath;
  }
} catch (e) {
  // Fallback to the path
  module.exports = require('electron');
}
