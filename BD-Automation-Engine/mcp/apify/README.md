# Apify MCP Server Guide

The Apify MCP server enables Claude to run web scrapers and actors for collecting job postings and competitive intelligence.

## Installation

```bash
npx -y @apify/mcp-server-apify
```

## Configuration

Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
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

## Available Tools

| Tool | Description |
|------|-------------|
| `apify_list_actors` | List available actors in your account |
| `apify_run_actor` | Start an actor run |
| `apify_get_run` | Get status/results of a run |
| `apify_get_dataset` | Retrieve dataset items |
| `apify_list_datasets` | List available datasets |
| `apify_get_key_value_store` | Access key-value storage |

## BD Operations Examples

### Run Job Scraper
```
Claude: "Scrape ClearanceJobs for DCGS positions in San Diego"
Tool: apify_run_actor
Actor: apify/puppeteer-scraper
Input: {
  "startUrls": ["https://www.clearancejobs.com/jobs?keywords=DCGS&location=San+Diego"],
  "maxRequestsPerCrawl": 100
}
```

### Get Scrape Results
```
Claude: "Get the results from my last scraper run"
Tool: apify_get_dataset
Dataset ID: <from previous run>
```

### List Available Actors
```
Claude: "What scrapers do I have available?"
Tool: apify_list_actors
```

## Configured Actors

### Puppeteer Scraper
- **Actor ID**: `apify/puppeteer-scraper`
- **Purpose**: General-purpose web scraping with JavaScript rendering
- **Target Sites**: Staffing job boards (Apex, Insight Global, TEKsystems)

### Input Configuration Files
Located in `Engine1_Scraper/Configurations/`:
- `apify_input_apex_jobs.json` - Apex Systems job scraper
- `apify_input_insightglobal.json` - Insight Global job scraper
- `apify_input_teksystems.json` - TEKsystems job scraper
- `apify_input_clearancejobs.json` - ClearanceJobs scraper
- `apify_input_linkedin.json` - LinkedIn job scraper

### Output Schema
```json
{
  "url": "https://source.com/job/123",
  "title": "Network Engineer",
  "company": "Apex Systems",
  "location": "San Diego, CA",
  "detected_clearance": "TS/SCI",
  "primary_keyword": "DCGS",
  "scraped_at": "2026-01-10T12:00:00Z"
}
```

## Workflow Integration

### Scrape → Enrich → Notify
1. **Apify MCP**: Run job scraper for target keywords
2. **Process**: Download dataset, run through Program Mapping Engine
3. **Notion MCP**: Create/update records in Program Mapping Hub
4. **n8n MCP**: Trigger notification workflow for Hot priorities

### Scheduled Scraping
Configure in Apify Console:
- **Schedule**: Daily at 6 AM (`0 6 * * *`)
- **Keywords**: DCGS, cleared, TS/SCI, intelligence analyst
- **Locations**: San Diego, Hampton, Norfolk, Dayton

## Best Practices

1. **Rate Limiting**: Use `maxRequestsPerCrawl` to avoid blocking
2. **Proxy Rotation**: Enable proxies for large-scale scraping
3. **Data Deduplication**: Check for existing URLs before creating
4. **Error Handling**: Monitor actor runs for failures

## Cost Optimization

| Plan | Compute Units/Month | Best For |
|------|---------------------|----------|
| Free | 10 | Testing, small batches |
| Starter | 49 | Daily scraping |
| Scale | 499 | High-volume operations |

**Typical Usage**:
- Job scraper: ~0.5 CU per 100 jobs
- LinkedIn scraper: ~1 CU per 100 profiles
- Daily scraping: ~15 CU/month

## Troubleshooting

| Error | Solution |
|-------|----------|
| "Invalid token" | Regenerate at console.apify.com |
| "Actor not found" | Check actor ID, verify access |
| "Run failed" | Check actor logs, adjust selectors |
| "Rate limited" | Reduce requests, add delays |
| "Blocked by site" | Enable proxy rotation |
