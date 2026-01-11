# PTS_BD_Skills_Master_Audit_Claude_Export_20260110.md

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
**PTS BD Intelligence System - Custom Skills Master Audit & Creation**

Comprehensive analysis of the PTS Business Development intelligence system, including:
- Job scraping and standardization pipelines
- Program mapping engine design
- Contact classification systems
- Notion database architecture
- n8n workflow automation
- Custom Claude skill creation for top 0.1% proficiency

### Date Range
- **Session Date:** January 9-10, 2026
- **Project Span:** December 2025 - January 2026 (based on referenced chats)

### Primary Objective
1. **Audit** the complete PTS BD intelligence system across all components
2. **Identify** skill gaps and systematize workflows
3. **Create** 10 comprehensive custom Claude skills to codify all methodologies
4. **Document** everything for repository inclusion

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: YAML Frontmatter Format for Skills
- **Decision:** Use simple single-line `name:` and `description:` format
- **Reasoning:** Anthropic's official skills use simple YAML, not multiline `>` syntax
- **Alternatives Considered:** Multiline YAML with `>` indicator (caused parsing errors)

### Decision 2: 10-Skill Architecture
- **Decision:** Create 10 discrete skills rather than one monolithic skill
- **Reasoning:** Multiple focused skills compose better; easier to maintain and update
- **Skills Created:**
  1. job-standardization
  2. program-mapping
  3. contact-classification
  4. bd-outreach-messaging
  5. humint-intelligence
  6. federal-defense-programs
  7. notion-bd-operations
  8. apify-job-scraping
  9. bd-call-sheet
  10. bd-playbook

### Decision 3: Database Split at 1,000 Records
- **Decision:** Maintain separate databases for DCGS Contacts (965) and GDIT Other (1,052)
- **Reasoning:** Notion performance degrades significantly above 1,000 records
- **Alternatives Considered:** Single combined database (rejected due to performance)

### Decision 4: Hub-and-Spoke Data Model
- **Decision:** Use Program Mapping Intelligence Hub as central processing node
- **Reasoning:** Single source of truth for job-to-program mapping with status tracking
- **Status Flow:** `raw_import → pending_enrichment → enriching → enriched → validated → error`

### Decision 5: Two-Stage Job Processing
- **Decision:** Lightweight universal scrape + selective deep enrichment
- **Reasoning:** 79% cost savings by only enriching high-priority opportunities
- **Stage 1:** Basic fields (title, location, URL, clearance) for all jobs
- **Stage 2:** Full standardization for jobs scoring >70 BD Priority

### Decision 6: 6-Tier Contact Hierarchy
- **Decision:** Implement 6-tier classification system
- **Reasoning:** Enables systematic HUMINT gathering (bottom-up) and outreach sequencing
- **Tiers:** Executive → Director → Program Leadership → Management → Senior IC → Individual Contributor

---

## 3. ARCHITECTURE & DATA FLOW

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        PTS BD INTELLIGENCE SYSTEM                        │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  JOB SCRAPING   │───▶│ PROGRAM MAPPING  │───▶│    CONTACT      │
│  (Apify)        │    │  HUB (Notion)    │    │   DISCOVERY     │
│                 │    │                  │    │ (ZoomInfo/LI)   │
│ • Puppeteer     │    │ • Status Flow    │    │                 │
│ • Insight Global│    │ • GPT-4o Enrich  │    │ • Tier 5-6 ICs  │
│ • Apex Systems  │    │ • BD Scoring     │    │ • Tier 3-4 Mgrs │
│ • TEKsystems    │    │ • Clearance      │    │ • Tier 1-2 Execs│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                      │                       │
         │                      ▼                       │
         │              ┌──────────────────┐            │
         │              │ FEDERAL PROGRAMS │            │
         │              │    (388 progs)   │            │
         │              └──────────────────┘            │
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           NOTION DATABASES                               │
├─────────────────┬──────────────────┬─────────────────┬──────────────────┤
│ DCGS Contacts   │ GDIT Other       │ Program Mapping │ BD Opportunities │
│ Full (965)      │ Contacts (1,052) │ Hub (variable)  │ (qualified)      │
└─────────────────┴──────────────────┴─────────────────┴──────────────────┘
         │                      │                       │
         ▼                      ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         BD DELIVERABLES                                  │
├─────────────────┬──────────────────┬─────────────────┬──────────────────┤
│ Call Sheets     │ BD Playbooks     │ Org Charts      │ HUMINT Reports   │
│ (Excel)         │ (Word)           │ (HTML/D3.js)    │ (Markdown)       │
└─────────────────┴──────────────────┴─────────────────┴──────────────────┘
```

### Data Flow Details

**1. Job Scraping Flow:**
```
Apify Puppeteer Scraper
    ↓
Webhook to n8n (POST /webhook/apify-job-import)
    ↓
Program Mapping Intelligence Hub (Status: raw_import)
    ↓
GPT-4o Enrichment (every 15 min via n8n)
    ↓
Program Mapping (location + keyword scoring)
    ↓
BD Priority Score Calculation
    ↓
BD Opportunities (if score ≥70, confidence ≥0.7)
```

**2. Contact Discovery Flow:**
```
Job signals identify program/location
    ↓
ZoomInfo query for contacts at that company/location
    ↓
LinkedIn verification of profiles
    ↓
Classification (Tier, Program, Priority, Functional Area)
    ↓
DCGS Contacts Full or GDIT Other Contacts
    ↓
HUMINT gathering (Tier 5-6 → Tier 3-4 → Tier 1-2)
    ↓
BD outreach with personalized messaging
```

### API Connections & Webhooks

| Integration | Type | Endpoint/ID |
|-------------|------|-------------|
| Apify → n8n | Webhook | `https://primetech.app.n8n.cloud/webhook/apify-job-import` |
| n8n → Notion | API | Notion MCP via collection IDs |
| n8n → OpenAI | API | GPT-4o for job enrichment |
| Claude → Notion | MCP | notion-search, notion-update-page |
| Claude → Apify | MCP | apify-slash-puppeteer-scraper |

---

## 4. CODE & CONFIGURATIONS

### 4.1 Job Standardization System Prompt

**File:** `job_standardization_system_prompt.txt`
**Purpose:** LLM prompt for extracting 11-field schema from raw job postings

```
You are a specialized data extraction system for defense contractor job postings. Analyze the raw job description and extract information into the standardized 11-field schema.

### EXTRACTION RULES

**Job Title/Position**
- Use Title Case (e.g., "Network Engineer" not "NETWORK ENGINEER")
- Remove HTML entities (&amp; → &)
- Remove embedded location info from title

**Date Posted**
- Convert to YYYY-MM-DD format
- If only month/year, use first day of month
- If missing, use scrape date as fallback

**Location**
- Format as "City, State" (e.g., "Herndon, VA")
- Standardize variations:
  - "100% Remote" → "Remote"
  - "Ft. Meade" → "Fort George G. Meade, MD"
  - "Washington DC Metro" → "Washington, DC"
- Preserve full military base names

**Security Clearance**
- Standardize abbreviations:
  - "TS/SCI w/ CI Poly" (with polygraph)
  - "TS/SCI" (no polygraph)
  - "Top Secret" → "Top Secret"
  - "Secret" (not "DOD Secret")
- Note if "ability to obtain" vs "active"

**Position Overview (REQUIRED)**
- 100-200 word summary
- Answer: What does this person do day-to-day?
- Extract from "Overview", "Summary", "About the Role" sections

**Key Responsibilities (REQUIRED)**
- Array of 5-15 bullet points
- Action verb sentence fragments
- Extract from "Responsibilities", "Duties", "What You'll Do"
- Remove bullet symbols (•, -, *, ·)

**Required Qualifications (REQUIRED)**
- Array of 5-20 bullet points
- Separate from "Preferred" qualifications
- Include: clearance, education, experience, certifications, skills

### OUTPUT FORMAT
Return valid JSON matching the 11-field schema exactly.
```

### 4.2 Hierarchy Tier Classification Logic

**File:** `contact_classification.py`
**Purpose:** Automatically classify contacts by seniority level

```python
def get_hierarchy_tier(title):
    """Classify contact into 6-tier hierarchy based on job title"""
    title_lower = title.lower()
    
    # Tier 1 - Executive
    if any(kw in title_lower for kw in [
        'vice president', 'vp,', 'vp ', 'president', 
        'chief ', 'ceo', 'cto', 'cio', 'ciso', 'cfo'
    ]):
        return 'Tier 1 - Executive'
    
    # Tier 2 - Director
    if 'director' in title_lower:
        return 'Tier 2 - Director'
    
    # Tier 3 - Program Leadership
    if any(kw in title_lower for kw in [
        'program manager', 'deputy program', 'site lead',
        'task order', 'program director', 'project director'
    ]):
        return 'Tier 3 - Program Leadership'
    
    # Tier 4 - Management
    if any(kw in title_lower for kw in [
        'manager', 'team lead', 'supervisor',
        'lead,', 'lead ', 'section chief'
    ]):
        return 'Tier 4 - Management'
    
    # Tier 5 - Senior IC
    if any(kw in title_lower for kw in [
        'senior ', 'sr.', 'sr ', 'principal',
        'lead engineer', 'staff engineer', 'architect'
    ]):
        return 'Tier 5 - Senior IC'
    
    # Tier 6 - Individual Contributor (default)
    return 'Tier 6 - Individual Contributor'
```

### 4.3 BD Priority Assignment Logic

**File:** `bd_priority.py`
**Purpose:** Assign BD priority based on tier, program, and location

```python
def get_bd_priority(hierarchy_tier, program=None, location=None):
    """Assign BD priority based on contact attributes"""
    
    # Critical: Executives + PACAF site
    if hierarchy_tier in ['Tier 1 - Executive', 'Tier 2 - Director']:
        return '🔴 Critical'
    if program == 'AF DCGS - PACAF':
        return '🔴 Critical'  # San Diego is priority target
    if location and 'San Diego' in location:
        return '🔴 Critical'
    
    # High: Program Managers and Site Leads
    if hierarchy_tier == 'Tier 3 - Program Leadership':
        return '🟠 High'
    
    # Medium: Managers
    if hierarchy_tier == 'Tier 4 - Management':
        return '🟡 Medium'
    
    # Standard: ICs
    return '⚪ Standard'
```

### 4.4 Location-to-Program Mapping

**File:** `location_mapping.py`
**Purpose:** Deterministic mapping of locations to DCGS programs

```python
LOCATION_TO_PROGRAM = {
    # AF DCGS - Langley (DGS-1)
    'Hampton': 'AF DCGS - Langley',
    'Newport News': 'AF DCGS - Langley',
    'Langley': 'AF DCGS - Langley',
    'Yorktown': 'AF DCGS - Langley',
    
    # AF DCGS - PACAF (San Diego) 🔥 CRITICAL
    'San Diego': 'AF DCGS - PACAF',
    'La Mesa': 'AF DCGS - PACAF',
    
    # AF DCGS - Wright-Patterson (NASIC)
    'Dayton': 'AF DCGS - Wright-Patt',
    'Beavercreek': 'AF DCGS - Wright-Patt',
    'Fairborn': 'AF DCGS - Wright-Patt',
    
    # Navy DCGS-N
    'Norfolk': 'Navy DCGS-N',
    'Suffolk': 'Navy DCGS-N',
    'Chesapeake': 'Navy DCGS-N',
    'Virginia Beach': 'Navy DCGS-N',
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
}
```

### 4.5 BD Priority Score Calculation

**File:** `bd_scoring.py`
**Purpose:** Multi-signal scoring for job-to-opportunity prioritization

```python
def calculate_bd_priority_score(job):
    """Calculate BD priority score (0-100) for a job posting"""
    score = 50  # Base score
    
    # Clearance boost (0-35 points)
    clearance_boosts = {
        'TS/SCI w/ FS Poly': 35,
        'TS/SCI w/ CI Poly': 35,
        'TS/SCI': 25,
        'Top Secret': 15,
        'Secret': 5,
        'Public Trust': 2,
    }
    clearance = job.get('Security Clearance', '')
    for level, boost in clearance_boosts.items():
        if level.lower() in clearance.lower():
            score += boost
            break
    
    # Match confidence boost (0-20 points)
    score += int(job.get('match_confidence', 0) * 20)
    
    # DCGS relevance boost (0-20 points)
    desc_lower = job.get('description', '').lower()
    if 'dcgs' in desc_lower:
        score += 20
    elif any(kw in desc_lower for kw in ['isr', '480th', 'nasic']):
        score += 15
    elif 'intelligence' in desc_lower:
        score += 10
    
    # Leadership role boost (0-5 points)
    title_lower = job.get('title', '').lower()
    if any(kw in title_lower for kw in ['program manager', 'site lead', 'director']):
        score += 5
    
    # Priority location boost (0-10 points)
    location = job.get('location', '')
    if 'San Diego' in location:
        score += 10  # PACAF is critical priority
    elif any(loc in location for loc in ['Hampton', 'Norfolk', 'Dayton']):
        score += 5
    
    return min(score, 100)

def get_bd_priority_tier(score):
    """Convert numeric score to priority tier"""
    if score >= 80:
        return '🔥 Hot'
    elif score >= 50:
        return '🟡 Warm'
    else:
        return '❄️ Cold'
```

### 4.6 Clearance Detection Patterns

**File:** `clearance_detection.py`
**Purpose:** Extract and normalize clearance levels from job postings

```python
import re

CLEARANCE_PATTERNS = {
    'TS/SCI w/ FS Poly': r'ts/sci.*full.?scope|full.?scope.*poly',
    'TS/SCI w/ CI Poly': r'ts/sci.*ci.?poly|ci.?poly.*ts/sci',
    'TS/SCI': r'ts/sci|top.?secret/sci',
    'Top Secret': r'top.?secret(?!/sci)',
    'Secret': r'(?<!top.)secret',
    'Public Trust': r'public.?trust',
}

def detect_clearance(text):
    """Extract clearance level from text"""
    text_lower = text.lower()
    for clearance, pattern in CLEARANCE_PATTERNS.items():
        if re.search(pattern, text_lower):
            return clearance
    return None
```

### 4.7 Job Preprocessing Pipeline

**File:** `job_preprocessing.py`
**Purpose:** Clean and prepare raw job data for LLM processing

```python
import html
import re
from datetime import datetime

def preprocess_job_data(raw_job):
    """Preprocess raw job data before LLM standardization"""
    
    # Decode HTML entities
    if raw_job.get('description'):
        raw_job['description'] = html.unescape(raw_job['description'])
    
    # Clean whitespace
    for key in raw_job:
        if isinstance(raw_job[key], str):
            raw_job[key] = re.sub(r'\s+', ' ', raw_job[key]).strip()
    
    return raw_job

def validate_standardized_job(job):
    """Validate standardized job meets schema requirements"""
    required_fields = [
        'Job Title/Position', 'Date Posted', 'Location',
        'Position Overview', 'Key Responsibilities', 'Required Qualifications'
    ]
    errors = []
    
    for field in required_fields:
        if not job.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Validate arrays
    if not isinstance(job.get('Key Responsibilities'), list):
        errors.append("Key Responsibilities must be an array")
    if not isinstance(job.get('Required Qualifications'), list):
        errors.append("Required Qualifications must be an array")
    
    # Validate date format
    if job.get('Date Posted'):
        try:
            datetime.strptime(job['Date Posted'], '%Y-%m-%d')
        except ValueError:
            errors.append("Date Posted must be YYYY-MM-DD format")
    
    return len(errors) == 0, errors
```

### 4.8 Excel Call Sheet Generator

**File:** `call_sheet_generator.py`
**Purpose:** Generate Excel call sheets with priority color-coding

```python
from openpyxl import Workbook
from openpyxl.styles import PatternFill, Font, Alignment, Border, Side
from openpyxl.utils import get_column_letter

# Priority color fills
PRIORITY_FILLS = {
    '🔴 Critical': PatternFill(start_color='FFCCCC', end_color='FFCCCC', fill_type='solid'),
    '🟠 High': PatternFill(start_color='FFE5CC', end_color='FFE5CC', fill_type='solid'),
    '🟡 Medium': PatternFill(start_color='FFFFCC', end_color='FFFFCC', fill_type='solid'),
    '⚪ Standard': PatternFill(start_color='FFFFFF', end_color='FFFFFF', fill_type='solid'),
}

def apply_priority_formatting(ws, row_num, priority):
    """Apply color-coded formatting to row based on priority"""
    fill = PRIORITY_FILLS.get(priority, PRIORITY_FILLS['⚪ Standard'])
    for col in range(1, 15):  # Columns A through N
        ws.cell(row=row_num, column=col).fill = fill

def create_bd_call_sheet(contacts_df, jobs_df, output_path):
    """Create BD call sheet Excel workbook"""
    wb = Workbook()
    ws_contacts = wb.active
    ws_contacts.title = "Priority Contacts"
    
    # Header row
    headers = [
        'Priority', 'Name', 'Title', 'Program', 'Phone', 'Email', 
        'LinkedIn', 'Personalized Message', 'Pain Points', 
        'Labor Gaps', 'PTS Past Performance', 'Call Notes', 
        'Status', 'Follow-Up Date'
    ]
    
    header_fill = PatternFill(start_color='1F4E79', end_color='1F4E79', fill_type='solid')
    header_font = Font(bold=True, color='FFFFFF')
    
    for col, header in enumerate(headers, 1):
        cell = ws_contacts.cell(row=1, column=col, value=header)
        cell.fill = header_fill
        cell.font = header_font
        cell.alignment = Alignment(horizontal='center', vertical='center')
    
    # Sort by priority
    priority_order = {'🔴 Critical': 0, '🟠 High': 1, '🟡 Medium': 2, '⚪ Standard': 3}
    contacts_df['_sort'] = contacts_df['BD Priority'].map(priority_order)
    contacts_df = contacts_df.sort_values('_sort').drop('_sort', axis=1)
    
    # Add data rows with formatting
    for idx, contact in contacts_df.iterrows():
        row_num = idx + 2
        # ... populate cells ...
        apply_priority_formatting(ws_contacts, row_num, contact.get('BD Priority', '⚪ Standard'))
    
    # Freeze header row
    ws_contacts.freeze_panes = 'A2'
    
    wb.save(output_path)
    return output_path
```

### 4.9 Apify Puppeteer Scraper Configuration

**File:** `apify_config.json`
**Purpose:** Configuration for Insight Global job scraper

```json
{
  "startUrls": [
    {"url": "https://www.insightglobal.com/jobs?search=DCGS"},
    {"url": "https://www.insightglobal.com/jobs?search=intelligence+analyst"},
    {"url": "https://www.insightglobal.com/jobs?search=network+engineer"},
    {"url": "https://www.insightglobal.com/jobs?search=TS%2FSCI"}
  ],
  "pageFunction": "async function pageFunction(context) { const { page, request, log } = context; const title = await page.title(); const jobs = await page.$$eval('.job-card', cards => { return cards.map(card => ({ title: card.querySelector('.job-title')?.textContent?.trim(), location: card.querySelector('.location')?.textContent?.trim(), url: card.querySelector('a')?.href, company: 'Insight Global' })); }); return jobs; }",
  "proxyConfiguration": {
    "useApifyProxy": true
  },
  "maxConcurrency": 10,
  "maxRequestsPerCrawl": 500,
  "maxRequestRetries": 3,
  "requestHandlerTimeoutSecs": 60
}
```

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 DCGS Contacts Full

**Database URL:** `https://www.notion.so/2ccdef65baa580d09b66c67d66e7a54d`
**Collection ID:** `2ccdef65-baa5-8087-a53b-000ba596128e`
**Records:** ~965

| Property | Type | Options/Values |
|----------|------|----------------|
| Name | Title | Text |
| First Name | Text | |
| Last Name | Text | |
| Job Title | Text | |
| Email Address | Email | |
| Phone Number | Phone | |
| LinkedIn Contact Profile URL | URL | |
| Person City | Text | |
| Person State | Text | |
| Program | Select | `AF DCGS - Langley`, `AF DCGS - Wright-Patt`, `AF DCGS - PACAF`, `AF DCGS - Other`, `Army DCGS-A`, `Navy DCGS-N`, `Corporate HQ`, `Enterprise Security`, `Unassigned` |
| Hierarchy Tier | Select | `Tier 1 - Executive`, `Tier 2 - Director`, `Tier 3 - Program Leadership`, `Tier 4 - Management`, `Tier 5 - Senior IC`, `Tier 6 - Individual Contributor` |
| BD Priority | Select | `🔴 Critical`, `🟠 High`, `🟡 Medium`, `⚪ Standard` |
| Location Hub | Select | `Hampton Roads`, `San Diego Metro`, `DC Metro`, `Dayton/Wright-Patt`, `Other CONUS`, `OCONUS`, `Unknown` |
| Functional Area | Multi-Select | `Program Management`, `Network Engineering`, `Cyber Security`, `ISR/Intelligence`, `Systems Administration`, `Software Engineering`, `Field Service`, `Security/FSO`, `Business Development`, `Training`, `Administrative` |

### 5.2 GDIT Other Contacts

**Database URL:** `https://www.notion.so/c1b1d3589d824f03b77cdb43d9795c6f`
**Collection ID:** `70ea1c94-211d-40e6-a994-e8d7c4807434`
**Records:** ~1,052

Same schema as DCGS Contacts Full (non-DCGS GDIT personnel)

### 5.3 Program Mapping Intelligence Hub

**Database URL:** `https://www.notion.so/0a0d7e463d8840b6853a3c9680347644`
**Collection ID:** `f57792c1-605b-424c-8830-23ab41c47137`

| Property | Type | Options/Values |
|----------|------|----------------|
| Title | Title | Job title |
| Source URL | URL | Original job posting URL |
| Location | Text | Standardized "City, State" |
| Clearance | Select | Clearance levels |
| Status | Select | `raw_import`, `pending_enrichment`, `enriching`, `enriched`, `validated`, `error` |
| Matched Program | Text | Program name from matching |
| Match Confidence | Number | 0.0 - 1.0 |
| BD Priority Score | Number | 0 - 100 |
| BD Priority Tier | Select | `🔥 Hot`, `🟡 Warm`, `❄️ Cold` |
| Scraped At | Date | When job was scraped |
| Processed At | Date | When enrichment completed |

### 5.4 Federal Programs

**Database URL:** `https://www.notion.so/9db40fce078142b9902cd4b0263b1e23`
**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`
**Records:** 388

| Property | Type | Description |
|----------|------|-------------|
| Program Name | Title | Full program name |
| Acronym | Text | Short name (e.g., "AF DCGS") |
| Agency Owner | Text | Customer agency |
| Prime Contractor | Text | Lead contractor |
| Known Subcontractors | Text | List of subs |
| Contract Value | Text | Estimated value |
| Contract Vehicle/Type | Text | IDIQ, FFP, etc. |
| Key Locations | Text | Comma-separated locations |
| Clearance Requirements | Text | Required clearance levels |
| Typical Roles | Text | Common job titles |
| Keywords/Signals | Text | Matching keywords |
| PTS Involvement | Select | `Current`, `Past`, `Target`, `None` |
| Priority Level | Select | Priority for BD |
| Pain Points | Text | Known challenges |

### 5.5 GDIT Jobs

**Database URL:** `https://www.notion.so/2ccdef65baa580669cb6ee688ede23f4`
**Collection ID:** `2ccdef65-baa5-80b0-9a80-000bd2745f63`
**Records:** ~700

| Property | Type | Description |
|----------|------|-------------|
| Job Title | Title | Position title |
| Date Added | Date | When imported |
| Owner | Text | Recruiter/Owner |
| Contact | Text | Contact info |
| Employment Type | Select | Contract, Perm, etc. |
| Open/Closed | Select | Status |
| Status | Text | Additional status |
| Pay Rate | Text | Hourly rate |
| Client Bill Rate | Text | Bill rate |
| Salary | Text | Annual salary |

---

## 6. N8N WORKFLOWS

### 6.1 Apify Job Import Workflow

**Workflow Name:** `Apify Job Import`
**Purpose:** Receive scraped jobs from Apify and import to Program Mapping Hub
**Status:** Active

**Node Sequence:**
```
Webhook Trigger (POST /webhook/apify-job-import)
    ↓
JSON Parse (extract jobs array)
    ↓
Loop Over Items (for each job)
    ↓
Set Fields (map to Notion schema)
    ↓
Notion Create Page (Program Mapping Hub)
    ↓
Set Status = "raw_import"
```

**Webhook Configuration:**
```json
{
  "httpMethod": "POST",
  "path": "apify-job-import",
  "responseMode": "onReceived",
  "options": {
    "responseCode": 200,
    "responseData": "allEntries"
  }
}
```

### 6.2 Enrichment Processor Workflow

**Workflow Name:** `Job Enrichment Processor`
**Purpose:** Process pending jobs with GPT-4o for standardization and program mapping
**Status:** Active

**Node Sequence:**
```
Schedule Trigger (every 15 minutes)
    ↓
Notion Query (Status = "pending_enrichment", limit 10)
    ↓
Loop Over Items
    ↓
Set Status = "enriching" (lock)
    ↓
OpenAI GPT-4o (standardization prompt)
    ↓
Parse Response (extract 11 fields)
    ↓
Program Matcher (location + keyword scoring)
    ↓
Calculate BD Priority Score
    ↓
Notion Update (enriched fields + Status = "enriched")
    ↓
Error Handler → Set Status = "error"
```

**GPT-4o Configuration:**
```json
{
  "model": "gpt-4o",
  "temperature": 0.1,
  "max_tokens": 2000,
  "system": "[Job Standardization System Prompt from Section 4.1]"
}
```

### 6.3 Priority Alert Notification Workflow

**Workflow Name:** `Priority Alert Notification`
**Purpose:** Alert when Hot opportunities are identified
**Status:** Active

**Node Sequence:**
```
Notion Property Change Trigger (BD Priority Tier)
    ↓
Filter (BD Priority Tier = "🔥 Hot")
    ↓
Slack Message (to #bd-alerts channel)
    ↓
Email (to BD team)
```

**Slack Message Template:**
```
🔥 *HOT OPPORTUNITY DETECTED*

*Job:* {{ $json.Title }}
*Location:* {{ $json.Location }}
*Program:* {{ $json.Matched_Program }}
*Score:* {{ $json.BD_Priority_Score }}
*Clearance:* {{ $json.Clearance }}

<{{ $json.Source_URL }}|View Original Posting>
```

### 6.4 Hub → BD Opportunities Pipeline (Designed)

**Workflow Name:** `Opportunity Qualification`
**Purpose:** Transfer validated high-score jobs to BD Opportunities
**Status:** Designed, pending implementation

**Qualification Criteria:**
- BD Priority Score ≥ 70
- Match Confidence ≥ 0.7
- Status = "validated"

---

## 7. APIFY ACTORS & SCRAPERS

### 7.1 Puppeteer Scraper

**Actor ID:** `apify/puppeteer-scraper`
**Actor URL:** `https://apify.com/apify/puppeteer-scraper`

**Input Configuration:**
```json
{
  "startUrls": [
    {"url": "https://www.insightglobal.com/jobs?search=DCGS"},
    {"url": "https://www.insightglobal.com/jobs?search=intelligence"},
    {"url": "https://www.insightglobal.com/jobs?search=network+engineer"},
    {"url": "https://www.insightglobal.com/jobs?search=TS%2FSCI"}
  ],
  "proxyConfiguration": {
    "useApifyProxy": true
  },
  "maxConcurrency": 10,
  "maxRequestsPerCrawl": 500,
  "maxRequestRetries": 3
}
```

**Output Schema:**
```json
{
  "title": "string",
  "company": "string",
  "location": "string",
  "url": "string",
  "detected_clearance": "string|null",
  "primary_keyword": "string",
  "scraped_at": "datetime"
}
```

**Rate Limiting:**
- Cost per run: ~$0.05-0.38 depending on volume
- Recommended cadence: Weekly
- Concurrent requests: 10

### 7.2 Scraping Targets

| Target | URL Pattern | Data Quality |
|--------|-------------|--------------|
| Insight Global | `insightglobal.com/jobs?search=` | URL + Location only |
| Apex Systems | `apexsystems.com/job-seekers/job-search?keywords=` | Rich (11 fields) |
| TEKsystems | `teksystems.com/en/jobs?keywords=` | Medium |
| CACI | `caci.com/careers?search=` | Medium |

### 7.3 Recent Run IDs (from audit)

| Run Date | Dataset ID | Jobs |
|----------|------------|------|
| 2026-01-06 | `2JJwE1r1gwh8J5Vsu` | 175 |
| 2025-12-22 | Various | 174 |
| 2025-12-19 | Various | 178 |
| 2025-12-17 | Various | 175 |

---

## 8. PROBLEMS SOLVED

### Problem 1: Notion Performance Degradation
- **Description:** Database queries became slow with >1,000 contacts
- **Root Cause:** Notion's architecture doesn't optimize well for large single databases
- **Solution:** Split into DCGS Contacts Full (965) and GDIT Other Contacts (1,052)

### Problem 2: Contact Misclassification
- **Description:** Maureen Shamaly misidentified as AF DCGS - PACAF instead of Langley
- **Root Cause:** Manual data entry without verification
- **Solution:** Implemented mandatory LinkedIn profile verification for high-priority contacts; automated classification logic based on location

### Problem 3: YAML Frontmatter Parse Error
- **Description:** Custom skill YAML failed to parse with multiline `>` syntax
- **Root Cause:** Anthropic skills use simple single-line YAML, not multiline
- **Solution:** Converted to simple `name:` and `description:` format matching official examples

### Problem 4: Schema Update Silent Failures
- **Description:** Select field updates failed without error
- **Root Cause:** Missing `color` attribute in select option updates
- **Solution:** Always include color attribute: `{"name": "🔴 Critical", "color": "red"}`

### Problem 5: Generic Outreach Not Differentiating
- **Description:** Cold calls getting rejected as "just another staffing firm"
- **Root Cause:** Generic templates without program-specific knowledge
- **Solution:** 6-step BD Formula with mandatory personalization, pain points, and past performance alignment

### Problem 6: Job Enrichment Cost Overruns
- **Description:** Enriching all jobs was too expensive (~$0.025/job × 5,000 jobs/month)
- **Root Cause:** Full LLM processing on every job regardless of priority
- **Solution:** Two-stage processing: lightweight universal scrape + selective deep enrichment for high-priority only (79% savings)

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate (This Week)
- [ ] Upload all 10 skills to Project Knowledge
- [ ] Test each skill with sample queries
- [ ] Execute PACAF outreach campaign using bd-outreach-messaging skill

### Short-Term (Next 2 Weeks)
- [ ] Implement Hub → BD Opportunities n8n pipeline
- [ ] Add LinkedIn Jobs scraper to Apify workflow
- [ ] Establish weekly HUMINT documentation cadence
- [ ] Create Army DCGS-A and Navy DCGS-N specific playbooks

### Medium-Term (Next Month)
- [ ] GCP Vertex AI integration for automated enrichment
- [ ] Expand beyond DCGS to full Federal Programs portfolio
- [ ] Build PTS Past Performance database from Bullhorn ATS extraction
- [ ] Implement automated contact discovery from job signals

### Long-Term (Q1 2026)
- [ ] Full automation: Scrape → Enrich → Match → Alert → Outreach
- [ ] Predictive analytics on recompete timing
- [ ] Multi-prime expansion (Leidos, SAIC, Peraton, CACI)

---

## 10. KEY INSIGHTS & GOTCHAS

### Insight 1: Bottom-Up HUMINT is Critical
**Learning:** Approaching executives cold without HUMINT results in rejection. Building from Tier 5-6 contacts up provides insider knowledge and credibility.
**Action:** Always gather intel from ICs before approaching PMs/Execs.

### Insight 2: Location is the Best Program Predictor
**Learning:** Job location is more reliable for program mapping than keywords. San Diego = PACAF, Hampton = Langley, Dayton = Wright-Patt.
**Action:** Use deterministic location mapping before keyword scoring.

### Insight 3: Notion Has Hidden Limits
**Learning:** Databases above 1,000 records degrade; multi-source databases can't be updated via API; select updates require color attribute.
**Action:** Plan database architecture for scale; verify API compatibility before design.

### Insight 4: Skill Format Matters
**Learning:** Anthropic skills use simple YAML frontmatter, not complex multiline syntax.
**Gotcha:** Don't use `>` for multiline description; use single-line under 200 chars.

### Insight 5: Two-Stage Processing Saves 79%
**Learning:** Full enrichment of all jobs is wasteful. Lightweight first pass + selective deep dive is optimal.
**Action:** Score jobs first, enrich only those >70 priority.

### Insight 6: The BD Formula Works
**Learning:** The 6-step formula (Personalized → Pain Points → Labor Gaps → GDIT PP → Program PP → Role PP) consistently differentiates from competitors.
**Action:** Never skip steps; always personalize.

### Insight 7: Collection ID vs Database ID
**Learning:** Notion MCP operations require Collection ID, not database URL/ID.
**Gotcha:** For multi-source databases, use the specific data_source_id from the `<data-source>` tag.

### Insight 8: Status Flow Prevents Duplicates
**Learning:** Using status flags (raw_import → enriching → enriched) prevents double-processing and enables error recovery.
**Action:** Always set status before processing; use "enriching" as a lock.

### Insight 9: Skills Compound
**Learning:** Multiple focused skills work better than one large skill. Claude can use multiple skills together automatically.
**Action:** Create discrete, composable skills rather than monolithic ones.

### Insight 10: Verification Prevents Embarrassment
**Learning:** Data errors (like Maureen Shamaly misidentification) damage credibility. LinkedIn verification is worth the time.
**Action:** Mandatory LinkedIn check for all 🔴 Critical and 🟠 High contacts.

---

## APPENDIX A: Custom Skills Created

| # | Skill Name | File Size | Purpose |
|---|------------|-----------|---------|
| 1 | job-standardization | 6.5K | LLM prompt engine for 11-field extraction |
| 2 | program-mapping | 4.0K | Multi-signal scoring for job-to-program |
| 3 | contact-classification | 5.5K | 6-tier hierarchy + BD priority |
| 4 | bd-outreach-messaging | 7.5K | 6-step BD Formula with templates |
| 5 | humint-intelligence | 7.5K | Tiered intelligence gathering |
| 6 | federal-defense-programs | 7.0K | DCGS portfolio + prime/sub info |
| 7 | notion-bd-operations | 7.0K | MCP patterns + database best practices |
| 8 | apify-job-scraping | 8.0K | Actor config + cost optimization |
| 9 | bd-call-sheet | 12K | Excel generation with color-coding |
| 10 | bd-playbook | 10K | Word document structure + templates |

**Total Skills Package:** 82KB

---

## APPENDIX B: Database Collection IDs (Quick Reference)

```
DCGS Contacts Full:      2ccdef65-baa5-8087-a53b-000ba596128e
GDIT Other Contacts:     70ea1c94-211d-40e6-a994-e8d7c4807434
GDIT Jobs:               2ccdef65-baa5-80b0-9a80-000bd2745f63
Program Mapping Hub:     f57792c1-605b-424c-8830-23ab41c47137
Federal Programs:        06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
BD Opportunities:        2bcdef65-baa5-80ed-bd95-000b2f898e17
Contractors:             3a259041-22bf-4262-a94a-7d33467a1752
Contract Vehicles:       0f09543e-9932-44f2-b0ab-7b4c070afb81
Enrichment Runs Log:     20dca021-f026-42a5-aaf7-2b1c87c4a13d
```

---

## APPENDIX C: Files Delivered This Session

| File | Location | Description |
|------|----------|-------------|
| `pts-bd-skills-complete.zip` | `/mnt/user-data/outputs/` | All 10 skills packaged |
| `pts-bd-skills/` | `/mnt/user-data/outputs/` | Unzipped skill folder |
| `PTS_BD_Skills_Audit_Report.md` | `/mnt/user-data/outputs/` | Summary audit report |
| `PTS_BD_Design_SKILL.md` | `/mnt/user-data/outputs/` | Design standards skill |
| `PTS_BD_Design_README.md` | `/mnt/user-data/outputs/` | Design skill README |

---

**Document Generated:** January 10, 2026
**Session Duration:** ~2 hours
**Total Deliverables:** 10 custom skills, 1 audit report, 1 export document
