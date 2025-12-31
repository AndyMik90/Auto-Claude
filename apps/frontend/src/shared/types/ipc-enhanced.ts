/**
 * Enhanced Common Types for IPC Communication
 * 
 * Extends the base IPCResult with additional metadata and type safety
 */

/**
 * Standard IPC result wrapper
 */
export interface IPCResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
  errorContext?: Record<string, unknown>;
  metadata?: {
    timestamp?: number;
    duration?: number;
    version?: string;
    cached?: boolean;
  };
}

/**
 * Type-safe IPC channel definition
 * Associates request and response types with a channel
 */
export type IPCChannelDefinition<TRequest, TResponse> = {
  request: TRequest;
  response: TResponse;
};

/**
 * Extract request type from channel definition
 */
export type ExtractRequest<T> = T extends IPCChannelDefinition<infer R, unknown> ? R : never;

/**
 * Extract response type from channel definition
 */
export type ExtractResponse<T> = T extends IPCChannelDefinition<unknown, infer R> ? R : never;

/**
 * Pagination parameters for list operations
 */
export interface PaginationParams {
  page?: number;
  pageSize?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * Paginated response wrapper
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

/**
 * Filter parameters for search/filter operations
 */
export interface FilterParams {
  query?: string;
  filters?: Record<string, unknown>;
  dateRange?: {
    from?: Date;
    to?: Date;
  };
}

/**
 * Batch operation result
 */
export interface BatchResult<T> {
  successful: Array<{ id: string; data: T }>;
  failed: Array<{ id: string; error: string }>;
  summary: {
    total: number;
    succeeded: number;
    failed: number;
  };
}

/**
 * Progress update for long-running operations
 */
export interface ProgressUpdate {
  stage: string;
  progress: number; // 0-100
  message?: string;
  estimatedTimeRemaining?: number;
}

/**
 * Stream chunk for streaming responses
 */
export interface StreamChunk<T> {
  type: 'data' | 'error' | 'complete';
  data?: T;
  error?: string;
  sequenceNumber: number;
}
