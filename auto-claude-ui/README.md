# Auto Claude UI

A desktop application for managing AI-driven development tasks using the Auto Claude autonomous coding framework.

## Quick Start

```bash
# 1. Clone the repo (if you haven't already)
git clone https://github.com/AndyMik90/Auto-Claude.git
cd Auto-Claude/auto-claude-ui

# 2. Install dependencies
npm install

# 3. Build the desktop app
npm run package:win    # Windows
npm run package:mac    # macOS
npm run package:linux  # Linux

# 4. Run the app
# Windows: .\dist\win-unpacked\Auto Claude.exe
# macOS:   open dist/mac-arm64/Auto\ Claude.app
# Linux:   ./dist/linux-unpacked/auto-claude
```

## Prerequisites

- Node.js 18+
- npm or pnpm
- Python 3.10+ (for auto-claude backend)
- **Windows only**: Visual Studio Build Tools 2022 with "Desktop development with C++" workload
- **Windows only**: Developer Mode enabled (Settings → System → For developers)

## How to Run

### Building for Production (Recommended)

Build the Electron desktop app for your platform:

```bash
# Build for Windows
npm run package:win

# Build for macOS
npm run package:mac

# Build for Linux
npm run package:linux
```

### Running the Production Build

After building, run the application from the `dist` folder:

```bash
# Windows - run the executable
.\dist\win-unpacked\Auto Claude.exe

# Windows - or use the installer
.\dist\Auto Claude Setup X.X.X.exe

# macOS
open dist/mac-arm64/Auto\ Claude.app

# Linux
./dist/linux-unpacked/auto-claude
```

### Development Mode

For development with hot reload (optional):

```bash
npm run dev
```

> **Note**: Some features like auto-updates only work in packaged builds.

## Distribution Files

After packaging, the `dist` folder contains:

| Platform | Files |
|----------|-------|
| macOS | `Auto Claude.app`, `.dmg`, `.zip` |
| Windows | `Auto Claude Setup X.X.X.exe` (installer), `.zip`, `win-unpacked/` |
| Linux | `.AppImage`, `.deb`, `linux-unpacked/` |

## Testing

```bash
# Run tests
npm run test
```

## Linting

```bash
# Run ESLint
npm run lint

# Run type checking
npm run typecheck
```

## Features

- **Project Management**: Add, configure, and switch between multiple projects
- **Kanban Board**: Visual task board with columns for Backlog, In Progress, AI Review, Human Review, and Done
- **Task Creation Wizard**: Form-based interface for creating new tasks
- **Real-Time Progress**: Live updates during agent execution
- **Human Review Workflow**: Review QA results and provide feedback
- **Theme Support**: Light and dark mode
- **Auto Updates**: Automatic update notifications

## Tech Stack

- **Framework**: Electron + React 18 (TypeScript)
- **Build Tool**: electron-vite + electron-builder
- **UI Components**: Radix UI (shadcn/ui pattern)
- **Styling**: TailwindCSS
- **State Management**: Zustand

## Environment Variables

- `CLAUDE_CODE_OAUTH_TOKEN`: OAuth token for Claude Code SDK (from auto-claude/.env)
- `FALKORDB_URL`: FalkorDB connection URL (optional)

## License

AGPL-3.0
