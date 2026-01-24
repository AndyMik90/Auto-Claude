# Codebase Structure

**Analysis Date:** 2026-01-19

## Directory Layout

```
autonomous-coding/
├── apps/
│   ├── backend/           # Python backend - CLI, agents, core logic
│   │   ├── agents/        # Agent implementations (coder, planner, memory)
│   │   ├── cli/           # Command-line interface modules
│   │   ├── core/          # Client factory, auth, worktree, security
│   │   ├── integrations/  # External integrations (Graphiti, Linear)
│   │   ├── memory/        # Memory system (sessions, patterns)
│   │   ├── merge/         # Git merge conflict resolution
│   │   ├── prompts/       # Agent system prompts (.md files)
│   │   ├── qa/            # QA validation loop
│   │   ├── runners/       # Feature runners (GitHub, GitLab, roadmap, spec)
│   │   ├── security/      # Command validators, secrets scanning
│   │   ├── spec/          # Spec creation pipeline
│   │   └── ui/            # CLI output formatting
│   └── frontend/          # Electron desktop app
│       ├── src/
│       │   ├── main/      # Electron main process
│       │   ├── renderer/  # React renderer (components, stores)
│       │   ├── preload/   # IPC bridge scripts
│       │   └── shared/    # Shared types, constants, i18n
│       └── resources/     # App icons, assets
├── tests/                 # Python test suite
├── scripts/               # Build and utility scripts
├── docs/                  # Documentation
└── guides/                # User guides
```

## Directory Purposes

**`apps/backend/`:**
- Purpose: All Python backend code (CLI, agents, core infrastructure)
- Contains: Agent implementations, CLI modules, security, integrations
- Key files: `run.py` (entry point), `core/client.py` (SDK factory)

**`apps/backend/agents/`:**
- Purpose: AI agent implementations for autonomous coding
- Contains: Coder agent loop, planner, memory manager, session utilities
- Key files: `coder.py`, `planner.py`, `memory_manager.py`, `session.py`

**`apps/backend/cli/`:**
- Purpose: CLI command implementations
- Contains: Build, spec, workspace, QA, batch commands
- Key files: `main.py`, `build_commands.py`, `workspace_commands.py`

**`apps/backend/core/`:**
- Purpose: Core infrastructure (client, auth, workspace, platform)
- Contains: SDK client factory, OAuth, worktree manager, platform abstraction
- Key files: `client.py`, `auth.py`, `worktree.py`, `workspace.py`

**`apps/backend/qa/`:**
- Purpose: QA validation after build completion
- Contains: QA loop, reviewer, fixer, criteria validation, issue tracking
- Key files: `loop.py`, `reviewer.py`, `fixer.py`, `criteria.py`

**`apps/backend/spec/`:**
- Purpose: Spec creation pipeline
- Contains: Pipeline orchestrator, complexity assessment, validation
- Key files: `pipeline/orchestrator.py`, `complexity.py`, `validate_pkg/`

**`apps/backend/security/`:**
- Purpose: Bash command validation and security
- Contains: Validators, hooks, command parser, secrets scanner
- Key files: `hooks.py`, `validator.py`, `parser.py`, `scan_secrets.py`

**`apps/backend/prompts/`:**
- Purpose: Agent system prompts (Markdown files)
- Contains: Prompts for coder, planner, QA, spec agents
- Key files: `coder.md`, `planner.md`, `qa_reviewer.md`, `spec_gatherer.md`

**`apps/backend/runners/`:**
- Purpose: Feature-specific execution runners
- Contains: GitHub PR review, roadmap generation, spec creation
- Key files: `github/orchestrator.py`, `spec_runner.py`, `roadmap_runner.py`

**`apps/frontend/src/main/`:**
- Purpose: Electron main process
- Contains: Window management, IPC handlers, service managers
- Key files: `index.ts`, `ipc-setup.ts`, `cli-tool-manager.ts`

**`apps/frontend/src/renderer/`:**
- Purpose: React UI
- Contains: Components, stores, hooks, contexts
- Key files: `App.tsx`, `components/`, `stores/`

**`apps/frontend/src/shared/`:**
- Purpose: Shared code between main and renderer
- Contains: Types, constants, i18n, utilities
- Key files: `types/`, `constants/`, `i18n/`

## Key File Locations

**Entry Points:**
- `apps/backend/run.py`: Backend CLI entry point
- `apps/frontend/src/main/index.ts`: Electron main entry
- `apps/frontend/src/renderer/main.tsx`: React app entry

**Configuration:**
- `apps/backend/.env`: Backend environment variables
- `apps/backend/.env.example`: Backend env template
- `apps/frontend/.env`: Frontend environment variables
- `apps/backend/requirements.txt`: Python dependencies
- `apps/frontend/package.json`: Frontend dependencies

**Core Logic:**
- `apps/backend/core/client.py`: Claude SDK client factory
- `apps/backend/core/auth.py`: OAuth token management
- `apps/backend/core/worktree.py`: Git worktree isolation
- `apps/backend/agents/coder.py`: Main agent loop
- `apps/backend/spec/pipeline/orchestrator.py`: Spec creation pipeline

**Testing:**
- `tests/`: All Python tests (pytest)
- `tests/conftest.py`: Pytest fixtures and configuration
- `apps/frontend/src/main/__tests__/`: Main process tests
- `apps/frontend/src/renderer/__tests__/`: Renderer tests

## Naming Conventions

**Files:**
- Python modules: `snake_case.py` (e.g., `workspace_commands.py`)
- TypeScript modules: `kebab-case.ts` (e.g., `cli-tool-manager.ts`)
- React components: `PascalCase.tsx` (e.g., `KanbanBoard.tsx`)
- Prompts: `snake_case.md` (e.g., `qa_reviewer.md`)
- Tests: `test_*.py` (Python), `*.test.ts/tsx` (TypeScript)

**Directories:**
- Python packages: `snake_case/` with `__init__.py`
- TypeScript modules: `kebab-case/`
- Package submodules: `*_pkg/` suffix (e.g., `tools_pkg/`, `queries_pkg/`)

**Classes and Functions:**
- Python classes: `PascalCase` (e.g., `SpecOrchestrator`)
- Python functions: `snake_case` (e.g., `run_autonomous_agent`)
- TypeScript/React: `camelCase` functions, `PascalCase` components

## Where to Add New Code

**New Agent Feature:**
- Primary code: `apps/backend/agents/`
- Prompt: `apps/backend/prompts/{agent_name}.md`
- Tests: `tests/test_agent_*.py`

**New CLI Command:**
- Implementation: `apps/backend/cli/{domain}_commands.py`
- Registration: `apps/backend/cli/main.py` (argument parsing)
- Tests: `tests/test_{command}.py`

**New Frontend Component:**
- Implementation: `apps/frontend/src/renderer/components/{ComponentName}.tsx`
- Translations: `apps/frontend/src/shared/i18n/locales/en/{namespace}.json`
- Tests: `apps/frontend/src/renderer/components/__tests__/`

**New Frontend Store:**
- Implementation: `apps/frontend/src/renderer/stores/{domain}-store.ts`
- Pattern: Use Zustand with typed state and actions

**New IPC Handler:**
- Handler module: `apps/frontend/src/main/ipc-handlers/{domain}-handlers.ts`
- Registration: `apps/frontend/src/main/ipc-handlers/index.ts`
- Types: `apps/frontend/src/shared/types/`

**New Security Validator:**
- Implementation: `apps/backend/security/validator.py`
- Registration: Add to `VALIDATORS` dict in same file
- Tests: `tests/test_security.py`

**New Integration:**
- Implementation: `apps/backend/integrations/{service}/`
- Configuration: Add env vars to `.env.example`
- Documentation: Update `CLAUDE.md`

**Utilities:**
- Backend shared helpers: `apps/backend/core/` or domain-specific module
- Frontend shared helpers: `apps/frontend/src/shared/utils/`

## Special Directories

**`.auto-claude/`:**
- Purpose: Per-project spec storage and build state
- Generated: Yes (by backend during spec creation)
- Committed: No (gitignored)
- Contents: `specs/`, `worktrees/tasks/`, `insights/`

**`.worktrees/`:**
- Purpose: Legacy worktree location (deprecated)
- Generated: Yes (by worktree manager)
- Committed: No (gitignored)

**`node_modules/`:**
- Purpose: Frontend npm dependencies
- Generated: Yes (by npm install)
- Committed: No (gitignored)

**`.venv/`:**
- Purpose: Python virtual environment
- Generated: Yes (by uv venv)
- Committed: No (gitignored)

**`dist/` and `out/`:**
- Purpose: Build outputs
- Generated: Yes (by build scripts)
- Committed: No (gitignored)

**`.planning/`:**
- Purpose: GSD planning documents
- Generated: Yes (by GSD commands)
- Committed: Optional (project choice)

---

*Structure analysis: 2026-01-19*
