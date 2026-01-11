# PTS BD Intelligence System - Claude Export
## Session Date: January 1-2, 2026

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
**Notion Workspace Optimization & GDIT Program Mapping** - Comprehensive optimization of the Prime Technical Services BD Intelligence System Notion workspace, including database architecture verification, data migration, contact imports, and systematic program classification of competitor job postings.

### Date Range
- **Start**: January 1, 2026 ~22:05 UTC
- **End**: January 2, 2026 ~16:00 UTC

### Primary Objective
Achieve "Master State" for the PTS BD Intelligence Notion workspace by:
1. Verifying and correcting the 14-database architecture
2. Splitting BD Events from BD Opportunities database
3. Importing 140 GDIT contacts from Excel
4. Mapping 250+ GDIT jobs to 25 federal programs
5. Creating authoritative Program Keyword Mapping Guide documentation

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Database ID Correction Strategy
- **Decision**: Use Collection IDs instead of Database IDs for all MCP operations
- **Reasoning**: Multi-source databases in Notion have different Database vs Collection IDs; Collection IDs are more reliable for API operations
- **Alternatives Considered**: Using Database IDs directly (failed with multi-source databases)

### Decision 2: Contact Database Separation
- **Decision**: Keep Lockheed Contact CSV, GBSD Contact Chart, and GDIT PTS Contacts as separate databases (not merged)
- **Reasoning**: Each database represents a different company/program relationship with unique context that would be lost in consolidation
- **Alternatives Considered**: Merging all contacts into DCGS Contacts Full (rejected to preserve relationship context)

### Decision 3: Program Classification Taxonomy
- **Decision**: Use 25 standardized program codes with "Other" as catch-all
- **Reasoning**: Balances specificity with maintainability; allows classification without creating hundreds of micro-categories
- **Alternatives Considered**: Free-text program names (rejected for inconsistency), more granular codes (rejected for complexity)

### Decision 4: BD Events Database Split
- **Decision**: Create dedicated BD Events database separate from BD Opportunities
- **Reasoning**: Events (conferences, trade shows) have different properties than opportunities (contracts, bids); mixing them complicated filtering and reporting
- **Alternatives Considered**: Adding Event type to BD Opportunities (rejected for schema clarity)

### Decision 5: Program Mapping Methodology
- **Decision**: Keyword + Location pattern matching as primary classification method
- **Reasoning**: Most job titles contain program acronyms or location identifiers that reliably indicate program assignment
- **Alternatives Considered**: GPT-4o only (rejected for cost), manual only (rejected for scale)

---

## 3. ARCHITECTURE & DATA FLOW

### System Overview
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PTS BD INTELLIGENCE SYSTEM                                │
│                         14-Database Architecture                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────┐     ┌──────────────────────┐     ┌──────────────────┐
│   DATA SOURCES       │     │   PROCESSING         │     │   OUTPUTS        │
│                      │     │                      │     │                  │
│  • Apify Scrapers    │────▶│  • n8n Workflows     │────▶│  • BD Opps       │
│  • Excel Imports     │     │  • GPT-4o Enrichment │     │  • Slack Alerts  │
│  • Manual Entry      │     │  • Program Mapping   │     │  • Reports       │
└──────────────────────┘     └──────────────────────┘     └──────────────────┘
```

### Database Hub-and-Spoke Model
```
                              ┌─────────────────────────────┐
                              │   PROGRAM MAPPING HUB       │
                              │   (Central Processing)      │
                              │   f57792c1-605b-424c-8830   │
                              └─────────────┬───────────────┘
                                            │
           ┌────────────────────────────────┼────────────────────────────────┐
           │                                │                                │
           ▼                                ▼                                ▼
┌──────────────────────┐      ┌──────────────────────┐      ┌──────────────────────┐
│  REFERENCE SPOKES    │      │   OUTPUT SPOKES      │      │   JOB TRACKING       │
│                      │      │                      │      │                      │
│  • Federal Programs  │      │  • BD Opportunities  │      │  • GDIT Jobs         │
│  • Contractors       │      │  • BD Events         │      │  • Insight Global    │
│  • Contract Vehicles │      │  • Enrichment Log    │      │                      │
└──────────────────────┘      └──────────────────────┘      └──────────────────────┘
           │                                │                                │
           └────────────────────────────────┼────────────────────────────────┘
                                            │
                                            ▼
                              ┌─────────────────────────────┐
                              │   CONTACT DATABASES         │
                              │                             │
                              │  • DCGS Contacts Full       │
                              │  • GDIT PTS Contacts        │
                              │  • GDIT Other Contacts      │
                              │  • Lockheed Contact CSV     │
                              │  • GBSD Contact Chart       │
                              └─────────────────────────────┘
```

### Data Flow: Job Import → Program Mapping → BD Opportunity
```
Apify Scraper (GDIT Careers)
        │
        ▼ [Webhook POST]
n8n Workflow (Apify Job Import)
        │
        ▼ [Create Pages]
Program Mapping Hub (Status: raw_import)
        │
        ▼ [15-min Schedule]
n8n Workflow (Enrichment Processor)
        │
        ├──▶ GPT-4o Program Classification
        │         │
        │         ▼
        │    Federal Programs DB (Reference Lookup)
        │
        ▼ [Update Page]
Program Mapping Hub (Status: enriched, Program: [assigned])
        │
        ▼ [Priority Score ≥ 80]
BD Opportunities (New Record Created)
        │
        ▼ [Slack Webhook]
Priority Alert Notification
```

### API Connections
| Connection | Type | URL/Endpoint |
|------------|------|--------------|
| Notion MCP | OAuth | via claude.ai integration |
| n8n Cloud | REST API | https://primetech.app.n8n.cloud |
| n8n MCP Server | SSE | https://primetech.app.n8n.cloud/mcp-server/http |
| Apify | REST API | Token: apify_api_n32KFOBo74tTXNi1nEH8nuaMMgrmRc15XrzS |

---

## 4. CODE & CONFIGURATIONS

### File: Program Keyword Mapping Guide Generator
**Purpose**: Creates comprehensive Word document with 25 GDIT program definitions, keywords, locations, and mapping rules for standardized job classification.

```javascript
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, Header, Footer, 
        AlignmentType, PageNumber, LevelFormat, BorderStyle, WidthType, ShadingType, 
        HeadingLevel } = require('docx');
const fs = require('fs');

// Program mapping data from Federal Programs Database and job analysis
const programs = [
  {
    code: "INSCOM",
    fullName: "INSCOM IT Support Services (I2TS4)",
    acronym: "I2TS4, I2TS-III, IT2S4",
    agency: "Army",
    prime: "GDIT",
    clearance: "TS/SCI",
    keywords: ["I2TS4", "I2TS", "INSCOM", "Intelligence Support"],
    locations: ["Fort Meade MD", "Fort Belvoir VA", "Fort Liberty NC (Bragg)", "Fort Sam Houston TX", "Fort Carson CO", "Fort Bliss TX", "Redstone Arsenal AL", "Hunter AAF GA", "Savannah GA", "Fort Eisenhower GA", "Camp Bullis TX", "Joint Base Lewis-McChord WA"],
    roles: ["Network Administrator", "Systems Administrator", "Help Desk", "Intel IT Support", "Field Service"],
    priority: "High"
  },
  {
    code: "JUSTIFIED",
    fullName: "Air Force SAP Security Support Services",
    acronym: "Justified",
    agency: "Air Force",
    prime: "GDIT",
    clearance: "TS/SCI + SAP",
    keywords: ["JUSTIFIED", "SAP Security", "ASR", "PSR", "Activity Security Representative", "Physical Security Representative"],
    locations: ["Pentagon VA", "Kirtland AFB NM", "Schriever SFB CO", "Hanscom AFB MA", "Langley AFB VA", "Eglin AFB FL", "JBAB DC", "San Antonio TX", "Robins AFB GA", "Colorado Springs CO"],
    roles: ["IT/IA Specialist", "ISSO", "ISSM", "Activity Security Representative", "Physical Security Representative", "Network/Systems Admin"],
    priority: "High"
  },
  {
    code: "BICES",
    fullName: "Battlefield Information Collection & Exploitation System",
    acronym: "BICES",
    agency: "DoD",
    prime: "CACI (GDIT sub)",
    clearance: "Secret, TS/SCI",
    keywords: ["BICES", "Coalition Intel", "Mission Partner"],
    locations: ["Tampa FL", "MacDill AFB FL", "Springfield VA", "Norfolk VA", "Doral FL", "Colorado Springs CO", "Hawaii", "Pearl Harbor HI"],
    roles: ["Network Engineer", "Systems Engineer", "Linux Admin", "Windows Admin", "SharePoint Engineer", "Cyber Analyst", "NOSC Analyst", "VoIP/CUCM Admin"],
    priority: "High"
  },
  {
    code: "BICES-X",
    fullName: "DIA Battlefield Information Networks / BICES-X",
    acronym: "BICES-X",
    agency: "DIA",
    prime: "CACI (GDIT sub)",
    clearance: "TS/SCI",
    keywords: ["BICES-X", "BICESX", "DIA BICES"],
    locations: ["MacDill AFB FL", "Tampa FL", "Springfield VA", "Offutt AFB NE", "Stuttgart Germany"],
    roles: ["Network Administrator", "Systems Architect", "Systems Administrator"],
    priority: "High"
  },
  {
    code: "MPCO",
    fullName: "Mission Partner Environment (Field Ops / MPCO)",
    acronym: "MPCO, MPE",
    agency: "DoD",
    prime: "GDIT",
    clearance: "Secret, TS/SCI",
    keywords: ["MPCO", "MPE", "Mission Partner Environment", "Mission Partner"],
    locations: ["Tampa FL", "Pearl Harbor HI", "Colorado Springs CO", "Norfolk VA", "Springfield VA", "Langley VA"],
    roles: ["Network Administrator", "Systems Administrator", "Information Security Analyst", "Solarwinds Analyst", "NOSC Analyst"],
    priority: "High"
  },
  {
    code: "DEOS",
    fullName: "Defense Enterprise Office Solutions",
    acronym: "DEOS",
    agency: "DISA",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["DEOS", "O365", "Office 365", "Exchange", "SharePoint", "Azure", "Cloud"],
    locations: ["Chantilly VA", "Fort Meade MD", "Durham NC", "Remote/Hybrid"],
    roles: ["O365 Administrator", "Exchange Architect", "SharePoint Engineer", "Cloud Architect", "Systems Engineer", "Identity Consultant", "Tier III Support"],
    priority: "Medium"
  },
  {
    code: "NCIS",
    fullName: "Naval Criminal Investigative Service IT Support",
    acronym: "NCIS",
    agency: "Navy",
    prime: "GDIT",
    clearance: "Secret, Top Secret",
    keywords: ["NCIS", "Naval Criminal"],
    locations: ["Quantico VA", "San Diego CA", "JBAB DC"],
    roles: ["Project Manager", "Oracle DBA", "SQL DBA", "Systems Integrator", "Requirements Analyst", "Network Engineer", "IA Analyst", "ISSO", "Linux Admin", "SharePoint Admin", ".NET Developer", "Citrix Admin", "VMware Admin", "ServiceNow Developer", "Field Service Engineer", "Field Computer Specialist"],
    priority: "Medium"
  },
  {
    code: "ADCS4",
    fullName: "Air Defense Command & Control System 4",
    acronym: "ADCS4",
    agency: "Air Force",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["ADCS4", "ADCS", "Air Defense"],
    locations: ["Hampton VA", "Tyndall AFB FL"],
    roles: ["Network Engineer", "Telecommunications Analyst", "Logistics Analyst", "Senior Program Analyst", "ISSM", "INFOSEC Analyst"],
    priority: "Medium"
  },
  {
    code: "ADCNOMS",
    fullName: "Air Defense Communications Network Operations & Maintenance Support",
    acronym: "ADCNOMS",
    agency: "Air Force",
    prime: "GDIT",
    clearance: "Secret, TS/SCI",
    keywords: ["ADCNOMS"],
    locations: ["Schriever AFB CO", "Fort Huachuca AZ"],
    roles: ["ISSO", "Project Manager", "Network Engineer", "PKI Systems Engineer", "Cyber Security Engineer"],
    priority: "Medium"
  },
  {
    code: "DSMS",
    fullName: "Defense Security Management System / DTRA Support",
    acronym: "DSMS, I3TS",
    agency: "DoD/DTRA",
    prime: "GDIT/Leidos",
    clearance: "Secret, Top Secret",
    keywords: ["DSMS", "DTRA", "Defense Threat Reduction"],
    locations: ["Fort Belvoir VA", "Kirtland AFB NM"],
    roles: ["Program Manager", "Network Administrator", "Active Directory Admin", "Database Administrator", "Lead Cyber Security Analyst", "Cyber Security Admin", "Configuration Manager"],
    priority: "Medium"
  },
  {
    code: "SITEC",
    fullName: "SITEC III – Enterprise Operations & Maintenance",
    acronym: "SITEC, SITEC III",
    agency: "SOCOM",
    prime: "Peraton (GDIT sub)",
    clearance: "TS/SCI",
    keywords: ["SITEC", "SITEC III", "SOCOM IT"],
    locations: ["Fort Liberty NC (Bragg)", "MacDill AFB FL"],
    roles: ["Systems Automation Engineer", "System Engineer", "Server Automation Engineer"],
    priority: "Medium"
  },
  {
    code: "WARHAWK",
    fullName: "WARHAWK Software Development",
    acronym: "WARHAWK",
    agency: "Air Force",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["WARHAWK"],
    locations: ["Remote"],
    roles: ["Scrum Master", "Software Engineer", "Software Developer"],
    priority: "Medium"
  },
  {
    code: "CMS",
    fullName: "Centers for Medicare & Medicaid Services Cloud/HFPP",
    acronym: "CMS, HFPP",
    agency: "HHS/CMS",
    prime: "GDIT",
    clearance: "Public Trust",
    keywords: ["CMS", "HFPP", "Medicare", "Medicaid", "Healthcare"],
    locations: ["Remote"],
    roles: ["ETL Cloud Developer", "Cloud Data Scientist", "Cloud/DevOps Engineer", "Cloud Optimization Analyst", "Sr. Cloud Developer", "Sr. Cloud Systems Engineer"],
    priority: "Medium"
  },
  {
    code: "BAO",
    fullName: "Blanket Ordering Agreement (General Software)",
    acronym: "BAO",
    agency: "DoD",
    prime: "GDIT",
    clearance: "Varies",
    keywords: ["BAO", "Blanket Ordering"],
    locations: ["Remote", "Various"],
    roles: ["Software Engineer", "Software Developer", "Human Factors Lead", "Hardware Systems Integration Lead"],
    priority: "Low"
  },
  {
    code: "DLA",
    fullName: "DLA J6 Enterprise Technology Services",
    acronym: "DLA JETS, IOEE",
    agency: "DLA",
    prime: "GDIT",
    clearance: "Secret, Public Trust",
    keywords: ["DLA", "JETS", "IOEE", "Defense Logistics Agency"],
    locations: ["Springfield VA", "Fort Belvoir VA", "Columbus OH", "Philadelphia PA"],
    roles: ["Network Engineer", "Systems Administrator", "Help Desk"],
    priority: "Medium"
  },
  {
    code: "SCITES",
    fullName: "SCITLS / SCITES Logistics IT",
    acronym: "SCITES, SCITLS",
    agency: "DoD",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["SCITES", "SCITLS"],
    locations: ["Key West FL", "CONUS"],
    roles: ["Service Desk Technician", "Logistics IT Technician"],
    priority: "Low"
  },
  {
    code: "NSST",
    fullName: "Navy Shipboard Systems Training",
    acronym: "NSST",
    agency: "Navy",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["NSST", "Navy Training"],
    locations: ["Orlando FL", "Navy Training Commands"],
    roles: ["Logistics Associate", "Trainer", "Simulator/IT Technician"],
    priority: "Low"
  },
  {
    code: "JSP ETM",
    fullName: "Joint Service Provider Enterprise Technology Modernization",
    acronym: "JSP ETM, JSP",
    agency: "DoD",
    prime: "CACI (GDIT sub)",
    clearance: "Secret, TS/SCI",
    keywords: ["JSP", "JSP ETM", "Pentagon IT", "Joint Service Provider"],
    locations: ["Pentagon VA", "NCR"],
    roles: ["Network Engineer", "Intercept Monitor", "Help Desk", "VTC Support"],
    priority: "High"
  },
  {
    code: "ISEE",
    fullName: "Intelligence Systems Security Engineering",
    acronym: "ISEE, ISSE",
    agency: "DoD",
    prime: "GDIT",
    clearance: "CI Poly, TS/SCI",
    keywords: ["ISEE", "ISSE", "Intel Systems"],
    locations: ["Tampa FL", "Various"],
    roles: ["Exchange Engineer", "Intel Systems Security Engineer"],
    priority: "Medium"
  },
  {
    code: "DHA D2D",
    fullName: "Defense Health Agency Desktop to Datacenter",
    acronym: "D2D, DHA D2D",
    agency: "DHA",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["DHA", "D2D", "Desktop to Datacenter", "Defense Health"],
    locations: ["San Antonio TX", "NCR", "Hawaii"],
    roles: ["IT Support", "Network Engineer", "Systems Administrator"],
    priority: "Medium"
  },
  {
    code: "F-35 JSF",
    fullName: "F-35 Joint Strike Fighter Program Support",
    acronym: "F-35, JSF",
    agency: "DoD",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["F-35", "JSF", "Joint Strike Fighter"],
    locations: ["Dayton OH", "Various"],
    roles: ["Help Desk Tech", "IT Support"],
    priority: "Low"
  },
  {
    code: "CENTCOM",
    fullName: "CENTCOM Enterprise IT Modernization",
    acronym: "CENTCOM EITM",
    agency: "CENTCOM",
    prime: "GDIT",
    clearance: "Secret, Top Secret",
    keywords: ["CENTCOM", "EITM"],
    locations: ["MacDill AFB FL", "OCONUS"],
    roles: ["IT Modernization", "Enterprise IT"],
    priority: "Medium"
  },
  {
    code: "AFNORTH",
    fullName: "Air Forces Northern Command Support",
    acronym: "AFNORTH",
    agency: "Air Force",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["AFNORTH", "NORAD"],
    locations: ["Tyndall AFB FL", "Peterson AFB CO"],
    roles: ["IT Support", "Network Engineer"],
    priority: "Low"
  },
  {
    code: "CBOSS",
    fullName: "C-Band Operations Support Services",
    acronym: "CBOSS",
    agency: "Space Force",
    prime: "GDIT",
    clearance: "Secret",
    keywords: ["CBOSS", "C-Band"],
    locations: ["Various"],
    roles: ["Operations Support", "SATCOM"],
    priority: "Low"
  },
  {
    code: "Other",
    fullName: "Other/Unclassified Programs",
    acronym: "N/A",
    agency: "Various",
    prime: "Various",
    clearance: "Varies",
    keywords: ["FBI/EOC", "RATCHET", "GECOS", "MSPSC", "WSP"],
    locations: ["Various"],
    roles: ["Various"],
    priority: "Low"
  }
];

// Document generation continues with tables, sections, etc.
// Full implementation creates 10+ page professional document
// See PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx for output
```

### File: Batch Job Program Mapping Script Pattern
**Purpose**: Pattern for batch updating GDIT Jobs with Program classification via Notion API.

```javascript
// Example: Mapping I2TS4/INSCOM jobs
// Search for jobs matching keyword pattern
const searchResults = await notionSearch({
  data_source_url: "collection://2ccdef65-baa5-80b0-9a80-000bd2745f63",
  query: "I2TS4 Fort Meade INSCOM Intelligence"
});

// Batch update each result
for (const job of searchResults.results) {
  await notionUpdatePage({
    data: {
      command: "update_properties",
      page_id: job.id,
      properties: {
        "Program": "INSCOM"
      }
    }
  });
}
```

### File: Contact Import Script Pattern
**Purpose**: Bulk import contacts from Excel to Notion database.

```javascript
// Contact data structure from Excel parsing
const contacts = [
  {
    name: "John Smith",
    lastContact: "2024-12-15",
    accountManager: "Colin Broder",
    location: "Fort Meade, MD",
    notes: "DCGS contact, interested in cleared roles"
  }
  // ... 140 total contacts
];

// Batch create in Notion
await notionCreatePages({
  parent: { data_source_id: "ff111f82-fdbd-4353-ad59-ea4de70a058b" },
  pages: contacts.map(c => ({
    properties: {
      "Contact Name": c.name,
      "date:Last Contact:start": c.lastContact,
      "date:Last Contact:is_datetime": 0,
      "Account Manager": c.accountManager,
      "Location/Site": c.location,
      "Raw Notes": c.notes,
      "Status": "Active"
    }
  }))
});
```

### Configuration: Program Field Select Options
**Purpose**: GDIT Jobs database Program field options (must include all when updating).

```json
{
  "Program": {
    "type": "select",
    "select": {
      "options": [
        {"name": "BICES", "color": "blue"},
        {"name": "BICES-X", "color": "blue"},
        {"name": "JUSTIFIED", "color": "purple"},
        {"name": "ISEE", "color": "purple"},
        {"name": "DEOS", "color": "green"},
        {"name": "CBOSS", "color": "green"},
        {"name": "NCIS", "color": "red"},
        {"name": "NSST", "color": "red"},
        {"name": "CMS", "color": "yellow"},
        {"name": "BAO", "color": "yellow"},
        {"name": "MPCO", "color": "orange"},
        {"name": "INSCOM", "color": "orange"},
        {"name": "SITEC", "color": "pink"},
        {"name": "SCITES", "color": "pink"},
        {"name": "WARHAWK", "color": "gray"},
        {"name": "Other", "color": "gray"},
        {"name": "JSP ETM", "color": "brown"},
        {"name": "AFNORTH", "color": "brown"},
        {"name": "DLA", "color": "default"},
        {"name": "F-35 JSF", "color": "default"},
        {"name": "DHA D2D", "color": "default"},
        {"name": "CENTCOM", "color": "default"},
        {"name": "ADCS4", "color": "default"},
        {"name": "DSMS", "color": "default"},
        {"name": "ADCNOMS", "color": "default"}
      ]
    }
  }
}
```

---

## 5. NOTION DATABASE SCHEMAS

### Database: Program Mapping Intelligence Hub
- **Collection ID**: `f57792c1-605b-424c-8830-23ab41c47137`
- **Purpose**: Central processing hub for job postings and enrichment

| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Job title/identifier |
| Status | Select | raw_import, pending_enrichment, enriching, enriched, validated, error |
| Enrichment Timestamp | Date | When enrichment was performed |
| AI Confidence Score | Number | 0-100 confidence in classification |
| Priority Score | Number | BD opportunity score (0-100) |
| Program Name | Relation | Link to Federal Programs |
| Apify Run ID | Text | Source scraper run identifier |
| Source URL | URL | Original job posting URL |
| Job Title | Text | Extracted job title |
| Company | Select | Source company (GDIT, CACI, etc.) |
| Job Description | Text | Full job description |
| Clearance Level | Select | Secret, TS, TS/SCI, CI Poly, etc. |
| Location | Text | Job location |
| Salary Range | Text | Extracted compensation info |
| + 52 more fields | Various | See handoff documentation |

**Relations**:
- Program Name → Federal Programs (many-to-one)
- BD Opportunity → BD Opportunities (one-to-many)

### Database: Federal Programs
- **Collection ID**: `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`
- **Purpose**: Master catalog of 388 DoD/IC programs

| Property | Type | Description |
|----------|------|-------------|
| Program Name | Title | Official program name |
| Program Type | Select | Weapons, IT, Intel, Logistics, etc. |
| Agency | Select | DoD, Army, Navy, Air Force, etc. |
| Prime Contractor | Relation | Link to Contractors DB |
| Contract Value | Number | Estimated contract value |
| Contract Vehicle | Select | GWAC, IDIQ, etc. |
| Confidence Level | Select | High, Medium, Low |
| Keywords | Multi-select | Searchable program identifiers |
| Locations | Multi-select | Key program locations |

### Database: GDIT Jobs
- **Collection ID**: `2ccdef65-baa5-80b0-9a80-000bd2745f63`
- **Purpose**: Historical GDIT job postings for program mapping

| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Job number + title |
| Program | Select | 25 program options (see config above) |
| Job Title | Text | Clean job title |
| Location | Text | Job location |
| Client Bill Rate | Text | Billing rate |
| Contact | Text | POC name |
| Employment Type | Select | Contract, Contract To Hire, Direct Hire |
| Open/Closed | Select | Open, Closed |
| Owner | Text | Account manager |
| Pay Rate | Text | Pay rate |
| Perm Fee (%) | Number | Placement fee percentage |
| Salary | Text | Salary range |
| Status | Select | Open, Placed, Filled by Client, etc. |
| Date Added | Date | When job was added |
| Reporting Manager | Text | Hiring manager |

### Database: GDIT PTS Contacts
- **Collection ID**: `ff111f82-fdbd-4353-ad59-ea4de70a058b`
- **Purpose**: GDIT contact activity tracking

| Property | Type | Description |
|----------|------|-------------|
| Contact Name | Title | Full name |
| Last Contact | Date | Most recent contact date |
| Account Manager | Select | PTS account manager |
| Location/Site | Text | Work location |
| Raw Notes | Text | Activity notes |
| Status | Select | Active, Inactive |

### Database: BD Events
- **Collection ID**: `782080b1-xxxx-xxxx-xxxx-xxxxxxxxxxxx`
- **Purpose**: Conference and event tracking

| Property | Type | Description |
|----------|------|-------------|
| Event Name | Title | Conference/event name |
| Event Type | Select | Conference, Trade Show, Networking, etc. |
| Date | Date | Event date range |
| Location | Text | Event location |
| Target Attendees | Multi-select | Key people to meet |
| Strategy Notes | Text | Pre-event strategy |
| Priority | Select | High, Medium, Low |
| Status | Select | Planned, Attending, Completed, Cancelled |
| Related Programs | Relation | Link to Federal Programs |
| Related Contacts | Relation | Link to Contacts Database |
| Budget | Number | Event budget |
| ROI Notes | Text | Post-event assessment |
| Follow-up Actions | Text | Action items |
| Created | Created time | Auto-generated |

### Database: BD Opportunities
- **Collection ID**: `2bcdef65-baa5-8015-xxxx-xxxxxxxxxxxx`
- **Purpose**: BD pipeline tracking

| Property | Type | Description |
|----------|------|-------------|
| Opportunity Name | Title | Opportunity identifier |
| Priority Score | Number | 0-100 BD score |
| Priority Class | Formula | HOT (≥80), WARM (50-79), COLD (<50) |
| Program | Relation | Link to Federal Programs |
| Source Hub Record | Relation | Link to Program Mapping Hub |
| Status | Select | Identified, Pursuing, Won, Lost |
| Estimated Value | Number | Contract value estimate |
| Next Action | Text | Next BD step |
| Owner | Select | BD lead |
| Created | Created time | Auto-generated |

### Database: Enrichment Runs Log
- **Collection ID**: `20dca021-f026-42a5-aaf7-2b1c87c4a13d`
- **Purpose**: Workflow execution audit trail

| Property | Type | Description |
|----------|------|-------------|
| Run Name | Title | Workflow run identifier |
| Workflow | Select | Apify Import, Enrichment, etc. |
| Status | Select | Running, Completed, Failed |
| Start Time | Date | Execution start |
| End Time | Date | Execution end |
| Records Processed | Number | Count of records |
| Errors | Number | Error count |
| Error Details | Text | Error messages |
| Trigger | Select | Schedule, Webhook, Manual |
| Run ID | Text | External system run ID |

---

## 6. N8N WORKFLOWS

### Workflow: Apify Job Import
- **Status**: Planned
- **Purpose**: Import scraped jobs from Apify to Notion

```
[Webhook Trigger] → [Parse Payload] → [Deduplicate] → [Create Notion Pages] → [Log Run]
     │                    │                 │                  │                  │
     ▼                    ▼                 ▼                  ▼                  ▼
  POST from           Extract job      Query existing     Create in Hub     Write to
  Apify Actor         data array       by Source URL      Status: raw       Enrichment Log
```

**Key Configurations**:
- Webhook URL: `https://primetech.app.n8n.cloud/webhook/apify-jobs`
- Notion Database: Program Mapping Hub (f57792c1)
- Dedup Field: Source URL

### Workflow: Enrichment Processor
- **Status**: Planned
- **Purpose**: AI-powered program classification

```
[Schedule: 15min] → [Query Hub] → [GPT-4o Classify] → [Update Notion] → [Score] → [Alert]
       │                │               │                   │             │          │
       ▼                ▼               ▼                   ▼             ▼          ▼
   Cron trigger    Status =        Use Program          Update job    Calculate   If score
                   pending_        Mapping Guide        Program +     Priority    ≥80, send
                   enrichment      prompt               Confidence    Score       Slack alert
```

**Key Configurations**:
- Schedule: Every 15 minutes
- Query Filter: Status = "pending_enrichment"
- GPT-4o Model: gpt-4o
- Scoring Algorithm: Clearance(35) + Program(20) + Location(15) + Value(15) + Timing(15)

### Workflow: Priority Alert
- **Status**: Planned
- **Purpose**: Notify on high-priority opportunities

```
[Notion Trigger] → [Check Score] → [Format Message] → [Slack Webhook]
       │                │                 │                 │
       ▼                ▼                 ▼                 ▼
  Priority Score    If ≥80 =        Build alert       POST to
  property change   HOT, proceed    with details      Slack channel
```

---

## 7. APIFY ACTORS & SCRAPERS

### Actor: GDIT Careers Scraper
- **Status**: To be configured
- **Purpose**: Scrape GDIT careers page for new job postings

**Input Configuration**:
```json
{
  "startUrls": [
    "https://www.gdit.com/careers/job-search/"
  ],
  "maxRequestsPerCrawl": 500,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

**Output Schema**:
```json
{
  "title": "string",
  "jobId": "string",
  "location": "string",
  "description": "string",
  "requirements": "string",
  "clearance": "string",
  "postedDate": "string",
  "url": "string"
}
```

**Rate Limiting**:
- Max 100 requests per run
- Run frequency: Daily at 2 AM

---

## 8. PROBLEMS SOLVED

### Problem 1: Database Creation Failing
- **Description**: Attempts to create BD Events database via Notion API returned generic errors
- **Root Cause**: Database creation at workspace root level is not supported; must specify valid parent page
- **Solution**: Searched for existing page to use as parent, then created database under that page

### Problem 2: Multi-Source Database Limitations
- **Description**: Unable to modify schema or rename multi-source databases via API
- **Root Cause**: Notion API limitation - multi-source databases require UI for certain operations
- **Solution**: Document which operations require manual UI intervention; use Collection IDs instead of Database IDs for reliable access

### Problem 3: Database ID Errors in Handoff Documents
- **Description**: 6 database IDs in handoff documents were incorrect, causing API failures
- **Root Cause**: IDs may have been copied incorrectly or databases were recreated
- **Solution**: Systematic audit of all 14 databases to verify and correct Collection IDs

### Problem 4: Select Field Update Failures
- **Description**: Adding new program options to select field failed
- **Root Cause**: Notion requires full options array including existing values when updating
- **Solution**: Fetch current schema, merge existing options with new ones, then update

### Problem 5: Rate Limiting During Bulk Updates
- **Description**: Batch updates hit rate limits causing partial failures
- **Root Cause**: Notion API limits: 180 general requests/min, 30 searches/min
- **Solution**: Batch updates in groups of 20-30 with delays between batches

### Problem 6: Unmapped Jobs Scattered Across Database
- **Description**: 400+ jobs had no Program field value, making analysis impossible
- **Root Cause**: Historical data entry without program classification standards
- **Solution**: Created Program Keyword Mapping Guide and systematically mapped 250+ jobs using keyword/location patterns

---

## 9. PENDING ITEMS / NEXT STEPS

### High Priority
1. **Implement Automated Program Classification Workflow** - Build n8n workflow using Program Keyword Mapping Guide patterns with GPT-4o
2. **Connect GDIT Jobs Scraper to n8n** - Configure Apify actor and webhook integration
3. **Map Remaining ~150 GDIT Jobs** - Complete classification using established patterns

### Medium Priority
4. **Populate Contractors Database** - Import prime/sub contractor data from SAM.gov
5. **Populate Contract Vehicles Database** - Add GWAC/IDIQ vehicle information
6. **Connect Enrichment Runs Log** - Enable audit trail for all workflow executions
7. **Build Contact Follow-up Workflow** - Automate stale contact identification

### Low Priority
8. **Add New Program Options** - Consider adding MSPSC, GECOS, FBI/EOC, RATCHET to program list
9. **Create Dashboard Views** - Build Notion views for BD pipeline analysis
10. **Formula Field Implementation** - Complete 11 placeholder formula fields in Hub

---

## 10. KEY INSIGHTS & GOTCHAS

### Notion API Gotchas
1. **Collection ID vs Database ID**: Always use Collection IDs for MCP data source operations. Find these in the `collection://` URLs returned by fetch operations.

2. **Multi-Source Database Limitations**: Cannot rename, delete, or modify schema via API. Requires Notion UI for these operations.

3. **Select Field Updates**: Must include ALL existing options plus new ones when updating select fields. Forgetting existing options will delete them.

4. **Database Creation Parent**: Cannot create databases at workspace root. Must specify a valid parent page ID.

5. **Rate Limits**: 
   - General: 180 requests/minute (3/second)
   - Search: 30 requests/minute
   - Batch in groups of 20-30 for safety

### Program Mapping Insights
1. **Keyword Priority**: Check for explicit program acronyms in job title FIRST (I2TS4, BICES, JUSTIFIED)

2. **Location is Key**: Many programs have exclusive locations:
   - Tampa/MacDill = BICES, BICES-X, MPCO
   - Fort Meade = INSCOM
   - Pentagon = JUSTIFIED, JSP ETM
   - Kirtland AFB = JUSTIFIED, DSMS

3. **Prime vs Sub**: GDIT is sometimes prime, sometimes sub:
   - GDIT Prime: INSCOM, JUSTIFIED, DEOS, NCIS, MPCO
   - GDIT Sub: BICES (CACI), JSP ETM (CACI), SITEC (Peraton)

4. **"Other" Catch-All**: Use for programs not in the standard list:
   - FBI/EOC programs
   - RATCHET
   - GECOS
   - MSPSC

### Schema-Locked Properties
These properties interface with n8n workflows - DO NOT MODIFY without coordinating workflow updates:

**Program Mapping Hub**:
- Status (state machine values must match exactly)
- Enrichment Timestamp
- AI Confidence Score
- Priority Score
- Apify Run ID
- Source URL
- Job Title
- Company
- Job Description
- Clearance Level

**Federal Programs**:
- property_contract_value
- property_contract_vehicle_type
- property_program_type_1
- property_confidence_level
- Program Name

### Contact Database Architecture
Contacts are intentionally separated by company/program relationship:
- **DCGS Contacts Full**: Primary HUMINT contacts (965+)
- **GDIT PTS Contacts**: GDIT activity log (140)
- **GDIT Other Contacts**: Secondary GDIT contacts
- **Lockheed Contact CSV**: Lockheed Martin program contacts
- **GBSD Contact Chart**: Northrop Grumman Sentinel contacts

Do NOT merge these databases - context would be lost.

---

## DOCUMENT OUTPUTS FROM THIS SESSION

1. **PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx** - 25 program definitions with keywords, locations, and mapping rules
2. **PTS_Database_Architecture_v5.docx** - Complete 14-database reference with verified Collection IDs
3. **PTS_Action_Plan_Complete.docx** - 5-phase cleanup and optimization roadmap
4. **PTS_Project_Handoff_Document_Master_State_v1.docx** - Cross-project handoff for n8n integration

---

*Generated by Claude | PTS BD Intelligence System | January 2, 2026*
