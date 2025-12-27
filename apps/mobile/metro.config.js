const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Add 'mjs' to source extensions for ES module support
// This is required for some libraries that use .mjs files
config.resolver.sourceExts.push('mjs');

module.exports = config;
