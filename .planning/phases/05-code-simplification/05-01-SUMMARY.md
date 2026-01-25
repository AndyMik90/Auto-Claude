# Phase 5 Plan 1: Remove Redundant Filters from Orchestrator Summary

**One-liner:** Removed 141 lines of programmatic filters (ConfidenceTier, _validate_finding_evidence, _apply_confidence_routing, keyword-based scope detection) - validation now relies on schema enforcement + AI finding-validator

## What Was Built

Simplified the parallel_orchestrator_reviewer.py by removing redundant programmatic filters that duplicate functionality now handled by:
1. Schema enforcement (VerificationEvidence required fields)
2. AI-based finding-validator agent
3. Schema field `is_impact_finding` for scope checking

### Changes Made

1. **Removed from review() method:**
   - Evidence filter loop that called `_validate_finding_evidence()`
   - Confidence routing call to `_apply_confidence_routing()`
   - Replaced `routed_findings` with direct `validated_findings` assignment

2. **Removed function definitions:**
   - `ConfidenceTier` enum (23 lines)
   - `_validate_finding_evidence()` function (55 lines)
   - `_apply_confidence_routing()` method (52 lines)

3. **Simplified `_is_finding_in_scope()`:**
   - Replaced keyword detection (`impact_keywords = ["breaks", "affects", ...]`)
   - Now uses `getattr(finding, 'is_impact_finding', False)`

4. **Cleaned up imports:**
   - Removed `from enum import Enum`

## Files Modified

| File | Change |
|------|--------|
| `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py` | -144 lines, +6 lines |

## Decisions Made

| Decision | Rationale |
|----------|-----------|
| Use getattr with False default | Backwards compatibility with findings that don't have is_impact_finding field |
| Remove confidence routing entirely | Validation is now binary (valid/invalid) via finding-validator AI |
| Keep scope filter | Still useful as programmatic check, just simplified to use schema field |

## Deviations from Plan

None - plan executed exactly as written.

## Requirements Satisfied

- [x] REMOVE-01: Remove _validate_finding_evidence() function
- [x] REMOVE-02: Remove ConfidenceTier enum
- [x] REMOVE-03: Remove _apply_confidence_routing() method
- [x] REMOVE-06: Simplify _is_finding_in_scope() to use schema field

## Verification Results

| Check | Result |
|-------|--------|
| Python syntax | PASSED |
| No removed code references | PASSED (0 matches) |
| Scope uses schema field | PASSED (`getattr(finding, 'is_impact_finding', False)`) |

## Duration

- Start: 2026-01-25T22:12:39Z
- End: 2026-01-25T22:14:41Z
- Duration: ~2 min
