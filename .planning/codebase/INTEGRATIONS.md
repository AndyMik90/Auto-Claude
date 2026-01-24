# External Integrations

**Analysis Date:** 2026-01-19

## APIs & External Services

**Claude AI (Primary):**
- Service: Anthropic Claude API via Claude Agent SDK
- SDK: `claude-agent-sdk` >= 0.1.19 (Python backend)
- Auth: OAuth tokens via system keychain (macOS Keychain, Windows Credential Manager, Linux Secret Service)
- Env: `CLAUDE_CODE_OAUTH_TOKEN` or auto-detected from system credential store
- Implementation: `apps/backend/core/client.py`, `apps/backend/core/auth.py`

**CRITICAL: Never use `anthropic.Anthropic()` directly. Always use `create_client()` from `core.client`.**

**Context7 MCP (Documentation Lookup):**
- Service: Upstash Context7 documentation retrieval
- SDK: `@upstash/context7-mcp` (spawned via npx)
- Auth: None (public MCP server)
- Implementation: Configured in `apps/backend/core/client.py` MCP servers
- Usage: Automatically available to agents for documentation queries

**Linear (Optional Project Management):**
- Service: Linear issue tracking and project management
- SDK: Linear MCP server (HTTP-based)
- Auth: `LINEAR_API_KEY` (Bearer token)
- Env: `LINEAR_API_KEY`, `LINEAR_TEAM_ID`, `LINEAR_PROJECT_ID`
- Implementation: `apps/backend/integrations/linear/integration.py`
- Features: Subtask-to-issue sync, progress tracking, stuck task escalation

**GitHub:**
- Service: GitHub API for issues, PRs, releases
- SDK: `gh` CLI (subprocess calls)
- Auth: GitHub CLI auth (`gh auth login`)
- Implementation: `apps/frontend/src/main/ipc-handlers/github/`
- Features: Import issues, create PRs, manage releases, triage automation

**GitLab (Optional):**
- Service: GitLab API for issues and merge requests
- SDK: `glab` CLI or Personal Access Token
- Auth: `glab auth login` or `GITLAB_TOKEN`
- Env: `GITLAB_INSTANCE_URL`, `GITLAB_TOKEN`, `GITLAB_PROJECT`
- Implementation: `apps/frontend/src/main/ipc-handlers/gitlab/`

## Data Storage

**Databases:**
- LadybugDB (embedded graph database)
  - Connection: Local file at `~/.auto-claude/memories/{database_name}`
  - Client: `real_ladybug` Python package (requires Python 3.12+)
  - No Docker required - fully embedded
  - Provider-specific database naming to prevent embedding dimension mismatches

**File Storage:**
- Local filesystem only
- Project data: `.auto-claude/` directory per project
- Specs: `.auto-claude/specs/{id}-{name}/`
- Worktrees: `.auto-claude/worktrees/` (git worktree isolation)

**Caching:**
- Project index cache (5 minute TTL, thread-safe)
- CLI path cache (per-session)
- Implementation: `apps/backend/core/client.py` (`_PROJECT_INDEX_CACHE`)

## Memory System (Graphiti)

**Graph Memory:**
- Engine: Graphiti-core + LadybugDB
- Purpose: Cross-session context retention, pattern learning
- Data: Episodes (insights, discoveries, patterns, gotchas, outcomes)
- Config: `apps/backend/integrations/graphiti/config.py`
- Memory: `apps/backend/integrations/graphiti/memory.py`

**Multi-Provider Support:**

| Provider | LLM | Embedder | Env Vars |
|----------|-----|----------|----------|
| OpenAI | Yes | Yes | `OPENAI_API_KEY`, `OPENAI_MODEL` |
| Anthropic | Yes | No | `ANTHROPIC_API_KEY`, `GRAPHITI_ANTHROPIC_MODEL` |
| Azure OpenAI | Yes | Yes | `AZURE_OPENAI_*` (API_KEY, BASE_URL, deployments) |
| Voyage AI | No | Yes | `VOYAGE_API_KEY`, `VOYAGE_EMBEDDING_MODEL` |
| Google AI | Yes | Yes | `GOOGLE_API_KEY`, `GOOGLE_LLM_MODEL` |
| Ollama | Yes | Yes | `OLLAMA_*` (BASE_URL, models, embedding dim) |
| OpenRouter | Yes | Yes | `OPENROUTER_API_KEY`, `OPENROUTER_*_MODEL` |

**Provider Implementation:** `apps/backend/integrations/graphiti/providers_pkg/`

## Authentication & Identity

**Claude OAuth:**
- Provider: Anthropic Claude Code OAuth
- Implementation: `apps/backend/core/auth.py`
- Storage:
  - macOS: Keychain (`/usr/bin/security find-generic-password`)
  - Windows: `~/.claude/.credentials.json` or Credential Manager
  - Linux: Secret Service API via DBus (`secretstorage` package)
- Token format: `sk-ant-oat01-*` (OAuth access token)
- Login flow: `claude` CLI with `/login` command (opens browser)

**GitHub Auth:**
- Provider: GitHub CLI OAuth
- Implementation: IPC handlers in frontend
- Storage: Managed by `gh` CLI

**GitLab Auth:**
- Provider: GitLab Personal Access Token or glab CLI OAuth
- Implementation: `apps/frontend/src/main/ipc-handlers/gitlab/`
- Storage: Managed by `glab` CLI or `.env` file

## Monitoring & Observability

**Error Tracking:**
- Service: Sentry (optional)
- SDK: `@sentry/electron` 7.5.0
- Auth: `SENTRY_DSN` (set in CI for official builds)
- Env: `SENTRY_DSN`, `SENTRY_TRACES_SAMPLE_RATE`, `SENTRY_PROFILES_SAMPLE_RATE`
- Implementation: `apps/frontend/src/main/sentry.ts`
- Note: Disabled in forks unless SENTRY_DSN is explicitly set

**Logs:**
- Backend: Python `logging` module (structured JSON in debug mode)
- Frontend: `electron-log` (file + console)
- Location: Platform-specific logs directory
- Debug: Set `DEBUG=true` for verbose output

## CI/CD & Deployment

**Hosting:**
- Distribution: GitHub Releases (electron-updater compatible)
- Auto-update: electron-updater checks GitHub releases

**CI Pipeline:**
- Service: GitHub Actions
- Workflow: `.github/workflows/ci.yml`
- Matrix: Linux, Windows, macOS
- Jobs: test-python, test-frontend, ci-complete (gate job)

**Release Pipeline:**
- Workflow: `.github/workflows/release.yml` (triggered on tag)
- Artifacts: DMG, ZIP (macOS), NSIS/ZIP (Windows), AppImage/DEB/Flatpak (Linux)

## Environment Configuration

**Required env vars (backend):**
```
CLAUDE_CODE_OAUTH_TOKEN   # Or use system keychain
GRAPHITI_ENABLED=true     # Enable memory system
```

**Optional env vars (backend):**
```
ANTHROPIC_BASE_URL        # Custom API endpoint
LINEAR_API_KEY            # Linear integration
ELECTRON_MCP_ENABLED      # E2E testing
DEBUG=true                # Verbose logging
```

**Required env vars (frontend):**
```
# None required - optional debug/Sentry settings
```

**Secrets location:**
- Development: `.env` files (gitignored)
- CI/CD: GitHub Secrets
- Production: System credential stores (no secrets in app bundle)

## MCP (Model Context Protocol) Servers

**Built-in MCP Servers:**

| Server | Purpose | Agent Access | Configuration |
|--------|---------|--------------|---------------|
| context7 | Documentation lookup | All agents | Auto-enabled |
| linear | Project management | All agents | `LINEAR_API_KEY` |
| electron | Desktop app automation | QA agents only | `ELECTRON_MCP_ENABLED` |
| puppeteer | Web browser automation | QA agents only | Project capability detection |
| graphiti-memory | Knowledge graph | All agents | `GRAPHITI_MCP_URL` |
| auto-claude | Custom tools | Phase-specific | Auto-enabled |

**Custom MCP Servers:**
- Config: `.auto-claude/.env` (`CUSTOM_MCP_SERVERS` JSON array)
- Validation: `apps/backend/core/client.py` (`_validate_custom_mcp_server`)
- Allowed commands: `npx`, `npm`, `node`, `python`, `python3`, `uv`, `uvx`

**Per-Agent MCP Overrides:**
- Add servers: `AGENT_MCP_{agent}_ADD=server1,server2`
- Remove servers: `AGENT_MCP_{agent}_REMOVE=server1,server2`

## Webhooks & Callbacks

**Incoming:**
- None (desktop application, no server)

**Outgoing:**
- GitHub API calls (via `gh` CLI)
- GitLab API calls (via `glab` CLI or REST)
- Linear MCP server (HTTP)
- Sentry error reports (if configured)
- Auto-update checks (GitHub Releases API)

---

*Integration audit: 2026-01-19*
