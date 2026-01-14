const { pathToFileURL } = require('url');
const { resolve } = require('path');

// This loader intercepts electron imports and converts them to use require()
exports.resolve = async (specifier, context, nextResolve) => {
  if (specifier === 'electron') {
    // Return the path to electron's index.js
    const electronPath = resolve(context.parentURL || '..', 'node_modules', 'electron', 'index.js');
    return {
      url: pathToFileURL(electronPath).href,
      format: 'commonjs'
    };
  }
  return nextResolve(specifier, context, nextResolve);
};
