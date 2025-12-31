/**
 * IPC Retry Mechanism
 * 
 * Provides automatic retry logic for failed IPC requests
 */

import { debugLog, debugError } from './debug-logger';
import type { IPCResult } from '../types/common';
import { IPCErrorCodes } from './ipc-error-handler';

/**
 * Configuration for retry behavior
 */
export interface RetryOptions {
  /** Maximum number of attempts (including the first attempt) */
  maxAttempts: number;
  
  /** Initial delay between retries in milliseconds */
  delayMs: number;
  
  /** Backoff strategy */
  backoff?: 'linear' | 'exponential' | 'fixed';
  
  /** Maximum delay between retries (for exponential backoff) */
  maxDelayMs?: number;
  
  /** Error codes that should trigger a retry */
  retryableErrors?: string[];
  
  /** Custom function to determine if error is retryable */
  shouldRetry?: (error: IPCResult) => boolean;
  
  /** Callback called before each retry */
  onRetry?: (attempt: number, error: IPCResult) => void;
}

/**
 * Default retryable error codes
 */
export const DEFAULT_RETRYABLE_ERRORS = [
  IPCErrorCodes.TIMEOUT,
  IPCErrorCodes.INTERNAL_ERROR,
  IPCErrorCodes.RATE_LIMIT,
];

/**
 * Calculate delay for next retry based on backoff strategy
 */
function calculateDelay(
  attempt: number,
  delayMs: number,
  backoff: 'linear' | 'exponential' | 'fixed',
  maxDelayMs?: number
): number {
  let delay: number;
  
  switch (backoff) {
    case 'linear':
      delay = delayMs * attempt;
      break;
    case 'exponential':
      delay = delayMs * Math.pow(2, attempt - 1);
      break;
    case 'fixed':
    default:
      delay = delayMs;
      break;
  }
  
  // Cap at maxDelayMs if specified
  if (maxDelayMs !== undefined) {
    delay = Math.min(delay, maxDelayMs);
  }
  
  return delay;
}

/**
 * Check if an error should be retried
 */
function isRetryable(error: IPCResult, options: RetryOptions): boolean {
  // Use custom shouldRetry function if provided
  if (options.shouldRetry) {
    return options.shouldRetry(error);
  }
  
  // Check if error code is in retryable list
  if (error.errorCode) {
    const retryableErrors = options.retryableErrors || DEFAULT_RETRYABLE_ERRORS;
    return retryableErrors.includes(error.errorCode);
  }
  
  // Don't retry if no error code
  return false;
}

/**
 * Retry a function with exponential backoff
 * 
 * @param fn - Async function to retry
 * @param options - Retry configuration
 * @returns Promise with final result
 * 
 * @example
 * const result = await withRetry(
 *   () => window.electronAPI.getRoadmap(projectId),
 *   {
 *     maxAttempts: 3,
 *     delayMs: 1000,
 *     backoff: 'exponential',
 *   }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<IPCResult<T>>,
  options: RetryOptions
): Promise<IPCResult<T>> {
  const {
    maxAttempts,
    delayMs,
    backoff = 'exponential',
    maxDelayMs,
    onRetry,
  } = options;
  
  let lastError: IPCResult<T> | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      debugLog(`[Retry] Attempt ${attempt}/${maxAttempts}`);
      const result = await fn();
      
      // Success - return immediately
      if (result.success) {
        if (attempt > 1) {
          debugLog(`[Retry] Succeeded on attempt ${attempt}`);
        }
        return result;
      }
      
      // Check if error is retryable
      if (!isRetryable(result, options)) {
        debugLog(`[Retry] Error not retryable:`, result.errorCode);
        return result;
      }
      
      lastError = result;
      
      // Don't wait after last attempt
      if (attempt < maxAttempts) {
        const delay = calculateDelay(attempt, delayMs, backoff, maxDelayMs);
        debugLog(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`, result.errorCode);
        
        // Call onRetry callback if provided
        if (onRetry) {
          onRetry(attempt, result);
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      debugError(`[Retry] Attempt ${attempt} threw error:`, error);
      
      // Re-throw on last attempt
      if (attempt === maxAttempts) {
        throw error;
      }
      
      // Wait before next attempt
      const delay = calculateDelay(attempt, delayMs, backoff, maxDelayMs);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  // All attempts exhausted
  debugError(`[Retry] All ${maxAttempts} attempts failed`);
  return lastError || {
    success: false,
    error: 'All retry attempts failed',
    errorCode: IPCErrorCodes.INTERNAL_ERROR,
  };
}

/**
 * Create a retryable version of an IPC function
 * 
 * @example
 * const retryableGetRoadmap = createRetryable(
 *   (projectId: string) => window.electronAPI.getRoadmap(projectId),
 *   { maxAttempts: 3, delayMs: 1000 }
 * );
 * 
 * const result = await retryableGetRoadmap('project-123');
 */
export function createRetryable<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => Promise<IPCResult<TResult>>,
  options: RetryOptions
) {
  return (...args: TArgs) => withRetry(() => fn(...args), options);
}

/**
 * Preset retry configurations for common scenarios
 */
export const RetryPresets = {
  /**
   * Quick retry - 3 attempts with short delays
   */
  quick: {
    maxAttempts: 3,
    delayMs: 500,
    backoff: 'exponential' as const,
    maxDelayMs: 2000,
  },
  
  /**
   * Standard retry - 3 attempts with moderate delays
   */
  standard: {
    maxAttempts: 3,
    delayMs: 1000,
    backoff: 'exponential' as const,
    maxDelayMs: 5000,
  },
  
  /**
   * Persistent retry - 5 attempts with longer delays
   */
  persistent: {
    maxAttempts: 5,
    delayMs: 2000,
    backoff: 'exponential' as const,
    maxDelayMs: 10000,
  },
  
  /**
   * Network retry - optimized for network operations
   */
  network: {
    maxAttempts: 3,
    delayMs: 1000,
    backoff: 'exponential' as const,
    maxDelayMs: 5000,
    retryableErrors: [
      IPCErrorCodes.TIMEOUT,
      IPCErrorCodes.INTERNAL_ERROR,
    ],
  },
  
  /**
   * Rate limit retry - handles rate limiting
   */
  rateLimit: {
    maxAttempts: 3,
    delayMs: 5000,
    backoff: 'linear' as const,
    retryableErrors: [IPCErrorCodes.RATE_LIMIT],
  },
};
