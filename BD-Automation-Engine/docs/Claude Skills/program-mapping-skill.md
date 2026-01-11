---
name: program-mapping
description: Multi-signal scoring engine for matching jobs to federal programs. Use when mapping scraped jobs to DCGS, IC, or DoD programs using location intelligence, keyword matching, and clearance alignment for BD opportunity identification.
---

# Program Mapping Engine

Match job postings to federal programs using location intelligence, keyword signals, and multi-factor scoring for BD opportunity identification.

**Keywords**: program mapping, federal programs, DCGS, location matching, clearance, BD scoring, opportunity, contract, prime contractor, subcontractor

## Core Methodology

For each job posting, the engine:
1. **Extracts signals** from title, location, description, clearance
2. **Scores against programs** in Federal Programs database
3. **Calculates match confidence** (0.0-1.0)
4. **Assigns BD Priority Score** (0-100) with tier classification
5. **Flags for review** if confidence below threshold

## Location-to-Program Mapping

### DCGS Sites (Priority)

```python
DCGS_LOCATIONS = {
    # AF DCGS - PACAF (🔥 Critical Priority)
    "San Diego": "AF DCGS - PACAF",
    "La Mesa": "AF DCGS - PACAF",
    
    # AF DCGS - Langley (DGS-1)
    "Hampton": "AF DCGS - Langley",
    "Newport News": "AF DCGS - Langley",
    "Langley": "AF DCGS - Langley",
    "Yorktown": "AF DCGS - Langley",
    
    # AF DCGS - Wright-Patterson (NASIC)
    "Dayton": "AF DCGS - Wright-Patt",
    "Beavercreek": "AF DCGS - Wright-Patt",
    "Fairborn": "AF DCGS - Wright-Patt",
    
    # Navy DCGS-N
    "Norfolk": "Navy DCGS-N",
    "Suffolk": "Navy DCGS-N",
    "Tracy": "Navy DCGS-N",
    
    # Army DCGS-A
    "Fort Belvoir": "Army DCGS-A",
    "Fort Detrick": "Army DCGS-A",
    "Aberdeen": "Army DCGS-A",
    
    # Corporate HQ
    "Herndon": "Corporate HQ",
    "Falls Church": "Corporate HQ",
    "Reston": "Corporate HQ",
}
```

### IC/DoD Locations

```python
IC_DOD_LOCATIONS = {
    "Fort Meade": "NSA/USCYBERCOM Programs",
    "Colorado Springs": "Space Force/MDA Programs",
    "Tampa": "SOCOM Programs",
    "MacDill": "SOCOM Programs",
    "Springfield": "NGA Programs",
    "McLean": "IC Corporate",
    "Chantilly": "NRO/IC Programs",
}
```

## Multi-Signal Scoring

| Signal | Points | Description |
|--------|--------|-------------|
| Program name in title | +50 | Exact program name/acronym |
| Program name in description | +20 | Program mentioned in body |
| Acronym match | +40 | Known acronym (DCGS, NASIC) |
| Location match (exact) | +20 | Job location matches program |
| Location match (region) | +10 | Same metro area |
| Technology keyword | +15 | Tech associated with program |
| Role type match | +10 | Title matches typical roles |
| Clearance alignment | +5 | Clearance meets requirements |
| Clearance mismatch | -20 | Clearance doesn't align |
| DCGS-specific keyword | +10 | ISR, 480th, DGS, etc. |

## BD Priority Score Algorithm

```python
def calculate_bd_priority_score(job):
    score = 50  # Base score
    
    # Clearance boost (0-35)
    clearance_boosts = {
        'TS/SCI w/ Poly': 35, 'TS/SCI': 25, 
        'Top Secret': 15, 'Secret': 5
    }
    
    # Match confidence boost (0-20)
    score += int(job['match_confidence'] * 20)
    
    # DCGS relevance boost (0-20)
    if 'dcgs' in job['description'].lower(): score += 20
    
    # Priority location boost (0-10)
    if 'San Diego' in job['location']: score += 10
    
    return min(score, 100)
```

## Confidence Thresholds

| Confidence | Match Type | Action |
|------------|------------|--------|
| ≥ 70% | `direct` | Auto-map |
| 50-69% | `fuzzy` | Flag for review |
| < 50% | `inferred` | Manual review required |

## Priority Tiers

| Score | Tier | Color | Action |
|-------|------|-------|--------|
| 80-100 | 🔥 Hot | Red | Immediate outreach |
| 50-79 | 🟡 Warm | Yellow | Weekly follow-up |
| 0-49 | ❄️ Cold | Blue | Pipeline tracking |
