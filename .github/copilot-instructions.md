# Auto-Claude - Copilot Instructions

## Project Summary

Auto-Claude is a **multi-agent autonomous coding framework** that builds software through coordinated AI agent sessions. It uses the Claude Agent SDK to run agents in isolated workspaces with security controls, enabling spec-driven development with automatic planning, implementation, and QA validation.

**Purpose:** Enable developers to describe features in natural language and have AI agents autonomously design, implement, test, and validate complete features with minimal human intervention.

---

## Tech Stack

- **Backend:** Python 3.12+ (apps/backend/)
- **Frontend:** Electron, React, TypeScript (apps/frontend/)
- **AI SDK:** Claude Agent SDK (`claude-agent-sdk` package)
- **Memory:** Graphiti (graph database with semantic search)
- **CI/CD:** GitHub Actions (workflow automation)
- **AI Review:** CodeRabbit (automatic PR reviews)
- **AI Fixes:** OpenHands (autonomous coding agent)
- **AI Implementation:** GitHub Copilot (code generation)
- **Version Control:** Git worktrees (isolated feature development)
- **Testing:** Pytest (backend), Jest (frontend), Electron MCP (E2E testing)

---

## Architecture Patterns

### Spec-Driven Development Pipeline
```
User Task Description
     │
     ▼
Spec Creation (3-8 phases based on complexity)
     │  ├─ Discovery Agent
     │  ├─ Requirements Agent
     │  ├─ Research Agent (optional)
     │  ├─ Context Agent
     │  ├─ Spec Writer Agent
     │  ├─ Technical Planner Agent
     │  └─ Critic Agent (optional)
     │
     ▼
Implementation (Multi-session build)
     │  ├─ Planner Agent (creates subtask plan)
     │  ├─ Coder Agent (implements subtasks)
     │  ├─ QA Reviewer Agent (validates)
     │  └─ QA Fixer Agent (fixes issues)
     │
     ▼
Review & Merge
     │  ├─ User tests in worktree
     │  ├─ CodeRabbit auto-review
     │  ├─ OpenHands auto-fix (if needed)
     │  └─ Merge to main branch
```

### Automated Issue/PR Workflow
```
Issue Created
     │
     ▼
CodeRabbit Auto-Plan
     │  └─ Creates implementation plan
     │
     ▼
Copilot Auto-Assign
     │  └─ Implements following plan
     │  └─ Timeout: 2-6 hours (adaptive)
     │
     ▼
Copilot Stale? → OpenHands Escalation
     │  └─ Takes over implementation
     │  └─ Creates PR with fixes
     │
     ▼
All Checks Pass? → Auto-Merge
```

### Key Components
1. **spec_runner.py** - Dynamic spec creation pipeline (3-8 phases)
2. **run.py** - Implementation orchestrator (planner → coder → QA)
3. **agent.py** - Base agent with Claude SDK integration
4. **core/client.py** - Claude SDK client factory with security
5. **integrations/graphiti/** - Memory system (knowledge graph)
6. **cli/worktree.py** - Git worktree isolation for safe builds

---

## Coding Guidelines

### Python (Backend)
- **Style:** PEP 8, type hints required (Python 3.10+ syntax)
- **Async:** Use `async`/`await` for I/O operations
- **Error Handling:** Specific exception types, never bare `except:`
- **Imports:** Absolute imports from project root
- **Testing:** Pytest with fixtures, AAA pattern
- **Security:** No hardcoded secrets, use `.env` files

```python
# GOOD - Type hints, specific exceptions, async
from pathlib import Path
from typing import Optional

async def load_spec(spec_dir: Path) -> dict:
    """Load specification from directory."""
    try:
        spec_path = spec_dir / "spec.md"
        async with aiofiles.open(spec_path, 'r') as f:
            content = await f.read()
        return {"content": content}
    except FileNotFoundError as e:
        raise SpecNotFoundError(f"Spec not found: {spec_dir}") from e

# BAD - No types, bare except, blocking I/O
def load_spec(spec_dir):
    try:
        with open(spec_dir + "/spec.md") as f:
            return f.read()
    except:
        return None
```

### TypeScript/React (Frontend)
- **Style:** TypeScript strict mode, ESLint + Prettier
- **Components:** Functional components with hooks
- **State:** React Context for global state
- **i18n:** ALWAYS use translation keys (react-i18next), NEVER hardcoded strings
- **Props:** Explicit interfaces, no implicit `any`
- **Testing:** Jest, React Testing Library

```tsx
// GOOD - Type-safe, i18n, proper hooks
import { useTranslation } from 'react-i18next';

interface TaskCardProps {
  taskId: string;
  onComplete: (id: string) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ taskId, onComplete }) => {
  const { t } = useTranslation(['tasks', 'common']);
  const [loading, setLoading] = useState(false);

  const handleComplete = useCallback(async () => {
    setLoading(true);
    await onComplete(taskId);
    setLoading(false);
  }, [taskId, onComplete]);

  return (
    <div className="task-card">
      <h3>{t('tasks:title.label')}</h3>
      <button onClick={handleComplete}>
        {loading ? t('common:loading') : t('tasks:actions.complete')}
      </button>
    </div>
  );
};

// BAD - No types, hardcoded strings, inline functions
export const TaskCard = ({ taskId, onComplete }) => {
  return (
    <div>
      <h3>Task Title</h3>  {/* ❌ WRONG - hardcoded string */}
      <button onClick={() => onComplete(taskId)}>Complete</button>
    </div>
  );
};
```

### YAML (Workflows)
- **Indentation:** 2 spaces (never tabs)
- **Quotes:** Single quotes for strings unless interpolation needed
- **Naming:** `kebab-case` for workflow files and job names
- **Secrets:** Always use `${{ secrets.SECRET_NAME }}`
- **Permissions:** Principle of least privilege

---

## Project Structure

```
autonomous-coding/
├── apps/
│   ├── backend/                    # Python backend/CLI
│   │   ├── core/                   # Client, auth, security
│   │   │   ├── client.py           # ⚠️ CRITICAL: Claude SDK client factory
│   │   │   ├── security.py         # Command allowlisting
│   │   │   └── auth.py             # OAuth token management
│   │   ├── agents/                 # Agent implementations
│   │   │   ├── planner.py          # Creates implementation plan
│   │   │   ├── coder.py            # Implements subtasks
│   │   │   ├── qa_reviewer.py      # Validates acceptance criteria
│   │   │   └── qa_fixer.py         # Fixes QA-reported issues
│   │   ├── spec_agents/            # Spec creation agents
│   │   │   ├── gatherer.py         # Collects requirements
│   │   │   ├── researcher.py       # Validates integrations
│   │   │   ├── writer.py           # Creates spec.md
│   │   │   └── critic.py           # Self-critique
│   │   ├── integrations/           # External integrations
│   │   │   ├── graphiti/           # Memory system
│   │   │   │   ├── queries_pkg/    # Graph operations
│   │   │   │   └── memory.py       # GraphitiMemory class
│   │   │   ├── linear_updater.py   # Linear integration
│   │   │   └── runners/github/     # GitHub automation
│   │   ├── prompts/                # Agent system prompts
│   │   ├── spec_runner.py          # Spec creation entry point
│   │   ├── run.py                  # Implementation entry point
│   │   └── agent.py                # Base agent class
│   └── frontend/                   # Electron desktop app
│       ├── src/
│       │   ├── main/               # Electron main process
│       │   ├── renderer/           # React components
│       │   └── shared/
│       │       └── i18n/           # Translation files
│       │           ├── locales/en/ # English translations
│       │           └── locales/fr/ # French translations
├── guides/                         # Documentation
├── tests/                          # Test suite
│   ├── test_security.py            # Security tests
│   └── requirements-test.txt       # Test dependencies
├── scripts/                        # Build scripts
├── .github/
│   ├── workflows/                  # GitHub Actions
│   │   ├── master-automation-controller.yml  # Master orchestrator
│   │   ├── unified-ai-automation.yml         # CodeRabbit→Copilot chain
│   │   ├── classify-issue-complexity.yml     # AI complexity classification
│   │   ├── copilot-reprompt-stale.yml       # Adaptive escalation
│   │   └── openhands-fix-issues.yml         # OpenHands integration
│   ├── ISSUE_TEMPLATE/            # Issue templates
│   │   ├── bug_report.yml         # Auto-implement bugs
│   │   └── feature_request.yml    # Auto-implement features
│   └── copilot-instructions.md    # This file (Copilot context)
├── .coderabbit.yaml                # CodeRabbit configuration
└── CLAUDE.md                       # Claude Code instructions
```

---

## AI Integration

### Claude Agent SDK (CRITICAL)

**⚠️ NEVER use `anthropic.Anthropic()` directly - ALWAYS use `create_client()` from `core.client`**

```python
# ✅ CORRECT - Use Claude SDK client factory
from core.client import create_client

client = create_client(
    project_dir=project_dir,
    spec_dir=spec_dir,
    model="claude-sonnet-4-5-20250929",
    agent_type="coder",  # planner, coder, qa_reviewer, qa_fixer
    max_thinking_tokens=None  # or 5000/10000/16000
)

response = client.create_agent_session(
    name="coder-agent-session",
    starting_message="Implement the authentication feature"
)

# ❌ WRONG - Never use Anthropic API directly
from anthropic import Anthropic
client = Anthropic(api_key=os.getenv("ANTHROPIC_API_KEY"))  # DON'T DO THIS
```

**Why use the SDK:**
- Pre-configured security (sandbox, allowlists, hooks)
- Automatic MCP server integration (Context7, Linear, Graphiti, Electron)
- Tool permissions based on agent role
- Session management and recovery

### MCP Server Integration

**Available MCP servers (configured in `core/client.py`):**

| Server | Purpose | When Enabled |
|--------|---------|--------------|
| Context7 | Up-to-date library docs | Always |
| Linear | Project management | If `LINEAR_API_KEY` set |
| Graphiti | Memory/knowledge graph | Always (mandatory) |
| Electron | E2E testing | If `ELECTRON_MCP_ENABLED=true` |
| Puppeteer | Web automation | Always |

**Graphiti Memory (Mandatory):**
```python
from integrations.graphiti.memory import get_graphiti_memory

# Get memory for spec
memory = get_graphiti_memory(spec_dir, project_dir)

# Retrieve context
context = memory.get_context_for_session("Implementing feature X")

# Add insights
memory.add_session_insight("Pattern: use React hooks for state")
```

### CodeRabbit (PR Review)
- **Trigger:** Automatic on every PR
- **Config:** `.coderabbit.yaml`
- **Features:**
  - Aggressive review mode (REQUEST_CHANGES for security issues)
  - Path-specific instructions (TypeScript, Python, tests)
  - Auto-plan for issues

### OpenHands (Auto-Fix)
- **Trigger:** Manual via labels or automatic escalation
- **Model:** DeepSeek R1 (default) or configurable
- **Workflow:** `openhands-fix-issues.yml`
- **Cost:** ~$0.30/1M input tokens

### GitHub Copilot (Code Generation)
- **Trigger:** Auto-assigned when CodeRabbit plan ready
- **Memory:** Learns from `.github/copilot-instructions.md` (this file)
- **Timeout:** Adaptive (simple=1.5h, medium=3h, complex=6h)
- **Escalation:** 3 re-pings before OpenHands takes over

---

## Build & Deploy

### Installation
```bash
# Install all dependencies from root
npm run install:all

# Or separately:
cd apps/backend && uv venv && uv pip install -r requirements.txt
cd apps/frontend && npm install

# Set up OAuth token
claude setup-token
# Add to apps/backend/.env: CLAUDE_CODE_OAUTH_TOKEN=your-token
```

### Running
```bash
# Backend CLI
cd apps/backend
python spec_runner.py --interactive  # Create spec
python run.py --spec 001             # Run build

# Frontend (Electron)
npm start        # Build and run
npm run dev      # Development mode with E2E testing enabled

# Tests
apps/backend/.venv/bin/pytest tests/ -v
```

### GitHub Actions Setup
```bash
# Required repository secrets:
OPENROUTER_API_KEY  # From https://openrouter.ai/keys
PAT_TOKEN           # GitHub PAT with repo permissions
PAT_USERNAME        # Your GitHub username
COPILOT_PAT         # PAT for Copilot assignment (optional)
```

---

## Spec Directory Structure

Each spec in `.auto-claude/specs/XXX-name/` contains:

```
001-user-authentication/
├── spec.md                      # Feature specification
├── requirements.json            # Structured user requirements
├── context.json                 # Discovered codebase context
├── implementation_plan.json     # Subtask-based plan with status
├── qa_report.md                 # QA validation results
├── QA_FIX_REQUEST.md           # Issues to fix (when rejected)
└── graphiti/                    # Memory data
    ├── edges.json
    └── nodes.json
```

---

## Security Model

**Three-layer defense:**

1. **OS Sandbox** - Bash command isolation
2. **Filesystem Permissions** - Operations restricted to project directory
3. **Command Allowlist** - Dynamic allowlist from project analysis

```python
# Allowlist is cached in .auto-claude-security.json
{
  "commands": ["git", "npm", "python", "pytest", "node"],
  "detected_stack": ["python", "node", "react", "electron"],
  "timestamp": "2026-01-01T00:00:00Z"
}
```

**Security best practices:**
- Never commit secrets to repository
- Use `.env` files for local development
- Store production secrets in GitHub repository secrets
- Rotate API keys regularly
- Use fine-grained PATs (not classic tokens)

---

## End-to-End Testing (Electron App)

**When bug fixing or implementing frontend features, QA agents automatically perform E2E testing using Electron MCP.**

### Setup
```bash
# 1. Start Electron app with remote debugging
npm run dev  # Already configured with --remote-debugging-port=9222

# 2. Enable Electron MCP in apps/backend/.env
ELECTRON_MCP_ENABLED=true
ELECTRON_DEBUG_PORT=9222
```

### Available Testing Capabilities

QA agents (`qa_reviewer` and `qa_fixer`) get access to Electron MCP tools:

```python
# Window Management
mcp__electron__get_electron_window_info()
mcp__electron__take_screenshot(filename="test-result.png")

# UI Interaction
mcp__electron__send_command_to_electron(command="click_by_text", args={"text": "Create New Spec"})
mcp__electron__send_command_to_electron(command="fill_input", args={"placeholder": "Task description", "value": "Add login"})
mcp__electron__send_command_to_electron(command="navigate_to_hash", args={"hash": "#settings"})

# Page Inspection
mcp__electron__send_command_to_electron(command="get_page_structure")
mcp__electron__send_command_to_electron(command="verify_form_state", args={"form_selector": "#create-spec-form"})

# Logging
mcp__electron__read_electron_logs()
```

### Example E2E Test Flow
```python
# 1. Take screenshot to see current state
agent.tool("mcp__electron__take_screenshot", filename="before-test.png")

# 2. Inspect page structure
agent.tool("mcp__electron__send_command_to_electron", command="get_page_structure")

# 3. Click button to navigate
agent.tool("mcp__electron__send_command_to_electron",
    command="click_by_text",
    args={"text": "Create New Spec"}
)

# 4. Fill form
agent.tool("mcp__electron__send_command_to_electron",
    command="fill_input",
    args={"placeholder": "Describe your task", "value": "Add user authentication"}
)

# 5. Submit and verify
agent.tool("mcp__electron__send_command_to_electron", command="click_by_text", args={"text": "Submit"})
agent.tool("mcp__electron__take_screenshot", filename="after-submit.png")
```

---

## Branching & Worktree Strategy

**Auto-Claude uses git worktrees for isolated builds. All branches stay LOCAL until user explicitly pushes.**

```
main (user's branch)
└── auto-claude/{spec-name}  ← spec branch (isolated worktree)
```

**Workflow:**
1. Build runs in isolated worktree on spec branch
2. Agent implements subtasks (can spawn subagents for parallel work)
3. User tests feature in `.worktrees/{spec-name}/`
4. User runs `--merge` to add to their project
5. User pushes to remote when ready

**Branch naming:**
- Spec branches: `auto-claude/{spec-name}`
- Feature branches: `feature/description`
- Fix branches: `fix/description`
- OpenHands auto-branches: `openhands-fix-issue-{number}`

---

## Workflow Conventions

### Commit Messages
```bash
# GOOD - Clear, descriptive, follows convention
feat: add user authentication with OAuth
fix: resolve spec creation timeout issue
docs: update installation instructions
test: add E2E tests for settings page

# BAD - Vague, unclear
update stuff
fix
changes
work in progress
```

### PR Labels (Auto-Applied)
- `auto-implement` - Triggers full automation pipeline
- `needs-plan` - CodeRabbit should create plan
- `copilot-assigned` - Copilot is working on it
- `escalated-to-openhands` - OpenHands took over
- `openhands` - Trigger OpenHands to fix the PR/issue
- `auto-merge` - Enable auto-merge when checks pass
- `ai-in-progress` - AI agents are working

---

## Frontend Internationalization (i18n)

**CRITICAL: Always use i18n translation keys for all user-facing text in the frontend.**

**Translation file locations:**
```
apps/frontend/src/shared/i18n/locales/
├── en/                      # English
│   ├── common.json          # Shared labels, buttons
│   ├── navigation.json      # Sidebar navigation
│   ├── settings.json        # Settings page
│   └── tasks.json           # Task/spec content
└── fr/                      # French
    ├── common.json
    ├── navigation.json
    └── ... (same structure)
```

**Usage pattern:**
```tsx
import { useTranslation } from 'react-i18next';

const { t } = useTranslation(['navigation', 'common']);

// ✅ CORRECT - Use translation keys
<span>{t('navigation:items.githubPRs')}</span>
<button>{t('common:actions.save')}</button>

// ❌ WRONG - Hardcoded strings
<span>GitHub PRs</span>
<button>Save</button>
```

**When adding new UI text:**
1. Add the translation key to ALL language files (at minimum: `en/*.json` and `fr/*.json`)
2. Use `namespace:section.key` format
3. Never use hardcoded strings in JSX/TSX files

---

## Common Scenarios

### Scenario 1: Adding a New Spec Agent
```python
# Create new agent in apps/backend/spec_agents/your_agent.py
from agent import Agent
from core.client import create_client

class YourAgent(Agent):
    def __init__(self, spec_dir: Path, project_dir: Path):
        super().__init__(
            name="your-agent",
            spec_dir=spec_dir,
            project_dir=project_dir,
            model="claude-sonnet-4-5-20250929"
        )

    async def run(self) -> dict:
        client = create_client(
            project_dir=self.project_dir,
            spec_dir=self.spec_dir,
            model=self.model,
            agent_type="spec_agent",  # Use appropriate type
            max_thinking_tokens=10000
        )

        response = client.create_agent_session(
            name=f"{self.name}-session",
            starting_message="Your task description"
        )

        return {"status": "success", "output": response}
```

### Scenario 2: Customizing CodeRabbit Reviews
```yaml
# Edit .coderabbit.yaml
reviews:
  profile: "assertive"  # or "chill"
  path_instructions:
    - path: "**/*.ts"
      instructions: |
        MUST check for type safety (no `any` without justification)
        MUST verify proper error handling
        REQUEST_CHANGES for any security vulnerability
```

### Scenario 3: Debugging a Workflow
```bash
# 1. Check workflow logs in GitHub Actions tab

# 2. Enable debug mode (add secrets):
ACTIONS_STEP_DEBUG=true
ACTIONS_RUNNER_DEBUG=true

# 3. Test locally with act:
act pull_request -W .github/workflows/your-workflow.yml
```

---

## Important Patterns

### Always Use Claude SDK Client Factory
```python
# ✅ CORRECT
from core.client import create_client
client = create_client(...)

# ❌ WRONG
from anthropic import Anthropic
client = Anthropic(...)  # DON'T DO THIS
```

### Always Use Type Hints (Python)
```python
# ✅ CORRECT
def load_spec(spec_dir: Path) -> dict:
    ...

# ❌ WRONG
def load_spec(spec_dir):
    ...
```

### Always Use Translation Keys (Frontend)
```tsx
// ✅ CORRECT
{t('common:actions.save')}

// ❌ WRONG
Save
```

### Always Use 2-Space Indentation (YAML)
```yaml
# ✅ CORRECT
jobs:
  test:
    runs-on: ubuntu-latest

# ❌ WRONG
jobs:
    test:
        runs-on: ubuntu-latest
```

---

## What to Avoid

### ❌ Don't Do This
1. **Never use Anthropic API directly** (use Claude SDK client factory)
2. **Never hardcode API keys** in code (use secrets/environment variables)
3. **Never use tabs** in YAML files (use 2 spaces)
4. **Never hardcode strings** in frontend (use i18n translation keys)
5. **Never skip type hints** in Python (always use Python 3.10+ syntax)
6. **Never commit secrets** to the repository
7. **Never use bare `except:`** (use specific exception types)
8. **Never skip E2E testing** for frontend bug fixes

### ✅ Do This Instead
1. **Use `create_client()` from `core.client`** for all AI interactions
2. **Use repository secrets** for all sensitive data
3. **Use 2-space indentation** consistently in YAML
4. **Use `{t('namespace:key')}` pattern** for all user-facing text
5. **Use type hints** for all function signatures
6. **Use environment variables** for configuration
7. **Use specific exception types** with proper error messages
8. **Use Electron MCP** for automated E2E testing

---

## Resources

- [Claude Agent SDK Documentation](https://docs.anthropic.com/agent-sdk)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [CodeRabbit Documentation](https://docs.coderabbit.ai/)
- [OpenHands Documentation](https://docs.all-hands.dev/)
- [Graphiti Memory Documentation](https://github.com/getzep/graphiti)
- [React i18next Documentation](https://react.i18next.com/)

---

## Version History

- **v2.8.0** - Added Copilot Memory integration (this file)
- **v2.7.0** - Added Electron MCP for E2E testing
- **v2.6.0** - Added Graphiti memory integration
- **v2.5.0** - Initial spec-driven development pipeline

---

*Last Updated: 2026-01-01*
