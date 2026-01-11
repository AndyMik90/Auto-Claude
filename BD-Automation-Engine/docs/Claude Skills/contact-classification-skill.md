---
name: contact-classification
description: Six-tier hierarchy classification system for BD contacts. Use when classifying contacts by seniority level, assigning BD priority scores, mapping to programs by location, and determining outreach sequencing strategy.
---

# Contact Classification System

Classify BD contacts using a 6-tier hierarchy system with automated BD priority assignment based on role, location, and program alignment.

**Keywords**: contact classification, hierarchy tier, BD priority, DCGS contacts, seniority, program manager, director, executive, individual contributor

## 6-Tier Hierarchy System

| Tier | Role Level | Color | Examples |
|------|------------|-------|----------|
| Tier 1 | Executive | 🔴 | VP, President, Chief, C-Suite |
| Tier 2 | Director | 🟠 | Director, Senior Director |
| Tier 3 | Program Leadership | 🟡 | PM, Site Lead, Task Order Lead |
| Tier 4 | Management | 🟢 | Manager, Team Lead, Supervisor |
| Tier 5 | Senior IC | 🔵 | Senior, Sr., Principal, Lead Engineer |
| Tier 6 | Individual Contributor | ⚪ | Analyst, Engineer, Admin |

## Hierarchy Tier Classification Logic

```python
def get_hierarchy_tier(title):
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

## BD Priority Assignment

```python
def get_bd_priority(hierarchy_tier, program=None, location=None):
    # Critical: Executives + PACAF site
    if hierarchy_tier in ['Tier 1 - Executive', 'Tier 2 - Director']:
        return '🔴 Critical'
    if program == 'AF DCGS - PACAF':
        return '🔴 Critical'
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

## Program Assignment by Location

```python
LOCATION_TO_PROGRAM = {
    # AF DCGS - Langley (DGS-1)
    'Hampton': 'AF DCGS - Langley',
    'Newport News': 'AF DCGS - Langley',
    
    # AF DCGS - PACAF (San Diego) 🔥
    'San Diego': 'AF DCGS - PACAF',
    'La Mesa': 'AF DCGS - PACAF',
    
    # AF DCGS - Wright-Patterson
    'Dayton': 'AF DCGS - Wright-Patt',
    'Beavercreek': 'AF DCGS - Wright-Patt',
    
    # Navy DCGS-N
    'Norfolk': 'Navy DCGS-N',
    'Suffolk': 'Navy DCGS-N',
    'Tracy': 'Navy DCGS-N',
    
    # Army DCGS-A
    'Fort Belvoir': 'Army DCGS-A',
    'Fort Detrick': 'Army DCGS-A',
    'Aberdeen': 'Army DCGS-A',
    
    # Corporate HQ
    'Herndon': 'Corporate HQ',
    'Falls Church': 'Corporate HQ',
    'Reston': 'Corporate HQ',
}
```

## Location Hub Mapping

| Hub | Cities |
|-----|--------|
| Hampton Roads | Hampton, Newport News, Norfolk, Suffolk |
| San Diego Metro | San Diego, La Mesa |
| DC Metro | Herndon, Falls Church, Reston, McLean |
| Dayton/Wright-Patt | Dayton, Beavercreek, Fairborn |
| Other CONUS | Fort Belvoir, Aberdeen, Tracy |
| OCONUS | Germany, Hawaii, Japan, Korea |

## Functional Areas

- Program Management
- Network Engineering
- Cyber Security
- ISR/Intelligence
- Systems Administration
- Software Engineering
- Field Service
- Security/FSO
- Business Development
- Training
- Administrative

## Outreach Sequencing by Tier

| Tier | Channel | Approach | CTA |
|------|---------|----------|-----|
| 5-6 (ICs) | LinkedIn | Friendly | "Coffee chat" |
| 4 (Managers) | LinkedIn → Email | Collaborative | "30 min call" |
| 3 (PMs) | Formal Email | Data-backed | "Meet BD lead" |
| 1-2 (Execs) | Exec-to-Exec | Strategic | "15-min sync" |

## Notion Schema Values

**Program:** AF DCGS - Langley, AF DCGS - Wright-Patt, AF DCGS - PACAF, AF DCGS - Other, Army DCGS-A, Navy DCGS-N, Corporate HQ, Enterprise Security, Unassigned

**Hierarchy Tier:** Tier 1 - Executive, Tier 2 - Director, Tier 3 - Program Leadership, Tier 4 - Management, Tier 5 - Senior IC, Tier 6 - Individual Contributor

**BD Priority:** 🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard

**Location Hub:** Hampton Roads, San Diego Metro, DC Metro, Dayton/Wright-Patt, Other CONUS, OCONUS, Unknown
