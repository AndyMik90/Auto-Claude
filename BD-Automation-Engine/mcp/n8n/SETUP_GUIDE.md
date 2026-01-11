# n8n MCP Setup Guide

Detailed setup instructions for the n8n MCP server from [DirtyDiablo/n8n-mcp](https://github.com/DirtyDiablo/n8n-mcp).

## Overview

The n8n MCP server provides Claude with access to:
- **1,084 n8n nodes** with full documentation
- **2,709 workflow templates** for common use cases
- Ability to search, browse, and understand n8n capabilities

## Prerequisites

- Node.js 18+ installed
- n8n instance running (cloud or self-hosted)
- n8n API key

## Installation Methods

### Method 1: NPX (Recommended)
```bash
# No installation needed, runs directly
npx -y n8n-mcp
```

### Method 2: Global Install
```bash
npm install -g n8n-mcp
```

### Method 3: From Source
```bash
git clone https://github.com/DirtyDiablo/n8n-mcp.git
cd n8n-mcp
npm install
npm run build
```

## Claude Desktop Configuration

### Minimal Config (Node Library Only)
```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"]
    }
  }
}
```

### Full Config (With API Access)
```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "N8N_API_KEY": "your-api-key-here",
        "N8N_API_URL": "https://your-n8n-instance.com/api/v1"
      }
    }
  }
}
```

## Getting Your n8n API Key

### n8n Cloud
1. Log in to your n8n cloud instance
2. Go to **Settings** → **API**
3. Click **Create API Key**
4. Copy the key (shown only once)

### Self-Hosted n8n
1. Access your n8n instance
2. Go to **Settings** → **API**
3. Create new API key
4. Copy and save securely

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `N8N_API_KEY` | No | API key for workflow operations |
| `N8N_API_URL` | No | Your n8n instance API URL |

Without API credentials, you can still:
- Browse node documentation
- Search nodes
- View workflow templates

With API credentials, you can also:
- Trigger workflows
- Get workflow status
- Access workflow definitions

## Verification

After configuration, restart Claude Desktop and test:

```
Claude: "List n8n node categories"
Expected: Returns categories like Core, Triggers, Apps, Data, AI, etc.

Claude: "Search for Notion nodes in n8n"
Expected: Returns Notion node with operations like create, update, query
```

## Tool Reference

### list_node_categories
Lists all available node categories.
```
Example: "What categories of n8n nodes are available?"
```

### get_nodes_by_category
Gets all nodes in a specific category.
```
Example: "Show me all AI nodes in n8n"
Category: "AI"
```

### get_node_details
Gets detailed documentation for a specific node.
```
Example: "How do I use the Notion node in n8n?"
Node: "notion"
```

### search_nodes
Searches nodes by keyword.
```
Example: "Find n8n nodes for sending emails"
Query: "email send"
```

### list_workflow_templates
Lists available workflow templates.
```
Example: "What workflow templates are available?"
```

### get_template_details
Gets configuration for a specific template.
```
Example: "Show me the Slack notification template"
Template ID: "123"
```

### search_templates
Searches templates by use case.
```
Example: "Find templates for lead enrichment"
Query: "lead enrichment"
```

## Use Cases for BD Automation

### 1. Building New Workflows
Ask Claude to help design workflows:
```
"Help me create an n8n workflow that:
1. Receives job data via webhook
2. Enriches it with Claude AI
3. Scores BD priority
4. Saves to Notion
5. Alerts Slack if Hot priority"
```

### 2. Understanding Existing Nodes
Get node documentation:
```
"Explain how the Notion node works in n8n, including all available operations"
```

### 3. Finding Templates
Search for relevant templates:
```
"Find n8n templates for CRM data synchronization"
```

### 4. Debugging Workflows
Understand node behavior:
```
"Why might the HTTP Request node be failing with a 401 error?"
```

## Best Practices

1. **Start Simple**: Begin with basic webhook → notification workflows
2. **Test Incrementally**: Verify each node before adding more
3. **Use Error Handling**: Add Error Trigger nodes for reliability
4. **Document Workflows**: Add sticky notes explaining logic
5. **Version Control**: Export workflows as JSON and commit to git

## Troubleshooting

### Server Won't Start
```bash
# Clear npx cache
npx clear-npx-cache
npx -y n8n-mcp
```

### "Module not found"
```bash
# Reinstall dependencies
npm cache clean --force
npx -y n8n-mcp
```

### API Connection Failed
1. Verify n8n is running
2. Check API URL format (should end with `/api/v1`)
3. Verify API key hasn't expired
4. Check network/firewall settings

## Resources

- [n8n Documentation](https://docs.n8n.io/)
- [n8n Community Templates](https://n8n.io/workflows/)
- [n8n MCP GitHub](https://github.com/DirtyDiablo/n8n-mcp)
