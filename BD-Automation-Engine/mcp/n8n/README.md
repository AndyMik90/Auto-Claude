# n8n MCP Server Guide

The n8n MCP server (from [DirtyDiablo/n8n-mcp](https://github.com/DirtyDiablo/n8n-mcp)) enables Claude to interact with n8n workflows, access 1,084 nodes, and leverage 2,709 workflow templates.

## Installation

```bash
npx -y n8n-mcp
```

## Configuration

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "n8n-mcp": {
      "command": "npx",
      "args": ["-y", "n8n-mcp"],
      "env": {
        "N8N_API_KEY": "YOUR_N8N_API_KEY",
        "N8N_API_URL": "https://your-n8n-instance.com/api/v1"
      }
    }
  }
}
```

## Features

### Node Library (1,084 Nodes)
Access comprehensive node documentation across categories:
- **Core**: HTTP Request, Code, Set, Filter, Merge, Split
- **Triggers**: Webhook, Schedule, Email, Slack
- **Apps**: Notion, Slack, Discord, Google Sheets, Airtable
- **AI**: OpenAI, Anthropic, LangChain, Vector Stores
- **Data**: JSON, CSV, XML, Spreadsheet
- **Flow**: IF, Switch, Loop, Wait, Error Trigger

### Workflow Templates (2,709 Templates)
Pre-built workflows for common use cases:
- Data synchronization
- Lead enrichment
- Alert notifications
- Report generation
- API integrations

## Available Tools

| Tool | Description |
|------|-------------|
| `list_node_categories` | Get all node categories |
| `get_nodes_by_category` | List nodes in a category |
| `get_node_details` | Get node documentation |
| `search_nodes` | Search nodes by keyword |
| `list_workflow_templates` | Browse workflow templates |
| `get_template_details` | Get template configuration |
| `search_templates` | Search templates by use case |

## BD Operations Examples

### Find Notification Nodes
```
Claude: "What n8n nodes can send Slack notifications?"
Tool: search_nodes
Query: "Slack notification"
Result: Slack node with message, file upload, reaction capabilities
```

### Get Webhook Template
```
Claude: "Find a template for webhook-triggered data processing"
Tool: search_templates
Query: "webhook data processing"
```

### Build Enrichment Workflow
```
Claude: "How do I create an n8n workflow that takes job data via webhook, enriches it with AI, and saves to Notion?"
Tool: get_node_details (for Webhook, OpenAI, Notion nodes)
```

## BD Workflow Examples

### WF1: Job Data Intake
**Trigger**: Webhook receives scraped jobs
**Nodes**: Webhook → Set → Filter → Notion Create
**File**: `n8n/PTS_BD_WF1_Apify_Job_Scraper_Intake.json`

### WF2: AI Enrichment
**Trigger**: New job in Notion with status "pending_enrichment"
**Nodes**: Notion Trigger → OpenAI → Set → Notion Update
**File**: `n8n/PTS_BD_WF2_AI_Enrichment_Processor.json`

### WF3: Hub to BD Opportunities
**Trigger**: Job marked as "validated" with Hot priority
**Nodes**: Notion Trigger → Filter → Notion Create (BD Opportunities)
**File**: `n8n/PTS_BD_WF3_Hub_to_BD_Opportunities.json`

### WF4: Contact Classification
**Trigger**: New contact added
**Nodes**: Notion Trigger → Code → OpenAI → Notion Update
**File**: `n8n/PTS_BD_WF4_Contact_Classification.json`

### WF5: Hot Lead Alerts
**Trigger**: Job reaches Hot priority (≥80)
**Nodes**: Notion Trigger → Filter → Slack → Email
**File**: `n8n/PTS_BD_WF5_Hot_Lead_Alerts.json`

### WF6: Weekly Summary
**Trigger**: Schedule (Monday 8 AM)
**Nodes**: Schedule → Notion Query → Aggregate → Slack/Email
**File**: `n8n/PTS_BD_WF6_Weekly_Summary_Report.json`

## Integration with BD Pipeline

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│ Apify MCP   │────▶│ n8n WF1     │────▶│ Notion MCP  │
│ (Scrape)    │     │ (Intake)    │     │ (Store)     │
└─────────────┘     └─────────────┘     └──────┬──────┘
                                               │
                    ┌─────────────┐     ┌──────▼──────┐
                    │ n8n WF2     │◀────│ Notion      │
                    │ (Enrich)    │     │ Trigger     │
                    └──────┬──────┘     └─────────────┘
                           │
                    ┌──────▼──────┐     ┌─────────────┐
                    │ n8n WF5     │────▶│ Slack/Email │
                    │ (Alerts)    │     │ (Notify)    │
                    └─────────────┘     └─────────────┘
```

## Setup Your n8n Instance

### Option 1: n8n Cloud
1. Sign up at [n8n.io](https://n8n.io)
2. Get API key from Settings → API
3. Use cloud URL: `https://your-instance.app.n8n.cloud/api/v1`

### Option 2: Self-Hosted
```bash
# Docker
docker run -it --rm \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n

# npm
npm install -g n8n
n8n start
```

## API Key Setup

1. Go to n8n Settings → API
2. Create new API key
3. Copy key and add to Claude Desktop config
4. Set N8N_API_URL to your instance URL

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Connection refused" | Check n8n is running, verify URL |
| "Unauthorized" | Verify API key is correct |
| "Node not found" | Update n8n to latest version |
| "Template not found" | Check template ID, may be deprecated |
