# DCGS BD Intelligence System - Claude Export
## PTS Business Development Campaign for GDIT DCGS Portfolio

**Export Date:** January 10, 2025  
**Conversation Span:** December 17, 2024 - January 10, 2025  
**Repository Ready:** Yes

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
**DCGS (Distributed Common Ground System) Business Development Campaign** for Prime Technical Services (PTS), a Service-Disabled Veteran-Owned Small Business (SDVOSB) specializing in cleared IT staffing for defense contractors.

### Primary Objective
Transform traditional cold-calling staffing sales into **intelligence-driven business development** by:
1. Scraping competitor job boards to identify labor gaps
2. Mapping jobs to federal programs (~388 programs in database)
3. Building contact intelligence through LinkedIn/ZoomInfo
4. Gathering HUMINT from lower-tier contacts before approaching decision-makers
5. Crafting personalized outreach using PTS past performance

### Target Portfolio
| Program | Estimated Value | Prime/Sub | Status |
|---------|-----------------|-----------|--------|
| AF DCGS | ~$500M | BAE Prime / GDIT Sub | Option Year 2, Nov 2026 review |
| Army DCGS-A | ~$300M | GDIT Prime | Active |
| Navy DCGS-N | ~$150M | GDIT Prime | Active |
| **TOTAL** | **~$950M** | | |

### Key Deliverables Created
1. Comprehensive handoff documents (DOCX + MD)
2. Contact classification system with 6-tier hierarchy
3. BD priority scoring algorithm
4. Location-to-program mapping logic
5. LinkedIn verification findings (critical accuracy issues)
6. N8N workflow specifications
7. Weekly pipeline updates for account management

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: 6-Tier Contact Hierarchy System
**Decision:** Classify all contacts into 6 tiers based on job title keywords

**Reasoning:** Enables HUMINT approach - gather intel from lower tiers (5-6) before approaching decision-makers (1-3). Also automates BD priority assignment.

**Tier Definitions:**
| Tier | Name | Keywords | BD Approach |
|------|------|----------|-------------|
| 1 | Executive | VP, President, Chief, CEO, CTO, CIO, CISO | Exec-to-exec, last contact |
| 2 | Director | Director | Strategic alignment |
| 3 | Program Leadership | Program Manager, Site Lead, Task Order Lead | Present solutions |
| 4 | Management | Manager, Team Lead, Supervisor | Validate intel |
| 5 | Senior IC | Senior, Sr., Principal, Lead Engineer, Architect | Relationship building |
| 6 | Individual Contributor | Default (Analyst, Engineer, Admin) | HUMINT gathering |

**Alternatives Considered:** 4-tier system was too coarse; 8-tier was too granular.

---

### Decision 2: BD Priority Based on Tier + Site Criticality
**Decision:** Calculate BD Priority as Critical/High/Medium/Standard based on hierarchy tier AND program assignment

**Reasoning:** San Diego PACAF site is critically understaffed, so ANY contact there gets elevated priority regardless of tier.

**Priority Rules:**
```python
def get_bd_priority(hierarchy_tier, program=None):
    # Critical: Executives + PACAF site (highest priority)
    if hierarchy_tier in ['Tier 1 - Executive', 'Tier 2 - Director']:
        return '🔴 Critical'
    if program == 'AF DCGS - PACAF':
        return '🔴 Critical'  # San Diego is priority target
    
    # High: Program Managers and Site Leads
    if hierarchy_tier == 'Tier 3 - Program Leadership':
        return '🟠 High'
    
    # Medium: Managers
    if hierarchy_tier == 'Tier 4 - Management':
        return '🟡 Medium'
    
    # Standard: ICs
    return '⚪ Standard'
```

---

### Decision 3: Database Split - DCGS vs Other GDIT Contacts
**Decision:** Split original ~2,000 contact database into:
- **DCGS Contacts Full** (~965 records) - Primary campaign focus
- **GDIT Other Contacts** (~1,052 records) - Other GDIT programs

**Reasoning:** 
- Focused classification for DCGS campaign
- Prevents contamination of BD messaging
- Database performance degrades above ~1,000 records in Notion

---

### Decision 4: LinkedIn Verification Required Before Outreach
**Decision:** MANDATORY LinkedIn profile verification for all Critical and High priority contacts before any outreach

**Reasoning:** Discovered major inaccuracies through verification:
- Maureen Shamaly was listed as "AF DCGS Langley Site Lead" but actually works on Global Freight Management in Illinois
- Kingsley Ero was claimed as "Acting Site Lead" but is actually "Security Analyst"

**Impact:** ~75-78% estimated accuracy after discoveries

---

### Decision 5: Hub-and-Spoke Data Architecture
**Decision:** Program Mapping Hub serves as central processing point for all scraped jobs

**Data Flow:**
```
Apify Scrapes → Program Mapping Hub → GPT-4o Enrichment → BD Opportunities
                       ↓
              Federal Programs (reference)
                       ↓
              DCGS Contacts (outreach)
```

---

## 3. ARCHITECTURE & DATA FLOW

### System Overview
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PTS BD INTELLIGENCE SYSTEM                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐   │
│  │   APIFY      │     │      N8N         │     │     NOTION        │   │
│  │  Scrapers    │────▶│   Workflows      │────▶│   Databases       │   │
│  │              │     │                  │     │                   │   │
│  │ • Insight Gl │     │ • Job Import     │     │ • Program Map Hub │   │
│  │ • TEKsystems │     │ • Enrichment     │     │ • Federal Progs   │   │
│  │ • CACI       │     │ • Alerts         │     │ • DCGS Contacts   │   │
│  │ • ClearanceJ │     │ • BD Pipeline    │     │ • GDIT Jobs       │   │
│  └──────────────┘     └──────────────────┘     │ • BD Opportunities│   │
│                              │                 └───────────────────┘   │
│                              │                          │               │
│                              ▼                          ▼               │
│                       ┌──────────────┐          ┌──────────────┐       │
│                       │   GPT-4o     │          │   OUTPUTS    │       │
│                       │  Enrichment  │          │              │       │
│                       │              │          │ • Call Sheets│       │
│                       │ • Location   │          │ • Playbooks  │       │
│                       │ • Clearance  │          │ • Org Charts │       │
│                       │ • Program    │          │ • Reports    │       │
│                       │ • Agency     │          └──────────────┘       │
│                       └──────────────┘                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Details

#### Flow 1: Job Scraping Pipeline
```
Apify PuppeteerScraper
    ↓ (webhook)
N8N: Apify Job Import Workflow
    ↓ (Status = raw_import)
Notion: Program Mapping Hub
    ↓ (15-min schedule)
N8N: Enrichment Processor
    ↓ (GPT-4o API call)
Notion: Program Mapping Hub (Status = enriched)
    ↓ (manual validation OR auto-qualify)
Notion: BD Opportunities (Score ≥ 70, Confidence ≥ 0.7)
```

#### Flow 2: Contact Classification Pipeline
```
ZoomInfo Export (CSV)
    ↓ (manual import)
Notion: DCGS Contacts Full
    ↓ (n8n workflow OR manual)
Classification Logic Applied:
    • Job Title → Hierarchy Tier
    • Location → Program
    • Tier + Program → BD Priority
    • Location → Location Hub
    • Title Keywords → Functional Area
    ↓
LinkedIn Verification Queue
    ↓ (manual verification)
Call Sheet Generation
```

### API Connections
| System | Endpoint/URL | Purpose |
|--------|--------------|---------|
| Notion MCP | https://mcp.notion.com/mcp | Database read/write |
| N8N MCP | https://primetech.app.n8n.cloud/mcp-server/http | Workflow triggers |
| Apify | Webhook to N8N | Job scrape delivery |
| OpenAI | GPT-4o API | Job enrichment |

---

## 4. CODE & CONFIGURATIONS

### 4.1 Contact Hierarchy Tier Classification

**File:** `contact_classification.py`  
**Purpose:** Automatically classify contacts into 6-tier hierarchy based on job title

```python
def get_hierarchy_tier(title):
    """
    Classify contact into hierarchy tier based on job title keywords.
    Returns exact Notion select option value.
    """
    if not title:
        return 'Tier 6 - Individual Contributor'
    
    title_lower = title.lower()
    
    # Tier 1 - Executive
    tier1_keywords = ['vice president', 'vp,', 'vp ', 'president', 
                      'chief ', 'ceo', 'cto', 'cio', 'ciso', 'cfo']
    if any(kw in title_lower for kw in tier1_keywords):
        return 'Tier 1 - Executive'
    
    # Tier 2 - Director
    if 'director' in title_lower:
        return 'Tier 2 - Director'
    
    # Tier 3 - Program Leadership
    tier3_keywords = ['program manager', 'deputy program', 'site lead', 
                      'task order', 'program director', 'project director']
    if any(kw in title_lower for kw in tier3_keywords):
        return 'Tier 3 - Program Leadership'
    
    # Tier 4 - Management
    tier4_keywords = ['manager', 'team lead', 'supervisor', 
                      'lead,', 'lead ', 'section chief']
    if any(kw in title_lower for kw in tier4_keywords):
        return 'Tier 4 - Management'
    
    # Tier 5 - Senior IC
    tier5_keywords = ['senior ', 'sr.', 'sr ', 'principal', 
                      'lead engineer', 'staff engineer', 'architect']
    if any(kw in title_lower for kw in tier5_keywords):
        return 'Tier 5 - Senior IC'
    
    # Tier 6 - Individual Contributor (default)
    return 'Tier 6 - Individual Contributor'
```

---

### 4.2 Location-to-Program Mapping

**File:** `location_mapping.js`  
**Purpose:** Map contact/job locations to DCGS programs

```javascript
const LOCATION_TO_PROGRAM = {
  // AF DCGS - Langley (DGS-1, 480th ISR Wing)
  'hampton': 'AF DCGS - Langley',
  'newport news': 'AF DCGS - Langley',
  'langley': 'AF DCGS - Langley',
  'yorktown': 'AF DCGS - Langley',
  
  // AF DCGS - PACAF (San Diego Node) 🔥 CRITICAL
  'san diego': 'AF DCGS - PACAF',
  'la mesa': 'AF DCGS - PACAF',
  
  // AF DCGS - Wright-Patterson (NASIC, Tech Refresh)
  'dayton': 'AF DCGS - Wright-Patt',
  'beavercreek': 'AF DCGS - Wright-Patt',
  'fairborn': 'AF DCGS - Wright-Patt',
  
  // Navy DCGS-N
  'norfolk': 'Navy DCGS-N',
  'suffolk': 'Navy DCGS-N',
  'chesapeake': 'Navy DCGS-N',
  'virginia beach': 'Navy DCGS-N',
  'tracy': 'Navy DCGS-N',  // West coast node
  
  // Army DCGS-A
  'fort belvoir': 'Army DCGS-A',
  'fort detrick': 'Army DCGS-A',
  'aberdeen': 'Army DCGS-A',
  
  // Corporate HQ
  'herndon': 'Corporate HQ',
  'falls church': 'Corporate HQ',
  'reston': 'Corporate HQ',
  'fairfax': 'Corporate HQ',
  'chantilly': 'Corporate HQ'
};

function mapLocationToProgram(city, state) {
  if (!city) return 'Unassigned';
  
  const cityLower = city.toLowerCase().trim();
  
  // Direct match
  if (LOCATION_TO_PROGRAM[cityLower]) {
    return LOCATION_TO_PROGRAM[cityLower];
  }
  
  // Partial match
  for (const [location, program] of Object.entries(LOCATION_TO_PROGRAM)) {
    if (cityLower.includes(location) || location.includes(cityLower)) {
      return program;
    }
  }
  
  return 'Unassigned';
}

function mapLocationToHub(city, state) {
  const program = mapLocationToProgram(city, state);
  
  const hubMap = {
    'AF DCGS - Langley': 'Hampton Roads',
    'AF DCGS - PACAF': 'San Diego Metro',
    'AF DCGS - Wright-Patt': 'Dayton/Wright-Patt',
    'Navy DCGS-N': 'Hampton Roads',  // Norfolk is Hampton Roads area
    'Army DCGS-A': 'DC Metro',
    'Corporate HQ': 'DC Metro'
  };
  
  return hubMap[program] || 'Unknown';
}

module.exports = { mapLocationToProgram, mapLocationToHub, LOCATION_TO_PROGRAM };
```

---

### 4.3 BD Priority Calculation

**File:** `bd_priority.py`  
**Purpose:** Calculate BD Priority based on hierarchy tier and program

```python
def get_bd_priority(hierarchy_tier, program=None):
    """
    Calculate BD Priority for outreach sequencing.
    Returns exact Notion select option value with emoji.
    """
    
    # Critical: Executives + PACAF site (highest priority)
    if hierarchy_tier in ['Tier 1 - Executive', 'Tier 2 - Director']:
        return '🔴 Critical'
    
    # Critical: San Diego PACAF is priority target regardless of tier
    if program == 'AF DCGS - PACAF':
        return '🔴 Critical'
    
    # High: Program Managers and Site Leads
    if hierarchy_tier == 'Tier 3 - Program Leadership':
        return '🟠 High'
    
    # Medium: Managers
    if hierarchy_tier == 'Tier 4 - Management':
        return '🟡 Medium'
    
    # Standard: ICs (Tier 5-6)
    return '⚪ Standard'


def get_priority_score(bd_priority):
    """Convert BD Priority to numeric score for sorting."""
    scores = {
        '🔴 Critical': 100,
        '🟠 High': 75,
        '🟡 Medium': 50,
        '⚪ Standard': 25
    }
    return scores.get(bd_priority, 0)
```

---

### 4.4 Functional Area Inference

**File:** `functional_area.py`  
**Purpose:** Infer functional area from job title keywords

```python
def get_functional_area(title):
    """
    Infer functional area from job title.
    Returns list of matching areas for Notion multi-select.
    """
    if not title:
        return ['Administrative']
    
    title_lower = title.lower()
    areas = []
    
    mappings = {
        'Program Management': ['program manager', 'project manager', 'pm ', 'pmo'],
        'Network Engineering': ['network', 'cisco', 'routing', 'switching'],
        'Cyber Security': ['cyber', 'security', 'infosec', 'isso', 'issm', 'stig'],
        'ISR/Intelligence': ['intelligence', 'isr', 'analyst', 'sigint', 'geoint', 'humint'],
        'Systems Administration': ['sysadmin', 'system admin', 'linux', 'windows admin'],
        'Software Engineering': ['software', 'developer', 'engineer', 'devsecops', 'devops'],
        'Field Service': ['field service', 'fse', 'field engineer', 'on-site'],
        'Security/FSO': ['fso', 'facility security', 'clearance', 'security officer'],
        'Business Development': ['business development', 'bd ', 'capture', 'proposal'],
        'Training': ['trainer', 'training', 'instructor'],
        'Administrative': ['admin', 'administrative', 'coordinator', 'assistant']
    }
    
    for area, keywords in mappings.items():
        if any(kw in title_lower for kw in keywords):
            areas.append(area)
    
    return areas if areas else ['Administrative']
```

---

### 4.5 GDIT Jobs Program Mapping

**File:** `gdit_jobs_mapping.py`  
**Purpose:** Map GDIT job titles and locations to programs

```python
# Program mapping based on Reporting Manager, Keywords, and Location
GDIT_PROGRAM_INDICATORS = {
    'BICES': {
        'keywords': ['bices', 'battlefield information', 'coalition'],
        'locations': ['norfolk', 'tampa', 'germany', 'italy'],
        'managers': ['bices', 'coalition']
    },
    'BICES-X': {
        'keywords': ['bices-x', 'bices x'],
        'locations': ['norfolk', 'tampa'],
        'managers': []
    },
    'JUSTIFIED': {
        'keywords': ['justified'],
        'locations': [],
        'managers': ['justified']
    },
    'ISEE': {
        'keywords': ['isee', 'integrated strategic'],
        'locations': ['huntsville', 'colorado springs'],
        'managers': ['isee']
    },
    'DEOS': {
        'keywords': ['deos', 'enterprise office'],
        'locations': [],
        'managers': ['deos']
    },
    'INSCOM': {
        'keywords': ['inscom', 'intelligence security command'],
        'locations': ['fort belvoir', 'fort meade'],
        'managers': ['inscom']
    }
}

def map_job_to_program(job_title, location, reporting_manager):
    """
    Map GDIT job to program using multi-factor logic.
    Priority: Reporting Manager > Keywords > Location
    """
    title_lower = (job_title or '').lower()
    location_lower = (location or '').lower()
    manager_lower = (reporting_manager or '').lower()
    
    for program, indicators in GDIT_PROGRAM_INDICATORS.items():
        # Check reporting manager first (highest confidence)
        if any(mgr in manager_lower for mgr in indicators['managers']):
            return program, 'High'
        
        # Check keywords in title
        if any(kw in title_lower for kw in indicators['keywords']):
            return program, 'Medium'
        
        # Check location
        if any(loc in location_lower for loc in indicators['locations']):
            return program, 'Low'
    
    return 'Other', 'Unknown'
```

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 DCGS Contacts Full

**Database URL:** https://www.notion.so/2ccdef65baa580d09b66c67d66e7a54d  
**Collection ID:** `2ccdef65-baa5-8087-a53b-000ba596128e`  
**Records:** ~965

| Property | Type | Options/Format | Notes |
|----------|------|----------------|-------|
| Name | Title | Text | Last Name, First Name format |
| First Name | Text | | |
| Job Title | Text | | Used for tier classification |
| Email Address | Email | | |
| Phone Number | Phone | | |
| Direct Phone Number | Phone | | |
| Mobile phone | Phone | | |
| Person City | Text | | Used for location mapping |
| Person State | Text | | |
| LinkedIn Contact Profile URL | URL | | CRITICAL for verification |
| **Program** | Select | AF DCGS - Langley, AF DCGS - Wright-Patt, AF DCGS - PACAF, AF DCGS - Other, Army DCGS-A, Navy DCGS-N, Corporate HQ, Enterprise Security, Unassigned | |
| **Hierarchy Tier** | Select | Tier 1 - Executive (🔴), Tier 2 - Director (🟠), Tier 3 - Program Leadership (🟡), Tier 4 - Management (🟢), Tier 5 - Senior IC (🔵), Tier 6 - Individual Contributor (⚪) | |
| **BD Priority** | Select | 🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard | |
| **Location Hub** | Select | Hampton Roads, San Diego Metro, DC Metro, Dayton/Wright-Patt, Other CONUS, OCONUS, Unknown | |
| **Functional Area** | Multi-Select | Program Management, Network Engineering, Cyber Security, ISR/Intelligence, Systems Administration, Software Engineering, Field Service, Security/FSO, Business Development, Training, Administrative | |
| Date | Date | | Last update |

---

### 5.2 GDIT Jobs

**Database URL:** https://www.notion.so/2ccdef65baa580669cb6ee688ede23f4  
**Collection ID:** `2ccdef65-baa5-80b0-9a80-000bd2745f63`  
**Records:** ~700

| Property | Type | Options/Format | Notes |
|----------|------|----------------|-------|
| Name | Title | | Job requisition name |
| Job Title | Text | | Parsed from Name |
| Location | Text | | Parsed from Name |
| **Program** | Select | BICES, BICES-X, JUSTIFIED, ISEE, DEOS, CBOSS, NCIS, NSST, CMS, BAO, MPCO, INSCOM, SITEC, SCITES, WARHAWK, JSP ETM, AFNORTH, DLA, F-35 JSF, DHA D2D, CENTCOM, ADCS4, DSMS, ADCNOMS, Other | |
| Reporting Manager | Text | | Key for program mapping |
| Date Added | Date | | |
| Owner | Text | | PTS recruiter assigned |
| Contact | Text | | Client contact |
| Employment Type | Select | Contract, Contract To Hire, Direct Hire, Scout, Closed | |
| Open/Closed | Select | Open, Closed, Filled by Client | |
| Status | Select | Open, Accepting Candidates, Placed, Lost to Competition, Filled by Client, Offer Out, Filled | |
| Pay Rate | Text | | |
| Client Bill Rate | Text | | |
| Salary | Text | | |
| Perm Fee (%) | Text | | |

---

### 5.3 Program Mapping Intelligence Hub

**Database URL:** https://www.notion.so/0a0d7e463d8840b6853a3c9680347644  
**Collection ID:** `f57792c1-605b-424c-8830-23ab41c47137`

| Property | Type | Notes |
|----------|------|-------|
| Name | Title | Job title from scrape |
| URL | URL | Original job posting URL |
| Company | Text | Staffing firm (Insight Global, etc.) |
| Location | Text | Extracted location |
| Detected Clearance | Text | TS/SCI, Secret, etc. |
| Primary Keyword | Text | Search term that found this job |
| Scraped At | Date | Apify scrape timestamp |
| **Status** | Select | raw_import, pending_enrichment, enriching, enriched, validated, error |
| **Priority Score** | Number | 0-100, triggers alerts |
| Enriched Program | Text | GPT-4o extracted program name |
| Enriched Agency | Text | GPT-4o extracted agency |
| Enriched Location | Text | GPT-4o normalized location |
| Enriched Clearance | Text | GPT-4o normalized clearance |
| Confidence | Number | 0-1, enrichment confidence |

---

### 5.4 Federal Programs

**Database URL:** https://www.notion.so/9db40fce078142b9902cd4b0263b1e23  
**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`  
**Records:** 388

| Property | Type | Notes |
|----------|------|-------|
| Program Name | Title | Full program name |
| Acronym | Text | Short name |
| Agency Owner | Text | DoD component |
| Prime Contractor | Text | |
| Known Subcontractors | Text | |
| Contract Value | Text | |
| Contract Vehicle/Type | Text | |
| PoP Start | Date | |
| PoP End | Date | |
| Key Locations | Text | |
| Clearance Requirements | Text | |
| Typical Roles | Text | |
| Keywords/Signals | Text | Job posting indicators |
| PTS Involvement | Select | Current, Past, Target, None |
| Priority Level | Select | High, Medium, Low |
| Pain Points | Text | Known staffing challenges |

---

### 5.5 Complete Collection ID Reference

| Database | Collection ID | Status |
|----------|---------------|--------|
| DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | ✅ ACTIVE |
| GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | ✅ ACTIVE |
| GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | ✅ ACTIVE |
| Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | ✅ ACTIVE |
| Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | ✅ ACTIVE |
| BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | ✅ ACTIVE |
| Contractors | `3a259041-22bf-4262-a94a-7d33467a1752` | ✅ ACTIVE |
| Contract Vehicles | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | ✅ ACTIVE |
| Enrichment Runs Log | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` | ✅ ACTIVE |
| Job Postings Database | `d92495a2-c753-48e3-9c2b-33c40ed21f06` | ⚠️ DEPRECATED |
| BD Targets - Insight Global | `9b9e7140-c13a-4c41-ae3a-0b926230d726` | ⚠️ DEPRECATED |

---

## 6. N8N WORKFLOWS

### N8N Instance
**URL:** https://primetech.app.n8n.cloud  
**Version:** 2.26.3

---

### 6.1 Apify Job Import Workflow

**Purpose:** Ingest scraped jobs from Apify into Program Mapping Hub

```
┌─────────────┐    ┌──────────────┐    ┌───────────────────┐
│   Webhook   │───▶│  Transform   │───▶│  Notion Create    │
│   Trigger   │    │  Job Data    │    │  (Program Hub)    │
└─────────────┘    └──────────────┘    └───────────────────┘
```

**Node Configuration:**

**1. Webhook Trigger**
- Method: POST
- Path: /apify-jobs
- Response: Immediately

**2. Transform Job Data (Code Node)**
```javascript
const items = $input.all();
return items.map(item => {
  const job = item.json;
  return {
    json: {
      title: job.title || '',
      url: job.url || '',
      company: job.company || 'Unknown',
      location: job.location || '',
      detected_clearance: job.detected_clearance || '',
      primary_keyword: job.primary_keyword || '',
      scraped_at: job.scraped_at || new Date().toISOString(),
      status: 'raw_import'
    }
  };
});
```

**3. Notion Create**
- Database ID: `f57792c1-605b-424c-8830-23ab41c47137`
- Properties:
  - Name: `{{$json.title}}`
  - URL: `{{$json.url}}`
  - Company: `{{$json.company}}`
  - Location: `{{$json.location}}`
  - Detected Clearance: `{{$json.detected_clearance}}`
  - Status: `raw_import`

---

### 6.2 Enrichment Processor Workflow

**Purpose:** Process pending jobs through GPT-4o for program mapping

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
│   Schedule  │───▶│ Notion Query │───▶│   GPT-4o    │───▶│Notion Update │
│  (15 min)   │    │(pending jobs)│    │  Enrichment │    │ (enriched)   │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────────┘
```

**Node Configuration:**

**1. Schedule Trigger**
- Interval: 15 minutes
- Active hours: 6am-10pm EST

**2. Notion Query**
- Database ID: `f57792c1-605b-424c-8830-23ab41c47137`
- Filter: `Status equals pending_enrichment`
- Limit: 10 (to manage API costs)

**3. GPT-4o Enrichment (HTTP Request)**
```json
{
  "model": "gpt-4o",
  "messages": [
    {
      "role": "system",
      "content": "You are a federal program analyst. Extract structured data from job postings. Return JSON only."
    },
    {
      "role": "user", 
      "content": "Extract from this job:\nTitle: {{$json.title}}\nLocation: {{$json.location}}\nCompany: {{$json.company}}\n\nReturn JSON with: program_name, agency, normalized_location, clearance_level, confidence (0-1)"
    }
  ]
}
```

**4. Notion Update**
- Page ID: `{{$json.id}}`
- Update:
  - Status: `enriched`
  - Enriched Program: `{{$json.program_name}}`
  - Enriched Agency: `{{$json.agency}}`
  - Confidence: `{{$json.confidence}}`

---

### 6.3 Priority Alert Notification

**Purpose:** Send Slack/Email alerts when hot leads identified

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐
│   Notion    │───▶│    Filter    │───▶│   Slack     │
│   Trigger   │    │  Score ≥ 80  │    │   Alert     │
└─────────────┘    └──────────────┘    └─────────────┘
```

**Priority Thresholds:**
- 🔥 Hot: Score ≥ 80 → Immediate Slack notification
- 🟡 Warm: Score 50-79 → Daily digest email
- ❄️ Cold: Score < 50 → No notification

---

### 6.4 Hub → BD Opportunities Pipeline (DESIGNED, NOT IMPLEMENTED)

**Purpose:** Move qualified leads from Hub to BD Opportunities

**Trigger Conditions:**
- Status = `validated`
- Priority Score ≥ 70
- Confidence ≥ 0.7

**Actions:**
1. Create page in BD Opportunities database
2. Copy enriched fields
3. Update Hub status to `promoted`
4. Send notification to BD team

---

## 7. APIFY ACTORS & SCRAPERS

### Actor: PuppeteerScraper
**Purpose:** Scrape competitor job boards for defense staffing positions

**Input Configuration:**
```json
{
  "startUrls": [
    { "url": "https://www.insightglobal.com/jobs/?keywords=DCGS" },
    { "url": "https://www.insightglobal.com/jobs/?keywords=TS/SCI" },
    { "url": "https://www.insightglobal.com/jobs/?keywords=clearance" }
  ],
  "pseudoUrls": [],
  "pageFunction": "... (see below)",
  "proxyConfiguration": { "useApifyProxy": true }
}
```

**Output Schema:**
```json
{
  "title": "string",
  "url": "string", 
  "company": "string",
  "location": "string",
  "detected_clearance": "string",
  "primary_keyword": "string",
  "scraped_at": "ISO 8601 datetime"
}
```

**Webhook Configuration:**
- URL: `https://primetech.app.n8n.cloud/webhook/apify-jobs`
- Events: Run succeeded
- Payload: Dataset items

**Rate Limiting:**
- Max concurrent pages: 5
- Request interval: 1-3 seconds random
- Daily run schedule: 6am, 12pm, 6pm EST

---

## 8. PROBLEMS SOLVED

### Problem 1: Maureen Shamaly Misidentification
**Description:** Playbooks listed Maureen Shamaly as "AF DCGS Site Lead at Langley" - a critical contact for the campaign.

**Root Cause:** 
- ZoomInfo showed: Hampton, VA location
- Job Title: "Program Manager, D"
- **Assumption made:** Hampton + GDIT + PM = DCGS Langley Site Lead

**Reality (LinkedIn Verification):**
- Actual Title: D. Program Manager, Global Freight Management
- Works REMOTELY from O'Fallon, Illinois
- Manages 38 software devs/QA/cloud devs on logistics IT program
- **NOT DCGS related at all**

**Solution:**
1. Remove from all DCGS call sheets
2. Update Notion record: Program = "Other GDIT Programs - Global Freight Management"
3. Implement mandatory LinkedIn verification for Critical/High contacts
4. Find actual AF DCGS Langley site lead (unknown)

---

### Problem 2: Kingsley Ero Title Inflation
**Description:** Claimed as "Acting Site Lead" for San Diego PACAF in HUMINT reports.

**Root Cause:** Speculation elevated to fact without verification.

**Reality (LinkedIn):**
- Actual Title: Security Analyst
- Tier 6 Individual Contributor, not leadership
- Note: LinkedIn shows "actively seeking opportunities"

**Solution:**
1. Correct hierarchy tier from Tier 3 to Tier 6
2. Treat as HUMINT source, not decision-maker
3. Note recruiting opportunity (actively seeking)

---

### Problem 3: Tara Stephenson Broken LinkedIn
**Description:** LinkedIn URL in database doesn't resolve.

**Root Cause:** Profile may have been deleted, URL changed, or incorrect URL captured.

**Solution:** Manual LinkedIn search required before outreach.

---

### Problem 4: Database Performance at Scale
**Description:** Original contact database (~2,000 records) was slow and hard to work with.

**Root Cause:** Notion performance degrades above ~1,000 records with complex views.

**Solution:** Split into DCGS Contacts Full (~965) and GDIT Other Contacts (~1,052).

---

### Problem 5: Multi-Source Database API Limitation
**Description:** Job Postings Database (deprecated) cannot be updated via API.

**Root Cause:** Notion multi-source databases have API write restrictions.

**Solution:** 
1. Mark as deprecated
2. Use manual Notion UI for any needed updates
3. Migrate active work to Program Mapping Hub

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate (Before Next Outreach)
- [ ] **REMOVE** Maureen Shamaly from all DCGS call lists
- [ ] **VERIFY** Kingsley Ero's functional role
- [ ] **FIND** correct LinkedIn for Tara Stephenson
- [ ] **UPDATE** Jeffrey Bartsch: Program = "Army DCGS-A"
- [ ] **FIND** real AF DCGS Langley site lead

### Short-Term (This Week)
- [ ] LinkedIn verify ALL Critical and High priority contacts
- [ ] Complete GDIT Jobs Program field mapping (~550 remaining)
- [ ] Implement Hub → BD Opportunities n8n workflow
- [ ] Begin outreach to verified San Diego PACAF contacts

### Medium-Term (This Month)
- [ ] Archive deprecated Job Postings Database
- [ ] Clean up Functional Area multi-select combinations
- [ ] Create Army DCGS-A playbook
- [ ] Create Navy DCGS-N playbook
- [ ] Establish weekly HUMINT update cadence

### Future Enhancements
- [ ] Automated LinkedIn profile verification integration
- [ ] Automated job expiration tracking
- [ ] SAM.gov contract notification integration
- [ ] Call outcome tracking in DCGS Contacts
- [ ] Dashboard generation for executive reporting

---

## 10. KEY INSIGHTS & GOTCHAS

### 🚨 CRITICAL GOTCHAS

#### 1. Never Trust ZoomInfo Location + Title Inference
ZoomInfo provides location data, but DOES NOT confirm what program someone works on. Hampton, VA could mean:
- AF DCGS Langley (what we assumed)
- Navy DCGS-N Norfolk (nearby)
- Any other GDIT program with remote workers
- Corporate staff working from home

**Always verify LinkedIn before outreach.**

#### 2. HUMINT Speculation ≠ Fact
When gathering intel from lower-tier contacts, their speculation about leadership roles should be noted as "unverified" until confirmed via LinkedIn or other sources.

#### 3. Notion Multi-Source Databases Are Read-Only via API
If a Notion database was created by linking multiple sources, it cannot be written to via the API. You must use the Notion UI for updates.

#### 4. San Diego PACAF Is Always Critical
Any contact at the San Diego site gets automatic 🔴 Critical priority due to:
- Small security team
- Limited resources
- Acting leadership situation
- Single points of failure

#### 5. The BD Formula Matters
Generic staffing outreach fails. Every message MUST include:
1. Personalized opener (their specific role/site)
2. Their pain points (from HUMINT)
3. Current labor gaps (from GDIT Jobs)
4. PTS past performance with GDIT
5. Relevant program experience
6. Title-specific capabilities

#### 6. Lower Tiers First, Then Executives
Never cold-call Tier 1-2 executives. Build intel from Tier 5-6 ICs, validate with Tier 4 managers, THEN approach Tier 3 PMs, and finally Tier 1-2 with insider knowledge.

---

### 💡 KEY INSIGHTS

#### 1. Competitor Job Postings = BD Signals
When Insight Global or TEKsystems posts a DCGS-related job, that's a signal of:
- Active hiring need
- Budget availability
- Potential staffing gap where PTS can help

#### 2. PTS Verified Past Performance with GDIT
These programs are confirmed and can be referenced in outreach:
- **BICES/BICES-X:** TS/SCI network engineers & analysts
- **GSM-O II:** Network engineers for 24/7 DISA operations
- **NATO BICES:** Coalition intel network analysts

#### 3. DCGS Contract Values Are Estimates
The $500M/$300M/$150M figures are BD intelligence estimates, not verified FPDS data. Preface with "estimated" in formal materials.

#### 4. Database Performance Sweet Spot
Keep operational databases under 1,000 records. Split by program or function if growing larger.

#### 5. Status State Machine Enables Automation
The `raw_import → pending_enrichment → enriching → enriched → validated → error` flow enables:
- Clear handoffs between automation steps
- Error isolation
- Progress tracking
- Quality gates

---

## APPENDIX A: Files Created in This Project

| Filename | Type | Purpose |
|----------|------|---------|
| `BD_Intelligence_System_Handoff_Document.docx` | DOCX | Comprehensive system documentation |
| `N8N_Project_Handoff_From_DCGS_Campaign.md` | MD | N8N-specific handoff for workflow development |
| `DCGS_BD_Materials_Accuracy_Audit.docx` | DOCX | 87% accuracy assessment |
| `GDIT_Program_Location_Hints_Comprehensive.xlsx` | XLSX | 4-sheet location mapping guide |
| `DCGS_BD_Call_Sheet.xlsx` | XLSX | Prioritized contact call sheet |
| `DCGS_BD_Call_Sheet_Job_Driven.xlsx` | XLSX | Call sheet organized by open jobs |
| `DCGS_BD_Call_Sheet_BLITZ_20250105.xlsx` | XLSX | Blitz campaign call sheet |
| `DCGS_BD_Playbook_Complete.docx` | DOCX | Master BD strategy document |
| `AF_DCGS_BD_HUMINT_Playbook.docx` | DOCX | AF DCGS-specific playbook |
| `DCGS_Interactive_Org_Chart_Full.html` | HTML | D3.js visualization (2,016 contacts) |
| `Job_Scrape_Maximum_Enrichment.xlsx` | XLSX | Enriched job analysis |

---

## APPENDIX B: Contact Verification Status

| Contact | Claimed Role | Verified Role | Status |
|---------|--------------|---------------|--------|
| Maureen Shamaly | AF DCGS Langley Site Lead | Global Freight Management PM | ❌ INCORRECT |
| Kingsley Ero | Acting Site Lead, San Diego | Security Analyst | ⚠️ DEMOTE |
| Tara Stephenson | Network Analyst, San Diego | UNKNOWN - LinkedIn broken | ⚠️ NEEDS VERIFICATION |
| Craig Lindahl | Sr. Program Manager, Wright-Patt | ✅ VERIFIED | ✅ ACCURATE |
| Jeffrey Bartsch | Ops Manager, DCGS-A | ✅ VERIFIED | ✅ ACCURATE |
| David Winkelman | VP, Defense Intelligence | ✅ VERIFIED | ✅ ACCURATE |

---

## APPENDIX C: Quick Reference Card

### MCP Tool Commands

**Search DCGS Contacts:**
```
notion-search: query="DCGS Langley"
data_source_url="collection://2ccdef65-baa5-8087-a53b-000ba596128e"
```

**Update Contact Classification:**
```
notion-update-page: page_id="[PAGE_ID]"
properties={
  "Program": "AF DCGS - Langley",
  "Hierarchy Tier": "Tier 3 - Program Leadership",
  "BD Priority": "🟠 High",
  "Location Hub": "Hampton Roads"
}
```

**Search Federal Programs:**
```
notion-search: query="GDIT Prime DCGS"
data_source_url="collection://06cd9b22-5d6b-4d37-b0d3-ba99da4971fa"
```

### Priority Scoring Quick Reference
| Condition | Priority |
|-----------|----------|
| Tier 1-2 (Executive/Director) | 🔴 Critical |
| Any tier at AF DCGS - PACAF | 🔴 Critical |
| Tier 3 (Program Leadership) | 🟠 High |
| Tier 4 (Management) | 🟡 Medium |
| Tier 5-6 (Senior IC / IC) | ⚪ Standard |

### Hot Lead Thresholds
| Score | Classification | Action |
|-------|----------------|--------|
| ≥ 80 | 🔥 Hot | Immediate outreach |
| 50-79 | 🟡 Warm | Queue for next cycle |
| < 50 | ❄️ Cold | Background tracking |

---

*End of Export Document*

**Generated:** January 10, 2025  
**Project:** PTS DCGS Business Development Campaign  
**Total Conversation Sessions:** 13+ (Dec 17, 2024 - Jan 10, 2025)
