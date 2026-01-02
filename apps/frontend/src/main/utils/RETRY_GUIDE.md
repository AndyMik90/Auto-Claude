# Retry Logic Usage Guide

This guide explains how to use the retry utility (`retry.ts`) to add resilience to critical operations in Auto Claude.

## Overview

The retry utility provides automatic retry logic with exponential backoff for:
- Subprocess operations (Python backend calls)
- Network requests (API calls)
- File I/O operations
- Database queries
- Any async operation that may fail transiently

## Quick Start

### Basic Usage

```typescript
import { withRetry, RetryPresets } from './retry';

// Retry a network request
const result = await withRetry(
  () => fetch('https://api.github.com/repos/owner/repo'),
  RetryPresets.fast
);

if (result.success) {
  console.log('Data:', result.data);
} else {
  console.error('Failed after', result.attempts, 'attempts');
}
```

### Using the Wrapper Function

```typescript
import { retryable, RetryPresets } from './retry';

// Create a retryable function
const fetchRepo = retryable(
  () => fetch('https://api.github.com/repos/owner/repo'),
  RetryPresets.fast
);

// Use it like a normal async function (throws on failure)
const data = await fetchRepo();
```

## Retry Presets

The utility provides 4 built-in presets optimized for different operation types:

| Preset | Max Attempts | Initial Delay | Max Delay | Use Case |
|--------|--------------|---------------|-----------|----------|
| `fast` | 3 | 1s | 10s | API calls, DB queries |
| `medium` | 3 | 2s | 30s | Subprocess calls, file ops |
| `slow` | 5 | 5s | 60s | Long processes, large transfers |
| `critical` | 5 | 3s | 60s | Data persistence, commits |

### Example: Subprocess Operations

```typescript
import { runPythonSubprocessWithRetry } from '../ipc-handlers/github/utils/subprocess-runner';
import { RetryPresets } from './retry';

const result = await runPythonSubprocessWithRetry({
  pythonPath: getPythonPath(backendPath),
  args: ['runner.py', '--analyze-pr', '123'],
  cwd: backendPath,
}, RetryPresets.medium);
```

## Custom Retry Configuration

```typescript
import { withRetry, isRetryableError } from './retry';

const result = await withRetry(
  () => myOperation(),
  {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    jitter: true,
    isRetryable: isRetryableError,
    onRetry: (error, attempt, delay) => {
      console.log(`Retry #${attempt} in ${delay}ms due to:`, error);
    }
  }
);
```

## Error Detection

### Automatic Retryable Error Detection

The `isRetryableError()` function automatically detects common transient errors:

**Network Errors:**
- ECONNREFUSED, ETIMEDOUT, ENOTFOUND
- ECONNRESET, EPIPE
- Socket hang up, request timeout

**HTTP Errors:**
- 429 (Rate Limit)
- 503, 504 (Service Unavailable, Gateway Timeout)
- 5xx (Server Errors)

**Non-retryable:**
- 4xx client errors (except 429)
- Validation errors
- Authentication errors

### Custom Retry Logic

```typescript
const result = await withRetry(
  () => myDatabaseQuery(),
  {
    maxAttempts: 3,
    isRetryable: (error) => {
      // Only retry on specific database errors
      const dbError = error as { code?: string };
      return dbError.code === 'ER_LOCK_DEADLOCK' ||
             dbError.code === 'ER_LOCK_WAIT_TIMEOUT';
    }
  }
);
```

## Integration Examples

### GitHub API Calls

```typescript
import { withRetry, RetryPresets, isRetryableError } from '../utils/retry';

async function fetchPullRequest(owner: string, repo: string, prNumber: number) {
  const result = await withRetry(
    () => fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${prNumber}`),
    {
      ...RetryPresets.fast,
      isRetryable: (error) => {
        // Retry on network errors and rate limits
        if (isRetryableError(error)) return true;

        // Don't retry on 404 (PR not found)
        const httpError = error as { status?: number };
        return httpError.status !== 404;
      },
      onRetry: (error, attempt, delay) => {
        console.log(`[GitHub API] Retry #${attempt} in ${delay}ms`);
      }
    }
  );

  if (!result.success) {
    throw new Error(`Failed to fetch PR after ${result.attempts} attempts`);
  }

  return result.data;
}
```

### File Operations

```typescript
import { withRetry, RetryPresets } from '../utils/retry';
import fs from 'fs/promises';

async function writeFileWithRetry(path: string, content: string) {
  const result = await withRetry(
    () => fs.writeFile(path, content, 'utf8'),
    {
      ...RetryPresets.critical, // 5 attempts for critical data
      onRetry: (error, attempt) => {
        console.log(`[File Write] Retry #${attempt} for ${path}`);
      }
    }
  );

  if (!result.success) {
    throw new Error(`Failed to write file after ${result.attempts} attempts`);
  }
}
```

### Database Queries

```typescript
import { withRetry, RetryPresets } from '../utils/retry';

async function executeQuery<T>(query: string): Promise<T> {
  const result = await withRetry(
    () => db.execute<T>(query),
    {
      ...RetryPresets.fast,
      isRetryable: (error) => {
        const dbError = error as { code?: string };
        // Retry on transient DB errors
        return ['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT', 'ER_QUERY_TIMEOUT'].includes(
          dbError.code || ''
        );
      }
    }
  );

  if (!result.success) {
    throw result.error;
  }

  return result.data!;
}
```

## Best Practices

### 1. Choose the Right Preset

- **Fast operations** (< 5s): Use `RetryPresets.fast`
- **Medium operations** (5-30s): Use `RetryPresets.medium`
- **Slow operations** (30s+): Use `RetryPresets.slow`
- **Critical data**: Use `RetryPresets.critical`

### 2. Don't Retry Everything

```typescript
// ❌ BAD: Retrying validation errors
await withRetry(() => validateUserInput(data), RetryPresets.fast);

// ✅ GOOD: Only retry network operations
await withRetry(
  () => fetch(url),
  {
    ...RetryPresets.fast,
    isRetryable: isRetryableError
  }
);
```

### 3. Log Retry Attempts

```typescript
await withRetry(
  () => criticalOperation(),
  {
    ...RetryPresets.critical,
    onRetry: (error, attempt, delay) => {
      console.error(`Retry #${attempt} after ${delay}ms:`, error);
      // Could also send to monitoring/alerting system
    }
  }
);
```

### 4. Handle Final Failure

```typescript
const result = await withRetry(() => operation(), RetryPresets.medium);

if (!result.success) {
  // Log comprehensive failure information
  console.error({
    error: result.error,
    attempts: result.attempts,
    totalDuration: result.totalDuration,
    operation: 'operation-name'
  });

  // Show user-friendly error
  throw new Error('Operation failed. Please try again later.');
}
```

### 5. Consider Timeouts

```typescript
import { withRetry, RetryPresets } from './retry';

// Add timeout to prevent hanging
const withTimeout = <T>(promise: Promise<T>, ms: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timeout')), ms)
    )
  ]);
};

const result = await withRetry(
  () => withTimeout(longRunningOperation(), 60000), // 60s timeout
  RetryPresets.slow
);
```

## Monitoring and Debugging

### Track Retry Metrics

```typescript
let retryCount = 0;
let totalRetryDelay = 0;

const result = await withRetry(
  () => operation(),
  {
    ...RetryPresets.medium,
    onRetry: (error, attempt, delay) => {
      retryCount++;
      totalRetryDelay += delay;
      console.log(`Total retries: ${retryCount}, Total delay: ${totalRetryDelay}ms`);
    }
  }
);

// Log metrics for monitoring
if (retryCount > 0) {
  console.log({
    operation: 'operation-name',
    retries: retryCount,
    totalDelay: totalRetryDelay,
    success: result.success
  });
}
```

### Debug Mode

```typescript
const DEBUG = process.env.NODE_ENV === 'development';

const result = await withRetry(
  () => operation(),
  {
    ...RetryPresets.medium,
    onRetry: (error, attempt, delay) => {
      if (DEBUG) {
        console.log('[RETRY]', {
          attempt,
          delay,
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined
        });
      }
    }
  }
);
```

## Testing Retry Logic

```typescript
import { describe, it, expect, vi } from 'vitest';
import { withRetry } from './retry';

describe('Retry Logic', () => {
  it('should retry on transient failures', async () => {
    let attempts = 0;
    const operation = vi.fn(async () => {
      attempts++;
      if (attempts < 3) {
        throw new Error('ETIMEDOUT');
      }
      return 'success';
    });

    const result = await withRetry(operation, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(result.success).toBe(true);
    expect(result.attempts).toBe(3);
    expect(operation).toHaveBeenCalledTimes(3);
  });

  it('should fail after max attempts', async () => {
    const operation = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    });

    const result = await withRetry(operation, {
      maxAttempts: 3,
      initialDelay: 10,
    });

    expect(result.success).toBe(false);
    expect(result.attempts).toBe(3);
  });
});
```

## Migration Guide

### Before (No Retry Logic)

```typescript
async function fetchData() {
  const result = await runPythonSubprocess({
    pythonPath,
    args,
    cwd
  });

  if (!result.success) {
    throw new Error('Failed');
  }

  return result.data;
}
```

### After (With Retry Logic)

```typescript
async function fetchData() {
  const result = await runPythonSubprocessWithRetry({
    pythonPath,
    args,
    cwd
  }, {
    ...RetryPresets.medium,
    onRetry: (error, attempt) => {
      console.log(`Retrying... Attempt #${attempt}`);
    }
  });

  if (!result.success) {
    throw new Error(`Failed after ${result.attempts} attempts`);
  }

  return result.data;
}
```

## Common Issues

### Issue: Infinite Retry Loop

**Problem:** Operation keeps retrying indefinitely

**Solution:** Ensure `isRetryable()` excludes permanent failures

```typescript
isRetryable: (error) => {
  // ❌ BAD: Retries everything
  return true;

  // ✅ GOOD: Only retry transient errors
  return isRetryableError(error);
}
```

### Issue: Slow Recovery

**Problem:** Application takes too long to recover

**Solution:** Reduce initial delay and max delay

```typescript
// ❌ BAD: Too slow for fast operations
await withRetry(fastOperation, RetryPresets.slow);

// ✅ GOOD: Use appropriate preset
await withRetry(fastOperation, RetryPresets.fast);
```

### Issue: Too Many Retries

**Problem:** Overwhelming the system with retry attempts

**Solution:** Add backoff and reduce max attempts

```typescript
await withRetry(operation, {
  maxAttempts: 3, // Not 10
  backoffMultiplier: 2, // Exponential backoff
  jitter: true // Prevent thundering herd
});
```

## See Also

- `retry.ts` - Retry utility implementation
- `subprocess-runner.ts` - Example usage with subprocess operations
- [GitHub Issue #491](https://github.com/AndyMik90/Auto-Claude/issues/491) - Retry logic tracking issue
