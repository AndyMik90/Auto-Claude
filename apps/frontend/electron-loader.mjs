// Custom loader to handle electron ESM imports
import { pathToFileURL } from 'url';
import { resolve as pathResolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'electron') {
    // Get the actual electron module path using require
    const electronModulePath = require.resolve('electron');
    
    // Return with commonjs format and short circuit
    return {
      url: pathToFileURL(electronModulePath).href,
      format: 'commonjs',
      shortCircuit: true,
    };
  }
  
  return nextResolve(specifier, context, nextResolve);
}
