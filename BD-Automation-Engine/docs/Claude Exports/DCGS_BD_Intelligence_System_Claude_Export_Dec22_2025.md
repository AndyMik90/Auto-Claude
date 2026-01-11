# DCGS_BD_Intelligence_System_Claude_Export_Dec22_2025.md

# PTS DCGS Business Development Intelligence System
## Complete Claude Session Export

**Export Date:** December 22, 2025  
**Project:** PTS DCGS Business Development Campaign  
**Claude Instance:** Claude.ai with Notion MCP, n8n MCP  
**Repository Target:** BD Intelligence System Codebase

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
- Job Scraper Data Enrichment
- Notion Database Integration
- DCGS Program Mapping (Air Force, Army, Navy)
- Contact Classification & Verification
- n8n Workflow Architecture
- BD Intelligence Pipeline Design

### Date Range
December 17-22, 2025 (primary sessions Dec 19-22)

### Primary Objective
Transform scraped competitor job postings into actionable BD intelligence by:
1. Enriching raw job data with program/contract information
2. Mapping jobs to federal programs and prime contractors
3. Classifying 2,000+ contacts by tier, program, and BD priority
4. Creating outreach materials (call sheets, playbooks, org charts)
5. Designing automated n8n workflows for the enrichment pipeline

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Database Split at 1,000 Records
- **Decision:** Split large contact database (2,000+) into DCGS-specific (965) and Other (1,052)
- **Reasoning:** Notion performance degraded significantly with large databases causing query timeouts
- **Alternatives Considered:** 
  - Single database with views (rejected - performance issues persisted)
  - Archive old contacts (rejected - need historical data)

### Decision 2: AF DCGS - Target GDIT as Staffing Vendor
- **Decision:** For AF DCGS (where BAE is prime), target GDIT as a staffing vendor, NOT sub-to-sub
- **Reasoning:** GDIT controls its own staffing pipeline separately from BAE prime contract procurement. PTS competes with Insight Global/TEKsystems, not as a sub-to-sub arrangement.
- **Alternatives Considered:**
  - Target BAE directly (rejected - they route staffing to GDIT anyway)
  - Sub-to-sub through GDIT (rejected - contractually prohibited)

### Decision 3: Mandatory LinkedIn Verification
- **Decision:** Require LinkedIn verification before outreach execution
- **Reasoning:** Maureen Shamaly case revealed ZoomInfo data quality issues - she was completely misclassified (wrong program, wrong location)
- **Alternatives Considered:**
  - Trust ZoomInfo data (rejected - proven unreliable)
  - Email verification only (rejected - doesn't confirm role/program)

### Decision 4: 5-Property Contact Classification Schema
- **Decision:** Add 5 new properties to DCGS Contacts database
- **Reasoning:** Enable multi-dimensional filtering and automated priority assignment
- **Properties:** Program, Hierarchy Tier, Location Hub, BD Priority, Functional Area

### Decision 5: Hub-and-Spoke Data Architecture
- **Decision:** Use Program Mapping Hub as central enrichment database with relations to reference databases
- **Reasoning:** Enables single point of enrichment with lookups to Federal Programs, Contractors, etc.
- **Alternatives Considered:**
  - Flat denormalized structure (rejected - data duplication issues)
  - Complex multi-hop relations (rejected - performance concerns)

### Decision 6: Two-Stage Job Enrichment
- **Decision:** Lightweight location/keyword matching first, GPT-4o for unmatched jobs
- **Reasoning:** 79% cost savings by only using AI for ambiguous cases
- **Alternatives Considered:**
  - AI-only enrichment (rejected - expensive and unnecessary for obvious matches)
  - Manual enrichment (rejected - doesn't scale)

---

## 3. ARCHITECTURE & DATA FLOW

### System Architecture
```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PTS BD INTELLIGENCE SYSTEM                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐            │
│  │ Insight      │     │ TEKsystems   │     │ ClearanceJobs│            │
│  │ Global       │     │ Job Board    │     │ Job Board    │            │
│  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘            │
│         │                    │                    │                     │
│         └────────────────────┼────────────────────┘                     │
│                              ▼                                          │
│                    ┌──────────────────┐                                 │
│                    │  Apify Puppeteer │                                 │
│                    │  Scraper         │                                 │
│                    └────────┬─────────┘                                 │
│                             │ Webhook                                   │
│                             ▼                                           │
│                    ┌──────────────────┐                                 │
│                    │  n8n Workflow    │                                 │
│                    │  (Import)        │                                 │
│                    └────────┬─────────┘                                 │
│                             │ Status: raw_import                        │
│                             ▼                                           │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                   NOTION DATABASE LAYER                           │  │
│  │                                                                   │  │
│  │   ┌─────────────────────────────────────────────────────────┐    │  │
│  │   │           🧭 PROGRAM MAPPING HUB (Central)               │    │  │
│  │   │   Collection: f57792c1-605b-424c-8830-23ab41c47137      │    │  │
│  │   │   Status: raw→pending→enriching→enriched→validated      │    │  │
│  │   └──────────────────────┬──────────────────────────────────┘    │  │
│  │                          │                                       │  │
│  │         ┌────────────────┼────────────────┐                      │  │
│  │         ▼                ▼                ▼                      │  │
│  │   ┌───────────┐   ┌───────────┐   ┌───────────┐                 │  │
│  │   │ Federal   │   │Contractors│   │ Contract  │                 │  │
│  │   │ Programs  │   │ Database  │   │ Vehicles  │                 │  │
│  │   │ (388)     │   │           │   │           │                 │  │
│  │   └───────────┘   └───────────┘   └───────────┘                 │  │
│  │                                                                   │  │
│  │   ┌───────────┐   ┌───────────┐   ┌───────────┐                 │  │
│  │   │ DCGS      │   │ GDIT      │   │ BD        │                 │  │
│  │   │ Contacts  │   │ Jobs      │   │Opportunities│               │  │
│  │   │ (965)     │   │ (700)     │   │           │                 │  │
│  │   └───────────┘   └───────────┘   └───────────┘                 │  │
│  │                                                                   │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                             │                                           │
│                             ▼                                           │
│                    ┌──────────────────┐                                 │
│                    │  n8n Workflow    │                                 │
│                    │  (Alerts)        │                                 │
│                    └────────┬─────────┘                                 │
│                             │ Score ≥ 80                                │
│                             ▼                                           │
│                    ┌──────────────────┐                                 │
│                    │  Slack / Email   │                                 │
│                    │  Notifications   │                                 │
│                    └──────────────────┘                                 │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Sequence
```
1. Apify Scraper → Raw job JSON (title, company, location, clearance, url)
2. Webhook → n8n Import Workflow
3. n8n → Create Notion record in Program Mapping Hub (Status: raw_import)
4. Schedule → n8n Enrichment Workflow triggers
5. Enrichment:
   a. Location matching → LOCATION_TO_PROGRAM table
   b. Title keyword matching → PROGRAM_KEYWORDS table
   c. If no match → GPT-4o API call for extraction
6. Update record: Program, Prime, Score, Confidence (Status: enriched)
7. Manual validation → Status: validated
8. If Score ≥ 70 + Confidence ≥ 0.7 → Create BD Opportunity record
9. If Score ≥ 80 → Trigger alert notification
```

### API Connections
| Service | Endpoint | Purpose |
|---------|----------|---------|
| Notion | https://api.notion.com/v1/ | Database CRUD operations |
| Apify | apify_api_n32KFOBo74tTXNi1nEH8nuaMMgrmRc15XrzS | Job scraping |
| OpenAI | GPT-4o | Job enrichment extraction |
| n8n MCP | https://primetech.app.n8n.cloud/mcp-server/http | Workflow automation |
| Notion MCP | Claude.ai native | Database operations from chat |

---

## 4. CODE & CONFIGURATIONS

### 4.1 Location-to-Program Mapping (Python)

```python
# File: location_program_mapping.py
# Purpose: Map job locations to likely federal programs

LOCATION_TO_PROGRAM = {
    # AF DCGS - Langley (DGS-1)
    'Hampton': 'AF DCGS - Langley',
    'Newport News': 'AF DCGS - Langley',
    'Langley': 'AF DCGS - Langley',
    'Yorktown': 'AF DCGS - Langley',
    'Virginia Beach': 'AF DCGS - Langley',
    'Portsmouth': 'AF DCGS - Langley',
    
    # AF DCGS - PACAF (San Diego) 🔥 CRITICAL
    'San Diego': 'AF DCGS - PACAF',
    'La Mesa': 'AF DCGS - PACAF',
    
    # AF DCGS - Wright-Patterson
    'Dayton': 'AF DCGS - Wright-Patt',
    'Beavercreek': 'AF DCGS - Wright-Patt',
    'Fairborn': 'AF DCGS - Wright-Patt',
    'Kettering': 'AF DCGS - Wright-Patt',
    
    # Navy DCGS-N
    'Norfolk': 'Navy DCGS-N',
    'Suffolk': 'Navy DCGS-N',
    'Chesapeake': 'Navy DCGS-N',
    'Tracy': 'Navy DCGS-N',
    
    # Army DCGS-A
    'Fort Belvoir': 'Army DCGS-A',
    'Fort Detrick': 'Army DCGS-A',
    'Aberdeen': 'Army DCGS-A',
    
    # Corporate HQ
    'Herndon': 'Corporate HQ',
    'Falls Church': 'Corporate HQ',
    'Reston': 'Corporate HQ',
    'Fairfax': 'Corporate HQ',
    'Chantilly': 'Corporate HQ',
    'McLean': 'Corporate HQ',
    
    # Other Major Programs
    'Montgomery': 'GSM-O II',  # DISA
    'Huntsville': 'Missile Defense',  # Army MDA
    'Colorado Springs': 'Space Force',  # USSF
    'Tampa': 'CENTCOM / SOCOM',
    'Fort Meade': 'NSA / Cyber Command',
    'Fort Liberty': 'INSCOM / JSOC',
}

LOCATION_HUB_MAPPING = {
    'Hampton': 'Hampton Roads',
    'Newport News': 'Hampton Roads',
    'Langley': 'Hampton Roads',
    'Norfolk': 'Hampton Roads',
    'Suffolk': 'Hampton Roads',
    'Chesapeake': 'Hampton Roads',
    'Virginia Beach': 'Hampton Roads',
    'San Diego': 'San Diego Metro',
    'La Mesa': 'San Diego Metro',
    'Herndon': 'DC Metro',
    'Falls Church': 'DC Metro',
    'Reston': 'DC Metro',
    'Fairfax': 'DC Metro',
    'Chantilly': 'DC Metro',
    'McLean': 'DC Metro',
    'Arlington': 'DC Metro',
    'Dayton': 'Dayton/Wright-Patt',
    'Beavercreek': 'Dayton/Wright-Patt',
    'Fairborn': 'Dayton/Wright-Patt',
    'Kettering': 'Dayton/Wright-Patt',
}
```

### 4.2 Hierarchy Tier Classification (Python)

```python
# File: contact_classification.py
# Purpose: Classify contacts by organizational tier

def get_hierarchy_tier(title: str) -> str:
    """
    Classify a contact's hierarchy tier based on job title.
    Returns one of 6 tier values for Notion select field.
    """
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


def get_bd_priority(hierarchy_tier: str, program: str = None) -> str:
    """
    Calculate BD priority based on tier and program.
    Returns emoji-prefixed priority for Notion select field.
    """
    # Critical: Executives + PACAF site (understaffed, high priority)
    if hierarchy_tier in ['Tier 1 - Executive', 'Tier 2 - Director']:
        return '🔴 Critical'
    if program == 'AF DCGS - PACAF':
        return '🔴 Critical'
    
    # High: Program Managers and Site Leads
    if hierarchy_tier == 'Tier 3 - Program Leadership':
        return '🟠 High'
    
    # Medium: Managers
    if hierarchy_tier == 'Tier 4 - Management':
        return '🟡 Medium'
    
    # Standard: ICs (relationship building tier)
    return '⚪ Standard'


def get_functional_area(title: str) -> list:
    """
    Extract functional areas from job title.
    Returns list of multi-select values for Notion.
    """
    title_lower = title.lower()
    areas = []
    
    mappings = {
        'Program Management': ['program manager', 'project manager', 'pm ', 'pmo'],
        'Network Engineering': ['network', 'cisco', 'routing', 'switching', 'wan', 'lan'],
        'Cyber Security': ['cyber', 'security', 'soc', 'siem', 'incident response', 'vulnerability'],
        'ISR/Intelligence': ['intelligence', 'isr', 'geoint', 'sigint', 'humint', 'analyst'],
        'Systems Administration': ['sysadmin', 'system admin', 'systems engineer', 'linux', 'windows server'],
        'Software Engineering': ['software', 'developer', 'programmer', 'devsecops', 'devops'],
        'Field Service': ['field service', 'field engineer', 'on-site', 'depot'],
        'Security/FSO': ['fso', 'facility security', 'security officer', 'clearance'],
        'Business Development': ['business development', 'bd ', 'capture', 'proposal'],
        'Training': ['trainer', 'instructor', 'training'],
        'Administrative': ['admin', 'coordinator', 'assistant', 'scheduler'],
    }
    
    for area, keywords in mappings.items():
        if any(kw in title_lower for kw in keywords):
            areas.append(area)
    
    return areas if areas else ['Administrative']
```

### 4.3 Job Enrichment Script (Python)

```python
# File: job_enrichment.py
# Purpose: Enrich raw job postings with program intelligence

import pandas as pd
from location_program_mapping import LOCATION_TO_PROGRAM
from contact_classification import get_bd_priority

# Program keyword patterns for title-based matching
PROGRAM_KEYWORDS = {
    'DCGS': ['dcgs', 'distributed common ground', 'dgs-', 'isr analyst'],
    'BICES': ['bices', 'coalition', 'battlefield information'],
    'GSM-O': ['gsm-o', 'gsmo', 'global service management'],
    'INSCOM': ['inscom', 'army intelligence'],
    'CENTCOM': ['centcom', 'central command'],
    'SOCOM': ['socom', 'special operations'],
    'DISA': ['disa', 'defense information systems'],
    'NSA': ['nsa', 'national security agency', 'ft meade', 'fort meade'],
    'Missile Defense': ['mda', 'missile defense', 'gmd', 'aegis', 'thaad', 'ibcs'],
    'Space Force': ['space force', 'ussf', 'sbirs', 'gps ocx', 'satellite'],
}

def enrich_job(job: dict) -> dict:
    """
    Enrich a raw job posting with program intelligence.
    
    Input: {title, company, location, clearance, url}
    Output: {+ program, prime_contractor, bd_priority, confidence, source}
    """
    enriched = job.copy()
    
    # Step 1: Location-based program matching
    city = job.get('location', '').split(',')[0].strip()
    if city in LOCATION_TO_PROGRAM:
        enriched['program'] = LOCATION_TO_PROGRAM[city]
        enriched['confidence'] = 0.8
        enriched['enrichment_source'] = 'Location Match'
    else:
        enriched['program'] = 'Unknown'
        enriched['confidence'] = 0.0
        enriched['enrichment_source'] = 'None'
    
    # Step 2: Title keyword matching (can override or increase confidence)
    title_lower = job.get('title', '').lower()
    for program, keywords in PROGRAM_KEYWORDS.items():
        if any(kw in title_lower for kw in keywords):
            if enriched['program'] == 'Unknown':
                enriched['program'] = program
                enriched['confidence'] = 0.7
                enriched['enrichment_source'] = 'Keyword Match'
            elif program in enriched['program']:
                enriched['confidence'] = min(1.0, enriched['confidence'] + 0.15)
    
    # Step 3: Calculate BD Priority
    clearance = job.get('clearance', '').lower()
    if 'ts/sci' in clearance or 'top secret' in clearance:
        enriched['bd_priority'] = '🟠 High'
    elif enriched['program'] in ['AF DCGS - PACAF']:
        enriched['bd_priority'] = '🔴 Critical'
    elif enriched['confidence'] >= 0.7:
        enriched['bd_priority'] = '🟡 Medium'
    else:
        enriched['bd_priority'] = '⚪ Standard'
    
    # Step 4: Set prime contractor based on program
    PROGRAM_TO_PRIME = {
        'AF DCGS - PACAF': 'BAE Systems (GDIT staffing)',
        'AF DCGS - Langley': 'BAE Systems (GDIT staffing)',
        'AF DCGS - Wright-Patt': 'BAE Systems (GDIT staffing)',
        'Army DCGS-A': 'GDIT',
        'Navy DCGS-N': 'GDIT',
        'GSM-O II': 'Leidos',
        'BICES': 'GDIT',
        'Missile Defense': 'Northrop Grumman / Dynetics',
        'Space Force': 'Multiple (Raytheon, Lockheed, Northrop)',
        'INSCOM': 'GDIT / Leidos',
        'CENTCOM / SOCOM': 'Multiple',
    }
    enriched['prime_contractor'] = PROGRAM_TO_PRIME.get(
        enriched['program'], 'Unknown'
    )
    
    return enriched


def process_job_scrape(input_file: str, output_file: str):
    """Process entire job scrape file."""
    df = pd.read_csv(input_file)
    
    enriched_jobs = []
    for _, row in df.iterrows():
        job = row.to_dict()
        enriched = enrich_job(job)
        enriched_jobs.append(enriched)
    
    result_df = pd.DataFrame(enriched_jobs)
    result_df.to_excel(output_file, index=False)
    
    return result_df
```

### 4.4 Notion Schema Update (JSON)

```json
{
  "database_id": "2ccdef65baa580d09b66c67d66e7a54d",
  "properties": {
    "Program": {
      "type": "select",
      "select": {
        "options": [
          {"name": "AF DCGS - Langley", "color": "blue"},
          {"name": "AF DCGS - Wright-Patt", "color": "blue"},
          {"name": "AF DCGS - PACAF", "color": "blue"},
          {"name": "AF DCGS - Other", "color": "blue"},
          {"name": "Army DCGS-A", "color": "green"},
          {"name": "Navy DCGS-N", "color": "default"},
          {"name": "Corporate HQ", "color": "gray"},
          {"name": "Enterprise Security", "color": "purple"},
          {"name": "Unassigned", "color": "default"}
        ]
      }
    },
    "BD Priority": {
      "type": "select",
      "select": {
        "options": [
          {"name": "🔴 Critical", "color": "red"},
          {"name": "🟠 High", "color": "orange"},
          {"name": "🟡 Medium", "color": "yellow"},
          {"name": "⚪ Standard", "color": "gray"}
        ]
      }
    },
    "Location Hub": {
      "type": "select",
      "select": {
        "options": [
          {"name": "Hampton Roads", "color": "blue"},
          {"name": "San Diego Metro", "color": "yellow"},
          {"name": "DC Metro", "color": "purple"},
          {"name": "Dayton/Wright-Patt", "color": "green"},
          {"name": "Other CONUS", "color": "gray"},
          {"name": "OCONUS", "color": "orange"},
          {"name": "Unknown", "color": "default"}
        ]
      }
    },
    "Hierarchy Tier": {
      "type": "select",
      "select": {
        "options": [
          {"name": "Tier 1 - Executive", "color": "red"},
          {"name": "Tier 2 - Director", "color": "orange"},
          {"name": "Tier 3 - Program Leadership", "color": "yellow"},
          {"name": "Tier 4 - Management", "color": "green"},
          {"name": "Tier 5 - Senior IC", "color": "blue"},
          {"name": "Tier 6 - Individual Contributor", "color": "gray"}
        ]
      }
    },
    "Functional Area": {
      "type": "multi_select",
      "multi_select": {
        "options": [
          {"name": "Program Management", "color": "blue"},
          {"name": "Network Engineering", "color": "green"},
          {"name": "Cyber Security", "color": "red"},
          {"name": "ISR/Intelligence", "color": "purple"},
          {"name": "Systems Administration", "color": "gray"},
          {"name": "Software Engineering", "color": "yellow"},
          {"name": "Field Service", "color": "orange"},
          {"name": "Security/FSO", "color": "pink"},
          {"name": "Business Development", "color": "blue"},
          {"name": "Training", "color": "green"},
          {"name": "Administrative", "color": "default"}
        ]
      }
    }
  }
}
```

### 4.5 GPT-4o Enrichment Prompt

```markdown
# Job-to-Program Mapping Prompt

You are a federal contracting intelligence analyst. Given a job posting from a defense staffing firm, extract program information.

## Input
- Job Title: {title}
- Location: {location}
- Company: {company}  
- Clearance: {clearance}
- Job URL: {url}

## Task
Analyze the job posting and extract:
1. **Federal Program Name** - The likely DoD/IC program this job supports
2. **Prime Contractor** - The company holding the prime contract
3. **Agency** - Government agency (DoD, DHS, IC, etc.)
4. **Task Order/Team** - Specific task order if identifiable
5. **Confidence Score** - 0.0 to 1.0 based on evidence quality

## Response Format
Respond ONLY with valid JSON:
```json
{
  "program_name": "string",
  "prime_contractor": "string", 
  "agency": "string",
  "task_order": "string or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation"
}
```

## Key Program Indicators
- Location + Clearance often indicates program
- DCGS = Distributed Common Ground System (ISR processing)
- GSM-O = DISA Global Service Management
- BICES = Battlefield Information Collection and Exploitation Systems
- Huntsville, AL + TS/SCI = likely Missile Defense Agency
- Tampa, FL = likely CENTCOM or SOCOM
- Montgomery, AL = likely DISA Maxwell AFB
```

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 DCGS Contacts Full
**Database ID:** `2ccdef65baa580d09b66c67d66e7a54d`  
**Collection ID:** `2ccdef65-baa5-8087-a53b-000ba596128e`  
**Records:** ~965

| Property | Type | Options/Notes |
|----------|------|---------------|
| Name | Title | Full name |
| First Name | Text | Imported from CSV |
| Last Name | Text | Imported from CSV |
| Job Title | Text | Current role |
| Email Address | Email | Primary email |
| Phone Number | Phone | Office phone |
| Direct Phone Number | Phone | Direct dial |
| Mobile phone | Phone | Cell |
| Person City | Text | Location city |
| Person State | Text | Location state |
| LinkedIn Contact Profile URL | URL | LinkedIn profile |
| **Program** | Select | AF DCGS-Langley, AF DCGS-Wright-Patt, AF DCGS-PACAF, AF DCGS-Other, Army DCGS-A, Navy DCGS-N, Corporate HQ, Enterprise Security, Unassigned |
| **Hierarchy Tier** | Select | Tier 1-6 with colors |
| **Location Hub** | Select | Hampton Roads, San Diego Metro, DC Metro, etc. |
| **BD Priority** | Select | 🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard |
| **Functional Area** | Multi-Select | 11 functional areas |

### 5.2 Program Mapping Intelligence Hub
**Database ID:** (from URL)  
**Collection ID:** `f57792c1-605b-424c-8830-23ab41c47137`

| Property | Type | Notes |
|----------|------|-------|
| Job Title | Title | From scrape |
| Source URL | URL | Original job posting |
| Location | Text | City, State |
| Clearance Level | Select | Public Trust, Secret, TS, TS/SCI, TS/SCI w/Poly |
| Staffing Company | Select | Insight Global, TEKsystems, etc. |
| **Status** | Select | raw_import, pending_enrichment, enriching, enriched, validated, error |
| **Program** | Relation | → Federal Programs |
| **Prime Contractor** | Relation | → Contractors |
| **BD Priority Score** | Number | 0-100 |
| **Confidence** | Number | 0.0-1.0 |
| Enrichment Source | Select | Location Match, Keyword Match, GPT-4o, Manual |
| Import Date | Date | Scrape timestamp |
| Validated Date | Date | Manual validation |
| Validated By | Text | User who validated |

### 5.3 Federal Programs
**Database ID:** `9db40fce-0781-42b9-902c-d4b0263b1e23`  
**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`  
**Records:** 388

| Property | Type | Notes |
|----------|------|-------|
| Program Name | Title | Official program name |
| Acronym | Text | Short name |
| Agency Owner | Select | DoD, DHS, IC, etc. |
| Prime Contractor | Relation | → Contractors |
| Known Subcontractors | Text | Sub list |
| Contract Value | Text | Estimated value |
| Contract Vehicle/Type | Select | IDIQ, BPA, etc. |
| PoP Start | Date | Period of performance |
| PoP End | Date | |
| Key Locations | Multi-Select | Bases/sites |
| Clearance Requirements | Select | |
| Typical Roles | Multi-Select | |
| PTS Involvement | Select | Current, Past, Target, None |
| Priority Level | Select | High, Medium, Low |
| Pain Points | Text | Known issues |

### 5.4 GDIT Jobs
**Database ID:** (from URL)  
**Collection ID:** `2ccdef65-baa5-80b0-9a80-000bd2745f63`  
**Records:** ~700

| Property | Type | Notes |
|----------|------|-------|
| Job Title | Title | Position name |
| Date Added | Date | |
| Owner | Text | Bullhorn owner |
| Contact | Text | Hiring contact |
| Employment Type | Select | Contract, FTE, C2H |
| Open/Closed | Select | Status |
| Status | Select | Active, Filled, Cancelled |
| Pay Rate | Text | Contractor rate |
| Client Bill Rate | Text | Client pays |
| Salary | Text | If FTE |
| **Program** | Select | 22 program options added |

---

## 6. N8N WORKFLOWS

### 6.1 Apify Job Import Workflow
**Workflow ID:** Part of jYihwcJ5BG04QKVC  
**Trigger:** Webhook from Apify actor completion

```
Node Sequence:
1. Webhook Trigger (POST /webhook/apify-jobs)
   ├── Receives: { items: [{title, company, location, clearance, url}] }
   
2. Loop Over Items
   ├── For each job in items array
   
3. Notion Create Page
   ├── Database: Program Mapping Hub (f57792c1-605b-424c-8830-23ab41c47137)
   ├── Properties:
   │   ├── Job Title: {{ $json.title }}
   │   ├── Location: {{ $json.location }}
   │   ├── Clearance Level: {{ $json.detected_clearance }}
   │   ├── Source URL: {{ $json.url }}
   │   ├── Staffing Company: {{ $json.company }}
   │   ├── Status: "raw_import"
   │   └── Import Date: {{ $now }}
   
4. Set Variable (count imported)

5. Respond to Webhook
   ├── { success: true, imported: count }
```

### 6.2 Enrichment Processor Workflow
**Trigger:** Schedule (every 15 minutes)

```
Node Sequence:
1. Schedule Trigger (*/15 * * * *)

2. Notion Query
   ├── Database: Program Mapping Hub
   ├── Filter: Status = "pending_enrichment"
   ├── Limit: 20

3. IF (has results)
   ├── True → Continue
   └── False → Stop

4. Loop Over Jobs

5. Location Matcher (Code Node)
   ├── Input: job.location
   ├── Logic: LOCATION_TO_PROGRAM lookup
   ├── Output: program, confidence

6. IF (confidence < 0.7)
   ├── True → OpenAI Node (GPT-4o)
   │   ├── Prompt: Job enrichment prompt
   │   ├── Parse JSON response
   └── False → Skip AI

7. Calculate BD Score (Code Node)
   ├── Factors: clearance, location, program match, recency
   ├── Output: score 0-100

8. Notion Update Page
   ├── Properties:
   │   ├── Program: enriched_program
   │   ├── Prime Contractor: enriched_prime
   │   ├── BD Priority Score: score
   │   ├── Confidence: confidence
   │   ├── Enrichment Source: source
   │   └── Status: "enriched"

9. IF (score >= 80)
   └── True → Slack Notification
       ├── Channel: #bd-alerts
       ├── Message: "🔥 Hot Lead: {title} at {location}"
```

### 6.3 Hub → BD Opportunities Pipeline (DESIGNED)
**Status:** Needs Implementation

```
Node Sequence:
1. Trigger: Notion Database Trigger (Property Changed)
   ├── Database: Program Mapping Hub
   ├── Property: Status
   ├── Value: "validated"

2. Filter Node
   ├── Conditions:
   │   ├── BD Priority Score >= 70
   │   └── Confidence >= 0.7

3. Notion Query (Federal Programs)
   ├── Filter: PTS Involvement != "Current"
   ├── Match: Program name

4. IF (not duplicate)
   ├── Check: BD Opportunities for existing record

5. Notion Create Page
   ├── Database: BD Opportunities (2bcdef65-baa5-80ed-bd95-000b2f898e17)
   ├── Properties:
   │   ├── Opportunity Name: {{ job_title }} - {{ program }}
   │   ├── Program: relation to Federal Programs
   │   ├── Source Job: relation to Hub record
   │   ├── Prime Contractor: from lookup
   │   ├── Estimated Value: from program
   │   ├── Priority: based on score
   │   └── Created Date: now

6. Slack Notification
   ├── "New BD Opportunity Created: {name}"
```

---

## 7. APIFY ACTORS & SCRAPERS

### 7.1 Insight Global Puppeteer Scraper
**Actor:** apify/puppeteer-scraper  
**Schedule:** Daily at 6 AM EST

**Input Configuration:**
```json
{
  "startUrls": [
    {"url": "https://insightglobal.com/jobs/?keywords=&locations=&clearance=secret"},
    {"url": "https://insightglobal.com/jobs/?keywords=&locations=&clearance=top-secret"},
    {"url": "https://insightglobal.com/jobs/?keywords=&locations=&clearance=ts-sci"}
  ],
  "linkSelector": "a.job-card-link",
  "pageFunction": "async function pageFunction(context) { /* see below */ }",
  "maxRequestsPerCrawl": 500,
  "maxConcurrency": 5,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

**Page Function:**
```javascript
async function pageFunction(context) {
    const { page, request } = context;
    
    // Wait for job cards to load
    await page.waitForSelector('.job-card', { timeout: 10000 });
    
    // Extract job data
    const jobs = await page.evaluate(() => {
        const cards = document.querySelectorAll('.job-card');
        return Array.from(cards).map(card => ({
            title: card.querySelector('.job-title')?.textContent?.trim(),
            company: 'Insight Global',
            location: card.querySelector('.job-location')?.textContent?.trim(),
            clearance: card.querySelector('.clearance-badge')?.textContent?.trim() || 'Unknown',
            url: card.querySelector('a')?.href,
            scraped_at: new Date().toISOString()
        }));
    });
    
    return jobs;
}
```

**Output Schema:**
```json
{
  "title": "string",
  "company": "string (always 'Insight Global')",
  "location": "string (City, State format)",
  "detected_clearance": "string",
  "url": "string (job posting URL)",
  "scraped_at": "ISO datetime",
  "primary_keyword": "string (search term used)"
}
```

**Webhook Configuration:**
- **URL:** https://primetech.app.n8n.cloud/webhook/apify-jobs
- **Event:** Actor run succeeded
- **Payload:** Full dataset JSON

---

## 8. PROBLEMS SOLVED

### Problem 1: Maureen Shamaly Misclassification
**Description:** Contact was listed as "AF DCGS Site Lead at Langley" but actually works on a completely different program (Global Freight Management) remotely from Illinois.

**Root Cause:** ZoomInfo scraped her Hampton Roads address from a previous role. Someone assumed Hampton = Langley AFB = DCGS without verification.

**Solution:** 
1. Removed her from AF DCGS call list
2. Added "Verified" status field to database
3. Established mandatory LinkedIn verification before outreach
4. Created verification checklist for high-priority contacts

### Problem 2: Database Performance Degradation
**Description:** 2,000+ record contact database caused 5-10 second query times and occasional timeouts.

**Root Cause:** Notion performance limits on large databases with multiple views and filters.

**Solution:**
1. Split into DCGS-specific (965) and Other (1,052) databases
2. Established guideline: plan database splits at ~1,000 records
3. Documented in architecture as best practice

### Problem 3: Select Field API Update Failures
**Description:** Notion API calls to update select fields were silently failing.

**Root Cause:** Missing "color" attribute in select option definitions.

**Solution:**
```json
// WRONG - fails silently
{"name": "🔴 Critical"}

// CORRECT - works
{"name": "🔴 Critical", "color": "red"}
```

### Problem 4: AF DCGS Contract Structure Confusion
**Description:** Unclear whether to target BAE (prime contractor) or GDIT (subcontractor) for staffing opportunities.

**Root Cause:** Misunderstanding of how staffing procurement works on large defense contracts.

**Solution:** Clarified that GDIT controls their own staffing pipeline separate from BAE procurement. PTS should position as staffing vendor to GDIT (competing with Insight Global, TEKsystems) rather than trying to be sub-to-sub.

### Problem 5: Job Postings Multi-Source Database Limitation
**Description:** Original Job Postings Database (d92495a2-c753-48e3-9c2b-33c40ed21f06) cannot be updated via API.

**Root Cause:** Notion multi-source databases have API restrictions.

**Solution:** 
1. Marked database as deprecated
2. Created Program Mapping Hub as replacement
3. All new workflows target Hub database

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate (This Week)
1. [ ] **Implement Contact Classification Workflow** - Auto-populate 5 properties on import
2. [ ] **Add Verified Property** - Boolean field for LinkedIn verification status
3. [ ] **Correct Maureen Shamaly Record** - Update classification to non-DCGS
4. [ ] **Find Real AF DCGS Langley Site Lead** - Re-research to identify correct person
5. [ ] **Implement Hub → BD Opportunities Pipeline** - Trigger on Status = validated

### High Priority (Next 2 Weeks)
6. [ ] **Build Location-to-Program Mapping n8n Node** - Reusable for all job sources
7. [ ] **Add TEKsystems Scraper** - Expand job sources
8. [ ] **Create Verification Checklist View** - Prioritize unverified critical contacts
9. [ ] **Update Federal Programs Database** - Add NSST ($202M, BGI-ASI JV) and NISC IV ($1.76B, Leidos)

### Medium Priority (Next Month)
10. [ ] **HUMINT Weekly Digest Workflow** - Aggregate call notes and discoveries
11. [ ] **BD Pipeline Dashboard** - Visual tracking by program
12. [ ] **SAM.gov Integration** - Contract award data enrichment
13. [ ] **Confidence Score Calibration** - Tune based on actual match rates

### Future Enhancements
14. [ ] Automated LinkedIn Verification API
15. [ ] Call outcome tracking integration
16. [ ] Competitor job alert system
17. [ ] Past performance matching engine

---

## 10. KEY INSIGHTS & GOTCHAS

### Data Quality
- **Never trust location data without verification** - ZoomInfo pulls from multiple sources including outdated records
- **Job title != Actual role** - "Program Manager, D" doesn't mean DCGS; always verify with LinkedIn
- **Always verify high-priority contacts before calling** - One wrong call damages credibility

### Notion Specifics
- **Select fields require color attribute** - `{"name": "Option", "color": "blue"}` or API fails silently
- **Collection ID ≠ Database ID** - Use collection ID for MCP data_source_url queries
- **Database performance degrades at ~1,000 records** - Plan splits proactively
- **Multi-source databases have API restrictions** - Avoid for workflow targets

### Contract Structure
- **AF DCGS: BAE is Prime, GDIT is Sub** - But target GDIT for staffing (they control their own vendors)
- **Army/Navy DCGS: GDIT is Prime** - Straightforward subcontract relationship
- **Staffing vendors compete with Insight Global** - Not sub-to-sub, different procurement path

### BD Strategy
- **HUMINT before executives** - Lower-tier contacts (Tier 5-6) gather intel before approaching Tier 1-3
- **San Diego PACAF is critical** - Understaffed site with acting leadership = immediate opportunity
- **6-step BD Formula required** - Personalization, pain points, gaps, past performance (3 types)

### n8n Workflows
- **Always check API response before proceeding** - Silent failures common
- **Batch operations for >100 records** - Individual API calls too slow
- **15-minute enrichment schedule is optimal** - Balances freshness with API limits
- **Score ≥ 80 triggers alerts** - Hot threshold for immediate action

### Rate Limits & Performance
- **Notion API: 3 requests/second** - Use delays in loops
- **GPT-4o: Cost optimization via two-stage enrichment** - Location match first, AI only for unmatched
- **Apify: 500 pages per scrape** - Sufficient for major job boards

---

## APPENDIX A: COLLECTION ID REFERENCE

```javascript
const NOTION_COLLECTION_IDS = {
  // Primary BD Databases
  DCGS_CONTACTS: "2ccdef65-baa5-8087-a53b-000ba596128e",
  GDIT_OTHER_CONTACTS: "70ea1c94-211d-40e6-a994-e8d7c4807434",
  GDIT_JOBS: "2ccdef65-baa5-80b0-9a80-000bd2745f63",
  PROGRAM_MAPPING_HUB: "f57792c1-605b-424c-8830-23ab41c47137",
  FEDERAL_PROGRAMS: "06cd9b22-5d6b-4d37-b0d3-ba99da4971fa",
  BD_OPPORTUNITIES: "2bcdef65-baa5-80ed-bd95-000b2f898e17",
  
  // Reference Databases
  CONTRACTORS: "3a259041-22bf-4262-a94a-7d33467a1752",
  CONTRACT_VEHICLES: "0f09543e-9932-44f2-b0ab-7b4c070afb81",
  ENRICHMENT_LOG: "20dca021-f026-42a5-aaf7-2b1c87c4a13d",
  CONTACTS_GENERAL: "dbad3487-5371-452e-903a-40f070e598aa",
  
  // Program Databases
  DEFENSE_PROGRAM_UNIVERSE: "bba2faa7-e297-4990-a179-3d0acc65c52d",
  DOD_PROGRAMS_MASTER: "4fa19e91-62c8-432a-8aa4-0f73f5416b41",
  
  // Deprecated (Do Not Use)
  BD_TARGETS_INSIGHT_GLOBAL: "9b9e7140-c13a-4c41-ae3a-0b926230d726",
  JOB_POSTINGS_MULTI_SOURCE: "d92495a2-c753-48e3-9c2b-33c40ed21f06",
  BD_OPPORTUNITIES_EVENTS: "8bf60d75-5638-41be-8d5d-6f8cf2601441"
};
```

---

## APPENDIX B: PRIORITY CONTACTS (Verified Dec 2025)

| Name | Program | Title | Priority | Status |
|------|---------|-------|----------|--------|
| Kingsley Ero | AF DCGS-PACAF | Security Analyst | 🔴 Critical | ✅ LinkedIn Verified |
| Craig Lindahl | AF DCGS-Wright-Patt | Sr. PM | 🟠 High | ⏳ Needs Verification |
| Jeffrey Bartsch | Army DCGS-A | Ops Manager | 🟠 High | ⏳ Needs Verification |
| Dusty Galbraith | Navy DCGS-N | PM | 🟠 High | ⏳ Needs Verification |
| David Winkelman | Corporate HQ | VP Defense Intel | 🔴 Critical | ⏳ Needs Verification |
| ~~Maureen Shamaly~~ | ~~AF DCGS-Langley~~ | ~~PM~~ | ~~Critical~~ | ❌ WRONG PROGRAM |

---

*Export generated by Claude AI*  
*Session Date: December 22, 2025*  
*Total conversation context: ~50,000 tokens processed*
