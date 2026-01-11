# 🚀 Claude + Notion MCP Prompt Playbook
## PTS BD Intelligence System Quick Reference

**Version 1.0 | December 2025 | Prime Technical Services**

---

## 📋 Table of Contents
1. [MCP Tools Reference](#-mcp-tools-quick-reference)
2. [Collection IDs](#-pts-database-collection-ids)
3. [Search Prompts](#-search--discovery-prompts)
4. [CRUD Prompts](#-database-operations-prompts)
5. [BD Workflows](#-bd-intelligence-workflows)
6. [Multi-Tool Chains](#-multi-tool-chain-prompts)
7. [Copy-Paste Templates](#-copy-paste-prompt-templates)

---

## 🔧 MCP Tools Quick Reference

| Tool | Purpose | Rate Limit |
|------|---------|------------|
| `notion-search` | Semantic search across workspace + connected apps | **30/min** |
| `notion-fetch` | Get page/database content by URL or ID | 180/min |
| `notion-create-pages` | Create one or more pages | 180/min |
| `notion-update-page` | Update properties or content | 180/min |
| `notion-create-database` | Create new database with schema | 180/min |
| `notion-update-database` | Modify schema/properties | 180/min |
| `notion-move-pages` | Move pages to new parent | 180/min |
| `notion-duplicate-page` | Clone page (async) | 180/min |
| `notion-query-data-sources` | Cross-DB queries *(Enterprise)* | 30/min |
| `notion-create-comment` | Add comment to page | 180/min |
| `notion-get-comments` | List page comments | 180/min |
| `notion-get-teams` | List teamspaces | 180/min |
| `notion-get-users` | List workspace users | 180/min |
| `notion-get-self` | Get bot info | 180/min |

**⚠️ Global limit: 180 requests/minute across ALL tools combined**

---

## 📊 PTS Database Collection IDs

```
🧭 Program Mapping Hub     → f57792c1-605b-424c-8830-23ab41c47137
🎯 BD Opportunities        → 2bcdef65-baa5-80ed-bd95-000b2f898e17
🏛️ Federal Programs        → 06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
📓 Enrichment Runs Log     → 20dca021-f026-42a5-aaf7-2b1c87c4a13d
🏢 Contractors Database    → 3a259041-22bf-4262-a94a-7d33467a1752
🚚 Contract Vehicles       → 0f09543e-9932-44f2-b0ab-7b4c070afb81
⭐ DCGS Contacts Full      → 2ccdef65-baa5-8087-a53b-000ba596128e
💼 GDIT Jobs               → 2ccdef65-baa5-80b0-9a80-000bd2745f63
🔍 Insight Global Jobs     → 69f0d6de-24c8-4878-9eed-b2e4f6c7d63f
🌍 Defense Program Universe → bba2faa7-e297-4990-a179-3d0acc65c52d
📋 DoD Programs Master     → 4fa19e91-62c8-432a-8aa4-0f73f5416b41
📅 BD Events               → 8bf60d75-5638-41be-8d5d-6f8cf2601441
```

---

## 🔍 Search & Discovery Prompts

### Find Opportunities by Program
```
Search my Notion workspace for all pages mentioning "DCGS" 
or "Distributed Common Ground System". Focus on the Program 
Mapping Hub and BD Opportunities databases. Return results 
with Priority Score, Status, and Company fields.
```

### Find High-Value Opportunities by Contractor
```
Search for all GDIT job postings in the Program Mapping Hub 
where Clearance Level = "TS/SCI" and Priority Score >= 70. 
Group results by Agency and sort by Priority Score descending.
```

### Cross-Reference with Connected Apps
```
Search across my Notion workspace and connected Slack for 
discussions about "Army DCGS-A" contract recompete. 
Summarize findings and identify any action items mentioned.
```

### Find Recompete Targets
```
Search Federal Programs for contracts ending in the next 
18 months with Contract Value >= $50M. Cross-reference 
with Program Mapping Hub for recent job activity from 
the incumbent contractor.
```

### Location-Based Search
```
Find all job postings in Program Mapping Hub located at 
"Langley AFB" or "Hampton Roads" with TS/SCI clearance. 
These map to AF DCGS program. Group by Company.
```

### Clearance Level Analysis
```
Search Program Mapping Hub and count jobs by Clearance Level.
Show distribution: Public Trust, Secret, TS, TS/SCI, TS/SCI w/Poly.
Flag any programs requiring polygraph as high-barrier opportunities.
```

---

## 🔄 Database Operations Prompts

### Fetch Schema (ALWAYS DO THIS FIRST!)
```
Fetch the complete schema for the Program Mapping Hub database 
(Collection ID: f57792c1-605b-424c-8830-23ab41c47137). 
Show me all property names, types, and any select/multi-select 
options. Highlight schema-locked properties.
```

### Create New BD Opportunity
```
Create a new page in BD Opportunities database 
(Collection ID: 2bcdef65-baa5-80ed-bd95-000b2f898e17) with:
- Opportunity Name: "AF DCGS Langley - Systems Engineer"
- Program: "AF DCGS"
- Priority Score: 85
- Status: "New"
- Prime: "BAE Systems"
- Source: "GDIT Job Posting"
```

### Bulk Create Multiple Records
```
Create 3 new pages in BD Opportunities database 
(Collection ID: 2bcdef65-baa5-80ed-bd95-000b2f898e17):

Page 1:
- Opportunity Name: "DCGS-A Fort Bragg - Intel Analyst"
- Program: "Army DCGS-A"
- Priority Score: 78

Page 2:
- Opportunity Name: "DCGS-N Norfolk - Systems Admin"
- Program: "Navy DCGS-N"
- Priority Score: 72

Page 3:
- Opportunity Name: "DCGS-SOF Tampa - SIGINT Analyst"
- Program: "DCGS-SOF"
- Priority Score: 88
```

### Bulk Update Status
```
Search Program Mapping Hub for records where:
- Status = "enriched"
- AI Confidence Score >= 0.8
- Priority Score >= 75

Update each matching record to set Status = "validated".
Process in batches of 10 to avoid rate limits.
Report: X updated, Y skipped, Z errors.
```

### Add Select Options to Database
```
First fetch the schema for Program Mapping Hub.
Then update the database to add a new option "SIGINT" 
to the "Domain" select property. Include all existing 
options in the update to preserve them.
```

### Update Page Content
```
Fetch the page at [URL].
Add a new section called "Competitive Analysis" with:
- Incumbent: [Company Name]
- Contract End Date: [Date]
- Estimated Value: $[Amount]M
- Our Position: Challenger
```

---

## 📈 BD Intelligence Workflows

### Opportunity Qualification Workflow
```
Process new job imports from the Program Mapping Hub:

1. Search for Status = "enriched" AND Priority Score >= 70 
   AND AI Confidence Score >= 0.7

2. For each qualifying record:
   a. Check if already exists in BD Opportunities (by Source URL)
   b. If not exists, create new BD Opportunity with:
      - Job Title → Opportunity Name
      - Program Name → Program
      - Priority Score → BD Score
      - Company → Prime
   c. Update Hub record Status to "promoted_to_bd"

3. Classify as Hot (>=80) / Warm (50-79) / Cold (<50)
4. Report: X opportunities created, Y skipped (duplicates)
```

### Competitive Intelligence Analysis
```
Analyze GDIT's hiring patterns across all DCGS programs:

1. Search Program Mapping Hub for Company = "GDIT"
2. Group by Location and count positions at each site
3. Identify clearance distribution (Secret vs TS vs TS/SCI)
4. Calculate average days since posting (job freshness)
5. Flag locations with >5 open positions as "hiring surge"
6. Create intelligence brief in our BD Campaign folder
```

### Contact Outreach Prep
```
Prepare call sheet for DCGS campaign outreach:

1. Search DCGS Contacts Full for BD Priority = "Critical" OR "High"
2. Filter where Verified != "LinkedIn Verified"
3. Sort by Hierarchy Tier ascending (lower tiers first)
4. For PACAF (San Diego) contacts, mark as Critical (strategic priority)
5. Create prioritized outreach list with talking points
```

### Weekly Recompete Monitor
```
Execute weekly recompete status check:

1. Fetch Federal Programs database
2. Find contracts ending in next 6 months
3. For each, search SAM.gov (via web search) for RFP status
4. Update Federal Programs with:
   - RFP Released Date (if found)
   - Proposal Due Date (if found)
   - Status: Pre-RFP / RFP Out / Proposal Due / Awarded
5. Flag urgent items (proposal due within 30 days)
6. Add comment to each updated record with findings
```

### Program Mapping Classification
```
Classify unmapped jobs in Program Mapping Hub:

1. Search for Program Name = empty OR Program Name = "Unknown"
2. For each job, analyze:
   - Job Title keywords (analyst, engineer, developer, etc.)
   - Location (base names, cities map to specific programs)
   - Company (incumbent status on known contracts)
   - Clearance requirements
3. Cross-reference with Federal Programs for best match
4. Update Program Name with classification
5. Set AI Confidence Score based on match quality
```

---

## ⛓️ Multi-Tool Chain Prompts

### Search → Fetch → Update → Comment
```
Find all opportunities in BD Opportunities where 
Status = "New" and Priority Score > 80.

For each one:
1. Fetch the full page details
2. Search Federal Programs for matching contract info
3. Update the opportunity with Contract End Date if found
4. Add a comment noting the enrichment was completed
5. Change Status from "New" to "Researched"
```

### Create Database → Populate → Generate Views
```
Create a new database called "Q1 2026 Recompetes" with fields:
- Program Name (title)
- Contract End Date (date)
- Current Prime (text)
- Estimated Value (number, currency)
- Our Position (select: Incumbent, Challenger, No Position)

Then search Federal Programs for contracts ending Jan-Mar 2026 
and create entries for each matching program.
```

### Full Pipeline Automation
```
Execute the weekly BD pipeline:

1. Search Program Mapping Hub for Status = "raw_import"
2. For each, map to Federal Programs using location + keywords
3. Calculate Priority Score using our algorithm
4. Update Status to "enriched" with AI Confidence Score
5. For Priority Score >= 75, create BD Opportunity
6. Log all actions to Enrichment Runs Log
7. Report summary: X processed, Y high-priority, Z errors
```

### Duplicate → Customize → Populate
```
Duplicate the "Campaign Template" page.
Rename to "Q1 2026 DCGS-A Campaign".
Update the following sections:
- Target Program: Army DCGS-A
- Contract Value: $180M
- Contract End Date: March 2026
- Prime: Lockheed Martin

Then search for all DCGS-A contacts and create a 
contact tracker table in the new page.
```

---

## 📝 Copy-Paste Prompt Templates

### Template: Quick Search
```
Search my Notion for [KEYWORD] in the [DATABASE_NAME].
```

### Template: Get Schema
```
Fetch the schema for [DATABASE_NAME] (Collection ID: [ID]).
Show all properties and their types.
```

### Template: Create Record
```
Create a page in [DATABASE_NAME] (Collection ID: [ID]) with:
- [PROPERTY]: [VALUE]
- [PROPERTY]: [VALUE]
```

### Template: Update Record
```
Update the page at [URL/ID] to set [PROPERTY] = [VALUE].
```

### Template: Bulk Update
```
Find all records in [DATABASE] where [CONDITION].
Update each to set [PROPERTY] = [VALUE].
Process in batches of 10.
```

### Template: Cross-Reference
```
Search [DATABASE_1] for [CRITERIA].
For each result, look up related info in [DATABASE_2].
Create a summary report.
```

### Template: Create with Relation
```
Create a page in [DATABASE] with:
- Title: [VALUE]
- [RELATION_PROPERTY]: Link to "[RELATED_PAGE_TITLE]"
```

### Template: Conditional Update
```
Search [DATABASE] for [CONDITION_1].
For records that also match [CONDITION_2]:
  Update [PROPERTY_A] = [VALUE_A]
For records that don't match [CONDITION_2]:
  Update [PROPERTY_A] = [VALUE_B]
```

---

## ⚠️ Schema-Locked Properties (DO NOT MODIFY)

These properties are used by n8n workflows - **never rename or delete**:

```
Hub Properties:
├── Status
├── Enrichment Timestamp
├── AI Confidence Score
├── Priority Score
├── Apify Run ID
├── Source URL
├── Job Title
├── Company
├── Job Description
└── Clearance Level

Federal Programs Properties:
├── property_contract_value
├── property_contract_vehicle_type
├── property_program_type_1
├── property_confidence_level
└── Program Name

Status Values (exact strings required):
├── raw_import
├── pending_enrichment
├── enriching
├── enriched
├── validated
└── error
```

---

## 🔥 Pro Tips

### Before ANY Operation
1. **Always fetch schema first** before any create/update operations
2. **Use Collection IDs** (not Database IDs) for data_source operations
3. **Verify property names** are exact (case-sensitive!)

### For Bulk Operations
4. **Process in batches of 10** for bulk operations to avoid rate limits
5. **Sequential over parallel** - run searches one at a time
6. **Include error handling** - ask Claude to report failures
7. **Log to Enrichment Runs Log** for auditability

### Formatting Requirements
8. **Date format is YYYY-MM-DD** for all date properties
9. **Select options need complete arrays** when updating (include existing + new)
10. **Use "__YES__" and "__NO__"** for checkbox properties

### Performance
11. **Cache schema results** - don't re-fetch for every operation
12. **Combine related operations** - create multiple pages in one call
13. **Use specific searches** - narrow queries return faster

---

## 🛠️ Troubleshooting Quick Fixes

| Error | Cause | Solution |
|-------|-------|----------|
| Rate limit exceeded | Too many requests | Smaller batches, add 30s delays |
| Property not found | Wrong name | Fetch schema, verify exact name |
| Database ID invalid | Wrong ID type | Use Collection ID instead |
| Search returns nothing | Too narrow | Broaden terms, fewer filters |
| Can't update multi-source DB | API limitation | Use Notion UI manually |
| Page not found | Bad URL/ID | Verify URL format, check permissions |
| Select value rejected | Option doesn't exist | Add option first via update-database |
| Relation not linking | Wrong page reference | Use page ID, not title |

### Common Gotchas

**Multi-source databases**: Cannot be renamed, modified, or deleted via API
```
If a database URL has ?v=viewId, it may have multiple data sources.
Fetch first to see all data sources and their Collection IDs.
```

**Date properties**: Use expanded format for create/update
```
"date:Due Date:start": "2025-03-15"
"date:Due Date:end": "2025-03-20"  (optional)
"date:Due Date:is_datetime": 0     (0 = date only, 1 = datetime)
```

**Checkbox properties**: Don't use true/false
```
✅ Correct: "Is Complete": "__YES__"
❌ Wrong: "Is Complete": true
```

---

## 📊 Priority Score Classification

| Score Range | Classification | Action |
|-------------|----------------|--------|
| 80-100 | 🔴 **HOT** | Immediate pursuit, assign BD lead |
| 50-79 | 🟡 **WARM** | Monitor, prep capability statement |
| 0-49 | 🟢 **COLD** | Track only, no active pursuit |

### Scoring Algorithm Reference
```
Clearance Alignment:     35 points max
Program Relevance:       20 points max
Location Proximity:      15 points max
Contract Value:          15 points max
Recompete Timing:        15 points max
────────────────────────────────────
Total:                  100 points
```

---

**📄 Document: PTS_Claude_Notion_MCP_Prompt_Playbook.md**  
**🏢 Organization: Prime Technical Services**  
**📅 Last Updated: December 2025**  
**🔧 Compatible with: Notion MCP v1.0, Claude 3.5+**
