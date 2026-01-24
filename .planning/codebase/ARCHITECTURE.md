# Architecture

**Analysis Date:** 2026-01-19

## Pattern Overview

**Overall:** Multi-Agent Orchestration with Electron Desktop UI

**Key Characteristics:**
- Dual-app architecture: Python backend (CLI + agents) + Electron frontend (desktop UI)
- Agent-based autonomous coding via Claude Agent SDK
- Git worktree isolation for safe parallel development
- Phase-based pipeline execution for spec creation and implementation
- Event-driven IPC communication between frontend and backend

## Layers

**Frontend (Electron Main Process):**
- Purpose: Desktop application shell, native OS integration, IPC coordination
- Location: `apps/frontend/src/main/`
- Contains: Window management, IPC handlers, service managers (terminal, python env, CLI tools)
- Depends on: Backend Python CLI, Claude Code CLI
- Used by: Renderer process via IPC

**Frontend (Renderer Process):**
- Purpose: React-based user interface
- Location: `apps/frontend/src/renderer/`
- Contains: Components, Zustand stores, hooks, contexts
- Depends on: Main process via preload IPC bridge
- Used by: End users

**Backend Core:**
- Purpose: Authentication, SDK client factory, security, workspace management
- Location: `apps/backend/core/`
- Contains: `client.py` (SDK factory), `auth.py`, `worktree.py`, `workspace.py`, security hooks
- Depends on: Claude Agent SDK, project analyzer
- Used by: Agents, CLI commands, runners

**Backend Agents:**
- Purpose: AI agent implementations for autonomous coding
- Location: `apps/backend/agents/`
- Contains: Coder, planner, memory manager, session management
- Depends on: Core client, prompts, phase config
- Used by: CLI commands, QA loop

**Backend QA:**
- Purpose: Quality assurance validation loop
- Location: `apps/backend/qa/`
- Contains: QA reviewer, QA fixer, criteria validation, issue tracking
- Depends on: Agents, core client
- Used by: CLI commands after build completion

**Backend Spec:**
- Purpose: Spec creation pipeline with complexity-based phases
- Location: `apps/backend/spec/`
- Contains: Pipeline orchestrator, complexity assessment, validation
- Depends on: Core client, agents
- Used by: CLI spec commands, frontend task creation

**Backend Security:**
- Purpose: Command validation, allowlist management, secrets scanning
- Location: `apps/backend/security/`
- Contains: Validators, hooks, command parser, secrets scanner
- Depends on: Project analyzer
- Used by: Core client via pre-tool-use hooks

**Backend CLI:**
- Purpose: Command-line interface and argument routing
- Location: `apps/backend/cli/`
- Contains: Main entry, build/spec/workspace/QA commands
- Depends on: All backend modules
- Used by: Entry point (`run.py`), frontend terminal

## Data Flow

**Spec Creation Flow:**
1. User creates task via frontend or CLI (`--task "description"`)
2. `SpecOrchestrator` (`spec/pipeline/orchestrator.py`) initializes
3. Complexity assessment determines phase count (3-8 phases)
4. `AgentRunner` executes phases: Discovery -> Requirements -> [Research] -> Context -> Spec -> Plan -> Validate
5. Each phase uses Claude Agent SDK session with phase-specific prompts
6. Output: `spec.md`, `requirements.json`, `context.json`, `implementation_plan.json`

**Implementation Flow:**
1. CLI starts with `python run.py --spec 001`
2. `run_autonomous_agent()` in `agents/coder.py` orchestrates
3. Planner agent creates subtask-based `implementation_plan.json`
4. Coder agent implements subtasks in iteration loop
5. Each subtask runs as Claude Agent SDK session
6. On completion, QA validation loop runs (`qa/loop.py`)
7. QA reviewer validates -> QA fixer fixes issues -> loop until approved

**Frontend-Backend IPC Flow:**
1. Renderer component dispatches action (e.g., start task)
2. Zustand store calls `window.api.invoke('ipc-channel', args)`
3. Preload script bridges to main process
4. IPC handler in `ipc-handlers/` processes request
5. Handler spawns Python subprocess or manages terminal
6. Events streamed back via IPC to update stores

**State Management:**
- Frontend: Zustand stores per domain (`task-store`, `project-store`, `settings-store`, etc.)
- Backend: File-based state (`implementation_plan.json`, `qa_report.md`)
- Session recovery: `RecoveryManager` tracks agent sessions for resumption

## Key Abstractions

**ClaudeSDKClient:**
- Purpose: Configured Claude Agent SDK client with security hooks
- Examples: `apps/backend/core/client.py:create_client()`
- Pattern: Factory function with multi-layered security (sandbox, permissions, hooks)

**SpecOrchestrator:**
- Purpose: Coordinates spec creation pipeline phases
- Examples: `apps/backend/spec/pipeline/orchestrator.py`
- Pattern: Orchestrator with dynamic phase selection based on complexity

**WorktreeManager:**
- Purpose: Git worktree isolation for safe parallel builds
- Examples: `apps/backend/core/worktree.py`
- Pattern: Each spec gets isolated worktree branch (`auto-claude/{spec-name}`)

**SecurityProfile:**
- Purpose: Dynamic command allowlist based on project analysis
- Examples: `apps/backend/project_analyzer.py`, `apps/backend/security/`
- Pattern: Base + stack-specific + custom commands cached in `.auto-claude-security.json`

**IPC Handlers:**
- Purpose: Bridge between Electron renderer and backend services
- Examples: `apps/frontend/src/main/ipc-handlers/`
- Pattern: Domain-specific handler modules registered via `ipc-setup.ts`

## Entry Points

**Backend CLI:**
- Location: `apps/backend/run.py`
- Triggers: Terminal, frontend subprocess spawn, direct invocation
- Responsibilities: Argument parsing, command routing to `cli/` modules

**Electron Main:**
- Location: `apps/frontend/src/main/index.ts`
- Triggers: Application launch
- Responsibilities: Window creation, IPC setup, service initialization

**Renderer Entry:**
- Location: `apps/frontend/src/renderer/main.tsx`
- Triggers: Window load
- Responsibilities: React app mount, store initialization

**Spec Pipeline:**
- Location: `apps/backend/spec/pipeline/orchestrator.py:SpecOrchestrator`
- Triggers: CLI `--task`, frontend task creation
- Responsibilities: Dynamic phase execution for spec creation

**Agent Loop:**
- Location: `apps/backend/agents/coder.py:run_autonomous_agent()`
- Triggers: CLI `--spec 001`, frontend build start
- Responsibilities: Subtask iteration, session management, recovery

## Error Handling

**Strategy:** Multi-level error handling with recovery support

**Patterns:**
- Agent sessions: `RecoveryManager` tracks state for resumption after interruption
- Security validation: Pre-tool-use hooks reject dangerous commands before execution
- QA loop: Escalation to human review after max iterations (`MAX_QA_ITERATIONS`)
- Git operations: Retry with exponential backoff for network errors
- Frontend: Error boundaries with toast notifications

## Cross-Cutting Concerns

**Logging:**
- Backend: Python `logging` module with task-specific loggers (`task_logger/`)
- Frontend: Electron app logger (`app-logger.ts`), Sentry integration

**Validation:**
- Command security: `security/` validators with dynamic allowlists
- Spec validation: `spec/validate_pkg/` for implementation plan schema
- Tool input: `security/tool_input_validator.py` for Claude tool arguments

**Authentication:**
- OAuth flow: `core/auth.py` manages Claude OAuth tokens
- Token storage: Keychain (macOS), Credential Manager (Windows), encrypted file (Linux)
- Token validation: Pre-SDK-call validation to prevent encrypted token errors

**Internationalization:**
- Frontend: `react-i18next` with namespace-organized JSON files
- Location: `apps/frontend/src/shared/i18n/locales/{en,fr}/`

---

*Architecture analysis: 2026-01-19*
