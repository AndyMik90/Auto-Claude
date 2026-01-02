import type { Guide } from './types';

export const GUIDES: Guide[] = [
  {
    id: 'quickstart',
    title: 'Quick Start',
    description: 'Get Auto Claude running in 5 minutes',
    category: 'usage',
    icon: 'zap',
    content: `# Quick Start Guide

Get Auto Claude running in 5 minutes.

---

## Step 1: Download & Install

Download the app for your platform from the README.

| Platform | What to Download |
|----------|------------------|
| **Windows** | \`.exe\` installer |
| **macOS (M1/M2/M3)** | \`darwin-arm64.dmg\` |
| **macOS (Intel)** | \`darwin-x64.dmg\` |
| **Linux** | \`.AppImage\` or \`.deb\` |

---

## Step 2: Open Your Project

1. Launch Auto Claude
2. Click **"Open Project"** or drag a folder onto the window
3. Select a folder that contains a **git repository**

> **Important:** Your project must be a git repo. If it's not, run \`git init\` in your project folder first.

---

## Step 3: Connect to Claude

The app will prompt you to authenticate:

1. Click **"Connect Claude"** when prompted
2. This opens your browser to sign in with your Claude account
3. Approve the connection
4. You're authenticated!

> **Requires:** Claude Pro or Max subscription

---

## Step 4: Create Your First Task

1. Click the **"+ New Task"** button
2. Describe what you want to build:
   - "Add a dark mode toggle to the settings page"
   - "Fix the login button not working on mobile"
   - "Add user profile avatars with image upload"
3. Click **"Create"**

---

## Step 5: Watch It Build

Auto Claude will:

1. **Analyze** your codebase to understand the structure
2. **Plan** the implementation with specific subtasks
3. **Code** each subtask automatically
4. **Validate** the work with QA checks
5. **Complete** - ready for your review!

You can watch progress in the:
- **Kanban board** - visual task cards moving through stages
- **Agent terminals** - real-time agent output (click a task to see)

---

## Step 6: Review & Merge

When the task is in **"Human Review"**:

1. Click the task to see what changed
2. Review the code in the diff viewer
3. Test the changes in the isolated workspace
4. Click **"Merge"** to add changes to your project

> **Safe by default:** All changes happen in an isolated git worktree. Your main branch is never modified until you explicitly merge.

---

## Quick Tips

| Tip | How |
|-----|-----|
| **Pause a build** | Press \`Ctrl+C\` once in the terminal |
| **Add instructions mid-build** | Create a \`HUMAN_INPUT.md\` file in the spec folder |
| **Run multiple tasks** | Each task runs in its own isolated workspace |
| **See agent thinking** | Click the task card to open the agent terminal |
| **Test changes safely** | Navigate to \`.worktrees/{spec-name}/\` |
`
  },
  {
    id: 'user-guide',
    title: 'User Guide',
    description: 'Complete documentation for all Auto Claude features',
    category: 'usage',
    icon: 'book',
    content: `# Auto Claude User Guide

Complete documentation for all Auto Claude features.

---

## Overview

Auto Claude is an autonomous coding framework that uses multiple AI agents to build software. Describe what you want, and agents handle planning, implementation, and quality assurance.

### How It Works

\`\`\`text
You describe a task
       ↓
   [Spec Phase]     → Analyzes codebase, creates detailed specification
       ↓
  [Planning Phase]  → Creates subtask-based implementation plan
       ↓
   [Build Phase]    → Coder agent implements each subtask
       ↓
    [QA Phase]      → QA agent validates acceptance criteria
       ↓
  [Ready to Review] → You review and merge
\`\`\`

### Key Concepts

| Concept | Description |
|---------|-------------|
| **Spec** | Complete specification of what to build |
| **Subtask** | Small, atomic unit of work the coder implements |
| **Session** | One run of an agent with maintained context |
| **Worktree** | Isolated git workspace where changes happen |
| **QA Loop** | Automatic validation that catches issues |

---

## Navigation

The sidebar provides access to all features:

### Main Views

| View | Shortcut | Description |
|------|----------|-------------|
| **Kanban Board** | \`K\` | Visual task management |
| **Agent Terminals** | \`A\` | Real-time agent output |
| **Insights** | \`N\` | Chat interface for codebase exploration |
| **Roadmap** | \`D\` | AI-assisted feature planning |
| **Ideation** | \`I\` | Discover improvements and issues |
| **Changelog** | \`L\` | Generate release notes |
| **Context** | \`C\` | View codebase context |
| **MCP Overview** | \`M\` | Agent tool configuration |
| **Worktrees** | \`W\` | Manage git worktrees |

### Git Integration (when enabled)

| View | Shortcut | Description |
|------|----------|-------------|
| **GitHub Issues** | \`G\` | Browse and import GitHub issues |
| **GitHub PRs** | \`P\` | View and manage pull requests |
| **GitLab Issues** | \`B\` | Browse GitLab issues |
| **GitLab MRs** | \`R\` | View merge requests |

---

## Kanban Board

Visual task management from creation to completion.

### Task Columns

| Column | Meaning |
|--------|---------|
| **Planning** | Tasks being analyzed and spec created |
| **In Progress** | Being built by agents |
| **AI Review** | QA agent validating the implementation |
| **Human Review** | Complete - your review needed |
| **Done** | Merged into project |

### Task Cards

Each card shows:
- Task title and status
- Progress indicator (subtasks completed)
- Phase indicator
- Quick actions (pause, resume, view)

Click a card to see:
- Full specification
- Implementation plan
- Agent terminal output
- File changes

---

## Creating Tasks

### From the UI

1. Click **"+ New Task"** or press the new task button
2. Enter a description of what you want to build
3. (Optional) Override complexity level
4. Click **"Create"**

### Writing Good Descriptions

**Be specific:**

\`\`\`text
Add a user profile page that displays:
- Profile picture with upload capability
- Username and email
- Account creation date
- Edit profile button that opens a modal
\`\`\`

**Less effective:**

\`\`\`text
Add profiles
\`\`\`

### Complexity Tiers

| Tier | When Used | Phases |
|------|-----------|--------|
| **Simple** | 1-2 files, UI tweaks | 3 phases |
| **Standard** | Features, 3-10 files | 6 phases |
| **Complex** | Multi-service, 10+ files | 8 phases |

Auto Claude automatically assesses complexity, but you can override.

---

## The Build Process

### Phase 1: Spec Creation

Creates a detailed specification:

1. **Discovery** - Scans codebase structure
2. **Requirements** - Extracts user requirements
3. **Research** - Looks up APIs/libraries (if needed)
4. **Context** - Identifies files to modify
5. **Spec Writing** - Creates spec.md
6. **Validation** - Verifies completeness

### Phase 2: Planning

Creates implementation plan:
- Breaks into subtasks
- Orders by dependencies
- Identifies files per subtask
- Creates acceptance criteria

### Phase 3: Building

Implements each subtask:
1. Reads current subtask
2. Writes/modifies code
3. Runs tests
4. Commits changes
5. Moves to next subtask

### Phase 4: QA Validation

Validates implementation:
1. Reviews acceptance criteria
2. Runs automated tests
3. Checks for issues
4. Approves or creates fix requests

---

## Agent Terminals

View real-time agent output.

### Accessing Terminals

1. Click **"Agent Terminals"** in sidebar (or press \`A\`)
2. Select a task to view its terminal
3. Watch live agent thinking and actions

### Multiple Terminals

Run up to 12 agent terminals simultaneously for parallel tasks.

---

## Reviewing & Merging

### When a Task is Ready

The task moves to "Human Review" when:
- All subtasks completed
- QA validation passed

### Reviewing Changes

1. Click the task card
2. View file changes in the diff viewer
3. Test in the isolated worktree:
   \`\`\`bash
   cd .worktrees/001-my-feature/
   npm run dev  # or your start command
   \`\`\`

### Merging

When satisfied:
1. Click **"Merge"** on the task
2. Changes merge into your current branch
3. Worktree is cleaned up
4. Task moves to "Done"

### Discarding

If you don't want the changes:
1. Click **"Discard"**
2. Confirm the action
3. All changes are deleted

---

## Providing Feedback During Build

### Pausing a Task

- Click **"Pause"** on the task card
- Or press \`Ctrl+C\` in terminal

### Adding Instructions

Create \`HUMAN_INPUT.md\` in the spec directory:

\`\`\`bash
echo "Please use the existing Button component" > specs/001-my-feature/HUMAN_INPUT.md
\`\`\`

### Resuming

Click **"Resume"** or use:

\`\`\`bash
python run.py --spec 001 --continue
\`\`\`
`
  },
  {
    id: 'views-guide',
    title: 'Views & Tabs Guide',
    description: 'Detailed explanation of every tab and view in Auto Claude',
    category: 'reference',
    icon: 'layout',
    content: `# Auto Claude Views Guide

A detailed explanation of every tab and view in Auto Claude.

---

## Navigation Overview

The sidebar on the left provides access to all views:

\`\`\`text
MAIN VIEWS
├── Kanban Board (K)
├── Agent Terminals (A)
├── Insights (N)
├── Roadmap (D)
├── Ideation (I)
├── Changelog (L)
├── Context (C)
├── MCP Overview (M)
└── Worktrees (W)

GIT INTEGRATION (when enabled)
├── GitHub Issues (G)
├── GitHub PRs (P)
├── GitLab Issues (B)
└── GitLab MRs (R)
\`\`\`

---

## Kanban Board

**Shortcut:** \`K\`

The main task management interface. Visualizes all your tasks as cards moving through stages.

### Task Columns

| Column | Description |
|--------|-------------|
| **Planning** | Tasks being analyzed and spec created |
| **In Progress** | Agents actively building the feature |
| **AI Review** | QA agent validating the implementation |
| **Human Review** | Complete - waiting for your review |
| **Done** | Successfully merged into your project |

### Task Cards

Each card displays:
- **Title** - The task description
- **Status badge** - Current phase (e.g., "Coding", "AI Review")
- **Progress bar** - Subtasks completed vs total
- **Time indicator** - How long the task has been running

### Inline Action Buttons

| Button | When Available | What It Does |
|--------|----------------|--------------|
| **Start** | Task in Planning | Begin build execution |
| **Stop** | Task running | Stop the current build |
| **Resume** | Task stopped | Continue from where it left off |
| **Recover** | Task failed | Attempt recovery from failure |
| **Archive** | Task complete/stopped | Remove task from board |

---

## Agent Terminals

**Shortcut:** \`A\`

Real-time view of what agents are doing.

### What You'll See

| Output | Meaning |
|--------|---------|
| \`Reading: file.ts\` | Agent is examining a file |
| \`Writing: file.ts\` | Agent is modifying a file |
| \`Running: command\` | Agent is executing a command |
| \`✓ Tests passed\` | Tests succeeded |
| \`✗ Tests failed\` | Tests failed (agent will fix) |
| \`Subtask completed\` | One unit of work done |

### Features

- **Multiple terminals** - View up to 12 agents simultaneously
- **Live streaming** - See output as it happens
- **Auto-scroll** - Follows latest output
- **Task selector** - Switch between tasks

---

## Insights

**Shortcut:** \`N\`

Chat interface for exploring and understanding your codebase.

### What It Does

Have a conversation with AI about your code. Ask questions like:

- "How does the authentication flow work?"
- "Where is user input validated?"
- "What API endpoints exist for user management?"
- "How are database migrations handled?"

### Features

- **Chat history** - Previous conversations saved in sidebar
- **Multiple sessions** - Start new conversations for different topics
- **Model selection** - Choose which Claude model to use
- **Create tasks** - Convert insights into actionable tasks

---

## Roadmap

**Shortcut:** \`D\`

AI-assisted feature planning and roadmap generation.

### What It Does

1. **Codebase Analysis** - AI reviews your project structure
2. **Feature Suggestions** - Generates ideas based on your code
3. **Competitor Analysis** - (Optional) Compare against competitors
4. **Feature Organization** - Kanban-style planning board

### View Tabs

| Tab | Description |
|-----|-------------|
| **Kanban** | Features organized by status columns |
| **Phases** | Features grouped by implementation phase |
| **All Features** | Complete list of all features |
| **By Priority** | Features sorted by MoSCoW priority |

### Priority System (MoSCoW)

| Priority | Label | Meaning |
|----------|-------|---------|
| **Must** | Must Have | Critical for release |
| **Should** | Should Have | Important but not critical |
| **Could** | Could Have | Nice to have if time permits |
| **Won't** | Won't Have | Out of scope for now |

---

## Ideation

**Shortcut:** \`I\`

Automatic discovery of improvements, optimizations, and issues.

### Analysis Types

| Type | What It Finds |
|------|---------------|
| **Code Improvements** | Code quality suggestions, refactoring opportunities |
| **UI/UX Improvements** | User interface and experience enhancements |
| **Documentation** | Missing or outdated documentation |
| **Security** | Vulnerabilities, unsafe patterns, missing validation |
| **Performance** | Slow queries, inefficient algorithms, memory issues |
| **Code Quality** | Pattern violations, antipatterns, maintainability issues |

### Workflow

1. **Select types** - Choose what to scan for
2. **Generate** - AI analyzes your codebase
3. **Review ideas** - See what was found
4. **Take action** - Convert to task or dismiss

---

## Changelog

**Shortcut:** \`L\`

Generate professional release notes from completed work.

### Source Options

| Source | Best For |
|--------|----------|
| **Completed Tasks** | When using Auto Claude for all work |
| **Git History** | When mixing manual and Auto Claude work |
| **Branch Comparison** | For comparing changes between two branches |

### Configuration

| Setting | Options |
|---------|---------|
| **Format** | Keep a Changelog, Simple List, GitHub Release |
| **Audience** | Technical, User-Facing, Marketing |
| **Emoji Level** | None, Headings Only, Headings + Highlights, Everything |
| **Version** | Semantic version number |

---

## Context

**Shortcut:** \`C\`

View what Auto Claude knows about your project.

### Project Index

Shows the analyzed structure of your codebase:

- **Directory purposes** - What each folder is for
- **Key files** - Important files and their roles
- **Tech stack** - Detected frameworks and libraries
- **Patterns** - Coding patterns found

### Memories

If Graphiti memory is enabled, shows:
- **Recent memories** - What agents learned recently
- **Search** - Find specific memories
- **Patterns** - Recurring patterns discovered
- **Gotchas** - Known issues and pitfalls

---

## MCP Overview

**Shortcut:** \`M\`

Configure Model Context Protocol (MCP) servers and agent tools.

### Built-in MCP Servers

| Server | Purpose |
|--------|---------|
| **Context7** | Documentation lookup via @upstash/context7-mcp |
| **Graphiti Memory** | Knowledge graph for cross-session context |
| **Auto-Claude Tools** | Build progress, session context, discoveries & gotchas |
| **Linear** | Project management via Linear API |
| **Electron MCP** | Desktop app automation via Chrome DevTools Protocol |
| **Puppeteer MCP** | Web browser automation for non-Electron frontends |

---

## Worktrees

**Shortcut:** \`W\`

Manage git worktrees used for isolated builds.

### Information Displayed

- **Worktree name** - Matches the spec ID
- **Branch** - Git branch name
- **Status** - Ahead/behind, conflicts
- **Linked task** - Associated Auto Claude task
- **File changes** - Added/modified/deleted counts

### Actions

| Action | Description |
|--------|-------------|
| **Open** | Open worktree folder in file explorer |
| **Merge** | Merge worktree changes into main |
| **Delete** | Remove worktree and branch |
| **Refresh** | Update worktree status |

---

## GitHub Integration

### GitHub Issues (Shortcut: \`G\`)

- Browse repository issues
- Search and filter
- **Import as Task** - Create Auto Claude task from issue
- **Investigate** - AI analyzes the issue

### GitHub PRs (Shortcut: \`P\`)

- View open pull requests
- See PR details and changes
- AI-assisted PR review

---

## GitLab Integration

### GitLab Issues (Shortcut: \`B\`)

Same functionality as GitHub Issues for GitLab repositories.

### GitLab MRs (Shortcut: \`R\`)

Same functionality as GitHub PRs for GitLab merge requests.

---

## Summary Table

| View | Shortcut | Purpose |
|------|----------|---------|
| **Kanban Board** | \`K\` | Task management and progress visualization |
| **Agent Terminals** | \`A\` | Real-time agent output and debugging |
| **Insights** | \`N\` | Chat with AI about your codebase |
| **Roadmap** | \`D\` | Feature planning and prioritization |
| **Ideation** | \`I\` | Discover improvements and issues |
| **Changelog** | \`L\` | Generate release notes |
| **Context** | \`C\` | View project index and memories |
| **MCP Overview** | \`M\` | Configure agent tools |
| **Worktrees** | \`W\` | Manage isolated git workspaces |
| **GitHub Issues** | \`G\` | Import GitHub issues as tasks |
| **GitHub PRs** | \`P\` | View and review pull requests |
| **GitLab Issues** | \`B\` | Import GitLab issues as tasks |
| **GitLab MRs** | \`R\` | View merge requests |
`
  },
  {
    id: 'cli-usage',
    title: 'CLI Usage Guide',
    description: 'Terminal-only usage for power users, headless servers, and CI/CD integration',
    category: 'usage',
    icon: 'terminal',
    content: `# Auto Claude CLI Usage

This document covers terminal-only usage of Auto Claude. **For most users, we recommend using the Desktop UI instead** - it provides a better experience with visual task management, progress tracking, and automatic Python environment setup.

## When to Use CLI

- You prefer terminal workflows
- You're running on a headless server
- You're integrating Auto Claude into scripts or CI/CD

## Prerequisites

- Python 3.9+
- Claude Code CLI (\`npm install -g @anthropic-ai/claude-code\`)

### Installing Python

**Windows:**
\`\`\`bash
winget install Python.Python.3.12
\`\`\`

**macOS:**
\`\`\`bash
brew install python@3.12
\`\`\`

**Linux (Ubuntu/Debian):**
\`\`\`bash
sudo apt install python3.12 python3.12-venv
\`\`\`

**Linux (Fedora):**
\`\`\`bash
sudo dnf install python3.12
\`\`\`

## Setup

**Step 1:** Navigate to the backend directory

\`\`\`bash
cd apps/backend
\`\`\`

**Step 2:** Set up Python environment

\`\`\`bash
# Using uv (recommended)
uv venv && uv pip install -r requirements.txt

# Or using standard Python
python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
\`\`\`

**Step 3:** Configure environment

\`\`\`bash
cp .env.example .env

# Get your OAuth token
claude setup-token

# Add the token to apps/backend/.env
# CLAUDE_CODE_OAUTH_TOKEN=your-token-here
\`\`\`

## Creating Specs

All commands below should be run from the \`apps/backend/\` directory:

\`\`\`bash
# Activate the virtual environment (if not already active)
source .venv/bin/activate

# Create a spec interactively
python spec_runner.py --interactive

# Or with a task description
python spec_runner.py --task "Add user authentication with OAuth"

# Force a specific complexity level
python spec_runner.py --task "Fix button color" --complexity simple

# Continue an interrupted spec
python spec_runner.py --continue 001-my-feature
\`\`\`

### Complexity Tiers

The spec runner automatically assesses task complexity:

| Tier | Phases | When Used |
|------|--------|-----------|
| **SIMPLE** | 3 | 1-2 files, single service, no integrations (UI fixes, text changes) |
| **STANDARD** | 6 | 3-10 files, 1-2 services, minimal integrations (features, bug fixes) |
| **COMPLEX** | 8 | 10+ files, multiple services, external integrations |

## Running Builds

\`\`\`bash
# List all specs and their status
python run.py --list

# Run a specific spec
python run.py --spec 001
python run.py --spec 001-my-feature

# Limit iterations for testing
python run.py --spec 001 --max-iterations 5
\`\`\`

## QA Validation

After all chunks are complete, QA validation runs automatically:

\`\`\`bash
# Skip automatic QA
python run.py --spec 001 --skip-qa

# Run QA validation manually
python run.py --spec 001 --qa

# Check QA status
python run.py --spec 001 --qa-status
\`\`\`

The QA validation loop:
1. **QA Reviewer** checks all acceptance criteria
2. If issues found → creates \`QA_FIX_REQUEST.md\`
3. **QA Fixer** applies fixes
4. Loop repeats until approved (up to 50 iterations)

## Workspace Management

Auto Claude uses Git worktrees for isolated builds:

\`\`\`bash
# Test the feature in the isolated workspace
cd .worktrees/001-my-feature/
npm run dev  # or your project's run command

# Return to backend directory to run management commands
cd apps/backend

# See what was changed
python run.py --spec 001 --review

# Merge changes into your project
python run.py --spec 001 --merge

# Discard if you don't like it
python run.py --spec 001 --discard
\`\`\`

## Interactive Controls

While the agent is running:

\`\`\`bash
# Pause and add instructions
Ctrl+C (once)

# Exit immediately
Ctrl+C (twice)
\`\`\`

**File-based alternative:**
\`\`\`bash
# Create PAUSE file to pause after current session
touch specs/001-my-feature/PAUSE

# Add instructions
echo "Focus on fixing the login bug first" > specs/001-my-feature/HUMAN_INPUT.md
\`\`\`

## Spec Validation

\`\`\`bash
python validate_spec.py --spec-dir specs/001-my-feature --checkpoint all
\`\`\`

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| \`CLAUDE_CODE_OAUTH_TOKEN\` | Yes | OAuth token from \`claude setup-token\` |
| \`AUTO_BUILD_MODEL\` | No | Model override (default: claude-opus-4-5-20251101) |
`
  },
  {
    id: 'docker-setup',
    title: 'Docker & FalkorDB Setup',
    description: 'Installing and troubleshooting Docker for the Memory Layer with FalkorDB',
    category: 'setup',
    icon: 'container',
    content: `# Docker & FalkorDB Setup Guide

This guide covers installing and troubleshooting Docker for Auto Claude's Memory Layer. The Memory Layer uses FalkorDB (a graph database) to provide persistent cross-session memory for AI agents.

> **Good news!** If you're using the Desktop UI, it automatically detects Docker and FalkorDB status and offers one-click setup. This guide is for manual setup or troubleshooting.

## Quick Start

If Docker Desktop is already installed and running:

\`\`\`bash
# Start FalkorDB
docker run -d --name auto-claude-falkordb -p 6379:6379 falkordb/falkordb:latest

# Verify it's running
docker ps | grep falkordb
\`\`\`

---

## What is Docker?

Docker is a tool that runs applications in isolated "containers". Think of it as a lightweight virtual machine that:

- **Keeps things contained** - FalkorDB runs inside Docker without affecting your system
- **Makes setup easy** - One command to start, no complex installation
- **Works everywhere** - Same setup on Mac, Windows, and Linux

**You don't need to understand Docker** - just install Docker Desktop and Auto Claude handles the rest.

---

## Installing Docker Desktop

### macOS

#### Step 1: Download

| Mac Type | Download Link |
|----------|---------------|
| **Apple Silicon (M1/M2/M3/M4)** | Download for Apple Chip |
| **Intel** | Download for Intel Chip |

> **Which do I have?** Click the Apple logo → "About This Mac". Look for "Chip" - if it says Apple M1/M2/M3/M4, use Apple Silicon. If it says Intel, use Intel.

#### Step 2: Install

1. Open the downloaded \`.dmg\` file
2. Drag the Docker icon to your Applications folder
3. Open Docker from Applications (or Spotlight: Cmd+Space, type "Docker")
4. Click "Open" if you see a security warning
5. **Wait** - Docker takes 1-2 minutes to start the first time

#### Step 3: Verify

Look for the whale icon in your menu bar. When it stops animating, Docker is ready.

\`\`\`bash
docker --version
# Expected: Docker version 24.x.x or higher
\`\`\`

### Windows

#### Prerequisites

- Windows 10 (version 2004 or higher) or Windows 11
- WSL 2 enabled (Docker will prompt you to install it)

#### Step 1: Install

1. Download Docker Desktop for Windows
2. Run the downloaded installer
3. **Keep "Use WSL 2" checked** (recommended)
4. Follow the installation wizard with default settings
5. **Restart your computer** when prompted
6. After restart, Docker Desktop will start automatically

### Linux

#### Ubuntu/Debian

\`\`\`bash
# Update package index
sudo apt-get update

# Install prerequisites
sudo apt-get install ca-certificates curl gnupg

# Install Docker
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-compose-plugin

# Add your user to the docker group (to run without sudo)
sudo usermod -aG docker $USER

# Log out and back in, then verify
docker --version
\`\`\`

---

## Starting FalkorDB

### Option 1: Using Docker Compose (Recommended)

From the Auto Claude root directory:

\`\`\`bash
# Start FalkorDB only (for Python library integration)
docker-compose up -d falkordb

# Or start both FalkorDB + Graphiti MCP server (for agent memory access)
docker-compose up -d
\`\`\`

### Option 2: Using Docker Run

\`\`\`bash
docker run -d \\
  --name auto-claude-falkordb \\
  -p 6379:6379 \\
  --restart unless-stopped \\
  falkordb/falkordb:latest
\`\`\`

### Option 3: Let the Desktop UI Handle It

If you're using the Auto Claude Desktop UI:

1. Go to Project Settings → Memory Backend
2. Enable "Use Graphiti"
3. The UI will show Docker/FalkorDB status
4. Click "Start" to launch FalkorDB automatically

---

## Verifying Your Setup

### Check Docker is Running

\`\`\`bash
docker info
# Should show Docker system information without errors
\`\`\`

### Check FalkorDB is Running

\`\`\`bash
docker ps | grep falkordb
# Should show the running container
\`\`\`

### Test FalkorDB Connection

\`\`\`bash
docker exec auto-claude-falkordb redis-cli PING
# Expected response: PONG
\`\`\`

---

## Troubleshooting

### Docker Issues

| Problem | Solution |
|---------|----------|
| **"docker: command not found"** | Docker Desktop isn't installed or isn't in PATH. Reinstall Docker Desktop. |
| **"Cannot connect to Docker daemon"** | Docker Desktop isn't running. Open Docker Desktop and wait for it to start. |
| **"permission denied"** | On Linux, add your user to the docker group: \`sudo usermod -aG docker $USER\` then log out and back in. |
| **Docker Desktop won't start** | Try restarting your computer. On Mac, check System Preferences → Security for blocked apps. |

### FalkorDB Issues

| Problem | Solution |
|---------|----------|
| **Container won't start** | Check if port 6379 is in use: \`lsof -i :6379\` (Mac/Linux) or \`netstat -ano | findstr 6379\` (Windows) |
| **"port is already allocated"** | Stop conflicting container: \`docker stop auto-claude-falkordb && docker rm auto-claude-falkordb\` |
| **Connection refused** | Verify container is running: \`docker ps\`. If not listed, start it again. |
`
  },
  {
    id: 'architecture',
    title: 'Architecture Overview',
    description: 'Understanding how Auto Claude works internally',
    category: 'reference',
    icon: 'layers',
    content: `# Auto Claude Architecture

This document explains how Auto Claude works under the hood.

## Core Components

### 1. Spec Creation Pipeline

The spec runner (\`spec_runner.py\`) creates task specifications through a multi-phase pipeline:

\`\`\`
Task Description
      ↓
[Discovery] → Analyze codebase structure
      ↓
[Requirements] → Extract user requirements
      ↓
[Research] → Validate external integrations (optional)
      ↓
[Context] → Build relevant codebase context
      ↓
[Spec Writing] → Create specification document
      ↓
[Planning] → Create implementation plan
      ↓
[Validation] → Verify spec completeness
\`\`\`

### Complexity Tiers

| Tier | Phases | Use Case |
|------|--------|----------|
| **SIMPLE** | 3 | 1-2 files, UI fixes, text changes |
| **STANDARD** | 6 | 3-10 files, features, bug fixes |
| **COMPLEX** | 8 | 10+ files, multiple services, integrations |

### 2. Implementation Pipeline

The runner (\`run.py → agent.py\`) executes the build:

\`\`\`
Specification
      ↓
[Planner Agent] → Create subtask-based plan
      ↓
[Coder Agent] → Implement each subtask
      ↓
[QA Reviewer] → Validate acceptance criteria
      ↓
[QA Fixer] → Fix issues (if any)
      ↓
Complete
\`\`\`

### 3. Agent Types

| Agent | Prompt File | Purpose |
|-------|-------------|---------|
| Planner | planner.md | Creates implementation plan with subtasks |
| Coder | coder.md | Implements individual subtasks |
| Coder Recovery | coder_recovery.md | Recovers from stuck/failed subtasks |
| QA Reviewer | qa_reviewer.md | Validates acceptance criteria |
| QA Fixer | qa_fixer.md | Fixes QA-reported issues |
| BUGFINDER-X | bugfinder.md | Autonomous debugging agent |

## Security Model

Three-layer defense protects your system:

### Layer 1: OS Sandbox
- Bash commands run in isolated environment
- Controlled by Claude Code SDK

### Layer 2: Filesystem Permissions
- Operations restricted to project directory
- Cannot access system files

### Layer 3: Command Allowlist
- Dynamic allowlist based on project analysis
- \`security.py\` + \`project_analyzer.py\` detect your stack
- Only relevant commands are permitted

Security profile is cached in \`.auto-claude-security.json\`.

## Workspace Isolation

### Git Worktree Strategy

\`\`\`
main (your branch)
    └── auto-claude/{spec-name}  ← spec branch (isolated worktree)
\`\`\`

Key principles:
- **ONE branch per spec** (\`auto-claude/{spec-name}\`)
- **NO automatic pushes** - you control when to push
- **Isolated testing** in \`.worktrees/{spec-name}/\`
- **Safe merging** - spec branch → main after approval

### Workflow

1. Build runs in isolated worktree on spec branch
2. Agent implements subtasks (can spawn subagents for parallel work)
3. User tests feature in \`.worktrees/{spec-name}/\`
4. User runs \`--merge\` to add to their project
5. User pushes to remote when ready

## Memory System

Dual-layer memory architecture:

### File-Based Memory (Primary)
- \`memory.py\`
- Zero dependencies, always available
- Human-readable files in \`specs/XXX/memory/\`
- Stores: session insights, patterns, gotchas, codebase map

### Graphiti Memory (Optional)
- \`graphiti_memory.py\`
- Graph database with semantic search
- Uses LadybugDB (embedded, no Docker required for basic use)
- Cross-session context retrieval
- Requires Python 3.12+

## Spec Directory Structure

Each spec in \`auto-claude/specs/XXX-name/\` contains:

| File | Purpose |
|------|---------|
| \`spec.md\` | Feature specification |
| \`requirements.json\` | Structured user requirements |
| \`context.json\` | Discovered codebase context |
| \`implementation_plan.json\` | Subtask-based plan with status |
| \`qa_report.md\` | QA validation results |
| \`QA_FIX_REQUEST.md\` | Issues to fix (when rejected) |
| \`BUG_REPORT.md\` | Bug description for BUGFINDER-X |
| \`DEBUG_REPORT.md\` | BUGFINDER-X findings |

## Key Files

| File | Description |
|------|-------------|
| \`run.py\` | Main entry point, CLI interface |
| \`agent.py\` | Agent execution logic |
| \`client.py\` | Claude SDK client wrapper |
| \`security.py\` | Command allowlist enforcement |
| \`project_analyzer.py\` | Stack detection |
| \`worktree.py\` | Git worktree management |
| \`memory.py\` | File-based memory |
| \`spec_runner.py\` | Spec creation pipeline |
`
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    description: 'Common issues and their solutions',
    category: 'reference',
    icon: 'wrench',
    content: `# Troubleshooting Guide

Common issues and their solutions.

---

## Authentication Issues

### "No OAuth token found"

**Symptoms:**
\`\`\`text
Error: No OAuth token found.
Auto Claude requires Claude Code OAuth authentication.
\`\`\`

**Solutions:**

1. **Run the setup command:**
   \`\`\`bash
   claude setup-token
   \`\`\`

2. **Verify the token was saved:**
   - **macOS:** Check Keychain Access for "Claude Code-credentials"
   - **Windows:** Check \`%USERPROFILE%\\.claude\\.credentials.json\`
   - **Linux:** Set \`CLAUDE_CODE_OAUTH_TOKEN\` in \`.env\`

3. **Manual token setup:**
   \`\`\`bash
   # Add to apps/backend/.env
   CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-your-token-here
   \`\`\`

### "OAuth token expired"

**Symptoms:**
- Authentication errors after working previously
- "Invalid token" errors

**Solution:**
\`\`\`bash
# Re-authenticate
claude setup-token
\`\`\`

### "Subscription required"

**Symptoms:**
\`\`\`text
Error: Claude Pro or Max subscription required
\`\`\`

**Solution:**
- Upgrade at claude.ai/upgrade
- Ensure you're signed in with the subscribed account

---

## Build/Task Issues

### Task stuck on "Spec Creation"

**Possible causes:**
1. Large codebase taking time to analyze
2. Network issues
3. Agent error

**Solutions:**

1. **Wait** - Large codebases can take 5-10 minutes
2. **Check the terminal** - Click the task to see agent output
3. **Check for errors** in the terminal output
4. **Restart the task:**
   - Click "Discard"
   - Create a new task with the same description

### Build incomplete

**Symptoms:**
\`\`\`text
❌ Build is not complete. Cannot run QA validation.
   Progress: 5/10 subtasks completed
\`\`\`

**Solutions:**

1. **Continue the build:**
   \`\`\`bash
   python run.py --spec 001 --continue
   \`\`\`

2. **Check for stuck subtasks:**
   - Look at \`implementation_plan.json\` for "in_progress" or "failed" subtasks
   - The agent may have encountered an error

3. **Reset a stuck subtask:**
   - Edit \`implementation_plan.json\`
   - Change the stuck subtask's status to "pending"
   - Re-run the build

### Agent keeps failing on same subtask

**Symptoms:**
- Same error repeated
- "Circular fix detected" message
- Task never progresses

**Solutions:**

1. **Provide human guidance:**
   \`\`\`bash
   echo "For subtask X, try using the existing UserService instead of creating a new one" > specs/001-my-feature/HUMAN_INPUT.md
   \`\`\`

2. **Simplify the subtask:**
   - Edit \`implementation_plan.json\`
   - Split the problematic subtask into smaller pieces

3. **Skip the subtask:**
   - Mark it as "completed" manually in \`implementation_plan.json\`
   - Add a note about what needs to be done manually

### "Context exhausted"

**Symptoms:**
\`\`\`text
Error: Context window exhausted
\`\`\`

**Solutions:**

1. **This is expected** - The agent commits progress and continues in a new session
2. **If it happens repeatedly:**
   - Your subtasks may be too large
   - Split them into smaller pieces in \`implementation_plan.json\`

---

## QA Loop Issues

### QA loop running too long

**Symptoms:**
- QA iteration count keeps increasing
- Same issues being found repeatedly

**Solutions:**

1. **Check for recurring issues:**
   - Look at \`qa_report.md\` for patterns
   - After 3 occurrences of the same issue, the system escalates to human

2. **Provide guidance:**
   \`\`\`bash
   echo "The login test is flaky due to timing - skip it for now" > specs/001-my-feature/HUMAN_INPUT.md
   \`\`\`

3. **Force approval (use carefully):**
   - Edit \`implementation_plan.json\`
   - Set \`qa_signoff.status\` to \`"approved"\`

### Tests failing that shouldn't

**Symptoms:**
- QA reports test failures for unrelated code
- Tests pass locally but fail in QA

**Solutions:**

1. **Check test isolation:**
   - Tests may depend on global state
   - Tests may have race conditions

2. **Skip flaky tests temporarily:**
   - Add guidance in \`HUMAN_INPUT.md\`

3. **Run tests manually in the worktree:**
   \`\`\`bash
   cd .worktrees/001-my-feature/
   npm test  # or pytest, etc.
   \`\`\`

---

## Merge Issues

### "Merge conflicts detected"

**Symptoms:**
\`\`\`text
Merge conflicts in 3 files
\`\`\`

**Solutions:**

1. **Auto Claude tries AI-assisted merge first**
   - Wait for the automatic resolution attempt

2. **If automatic merge fails:**
   \`\`\`bash
   cd .worktrees/001-my-feature/
   git status  # See conflicted files
   # Resolve manually, then:
   git add .
   git commit -m "Resolved conflicts"
   \`\`\`

3. **Re-attempt merge from UI**

### Worktree cleanup failed

**Symptoms:**
- Error about worktree still existing
- Can't create new tasks

**Solutions:**

1. **Manual cleanup:**
   \`\`\`bash
   # List all worktrees
   git worktree list

   # Remove the problematic one
   git worktree remove .worktrees/001-my-feature --force

   # Prune stale entries
   git worktree prune
   \`\`\`

---

## Memory System Issues

### "Graphiti not available"

**Symptoms:**
\`\`\`text
Graphiti not available: [reason]
Using file-based memory as fallback
\`\`\`

**Solutions:**

1. **Check configuration:**
   \`\`\`bash
   # Verify in apps/backend/.env
   GRAPHITI_ENABLED=true
   \`\`\`

2. **Check provider credentials:**
   \`\`\`bash
   # At least one of these must be set:
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_API_KEY=...
   \`\`\`

3. **File-based fallback works fine**
   - Memory still saves to \`specs/001-my-feature/memory/\`
   - Just without semantic search capabilities

---

## Platform-Specific Issues

### Windows: Unicode errors

**Symptoms:**
\`\`\`text
UnicodeEncodeError: 'charmap' codec can't encode character
\`\`\`

**Solutions:**

1. **Set environment variable:**
   \`\`\`cmd
   set PYTHONUTF8=1
   \`\`\`

2. **Or add to \`.env\`:**
   \`\`\`text
   PYTHONUTF8=1
   \`\`\`

### Windows: Path too long

**Symptoms:**
\`\`\`text
OSError: [WinError 206] The filename or extension is too long
\`\`\`

**Solutions:**

1. **Enable long paths in Windows:**
   \`\`\`powershell
   # Run as Administrator
   New-ItemProperty -Path "HKLM:\\SYSTEM\\CurrentControlSet\\Control\\FileSystem" -Name "LongPathsEnabled" -Value 1 -PropertyType DWORD -Force
   \`\`\`

2. **Move project to shorter path:**
   - \`C:\\projects\\myapp\` instead of \`C:\\Users\\username\\Documents\\development\\projects\\myapp\`

### macOS: Keychain access denied

**Symptoms:**
\`\`\`text
Error accessing macOS Keychain
\`\`\`

**Solutions:**

1. **Allow access in Keychain:**
   - Open Keychain Access
   - Find "Claude Code-credentials"
   - Right-click → Get Info → Access Control
   - Add your terminal app

2. **Use environment variable instead:**
   \`\`\`bash
   export CLAUDE_CODE_OAUTH_TOKEN=sk-ant-oat01-...
   \`\`\`

### Linux: Missing dependencies

**Symptoms:**
\`\`\`text
ImportError: libXXX.so not found
\`\`\`

**Solutions:**
\`\`\`bash
# Ubuntu/Debian
sudo apt install python3-dev libffi-dev

# Fedora
sudo dnf install python3-devel libffi-devel
\`\`\`

---

## Performance Issues

### Slow spec creation

**Causes:**
- Large codebase (10,000+ files)
- Slow disk
- Limited memory

**Solutions:**

1. **Exclude unnecessary directories:**
   - Add to \`.gitignore\` (Auto Claude respects it)
   - Especially: \`node_modules/\`, \`venv/\`, \`.git/\`, build artifacts

2. **Use SSD storage**

3. **Increase available memory**

### Agent responses slow

**Causes:**
- API rate limiting
- Network issues
- Large context-window

**Solutions:**

1. **Check network:**
   \`\`\`bash
   ping api.anthropic.com
   \`\`\`

2. **Reduce context:**
   - Smaller subtasks = faster responses
   - Split large tasks

---

## Still Having Issues?

1. **Enable debug mode:**
   \`\`\`bash
   DEBUG=true python run.py --spec 001
   \`\`\`

2. **Check logs:**
   - App logs: Click "View Logs" in settings
   - Backend logs: \`apps/backend/logs/\`

3. **Get help:**
   - GitHub Issues: github.com/AndyMik90/Auto-Claude/issues
   - GitHub Discussions: github.com/AndyMik90/Auto-Claude/discussions

When reporting issues, include:
- Auto Claude version
- Operating system
- Error messages (full text)
- Steps to reproduce
- Debug output if available
`
  },
  {
    id: 'faq',
    title: 'Frequently Asked Questions',
    description: 'Common questions about Auto Claude, pricing, workflow, and integrations',
    category: 'faq',
    icon: 'help',
    content: `# Frequently Asked Questions

---

## General

### What is Auto Claude?

Auto Claude is an autonomous coding framework that uses multiple AI agents to build software. You describe what you want, and it handles planning, implementation, and quality assurance automatically.

### How is this different from using Claude directly?

| Claude (chat) | Auto Claude |
|---------------|-------------|
| Single conversation | Multi-agent coordination |
| You guide each step | Autonomous execution |
| No memory between sessions | Persistent memory |
| Manual code application | Automatic code changes |
| No QA validation | Built-in QA loop |

### Is my code sent to Anthropic?

Yes, like any Claude interaction:
- Your code is processed by Claude's API
- Anthropic's standard privacy policy applies
- Code is not used to train models (per Anthropic's policy)

### What languages/frameworks are supported?

Auto Claude works with any language or framework. It analyzes your project to understand the tech stack. Commonly tested with:
- JavaScript/TypeScript (React, Next.js, Node.js)
- Python (Django, Flask, FastAPI)
- Go, Rust, Java, C#
- And many more

---

## Pricing & Subscriptions

### What subscription do I need?

**Claude Pro or Claude Max subscription** is required.

- Claude Pro: Standard rate limits
- Claude Max: Higher rate limits, recommended for heavy use

### Does Auto Claude cost extra?

No additional cost beyond your Claude subscription. Auto Claude uses the Claude Code OAuth system which is included with Pro/Max subscriptions.

### Are there API costs?

Not for the main agents. However, optional features may have costs:
- **Memory System (Graphiti)** - Requires embedding provider (OpenAI, etc.)
- **Linear Integration** - Free with Linear account

---

## Tasks & Workflow

### How long does a task take?

Depends on complexity:

| Complexity | Typical Time |
|------------|--------------|
| Simple (1-2 files) | 5-15 minutes |
| Standard (3-10 files) | 15-45 minutes |
| Complex (10+ files) | 45+ minutes |

### Can I run multiple tasks at once?

Yes! Each task runs in an isolated git worktree. You can run up to 12 agent terminals simultaneously.

### What if the agent makes a mistake?

Several safeguards:
1. **QA validation** catches most issues
2. **Isolated worktrees** protect your main branch
3. **You review before merging**
4. **You can discard** any task completely

### Can I modify the code while a task is running?

**In the worktree:** Not recommended while agents are active (can cause conflicts)

**In your main branch:** Yes! The worktree is isolated.

### How do I provide feedback during a build?

1. Create \`HUMAN_INPUT.md\` in the spec directory:
   \`\`\`bash
   echo "Use the existing Button component" > specs/001-my-feature/HUMAN_INPUT.md
   \`\`\`

2. Or pause the task and add instructions via the UI

### Can I edit the implementation plan?

Yes! Edit \`specs/{spec-name}/implementation_plan.json\`:
- Change subtask order
- Modify subtask descriptions
- Add or remove subtasks
- Mark subtasks as completed/pending

---

## Quality & Security

### How reliable is the code it produces?

Quality depends on:
- **Task clarity** - Clear descriptions produce better results
- **Codebase complexity** - Well-organized code = better results
- **QA validation** - Catches most issues before you review

Always review code before deploying to production.

### What security controls are in place?

Three-layer security model:

1. **OS Sandbox** - Bash commands run in isolation
2. **Filesystem Restrictions** - Operations limited to project directory
3. **Dynamic Command Allowlist** - Only approved commands for your tech stack

### Can it access the internet?

Limited:
- **Web search** for documentation lookup
- **API calls** your project normally makes
- **No arbitrary network access**

### Can it delete my files?

Only within the project directory, and:
- All changes happen in isolated worktrees
- Your main branch is protected
- You can discard any changes

---

## Memory System

### What is the Memory Layer?

Graphiti-based persistent memory that helps agents:
- Remember patterns from your codebase
- Recall past gotchas and solutions
- Maintain context across sessions

### Is the Memory Layer required?

No. It's optional but recommended. Without it:
- Each session starts fresh
- Agents may repeat past mistakes
- Less efficient for complex projects

### Where is memory data stored?

Locally in your project:
\`\`\`text
.auto-claude/specs/001-my-feature/memory/      # File-based fallback
.auto-claude/specs/001-my-feature/graphiti/    # Graphiti database
\`\`\`

---

## Git & Version Control

### What happens to my git history?

Each subtask creates a commit. Your history looks like:
\`\`\`text
abc123 feat(user): Add avatar upload endpoint
def456 feat(user): Add avatar component
ghi789 feat(user): Add avatar styling
\`\`\`

### What if I have uncommitted changes?

Auto Claude creates a worktree from your current branch. Uncommitted changes in your main directory are preserved.

### Can I use this with git-flow or trunk-based development?

Yes! Auto Claude creates feature branches:
- \`auto-claude/001-feature-name\`

You merge into your workflow however you prefer.

---

## Integrations

### How do I use with GitHub Issues?

1. Connect GitHub in the app settings
2. Go to GitHub tab
3. Browse/search issues
4. Click "Import as Task" or "Investigate"

### How do I use with GitLab?

Add to \`apps/backend/.env\`:
\`\`\`bash
GITLAB_TOKEN=glpat-...
GITLAB_INSTANCE_URL=https://gitlab.example.com  # or omit for gitlab.com
\`\`\`

### How do I use with Linear?

Add to \`apps/backend/.env\`:
\`\`\`bash
LINEAR_API_KEY=lin_api_...
\`\`\`

Tasks automatically sync:
- New task → Linear issue created
- Progress → Linear status updated
- Complete → Linear issue closed

---

## Technical

### What models does Auto Claude use?

Three Claude models are available:

| Model | ID | Best For |
|-------|------|----------|
| **Opus** | \`claude-opus-4-5-20251101\` | Complex tasks, highest quality (default) |
| **Sonnet** | \`claude-sonnet-4-5-20250929\` | Balanced speed and quality |
| **Haiku** | \`claude-haiku-4-5-20251001\` | Fast utility operations, cost-effective |

Override with:
\`\`\`bash
AUTO_BUILD_MODEL=claude-sonnet-4-5-20250929
\`\`\`

### Can I use my own API key?

No. Auto Claude is designed to use Claude Code OAuth tokens only. This ensures:
- Proper rate limiting
- Subscription verification
- No accidental API charges

### What's the difference between CLI and Desktop app?

| CLI | Desktop App |
|-----|-------------|
| Terminal-based | Visual interface |
| Manual Python setup | Auto-configured |
| Good for servers/CI | Good for daily use |
| Same core functionality | Same core functionality |

### Can I run this on a server?

Yes! Use the CLI:
\`\`\`bash
cd apps/backend
python run.py --spec 001
\`\`\`

See the CLI Usage guide for details.

---

## Troubleshooting

### Where do I get help?

1. Check the Troubleshooting guide in this Knowledge Base
2. GitHub Issues - Bug reports
3. GitHub Discussions - Questions

### How do I report a bug?

1. Go to GitHub Issues
2. Click "New Issue"
3. Include:
   - Your operating system and version
   - Auto Claude version
   - Steps to reproduce
   - Error messages or logs

---

## Contributing

### How can I contribute?

See CONTRIBUTING.md for:
- Development setup
- Code guidelines
- PR process
- Testing requirements

### Is Auto Claude open source?

Yes! Licensed under **AGPL-3.0**:
- Free to use
- Free to modify
- Modifications must be shared if distributed
- Commercial licensing available for closed-source use
`
  }
];

export const GUIDE_CATEGORIES = [
  { id: 'all', label: 'All Guides' },
  { id: 'usage', label: 'Usage' },
  { id: 'setup', label: 'Setup' },
  { id: 'reference', label: 'Reference' },
  { id: 'faq', label: 'FAQ' }
] as const;
