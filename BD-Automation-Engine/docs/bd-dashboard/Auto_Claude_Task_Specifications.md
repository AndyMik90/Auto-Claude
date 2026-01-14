# Auto Claude Task Specifications
## BD Intelligence Dashboard Implementation

**Total Estimated Implementation Time:** 8 weeks (4 phases)
**Priority:** Critical - Core BD Automation Infrastructure

---

## TASK 1: Data Correlation Engine
**Phase:** 1 (Week 1-2)
**Complexity:** High
**Dependencies:** Existing CSV/JSON data files

### Objective
Build a Python-based data processing pipeline that correlates data across all sources and generates unified JSON files for the dashboard.

### Input Files (from /mnt/project/)
```
- jobs_fully_enriched.csv           # Enriched job data
- DCGS_Contact_Spreadsheet*.csv     # Contact exports
- Federal_Program_Cleaned_Notion_Import.csv  # Program data
- GDIT_Jobs.csv                     # Bullhorn jobs
```

### Output Files
```
/output/data/
├── jobs_intelligence.json          # All enriched jobs with full BD context
├── contacts_actionable.json        # Contacts with BD Formula messaging
├── programs_complete.json          # Program intelligence
├── primes_relationships.json       # Company portfolios
├── locations_hub.json              # Geographic grouping
├── customers_agencies.json         # Agency profiles
├── contractors_bench.json          # PTS talent pool
└── daily_playbook.json             # Generated action list
```

### Processing Logic

**Job Enrichment:**
```python
for each job:
    1. Match to program (by location + keywords)
    2. Find contacts at that program/site
    3. Match PTS past performance (by program similarity)
    4. Calculate BD score (0-100)
    5. Identify pain points (from HUMINT database)
    6. Generate BD Formula messaging
```

**Contact Classification:**
```python
for each contact:
    1. Classify hierarchy tier (1-6) from job title
    2. Assign program (by location mapping)
    3. Calculate BD priority (🔴🟠🟡⚪)
    4. Assign location hub
    5. Generate personalized opener
    6. Compile full BD Formula message
```

### Success Criteria
- [ ] All JSON files generate without errors
- [ ] 100% of jobs have program linkage
- [ ] 100% of contacts have BD messaging
- [ ] Daily playbook has 8-15 prioritized actions

---

## TASK 2: React Dashboard Application
**Phase:** 1-2 (Week 1-4)
**Complexity:** High
**Dependencies:** Task 1 JSON outputs

### Objective
Build a single-page React application with 8 tabs displaying BD intelligence data.

### Technical Stack
```
- React 18+
- Tailwind CSS
- No backend (JSON file loading)
- Responsive design
```

### Tab Components
```
1. JobsTab.jsx           # Job intelligence grid + cards
2. ProgramsTab.jsx       # Program overview cards
3. PrimesTab.jsx         # Company relationship view
4. LocationsTab.jsx      # Geographic grouping
5. CustomersTab.jsx      # Agency profiles
6. ContactsTab.jsx       # BD-ready contact cards
7. ContractorsTab.jsx    # PTS bench + job matching
8. PlaybookTab.jsx       # Daily action list
```

### Shared Components
```
- TabNavigation.jsx      # Tab bar with counts
- DataGrid.jsx           # Sortable/filterable table
- JobCard.jsx            # Job intelligence display
- ContactCard.jsx        # Contact with BD messaging
- PriorityBadge.jsx      # 🔴🟠🟡⚪ color coding
- FilterBar.jsx          # Search and filter controls
- ExportButton.jsx       # Excel/PDF export
```

### Design System (CSS Variables)
```css
--pts-navy: #1e3a5f;
--priority-critical: #e53e3e;
--priority-high: #dd6b20;
--priority-medium: #d69e2e;
--priority-standard: #718096;
```

### Success Criteria
- [ ] All 8 tabs functional and displaying data
- [ ] Filtering and sorting work correctly
- [ ] Export to Excel functional
- [ ] Responsive on desktop/tablet/mobile
- [ ] Professional PTS-branded appearance

---

## TASK 3: BD Formula Generator
**Phase:** 2 (Week 3-4)
**Complexity:** Medium
**Dependencies:** Contact + Program data

### Objective
Create a Python module that generates personalized BD outreach messages following the 6-step PTS BD Formula.

### Input Per Contact
```python
{
    "name": "Kingsley Ero",
    "title": "Acting Site Lead",
    "tier": 3,
    "program": "AF DCGS - PACAF",
    "location": "San Diego, CA",
    "company": "GDIT"
}
```

### Output Per Contact
```python
{
    "personalized_opener": "...",
    "pain_point_reference": "...",
    "labor_gap_reference": "...",
    "pts_gdit_past_perf": "...",
    "program_alignment": "...",
    "role_alignment": "...",
    "email_message": "...",
    "linkedin_message": "...",
    "call_script": "..."
}
```

### BD Formula Implementation
```python
def generate_bd_formula(contact, program_data, job_data, pts_past_perf):
    # Step 1: Personalized opener
    opener = f"Given your work supporting {program_data['name']} at {contact['location']}..."
    
    # Step 2: Pain point reference (from HUMINT)
    pain_points = program_data.get('pain_points', [])
    pain_ref = f"I understand {program_data['name']} teams are dealing with {pain_points[0]}..."
    
    # Step 3: Labor gaps (from active jobs)
    jobs_at_location = filter_jobs_by_location(job_data, contact['location'])
    labor_ref = f"I see your team has open positions for {jobs_at_location[0]['title']}..."
    
    # Step 4: PTS-GDIT past performance
    gdit_perf = filter_past_perf(pts_past_perf, 'GDIT')
    gdit_ref = f"PTS has supported GDIT on {gdit_perf[0]} since 2018..."
    
    # Step 5: Program alignment
    similar = find_similar_programs(program_data, pts_past_perf)
    program_ref = f"Our work on {similar[0]} aligns with your ISR mission..."
    
    # Step 6: Role alignment
    role_ref = f"For {contact['title']} support, we've placed similar roles..."
    
    return compile_messages(contact['tier'], opener, pain_ref, labor_ref, 
                           gdit_ref, program_ref, role_ref)
```

### Tone by Tier
```python
TONE_CONFIG = {
    1: {"tone": "strategic", "length": "short", "focus": "value"},
    2: {"tone": "strategic", "length": "short", "focus": "partnership"},
    3: {"tone": "professional", "length": "medium", "focus": "results"},
    4: {"tone": "collaborative", "length": "medium", "focus": "solutions"},
    5: {"tone": "friendly", "length": "short", "focus": "mission"},
    6: {"tone": "curious", "length": "short", "focus": "team"}
}
```

### Success Criteria
- [ ] All contacts have personalized messages
- [ ] Messages follow BD Formula exactly
- [ ] Tone appropriate to tier
- [ ] No generic/template placeholders remain

---

## TASK 4: Daily Playbook Generator
**Phase:** 4 (Week 7-8)
**Complexity:** Medium
**Dependencies:** Tasks 1-3

### Objective
Create a script that runs daily to generate the prioritized action list for BD outreach.

### Output: daily_playbook.json
```json
{
    "date": "2026-01-13",
    "generated_at": "2026-01-13T06:00:00Z",
    "summary": {
        "total_actions": 15,
        "calls": 8,
        "emails": 5,
        "meetings": 2
    },
    "call_sequence": [
        {
            "order": 1,
            "contact": "Kingsley Ero",
            "tier": 3,
            "priority": "🔴",
            "program": "AF DCGS - PACAF",
            "phone": "(555) 123-4567",
            "script": "Hi Kingsley, this is [Name] from Prime Technical Services...",
            "pain_points": ["Acting lead stretched thin"],
            "jobs_to_reference": ["Network Engineer (2)"],
            "pts_alignment": "BICES network engineers",
            "goal": "Schedule capability brief"
        }
    ],
    "email_queue": [...],
    "meetings": [...]
}
```

### Prioritization Algorithm
```python
def prioritize_contacts(contacts, jobs):
    # Critical: Tier 1-2, PACAF site, active hiring managers
    critical = [c for c in contacts if 
                c['tier'] in [1,2] or 
                c['program'] == 'AF DCGS - PACAF' or
                is_hiring_manager(c)]
    
    # High: Tier 3 PMs, programs with 3+ active jobs
    high = [c for c in contacts if 
            c['tier'] == 3 or 
            count_jobs_by_program(jobs, c['program']) >= 3]
    
    # Medium: Tier 4 managers
    medium = [c for c in contacts if c['tier'] == 4]
    
    # Standard: Tier 5-6 (HUMINT gathering)
    standard = [c for c in contacts if c['tier'] in [5,6]]
    
    return critical[:5] + high[:3] + medium[:3] + standard[:4]
```

### Success Criteria
- [ ] Playbook generates automatically
- [ ] Max 8 calls per day
- [ ] All actions have complete scripts
- [ ] Call sequence optimized by program variety

---

## TASK 5: Job Intelligence Cards
**Phase:** 2 (Week 3-4)
**Complexity:** Medium
**Dependencies:** React Dashboard (Task 2)

### Objective
Build the JobCard React component that displays complete BD context for each job opportunity.

### Card Sections
```
┌────────────────────────────────────────────┐
│ [Job Title]                    Score: [XX] │
│ 📍 [Location] | 🔐 [Clearance] | [Priority]│
├────────────────────────────────────────────┤
│ PROGRAM INTELLIGENCE                       │
│ • Program: [Name]                          │
│ • Task Order: [TO]                         │
│ • Customer: [Agency] | Prime: [Company]    │
├────────────────────────────────────────────┤
│ KEY CONTACTS                               │
│ • Site Lead: [Name] - 🔴                   │
│ • Hiring Mgr: [Name] - 🟠                  │
├────────────────────────────────────────────┤
│ PTS ALIGNMENT                              │
│ • Past Perf: [Programs]                    │
│ • Contractors: [N] matching                │
├────────────────────────────────────────────┤
│ PAIN POINTS                                │
│ • [Pain point 1]                           │
├────────────────────────────────────────────┤
│ BD MESSAGE                                 │
│ "[Personalized opener...]"                 │
│                        [Copy] [View Full]  │
└────────────────────────────────────────────┘
```

### Props Interface
```typescript
interface JobCardProps {
    job: {
        job_title: string;
        location: string;
        clearance: string;
        bd_score: number;
        bd_priority: '🔴' | '🟠' | '🟡' | '⚪';
        matched_program: string;
        task_order: string;
        customer: string;
        prime_contractor: string;
        site_lead: ContactSummary;
        hiring_manager: ContactSummary;
        pts_past_performance: string[];
        available_contractors: number;
        pain_points: string[];
        bd_message: string;
    };
    onCopyMessage: () => void;
    onViewDetails: () => void;
}
```

### Success Criteria
- [ ] All job data fields displayed
- [ ] Priority color-coding works
- [ ] Copy message functionality works
- [ ] Expand/collapse for long content

---

## TASK 6: Contact Cards with BD Formula
**Phase:** 2 (Week 3-4)
**Complexity:** Medium
**Dependencies:** BD Formula Generator (Task 3)

### Objective
Build the ContactCard React component with full BD messaging ready to use.

### Card Sections
```
┌────────────────────────────────────────────┐
│ [Avatar] [Name]                   [Tier]   │
│          [Title] @ [Company]     [Priority]│
├────────────────────────────────────────────┤
│ 📍 [Location] ([Program])                  │
│ 📧 [email@domain.com]                      │
│ 📞 [phone number]                          │
│ 🔗 [LinkedIn]                              │
├────────────────────────────────────────────┤
│ ⚠️ PAIN POINTS                             │
│ • [Pain point 1]                           │
│ • [Pain point 2]                           │
├────────────────────────────────────────────┤
│ 💬 PERSONALIZED OPENER                     │
│ "[Given your work supporting...]"          │
├────────────────────────────────────────────┤
│ [📞 Call] [📧 Email] [💼 LinkedIn] [📋 All]│
└────────────────────────────────────────────┘
```

### Click Actions
- **Call Script**: Modal with full phone script
- **Email**: Modal with complete email + copy button
- **LinkedIn**: Modal with connection request (300 char)
- **Copy All**: Copy entire BD Formula to clipboard

### Success Criteria
- [ ] All contact fields displayed
- [ ] BD messages properly formatted
- [ ] Copy functionality works
- [ ] Click-to-call/email links work

---

## TASK 7: Export Functionality
**Phase:** 3 (Week 5-6)
**Complexity:** Medium
**Dependencies:** Dashboard populated with data

### Objective
Implement export to Excel, PDF, and call sheet formats.

### Excel Call Sheet Export
```python
# Using openpyxl
def export_call_sheet(contacts, output_path):
    wb = Workbook()
    ws = wb.active
    ws.title = "Priority Contacts"
    
    # Headers
    headers = ['Priority', 'Name', 'Title', 'Program', 'Location', 
               'Phone', 'Email', 'LinkedIn', 'Personalized Message',
               'Notes', 'Follow-Up Date']
    ws.append(headers)
    
    # Style headers
    for cell in ws[1]:
        cell.fill = PatternFill('solid', fgColor='1E3A5F')
        cell.font = Font(color='FFFFFF', bold=True)
    
    # Add contacts by priority group
    for contact in contacts:
        row = [
            contact['bd_priority'],
            contact['full_name'],
            contact['job_title'],
            contact['program'],
            contact['location'],
            contact['phone'],
            contact['email'],
            contact['linkedin'],
            contact['personalized_opener'][:200],
            '',  # Notes (empty)
            ''   # Follow-up (empty)
        ]
        ws.append(row)
    
    wb.save(output_path)
```

### Priority Color Formatting
```python
PRIORITY_COLORS = {
    '🔴 Critical': 'FFF5F5',
    '🟠 High': 'FFFAF0',
    '🟡 Medium': 'FFFFF0',
    '⚪ Standard': 'F7FAFC'
}
```

### Success Criteria
- [ ] Excel export creates valid .xlsx file
- [ ] Priority color-coding preserved
- [ ] All contact fields exported
- [ ] Phone numbers formatted correctly

---

## FILE STRUCTURE

```
bd-intelligence-dashboard/
├── public/
│   └── index.html
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── TabNavigation.jsx
│   │   │   ├── Header.jsx
│   │   │   └── FilterBar.jsx
│   │   ├── cards/
│   │   │   ├── JobCard.jsx
│   │   │   ├── ContactCard.jsx
│   │   │   ├── ProgramCard.jsx
│   │   │   └── PlaybookItem.jsx
│   │   └── common/
│   │       ├── PriorityBadge.jsx
│   │       ├── TierBadge.jsx
│   │       └── ExportButton.jsx
│   ├── tabs/
│   │   ├── JobsTab.jsx
│   │   ├── ProgramsTab.jsx
│   │   ├── PrimesTab.jsx
│   │   ├── LocationsTab.jsx
│   │   ├── CustomersTab.jsx
│   │   ├── ContactsTab.jsx
│   │   ├── ContractorsTab.jsx
│   │   └── PlaybookTab.jsx
│   ├── data/
│   │   └── *.json (generated by Task 1)
│   ├── utils/
│   │   ├── dataLoader.js
│   │   ├── filtering.js
│   │   ├── sorting.js
│   │   └── export.js
│   ├── App.jsx
│   └── index.jsx
├── scripts/
│   ├── data_export.py
│   ├── correlation_engine.py
│   ├── bd_formula_generator.py
│   └── daily_playbook_generator.py
├── package.json
└── README.md
```

---

## EXECUTION ORDER

```
Week 1-2 (Phase 1):
├── TASK 1: Data Correlation Engine
└── TASK 2: React Dashboard Shell

Week 3-4 (Phase 2):
├── TASK 3: BD Formula Generator
├── TASK 5: Job Intelligence Cards
└── TASK 6: Contact Cards

Week 5-6 (Phase 3):
├── TASK 7: Export Functionality
├── Programs Tab Complete
├── Primes Tab Complete
└── Customers Tab Complete

Week 7-8 (Phase 4):
├── TASK 4: Daily Playbook Generator
├── Locations Tab Complete
├── Contractors Tab Complete
└── Final Integration Testing
```

---

## REFERENCE DATA

### Collection IDs
```
DCGS Contacts Full:     2ccdef65-baa5-8087-a53b-000ba596128e
GDIT Other Contacts:    70ea1c94-211d-40e6-a994-e8d7c4807434
GDIT Jobs:              2ccdef65-baa5-80b0-9a80-000bd2745f63
Program Mapping Hub:    f57792c1-605b-424c-8830-23ab41c47137
Federal Programs:       06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
```

### Priority Programs (🔴 Critical)
```
AF DCGS - PACAF (San Diego) - $500M - Highest Priority
AF DCGS - Langley (Hampton) - DGS-1 Headquarters
AF DCGS - Wright-Patt (Dayton) - NASIC
Army DCGS-A (Belvoir, Detrick, Aberdeen) - $300M
Navy DCGS-N (Norfolk, Suffolk, Tracy) - $150M
```

### PTS Past Performance
```
GDIT Direct:
- BICES / BICES-X (Norfolk, Tampa)
- GSM-O II (DISA)
- NATO BICES

Similar Programs:
- SOCOM JICCENT (ISR)
- Platform One (USAF DevSecOps)
- DIA I2OS
- DISA JRSS
```

---

**END OF TASK SPECIFICATIONS**
