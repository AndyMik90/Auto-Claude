/**
 * Debug Logger
 * Only logs when DEBUG=true in environment
 */

import { getEnvVar } from '../platform';

/**
 * Check if debug mode is enabled via DEBUG environment variable.
 * Uses centralized getEnvVar for case-insensitive Windows access.
 */
export const isDebugEnabled = (): boolean => {
  return getEnvVar('DEBUG') === 'true';
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
