/**
 * IPC Error Handling Utilities
 * 
 * Provides centralized error handling for IPC communication
 */

import { debugError, debugLog } from './debug-logger';
import type { IPCResult } from '../types/common';

/**
 * Standard IPC error codes
 */
export const IPCErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  RATE_LIMIT: 'RATE_LIMIT',
  CONFLICT: 'CONFLICT',
} as const;

export type IPCErrorCode = typeof IPCErrorCodes[keyof typeof IPCErrorCodes];

/**
 * Custom error class for IPC operations
 */
export class IPCError extends Error {
  public readonly code: IPCErrorCode;
  public readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    code: IPCErrorCode,
    context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IPCError';
    this.code = code;
    this.context = context;
    
    // Maintain proper stack trace for where error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IPCError);
    }
  }

  toJSON() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Handle IPC errors in a consistent way
 * 
 * @param error - The error to handle
 * @param context - Context string for logging
 * @returns IPCResult with error information
 */
export function handleIPCError(error: unknown, context: string): IPCResult {
  // Handle IPCError instances
  if (error instanceof IPCError) {
    debugError(`[${context}] ${error.code}:`, error.message, error.context);
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      errorContext: error.context,
    };
  }

  // Handle standard Error instances
  if (error instanceof Error) {
    debugError(`[${context}] Error:`, error.message, error.stack);
    return {
      success: false,
      error: error.message,
      errorCode: IPCErrorCodes.INTERNAL_ERROR,
      errorContext: { originalError: error.name },
    };
  }

  // Handle unknown error types
  debugError(`[${context}] Unknown error:`, error);
  return {
    success: false,
    error: 'An unexpected error occurred',
    errorCode: IPCErrorCodes.INTERNAL_ERROR,
    errorContext: { originalError: String(error) },
  };
}

/**
 * Create a user-friendly error message based on error code
 */
export function getUserFriendlyError(code: IPCErrorCode, defaultMessage: string): string {
  const messages: Record<IPCErrorCode, string> = {
    [IPCErrorCodes.NOT_FOUND]: 'The requested resource was not found',
    [IPCErrorCodes.UNAUTHORIZED]: 'Authentication is required to perform this action',
    [IPCErrorCodes.VALIDATION_ERROR]: 'The provided data is invalid',
    [IPCErrorCodes.INTERNAL_ERROR]: 'An internal error occurred. Please try again',
    [IPCErrorCodes.TIMEOUT]: 'The operation timed out. Please try again',
    [IPCErrorCodes.PERMISSION_DENIED]: 'You do not have permission to perform this action',
    [IPCErrorCodes.RATE_LIMIT]: 'Too many requests. Please wait before trying again',
    [IPCErrorCodes.CONFLICT]: 'A conflict occurred. Please refresh and try again',
  };

  return messages[code] || defaultMessage;
}

/**
 * Assert that a condition is true, throwing an IPCError if not
 */
export function assert(
  condition: boolean,
  message: string,
  code: IPCErrorCode = IPCErrorCodes.VALIDATION_ERROR,
  context?: Record<string, unknown>
): asserts condition {
  if (!condition) {
    throw new IPCError(message, code, context);
  }
}

/**
 * Wrap an async function to automatically handle errors
 */
export function withErrorHandling<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<IPCResult<TResult>>,
  contextName: string
) {
  return async (...args: TArgs): Promise<IPCResult<TResult>> => {
    try {
      return await fn(...args);
    } catch (error) {
      return handleIPCError(error, contextName);
    }
  };
}
