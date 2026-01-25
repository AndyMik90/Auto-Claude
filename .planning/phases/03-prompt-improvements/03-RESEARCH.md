# Phase 3: Prompt Improvements - Research

**Researched:** 2026-01-25
**Domain:** AI prompt engineering for evidence-based code review with reduced false positives
**Confidence:** HIGH

## Summary

Phase 3 updates the 5 PR review prompts to align with the new `VerificationEvidence` schema from Phase 2. The core changes are: (1) adding an "Understand Intent" phase to all 4 specialist prompts so they understand what the PR is trying to accomplish before flagging issues, (2) adding an "Evidence Requirements" section that teaches the schema fields (`verification.code_examined`, `verification.line_range_examined`, `verification.verification_method`, `is_impact_finding`, `checked_for_handling_elsewhere`), and (3) reframing the orchestrator prompt with "What the Diff Is For" to emphasize understanding purpose before delegation.

Research on false positive reduction in AI code review shows that context understanding is the #1 factor - tools that "read diffs without enough project context" produce 60-80% false positive rates. The solution is forcing step-by-step reasoning (Chain of Thought) where the AI first states what it understands about intent, then identifies potential issues, then verifies each with evidence.

**Primary recommendation:** Use a structured "Understand Intent -> Investigate -> Verify with Evidence" workflow in prompts, with explicit instructions that "no significant issues found" is a valid and expected output when the PR is well-implemented.

## Standard Stack

This phase is pure prompt engineering - no new libraries or code changes.

### Components to Modify

| File | Location | Change Type | Requirement |
|------|----------|-------------|-------------|
| `pr_security_agent.md` | `prompts/github/` | Add new section | PROMPT-01 |
| `pr_logic_agent.md` | `prompts/github/` | Add new section | PROMPT-02 |
| `pr_quality_agent.md` | `prompts/github/` | Add new section | PROMPT-03 |
| `pr_codebase_fit_agent.md` | `prompts/github/` | Add new section | PROMPT-04 |
| All 4 specialist prompts | `prompts/github/` | Add Evidence Requirements | PROMPT-05 |
| `pr_parallel_orchestrator.md` | `prompts/github/` | Add reframing section | PROMPT-06 |

### Supporting Components (Reference Only)

| Component | Location | How Used |
|-----------|----------|----------|
| `VerificationEvidence` | `pydantic_models.py:36-75` | Schema that prompts must teach AI to populate |
| `is_impact_finding` | `pydantic_models.py:454-460` | Schema field prompts must teach |
| `checked_for_handling_elsewhere` | `pydantic_models.py:461-467` | Schema field prompts must teach |
| `full_context_analysis.md` | `prompts/github/partials/` | Existing shared partial - will NOT replace, only supplement |

### No New Dependencies

This phase requires **zero new libraries**. All changes are text edits to markdown prompt files.

## Architecture Patterns

### Pattern 1: "Understand Intent" Phase Structure

The specialist prompts currently jump straight to "Security Focus Areas" or "Logic Focus Areas". Research shows that Chain of Thought prompting improves accuracy by forcing step-by-step reasoning. Add an explicit understanding phase:

```markdown
## Phase 1: Understand the PR Intent (BEFORE Looking for Issues)

BEFORE searching for issues, understand what this PR is trying to accomplish:

1. **Read the provided context**
   - What does the PR description say?
   - What files are being changed and why?
   - What is the author's stated goal?

2. **Identify the change type**
   - Bug fix? (fixing broken behavior)
   - New feature? (adding new capability)
   - Refactor? (restructuring without behavior change)
   - Performance? (optimizing existing code)

3. **State your understanding**
   - "This PR [adds/fixes/changes] X by [modifying] Y"
   - "The author wants to [achieve goal] by [approach]"

**Only AFTER understanding intent, proceed to Phase 2 (Issue Investigation).**

This prevents flagging "issues" that are actually intentional design decisions.
```

### Pattern 2: "Evidence Requirements" Section

The new `VerificationEvidence` schema has required fields that prompts must teach AI to populate. Add this section:

```markdown
## Evidence Requirements (MANDATORY)

Every finding you report MUST include a `verification` object with:

### 1. code_examined (REQUIRED)
The **exact code snippet** you examined. Copy-paste from the file:
- DO: `code_examined: "cursor.execute(f'SELECT * FROM users WHERE id={user_id}')"`
- DON'T: `code_examined: "SQL query with user input"`

### 2. line_range_examined (REQUIRED)
The line numbers [start, end] where you found the issue:
- DO: `line_range_examined: [45, 45]`
- DON'T: Guessed or approximate line numbers

### 3. verification_method (REQUIRED)
How you verified the issue. One of:
- `direct_code_inspection` - Found issue directly in the code at the location
- `cross_file_trace` - Traced through imports/calls to find the issue
- `test_verification` - Verified through examination of test code
- `dependency_analysis` - Verified through analyzing dependencies

### Additional Fields

**is_impact_finding** (boolean)
Set to `true` if this finding is about impact on OTHER files (not the changed file).
- Example: "This change breaks callers in `auth.ts`" -> `is_impact_finding: true`

**checked_for_handling_elsewhere** (boolean)
For "missing X" claims (missing error handling, missing validation):
- Set `true` if you verified X is not handled elsewhere
- Set `false` if you didn't check other locations

**If you cannot fill these fields with real data, you don't have a verified finding.**
```

### Pattern 3: "What the Diff Is For" Reframing (Orchestrator)

The orchestrator prompt already has "Phase 0: Understand the PR Holistically" from Phase 1. Add a reframing section that emphasizes the diff's purpose:

```markdown
## The Diff Is The Question, Not The Answer

**Critical mindset shift:** The code changes are what the author is ASKING you to review, not the answer to what's wrong.

### Before Delegation, Answer:
1. **What is this diff trying to accomplish?** (the author's intent)
2. **What could go wrong with this approach?** (potential risks)
3. **What would I need to check to validate this is safe?** (verification targets)

### Specialist Agents Receive:
- Your synthesis of PR intent
- Specific concerns to investigate
- Files to examine beyond the changed files

**Never delegate without understanding.** If you don't know what the PR does, you can't give specialists useful context.
```

### Pattern 4: Valid "No Issues" Output

Research shows AI code reviewers often over-report to appear thorough. Explicitly allow "no issues found":

```markdown
## Valid Outputs

Finding issues is NOT required. If the code is well-implemented, say so:

### Valid: No Significant Issues
```json
{
  "findings": [],
  "summary": "Reviewed [X files]. No [security/logic/quality] issues found. The implementation correctly [describes what it does well]."
}
```

### Invalid: Forced Issues
Do NOT invent issues to have something to report:
- DON'T flag theoretical edge cases without evidence they're reachable
- DON'T suggest "improvements" that aren't addressing actual problems
- DON'T report style preferences as quality issues

**Reporting nothing is better than reporting noise.** False positives erode trust.
```

### Recommended Prompt Structure (After Changes)

```markdown
# [Agent Name] Review Agent

## Your Mission
[Existing - unchanged]

## Phase 1: Understand the PR Intent (BEFORE Looking for Issues)    <-- NEW
[Understanding steps - Chain of Thought]

## CRITICAL: PR Scope and Context
[Existing - unchanged]

## [Focus Areas]
[Existing - unchanged]

## Review Guidelines
[Existing - unchanged]

## Evidence Requirements (MANDATORY)                                 <-- NEW
[Schema field documentation]

## CRITICAL: Full Context Analysis
[Existing - unchanged]

## Valid Outputs                                                     <-- NEW
[No issues is valid section]

## Output Format
[Existing - unchanged]
```

### Anti-Patterns to Avoid

- **Adding redundant instructions:** The "Full Context Analysis" section already exists - don't duplicate it
- **Making prompts too long:** Research shows overlong prompts reduce compliance - keep new sections concise
- **Vague instructions:** "Think carefully" is useless - specific steps work better
- **Missing schema mapping:** Don't describe fields differently than the schema defines them

## Don't Hand-Roll

This phase is pure prompt editing - nothing to build or avoid building.

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Schema documentation | New documentation file | Inline in prompts | AI reads prompts directly |
| Validation logic | Prompt-based validation | Pydantic schema | Schema already enforces fields |
| Shared partial | New partial file | Copy-paste to each file | Sync comments document what to sync |

**Key insight:** Keep prompts self-contained. The AI reads ONE prompt per invocation - shared partials help humans maintain consistency but don't help AI performance.

## Common Pitfalls

### Pitfall 1: Instructions That AI Ignores

**What goes wrong:** Adding "understand intent first" but AI still jumps to flagging issues
**Why it happens:** Instruction not prominent enough, or no verification step
**How to avoid:**
- Make Phase 1 the FIRST section after "Your Mission"
- Add explicit gate: "Only AFTER understanding intent, proceed to Phase 2"
- Add verification: "State your understanding in your output"
**Warning signs:** Findings that misunderstand PR purpose

### Pitfall 2: Schema Field Mismatch

**What goes wrong:** Prompt describes fields differently than schema defines them
**Why it happens:** Copying from research without checking actual schema
**How to avoid:**
- Reference exact field names from `pydantic_models.py`
- Use exact `Literal` values for `verification_method`
- Match description text closely to schema descriptions
**Warning signs:** Validation errors on AI output

### Pitfall 3: Prompt Length Bloat

**What goes wrong:** Adding so much text that AI ignores parts of the prompt
**Why it happens:** Over-documenting every edge case
**How to avoid:**
- Each new section should be <100 lines
- Use examples rather than exhaustive rules
- Prioritize most important instructions at top
**Warning signs:** AI outputs that ignore some instructions

### Pitfall 4: Breaking Existing Behavior

**What goes wrong:** New sections conflict with existing instructions
**Why it happens:** Not reading full existing prompt before modifying
**How to avoid:**
- Read entire existing prompt first
- New sections should supplement, not contradict
- Check "Output Format" section still matches
**Warning signs:** AI output format changes unexpectedly

### Pitfall 5: Inconsistent Across Specialists

**What goes wrong:** Different wording/structure across the 4 specialist prompts
**Why it happens:** Editing each file separately without template
**How to avoid:**
- Create template text first
- Apply consistently to all 4 files
- Only customize focus-area-specific examples
**Warning signs:** Some agents understand intent, others don't

## Code Examples

These are the actual prompt sections to add, verified against the schema.

### "Understand Intent" Phase (For All 4 Specialists)

```markdown
## Phase 1: Understand the PR Intent (BEFORE Looking for Issues)

**MANDATORY** - Before searching for issues, understand what this PR is trying to accomplish.

1. **Read the provided context**
   - PR description: What does the author say this does?
   - Changed files: What areas of code are affected?
   - Commits: How did the PR evolve?

2. **Identify the change type**
   - Bug fix: Correcting broken behavior
   - New feature: Adding new capability
   - Refactor: Restructuring without behavior change
   - Performance: Optimizing existing code
   - Cleanup: Removing dead code or improving organization

3. **State your understanding** (include in your analysis)
   ```
   PR INTENT: This PR [verb] [what] by [how].
   RISK AREAS: [what could go wrong specific to this change type]
   ```

**Only AFTER completing Phase 1, proceed to looking for issues.**

Why this matters: Understanding intent prevents flagging intentional design decisions as bugs.
```

### Evidence Requirements Section (For All 4 Specialists)

```markdown
## Evidence Requirements (MANDATORY)

Every finding you report MUST include a `verification` object with ALL of these fields:

### Required Fields

**code_examined** (string, min 1 character)
The **exact code snippet** you examined. Copy-paste directly from the file:
```
CORRECT: "cursor.execute(f'SELECT * FROM users WHERE id={user_id}')"
WRONG:   "SQL query that uses string interpolation"
```

**line_range_examined** (array of 2 integers)
The exact line numbers [start, end] where the issue exists:
```
CORRECT: [45, 47]
WRONG:   [1, 100]  // Too broad - you didn't examine all 100 lines
```

**verification_method** (one of these exact values)
How you verified the issue:
- `"direct_code_inspection"` - Found the issue directly in the code at the location
- `"cross_file_trace"` - Traced through imports/calls to confirm the issue
- `"test_verification"` - Verified through examination of test code
- `"dependency_analysis"` - Verified through analyzing dependencies

### Conditional Fields

**is_impact_finding** (boolean, default false)
Set to `true` ONLY if this finding is about impact on OTHER files (not the changed file):
```
TRUE:  "This change in utils.ts breaks the caller in auth.ts"
FALSE: "This code in utils.ts has a bug" (issue is in the changed file)
```

**checked_for_handling_elsewhere** (boolean, default false)
For ANY "missing X" claim (missing error handling, missing validation, missing null check):
- Set `true` ONLY if you used Grep/Read tools to verify X is not handled elsewhere
- Set `false` if you didn't search other files

```
TRUE:  "Searched for try/catch patterns in this file and callers - none found"
FALSE: "This function should have error handling" (didn't verify it's missing)
```

### Example Finding with Complete Evidence

```json
{
  "id": "sec-1",
  "file": "src/api/users.ts",
  "line": 45,
  "title": "SQL injection in user lookup",
  "description": "User input directly interpolated into SQL query",
  "category": "security",
  "severity": "critical",
  "verification": {
    "code_examined": "const query = `SELECT * FROM users WHERE id = ${req.params.id}`;",
    "line_range_examined": [45, 45],
    "verification_method": "direct_code_inspection"
  },
  "is_impact_finding": false,
  "checked_for_handling_elsewhere": false,
  "suggested_fix": "Use parameterized query: db.query('SELECT * FROM users WHERE id = ?', [req.params.id])"
}
```

**If you cannot provide real evidence, you do not have a verified finding - do not report it.**
```

### Valid Outputs Section (For All 4 Specialists)

```markdown
## Valid Outputs

Finding issues is NOT the goal. Accurate review is the goal.

### Valid: No Significant Issues Found
If the code is well-implemented, say so:
```json
{
  "findings": [],
  "summary": "Reviewed [files]. No [security/logic/quality/codebase_fit] issues found. The implementation correctly [positive observation about the code]."
}
```

### Valid: Only Low-Severity Suggestions
Minor improvements that don't block merge:
```json
{
  "findings": [
    {"severity": "low", "title": "Consider extracting magic number to constant", ...}
  ],
  "summary": "Code is sound. One minor suggestion for readability."
}
```

### INVALID: Forced Issues
Do NOT report issues just to have something to say:
- Theoretical edge cases without evidence they're reachable
- Style preferences not backed by project conventions
- "Could be improved" without concrete problem
- Pre-existing issues not introduced by this PR

**Reporting nothing is better than reporting noise.** False positives erode trust faster than false negatives.
```

### "What the Diff Is For" Section (Orchestrator Only)

```markdown
## What the Diff Is For

**The diff is the question, not the answer.**

The code changes show what the author is asking you to review. Before delegating to specialists:

### Answer These Questions
1. **What is this diff trying to accomplish?**
   - Read the PR description
   - Look at the file names and change patterns
   - Understand the author's intent

2. **What could go wrong with this approach?**
   - Security: Does it handle user input? Auth? Secrets?
   - Logic: Are there edge cases? State changes? Async issues?
   - Quality: Is it maintainable? Does it follow patterns?
   - Fit: Does it reinvent existing utilities?

3. **What should specialists verify?**
   - Specific concerns, not generic "check for bugs"
   - Files to examine beyond the changed files
   - Questions the diff raises but doesn't answer

### Delegate with Context

When invoking specialists, include:
- Your synthesis of what the PR does
- Specific concerns to investigate
- Related files they should examine

**Never delegate blind.** "Review this code" without context leads to noise. "This PR adds user auth - verify password hashing and session management" leads to signal.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Jump to issue finding | Understand intent first | Chain of Thought research 2022+ | Fewer misunderstood findings |
| Optional evidence | Required evidence schema | Phase 2 (2026-01-25) | Forces verification |
| Keyword-based scope | Schema field (`is_impact_finding`) | Phase 2 (2026-01-25) | Explicit over implicit |
| Always find something | "No issues" is valid | Industry shift 2024+ | Reduces noise |

**Deprecated/outdated:**
- "Flag everything, let humans filter": Creates alert fatigue, 60-80% FP rates
- "More comments = better review": Quality over quantity is key metric
- "Diff-only analysis": Without context, most findings are noise

## Open Questions

### 1. Section Placement

**What we know:** New sections must integrate with existing prompt structure
**What's unclear:** Optimal position for "Evidence Requirements" - before or after "Focus Areas"?
**Recommendation:** After "Review Guidelines" but before "Full Context Analysis" - creates logical flow: guidelines -> evidence -> verification

### 2. Output Format Compatibility

**What we know:** Current output format doesn't show `verification` object in example
**What's unclear:** Should we update the JSON example in "Output Format" section?
**Recommendation:** Yes - add `verification` to the example JSON so AI sees complete expected format

### 3. Specialist-Specific Examples

**What we know:** Each specialist has domain-specific concerns (security vs logic vs quality)
**What's unclear:** Should "Evidence Requirements" examples be domain-specific?
**Recommendation:** Keep Evidence Requirements generic but add one domain-specific example in each specialist's section

## Sources

### Primary (HIGH confidence)

- **Existing codebase** - `pydantic_models.py`, specialist prompts
  - Verified: `VerificationEvidence` class fields and descriptions
  - Verified: `is_impact_finding` and `checked_for_handling_elsewhere` field definitions
  - Verified: Current prompt structure and "Full Context Analysis" partial

- **Phase 2 Research** - `.planning/phases/02-schema-enforcement/02-RESEARCH.md`
  - Schema field definitions that prompts must reference
  - Field descriptions to use in prompt documentation

### Secondary (MEDIUM confidence)

- **[Chain of Thought Prompting](https://www.promptingguide.ai/techniques/cot)** - Wei et al. research
  - Step-by-step reasoning improves accuracy on complex tasks
  - "Let's think step by step" pattern

- **[AI Code Review Noise Framework](https://jetxu-llm.github.io/posts/low-noise-code-review/)** - Jet Xu
  - Three-tier classification (Critical/Important/Noise)
  - Signal Ratio metric: >60% good, >80% great
  - "Fewer, actionable comments are better"

- **[Effective Prompt Engineering for AI Code Reviews](https://graphite.com/guides/effective-prompt-engineering-ai-code-reviews)** - Graphite
  - Be specific and scoped
  - Provide rich context
  - Request actionable feedback

- **[Awesome Reviewers](https://github.com/baz-scm/awesome-reviewers)** - baz-scm
  - Checklist-style instructions work best
  - Patterns distilled from real code review comments

- **[State of AI Code Quality 2025](https://www.qodo.ai/reports/state-of-ai-code-quality/)** - Qodo
  - Context is #1 barrier to AI trust
  - False positive rates 60-80% without proper context

### Tertiary (LOW confidence)

- General prompt engineering guides (principles, not specific implementation)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Pure text edits to existing files
- Architecture: HIGH - Clear structure based on existing patterns
- Pitfalls: MEDIUM - Based on prompt engineering research, not runtime validation

**Research date:** 2026-01-25
**Valid until:** Implementation complete (static prompt analysis)

---

## Implementation Checklist (For Planner Reference)

Based on research, the planner should create tasks for:

### Plan 1: Specialist Prompt Updates (PROMPT-01 through PROMPT-05)

1. **Add "Understand Intent" Phase to all 4 specialists**
   - Add Phase 1 section after "Your Mission"
   - Include 3-step understanding process
   - Add explicit gate before issue investigation
   - Files: `pr_security_agent.md`, `pr_logic_agent.md`, `pr_quality_agent.md`, `pr_codebase_fit_agent.md`

2. **Add "Evidence Requirements" Section to all 4 specialists**
   - Document `verification` object fields
   - Document `is_impact_finding` and `checked_for_handling_elsewhere`
   - Include complete example with all fields
   - Place after "Review Guidelines"

3. **Add "Valid Outputs" Section to all 4 specialists**
   - Explicitly allow "no issues found"
   - Show valid output examples
   - List invalid forced-issue patterns

4. **Update "Output Format" examples**
   - Add `verification` object to JSON example
   - Add `is_impact_finding` and `checked_for_handling_elsewhere` to example

### Plan 2: Orchestrator Prompt Update (PROMPT-06)

1. **Add "What the Diff Is For" section**
   - Add after "Phase 0: Understand the PR Holistically"
   - Include 3 questions to answer before delegation
   - Include guidance on contextual delegation

2. **Update delegation guidance**
   - Emphasize passing context to specialists
   - Ensure Phase 0 synthesis is included in specialist invocations

**Verification:**
- All 4 specialist prompts have "Understand Intent" phase
- All 4 specialist prompts have "Evidence Requirements" section
- Orchestrator prompt has "What the Diff Is For" section
- Output format examples include new schema fields
- "No significant issues" is explicitly allowed as valid output
