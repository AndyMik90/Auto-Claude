# PTS BD INTELLIGENCE SYSTEM
## NOTION PROJECT HANDOFF DOCUMENT
### Version 1.0 | December 27, 2025

*Complete extraction from 15+ consolidation sessions for project continuity*

---

## 1. PROJECT OVERVIEW

### What We're Building
The **Prime Technical Services BD Intelligence System** - a comprehensive defense contractor business development automation platform that:
- Scrapes competitor job boards (CACI, GDIT, Leidos, Booz Allen, Peraton, Insight Global, TEKsystems)
- Uses AI (GPT-4o) to map jobs to specific DoD/IC programs with confidence scoring
- Calculates BD opportunity scores using 100-point weighted algorithm
- Manages 6-tier HUMINT contact classification for targeted outreach
- Tracks recompetes, contract vehicles, and competitive intelligence
- Generates Hot/Warm/Cold prioritized alerts for capture teams

### Notion's Role in the Architecture
Notion is the **source of truth** for:
- All job intelligence data (Program Mapping Hub)
- Federal program reference data (388+ programs)
- Contact/HUMINT intelligence (1,000+ contacts)
- BD opportunity pipeline
- Contractor and contract vehicle reference data

### Current State (December 27, 2025)
**Consolidation Status: 85% Complete**

| Metric | Before | After | Status |
|--------|--------|-------|--------|
| Total Databases | 27+ | 12 target | ⏳ Manual cleanup needed |
| Contacts Migrated | 0 | 90+ | ✅ Complete |
| Programs Migrated | 0 | 13 | ✅ Complete |
| Contractors Populated | 0 | 15 | ✅ Complete |
| Contract Vehicles | 0 | 9 | ✅ Complete |
| Broken Jobs DBs | 11 | 11 | ⚠️ Require manual UI trash |

### Notion ↔ n8n Division of Responsibilities

| Notion Owns | n8n Owns |
|-------------|----------|
| Database schemas & properties | Workflow logic & triggers |
| Views & filters | API orchestration |
| Data storage & relations | Apify webhook handling |
| BD scoring formulas | GPT-4o API calls |
| HUMINT tier classifications | Status state machine transitions |
| Reference data (programs, contractors, vehicles) | Alert notifications |

---

## 2. FULL SYSTEM ARCHITECTURE (Notion's Perspective)

### Data Flow Diagram
```
[Apify Scrapers]
       │ Webhook
       ▼
[n8n: Job Import Workflow]
       │ Creates pages (Status: raw_import)
       ▼
┌─────────────────────────────────────────────────────────────┐
│           🧭 PROGRAM MAPPING INTELLIGENCE HUB              │
│           (Central Nexus - 65 fields, 23 views)            │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  REFERENCE DATABASES (Lookups/Enrichment)           │   │
│  │  ├── 🏛️ Federal Programs (388 programs)              │   │
│  │  ├── 🏢 Contractors Database (15 companies)          │   │
│  │  └── 🚚 Contract Vehicles Master (9 vehicles)        │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Status: raw_import → pending_enrichment → enriching       │
│          → enriched → validated → error                    │
└─────────────────────────────────────────────────────────────┘
       │ GPT-4o Enrichment
       ▼
[n8n: Enrichment Processor] ──→ [OpenAI GPT-4o]
       │ Updates Hub (Program Name, AI Confidence, Priority Score)
       │ Status → enriched
       ▼
[n8n: Priority Alert] ──→ [Slack/Email]
       │ Hot ≥80 / Warm 50-79 / Cold <50
       ▼
┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT DATABASES                         │
│  ├── 🎯 BD Opportunities (Pipeline)                        │
│  ├── 📅 BD Events (Conferences/Events)                     │
│  └── 📓 Enrichment Runs Log (Telemetry)                    │
└─────────────────────────────────────────────────────────────┘
```

### What Data Lives in Notion
| Database | Data Type | Why Here |
|----------|-----------|----------|
| Program Mapping Hub | Scraped jobs + AI enrichment | Central processing hub |
| Federal Programs | DoD/IC program catalog | Reference for program mapping |
| Contractors Database | Prime/Sub company profiles | Competitive intelligence |
| Contract Vehicles Master | GWAC/IDIQ vehicles | Opportunity qualification |
| DCGS Contacts Full | HUMINT contacts (965+) | BD outreach pipeline |
| BD Opportunities | Qualified opportunities | Capture team workflow |

### What Flows INTO Notion
| Source | Trigger | Destination | Data |
|--------|---------|-------------|------|
| Apify Cloud | Webhook POST | Program Mapping Hub | Raw job postings |
| GPT-4o | n8n schedule (15min) | Program Mapping Hub | Program mapping, confidence scores |
| Manual CSV Import | Claude MCP | DCGS Contacts Full | Contact data |
| SAM.gov/FPDS | Manual | Federal Programs | Contract data |

### What Flows OUT OF Notion
| Source | Trigger | Destination | Data |
|--------|---------|-------------|------|
| Program Mapping Hub | Priority Score change | Slack/Email | Hot/Warm/Cold alerts |
| Program Mapping Hub | Status = validated + Score ≥70 | BD Opportunities | Qualified opportunities |
| Enrichment Runs Log | Each workflow run | n8n logging | Telemetry data |

### What Notion Exposes for Integrations
| Element | Used By | Purpose |
|---------|---------|---------|
| Collection IDs | n8n workflows, MCP tools | Reliable database targeting |
| Status select values | n8n state machine | Workflow progression |
| Priority Score number | n8n alerts | Threshold triggers |
| Source URL | Deduplication | Prevent duplicate imports |

---

## 3. NOTION WORKSPACE ARCHITECTURE

### TARGET 12-DATABASE ARCHITECTURE

#### 1. 🧭 Program Mapping Intelligence Hub
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `f57792c1-605b-424c-8830-23ab41c47137` |
| **Database ID** | `0a0d7e46-3d88-40b6-853a-3c9680347644` |
| **Purpose** | Central hub for all jobs, enrichment, and BD scoring |
| **Status** | ✅ Active (65 fields, 23 views) |

**Key Properties:**
| Property | Type | Purpose | Schema-Locked |
|----------|------|---------|---------------|
| Job Title | title | Primary identifier | ⚠️ YES |
| Company | text | Source tracking | ⚠️ YES |
| Program Name | text | AI-mapped DoD/IC program | |
| Status | select | Workflow state machine | ⚠️ YES |
| Priority Score | number | 0-100 BD score | ⚠️ YES |
| AI Confidence Score | number | 0-1 GPT-4o confidence | ⚠️ YES |
| Source URL | url | Deduplication key | ⚠️ YES |
| Job Description | text | AI enrichment input | ⚠️ YES |
| Clearance Level | select | Security requirement | ⚠️ YES |
| Enrichment Timestamp | date | Processing timing | ⚠️ YES |
| Apify Run ID | text | Batch tracking | ⚠️ YES |
| Source Program | select | NEW - 15 options (CANES, JRSS, etc.) | |

**Status State Machine (exact values):**
```
raw_import → pending_enrichment → enriching → enriched → validated → error
```

**Views (23 total):**
- Pipeline: All Records, 🚨 Pending Enrichment, ⚡ Currently Processing, ✅ Enriched & Ready
- Analysis: 🏆 High Confidence, 🏢 By Agency, 💼 By Contract Vehicle, 📊 By Prime Contractor
- BD Capture: 📈 BD Capture Pipeline, ⏰ Upcoming Recompetes, 🤝 Subcontractor Opportunities
- QA: 🔍 Needs Review, 🧰 Needs Human Review, 🔁 Duplicates

---

#### 2. 🏛️ Federal Programs
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` |
| **Database ID** | `9db40fce-0781-42b9-902c-d4b0263b1e23` |
| **Purpose** | DoD/IC program catalog (388+ programs) |
| **Status** | ✅ Active (+13 programs migrated from legacy DBs) |

**Key Properties:** Program Name (title), Agency, Prime Contractor, Contract Value, Contract Vehicle Type, Program Type 1, Confidence Level, PTS Involvement

**Migrated Programs (13 new):**
- From Defense Program Universe: DIA ISEO, DISA GSM-O II, Sentinel GBSD, Army AESD, Army AvMC EITSS, DoD JSP, USAF 16th AF Mission IT
- From DoD Programs Master: CANES, JRSS, NJRSS, AFSIM, Counter-UAS, EVMS

---

#### 3. 🏢 Contractors Database
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `3a259041-22bf-4262-a94a-7d33467a1752` |
| **Database ID** | `ca67175b-df3d-442d-a2e7-cc24e9a1bf78` |
| **Purpose** | Prime/Sub contractor profiles |
| **Status** | ✅ Populated (15 companies) |

**Populated Companies:**
- Large Primes (10): Northrop Grumman, Lockheed Martin, GDIT, Leidos, Booz Allen Hamilton, BAE Systems, Raytheon, CACI, Peraton, ManTech
- Staffing (3): Insight Global, TEKsystems, Apex Group
- Small Business (2): SHINE Systems, Prime Technical Services (SDVOSB)

**Schema Enhanced:** 17 Key Capabilities options, 9 Subcontractor To options

---

#### 4. 🚚 Contract Vehicles Master
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `0f09543e-9932-44f2-b0ab-7b4c070afb81` |
| **Database ID** | `e1166305-1b1f-4812-b665-bcfa6a87a2ab` |
| **Purpose** | GWAC/IDIQ vehicle reference |
| **Status** | ✅ Populated (9 vehicles) |

**Populated Vehicles:** CIO-SP3 ($20B), SEWP V ($10B), Alliant 2 ($50B), OASIS+ ($60B), 8(a) STARS III ($50B), DISA Encore III ($17.5B), GSA IT Schedule 70, ITES-3S ($12.9B), RS3 ($37.4B)

**Schema Enhanced:** 14 Agency options, 8 NAICS Code options

---

#### 5. 📓 Enrichment Runs Log
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` |
| **Database ID** | `9b9328d2-f969-40e3-9d33-a4168620fb1b` |
| **Purpose** | Workflow telemetry and debugging |
| **Status** | ✅ Schema Ready (n8n connection pending) |

---

#### 6. 🎯 BD Opportunities
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `2bcdef65-baa5-80ed-bd95-000b2f898e17` |
| **Purpose** | Qualified opportunities for capture team |
| **Status** | ✅ Active |

**Priority Thresholds:**
- 🔥 Hot: Score ≥80 (Immediate action)
- 🟡 Warm: Score 50-79 (Priority outreach)
- ❄️ Cold: Score <50 (Monitor)

---

#### 7. 📅 BD Events
| Status | ⏳ Pending split from BD Opportunities & Events |
| **Current Source** | BD Opportunities & Events (8bf60d75-5638-41be-8d5d-6f8cf2601441) |
| **Action Needed** | Create separate database for conferences/events |

---

#### 8. ⭐ DCGS Contacts Full
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `2ccdef65-baa5-8087-a53b-000ba596128e` |
| **Purpose** | Primary HUMINT contact database (965+ contacts) |
| **Status** | ✅ Active (+90 contacts migrated) |

**Schema Enhanced:**
- Added "Company Name" text field
- Added "Verified" select field (Unverified, LinkedIn Verified, Phone Verified, Email Verified)
- Added "Sentinel GBSD", "Lockheed Martin", "F-35" to Program options

**Migrated Contacts (90+):**
- GBSD Contacts: 35 (Northrop Grumman, Sentinel GBSD program)
- Lockheed Contacts: 55 (Lockheed Martin, various programs)

**HUMINT 6-Tier Hierarchy:**
| Tier | Role Examples | BD Purpose | Approach Order |
|------|---------------|------------|----------------|
| Tier 1 - Executive | VP, C-Suite | Strategic alignment | LAST |
| Tier 2 - Director | Director-level | Portfolio direction | 5th |
| Tier 3 - Program Leadership | PM, Site Lead | Decision makers | 4th |
| Tier 4 - Management | Manager, Team Lead | Validate intel | 3rd |
| Tier 5 - Senior IC | Senior Engineer | Relationship building | 2nd |
| Tier 6 - Individual | Analyst, Engineer | Intel gathering | FIRST |

**PACAF Override Rule:** ALL AF DCGS - PACAF (San Diego) contacts = 🔴 CRITICAL regardless of tier

---

#### 9. 🏢 GDIT Other Contacts
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `70ea1c94-211d-40e6-a994-e8d7c4807434` |
| **Purpose** | GDIT non-DCGS contacts (1,052 records) |
| **Status** | ✅ Active |

---

#### 10. 💼 GDIT Jobs
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `2ccdef65-baa5-80b0-9a80-000bd2745f63` |
| **Purpose** | GDIT job postings (700 records) |
| **Status** | ✅ Active (~550 need program mapping) |

**Program Options (22):** BICES, BICES-X, JUSTIFIED, ISEE, DEOS, CBOSS, NCIS, NSST, CMS, BAO, MPCO, INSCOM, SITEC, SCITES, WARHAWK, JSP ETM, AFNORTH, DLA, F-35 JSF, DHA D2D, CENTCOM, ADCS4, DSMS, ADCNOMS, Other

---

#### 11. 🔍 Insight Global Jobs (Dec 2025)
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `69f0d6de-24c8-4878-9eed-b2e4f6c7d63f` |
| **Purpose** | Insight Global scraped jobs (178 records) |
| **Status** | ✅ Active |

**Key Properties:** Job Title, Location, State, Clearance, Program, Task Order/Site, Prime Contractor, Confidence, BD Score, BD Priority, DCGS Relevance, Job URL, Scraped Date

---

#### 12. 👤 Contacts Database
| Attribute | Value |
|-----------|-------|
| **Collection ID** | `dbad3487-5371-452e-903a-40f070e598aa` |
| **Purpose** | General BD contacts/HUMINT |
| **Status** | ✅ Active |

---

### DATABASES PENDING MANUAL CLEANUP

#### Trash Required (11 broken Jobs databases)
All have poor schemas (unnamed columns " 1", " 2", " 3") and require **manual UI deletion** (multi-source API limitation):

| Database | Collection ID |
|----------|---------------|
| Jobs – CANES | `9eff72f7-2c56-418a-a921-413e36766c25` |
| Jobs – AFSIM | `1c03fa5c-0d38-4269-b78c-7cdef5d99fc5` |
| Jobs – Jessup Cyber Security | `c4152f84-3321-4bbc-80f8-3c2600c3d9f4` |
| Jobs – JRSS | `afd6cdc2-00e8-4ab5-9282-60a5bd792885` |
| Jobs – NJRSS | `18957064-fda1-4e24-935a-a4c4a16565d8` |
| Jobs – Project LUPUS | `2db5ff90-192c-4b58-a07c-e8a99d2e5772` |
| Jobs – Project INDUS | `20b6b38c-a5e8-4434-a972-325bb0cf5e35` |
| Jobs – Project AURIGA | `bb6585d4-1d3b-49d6-80ab-0faf602e0544` |
| Jobs – NRO_NGA Support | `013053bb-5ffd-460c-bc0b-4f641a70aaf1` |
| Jobs – Counter-UAS | `d954c29f-ada9-4b2d-92ac-328b44b9835b` |
| Jobs – EVMS | `e58eddb6-2e5c-4d6c-997c-9931bb54adae` |

**Why Manual Required:** These are multi-source databases (DoD Programs Master has relation fields to them). Notion API cannot delete multi-source databases.

#### Archive After Validation (4 source databases)
| Database | Collection ID | Reason |
|----------|---------------|--------|
| Defense Program Universe | `bba2faa7-e297-4990-a179-3d0acc65c52d` | Data migrated to Federal Programs |
| DoD Programs Master | `4fa19e91-62c8-432a-8aa4-0f73f5416b41` | Data migrated to Federal Programs |
| Lockheed Contact CSV | `294def65-baa5-811f-9238-000b238c1f5d` | Data migrated to DCGS Contacts Full |
| GBSD Contact Chart | `264def65-baa5-816a-8f9c-000b83a23db5` | Data migrated to DCGS Contacts Full |

#### Already Trashed (2 databases - completed)
- BD Targets — Insight Global (`9b9e7140-c13a-4c41-ae3a-0b926230d726`)
- Job Postings Database (`d92495a2-c753-48e3-9c2b-33c40ed21f06`)

---

## 4. MCP TOOL CONFIGURATION & USAGE

### Notion Connector (Native Claude Integration)
**Prefix:** `Notion:` (uppercase N)
**Status:** ✅ CONNECTED
**Integration:** Built into Claude via Anthropic's native Notion integration

**Available Tools (14):**
| Tool | Purpose | When to Use |
|------|---------|-------------|
| `Notion:notion-search` | Semantic search across workspace | Finding pages/databases by content |
| `Notion:notion-fetch` | Retrieve page/database by URL or ID | Get full schema, views, SQLite definitions |
| `Notion:notion-create-pages` | Create one or more pages | Batch data imports, new records |
| `Notion:notion-update-page` | Update page properties or content | Modifying existing records |
| `Notion:notion-create-database` | Create new database with schema | New database setup |
| `Notion:notion-update-database` | Modify database schema | Adding/removing properties |
| `Notion:notion-move-pages` | Move pages to new parent | Reorganization |
| `Notion:notion-duplicate-page` | Duplicate a page asynchronously | Templating |
| `Notion:notion-create-comment` | Add comment to a page | Collaboration notes |
| `Notion:notion-get-comments` | Retrieve all comments on a page | Review feedback |
| `Notion:notion-get-teams` | List teamspaces | Workspace organization |
| `Notion:notion-get-users` | List workspace users | Finding user IDs |
| `Notion:notion-get-user` | Get specific user details | User lookup |
| `Notion:notion-get-self` | Get current bot user info | Connection verification |

### Notion MCP Server
**Prefix:** `notion:` (lowercase n)
**Status:** ✅ CONNECTED
**Server URL:** `https://mcp.notion.com/mcp`

**Available Tools:** Same 14 tools as Native Connector with identical functionality

### MCP vs Connector Decision Guide

| Use Notion Connector (`Notion:`) | Use Notion MCP (`notion:`) |
|----------------------------------|----------------------------|
| **DEFAULT CHOICE** - slightly lower latency | Fallback if Connector errors |
| Large batch operations | Alternative for debugging |
| Standard CRUD operations | Isolating connection issues |

**Both connectors are functionally identical.** Use `Notion:` as default, fall back to `notion:` if errors occur.

### n8n MCP Server
**Status:** ✅ CONNECTED
**Server URL:** `https://primetech.app.n8n.cloud/mcp-server/http`
**Instance:** primetech.app.n8n.cloud (v2.26.3)
**Purpose:** Workflow management, execution tracking, webhook testing (NOT direct Notion access)

### MCP Tool Patterns Established

**Successful Query Pattern:**
```
Notion:notion-fetch with Collection ID for schema
Notion:notion-search with data_source_url for targeted search
```

**Batch Creation Pattern:**
```
Notion:notion-create-pages with parent.data_source_id
Up to 100 pages per call
Properties match exact schema field names
```

**Database Schema Update Pattern:**
```
Notion:notion-fetch first to get current schema
Notion:notion-update-database with exact property type specifications
```

**Critical Learnings:**
- Always use Collection IDs (not Database IDs) for data source operations
- Collection IDs remain stable across modifications
- Multi-source databases CANNOT be renamed, have properties added, or deleted via API
- Fetch schema before any modifications
- Check schema-locked list before renaming properties

---

## 5. N8N INTEGRATION MAP (Reference Layer)

### Active Workflows (3)

#### Workflow 1: Apify Job Import
| Attribute | Value |
|-----------|-------|
| Trigger | Webhook: POST /webhook/job-import |
| Database | Program Mapping Hub (`f57792c1-605b-424c-8830-23ab41c47137`) |
| Properties Written | Job Title, Company, Location, Job Description, Source URL, Clearance Level, Status (raw_import), Apify Run ID |

#### Workflow 2: Enrichment Processor
| Attribute | Value |
|-----------|-------|
| Trigger | Schedule: Every 15 minutes |
| Filter | Status = pending_enrichment |
| Properties Written | Program Name, Agency, AI Confidence Score, Priority Score, Status (enriched) |

#### Workflow 3: Priority Alert Notification
| Attribute | Value |
|-----------|-------|
| Trigger | Property change on Priority Score |
| Alert Thresholds | 🔥 Hot: ≥80 | 🟡 Warm: 50-79 | ❄️ Cold: <50 |

### Designed but Not Implemented (1)

#### Workflow 4: Hub → BD Opportunities Pipeline
| Attribute | Value |
|-----------|-------|
| Status | ⏳ DESIGNED - NOT YET IMPLEMENTED |
| Trigger | Status = 'validated' AND Score ≥70 AND Confidence ≥0.7 |
| Source | Program Mapping Hub |
| Target | BD Opportunities |
| Field Mappings | Job Title → Source Job Title, Program Name → Matched Program, Priority Score → Priority Score |

### Schema-Locked Properties ⚠️

**DO NOT rename, delete, or change types without updating n8n workflows:**

| Property | Database | n8n Usage |
|----------|----------|-----------|
| Job Title | Program Mapping Hub | Primary identifier |
| Company | Program Mapping Hub | Source tracking |
| Status | Program Mapping Hub | Workflow state machine |
| AI Confidence Score | Program Mapping Hub | GPT-4o output field |
| Priority Score | Program Mapping Hub | Scoring & alert trigger |
| Source URL | Program Mapping Hub | Deduplication key |
| Apify Run ID | Program Mapping Hub | Batch tracking |
| Enrichment Timestamp | Program Mapping Hub | Processing timing |
| Job Description | Program Mapping Hub | AI enrichment input |
| Clearance Level | Program Mapping Hub | Job import field |

---

## 6. BD SCORING SYSTEMS

### Jobs BD Score (100-point scale)
```
score = 50  # Base
score += clearance_boost  # 0-35: TS/SCI Poly=35, TS/SCI=25, TS=15, Secret=5
score += confidence_boost # 0-20: High=20, Moderate=10, Low=0
score += relevance_boost  # 0-20: Direct DCGS=20, Adjacent=15, Related=10
score += keyword_boost    # 0-10: DCGS, ISR, 480TH, NASIC keywords
return min(100, score)
```

### DCGS Relevance Classification
| Level | Criteria |
|-------|----------|
| Direct DCGS | Job is for known DCGS site/task order |
| DCGS Adjacent | Related ISR/intel program or same geographic hub |
| Related Intel | IC or intel community program |
| General DoD | Defense contractor role, not intel-specific |

### Confidence Scoring Criteria
| Level | Criteria |
|-------|----------|
| High | Location + title + clearance ALL match known program patterns |
| Moderate | 2 of 3 indicators match |
| Low | Only 1 indicator, or location unknown |

### Location-to-Program Mapping (Key Sites)
| Location | Primary Program | Prime |
|----------|-----------------|-------|
| San Diego, CA | AF DCGS-PACAF / Navy DCGS-N | BAE/GDIT |
| Hampton/Newport News, VA | AF DCGS-Langley | BAE/GDIT |
| Dayton/Kettering, OH | AF DCGS-Wright-Patt / NASIC | BAE/GDIT |
| Norfolk/Suffolk/Chesapeake, VA | Navy DCGS-N / NGEN-R | Leidos/GDIT |
| Aberdeen, MD | Army DCGS-A / CERDEC | GDIT |
| Fort Belvoir, VA | Army DCGS-A | GDIT |

---

## 7. CURRENT STATE

### ✅ Working Now
- Program Mapping Hub with 65 fields, 23 views
- Federal Programs with 388+ programs (enriched +13)
- Contractors Database with 15 companies
- Contract Vehicles Master with 9 vehicles
- DCGS Contacts Full with 965+ contacts (enriched +90)
- GDIT Jobs with 700 records
- Insight Global Jobs with 178 records
- 3 active n8n workflows (Job Import, Enrichment, Alerts)
- Both MCP connectors (Notion: and notion:) functional

### ⏳ In Progress
- Manual deletion of 11 broken Jobs databases (requires UI)
- Archival of 4 source databases (after validation)
- ~5 remaining Lockheed contacts to migrate
- ~550 GDIT Jobs need program mapping

### 📋 Planned/Discussed
- Implement Workflow 4: Hub → BD Opportunities pipeline
- Split BD Events from BD Opportunities & Events
- 11 Hub formula field implementations (placeholders)
- Weekly HUMINT update cadence
- SAM.gov contract notification integration

### ⚠️ Known Issues
1. **Multi-source API limitation:** Cannot delete databases with relation fields via API
2. **8 Contact corrections needed:** Maureen Shamaly (wrong program), Kingsley Ero (wrong title), etc.
3. **Formula fields:** 11 placeholders in Hub need implementation
4. **GDIT Jobs:** ~550 records need Program field mapping

---

## 8. NOTION PROJECT INSTRUCTIONS

*Paste this into Project Settings for the new Notion Project:*

---

## Project Context
This Notion workspace powers the **Prime Technical Services BD Intelligence System** - a defense contractor business development automation platform. The system scrapes competitor job boards, uses GPT-4o for program mapping, calculates BD opportunity scores, and manages HUMINT contacts for targeted outreach.

## My Notion Workspace
| Database | Collection ID | Purpose |
|----------|---------------|---------|
| 🧭 Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Central jobs + enrichment hub |
| 🏛️ Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | DoD/IC program catalog (388+) |
| 🏢 Contractors Database | `3a259041-22bf-4262-a94a-7d33467a1752` | Prime/Sub company profiles |
| 🚚 Contract Vehicles Master | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | GWAC/IDIQ vehicles |
| 📓 Enrichment Runs Log | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` | Workflow telemetry |
| 🎯 BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | Sales pipeline |
| ⭐ DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | HUMINT contacts (965+) |
| 🏢 GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | GDIT non-DCGS contacts |
| 💼 GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | GDIT job postings |
| 🔍 Insight Global Jobs | `69f0d6de-24c8-4878-9eed-b2e4f6c7d63f` | IG scraped jobs |
| 👤 Contacts Database | `dbad3487-5371-452e-903a-40f070e598aa` | General BD contacts |

## System Architecture
Notion is the **source of truth** in a hub-and-spoke model with n8n orchestrating data flows. Data flows: Apify scrapers → n8n webhook → Program Mapping Hub (raw_import) → n8n enrichment → GPT-4o → Hub (enriched) → n8n alerts → Slack/Email.

## MCP Tools Available
You have access to:
1. **Notion Connector** (`Notion:`) - 14 tools, native integration, use as DEFAULT
2. **Notion MCP** (`notion:`) - 14 identical tools, external server, use as FALLBACK
3. **n8n MCP** - Workflow management only, NOT for direct Notion access

When I ask you to read/write/query Notion:
- Use `Notion:` prefix by default for slightly lower latency
- Fall back to `notion:` prefix if errors occur
- Always fetch current schema before suggesting property changes
- Confirm before any destructive changes (deletions, schema modifications)

## Integration Awareness (n8n Workflows)
Active workflows depend on these schema-locked properties in Program Mapping Hub:
- **Status** (select): raw_import → pending_enrichment → enriching → enriched → validated → error
- **Priority Score** (number): Alert trigger thresholds (Hot ≥80, Warm 50-79, Cold <50)
- **AI Confidence Score** (number): GPT-4o output field
- **Source URL** (url): Deduplication key
- **Apify Run ID** (text): Batch tracking

**⚠️ DO NOT rename these properties without coordinating n8n workflow updates.**

## Working Agreements
- ALWAYS fetch database schema before suggesting property changes
- CHECK schema-locked list before any modifications
- FLAG if changes might break n8n integrations
- USE relations (not text) for cross-database links
- USE Collection IDs (not Database IDs) for MCP data source operations
- CONFIRM before destructive changes

## My Preferences
- Use Collection IDs for reliable automation targeting
- Batch operations when possible (up to 100 pages per create call)
- Progress reports for multi-step operations
- "GOD mode control" - maximum automation and thoroughness
- Defense contracting terminology (DCGS, HUMINT, TS/SCI, etc.)

## Current Focus
1. Complete manual cleanup (11 broken Jobs databases need UI deletion)
2. Implement Workflow 4: Hub → BD Opportunities pipeline
3. Split BD Events from BD Opportunities & Events
4. Complete remaining contact migrations (~5 Lockheed)
5. Map ~550 GDIT Jobs to programs

---

## 9. FIRST CHAT MESSAGE (Continuation Prompt)

*Use this to start the new project chat:*

---

I've set up this dedicated Notion project with both Notion Connector and Notion MCP enabled. See the attached handoff document for complete context.

**Current Notion state:**
- 12-database target architecture: 85% complete
- Consolidation: 27+ databases → 12 target (manual cleanup pending)
- Migrations completed: 90+ contacts, 13 programs, 15 contractors, 9 contract vehicles
- Schema enhancements: Source Program field, Company Name field, Verified field added

**MCP tools available:**
- `Notion:` (14 tools) - Default connector
- `notion:` (14 tools) - Fallback MCP server
- n8n MCP for workflow management

**Integration context:**
- 3 active n8n workflows (Job Import, Enrichment, Alerts)
- 1 designed workflow (Hub → BD Opportunities) pending implementation
- 10 schema-locked properties in Program Mapping Hub

**Immediate priorities:**
1. **Manual UI action needed:** Trash 11 broken Jobs databases (multi-source API limitation)
2. **Implement Workflow 4:** Hub → BD Opportunities pipeline
3. **Split BD Events:** Create separate database from BD Opportunities & Events
4. **Complete Lockheed migration:** ~5 remaining contacts
5. **Archive source databases:** After validation (Defense Program Universe, DoD Programs Master, Lockheed CSV, GBSD Chart)

Let's pick up with [your choice: manual cleanup guidance / Workflow 4 implementation / BD Events split / other].

---

## 10. CROSS-PROJECT COORDINATION NOTES

### Pending Changes Affecting Both Systems

| Change | Notion Impact | n8n Impact |
|--------|---------------|------------|
| Workflow 4 implementation | BD Opportunities schema may need updates | New workflow creation |
| BD Events split | New database with relations | May need event-specific workflow |
| Formula field implementation | 11 formulas in Hub | May affect scoring/filtering |

### Handoff Points

| When This Happens in Notion | Trigger n8n Work |
|-----------------------------|------------------|
| New Status select option added | Update state machine in workflows |
| Priority Score thresholds change | Update alert conditions |
| New database created | May need new workflow integration |

| When This Happens in n8n | Inform Notion Project |
|--------------------------|----------------------|
| New properties needed | Add to schema-locked list |
| Workflow expects new field | Create property first |
| Data format requirements change | Update property constraints |

### Documents to Keep Updated
- **Architecture Blueprint v3.3 FINAL** - Master schema reference
- **Master Action Plan** - Consolidated task list
- **N8N Workflow Spec** - Workflow 4 implementation guide
- **This Handoff Document** - Project continuity

---

*Generated: December 27, 2025*
*Sessions Consolidated: 15+ (Architecture, DCGS Campaign, HUMINT Playbook, Consolidation Execution)*
*Total Context: 27+ databases audited, 12 target architecture, 4 n8n workflows, 90+ contacts migrated*
