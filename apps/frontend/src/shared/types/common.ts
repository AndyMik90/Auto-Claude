/**
 * Common utility types shared across the application
 */

// IPC Types
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorContext?: Record<string, unknown>;
  metadata?: {
    timestamp?: number;
    duration?: number;
  };
}
