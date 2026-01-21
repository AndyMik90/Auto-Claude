# Claude Code Rules Support (`.claude/rules/`)

Auto-Claude now supports Claude Code's path-based rules convention, automatically loading project-specific rules based on which files are being modified.

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
| `USE_CLAUDE_MD` | `false` | Enable CLAUDE.md loading (also enables rules by default) |
| `USE_CLAUDE_RULES` | (inherits from USE_CLAUDE_MD) | Explicitly enable/disable rules loading |

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
  - src/app/api/**/*.ts
  - src/app/api/**/*.tsx
---

# API Route Security Rules

All API routes must follow these patterns:

1. Wrap POST/PUT/PATCH/DELETE handlers with `withCsrfProtection`
2. Validate user permissions before database operations
3. Return consistent error responses
...
```

### Requiring Skills

Rules can require specific skills to be run. Add `require_skills` to the frontmatter:

```markdown
---
paths:
  - src/app/api/**/*.ts
require_skills:
  - /security-audit
---
```

#### Structured Format with Timing Control

For more control over when skills run, use the structured format:

```markdown
---
paths:
  - src/**/*.ts
require_skills:
  - skill: /review
    when: end_of_coding
  - skill: /security-audit
    when: per_subtask
    paths:
      - src/app/api/**
---
```

#### `when` Options

| Value | Agent | Description |
|-------|-------|-------------|
| `planning` | Planner | Include in implementation plan as a requirement |
| `per_subtask` | Coder | Run on each matching subtask (default) |
| `end_of_coding` | Coder | Run once after ALL subtasks complete |
| `qa_phase` | QA Reviewer | Run during QA validation |

#### `paths` Filter (Optional)

Narrow skill execution to specific file patterns within the rule's scope:

```yaml
require_skills:
  - skill: /security-audit
    when: per_subtask
    paths:
      - src/app/api/**
      - supabase/functions/**
```

If omitted, the skill applies to all files matched by the rule's `paths`.

### Supported Path Patterns

| Pattern | Matches |
|---------|---------|
| `src/app/api/**/*.ts` | Any `.ts` file under `src/app/api/` at any depth |
| `src/components/*.tsx` | `.tsx` files directly in `src/components/` |
| `**/*.test.ts` | Any test file anywhere in the project |
| `supabase/migrations/*.sql` | SQL files in migrations directory |

## How It Works

### During Planning Phase

When no implementation plan exists yet (planning phase), **all rules are loaded** to give the planner full context about project conventions.

### During Coding Phase

When an implementation plan exists, rules are **selectively loaded** based on `files_to_modify` and `files_to_create` in the plan:

```text
Implementation Plan:
  - files_to_modify: ["src/app/api/films/route.ts"]
  - files_to_create: ["src/components/FilmModal.tsx"]

Matched Rules:
  - security/api-routes.md (matches src/app/api/**)
  - security/csrf-protection.md (matches src/app/api/**)
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
     - src/app/api/**/*.ts
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

- Skills Support - Loading `.claude/skills/` (documentation coming soon)
