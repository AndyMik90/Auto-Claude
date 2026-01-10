# Auto Claude Complete Setup Guide

This comprehensive guide will help you set up Auto Claude, understand all its features, and build your BD Automation Engine project step by step.

## Table of Contents

1. [Prerequisites & Installation](#1-prerequisites--installation)
2. [Initial Setup](#2-initial-setup)
3. [Understanding the Interface](#3-understanding-the-interface)
4. [Creating Your First Project](#4-creating-your-first-project)
5. [Building Tasks](#5-building-tasks)
6. [All Auto Claude Features Explained](#6-all-auto-claude-features-explained)
7. [Agent Types & Configuration](#7-agent-types--configuration)
8. [MCP Servers](#8-mcp-servers)
9. [Settings Deep Dive](#9-settings-deep-dive)
10. [Workflows & Best Practices](#10-workflows--best-practices)

---

## 1. Prerequisites & Installation

### Required Tools

Before you begin, ensure you have the following installed:

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Claude Pro/Max** | AI subscription for Claude Code | [claude.ai](https://claude.ai) |
| **Claude Code CLI** | Command-line tool for coding | `npm install -g @anthropic-ai/claude-code` |
| **Node.js/NPM** | JavaScript runtime | [nodejs.org](https://nodejs.org) |
| **Git** | Version control | [git-scm.com](https://git-scm.com) |
| **Python 3.12+** | Backend runtime | [python.org](https://python.org) |
| **Auto Claude Desktop App** | Main interface | [GitHub Releases](https://github.com/AndyMik90/Auto-Claude/releases) |

### Optional but Recommended

| Tool | Purpose |
|------|---------|
| **Notion** | Data storage & databases |
| **n8n** | Workflow automation |
| **Apify** | Web scraping service |
| **OpenAI API Key** | For Graphiti memory embeddings |

### Installation Steps

```bash
# 1. Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# 2. Verify installation
claude --version

# 3. Set up OAuth token
claude setup-token
```

---

## 2. Initial Setup

### Step 1: Download & Install Auto Claude

1. Go to [Auto Claude Releases](https://github.com/AndyMik90/Auto-Claude/releases)
2. Download the installer for your platform (Windows/macOS/Linux)
3. Run the installer and follow prompts
4. Launch Auto Claude

### Step 2: Connect Your Claude Account

1. Open Auto Claude
2. Click on **Settings** (gear icon)
3. Go to **Integrations** > **Claude Accounts**
4. Click **Add Account** - this opens Anthropic OAuth
5. Log in with your Claude credentials
6. Authorize the app
7. Your account should now show as "Active"

### Step 3: Configure API Keys (Settings > Integrations)

```
OpenAI API Key: [Required for Graphiti memory]
GitHub Personal Access Token: [For GitHub integration]
Linear API Key: [Optional - for Linear integration]
```

### Step 4: Verify Claude CLI Detection

1. Go to **Settings** > **Paths**
2. Verify all paths are auto-detected:
   - Python Path: Should show version 3.12+
   - Git Path: Should show git version
   - Claude CLI Path: Should show Claude version
   - GitHub CLI Path: (Optional) gh version

---

## 3. Understanding the Interface

### Main Navigation (Sidebar)

```
┌─────────────────────────────────────┐
│  📊 Kanban Board                    │  ← Task management
│  🖥️ Agent Terminals                │  ← Running AI sessions
│  💡 Insights                        │  ← Codebase Q&A
│  🗺️ Roadmap                         │  ← Strategic planning
│  💭 Ideation                        │  ← Generate ideas
│  📝 Changelog                       │  ← Track changes
│  🧠 Context                         │  ← Project knowledge
│  🔌 MCP Overview                    │  ← MCP server status
│  🌳 Worktrees                       │  ← Isolated workspaces
│  ⚙️ Settings                        │  ← Configuration
└─────────────────────────────────────┘
```

### Interface Overview

| Section | Purpose | When to Use |
|---------|---------|-------------|
| **Kanban Board** | Visual task tracking | Planning, tracking progress, reviewing |
| **Agent Terminals** | Watch AI work in real-time | During task execution |
| **Insights** | Ask questions about codebase | Understanding existing code |
| **Roadmap** | AI-generated feature planning | Strategic planning |
| **Ideation** | Generate improvement ideas | Finding enhancements |
| **Changelog** | Track all changes | Code review, documentation |
| **Context** | Project structure & memory | Building AI knowledge |
| **MCP Overview** | Server connections | Debugging, configuration |
| **Worktrees** | Isolated git workspaces | Feature development |

---

## 4. Creating Your First Project

### Method 1: Open Existing Folder

1. Click **"Open Project"** or **"New Project"**
2. Select your project folder (should be a git repo)
3. Auto Claude will:
   - Detect project type
   - Initialize `.auto-claude/` folder
   - Scan codebase for context

### Method 2: Create Fresh Project

1. Create a new folder on your computer
2. Initialize git: `git init`
3. Open folder in Auto Claude
4. Let it initialize the project structure

### Project Initialization

When you open a project, Auto Claude creates:

```
your-project/
├── .auto-claude/           # Auto Claude data (gitignored)
│   ├── specs/              # Task specifications
│   ├── graphiti/           # Memory data
│   └── security.json       # Security profile
└── ... (your project files)
```

### First-Time Setup Wizard

The setup wizard will ask:
1. **Project name** - Human-readable name
2. **Template** (optional) - Pre-configured setups
3. **Model selection** - Default Claude model
4. **CLAUDE.md** - Whether to use project instructions

---

## 5. Building Tasks

### Understanding the Task Lifecycle

```
Planning → In Progress → AI Review → Human Review → Done
    ↓          ↓            ↓            ↓
  Create    Agents       QA Agent     You verify
   spec      work        validates    and approve
```

### Creating a Task

#### Step 1: Go to Kanban Board
Click on the **Kanban Board** in the sidebar.

#### Step 2: Create New Task
Click **"+ New Task"** or **"Create Spec"**

#### Step 3: Define the Task

**Interactive Mode:**
```
Auto Claude will ask questions about your task:
- What do you want to build?
- What are the acceptance criteria?
- Any specific requirements?
```

**Direct Mode:**
```
Provide a description directly:
"Build a web scraper that collects job postings from ClearanceJobs
and saves them to a JSON file. Include error handling and rate limiting."
```

#### Step 4: Configure Task Settings

| Setting | Options | Recommendation |
|---------|---------|----------------|
| **Complexity** | Simple / Standard / Complex | Let AI assess or force one |
| **Model** | Opus 4.5 / Sonnet 4.5 / Haiku 4.5 | Opus for complex, Haiku for quick |
| **Thinking Level** | Low / Medium / High / Ultra Think | Ultra Think for complex tasks |
| **Agent Profile** | Auto / Complex / Balanced / Quick | Auto is usually best |

#### Step 5: Start the Build

1. Click **"Start Build"** or **"Run"**
2. Watch progress in **Agent Terminals**
3. Review in **Kanban Board** as status changes

### Task Phases

A Standard task goes through these phases:

1. **Discovery** - AI analyzes requirements
2. **Requirements** - Structured requirements created
3. **Research** (optional) - External API validation
4. **Context** - Codebase context gathered
5. **Spec** - Detailed specification written
6. **Plan** - Implementation plan created
7. **Validate** - Spec completeness checked
8. **Build** - Code implemented
9. **QA** - Automated testing & validation

---

## 6. All Auto Claude Features Explained

### 📊 Kanban Board

**Purpose:** Visual task management with drag-and-drop columns.

**Columns:**
| Column | Description |
|--------|-------------|
| **Planning** | Tasks being defined |
| **In Progress** | Tasks currently running |
| **AI Review** | QA Agent validating |
| **Human Review** | Waiting for your approval |
| **Done** | Completed tasks |

**How to Use:**
1. Drag tasks between columns
2. Click on a task to see details
3. Use filters to find specific tasks
4. Right-click for context menu (edit, delete, restart)

**Tips:**
- Keep no more than 2-3 tasks in "In Progress"
- Review "Human Review" items promptly
- Archive completed tasks periodically

---

### 🖥️ Agent Terminals

**Purpose:** Real-time view of AI agents working on tasks.

**Features:**
- One terminal per running agent
- See AI's thought process
- View code being written
- Intervene with additional instructions
- Run Claude in parallel on multiple terminals

**Creating New Terminals:**
1. Click **"+"** to add a new terminal tab
2. Each terminal can run an independent Claude session
3. Use for parallel work on different aspects

**Commands in Terminal:**
```bash
# Example interactions
> continue           # Resume paused work
> show progress      # See current status
> explain decision   # Ask why AI made a choice
> stop               # Halt current operation
```

**Parallel Sessions:**
- You can run multiple agents simultaneously
- Each has its own context
- Great for independent sub-tasks

---

### 💡 Insights (Chat)

**Purpose:** Ask questions about your codebase.

**How to Use:**
1. Click **Insights** in sidebar
2. Type your question in the chat box
3. AI analyzes codebase and responds

**Example Questions:**
```
"Where is user authentication handled?"
"How does the database connection work?"
"What API endpoints are available?"
"Explain the project architecture"
"What dependencies does this project use?"
```

**Configuration:**
- **Model:** Sonnet 4.5 (default) - good balance
- **Thinking Level:** Ultra Think for complex questions

---

### 🗺️ Roadmap

**Purpose:** AI-powered strategic feature planning.

**How to Use:**
1. Click **Roadmap** in sidebar
2. Click **"Generate Roadmap"**
3. AI analyzes your project and suggests:
   - Target audience
   - Feature priorities
   - Strategic improvements
   - Timeline recommendations

**What It Considers:**
- Current codebase state
- Industry best practices
- User needs (based on project type)
- Technical debt
- Growth opportunities

**Output Format:**
```
Phase 1: Foundation
├── Feature A - High priority
├── Feature B - Medium priority
└── Bug fixes

Phase 2: Enhancement
├── Feature C
└── Performance improvements

Phase 3: Scale
├── Feature D
└── Infrastructure updates
```

---

### 💭 Ideation

**Purpose:** Generate improvement ideas across categories.

**Categories:**
| Category | What It Finds |
|----------|---------------|
| **Code Improvements** | Refactoring opportunities |
| **UI/UX Improvements** | Interface enhancements |
| **Documentation** | Missing or outdated docs |
| **Security** | Vulnerability assessments |
| **Performance** | Optimization opportunities |
| **Code Quality** | Style, patterns, best practices |

**How to Use:**
1. Click **Ideation** in sidebar
2. Select category or "All"
3. Click **"Generate Ideas"**
4. Review suggestions
5. Create tasks from promising ideas

**Configuration:**
- **Model:** Opus 4.5 (default)
- **Thinking Level:** Ultra Think

---

### 📝 Changelog

**Purpose:** Track all project changes.

**Tabs:**
| Tab | Shows |
|-----|-------|
| **Completed Tasks** | All finished specs with summaries |
| **Git History** | Recent commits |
| **Branch Comparison** | Diff between branches |
| **Changelog Generator** | Auto-generate release notes |

**Changelog Generator:**
1. Select version range (e.g., v1.0.0...v1.1.0)
2. Click **"Generate"**
3. AI produces formatted changelog
4. Copy/export for releases

---

### 🧠 Context

**Purpose:** Manage what AI knows about your project.

**Tabs:**

#### Project Structure
- Visual file tree
- Detected project type
- Framework detection
- Key files highlighted

#### AI Discovered Knowledge
- Patterns found in code
- Architecture insights
- Dependencies mapped
- APIs discovered

#### Project Index/Memories
- Persistent knowledge
- Cross-session context
- Key facts about project
- Custom notes you add

**How to Use:**
1. Click **Context** in sidebar
2. Review auto-discovered information
3. Add custom context if needed
4. Refresh to re-scan codebase

---

### 🔌 MCP Overview

**Purpose:** Monitor Model Context Protocol servers.

**Available MCP Servers:**

| Server | Purpose | Auto-Enabled |
|--------|---------|--------------|
| **Context7** | Documentation lookup | Yes |
| **Graphiti Memory** | Cross-session memory | If configured |
| **Linear** | Issue tracking | If configured |
| **Electron** | E2E testing (Electron apps) | For QA agents |
| **Puppeteer** | Browser automation | For web projects |
| **Auto Claude Tools** | Custom tooling | Always |
| **Custom MCP Servers** | Your additions | Manual |

**How to Configure:**
1. Go to **MCP Overview**
2. See connected servers
3. Click server for details
4. Enable/disable as needed

---

### 🌳 Worktrees

**Purpose:** Isolated git workspaces for each task.

**How They Work:**
```
main (your branch)
└── auto-claude/{spec-name}  ← Isolated workspace
```

**Benefits:**
- Each task works in isolation
- No conflicts between parallel tasks
- Easy to review/discard changes
- Clean merge process

**Management:**
1. Click **Worktrees** in sidebar
2. See all active worktrees
3. **Refresh** to update list
4. Click worktree to open in IDE/terminal

**Lifecycle:**
1. **Created** - When build starts
2. **Active** - During development
3. **Ready for Review** - Build complete
4. **Merged** - Changes merged to main
5. **Discarded** - If you reject changes

---

## 7. Agent Types & Configuration

### Spec Creation Agents (7 agents)

| Agent | Model | Thinking | Purpose | MCP |
|-------|-------|----------|---------|-----|
| **Spec Gatherer** | Opus 4.5 | Ultra Think | Collect initial requirements | 0 |
| **Spec Researcher** | Opus 4.5 | Ultra Think | Validate external integrations | 1 |
| **Spec Writer** | Opus 4.5 | Ultra Think | Create spec.md document | 0 |
| **Spec Critic** | Opus 4.5 | Ultra Think | Self-critique analysis | 0 |
| **Spec Discovery** | Opus 4.5 | Ultra Think | Initial project analysis | 0 |
| **Spec Context** | Opus 4.5 | Ultra Think | Build codebase context | 0 |
| **Spec Validation** | Opus 4.5 | Ultra Think | Validate completeness | 0 |

### Build Agents (2 agents)

| Agent | Model | Thinking | Purpose | MCP |
|-------|-------|----------|---------|-----|
| **Planner** | Opus 4.5 | Ultra Think | Create implementation plan | 3 |
| **Coder** | Opus 4.5 | Ultra Think | Implement subtasks | 3 |

### QA Agents (2 agents)

| Agent | Model | Thinking | Purpose | MCP |
|-------|-------|----------|---------|-----|
| **QA Reviewer** | Opus 4.5 | Ultra Think | Validate acceptance criteria | 3 |
| **QA Fixer** | Opus 4.5 | Ultra Think | Fix QA-reported issues | 3 |

### Utility Agents (6 agents)

| Agent | Model | Thinking | Purpose | MCP |
|-------|-------|----------|---------|-----|
| **PR Reviewer** | Opus 4.5 | Ultra Think | Review GitHub PRs | 1 |
| **Commit Message** | Haiku 4.5 | Ultra Think | Generate commits | 0 |
| **Merge Resolver** | Haiku 4.5 | Ultra Think | Resolve merge conflicts | 0 |
| **Insights** | Sonnet 4.5 | Ultra Think | Extract code insights | 0 |
| **Analysis** | Sonnet 4.5 | Ultra Think | Codebase analysis | 1 |
| **Batch Analysis** | Opus 4.5 | Ultra Think | Batch processing | 0 |

### Ideation Agents (2 agents)

| Agent | Model | Thinking | Purpose | MCP |
|-------|-------|----------|---------|-----|
| **Ideation** | Opus 4.5 | Ultra Think | Generate feature ideas | 0 |
| **Roadmap Discovery** | Opus 4.5 | Ultra Think | Discover roadmap items | 1 |

### Agent Profiles

**Auto (Optimized)** - Default
- Uses Opus across all phases
- Optimized thinking levels per phase

**Complex Tasks**
- Claude Opus 4.5 everywhere
- Ultra Think for deep analysis

**Balanced**
- Claude Sonnet 4.5
- Medium thinking
- Good speed/quality balance

**Quick Edits**
- Claude Haiku 4.5
- Low thinking
- Fast iterations

---

## 8. MCP Servers

### What is MCP?

Model Context Protocol (MCP) allows Claude to interact with external tools and services.

### Built-in MCP Servers

#### Context7
- **Purpose:** Documentation and context lookup
- **Usage:** Automatically provides relevant docs
- **Configuration:** Enabled by default

#### Graphiti Memory
- **Purpose:** Persistent memory across sessions
- **Requires:** OpenAI API key for embeddings
- **Configuration:**
  ```env
  GRAPHITI_ENABLED=true
  OPENAI_API_KEY=your-key
  ```

#### Linear Integration
- **Purpose:** Issue tracking sync
- **Configuration:** Settings > Integrations > Linear

#### Electron MCP
- **Purpose:** E2E testing for Electron apps
- **Usage:** QA agents can interact with running app
- **Configuration:**
  ```env
  ELECTRON_MCP_ENABLED=true
  ELECTRON_DEBUG_PORT=9222
  ```

#### Puppeteer
- **Purpose:** Browser automation for web projects
- **Usage:** Automated testing, screenshots
- **Configuration:** Auto-detected for web projects

### Custom MCP Servers

You can add custom MCP servers:

1. Go to **MCP Overview**
2. Click **"Add Custom Server"**
3. Provide:
   - Server name
   - Command to run
   - Arguments
   - Environment variables

---

## 9. Settings Deep Dive

### Appearance

| Setting | Options |
|---------|---------|
| **Mode** | System / Light / Dark |
| **Color Theme** | Default, Oscura, Dusk, Lime, Ocean, Retro, Neo, Forest |

### Display

| Setting | Range |
|---------|-------|
| **Scale Presets** | 100% / 125% / 150% |
| **Fine-tune Scale** | 75% - 200% |

### Developer Tools

| Setting | Purpose |
|---------|---------|
| **Preferred IDE** | Where to open worktrees |
| **Preferred Terminal** | Where to open terminal sessions |

### Agent Settings

#### Default Agent Profile
- Auto (Optimized)
- Complex Tasks
- Balanced
- Quick Edits

#### Phase Configuration
Customize model and thinking for each phase:
- Spec Creation
- Planning
- Coding
- QA Review

#### Feature Model Settings
Configure models for:
- Insights Chat
- Ideation
- Roadmap
- GitHub Issues
- GitHub PR Review
- Utility

### Paths

| Path | Purpose |
|------|---------|
| **Python Path** | Python executable |
| **Git Path** | Git executable |
| **GitHub CLI Path** | gh executable |
| **Claude CLI Path** | claude executable |
| **Auto Claude Path** | Backend location |

### Integrations

#### Claude Accounts
- Add multiple Claude subscriptions
- Auto-switch on rate limits
- Set default account

#### API Keys
- OpenAI API Key (for Graphiti)
- Other service keys

#### GitHub Integration
- Personal Access Token or OAuth
- Repository connection
- Default branch setting
- Auto-sync on load

#### Linear Integration
- Enable sync
- API key configuration

#### GitLab Integration
- Enable sync
- API configuration

### Updates

| Setting | Purpose |
|---------|---------|
| **Check for Updates** | Manual update check |
| **Auto-Update Projects** | Auto-update in projects |
| **Beta Updates** | Enable pre-release versions |

### Notifications

| Setting | Default |
|---------|---------|
| **On Task Complete** | On |
| **On Task Failed** | On |
| **On Review Needed** | On |
| **Sound** | On |

### Debug & Logs

- **Open Logs Folder** - Access log files
- **Copy Debug Info** - For bug reports
- **Load Debug Info** - Import debug data

---

## 10. Workflows & Best Practices

### Recommended Workflow

```
1. PLAN
   ├── Define task in Kanban
   ├── Set complexity level
   └── Configure agent profile

2. BUILD
   ├── Start the build
   ├── Monitor in Agent Terminals
   └── Answer any agent questions

3. REVIEW
   ├── Check AI Review results
   ├── Test in worktree
   └── Request fixes if needed

4. MERGE
   ├── Approve changes
   ├── Merge to main
   └── Clean up worktree
```

### Tips for Success

1. **Start Small**
   - Begin with simple tasks
   - Learn the workflow
   - Gradually increase complexity

2. **Provide Context**
   - Use CLAUDE.md for project instructions
   - Keep Context updated
   - Add relevant documentation

3. **Use Appropriate Models**
   - Opus for complex logic
   - Sonnet for balanced work
   - Haiku for quick changes

4. **Monitor Progress**
   - Watch Agent Terminals
   - Check Kanban regularly
   - Review changelogs

5. **Iterate**
   - If first attempt fails, refine requirements
   - Use QA Fixer for issues
   - Learn from what works

### Common Commands

```bash
# From project root
npm run install:all    # Install all dependencies
npm run dev            # Run in development mode
npm run test:backend   # Run backend tests

# Backend specific (apps/backend/)
python spec_runner.py --interactive  # Create spec interactively
python run.py --spec 001            # Run spec build
python run.py --spec 001 --review   # Review changes
python run.py --spec 001 --merge    # Merge changes
python run.py --spec 001 --qa       # Run QA manually
```

---

## Quick Reference Card

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + N` | New Task |
| `Ctrl/Cmd + O` | Open Project |
| `Ctrl/Cmd + ,` | Settings |
| `Ctrl/Cmd + K` | Command Palette |

### Task Status Flow

```
Planning → In Progress → AI Review → Human Review → Done
              ↓
          (if issues)
              ↓
          QA Fixer → back to AI Review
```

### Getting Help

- **In-app:** Settings > Help
- **Issues:** https://github.com/anthropics/claude-code/issues
- **Documentation:** Check CLAUDE.md in projects

---

**Next Steps:** See `BD-AUTOMATION-ENGINE/README.md` for your specific project setup.
