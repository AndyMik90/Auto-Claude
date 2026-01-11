# Notion_MCP_Integration_Documentation_Claude_Export_2026-01-10.md

## PTS BD Intelligence System - Claude Conversation Export
### Notion Enterprise Analysis & MCP Integration Documentation

**Export Date:** January 10, 2026  
**Session Date Range:** December 23, 2025 - January 10, 2026  
**Project:** Prime Technical Services BD Intelligence System  
**Repository Target:** PTS BD Intelligence Codebase  

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
- Notion Enterprise vs Business plan analysis for BD Intelligence System
- Claude + Notion MCP integration documentation and optimization
- Custom instructions enhancement with Prompt Workshop methodology
- Cross-project handoff system between Notion and n8n projects

### Date Range
- Initial session: December 23, 2025 (Enterprise analysis, documentation creation)
- Follow-up session: January 10, 2026 (Custom instructions v2, handoff prompt v2)

### Primary Objectives
1. Determine if upgrading to Notion Enterprise would enhance MCP integration capabilities
2. Create comprehensive documentation for Claude + Notion MCP operations
3. Develop a "Prompt Workshop" system that optimizes every Notion-related prompt
4. Build a cross-project handoff system for Notion ↔ n8n context transfer

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Do NOT Upgrade to Notion Enterprise
**Decision:** Stay on Notion Business plan; Enterprise does not improve MCP/API capabilities

**Reasoning:**
- Both Business and Enterprise provide **identical MCP functionality** (14 tools)
- Same API rate limits: 180 requests/minute general, 30 searches/minute
- No additional MCP endpoints or enhanced integration features
- Current n8n + Claude MCP architecture works identically on both plans
- Team size <20 users doesn't justify Enterprise cost

**Alternatives Considered:**
- Enterprise ($20/user/month) - Rejected: MCP features identical
- Business ($15/user/month) - Selected: Current plan, sufficient for needs

**What Enterprise WOULD add (not relevant to MCP):**
- SCIM API for automated user provisioning (Okta/Azure AD)
- Audit logs tracking all page access and modifications
- SIEM integration (Splunk, Datadog, Panther, SumoLogic)
- DLP integration for auto-detecting/redacting sensitive data
- Workspace analytics (user-level, full content search for admins)
- Unlimited page history (vs 90 days on Business)
- Zero data retention for AI operations
- Dedicated Customer Success Manager

---

### Decision 2: Use Collection IDs (Not Database IDs) for MCP Operations
**Decision:** Always use Collection IDs when working with Notion MCP data_source operations

**Reasoning:**
- Collection IDs are more reliable for MCP operations
- Database IDs can fail for multi-source databases
- MCP tools specifically require Collection ID format for data_source_id parameter

**Example:**
```
✅ Correct: data_source_id: "f57792c1-605b-424c-8830-23ab41c47137"
❌ Wrong:   database_id: "0a0d7e46-3d88-40b6-853a-3c9680347644"
```

---

### Decision 3: Implement Prompt Workshop Mode
**Decision:** Every Notion MCP prompt gets analyzed and optimized before execution

**Reasoning:**
- Maximizes automation potential of MCP tools
- Reduces manual follow-up actions
- Ensures rate limit compliance
- Chains tools for comprehensive operations

**Bypass Triggers:**
- "Execute now" or "just do it"
- "Skip workshop"
- "GOD mode" (maximum automation)

---

### Decision 4: Schema-Locked Properties Protection
**Decision:** Never modify certain properties without n8n coordination

**Reasoning:**
- These properties are used by active n8n workflows
- Changing them breaks the Apify → n8n → Notion automation pipeline
- Status field values must match exactly for state machine transitions

**Schema-Locked Properties:**
```
Hub: Status, Enrichment Timestamp, AI Confidence Score, Priority Score,
     Apify Run ID, Source URL, Job Title, Company, Job Description, Clearance Level

Federal Programs: property_contract_value, property_contract_vehicle_type,
                  property_program_type_1, property_confidence_level, Program Name

Status State Machine: raw_import → pending_enrichment → enriching → enriched → validated → error
```

---

## 3. ARCHITECTURE & DATA FLOW

### System Overview
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PTS BD INTELLIGENCE SYSTEM                                │
│                         Data Flow Architecture                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │  Apify   │───▶│   n8n    │───▶│  Program Mapping │───▶│     BD       │  │
│  │ Scrapers │    │ Webhook  │    │       Hub        │    │ Opportunities│  │
│  └──────────┘    └──────────┘    └──────────────────┘    └──────────────┘  │
│       │                │                  │                      │          │
│       │                │                  │                      │          │
│       ▼                ▼                  ▼                      ▼          │
│  ┌──────────┐    ┌──────────┐    ┌──────────────────┐    ┌──────────────┐  │
│  │ GDIT,    │    │Status:   │    │   GPT-4o         │    │ Slack/Email  │  │
│  │ CACI,    │    │raw_import│    │   Enrichment     │    │   Alerts     │  │
│  │ Leidos,  │    └──────────┘    │   (15min cycle)  │    │   (Hot/Warm) │  │
│  │ etc.     │                    └──────────────────┘    └──────────────┘  │
│  └──────────┘                                                               │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                        HUB-AND-SPOKE MODEL                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                    ┌──────────────────────┐                                  │
│                    │  🏛️ Federal Programs  │ ◀──── Reference                 │
│                    │     (388+ programs)   │                                 │
│                    └──────────────────────┘                                  │
│                              │                                               │
│  ┌────────────────┐          │          ┌────────────────┐                  │
│  │ 🏢 Contractors │          │          │ 🚚 Contract    │                  │
│  │    Database    │◀─────────┼─────────▶│    Vehicles    │                  │
│  └────────────────┘          │          └────────────────┘                  │
│                              ▼                                               │
│                    ┌──────────────────────┐                                  │
│                    │  🧭 PROGRAM MAPPING   │ ◀──── CENTER                    │
│                    │        HUB            │       (65 fields, 23 views)     │
│                    │   (Central Hub)       │                                 │
│                    └──────────────────────┘                                  │
│                              │                                               │
│         ┌────────────────────┼────────────────────┐                         │
│         ▼                    ▼                    ▼                          │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐                 │
│  │ 🎯 BD        │   │ 📅 BD Events │   │ 📓 Enrichment    │                 │
│  │ Opportunities│   │              │   │    Runs Log      │                 │
│  └──────────────┘   └──────────────┘   └──────────────────┘                 │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Database Architecture (16 Databases)

| Category | Database | Collection ID | Records | Status |
|----------|----------|---------------|---------|--------|
| **CORE** | 🧭 Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Dynamic | ✅ Active |
| **CORE** | 🎯 BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | Dynamic | ✅ Active |
| **CORE** | 📓 Enrichment Runs Log | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` | Dynamic | ✅ Active |
| **REFERENCE** | 🏛️ Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | 388+ | ✅ Active |
| **REFERENCE** | 🏢 Contractors Database | `3a259041-22bf-4262-a94a-7d33467a1752` | 15 | ⏳ Needs population |
| **REFERENCE** | 🚚 Contract Vehicles | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | 9 | ⏳ Needs population |
| **REFERENCE** | 🌍 Defense Program Universe | `bba2faa7-e297-4990-a179-3d0acc65c52d` | - | ✅ Active |
| **REFERENCE** | 📋 DoD Programs Master | `4fa19e91-62c8-432a-8aa4-0f73f5416b41` | - | ✅ Active |
| **CONTACTS** | ⭐ DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | 965+ | ✅ Active |
| **CONTACTS** | 🏢 GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | 1,052 | ✅ Active |
| **CONTACTS** | 👤 Contacts Database | `dbad3487-5371-452e-903a-40f070e598aa` | - | ✅ Active |
| **JOBS** | 💼 GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | 700 | ✅ Active |
| **JOBS** | 🔍 Insight Global Jobs | `69f0d6de-24c8-4878-9eed-b2e4f6c7d63f` | 178 | ✅ Active |
| **EVENTS** | 📅 BD Events | `8bf60d75-5638-41be-8d5d-6f8cf2601441` | - | ✅ Active |

### API Connections

| System | Type | Endpoint/Details |
|--------|------|------------------|
| Notion MCP | OAuth Integration | `https://mcp.notion.com/mcp` |
| n8n Cloud | Webhook/MCP | `https://primetech.app.n8n.cloud` |
| n8n MCP Server | HTTP | `https://primetech.app.n8n.cloud/mcp-server/http` |
| Apify | API | Scraper actors for job boards |

### Rate Limits
- **General Notion MCP:** 180 requests/minute (3/second)
- **Search-specific:** 30 searches/minute
- **Recommended batch size:** 10 records with delays

---

## 4. CODE & CONFIGURATIONS

### 4.1 PTS_Enhanced_Custom_Instructions_v2.md

**Purpose:** Project custom instructions for Claude with Prompt Workshop mode

**Full Content:**
```markdown
# PTS Notion BD Intelligence System
## Custom Instructions v2.0 (January 2026)

---

## 🎯 PROMPT WORKSHOP MODE (CRITICAL - ALWAYS ACTIVE)

**For EVERY prompt involving Notion MCP operations, Claude MUST:**

### Step 1: Analyze the Request
Before executing, evaluate the prompt against the Prompt Playbook (`PTS_Claude_Notion_MCP_Prompt_Playbook.md`) and identify:
- Which MCP tools are needed
- Which databases are targeted (with Collection IDs)
- Potential rate limit concerns
- Schema dependencies

### Step 2: Suggest Optimizations
Respond with a **Prompt Workshop** block offering improvements:

📋 PROMPT WORKSHOP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 YOUR REQUEST: [Brief summary]

🔧 TOOLS NEEDED:
• [tool-name] → [purpose]

📊 DATABASES TARGETED:
• [Database Name] (Collection: [ID])

⚡ OPTIMIZATION SUGGESTIONS:
1. [Suggestion to improve efficiency/accuracy]
2. [Additional capability we could add]
3. [Way to reduce manual follow-up]

🚀 ENHANCED PROMPT (Ready to Execute):
[Rewritten prompt incorporating best practices]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Proceed with enhanced version? (Y/auto-proceed after 3s)

### Step 3: Execute with Maximum Automation
- Batch operations where possible (up to 100 pages per call)
- Chain tools automatically (search → fetch → update → comment)
- Log actions to Enrichment Runs Log when appropriate
- Report comprehensive results with next-step recommendations

### Workshop Bypass Triggers
Skip the workshop and execute immediately when prompt includes:
- "Execute now" or "just do it"
- "Skip workshop"
- "GOD mode" (maximum automation, no confirmations except destructive)

---

## 📚 DOCUMENTATION HIERARCHY

When handling Notion operations, consult in this order:

1. **PTS_Claude_Notion_MCP_Prompt_Playbook.md** - Quick reference for prompts, templates, Collection IDs
2. **PTS_Claude_Notion_MCP_Integration_Guide.docx** - Deep dive on tool capabilities, security, advanced patterns
3. **PTS_BD_Intelligence_Architecture_Blueprint_v3_3_FINAL.docx** - Full database schemas, field definitions
4. **PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx** - Program classification methodology

---

## 🏗️ System Architecture

### Workspace Overview
This Notion workspace powers the **Prime Technical Services BD Intelligence System** - a defense contracting business development automation platform that:
- Scrapes competitor job boards (Insight Global, TEKsystems, CACI, GDIT, Booz Allen, Leidos, Peraton)
- Uses AI (GPT-4o) to map jobs to DoD/IC programs
- Calculates BD opportunity scores (Hot ≥80 / Warm 50-79 / Cold <50)
- Tracks recompetes, contract vehicles, and competitive intelligence

### Data Flow
Apify Scrapers → n8n Webhook → Hub (raw_import) → GPT-4o Enrichment 
→ Hub (enriched) → Scoring → BD Opportunities → Slack/Email Alerts

### Hub-and-Spoke Model
- **CENTER:** Program Mapping Intelligence Hub
- **REFERENCE SPOKES:** Federal Programs, Contractors, Contract Vehicles
- **OUTPUT SPOKES:** BD Opportunities, Events, Enrichment Runs Log

---

## 📊 Database Reference (Collection IDs)

### CORE OPERATIONS
| Database | Collection ID | Purpose |
|----------|---------------|---------|
| 🧭 Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Central jobs + enrichment hub (65 fields, 23 views) |
| 🎯 BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | Sales pipeline (16 fields) |
| 📓 Enrichment Runs Log | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` | Workflow telemetry (12 fields) |

### REFERENCE DATA
| Database | Collection ID | Purpose |
|----------|---------------|---------|
| 🏛️ Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | DoD/IC program catalog (388+ programs) |
| 🏢 Contractors Database | `3a259041-22bf-4262-a94a-7d33467a1752` | Prime/Sub company profiles |
| 🚚 Contract Vehicles Master | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | GWAC/IDIQ vehicles |
| 🌍 Defense Program Universe | `bba2faa7-e297-4990-a179-3d0acc65c52d` | Strategic program catalog |
| 📋 DoD Programs Master | `4fa19e91-62c8-432a-8aa4-0f73f5416b41` | BD targets not in Federal Programs |

### CONTACTS
| Database | Collection ID | Purpose |
|----------|---------------|---------|
| ⭐ DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | HUMINT contacts (965+) |
| 🏢 GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | GDIT non-DCGS contacts |
| 👤 Contacts Database | `dbad3487-5371-452e-903a-40f070e598aa` | General BD contacts |

### JOB TRACKING
| Database | Collection ID | Purpose |
|----------|---------------|---------|
| 💼 GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | GDIT job postings |
| 🔍 Insight Global Jobs | `69f0d6de-24c8-4878-9eed-b2e4f6c7d63f` | IG scraped jobs |
| 📅 BD Events | `8bf60d75-5638-41be-8d5d-6f8cf2601441` | Events/conferences |

---

## 🔧 MCP Tools Reference

### Rate Limits
- **General:** 180 requests/minute (3/second)
- **Search-specific:** 30 searches/minute
- **Batch recommendation:** Process in groups of 10 with delays

### Tool Selection Guide
| Operation | Primary Tool | Fallback |
|-----------|--------------|----------|
| Find records | `Notion:notion-search` | `notion:notion-search` |
| Get schema/content | `Notion:notion-fetch` | `notion:notion-fetch` |
| Create records | `Notion:notion-create-pages` | - |
| Update records | `Notion:notion-update-page` | - |
| Modify schema | `Notion:notion-update-database` | - |
| Move pages | `Notion:notion-move-pages` | - |
| Clone pages | `Notion:notion-duplicate-page` | - |
| Add notes | `Notion:notion-create-comment` | - |

### Tool Chaining Patterns
For maximum automation, chain tools in these patterns:
1. **Research:** search → fetch → analyze → report
2. **Create Pipeline:** fetch schema → create pages → update relations → comment
3. **Bulk Update:** search → fetch each → update → log to Enrichment Runs
4. **Full Automation:** search → fetch → update → create BD Opportunity → comment → alert

---

## ⚠️ SCHEMA-LOCKED PROPERTIES (DO NOT MODIFY)

These properties are used by n8n workflows - **never rename or delete without coordinating n8n updates:**

### Program Mapping Hub
Status, Enrichment Timestamp, AI Confidence Score, Priority Score,
Apify Run ID, Source URL, Job Title, Company, Job Description, Clearance Level

### Federal Programs
property_contract_value, property_contract_vehicle_type,
property_program_type_1, property_confidence_level, Program Name

### Status State Machine (exact values required)
raw_import → pending_enrichment → enriching → enriched → validated → error

---

## 🔌 N8N Integration Awareness

### Active Workflows (3)
1. **Apify Job Import** - Webhook creates jobs in Hub (Status: raw_import)
2. **Enrichment Processor** - 15min schedule, GPT-4o enrichment, updates scores
3. **Priority Alert** - Triggers on Priority Score changes (Hot/Warm/Cold notifications)

### n8n MCP Server
- **URL:** `https://primetech.app.n8n.cloud/mcp-server/http`
- **Instance:** primetech.app.n8n.cloud (v2.26.3)

### Coordination Rules
- Schema changes require n8n workflow updates
- Status field values must match exactly
- Log significant operations to Enrichment Runs Log

---

## ✅ Working Agreements

### Before ANY Notion Operation:
1. **ALWAYS** fetch database schema before create/update operations
2. **USE** Collection IDs (not Database IDs) for MCP data source operations
3. **CHECK** schema-locked list before any modifications
4. **VERIFY** property names are exact (case-sensitive!)

### For Modifications:
5. **FLAG** if changes might break n8n integrations
6. **USE** relations (not text) for cross-database links
7. **CONFIRM** before destructive changes (deletions, schema modifications)
8. **COORDINATE** with n8n project for schema changes

### For Bulk Operations:
9. **PROCESS** in batches of 10 to avoid rate limits
10. **SEQUENTIAL** over parallel - run searches one at a time
11. **INCLUDE** error handling - report failures
12. **LOG** to Enrichment Runs Log for auditability

### Formatting Requirements:
13. **DATE FORMAT:** YYYY-MM-DD for all date properties
14. **SELECT OPTIONS:** Include complete arrays when updating (existing + new)
15. **CHECKBOXES:** Use `"__YES__"` and `"__NO__"` (not true/false)

---

## 🎮 User Preferences

- **GOD mode control** - Maximum automation and thoroughness when requested
- **Defense contracting terminology** - Use DCGS, HUMINT, TS/SCI, ISR, etc. naturally
- **Batch operations** - Combine when possible (up to 100 pages per create call)
- **Progress reports** - Provide detailed status for multi-step operations
- **Proactive suggestions** - Recommend next actions and automation opportunities
- **Minimal manual actions** - Automate everything possible via MCP

---

## 📊 Priority Score Classification

| Score | Class | Color | Action |
|-------|-------|-------|--------|
| 80-100 | HOT | 🔴 | Immediate pursuit, assign BD lead |
| 50-79 | WARM | 🟡 | Monitor, prep capability statement |
| 0-49 | COLD | 🟢 | Track only, no active pursuit |

### Scoring Algorithm
Clearance Alignment:     35 points max
Program Relevance:       20 points max
Location Proximity:      15 points max
Contract Value:          15 points max
Recompete Timing:        15 points max
────────────────────────────────────
Total:                  100 points

---

## 🛠️ Troubleshooting Quick Reference

| Error | Solution |
|-------|----------|
| Rate limit exceeded | Smaller batches, add 30s delays |
| Property not found | Fetch schema, verify exact name (case-sensitive) |
| Database ID invalid | Use Collection ID instead |
| Search returns nothing | Broaden terms, use fetch with URL |
| Can't update multi-source DB | Must use Notion UI manually |
| Select value rejected | Add option first via update-database |

---

## 📌 Current Priorities

1. ✅ Database architecture verified (12+ databases)
2. ⏳ BD Opportunities workflow optimization
3. ⏳ Data import for Contractors Database  
4. ⏳ Formula field implementation (11 placeholders in Hub)
5. ⏳ Connect Enrichment Runs Log to n8n workflows
6. ⏳ ~550 GDIT Jobs need program mapping

---

## 🚀 Quick Start Prompts

### Get Oriented
Fetch the schema for Program Mapping Hub and show me all properties with their types.

### Find Hot Opportunities
Search for all records in Program Mapping Hub where Priority Score >= 80 and Status = "enriched". Group by Program Name.

### Create BD Opportunity
Create a new BD Opportunity for [PROGRAM] with Priority Score [X] and link to the source job posting.

### Bulk Classification
Find all unmapped jobs in GDIT Jobs database and classify them using the Program Keyword Mapping Guide.

---

*For detailed prompt templates and advanced patterns, see: `PTS_Claude_Notion_MCP_Prompt_Playbook.md`*

*For full MCP tool documentation and security guidance, see: `PTS_Claude_Notion_MCP_Integration_Guide.docx`*
```

---

### 4.2 MCP Tools Reference Table

**Purpose:** Complete list of 14 Notion MCP tools with PTS-specific use cases

```markdown
| Tool | Purpose | Rate Limit | PTS Use Case |
|------|---------|------------|--------------|
| `notion-search` | Semantic search across workspace + connected apps | **30/min** | Find BD opportunities by keyword, program name, contractor |
| `notion-fetch` | Get page/database content by URL or ID | 180/min | Get Hub schema, read opportunity details |
| `notion-create-pages` | Create one or more pages | 180/min | Add job postings, create BD opportunities |
| `notion-update-page` | Update properties or content | 180/min | Change Status, update Priority Score |
| `notion-create-database` | Create new database with schema | 180/min | Create tracking databases |
| `notion-update-database` | Modify schema, add/remove properties | 180/min | Add fields to Hub, update select options |
| `notion-move-pages` | Move pages/databases to new parent | 180/min | Reorganize workspace, archive |
| `notion-duplicate-page` | Clone page with all content (async) | 180/min | Create playbook templates |
| `notion-query-data-sources` | Cross-DB queries (Enterprise only) | 30/min | N/A - not on Enterprise |
| `notion-create-comment` | Add comment to a page | 180/min | Add analysis notes |
| `notion-get-comments` | List all comments on a page | 180/min | Review BD team feedback |
| `notion-get-teams` | List teamspaces in workspace | 180/min | Find team IDs |
| `notion-get-users` | List workspace users | 180/min | Assign BD leads |
| `notion-get-self` | Get bot user info | 180/min | Verify connection |
```

---

### 4.3 Prompt Workshop Block Template

**Purpose:** Standard format for prompt optimization suggestions

```markdown
📋 PROMPT WORKSHOP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 YOUR REQUEST: [Brief summary of user's request]

🔧 TOOLS NEEDED:
• notion-search → [purpose]
• notion-fetch → [purpose]
• notion-update-page → [purpose]

📊 DATABASES TARGETED:
• [Database Name] (Collection: [full-collection-id])

⚡ OPTIMIZATION SUGGESTIONS:
1. [Suggestion to improve efficiency/accuracy]
2. [Additional capability we could add]
3. [Way to reduce manual follow-up]

🚀 ENHANCED PROMPT (Ready to Execute):
[Complete rewritten prompt incorporating best practices]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Proceed with enhanced version? (Y/auto-proceed after 3s)
```

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 Program Mapping Hub (Central Hub)

**Collection ID:** `f57792c1-605b-424c-8830-23ab41c47137`  
**Database ID:** `0a0d7e46-3d88-40b6-853a-3c9680347644`  
**Fields:** 65  
**Views:** 23  

**Schema-Locked Properties (n8n dependencies):**
| Property | Type | n8n Usage |
|----------|------|-----------|
| Status | Select | State machine trigger |
| Enrichment Timestamp | Date | Processing tracking |
| AI Confidence Score | Number | GPT-4o output |
| Priority Score | Number | Alert trigger (80/50 thresholds) |
| Apify Run ID | Text | Batch tracking |
| Source URL | URL | Deduplication key |
| Job Title | Title | Display name |
| Company | Text | Contractor identification |
| Job Description | Text | AI analysis input |
| Clearance Level | Select | Scoring factor |

**Status State Machine:**
```
raw_import → pending_enrichment → enriching → enriched → validated → error
```

---

### 5.2 BD Opportunities

**Collection ID:** `2bcdef65-baa5-80ed-bd95-000b2f898e17`  
**Fields:** 16  

| Property | Type | Purpose |
|----------|------|---------|
| Opportunity Name | Title | Display name |
| Program | Relation | Link to Federal Programs |
| Priority Score | Number | BD classification (Hot/Warm/Cold) |
| Status | Select | Pipeline stage |
| Prime | Text | Prime contractor |
| Source | Text | Where opportunity was found |

---

### 5.3 Federal Programs

**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`  
**Database ID:** `9db40fce-0781-42b9-902c-d4b0263b1e23`  
**Records:** 388+  

**Schema-Locked Properties:**
| Property | Type | n8n Usage |
|----------|------|-----------|
| Program Name | Title | Primary identifier |
| property_contract_value | Number | Scoring factor |
| property_contract_vehicle_type | Select | Classification |
| property_program_type_1 | Select | Program categorization |
| property_confidence_level | Select | Data quality indicator |

---

## 6. N8N WORKFLOWS

### 6.1 Apify Job Import Workflow

**Purpose:** Receive scraped jobs from Apify and create records in Hub  
**Trigger:** Webhook  
**Status:** ✅ Active  

**Node Sequence:**
```
Webhook (POST) → Parse JSON → Create Notion Pages → Set Status: "raw_import"
```

**Key Configuration:**
- Sets `Status = "raw_import"` on all new records
- Populates: Job Title, Company, Source URL, Apify Run ID, Job Description

---

### 6.2 Enrichment Processor Workflow

**Purpose:** Process raw imports through GPT-4o for program mapping  
**Trigger:** Schedule (15-minute interval)  
**Status:** ✅ Active  

**Node Sequence:**
```
Schedule → Query Hub (Status = "raw_import") → GPT-4o Enrichment → Update Hub → Calculate Priority Score → Update Status: "enriched"
```

**Key Configuration:**
- Queries for `Status = "raw_import"` OR `Status = "pending_enrichment"`
- GPT-4o maps to Federal Programs database
- Sets AI Confidence Score (0-1)
- Calculates Priority Score (0-100)
- Updates Status to "enriched"

---

### 6.3 Priority Alert Workflow

**Purpose:** Send notifications for hot/warm opportunities  
**Trigger:** Database change on Priority Score  
**Status:** ✅ Active  

**Node Sequence:**
```
Database Trigger → Check Priority Score → Branch (Hot/Warm/Cold) → Send Slack/Email
```

**Key Configuration:**
- Hot (≥80): Immediate Slack + Email
- Warm (50-79): Daily digest
- Cold (<50): No notification

---

## 7. APIFY ACTORS & SCRAPERS

### Currently Active Scrapers

| Target | Actor Type | Status | Records |
|--------|------------|--------|---------|
| Insight Global | Puppeteer | ✅ Active | 178 |
| GDIT | Web Scraper | ✅ Active | 700 |
| CACI | Planned | ⏳ Pending | - |
| Leidos | Planned | ⏳ Pending | - |
| Booz Allen | Planned | ⏳ Pending | - |

**Output Schema:**
```json
{
  "jobTitle": "string",
  "company": "string",
  "location": "string",
  "clearanceLevel": "string",
  "description": "string",
  "sourceUrl": "string",
  "postedDate": "date",
  "apifyRunId": "string"
}
```

---

## 8. PROBLEMS SOLVED

### Problem 1: Database ID vs Collection ID Confusion
**Description:** MCP operations failing with "Database ID invalid" errors  
**Root Cause:** Using Database IDs instead of Collection IDs for data_source operations  
**Solution:** Always use Collection IDs (e.g., `f57792c1-605b-424c-8830-23ab41c47137`) not Database IDs

---

### Problem 2: Rate Limit Exceeded on Bulk Operations
**Description:** Bulk update operations hitting 429 errors  
**Root Cause:** Running too many parallel searches (>30/min)  
**Solution:** Process in batches of 10, run searches sequentially, add 30s delays

---

### Problem 3: Select Value Rejected
**Description:** Update operations failing when setting select properties  
**Root Cause:** Attempting to use select values that don't exist in the schema  
**Solution:** Fetch schema first, then use `update-database` to add new options before using them

---

### Problem 4: Multi-Source Database Modifications Failing
**Description:** Cannot rename/modify certain databases via API  
**Root Cause:** Databases with multiple data sources have API limitations  
**Solution:** Use Notion UI manually for these operations; document which databases are affected

---

### Problem 5: Prompt Inefficiency
**Description:** Simple prompts not leveraging full MCP capabilities  
**Root Cause:** Users not aware of tool chaining possibilities  
**Solution:** Implemented Prompt Workshop mode that suggests optimizations for every Notion prompt

---

## 9. PENDING ITEMS / NEXT STEPS

### High Priority
1. **~550 GDIT Jobs need program mapping** - Use Program Keyword Mapping Guide for classification
2. **11 Hub formula field implementations** - Placeholders need actual formulas
3. **Workflow 4: Hub → BD Opportunities pipeline** - Automated promotion of qualified leads

### Medium Priority
4. **Contractors Database population** - Currently only 15 companies
5. **Contract Vehicles Master population** - Currently only 9 vehicles
6. **Connect Enrichment Runs Log to n8n** - Enable workflow telemetry

### Low Priority / Future
7. **SAM.gov contract notification integration** - For recompete tracking
8. **Weekly executive summary automation** - Dashboard generation
9. **Additional scraper actors** - CACI, Leidos, Booz Allen

---

## 10. KEY INSIGHTS & GOTCHAS

### 🚨 Critical Gotchas

1. **Collection IDs ≠ Database IDs**
   - MCP data_source operations require Collection IDs
   - Database IDs look similar but will fail
   - Always verify which ID type you're using

2. **Schema-Locked Properties**
   - Never modify without n8n coordination
   - Status values must match EXACTLY (case-sensitive)
   - Breaking these breaks the entire automation pipeline

3. **Multi-Source Database Limitation**
   - Databases with `?v=viewId` in URL may have multiple data sources
   - Cannot be modified/deleted via API
   - Must use Notion UI for changes

4. **Rate Limits are Per-User, Not Per-Tool**
   - 180 requests/minute TOTAL across all tools
   - 30 searches/minute is a separate, stricter limit
   - Plan batch operations accordingly

### 💡 Pro Tips

5. **Always Fetch Schema First**
   - Property names are case-sensitive
   - Select options must exist before use
   - Schemas change; don't assume

6. **Use Tool Chaining**
   - Combine: search → fetch → update → comment
   - More efficient than separate operations
   - Better for audit trails

7. **Checkbox Values are Special**
   - Use `"__YES__"` and `"__NO__"` 
   - NOT `true`/`false`
   - NOT `1`/`0`

8. **Date Format is Strict**
   - Always use `YYYY-MM-DD`
   - For datetime: `"date:Property:is_datetime": 1`

9. **Select Updates Need Full Arrays**
   - When adding new options, include ALL existing options
   - Missing options get deleted

10. **Enterprise Doesn't Improve MCP**
    - Same 14 tools on Business and Enterprise
    - Same rate limits
    - Save the money unless you need SCIM/audit logs

### 📚 Documentation References

| Document | Purpose |
|----------|---------|
| `PTS_Enhanced_Custom_Instructions_v2.md` | Project custom instructions with Prompt Workshop |
| `PTS_Claude_Notion_MCP_Prompt_Playbook.md` | Quick reference prompts and templates |
| `PTS_Claude_Notion_MCP_Integration_Guide.docx` | Full MCP tool documentation |
| `PTS_Notion_to_N8N_Handoff_Prompt_v2.md` | Cross-project context transfer |
| `PTS_BD_Intelligence_Architecture_Blueprint_v3_3_FINAL.docx` | Complete database schemas |
| `PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx` | Program classification rules |

---

## DOCUMENT METADATA

**File:** `Notion_MCP_Integration_Documentation_Claude_Export_2026-01-10.md`  
**Generated:** January 10, 2026  
**Author:** Claude (Anthropic) via PTS BD Intelligence Project  
**Repository:** PTS BD Intelligence Codebase  
**Version:** 1.0  

### Files Created in This Session
1. `PTS_Claude_Notion_MCP_Integration_Guide.docx` - 40+ page Word document
2. `PTS_Claude_Notion_MCP_Prompt_Playbook.md` - Quick reference markdown
3. `PTS_Enhanced_Custom_Instructions_v2.md` - Updated project instructions
4. `PTS_Notion_to_N8N_Handoff_Prompt_v2.md` - Cross-project handoff system
5. `Notion_MCP_Integration_Documentation_Claude_Export_2026-01-10.md` - This export document

---

*End of Export Document*
