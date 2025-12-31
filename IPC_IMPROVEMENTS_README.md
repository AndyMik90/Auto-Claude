# שיפורי איכות קוד - שכבת IPC

## 📖 סקירה כללית

מסמך זה מתאר שיפורים מקיפים לשכבת התקשורת (IPC) בין ה-Frontend ל-Backend באפליקציית Auto-Claude.

## 🎯 מטרות השיפורים

1. **אחידות** - מבנה אחיד לכל ה-IPC handlers
2. **Type Safety** - בטיחות טיפוסית מלאה עם validation
3. **Error Handling** - טיפול בשגיאות מרכזי ועקבי
4. **Maintainability** - קוד קל יותר לתחזוקה ולהרחבה
5. **Performance** - מנגנוני caching ו-retry אופציונליים

## 📦 רכיבים חדשים

### 1. מערכת טיפול בשגיאות (`ipc-error-handler.ts`)

```typescript
import { IPCError, IPCErrorCodes, assert } from '@/shared/utils/ipc-error-handler';

// זריקת שגיאה מובנית
throw new IPCError(
  'Project not found',
  IPCErrorCodes.NOT_FOUND,
  { projectId }
);

// וידוא תנאי
assert(
  project !== null,
  'Project is required',
  IPCErrorCodes.VALIDATION_ERROR
);
```

**תכונות:**
- סוגי שגיאות סטנדרטיים
- הוספת context לשגיאות
- טיפול אוטומטי בשגיאות
- הודעות שגיאה ידידותיות למשתמש

### 2. Middleware Framework (`ipc-middleware.ts`)

```typescript
import { registerIPCHandler, defaultMiddlewareStack } from '@/main/ipc-handlers/middleware';

registerIPCHandler(
  IPC_CHANNELS.ROADMAP_GET,
  async (_, args) => {
    // Handler logic
  },
  defaultMiddlewareStack({ contextName: 'roadmap:get' })
);
```

**Middleware זמינים:**
- `loggingMiddleware` - לוגים אוטומטיים
- `timingMiddleware` - מדידת זמן ביצוע
- `errorHandlingMiddleware` - טיפול בשגיאות
- `validationMiddleware` - אימות קלט
- `rateLimitMiddleware` - הגבלת קריאות

### 3. Schema Validation (`ipc-validators.ts`)

```typescript
import { Validators } from '@/shared/validators/ipc-validators';
import { z } from 'zod';

// שימוש ב-validator קיים
const { projectId } = Validators.projectAdd(args);

// יצירת validator חדש
const mySchema = z.object({
  id: z.string().min(1),
  options: z.object({
    enabled: z.boolean(),
  }).optional(),
});

const validate = createIPCValidator(mySchema);
const validated = validate(data);
```

**תכונות:**
- אימות מבוסס Zod
- הודעות שגיאה ברורות
- Validators מוכנים לשימוש
- תמיכה מלאה ב-TypeScript

### 4. Retry Mechanism (`ipc-retry.ts`)

```typescript
import { withRetry, RetryPresets } from '@/shared/utils/ipc-retry';

const result = await withRetry(
  () => window.electronAPI.getRoadmap(projectId),
  {
    ...RetryPresets.standard,
    onRetry: (attempt, error) => {
      console.log(`Retry ${attempt}:`, error);
    },
  }
);
```

**תכונות:**
- Backoff strategies (linear, exponential, fixed)
- Configurable retry conditions
- Retry presets להקלה
- Callbacks לעדכון UI

### 5. Response Caching (`ipc-cache.ts`)

```typescript
import { createCachedAPI } from '@/shared/utils/ipc-cache';

const cachedAPI = createCachedAPI(window.electronAPI, {
  getRoadmap: 60000, // 1 minute cache
  getProjects: 30000, // 30 seconds cache
});

// שימוש רגיל - caching אוטומטי
const roadmap = await cachedAPI.getRoadmap('project-1');
```

**תכונות:**
- TTL per-method
- LRU eviction
- Cache invalidation
- Statistics and monitoring

## 🔄 תהליך מעבר

### שלב 1: התקנת Dependencies

```bash
cd apps/frontend
npm install zod
```

### שלב 2: רפקטור Handler בודד

1. בחר handler להתחלה (מומלץ: handler פשוט)
2. צור Zod schema לפרמטרים
3. החלף `ipcMain.handle` ב-`registerIPCHandler`
4. החלף טיפול בשגיאות ידני ב-`assert()` / `IPCError`
5. הוסף middleware stack
6. בדוק את ה-handler

### שלב 3: עדכון Frontend (אם נדרש)

```typescript
// לפני
const result = await window.electronAPI.getRoadmap(projectId);

// אחרי (עם retry)
import { withRetry, RetryPresets } from '@/shared/utils/ipc-retry';

const result = await withRetry(
  () => window.electronAPI.getRoadmap(projectId),
  RetryPresets.standard
);
```

### שלב 4: הרחבה הדרגתית

- המשך לרפקטר handlers נוספים
- הוסף validators משותפים ל-`ipc-validators.ts`
- שפר middleware לפי צורך

## 📝 דוגמאות שימוש

### דוגמה 1: Handler פשוט עם Validation

```typescript
import { z } from 'zod';
import { registerIPCHandler, defaultMiddlewareStack } from './middleware/ipc-middleware';
import { createIPCValidator } from '@/shared/validators/ipc-validators';
import { IPCError, IPCErrorCodes } from '@/shared/utils/ipc-error-handler';

const getTaskSchema = z.object({
  taskId: z.string().min(1, 'Task ID is required'),
});

const validateGetTask = createIPCValidator(getTaskSchema);

registerIPCHandler(
  IPC_CHANNELS.TASK_GET,
  async (_, args) => {
    const { taskId } = validateGetTask(args);
    
    const task = taskStore.getTask(taskId);
    if (!task) {
      throw new IPCError(
        'Task not found',
        IPCErrorCodes.NOT_FOUND,
        { taskId }
      );
    }
    
    return { success: true, data: task };
  },
  defaultMiddlewareStack()
);
```

### דוגמה 2: Handler עם Rate Limiting

```typescript
import { rateLimitMiddleware } from './middleware/ipc-middleware';

registerIPCHandler(
  IPC_CHANNELS.ROADMAP_GENERATE,
  async (_, args) => {
    // Implementation
  },
  [
    rateLimitMiddleware({
      maxCalls: 3,
      windowMs: 60000,
      keyFn: (args) => args.projectId,
    }),
    ...defaultMiddlewareStack(),
  ]
);
```

### דוגמה 3: Frontend עם Retry ו-Cache

```typescript
import { createCachedAPI } from '@/shared/utils/ipc-cache';
import { withRetry, RetryPresets } from '@/shared/utils/ipc-retry';

// יצירת API עם cache
const cachedAPI = createCachedAPI(window.electronAPI, {
  getRoadmap: 60000,
  getProjects: 30000,
});

// שימוש עם retry
async function loadRoadmap(projectId: string) {
  return withRetry(
    () => cachedAPI.getRoadmap(projectId),
    RetryPresets.network
  );
}
```

## 🧪 בדיקות

### Unit Tests למידלוור

```typescript
import { loggingMiddleware, timingMiddleware } from './ipc-middleware';

describe('IPC Middleware', () => {
  it('should log requests', async () => {
    const handler = jest.fn().mockResolvedValue({ success: true });
    const wrapped = loggingMiddleware()(handler);
    
    await wrapped({} as any, 'arg1');
    
    expect(handler).toHaveBeenCalledWith({}, 'arg1');
  });
  
  it('should measure timing', async () => {
    const handler = jest.fn().mockResolvedValue({ success: true });
    const wrapped = timingMiddleware()(handler);
    
    const result = await wrapped({} as any);
    
    expect(result.metadata?.duration).toBeDefined();
  });
});
```

### Integration Tests

```typescript
import { registerIPCHandler } from './ipc-middleware';
import { ipcMain } from 'electron';

describe('IPC Handler Integration', () => {
  it('should handle successful request', async () => {
    registerIPCHandler(
      'test:channel',
      async () => ({ success: true, data: 'test' }),
      []
    );
    
    const result = await ipcMain.invoke('test:channel');
    
    expect(result.success).toBe(true);
    expect(result.data).toBe('test');
  });
});
```

## 📊 השוואת לפני ואחרי

### לפני השיפורים

```typescript
ipcMain.handle('task:start', async (_, taskId: string) => {
  try {
    const task = taskStore.getTask(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }
    
    // Start task logic...
    
    return { success: true };
  } catch (error) {
    console.error('Error:', error);
    return { success: false, error: 'Internal error' };
  }
});
```

### אחרי השיפורים

```typescript
registerIPCHandler(
  IPC_CHANNELS.TASK_START,
  async (_, args) => {
    const { taskId } = Validators.taskStart(args);
    
    const task = taskStore.getTask(taskId);
    assert(task !== null, 'Task not found', IPCErrorCodes.NOT_FOUND);
    
    // Start task logic...
    
    return { success: true };
  },
  defaultMiddlewareStack()
);
```

**היתרונות:**
- ✅ קוד נקי וקריא יותר
- ✅ Type safety מלא
- ✅ טיפול בשגיאות עקבי
- ✅ Logging אוטומטי
- ✅ קל יותר לתחזוקה

## 📈 מדדי הצלחה

- [ ] כל ה-handlers משתמשים ב-middleware
- [ ] כל הקלטים עוברים validation
- [ ] אין שימוש ב-`any` בקוד IPC
- [ ] כל השגיאות מטופלות עם `IPCError`
- [ ] Coverage של 80%+ בבדיקות
- [ ] זמן תגובה ממוצע < 100ms

## 🚀 תכנון עבודה

### Priority 1 (שבוע 1-2)
- [x] יצירת קבצי utility (error handler, middleware, validators)
- [ ] רפקטור 3-5 handlers מרכזיים
- [ ] בדיקות integration

### Priority 2 (שבוע 3-4)
- [ ] רפקטור יתר ה-handlers
- [ ] הוספת retry mechanism למקומות קריטיים
- [ ] תיעוד API contracts

### Priority 3 (שבוע 5-6)
- [ ] הוספת caching למקומות מתאימים
- [ ] אופטימיזציה ו-performance tuning
- [ ] בדיקות מקיפות

## 📚 משאבים

- [תכנית שיפור מפורטת](CODE_QUALITY_IMPROVEMENTS.md)
- [דוגמה מלאה](apps/frontend/src/main/ipc-handlers/examples/refactored-handler-example.ts)
- [Electron IPC Documentation](https://www.electronjs.org/docs/latest/tutorial/ipc)
- [Zod Documentation](https://zod.dev/)

## 🤝 תרומה

כשמרפקטרים handler:

1. עקוב אחר הדוגמאות במסמך זה
2. הוסף tests
3. עדכן תיעוד אם נדרש
4. בקש code review

## ❓ שאלות נפוצות

### מתי להשתמש ב-retry?
השתמש ב-retry עבור פעולות שעלולות להיכשל זמנית (network, rate limits).

### מתי להשתמש ב-cache?
השתמש ב-cache עבור נתונים שמשתנים לאט (projects, settings).

### איך מטפלים בשגיאות async?
השתמש ב-`errorHandlingMiddleware` - הוא תופס את כל השגיאות אוטומטית.

### איך יוצרים validator חדש?
```typescript
const schema = z.object({ /* ... */ });
const validator = createIPCValidator(schema);
```

## 📞 יצירת קשר

לשאלות או בעיות, פתח issue ב-GitHub או פנה לצוות הפיתוח.

---

**עודכן לאחרונה:** 30 דצמבר 2025
