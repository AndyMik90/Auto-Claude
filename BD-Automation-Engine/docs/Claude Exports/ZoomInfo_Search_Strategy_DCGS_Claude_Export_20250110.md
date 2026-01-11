# ZoomInfo Search Strategy for DCGS BD Campaign
## Claude Conversation Export - January 10, 2025

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
ZoomInfo Contact Search Strategy for GDIT DCGS (Distributed Common Ground System) Business Development Campaign

### Date Range
January 10, 2025

### Primary Objective
Analyze existing Notion database coverage across DCGS programs (AF, Army, Navy) and identify ZoomInfo search gaps to optimize export credit usage. The goal was to create a prioritized list of ZoomInfo searches that would fill contact gaps in the DCGS Contacts Full database for the PTS BD campaign targeting ~$950M in GDIT DCGS contracts.

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Priority-Based Search Strategy
- **Decision**: Organized ZoomInfo searches into 6 priority tiers based on coverage gaps
- **Reasoning**: Army DCGS-A had only ~5-10 contacts vs. 300+ for other programs - critical gap given $300M program value
- **Alternatives Considered**: Broad searches across all locations (rejected - would waste credits on already-covered areas)

### Decision 2: Multi-Location Query Structure
- **Decision**: Use compound queries combining Company + Location + Title filters
- **Reasoning**: More precise results, better credit efficiency, easier deduplication against existing data
- **Alternatives Considered**: Single broad company search (rejected - too many irrelevant results)

### Decision 3: Named Target Verification
- **Decision**: Include specific name searches for 6 key contacts mentioned in HUMINT playbooks
- **Reasoning**: Verify critical decision-makers (Kingsley Ero, Craig Lindahl, etc.) are in database
- **Alternatives Considered**: Assume existing contacts are correct (rejected - data quality issues previously found)

### Decision 4: Functional Role Mapping
- **Decision**: Create role-specific searches matching known hiring gaps (Network Engineers, Cyber Analysts, DevSecOps)
- **Reasoning**: Enables targeted outreach to contacts whose teams are actively hiring
- **Alternatives Considered**: Generic title searches (rejected - misses the labor gap intelligence angle)

---

## 3. ARCHITECTURE & DATA FLOW

### Database Coverage Analysis Flow
```
Notion DCGS Contacts Full Database
         │
         ▼
   Claude MCP Search
   (notion-search tool)
         │
         ▼
   Location Analysis
   ┌─────────────────────────────────────────────────────┐
   │ Program          │ Contacts │ Tier 1-3 │ Gap Level │
   ├─────────────────────────────────────────────────────┤
   │ AF DCGS - PACAF  │ ~60-80   │ Good     │ 🟢 LOW    │
   │ AF DCGS - Langley│ ~80-100  │ Good     │ 🟢 LOW    │
   │ AF DCGS - W-Patt │ ~30-40   │ Moderate │ 🟡 MEDIUM │
   │ Navy DCGS-N      │ ~50-70   │ Good     │ 🟢 LOW    │
   │ Army DCGS-A      │ ~5-10    │ POOR     │ 🔴 CRITICAL│
   │ Corporate HQ     │ ~200+    │ Good     │ 🟢 LOW    │
   └─────────────────────────────────────────────────────┘
         │
         ▼
   ZoomInfo Search Strategy
         │
         ▼
   CSV Export → Dedup → Notion Import
```

### Data Sources Analyzed
| Source | Collection ID | Record Count |
|--------|---------------|--------------|
| DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | ~965 |
| GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | ~1,052 |
| GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | ~700 |
| Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | 388 |
| Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Variable |

---

## 4. CODE & CONFIGURATIONS

### Notion MCP Search Queries Used

#### Query 1: San Diego/PACAF Coverage Check
```
Tool: Notion:notion-search
Parameters:
  data_source_url: collection://2ccdef65-baa5-8087-a53b-000ba596128e
  query: "San Diego PACAF"
Result: ~70 contacts found with good Tier 1-3 coverage
```

#### Query 2: Langley/Hampton Coverage Check
```
Tool: Notion:notion-search
Parameters:
  data_source_url: collection://2ccdef65-baa5-8087-a53b-000ba596128e
  query: "Langley Hampton AF DCGS"
Result: ~100 contacts found with good coverage
```

#### Query 3: Wright-Patterson Coverage Check
```
Tool: Notion:notion-search
Parameters:
  data_source_url: collection://2ccdef65-baa5-8087-a53b-000ba596128e
  query: "Wright-Patterson Dayton AF DCGS NASIC"
Result: ~40 contacts found - moderate gap identified
```

#### Query 4: Navy DCGS-N Coverage Check
```
Tool: Notion:notion-search
Parameters:
  data_source_url: collection://2ccdef65-baa5-8087-a53b-000ba596128e
  query: "Norfolk Navy DCGS-N Suffolk Tracy"
Result: ~60 contacts found with good coverage
```

#### Query 5: Army DCGS-A Coverage Check
```
Tool: Notion:notion-search
Parameters:
  data_source_url: collection://2ccdef65-baa5-8087-a53b-000ba596128e
  query: "Army DCGS-A Fort Belvoir Aberdeen Fort Detrick"
Result: Only Jeffrey Bartsch well-documented - CRITICAL GAP
```

---

## 5. NOTION DATABASE SCHEMAS

### DCGS Contacts Full Database Schema

**Database ID**: `2ccdef65-baa5-8087-a53b-000ba596128e`

| Property | Type | Options/Format |
|----------|------|----------------|
| Last Name | Title | - |
| First Name | Text | - |
| Job Title | Text | - |
| Email Address | Email | - |
| Phone Number | Phone | - |
| Direct Phone Number | Phone | - |
| Mobile phone | Phone | - |
| Person City | Text | - |
| Person State | Text | - |
| LinkedIn Contact Profile URL | URL | - |
| Program | Select | `AF DCGS - Langley`, `AF DCGS - Wright-Patt`, `AF DCGS - PACAF`, `AF DCGS - Other`, `Army DCGS-A`, `Navy DCGS-N`, `Corporate HQ`, `Enterprise Security`, `Unassigned` |
| Hierarchy Tier | Select | `Tier 1 - Executive`, `Tier 2 - Director`, `Tier 3 - Program Leadership`, `Tier 4 - Management`, `Tier 5 - Senior IC`, `Tier 6 - Individual Contributor` |
| BD Priority | Select | `🔴 Critical`, `🟠 High`, `🟡 Medium`, `⚪ Standard` |
| Location Hub | Select | `Hampton Roads`, `San Diego Metro`, `DC Metro`, `Dayton/Wright-Patt`, `Other CONUS`, `OCONUS`, `Unknown` |
| Functional Area | Multi-Select | `Program Management`, `Network Engineering`, `Cyber Security`, `ISR/Intelligence`, `Systems Administration`, `Software Engineering`, `Field Service`, `Security/FSO`, `Business Development`, `Training`, `Administrative` |

### Classification Logic (Python Reference)

```python
# Hierarchy Tier Assignment
def get_hierarchy_tier(title):
    title_lower = title.lower()
    
    # Tier 1 - Executive
    if any(kw in title_lower for kw in ['vice president', 'vp,', 'vp ', 
           'president', 'chief ', 'ceo', 'cto', 'cio', 'ciso', 'cfo']):
        return 'Tier 1 - Executive'
    
    # Tier 2 - Director
    if 'director' in title_lower:
        return 'Tier 2 - Director'
    
    # Tier 3 - Program Leadership
    if any(kw in title_lower for kw in ['program manager', 'deputy program',
           'site lead', 'task order', 'program director', 'project director']):
        return 'Tier 3 - Program Leadership'
    
    # Tier 4 - Management
    if any(kw in title_lower for kw in ['manager', 'team lead', 'supervisor',
           'lead,', 'lead ', 'section chief']):
        return 'Tier 4 - Management'
    
    # Tier 5 - Senior IC
    if any(kw in title_lower for kw in ['senior ', 'sr.', 'sr ', 'principal',
           'lead engineer', 'staff engineer', 'architect']):
        return 'Tier 5 - Senior IC'
    
    # Tier 6 - Individual Contributor (default)
    return 'Tier 6 - Individual Contributor'

# Location to Program Mapping
LOCATION_TO_PROGRAM = {
    # AF DCGS - Langley (DGS-1)
    'Hampton': 'AF DCGS - Langley', 
    'Newport News': 'AF DCGS - Langley',
    'Langley': 'AF DCGS - Langley', 
    'Yorktown': 'AF DCGS - Langley',
    
    # AF DCGS - PACAF (San Diego)
    'San Diego': 'AF DCGS - PACAF', 
    'La Mesa': 'AF DCGS - PACAF',
    
    # AF DCGS - Wright-Patterson
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
    'Chantilly': 'Corporate HQ'
}

# BD Priority Assignment
def get_bd_priority(hierarchy_tier, program=None):
    # Critical: Executives + PACAF site
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

## 6. N8N WORKFLOWS

### Not Directly Discussed
This conversation focused on ZoomInfo search strategy, not n8n workflows. However, the recommended post-search workflow would be:

```
ZoomInfo Export (CSV)
         │
         ▼
   n8n Trigger (Webhook/File)
         │
         ▼
   Dedup Against Existing Data
   (Filter Node - Check DCGS Contacts Full)
         │
         ▼
   Apply Classification Logic
   (Code Node - Python/JS)
         │
         ▼
   Notion Create Pages
   (Notion Node - Batch Insert)
         │
         ▼
   Slack Notification
   (Summary of new contacts added)
```

---

## 7. APIFY ACTORS & SCRAPERS

### Not Primary Focus
This conversation referenced existing Apify scraping but focused on ZoomInfo. Existing setup from project knowledge:

| Actor | Purpose | Output |
|-------|---------|--------|
| Puppeteer Scraper | Job board scraping (Insight Global, TEKsystems, CACI) | JSON: title, company, location, clearance, URL |

---

## 8. PROBLEMS SOLVED

### Problem 1: Unknown Database Coverage
- **Description**: Unclear which DCGS locations/programs had adequate contact coverage
- **Root Cause**: No systematic analysis of existing Notion data by program
- **Solution**: Used Notion MCP search to query each program location and analyze results

### Problem 2: Army DCGS-A Critical Gap
- **Description**: Only Jeffrey Bartsch well-documented for $300M Army DCGS-A program
- **Root Cause**: Previous ZoomInfo pulls focused on AF DCGS and Navy
- **Solution**: Prioritized Army searches as P1 with 4 dedicated queries covering Fort Belvoir, Aberdeen, Fort Detrick

### Problem 3: Credit Optimization
- **Description**: Need to maximize value from limited ZoomInfo export credits
- **Root Cause**: Credits are expensive; broad searches waste resources
- **Solution**: Created 22 targeted searches with estimated 446-692 total results vs. potentially thousands from broad queries

### Problem 4: Verification of Key Contacts
- **Description**: Uncertainty whether priority targets from HUMINT playbooks existed in database
- **Root Cause**: Data quality issues discovered previously with misassigned contacts
- **Solution**: Added P6 Named Target searches for 6 key individuals

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate (Week 1)
- [ ] Execute all Army DCGS-A searches (#1-4) - Critical gap fill
- [ ] Execute Named Target searches (#17-22) - Verify key contacts
- [ ] Dedup results against existing DCGS Contacts Full database
- [ ] Import new unique contacts with proper classification

### Short-term (Week 2)
- [ ] Execute Executive/Director searches (#8-10)
- [ ] Execute Wright-Patterson searches (#5-7)
- [ ] Update BD Priority scores based on hiring activity

### Medium-term (Week 3)
- [ ] Execute Functional Role searches (#11-14)
- [ ] Execute Navy Depth searches (#15-16)
- [ ] Create call sheets for new contacts by program

### Future Considerations
- [ ] Build automated ZoomInfo → n8n → Notion pipeline
- [ ] Set up LinkedIn profile verification workflow for Tier 1-3 contacts
- [ ] Create duplicate detection rules for ongoing imports

---

## 10. KEY INSIGHTS & GOTCHAS

### Insight 1: Coverage Varies Dramatically by Program
The existing database has 60-200+ contacts for most programs but only 5-10 for Army DCGS-A. Always analyze coverage before assuming data exists.

### Insight 2: Location-Based Queries More Reliable
Searching by city + company yields more accurate results than searching by program keywords (e.g., "DCGS" may not appear in titles).

### Insight 3: Tier Classification Critical for BD Strategy
The HUMINT approach requires contacting Tier 5-6 ICs before Tier 1-2 executives. Must classify contacts before outreach.

### Gotcha 1: ZoomInfo Company Name Variations
Search both "GDIT" and "General Dynamics Information Technology" - records vary by which name is used.

### Gotcha 2: Location Granularity Matters
- "Hampton, VA" vs "Hampton, AR" - different states in results
- "Fort Belvoir" may be listed as "Springfield, VA" or "Fairfax, VA"

### Gotcha 3: Duplicate Risk
Running overlapping searches will return duplicates. Always dedup before import using Email + LinkedIn URL as unique keys.

### Gotcha 4: Title Variations
Same role may have many title formats:
- "Program Manager" vs "Sr. Program Manager" vs "Senior PM"
- Use broad title fragments in queries, then filter in post-processing

### Gotcha 5: Database Performance
Per project documentation: Notion databases degrade above 1,000 records. Current DCGS Contacts Full at ~965 - approaching limit. May need to strategically split before major import.

---

## 11. ZOOMINFO SEARCH SPECIFICATIONS (COMPLETE)

### Priority 1: Army DCGS-A (CRITICAL)

#### Search #1
```yaml
Company: "General Dynamics Information Technology"
Location: "Fort Belvoir, VA"
Title Contains: ["Program Manager", "Site Lead", "Manager", "Director"]
Expected Results: 20-40
Purpose: Army DCGS-A Leadership
```

#### Search #2
```yaml
Company: "GDIT"
Location: "Aberdeen Proving Ground, MD"
Title Contains: ["Engineer", "Analyst", "Administrator"]
Expected Results: 30-50
Purpose: Army site ICs
```

#### Search #3
```yaml
Company: "General Dynamics"
Location: "Fort Detrick, MD"
Department: ["Information Technology", "Engineering", "Operations"]
Expected Results: 15-25
Purpose: Fort Detrick team
```

#### Search #4
```yaml
Company: "GDIT"
Title Contains: ["DCGS-A", "Army Intelligence", "INSCOM"]
Expected Results: 10-20
Purpose: Army intel specific
```

### Priority 2: AF DCGS Wright-Patterson (MODERATE)

#### Search #5
```yaml
Company: "GDIT"
Location: "Dayton, OH"
Title Contains: ["Engineer", "Architect", "DevOps", "Developer"]
Expected Results: 40-60
Purpose: Wright-Patt technical
```

#### Search #6
```yaml
Company: "General Dynamics Information Technology"
Location: ["Beavercreek, OH", "Fairborn, OH"]
Department: "Engineering"
Expected Results: 20-30
Purpose: Extended Dayton area
```

#### Search #7
```yaml
Company: "GDIT"
Title Contains: ["NASIC", "Air Force", "ISR"]
Location: "Ohio"
Expected Results: 15-25
Purpose: AF ISR specific
```

### Priority 3: Executive/Director Tier

#### Search #8
```yaml
Company: "General Dynamics Information Technology"
Title Contains: ["Vice President", "VP", "Director"]
Department: ["Defense", "Intelligence", "ISR"]
Expected Results: 30-50
Purpose: Defense Intel Execs
```

#### Search #9
```yaml
Company: "GDIT"
Location: ["Herndon, VA", "Falls Church, VA", "Reston, VA"]
Title Contains: ["Director", "Vice President", "Chief"]
Expected Results: 40-60
Purpose: Corporate leadership
```

#### Search #10
```yaml
Company: "GDIT"
Title Contains: ["Program Director", "Deputy Program", "Portfolio"]
Keywords: ["DCGS", "ISR", "Intelligence"]
Expected Results: 20-30
Purpose: Program leadership
```

### Priority 4: Functional Role Gaps

#### Search #11
```yaml
Company: "GDIT"
Title Contains: ["Network Engineer", "Network Administrator", "CCNA", "CCNP"]
Location: ["San Diego, CA", "Hampton, VA", "Norfolk, VA"]
Expected Results: 40-60
Purpose: Network Engineers
```

#### Search #12
```yaml
Company: "GDIT"
Title Contains: ["Cyber", "Security Analyst", "ISSO", "Cybersecurity"]
Location: "Virginia"
Expected Results: 50-70
Purpose: Cyber roles (Langley focus)
```

#### Search #13
```yaml
Company: "GDIT"
Title Contains: ["DevSecOps", "DevOps", "Software Engineer", "Developer"]
Location: "Ohio"
Expected Results: 30-40
Purpose: DevSecOps (Wright-Patt)
```

#### Search #14
```yaml
Company: "GDIT"
Title Contains: ["Intelligence Analyst", "ISR", "SIGINT", "GEOINT", "All-Source"]
Expected Results: 40-60
Purpose: Intel analysts
```

### Priority 5: Navy DCGS-N Depth

#### Search #15
```yaml
Company: "GDIT"
Location: "Tracy, CA"
Department: ["Operations", "Engineering", "IT"]
Expected Results: 10-20
Purpose: West coast Navy site
```

#### Search #16
```yaml
Company: "General Dynamics Information Technology"
Location: ["Suffolk, VA", "Chesapeake, VA"]
Title Contains: ["Engineer", "Technician", "Analyst"]
Expected Results: 30-40
Purpose: Navy adjacent areas
```

### Priority 6: Named Target Verification

#### Search #17
```yaml
Name: "Craig Lindahl"
Company: "GDIT"
Purpose: Verify Wright-Patt PM in database
```

#### Search #18
```yaml
Name: "Kingsley Ero"
Company: "GDIT"
Purpose: Verify San Diego Acting Site Lead
```

#### Search #19
```yaml
Name: "Maureen Shamaly"
Company: "GDIT"
Purpose: Verify Langley PM
```

#### Search #20
```yaml
Name: "Rebecca Gunning"
Company: "GDIT"
Purpose: Verify Army DCGS-A contact
```

#### Search #21
```yaml
Name: "Dusty Galbraith"
Company: "GDIT"
Purpose: Verify Navy DCGS-N PM
```

#### Search #22
```yaml
Name: "David Winkelman"
Company: "GDIT"
Purpose: Verify VP Defense Intel
```

---

## 12. ESTIMATED RESOURCE USAGE

| Priority | Searches | Est. Results | Max Credits |
|----------|----------|--------------|-------------|
| P1 - Army DCGS-A | 4 | 75-135 | 135 |
| P2 - Wright-Patt | 3 | 75-115 | 115 |
| P3 - Executives | 3 | 90-140 | 140 |
| P4 - Functional | 4 | 160-230 | 230 |
| P5 - Navy Depth | 2 | 40-60 | 60 |
| P6 - Named | 6 | 6-12 | 12 |
| **TOTAL** | **22** | **446-692** | **~700** |

---

## 13. POST-SEARCH CHECKLIST

### Before Running Each Search
- [ ] Check if contacts already exist in DCGS Contacts Full database
- [ ] Export results to CSV for dedup against existing data
- [ ] Tag source as "ZoomInfo-Jan2026" for tracking

### After Each Search
- [ ] Apply classification logic (Hierarchy Tier, BD Priority, Location Hub, Program)
- [ ] Verify LinkedIn profiles for key Tier 1-3 contacts
- [ ] Import new unique contacts to Notion
- [ ] Flag duplicates for merge review

### Post-Import Validation
- [ ] Run dedup check on Email Address field
- [ ] Verify Program assignment matches Location
- [ ] Spot-check 10% of new contacts via LinkedIn
- [ ] Update BD Priority based on current hiring activity

---

## 14. REFERENCE: DCGS PROGRAM OVERVIEW

### Contract Values
| Program | Value | Prime/Sub | Status |
|---------|-------|-----------|--------|
| AF DCGS | ~$500M | BAE Prime / GDIT Sub | Option Year 2 (Nov 2026 review) |
| Army DCGS-A | ~$300M | GDIT Prime | Active |
| Navy DCGS-N | ~$150M | GDIT Prime | Active |
| **Total** | **~$950M** | | |

### Key Sites by Program
| Program | Locations |
|---------|-----------|
| AF DCGS - Langley | Hampton, Newport News, Yorktown (VA) |
| AF DCGS - PACAF | San Diego, La Mesa (CA) |
| AF DCGS - Wright-Patt | Dayton, Beavercreek, Fairborn (OH) |
| Army DCGS-A | Fort Belvoir, Fort Detrick, Aberdeen (MD/VA) |
| Navy DCGS-N | Norfolk, Suffolk, Chesapeake, Virginia Beach, Tracy (VA/CA) |
| Corporate HQ | Herndon, Falls Church, Reston, Fairfax, Chantilly (VA) |

### Known Pain Points (for BD Outreach)
| Program | Pain Point |
|---------|------------|
| AF DCGS - PACAF | Acting site lead stretched thin, single points of failure |
| AF DCGS - Langley | High ISR volume, analyst burnout, PMO pressure on vacancies |
| AF DCGS - Wright-Patt | Radar engineer vacancy, DevSecOps shortage |
| Army DCGS-A | Surge staffing needs, coordination across dispersed sites |
| Navy DCGS-N | Ship/shore integration challenges, Norfolk talent competition |

---

*Document generated by Claude on January 10, 2025*
*For PTS DCGS Business Development Campaign*
