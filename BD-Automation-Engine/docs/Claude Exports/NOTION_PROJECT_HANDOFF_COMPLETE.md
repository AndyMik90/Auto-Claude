# NOTION PROJECT HANDOFF - Prime TS BD Intelligence System
## Complete Context Transfer from n8n Project
### December 27, 2025

---

## 1. PROJECT OVERVIEW

### What We're Building
A comprehensive BD (Business Development) Intelligence System for Prime Technical Services (PTS), a defense contractor specializing in cleared personnel staffing. The system automates:
- **Competitive intelligence gathering** - Scraping competitor job postings from firms like CACI, GDIT, Leidos, Booz Allen
- **AI-powered program mapping** - Matching jobs to 388 DoD/IC programs
- **BD opportunity scoring** - 5-factor weighted algorithm for prioritization
- **Automated outreach** - Notifications for hot leads

### Notion's Role in the Architecture
**Notion is the central source of truth** for all structured data. The 7-database hub-and-spoke architecture stores:
- Federal Programs (388 DoD/IC programs) - CENTRAL HUB
- Job Postings (scraped competitor jobs) - PRIMARY INPUT
- BD Opportunities (scored leads) - OUTPUT
- Contractors, Contract Vehicles, Contacts, Enrichment Logs - REFERENCE/OPS

### Current State of Notion Development
| Component | Status | Details |
|-----------|--------|---------|
| Database Architecture | ✅ 95% | 7 databases designed and configured |
| Federal Programs Data | ✅ Imported | 388 programs with 35 properties each |
| Schema Design | ✅ Complete | Select options, relations defined |
| Data Transformations | ⏳ In Progress | Budget/Contract Vehicle need n8n re-run |
| Relations Population | ⏳ Pending | Prime Contractor text→relation mapping |
| Views & Filters | 🔜 Planned | Custom BD priority views needed |

### Responsibility Division
| Project | Owns |
|---------|------|
| **Notion Project** | Database schema, properties, views, relations, data quality |
| **n8n Project** | Workflow logic, API integrations, scraping, AI enrichment, automation |

---

## 2. FULL SYSTEM ARCHITECTURE (Notion's Perspective)

### Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                        INBOUND DATA FLOWS                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  [Apify Scrapers]                                                   │
│       │                                                             │
│       ▼                                                             │
│  [n8n: Prime TS BD Intelligence v2.1]                               │
│       │                                                             │
│       ▼                                                             │
│  ┌─────────────────────┐                                            │
│  │  JOB POSTINGS DB    │ ◄── Scraped jobs stored here               │
│  └─────────────────────┘                                            │
│       │                                                             │
│       │ [AI Enrichment - GPT-4o]                                    │
│       ▼                                                             │
│  ┌─────────────────────┐                                            │
│  │  FEDERAL PROGRAMS   │ ◄── Program mapping, relations             │
│  │     (CENTRAL HUB)   │                                            │
│  └─────────────────────┘                                            │
│       │                                                             │
│       │ [Scoring Algorithm]                                         │
│       ▼                                                             │
│  ┌─────────────────────┐                                            │
│  │  BD OPPORTUNITIES   │ ◄── Scored opportunities                   │
│  └─────────────────────┘                                            │
│       │                                                             │
│       ▼                                                             │
│  [Email/Slack Notifications]                                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### What Data Lives in Notion (and Why)

| Database | Data Type | Why Notion |
|----------|-----------|------------|
| Federal Programs | 388 DoD/IC programs | Central reference, relations hub |
| Job Postings | Scraped competitor jobs | Structured storage, deduplication |
| BD Opportunities | Scored leads | Pipeline tracking, owner assignment |
| Contractors | Prime/sub profiles | Relation targets, capability data |
| Contract Vehicles | DISA Encore, SEWP, etc. | Reference data for matching |
| Contacts | BD contacts (HUMINT) | CRM-style tracking |
| Enrichment Runs | Automation logs | Operations monitoring |

### Integration Touchpoints

**n8n reads FROM Notion:**
- Federal Programs (for matching)
- Job Postings (for enrichment)
- Contractors (for relation matching)

**n8n writes TO Notion:**
- Job Postings (new scraped jobs)
- Federal Programs (Budget, Contract Vehicle, Program Type, Priority Level)
- BD Opportunities (scored leads)
- Enrichment Runs (execution logs)

---

## 3. NOTION WORKSPACE ARCHITECTURE

### Database 1: Federal Programs (CENTRAL HUB)

**Database ID:** `9db40fce-0781-42b9-902c-d4b0263b1e23`
**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`
**Purpose:** Master registry of 388 DoD/IC programs with contract details and BD intelligence
**Status:** Active - Data transformation in progress

#### Key Properties (35 total)

| Property | Type | Purpose | Status |
|----------|------|---------|--------|
| Program Name | Title | Official program name | ✅ Populated |
| Acronym | Text | Short name (PAC-3, DCGS, etc.) | ✅ Populated |
| Agency Owner | Select (23 options) | DoD, Army, Navy, etc. | ✅ Populated |
| Program Type | Select (20 options) | IT, Cyber, Intel, Weapon Systems | ✅ Working |
| Budget | Number | Contract value in dollars | ⏳ Needs n8n run |
| Contract Vehicle | Select (16 options) | IDIQ, Services, GWAC, etc. | ⏳ Needs n8n run |
| Priority Level | Select | High/Medium/Low | ✅ Working |
| Clearance Requirements | Multi-select | Secret, TS/SCI, etc. | ✅ Populated |
| Prime Contractor | Relation | Links to Contractors DB | 🔜 Pending |
| Key Subcontractors | Relation | Links to Contractors DB | 🔜 Pending |
| Related Jobs | Relation | Links to Job Postings | ✅ Configured |
| Contract Vehicle Used | Relation | Links to Contract Vehicles Master | 🔜 Pending |

#### Duplicate/Reference Text Columns (Keep for now, hide later)
- `Program Type 1` (text) → populated, source for Program Type (select)
- `Contract Vehicle/Type` (text) → populated, source for Contract Vehicle (select)
- `Contract Value` (text) → "$261M", "$1.3B" format, source for Budget (number)
- `Prime Contractor 1` (text) → keep until relation built
- `Known Subcontractors` (text) → keep until relation built
- `Confidence Level` (select) → copied to Priority Level

#### Schema-Locked Properties (DO NOT RENAME)
⚠️ **n8n depends on these flattened property names:**
- `property_contract_value`
- `property_contract_vehicle_type`
- `property_program_type_1`
- `property_confidence_level`

### Database 2: Job Postings Database (PRIMARY INPUT)

**Database ID:** `d92495a2-c753-48e3-9c2b-33c40ed21f06`
**Purpose:** Stores scraped competitor job postings with AI enrichment
**Status:** Active

#### Key Properties
| Property | Type | Purpose |
|----------|------|---------|
| Job Title | Title | Job posting title |
| Company | Select | CACI, GDIT, Leidos, etc. |
| Location | Text | City, State |
| Clearance Level | Select | Secret, TS/SCI, etc. |
| Job URL | URL | Original posting link |
| Job Description | Text | Full description |
| Program/Agency | Text | AI-mapped program |
| Primary Keyword | Text | AI-extracted keyword |
| Seniority Level (AI) | Select | Junior, Mid, Senior |
| Key Requirements (AI) | Text | AI-extracted requirements |
| Deduplication Key | Text | For duplicate detection |
| Is Duplicate? | Checkbox | Duplicate flag |

#### Schema-Locked Properties
- `Job Title`, `Company`, `Location`, `Clearance Level`, `Job URL`
- `Deduplication Key`, `Is Duplicate?`

### Database 3: BD Opportunities (OUTPUT SPOKE)

**Database ID:** `2bcdef65-baa5-80ed-bd95-000b2f898e17`
**Purpose:** Scored BD opportunities generated from job/program analysis
**Status:** Active

### Database 4: Contractors Database (REFERENCE)

**Database ID:** `3a259041-22bf-4262-a94a-7d33467a1752`
**Purpose:** Master list of defense contractors (primes and subs)
**Status:** Active - Relations pending population

### Database 5: Contract Vehicles Master (REFERENCE)

**Database ID:** `0f09543e-9932-44f2-b0ab-7b4c070afb81`
**Purpose:** Reference database for federal contract vehicles
**Status:** Building

### Database 6: Contacts Database (HUMINT)

**Database ID:** `428bc63e-f251-4b7a-a9c8-2388f4c8ff23`
**Purpose:** Key contacts at agencies and contractors for BD outreach
**Status:** Planned

### Database 7: Enrichment Runs Log (OPS TRACKING)

**Database ID:** `20dca021-f026-42a5-aaf7-2b1c87c4a13d`
**Purpose:** Tracks automation execution history and data quality metrics
**Status:** Active

---

## 4. MCP TOOL CONFIGURATION & USAGE

### Notion Connector (Native Claude Integration)

**Status:** ✅ Connected
**Workspace:** Prime TS Notion workspace
**Permission Scope:** Full read/write access to all databases

**Available Operations:**
| Tool | Purpose | When to Use |
|------|---------|-------------|
| notion-search | Semantic search across workspace | Finding pages, programs, contacts |
| notion-fetch | Retrieve page/database by ID | Getting schemas, page content |
| notion-create-pages | Create new pages in databases | Adding new programs, contacts |
| notion-update-page | Update page properties/content | Data fixes, property updates |
| notion-create-database | Create new databases with schema | New database design |
| notion-update-database | Modify database schema | Adding properties, options |
| notion-get-users | List workspace users | Finding user IDs for mentions |
| notion-move-pages | Move pages between locations | Organization |
| notion-duplicate-page | Duplicate a page | Templates |

### Notion MCP Server

**Server URL:** `https://mcp.notion.com/mcp`
**Status:** ✅ Connected
**Authentication:** OAuth via Claude.ai connector system

**MCP-Specific Capabilities:**
- Duplicate pages (notion-duplicate-page)
- Move pages between databases (notion-move-pages)
- Get/create comments on pages
- Get teams/teamspaces

### MCP vs Connector Decision Guide

| Operation | Use Connector | Use MCP |
|-----------|---------------|---------|
| Search workspace | ✅ | |
| Fetch database schema | ✅ | |
| Create pages | ✅ | |
| Update page properties | ✅ | |
| Duplicate pages | | ✅ |
| Move pages | | ✅ |
| Comments | | ✅ |
| Team operations | | ✅ |

### Successful Patterns Established

**Fetching database schema:**
```
notion-fetch with id: "9db40fce-0781-42b9-902c-d4b0263b1e23"
```

**Searching for programs:**
```
notion-search with query: "PAC-3 MSE" 
```

**Updating page properties:**
```
notion-update-page with page_id and properties object
```

---

## 5. N8N INTEGRATION MAP (Reference Layer)

### Active Workflows

#### Workflow 1: Prime TS BD Intelligence System v2.1
| Field | Value |
|-------|-------|
| **Workflow ID** | `jYihwcJ5BG04QKVC` |
| **Purpose** | Main BD pipeline - scraping, enrichment, scoring |
| **Trigger** | Scheduled (6 AM EST daily) |
| **Databases Used** | Job Postings, Federal Programs, BD Opportunities |
| **Properties Read** | All Job Postings properties, Federal Programs for matching |
| **Properties Written** | Program/Agency mapping, BD Score, Priority Level |
| **Status** | Active (30 nodes) |

#### Workflow 2: Federal Programs Data Fix
| Field | Value |
|-------|-------|
| **Workflow ID** | `S5ZNab8nkGoDRVHG` |
| **Purpose** | Transform imported data - Budget, Contract Vehicle, Program Type, Priority Level |
| **Trigger** | Manual |
| **Database Used** | Federal Programs |
| **Properties Read** | property_contract_value, property_contract_vehicle_type, property_program_type_1, property_confidence_level |
| **Properties Written** | Budget, Contract Vehicle, Program Type, Priority Level |
| **Status** | ✅ Fixed and ready to run |

#### Workflow 3: Clearance Job RAG Agent
| Field | Value |
|-------|-------|
| **Workflow ID** | `NrrRAihA4vChAlmk` |
| **Purpose** | AI-powered job matching using RAG |
| **Status** | Development |

### Schema-Locked Items

⚠️ **DO NOT rename or delete without updating n8n workflows:**

| Database | Property | n8n Expects |
|----------|----------|-------------|
| Federal Programs | Contract Value (text) | property_contract_value |
| Federal Programs | Contract Vehicle/Type (text) | property_contract_vehicle_type |
| Federal Programs | Program Type 1 (text) | property_program_type_1 |
| Federal Programs | Confidence Level (select) | property_confidence_level |
| Job Postings | Job Title | title |
| Job Postings | Company | company |
| Job Postings | Location | location |
| Job Postings | Clearance Level | clearance_level |
| Job Postings | Job URL | job_url |
| Job Postings | Deduplication Key | deduplication_key |
| All Databases | Database IDs | Hardcoded in n8n |

### n8n Technical Notes

**CRITICAL:** n8n Notion node returns **flattened property names** with `property_` prefix:
- `property_contract_value` (not `properties['Contract Value']`)
- `property_program_type_1` (not `properties['Program Type 1']`)

When updating Notion via n8n, use **HTTP Request node** with direct Notion API calls for complex updates (PATCH to `https://api.notion.com/v1/pages/{pageId}`).

---

## 6. CURRENT STATE

### ✅ Working Now
- 7-database hub-and-spoke architecture fully designed
- 388 federal programs imported with 35 properties each
- Program Type and Priority Level transformations working (verified in Notion)
- Notion Connector and MCP both functional
- n8n MCP server connected for workflow management
- Database schemas with all select options configured
- Relations defined between databases

### ⏳ In Progress
- **Budget and Contract Vehicle field transformations** - n8n workflow fixed, needs re-run
- Federal Programs Data Fix workflow (S5ZNab8nkGoDRVHG) ready to execute

### 🔜 Planned/Discussed
- Prime Contractor relation population (text → relation mapping)
- Known Subcontractors → Key Subcontractors relation
- Contract Vehicles Master database population
- Hide/archive duplicate text columns after verification
- Custom views for BD prioritization
- Contacts Database population (HUMINT)

### ⚠️ Known Issues

1. **Data Alignment Issues:** Some fields have misaligned data from CSV import
   - Example: Key Locations contains clearance data for some records
   - Root cause: Column shift during import

2. **Duplicate Columns:** Text columns exist alongside select fields
   - `Program Type 1` (text) → `Program Type` (select)
   - `Contract Vehicle/Type` (text) → `Contract Vehicle` (select)
   - Action: Hide after transformation verification

3. **n8n Property Access:** n8n returns flattened `property_` prefixed names
   - Fixed in Code node, documented for future reference

---

## 7. NOTION PROJECT INSTRUCTIONS

**Copy this into the Notion Project's custom instructions:**

```
## Project Context
This Notion workspace powers the Prime Technical Services BD Intelligence System - an automated competitive intelligence platform for defense contractor staffing. We scrape competitor job postings, map them to DoD/IC programs, and score BD opportunities.

## My Notion Workspace

Core Databases (7 total):
1. Federal Programs (9db40fce-0781-42b9-902c-d4b0263b1e23) - CENTRAL HUB, 388 programs
2. Job Postings (d92495a2-c753-48e3-9c2b-33c40ed21f06) - Scraped competitor jobs
3. BD Opportunities (2bcdef65-baa5-80ed-bd95-000b2f898e17) - Scored opportunities
4. Contractors (3a259041-22bf-4262-a94a-7d33467a1752) - Prime/sub contractors
5. Contract Vehicles Master (0f09543e-9932-44f2-b0ab-7b4c070afb81) - Reference
6. Contacts (428bc63e-f251-4b7a-a9c8-2388f4c8ff23) - BD contacts
7. Enrichment Runs Log (20dca021-f026-42a5-aaf7-2b1c87c4a13d) - Ops tracking

## System Architecture
Notion is the central source of truth in a hub-and-spoke architecture:
- n8n workflows read/write to Notion databases
- Apify scrapers feed job data via n8n → Notion
- GPT-4o enriches data and maps to programs
- 5-factor scoring algorithm generates BD opportunities

## MCP Tools Available

You have access to:
1. **Notion Connector** (native) - Use for searches, fetches, page creates/updates
2. **Notion MCP** (https://mcp.notion.com/mcp) - Use for duplicating pages, moving pages, comments

When I ask you to read/write/query Notion:
- Prefer Notion Connector for most operations
- Use MCP for duplicate/move/comment operations
- Always fetch current schema before suggesting property changes
- Confirm before making destructive changes

## Integration Awareness (CRITICAL)

n8n workflows depend on specific property names. SCHEMA-LOCKED items:
- property_contract_value
- property_contract_vehicle_type
- property_program_type_1
- property_confidence_level
- Job Postings: Job Title, Company, Location, Clearance Level, Job URL, Deduplication Key

NEVER rename or delete these without coordinating with the n8n project.

## Working Agreements

1. When I ask to modify a property, check if it's schema-locked for n8n
2. Suggest schema changes that maintain integration compatibility
3. When designing new databases, consider what n8n will need to access
4. Flag if a requested change might break existing integrations
5. Always fetch current database schema before suggesting property changes
6. Use relation fields for contractor/program links (not text)

## My Preferences

- Defense/federal contracting domain expertise expected
- Use proper terminology (DoD, IC, TS/SCI, IDIQ, etc.)
- Practical solutions over theoretical - this is a working system
- Incremental improvements preferred over wholesale changes

## Current Focus

1. Verify Budget/Contract Vehicle transformations after n8n workflow run
2. Clean up duplicate text columns (Program Type 1, Contract Vehicle/Type)
3. Build Prime Contractor relation mapping
4. Populate Contract Vehicles Master database
```

---

## 8. FIRST CHAT MESSAGE (Continuation Prompt)

**Use this to start a new conversation in the Notion project:**

```
I've set up this dedicated Notion project with both Notion Connector and Notion MCP enabled. The attached handoff document contains full context from the n8n project sessions.

**Current Notion State:**
- 7 databases configured (Federal Programs is central hub with 388 records)
- Schema fully designed with select options, relations
- Program Type and Priority Level transformations verified working
- Budget and Contract Vehicle transformations ready (n8n workflow fixed, needs manual run)

**MCP Tools Available:**
- Notion Connector: search, fetch, create/update pages, database schema
- Notion MCP: duplicate, move, comments

**Integration Context:**
- Prime TS BD Intelligence System v2.1 workflow (jYihwcJ5BG04QKVC) - active
- Federal Programs Data Fix workflow (S5ZNab8nkGoDRVHG) - fixed, needs run

**Immediate Priorities:**
1. Verify data transformation results after n8n workflow execution
2. Clean up duplicate text columns (Program Type 1, Contract Vehicle/Type, etc.)
3. Build Prime Contractor → Contractors Database relation mapping
4. Create custom views for BD priority sorting

Let's start by fetching the Federal Programs database schema to confirm current state after the recent updates.
```

---

## 9. CROSS-PROJECT COORDINATION NOTES

### Pending Changes Affecting Both Systems

| Change | n8n Status | Notion Status | Next Step |
|--------|------------|---------------|-----------|
| Budget/Contract Vehicle transformation | ✅ Workflow fixed | ⏳ Fields empty | Run n8n workflow manually |
| Prime Contractor relation | 🔜 Workflow needed | ✅ Relation field exists | Build n8n matching workflow |
| Job deduplication | ✅ Uses Deduplication Key | ✅ Property exists | Working |

### Handoff Points

| When This Happens | Switch To |
|-------------------|-----------|
| Adding new Notion properties n8n should use | n8n project (update workflow) |
| n8n writes to new/different properties | Notion project (verify schema) |
| Schema changes (rename/delete properties) | BOTH projects (coordinate) |
| Database ID changes | n8n project (update hardcoded IDs) |
| New database design | Notion project first, then n8n |

### What n8n Project Should Know

1. **Flattened property names:** n8n Notion node returns `property_field_name_with_underscores`
2. **Select values are case-sensitive:** Must match exactly
3. **Relations require page IDs:** Not text values
4. **Rate limiting:** Use 350ms+ delay between Notion API calls
5. **HTTP Request > Notion node:** For complex updates, use direct API calls

### n8n Connection Details

**n8n Cloud Instance:** `primetech.app.n8n.cloud`
**n8n MCP Server:** `https://primetech.app.n8n.cloud/mcp-server/http`
**Notion Credential ID:** `WrAqBcxNV9pskdOG` (Notion - Prime TS BD)

---

## 10. ARTIFACTS DOWNLOAD CHECKLIST

### Priority 1 - Essential Notion Files
- [x] This handoff document (NOTION_PROJECT_HANDOFF_COMPLETE.md)
- [x] Federal Programs database schema (live in Notion)
- [x] notion_project_handoff.docx (comprehensive Word doc)

### Priority 2 - Integration Documentation
- [x] Federal_Programs_Field_Transformation_Guide.md (in project files)
- [x] federal_programs_data_fix_workflow.json (in n8n)

### Priority 3 - Reference/Planning
- [x] PTS_Notion_Database_Analysis_Dec2025.docx
- [x] Notion_Update.docx
- [x] Prime_TS_BD_Intelligence_System_v2_1.json

---

*End of Handoff Document*
*Generated: December 27, 2025*
*Source: n8n Project Chat Sessions*
