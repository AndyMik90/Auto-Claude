---
name: notion-bd-operations
description: Notion database operations and MCP patterns for BD intelligence systems. Use when searching, updating, or managing contacts, programs, jobs, or any BD data in Notion databases with proper schema handling and bulk operation strategies.
---

# Notion BD Operations

Best practices for Notion database operations in BD intelligence systems. Includes MCP patterns, schema management, bulk operations, and troubleshooting.

**Keywords**: Notion, MCP, database, contacts, programs, jobs, schema, bulk operations, collection ID, search, update

## Database Reference

### Core BD Databases

| Database | Collection ID | Records | Purpose |
|----------|---------------|---------|---------|
| DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | ~965 | Primary BD contacts |
| GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | ~1,052 | Non-DCGS contacts |
| GDIT Jobs | `2563119e7914442cbe0fb86904a957a1` | ~700 | Job openings |
| Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Variable | Scraped job enrichment |
| Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | 388 | Program reference |
| BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | Variable | Qualified leads |
| Contractors | `3a259041-22bf-4262-a94a-7d33467a1752` | Variable | Prime/sub info |
| Contract Vehicles | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | Variable | Vehicle reference |

## MCP Tool Patterns

### Search Operations

**Search by keyword in specific database:**
```
notion-search: 
  query="DCGS Langley network engineer"
  data_source_url="collection://2ccdef65-baa5-8087-a53b-000ba596128e"
```

**Search across workspace:**
```
notion-search:
  query="San Diego PACAF contacts"
```

**Semantic search tips:**
- Use specific keywords, not full sentences
- Combine program + location + role
- Results include page content in highlight field

### Fetch Operations

**Fetch database schema:**
```
notion-fetch:
  id="2ccdef65baa580d09b66c67d66e7a54d"
```

Returns:
- Database title and description
- All properties with types
- Collection ID for data_source_url
- Sample records

**Fetch specific page:**
```
notion-fetch:
  id="[PAGE_ID]"
```

### Update Operations

**Update contact properties:**
```
notion-update-page:
  data={
    "page_id": "[PAGE_ID]",
    "command": "update_properties",
    "properties": {
      "Program": "AF DCGS - Langley",
      "Hierarchy Tier": "Tier 3 - Program Leadership",
      "BD Priority": "🟠 High",
      "Location Hub": "Hampton Roads"
    }
  }
```

**Update page content:**
```
notion-update-page:
  data={
    "page_id": "[PAGE_ID]",
    "command": "replace_content",
    "new_str": "# Updated Notes\nNew content here..."
  }
```

### Create Operations

**Create new contact:**
```
notion-create-pages:
  parent={"data_source_id": "2ccdef65-baa5-8087-a53b-000ba596128e"}
  pages=[{
    "properties": {
      "Name": "John Smith",
      "Job Title": "Program Manager",
      "Email Address": "john.smith@gdit.com",
      "Program": "AF DCGS - Langley",
      "Hierarchy Tier": "Tier 3 - Program Leadership",
      "BD Priority": "🟠 High"
    }
  }]
```

## Schema Requirements

### Select Fields (Exact Values Required)

**Program:**
```
AF DCGS - Langley
AF DCGS - Wright-Patt
AF DCGS - PACAF
AF DCGS - Other
Army DCGS-A
Navy DCGS-N
Corporate HQ
Enterprise Security
Unassigned
```

**Hierarchy Tier:**
```
Tier 1 - Executive
Tier 2 - Director
Tier 3 - Program Leadership
Tier 4 - Management
Tier 5 - Senior IC
Tier 6 - Individual Contributor
```

**BD Priority:**
```
🔴 Critical
🟠 High
🟡 Medium
⚪ Standard
```

**Location Hub:**
```
Hampton Roads
San Diego Metro
DC Metro
Dayton/Wright-Patt
Other CONUS
OCONUS
Unknown
```

### Multi-Select Fields (Array Required)

**Functional Area:**
```json
["Program Management", "Network Engineering", "Cyber Security"]
```

### Adding New Select Options

When adding new options to select fields, include both name and color:

```json
{
  "name": "🔴 Critical",
  "color": "red"
}
```

Available colors: default, gray, brown, orange, yellow, green, blue, purple, pink, red

## Bulk Operations

### When to Use CSV Export/Import

Use CSV for:
- Operations involving >100 records
- Complex transformations
- Data migrations between databases
- Backups before major changes

### CSV Workflow

1. **Export from Notion** (manual)
2. **Process in Python:**
```python
import pandas as pd

df = pd.read_csv('export.csv')
# Apply classification logic
df['Hierarchy Tier'] = df['Job Title'].apply(get_hierarchy_tier)
df['BD Priority'] = df.apply(lambda r: get_bd_priority(r['Hierarchy Tier'], r['Program']), axis=1)
df.to_csv('import.csv', index=False)
```
3. **Import back to Notion** (manual merge)

### Rate Limiting

- API limit: ~100 calls/minute
- For bulk updates: Add 0.5s delay between calls
- Batch related operations together
- Use webhooks for real-time vs polling

## Common Issues & Solutions

### Issue: Silent Property Update Failure

**Cause:** Missing color attribute in select options

**Solution:**
```json
// ❌ Wrong
{"name": "Critical"}

// ✅ Correct
{"name": "🔴 Critical", "color": "red"}
```

### Issue: Database Performance Degradation

**Cause:** >1,000 records in single database

**Solution:** Split database by category
- DCGS Contacts Full: ~965 (DCGS-specific)
- GDIT Other Contacts: ~1,052 (non-DCGS)

### Issue: Multi-Source Database Update Fails

**Cause:** Multi-source databases (multiple data sources) cannot be updated via API

**Solution:** 
- Mark as deprecated for API workflows
- Use single-source databases for automation
- Manual updates in Notion UI only

### Issue: Search Returns Irrelevant Results

**Cause:** Query too broad or wrong database

**Solution:**
- Use specific keywords
- Add data_source_url parameter
- Combine multiple filters

## Status Flow (Program Mapping Hub)

```
raw_import → pending_enrichment → enriching → enriched → validated → error
```

**Status Transitions:**
- `raw_import`: Just imported from Apify
- `pending_enrichment`: Ready for GPT-4o processing
- `enriching`: Currently being processed (lock)
- `enriched`: Processing complete
- `validated`: Human verified
- `error`: Processing failed

## Working Agreements

### Always Do:
- ✅ Use Collection ID for data_source_url (not database URL)
- ✅ Include color attribute for select options
- ✅ Verify schema before bulk operations
- ✅ Use CSV for >100 record operations
- ✅ Check record counts before database operations

### Never Do:
- ❌ Rename schema-locked properties without confirmation
- ❌ Individual API calls for bulk operations (>100 records)
- ❌ Update multi-source databases via API
- ❌ Assume property exists (verify first)

### Confirm Before:
- ⚠️ Schema changes to databases
- ⚠️ Bulk contact imports/updates
- ⚠️ Merging or splitting databases
- ⚠️ Creating new database properties
