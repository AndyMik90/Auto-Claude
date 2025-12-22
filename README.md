# Auto Claude

Autonomous multi-agent coding framework that plans, builds, and validates software features for you.

![Auto Claude Kanban Board](.github/assets/Auto-Claude-Kanban.png)

[![Discord](https://img.shields.io/badge/Discord-Join%20Community-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.gg/KCXaPBr4Dj)

---

## Quick Start

### Prerequisites

- **Node.js 24+** - [Download](https://nodejs.org/)
- **Python 3.12+** - [Download](https://www.python.org/downloads/) (3.12+ required for Memory Layer)
- **Claude Code CLI** - `npm install -g @anthropic-ai/claude-code`
- **Claude Pro/Max** subscription - [Upgrade](https://claude.ai/upgrade)
- **Git repository** - Your project must be a git repo

### Installation

```bash
# Install all dependencies (backend + frontend)
npm run install:all
```

### Running

```bash
# Start the desktop application
npm start

# Or run in development mode
npm run dev
```

### Memory Layer (Optional)

Memory Layer uses LadybugDB (embedded graph database) - no Docker required.
Enable in settings or set `GRAPHITI_ENABLED=true` in `.env`.

### Download Pre-built

Download the latest release for your platform from [GitHub Releases](https://github.com/AndyMik90/Auto-Claude/releases/latest):

| Platform | Download |
|----------|----------|
| **macOS (Apple Silicon)** | `Auto-Claude-X.X.X-arm64.dmg` |
| **macOS (Intel)** | `Auto-Claude-X.X.X-x64.dmg` |
| **Windows** | `Auto-Claude-X.X.X.exe` |
| **Linux** | `Auto-Claude-X.X.X.AppImage` or `.deb` |

---

## Features

| Feature | Description |
|---------|-------------|
| **Autonomous Tasks** | Describe what you want, agents handle planning, coding, and validation |
| **Parallel Agents** | Run multiple builds simultaneously across up to 12 terminals |
| **Safe by Default** | All work happens in isolated git worktrees |
| **Self-Validating** | Built-in QA loop catches issues before review |
| **AI Merge** | Automatic conflict resolution when merging back to main |
| **Memory Layer** | Agents remember insights across sessions |
| **Cross-Platform** | Desktop app for Mac, Windows, and Linux |

---

## Interface

### Kanban Board
Visual task management from planning to done. Create tasks and watch agents work autonomously.

### Agent Terminals
Spawn AI-powered terminals with one-click task context injection.

![Agent Terminals](.github/assets/Auto-Claude-Agents-terminals.png)

### Roadmap
AI-powered feature planning based on your target audience.

![Roadmap](.github/assets/Auto-Claude-roadmap.png)

### Insights
Chat interface for exploring and understanding your codebase.

### Ideation
Discover code improvements, performance issues, and security vulnerabilities.

### Changelog
Generate professional release notes from completed tasks.

---

## Project Structure

```
auto-claude/
├── Apps/
│   ├── backend/           # Python backend (agents, specs, QA)
│   └── frontend/          # Electron desktop UI
├── guides/                # Documentation
└── tests/                 # Test suite
```

---

## CLI Usage

For terminal-only workflows and CI/CD integration, see [guides/CLI-USAGE.md](guides/CLI-USAGE.md).

```bash
cd Apps/backend

# List specs
python run.py --list

# Run a spec
python run.py --spec 001

# Merge completed build
python run.py --spec 001 --merge
```

---

## Configuration

Create `.env` files in `Apps/backend/` (copy from `.env.example`):

| Variable | Required | Description |
|----------|----------|-------------|
| `CLAUDE_CODE_OAUTH_TOKEN` | Yes | From `claude setup-token` |
| `GRAPHITI_ENABLED` | No | Enable Memory Layer |
| `AUTO_BUILD_MODEL` | No | Override default model |

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install backend + frontend dependencies |
| `npm start` | Build and run desktop app |
| `npm run dev` | Run in development mode |
| `npm run package` | Package app for distribution |
| `npm run lint` | Run linter |
| `npm test` | Run frontend tests |
| `npm run test:backend` | Run backend tests |

---

## How It Works

### Agent Pipeline

**1. Spec Creation** - Gather requirements and create detailed specifications

**2. Implementation** - Agents execute the plan with built-in verification

**3. QA Loop** - Self-validating agents check their work (up to 50 iterations)

**4. Merge** - AI-powered conflict resolution when merging to main

### Security Model

- **OS Sandbox** - Bash commands run in isolation
- **Filesystem Restrictions** - Operations limited to project directory
- **Command Allowlist** - Only approved commands based on project stack

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

**AGPL-3.0** - GNU Affero General Public License v3.0

You can use Auto Claude freely, but if you build on it, your code must also be open source under AGPL-3.0. Closed-source commercial use requires a separate license.
