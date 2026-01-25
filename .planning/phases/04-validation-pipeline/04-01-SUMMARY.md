---
phase: 04-validation-pipeline
plan: 01
subsystem: api
tags: [pr-review, validation, finding-validator, line-verification]

# Dependency graph
requires:
  - phase: 02-schema-enforcement
    provides: FindingValidationResult and FindingValidationResponse models
  - phase: 03-prompt-improvements
    provides: Enhanced specialist prompts with evidence requirements
provides:
  - Two-stage validation pipeline (line check + AI validation)
  - _verify_line_numbers() method for hallucinated line detection
  - _validate_findings() method for AI-based validation
  - Validation integrated into initial PR review flow
affects: [05-filter-removal, 06-measurement]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Two-stage validation (cheap programmatic pre-filter + expensive AI validation)
    - Fail-safe validation (return original findings on error)

key-files:
  created: []
  modified:
    - apps/backend/runners/github/services/parallel_orchestrator_reviewer.py

key-decisions:
  - "Use project_root for validation (works for both worktree and fallback)"
  - "Fail-safe on validation errors (keep original findings rather than blocking)"
  - "Log each rejection with finding ID for debugging"

patterns-established:
  - "Validation order: line verification (free) -> AI validation (expensive)"
  - "Conservative approach: allow findings on read errors, keep unvalidated findings"

# Metrics
duration: 3min
completed: 2026-01-25
---

# Phase 4 Plan 1: Validation Pipeline Integration Summary

**Two-stage finding validation with line number pre-filter and AI finding-validator invocation for all initial PR reviews**

## Performance

- **Duration:** 3 min
- **Started:** 2026-01-25T21:58:29Z
- **Completed:** 2026-01-25T22:01:25Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Added `_verify_line_numbers()` method to catch hallucinated line numbers without AI cost
- Added `_validate_findings()` method to invoke finding-validator agent for evidence-based validation
- Integrated two-stage validation into review() flow after cross-validation
- Dismissed findings excluded from results, needs_human_review findings flagged with prefix

## Task Commits

Each task was committed atomically:

1. **Task 1: Add _verify_line_numbers() method** - `52ed7eb37` (feat)
2. **Task 2: Add _validate_findings() method** - `586972f28` (feat)
3. **Task 3: Wire validation into review() method** - `28c01cd64` (feat)

## Files Created/Modified
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py` - Added two validation methods and integrated them into review() flow

## Decisions Made
- **Use project_root for validation:** Works correctly for both worktree-based reviews and fallback scenarios
- **Fail-safe validation:** Return original findings on any error (client creation, stream, parse) rather than blocking the review
- **Conservative line verification:** Allow findings on file read errors to avoid blocking reviews due to encoding issues

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Validation pipeline complete, ready for Phase 4 Plan 2 (hypothesis-validation prompt structure)
- VAL-01 (finding-validator for all reviews) and VAL-02 (line verification) requirements satisfied
- VAL-03 (hypothesis-validation prompt) to be addressed in next plan

---
*Phase: 04-validation-pipeline*
*Completed: 2026-01-25*
