# Roadmap: PR Review System Robustness

**Project:** PR Review False Positive Reduction
**Created:** 2026-01-19
**Mode:** Comprehensive (8-12 phases)
**Parallelization:** Enabled

---

## Overview

```
Phase 1: Core Validation Pipeline
├─ P1.1: Fix Critical Bugs (REQ-002, REQ-003)
├─ P1.2: Add Finding-Validator to Initial Reviews (REQ-001)
├─ P1.3: Evidence & Scope Enforcement (REQ-009, REQ-010)
└─ P1.4: Tool Usage Instructions (REQ-004)

Phase 2: Context Enrichment
├─ P2.1: JS/TS Import Analysis (REQ-005)
├─ P2.2: Python Import Analysis (REQ-006)
└─ P2.3: Related Files Enhancement (REQ-007, REQ-008)

Phase 3: Cross-Validation
├─ P3.1: Confidence Scoring (REQ-011)
└─ P3.2: Multi-Agent Agreement (REQ-012)

Phase 4: Integration Testing
└─ P4.1: End-to-End Validation
```

---

## Phase 1: Core Validation Pipeline

**Goal:** Eliminate false positives by running validation on ALL reviews.
**Plans:** 4 plans in 3 waves

**Research Basis:**
- SUMMARY.md: "Finding Validator integrated into initial review flow" is Phase 1 priority
- PITFALLS.md: #1 pitfall is "Finding-Validator Only on Follow-up Reviews"
- STACK.md: Generator-Critic pattern is industry standard

**Status:** Complete (2026-01-19)

Plans:
- [x] 01-01-PLAN.md - Fix ai_reviews context bug (Wave 1)
- [x] 01-02-PLAN.md - Add tool usage instructions to prompts (Wave 1)
- [x] 01-03-PLAN.md - Add finding-validator to initial reviews (Wave 2)
- [x] 01-04-PLAN.md - Evidence validation and scope pre-filter (Wave 3)

### P1.1: Fix Critical Context Bugs

**Requirements:** REQ-002, REQ-003
**Effort:** Small
**Parallelizable:** Yes (independent changes)

**Goal:** Fix bugs that cause missing context in reviews.

**Deliverables:**
1. Fix line 1288 - include ai_reviews in follow-up context (REQ-002)
2. Add `_fetch_pr_reviews()` to fetch formal PR reviews (REQ-003)
3. Include formal reviews in `_fetch_ai_bot_comments()` output

**Files:**
- `apps/backend/runners/github/context_gatherer.py`

**Success Criteria:**
- [ ] Follow-up reviews include both AI comments AND AI formal reviews
- [ ] Initial reviews fetch from `/pulls/{pr}/reviews` endpoint
- [ ] AI bot formal reviews parsed using existing `AI_BOT_PATTERNS`

---

### P1.2: Finding-Validator on Initial Reviews

**Requirements:** REQ-001
**Effort:** Medium
**Parallelizable:** No (core infrastructure change)

**Goal:** Apply the existing finding-validator to initial reviews.

**Deliverables:**
1. Add `finding-validator` agent to `_define_specialist_agents()` in parallel_orchestrator
2. Update orchestrator prompt with Phase 3.5: Validate findings before synthesis
3. Wire validation results into verdict generation

**Files:**
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py`
- `apps/backend/prompts/github/pr_parallel_orchestrator.md`

**Success Criteria:**
- [ ] Initial reviews invoke finding-validator for all findings
- [ ] Validation produces CONFIRMED/NEEDS_EVIDENCE/REJECTED status
- [ ] REJECTED findings excluded from final output

---

### P1.3: Evidence & Scope Enforcement

**Requirements:** REQ-009, REQ-010
**Effort:** Small
**Parallelizable:** Yes (can run after P1.2)

**Goal:** Filter findings that lack evidence or are out of scope.

**Deliverables:**
1. Add evidence validation logic (code must contain actual code patterns)
2. Add scope pre-filter (file in changed files, valid line numbers)
3. Log filtered findings for monitoring

**Files:**
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py`

**Success Criteria:**
- [ ] Findings without code evidence filtered
- [ ] Findings outside PR scope filtered
- [ ] Filters run fast (< 100ms total)

---

### P1.4: Tool Usage Instructions

**Requirements:** REQ-004
**Effort:** Small
**Parallelizable:** Yes (independent prompt changes)

**Goal:** Teach specialist agents to verify claims with actual code.

**Deliverables:**
1. Add "CRITICAL: Full Context Analysis" section to all specialist prompts
2. Specify Read before reporting, Grep for callers
3. Require tool verification for "missing X" claims

**Files:**
- `apps/backend/prompts/github/pr_parallel_orchestrator.md`
- `apps/backend/prompts/github/pr_security_agent.md`
- `apps/backend/prompts/github/pr_logic_agent.md`
- `apps/backend/prompts/github/pr_quality_agent.md`
- `apps/backend/prompts/github/pr_codebase_fit_agent.md`
- `apps/backend/prompts/github/pr_followup_resolution_agent.md`
- `apps/backend/prompts/github/pr_followup_newcode_agent.md`

**Success Criteria:**
- [ ] All specialist agent prompts include tool usage instructions
- [ ] Instructions specify when and how to use Read/Grep/Glob

---

## Phase 2: Context Enrichment

**Goal:** Improve context gathering to reduce false positives at the source.
**Plans:** 3 plans in 2 waves

**Research Basis:**
- SUMMARY.md: "Better context means specialists produce fewer hallucinated findings"
- PITFALLS.md: #3 "Incomplete Import Analysis" is moderate pitfall

**Status:** Complete (2026-01-19)

Plans:
- [x] 02-01-PLAN.md - JS/TS import analysis: path aliases, CommonJS, re-exports (Wave 1)
- [x] 02-02-PLAN.md - Python import analysis via AST (Wave 1)
- [x] 02-03-PLAN.md - Related files: limit 50, prioritization, reverse deps (Wave 2)

### P2.1: JS/TS Import Analysis

**Requirements:** REQ-005
**Effort:** Medium
**Parallelizable:** Yes

**Goal:** Detect path alias and CommonJS imports.

**Deliverables:**
1. Add patterns for `@/utils`, `@utils/helpers` imports
2. Add patterns for CommonJS `require('./utils')`
3. Add patterns for re-exports `export * from`
4. Add `_resolve_path_alias()` with tsconfig.json parsing

**Files:**
- `apps/backend/runners/github/context_gatherer.py`

**Success Criteria:**
- [ ] Path alias imports detected and resolved
- [ ] CommonJS requires detected
- [ ] Re-exports detected

---

### P2.2: Python Import Analysis

**Requirements:** REQ-006
**Effort:** Medium
**Parallelizable:** Yes

**Goal:** Detect Python imports (currently skipped).

**Deliverables:**
1. Parse relative imports: `from .utils import helper`
2. Parse absolute imports: `from utils import helper`
3. Add `_resolve_python_import()` method

**Files:**
- `apps/backend/runners/github/context_gatherer.py`

**Success Criteria:**
- [ ] Python relative imports detected
- [ ] Python absolute imports (project-internal) detected
- [ ] Resolved to actual file paths

---

### P2.3: Related Files Enhancement

**Requirements:** REQ-007, REQ-008
**Effort:** Medium
**Parallelizable:** Yes

**Goal:** Expand related files coverage and add reverse dependencies.

**Deliverables:**
1. Increase related files limit from 20 to 50
2. Add smart prioritization (tests > types > configs)
3. Add `_find_dependents()` for reverse dependency analysis

**Files:**
- `apps/backend/runners/github/context_gatherer.py`

**Success Criteria:**
- [ ] Limit increased to 50 with prioritization
- [ ] Reverse dependencies detected
- [ ] Performance < 5 seconds for typical PRs

---

## Phase 3: Cross-Validation

**Goal:** Enhance confidence scoring and multi-agent agreement.
**Plans:** 2 plans in 2 waves

**Research Basis:**
- ARCHITECTURE.md: Confidence thresholds and multi-source agreement patterns
- STACK.md: "Multi-review aggregation significantly boosts F1 scores"

**Status:** Complete (2026-01-19)

Plans:
- [x] 03-01-PLAN.md - Confidence threshold routing (Wave 1)
- [x] 03-02-PLAN.md - Multi-agent agreement and confidence boost (Wave 2)

### P3.1: Confidence Scoring

**Requirements:** REQ-011
**Effort:** Medium
**Parallelizable:** No (depends on P1 completion)

**Goal:** Route findings based on confidence thresholds.

**Deliverables:**
1. Add confidence score calculation after validation
2. Implement routing logic (HIGH/MEDIUM/LOW)
3. Handle low-confidence findings appropriately

**Files:**
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py`
- `apps/backend/prompts/github/pr_parallel_orchestrator.md`

**Success Criteria:**
- [ ] Confidence scores assigned to validated findings
- [ ] Routing logic based on thresholds
- [ ] Low-confidence findings handled appropriately

---

### P3.2: Multi-Agent Agreement

**Requirements:** REQ-012
**Effort:** Medium
**Parallelizable:** No (depends on P3.1)

**Goal:** Boost confidence when multiple agents agree.

**Deliverables:**
1. Track which agents flag each file/line combination
2. Apply cross-validation rules for confidence adjustment
3. Flag conflicts for deeper validation

**Files:**
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py`
- `apps/backend/prompts/github/pr_parallel_orchestrator.md`

**Success Criteria:**
- [ ] Agent agreement tracked per finding
- [ ] Confidence boosted for multi-agent agreement
- [ ] Conflicts flagged for deeper validation

---

## Phase 4: Integration Testing

**Goal:** Validate the complete system with comprehensive integration tests.
**Plans:** 1 plan in 1 wave

**Research Basis:**
- 04-RESEARCH.md: Scenario-based integration tests, metrics collection, pytest patterns
- Existing patterns: test_github_pr_e2e.py, test_output_validator.py

**Status:** In Progress

Plans:
- [ ] 04-01-PLAN.md - Integration tests for all Phase 1-3 features (Wave 1)

### P4.1: End-to-End Validation

**Effort:** Medium
**Parallelizable:** N/A (final validation)

**Goal:** Test the improved system with comprehensive integration tests.

**Deliverables:**
1. Integration tests for Phase 1 features:
   - Confidence tier routing (HIGH/MEDIUM/LOW)
   - Evidence validation (code syntax required)
   - Scope filtering (file in changed files)
2. Integration tests for Phase 2 features:
   - Path alias import detection
   - Python import detection
   - Reverse dependency detection
3. Integration tests for Phase 3 features:
   - Multi-agent cross-validation
   - Confidence boost capping
4. Metrics collection tests:
   - False positive rate calculation
   - Severity/category distribution

**Files:**
- `tests/test_integration_phase4.py`

**Success Criteria:**
- [ ] All test scenarios pass
- [ ] False positive rate measurable
- [ ] 20+ integration tests covering all features

---

## Execution Schedule

```
Week 1: Phase 1 (Core Validation)
├─ Day 1-2: P1.1 (Bug fixes) + P1.4 (Prompts) - parallel
├─ Day 3-4: P1.2 (Finding-validator integration)
└─ Day 5: P1.3 (Evidence/scope enforcement)

Week 2: Phase 2 (Context Enrichment)
├─ Day 1-2: P2.1 (JS/TS) + P2.2 (Python) - parallel
└─ Day 3-4: P2.3 (Related files)

Week 3: Phase 3 + 4 (Cross-Validation + Testing)
├─ Day 1-2: P3.1 (Confidence scoring)
├─ Day 3: P3.2 (Multi-agent agreement)
└─ Day 4-5: P4.1 (Integration testing)
```

---

## Risk Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| Validation adds latency | Medium | Run validation in parallel with synthesis where possible |
| Over-filtering (false negatives) | High | Track both FP and FN rates, calibrate thresholds |
| Regex complexity in import parsing | Medium | Comprehensive testing, graceful fallback |
| Performance on large PRs | Medium | Limit search depth, optimize hot paths |

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| False positive rate | < 5% | Dismissal rate of initial review findings |
| Review latency | < 30s increase | Time from PR open to review posted |
| Finding accuracy | > 90% | Findings that result in code changes |
| Developer satisfaction | Qualitative | Feedback on review quality |

---

*Roadmap created: 2026-01-19*
*Phase 1 completed: 2026-01-19*
*Phase 2 completed: 2026-01-19*
*Phase 3 completed: 2026-01-19*
