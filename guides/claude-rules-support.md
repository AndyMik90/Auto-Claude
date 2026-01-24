# Auto Claude Rules Support

Auto-Claude can load project-specific rules from `.claude/rules/`, automatically selecting relevant rules based on which files are being modified during a build.

> **Note:** For the official rules format, see [Claude Code's rules documentation](https://docs.anthropic.com/en/docs/claude-code/memory). This guide covers Auto-Claude's integration and extensions.

## When to Use Rules

- You have project-specific coding standards or patterns
- You want security rules enforced automatically during builds
- You need different conventions for different parts of your codebase
- You want to auto-trigger skills (like audits) based on file changes

## Overview

When `USE_CLAUDE_MD=true` is set, Auto-Claude will:

1. Read the project's `.claude/rules/` directory
2. Parse YAML frontmatter from each rule file to extract path patterns
3. Match patterns against files in the implementation plan
4. Inject matched rules into the agent's system prompt

This enables project-specific coding standards, security patterns, and conventions to be automatically enforced during autonomous development.

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_CLAUDE_MD` | `true` (UI) / `false` (env) | Enable CLAUDE.md loading. UI defaults to enabled; env var defaults to disabled. |
| `USE_CLAUDE_RULES` | (inherits from USE_CLAUDE_MD) | Explicitly enable/disable rules loading. When `USE_CLAUDE_MD=true`, rules are enabled unless explicitly set to `false`. |

### Project Setup

Create `.auto-claude/.env` in your project:

```bash
USE_CLAUDE_MD=true
# USE_CLAUDE_RULES is automatically enabled when USE_CLAUDE_MD=true
# To disable rules while keeping CLAUDE.md: USE_CLAUDE_RULES=false
```

## Rule File Format

Rules are markdown files in `.claude/rules/` with YAML frontmatter specifying path patterns:

```markdown
---
paths:
  - src/api/**/*.ts
  - src/api/**/*.tsx
---

# API Security Rules

All API endpoints must follow these patterns:

1. Validate all user input
2. Check authentication and authorization
3. Return consistent error responses
...
```

### Auto-Triggering Skills with `require_skills`

> **Note:** For creating skills, see [Claude Code's official skills documentation](https://docs.anthropic.com/en/docs/claude-code/skills). This section covers Auto-Claude's **extension** that auto-triggers skills during builds.

Auto-Claude extends Claude Code's rules with `require_skills` - allowing rules to automatically invoke skills at specific build phases. This is **not** part of Claude Code's standard rules format.

#### Basic Format

Add `require_skills` to trigger skills when the rule matches:

```markdown
---
paths:
  - src/api/**/*.ts
require_skills:
  - /security-audit
---
```

#### Timing Control with `when`

Control exactly when skills run during the build:

```markdown
---
paths:
  - src/**/*.ts
require_skills:
  - skill: /security-audit
    when: end_of_coding
  - skill: /migration-review
    when: qa_phase
---
```

#### Build Phase Integration

```text
┌─────────────────────────────────────────────────────────────────┐
│                        AUTO-CLAUDE BUILD                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  1. PLANNING PHASE (Planner Agent)                              │
│     └── when: planning                                          │
│         Skills run here to inform the implementation plan       │
│                                                                 │
│  2. CODING PHASE (Coder Agent)                                  │
│     ├── Subtask 1                                               │
│     │   └── when: per_subtask  ← runs after this subtask        │
│     ├── Subtask 2                                               │
│     │   └── when: per_subtask  ← runs after this subtask        │
│     └── All subtasks complete                                   │
│         └── when: end_of_coding  ← runs once here               │
│                                                                 │
│  3. QA PHASE (QA Reviewer Agent)                                │
│     └── when: qa_phase                                          │
│         Skills run during validation                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

#### `when` Options

| Value | Agent | When It Runs |
|-------|-------|--------------|
| `planning` | Planner | Before coding starts, informs implementation plan |
| `per_subtask` | Coder | After each subtask completes (default) |
| `end_of_coding` | Coder | Once, after ALL subtasks complete |
| `qa_phase` | QA Reviewer | During QA validation |

#### `paths` Filter (Optional)

Narrow skill execution to specific patterns within the rule's scope:

```yaml
require_skills:
  - skill: /security-audit
    when: per_subtask
    paths:
      - src/api/**
      - src/server/**
```

If omitted, the skill applies to all files matched by the rule's `paths`.

#### Practical Examples

**Security audit after API changes:**

```yaml
---
paths:
  - src/api/**/*.ts
require_skills:
  - skill: /security-audit
    when: end_of_coding
---
```

**Database migration review:**

```yaml
---
paths:
  - db/migrations/**/*.sql
require_skills:
  - skill: /migration-review
    when: end_of_coding
---
```

**Multiple skills at different phases:**

```yaml
---
paths:
  - src/**/*.ts
require_skills:
  - skill: /lint-check
    when: per_subtask
  - skill: /security-audit
    when: end_of_coding
    paths:
      - src/api/**
  - skill: /performance-review
    when: qa_phase
---
```

### Supported Path Patterns

| Pattern | Matches |
|---------|---------|
| `src/api/**/*.ts` | Any `.ts` file under `src/api/` at any depth |
| `src/components/*.tsx` | `.tsx` files directly in `src/components/` |
| `**/*.test.ts` | Any test file anywhere in the project |
| `db/migrations/*.sql` | SQL files in migrations directory |

## How It Works

### During Planning Phase

When no implementation plan exists yet (planning phase), **all rules are loaded** to give the planner full context about project conventions.

### During Coding Phase

When an implementation plan exists, rules are **selectively loaded** based on `files_to_modify` and `files_to_create` in the plan:

```text
Implementation Plan:
  - files_to_modify: ["src/api/users/handler.ts"]
  - files_to_create: ["src/components/UserModal.tsx"]

Matched Rules:
  - security/api-rules.md (matches src/api/**)
  - frontend/patterns.md (matches src/components/**)
```

### Console Output

When Auto-Claude starts, you'll see which rules were loaded:

```text
Security settings: .claude_settings.json
   - Sandbox enabled (OS-level bash isolation)
   - Filesystem restricted to: /path/to/project
   - Bash commands restricted to allowlist
   - Extended thinking: disabled
   - MCP servers: context7 (documentation)
   - CLAUDE.md: included in system prompt
   - .claude/rules/: 3 rules matched
     • security/api-routes.md
     • security/csrf-protection.md
     • frontend/patterns.md
```

## Example Rules Structure

```text
.claude/rules/
├── core/
│   └── working-principles.md      # General coding principles
├── database/
│   ├── migrations.md              # Migration patterns
│   └── realtime.md                # Realtime subscription patterns
├── frontend/
│   ├── patterns.md                # Component patterns
│   └── permissions.md             # Permission system usage
├── security/
│   ├── api-routes.md              # IDOR, injection prevention
│   ├── csrf-protection.md         # CSRF token handling
│   └── auth-patterns.md           # Authentication flows
└── testing/
    └── playwright.md              # E2E test patterns
```

## Benefits

1. **Automatic Pattern Enforcement** - Security rules, coding standards, and conventions are injected automatically
2. **Context-Aware Loading** - Only relevant rules are loaded based on files being modified
3. **Reduced Token Usage** - Planning phase gets all rules; coding phase gets only matched rules
4. **Consistent Code Quality** - Agents follow project-specific patterns without manual prompting

## Compatibility

- Works with existing Claude Code projects that use `.claude/rules/`
- No changes required to rule file format
- Falls back gracefully if rules directory doesn't exist

## Troubleshooting

### Rules Not Being Applied

1. **Check USE_CLAUDE_MD is set:**

   ```bash
   cat .auto-claude/.env | grep USE_CLAUDE_MD
   # Should show: USE_CLAUDE_MD=true
   ```

2. **Check console output for "rules matched":**

   ```text
   - .claude/rules/: 3 rules matched
   ```

   If you see `0 rules matched`, check your path patterns in frontmatter.

3. **Verify frontmatter format:**

   ```yaml
   ---
   paths:
     - src/api/**/*.ts
   ---
   ```

   The `paths:` key must be a YAML list, not a comma-separated string.

### Rules Loaded But Not Followed

Check `context.json` in the spec folder - it should contain distilled patterns from your rules:

```json
{
  "patterns": {
    "api_route_pattern": "Use withCsrfProtection wrapper...",
    "..."
  }
}
```

If patterns are empty, the rule parsing may have failed silently.

### All Rules Loading Every Time

During planning phase, all rules are intentionally loaded. During coding phase, only matched rules should load. If all rules load during coding, check that:
1. `implementation_plan.json` exists
2. It contains `files_to_modify` and `files_to_create` arrays
3. Your rule path patterns actually match those files

## Related

- [Claude Code Skills Documentation](https://docs.anthropic.com/en/docs/claude-code/skills) - Official skill creation guide
- [Claude Code Rules Documentation](https://docs.anthropic.com/en/docs/claude-code/memory) - Official rules guide
