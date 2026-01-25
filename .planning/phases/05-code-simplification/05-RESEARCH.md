# Phase 5: Code Simplification - Research

**Researched:** 2026-01-25
**Domain:** Python code removal (filter functions now redundant due to schema enforcement)
**Confidence:** HIGH

## Summary

This phase removes programmatic filters that are now redundant because Phases 1-4 implemented evidence-based validation through schema enforcement and improved prompts. The code to remove is localized to two files:

1. **parallel_orchestrator_reviewer.py** - Three functions/code blocks to remove
2. **output_validator.py** - Two constants and one method to remove, plus the `_is_finding_in_scope` function needs simplification

The removal is straightforward with no complex dependencies. The main risk is ensuring the replacement mechanism (`is_impact_finding` schema field) is properly used instead of keyword detection.

**Primary recommendation:** Remove functions in dependency order (callers first, then definitions), update tests, and verify with `pytest`.

## Standard Stack

No new libraries needed - this is pure removal work.

### Files to Modify

| File | Location | Changes |
|------|----------|---------|
| `parallel_orchestrator_reviewer.py` | `apps/backend/runners/github/services/` | Remove 3 functions + 1 code block |
| `output_validator.py` | `apps/backend/runners/github/` | Remove 2 constants + 1 method |
| `test_output_validator.py` | `tests/` | Update tests for removed functionality |
| `validator_example.py` | `apps/backend/runners/github/` | May need updates (uses FindingValidator) |

## Code to Remove - Exact Locations

### File 1: parallel_orchestrator_reviewer.py

**Location:** `/Users/andremikalsen/Documents/Coding/autonomous-coding/apps/backend/runners/github/services/parallel_orchestrator_reviewer.py`

#### REMOVE-01: `_validate_finding_evidence()` function
- **Lines:** 112-166 (55 lines)
- **Function signature:** `def _validate_finding_evidence(finding: PRReviewFinding) -> tuple[bool, str]:`
- **Purpose:** Programmatic check if finding has actual code evidence (not descriptions)
- **Why redundant:** `VerificationEvidence` schema now requires `code_examined` field (Phase 2, SCHEMA-01)
- **Callers:** Lines 957-962 in `review()` method

```python
# Lines 112-166 - REMOVE THIS ENTIRE FUNCTION
def _validate_finding_evidence(finding: PRReviewFinding) -> tuple[bool, str]:
    """
    Check if finding has actual code evidence, not just descriptions.
    ...
    """
```

#### REMOVE-02: Evidence filter call block
- **Lines:** 955-963 (approximate, in review() method)
- **Code block:**
```python
for finding in validated_by_ai:
    # Check evidence quality
    evidence_valid, evidence_reason = _validate_finding_evidence(finding)
    if not evidence_valid:
        logger.info(
            f"[PRReview] Filtered finding {finding.id}: {evidence_reason}"
        )
        filtered_findings.append((finding, evidence_reason))
        continue
```
- **Why redundant:** Schema requires `verification.code_examined` to be non-empty (min_length=1)

#### REMOVE-03: `_apply_confidence_routing()` method
- **Lines:** 1353-1404 (52 lines)
- **Method signature:** `def _apply_confidence_routing(self, findings: list[PRReviewFinding]) -> list[PRReviewFinding]:`
- **Purpose:** Routes findings based on confidence scores (HIGH/MEDIUM/LOW tiers)
- **Why redundant:** Finding-validator now validates all findings; confidence is superseded by binary validation status
- **Callers:** Line 985 in `review()` method

Also remove supporting code:
- **ConfidenceTier enum:** Lines 87-109 (23 lines) - only used by `_apply_confidence_routing`

#### REMOVE-06 (partial): Simplify `_is_finding_in_scope()`
- **Lines:** 169-203
- **Current logic:** Uses keyword detection (`impact_keywords = ["breaks", "affects", "impact", "caller", "depends"]`)
- **New logic:** Use `is_impact_finding` schema field instead
- **Schema field location:** `pydantic_models.py` line 454-460

```python
# CURRENT (to remove keyword detection):
impact_keywords = ["breaks", "affects", "impact", "caller", "depends"]
description_lower = (finding.description or "").lower()
is_impact_finding = any(kw in description_lower for kw in impact_keywords)

# NEW (use schema field):
is_impact_finding = getattr(finding, 'is_impact_finding', False)
```

### File 2: output_validator.py

**Location:** `/Users/andremikalsen/Documents/Coding/autonomous-coding/apps/backend/runners/github/output_validator.py`

#### REMOVE-04: VAGUE_PATTERNS and GENERIC_PATTERNS constants
- **VAGUE_PATTERNS:** Lines 26-37 (12 lines)
- **GENERIC_PATTERNS:** Lines 40-47 (8 lines)
- **Purpose:** Pattern lists for false positive detection
- **Why redundant:** Prompts now guide AI to avoid vague language (Phase 3)

```python
# Lines 26-47 - REMOVE BOTH CONSTANTS
VAGUE_PATTERNS = [
    "could be improved",
    "consider using",
    ...
]

GENERIC_PATTERNS = [
    "improve this",
    "fix this",
    ...
]
```

#### REMOVE-05: `_is_false_positive()` method
- **Lines:** 297-340 (44 lines)
- **Method signature:** `def _is_false_positive(self, finding: PRReviewFinding) -> bool:`
- **Purpose:** Detects likely false positives based on patterns
- **Why redundant:** Finding-validator now validates all findings at runtime
- **Callers:** Line 127 in `_is_valid()` method

## Architecture Patterns

### Removal Order (Dependency-Safe)

The following order ensures no broken references during removal:

**Phase A: Remove Callers First**
1. Remove evidence filter call block (lines 955-963) - uses `_validate_finding_evidence`
2. Remove confidence routing call (line 985) - uses `_apply_confidence_routing`
3. Remove `_is_false_positive` call in `_is_valid()` (line 127)

**Phase B: Remove Function Definitions**
4. Remove `_validate_finding_evidence()` function (lines 112-166)
5. Remove `ConfidenceTier` enum (lines 87-109)
6. Remove `_apply_confidence_routing()` method (lines 1353-1404)
7. Remove `VAGUE_PATTERNS` constant (lines 26-37)
8. Remove `GENERIC_PATTERNS` constant (lines 40-47)
9. Remove `_is_false_positive()` method (lines 297-340)

**Phase C: Simplify Remaining Logic**
10. Simplify `_is_finding_in_scope()` to use schema field

### Code Flow After Removal

```
review() method flow:
  1. Run specialist agents (parallel)
  2. Deduplicate findings
  3. Cross-validate findings
  4. Verify line numbers (KEEP - cheap pre-filter)
  5. AI validation via finding-validator (KEEP)
  6. Scope filter via _is_finding_in_scope (SIMPLIFIED)
  7. Generate verdict and summary
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Evidence validation | Pattern matching | Schema enforcement | Pydantic validates at parse time |
| Confidence routing | Tier-based filtering | Binary validation status | finding-validator gives definitive answer |
| False positive detection | Keyword patterns | AI validation | AI understands context, patterns don't |

## Common Pitfalls

### Pitfall 1: Forgetting to Update Review Flow Variables

**What goes wrong:** After removing filter calls, variables like `validated_findings` and `filtered_findings` may have dangling references.
**Why it happens:** The review() method uses these variables downstream.
**How to avoid:** Trace variable usage after each removal.
**Warning signs:** `NameError` or logic using undefined variables.

### Pitfall 2: Missing Test Updates

**What goes wrong:** Tests for removed functions will fail.
**Why it happens:** `test_output_validator.py` has tests specifically for `_is_false_positive`.
**How to avoid:** Remove corresponding test classes/methods:
- `TestFalsePositiveDetection` class (lines 228-288)
**Warning signs:** Test failures with `AttributeError: 'FindingValidator' object has no attribute '_is_false_positive'`

### Pitfall 3: Breaking validator_example.py

**What goes wrong:** Example file may use removed functionality.
**Why it happens:** `validator_example.py` demonstrates FindingValidator usage.
**How to avoid:** Review and update example after removals.
**Warning signs:** Import errors or runtime errors when running example.

### Pitfall 4: is_impact_finding Field Access

**What goes wrong:** Trying to access `is_impact_finding` on old PRReviewFinding objects.
**Why it happens:** `PRReviewFinding` in `models.py` may not have this field.
**How to avoid:** Use `getattr(finding, 'is_impact_finding', False)` for backwards compatibility.
**Warning signs:** `AttributeError` in `_is_finding_in_scope`.

## Code Examples

### Simplified `_is_finding_in_scope()` (After Changes)

```python
def _is_finding_in_scope(
    finding: PRReviewFinding,
    changed_files: list[str],
) -> tuple[bool, str]:
    """
    Check if finding is within PR scope.

    Args:
        finding: The finding to check
        changed_files: List of file paths changed in the PR

    Returns:
        Tuple of (is_in_scope, reason)
    """
    if not finding.file:
        return False, "No file specified"

    # Check if file is in changed files
    if finding.file not in changed_files:
        # Use schema field instead of keyword detection
        is_impact = getattr(finding, 'is_impact_finding', False)

        if not is_impact:
            return (
                False,
                f"File '{finding.file}' not in PR changed files and not an impact finding",
            )

    # Check line number is reasonable (> 0)
    if finding.line is not None and finding.line <= 0:
        return False, f"Invalid line number: {finding.line}"

    return True, "In scope"
```

### Updated review() Method (Evidence Filter Removed)

```python
# BEFORE (lines 949-976):
for finding in validated_by_ai:
    # Check evidence quality - REMOVE THIS BLOCK
    evidence_valid, evidence_reason = _validate_finding_evidence(finding)
    if not evidence_valid:
        logger.info(f"[PRReview] Filtered finding {finding.id}: {evidence_reason}")
        filtered_findings.append((finding, evidence_reason))
        continue

    # Check scope
    scope_valid, scope_reason = _is_finding_in_scope(finding, changed_file_paths)
    ...

# AFTER:
for finding in validated_by_ai:
    # Check scope (evidence now enforced by schema)
    scope_valid, scope_reason = _is_finding_in_scope(finding, changed_file_paths)
    if not scope_valid:
        logger.info(f"[PRReview] Filtered finding {finding.id}: {scope_reason}")
        filtered_findings.append((finding, scope_reason))
        continue

    validated_findings.append(finding)
```

### Updated review() Method (Confidence Routing Removed)

```python
# BEFORE (lines 983-993):
# Apply confidence routing to filter low-confidence findings
routed_findings = self._apply_confidence_routing(validated_findings)

logger.info(
    f"[PRReview] Confidence routing: {len(routed_findings)} included, "
    f"{len(validated_findings) - len(routed_findings)} dropped (low confidence)"
)

# Use routed findings for verdict and summary
unique_findings = routed_findings

# AFTER:
# No confidence routing - validation is binary via finding-validator
unique_findings = validated_findings

logger.info(f"[PRReview] Final findings: {len(unique_findings)} validated")
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Pattern-based evidence check | Schema-enforced `VerificationEvidence` | Phase 2 | Evidence is required at schema level |
| Confidence tier routing | Binary validation via finding-validator | Phase 4 | No more tier-based filtering |
| Keyword-based scope detection | `is_impact_finding` schema field | Phase 2 | Agents declare intent, not inferred |
| VAGUE/GENERIC patterns | Prompt guidance | Phase 3 | AI avoids vague language by design |

## Open Questions

1. **Should we keep any logging for removed filters?**
   - What we know: The logging provided visibility into filter decisions
   - What's unclear: Whether this visibility is still needed
   - Recommendation: Keep validation logging (`[PRReview] Final findings: X validated`), remove filter-specific logs

2. **Should `output_validator.py` be deprecated entirely?**
   - What we know: After removing `_is_false_positive`, remaining functionality is:
     - Line number verification (also done in orchestrator)
     - Actionability scoring (not used post-validation)
     - Key term extraction (used for line relevance)
   - What's unclear: Whether any code path still uses `FindingValidator`
   - Recommendation: Keep file for now; mark for future deprecation review in Phase 6

## Sources

### Primary (HIGH confidence)
- Direct code inspection of `parallel_orchestrator_reviewer.py` (1770 lines)
- Direct code inspection of `output_validator.py` (521 lines)
- Direct code inspection of `pydantic_models.py` (718 lines)
- Direct code inspection of `test_output_validator.py` (625 lines)

### Secondary (MEDIUM confidence)
- ROADMAP.md for phase dependencies and requirements
- Previous phase plans (01-04) for schema/prompt changes

## Metadata

**Confidence breakdown:**
- Code locations: HIGH - Direct inspection of actual files
- Removal order: HIGH - Traced all callers and dependencies
- Risk assessment: HIGH - Code paths are well-defined

**Research date:** 2026-01-25
**Valid until:** N/A (code removal, not library research)
