# MCP Server Configuration Hub

This folder contains all Model Context Protocol (MCP) server configurations, usage guides, and Claude Desktop settings for the BD Automation Engine.

## Quick Start

1. **Copy the Claude Desktop config:**
   ```bash
   # Windows
   copy claude_desktop_config.json %APPDATA%\Claude\claude_desktop_config.json

   # macOS
   cp claude_desktop_config.json ~/Library/Application\ Support/Claude/claude_desktop_config.json
   ```

2. **Restart Claude Desktop** (fully quit from system tray)

3. **Verify servers** are connected (look for MCP icon in Claude Desktop)

## MCP Servers Overview

| Server | Purpose | Transport | Status |
|--------|---------|-----------|--------|
| **Notion** | Database operations (contacts, programs, jobs) | stdio (npx) | ✅ Configured |
| **Apify** | Web scraping (job boards, competitor sites) | stdio (npx) | ✅ Configured |
| **n8n** | Workflow automation (1,084 nodes, 2,709 templates) | stdio (npx) | ✅ Configured |
| **Windows-MCP** | UI automation, PowerShell, app control | stdio (uvx) | Optional |
| **Computer Control** | Screenshots, OCR, mouse/keyboard | stdio (uvx) | Optional |
| **Desktop Commander** | File operations, process management | stdio (npx) | Optional |
| **Sequential Thinking** | Complex planning and reasoning | stdio (npx) | Optional |

## Folder Structure

```
mcp/
├── README.md                     # This file
├── claude_desktop_config.json    # Complete Claude Desktop configuration
├── INSTALLATION_GUIDE.md         # Step-by-step installation
│
├── notion/
│   ├── README.md                 # Notion MCP usage guide
│   └── database_reference.md     # Database IDs and schemas
│
├── apify/
│   ├── README.md                 # Apify MCP usage guide
│   └── actors.md                 # Actor configurations
│
├── n8n/
│   ├── README.md                 # n8n MCP usage guide
│   └── SETUP_GUIDE.md            # Detailed setup from DirtyDiablo/n8n-mcp
│
└── auto-claude-builtin/
    ├── README.md                 # Built-in MCP servers overview
    ├── context7.md               # Context7 documentation lookup
    ├── graphiti.md               # Graphiti memory system
    ├── electron.md               # Electron E2E testing
    └── puppeteer.md              # Puppeteer browser testing
```

## Configuration Files

### Primary: `claude_desktop_config.json`
The main configuration file for Claude Desktop. Contains all MCP server definitions with:
- Notion MCP (for BD database operations)
- Apify MCP (for web scraping)
- n8n MCP (for workflow automation)
- Optional: Windows-MCP, Computer Control, Desktop Commander, Sequential Thinking

### Environment Variables
MCP servers read credentials from environment variables or inline config:
- `NOTION_TOKEN` - Notion integration token
- `APIFY_API_TOKEN` - Apify API token
- `N8N_API_KEY` - n8n API key (if using n8n MCP)

## Use Cases

### BD Intelligence Workflow
1. **Apify MCP** → Scrape job postings from staffing sites
2. **Notion MCP** → Store/update Program Mapping Intelligence Hub
3. **n8n MCP** → Trigger enrichment workflows, send alerts

### Contact Management
1. **Notion MCP** → Query DCGS Contacts database
2. **Notion MCP** → Update contact classification tiers
3. **n8n MCP** → Send weekly contact reports

### Program Research
1. **Notion MCP** → Search Federal Programs database
2. **Apify MCP** → Scrape contract award announcements
3. **Notion MCP** → Update program intelligence

## Troubleshooting

### Server Not Connecting
1. Check Claude Desktop logs: `%APPDATA%\Claude\logs\` (Windows)
2. Verify Node.js/Python installed: `node -v`, `python --version`
3. Test server manually: `npx -y @notionhq/notion-mcp-server`

### Invalid Config Error
1. Ensure JSON is valid (no trailing commas)
2. Use UTF-8 encoding without BOM
3. Check all env vars are properly escaped

### Black Screenshots (Windows-MCP)
Add WGC patterns for GPU-accelerated apps:
```json
"env": {
  "COMPUTER_CONTROL_MCP_WGC_PATTERNS": "chrome,edge,firefox,electron"
}
```

## Security Notes

- **Never commit** `claude_desktop_config.json` with real tokens to git
- Tokens in this folder are for reference only
- Rotate tokens if exposed in logs or screenshots
- Use environment variables for production deployments

## Related Documentation

- [Notion MCP](./notion/README.md) - Database operations guide
- [Apify MCP](./apify/README.md) - Web scraping guide
- [n8n MCP](./n8n/README.md) - Workflow automation guide
- [Auto Claude Built-in](./auto-claude-builtin/README.md) - Built-in server docs
- [Installation Guide](./INSTALLATION_GUIDE.md) - Full setup instructions
