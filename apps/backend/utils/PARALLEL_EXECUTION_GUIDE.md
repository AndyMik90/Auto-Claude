# Parallel Agent Execution Guide

This guide explains how to use the parallel execution feature (Issue #487) that enables concurrent agent sessions for parallel-safe phases in implementation plans.

## Overview

Auto Claude can now execute multiple coding agent sessions in parallel for independent subtasks within a phase, significantly reducing total build time. This is controlled by marking phases as `parallel_safe` in the implementation plan.

**Key Features:**
- **Concurrent execution** using asyncio.gather() for truly parallel agent sessions
- **Semaphore limiting** prevents overwhelming the system (MAX_PARALLEL_AGENTS=5)
- **Dependency-aware** - only executes phases after dependencies are satisfied
- **Status tracking** - individual success/failure for each subtask
- **Backward compatible** - falls back to sequential execution for non-parallel-safe phases

**Performance Improvement:**
- For parallel-safe phases with N subtasks, execution time approaches: `max(subtask_durations)` instead of `sum(subtask_durations)`
- With 5 independent subtasks taking 10 minutes each: **10 minutes total instead of 50 minutes**

## How It Works

### 1. Phase Detection

The `get_parallel_subtasks()` function in `core/progress.py` identifies phases suitable for parallel execution:

```python
from core.progress import get_parallel_subtasks

# Returns (list of subtasks, phase dict) or None
result = get_parallel_subtasks(spec_dir)
if result:
    subtasks_list, phase = result
    # Execute subtasks in parallel
else:
    # Fall back to sequential execution
    next_subtask = get_next_subtask(spec_dir)
```

**Requirements for parallel execution:**
- Phase has `parallel_safe: true` in implementation_plan.json
- Phase dependencies are satisfied (all depends_on phases are completed)
- Phase has 2+ pending subtasks (single subtask falls back to sequential)

### 2. Concurrent Execution

The `run_parallel_subtasks()` function in `agents/coder.py` orchestrates parallel sessions:

```python
from agents.coder import run_parallel_subtasks

# Execute subtasks concurrently with semaphore limiting
results = await run_parallel_subtasks(
    subtasks=subtasks_list,
    phase=phase,
    spec_dir=spec_dir,
    project_dir=project_dir,
    session_num=session_num,
    max_parallel=5  # Semaphore limit
)

# Results: list of (subtask_id, success, error_msg) tuples
for subtask_id, success, error_msg in results:
    if success:
        print(f"✓ {subtask_id} completed")
    else:
        print(f"✗ {subtask_id} failed: {error_msg}")
```

**Concurrency Control:**
- Uses `asyncio.Semaphore(max_parallel)` to limit concurrent sessions
- Default: `MAX_PARALLEL_AGENTS=5` (configurable)
- Ensures system resources aren't overwhelmed
- Each agent session runs in isolated environment

### 3. Status Updates

After parallel execution completes, the implementation plan is updated:

```python
from implementation_plan import ImplementationPlan

# Load plan
plan = ImplementationPlan.load(plan_file)

# Update subtask statuses based on results
for subtask_id, success, error_msg in results:
    for phase in plan.phases:
        for subtask in phase.subtasks:
            if subtask.id == subtask_id:
                if success:
                    subtask.status = SubtaskStatus.COMPLETED
                else:
                    subtask.status = SubtaskStatus.FAILED

# Save with retry logic and file locking
plan.save(plan_file)
```

## Configuration

### Marking Phases as Parallel-Safe

Edit `implementation_plan.json` to enable parallel execution for a phase:

```json
{
  "phases": [
    {
      "phase": 1,
      "id": "phase-1",
      "name": "Component Implementation",
      "type": "implementation",
      "parallel_safe": true,  // ← Enable parallel execution
      "depends_on": [],
      "subtasks": [
        {"id": "task-1", "description": "Implement ComponentA", "status": "pending"},
        {"id": "task-2", "description": "Implement ComponentB", "status": "pending"},
        {"id": "task-3", "description": "Implement ComponentC", "status": "pending"}
      ]
    }
  ]
}
```

**When to mark a phase as parallel-safe:**

✅ **Safe for parallel execution:**
- Independent UI components (no shared state)
- Separate API endpoints (different routes/controllers)
- Independent utility functions/modules
- Separate database migrations (different tables)
- Independent test files

❌ **NOT safe for parallel execution:**
- Interdependent components (shared state/interfaces)
- Database schema changes (risk of conflicts)
- Shared configuration files (merge conflicts)
- Sequential workflow steps (authentication → authorization → access control)

### Adjusting Concurrency Limit

Change `MAX_PARALLEL_AGENTS` in `agents/coder.py`:

```python
# Default: 5 concurrent sessions
MAX_PARALLEL_AGENTS = 5

# For more powerful systems
MAX_PARALLEL_AGENTS = 10

# For resource-constrained systems
MAX_PARALLEL_AGENTS = 3
```

**Considerations:**
- Each agent session consumes memory and API tokens
- Higher concurrency = faster builds but more resource usage
- Monitor system resources when adjusting this value

## Usage Examples

### Example 1: Frontend Component Development

**Scenario:** Building 3 independent React components

**implementation_plan.json:**
```json
{
  "phases": [
    {
      "phase": 1,
      "name": "Component Implementation",
      "parallel_safe": true,
      "subtasks": [
        {"id": "header", "description": "Implement Header component"},
        {"id": "sidebar", "description": "Implement Sidebar component"},
        {"id": "footer", "description": "Implement Footer component"}
      ]
    }
  ]
}
```

**Execution:**
- All 3 components are built concurrently
- Each agent session creates its own component file
- Total time ≈ longest component implementation (instead of sum of all)

### Example 2: API Endpoint Development

**Scenario:** Creating 5 independent REST API endpoints

**implementation_plan.json:**
```json
{
  "phases": [
    {
      "phase": 2,
      "name": "API Endpoints",
      "parallel_safe": true,
      "depends_on": ["1"],
      "subtasks": [
        {"id": "users-get", "description": "GET /api/users endpoint"},
        {"id": "users-post", "description": "POST /api/users endpoint"},
        {"id": "tasks-get", "description": "GET /api/tasks endpoint"},
        {"id": "tasks-post", "description": "POST /api/tasks endpoint"},
        {"id": "tasks-delete", "description": "DELETE /api/tasks/:id endpoint"}
      ]
    }
  ]
}
```

**Execution:**
- Max 5 endpoints built concurrently (limited by semaphore)
- Each endpoint has its own route handler, validation, tests
- No conflicts since endpoints are independent

### Example 3: Mixed Parallel and Sequential Phases

**Scenario:** Database schema must complete before backend implementation

**implementation_plan.json:**
```json
{
  "phases": [
    {
      "phase": 1,
      "name": "Database Schema",
      "parallel_safe": false,  // Sequential - schema changes must be ordered
      "subtasks": [
        {"id": "db-1", "description": "Create users table"},
        {"id": "db-2", "description": "Create tasks table with FK to users"}
      ]
    },
    {
      "phase": 2,
      "name": "Backend Services",
      "parallel_safe": true,  // Parallel - services are independent
      "depends_on": ["1"],
      "subtasks": [
        {"id": "svc-1", "description": "Implement UserService"},
        {"id": "svc-2", "description": "Implement TaskService"},
        {"id": "svc-3", "description": "Implement AuthService"}
      ]
    }
  ]
}
```

**Execution:**
1. Phase 1 runs sequentially (database order matters)
2. After Phase 1 completes, Phase 2 runs in parallel
3. 3 services are built concurrently

## Performance Considerations

### Speedup Calculation

**Sequential execution:**
```
Total time = sum of all subtask durations
Example: 5 tasks × 10 min each = 50 minutes
```

**Parallel execution:**
```
Total time ≈ max(subtask durations) + scheduling overhead
Example: max(10, 10, 10, 10, 10) = ~10 minutes
Speedup: 5x faster
```

**Real-world factors:**
- API rate limits may throttle concurrent requests
- System resources (CPU, memory) affect max concurrency
- Subtask durations vary - speedup = `N / max(1, ceil(N / MAX_PARALLEL))`

### Resource Usage

**Memory:**
- Each concurrent agent session: ~200-500MB (depending on model)
- 5 concurrent sessions: ~1-2.5GB additional memory

**API Tokens:**
- Parallel execution doesn't increase total token usage
- Same number of subtasks, just executed faster
- Token rate limits may apply with high concurrency

**Disk I/O:**
- Concurrent file writes use atomic operations (temp file + rename)
- File locking prevents race conditions
- Minimal disk overhead

## Testing

### Running Parallel Execution Tests

```bash
# Run all parallel execution tests
cd apps/backend
python agents/test_parallel_execution.py

# Expected output:
# === Test 1: Parallel-Safe Phase Detection ===
# ✓ Detected parallel-safe phase with 3 pending subtasks
#
# === Test 3: Semaphore Limiting ===
# ✓ Semaphore limited concurrency to 5
#
# === Test 6: Parallel Execution Performance ===
# ✓ Speedup: 4.2x (parallel is faster)
```

### Test Coverage

The test suite (`agents/test_parallel_execution.py`) includes:

1. **test_parallel_phase_detection()** - Verifies detection logic
2. **test_dependency_handling()** - Verifies phase dependency blocking
3. **test_semaphore_limiting()** - Verifies concurrency limiting
4. **test_success_failure_tracking()** - Verifies result tracking
5. **test_plan_status_updates()** - Verifies status persistence
6. **test_parallel_performance()** - Benchmarks speedup
7. **test_edge_cases()** - Tests error handling
8. **test_full_workflow_simulation()** - Integration test

### Manual Testing

**Test parallel execution with a real spec:**

1. Create a test implementation plan:
```bash
cd apps/backend
python spec_runner.py --task "Build 3 independent components"
```

2. Edit the generated `implementation_plan.json`:
```json
{
  "phases": [
    {
      "parallel_safe": true,  // ← Add this
      "subtasks": [...]
    }
  ]
}
```

3. Run the build and observe parallel execution:
```bash
python run.py --spec 001
```

4. Watch for parallel execution messages:
```
INFO: Detected 3 parallel-safe subtasks in phase "Component Implementation"
INFO: Spawning 3 concurrent agent sessions (max: 5)
INFO: Running subtasks in parallel: task-1, task-2, task-3
INFO: All 3 parallel subtasks completed successfully
```

## Troubleshooting

### Issue: Parallel execution not triggered

**Symptom:** Subtasks execute sequentially even with `parallel_safe: true`

**Possible causes:**
1. Only 1 pending subtask (falls back to sequential)
2. Phase dependencies not satisfied
3. `parallel_safe` is false or missing

**Solution:**
```bash
# Check implementation_plan.json
cat .auto-claude/specs/001/implementation_plan.json | grep -A 5 "parallel_safe"

# Verify phase has multiple pending subtasks
# Verify depends_on phases are completed
```

### Issue: Semaphore limiting too aggressive

**Symptom:** Only 1-2 tasks run concurrently instead of 5

**Cause:** System resources or API rate limits

**Solution:**
```python
# Reduce MAX_PARALLEL_AGENTS in agents/coder.py
MAX_PARALLEL_AGENTS = 3  # Instead of 5
```

### Issue: Out of memory errors

**Symptom:** System runs out of memory during parallel execution

**Solution:**
1. Reduce `MAX_PARALLEL_AGENTS` (see above)
2. Close other applications to free memory
3. Use smaller model (claude-sonnet instead of opus)
4. Split large phases into smaller ones

### Issue: Subtasks fail with file locking errors

**Symptom:** `FileLockError` when multiple agents update implementation_plan.json

**Cause:** File locking timeout exceeded (very rare)

**Solution:**
- The system uses retry logic with file locking (Issue #488)
- Errors should auto-resolve after retry
- If persistent, check for stuck processes holding locks

### Issue: Race conditions with shared files

**Symptom:** Merge conflicts or corrupted files

**Cause:** Subtasks aren't actually independent (shared files)

**Solution:**
- Mark phase as `parallel_safe: false`
- Split shared file changes into separate phase
- Ensure subtasks truly don't overlap

## Integration with Existing Features

### File Locking (Issue #488)

Parallel execution uses safe file I/O for plan updates:

```python
from utils.file_utils import safe_write_json

# All plan updates use locking to prevent race conditions
safe_write_json(plan_file, plan.to_dict())
```

See [RETRY_GUIDE.md](./RETRY_GUIDE.md) for details.

### Retry Logic (Issue #491)

Individual subtask failures don't block other subtasks:

```python
# Each subtask has independent retry logic
try:
    result = await execute_subtask(subtask)
except Exception as e:
    # Subtask marked as failed, others continue
    results.append((subtask.id, False, str(e)))
```

### Progress Tracking

The UI and CLI show parallel execution progress:

```
Progress: [████████░░░░░░░░░░] 40% (2/5 subtasks)
  ✓ task-1: COMPLETED
  ✓ task-2: COMPLETED
  ⟳ task-3: IN_PROGRESS (parallel)
  ⟳ task-4: IN_PROGRESS (parallel)
  ⟳ task-5: IN_PROGRESS (parallel)
```

## Best Practices

### 1. Start Conservative

When first using parallel execution:
- Mark only clearly independent phases as parallel-safe
- Start with small number of subtasks (2-3)
- Monitor resource usage and adjust MAX_PARALLEL_AGENTS

### 2. Verify Independence

Before marking a phase as parallel-safe, ensure subtasks:
- Don't modify the same files
- Don't share state or configuration
- Don't have implicit dependencies
- Can execute in any order

### 3. Split Large Phases

Instead of one large parallel-safe phase:
```json
// ❌ RISKY: 20 subtasks in one phase
{"phase": 1, "parallel_safe": true, "subtasks": [...20 items...]}
```

Split into smaller phases:
```json
// ✅ SAFER: 2 phases with 10 subtasks each
{"phase": 1, "parallel_safe": true, "subtasks": [...10 items...]},
{"phase": 2, "parallel_safe": true, "depends_on": ["1"], "subtasks": [...10 items...]}
```

### 4. Monitor First Run

When testing parallel execution:
1. Watch resource usage (memory, CPU)
2. Check for errors in logs
3. Verify all subtasks complete successfully
4. Review generated code for conflicts

### 5. Document Dependencies

Add comments to implementation_plan.json:
```json
{
  "phase": 2,
  "parallel_safe": true,
  "depends_on": ["1"],  // Must wait for database schema
  "subtasks": [
    // All services are independent - safe to parallelize
    {"id": "svc-1", ...},
    {"id": "svc-2", ...}
  ]
}
```

## See Also

- **File Locking:** [RETRY_GUIDE.md](./RETRY_GUIDE.md) - Safe concurrent file access
- **Implementation Plan:** `implementation_plan/plan.py` - Plan data model
- **Progress Tracking:** `core/progress.py` - Progress utilities
- **Coder Agent:** `agents/coder.py` - Parallel execution implementation
- **Tests:** `agents/test_parallel_execution.py` - Test suite
- **GitHub Issue #487:** https://github.com/AndyMik90/Auto-Claude/issues/487
