/**
 * IPC Request Validator using Zod
 * 
 * Provides schema-based validation for IPC requests
 */

import { z } from 'zod';
import { IPCError, IPCErrorCodes } from '../utils/ipc-error-handler';

/**
 * Create a validator function from a Zod schema
 * 
 * @param schema - Zod schema to validate against
 * @returns Validator function that throws IPCError on validation failure
 */
export function createIPCValidator<T extends z.ZodType>(schema: T) {
  return (data: unknown): z.infer<T> => {
    const result = schema.safeParse(data);
    
    if (!result.success) {
      const errors = result.error.issues.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));
      
      throw new IPCError(
        'Validation failed',
        IPCErrorCodes.VALIDATION_ERROR,
        { validationErrors: errors }
      );
    }
    
    return result.data;
  };
}

/**
 * Common validation schemas
 */
export const CommonSchemas = {
  /**
   * Non-empty string
   */
  nonEmptyString: z.string().min(1, 'String cannot be empty'),
  
  /**
   * Project ID
   */
  projectId: z.string().min(1, 'Project ID is required'),
  
  /**
   * Task ID
   */
  taskId: z.string().min(1, 'Task ID is required'),
  
  /**
   * File path
   */
  filePath: z.string().min(1, 'File path is required'),
  
  /**
   * Optional language code
   */
  language: z.enum(['en', 'he', 'es', 'fr', 'de', 'it', 'pt', 'ru', 'zh', 'ja']).optional(),
  
  /**
   * Pagination params
   */
  pagination: z.object({
    page: z.number().int().positive().optional().default(1),
    pageSize: z.number().int().positive().max(100).optional().default(20),
    sortBy: z.string().optional(),
    sortOrder: z.enum(['asc', 'desc']).optional(),
  }).optional(),
  
  /**
   * Date range
   */
  dateRange: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  }).optional(),
};

/**
 * Example schemas for common operations
 */
export const ValidationSchemas = {
  /**
   * Task start request
   */
  taskStart: z.object({
    taskId: CommonSchemas.taskId,
    options: z.object({
      baseBranch: z.string().optional(),
      language: CommonSchemas.language,
      force: z.boolean().optional(),
    }).optional(),
  }),
  
  /**
   * Task stop request
   */
  taskStop: z.object({
    taskId: CommonSchemas.taskId,
    reason: z.string().optional(),
  }),
  
  /**
   * Project add request
   */
  projectAdd: z.object({
    projectPath: CommonSchemas.filePath,
    settings: z.object({
      mainBranch: z.string().optional(),
      autoBuildPath: z.string().optional(),
    }).optional(),
  }),
  
  /**
   * Task create request
   */
  taskCreate: z.object({
    projectId: CommonSchemas.projectId,
    title: CommonSchemas.nonEmptyString,
    description: CommonSchemas.nonEmptyString,
    metadata: z.object({
      baseBranch: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high']).optional(),
      tags: z.array(z.string()).optional(),
    }).optional(),
    language: CommonSchemas.language,
  }),
  
  /**
   * Roadmap generation request
   */
  roadmapGenerate: z.object({
    projectId: CommonSchemas.projectId,
    enableCompetitorAnalysis: z.boolean().optional(),
    refreshCompetitorAnalysis: z.boolean().optional(),
    language: CommonSchemas.language,
  }),
  
  /**
   * Settings update request
   */
  settingsUpdate: z.object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    language: CommonSchemas.language,
    defaultIDE: z.string().optional(),
    autoBuildPath: z.string().optional(),
    featureModels: z.record(z.string(), z.string()).optional(),
    featureThinking: z.record(z.string(), z.string()).optional(),
  }),
};

/**
 * Create validators from schemas
 */
export const Validators = {
  taskStart: createIPCValidator(ValidationSchemas.taskStart),
  taskStop: createIPCValidator(ValidationSchemas.taskStop),
  projectAdd: createIPCValidator(ValidationSchemas.projectAdd),
  taskCreate: createIPCValidator(ValidationSchemas.taskCreate),
  roadmapGenerate: createIPCValidator(ValidationSchemas.roadmapGenerate),
  settingsUpdate: createIPCValidator(ValidationSchemas.settingsUpdate),
};

/**
 * Validate multiple values against a schema
 */
export function validateMany<T extends z.ZodType>(
  schema: T,
  values: unknown[]
): z.infer<T>[] {
  const validator = createIPCValidator(schema);
  return values.map(value => validator(value));
}

/**
 * Validate object properties against different schemas
 */
export function validateObject<T extends Record<string, z.ZodType>>(
  schemas: T,
  obj: Record<string, unknown>
): { [K in keyof T]: z.infer<T[K]> } {
  const result = {} as { [K in keyof T]: z.infer<T[K]> };
  
  for (const key in schemas) {
    const validator = createIPCValidator(schemas[key]);
    result[key] = validator(obj[key]);
  }
  
  return result;
}

/**
 * Create a partial validator (all fields optional)
 */
export function createPartialValidator<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return createIPCValidator(schema.partial());
}
