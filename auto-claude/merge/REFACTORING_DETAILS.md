# Detailed Refactoring Breakdown

## What Moved Where

This document provides a detailed mapping of where each component from the original `file_timeline.py` (992 lines) was relocated.

### Original file_timeline.py Structure

```
Lines 1-59:    Module docstring, imports, debug utilities
Lines 61-115:  MainBranchEvent class
Lines 117-137: BranchPoint class
Lines 139-157: WorktreeState class
Lines 159-180: TaskIntent class
Lines 182-230: TaskFileView class
Lines 232-315: FileTimeline class
Lines 317-365: MergeContext class
Lines 367-992: FileTimelineTracker class + Git helpers
```

### New Module Breakdown

#### timeline_models.py (321 lines)
**Extracted from**: Lines 61-365 of original file

Contains:
- `MainBranchEvent` (lines 61-115) → Now lines 18-77
- `BranchPoint` (lines 117-137) → Now lines 80-103
- `WorktreeState` (lines 139-157) → Now lines 106-124
- `TaskIntent` (lines 159-180) → Now lines 127-149
- `TaskFileView` (lines 182-230) → Now lines 152-211
- `FileTimeline` (lines 232-315) → Now lines 214-306
- `MergeContext` (lines 317-365) → Now lines 309-321

**Changes made**:
- Added comprehensive module docstring
- All imports moved to top
- No functional changes to classes

#### timeline_git.py (256 lines)
**Extracted from**: Lines 785-875 + scattered helper methods

Contains methods that were in FileTimelineTracker:
- `_get_current_main_commit()` → Now `get_current_main_commit()`
- `_get_file_content_at_commit()` → Now `get_file_content_at_commit()`
- `_get_files_changed_in_commit()` → Now `get_files_changed_in_commit()`
- `_get_commit_info()` → Now `get_commit_info()`
- `_get_worktree_file_content()` → Now `get_worktree_file_content()`

**Plus new helper methods**:
- `get_changed_files_in_worktree()` - Extracted from `capture_worktree_state()`
- `get_branch_point()` - Extracted from `initialize_from_worktree()`
- `count_commits_between()` - Extracted from `initialize_from_worktree()`

**Changes made**:
- Wrapped in `TimelineGitHelper` class
- Removed `_` prefix (now public methods)
- Added comprehensive docstrings
- Better error handling

#### timeline_persistence.py (136 lines)
**Extracted from**: Lines 717-779 of original file

Contains methods that were in FileTimelineTracker:
- `_load_from_storage()` → Now `load_all_timelines()`
- `_persist_timeline()` → Now `save_timeline()`
- `_update_index()` → Now `update_index()`
- `_get_timeline_file_path()` → Now `_get_timeline_file_path()`

**Changes made**:
- Wrapped in `TimelinePersistence` class
- Removed `_` prefix from public methods
- Separated concerns (no timeline business logic)
- Added comprehensive docstrings

#### timeline_tracker.py (560 lines)
**Extracted from**: Lines 372-992 of original file

Contains the main `FileTimelineTracker` class with:

**Event Handlers** (lines 414-608 of original):
- `on_task_start()` - Simplified to use git helper
- `on_main_branch_commit()` - Simplified to use git helper
- `on_task_worktree_change()` - Unchanged
- `on_task_merged()` - Simplified to use git helper
- `on_task_abandoned()` - Unchanged

**Query Methods** (lines 610-711 of original):
- `get_merge_context()` - Simplified to use git helper
- `get_files_for_task()` - Unchanged
- `get_pending_tasks_for_file()` - Unchanged
- `get_task_drift()` - Unchanged
- `has_timeline()` - Unchanged
- `get_timeline()` - Unchanged

**Capture Methods** (lines 878-992 of original):
- `capture_worktree_state()` - Simplified to use git helper
- `initialize_from_worktree()` - Simplified to use git helper

**Changes made**:
- Now uses `TimelineGitHelper` for all git operations
- Now uses `TimelinePersistence` for all storage operations
- Removed all git subprocess calls (delegated to helper)
- Removed all file I/O (delegated to persistence)
- Focused on business logic and coordination

#### file_timeline.py (83 lines)
**New entry point** - Replaces original 992 line file

Contains:
- Comprehensive module docstring with usage examples
- Architecture description
- Re-exports of all public APIs
- `__all__` declaration

**Changes made**:
- Complete rewrite as entry point
- No business logic (pure re-exports)
- Enhanced documentation
- Backward compatibility maintained

## Dependency Changes

### Before Refactoring
```
file_timeline.py (992 lines)
├── subprocess (git operations)
├── json (persistence)
├── pathlib (file operations)
└── datetime, logging, dataclasses, typing
```

### After Refactoring
```
file_timeline.py (83 lines) - Entry point
└── Re-exports from:
    ├── timeline_models.py (321 lines)
    │   └── datetime, dataclasses, typing
    │
    ├── timeline_git.py (256 lines)
    │   └── subprocess, pathlib, logging
    │
    ├── timeline_persistence.py (136 lines)
    │   └── json, pathlib, datetime, logging
    │
    └── timeline_tracker.py (560 lines)
        ├── timeline_models
        ├── timeline_git
        └── timeline_persistence
```

## Line Count Comparison

| Original Section | Lines | New Module | Lines | Change |
|-----------------|-------|------------|-------|--------|
| Imports & Debug | 59 | Distributed | ~40 | Simplified |
| Data Models | 305 | timeline_models.py | 321 | +16 (docs) |
| FileTimelineTracker | 628 | timeline_tracker.py | 560 | -68 (delegation) |
| Git Helpers | - | timeline_git.py | 256 | +256 (extracted) |
| Persistence | - | timeline_persistence.py | 136 | +136 (extracted) |
| Entry Point | - | file_timeline.py | 83 | +83 (new) |
| **Total** | **992** | **All modules** | **1,356** | **+364** |

The total line count increased by 364 lines (37%) due to:
- More comprehensive documentation in each module
- Clear module boundaries and interfaces
- Explicit type hints throughout
- Better error handling
- Separation of concerns (less code reuse)

However, the main entry point decreased by 91%, and each individual module is now much more maintainable.

## Import Impact

### Files That Import from file_timeline.py

#### merge/__init__.py
```python
# Before (still works)
from .file_timeline import (
    FileTimelineTracker,
    FileTimeline,
    MainBranchEvent,
    # ...
)

# After (same imports, different source)
from .file_timeline import (  # Now re-exported from modular structure
    FileTimelineTracker,
    FileTimeline,
    MainBranchEvent,
    # ...
)
```
**Status**: ✅ No changes needed - backward compatible

#### merge/tracker_cli.py
```python
# Before and After (unchanged)
from .file_timeline import FileTimelineTracker
```
**Status**: ✅ No changes needed - backward compatible

#### merge/prompts.py
```python
# Before and After (unchanged)
if TYPE_CHECKING:
    from .file_timeline import MergeContext, MainBranchEvent
```
**Status**: ✅ No changes needed - backward compatible

### Advanced Usage (Optional)

Users can now import from specific modules if needed:

```python
# Import from specific modules (new capability)
from merge.timeline_models import FileTimeline, MergeContext
from merge.timeline_git import TimelineGitHelper
from merge.timeline_persistence import TimelinePersistence
from merge.timeline_tracker import FileTimelineTracker

# Or continue using the entry point (backward compatible)
from merge.file_timeline import FileTimelineTracker, MergeContext
```

## Testing Coverage

All original functionality is preserved:

### Event Handlers
- ✅ `on_task_start()` - Creates timeline for new task
- ✅ `on_main_branch_commit()` - Updates main branch history
- ✅ `on_task_worktree_change()` - Updates worktree state
- ✅ `on_task_merged()` - Marks task as merged
- ✅ `on_task_abandoned()` - Marks task as abandoned

### Query Methods
- ✅ `get_merge_context()` - Builds complete merge context
- ✅ `get_files_for_task()` - Returns files for a task
- ✅ `get_pending_tasks_for_file()` - Returns pending tasks
- ✅ `get_task_drift()` - Returns commits behind main
- ✅ `has_timeline()` - Checks if timeline exists
- ✅ `get_timeline()` - Gets timeline for file

### Capture Methods
- ✅ `capture_worktree_state()` - Captures worktree state
- ✅ `initialize_from_worktree()` - Initializes from existing worktree

### Data Models
- ✅ All 7 data models with serialization methods
- ✅ All business logic methods on models
- ✅ All type hints preserved

## Future Maintenance

With this refactoring, future changes become easier:

### To add a new git operation:
1. Add method to `TimelineGitHelper` in `timeline_git.py`
2. Use it in `FileTimelineTracker` in `timeline_tracker.py`
3. No changes to models or persistence

### To change storage format:
1. Modify `TimelinePersistence` in `timeline_persistence.py`
2. No changes to tracker, models, or git operations

### To add a new data field:
1. Add field to model in `timeline_models.py`
2. Update `to_dict()` and `from_dict()` methods
3. Use new field in `FileTimelineTracker` if needed

### To add a new event handler:
1. Add method to `FileTimelineTracker` in `timeline_tracker.py`
2. Use existing git helper and persistence methods
3. No changes to other modules

This separation of concerns makes the codebase much more maintainable going forward.
