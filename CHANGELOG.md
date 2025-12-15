## What's New in 2.0.1

### 🚀 New Features
- **Update Check with Release URLs**: Enhanced update checking functionality to include release URLs, allowing users to easily access release information
- **Markdown Renderer for Release Notes**: Added markdown renderer in advanced settings to properly display formatted release notes
- **Terminal Name Generator**: New feature for generating terminal names

### 🔧 Improvements
- **LLM Provider Naming**: Updated project settings to reflect new LLM provider name
- **IPC Handlers**: Improved IPC handlers for external link management
- **UI Simplification**: Refactored App component to simplify project selection display by removing unnecessary wrapper elements
- **Docker Infrastructure**: Updated FalkorDB service container naming in docker-compose configuration
- **Documentation**: Improved README with dedicated CLI documentation and infrastructure status information

### 📚 Documentation
- Enhanced README with comprehensive CLI documentation and setup instructions
- Added Docker infrastructure status documentation

## What's New in v2.0.0

### New Features
- **Task Integration**: Connected ideas to tasks with "Go to Task" functionality across the UI
- **File Explorer Panel**: Implemented file explorer panel with directory listing capabilities
- **Terminal Task Selection**: Added task selection dropdown in terminal with auto-context loading
- **Task Archiving**: Introduced task archiving functionality
- **Graphiti MCP Server Integration**: Added support for Graphiti memory integration
- **Roadmap Functionality**: New roadmap visualization and management features

### Improvements
- **File Tree Virtualization**: Refactored FileTree component to use efficient virtualization for improved performance with large file structures
- **Agent Parallelization**: Improved Claude Code agent decision-making for parallel task execution
- **Terminal Experience**: Enhanced terminal with task features and visual feedback for better user experience
- **Python Environment Detection**: Auto-detect Python environment readiness before task execution
- **Version System**: Cleaner version management system
- **Project Initialization**: Simpler project initialization process

### Bug Fixes
- Fixed project settings bug
- Fixed insight UI sidebar
- Resolved Kanban and terminal integration issues

### Changed
- Updated project-store.ts to use proper Dirent type for specDirs variable
- Refactored codebase for better code quality
- Removed worktree-worker logic in favor of Claude Code's internal agent system
- Removed obsolete security configuration file (.auto-claude-security.json)

### Documentation
- Added CONTRIBUTING.md with development guidelines

## What's New in v1.1.0

### New Features
- **Follow-up Tasks**: Continue working on completed specs by adding new tasks to existing implementations. The system automatically re-enters planning mode and integrates with your existing documentation and context.
- **Screenshot Support for Feedback**: Attach screenshots to your change requests when reviewing tasks, providing visual context for your feedback alongside text comments.
- **Unified Task Editing**: The Edit Task dialog now includes all the same options as the New Task dialog—classification metadata, image attachments, and review settings—giving you full control when modifying tasks.

### Improvements
- **Enhanced Kanban Board**: Improved visual design and interaction patterns for task cards, making it easier to scan status, understand progress, and work with tasks efficiently.
- **Screenshot Handling**: Paste screenshots directly into task descriptions using Ctrl+V (Cmd+V on Mac) for faster documentation.
- **Draft Auto-Save**: Task creation state is now automatically saved when you navigate away, preventing accidental loss of work-in-progress.

### Bug Fixes
- Fixed task editing to support the same comprehensive options available in new task creation