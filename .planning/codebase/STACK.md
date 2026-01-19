# Technology Stack

**Analysis Date:** 2026-01-19

## Languages

**Primary:**
- TypeScript 5.9.3 - Electron frontend (desktop UI, IPC handlers, state management)
- Python 3.12+ - Backend agents, CLI, integrations, security

**Secondary:**
- JavaScript (ES modules) - Build scripts, configuration
- JSON - Configuration, data storage, IPC communication

## Runtime

**Environment:**
- Node.js >= 24.0.0 (Electron main/renderer processes)
- Python 3.12+ (required for LadybugDB/Graphiti memory system)

**Package Manager:**
- npm 10.0.0+ (root monorepo, frontend)
- uv (Python backend - fast pip alternative)
- Lockfiles: `package-lock.json` (present), Python deps in `requirements.txt`

## Frameworks

**Core:**
- Electron 39.2.7 - Cross-platform desktop application shell
- React 19.2.3 - UI components and state management
- Claude Agent SDK >= 0.1.19 - AI agent orchestration (CRITICAL: NOT raw Anthropic API)

**Testing:**
- Vitest 4.0.16 - Frontend unit tests
- Playwright 1.52.0 - E2E testing for Electron
- pytest 7.0.0+ - Backend Python tests
- pytest-asyncio 0.21.0+ - Async test support

**Build/Dev:**
- electron-vite 5.0.0 - Electron build toolchain
- Vite 7.2.7 - Frontend bundler
- electron-builder 26.4.0 - Cross-platform packaging (dmg, exe, AppImage, deb, flatpak)

## Key Dependencies

**Critical (AI/Agent):**
- `claude-agent-sdk` >= 0.1.19 - Core AI agent SDK (replaces direct Anthropic API)
- `@anthropic-ai/sdk` 0.71.2 - Anthropic client (used by Graphiti providers)

**Infrastructure:**
- `@lydell/node-pty` 1.1.0 - Terminal emulation (native module)
- `@xterm/xterm` 6.0.0 - Terminal rendering
- `electron-updater` 6.6.2 - Auto-update mechanism
- `chokidar` 5.0.0 - File system watching
- `zustand` 5.0.9 - React state management

**UI Components:**
- `@radix-ui/*` - Accessible UI primitives (dialogs, dropdowns, tabs, etc.)
- `tailwindcss` 4.1.17 - Utility-first CSS
- `lucide-react` 0.562.0 - Icons
- `motion` 12.23.26 - Animations

**Memory/Database:**
- `real_ladybug` >= 0.13.0 - Embedded graph database (Python 3.12+, no Docker)
- `graphiti-core` >= 0.5.0 - Knowledge graph memory layer

**Observability:**
- `@sentry/electron` 7.5.0 - Error tracking (optional, requires SENTRY_DSN)
- `electron-log` 5.4.3 - Structured logging

**Internationalization:**
- `i18next` 25.7.3 + `react-i18next` 16.5.0 - Multi-language support (en, fr)

## Configuration

**Environment:**
- Backend: `apps/backend/.env` (OAuth tokens, integrations, memory config)
- Frontend: `apps/frontend/.env` (debug settings, Sentry DSN)
- Example files: `.env.example` in both directories

**Key Backend Env Vars:**
```
CLAUDE_CODE_OAUTH_TOKEN      # Required: OAuth token (or use system keychain)
ANTHROPIC_BASE_URL           # Optional: Custom API endpoint
GRAPHITI_ENABLED             # Required: true to enable memory
GRAPHITI_LLM_PROVIDER        # openai|anthropic|azure_openai|ollama|google|openrouter
GRAPHITI_EMBEDDER_PROVIDER   # openai|voyage|azure_openai|ollama|google|openrouter
LINEAR_API_KEY               # Optional: Linear integration
ELECTRON_MCP_ENABLED         # Optional: E2E testing via Electron MCP
```

**Build:**
- `apps/frontend/electron.vite.config.ts` - Electron/Vite build config
- `apps/frontend/vitest.config.ts` - Test configuration
- `apps/frontend/package.json` (build section) - electron-builder config
- `ruff.toml` - Python linting/formatting

## Platform Requirements

**Development:**
- macOS, Windows, or Linux
- Node.js 24+, Python 3.12+
- Git (required for worktree isolation)
- Git Bash (Windows only, for Claude Code CLI)

**Production:**
- macOS: DMG/ZIP (arm64 + x64)
- Windows: NSIS installer/ZIP
- Linux: AppImage, DEB, Flatpak
- Bundled Python runtime (downloaded via `scripts/download-python.cjs`)

**CI/CD:**
- GitHub Actions (`.github/workflows/ci.yml`)
- Matrix testing: Linux, Windows, macOS
- Python 3.12 + 3.13 (Linux only)

## Monorepo Structure

```
autonomous-coding/
├── apps/
│   ├── backend/           # Python (uv, requirements.txt)
│   └── frontend/          # Electron/React (npm, package.json)
├── tests/                 # Shared test suite
├── scripts/               # Build/release scripts
└── package.json           # Root workspace config
```

**Workspace Commands:**
```bash
npm run install:all        # Install both frontend and backend
npm run dev                # Start Electron in dev mode
npm run build              # Build frontend
npm run package            # Package for current platform
npm run test:backend       # Run Python tests
```

---

*Stack analysis: 2026-01-19*
