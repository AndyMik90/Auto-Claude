# IDLE (Fork Auto-Claude)

**Autonomous multi-agent coding framework that plans, builds, and validates software for you.**

> 🔱 **This is a fork** of the original [Auto Claude](https://github.com/AndyMik90/Auto-Claude) project by Andre Mikalsen.

![Auto Claude Kanban Board](.github/assets/Auto-Claude-Kanban.png)

[![License](https://img.shields.io/badge/license-AGPL--3.0-green?style=flat-square)](./LICENSE)
[![Original Project](https://img.shields.io/badge/original-Auto%20Claude-blue?style=flat-square)](https://github.com/AndyMik90/Auto-Claude)

---

## Installation

### From Source

This fork is distributed as source code. To build and run:

```bash
# Clone the repository
git clone <your-fork-url>
cd Auto-Claude

# Install dependencies
npm run install:all

# Run in development mode
npm run dev

# Or build for production
npm start
```

### Download Original Releases

For pre-built binaries, visit the [original project releases](https://github.com/AndyMik90/Auto-Claude/releases).

---

## Requirements

- **Claude Pro/Max subscription** - [Get one here](https://claude.ai/upgrade)
- **Claude Code CLI** - `npm install -g @anthropic-ai/claude-code`
- **Git repository** - Your project must be initialized as a git repo

---

## Quick Start

1. **Download and install** the app for your platform
2. **Open your project** - Select a git repository folder
3. **Connect Claude** - The app will guide you through OAuth setup
4. **Create a task** - Describe what you want to build
5. **Watch it work** - Agents plan, code, and validate autonomously

---

## Language Configuration

Auto-Claude supports generating content in multiple languages. By default, all generated content (task descriptions, roadmaps, ideas) is in English.

### Configure Russian Language

To generate all content in Russian:

```bash
export AUTO_CLAUDE_LANGUAGE=ru
```

Or create `.auto-claude/config.json` in your project:

```json
{
  "output_language": "ru"
}
```

### Supported Languages

- `ru` - Russian (Русский)
- `en` - English (default)
- `es` - Spanish (Español)
- `de` - German (Deutsch)
- `fr` - French (Français)

📖 **Full documentation**: [Language Configuration Guide](apps/backend/docs/LANGUAGE_CONFIGURATION.md) | [Русская инструкция](apps/backend/docs/LANGUAGE_SETUP_RU.md)

---

## Features

| Feature | Description |
|---------|-------------|
| **Autonomous Tasks** | Describe your goal; agents handle planning, implementation, and validation |
| **Parallel Execution** | Run multiple builds simultaneously with up to 12 agent terminals |
| **Isolated Workspaces** | All changes happen in git worktrees - your main branch stays safe |
| **Self-Validating QA** | Built-in quality assurance loop catches issues before you review |
| **AI-Powered Merge** | Automatic conflict resolution when integrating back to main |
| **Memory Layer** | Agents retain insights across sessions for smarter builds |
| **GitHub/GitLab Integration** | Import issues, investigate with AI, create merge requests |
| **Linear Integration** | Sync tasks with Linear for team progress tracking |
| **Cross-Platform** | Native desktop apps for Windows, macOS, and Linux |
| **Auto-Updates** | App updates automatically when new versions are released |

---

## Interface

### Kanban Board
Visual task management from planning through completion. Create tasks and monitor agent progress in real-time.

### Agent Terminals
AI-powered terminals with one-click task context injection. Spawn multiple agents for parallel work.

![Agent Terminals](.github/assets/Auto-Claude-Agents-terminals.png)

### Roadmap
AI-assisted feature planning with competitor analysis and audience targeting.

![Roadmap](.github/assets/Auto-Claude-roadmap.png)

### Additional Features
- **Insights** - Chat interface for exploring your codebase
- **Ideation** - Discover improvements, performance issues, and vulnerabilities
- **Changelog** - Generate release notes from completed tasks

---

## Project Structure

```
Auto-Claude/
├── apps/
│   ├── backend/     # Python agents, specs, QA pipeline
│   └── frontend/    # Electron desktop application
├── guides/          # Additional documentation
├── tests/           # Test suite
└── scripts/         # Build utilities
```

---

## CLI Usage

For headless operation, CI/CD integration, or terminal-only workflows:

```bash
cd apps/backend

# Create a spec interactively
python spec_runner.py --interactive

# Run autonomous build
python run.py --spec 001

# Review and merge
python run.py --spec 001 --review
python run.py --spec 001 --merge
```

See [guides/CLI-USAGE.md](guides/CLI-USAGE.md) for complete CLI documentation.

---

## Development

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run install:all` | Install backend and frontend dependencies |
| `npm start` | Build and run the desktop app |
| `npm run dev` | Run in development mode with hot reload |
| `npm run package` | Package for current platform |
| `npm run package:mac` | Package for macOS |
| `npm run package:win` | Package for Windows |
| `npm run package:linux` | Package for Linux |
| `npm run package:flatpak` | Package as Flatpak (see [guides/linux.md](guides/linux.md)) |
| `npm run lint` | Run linter |
| `npm test` | Run frontend tests |
| `npm run test:backend` | Run backend tests |

### Building from Source

For complete development setup instructions, see the [original project documentation](https://github.com/AndyMik90/Auto-Claude).

For Linux-specific builds (Flatpak, AppImage), see [guides/linux.md](guides/linux.md).

---

## Security

Auto Claude uses a three-layer security model:

1. **OS Sandbox** - Bash commands run in isolation
2. **Filesystem Restrictions** - Operations limited to project directory
3. **Dynamic Command Allowlist** - Only approved commands based on detected project stack

---

## Original Project

This is a fork of **Auto Claude** by Andre Mikalsen.

- **Original Repository**: https://github.com/AndyMik90/Auto-Claude
- **Discord Community**: https://discord.gg/KCXaPBr4Dj
- **YouTube Channel**: https://www.youtube.com/@AndreMikalsen

For issues related to the original project, please visit the [original repository](https://github.com/AndyMik90/Auto-Claude/issues).

---

## License

**AGPL-3.0** - GNU Affero General Public License v3.0

This project is licensed under AGPL-3.0, same as the original Auto Claude project. 

- You are free to use, modify, and distribute this software
- If you modify and distribute it, or run it as a service, your code must also be open source under AGPL-3.0
- See [LICENSE](LICENSE) for full terms

**Original Project**: Copyright © Andre Mikalsen  
**This Fork**: _(Add your copyright notice here if making substantial modifications)_
