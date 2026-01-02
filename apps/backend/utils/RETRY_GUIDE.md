# Python Backend Retry Logic Usage Guide

This guide explains how to use the retry utilities (`file_utils.py`) to add resilience to critical file operations in Auto Claude's Python backend.

## Overview

The retry utility provides automatic retry logic with exponential backoff and cross-platform file locking for:
- JSON file operations (implementation_plan.json, etc.)
- Text file operations
- Any file I/O that may fail transiently

**Key Features:**
- **Cross-platform file locking** (Windows msvcrt, Unix fcntl)
- **Exponential backoff** with jitter (1s, 2s, 4s delays)
- **Atomic writes** using temp file + rename pattern
- **Retry decorator** powered by the `tenacity` library
- **Lock timeout** handling to prevent deadlocks

## Quick Start

### Basic Usage

```python
from pathlib import Path
from utils.file_utils import safe_read_json, safe_write_json

# Read JSON with retry and locking
data = safe_read_json(Path("config.json"), default={})

# Write JSON with retry, locking, and atomic write
safe_write_json(Path("config.json"), {"key": "value"})
```

## Core Functions

### `safe_read_json(path, default=None)`

Read JSON file with retry logic and file locking.

**Parameters:**
- `path` (Path): Path to the JSON file
- `default` (Any): Value to return if file doesn't exist (default: None)

**Returns:** Parsed JSON data, or default if file doesn't exist

**Raises:**
- `FileOperationError`: If read fails after all retries
- `json.JSONDecodeError`: If file contains invalid JSON

**Example:**
```python
from pathlib import Path
from utils.file_utils import safe_read_json

# Read with default value
config = safe_read_json(Path("config.json"), default={})

# Read required file (raises if missing)
plan = safe_read_json(Path("implementation_plan.json"))
```

### `safe_write_json(path, data, indent=2, ensure_ascii=False)`

Write JSON file with retry logic, file locking, and atomic write.

Uses atomic write pattern: data is written to a temp file first, then renamed to prevent corruption.

**Parameters:**
- `path` (Path): Path to the JSON file
- `data` (Any): Data to serialize as JSON
- `indent` (int): JSON indentation (default: 2)
- `ensure_ascii` (bool): Whether to escape non-ASCII chars (default: False)

**Raises:**
- `FileOperationError`: If write fails after all retries
- `TypeError`: If data is not JSON-serializable

**Example:**
```python
from pathlib import Path
from utils.file_utils import safe_write_json

# Write with default settings
safe_write_json(Path("plan.json"), {"status": "in_progress"})

# Write with custom indentation
safe_write_json(Path("plan.json"), data, indent=4)
```

### `safe_read_text(path, default="")`

Read text file with retry logic and file locking.

**Example:**
```python
from pathlib import Path
from utils.file_utils import safe_read_text

# Read with default value
readme = safe_read_text(Path("README.md"), default="")
```

### `safe_write_text(path, content)`

Write text file with retry logic and atomic write.

**Example:**
```python
from pathlib import Path
from utils.file_utils import safe_write_text

safe_write_text(Path("output.txt"), "Hello, world!")
```

## Retry Configuration

The `FILE_RETRY_CONFIG` provides consistent retry behavior across all file operations:

```python
FILE_RETRY_CONFIG = {
    "stop": stop_after_attempt(3),  # Max 3 attempts
    "wait": wait_exponential(multiplier=1, min=1, max=10),  # 1s, 2s, 4s, 8s (capped at 10s)
    "retry": retry_if_exception_type((
        IOError,
        OSError,
        PermissionError,
        BlockingIOError,
        FileLockError,
    )),
    "reraise": True,  # Re-raise exception after exhausting retries
}
```

**Retry Schedule:**
- Attempt 1: Immediate
- Attempt 2: Wait 1s
- Attempt 3: Wait 2s
- Attempt 4 (if added): Wait 4s
- Jitter: Random 50-100% of delay to prevent thundering herd

## File Locking

The `with_file_lock()` context manager provides cross-platform exclusive file access:

```python
from pathlib import Path
from utils.file_utils import with_file_lock

# Read with shared lock
with with_file_lock(Path("data.json"), "r") as f:
    data = json.load(f)

# Write with exclusive lock
with with_file_lock(Path("data.json"), "w") as f:
    json.dump(data, f)
```

**Lock Behavior:**
- **Windows**: Uses `msvcrt.locking()` to lock the first byte
- **Unix**: Uses `fcntl.flock()` for exclusive lock
- **Timeout**: Default 10s, raises `FileLockError` if exceeded
- **Non-blocking**: Uses `LOCK_NB` flag and retries with exponential backoff

**Lock Types:**
- `"r"` mode: Can be shared (multiple readers allowed on Unix)
- `"w"` mode: Exclusive (only one writer at a time)

## Integration with ImplementationPlan

The `ImplementationPlan` class automatically uses safe file I/O:

```python
from pathlib import Path
from implementation_plan import ImplementationPlan

# Load plan (uses safe_read_json)
plan = ImplementationPlan.load(Path("specs/001/implementation_plan.json"))

# Modify plan
plan.status = "in_progress"

# Save plan (uses safe_write_json)
plan.save(Path("specs/001/implementation_plan.json"))
```

**Internal Implementation (in `implementation_plan/plan.py`):**
```python
def save(self, path: Path):
    """
    Save plan to JSON file with retry logic and file locking.

    FIX #491: Uses safe_write_json with retry logic for transient errors
    FIX #488: Uses file locking to prevent concurrent write race conditions
    """
    self.updated_at = datetime.now().isoformat()
    if not self.created_at:
        self.created_at = self.updated_at

    self.update_status_from_subtasks()
    logger.debug(f"Saving implementation plan to {path}")
    safe_write_json(path, self.to_dict(), indent=2, ensure_ascii=False)

@classmethod
def load(cls, path: Path) -> "ImplementationPlan":
    """
    Load plan from JSON file with retry logic and file locking.

    FIX #491: Uses safe_read_json with retry logic for transient errors
    FIX #488: Uses file locking to prevent concurrent read race conditions
    """
    logger.debug(f"Loading implementation plan from {path}")
    data = safe_read_json(path)
    if data is None:
        raise FileNotFoundError(f"Implementation plan not found: {path}")
    return cls.from_dict(data)
```

## Error Handling

### Retryable Errors

These errors will trigger automatic retry with exponential backoff:

- `IOError` - I/O operation failed
- `OSError` - Operating system error
- `PermissionError` - Insufficient permissions
- `BlockingIOError` - Resource temporarily unavailable
- `FileLockError` - Unable to acquire file lock

### Non-Retryable Errors

These errors will be raised immediately without retry:

- `json.JSONDecodeError` - Invalid JSON syntax (data error, not transient)
- `TypeError` - Data is not JSON-serializable (logic error)
- `FileNotFoundError` - File doesn't exist and no default provided

**Example:**
```python
from pathlib import Path
from utils.file_utils import safe_read_json
import json

try:
    data = safe_read_json(Path("config.json"))
except json.JSONDecodeError as e:
    # Invalid JSON - won't be retried
    logger.error(f"Config file is corrupted: {e}")
except FileOperationError as e:
    # Failed after 3 retries
    logger.error(f"Unable to read config after retries: {e}")
```

## Custom Retry Decorator

For custom file operations, use the `@retry_file_operation` decorator:

```python
from utils.file_utils import retry_file_operation
from pathlib import Path
import json

@retry_file_operation
def read_custom_file(path: Path) -> dict:
    """Custom file reader with automatic retry."""
    with open(path, 'r') as f:
        return json.load(f)

# Automatically retries on transient errors
data = read_custom_file(Path("data.json"))
```

## Best Practices

### 1. Always Use Safe I/O for Critical Files

```python
# ❌ BAD: No locking, no retry, no atomic write
with open("implementation_plan.json", "w") as f:
    json.dump(plan, f)

# ✅ GOOD: Locking, retry, atomic write
from utils.file_utils import safe_write_json
safe_write_json(Path("implementation_plan.json"), plan)
```

### 2. Provide Default Values for Optional Files

```python
# ❌ BAD: Will raise FileNotFoundError
config = safe_read_json(Path("optional_config.json"))

# ✅ GOOD: Graceful fallback
config = safe_read_json(Path("optional_config.json"), default={})
```

### 3. Use Path Objects, Not Strings

```python
from pathlib import Path

# ❌ BAD: String paths
safe_write_json("data.json", data)

# ✅ GOOD: Path objects
safe_write_json(Path("data.json"), data)
```

### 4. Handle Specific Exceptions

```python
from utils.file_utils import safe_read_json, FileLockError
from pathlib import Path

try:
    plan = safe_read_json(Path("implementation_plan.json"))
except FileLockError:
    # File is locked by another process
    logger.warning("Plan file is locked, will retry later")
except FileOperationError as e:
    # Failed after retries
    logger.error(f"Unable to read plan: {e}")
```

### 5. Log Retry Attempts (Automatic)

The retry decorator automatically logs warnings on transient errors:

```
WARNING: File read error (will retry): config.json - [Errno 13] Permission denied
```

## Common Use Cases

### 1. Updating JSON Files

```python
from pathlib import Path
from utils.file_utils import safe_read_json, safe_write_json

# Read, modify, write pattern
config = safe_read_json(Path("config.json"), default={})
config["last_run"] = datetime.now().isoformat()
safe_write_json(Path("config.json"), config)
```

### 2. Concurrent Access to Shared Files

```python
# Multiple processes can safely access implementation_plan.json
# File locking prevents corruption from concurrent writes

# Process 1: Coder agent updates subtask status
plan = ImplementationPlan.load(plan_file)
plan.phases[0].subtasks[0].status = SubtaskStatus.COMPLETED
plan.save(plan_file)  # Uses safe_write_json with locking

# Process 2: UI reads plan for display (simultaneous)
plan = ImplementationPlan.load(plan_file)  # Uses safe_read_json with locking
display_progress(plan)

# No corruption thanks to file locking!
```

### 3. Atomic Updates to Prevent Corruption

```python
# safe_write_json uses temp file + rename pattern
# Ensures readers never see partial writes

# Write process
safe_write_json(Path("large_data.json"), large_dict)
# 1. Writes to large_data.json.tmp.12345
# 2. Renames to large_data.json (atomic operation)

# Reader process
data = safe_read_json(Path("large_data.json"))
# Always sees complete file or old file, never partial write
```

### 4. Handling Lock Timeouts

```python
from utils.file_utils import safe_write_json, FileLockError
from pathlib import Path

try:
    safe_write_json(Path("busy_file.json"), data)
except FileLockError:
    # Another process held the lock for > 10 seconds
    logger.warning("File is locked by long-running process")
    # Could retry later, skip, or alert user
```

## Performance Considerations

### Atomic Writes

Atomic writes use a temp file pattern which:
- ✅ Prevents corruption (readers never see partial writes)
- ✅ Provides rollback capability (original file unchanged until rename)
- ⚠️ Requires 2x disk space temporarily
- ⚠️ Slightly slower than direct write (negligible for small files)

### File Locking Overhead

File locking adds minimal overhead:
- Shared locks (reads): Very low overhead, multiple readers allowed on Unix
- Exclusive locks (writes): Blocks other writers, but necessary for consistency
- Lock timeout: Default 10s prevents deadlocks

**Typical timings** (on modern SSD):
- Lock acquisition: < 1ms (uncontended)
- Lock acquisition: 100ms - 10s (contended, with backoff)
- Small JSON write (< 100KB): < 10ms

### Retry Performance

Retry logic adds delays only on failures:
- **Success case**: No delay (immediate return)
- **First retry**: 1s delay
- **Second retry**: 2s delay
- **Third retry**: 4s delay

**Total worst case**: ~7s for 3 failed attempts

## Migration Guide

### Before (Unsafe I/O)

```python
import json
from pathlib import Path

# Unsafe: No locking, no retry
def save_plan(plan, path):
    with open(path, "w") as f:
        json.dump(plan.to_dict(), f, indent=2)

def load_plan(path):
    with open(path, "r") as f:
        return json.load(f)
```

### After (Safe I/O)

```python
from pathlib import Path
from utils.file_utils import safe_read_json, safe_write_json

# Safe: Locking, retry, atomic write
def save_plan(plan, path):
    safe_write_json(path, plan.to_dict())

def load_plan(path):
    return safe_read_json(path)
```

## Troubleshooting

### Issue: FileLockError After 10 Seconds

**Problem:** File is locked by a long-running process

**Solution:** Increase timeout if legitimate, or investigate stuck process

```python
# Custom timeout for slow operations
from utils.file_utils import with_file_lock

with with_file_lock(Path("data.json"), "r", timeout=30.0) as f:
    data = json.load(f)
```

### Issue: PermissionError on Windows

**Problem:** File is open in another program (Excel, text editor)

**Solution:** Close the file in other programs, or handle the error gracefully

```python
from utils.file_utils import safe_write_json, FileOperationError

try:
    safe_write_json(Path("data.json"), data)
except FileOperationError as e:
    if "Permission denied" in str(e):
        logger.error("File is open in another program")
```

### Issue: Slow Performance Due to Lock Contention

**Problem:** Many processes competing for the same file

**Solution:**
1. Reduce write frequency (batch updates)
2. Use separate files per process
3. Increase retry delays to reduce thundering herd

```python
# Batch updates to reduce lock contention
updates = []
for item in items:
    updates.append(process(item))

# Single write instead of multiple
safe_write_json(Path("batch_results.json"), {"updates": updates})
```

### Issue: temp.*.json Files Left Behind

**Problem:** Process crashed during atomic write

**Solution:** Temp files are automatically cleaned up. Manual cleanup:

```bash
# Find orphaned temp files
find . -name "*.tmp.*" -mtime +1

# Remove old temp files (> 1 day old)
find . -name "*.tmp.*" -mtime +1 -delete
```

## Testing

### Unit Test Example

```python
import pytest
from pathlib import Path
from utils.file_utils import safe_read_json, safe_write_json

def test_safe_json_roundtrip(tmp_path):
    """Test safe read/write preserves data."""
    test_file = tmp_path / "test.json"
    test_data = {"key": "value", "number": 42}

    # Write
    safe_write_json(test_file, test_data)

    # Read
    result = safe_read_json(test_file)

    assert result == test_data

def test_safe_read_default(tmp_path):
    """Test safe read returns default for missing file."""
    missing_file = tmp_path / "missing.json"

    result = safe_read_json(missing_file, default={"default": True})

    assert result == {"default": True}
```

## See Also

- `file_utils.py` - Implementation
- `implementation_plan/plan.py` - Example usage in ImplementationPlan class
- [GitHub Issue #491](https://github.com/AndyMik90/Auto-Claude/issues/491) - Retry logic tracking
- [GitHub Issue #488](https://github.com/AndyMik90/Auto-Claude/issues/488) - File locking tracking
