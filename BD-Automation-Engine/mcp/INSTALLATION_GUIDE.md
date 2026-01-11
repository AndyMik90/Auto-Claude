# MCP Server Installation Guide

Complete guide to installing and configuring MCP servers for the BD Automation Engine.

## Prerequisites

### Required Software

1. **Node.js 18+** (for npx-based servers)
   ```bash
   # Check version
   node -v

   # Install via nvm (recommended)
   nvm install 18
   nvm use 18
   ```

2. **Python 3.10+** (for uvx-based servers)
   ```bash
   # Check version
   python --version

   # Install uv package manager
   # Windows (PowerShell)
   powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"

   # macOS/Linux
   curl -LsSf https://astral.sh/uv/install.sh | sh
   ```

3. **Claude Desktop** (latest version)
   - Download from: https://claude.ai/download

## Installation Steps

### Step 1: Install Core MCP Servers

```bash
# Pre-load Notion MCP
npx -y @notionhq/notion-mcp-server --help

# Pre-load Apify MCP
npx -y @apify/mcp-server-apify --help

# Pre-load n8n MCP (from DirtyDiablo/n8n-mcp)
npx -y n8n-mcp --help
```

### Step 2: Install Optional God Mode Servers (Windows)

```powershell
# Windows-MCP (UI automation)
uvx windows-mcp --help

# Computer Control MCP (screenshots, OCR)
uvx computer-control-mcp@latest --help

# Desktop Commander (file operations)
npx -y @wonderwhy-er/desktop-commander --help

# Sequential Thinking (planning)
npx -y @modelcontextprotocol/server-sequential-thinking --help
```

### Step 3: Configure Claude Desktop

1. **Locate config file:**
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Backup existing config:**
   ```bash
   # Windows
   copy %APPDATA%\Claude\claude_desktop_config.json %APPDATA%\Claude\claude_desktop_config.backup.json

   # macOS/Linux
   cp ~/Library/Application\ Support/Claude/claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.backup.json
   ```

3. **Copy new config:**
   ```bash
   # From this folder
   copy claude_desktop_config.json %APPDATA%\Claude\claude_desktop_config.json
   ```

4. **Update tokens:**
   Edit the config file and replace placeholder values:
   - `YOUR_N8N_API_KEY` → Your actual n8n API key
   - `https://your-n8n-instance.com` → Your n8n instance URL

### Step 4: Restart Claude Desktop

1. **Fully quit** Claude Desktop (check system tray on Windows)
2. **Reopen** Claude Desktop
3. **Verify** MCP servers are connected (look for server icons)

## Configuration Reference

### Minimal Config (BD Operations Only)

```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer YOUR_NOTION_TOKEN\", \"Notion-Version\": \"2022-06-28\"}"
      }
    },
    "apify": {
      "command": "npx",
      "args": ["-y", "@apify/mcp-server-apify"],
      "env": {
        "APIFY_API_TOKEN": "YOUR_APIFY_TOKEN"
      }
    }
  }
}
```

### Full Config (God Mode)

See `claude_desktop_config.json` in this folder for complete configuration with all servers.

## Testing Each Server

### Test Notion MCP
```
Claude: "Search my Notion workspace for 'DCGS'"
Expected: Returns pages/databases containing DCGS
```

### Test Apify MCP
```
Claude: "List my Apify actors"
Expected: Returns list of available actors
```

### Test n8n MCP
```
Claude: "List available n8n nodes"
Expected: Returns node categories and counts
```

### Test Windows-MCP (Windows only)
```
Claude: "Take a screenshot of my desktop"
Expected: Returns screenshot image
```

## Troubleshooting

### Error: "Command not found: npx"
- Install Node.js: https://nodejs.org/
- Restart terminal after installation

### Error: "Command not found: uvx"
- Install uv: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Restart terminal after installation

### Error: "Invalid JSON in config"
- Validate JSON: https://jsonlint.com/
- Check for trailing commas (not allowed in JSON)
- Ensure UTF-8 encoding without BOM

### Error: "Server failed to start"
- Check server logs in Claude Desktop
- Verify API tokens are correct
- Test server manually: `npx -y @notionhq/notion-mcp-server`

### Notion: "Unauthorized"
- Verify token starts with `ntn_` or `secret_`
- Check integration has access to databases
- Regenerate token at developers.notion.com

### Apify: "Invalid token"
- Verify token starts with `apify_api_`
- Check token hasn't expired
- Regenerate at console.apify.com

### n8n: "Connection refused"
- Verify n8n instance is running
- Check N8N_API_URL is correct
- Verify API key is valid

## Security Best Practices

1. **Never commit tokens to git**
   - Add `claude_desktop_config.json` to `.gitignore`
   - Use environment variables when possible

2. **Rotate tokens regularly**
   - Notion: developers.notion.com → Integrations
   - Apify: console.apify.com → Settings → API
   - n8n: n8n instance → Settings → API

3. **Limit integration permissions**
   - Notion: Only grant access to required databases
   - Apify: Use read-only tokens when possible

4. **Monitor usage**
   - Check Notion integration analytics
   - Review Apify actor runs
   - Monitor n8n workflow executions

## Next Steps

After installation:
1. [Configure Notion databases](./notion/README.md)
2. [Set up Apify actors](./apify/README.md)
3. [Create n8n workflows](./n8n/README.md)
4. [Learn about Auto Claude built-in servers](./auto-claude-builtin/README.md)
