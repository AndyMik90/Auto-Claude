# Phase 4: Validation Pipeline - Research

**Researched:** 2026-01-25
**Domain:** Validation pipeline integration for evidence-based PR review
**Confidence:** HIGH

## Summary

Phase 4 integrates the finding-validator agent into the initial review pipeline, adds line number verification to catch hallucinated findings, and enhances the validator prompt with hypothesis-validation structure. The current codebase has all the infrastructure in place: the finding-validator agent is already defined in `parallel_orchestrator_reviewer.py` (lines 379-392), the `FindingValidationResult` model exists in `pydantic_models.py` (lines 654-702), and the validator prompt `pr_finding_validator.md` has solid anti-false-positive guidance.

The critical gap is that **finding-validator is only invoked during follow-up reviews** (in `parallel_followup_reviewer.py`), not during initial reviews. The orchestrator prompt mentions "Phase 3.5: Finding Validation (CRITICAL)" but this is documentation only - no code actually invokes the validator after specialist agents complete in the initial review flow.

**Primary recommendation:** Add a `_validate_findings()` method to `parallel_orchestrator_reviewer.py` that invokes finding-validator for all findings before verdict generation. Modify the validator prompt to use hypothesis-validation structure. Add line number verification programmatically before validation (cheap check, catches obvious hallucinations).

## Standard Stack

This phase uses existing infrastructure - no new libraries needed.

### Core Components (Existing)

| Component | Location | Current State | Modification Needed |
|-----------|----------|---------------|---------------------|
| `finding-validator` agent | `parallel_orchestrator_reviewer.py:379-392` | Defined but not invoked in initial review | Invoke after specialist synthesis |
| `FindingValidationResult` | `pydantic_models.py:654-702` | Full schema with `code_evidence`, `line_range`, etc. | No changes |
| `FindingValidationResponse` | `pydantic_models.py:705-717` | Wrapper for list of validations | No changes |
| `pr_finding_validator.md` | `prompts/github/` | Good structure, needs hypothesis framing | Add hypothesis-validation section |
| `_validate_finding_evidence()` | `parallel_orchestrator_reviewer.py:104-158` | Programmatic filter (Phase 5 removal target) | Keep for now, add line verification |
| `_is_finding_in_scope()` | `parallel_orchestrator_reviewer.py:161-195` | Checks file in PR, basic line check | Add line count verification |

### Supporting Components (Reference Only)

| Component | Location | How Used |
|-----------|----------|----------|
| `create_client()` | `core/client.py` | Create SDK client for finding-validator |
| `process_sdk_stream()` | `services/sdk_utils.py` | Process validator agent responses |
| `ParallelOrchestratorResponse` | `pydantic_models.py:496-517` | Current structured output (no validation_summary) |
| `ParallelFollowupResponse` | `pydantic_models.py:589-646` | Reference - has `finding_validations` field |

### No New Dependencies

This phase requires **zero new libraries**. All changes are:
1. Python code changes to invoke finding-validator in initial review
2. Prompt edits to add hypothesis-validation structure
3. Line verification code addition

## Architecture Patterns

### Current Flow (Initial Review - Missing Validation)

```
PR Context
    |
    v
Orchestrator (analyzes, decides agents)
    |
    +---> security-reviewer ----+
    |                           |
    +---> quality-reviewer  ----+
    |                           +---> Dedup + Cross-Validate
    +---> logic-reviewer    ----+           |
    |                           |           v
    +---> codebase-fit      ----+    Raw Findings
                                         |
                                         v
                      +------------------------+
                      | Programmatic Filters   | <-- _validate_finding_evidence()
                      | (to be removed Phase 5)|     _is_finding_in_scope()
                      +------------------------+
                                         |
                                         v
                            +-------------------+
                            | Verdict Generation |
                            +-------------------+
                                         |
                                         v
                                 Present to User

*** MISSING: finding-validator invocation ***
```

### Recommended Flow (After Phase 4)

```
PR Context
    |
    v
Orchestrator (analyzes, decides agents)
    |
    +---> security-reviewer ----+
    |                           |
    +---> quality-reviewer  ----+
    |                           +---> Dedup + Cross-Validate
    +---> logic-reviewer    ----+           |
    |                           |           v
    +---> codebase-fit      ----+    Raw Findings
                                         |
                                         v
                     +---------------------------+
                     | Line Number Verification  | <-- NEW: Cheap pre-filter
                     | (file length check)       |
                     +---------------------------+
                                         |
                                         v
                     +---------------------------+
                     | finding-validator (AI)    | <-- NEW: Hypothesis validation
                     | (for each remaining)      |
                     +---------------------------+
                                         |
                                         v
                                 Validated Findings
                                         |
                                         v
                            +-------------------+
                            | Verdict Generation |
                            +-------------------+
                                         |
                                         v
                                 Present to User
```

### Pattern 1: Two-Stage Validation

The recommended approach uses two validation stages:

**Stage 1: Programmatic Pre-Filter (Cheap)**
- Check line number exists (file length)
- Check file exists in worktree
- Rejects obvious hallucinations without AI cost

**Stage 2: AI Hypothesis Validation (Thorough)**
- Invoke finding-validator agent
- Re-read actual code with fresh eyes
- Binary decision: confirmed_valid / dismissed_false_positive / needs_human_review

This pattern is cost-effective: Stage 1 is free, Stage 2 only runs for findings that pass Stage 1.

### Pattern 2: Hypothesis-Validation Structure

The validator prompt should frame each finding as a hypothesis to test:

```markdown
For each finding, construct and validate:

HYPOTHESIS: The issue "{title}" exists at {file}:{line}

CONDITIONS TO VERIFY:
1. The code at this location contains the pattern described
2. No mitigation exists in surrounding context (+/- 20 lines)
3. The issue is actually exploitable/problematic in this context

INVESTIGATION:
1. Read {file} lines {line-20} to {line+20}
2. Verify each condition against actual code
3. Report: CONFIRMED | DISPROVED | INCONCLUSIVE

EVIDENCE:
- Copy-paste the actual code that proves your conclusion
- Set `evidence_verified_in_file: true/false`
```

### Pattern 3: Parallel Validation with Batching

For PRs with many findings (10+), validate in batches of 5:

```python
async def _validate_findings_batched(self, findings: list[PRReviewFinding], batch_size: int = 5):
    """Validate findings in batches for cost efficiency."""
    validated = []
    for i in range(0, len(findings), batch_size):
        batch = findings[i:i + batch_size]
        batch_results = await self._invoke_finding_validator(batch)
        validated.extend(batch_results)
    return validated
```

### Anti-Patterns to Avoid

- **Skipping validation for "obvious" findings:** All findings should be validated - specialists hallucinate
- **Trusting confidence scores alone:** A 0.95 confidence finding can still be wrong if the code was misread
- **Validating after verdict generation:** Must validate before, not after - verdict depends on validation results
- **Sequential specialist + validator calls:** Use existing parallel architecture where possible

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File line counting | Custom file parsing | Python's `Path.read_text().splitlines()` | Already handles encoding |
| Batch validation | Complex async orchestration | Sequential with timeout | Simple, reliable |
| Validation result tracking | Manual dict management | `FindingValidationResult` Pydantic model | Already exists with full schema |

**Key insight:** The infrastructure exists - `FindingValidationResult`, `FindingValidationResponse`, the finding-validator agent definition. Phase 4 just needs to connect these pieces in the initial review flow.

## Common Pitfalls

### Pitfall 1: Not Passing Worktree Path to Validator

**What goes wrong:** Validator reads from main checkout instead of PR worktree, sees different code
**Why it happens:** Forgetting that review runs in temporary worktree at PR HEAD
**How to avoid:**
- Pass `project_root` (worktree path) to `_validate_findings()` method
- Validator agent inherits filesystem access from orchestrator session
**Warning signs:** Validator reports "code doesn't exist" for code that does exist in PR

### Pitfall 2: Validation Adds Too Much Latency

**What goes wrong:** Review takes 2-3x longer with validation
**Why it happens:** Sequential validation of each finding
**How to avoid:**
- Pre-filter with programmatic line check (free)
- Batch findings to validator (fewer API calls)
- Accept that quality costs time - this is the point
**Warning signs:** Users complain about slow reviews

### Pitfall 3: Validator Confirms Everything

**What goes wrong:** Validator just echoes specialist findings, doesn't actually re-read code
**Why it happens:** Prompt not clear enough, validator "trusts" specialist
**How to avoid:**
- Hypothesis-validation structure forces explicit verification steps
- Require `evidence_verified_in_file: true/false` to catch lazy validation
- Prompt says "NEVER trust the finding description without reading the code"
**Warning signs:** 0% dismissal rate, validation just rubber-stamps findings

### Pitfall 4: Over-Dismissing Real Issues

**What goes wrong:** Validator dismisses too many real issues as false positives
**Why it happens:** Validator too skeptical, misses subtle issues
**How to avoid:**
- Use `needs_human_review` for uncertain cases
- Track dismissal rate and sample-check dismissed findings
- Don't make validator goal "reduce findings" - goal is "accurate findings"
**Warning signs:** >50% dismissal rate, real bugs slipping through

### Pitfall 5: Breaking Structured Output Schema

**What goes wrong:** Adding validation_summary changes ParallelOrchestratorResponse, breaks clients
**Why it happens:** Modifying shared schema without testing consumers
**How to avoid:**
- Add fields with defaults (backwards compatible)
- Test structured output parsing still works
- Validation data can go in each finding's fields, not top-level
**Warning signs:** Validation errors in production

## Code Examples

### Line Number Verification (VAL-02)

```python
# Source: New code for parallel_orchestrator_reviewer.py

async def _verify_line_numbers(
    self,
    findings: list[PRReviewFinding],
    worktree_path: Path,
) -> tuple[list[PRReviewFinding], list[tuple[PRReviewFinding, str]]]:
    """
    Pre-filter findings with obviously invalid line numbers.

    Args:
        findings: Findings from specialist agents
        worktree_path: Path to PR worktree (or project root)

    Returns:
        Tuple of (valid_findings, rejected_findings_with_reasons)
    """
    valid = []
    rejected = []

    # Cache file line counts to avoid re-reading
    line_counts: dict[str, int] = {}

    for finding in findings:
        file_path = worktree_path / finding.file

        # Check file exists
        if not file_path.exists():
            rejected.append((finding, f"File does not exist: {finding.file}"))
            continue

        # Get line count (cached)
        if finding.file not in line_counts:
            try:
                content = file_path.read_text(encoding="utf-8", errors="replace")
                line_counts[finding.file] = len(content.splitlines())
            except Exception as e:
                logger.warning(f"Could not read file {finding.file}: {e}")
                line_counts[finding.file] = float("inf")  # Allow on read error

        max_line = line_counts[finding.file]

        # Check line number is valid
        if finding.line > max_line:
            rejected.append((
                finding,
                f"Line {finding.line} exceeds file length ({max_line} lines)"
            ))
            continue

        valid.append(finding)

    # Log rejections
    if rejected:
        logger.info(
            f"[PRReview] Line verification: {len(rejected)} findings rejected, "
            f"{len(valid)} passed"
        )
        for finding, reason in rejected:
            logger.info(f"[PRReview] Rejected {finding.id}: {reason}")

    return valid, rejected
```

### Finding Validator Invocation (VAL-01)

```python
# Source: New code for parallel_orchestrator_reviewer.py

async def _validate_findings(
    self,
    findings: list[PRReviewFinding],
    context: PRContext,
    worktree_path: Path,
) -> list[PRReviewFinding]:
    """
    Validate findings using the finding-validator agent.

    Args:
        findings: Pre-filtered findings from specialist agents
        context: PR context with changed files
        worktree_path: Path to PR worktree for code reading

    Returns:
        List of validated findings (only confirmed_valid and needs_human_review)
    """
    if not findings:
        return []

    # Build validation prompt with all findings
    findings_json = []
    for f in findings:
        findings_json.append({
            "id": f.id,
            "file": f.file,
            "line": f.line,
            "title": f.title,
            "description": f.description,
            "severity": f.severity.value,
            "category": f.category.value,
            "evidence": f.evidence,
        })

    prompt = f"""
## Findings to Validate

The following findings were reported by specialist agents. Your job is to validate each one.

**Changed files in this PR:** {', '.join(f.path for f in context.changed_files)}

**Findings:**
```json
{json.dumps(findings_json, indent=2)}
```

For EACH finding above:
1. Read the actual code at the file/line location
2. Determine if the issue actually exists
3. Return validation status with code evidence
"""

    # Create validator client (inherits worktree filesystem access)
    validator_client = create_client(
        project_dir=worktree_path,
        spec_dir=self.github_dir,
        model=self._resolve_model(),
        agent_type="pr_finding_validator",
        max_thinking_tokens=get_thinking_budget("medium"),
        output_format={
            "type": "json_schema",
            "schema": FindingValidationResponse.model_json_schema(),
        },
    )

    # Run validation
    async with validator_client:
        await validator_client.query(prompt)

        stream_result = await process_sdk_stream(
            client=validator_client,
            context_name="FindingValidator",
            model=self._resolve_model(),
        )

        if stream_result.get("error"):
            logger.error(f"[PRReview] Validation failed: {stream_result['error']}")
            # On validation failure, return original findings (fail-safe)
            return findings

        structured_output = stream_result.get("structured_output")

    if not structured_output:
        logger.warning("[PRReview] No structured validation output, keeping original findings")
        return findings

    # Parse validation results
    try:
        response = FindingValidationResponse.model_validate(structured_output)
    except Exception as e:
        logger.error(f"[PRReview] Failed to parse validation response: {e}")
        return findings

    # Build map of validation results
    validation_map = {v.finding_id: v for v in response.validations}

    # Filter findings based on validation
    validated_findings = []
    dismissed_count = 0
    needs_human_count = 0

    for finding in findings:
        validation = validation_map.get(finding.id)

        if not validation:
            # No validation result - keep finding (conservative)
            validated_findings.append(finding)
            continue

        if validation.validation_status == "confirmed_valid":
            # Add validation evidence to finding
            finding.validation_status = "confirmed_valid"
            finding.validation_evidence = validation.code_evidence
            finding.validation_explanation = validation.explanation
            validated_findings.append(finding)

        elif validation.validation_status == "dismissed_false_positive":
            # Dismiss - do not include
            dismissed_count += 1
            logger.info(
                f"[PRReview] Dismissed {finding.id} as false positive: "
                f"{validation.explanation[:100]}"
            )

        elif validation.validation_status == "needs_human_review":
            # Keep but flag
            finding.validation_status = "needs_human_review"
            finding.validation_evidence = validation.code_evidence
            finding.validation_explanation = validation.explanation
            finding.title = f"[NEEDS REVIEW] {finding.title}"
            validated_findings.append(finding)
            needs_human_count += 1

    logger.info(
        f"[PRReview] Validation complete: {len(validated_findings)} valid, "
        f"{dismissed_count} dismissed, {needs_human_count} need human review"
    )

    return validated_findings
```

### Hypothesis-Validation Prompt Section (VAL-03)

```markdown
# Add to pr_finding_validator.md after "Your Mission" section

## Hypothesis-Validation Structure (MANDATORY)

For EACH finding you investigate, use this structured approach:

### Step 1: State the Hypothesis

Before reading any code, clearly state what you're testing:

```
HYPOTHESIS: The finding claims "{title}" at {file}:{line}

This hypothesis is TRUE if:
1. The code at {line} contains {specific pattern described}
2. No mitigation exists in context (+/- 20 lines)
3. The issue is actually reachable/exploitable

This hypothesis is FALSE if:
1. The code at {line} is different than described
2. Mitigation exists (validation, sanitization, framework protection)
3. The code is unreachable/theoretical
```

### Step 2: Gather Evidence

Read the actual code. Copy-paste it into `code_evidence`.

```
FILE: {file}
LINES: {line-20} to {line+20}
ACTUAL CODE:
[paste code here]
```

### Step 3: Test Each Condition

For each condition in your hypothesis:

```
CONDITION 1: Code contains {pattern}
EVIDENCE: [specific line from code_evidence that proves/disproves]
RESULT: TRUE / FALSE

CONDITION 2: No mitigation in context
EVIDENCE: [what you found or didn't find]
RESULT: TRUE / FALSE

CONDITION 3: Issue is reachable
EVIDENCE: [how input reaches this code, or why it doesn't]
RESULT: TRUE / FALSE
```

### Step 4: Conclude

Based on evidence:
- ALL conditions TRUE = `confirmed_valid`
- ANY condition FALSE = `dismissed_false_positive`
- CANNOT DETERMINE any condition = `needs_human_review`

### Example

```
HYPOTHESIS: SQL injection at auth.py:45

Conditions:
1. User input in SQL string
2. No parameterization
3. Input reachable from HTTP request

Evidence:
FILE: auth.py, lines 25-65
ACTUAL CODE:
```python
def get_user(user_id: str) -> User:
    # user_id comes from request.args["id"]
    query = f"SELECT * FROM users WHERE id = {user_id}"  # Line 45
    return db.execute(query).fetchone()
```

Test:
1. Code contains user input in SQL: TRUE (f-string interpolation of user_id)
2. No parameterization: TRUE (raw string, not db.execute(query, [user_id]))
3. Input reachable: TRUE (comes from request.args)

CONCLUSION: confirmed_valid
CODE_EVIDENCE: "query = f\"SELECT * FROM users WHERE id = {user_id}\""
LINE_RANGE: [45, 45]
```
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Trust specialist findings | Validate with fresh eyes | This phase | Catches hallucinations |
| Confidence scores alone | Evidence-based validation | Phase 2 (schema) | Binary decisions |
| Post-hoc filtering | Pre-verdict validation | This phase | Accurate verdicts |
| Follow-up only validation | All reviews validated | This phase | Consistent quality |

**Why validation matters:**
- Phase 1 gave specialists better context (reduced hallucinations at source)
- Phase 2 required evidence in schema (forced specialists to prove claims)
- Phase 3 improved prompts (taught specialists to verify before reporting)
- Phase 4 adds validation gate (catches what still slips through)
- Phase 5 removes programmatic filters (relies on schema + validation)

## Open Questions

### 1. Validation Timeout/Cost

**What we know:** Validation adds an AI call per review
**What's unclear:** Acceptable latency increase? Cost per review?
**Recommendation:** Accept 30-60s additional time for quality. Monitor and optimize later.

### 2. Batching Strategy

**What we know:** Can pass multiple findings to validator in one prompt
**What's unclear:** How many before context window issues?
**Recommendation:** Start with all findings in one call (simpler), add batching if needed.

### 3. Validation Failure Handling

**What we know:** Validator can fail (timeout, API error, parse error)
**What's unclear:** Fail-safe (keep findings) or fail-closed (block review)?
**Recommendation:** Fail-safe - keep original findings if validation fails. Log prominently.

### 4. Metrics for Success

**What we know:** Goal is <5% false positive rate
**What's unclear:** How to measure before Phase 6 (Measurement)?
**Recommendation:** Log validation statistics (dismissed_count, confirmed_count). Manual review of dismissed findings to spot over-dismissal.

## Sources

### Primary (HIGH confidence)

- **Existing codebase** - `parallel_orchestrator_reviewer.py`, `parallel_followup_reviewer.py`, `pydantic_models.py`
  - Verified: Finding-validator agent defined but only used in follow-up
  - Verified: FindingValidationResult schema has all needed fields
  - Verified: Validator prompt has good anti-FP guidance, needs hypothesis structure

- **Prior phase research**
  - `.planning/phases/02-schema-enforcement/02-RESEARCH.md` - VerificationEvidence schema
  - `.planning/phases/03-prompt-improvements/03-RESEARCH.md` - Evidence Requirements section
  - `.planning/research/ARCHITECTURE.md` - Hypothesis-validation paradigm (VulAgent)

### Secondary (MEDIUM confidence)

- **[VulAgent: Hypothesis Validation-Based Multi-Agent Vulnerability Detection](https://arxiv.org/html/2509.11523v1)**
  - 36% false positive reduction with hypothesis validation
  - Pattern: discovery -> hypothesis -> validation -> filter
  - Directly applicable to our architecture

### Tertiary (LOW confidence)

- General prompt engineering patterns for validation agents

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing infrastructure, no new components
- Architecture: HIGH - Follow-up reviewer already has this pattern working
- Pitfalls: MEDIUM - Based on follow-up reviewer implementation, not initial review testing

**Research date:** 2026-01-25
**Valid until:** Implementation complete (changes are architectural, not library-dependent)

---

## Implementation Checklist (For Planner Reference)

Based on research, the planner should create tasks for:

### VAL-01: Finding-validator runs for ALL initial reviews

1. **Add `_verify_line_numbers()` method** to `parallel_orchestrator_reviewer.py`
   - Pre-filter findings with obviously invalid line numbers
   - Cache file line counts for efficiency
   - Log rejections for debugging

2. **Add `_validate_findings()` method** to `parallel_orchestrator_reviewer.py`
   - Invoke finding-validator agent for remaining findings
   - Parse FindingValidationResponse
   - Filter based on validation_status

3. **Modify `review()` method** to call validation
   - After cross-validation (line ~900)
   - Before programmatic filters (line ~917)
   - Pass worktree_path to validator

4. **Add validation fields to PRReviewFinding** (if not already present)
   - `validation_status: str | None`
   - `validation_evidence: str | None`
   - `validation_explanation: str | None`

### VAL-02: Line number verification catches hallucinated line numbers

1. **Implement line count check** in `_verify_line_numbers()`
   - Read file, count lines
   - Reject findings where `line > file_length`
   - Log with clear reason

2. **Add line verification before AI validation**
   - Cheap check runs first
   - Saves API cost on obvious hallucinations

### VAL-03: Hypothesis-validation structure in validator prompt

1. **Add "Hypothesis-Validation Structure (MANDATORY)" section** to `pr_finding_validator.md`
   - Step 1: State the Hypothesis
   - Step 2: Gather Evidence
   - Step 3: Test Each Condition
   - Step 4: Conclude
   - Include worked example

2. **Update Investigation Process section**
   - Reference hypothesis structure
   - Make steps more explicit

**Verification:**
- Run test review with known false positive - should be dismissed
- Run test review with real issue - should be confirmed
- Line number > file length - should be rejected pre-validation
- Validation stats logged in output
