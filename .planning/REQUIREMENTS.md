# Requirements: PR Review 99% Trust

**Defined:** 2026-01-25
**Core Value:** When the system flags something, it's a real issue.

## v1 Requirements

Requirements for this milestone. Each maps to roadmap phases.

### Holistic PR Understanding

- [ ] **CONTEXT-01**: PR synthesis step before specialists run - orchestrator synthesizes description + files + commits + comments into a PR understanding document
- [ ] **CONTEXT-02**: Related files list passed to orchestrator prompt (50 files already gathered, currently unused)
- [ ] **CONTEXT-03**: Import graph summary passed to orchestrator (what imports what, reverse deps)
- [ ] **CONTEXT-04**: Specialists receive "files to investigate" list (related files, not just changed files)
- [ ] **CONTEXT-05**: Orchestrator prompt includes "Understand the PR holistically BEFORE delegating" instruction

### Validation Pipeline

- [ ] **VAL-01**: Finding-validator runs for ALL initial reviews (not just follow-ups)
- [ ] **VAL-02**: Line number verification catches hallucinated line numbers
- [ ] **VAL-03**: Hypothesis-validation structure in validator prompt

### Schema Enforcement

- [ ] **SCHEMA-01**: VerificationEvidence class with required code_examined, line_range_examined, verification_method fields
- [ ] **SCHEMA-02**: verification field required in BaseFinding
- [ ] **SCHEMA-03**: verification field required in ParallelOrchestratorFinding
- [ ] **SCHEMA-04**: is_impact_finding field replaces keyword-based scope detection
- [ ] **SCHEMA-05**: checked_for_handling_elsewhere field for "missing X" claims

### Prompt Improvements

- [ ] **PROMPT-01**: "Understand Intent" phase added to pr_security_agent.md
- [ ] **PROMPT-02**: "Understand Intent" phase added to pr_logic_agent.md
- [ ] **PROMPT-03**: "Understand Intent" phase added to pr_quality_agent.md
- [ ] **PROMPT-04**: "Understand Intent" phase added to pr_codebase_fit_agent.md
- [ ] **PROMPT-05**: "Evidence Requirements" section added to all specialist prompts
- [ ] **PROMPT-06**: "What the Diff Is For" reframing added to pr_parallel_orchestrator.md

### Code Simplification

- [ ] **REMOVE-01**: _validate_finding_evidence() function removed
- [ ] **REMOVE-02**: Evidence filter call removed (lines 839-845)
- [ ] **REMOVE-03**: _apply_confidence_routing() function removed
- [ ] **REMOVE-04**: VAGUE_PATTERNS and GENERIC_PATTERNS removed from output_validator.py
- [ ] **REMOVE-05**: _is_false_positive() method removed from output_validator.py
- [ ] **REMOVE-06**: _is_finding_in_scope() simplified to use schema field

### Measurement

- [ ] **MEASURE-01**: Run 5 PRs with new system
- [ ] **MEASURE-02**: Calculate false positive rate
- [ ] **MEASURE-03**: Document remaining FP patterns
- [ ] **MEASURE-04**: Iterate on prompts if needed

## v2 Requirements

Deferred to future milestone. Tracked but not in current roadmap.

### Feedback Loop

- **FEEDBACK-01**: Track dismissed findings with reasons
- **FEEDBACK-02**: Learn patterns from dismissals
- **FEEDBACK-03**: Auto-tune thresholds based on data

### Enhanced Verification

- **ENHANCED-01**: Claude structured outputs beta for stricter schema enforcement
- **ENHANCED-02**: LSP integration for semantic code understanding
- **ENHANCED-03**: Dynamic MCP discovery for tool selection

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| LSP integration | Separate milestone - improves token usage, doesn't fix hallucinations |
| Dynamic MCP discovery | Separate milestone - efficiency improvement |
| Recall measurement | Focus on precision first |
| Agent-specific FP rates | Aggregate metrics first |
| Claude structured outputs beta | Added risk, marginal benefit over Pydantic |
| Confidence routing preservation | Binary evidence is cleaner, removes complexity |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONTEXT-01 | Phase 1 | Pending |
| CONTEXT-02 | Phase 1 | Pending |
| CONTEXT-03 | Phase 1 | Pending |
| CONTEXT-04 | Phase 1 | Pending |
| CONTEXT-05 | Phase 1 | Pending |
| SCHEMA-01 | Phase 2 | Pending |
| SCHEMA-02 | Phase 2 | Pending |
| SCHEMA-03 | Phase 2 | Pending |
| SCHEMA-04 | Phase 2 | Pending |
| SCHEMA-05 | Phase 2 | Pending |
| PROMPT-01 | Phase 3 | Pending |
| PROMPT-02 | Phase 3 | Pending |
| PROMPT-03 | Phase 3 | Pending |
| PROMPT-04 | Phase 3 | Pending |
| PROMPT-05 | Phase 3 | Pending |
| PROMPT-06 | Phase 3 | Pending |
| VAL-01 | Phase 4 | Pending |
| VAL-02 | Phase 4 | Pending |
| VAL-03 | Phase 4 | Pending |
| REMOVE-01 | Phase 5 | Pending |
| REMOVE-02 | Phase 5 | Pending |
| REMOVE-03 | Phase 5 | Pending |
| REMOVE-04 | Phase 5 | Pending |
| REMOVE-05 | Phase 5 | Pending |
| REMOVE-06 | Phase 5 | Pending |
| MEASURE-01 | Phase 6 | Pending |
| MEASURE-02 | Phase 6 | Pending |
| MEASURE-03 | Phase 6 | Pending |
| MEASURE-04 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 29 total
- Mapped to phases: 29
- Unmapped: 0

---
*Requirements defined: 2026-01-25*
*Last updated: 2026-01-25 after roadmap creation*
