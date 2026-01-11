# PTS BD INTELLIGENCE SYSTEM - CLAUDE EXPORT
## Complete Technical Documentation from 30+ Sessions
### December 16, 2025 - January 10, 2026

---

## 1. CONVERSATION SUMMARY

| Attribute | Value |
|-----------|-------|
| **Topic/Focus Area** | Notion BD Intelligence System Architecture, Database Consolidation, n8n Integration |
| **Date Range** | December 16, 2025 - January 10, 2026 |
| **Sessions** | 30+ conversation sessions across multiple compactions |
| **Primary Objective** | Build a comprehensive defense contractor BD intelligence system using Notion as the source of truth, with n8n automation for job scraping and GPT-4o enrichment |

### Key Accomplishments
1. Designed and documented complete 12-database hub-and-spoke architecture
2. Consolidated 27+ fragmented databases down to 12 target databases
3. Migrated 90+ contacts from legacy databases to consolidated structure
4. Populated reference databases (15 contractors, 9 contract vehicles, 13 programs)
5. Created comprehensive documentation suite (Architecture Blueprint v3.3 FINAL, N8N Workflow Spec, Program Mapping Guide, MCP Integration Guide)
6. Established schema-locked properties for n8n workflow compatibility
7. Documented HUMINT 6-tier contact classification methodology
8. Created 100-point BD scoring algorithm

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Hub-and-Spoke Architecture
**Decision:** Use Program Mapping Hub as central nexus with reference and output spokes
**Reasoning:** 
- Jobs flow through a single processing pipeline for consistent enrichment
- Reference data (programs, contractors, vehicles) stays clean and authoritative
- Output databases (BD Opportunities, Contacts) receive qualified data only
**Alternatives Considered:**
- Flat database structure (rejected - too difficult to maintain relationships)
- Multiple pipeline hubs (rejected - duplicates logic and creates sync issues)

### Decision 2: Collection IDs over Database IDs
**Decision:** Always use Collection IDs for MCP operations
**Reasoning:**
- Collection IDs remain stable when database views or properties change
- Database IDs can change during certain operations
- Collection IDs work reliably with data_source_url parameter
**Alternatives Considered:**
- Database IDs (rejected - instability discovered during testing)
- URLs only (rejected - less reliable for automation)

### Decision 3: DCGS Contacts Full as Primary Contact Database
**Decision:** Consolidate all contacts into DCGS Contacts Full (not Contacts Database)
**Reasoning:**
- Already has the richest schema (965+ records, full HUMINT fields)
- Has BD Priority, Hierarchy Tier, and Program fields
- Integration with GDIT DCGS campaign intelligence
**Alternatives Considered:**
- Contacts Database (rejected - less comprehensive schema)
- Create new unified database (rejected - would require migrating 1000+ records)

### Decision 4: Federal Programs as Authoritative Source
**Decision:** Use Federal Programs database for program classification (not job-specific select options)
**Reasoning:**
- Single source of truth for 388+ programs
- Rich metadata (contract value, vehicle, agency, keywords)
- Can be queried for GPT-4o enrichment context
**Alternatives Considered:**
- Duplicate program options in each jobs database (rejected - creates drift)
- Inline text fields (rejected - no validation or standardization)

### Decision 5: Status State Machine for Workflow Control
**Decision:** Use exact status values for n8n workflow state transitions
**Reasoning:**
- n8n workflows depend on exact string matching
- Clear progression: raw_import → pending_enrichment → enriching → enriched → validated → error
- Enables filtering and automation triggers
**Alternatives Considered:**
- Checkbox fields (rejected - doesn't support multi-state transitions)
- Multiple status fields (rejected - creates confusion and sync issues)

### Decision 6: Multi-Source Database Limitations
**Decision:** Accept that multi-source databases cannot be modified via API
**Reasoning:**
- Notion API limitation discovered during testing
- DoD Programs Master has relations to all 11 Jobs databases
- Requires manual UI intervention for deletion
**Alternatives Considered:**
- Break relations first (attempted - still couldn't delete)
- Delete parent database (rejected - would lose valuable reference data)

---

## 3. ARCHITECTURE & DATA FLOW

### System Architecture Diagram
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES (External)                              │
├─────────────────────────────────────────────────────────────────────────────┤
│  [GDIT Jobs]  [CACI Jobs]  [Leidos Jobs]  [Booz Allen]  [Insight Global]   │
│       │            │            │              │              │             │
│       └────────────┴────────────┴──────────────┴──────────────┘             │
│                                 │                                           │
│                         [Apify Scrapers]                                    │
│                                 │ Webhook POST                              │
│                                 ▼                                           │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      N8N WORKFLOW LAYER                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────────┐  ┌────────────────────┐    │
│  │ WF1: Job Import  │  │ WF2: Enrichment      │  │ WF3: Priority      │    │
│  │ Webhook          │  │ Processor (15min)    │  │ Alerts             │    │
│  │ Creates raw jobs │→ │ GPT-4o classification│→ │ Slack/Email        │    │
│  └──────────────────┘  └──────────────────────┘  └────────────────────┘    │
│                                 │                                           │
│                         [OpenAI GPT-4o API]                                 │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NOTION WORKSPACE                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐  │
│   │              🧭 PROGRAM MAPPING INTELLIGENCE HUB                     │  │
│   │              Collection: f57792c1-605b-424c-8830-23ab41c47137       │  │
│   │              65 Fields | 23 Views | Central Processing Nexus        │  │
│   │                                                                     │  │
│   │  Status Flow: raw_import → pending_enrichment → enriching →        │  │
│   │               enriched → validated → error                          │  │
│   └─────────────────────────────────────────────────────────────────────┘  │
│                    │                    │                    │             │
│         ┌─────────┴─────────┐         │         ┌──────────┴──────────┐  │
│         ▼                   ▼         ▼         ▼                     ▼  │
│   ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  ┌───────────┐│
│   │ 🏛️ Federal    │  │ 🏢 Contractors│  │ 🚚 Contract   │  │ 📓 Enrich-││
│   │ Programs      │  │ Database      │  │ Vehicles      │  │ ment Runs ││
│   │ 388+ programs │  │ 15 companies  │  │ 9 vehicles    │  │ Log       ││
│   │ (reference)   │  │ (reference)   │  │ (reference)   │  │ (telemetry││
│   └───────────────┘  └───────────────┘  └───────────────┘  └───────────┘│
│                                                                          │
│         ┌─────────────────────────────────────────────────────────────┐ │
│         │                   OUTPUT DATABASES                          │ │
│         ├───────────────┬───────────────┬───────────────┬─────────────┤ │
│         │ 🎯 BD         │ ⭐ DCGS       │ 💼 GDIT      │ 🔍 Insight  │ │
│         │ Opportunities │ Contacts Full │ Jobs          │ Global Jobs │ │
│         │ (pipeline)    │ (965+ HUMINT) │ (700 records) │ (178 recs)  │ │
│         └───────────────┴───────────────┴───────────────┴─────────────┘ │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Details

**Inbound Flow (Scraping to Hub):**
1. Apify actors scrape competitor job boards on schedule
2. Webhook POST to n8n: `https://primetech.app.n8n.cloud/webhook/job-import`
3. n8n creates pages in Program Mapping Hub with Status: `raw_import`
4. Properties populated: Job Title, Company, Location, Job Description, Source URL, Clearance Level, Apify Run ID

**Enrichment Flow (Hub Processing):**
1. n8n Enrichment Processor runs every 15 minutes
2. Queries Hub for Status: `pending_enrichment`
3. Sends job data to GPT-4o with Program Mapping Guide context
4. Updates Hub: Program Name, Agency, AI Confidence Score, Priority Score
5. Sets Status: `enriched`

**Outbound Flow (Hub to Outputs):**
1. Priority Alert workflow triggers on Priority Score changes
2. Hot (≥80) / Warm (50-79) / Cold (<50) alerts sent to Slack/Email
3. Workflow 4 (designed, not implemented) would create BD Opportunities from validated jobs

### API Connections

| Service | Endpoint | Authentication | Purpose |
|---------|----------|----------------|---------|
| n8n Cloud | primetech.app.n8n.cloud | OAuth | Workflow orchestration |
| Notion API | api.notion.com | Internal Integration | Database CRUD |
| OpenAI API | api.openai.com | API Key | GPT-4o enrichment |
| Apify Cloud | api.apify.com | API Key | Job scraping |
| Slack API | slack.com/api | Webhook | Alert notifications |

---

## 4. CODE & CONFIGURATIONS

### 4.1 JavaScript: Document Generation Script (docx-js)

**File:** `generate_architecture_blueprint.js`
**Purpose:** Generate professional Word documents using docx-js library

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, 
        Header, Footer, AlignmentType, PageOrientation, LevelFormat, 
        HeadingLevel, BorderStyle, WidthType, PageNumber, PageBreak, ShadingType } = require('docx');
const fs = require('fs');

const tableBorder = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const cellBorders = { top: tableBorder, bottom: tableBorder, left: tableBorder, right: tableBorder };

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } }, // 11pt default
    paragraphStyles: [
      { id: "Title", name: "Title", basedOn: "Normal",
        run: { size: 56, bold: true, color: "1a365d", font: "Arial" },
        paragraph: { spacing: { before: 0, after: 200 }, alignment: AlignmentType.CENTER } },
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, color: "1a365d", font: "Arial" },
        paragraph: { spacing: { before: 400, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, color: "2d4a6f", font: "Arial" },
        paragraph: { spacing: { before: 300, after: 150 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, color: "3a5a80", font: "Arial" },
        paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 2 } }
    ]
  },
  numbering: {
    config: [
      { reference: "bullet-list",
        levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbered-list",
        levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
          style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] }
    ]
  },
  sections: [{
    properties: {
      page: { margin: { top: 1008, right: 1008, bottom: 1008, left: 1008 } } // 0.7" margins
    },
    headers: {
      default: new Header({ children: [new Paragraph({ 
        alignment: AlignmentType.RIGHT,
        children: [new TextRun({ text: "PTS BD Intelligence System", size: 18, color: "666666" })]
      })] })
    },
    footers: {
      default: new Footer({ children: [new Paragraph({ 
        alignment: AlignmentType.CENTER,
        children: [
          new TextRun({ text: "Page ", size: 18 }), 
          new TextRun({ children: [PageNumber.CURRENT], size: 18 }), 
          new TextRun({ text: " of ", size: 18 }), 
          new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 18 })
        ]
      })] })
    },
    children: [
      // Content paragraphs here...
      new Paragraph({ heading: HeadingLevel.TITLE, children: [new TextRun("Document Title")] }),
      // Tables use this pattern:
      new Table({
        columnWidths: [3500, 6860], // Total ~10360 for letter with 0.7" margins
        rows: [
          new TableRow({
            tableHeader: true,
            children: [
              new TableCell({ 
                borders: cellBorders, 
                shading: { fill: "1a365d", type: ShadingType.CLEAR }, 
                children: [new Paragraph({ children: [new TextRun({ text: "Header", bold: true, color: "FFFFFF" })] })] 
              }),
              // More cells...
            ]
          }),
          // More rows...
        ]
      }),
    ]
  }]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("/mnt/user-data/outputs/document.docx", buffer);
  console.log("Document created successfully!");
});
```

### 4.2 MCP Tool Usage Patterns

**Search Pattern (with Collection ID):**
```javascript
// Targeted search within a specific database
Notion:notion-search({
  query: "keyword terms",
  data_source_url: "collection://f57792c1-605b-424c-8830-23ab41c47137"
})
```

**Fetch Schema Pattern:**
```javascript
// Get complete database schema before modifications
Notion:notion-fetch({
  id: "f57792c1-605b-424c-8830-23ab41c47137"  // Collection ID
})
```

**Batch Create Pattern:**
```javascript
// Create multiple pages in one call (up to 100)
Notion:notion-create-pages({
  parent: { 
    data_source_id: "2ccdef65-baa5-8087-a53b-000ba596128e"  // Collection ID
  },
  pages: [
    {
      properties: {
        "Name": "Contact Name",
        "Job Title": "Title",
        "Company Name": "Company",
        "Program": "Program Name",
        "BD Priority": "🟡 Warm",
        "Hierarchy Tier": "Tier 4 - Management",
        "Person City": "City",
        "Person State": "State",
        "Email Address": "email@example.com",
        "Mobile phone": "(555) 123-4567"
      }
    },
    // More pages...
  ]
})
```

**Update Database Schema Pattern:**
```javascript
// Add new select option to existing field
Notion:notion-update-database({
  database_id: "f57792c1-605b-424c-8830-23ab41c47137",
  properties: {
    "Source Program": {
      type: "select",
      select: {
        options: [
          { name: "CANES", color: "blue" },
          { name: "JRSS", color: "green" },
          // Include ALL existing options + new ones
        ]
      }
    }
  }
})
```

### 4.3 N8N Workflow Configurations

**Workflow 1: Apify Job Import**
```json
{
  "name": "Apify Job Import",
  "nodes": [
    {
      "type": "n8n-nodes-base.webhook",
      "name": "Job Import Webhook",
      "parameters": {
        "path": "job-import",
        "httpMethod": "POST",
        "responseMode": "lastNode"
      }
    },
    {
      "type": "n8n-nodes-base.notion",
      "name": "Create Job in Hub",
      "parameters": {
        "resource": "page",
        "operation": "create",
        "databaseId": "f57792c1-605b-424c-8830-23ab41c47137",
        "properties": {
          "Job Title": "={{ $json.title }}",
          "Company": "={{ $json.company }}",
          "Location": "={{ $json.location }}",
          "Job Description": "={{ $json.description }}",
          "Source URL": "={{ $json.url }}",
          "Clearance Level": "={{ $json.clearance }}",
          "Status": "raw_import",
          "Apify Run ID": "={{ $json.runId }}"
        }
      }
    }
  ],
  "connections": {
    "Job Import Webhook": {
      "main": [[{ "node": "Create Job in Hub", "type": "main", "index": 0 }]]
    }
  }
}
```

**Workflow 2: Enrichment Processor**
```json
{
  "name": "Enrichment Processor",
  "nodes": [
    {
      "type": "n8n-nodes-base.scheduleTrigger",
      "name": "Every 15 Minutes",
      "parameters": {
        "rule": { "interval": [{ "field": "minutes", "minutesInterval": 15 }] }
      }
    },
    {
      "type": "n8n-nodes-base.notion",
      "name": "Get Pending Jobs",
      "parameters": {
        "resource": "page",
        "operation": "getAll",
        "databaseId": "f57792c1-605b-424c-8830-23ab41c47137",
        "filterType": "json",
        "filter": {
          "property": "Status",
          "select": { "equals": "pending_enrichment" }
        },
        "limit": 10
      }
    },
    {
      "type": "n8n-nodes-base.openAi",
      "name": "GPT-4o Classify",
      "parameters": {
        "model": "gpt-4o",
        "messages": {
          "values": [
            {
              "role": "system",
              "content": "You are a defense contracting program classifier. Given a job posting, identify the most likely DoD/IC program based on: 1) Program keywords in title/description, 2) Location matching known program sites, 3) Role type matching typical program roles. Return JSON with: program_name, agency, confidence (0-1), reasoning."
            },
            {
              "role": "user",
              "content": "Title: {{ $json.properties['Job Title'] }}\nLocation: {{ $json.properties.Location }}\nDescription: {{ $json.properties['Job Description'] }}\nClearance: {{ $json.properties['Clearance Level'] }}"
            }
          ]
        }
      }
    },
    {
      "type": "n8n-nodes-base.notion",
      "name": "Update Hub with Results",
      "parameters": {
        "resource": "page",
        "operation": "update",
        "pageId": "={{ $node['Get Pending Jobs'].json.id }}",
        "properties": {
          "Program Name": "={{ $json.program_name }}",
          "Agency": "={{ $json.agency }}",
          "AI Confidence Score": "={{ $json.confidence }}",
          "Priority Score": "={{ $runCalculateBDScore($json) }}",
          "Status": "enriched",
          "Enrichment Timestamp": "={{ $now.toISOString() }}"
        }
      }
    }
  ]
}
```

**Workflow 4: Hub → BD Opportunities (Designed, Not Implemented)**
```json
{
  "name": "Hub to BD Opportunities Pipeline",
  "status": "DESIGNED - NOT YET IMPLEMENTED",
  "trigger": {
    "type": "notion-database-update",
    "database": "f57792c1-605b-424c-8830-23ab41c47137",
    "filter": {
      "and": [
        { "property": "Status", "select": { "equals": "validated" } },
        { "property": "Priority Score", "number": { "greater_than_or_equal_to": 70 } },
        { "property": "AI Confidence Score", "number": { "greater_than_or_equal_to": 0.7 } }
      ]
    }
  },
  "field_mappings": {
    "Hub → BD Opportunities": {
      "Job Title": "Source Job Title",
      "Program Name": "Matched Program",
      "Company": "Source Contractor",
      "Priority Score": "Priority Score",
      "Source URL": "Source URL",
      "Agency": "Customer Agency"
    }
  }
}
```

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 Program Mapping Intelligence Hub
**Collection ID:** `f57792c1-605b-424c-8830-23ab41c47137`
**Database ID:** `0a0d7e46-3d88-40b6-853a-3c9680347644`
**Purpose:** Central processing hub for all job intelligence

**Properties (65 total, key fields shown):**

| Property | Type | Options/Format | Schema-Locked |
|----------|------|----------------|---------------|
| Job Title | title | - | ⚠️ YES |
| Company | text | - | ⚠️ YES |
| Status | select | raw_import, pending_enrichment, enriching, enriched, validated, error | ⚠️ YES |
| Priority Score | number | 0-100 | ⚠️ YES |
| AI Confidence Score | number | 0.0-1.0 | ⚠️ YES |
| Source URL | url | - | ⚠️ YES |
| Job Description | text | - | ⚠️ YES |
| Clearance Level | select | TS/SCI Poly, TS/SCI, Top Secret, Secret, Public Trust, None | ⚠️ YES |
| Enrichment Timestamp | date | ISO-8601 | ⚠️ YES |
| Apify Run ID | text | - | ⚠️ YES |
| Program Name | text | AI-populated | |
| Agency | select | Army, Navy, Air Force, DIA, DoD, etc. | |
| Location | text | City, State | |
| Source Program | select | CANES, JRSS, NJRSS, AFSIM, Counter-UAS, EVMS, Sentinel GBSD, etc. (15 options) | |
| BD Priority | select | 🔴 Critical, 🔥 Hot, 🟡 Warm, ❄️ Cold | |
| DCGS Relevance | select | Direct DCGS, DCGS Adjacent, Related Intel, General DoD | |

**Views (23 total):**
- Pipeline: All Records, 🚨 Pending Enrichment, ⚡ Currently Processing, ✅ Enriched & Ready
- Analysis: 🏆 High Confidence, 🏢 By Agency, 💼 By Contract Vehicle, 📊 By Prime Contractor
- BD Capture: 📈 BD Capture Pipeline, ⏰ Upcoming Recompetes, 🤝 Subcontractor Opportunities
- QA: 🔍 Needs Review, 🧰 Needs Human Review, 🔁 Duplicates

---

### 5.2 Federal Programs
**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`
**Database ID:** `9db40fce-0781-42b9-902c-d4b0263b1e23`
**Purpose:** Authoritative DoD/IC program catalog (388+ programs)

| Property | Type | Description |
|----------|------|-------------|
| Program Name | title | Official program name |
| Acronym | text | Short code (e.g., I2TS4, BICES) |
| Agency | select | Army, Navy, Air Force, DIA, NSA, etc. |
| Prime Contractor | text | Primary contract holder |
| Contract Value | text | Dollar value (e.g., "$1.2B") |
| Contract Vehicle Type | select | GWAC, IDIQ, BPA, etc. |
| Period of Performance | text | Contract dates |
| Key Locations | text | Primary work sites |
| Clearance Requirements | text | Security clearance needed |
| Keywords/Signals | text | Classification keywords |
| Typical Roles | text | Common job titles |
| PTS Involvement | select | Current, Target, Past, None |
| Confidence Level | select | High, Medium, Low |
| Program Type 1 | select | IT, Intel, Cyber, etc. |

---

### 5.3 DCGS Contacts Full
**Collection ID:** `2ccdef65-baa5-8087-a53b-000ba596128e`
**Purpose:** Primary HUMINT contact database (965+ contacts)

| Property | Type | Options |
|----------|------|---------|
| Name | title | Last name |
| First Name | text | First name |
| Job Title | text | Current position |
| Company Name | text | Employer |
| Program | select | DCGS, Sentinel GBSD, Lockheed Martin, F-35, etc. |
| BD Priority | select | 🔴 Critical, 🔥 Hot, 🟡 Warm, 🟢 Low |
| Hierarchy Tier | select | Tier 1 - Executive, Tier 2 - Director, Tier 3 - Program Leadership, Tier 4 - Management, Tier 5 - Senior IC, Tier 6 - Individual |
| Person City | text | City |
| Person State | text | State |
| Email Address | email | Primary email |
| Mobile phone | phone | Mobile number |
| Direct Phone Number | phone | Office number |
| LinkedIn Contact Profile URL | url | LinkedIn profile |
| Verified | select | Unverified, LinkedIn Verified, Phone Verified, Email Verified |

**HUMINT 6-Tier Classification:**
| Tier | Role Examples | Approach Order |
|------|---------------|----------------|
| Tier 1 - Executive | VP, C-Suite | LAST |
| Tier 2 - Director | Director-level | 5th |
| Tier 3 - Program Leadership | PM, Site Lead | 4th |
| Tier 4 - Management | Manager, Team Lead | 3rd |
| Tier 5 - Senior IC | Senior Engineer | 2nd |
| Tier 6 - Individual | Analyst, Engineer | FIRST |

---

### 5.4 Contractors Database
**Collection ID:** `3a259041-22bf-4262-a94a-7d33467a1752`
**Purpose:** Prime/Sub contractor profiles (15 companies)

| Property | Type | Description |
|----------|------|-------------|
| Company Name | title | Official company name |
| Company Type | select | Large Business, Small Business, SDVOSB, 8(a), HUBZone |
| Headquarters | text | HQ location |
| Employee Count | number | Approximate headcount |
| Facility Clearance | select | TS/SCI, Top Secret, Secret |
| Key Capabilities | multi_select | 17 options: Cloud, Cybersecurity, AI/ML, etc. |
| Subcontractor To | multi_select | 9 options: GDIT, Leidos, BAE, etc. |
| Website | url | Company website |
| Notes | text | Additional context |

**Populated Companies (15):**
- Large Primes: Northrop Grumman, Lockheed Martin, GDIT, Leidos, Booz Allen Hamilton, BAE Systems, Raytheon, CACI, Peraton, ManTech
- Staffing: Insight Global, TEKsystems, Apex Group
- Small Business: SHINE Systems, Prime Technical Services (SDVOSB)

---

### 5.5 Contract Vehicles Master
**Collection ID:** `0f09543e-9932-44f2-b0ab-7b4c070afb81`
**Purpose:** GWAC/IDIQ vehicle reference (9 vehicles)

| Property | Type | Description |
|----------|------|-------------|
| Vehicle Name | title | Contract vehicle name |
| Vehicle Type | select | GWAC, IDIQ, GSA Schedule |
| Ceiling | text | Maximum value |
| Set-Aside | select | Total, Partial, None |
| Agency | multi_select | 14 options |
| NAICS Codes | multi_select | 8 options |
| PTS Position | select | Prime, Sub, Neither, Target |

**Populated Vehicles (9):**
- CIO-SP3 ($20B), SEWP V ($10B), Alliant 2 ($50B), OASIS+ ($60B)
- 8(a) STARS III ($50B), DISA Encore III ($17.5B), GSA IT Schedule 70
- ITES-3S ($12.9B), RS3 ($37.4B)

---

### 5.6 Complete Database Inventory

| # | Database | Collection ID | Status |
|---|----------|---------------|--------|
| 1 | 🧭 Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | ✅ Active |
| 2 | 🏛️ Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | ✅ 388+ programs |
| 3 | 🏢 Contractors Database | `3a259041-22bf-4262-a94a-7d33467a1752` | ✅ 15 companies |
| 4 | 🚚 Contract Vehicles Master | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | ✅ 9 vehicles |
| 5 | 📓 Enrichment Runs Log | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` | ✅ Schema Ready |
| 6 | 🎯 BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | ✅ Active |
| 7 | ⭐ DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | ✅ 965+ contacts |
| 8 | 🏢 GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | ✅ 1,052 contacts |
| 9 | 💼 GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | ✅ 700 records |
| 10 | 🔍 Insight Global Jobs | `69f0d6de-24c8-4878-9eed-b2e4f6c7d63f` | ✅ 178 records |
| 11 | 👤 Contacts Database | `dbad3487-5371-452e-903a-40f070e598aa` | ✅ Active |
| 12 | 📅 BD Events | (pending split from BD Opportunities & Events) | ⏳ Pending |

---

## 6. N8N WORKFLOWS

### Active Workflows (3)

**Workflow 1: Apify Job Import**
| Attribute | Value |
|-----------|-------|
| Name | Apify Job Import |
| Trigger | Webhook POST |
| Endpoint | `https://primetech.app.n8n.cloud/webhook/job-import` |
| Target Database | Program Mapping Hub |
| Properties Written | Job Title, Company, Location, Job Description, Source URL, Clearance Level, Status (raw_import), Apify Run ID |

**Workflow 2: Enrichment Processor**
| Attribute | Value |
|-----------|-------|
| Name | Enrichment Processor |
| Trigger | Schedule (every 15 minutes) |
| Filter | Status = pending_enrichment |
| AI Model | GPT-4o |
| Properties Written | Program Name, Agency, AI Confidence Score, Priority Score, Status (enriched), Enrichment Timestamp |

**Workflow 3: Priority Alert Notification**
| Attribute | Value |
|-----------|-------|
| Name | Priority Alert |
| Trigger | Property change on Priority Score |
| Thresholds | 🔥 Hot ≥80, 🟡 Warm 50-79, ❄️ Cold <50 |
| Output | Slack + Email notification |

### Designed but Not Implemented (1)

**Workflow 4: Hub → BD Opportunities Pipeline**
| Attribute | Value |
|-----------|-------|
| Status | ⏳ DESIGNED - NOT YET IMPLEMENTED |
| Trigger | Status = 'validated' AND Priority Score ≥70 AND AI Confidence ≥0.7 |
| Source | Program Mapping Hub |
| Target | BD Opportunities |

---

## 7. APIFY ACTORS & SCRAPERS

### Configured Actors

| Actor | Target | Schedule | Output Format |
|-------|--------|----------|---------------|
| GDIT Job Scraper | gdit.com/careers | Daily | JSON webhook |
| CACI Job Scraper | caci.com/careers | Daily | JSON webhook |
| Leidos Job Scraper | leidos.com/careers | Daily | JSON webhook |
| Booz Allen Scraper | boozallen.com/careers | Daily | JSON webhook |
| Insight Global Scraper | insightglobal.com | Daily | JSON webhook |

### Output Schema (Standard)
```json
{
  "title": "Job Title",
  "company": "Company Name",
  "location": "City, State",
  "description": "Full job description text",
  "url": "https://source-url.com/job/123",
  "clearance": "TS/SCI",
  "postedDate": "2025-01-10",
  "runId": "apify-run-abc123"
}
```

### Rate Limiting
- Maximum 100 jobs per webhook call
- 30-second delay between batches
- Daily run limit: 1000 jobs per actor

---

## 8. PROBLEMS SOLVED

### Problem 1: Multi-Source Database Deletion Limitation
**Description:** Attempted to delete 11 broken Jobs databases via Notion API
**Root Cause:** DoD Programs Master database has relation fields pointing to all 11 Jobs databases, making them multi-source databases that cannot be deleted via API
**Solution:** Documented as manual UI action required; created checklist with all Collection IDs for manual deletion

### Problem 2: Database ID vs Collection ID Confusion
**Description:** MCP operations failing intermittently with some databases
**Root Cause:** Using Database IDs instead of Collection IDs for data_source_url parameter
**Solution:** Standardized on Collection IDs for all operations; documented ID lookup process

### Problem 3: Contact Database Target Misidentification
**Description:** Initially planned to migrate contacts to "Contacts Database"
**Root Cause:** DCGS Contacts Full has richer schema and existing HUMINT data
**Solution:** Changed target to DCGS Contacts Full (Collection: 2ccdef65-baa5-8087-a53b-000ba596128e); added Company Name and Verified fields to support new data

### Problem 4: Select Field Options Not Present
**Description:** Batch contact creation failing with "option not found" errors
**Root Cause:** New program values (Sentinel GBSD, Lockheed Martin, F-35) not in Program select field options
**Solution:** Used notion-update-database to add options before migration batches

### Problem 5: Maureen Shamaly Misclassification
**Description:** Contact assigned to wrong program
**Root Cause:** Data entry error in source database
**Solution:** Identified for manual correction (listed in 8 contact corrections needed)

### Problem 6: Schema Drift Between Projects
**Description:** Multiple handoff documents from different projects had conflicting database information
**Root Cause:** Work done in parallel across DCGS Campaign, BD Playbook, and Notion projects
**Solution:** Created comprehensive reconciliation process; merged 5 source documents into Architecture Blueprint v3.3 FINAL

---

## 9. PENDING ITEMS / NEXT STEPS

### High Priority (Manual Actions Required)
1. **Trash 11 Broken Jobs Databases** - Requires Notion UI (multi-source API limitation)
   - Jobs – CANES (9eff72f7-2c56-418a-a921-413e36766c25)
   - Jobs – AFSIM (1c03fa5c-0d38-4269-b78c-7cdef5d99fc5)
   - Jobs – Jessup Cyber Security (c4152f84-3321-4bbc-80f8-3c2600c3d9f4)
   - Jobs – JRSS (afd6cdc2-00e8-4ab5-9282-60a5bd792885)
   - Jobs – NJRSS (18957064-fda1-4e24-935a-a4c4a16565d8)
   - Jobs – Project LUPUS (2db5ff90-192c-4b58-a07c-e8a99d2e5772)
   - Jobs – Project INDUS (20b6b38c-a5e8-4434-a972-325bb0cf5e35)
   - Jobs – Project AURIGA (bb6585d4-1d3b-49d6-80ab-0faf602e0544)
   - Jobs – NRO_NGA Support (013053bb-5ffd-460c-bc0b-4f641a70aaf1)
   - Jobs – Counter-UAS (d954c29f-ada9-4b2d-92ac-328b44b9835b)
   - Jobs – EVMS (e58eddb6-2e5c-4d6c-997c-9931bb54adae)

### Medium Priority
2. **Archive Source Databases** (after validating migrations)
   - Defense Program Universe (bba2faa7-e297-4990-a179-3d0acc65c52d)
   - DoD Programs Master (4fa19e91-62c8-432a-8aa4-0f73f5416b41)
   - Lockheed Contact CSV (294def65-baa5-811f-9238-000b238c1f5d)
   - GBSD Contact Chart (264def65-baa5-816a-8f9c-000b83a23db5)

3. **Implement Workflow 4** - Hub → BD Opportunities pipeline

4. **Split BD Events Database** - Create separate database from BD Opportunities & Events

5. **Complete Lockheed Migration** - ~5 remaining contacts

6. **Fix 8 Contact Corrections:**
   - Maureen Shamaly (wrong program)
   - Kingsley Ero (wrong title)
   - Jeffrey Bartsch (verification needed)
   - Craig Lindahl (verification needed)
   - Robert Nicholson (verification needed)
   - Rebecca Gunning (verification needed)
   - + 2 others TBD

### Lower Priority
7. **Map ~550 GDIT Jobs** - Use Program Keyword Mapping Guide

8. **Implement 11 Formula Fields** in Program Mapping Hub

9. **Connect Enrichment Runs Log** to n8n workflows

10. **SAM.gov Integration** - Contract notification automation

---

## 10. KEY INSIGHTS & GOTCHAS

### MCP Tool Gotchas
1. **Always use Collection IDs, not Database IDs** - Collection IDs remain stable; Database IDs can change
2. **Fetch schema before any modifications** - Property names are case-sensitive
3. **Multi-source databases cannot be deleted via API** - Requires manual Notion UI
4. **Rate limits:** 30 searches/minute, 180 general operations/minute
5. **Batch operations:** Max 100 pages per create call, process in groups of 10-30 with delays

### Schema-Locked Properties (DO NOT MODIFY)
These 10 properties in Program Mapping Hub are used by n8n workflows:
- Status, Priority Score, AI Confidence Score, Source URL, Apify Run ID
- Job Title, Company, Job Description, Clearance Level, Enrichment Timestamp

### Status State Machine (exact values required)
```
raw_import → pending_enrichment → enriching → enriched → validated → error
```

### BD Scoring Algorithm
```
score = 50  # Base
score += clearance_boost  # 0-35: TS/SCI Poly=35, TS/SCI=25, TS=15, Secret=5
score += confidence_boost # 0-20: High=20, Moderate=10, Low=0
score += relevance_boost  # 0-20: Direct DCGS=20, Adjacent=15, Related=10
score += keyword_boost    # 0-10: DCGS, ISR, 480TH, NASIC keywords
return min(100, score)
```

### HUMINT Approach Order
**PACAF Override:** ALL AF DCGS - PACAF (San Diego) contacts = 🔴 CRITICAL regardless of tier
**Standard Order:** Tier 6 → Tier 5 → Tier 4 → Tier 3 → Tier 2 → Tier 1 (bottom-up)

### Document Generation Best Practices
1. **Use docx-js for new documents** (not python-docx)
2. **Always use LevelFormat.BULLET constant** (not string "bullet")
3. **Never use \n for line breaks** - use separate Paragraph elements
4. **Use ShadingType.CLEAR** for table cells (not SOLID)
5. **Set columnWidths array + individual cell widths** for table compatibility

### Database Consolidation Lessons
1. **27+ databases → 12 target = 56% reduction possible**
2. **Migration before deletion** - Always migrate data before trashing databases
3. **Schema preparation first** - Add select options before batch imports
4. **Validation after migration** - Spot-check migrated data before archiving sources

---

## APPENDIX A: Document Inventory

| Document | Version | Purpose |
|----------|---------|---------|
| PTS_BD_Intelligence_Architecture_Blueprint_v3_3_FINAL.docx | 3.3 | Master architecture reference |
| PTS_MASTER_ACTION_PLAN_DEFINITIVE.md | 1.0 | Consolidated task list |
| PTS_N8N_Workflow_Spec_Hub_to_BD_Opportunities.docx | 1.0 | Workflow 4 specification |
| PTS_Claude_Notion_MCP_Integration_Guide.docx | 1.0 | MCP tool documentation |
| PTS_Claude_Notion_MCP_Prompt_Playbook.md | 1.0 | Quick reference prompts |
| PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx | 1.0 | 25 GDIT program profiles |
| PTS_Notion_Project_Handoff_Document.docx | 1.0 | Project handoff |
| PTS_Enhanced_Custom_Instructions_v2.md | 2.0 | Claude project instructions |

---

## APPENDIX B: Key URLs & Endpoints

| Service | URL |
|---------|-----|
| n8n Cloud | https://primetech.app.n8n.cloud |
| n8n MCP Server | https://primetech.app.n8n.cloud/mcp-server/http |
| Notion MCP Server | https://mcp.notion.com/mcp |
| Job Import Webhook | https://primetech.app.n8n.cloud/webhook/job-import |

---

*Generated: January 10, 2026*
*Sessions: 30+ conversation sessions (December 16, 2025 - January 10, 2026)*
*Author: Claude (Anthropic)*
