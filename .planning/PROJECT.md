# PR Review System Robustness

## What This Is

Improvements to Auto Claude's PR review system to make it trustworthy enough to replace human review. The system uses specialist agents (security, logic, quality, codebase-fit) with a finding-validator that re-investigates findings before presenting them. This milestone fixes gaps that cause false positives and missed context.

## Core Value

**When the system flags something, it's a real issue.** Trustworthy PR reviews that are faster, more thorough, and more accurate than human review.

## Requirements

### Validated

- ✓ Multi-agent PR review architecture — existing
- ✓ Specialist agents (security, logic, quality, codebase-fit) — existing
- ✓ Finding-validator for follow-up reviews — existing
- ✓ Dismissal tracking with reasons — existing
- ✓ CI status enforcement — existing
- ✓ Context gathering (diff, comments, related files) — existing

### Active

- [ ] **REQ-001**: Finding-validator runs on initial reviews (not just follow-ups)
- [ ] **REQ-002**: Fix line 1288 bug — include ai_reviews in follow-up context
- [ ] **REQ-003**: Fetch formal PR reviews from `/pulls/{pr}/reviews` API
- [ ] **REQ-004**: Add Read/Grep/Glob tool instructions to all specialist prompts
- [ ] **REQ-005**: Expand JS/TS import analysis (path aliases, CommonJS, re-exports)
- [ ] **REQ-006**: Add Python import analysis (currently skipped)
- [ ] **REQ-007**: Increase related files limit from 20 to 50 with prioritization
- [ ] **REQ-008**: Add reverse dependency analysis (what imports changed files)

### Out of Scope

- Real-time review streaming — complexity, not needed for accuracy goal
- Review caching/memoization — premature optimization
- Custom specialist agents — current four dimensions sufficient

## Context

**Problem**: False positives in PR reviews erode trust. Users have to second-guess every finding, defeating the purpose of automated review.

**Root cause**: Finding-validator (which catches false positives) only runs during follow-up reviews. Initial reviews present unvalidated findings. Additionally, context gathering has bugs and gaps that cause the AI to make claims without complete information.

**Existing system**:
- `apps/backend/runners/github/` — PR review orchestration
- `apps/backend/runners/github/services/parallel_orchestrator_reviewer.py` — initial review
- `apps/backend/runners/github/services/parallel_followup_reviewer.py` — follow-up review (has finding-validator)
- `apps/backend/runners/github/context_gatherer.py` — gathers PR context
- `apps/backend/prompts/github/pr_*.md` — specialist agent prompts

**Reference**: Full PRD at `docs/PR_REVIEW_SYSTEM_IMPROVEMENTS.md`

## Constraints

- **Existing architecture**: Work within current multi-agent PR review structure
- **Backward compatibility**: Don't break existing review workflows
- **Performance**: Validation step should not significantly slow reviews (run in parallel where possible)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Add finding-validator to initial reviews | Catches false positives before user sees them | — Pending |
| Same validator for initial and follow-up | Consistency, proven approach from follow-up reviews | — Pending |
| Expand import analysis incrementally | JS/TS first (REQ-005), Python second (REQ-006) | — Pending |

---
*Last updated: 2026-01-19 after initialization*
