# Auto Claude Built-in MCP Servers

Auto Claude Desktop application has 7 built-in MCP server types that provide specialized capabilities for autonomous coding tasks.

## Overview

These servers are automatically configured and managed by Auto Claude. They don't require separate installation but understanding their capabilities helps leverage Auto Claude effectively.

| Server | Purpose | When Used |
|--------|---------|-----------|
| **Context7** | Documentation lookup | Planning, research phases |
| **Linear** | Project management | Task tracking integration |
| **Graphiti** | Knowledge graph memory | Cross-session context |
| **Electron** | Desktop app E2E testing | QA for Electron apps |
| **Puppeteer** | Browser automation | Web app testing |
| **Auto-Claude** | Build management | Internal orchestration |
| **Custom MCP** | User-defined servers | Extended capabilities |

## Server Details

### 1. Context7 MCP
**Purpose**: Real-time documentation lookup for libraries and frameworks

**Capabilities**:
- Search npm, PyPI, and other package documentation
- Get API references for specific functions
- Look up code examples and usage patterns

**Use Case**: When implementing features, agents can look up current documentation instead of relying on training data.

### 2. Linear MCP
**Purpose**: Integration with Linear project management

**Capabilities**:
- Read issues and tasks
- Update issue status
- Add comments to issues
- Link code changes to issues

**Configuration**: Requires Linear API key in Auto Claude settings.

### 3. Graphiti MCP
**Purpose**: Persistent memory and knowledge graph across sessions

**Capabilities**:
- Store session insights and discoveries
- Retrieve past context for similar tasks
- Build knowledge graph of codebase patterns
- Semantic search across session history

**Data Location**: `.auto-claude/specs/XXX/graphiti/`

**Use Case**: Agents remember past solutions, avoiding repeated mistakes.

### 4. Electron MCP
**Purpose**: End-to-end testing for Electron desktop applications

**Capabilities**:
- Take screenshots of running app
- Click UI elements by text or selector
- Fill form inputs
- Navigate between views
- Read console logs
- Verify UI state

**Requirements**:
- Electron app running with remote debugging (`--remote-debugging-port=9222`)
- `ELECTRON_MCP_ENABLED=true` in `.env`

**Use Case**: QA agents test Auto Claude's own frontend during development.

### 5. Puppeteer MCP
**Purpose**: Browser automation for web application testing

**Capabilities**:
- Launch and control Chrome/Chromium
- Navigate to URLs
- Take screenshots
- Click elements
- Fill forms
- Execute JavaScript
- Capture network requests

**Use Case**: Testing web applications, scraping verification, visual regression.

### 6. Auto-Claude MCP
**Purpose**: Internal build orchestration and management

**Capabilities**:
- Manage worktree isolation
- Track subtask progress
- Coordinate multi-agent sessions
- Handle spec lifecycle

**Note**: This is used internally by Auto Claude's agent system.

### 7. Custom MCP
**Purpose**: User-defined MCP servers for extended capabilities

**Configuration**: Add custom servers in Auto Claude settings or `.auto-claude/config.json`

**Example**:
```json
{
  "customMcpServers": {
    "my-database": {
      "command": "npx",
      "args": ["-y", "@my-org/database-mcp"],
      "env": {
        "DB_URL": "postgres://..."
      }
    }
  }
}
```

## Agent Tool Access

Different agent types have access to different MCP servers:

| Agent Type | Context7 | Linear | Graphiti | Electron | Puppeteer |
|------------|----------|--------|----------|----------|-----------|
| Planner | ✅ | ✅ | ✅ | ❌ | ❌ |
| Coder | ✅ | ✅ | ✅ | ❌ | ❌ |
| QA Reviewer | ✅ | ❌ | ✅ | ✅ | ✅ |
| QA Fixer | ✅ | ❌ | ✅ | ✅ | ✅ |

## Configuration

### Enabling Built-in Servers

Most built-in servers are enabled automatically. Configure in `apps/backend/.env`:

```bash
# Graphiti Memory
GRAPHITI_ENABLED=true
ANTHROPIC_API_KEY=your-key  # or other provider

# Electron E2E Testing
ELECTRON_MCP_ENABLED=true
ELECTRON_DEBUG_PORT=9222

# Linear Integration
LINEAR_API_KEY=your-linear-key
```

### Checking Server Status

In Auto Claude:
1. Open Settings → MCP Servers
2. View connected servers and status
3. Check logs for connection errors

## Best Practices

1. **Context7**: Use for current library versions, don't rely on outdated training data
2. **Graphiti**: Let agents build memory over time, improves with usage
3. **Electron**: Always run app with debug port for QA testing
4. **Custom**: Add project-specific servers (database, internal APIs)

## Troubleshooting

### Server Not Connecting
1. Check Auto Claude logs
2. Verify required environment variables
3. Restart Auto Claude

### Graphiti Memory Issues
1. Check `.auto-claude/` directory permissions
2. Verify provider API key is valid
3. Check available disk space

### Electron Tests Failing
1. Ensure app is running with debug port
2. Check `ELECTRON_MCP_ENABLED=true`
3. Verify port 9222 isn't blocked
