/**
 * Debug Logger
 * Only logs when DEBUG=true in environment
 */

/**
 * Case-insensitive environment variable lookup for Windows compatibility
 * On Windows, environment variables are case-insensitive (DEBUG, debug, Debug all work)
 * On Unix, this falls back to direct access for performance
 */
const getEnvVarCaseInsensitive = (name: string): string | undefined => {
  if (typeof process === 'undefined' || !process.env) {
    return undefined;
  }

  // On Windows, environment variables are case-insensitive
  // Node.js may return keys with different casing depending on how they were set
  if (typeof process.platform !== 'undefined' && process.platform === 'win32') {
    const upperName = name.toUpperCase();
    for (const [key, value] of Object.entries(process.env)) {
      if (key.toUpperCase() === upperName) {
        return value;
      }
    }
    return undefined;
  }

  // On Unix, direct access is fine
  return process.env[name];
};

export const isDebugEnabled = (): boolean => {
  return getEnvVarCaseInsensitive('DEBUG') === 'true';
};

export const debugLog = (...args: unknown[]): void => {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
};

export const debugWarn = (...args: unknown[]): void => {
  if (isDebugEnabled()) {
    console.warn(...args);
  }
};

export const debugError = (...args: unknown[]): void => {
  if (isDebugEnabled()) {
    console.error(...args);
  }
};
