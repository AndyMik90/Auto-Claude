# PR Review System: Path to 99% Trust

## What This Is

Fixing the AI PR review system's false positive problem (~57% invalid findings) by forcing evidence-based verification. The system has specialist agents (security, logic, quality, codebase-fit) that make claims without proving them. This milestone adds prompt discipline and structured output that requires actual code evidence before any finding is reported.

## Core Value

**When the system flags something, it's a real issue.** No more second-guessing findings. Trust comes from proof, not filters.

## Requirements

### Validated

- ✓ Multi-agent PR review architecture — existing
- ✓ Specialist agents (security, logic, quality, codebase-fit) — existing
- ✓ Finding-validator for follow-up reviews — existing
- ✓ Cross-validation (multi-agent agreement) — existing
- ✓ Tools available (Read, Grep, Glob) — existing

### Active

#### Phase 1: Core Fixes (Prompts + Schema)

- [ ] **PROMPT-01**: Add "Understand Intent" phase to pr_security_agent.md
- [ ] **PROMPT-02**: Add "Understand Intent" phase to pr_logic_agent.md
- [ ] **PROMPT-03**: Add "Understand Intent" phase to pr_quality_agent.md
- [ ] **PROMPT-04**: Add "Understand Intent" phase to pr_codebase_fit_agent.md
- [ ] **SCHEMA-01**: Add VerificationEvidence class to pydantic_models.py
- [ ] **SCHEMA-02**: Make verification required in BaseFinding
- [ ] **SCHEMA-03**: Make verification required in ParallelOrchestratorFinding
- [ ] **SCHEMA-04**: Add is_impact_finding field for scope validation
- [ ] **PROMPT-05**: Add "Evidence Requirements" section to all specialist prompts
- [ ] **PROMPT-06**: Add "What the Diff Is For" reframing to pr_parallel_orchestrator.md

#### Phase 2: Simplify Validation Pipeline

- [ ] **REMOVE-01**: Remove _validate_finding_evidence() (lines 104-158 in parallel_orchestrator_reviewer.py)
- [ ] **REMOVE-02**: Remove evidence filter call (lines 839-845)
- [ ] **REMOVE-03**: Remove _apply_confidence_routing() (lines 1235-1286)
- [ ] **REMOVE-04**: Remove VAGUE_PATTERNS and GENERIC_PATTERNS (output_validator.py lines 26-47)
- [ ] **REMOVE-05**: Remove _is_false_positive() (output_validator.py lines 297-340)
- [ ] **SIMPLIFY-01**: Simplify _is_finding_in_scope() to use schema field instead of keywords

#### Phase 3: Measure and Iterate

- [ ] **MEASURE-01**: Run 5 PRs with new prompts
- [ ] **MEASURE-02**: Count invalid findings, calculate FP rate
- [ ] **MEASURE-03**: Document patterns in remaining false positives
- [ ] **MEASURE-04**: Iterate on prompts if needed

### Out of Scope

- LSP integration — separate milestone, improves token usage but doesn't fix hallucinations
- Dynamic MCP discovery — separate milestone, efficiency improvement
- Diff-scope validation (programmatic) — only add if Phase 3 data shows it's needed
- Recall measurement — focus on precision first
- Agent-specific FP rates — aggregate metrics first

## Context

**Problem**: False positives erode trust. Users second-guess every finding, defeating the purpose.

**Root cause**: AI makes claims without verification. The diff is inline, so AI thinks it already has the code. Output schema doesn't REQUIRE proof.

**Solution**: Three principles:
1. Understand Intent First — shift from fault-finding to evaluating "did they accomplish their goal"
2. Evidence-Based Verification — structured output requiring actual code snippets
3. Diff = Investigation Starting Point — not a conclusion source

**Key insight**: The fix is not more filters. The fix is better prompts + enforced evidence schema.

**Existing code**:
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py` — main orchestrator
- `apps/backend/runners/github/services/pydantic_models.py` — finding schemas
- `apps/backend/runners/github/output_validator.py` — keyword-based FP detection (to remove)
- `apps/backend/prompts/github/pr_*.md` — specialist agent prompts

**Reference**: Full PRD at `docs/PR_REVIEW_99_TRUST.md`

## Constraints

- **Existing architecture**: Work within current multi-agent structure
- **Backward compatibility**: Don't break existing review workflows
- **No new dependencies**: Prompt/schema changes only
- **Test gap**: Filter functions have no unit tests (removal is safe)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Evidence-based, not filter-based | Filters are band-aids; fix prompts so AI produces good findings | — Pending |
| Remove confidence routing | Binary evidence: you have proof or you don't | — Pending |
| Keep scope filter, simplify it | Valid to reject findings on unchanged files, but use schema field not keywords | — Pending |
| 5 PRs for validation, not 20 | Faster iteration, enough signal to catch obvious issues | — Pending |

---
*Last updated: 2026-01-25 after initialization*
