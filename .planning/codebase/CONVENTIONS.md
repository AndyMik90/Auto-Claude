# Coding Conventions

**Analysis Date:** 2026-01-19

## Naming Patterns

**Files:**
- Python: `snake_case.py` (e.g., `project_analyzer.py`, `qa_report.py`)
- TypeScript: `kebab-case.ts` or `PascalCase.tsx` for React components
- Test files: `test_*.py` (Python), `*.test.ts` (TypeScript)
- Config files: lowercase with extension (e.g., `ruff.toml`, `tsconfig.json`)

**Functions:**
- Python: `snake_case` (e.g., `validate_command()`, `get_security_profile()`)
- TypeScript: `camelCase` (e.g., `detectRateLimit()`, `parsePhaseEvent()`)

**Variables:**
- Python: `snake_case` for locals, `UPPER_SNAKE_CASE` for constants
- TypeScript: `camelCase` for locals, `UPPER_SNAKE_CASE` for constants

**Classes/Types:**
- Python: `PascalCase` (e.g., `SecurityProfile`, `ClaudeSDKClient`)
- TypeScript: `PascalCase` for types/interfaces (e.g., `ExecutionParserContext`)

**Constants:**
- Module-level: `UPPER_SNAKE_CASE` (e.g., `DEFAULT_UTILITY_MODEL`, `SAFE_COMMANDS`)
- Private cache variables: `_UPPER_SNAKE_CASE` (e.g., `_PROJECT_INDEX_CACHE`)

## Code Style

**Formatting - Python (Backend):**
- Tool: Ruff (v0.14.10 via pre-commit)
- Quote style: Double quotes
- Indent style: Spaces (4 spaces per PEP 8)
- Line endings: Auto
- Key rules enabled:
  - `E`, `W` (pycodestyle)
  - `F` (Pyflakes)
  - `I` (isort)
  - `B` (flake8-bugbear)
  - `C4` (flake8-comprehensions)
  - `UP` (pyupgrade)

**Formatting - TypeScript (Frontend):**
- Tool: Biome (v2.3.11)
- Commands:
  ```bash
  cd apps/frontend && npx biome check --write .  # Lint + format
  ```
- TypeScript compiler: `tsc --noEmit` for type checking
- Strict mode enabled in `tsconfig.json`

**Linting:**
- Python: Ruff handles both linting and formatting
- TypeScript: Biome handles both (replaced ESLint for 15-25x faster performance)

## Import Organization

**Python Order (enforced by isort via Ruff):**
1. Standard library imports (`import os`, `import json`)
2. Third-party imports (`from claude_agent_sdk import ...`)
3. Local imports (`from core.client import create_client`)

**TypeScript Order:**
1. React/external library imports
2. Local component imports
3. Type imports

**Path Aliases (TypeScript):**
```typescript
// tsconfig.json paths
"@/*": ["src/renderer/*"]
"@shared/*": ["src/shared/*"]
"@preload/*": ["src/preload/*"]
"@features/*": ["src/renderer/features/*"]
"@components/*": ["src/renderer/shared/components/*"]
"@hooks/*": ["src/renderer/shared/hooks/*"]
"@lib/*": ["src/renderer/shared/lib/*"]
```

## Error Handling

**Python Patterns:**
```python
# Try-except with specific exceptions
try:
    result = subprocess.run(cmd, capture_output=True, timeout=5)
except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
    logger.debug(f"Operation failed: {e}")
    return None

# Validation with early return
def validate_something(value: str) -> tuple[bool, str]:
    if not value:
        return False, "Value is required"
    if invalid_condition:
        return False, "Value is invalid because..."
    return True, ""
```

**TypeScript Patterns:**
```typescript
// Result object pattern for detection functions
interface DetectionResult {
  isDetected: boolean;
  message?: string;
  details?: Record<string, unknown>;
}

function detectSomething(input: string): DetectionResult {
  if (!input) {
    return { isDetected: false };
  }
  // Detection logic...
  return { isDetected: true, message: "Detected condition X" };
}
```

## Logging

**Python Framework:** Standard library `logging`

**Patterns:**
```python
import logging

logger = logging.getLogger(__name__)

# Debug for verbose/diagnostic info
logger.debug(f"Cache HIT for {key}")

# Info for significant operations
logger.info(f"Found Claude CLI: {path} (v{version})")

# Warning for recoverable issues
logger.warning(f"Invalid configuration: {value}, using default")

# Error with context
logger.error(f"Failed to process {file}: {error}")
```

**TypeScript Logging:** Console-based in development, suppressed in tests.

## Comments

**When to Comment:**
- Public functions: Always document with docstrings/JSDoc
- Complex algorithms: Explain the "why" not the "what"
- Security-related code: Explain security implications
- Workarounds: Reference issue numbers

**Python Docstrings:**
```python
def create_client(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    agent_type: str = "coder",
) -> ClaudeSDKClient:
    """
    Create a Claude Agent SDK client with multi-layered security.

    Uses AGENT_CONFIGS for phase-aware tool and MCP server configuration.

    Args:
        project_dir: Root directory for the project (working directory)
        spec_dir: Directory containing the spec (for settings file)
        model: Claude model to use
        agent_type: Agent type identifier from AGENT_CONFIGS

    Returns:
        Configured ClaudeSDKClient

    Raises:
        ValueError: If agent_type is not found in AGENT_CONFIGS
    """
```

**TypeScript JSDoc:**
```typescript
/**
 * Detect rate limit from CLI output.
 *
 * @param output - Raw CLI output string
 * @returns Detection result with isRateLimited flag and optional resetTime
 */
function detectRateLimit(output: string): RateLimitResult {
  // ...
}
```

## Function Design

**Size:** Keep functions focused on a single responsibility. Functions over 50 lines should be considered for splitting.

**Parameters:**
- Python: Use type hints for all parameters
- TypeScript: Use explicit types, avoid `any`
- Default values for optional parameters
- Keyword arguments for functions with 3+ parameters

**Return Values:**
- Python: Use tuple for multiple returns `-> tuple[bool, str]`
- TypeScript: Use result objects for complex returns
- Always annotate return types

## Module Design

**Python Exports:**
- Use `__all__` in `__init__.py` to control public API
- Prefix internal functions/classes with underscore

**TypeScript Barrel Files:**
```typescript
// index.ts barrel export pattern
export { ExecutionPhaseParser } from './execution-phase-parser';
export { IdeationPhaseParser } from './ideation-phase-parser';
export type { ExecutionParserContext } from './types';
```

## Security Conventions

**Validation First:**
```python
# Always validate input before processing
def _validate_custom_mcp_server(server: dict) -> bool:
    """Validate a custom MCP server configuration for security."""
    if not isinstance(server, dict):
        return False

    # Required fields
    required_fields = {"id", "name", "type"}
    if not all(field in server for field in required_fields):
        return False

    # Blocklist dangerous commands
    DANGEROUS_COMMANDS = {"bash", "sh", "cmd", "powershell"}
    if command in DANGEROUS_COMMANDS:
        logger.warning(f"Rejected dangerous command: {command}")
        return False

    return True
```

**Sensitive Commands:** Always use allowlist approach, never blocklist alone.

## Internationalization (Frontend)

**Always use i18n for user-facing text:**
```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['navigation', 'common']);

// Correct
<span>{t('navigation:items.githubPRs')}</span>

// Wrong - hardcoded string
<span>GitHub PRs</span>
```

**Translation file structure:**
- `apps/frontend/src/shared/i18n/locales/en/*.json`
- `apps/frontend/src/shared/i18n/locales/fr/*.json`

## Platform-Specific Code

**Use platform abstraction module:**
```typescript
// Correct - use abstraction
import { isWindows, getPathDelimiter } from './platform';

// Wrong - direct check
if (process.platform === 'win32') { ... }
```

**Platform modules:**
- Frontend: `apps/frontend/src/main/platform/`
- Backend: `apps/backend/core/platform/`

---

*Convention analysis: 2026-01-19*
