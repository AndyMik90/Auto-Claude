/**
 * Retry utility with exponential backoff for critical operations
 *
 * Provides resilient error handling for:
 * - Subprocess operations
 * - Network requests
 * - File I/O operations
 * - Database calls
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxAttempts?: number;
  /** Initial delay in milliseconds (default: 1000) */
  initialDelay?: number;
  /** Maximum delay in milliseconds (default: 30000) */
  maxDelay?: number;
  /** Backoff multiplier (default: 2 for exponential) */
  backoffMultiplier?: number;
  /** Whether to add jitter to prevent thundering herd (default: true) */
  jitter?: boolean;
  /** Custom function to determine if an error is retryable (default: all errors retryable) */
  isRetryable?: (error: unknown) => boolean;
  /** Callback for each retry attempt */
  onRetry?: (error: unknown, attempt: number, delay: number) => void;
}

export interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: unknown;
  attempts: number;
  totalDuration: number;
}

/**
 * Execute a function with retry logic and exponential backoff
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Promise resolving to RetryResult
 *
 * @example
 * ```ts
 * const result = await withRetry(
 *   () => fetch('https://api.example.com/data'),
 *   { maxAttempts: 3, initialDelay: 1000 }
 * );
 *
 * if (result.success) {
 *   console.log('Data:', result.data);
 * } else {
 *   console.error('Failed after', result.attempts, 'attempts:', result.error);
 * }
 * ```
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 30000,
    backoffMultiplier = 2,
    jitter = true,
    isRetryable = () => true, // By default, retry all errors
    onRetry,
  } = options;

  const startTime = Date.now();
  let lastError: unknown;
  let attempts = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    attempts = attempt;

    try {
      const data = await fn();
      return {
        success: true,
        data,
        attempts,
        totalDuration: Date.now() - startTime,
      };
    } catch (error) {
      lastError = error;

      // If this is the last attempt or error is not retryable, fail immediately
      if (attempt >= maxAttempts || !isRetryable(error)) {
        return {
          success: false,
          error,
          attempts,
          totalDuration: Date.now() - startTime,
        };
      }

      // Calculate delay with exponential backoff
      let delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1);

      // Cap at max delay
      delay = Math.min(delay, maxDelay);

      // Add jitter to prevent thundering herd
      if (jitter) {
        delay = delay * (0.5 + Math.random() * 0.5);
      }

      // Call onRetry callback if provided
      onRetry?.(error, attempt, delay);

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Should never reach here, but TypeScript needs it
  return {
    success: false,
    error: lastError,
    attempts,
    totalDuration: Date.now() - startTime,
  };
}

/**
 * Common retry configurations for different operation types
 */
export const RetryPresets = {
  /**
   * For fast operations (API calls, database queries)
   * - 3 attempts with 1s initial delay, max 10s
   */
  fast: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
  } as RetryOptions,

  /**
   * For medium operations (subprocess calls, file operations)
   * - 3 attempts with 2s initial delay, max 30s
   */
  medium: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 30000,
  } as RetryOptions,

  /**
   * For slow operations (long-running processes, large file transfers)
   * - 5 attempts with 5s initial delay, max 60s
   */
  slow: {
    maxAttempts: 5,
    initialDelay: 5000,
    maxDelay: 60000,
  } as RetryOptions,

  /**
   * For critical operations that must succeed (data persistence, commits)
   * - 5 attempts with 3s initial delay, max 60s
   */
  critical: {
    maxAttempts: 5,
    initialDelay: 3000,
    maxDelay: 60000,
  } as RetryOptions,
};

/**
 * Helper to determine if an error is retryable based on common error patterns
 */
export function isRetryableError(error: unknown): boolean {
  // Network errors (ECONNREFUSED, ETIMEDOUT, ENOTFOUND, etc.)
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    const retryablePatterns = [
      'econnrefused',
      'etimedout',
      'enotfound',
      'econnreset',
      'epipe',
      'network',
      'timeout',
      'rate limit',
      'too many requests',
      '429',
      '503',
      '504',
      'socket hang up',
      'request timeout',
    ];

    return retryablePatterns.some((pattern) => message.includes(pattern));
  }

  // HTTP status codes (if error has a status property)
  const httpError = error as { status?: number; statusCode?: number };
  if (httpError.status || httpError.statusCode) {
    const status = httpError.status || httpError.statusCode;
    // Retry on 429 (rate limit), 500s (server errors), but not 4xx client errors
    return status === 429 || status === 503 || status === 504 || (status !== undefined && status >= 500);
  }

  // Default to retryable
  return true;
}

/**
 * Wrapper for async functions that automatically retries with preset configuration
 *
 * @example
 * ```ts
 * const fetchData = retryable(
 *   async () => fetch('https://api.example.com/data'),
 *   RetryPresets.fast
 * );
 *
 * const result = await fetchData();
 * ```
 */
export function retryable<T>(
  fn: () => Promise<T>,
  options: RetryOptions = RetryPresets.medium
): () => Promise<T> {
  return async () => {
    const result = await withRetry(fn, options);
    if (result.success && result.data !== undefined) {
      return result.data;
    }
    throw result.error;
  };
}
