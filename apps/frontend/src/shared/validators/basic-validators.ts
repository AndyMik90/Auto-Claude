/**
 * Simple IPC Validators - Starting Point
 * 
 * Basic validators for testing the new infrastructure
 */

import { z } from 'zod';

/**
 * Simple error class for validation
 */
export class ValidationError extends Error {
  constructor(message: string, public readonly details?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Create a simple validator from Zod schema
 */
export function createValidator<T extends z.ZodType>(schema: T) {
  return (data: unknown): z.infer<T> => {
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const errors = result.error.issues.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message,
      }));
      
      throw new ValidationError('Validation failed', { errors });
    }
    
    return result.data;
  };
}

/**
 * Basic validation schemas
 */
export const BasicSchemas = {
  projectId: z.string().min(1, 'Project ID is required'),
  taskId: z.string().min(1, 'Task ID is required'),
};
