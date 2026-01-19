# Phase 3: Cross-Validation - Research

**Researched:** 2026-01-19
**Domain:** Multi-Agent Confidence Scoring and Cross-Validation
**Confidence:** HIGH

## Summary

Phase 3 implements confidence threshold routing (REQ-011) and multi-agent cross-validation (REQ-012). The goal is to enhance the PR review system's accuracy by leveraging information from multiple specialist agents and assigning confidence scores that determine how findings are routed and presented.

The existing infrastructure already includes the data models for this functionality (`AgentAgreement`, `source_agents`, `cross_validated` fields in Pydantic models), but the actual cross-validation logic is not implemented. The orchestrator prompt mentions cross-validation conceptually, but no programmatic rules exist to boost confidence when agents agree or flag conflicts when they disagree.

**Key insight from research:** Simple majority voting accounts for most of the observed gains in multi-agent systems. The primary value of cross-validation is not complex consensus mechanisms, but rather: (1) boosting confidence when multiple agents independently flag the same issue, and (2) detecting conflicts that require human review.

**Primary recommendation:** Implement lightweight cross-validation as a post-processing step in `parallel_orchestrator_reviewer.py` that tracks agent agreement per file+line combination and adjusts confidence before verdict generation.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python dataclasses | Built-in | Data structures for validation results | Already used throughout codebase |
| Pydantic | 2.x | Schema validation, JSON serialization | Already used for structured outputs |
| hashlib | Built-in | Deduplication key generation | Already used for finding IDs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| typing.Literal | Built-in | Type-safe confidence levels | For confidence tier enum |
| collections.defaultdict | Built-in | Grouping findings by location | For cross-validation aggregation |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Simple majority voting | Weighted voting by agent expertise | Added complexity, marginal gain |
| Hardcoded thresholds | ML-calibrated thresholds | Requires historical data, Phase 4+ |
| Per-finding confidence | Per-agent confidence weights | No data to calibrate agent reliability |

**Installation:**
```bash
# No new dependencies - all built-in Python
```

## Architecture Patterns

### Recommended Project Structure
```
apps/backend/runners/github/services/
├── parallel_orchestrator_reviewer.py  # Add cross-validation logic
├── pydantic_models.py                 # Already has AgentAgreement, extend
└── confidence.py                      # DEPRECATED - do not use

apps/backend/prompts/github/
├── pr_parallel_orchestrator.md        # Update synthesis instructions
└── pr_finding_validator.md            # No changes needed
```

### Pattern 1: Post-Processing Cross-Validation
**What:** Apply cross-validation as a post-processing step after all specialist agents complete, before verdict generation.

**When to use:** Always for initial reviews, after finding validation.

**Example:**
```python
# Source: Industry pattern from multi-agent code review research
def cross_validate_findings(findings: list[PRReviewFinding]) -> list[PRReviewFinding]:
    """
    Cross-validate findings by checking agent agreement.

    Rules:
    - Same file + same line + same issue type from 2+ agents = boost to HIGH
    - Conflicting assessments = flag for deeper validation
    - Single-agent finding on high-risk area = require validation
    """
    # Group by location (file, line)
    by_location = defaultdict(list)
    for finding in findings:
        key = (finding.file, finding.line, finding.category.value)
        by_location[key].append(finding)

    validated = []
    for key, group in by_location.items():
        if len(group) >= 2:
            # Multi-agent agreement - boost confidence
            merged = merge_findings(group)
            merged.confidence = min(0.95, merged.confidence + 0.15)
            merged.cross_validated = True
            validated.append(merged)
        else:
            # Single agent - check if high-risk
            finding = group[0]
            if is_high_risk_area(finding):
                finding.validation_required = True
            validated.append(finding)

    return validated
```

### Pattern 2: Confidence Tier Routing
**What:** Route findings through different paths based on confidence tier.

**When to use:** After cross-validation, before final output.

**Example:**
```python
# Source: STACK.md recommendation
class ConfidenceTier:
    HIGH = "high"      # >= 0.8: Include as blocking if severity warrants
    MEDIUM = "medium"  # 0.5-0.8: Include with "potential issue" framing
    LOW = "low"        # < 0.5: Drop or flag for human review

def route_finding(finding: PRReviewFinding) -> ConfidenceTier:
    confidence = finding.confidence or 0.5

    if confidence >= 0.8:
        return ConfidenceTier.HIGH
    elif confidence >= 0.5:
        return ConfidenceTier.MEDIUM
    else:
        return ConfidenceTier.LOW

def apply_confidence_routing(findings: list[PRReviewFinding]) -> list[PRReviewFinding]:
    """Apply confidence-based routing to findings."""
    output = []
    for finding in findings:
        tier = route_finding(finding)

        if tier == ConfidenceTier.HIGH:
            output.append(finding)
        elif tier == ConfidenceTier.MEDIUM:
            # Reframe description
            finding.description = f"[Potential Issue] {finding.description}"
            output.append(finding)
        else:  # LOW
            # Log for monitoring, don't include in output
            logger.info(f"Dropped low-confidence finding: {finding.id}")

    return output
```

### Pattern 3: Finding Deduplication with Agent Tracking
**What:** When merging duplicate findings, preserve which agents flagged it.

**When to use:** During cross-validation when multiple agents report same issue.

**Example:**
```python
# Source: diffray multi-agent code review pattern
def merge_findings(findings: list[PRReviewFinding]) -> PRReviewFinding:
    """
    Merge multiple findings of the same issue.

    Rules:
    1. Keep finding with highest severity
    2. Merge context from all agents
    3. Track which agents flagged it
    """
    # Sort by severity (critical > high > medium > low)
    severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    findings.sort(key=lambda f: severity_order.get(f.severity.value, 4))

    # Base merged finding on highest severity
    merged = findings[0]

    # Track all source agents
    all_agents = set()
    for f in findings:
        if hasattr(f, 'source_agents') and f.source_agents:
            all_agents.update(f.source_agents)

    merged.source_agents = list(all_agents)
    merged.cross_validated = len(all_agents) > 1

    # Combine evidence from all findings
    if any(f.evidence for f in findings):
        all_evidence = [f.evidence for f in findings if f.evidence]
        merged.evidence = "\n---\n".join(all_evidence)

    return merged
```

### Anti-Patterns to Avoid
- **Self-validation echo chamber:** Same agent that found issue validates it. Use separate validation.
- **Complex consensus protocols:** Research shows simple majority voting provides most benefit. Avoid over-engineering.
- **Static thresholds without feedback:** Optimal thresholds vary. Plan for future calibration (Phase 4+).
- **Ignoring agent expertise:** Not all agents are equal for all issue types. Security agent should weight higher for security findings.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Finding deduplication | Custom matching algorithm | Existing `_deduplicate_findings()` method | Already handles file+line+title matching |
| Confidence calculation | Complex ML model | Simple rule-based scoring | No training data available |
| Agent agreement tracking | New data model | Existing `AgentAgreement` Pydantic model | Already defined with `agreed_findings`, `conflicting_findings` |
| Source agent tracking | New field | Existing `source_agents` field in `ParallelOrchestratorFinding` | Already in schema |

**Key insight:** The Pydantic models already have fields for cross-validation (`source_agents`, `cross_validated`, `AgentAgreement`). The gap is implementation in `parallel_orchestrator_reviewer.py`, not schema design.

## Common Pitfalls

### Pitfall 1: Over-Engineering Consensus Mechanisms
**What goes wrong:** Building complex voting, debate, or consensus protocols.
**Why it happens:** Academic research describes sophisticated multi-agent consensus systems.
**How to avoid:** Research shows "simple majority voting accounts for most of the observed gains." Start simple.
**Warning signs:** Implementing more than 2 rounds of agent communication, building debate protocols.

### Pitfall 2: Trusting Confidence Scores Uncalibrated
**What goes wrong:** Setting thresholds (e.g., "80% = HIGH") without validation data.
**Why it happens:** Numbers feel precise, but calibration is missing.
**How to avoid:** Log all decisions, track false positive rates per confidence tier, adjust over time.
**Warning signs:** Hard-coding thresholds without a plan to validate them.

### Pitfall 3: Merging Findings That Are Actually Different
**What goes wrong:** Two agents flag the same line for different reasons (e.g., security vs. quality), merged into one finding.
**Why it happens:** Deduplication based only on file+line, ignoring category.
**How to avoid:** Include `category` in deduplication key: `(file, line, category)`.
**Warning signs:** Security finding merged with quality finding, losing security context.

### Pitfall 4: Dropping All Low-Confidence Findings
**What goes wrong:** Legitimate issues are silently dropped because confidence is low.
**Why it happens:** Strict threshold enforcement without escape hatch.
**How to avoid:** Log dropped findings for monitoring. Consider `needs_human_review` status.
**Warning signs:** Users report "AI didn't catch obvious issue" that appears in logs as dropped.

### Pitfall 5: Not Handling Empty Agent Agreement
**What goes wrong:** When only one agent runs (small PR), cross-validation logic errors.
**Why it happens:** Code assumes multiple agents always report.
**How to avoid:** Handle edge case where `source_agents` has length 1.
**Warning signs:** Errors on small PRs that only invoke one specialist agent.

## Code Examples

Verified patterns from existing codebase and research:

### Existing Deduplication Logic (Reference)
```python
# Source: apps/backend/runners/github/services/parallel_orchestrator_reviewer.py
def _deduplicate_findings(self, findings: list[PRReviewFinding]) -> list[PRReviewFinding]:
    """Remove duplicate findings."""
    seen = set()
    unique = []

    for f in findings:
        key = (f.file, f.line, f.title.lower().strip())
        if key not in seen:
            seen.add(key)
            unique.append(f)

    return unique
```

### Existing AgentAgreement Model (Reference)
```python
# Source: apps/backend/runners/github/services/pydantic_models.py
class AgentAgreement(BaseModel):
    """Tracks agreement between agents on findings."""

    agreed_findings: list[str] = Field(
        default_factory=list,
        description="Finding IDs that multiple agents agreed on",
    )
    conflicting_findings: list[str] = Field(
        default_factory=list,
        description="Finding IDs where agents disagreed",
    )
    resolution_notes: str | None = Field(
        None, description="Notes on how conflicts were resolved"
    )
```

### Existing ParallelOrchestratorFinding Fields (Reference)
```python
# Source: apps/backend/runners/github/services/pydantic_models.py
class ParallelOrchestratorFinding(BaseModel):
    # ... other fields ...
    source_agents: list[str] = Field(
        default_factory=list,
        description="Which agents reported this finding",
    )
    cross_validated: bool = Field(
        False, description="Whether multiple agents agreed on this finding"
    )
```

### Confidence Normalization (Existing)
```python
# Source: apps/backend/runners/github/services/parallel_orchestrator_reviewer.py
def _normalize_confidence(self, value: int | float) -> float:
    """Normalize confidence to 0.0-1.0 range."""
    if value > 1:
        return value / 100.0
    return float(value)
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single confidence score | Evidence-based binary validation | 2024-2025 | Confidence scores deprecated in favor of evidence |
| Complex debate protocols | Simple majority voting | 2025 research | Debate overhead rarely justified |
| Hard-coded thresholds | Feedback-calibrated thresholds | 2025 industry practice | Requires deployment data |
| Per-model confidence | Per-finding confidence | 2025 | Finding-level granularity more useful |

**Deprecated/outdated:**
- `confidence.py`: The existing file is marked deprecated. Do not use confidence scoring from it.
- Numerical confidence without evidence: Industry has moved to evidence-based validation.

## Open Questions

Things that couldn't be fully resolved:

1. **Optimal confidence thresholds**
   - What we know: Research suggests 0.8 for HIGH, 0.5 for MEDIUM cutoffs
   - What's unclear: Whether these thresholds work for this specific codebase
   - Recommendation: Start with research-suggested thresholds, plan calibration in Phase 4

2. **Agent expertise weighting**
   - What we know: Security agent should weight higher for security findings
   - What's unclear: Exact weights for each agent-category combination
   - Recommendation: Start without weighting, add if false positive analysis suggests need

3. **Conflict resolution strategy**
   - What we know: Conflicts should be flagged
   - What's unclear: Should conflicts always go to human, or should orchestrator resolve?
   - Recommendation: Flag for human review initially, refine based on feedback

## Sources

### Primary (HIGH confidence)
- Existing codebase: `parallel_orchestrator_reviewer.py` - Current implementation reference
- Existing codebase: `pydantic_models.py` - Data model reference (`AgentAgreement`, `ParallelOrchestratorFinding`)
- `.planning/research/STACK.md` - Prior research on confidence thresholds and cross-validation
- `.planning/research/ARCHITECTURE.md` - Architecture patterns for validation

### Secondary (MEDIUM confidence)
- [Reaching Agreement Among Reasoning LLM Agents](https://arxiv.org/abs/2512.20184) - Formal consensus protocols
- [Voting or Consensus? Decision-Making in Multi-Agent Systems](https://aclanthology.org/2025.findings-acl.606.pdf) - Voting vs. consensus comparison
- [Qodo State of AI Code Quality 2025](https://www.qodo.ai/reports/state-of-ai-code-quality/) - Industry benchmarks
- [diffray Multi-Agent Code Review](https://diffray.ai/) - Issue deduplication patterns
- [Anthropic Engineering - Demystifying Evals](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) - Confidence calibration

### Tertiary (LOW confidence)
- WebSearch results on "multi-agent agreement voting consensus" - General patterns
- WebSearch results on "automated code review confidence score calibration" - Industry practices

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Uses built-in Python, existing Pydantic models
- Architecture: HIGH - Patterns verified in existing codebase and research
- Pitfalls: HIGH - Documented in prior research and common in multi-agent systems

**Research date:** 2026-01-19
**Valid until:** 30 days (stable patterns, implementation-focused)
