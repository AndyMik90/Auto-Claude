# Roadmap: PR Review 99% Trust

## Overview

Transform the AI PR review system from 57% false positive rate to under 5% by forcing evidence-based verification. The journey goes: give AI better context (Phase 1), make evidence required (Phase 2), improve prompts (Phase 3), add validation pipeline (Phase 4), remove old band-aid filters (Phase 5), then measure and iterate (Phase 6).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [ ] **Phase 1: Holistic PR Understanding** - Pass gathered context to orchestrator and specialists
- [ ] **Phase 2: Schema Enforcement** - Add VerificationEvidence class and make it required
- [ ] **Phase 3: Prompt Improvements** - Add "Understand Intent" and "Evidence Requirements" to prompts
- [ ] **Phase 4: Validation Pipeline** - Run finding-validator for ALL reviews, add line verification
- [ ] **Phase 5: Code Simplification** - Remove programmatic filters that are now redundant
- [ ] **Phase 6: Measurement** - Run 5 PRs, calculate FP rate, iterate

## Phase Details

### Phase 1: Holistic PR Understanding
**Goal**: AI understands full PR context before reviewing (currently gathered but unused)
**Depends on**: Nothing (first phase)
**Requirements**: CONTEXT-01, CONTEXT-02, CONTEXT-03, CONTEXT-04, CONTEXT-05
**Success Criteria** (what must be TRUE):
  1. Orchestrator prompt includes PR synthesis instruction ("Understand the PR Holistically" phase)
  2. Related files list (50 files from context_gatherer.py) appears in orchestrator prompt
  3. Import graph summary appears in orchestrator prompt
  4. Specialists receive "files to investigate" list beyond just changed files
  5. Orchestrator synthesizes description + files + commits + comments before delegating
**Plans**: TBD

Plans:
- [ ] 01-01: TBD (Context passing to orchestrator)
- [ ] 01-02: TBD (Context passing to specialists)

### Phase 2: Schema Enforcement
**Goal**: Findings cannot exist without verification evidence (schema enforces it)
**Depends on**: Nothing (can run parallel with Phase 1)
**Requirements**: SCHEMA-01, SCHEMA-02, SCHEMA-03, SCHEMA-04, SCHEMA-05
**Success Criteria** (what must be TRUE):
  1. VerificationEvidence class exists in pydantic_models.py with code_examined, line_range_examined, verification_method fields
  2. BaseFinding.verification is required (not optional)
  3. ParallelOrchestratorFinding.verification is required (not optional)
  4. is_impact_finding field exists on findings (replaces keyword-based scope detection)
  5. checked_for_handling_elsewhere field exists for "missing X" claims
**Plans**: TBD

Plans:
- [ ] 02-01: TBD (Schema changes)

### Phase 3: Prompt Improvements
**Goal**: Prompts guide AI to understand intent and provide evidence
**Depends on**: Phase 2 (prompts reference new schema fields)
**Requirements**: PROMPT-01, PROMPT-02, PROMPT-03, PROMPT-04, PROMPT-05, PROMPT-06
**Success Criteria** (what must be TRUE):
  1. All 4 specialist prompts have "Understand Intent" phase at the beginning
  2. All 4 specialist prompts have "Evidence Requirements" section referencing new schema
  3. Orchestrator prompt has "What the Diff Is For" reframing section
  4. Prompts explicitly allow "no significant issues found" as valid output
**Plans**: TBD

Plans:
- [ ] 03-01: TBD (Specialist prompt updates)
- [ ] 03-02: TBD (Orchestrator prompt update)

### Phase 4: Validation Pipeline
**Goal**: Finding-validator runs for ALL reviews (not just follow-ups), with line verification
**Depends on**: Phase 2 and Phase 3 (validator needs to verify against new schema)
**Requirements**: VAL-01, VAL-02, VAL-03
**Success Criteria** (what must be TRUE):
  1. Finding-validator invoked in initial review pipeline (not just follow-up reviews)
  2. Line number verification catches findings with line numbers that exceed file length
  3. Validator prompt uses hypothesis-validation structure ("this finding claims X, verify if X is true")
**Plans**: TBD

Plans:
- [ ] 04-01: TBD (Validation pipeline changes)

### Phase 5: Code Simplification
**Goal**: Remove programmatic filters that are now redundant (prompts + schema handle quality)
**Depends on**: Phase 1, 2, 3, 4 (remove filters only after replacements are in place)
**Requirements**: REMOVE-01, REMOVE-02, REMOVE-03, REMOVE-04, REMOVE-05, REMOVE-06
**Success Criteria** (what must be TRUE):
  1. _validate_finding_evidence() function removed from parallel_orchestrator_reviewer.py
  2. Evidence filter call (lines 839-845) removed
  3. _apply_confidence_routing() function removed
  4. VAGUE_PATTERNS and GENERIC_PATTERNS removed from output_validator.py
  5. _is_false_positive() method removed from output_validator.py
  6. _is_finding_in_scope() uses is_impact_finding schema field instead of keyword detection
**Plans**: TBD

Plans:
- [ ] 05-01: TBD (Remove filter functions)

### Phase 6: Measurement
**Goal**: Validate the changes work by running real PRs and measuring FP rate
**Depends on**: Phase 5 (all changes complete before measuring)
**Requirements**: MEASURE-01, MEASURE-02, MEASURE-03, MEASURE-04
**Success Criteria** (what must be TRUE):
  1. 5 PRs reviewed with new system
  2. False positive rate calculated and documented (target: <15%)
  3. Patterns in remaining false positives documented
  4. Prompt iterations applied if FP rate exceeds target
**Plans**: TBD

Plans:
- [ ] 06-01: TBD (Run and measure)

## Progress

**Execution Order:**
Phases 1 and 2 can run in parallel. Then 3, 4, 5, 6 in sequence.

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Holistic PR Understanding | 0/2 | Not started | - |
| 2. Schema Enforcement | 0/1 | Not started | - |
| 3. Prompt Improvements | 0/2 | Not started | - |
| 4. Validation Pipeline | 0/1 | Not started | - |
| 5. Code Simplification | 0/1 | Not started | - |
| 6. Measurement | 0/1 | Not started | - |

---
*Roadmap created: 2026-01-25*
*Last updated: 2026-01-25*
