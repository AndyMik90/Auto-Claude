# תכנית שיפור איכות קוד - שכבת IPC

## סקירה כללית
מסמך זה מתאר שיפורים מוצעים לשכבת התקשורת בין Frontend ל-Backend (IPC Layer).

## 🎯 יעדים

1. **אחידות** - ליצור מבנה אחיד לכל ה-IPC handlers
2. **Type Safety** - לחזק את הבטיחות הטיפוסית בכל השכבות
3. **Validation** - להוסיף שכבת validation מרכזית
4. **Error Handling** - לשפר את הטיפול בשגיאות
5. **Documentation** - לתעד את ה-API contracts

---

## 📦 שיפורים מוצעים

### 1. Error Handling מרכזי

**בעיה נוכחית:**
```typescript
// בקבצים שונים יש טיפול שונה בשגיאות
console.warn('[TASK_START] No main window found');
console.error('[Roadmap Handler] Failed to read feature settings:', error);
```

**פתרון מוצע:**
```typescript
// apps/frontend/src/shared/utils/ipc-error-handler.ts
export class IPCError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IPCError';
  }
}

export const IPCErrorCodes = {
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export function handleIPCError(error: unknown, context: string): IPCResult {
  if (error instanceof IPCError) {
    debugError(`[${context}] ${error.code}:`, error.message, error.context);
    return {
      success: false,
      error: error.message,
      errorCode: error.code,
      errorContext: error.context,
    };
  }
  
  debugError(`[${context}] Unexpected error:`, error);
  return {
    success: false,
    error: 'Internal server error',
    errorCode: IPCErrorCodes.INTERNAL_ERROR,
  };
}
```

---

### 2. IPC Request Validator

**בעיה נוכחית:**
- כל handler מבצע validation משלו
- אין בדיקות עקביות

**פתרון מוצע:**
```typescript
// apps/frontend/src/main/ipc-handlers/validators/schema-validator.ts
import { z } from 'zod';

export function createIPCValidator<T extends z.ZodType>(schema: T) {
  return (data: unknown): z.infer<T> => {
    const result = schema.safeParse(data);
    if (!result.success) {
      throw new IPCError(
        'Validation failed',
        IPCErrorCodes.VALIDATION_ERROR,
        { errors: result.error.errors }
      );
    }
    return result.data;
  };
}

// דוגמה לשימוש
const taskStartOptionsSchema = z.object({
  taskId: z.string().min(1),
  options: z.object({
    baseBranch: z.string().optional(),
    language: z.string().optional(),
  }).optional(),
});

export const validateTaskStartOptions = createIPCValidator(taskStartOptionsSchema);
```

---

### 3. Middleware Pattern for Handlers

**פתרון מוצע:**
```typescript
// apps/frontend/src/main/ipc-handlers/middleware/ipc-middleware.ts
import { ipcMain, IpcMainInvokeEvent } from 'electron';

export type IPCHandler<TArgs extends unknown[], TResult> = (
  event: IpcMainInvokeEvent,
  ...args: TArgs
) => Promise<IPCResult<TResult>>;

export type IPCMiddleware = <TArgs extends unknown[], TResult>(
  handler: IPCHandler<TArgs, TResult>
) => IPCHandler<TArgs, TResult>;

// Logging middleware
export const loggingMiddleware: IPCMiddleware = (handler) => {
  return async (event, ...args) => {
    const startTime = Date.now();
    debugLog(`[IPC] Handler started with args:`, args);
    
    try {
      const result = await handler(event, ...args);
      const duration = Date.now() - startTime;
      debugLog(`[IPC] Handler completed in ${duration}ms`, result);
      return result;
    } catch (error) {
      debugError(`[IPC] Handler failed:`, error);
      throw error;
    }
  };
};

// Validation middleware
export const validationMiddleware = <T>(
  validator: (data: unknown) => T
): IPCMiddleware => {
  return (handler) => {
    return async (event, ...args) => {
      try {
        const validatedArgs = args.map(arg => validator(arg));
        return await handler(event, ...validatedArgs as unknown[]);
      } catch (error) {
        return handleIPCError(error, 'Validation');
      }
    };
  };
};

// Error handling middleware
export const errorHandlingMiddleware: IPCMiddleware = (handler) => {
  return async (event, ...args) => {
    try {
      return await handler(event, ...args);
    } catch (error) {
      return handleIPCError(error, 'Handler');
    }
  };
};

// Compose multiple middlewares
export function composeMiddlewares(...middlewares: IPCMiddleware[]): IPCMiddleware {
  return (handler) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
}

// Helper to register handler with middlewares
export function registerIPCHandler<TArgs extends unknown[], TResult>(
  channel: string,
  handler: IPCHandler<TArgs, TResult>,
  middlewares: IPCMiddleware[] = []
) {
  const composedMiddleware = composeMiddlewares(...middlewares);
  const wrappedHandler = composedMiddleware(handler);
  ipcMain.handle(channel, wrappedHandler);
}
```

---

### 4. Enhanced Type Definitions

**פתרון מוצע:**
```typescript
// apps/frontend/src/shared/types/common.ts
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
  };
}

// Create strongly-typed IPC channel definitions
export type IPCChannelDefinition<TRequest, TResponse> = {
  request: TRequest;
  response: TResponse;
};

// Example usage
export type IPCChannels = {
  'task:start': IPCChannelDefinition<
    { taskId: string; options?: TaskStartOptions },
    Task
  >;
  'task:stop': IPCChannelDefinition<
    { taskId: string },
    void
  >;
  'project:add': IPCChannelDefinition<
    { projectPath: string },
    Project
  >;
  // ... more channels
};
```

---

### 5. API Contract Documentation

**פתרון מוצע:**
```typescript
// apps/frontend/src/shared/docs/api-contracts.ts
/**
 * IPC API Contract Documentation
 * 
 * This file serves as the single source of truth for all IPC communication
 * contracts between the frontend and backend.
 */

export const IPC_API_CONTRACTS = {
  'task:start': {
    description: 'Starts a task execution',
    request: {
      taskId: 'string (required) - The unique task identifier',
      options: {
        baseBranch: 'string (optional) - Base branch for worktree',
        language: 'string (optional) - Language for spec generation',
      },
    },
    response: {
      success: 'boolean - Indicates if operation succeeded',
      data: 'Task | undefined - The updated task object',
      error: 'string | undefined - Error message if failed',
    },
    errors: {
      NOT_FOUND: 'Task or project not found',
      UNAUTHORIZED: 'No valid Claude authentication',
      VALIDATION_ERROR: 'Invalid request parameters',
    },
    example: `
      // Request
      await window.electronAPI.startTask('task-123', {
        baseBranch: 'main',
        language: 'en'
      });
      
      // Response (success)
      { success: true, data: { id: 'task-123', ... } }
      
      // Response (error)
      { success: false, error: 'Task not found', errorCode: 'NOT_FOUND' }
    `,
  },
  // ... more contracts
} as const;
```

---

### 6. Retry Mechanism

**פתרון מוצע:**
```typescript
// apps/frontend/src/shared/utils/ipc-retry.ts
export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  backoff?: 'linear' | 'exponential';
  retryableErrors?: string[];
}

export async function withRetry<T>(
  fn: () => Promise<IPCResult<T>>,
  options: RetryOptions
): Promise<IPCResult<T>> {
  const { maxAttempts, delayMs, backoff = 'exponential', retryableErrors } = options;
  
  let lastError: IPCResult<T> | undefined;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const result = await fn();
      
      if (result.success) {
        return result;
      }
      
      // Check if error is retryable
      if (retryableErrors && result.errorCode) {
        if (!retryableErrors.includes(result.errorCode)) {
          return result; // Not retryable, return immediately
        }
      }
      
      lastError = result;
      
      if (attempt < maxAttempts) {
        const delay = backoff === 'exponential'
          ? delayMs * Math.pow(2, attempt - 1)
          : delayMs * attempt;
        
        debugLog(`[Retry] Attempt ${attempt} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    } catch (error) {
      debugError(`[Retry] Attempt ${attempt} threw error:`, error);
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }
  
  return lastError || { success: false, error: 'All retry attempts failed' };
}

// Usage example
const result = await withRetry(
  () => window.electronAPI.getRoadmap(projectId),
  {
    maxAttempts: 3,
    delayMs: 1000,
    backoff: 'exponential',
    retryableErrors: [IPCErrorCodes.TIMEOUT, IPCErrorCodes.INTERNAL_ERROR],
  }
);
```

---

### 7. Request/Response Caching

**פתרון מוצע:**
```typescript
// apps/frontend/src/renderer/utils/ipc-cache.ts
export class IPCCache {
  private cache = new Map<string, { data: unknown; timestamp: number }>();
  private ttlMs: number;

  constructor(ttlMs: number = 60000) {
    this.ttlMs = ttlMs;
  }

  getCacheKey(channel: string, ...args: unknown[]): string {
    return `${channel}:${JSON.stringify(args)}`;
  }

  get<T>(channel: string, ...args: unknown[]): T | undefined {
    const key = this.getCacheKey(channel, ...args);
    const cached = this.cache.get(key);
    
    if (!cached) return undefined;
    
    const isExpired = Date.now() - cached.timestamp > this.ttlMs;
    if (isExpired) {
      this.cache.delete(key);
      return undefined;
    }
    
    return cached.data as T;
  }

  set<T>(channel: string, data: T, ...args: unknown[]): void {
    const key = this.getCacheKey(channel, ...args);
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  invalidate(channel?: string): void {
    if (!channel) {
      this.cache.clear();
      return;
    }
    
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${channel}:`)) {
        this.cache.delete(key);
      }
    }
  }
}

// Create cached API wrapper
export function createCachedAPI<T extends Record<string, unknown>>(
  api: T,
  cacheConfig: Record<keyof T, number>
): T {
  const caches = new Map<keyof T, IPCCache>();
  
  return new Proxy(api, {
    get(target, prop: string | symbol) {
      const key = prop as keyof T;
      if (typeof target[key] !== 'function') {
        return target[key];
      }
      
      const ttl = cacheConfig[key];
      if (!ttl) {
        return target[key]; // No caching for this method
      }
      
      if (!caches.has(key)) {
        caches.set(key, new IPCCache(ttl));
      }
      
      const cache = caches.get(key)!;
      
      return async (...args: unknown[]) => {
        const cached = cache.get(String(prop), ...args);
        if (cached !== undefined) {
          debugLog(`[Cache] Hit for ${String(prop)}`);
          return cached;
        }
        
        debugLog(`[Cache] Miss for ${String(prop)}`);
        const result = await (target[key] as Function)(...args);
        cache.set(String(prop), result, ...args);
        return result;
      };
    },
  }) as T;
}
```

---

## 📊 סדר עדיפויות ליישום

### Priority 1 (High) - Critical for stability
1. ✅ Error Handling מרכזי
2. ✅ Enhanced Type Definitions
3. ✅ Validation middleware

### Priority 2 (Medium) - Improves developer experience
4. ✅ Middleware Pattern
5. ✅ API Contract Documentation

### Priority 3 (Low) - Nice to have
6. ✅ Retry Mechanism
7. ✅ Request/Response Caching

---

## 🔄 תכנית מעבר (Migration Plan)

### שלב 1: הקמת תשתית (1-2 ימים)
- [ ] יצירת קבצי utility חדשים
- [ ] הגדרת types משופרים
- [ ] יצירת middleware framework

### שלב 2: רפקטורינג הדרגתי (3-5 ימים)
- [ ] התחלה עם handler אחד (למשל roadmap-handlers)
- [ ] מעבר של 2-3 handlers נוספים
- [ ] בדיקות integration

### שלב 3: מעבר מלא (5-7 ימים)
- [ ] מעבר של כל ה-handlers
- [ ] עדכון תיעוד
- [ ] בדיקות מקיפות

### שלב 4: אופטימיזציה (2-3 ימים)
- [ ] הוספת caching
- [ ] הוספת retry logic
- [ ] מדידות performance

---

## 📝 דוגמה מלאה להטמעה

### לפני:
```typescript
// roadmap-handlers.ts
ipcMain.handle(
  IPC_CHANNELS.ROADMAP_GET,
  async (_, projectId: string): Promise<IPCResult<Roadmap | null>> => {
    const project = projectStore.getProject(projectId);
    if (!project) {
      return { success: false, error: 'Project not found' };
    }

    const roadmapPath = path.join(
      project.path,
      AUTO_BUILD_PATHS.ROADMAP_DIR,
      AUTO_BUILD_PATHS.ROADMAP_FILE
    );

    try {
      const content = readFileSync(roadmapPath, 'utf-8');
      const roadmap = JSON.parse(content);
      return { success: true, data: roadmap };
    } catch (error) {
      console.error('Failed to read roadmap:', error);
      return { success: false, error: 'Failed to read roadmap' };
    }
  }
);
```

### אחרי:
```typescript
// roadmap-handlers.ts
import { z } from 'zod';
import { registerIPCHandler, loggingMiddleware, errorHandlingMiddleware } from './middleware';
import { createIPCValidator, IPCError, IPCErrorCodes } from './validators';

const getRoadmapSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
});

const validateGetRoadmap = createIPCValidator(getRoadmapSchema);

registerIPCHandler(
  IPC_CHANNELS.ROADMAP_GET,
  async (_, args) => {
    const { projectId } = validateGetRoadmap(args);
    
    const project = projectStore.getProject(projectId);
    if (!project) {
      throw new IPCError(
        'Project not found',
        IPCErrorCodes.NOT_FOUND,
        { projectId }
      );
    }

    const roadmapPath = path.join(
      project.path,
      AUTO_BUILD_PATHS.ROADMAP_DIR,
      AUTO_BUILD_PATHS.ROADMAP_FILE
    );

    if (!existsSync(roadmapPath)) {
      return { success: true, data: null };
    }

    const content = await fs.promises.readFile(roadmapPath, 'utf-8');
    const roadmap = JSON.parse(content);
    
    return {
      success: true,
      data: roadmap,
      metadata: {
        timestamp: Date.now(),
      },
    };
  },
  [loggingMiddleware, errorHandlingMiddleware]
);
```

---

## 🧪 בדיקות

### Unit Tests
```typescript
describe('IPC Middleware', () => {
  it('should log request and response', async () => {
    const handler = jest.fn().mockResolvedValue({ success: true });
    const wrappedHandler = loggingMiddleware(handler);
    
    await wrappedHandler({} as IpcMainInvokeEvent, 'test-arg');
    
    expect(handler).toHaveBeenCalledWith({}, 'test-arg');
  });

  it('should handle errors gracefully', async () => {
    const handler = jest.fn().mockRejectedValue(new Error('Test error'));
    const wrappedHandler = errorHandlingMiddleware(handler);
    
    const result = await wrappedHandler({} as IpcMainInvokeEvent);
    
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});
```

---

## 📚 משאבים נוספים

- [Electron IPC Best Practices](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [TypeScript Handbook - Advanced Types](https://www.typescriptlang.org/docs/handbook/2/types-from-types.html)
- [Zod Documentation](https://zod.dev/)

---

## ✅ Checklist לסיום

- [ ] כל ה-handlers משתמשים במידלוור אחיד
- [ ] כל הבקשות עוברות validation
- [ ] כל השגיאות מטופלות בצורה עקבית
- [ ] התיעוד מעודכן
- [ ] בדיקות unit ו-integration עוברות
- [ ] Performance נמדד ומאושר
- [ ] Code review בוצע
