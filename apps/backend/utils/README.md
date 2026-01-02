# Utils Module

Utility modules for Auto Claude backend providing common functionality.

## File Utilities (`file_utils.py`)

Provides safe file I/O operations with retry logic and cross-platform file locking.

### Why This Exists

**FIX #491**: Critical operations like reading/writing `implementation_plan.json` need retry logic to handle transient file system errors (IOError, OSError, PermissionError).

**FIX #488**: Multiple processes (UI, agents, watchers) may access `implementation_plan.json` concurrently, requiring file locking to prevent race conditions.

### Features

- **Retry Logic**: Up to 3 attempts with exponential backoff (1s, 2s, 4s delays)
- **Cross-Platform Locking**: Works on Windows (msvcrt) and Unix (fcntl)
- **Atomic Writes**: Uses temp file + rename pattern to prevent partial writes
- **Type-Safe API**: Full type hints for IDE support

### Usage

```python
from utils.file_utils import safe_read_json, safe_write_json

# Read JSON with retry and locking
data = safe_read_json(Path("config.json"))

# Read with default value if file doesn't exist
data = safe_read_json(Path("config.json"), default={})

# Write JSON with retry and atomic write
safe_write_json(Path("config.json"), {"key": "value"})
```

### Available Functions

| Function | Description |
|----------|-------------|
| `safe_read_json(path, default=None)` | Read JSON file with retry and locking |
| `safe_write_json(path, data, indent=2)` | Write JSON file atomically with retry |
| `safe_read_text(path, default="")` | Read text file with retry and locking |
| `safe_write_text(path, content)` | Write text file atomically with retry |
| `with_file_lock(path, mode, timeout=10)` | Context manager for file locking |
| `retry_file_operation` | Decorator for custom file operations |

### File Locking

The `with_file_lock` context manager provides exclusive access:

```python
from utils.file_utils import with_file_lock

# Exclusive access while reading
with with_file_lock(Path("data.json"), "r") as f:
    data = json.load(f)

# Exclusive access while writing
with with_file_lock(Path("data.json"), "w") as f:
    json.dump(data, f)
```

### Custom Retry Operations

Use the decorator for your own file operations:

```python
from utils.file_utils import retry_file_operation

@retry_file_operation
def read_config(path: Path) -> dict:
    with open(path) as f:
        return json.load(f)
```

### Retry Configuration

Default settings (matching other retry patterns in the codebase):
- **Max Attempts**: 3
- **Backoff**: Exponential (1s min, 10s max)
- **Retried Errors**: IOError, OSError, PermissionError, BlockingIOError, FileLockError

### Error Handling

```python
from utils.file_utils import safe_read_json, FileOperationError, FileLockError

try:
    data = safe_read_json(Path("config.json"))
except FileLockError:
    # Unable to acquire lock within timeout
    pass
except json.JSONDecodeError:
    # Invalid JSON (not retried - data error)
    pass
```

## Integration with ImplementationPlan

The `ImplementationPlan.save()` and `ImplementationPlan.load()` methods now use these utilities automatically:

```python
from implementation_plan import ImplementationPlan

# These calls now have retry + locking built-in
plan = ImplementationPlan.load(plan_path)
plan.save(plan_path)
```

## Parallel Agent Execution (`core/progress.py`, `agents/coder.py`)

**FIX #487**: Enables true concurrent agent sessions for parallel-safe phases, reducing build time for independent subtasks.

### Features

- **Concurrent execution** using asyncio.gather() for truly parallel agent sessions
- **Semaphore limiting** prevents overwhelming the system (MAX_PARALLEL_AGENTS=5)
- **Dependency-aware** - only executes phases after dependencies are satisfied
- **Status tracking** - individual success/failure for each subtask
- **Backward compatible** - falls back to sequential execution for non-parallel-safe phases

### Usage

Mark phases as `parallel_safe` in `implementation_plan.json`:

```json
{
  "phases": [
    {
      "phase": 1,
      "parallel_safe": true,
      "subtasks": [
        {"id": "task-1", "description": "Component A"},
        {"id": "task-2", "description": "Component B"},
        {"id": "task-3", "description": "Component C"}
      ]
    }
  ]
}
```

For detailed usage, configuration, and best practices, see [PARALLEL_EXECUTION_GUIDE.md](./PARALLEL_EXECUTION_GUIDE.md).
