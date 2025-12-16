# File Timeline Architecture

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                      file_timeline.py                            │
│                   (Public API Entry Point)                       │
│                         83 lines                                 │
│                                                                   │
│  Re-exports all public classes and functions                     │
│  Maintains backward compatibility                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              │ imports and re-exports
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     timeline_tracker.py                          │
│                  (Main Coordination Service)                     │
│                         560 lines                                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  FileTimelineTracker                                       │ │
│  │  • Event handlers (task start, commit, merge, abandon)     │ │
│  │  • Query methods (get context, files, drift, timeline)     │ │
│  │  • Worktree capture and initialization                     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
         │                    │                    │
         │                    │                    │
         ▼                    ▼                    ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ timeline_git.py  │ │timeline_models.py│ │timeline_persist- │
│                  │ │                  │ │ence.py           │
│   256 lines      │ │    321 lines     │ │   136 lines      │
│                  │ │                  │ │                  │
│ ┌──────────────┐ │ │ Data Classes:    │ │ ┌──────────────┐ │
│ │TimelineGit-  │ │ │ • MainBranchEvent│ │ │Timeline-     │ │
│ │Helper        │ │ │ • BranchPoint    │ │ │Persistence   │ │
│ │              │ │ │ • WorktreeState  │ │ │              │ │
│ │Git Ops:      │ │ │ • TaskIntent     │ │ │Storage:      │ │
│ │• File content│ │ │ • TaskFileView   │ │ │• Load all    │ │
│ │• Commit info │ │ │ • FileTimeline   │ │ │• Save one    │ │
│ │• Changed files│ │ │ • MergeContext   │ │ │• Update index│ │
│ │• Worktree ops│ │ │                  │ │ │• File paths  │ │
│ └──────────────┘ │ │ Methods:         │ │ └──────────────┘ │
│                  │ │ • to_dict()      │ │                  │
│                  │ │ • from_dict()    │ │                  │
│                  │ │ • Business logic │ │                  │
└──────────────────┘ └──────────────────┘ └──────────────────┘
```

## Data Flow

### 1. Task Start Event
```
External Event (task starts)
      ↓
FileTimelineTracker.on_task_start()
      ↓
TimelineGitHelper.get_file_content_at_commit()  ← Get branch point content
      ↓
Create TaskFileView (timeline_models)
      ↓
FileTimeline.add_task_view()
      ↓
TimelinePersistence.save_timeline()  ← Persist to disk
```

### 2. Main Branch Commit Event
```
Git Hook (post-commit)
      ↓
FileTimelineTracker.on_main_branch_commit()
      ↓
TimelineGitHelper.get_files_changed_in_commit()
      ↓
TimelineGitHelper.get_file_content_at_commit()
      ↓
TimelineGitHelper.get_commit_info()
      ↓
Create MainBranchEvent (timeline_models)
      ↓
FileTimeline.add_main_event()  ← Updates drift counters
      ↓
TimelinePersistence.save_timeline()
```

### 3. Get Merge Context
```
AI Resolver needs context
      ↓
FileTimelineTracker.get_merge_context(task_id, file_path)
      ↓
FileTimeline.get_task_view()
      ↓
FileTimeline.get_events_since_commit()  ← Main evolution
      ↓
FileTimeline.get_current_main_state()
      ↓
TimelineGitHelper.get_worktree_file_content()
      ↓
FileTimeline.get_active_tasks()  ← Other pending tasks
      ↓
Build MergeContext (timeline_models)
      ↓
Return to AI Resolver
```

## Separation of Concerns

### timeline_models.py
**Concern**: Data representation and serialization
- Pure data classes with minimal logic
- Serialization/deserialization methods
- Basic query methods (no external dependencies)

### timeline_git.py
**Concern**: Git interaction
- All git command execution
- File content retrieval
- Commit metadata queries
- No business logic about timelines

### timeline_persistence.py
**Concern**: Storage and retrieval
- JSON file operations
- Index management
- File path encoding
- No knowledge of timeline business logic

### timeline_tracker.py
**Concern**: Business logic and coordination
- Event handling workflow
- Coordinate between git, models, and persistence
- Build complex merge contexts
- Manage timeline lifecycle

### file_timeline.py
**Concern**: Public API and backward compatibility
- Re-export public interfaces
- Documentation and usage examples
- Entry point for external code

## Benefits

### Testability
Each component can be tested in isolation:
- **Models**: Test serialization, queries without git/filesystem
- **Git**: Mock git commands, test parsing logic
- **Persistence**: Mock filesystem, test save/load logic
- **Tracker**: Mock all dependencies, test business logic

### Reusability
Components can be used independently:
- `TimelineGitHelper` for any git operations
- `TimelinePersistence` pattern for other storage needs
- Models can be used without the full tracker

### Maintainability
Clear boundaries make changes easier:
- Add git operation → Change only `timeline_git.py`
- Add data field → Change only `timeline_models.py`
- Change storage format → Change only `timeline_persistence.py`
- Add event handler → Change only `timeline_tracker.py`

### Type Safety
All components have proper type hints:
- Clear interfaces between components
- IDE autocomplete support
- Static type checking with mypy

## Future Extensions

The modular structure enables easy extensions:

1. **Add SQLite backend**
   - Create `timeline_db_persistence.py`
   - Implement same interface as `TimelinePersistence`
   - Switch via configuration

2. **Add caching layer**
   - Add `timeline_cache.py`
   - Cache git operations in `TimelineGitHelper`
   - LRU cache for frequently accessed timelines

3. **Add timeline analytics**
   - Create `timeline_analytics.py`
   - Analyze drift patterns
   - Identify frequently conflicting files

4. **Add visualization**
   - Create `timeline_visualizer.py`
   - Use the data models directly
   - Generate timeline graphs

5. **Add async support**
   - Create `timeline_tracker_async.py`
   - Async git operations
   - Concurrent timeline updates
