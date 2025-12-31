/**
 * IPC Middleware Framework
 * 
 * Provides composable middleware for IPC handlers with logging, validation, and error handling
 */

import { ipcMain, IpcMainInvokeEvent } from 'electron';
import { debugLog, debugError } from '../../../shared/utils/debug-logger';
import { handleIPCError } from '../../../shared/utils/ipc-error-handler';
import type { IPCResult } from '../../../shared/types/common';

/**
 * Generic IPC handler type
 */
export type IPCHandler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<IPCResult<TResult>>;

/**
 * Middleware function type - transforms a handler
 */
export type IPCMiddleware = <TArgs extends unknown[], TResult>(
  handler: IPCHandler<TArgs, TResult>
) => IPCHandler<TArgs, TResult>;

/**
 * Configuration for middleware
 */
export interface MiddlewareConfig {
  enableLogging?: boolean;
  enableTiming?: boolean;
  enableErrorHandling?: boolean;
  contextName?: string;
}

/**
 * Logging middleware - logs all IPC calls and their results
 */
export const loggingMiddleware = (config: { verbose?: boolean } = {}): IPCMiddleware => {
  return (handler) => {
    return async (event, ...args) => {
      const channel = (event as unknown as { _channel?: string })._channel || 'unknown';
      
      if (config.verbose) {
        debugLog(`[IPC] ${channel} called with args:`, args);
      } else {
        debugLog(`[IPC] ${channel} called`);
      }
      
      const result = await handler(event, ...args);
      
      if (config.verbose) {
        debugLog(`[IPC] ${channel} result:`, result);
      } else {
        debugLog(`[IPC] ${channel} completed - success: ${result.success}`);
      }
      
      return result;
    };
  };
};

/**
 * Timing middleware - measures execution time
 */
export const timingMiddleware = (config: { warnThresholdMs?: number } = {}): IPCMiddleware => {
  const { warnThresholdMs = 1000 } = config;
  
  return (handler) => {
    return async (event, ...args) => {
      const startTime = Date.now();
      const channel = (event as unknown as { _channel?: string })._channel || 'unknown';
      
      const result = await handler(event, ...args);
      
      const duration = Date.now() - startTime;
      
      if (duration > warnThresholdMs) {
        debugError(`[IPC] ${channel} took ${duration}ms (threshold: ${warnThresholdMs}ms)`);
      } else {
        debugLog(`[IPC] ${channel} completed in ${duration}ms`);
      }
      
      // Add timing metadata to result
      return {
        ...result,
        metadata: {
          ...result.metadata,
          duration,
          timestamp: Date.now(),
        },
      };
    };
  };
};

/**
 * Error handling middleware - catches and formats errors
 */
export const errorHandlingMiddleware = (contextName?: string): IPCMiddleware => {
  return (handler) => {
    return async (event, ...args) => {
      try {
        return await handler(event, ...args);
      } catch (error) {
        const channel = (event as unknown as { _channel?: string })._channel || 'unknown';
        const context = contextName || channel;
        return handleIPCError(error, context);
      }
    };
  };
};

/**
 * Validation middleware - validates arguments using a validator function
 */
export const validationMiddleware = <T>(
  validator: (data: unknown) => T,
  options: { skipValidation?: (args: unknown[]) => boolean } = {}
): IPCMiddleware => {
  return (handler) => {
    return async (event, ...args) => {
      // Allow skipping validation for certain cases
      if (options.skipValidation && options.skipValidation(args)) {
        return await handler(event, ...args);
      }
      
      try {
        // Validate each argument
        const validatedArgs = args.map(arg => validator(arg));
        return await handler(event, ...validatedArgs as unknown[]);
      } catch (error) {
        const channel = (event as unknown as { _channel?: string })._channel || 'unknown';
        return handleIPCError(error, `${channel}:validation`);
      }
    };
  };
};

/**
 * Rate limiting middleware - prevents too many rapid calls
 */
export const rateLimitMiddleware = (config: {
  maxCalls: number;
  windowMs: number;
  keyFn?: (...args: unknown[]) => string;
}): IPCMiddleware => {
  const { maxCalls, windowMs, keyFn = () => 'default' } = config;
  const callCounts = new Map<string, { count: number; resetTime: number }>();
  
  return (handler) => {
    return async (event, ...args) => {
      const key = keyFn(...args);
      const now = Date.now();
      
      let record = callCounts.get(key);
      
      // Reset if window expired
      if (!record || now > record.resetTime) {
        record = { count: 0, resetTime: now + windowMs };
        callCounts.set(key, record);
      }
      
      // Check limit
      if (record.count >= maxCalls) {
        return {
          success: false,
          error: 'Rate limit exceeded. Please try again later.',
          errorCode: 'RATE_LIMIT',
        };
      }
      
      record.count++;
      
      return await handler(event, ...args);
    };
  };
};

/**
 * Compose multiple middlewares into a single middleware
 */
export function composeMiddlewares(...middlewares: IPCMiddleware[]): IPCMiddleware {
  return (handler) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

/**
 * Helper to register an IPC handler with middlewares
 * 
 * @example
 * registerIPCHandler(
 *   IPC_CHANNELS.TASK_START,
 *   async (event, taskId: string) => {
 *     // handler implementation
 *   },
 *   [loggingMiddleware(), errorHandlingMiddleware('task:start')]
 * );
 */
export function registerIPCHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: IPCHandler<TArgs, TResult>,
  middlewares: IPCMiddleware[] = []
): void {
  const composedMiddleware = composeMiddlewares(...middlewares);
  const wrappedHandler = composedMiddleware(handler);
  
  // Store channel name in event for middleware access
  ipcMain.handle(channel, (event, ...args) => {
    (event as unknown as { _channel: string })._channel = channel;
    return wrappedHandler(event, ...args as TArgs);
  });
}

/**
 * Default middleware stack for common use cases
 */
export const defaultMiddlewareStack = (config: MiddlewareConfig = {}): IPCMiddleware[] => {
  const {
    enableLogging = true,
    enableTiming = true,
    enableErrorHandling = true,
    contextName,
  } = config;

  const middlewares: IPCMiddleware[] = [];

  if (enableLogging) {
    middlewares.push(loggingMiddleware({ verbose: false }));
  }

  if (enableTiming) {
    middlewares.push(timingMiddleware({ warnThresholdMs: 1000 }));
  }

  if (enableErrorHandling) {
    middlewares.push(errorHandlingMiddleware(contextName));
  }

  return middlewares;
};
