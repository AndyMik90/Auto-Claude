# Auto-Claude Repository Schema Documentation
**AI-Readable Architecture Guide**

> **Generated:** 2026-01-01
> **Version:** Based on commit 7210610 (develop branch)
> **Purpose:** Complete architectural reference for AI agents working with Auto-Claude

---

## Repository Lineage

```
Original: AndyMik90/Auto-Claude
    ↓ (forked)
Fork: joelfuller2016/Auto-Claude
    ↓ (upstream tracking maintained)
Current Status: ✅ Synced with upstream/develop
```

### Remote Configuration
```bash
origin    → https://github.com/joelfuller2016/Auto-Claude.git
upstream  → https://github.com/AndyMik90/Auto-Claude.git
```

### Branch Strategy
- **main** - Production releases
- **develop** - Active development (default)
- **fix/* - Bug fix branches
- **feat/* - Feature branches

---

## Project Structure Overview

```
Auto-Claude/
├── .auto-claude/          # Auto-Claude specific runtime artifacts
├── .github/               # GitHub configuration and workflows
├── apps/                  # Main application code
│   ├── backend/          # Python backend (agents, runners, prompts)
│   └── frontend/         # TypeScript Electron frontend
├── guides/               # User documentation
├── scripts/              # Automation scripts
├── shared_docs/          # Shared documentation
└── tests/                # Test suite
```

---

## Core Components

### 1. Backend Architecture (`apps/backend/`)

```
apps/backend/
├── agents/               # Agent implementations
│   └── tools_pkg/       # Agent tool definitions
├── prompts/             # 25+ LLM prompt templates (CRITICAL)
│   ├── coder.md         # Coding agent prompt
│   ├── planner.md       # Planning agent prompt
│   ├── qa_reviewer.md   # QA agent prompt
│   ├── spec_writer.md   # Spec writer agent prompt
│   └── [21 more prompts]
├── runners/             # Task execution runners
│   ├── github/          # GitHub integration runner
│   └── spec_runner.py   # Specification execution
├── core/                # Core functionality
├── context/             # Context management
├── ideation/            # Ideation features
├── implementation_plan/ # Implementation planning
├── integrations/        # External integrations
├── memory/              # Memory management
├── merge/               # Code merging logic
├── planner_lib/         # Planning library
├── prediction/          # Prediction features
├── project/             # Project management
├── prompts_pkg/         # Prompt utilities
├── qa/                  # Quality assurance
├── review/              # Code review logic
├── security/            # Security features
├── services/            # Backend services
├── spec/                # Specification handling
├── task_logger/         # Task logging
└── ui/                  # UI backend support
```

#### Key Backend Files
- **`.env.example`** - Environment variable template
- **`requirements.txt`** - Python dependencies

### 2. Frontend Architecture (`apps/frontend/`)

```
apps/frontend/
├── src/
│   ├── main/           # Electron main process
│   │   ├── agent/      # Agent management (manager, process, queue)
│   │   └── ipc-handlers/ # IPC handlers (github, task, terminal, worktree)
│   ├── preload/        # Electron preload scripts
│   │   └── api/        # API modules (github, task, terminal)
│   ├── renderer/       # React renderer process
│   │   ├── components/ # React components
│   │   │   ├── github-prs/       # PR management UI
│   │   │   ├── task-detail/      # Task detail views
│   │   │   └── [UI components]
│   │   └── lib/        # Frontend libraries
│   └── shared/         # Shared code
│       ├── constants/  # Constants (ipc.ts)
│       ├── i18n/       # Internationalization (en, fr)
│       └── types/      # TypeScript types
├── e2e/                # End-to-end tests
├── resources/          # Application resources
└── scripts/            # Build/deploy scripts
```

#### Key Frontend Files
- **`package.json`** - Dependencies and scripts
- **`package-lock.json`** - Dependency lock file

---

## Prompt Template System

**Location:** `apps/backend/prompts/`
**Count:** 25+ markdown templates
**Purpose:** Define behavior for autonomous agent pipeline

### Prompt Categories

#### 1. **Core Agent Prompts** (Primary Workflow)
```
Execution Flow: spec → planner → coder → qa_reviewer → qa_fixer
```

| File | Agent Role | Thinking Tools |
|------|-----------|----------------|
| `spec_gatherer.md` | Gather requirements | sequential-thinking, code-reasoning |
| `spec_researcher.md` | Research context | sequential-thinking, code-reasoning |
| `spec_writer.md` | Write specifications | sequential-thinking, code-reasoning |
| `spec_critic.md` | Critique specs | - |
| `spec_quick.md` | Quick spec generation | - |
| `planner.md` | Create implementation plan | sequential-thinking, code-reasoning, mcp-reasoner |
| `coder.md` | Implement code | sequential-thinking, code-reasoning |
| `coder_recovery.md` | Recover from errors | - |
| `qa_reviewer.md` | Review implementation | sequential-thinking, code-reasoning |
| `qa_fixer.md` | Fix QA issues | sequential-thinking, code-reasoning |

#### 2. **Ideation & Analysis Prompts**
| File | Purpose |
|------|---------|
| `ideation_code_improvements.md` | Generate code improvement ideas |
| `ideation_code_quality.md` | Analyze code quality |
| `ideation_documentation.md` | Documentation suggestions |
| `ideation_performance.md` | Performance optimization ideas |
| `ideation_security.md` | Security improvement ideas |
| `ideation_ui_ux.md` | UI/UX enhancement ideas |

#### 3. **Planning & Strategy Prompts**
| File | Purpose |
|------|---------|
| `complexity_assessor.md` | Assess implementation complexity |
| `followup_planner.md` | Plan follow-up work |
| `roadmap_discovery.md` | Discover roadmap items |
| `roadmap_features.md` | Generate feature roadmaps |

#### 4. **Analysis & Extraction Prompts**
| File | Purpose |
|------|---------|
| `competitor_analysis.md` | Analyze competitive landscape |
| `insight_extractor.md` | Extract insights from data |
| `validation_fixer.md` | Fix validation issues |

### Prompt Structure Pattern

All prompts follow this structure:

```markdown
## YOUR ROLE - [AGENT NAME]

[Role description and key principles]

---

## THINKING TOOLS AVAILABLE

### 1. Sequential Thinking (`mcp__sequential-thinking__sequentialthinking`)
[Usage guidelines]

### 2. Code Reasoning (`mcp__code-reasoning__code-reasoning`)
[Usage guidelines]

### 3. [Optional: MCP Reasoner]
[Usage guidelines for strategic decisions]

---

## PHASE 0: LOAD CONTEXT (MANDATORY)

[Commands to load working context]

---

## [MAIN WORKFLOW PHASES]

[Detailed instructions for agent execution]
```

### Critical Prompt Features

1. **Environment Awareness** (coder.md):
   - Filesystem restrictions
   - Relative path requirements (`./`)
   - Working directory constraints

2. **Thinking Tool Integration**:
   - All prompts include thinking tool sections
   - Guidance on when/how to use each tool
   - Best practices for complex decisions

3. **Session Memory**:
   - Agents read from spec directories
   - Context preserved across sessions
   - Progress tracking in JSON files

---

## GitHub Workflows (`.github/workflows/`)

**Count:** 17 workflows
**Purpose:** CI/CD, security, release automation

### Workflow Categories

#### 1. **CI/CD Core** (3 workflows)
| File | Triggers | Jobs | Purpose |
|------|----------|------|---------|
| `ci.yml` | push, PR to main/develop | test-python (3.12, 3.13), test-frontend | Run tests, coverage |
| `lint.yml` | push, PR | python lint | Code quality checks |
| `pr-status-check.yml` | PR | status check | Basic PR validation |

#### 2. **PR Management** (3 workflows)
| File | Purpose |
|------|---------|
| `pr-auto-label.yml` | Auto-label PRs based on changes |
| `pr-status-gate.yml` | **CRITICAL** - Gate PR merges based on check status |
| `issue-auto-label.yml` | Auto-label issues |

**PR Status Gate Architecture:**
```javascript
// Hardcoded check names (Issue #4 - maintenance burden)
const requiredChecks = [
  'CI / test-frontend (pull_request)',
  'CI / test-python (3.12) (pull_request)',
  'CI / test-python (3.13) (pull_request)',
  'Lint / python (pull_request)',
  'Quality Security / CodeQL (javascript-typescript) (pull_request)',
  'Quality Security / CodeQL (python) (pull_request)',
  'Quality Security / Python Security (Bandit) (pull_request)',
  'Quality Security / Security Summary (pull_request)',
  'CLA Assistant / CLA Check',
  'Quality Commit Lint / Conventional Commits (pull_request)'
];
```

#### 3. **Security & Quality** (1 workflow)
| File | Jobs | Tools |
|------|------|-------|
| `quality-security.yml` | CodeQL (Python, JS/TS), Bandit | CodeQL, Bandit scanner |

**Security Features:**
- Scheduled weekly scans (Monday midnight UTC)
- Extended security queries
- JSON report analysis
- Auto-annotation of findings

#### 4. **Release Management** (5 workflows)
| File | Purpose |
|------|---------|
| `release.yml` | Full release (macOS Intel/ARM, Windows, Linux) |
| `beta-release.yml` | Beta releases |
| `prepare-release.yml` | Release preparation |
| `build-prebuilds.yml` | Prebuild artifacts |
| `discord-release.yml` | Discord release notifications |

**Release Architecture:**
```yaml
Build Matrix:
  - macOS Intel (macos-15-intel) [last Intel runner, supported until Fall 2027]
  - macOS ARM (macos-14)
  - Windows (windows-latest)
  - Linux (ubuntu-latest)

Artifacts:
  - .dmg (macOS, notarized)
  - .exe (Windows)
  - .AppImage, .deb (Linux)
```

#### 5. **Automation & Maintenance** (5 workflows)
| File | Purpose |
|------|---------|
| `stale.yml` | Close stale issues/PRs |
| `welcome.yml` | Welcome new contributors |
| `test-on-tag.yml` | Test on git tags |
| `validate-version.yml` | Validate version numbers |
| `discord-release.yml` | Discord notifications |

### Workflow Best Practices

✅ **Implemented:**
- Concurrency control (cancel-in-progress)
- Minimal permissions principle
- Timeout protection
- Caching (npm, Python)
- Matrix strategies for multi-version testing

⚠️ **Improvements Needed** (see GitHub Issues):
- Dynamic check discovery (Issue #4)
- Meta-workflow validation (Issue #5)
- Workflow consistency checks

---

## Issue Templates (`.github/ISSUE_TEMPLATE/`)

| Template | Type | Purpose |
|----------|------|---------|
| `bug_report.yml` | Form | Structured bug reports |
| `question.yml` | Form | User questions |
| `docs.yml` | Form | Documentation requests |
| `config.yml` | Config | Template configuration |

---

## Key Configuration Files

### Root Level
| File | Purpose |
|------|---------|
| `CLAUDE.md` | **CRITICAL** - Claude AI instructions for autonomous dev |
| `README.md` | Project documentation |
| `CONTRIBUTING.md` | Contribution guidelines |
| `CHANGELOG.md` | Version history |
| `LICENSE` | Apache 2.0 license |
| `CLA.md` | Contributor License Agreement |
| `.gitignore` | Git ignore rules |
| `.pre-commit-config.yaml` | Pre-commit hooks |
| `.secretsignore.example` | Secret scanning config |
| `.coderabbit.yaml` | CodeRabbit AI review config |

### GitHub Specific
| File | Purpose |
|------|---------|
| `.github/dependabot.yml` | Dependency updates |
| `.github/FUNDING.yml` | Sponsor links |
| `.github/release-drafter.yml` | Auto-generate release notes |

---

## Data Flow Architecture

```
User Input
    ↓
Spec Gatherer Agent → spec_gatherer.md
    ↓
Spec Researcher Agent → spec_researcher.md
    ↓
Spec Writer Agent → spec_writer.md
    ↓
[spec.md created in .auto-claude/specs/{name}/]
    ↓
Planner Agent → planner.md
    ↓
[implementation_plan.json created]
    ↓
Coder Agent → coder.md (iterative, per subtask)
    ↓
QA Reviewer Agent → qa_reviewer.md
    ↓
[If issues found]
    ↓
QA Fixer Agent → qa_fixer.md
    ↓
[Until all checks pass]
    ↓
Final Deliverable
```

### Artifact Locations

```
.auto-claude/
├── ideation/
│   ├── screenshots/      # UI screenshots for analysis
│   └── [ideation docs]   # Generated ideation documents
├── insights/             # Extracted insights
├── roadmap/             # Roadmap documents
└── specs/               # Specifications
    └── {spec-name}/     # Per-spec directory
        ├── spec.md                 # Main specification
        ├── implementation_plan.json # Execution plan
        ├── context.json            # Relevant codebase context
        ├── project_index.json      # Project structure
        ├── requirements.json       # User requirements
        ├── build-progress.txt      # Session progress notes
        └── memory/                 # Session memory
            ├── codebase_map.json   # File→purpose mapping
            └── patterns.md         # Code patterns to follow
```

---

## Dependencies

### Backend Python (`apps/backend/requirements.txt`)
- **Core:** Python 3.12+, FastAPI, Pydantic
- **AI:** OpenAI SDK, Anthropic SDK
- **Testing:** pytest, pytest-cov
- **Utilities:** httpx, pyyaml, python-dotenv

### Frontend TypeScript (`apps/frontend/package.json`)
- **Framework:** Electron, React, TypeScript
- **UI:** Tailwind CSS, shadcn/ui components
- **State:** React hooks, context
- **Build:** electron-builder, webpack
- **Testing:** Jest, Playwright (e2e)

---

## Testing Architecture

```
tests/                   # Python backend tests
apps/frontend/e2e/       # Frontend E2E tests
apps/frontend/src/**/__tests__/  # Frontend unit tests
```

### Test Commands
```bash
# Backend tests
cd apps/backend
pytest ../../tests/ -v --cov=. --cov-report=term-missing

# Frontend tests
cd apps/frontend
npm run test
npm run test:e2e

# Lint
npm run lint
ruff check apps/backend/
```

---

## Local Development Setup

### Prerequisites
- Python 3.12 or 3.13
- Node.js 24
- Git

### Quick Start
```bash
# Clone
git clone https://github.com/joelfuller2016/Auto-Claude.git
cd Auto-Claude

# Backend setup
cd apps/backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt

# Frontend setup
cd ../frontend
npm ci
npm run dev

# Run full build
npm run build
npm run package:mac  # or package:win, package:linux
```

---

## Known Issues & Improvements

See GitHub Issues:
- **#1** - [Prompts] Inconsistent PATH handling across agent prompts (HIGH)
- **#2** - [Prompts] Standardize variable naming conventions (MEDIUM)
- **#3** - [Prompts] Add enforcement mechanism for thinking tool usage (MEDIUM)
- **#4** - [Workflows] Hardcoded check names in PR status gate (HIGH)
- **#5** - [Workflows] Add meta-workflow to validate workflow consistency (MEDIUM)

---

## Version Information

- **Current Version:** 2.7.2-beta.12 (as of 2025-12-26)
- **Latest Release:** See GitHub releases
- **Commit:** 7210610 (develop)

---

## Architecture Decisions

### Why Python + TypeScript?
- **Python Backend:** AI/ML ecosystem, strong LLM library support
- **TypeScript Frontend:** Type safety, Electron compatibility, React ecosystem

### Why Markdown Prompts?
- Version-controllable
- Human-readable
- Easy to diff and review
- Direct embedding in LLM contexts

### Why Electron?
- Cross-platform (macOS, Windows, Linux)
- Rich UI capabilities
- Native system integration
- Strong ecosystem

---

## For AI Agents

### Critical Files for Understanding
1. `CLAUDE.md` - Project instructions
2. `apps/backend/prompts/*.md` - Agent behavior definitions
3. `.github/workflows/pr-status-gate.yml` - Merge gate logic
4. `apps/backend/runners/github/runner.py` - GitHub integration
5. This file - Architecture overview

### When Modifying Prompts
- ✅ Include environment awareness section
- ✅ Add thinking tools section
- ✅ Use relative paths (`./`)
- ✅ Document with inline comments
- ✅ Test with actual agents

### When Modifying Workflows
- ✅ Update pr-status-gate.yml if changing job names
- ✅ Use concurrency control
- ✅ Set minimal permissions
- ✅ Add timeout protection
- ✅ Pin action versions

---

**Last Updated:** 2026-01-01
**Maintainer:** joelfuller2016
**Source:** Auto-Claude Deep Review (Ultrathink Mode)
