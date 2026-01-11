# DCGS BD Email Campaign & Contact Intelligence System
## Claude Export - January 10, 2026

---

## 1. CONVERSATION SUMMARY

| Field | Value |
|-------|-------|
| **Topic/Focus Area** | DCGS Business Development Email Campaign & Contact Intelligence |
| **Date Range** | January 5-10, 2026 |
| **Primary Objective** | Create comprehensive email templates segmented by contact tier, with pre-populated merge fields for 232 DCGS contacts, integrated with job intelligence from competitor scrapes |

### Session Lineage
This conversation built upon multiple prior sessions:
1. `2026-01-06-02-53-01` - DCGS contacts keyword analysis (1,198 contacts)
2. `2026-01-06-03-34-42` - Initial job scrape enrichment (275 jobs)
3. `2026-01-09-20-40-21` - Full 26-column enrichment with location intelligence
4. `2026-01-09-21-12-03` - Maximum data extraction (33 columns with technologies, certs)
5. `2026-01-09-21-42-21` - Final BD call sheet creation (232 contacts, 33 DCGS jobs)

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Four-Template Email Segmentation Strategy
**Decision:** Segment 232 contacts into 4 email templates based on hierarchy tier and job matching

**Reasoning:** 
- Executives require different messaging than individual contributors
- Contacts matched to specific job openings get more direct "hiring manager" approach
- HUMINT strategy requires softer outreach to lower-tier contacts
- Site leads/PMs respond to pain-point messaging

**Template Distribution:**
| Template | Target | Count |
|----------|--------|-------|
| Template A | Executives/Directors (Tier 1-2) | 8 |
| Template B | Hiring Managers with matching jobs | 76 |
| Template C | Site Leads/PMs at critical sites | 16 |
| Template D | ICs for HUMINT/relationship building | 132 |

### Decision 2: Active Programs Only in Messaging
**Decision:** Only reference programs with current open positions in BD messaging

**Reasoning:**
- 262 jobs currently open across 16 active programs
- Referencing closed programs reduces credibility
- Active programs: BICES (49), JUSTIFIED (39), INSCOM (36), GSM-O/DEOS (16), ISEE (16)

**Alternatives Considered:**
- Including historical placements (rejected - less compelling)
- Generic "multiple programs" (rejected - lacks specificity)

### Decision 3: Pain Point Integration by Program
**Decision:** Pre-populate pain points by program for each contact

**Reasoning:**
- PACAF San Diego: Acting site lead stretched thin, single points of failure
- Langley: High ISR tempo, analyst burnout
- Wright-Patt: DevSecOps shortage, tech refresh pressure
- Navy DCGS-N: Norfolk talent competition, ship/shore integration challenges

---

## 3. ARCHITECTURE & DATA FLOW

### System Overview
```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│ ZoomInfo Export │────▶│ Notion Databases │────▶│ Excel Call      │
│ (CSV Files)     │     │ - DCGS Contacts  │     │ Sheets          │
└─────────────────┘     │ - GDIT Jobs      │     └─────────────────┘
                        │ - Federal Progs  │              │
┌─────────────────┐     └──────────────────┘              ▼
│ Apify Job       │────▶┌──────────────────┐     ┌─────────────────┐
│ Scrapers        │     │ Program Mapping  │────▶│ Email Templates │
│ - Insight Global│     │ Intelligence Hub │     │ & Merge Data    │
│ - Apex Systems  │     └──────────────────┘     └─────────────────┘
└─────────────────┘
```

### Data Sources
| Source | Records | Purpose |
|--------|---------|---------|
| DCGS Contacts Full (Notion) | 965 | Primary contact database |
| GDIT Jobs (Notion/Bullhorn) | 700 | PTS placement history |
| Job Scrapes (Apify) | 275 | Competitor job intelligence |
| Federal Programs (Notion) | 388 | Contract/program reference |
| ZoomInfo Exports | 1,198 | Contact enrichment |

### Notion Database Collection IDs
```
DCGS Contacts Full:     2ccdef65-baa5-8087-a53b-000ba596128e
GDIT Other Contacts:    70ea1c94-211d-40e6-a994-e8d7c4807434
GDIT Jobs:              2ccdef65-baa5-80b0-9a80-000bd2745f63
Program Mapping Hub:    f57792c1-605b-424c-8830-23ab41c47137
Federal Programs:       06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
```

---

## 4. CODE & CONFIGURATIONS

### Email Template Definitions

```python
TEMPLATES = {
    'TEMPLATE_A': {
        'name': 'Approved Supplier Introduction',
        'target': 'Executives, Directors, Program Managers (Tier 1-3)',
        'subject': 'PTS + {{Company}} | Approved Supplier Introduction',
        'body': '''Hi {{FirstName}},

I'm George Maranville, GDIT Portfolio Manager at Prime Technical Services – an approved supplier currently supporting several GDIT subcontracts including {{PTS_Programs}} in providing excellent engineering consultants.

We're also supporting {{Competing_Prime}} on their {{Competing_Program}} program in {{Location}} supporting their {{Customer_Unit}} – these synergies prompted me to reach out to connect for an introduction.

I'd appreciate the opportunity to introduce myself and Prime Technical Services, learn more about your role and team, and explore how we can best support your efforts. I can assure you that it will not be a waste of your time.

I'm flexible and happy to work around your schedule – just let me know a couple of times that work best for you.

Best regards,
George Maranville
GDIT Portfolio Manager
Prime Technical Services'''
    },
    
    'TEMPLATE_B': {
        'name': 'Job-Specific Outreach (Confirmed Hiring Manager)',
        'target': 'Managers, Team Leads matched to specific job openings',
        'subject': '{{Job_Title}} Candidates | {{Job_Location}}',
        'body': '''Hi {{FirstName}},

We haven't met, but several recruiting agencies have been calling my {{Contractor_Title}}s regarding an opportunity with {{Company}} in {{Job_Location}}, and I did some research on the position and saw that you were the hiring manager for this role, which prompted me to reach out.

My company – Prime Technical Services – is a current sub on several {{Company}} programs such as {{PTS_Programs}}, and I have several {{Contractor_Title}}s with {{Job_Clearance}} clearance who have the required certs and experience. I assume if these recruiters are calling my candidates, then they must be a good fit for what you're looking for. I'd love to get them in front of you.

Do you have a few minutes to discuss today or tomorrow?

Best regards,
George Maranville
GDIT Portfolio Manager
Prime Technical Services'''
    },
    
    'TEMPLATE_C': {
        'name': 'Site-Specific Pain Point',
        'target': 'Site Leads, Project Managers at critical sites (PACAF, Langley)',
        'subject': '{{Program}} Staffing Support | {{Location}}',
        'body': '''Hi {{FirstName}},

I understand you're {{Role_Context}} at the {{Site_Name}} – I know {{Pain_Point_Short}}.

Prime Technical Services is a current GDIT approved supplier supporting {{PTS_Programs}}. We've placed TS/SCI cleared engineers and analysts across multiple GDIT sites and understand the unique challenges of {{Program}} operations.

I noticed you currently have several open positions including {{Open_Jobs}} – these are exactly the types of roles where PTS has a strong bench of qualified candidates.

Would you have 15-20 minutes this week for a quick call to discuss how we might support your team's needs?

Best regards,
George Maranville
GDIT Portfolio Manager
Prime Technical Services'''
    },
    
    'TEMPLATE_D': {
        'name': 'HUMINT/Relationship Building',
        'target': 'Senior ICs and Individual Contributors (Tier 5-6)',
        'subject': '{{Program}} | Quick Question',
        'body': '''Hi {{FirstName}},

I'm George Maranville with Prime Technical Services – we're a current GDIT approved supplier on programs like {{PTS_Programs}}.

I'm reaching out because I'm trying to better understand the {{Program}} landscape in {{Location}} and saw that you're {{Role_Context}}. I'd love to learn more about the team dynamics and any staffing challenges you're seeing on the ground.

No sales pitch – just looking to connect with folks who know the program well. Would you be open to a brief 10-minute chat at your convenience?

Best regards,
George Maranville
GDIT Portfolio Manager
Prime Technical Services'''
    }
}
```

### Template Selection Logic

```python
def determine_template(tier, has_matching_jobs):
    """Determine which template to use based on tier and job matching"""
    if has_matching_jobs and ('Management' in str(tier) or 'Leadership' in str(tier)):
        return 'TEMPLATE_B'  # Job-specific for hiring managers
    elif tier in ['Tier 1 - Executive', 'Tier 2 - Director']:
        return 'TEMPLATE_A'  # Executive intro
    elif tier in ['Tier 3 - Program Leadership', 'Tier 4 - Management']:
        return 'TEMPLATE_C'  # Site-specific pain point
    else:
        return 'TEMPLATE_D'  # HUMINT for ICs
```

### Program-Specific Configuration Data

```python
PTS_PROGRAMS = 'GSM-O II, BICES/BICES-X, and NATO BICES'

COMPETING_PRIMES = {
    'AF DCGS - PACAF': ('BAE Systems', 'AF DCGS Block 20', 'San Diego', '480th ISR Wing'),
    'AF DCGS - Langley': ('BAE Systems', 'AF DCGS Block 20', 'Hampton Roads', '480th ISR Wing'),
    'AF DCGS - Wright-Patt': ('BAE Systems', 'AF DCGS Tech Refresh', 'Dayton', 'NASIC'),
    'Navy DCGS-N': ('Lockheed Martin', 'DCGS-N Sustainment', 'Norfolk', 'NAVSEA/NIWC'),
    'Army DCGS-A': ('Raytheon', 'Army DCGS-A Modernization', 'Fort Belvoir', 'PEO IEW&S'),
}

SITE_NAMES = {
    'San Diego': 'PACAF San Diego Node',
    'Hampton': 'DGS-1 Langley',
    'Norfolk': 'Norfolk Naval Station',
    'Virginia Beach': 'Dam Neck NSWC',
    'Dayton': 'Wright-Patterson AFB / NASIC',
}

PAIN_POINTS_SHORT = {
    'AF DCGS - PACAF': 'the San Diego site has unique challenges being remote from HQ with acting leadership stretched thin',
    'AF DCGS - Langley': 'the high ISR tempo creates significant staffing pressure',
    'AF DCGS - Wright-Patt': 'the tech refresh timeline is creating urgent DevSecOps and engineering needs',
    'Navy DCGS-N': 'Norfolk talent competition makes cleared positions tough to fill',
    'Army DCGS-A': 'INSCOM coordination and surge requirements are challenging',
}
```

### Complete Excel Generation Script

```python
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import get_column_letter
import pandas as pd

# Load data
contacts_df = pd.read_excel('/home/claude/DCGS_BD_Call_Sheet_FINAL.xlsx', sheet_name='Priority Call Sheet')
jobs_df = pd.read_csv('/home/claude/jobs_maximum_enrichment.csv')
dcgs_jobs = jobs_df[jobs_df['DCGS Relevant'] == 'Yes'].copy()

def get_open_jobs_for_location(city, program):
    jobs = []
    city_lower = str(city).lower()
    
    for _, job in dcgs_jobs.iterrows():
        job_loc = str(job.get('Location', '')).lower()
        if city_lower in job_loc:
            jobs.append({
                'title': job['Job Title'],
                'clearance': job['Clearance'],
            })
    return jobs[:4]

# Build merge data
merge_data = []

for _, contact in contacts_df.iterrows():
    name = contact.get('Name', '')
    first_name = str(name).split()[0] if name else ''
    title = contact.get('Title', '')
    tier = contact.get('Tier', '')
    program = contact.get('Program', '')
    city = contact.get('City', '')
    email = contact.get('Email', '')
    
    matching_jobs = get_open_jobs_for_location(city, program)
    has_matching_jobs = len(matching_jobs) > 0
    template_id = determine_template(tier, has_matching_jobs)
    
    company = 'GDIT'
    comp_info = COMPETING_PRIMES.get(program, ('BAE Systems', 'Defense Programs', city, 'DoD'))
    site_name = SITE_NAMES.get(city, f"{city} Site")
    pain_point = PAIN_POINTS_SHORT.get(program, 'staffing challenges')
    
    title_lower = str(title).lower()
    if 'director' in title_lower or 'vp' in title_lower:
        role_context = f"leading the {program} program"
    elif 'manager' in title_lower or 'lead' in title_lower:
        role_context = f"managing operations"
    else:
        role_context = f"supporting the program"
    
    if matching_jobs:
        open_jobs = '; '.join([f"{j['title'][:30]} ({j['clearance']})" for j in matching_jobs[:3]])
        job_title = matching_jobs[0]['title']
        job_clearance = matching_jobs[0]['clearance']
    else:
        open_jobs = 'various technical positions'
        job_title = 'Engineering Positions'
        job_clearance = 'TS/SCI'
    
    if 'network' in title_lower:
        contractor_title = 'Network Engineer'
    elif 'security' in title_lower:
        contractor_title = 'Security Engineer'
    else:
        contractor_title = 'Systems Engineer'
    
    merge_data.append({
        'Template': template_id,
        'Template_Name': TEMPLATES[template_id]['name'],
        'Priority': contact.get('Priority', ''),
        'Tier': tier,
        'Program': program,
        'Full_Name': name,
        'First_Name': first_name,
        'Title': title,
        'Email': email,
        'Phone': contact.get('Phone', ''),
        'City': city,
        'Company': company,
        'PTS_Programs': PTS_PROGRAMS,
        'Competing_Prime': comp_info[0],
        'Competing_Program': comp_info[1],
        'Customer_Unit': comp_info[3],
        'Site_Name': site_name,
        'Role_Context': role_context,
        'Pain_Point_Short': pain_point,
        'Has_Matching_Jobs': 'Yes' if has_matching_jobs else 'No',
        'Open_Jobs': open_jobs,
        'Job_Title': job_title,
        'Job_Clearance': job_clearance,
        'Contractor_Title': contractor_title,
        'Subject_Intro': f"PTS + {company} | Approved Supplier Introduction",
        'Subject_Job': f"{job_title[:30]} Candidates | {city}",
        'Subject_Site': f"{program} Staffing Support | {city}",
        'Subject_HUMINT': f"{program} | Quick Question",
    })

merge_df = pd.DataFrame(merge_data)

# Create workbook with 7 sheets
wb = Workbook()

# Sheet 1: Email Templates (full text)
# Sheet 2: Email Merge Data (all 232 contacts with all fields)
# Sheet 3: Template A - Intro (8 contacts)
# Sheet 4: Template B - Job Specific (76 contacts)
# Sheet 5: Template C - Site Pain (16 contacts)
# Sheet 6: Template D - HUMINT (132 contacts)
# Sheet 7: Summary statistics

wb.save('/mnt/user-data/outputs/DCGS_Email_Campaign_Templates.xlsx')
```

---

## 5. NOTION DATABASE SCHEMAS

### GDIT Jobs Database Schema
```
Database: GDIT Jobs
Collection ID: 2ccdef65-baa5-80b0-9a80-000bd2745f63

Properties:
- Name (title): Job requisition identifier
- Job Title (text): Position title
- Program (select): 
  Options: BICES, BICES-X, JUSTIFIED, ISEE, DEOS, CBOSS, NCIS, NSST, 
           CMS, BAO, MPCO, INSCOM, SITEC, SCITES, WARHAWK, Other, 
           JSP ETM, AFNORTH, DLA, F-35 JSF, DHA D2D, CENTCOM, ADCS4, 
           DSMS, ADCNOMS
- Status (select):
  Options: Open, Accepting Candidates, Placed, Lost to Competition, 
           Filled by Client, Offer Out, Filled
- Open/Closed (select): Open, Closed, Filled by Client
- Location (text): Job location
- Employment Type (select): Contract, Contract To Hire, Direct Hire, Scout, Closed
- Contact (text): GDIT POC name
- Reporting Manager (text): Hiring manager
- Client Bill Rate (text): Billing rate
- Pay Rate (text): Pay rate offered
- Salary (text): Annual salary if applicable
- Date Added (date): When job was added
- Owner (text): PTS recruiter assigned
- Perm Fee (%) (text): Placement fee percentage
```

### DCGS Contacts Full Schema
```
Database: DCGS Contacts Full
Collection ID: 2ccdef65-baa5-8087-a53b-000ba596128e

Properties:
- Name (title): Full name
- Program (select):
  Options: AF DCGS - Langley, AF DCGS - Wright-Patt, AF DCGS - PACAF, 
           AF DCGS - Other, Army DCGS-A, Navy DCGS-N, Corporate HQ, 
           Enterprise Security, Unassigned
- Hierarchy Tier (select):
  Options: Tier 1 - Executive, Tier 2 - Director, Tier 3 - Program Leadership,
           Tier 4 - Management, Tier 5 - Senior IC, Tier 6 - Individual Contributor
- BD Priority (select):
  Options: 🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard
- Location Hub (select):
  Options: Hampton Roads, San Diego Metro, DC Metro, Dayton/Wright-Patt, 
           Other CONUS, OCONUS, Unknown
- Functional Area (multi-select):
  Options: Program Management, Network Engineering, Cyber Security, 
           ISR/Intelligence, Systems Administration, Software Engineering,
           Field Service, Security/FSO, Business Development, Training, Administrative
- Email (email)
- Phone (phone)
- LinkedIn (url)
- Title (text)
- City (text)
- State (text)
```

---

## 6. ACTIVE GDIT PROGRAMS REFERENCE

### Currently Hiring (262 Open Positions)
| Program | Open | Status | Key Locations |
|---------|------|--------|---------------|
| BICES / BICES-X | 49 | 🟢 ACTIVE | Norfolk, Tampa, Springfield, Langley |
| JUSTIFIED | 39 | 🟢 ACTIVE | Pentagon, Hanscom, JBAB, Eglin, Beale |
| INSCOM / I2TS4 | 36 | 🟢 ACTIVE | Fort Belvoir, Fort Meade |
| GSM-O / DEOS | 16 | 🟢 ACTIVE | Chantilly, Fort Meade, Durham |
| ISEE | 16 | 🟢 ACTIVE | Annapolis Junction, Sterling |
| MPCO | 6 | 🟢 ACTIVE | Tampa, Norfolk, Colorado Springs |
| CBOSS | 4 | 🟢 ACTIVE | Various |
| NCIS | 3 | 🟢 ACTIVE | Quantico, San Diego |
| SITEC | 3 | 🟢 ACTIVE | Various |
| SCITES | 3 | 🟢 ACTIVE | Various |
| JSP ETM | 2 | 🟢 ACTIVE | Pentagon area |
| WARHAWK | 1 | 🟢 ACTIVE | Remote |
| DLA | 1 | 🟢 ACTIVE | Various |
| CENTCOM | 1 | 🟢 ACTIVE | Tampa |
| MPE | 1 | 🟢 ACTIVE | Langley |
| BIM | 1 | 🟢 ACTIVE | Hawaii/Alaska |

### Inactive Programs (No Current Openings)
- NSST, CMS, BAO, AFNORTH, F-35 JSF, ADCS4

---

## 7. LINKEDIN CONNECTION TEMPLATES

### Standard Template (274 characters)
```
Hi {{FirstName}} – congrats on the {{Achievement}}! I'm with Prime Technical Services, an approved GDIT supplier currently supporting BICES, INSCOM, NCIS & JUSTIFIED with 180+ open positions. Given your {{Experience_Reference}}, I'd love to connect.
```

### Contact-Specific Examples

**Matt Daly (Director, Torpedo Programs)**
```
Hi Matt – congrats on the Director role! I'm with Prime Technical Services, an approved GDIT supplier currently supporting BICES, INSCOM, NCIS & JUSTIFIED with 180+ open positions. Given your 11 years on LCS Sustainment in San Diego, I'd love to connect.
```

**Brandon Bishop (Site Lead, San Diego)**
```
Hi Brandon – I'm George with Prime Technical Services, a GDIT approved supplier on BICES, INSCOM & NCIS. I see you're leading 25 contractors at the San Diego site – I'd love to connect and learn about any staffing challenges you're seeing. Just left you a VM.
```

---

## 8. PROBLEMS SOLVED

### Problem 1: Contact Misclassification
**Description:** Matt Daly was listed as AF DCGS - PACAF in San Diego, but LinkedIn revealed he's actually Navy Torpedo programs in Pennsylvania

**Root Cause:** Automated location-based classification without role verification

**Solution:** LinkedIn profile verification required for high-priority contacts before outreach

### Problem 2: Inactive Program References
**Description:** Initial messaging included programs with no current openings (CMS, BAO, F-35 JSF)

**Root Cause:** Using total historical placements vs. current open positions

**Solution:** Query GDIT Jobs database for `Open/Closed = 'Open'` before generating messaging

### Problem 3: Generic Template Messaging
**Description:** All contacts receiving same generic pitch regardless of role

**Root Cause:** Single template approach

**Solution:** Four-template segmentation based on hierarchy tier + job matching

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate Actions
1. ✅ Email templates created and exported
2. ✅ LinkedIn connection notes personalized
3. ⏳ Execute outreach to 39 Critical PACAF contacts
4. ⏳ Import email tracking to Notion CRM
5. ⏳ Schedule follow-ups based on response rates

### Future Enhancements
1. Automate LinkedIn profile verification for all Tier 1-3 contacts
2. Build n8n workflow for email response tracking
3. Expand template system to other GDIT programs beyond DCGS
4. Create automated job scrape → template refresh pipeline

---

## 10. KEY INSIGHTS & GOTCHAS

### Critical Learnings

1. **Always verify LinkedIn profiles before executive outreach**
   - Matt Daly example: Listed as PACAF San Diego, actually Torpedo Director in Pennsylvania
   - ZoomInfo data can be 6+ months stale

2. **Only reference ACTIVE programs in messaging**
   - Query for `Open/Closed = 'Open'` before generating templates
   - Currently 262 open positions across 16 programs

3. **San Diego PACAF is highest priority**
   - All 39 contacts marked Critical
   - Site has acting leadership, single points of failure
   - Pain point messaging resonates strongly

4. **HUMINT before executives**
   - 132 contacts assigned Template D (relationship building)
   - Lower-tier contacts provide intel on hiring managers, pain points
   - Build credibility before approaching decision-makers

5. **Navy background opens doors**
   - Brandon Bishop: 25-year Navy veteran running 25 contractors
   - Reference PTS veteran-focused approach
   - Military-to-military credibility matters

### Database Performance Notes
- Notion databases degrade above 1,000 records
- DCGS Contacts split: 965 DCGS-specific + 1,052 GDIT Other
- Use CSV export/import for bulk operations

### Email Deliverability
- Keep LinkedIn connection notes under 300 characters
- Pre-built subject lines in merge data
- Avoid spam trigger words in templates

---

## 11. FILES CREATED

| File | Location | Purpose |
|------|----------|---------|
| `DCGS_BD_Call_Sheet_FINAL.xlsx` | /mnt/user-data/outputs/ | 5-sheet call sheet with 232 contacts |
| `DCGS_Email_Campaign_Templates.xlsx` | /mnt/user-data/outputs/ | 7-sheet email template workbook |
| `jobs_maximum_enrichment.csv` | /home/claude/ | 275 jobs with 33-column enrichment |
| `all_jobs_enriched.csv` | /mnt/project/ | Full job enrichment data |

---

## 12. CONTACT PROFILES ANALYZED

### Matt Daly (Corrected Classification)
| Field | Value |
|-------|-------|
| Current Role | Director, Torpedo Programs @ GDMS |
| Previous | Program Manager, LCS Sustainment (11 years) |
| Location | Canonsburg, PA (not San Diego) |
| Program | Navy Torpedoes, NOT DCGS |
| Value | San Diego network connections, intro potential |

### Brandon Bishop (High Value Target)
| Field | Value |
|-------|-------|
| Role | Senior Training Specialist Site Lead |
| Location | San Diego (PACAF) |
| Team | Manages 25 contractors/subcontractors |
| Background | 25 years US Navy |
| Focus | Fleet training, fiber optics |
| Priority | 🔥 CRITICAL - knows all staffing gaps |

---

*Document generated: January 10, 2026*
*Export from Claude conversation - PTS DCGS Business Development Project*
