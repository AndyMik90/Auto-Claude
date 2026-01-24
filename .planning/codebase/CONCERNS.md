# Codebase Concerns

**Analysis Date:** 2026-01-19

## Tech Debt

**Large File Complexity:**
- Issue: Several core files exceed 1000+ lines, indicating potential need for further modularization
- Files:
  - `apps/backend/core/workspace.py` (2096 lines) - Already refactored but remains large
  - `apps/backend/runners/github/orchestrator.py` (1607 lines)
  - `apps/backend/core/worktree.py` (1404 lines)
  - `apps/backend/runners/github/context_gatherer.py` (1292 lines)
  - `apps/frontend/src/main/ipc-handlers/task/worktree-handlers.ts` (3149 lines)
  - `apps/frontend/src/main/ipc-handlers/github/pr-handlers.ts` (2874 lines)
- Impact: Difficult to navigate, test, and maintain; increases risk of merge conflicts
- Fix approach: Continue modular extraction pattern (workspace.py partially done); extract sub-modules for GitHub orchestrator

**Deprecated Modules Still in Codebase:**
- Issue: Deprecated code remains active and produces warnings
- Files:
  - `apps/backend/runners/github/confidence.py` - Marked deprecated, uses DeprecationWarning
  - `apps/frontend/src/main/terminal/terminal-manager.ts` - Contains deprecated sync methods
  - `apps/frontend/src/main/terminal/session-handler.ts` - persistAllSessions deprecated
- Impact: Technical confusion, potential runtime warnings, maintenance burden
- Fix approach: Remove deprecated modules or complete migration to evidence-based validation

**Global State / Module-Level Caches:**
- Issue: Multiple modules use global variables and module-level caches that are not thread-safe
- Files:
  - `apps/backend/security/profile.py` (5 global variables for caching)
  - `apps/backend/core/client.py` (_PROJECT_INDEX_CACHE, _CLAUDE_CLI_CACHE)
  - `apps/backend/core/io_utils.py` (_pipe_broken global)
  - `apps/backend/core/sentry.py` (_sentry_initialized, _sentry_enabled)
  - `apps/backend/task_logger/utils.py` (_current_logger global)
- Impact: Potential race conditions in multi-threaded scenarios; difficult to test in isolation
- Fix approach: Convert to class-based singletons with proper locking; use thread-local storage where appropriate

**Incomplete TODO Implementation:**
- Issue: Critical features have TODO placeholders
- Files:
  - `apps/backend/core/workspace.py:1578` - `_record_merge_completion` not implemented
  - `apps/backend/merge/conflict_analysis.py:272-283` - Advanced implicit conflict detection not implemented
  - `apps/frontend/src/renderer/stores/settings-store.ts:214` - i18n keys not implemented
  - `apps/frontend/src/renderer/components/ideation/EnvConfigModal.tsx:1` - Props interface not defined
- Impact: Missing functionality, potential runtime issues
- Fix approach: Implement or remove features; document if intentionally deferred

**Empty Exception Handlers:**
- Issue: Many `pass` statements in exception handlers swallow errors silently
- Files: 237+ instances of `pass` after exception handling across backend
- Locations include:
  - `apps/backend/core/worktree.py:448`
  - `apps/backend/services/orchestrator.py:384, 396, 411, 423`
  - `apps/backend/cli/workspace_commands.py:339-359` (multiple)
  - `apps/backend/runners/github/memory_integration.py` (multiple)
- Impact: Silent failures make debugging difficult; errors may propagate unexpectedly
- Fix approach: Add logging to catch blocks; re-raise critical exceptions; document intentional suppressions

## Known Bugs

**Status Flip-Flop Bug (Task Store):**
- Symptoms: Task status may incorrectly change between terminal states
- Files: `apps/frontend/src/renderer/stores/task-store.ts:278, 282, 324, 346`
- Trigger: Phase transitions in updateTaskFromPlan
- Workaround: Multiple FIX comments added inline; logic guards terminal phases

**BulkPRDialog Error Detection:**
- Symptoms: String-based error detection is fragile
- Files: `apps/frontend/src/renderer/components/BulkPRDialog.tsx:32`
- Trigger: API error messages changing format
- Workaround: None - TODO comment acknowledges the issue

## Security Considerations

**Shell=True Usage:**
- Risk: Command injection if inputs not properly sanitized
- Files:
  - `apps/backend/core/git_executable.py:134` - Windows 'where' command
  - `apps/backend/core/gh_executable.py:61` - Windows 'where' command
- Current mitigation: Limited to Windows platform detection, not user-controlled input
- Recommendations: Document why shell=True is required; ensure no user input reaches these calls

**Subprocess Execution Spread Across Codebase:**
- Risk: Inconsistent security validation; command injection if not properly controlled
- Files: 50+ files with subprocess.run/Popen calls
- Current mitigation: Security hooks in `apps/backend/security/hooks.py`; allowlist in project_analyzer
- Recommendations: Consolidate subprocess calls through centralized wrappers; audit all subprocess calls

**Environment Variable Handling:**
- Risk: Sensitive data exposure through env vars
- Files: 100+ os.environ references across backend
- Current mitigation: Token validation in `apps/backend/core/auth.py`; encrypted token detection
- Recommendations: Audit all env var usage; ensure secrets are not logged; use secure storage APIs

**Token Decryption Not Implemented:**
- Risk: Encrypted tokens fail silently, requiring manual workarounds
- Files: `apps/backend/core/auth.py:103-228`
- Current mitigation: Clear error messages directing users to alternatives
- Recommendations: Implement cross-platform token decryption or improve error UX

## Performance Bottlenecks

**Blocking Sleep Calls:**
- Problem: time.sleep() calls block threads
- Files:
  - `apps/backend/core/workspace/models.py:129, 218`
  - `apps/backend/core/worktree.py:95, 106`
  - `apps/backend/services/orchestrator.py:451`
  - `apps/backend/runners/github/file_lock.py:172`
  - `apps/backend/runners/gitlab/glab_client.py:168`
- Cause: Synchronous retry logic with exponential backoff
- Improvement path: Convert to async operations where possible; use asyncio.sleep for async code

**Project Index Cache TTL:**
- Problem: 5-minute TTL may cause stale data or unnecessary reloads
- Files: `apps/backend/core/client.py:43` (_CACHE_TTL_SECONDS = 300)
- Cause: Fixed TTL doesn't adapt to project activity
- Improvement path: Implement file-watcher invalidation; make TTL configurable

**Security Profile Cache:**
- Problem: Module-level cache with no size limits
- Files: `apps/backend/security/profile.py:23-27`
- Cause: Global state without eviction policy
- Improvement path: Add LRU eviction; consider bounded cache

## Fragile Areas

**Merge System:**
- Files:
  - `apps/backend/core/workspace.py` (complex merge orchestration)
  - `apps/backend/merge/` directory (conflict detection, resolution)
- Why fragile: Complex state machine for parallel merges; many edge cases in git operations
- Safe modification: Always test with multiple concurrent specs; use DEBUG=true for verbose logging
- Test coverage: Tests exist but may not cover all race conditions

**GitHub Integration:**
- Files:
  - `apps/backend/runners/github/orchestrator.py`
  - `apps/backend/runners/github/rate_limiter.py`
  - `apps/backend/runners/github/gh_client.py`
- Why fragile: External API dependencies; rate limiting complexity; async/await patterns
- Safe modification: Mock external calls in tests; test rate limit scenarios explicitly
- Test coverage: Good coverage in `tests/test_github_*.py`

**Terminal Integration (Frontend):**
- Files:
  - `apps/frontend/src/renderer/stores/terminal-store.ts`
  - `apps/frontend/src/main/terminal/claude-integration-handler.ts`
- Why fragile: Complex state management; IPC communication; PTY lifecycle
- Safe modification: Test terminal creation/destruction cycles; watch for memory leaks
- Test coverage: Tests exist in `__tests__/` directories

**Auth/Token Handling:**
- Files: `apps/backend/core/auth.py` (898 lines)
- Why fragile: Platform-specific code paths; external dependency on Claude CLI; keyring integration
- Safe modification: Test on all platforms; verify OAuth flow end-to-end
- Test coverage: `tests/test_auth.py` exists

## Scaling Limits

**Concurrent Agent Sessions:**
- Current capacity: Limited by Claude SDK rate limits and system resources
- Limit: No explicit session pooling or queuing
- Scaling path: Implement session pool; add retry queues for rate limits

**Graphiti Memory Database:**
- Current capacity: LadybugDB (embedded Kuzu) - single-process access
- Limit: No concurrent write support across multiple processes
- Scaling path: Consider distributed graph database for multi-user scenarios

## Dependencies at Risk

**Deprecated Python Packages:**
- Risk: `secretstorage` on Linux has complex DBus dependencies
- Impact: Installation failures on minimal Linux systems
- Migration plan: Document fallback to .env storage; improve error messages

**Platform-Specific Code:**
- Risk: Windows/macOS/Linux code paths diverge
- Impact: Platform-specific bugs (documented in CLAUDE.md)
- Migration plan: Centralized platform abstraction in `apps/backend/core/platform/`

## Missing Critical Features

**Implicit Conflict Detection:**
- Problem: Function rename + usage conflicts not detected
- Blocks: Accurate parallel merge conflict resolution
- Files: `apps/backend/merge/conflict_analysis.py:272-283`

**_record_merge_completion:**
- Problem: Merge completion not recorded for timeline tracking
- Blocks: Full merge history audit trail
- Files: `apps/backend/core/workspace.py:1578`

## Test Coverage Gaps

**Async Code Testing:**
- What's not tested: Many async functions have limited coverage
- Files: 70+ files with async functions, 92+ with await statements
- Risk: Race conditions in async code may go unnoticed
- Priority: High - async bugs are hard to reproduce

**Platform-Specific Paths:**
- What's not tested: Windows-specific code paths on Linux CI
- Files: Platform detection in `apps/backend/core/platform/__init__.py`
- Risk: Windows-only bugs not caught until user reports
- Priority: Medium - CI now runs on all platforms per CLAUDE.md

**Global State Reset:**
- What's not tested: Cache invalidation edge cases
- Files: All files with module-level caches
- Risk: State leakage between tests
- Priority: Medium - add cache reset fixtures

**Exception Handler Behavior:**
- What's not tested: Error paths through empty except blocks
- Files: 237+ `pass` statements in exception handlers
- Risk: Silent failures in production
- Priority: High - add tests that trigger exception paths

---

*Concerns audit: 2026-01-19*
