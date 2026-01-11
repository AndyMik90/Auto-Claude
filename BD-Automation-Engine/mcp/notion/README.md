# Notion MCP Server Guide

The Notion MCP server enables Claude to interact directly with your Notion workspace for BD intelligence operations.

## Installation

```bash
npx -y @notionhq/notion-mcp-server
```

## Configuration

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer YOUR_NOTION_TOKEN\", \"Notion-Version\": \"2022-06-28\"}"
      }
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `notion_search` | Search pages and databases by query |
| `notion_get_page` | Get page content by ID |
| `notion_get_database` | Get database schema and properties |
| `notion_query_database` | Query database with filters/sorts |
| `notion_create_page` | Create new page in database |
| `notion_update_page` | Update page properties |
| `notion_append_blocks` | Add content blocks to page |

## BD Operations Examples

### Search for DCGS Contacts
```
Claude: "Search Notion for DCGS contacts in San Diego"
Tool: notion_search
Query: "DCGS San Diego contact"
```

### Query Program Mapping Hub
```
Claude: "Find all Hot priority jobs in the Program Mapping Hub"
Tool: notion_query_database
Database: f57792c1-605b-424c-8830-23ab41c47137
Filter: BD_Priority_Tier equals "🔥 Hot"
```

### Create New Contact
```
Claude: "Add a new contact: John Smith, GDIT, Network Engineer"
Tool: notion_create_page
Database: DCGS Contacts (2ccdef65-baa5-8087-a53b-000ba596128e)
Properties: { Name: "John Smith", Company: "GDIT", Title: "Network Engineer" }
```

### Update Job Status
```
Claude: "Mark job ID abc123 as enriched"
Tool: notion_update_page
Page ID: abc123
Properties: { Status: "enriched" }
```

## Database Reference

See [database_reference.md](./database_reference.md) for complete database IDs and schemas.

## Tips

1. **Use database IDs** for precise queries (not page titles)
2. **Filter by Status** to get actionable items only
3. **Sort by BD_Priority_Score** to prioritize high-value jobs
4. **Use date filters** to get recent items only

## Error Handling

| Error | Solution |
|-------|----------|
| "Unauthorized" | Check token, regenerate if expired |
| "Object not found" | Verify database ID, check integration access |
| "Invalid filter" | Check property names match database schema |
| "Rate limited" | Wait and retry, reduce query frequency |
