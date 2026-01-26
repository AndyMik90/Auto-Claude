# Testing Patterns

**Analysis Date:** 2026-01-19

## Test Framework

**Backend (Python):**
- Runner: pytest (>=7.0.0)
- Config: `tests/pytest.ini`
- Async support: pytest-asyncio (>=0.21.0)
- Coverage: pytest-cov (>=4.0.0)
- Mocking: pytest-mock (>=3.0.0)

**Frontend (TypeScript):**
- Runner: Vitest (v4.0.16)
- Config: `apps/frontend/vitest.config.ts`
- DOM testing: @testing-library/react, @testing-library/dom
- Mocking: Vitest built-in `vi`

**Run Commands:**
```bash
# Backend - all tests
apps/backend/.venv/bin/pytest tests/ -v

# Backend - skip slow tests (recommended for development)
apps/backend/.venv/bin/pytest tests/ -m "not slow" -v

# Backend - single test file
apps/backend/.venv/bin/pytest tests/test_security.py -v

# Backend - specific test
apps/backend/.venv/bin/pytest tests/test_security.py::test_bash_command_validation -v

# Frontend - all tests
cd apps/frontend && npm test

# Frontend - watch mode
cd apps/frontend && npm run test:watch

# Frontend - coverage
cd apps/frontend && npm run test:coverage

# From root (convenience)
npm run test:backend
npm run test (frontend)
```

## Test File Organization

**Backend Location:** Co-located at root `tests/` directory
```
tests/
├── pytest.ini                    # Pytest configuration
├── conftest.py                   # Shared fixtures
├── test_fixtures.py              # Sample data constants
├── review_fixtures.py            # Review system fixtures
├── qa_report_helpers.py          # QA test helpers
├── requirements-test.txt         # Test dependencies
├── test_security.py              # Security module tests
├── test_client.py                # SDK client tests
├── test_qa_loop.py               # QA system tests
└── ...
```

**Frontend Location:** Co-located with source, in `__tests__/` directories
```
apps/frontend/src/
├── __tests__/
│   ├── setup.ts                  # Test setup (mocks, globals)
│   └── integration/              # Integration tests
├── main/__tests__/               # Main process tests
│   ├── parsers.test.ts
│   ├── rate-limit-detector.test.ts
│   └── ...
├── renderer/__tests__/           # Renderer tests
│   ├── task-store.test.ts
│   └── ...
└── renderer/components/__tests__/ # Component tests
```

**Naming:**
- Python: `test_*.py` (e.g., `test_security.py`)
- TypeScript: `*.test.ts` or `*.test.tsx` (e.g., `parsers.test.ts`)

## Test Structure

**Python - pytest Pattern:**
```python
#!/usr/bin/env python3
"""
Tests for Security System
=========================

Tests the security.py module functionality including:
- Command extraction and parsing
- Command allowlist validation
"""

import pytest
from security import validate_command, extract_commands


class TestCommandExtraction:
    """Tests for command extraction from shell strings."""

    def test_simple_command(self):
        """Extracts single command correctly."""
        commands = extract_commands("ls -la")
        assert commands == ["ls"]

    def test_piped_commands(self):
        """Extracts all commands from pipeline."""
        commands = extract_commands("cat file.txt | grep pattern | wc -l")
        assert commands == ["cat", "grep", "wc"]


class TestValidateCommand:
    """Tests for full command validation."""

    def test_base_commands_allowed(self, temp_dir):
        """Base commands are always allowed."""
        for cmd in ["ls", "cat", "grep"]:
            allowed, reason = validate_command(cmd, temp_dir)
            assert allowed is True, f"{cmd} should be allowed"
```

**TypeScript - Vitest Pattern:**
```typescript
/**
 * Phase Parsers Tests
 * ====================
 * Unit tests for the specialized phase parsers.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ExecutionPhaseParser } from '../agent/parsers';

describe('ExecutionPhaseParser', () => {
  const parser = new ExecutionPhaseParser();

  const makeContext = (currentPhase: string): ExecutionParserContext => ({
    currentPhase,
    isTerminal: currentPhase === 'complete'
  });

  describe('structured event parsing', () => {
    it('should parse structured phase events', () => {
      const log = '__EXEC_PHASE__:{"phase":"coding","message":"Starting"}';
      const result = parser.parse(log, makeContext('planning'));

      expect(result).toEqual({
        phase: 'coding',
        message: 'Starting',
        currentSubtask: undefined
      });
    });
  });

  describe('terminal state handling', () => {
    it('should not change phase when current phase is complete', () => {
      const log = 'Starting coder agent...';
      const result = parser.parse(log, makeContext('complete'));

      expect(result).toBeNull();
    });
  });
});
```

## Mocking

**Python - pytest fixtures and unittest.mock:**
```python
from unittest.mock import MagicMock, patch

@pytest.fixture
def mock_task_logger():
    """Mock TaskLogger for testing PhaseExecutor."""
    logger = MagicMock()
    logger.log = MagicMock()
    logger.start_phase = MagicMock()
    logger.end_phase = MagicMock()
    return logger

# Using patch decorator
@patch('core.client.find_claude_cli')
def test_client_creation(mock_find_cli):
    mock_find_cli.return_value = '/usr/local/bin/claude'
    # Test code...

# Using monkeypatch fixture
def test_with_env_var(monkeypatch):
    monkeypatch.setenv("CLAUDE_CLI_PATH", "/custom/path")
    # Test code...
```

**TypeScript - Vitest vi.mock:**
```typescript
// Mock at module level (hoisted)
vi.mock('../claude-profile-manager', () => ({
  getClaudeProfileManager: vi.fn(() => ({
    getActiveProfile: vi.fn(() => ({
      id: 'test-profile-id',
      name: 'Test Profile'
    })),
    recordRateLimitEvent: vi.fn()
  }))
}));

describe('Rate Limit Detector', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should detect rate limit', async () => {
    const { detectRateLimit } = await import('../rate-limit-detector');
    const result = detectRateLimit('Limit reached · resets Dec 17');
    expect(result.isRateLimited).toBe(true);
  });
});
```

**What to Mock:**
- External APIs (Claude SDK, GitHub API)
- File system operations in unit tests
- Network requests
- System time (for time-sensitive tests)
- Heavy dependencies (databases, MCP servers)

**What NOT to Mock:**
- Pure functions under test
- Simple data transformations
- Validation logic

## Fixtures and Factories

**Python Fixtures (conftest.py):**
```python
@pytest.fixture
def temp_dir() -> Generator[Path, None, None]:
    """Create a temporary directory that's cleaned up after the test."""
    temp_path = Path(tempfile.mkdtemp())
    yield temp_path
    shutil.rmtree(temp_path, ignore_errors=True)

@pytest.fixture
def temp_git_repo(temp_dir: Path) -> Generator[Path, None, None]:
    """Create a temporary git repository with initial commit."""
    # Clear git environment variables to isolate from parent repo
    orig_env = {}
    git_vars_to_clear = ["GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE"]
    for key in git_vars_to_clear:
        orig_env[key] = os.environ.get(key)
        if key in os.environ:
            del os.environ[key]

    try:
        subprocess.run(["git", "init"], cwd=temp_dir, capture_output=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=temp_dir)
        # ...
        yield temp_dir
    finally:
        # Restore environment
        for key, value in orig_env.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

@pytest.fixture
def python_project(temp_git_repo: Path) -> Path:
    """Create a sample Python project structure."""
    (temp_git_repo / "pyproject.toml").write_text(toml_content)
    (temp_git_repo / "app" / "__init__.py").write_text("# App module\n")
    return temp_git_repo
```

**TypeScript Setup (setup.ts):**
```typescript
import { vi, beforeEach, afterEach } from 'vitest';

// Mock localStorage for tests
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
    clear: vi.fn(() => { store = {}; })
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

// Mock window.electronAPI for renderer tests
if (typeof window !== 'undefined') {
  (window as any).electronAPI = {
    getTasks: vi.fn(),
    createTask: vi.fn(),
    getSettings: vi.fn(),
    // ...
  };
}

beforeEach(() => {
  localStorageMock.clear();
});

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
});
```

**Sample Data (test_fixtures.py):**
```python
SAMPLE_REACT_COMPONENT = '''import React from 'react';
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  return <div><h1>Hello World</h1></div>;
}
export default App;
'''

SAMPLE_PYTHON_MODULE = '''"""Sample Python module."""
import os
from pathlib import Path

def hello():
    """Say hello."""
    print("Hello")
'''
```

## Coverage

**Requirements:** No enforced minimum threshold, but aim for meaningful coverage

**View Coverage:**
```bash
# Backend
apps/backend/.venv/bin/pytest tests/ --cov=apps/backend --cov-report=html

# Frontend
cd apps/frontend && npm run test:coverage
```

**Coverage Output:**
- Backend: `.coverage` file, HTML report in `htmlcov/`
- Frontend: `coverage/` directory with JSON, text, and HTML reports

## Test Types

**Unit Tests:**
- Test individual functions/classes in isolation
- Mock external dependencies
- Fast execution (sub-second)
- Location: `tests/test_*.py`, `src/**/*.test.ts`

**Integration Tests:**
- Test interactions between components
- May use real file system, git repos
- Slower execution
- Markers: `@pytest.mark.integration` (Python)
- Location: `tests/` (Python), `src/__tests__/integration/` (TypeScript)

**E2E Tests (Frontend):**
- Framework: Playwright (configured but limited use)
- Config: `apps/frontend/e2e/playwright.config.ts`
- Run: `npm run test:e2e`

## Common Patterns

**Async Testing (Python):**
```python
import pytest

@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_operation()
    assert result is not None

# pytest.ini enables asyncio_mode = auto
# No need to manually mark simple async tests
```

**Async Testing (TypeScript):**
```typescript
it('should handle async operation', async () => {
  const { detectRateLimit } = await import('../rate-limit-detector');
  const result = detectRateLimit('some output');
  expect(result.isRateLimited).toBe(false);
});
```

**Error Testing (Python):**
```python
def test_blocked_dangerous_command(self, temp_dir):
    """Dangerous commands not in allowlist are blocked."""
    allowed, reason = validate_command("rm -rf /", temp_dir)
    assert allowed is False
    assert "not allowed for safety" in reason

def test_raises_on_invalid_input():
    """Should raise ValueError on invalid input."""
    with pytest.raises(ValueError, match="Invalid configuration"):
        process_config(None)
```

**Error Testing (TypeScript):**
```typescript
it('should return false for empty output', async () => {
  const { detectRateLimit } = await import('../rate-limit-detector');
  const result = detectRateLimit('');
  expect(result.isRateLimited).toBe(false);
});

it('should handle malformed input gracefully', () => {
  expect(() => parser.parse(null as any)).not.toThrow();
});
```

**Parameterized Tests (Python):**
```python
@pytest.mark.parametrize("cmd,expected", [
    ("ls -la", ["ls"]),
    ("cat file | grep pattern", ["cat", "grep"]),
    ("", []),
])
def test_extract_commands(cmd, expected):
    assert extract_commands(cmd) == expected
```

**Parameterized Tests (TypeScript):**
```typescript
const testCases = [
  'rate limit exceeded',
  'usage limit reached',
  'too many requests'
];

for (const output of testCases) {
  const result = detectRateLimit(output);
  expect(result.isRateLimited).toBe(true);
}
```

## Pre-commit Testing

**Configuration:** `.pre-commit-config.yaml`

Tests run automatically on commit:
- Python: `pytest -m "not slow and not integration"` (fast tests only)
- TypeScript: Biome lint + TypeScript type check

Skipped tests in pre-commit:
- `test_graphiti.py` (external dependencies)
- `test_worktree.py` (git-sensitive)
- `test_workspace.py` (Windows path issues)

## Test Markers (Python)

```python
@pytest.mark.slow       # Long-running tests
@pytest.mark.integration  # Integration tests
@pytest.mark.asyncio    # Async tests (auto-applied via config)
```

**Run specific markers:**
```bash
# Skip slow tests
pytest tests/ -m "not slow"

# Run only integration tests
pytest tests/ -m "integration"
```

---

*Testing analysis: 2026-01-19*
