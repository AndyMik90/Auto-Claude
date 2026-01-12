# Prompt Template Guide

This guide explains how to use the standardized prompt template (`template.md`) for creating or modernizing Auto-Claude agent prompts.

---

## Overview

The template provides a structured format with:
- **YAML frontmatter** for machine-readable metadata
- **XML sections** for structured, parseable content
- **Standardized patterns** for consistency across agents
- **Tool usage guidance** for Claude Agent SDK integration
- **Quality gates** for validation

---

## Template Structure

### 1. YAML Frontmatter (Lines 1-60)

```yaml
---
version: "2.0.0"
agent_type: "example"
model: "claude-sonnet-4-5"
...
---
```

**Purpose**: Machine-readable configuration for the orchestrator

**Required Fields**:
- `version` - Semantic version (MAJOR.MINOR.PATCH)
- `agent_type` - One of: planner, coder, qa_reviewer, qa_fixer, spec_gatherer, spec_writer
- `model` - Recommended Claude model
- `last_updated` - ISO date (YYYY-MM-DD)
- `session_type` - "single" or "multi"

**Optional Fields**:
- `thinking_budget` - Max thinking tokens (null for unlimited)
- `required_tools` - List of tools that MUST be available
- `optional_tools` - List of nice-to-have tools
- `required_mcp_servers` - MCP servers that MUST be enabled
- `tool_permissions` - What this agent can/cannot do
- `quality_gates` - Which quality checks are required

---

### 2. XML Metadata Section

```xml
<metadata>
  <agent_info>
    <name>Agent Name</name>
    <role>Description</role>
    <scope>Responsibilities</scope>
  </agent_info>
</metadata>
```

**Purpose**: Extended metadata for complex configurations

**When to use**: When YAML frontmatter isn't sufficient for nested data

---

### 3. Purpose Section

```xml
<purpose>
## YOUR ROLE - AGENT NAME

Description of agent's role and responsibilities...
</purpose>
```

**Purpose**: Human-readable agent definition

**Should include**:
- Clear role statement
- Key guiding principle
- Input/output contract
- Why this agent exists
- Success/failure criteria

**Length**: 3-5 paragraphs

---

### 4. Instructions Section

```xml
<instructions>
## EXECUTION WORKFLOW

### PHASE 0: Load Context
...

### PHASE N: Signal Completion
...
</instructions>
```

**Purpose**: Step-by-step execution guide

**Structure**:
- Numbered phases (0-based: PHASE 0, PHASE 1, ...)
- Each phase has: Purpose, Actions, Validation, Output, Common Issues
- Phases should be sequential and clear
- Include bash commands, code examples, checkboxes

**Best practices**:
- Use Title Case for phase names
- Include validation checkpoints
- Document common issues and solutions
- Show expected outputs

---

### 5. Tools Section

```xml
<tools>
## TOOL USAGE GUIDE

### Core File Operations
#### Read Tool
...

### MCP Tools
#### Context7
...
</tools>
```

**Purpose**: Comprehensive tool usage reference

**For each tool, document**:
- When to use
- Usage pattern
- Code examples
- Best practices
- Common mistakes
- Safety rules (for Bash)

**Tool categories**:
- Core file operations (Read, Write, Edit)
- Command execution (Bash)
- Search tools (Grep, Glob)
- MCP tools (Context7, Electron, etc.)

---

### 6. Patterns Section

```xml
<patterns>
## COMMON PATTERNS & ANTI-PATTERNS

### Pattern Library References
- Path Validation → .claude/patterns/path-validation.md
...

### Agent-Specific Patterns
[Pattern examples specific to this agent]
</patterns>
```

**Purpose**: Reference common patterns and show anti-patterns

**Structure**:
- References to shared pattern library (`.claude/patterns/`)
- Agent-specific patterns (unique to this agent)
- Code examples (good vs bad)
- Explanations of why patterns work

**When to reference vs embed**:
- **Reference**: Common patterns used by multiple agents
- **Embed**: Agent-specific patterns used only here

---

### 7. Examples Section

```xml
<examples>
## WORKED EXAMPLES

### Example 1: Scenario Name
...
</examples>
```

**Purpose**: Complete walkthroughs of agent execution

**Each example should include**:
- Context (what situation)
- Input state (files, conditions)
- Execution (commands run, phase by phase)
- Final output (files created, state changes)
- Verification (how to check success)

**Number of examples**: 1-3 complete examples covering common scenarios

---

### 8. Quality Gates Section

```xml
<quality_gates>
## QUALITY GATES & VALIDATION

### Pre-Completion Checklist
...

### Self-Critique
...

### Verification
...
</quality_gates>
```

**Purpose**: Define validation requirements

**Should include**:
- Pre-completion checklist (what to verify before ending)
- Self-critique checklist (if quality_gates.self_critique = true)
- Verification steps (if quality_gates.verification = true)
- Pass/fail criteria
- What to do if checks fail

---

### 9. Critical Reminders Section

```xml
<critical_reminders>
## CRITICAL RULES

### File Operations
...

### Git Operations
...
</critical_reminders>
```

**Purpose**: Non-negotiable rules that MUST be followed

**Categories**:
- File operations (read before modify, correct tool usage)
- Git operations (never modify config, never push, exclude spec files)
- Path safety (monorepo-specific)
- Quality standards (fix bugs now, self-critique, verify)
- Scope discipline (stay in bounds)

**Format**: Use ✅ for allowed, ❌ for forbidden

---

### 10. Error Recovery Section

```xml
<error_recovery>
## ERROR RECOVERY

### File Creation Failed
**Symptom**: ...
**Diagnosis**: ...
**Fix**: ...
</error_recovery>
```

**Purpose**: Solutions for common errors

**Each error should have**:
- Symptom (what you see)
- Diagnosis (how to check)
- Fix (step-by-step solution)

**Common errors to cover**:
- File creation failed
- Git commit blocked (secrets)
- Path not found (monorepo)
- Verification failed
- Invalid JSON

---

### 11. Completion Section

```xml
<completion>
## SESSION COMPLETION

### Pre-Completion Verification
...

### Completion Signal
...

### If Session Must End Early
...
</completion>
```

**Purpose**: How to properly end the session

**Should include**:
- Pre-completion checklist
- Completion signal format
- Early termination handling (if context fills up)
- What to document

---

## How to Create a New Prompt

### Step 1: Copy Template

```bash
cp apps/backend/prompts/template.md apps/backend/prompts/my_new_agent.md
```

### Step 2: Update Frontmatter

```yaml
---
version: "2.0.0"
agent_type: "my_new_agent"
model: "claude-sonnet-4-5"
last_updated: "2026-01-12"
session_type: "multi"  # or "single"

thinking_budget: 10000  # or null

required_tools:
  - Read
  - Write
  # Add tools this agent NEEDS

tool_permissions:
  can_modify_files: true
  can_commit: true
  # Set permissions
---
```

### Step 3: Fill in <purpose>

```xml
<purpose>
## YOUR ROLE - MY NEW AGENT

You are the **My New Agent** in an autonomous development process. Your job is to [clear description].

**Key Principle**: [Guiding principle]

**Input**: [Files received]
**Output**: [Files produced]

### Why This Agent Exists
[Explanation of problem solved]

### Success Criteria
- ✅ [Criterion 1]
</purpose>
```

### Step 4: Define Phases in <instructions>

```xml
<instructions>
## EXECUTION WORKFLOW

### PHASE 0: Load Context (Mandatory)
**Purpose**: ...
**Actions**:
```bash
# Commands
```
**Validation**:
- [ ] Checkpoint

### PHASE 1: [Your Phase]
...
</instructions>
```

### Step 5: Document Tools in <tools>

Only document tools this agent uses. Reference common tools, explain agent-specific usage.

### Step 6: Reference Patterns in <patterns>

```xml
<patterns>
## COMMON PATTERNS & ANTI-PATTERNS

### Pattern Library References
- Path Validation → .claude/patterns/path-validation.md
- Git Commit → .claude/patterns/git-commit.md

### Agent-Specific Patterns
[Your patterns]
</patterns>
```

### Step 7: Add Examples in <examples>

Provide 1-3 complete walkthroughs.

### Step 8: Define Quality Gates in <quality_gates>

Set appropriate checkboxes based on frontmatter `quality_gates`.

### Step 9: Document Critical Rules in <critical_reminders>

Include agent-specific critical rules.

### Step 10: Add Error Recovery in <error_recovery>

Document common errors specific to this agent.

### Step 11: Define Completion in <completion>

Standard completion signal format.

---

## How to Modernize an Existing Prompt

### Step 1: Read Current Prompt

```bash
cat apps/backend/prompts/existing_agent.md
```

### Step 2: Extract Metadata

Identify:
- Agent type
- Session type (single or multi)
- Required tools
- Permissions

### Step 3: Create Frontmatter

```yaml
---
version: "2.0.0"
agent_type: "[from filename]"
model: "claude-sonnet-4-5"
last_updated: "2026-01-12"
session_type: "[single or multi]"

required_tools:
  [Extract from current prompt - look for tool usage]

tool_permissions:
  [Extract from current prompt - look for warnings]
---
```

### Step 4: Wrap Sections in XML

Find sections in current prompt:
- Role definition → `<purpose>`
- Step-by-step instructions → `<instructions>`
- Tool usage (scattered) → `<tools>`
- Examples → `<examples>`
- Reminders → `<critical_reminders>`

### Step 5: Standardize Phase Structure

Convert to:
```
### PHASE 0: Load Context
### PHASE 1: [Name]
### PHASE 2: [Name]
### PHASE N: Signal Completion
```

### Step 6: Extract Patterns

Move duplicate content to `.claude/patterns/`, reference it:
```xml
<pattern ref=".claude/patterns/path-validation.md" />
```

### Step 7: Consolidate Tools

Gather all tool usage guidance into `<tools>` section.

### Step 8: Add Quality Gates

Based on current prompt's verification steps.

### Step 9: Extract Templates

Move embedded templates (like spec.md, qa_report.md) to `templates/`, reference them:
```xml
<template ref="templates/spec.template.md" />
```

### Step 10: Validate

Check:
- [ ] Frontmatter valid YAML
- [ ] All XML sections closed
- [ ] Phases numbered correctly (0-based)
- [ ] Tools documented
- [ ] Examples present
- [ ] Quality gates defined

---

## XML Section Schema

### Valid XML Tags

```xml
<metadata>           <!-- Extended metadata -->
<purpose>            <!-- Agent role and scope -->
<instructions>       <!-- Execution workflow -->
<tools>              <!-- Tool usage guide -->
<patterns>           <!-- Common patterns -->
<examples>           <!-- Worked examples -->
<quality_gates>      <!-- Validation requirements -->
<critical_reminders> <!-- Non-negotiable rules -->
<error_recovery>     <!-- Error solutions -->
<completion>         <!-- Session end protocol -->
```

### XML Best Practices

1. **Always close tags**: `<section>...</section>`
2. **Use markdown inside XML**: XML is for structure, markdown for content
3. **Don't nest unnecessarily**: Keep flat when possible
4. **Use attributes sparingly**: Prefer YAML frontmatter for config

---

## Validation Checklist

Use this checklist when creating or modernizing prompts:

### Structure
- [ ] YAML frontmatter present and valid
- [ ] All required frontmatter fields filled
- [ ] All XML sections closed properly
- [ ] Phases numbered 0-based consistently
- [ ] Sections in correct order

### Content
- [ ] Purpose clearly states agent role
- [ ] Instructions have clear phases with validation
- [ ] Tools section documents all used tools
- [ ] Patterns reference shared library when applicable
- [ ] Examples provide complete walkthroughs
- [ ] Quality gates match frontmatter config
- [ ] Critical reminders include safety rules
- [ ] Error recovery covers common issues
- [ ] Completion signal defined

### Quality
- [ ] No duplicate content (use pattern references)
- [ ] Consistent terminology (Phase, not Step)
- [ ] Code examples are correct and tested
- [ ] Bash commands have safety checks
- [ ] Git operations follow safety rules

### Machine-Parseability
- [ ] Frontmatter can be parsed by YAML parser
- [ ] XML structure is valid
- [ ] Version follows semver (X.Y.Z)
- [ ] Tool lists use correct tool names

---

## Pattern Library Structure

Shared patterns should go in `.claude/patterns/`:

```
.claude/patterns/
├── path-validation.md          # Monorepo path confusion prevention
├── git-commit.md                # Commit safety, message templates
├── secret-scanning.md           # Handling secret detection
├── self-critique.md             # Quality gate checklist
├── context-loading.md           # Standard file reading
└── error-recovery.md            # Common errors across agents
```

Each pattern file should follow this structure:

```markdown
# Pattern Name

## When to Use
[Description of when this pattern applies]

## The Problem
[What issue this solves]

## The Solution
[Step-by-step pattern]

## Example
\`\`\`[language]
[code example]
\`\`\`

## Why It Works
[Explanation]

## Anti-Pattern (DON'T)
\`\`\`[language]
[bad example]
\`\`\`

## Why It Fails
[Explanation of why anti-pattern is bad]
```

---

## Template Library Structure

Extracted templates should go in `apps/backend/prompts/templates/`:

```
apps/backend/prompts/templates/
├── implementation_plan.schema.json  # Plan structure
├── spec.template.md                  # Spec document
├── qa_report.template.md             # QA report
└── requirements.schema.json          # Requirements structure
```

Reference templates in prompts:
```xml
<template ref="templates/spec.template.md" />
```

---

## Version Management

### Semantic Versioning

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes (structure change, removed sections)
MINOR: New features (new sections, new tools)
PATCH: Bug fixes, clarifications, typo fixes
```

**Examples**:
- `2.0.0` → New template structure with XML
- `2.1.0` → Added new `<patterns>` section
- `2.1.1` → Fixed typo in example

### When to Bump Version

- **MAJOR**: Template structure changes, XML schema changes
- **MINOR**: New required sections, new frontmatter fields
- **PATCH**: Fixes, clarifications, improved examples

### Changelog

Update changelog at bottom of template:

```markdown
<!--
TEMPLATE VERSION: 2.1.1
LAST UPDATED: 2026-01-12
CHANGELOG:
- 2.1.1 (2026-01-12): Fixed example in <tools> section
- 2.1.0 (2026-01-12): Added <patterns> section
- 2.0.0 (2026-01-12): Initial template with XML structure
-->
```

---

## FAQ

### Q: Why XML instead of all YAML?

**A**: YAML is great for flat config, but prompt content is hierarchical and needs markdown formatting. XML provides:
- Clear section boundaries
- Machine-parseability
- Markdown compatibility
- Easy extraction/composition

### Q: Why frontmatter AND <metadata>?

**A**: Frontmatter for simple config (strings, numbers, lists), XML metadata for complex nested data.

### Q: Can I skip sections?

**A**: No. All sections must be present. If not applicable, use:
```xml
<section>
Not applicable for this agent.
</section>
```

### Q: How do I reference another prompt?

**A**: In `<patterns>` section:
```xml
<pattern ref="../other_agent.md#specific-section" />
```

### Q: Should examples be real or synthetic?

**A**: Real examples from actual runs are best. Sanitize sensitive data.

### Q: How long should each section be?

**A**:
- `<purpose>`: 3-5 paragraphs
- `<instructions>`: As many phases as needed (5-15 typical)
- `<tools>`: Document all tools used (10-30 tools typical)
- `<examples>`: 1-3 complete examples
- Other sections: As needed

---

## Support

**Issues with template**: Open issue with `[template]` prefix
**Questions**: See `/Users/jeff/Dev_Projects/Auto-claude/apps/backend/prompts/template.md`
**Pattern library**: See `.claude/patterns/`

---

**Template Version**: 2.0.0
**Last Updated**: 2026-01-12
