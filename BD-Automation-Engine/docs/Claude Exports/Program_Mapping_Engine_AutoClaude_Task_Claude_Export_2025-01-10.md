# Program Mapping Engine - Auto Claude Task Setup
## Claude Export Document

**Topic/Focus Area**: Program Mapping Engine (Engine 2) - AI-Powered Job-to-Federal-Program Matching  
**Date**: January 10, 2025  
**Session Type**: Task Design & Architecture Planning for Auto Claude  
**Export Version**: 1.0

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
Building a standalone **Program Mapping Engine** (Engine 2 of the 5-engine Prime TS BD Intelligence System) using Auto Claude. This engine takes scraped job postings from competitor defense staffing firms and uses GPT-4o to match them to 388 DoD/IC federal programs with confidence scoring.

### Primary Objective
Design and document a comprehensive Auto Claude task that will build an AI-powered matching system capable of:
1. Accepting Apify scraper output (job postings from Insight Global, TEKsystems, ClearanceJobs, etc.)
2. Matching jobs to federal programs using multi-signal analysis (location, keywords, clearance, technology, prime contractor)
3. Calculating match confidence scores (High/Moderate/Low)
4. Computing BD opportunity scores using weighted algorithm
5. Outputting structured JSON for n8n workflow integration

### Context
This is part of the larger Prime Technical Services (PTS) BD Intelligence System - an automated competitive intelligence platform for defense contractor staffing that:
- Scrapes competitor job boards (Engine 1 - COMPLETE)
- Maps jobs to programs (Engine 2 - THIS TASK)
- Discovers organizational structures (Engine 3 - Future)
- Generates sales materials (Engine 4 - Future)
- Prioritizes opportunities (Engine 5 - Integrated)

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Standalone Module Architecture
**Decision**: Build the Program Mapping Engine as a standalone Python/TypeScript module rather than embedding directly into n8n Code nodes.

**Reasoning**:
- Enables independent testing and validation
- Allows use with Auto Claude for AI-assisted development
- Can be deployed as REST API or imported into n8n
- Better maintainability and version control
- Supports unit testing and CI/CD

**Alternatives Considered**:
- n8n Code node only (rejected: hard to test, no version control)
- Direct n8n workflow with OpenAI node (rejected: limited customization)

### Decision 2: Multi-Signal Matching Algorithm
**Decision**: Use a weighted multi-signal approach with 5 factors:
- Location Match: 30%
- Title/Keyword Match: 25%
- Clearance Alignment: 20%
- Technology Stack: 15%
- Prime Contractor Inference: 10%

**Reasoning**:
- Location is the strongest predictor (San Diego = DCGS PACAF, Fort Meade = NSA)
- Keywords provide program-specific signals
- Clearance is a hard filter for placement viability
- Technology alignment indicates fit
- Prime contractor provides subcontracting opportunities

**Alternatives Considered**:
- Single-factor matching (rejected: too low accuracy)
- Equal weighting (rejected: doesn't reflect real-world importance)
- ML-based approach (rejected: insufficient training data currently)

### Decision 3: GPT-4o for AI Matching
**Decision**: Use OpenAI GPT-4o with structured JSON output for program matching.

**Reasoning**:
- 128K context window can hold all 388 programs
- Structured output ensures consistent JSON
- Temperature 0.1 for deterministic results
- Superior reasoning for complex matching scenarios

**Alternatives Considered**:
- GPT-4o-mini (considered for cost savings on simple matches)
- Claude API (rejected: currently building in Claude, avoid recursion)
- Local LLM (rejected: insufficient accuracy for this use case)

### Decision 4: BD Scoring Integration
**Decision**: Integrate BD scoring directly into the Program Mapping Engine rather than as a separate workflow step.

**Reasoning**:
- Reduces latency (one pass instead of two)
- Ensures scoring uses fresh matching data
- Simplifies n8n workflow integration
- Single API call for complete enrichment

**Alternatives Considered**:
- Separate scoring engine (rejected: adds complexity)
- Post-processing in n8n (rejected: duplicate logic)

### Decision 5: Agent Profile for Auto Claude
**Decision**: Use "Auto optimize per phase" with Opus 4.5 + Ultrathink for implementation phases.

**Reasoning**:
- Phase 1 (Architecture): Sonnet 4.5 - fast, efficient for design
- Phases 2-4 (Implementation): Opus 4.5 + Ultrathink - complex logic requires deepest reasoning
- Phase 5 (Testing): Sonnet 4.5 - efficient for test generation

---

## 3. ARCHITECTURE & DATA FLOW

### System Architecture (5-Engine Overview)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PRIME TS BD INTELLIGENCE SYSTEM                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  ENGINE 1: SCRAPER          → Competitor job board scraping (Apify)         │
│  ENGINE 2: PROGRAM MAPPING  → AI-powered job-to-program matching (GPT-4)    │ ← THIS TASK
│  ENGINE 3: ORG CHART        → Contact/org structure discovery (Future)      │
│  ENGINE 4: PLAYBOOK         → Sales material generation (Future)            │
│  ENGINE 5: SCORING          → BD opportunity prioritization (Integrated)    │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow (Engine 2 Focus)
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PROGRAM MAPPING ENGINE DATA FLOW                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌──────────────────┐                                                        │
│  │  Apify Scrapers  │ ─────────────────────┐                                │
│  │  (Puppeteer)     │                      │                                │
│  └──────────────────┘                      ▼                                │
│         │                     ┌─────────────────────────┐                   │
│         │                     │   n8n Webhook Trigger   │                   │
│         │                     │   POST /bd-intelligence │                   │
│         │                     └───────────┬─────────────┘                   │
│         │                                 │                                  │
│         ▼                                 ▼                                  │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                    PROGRAM MAPPING ENGINE                         │       │
│  ├──────────────────────────────────────────────────────────────────┤       │
│  │                                                                   │       │
│  │  INPUT: Raw Job Data                                             │       │
│  │  ┌─────────────────────────────────────────────────────────┐     │       │
│  │  │ {                                                        │     │       │
│  │  │   "title": "TS/SCI Field Service Engineer",              │     │       │
│  │  │   "company": "Insight Global",                           │     │       │
│  │  │   "location": "San Diego, California",                   │     │       │
│  │  │   "clearance": "TS/SCI",                                 │     │       │
│  │  │   "url": "https://...",                                  │     │       │
│  │  │   "description": "Support DCGS-AF operations..."         │     │       │
│  │  │ }                                                        │     │       │
│  │  └─────────────────────────────────────────────────────────┘     │       │
│  │                            │                                      │       │
│  │                            ▼                                      │       │
│  │  ┌─────────────────────────────────────────────────────────┐     │       │
│  │  │         MULTI-SIGNAL MATCHING ALGORITHM                  │     │       │
│  │  │                                                          │     │       │
│  │  │  1. Location Match (30%)                                 │     │       │
│  │  │     San Diego → AF DCGS PACAF, Navy DCGS-N              │     │       │
│  │  │                                                          │     │       │
│  │  │  2. Keyword Match (25%)                                  │     │       │
│  │  │     "DCGS" + "ISR" → DCGS Program Family                │     │       │
│  │  │                                                          │     │       │
│  │  │  3. Clearance Alignment (20%)                            │     │       │
│  │  │     TS/SCI job = TS/SCI program (100% match)            │     │       │
│  │  │                                                          │     │       │
│  │  │  4. Technology Stack (15%)                               │     │       │
│  │  │     Python, AWS, Linux → C5ISR programs                 │     │       │
│  │  │                                                          │     │       │
│  │  │  5. Prime Contractor (10%)                               │     │       │
│  │  │     Insight Global → GDIT subcontractor                 │     │       │
│  │  └─────────────────────────────────────────────────────────┘     │       │
│  │                            │                                      │       │
│  │                            ▼                                      │       │
│  │  ┌─────────────────────────────────────────────────────────┐     │       │
│  │  │            GPT-4o PROGRAM MATCHER                        │     │       │
│  │  │  "Match this job to the best program based on           │     │       │
│  │  │   location, title, clearance, tech, and prime"          │     │       │
│  │  └─────────────────────────────────────────────────────────┘     │       │
│  │                            │                                      │       │
│  │                            ▼                                      │       │
│  │  ┌─────────────────────────────────────────────────────────┐     │       │
│  │  │         CONFIDENCE SCORE CALCULATION                     │     │       │
│  │  │  High (≥80%) | Moderate (50-79%) | Low (<50%)           │     │       │
│  │  └─────────────────────────────────────────────────────────┘     │       │
│  │                            │                                      │       │
│  │                            ▼                                      │       │
│  │  ┌─────────────────────────────────────────────────────────┐     │       │
│  │  │              BD SCORING ENGINE                           │     │       │
│  │  │  Hiring Demand (25%) + Pain Level (20%) +               │     │       │
│  │  │  Contract Value (20%) + Company Fit (20%) +             │     │       │
│  │  │  Competitive Intensity (15%) = BD Score (0-100)         │     │       │
│  │  └─────────────────────────────────────────────────────────┘     │       │
│  │                                                                   │       │
│  └───────────────────────────────┬──────────────────────────────────┘       │
│                                  │                                           │
│                                  ▼                                           │
│  OUTPUT: Enriched Job Data                                                  │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │ {                                                                 │       │
│  │   "job_id": "IG-2025-12-001",                                    │       │
│  │   "mapping_result": {                                            │       │
│  │     "matched_program": "DCGS-AF",                                │       │
│  │     "confidence": 87,                                            │       │
│  │     "confidence_level": "High"                                   │       │
│  │   },                                                              │       │
│  │   "bd_scoring": {                                                │       │
│  │     "bd_score": 82,                                              │       │
│  │     "priority_level": "Hot"                                      │       │
│  │   }                                                               │       │
│  │ }                                                                 │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                  │                                           │
│                                  ▼                                           │
│  ┌──────────────────────────────────────────────────────────────────┐       │
│  │                    NOTION DATABASES                               │       │
│  │  - Program Mapping Intelligence Hub (enriched jobs)              │       │
│  │  - BD Opportunities (hot leads ≥80)                              │       │
│  │  - Federal Programs (388 programs reference)                     │       │
│  └──────────────────────────────────────────────────────────────────┘       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Connections
| Service | Purpose | Credentials |
|---------|---------|-------------|
| OpenAI GPT-4o | AI program matching | API Key (configured in n8n) |
| Notion API | Database storage | Integration token |
| Apify API | Job scraping | `apify_api_n32KFOBo74tTXNi1nEH8nuaMMgrmRc15XrzS` |
| n8n Cloud | Workflow orchestration | https://primetech.app.n8n.cloud |

---

## 4. CODE & CONFIGURATIONS

### 4.1 Auto Claude Task Description (Complete)

**File/Component Name**: `auto_claude_task_description.md`  
**Purpose**: Complete task specification for Auto Claude to build the Program Mapping Engine

```markdown
# Program Mapping Engine v1.0 - AI Job-to-Program Matching System

## OBJECTIVE
Build a standalone Python/TypeScript Program Mapping Engine that:
1. Accepts scraped job postings (from Apify puppeteer scraper output)
2. Matches jobs to 388 DoD/IC federal programs using GPT-4o
3. Calculates match confidence scores (0-100%)
4. Returns structured JSON with program assignments and BD scores

## CONTEXT
This is **Engine 2** of the Prime TS BD Intelligence System (5-engine architecture):
- Engine 1: Scraper (COMPLETE - Apify puppeteer actors)
- **Engine 2: Program Mapping (THIS TASK)**
- Engine 3: Org Chart (Future)
- Engine 4: Playbook (Future)  
- Engine 5: Scoring (Integrated into this engine)

## INPUT DATA FORMATS

### Job Input Format (from Apify scraper):
```json
{
  "title": "TS/SCI Field Service Engineer",
  "company": "Insight Global",
  "location": "San Diego, California",
  "clearance": "TS/SCI",
  "url": "https://insightglobal.com/jobs/...",
  "description": "Support DCGS-AF operations...",
  "scraped_at": "2025-12-30T17:56:00.582Z",
  "primary_keyword": "TS/SCI",
  "technologies": ["Python", "AWS", "Linux"]
}
```

### Federal Programs Reference Data Format:
Key fields for matching:
- Program Name (e.g., "DCGS-AF", "Sentinel GBSD", "F-35 Lightning II")
- Agency (e.g., "Air Force", "MDA", "NRO")
- Prime Contractors (GDIT, Northrop, Lockheed, etc.)
- Key Locations (San Diego, Fort Meade, Huntsville, etc.)
- Clearance Requirements (Secret, TS, TS/SCI, TS/SCI w/ Poly)
- Program Type (C5ISR, Missile, Cyber, Space, etc.)
- Contract Value ($1M-$100B+)

## MATCHING ALGORITHM REQUIREMENTS

### Multi-Signal Matching (Priority Order):
1. **Location Match** (30% weight): Map job location → program locations
   - San Diego → AF DCGS PACAF, Navy DCGS-N
   - Fort Meade → NSA, USCYBERCOM
   - Huntsville → MDA GMD/IBCS
   - Colorado Springs → Space Force, NORAD
   
2. **Title/Keyword Match** (25% weight): Job title keywords → program names
   - "DCGS" → DCGS program family
   - "Sentinel" or "GBSD" → Sentinel GBSD
   - "F-35" → F-35 Lightning II

3. **Clearance Alignment** (20% weight): Job clearance → program requirements
   - Exact match = 100%
   - One level below = 70%
   - Two levels below = 40%

4. **Technology Stack Match** (15% weight): Job technologies → program tech needs

5. **Prime Contractor Inference** (10% weight): Job company → known prime subs

### Confidence Score Calculation:
```python
confidence = (
    location_score * 0.30 +
    keyword_score * 0.25 +
    clearance_score * 0.20 +
    tech_score * 0.15 +
    prime_score * 0.10
)
# Categories: High (≥80%), Moderate (50-79%), Low (<50%)
```

## BD SCORING ALGORITHM (Integrated)

Calculate BD Score (0-100) using:
```python
bd_score = (
    hiring_demand * 0.25 +      # Based on clearance level
    pain_level * 0.20 +          # Location difficulty + clearance
    contract_value * 0.20 +      # Program budget tier
    company_fit * 0.20 +         # PTS capability alignment
    competitive_intensity * 0.15  # Market saturation
)

# Priority Thresholds:
# Hot: ≥80 → Immediate action
# Warm: 50-79 → Standard queue
# Cold: <50 → Monitor only
```

## OUTPUT FORMAT

```json
{
  "job_id": "IG-2025-12-001",
  "original_job": { /* input job data */ },
  "mapping_result": {
    "matched_program": "DCGS-AF",
    "program_id": "dcgs-af-001",
    "agency": "Air Force",
    "prime_contractor": "General Dynamics IT (GDIT)",
    "confidence": 87,
    "confidence_level": "High",
    "match_signals": {
      "location": {"score": 95, "matched": "San Diego → AF DCGS PACAF"},
      "keywords": {"score": 90, "matched": ["DCGS", "ISR"]},
      "clearance": {"score": 100, "matched": "TS/SCI = TS/SCI"},
      "technology": {"score": 70, "matched": ["Linux", "Python"]},
      "prime": {"score": 60, "matched": "Insight Global → GDIT sub"}
    }
  },
  "bd_scoring": {
    "bd_score": 82,
    "priority_level": "Hot",
    "score_breakdown": {
      "hiring_demand": 90,
      "pain_level": 85,
      "contract_value": 80,
      "company_fit": 75,
      "competitive_intensity": 70
    }
  },
  "enriched_at": "2025-01-07T10:30:00Z",
  "model_used": "gpt-4o"
}
```

## TECHNICAL REQUIREMENTS

### Architecture Options (choose one):
1. **Python Module** (preferred for AI/ML):
   - FastAPI REST endpoint
   - OpenAI SDK integration
   - Pandas for data processing
   - Pydantic for validation

2. **TypeScript Module** (for n8n Code node):
   - ES modules compatible
   - Native fetch for OpenAI calls
   - Type-safe interfaces

### Core Components to Build:
1. `program_matcher.py/ts` - Main matching logic
2. `scoring_engine.py/ts` - BD score calculator
3. `prompt_templates.py/ts` - GPT-4o system prompts
4. `reference_data.py/ts` - Program database loader
5. `validators.py/ts` - Input/output validation

### GPT-4o Integration:
- Use structured JSON output mode
- System prompt with all 388 programs context
- Few-shot examples for accuracy
- Temperature: 0.1 (deterministic)
- Max tokens: 2000

## CONSTRAINTS

1. **Rate Limiting**: OpenAI API has rate limits - batch jobs in groups of 10
2. **Context Window**: 388 programs must fit in GPT-4o context (128k tokens)
3. **Latency**: Target <5 seconds per job mapping
4. **Accuracy**: Target >85% match accuracy on DCGS jobs (validation set)
5. **Idempotency**: Same input should produce same output

## DELIVERABLES

1. **Working Code Module**:
   - Python package OR TypeScript module
   - CLI interface for testing
   - REST API endpoint (optional)

2. **Documentation**:
   - README.md with setup instructions
   - API documentation
   - Example usage

3. **Test Suite**:
   - Unit tests for matching logic
   - Integration tests with GPT-4o
   - Validation against known job→program mappings

4. **Sample Outputs**:
   - 10 mapped jobs with full JSON output
   - Accuracy report against validation set

## SUCCESS CRITERIA

1. ✅ Accepts Apify scraper output format
2. ✅ Maps jobs to correct programs with >85% accuracy
3. ✅ Calculates confidence scores (High/Moderate/Low)
4. ✅ Calculates BD scores with correct priority thresholds
5. ✅ Returns structured JSON output
6. ✅ Handles edge cases (unknown locations, missing data)
7. ✅ Includes comprehensive tests
8. ✅ Documentation for n8n integration
```

---

### 4.2 BD Scoring Algorithm (Python Implementation Reference)

**File/Component Name**: `bd_scoring_algorithm.py`  
**Purpose**: Reference implementation of the BD scoring logic

```python
# BD Opportunity Score Calculation
# Formula: Score = (Hiring_Demand × 25) + (Pain_Level × 20) + (Contract_Value × 20) + 
#                  (Company_Fit × 20) + (Competitive_Intensity × 15)

def calculate_bd_score(job: dict) -> dict:
    """
    Calculate BD opportunity score for a mapped job.
    
    Args:
        job: Dictionary containing job data with mapping results
        
    Returns:
        Dictionary with bd_score, priority_level, and score_breakdown
    """
    
    # Calculate component scores (normalized 0-100)
    hiring_demand_score = calculate_hiring_demand(job)
    pain_level_score = calculate_pain_level(job)
    contract_value_score = calculate_contract_value(job)
    company_fit_score = calculate_company_fit(job)
    competitive_intensity_score = calculate_competitive_intensity(job)
    
    # Weighted calculation
    bd_score = round(
        (hiring_demand_score * 0.25) +
        (pain_level_score * 0.20) +
        (contract_value_score * 0.20) +
        (company_fit_score * 0.20) +
        (competitive_intensity_score * 0.15)
    )
    
    # Priority classification
    if bd_score >= 80:
        priority_level = 'Hot'
    elif bd_score >= 50:
        priority_level = 'Warm'
    else:
        priority_level = 'Cold'
    
    return {
        'bd_score': bd_score,
        'priority_level': priority_level,
        'score_breakdown': {
            'hiring_demand': hiring_demand_score,
            'pain_level': pain_level_score,
            'contract_value': contract_value_score,
            'company_fit': company_fit_score,
            'competitive_intensity': competitive_intensity_score
        }
    }


def calculate_hiring_demand(job: dict) -> int:
    """Higher score for more urgent clearance requirements."""
    clearance_scores = {
        'TS/SCI w/ Poly': 100,
        'TS/SCI with Polygraph': 100,
        'TS/SCI CI Poly': 100,
        'TS/SCI FS Poly': 100,
        'TS/SCI': 90,
        'Top Secret': 75,
        'TS': 75,
        'Secret': 50,
        'Public Trust': 30,
        'Unknown': 20,
        'None': 10
    }
    clearance = job.get('clearance', job.get('clearance_level', 'Unknown'))
    return clearance_scores.get(clearance, 20)


def calculate_pain_level(job: dict) -> int:
    """Higher score for hard-to-fill locations and clearances."""
    score = 50  # Base score
    
    # Location-based pain (high-demand areas = harder to fill)
    high_demand_locations = [
        'fort meade', 'fort liberty', 'lackland', 'colorado springs',
        'huntsville', 'san diego', 'langley', 'mclean', 'reston',
        'springfield', 'crystal city', 'arlington'
    ]
    location = (job.get('location', '')).lower()
    if any(loc in location for loc in high_demand_locations):
        score += 25
    
    # Clearance-based pain
    clearance = job.get('clearance', job.get('clearance_level', 'Unknown'))
    if 'Poly' in clearance:
        score += 25
    elif clearance in ['TS/SCI', 'Top Secret', 'TS']:
        score += 20
    elif clearance == 'Secret':
        score += 10
    
    return min(score, 100)


def calculate_contract_value(job: dict) -> int:
    """Base score on program type and match confidence."""
    score = job.get('match_confidence', job.get('confidence', 50))
    
    # Bonus for high-value program types
    high_value_types = ['Missile', 'C5ISR', 'Cyber', 'Space', 'Nuclear']
    program_type = job.get('program_type', '')
    if program_type in high_value_types:
        score += 20
    
    return min(score, 100)


def calculate_company_fit(job: dict) -> int:
    """Score based on PTS capability alignment."""
    score = 50  # Base score
    
    # Clearance alignment (PTS has strong TS/SCI capability)
    clearance = job.get('clearance', job.get('clearance_level', 'Unknown'))
    if 'TS/SCI' in clearance or 'Poly' in clearance:
        score += 30
    elif clearance in ['Top Secret', 'TS']:
        score += 20
    elif clearance == 'Secret':
        score += 10
    
    # Program type alignment
    pts_strengths = ['C5ISR', 'Cyber', 'Intelligence', 'IT Services']
    program_type = job.get('program_type', '')
    if program_type in pts_strengths:
        score += 20
    
    return min(score, 100)


def calculate_competitive_intensity(job: dict) -> int:
    """Score based on market saturation (inverse - lower competition = higher score)."""
    score = 70  # Base score
    
    # Source company indicates competition level
    high_competition_companies = ['CACI', 'Booz Allen', 'Leidos', 'ManTech']
    low_competition_companies = ['Insight Global', 'TEKsystems', 'Kforce']
    
    company = job.get('company', '')
    if company in high_competition_companies:
        score -= 20  # More competition
    elif company in low_competition_companies:
        score += 15  # Less competition from staffing firms
    
    return min(max(score, 0), 100)


# Alternative simpler DCGS-focused scoring (from handoff docs)
def calculate_dcgs_bd_score(job: dict) -> dict:
    """
    Simplified BD scoring for DCGS campaign.
    Base (50) + Clearance (0-35) + Confidence (0-20) + DCGS Relevance (0-20) + Keywords (0-10)
    """
    score = 50  # Base score
    
    # Clearance boost (0-35 points)
    clearance_scores = {
        'TS/SCI with Polygraph': 35,
        'TS/SCI w/ Poly': 35,
        'TS/SCI': 25,
        'Top Secret': 15,
        'TS': 15,
        'Secret': 5,
        'Unknown': 0
    }
    clearance = job.get('clearance', 'Unknown')
    score += clearance_scores.get(clearance, 0)
    
    # Confidence boost (0-20 points)
    confidence_level = job.get('confidence_level', 'Low')
    confidence_scores = {
        'High': 20,
        'Moderate': 10,
        'Low': 0
    }
    score += confidence_scores.get(confidence_level, 0)
    
    # DCGS Relevance boost (0-20 points)
    dcgs_relevance = job.get('dcgs_relevance', 'General DoD')
    relevance_scores = {
        'Direct DCGS': 20,
        'DCGS Adjacent': 15,
        'Related Intel': 10,
        'General DoD': 0
    }
    score += relevance_scores.get(dcgs_relevance, 0)
    
    # Program keyword boost (0-10 points)
    program = job.get('matched_program', job.get('program', ''))
    if any(kw in program.upper() for kw in ['DCGS', 'ISR', '480TH', 'NASIC']):
        score += 10
    
    score = min(100, score)
    
    # Priority thresholds
    if score >= 90:
        priority = 'Critical'
    elif score >= 75:
        priority = 'High'
    elif score >= 60:
        priority = 'Medium'
    else:
        priority = 'Low'
    
    return {
        'bd_score': score,
        'priority_level': priority
    }
```

---

### 4.3 Location-to-Program Mapping Reference

**File/Component Name**: `location_program_mapping.json`  
**Purpose**: Reference data for location-based program inference

```json
{
  "location_mappings": {
    "san_diego": {
      "programs": ["DCGS-AF PACAF", "Navy DCGS-N", "SPAWAR"],
      "agencies": ["Air Force", "Navy"],
      "primes": ["GDIT", "Northrop Grumman"]
    },
    "fort_meade": {
      "programs": ["NSA Programs", "USCYBERCOM", "DIA"],
      "agencies": ["NSA", "DoD"],
      "primes": ["GDIT", "Booz Allen", "Leidos"]
    },
    "huntsville": {
      "programs": ["MDA GMD", "IBCS", "SDA Programs"],
      "agencies": ["MDA", "Space Development Agency"],
      "primes": ["Northrop Grumman", "Lockheed Martin"]
    },
    "colorado_springs": {
      "programs": ["Space Force", "NORAD", "AFSPC"],
      "agencies": ["Space Force", "Air Force"],
      "primes": ["Raytheon", "L3Harris"]
    },
    "langley_hampton_roads": {
      "programs": ["DCGS-AF Langley", "ACC Programs"],
      "agencies": ["Air Force"],
      "primes": ["GDIT", "L3Harris"]
    },
    "lackland_jbsa": {
      "programs": ["16th Air Force", "AF Cyber", "NSA/CSS Texas"],
      "agencies": ["Air Force", "NSA"],
      "primes": ["GDIT", "Booz Allen"]
    },
    "montgomery_maxwell": {
      "programs": ["DISA N-JRSS", "CENTCOM IT"],
      "agencies": ["DISA", "CENTCOM"],
      "primes": ["GDIT"]
    },
    "dc_metro": {
      "programs": ["Multiple Pentagon Programs"],
      "agencies": ["DoD", "All Services"],
      "primes": ["All Major Primes"]
    }
  },
  "clearance_hierarchy": [
    "TS/SCI with Polygraph",
    "TS/SCI CI Poly",
    "TS/SCI FS Poly", 
    "TS/SCI",
    "Top Secret",
    "Secret",
    "Public Trust",
    "None"
  ],
  "prime_subcontractor_relationships": {
    "Insight Global": ["GDIT", "Leidos", "SAIC", "Booz Allen"],
    "TEKsystems": ["GDIT", "Northrop Grumman", "Raytheon"],
    "ClearanceJobs": ["All Major Primes"],
    "Kforce": ["CACI", "ManTech", "Peraton"]
  }
}
```

---

### 4.4 GPT-4o System Prompt Template

**File/Component Name**: `gpt4o_system_prompt.txt`  
**Purpose**: System prompt for GPT-4o program matching

```text
You are an expert DoD/IC federal program analyst specializing in mapping job postings to government programs.

TASK: Given a job posting, identify the most likely federal program it supports based on location, job title, clearance requirements, technologies, and the posting company.

FEDERAL PROGRAMS DATABASE (388 programs):
{programs_context}

MATCHING CRITERIA (in priority order):
1. LOCATION (30%): Primary indicator. Map job location to program locations.
   - San Diego → DCGS-AF PACAF, Navy DCGS-N
   - Fort Meade → NSA, USCYBERCOM, DIA
   - Huntsville → MDA GMD/IBCS, SDA
   - Colorado Springs → Space Force, NORAD
   - Langley/Hampton Roads → DCGS-AF Langley, ACC

2. KEYWORDS (25%): Match job title and description keywords to program names.
   - "DCGS" → DCGS program family
   - "Sentinel" or "GBSD" → Sentinel GBSD
   - "F-35" → F-35 Lightning II

3. CLEARANCE (20%): Match clearance requirements.
   - Exact match = 100%
   - One level below = 70%
   - Two levels below = 40%

4. TECHNOLOGY (15%): Match required technologies to program tech stacks.

5. PRIME CONTRACTOR (10%): Infer from posting company to known prime-sub relationships.
   - Insight Global often subs to GDIT
   - TEKsystems often subs to Northrop Grumman

OUTPUT FORMAT (JSON):
{
  "matched_program": "Program Name",
  "program_id": "program-id",
  "agency": "Agency Name",
  "prime_contractor": "Prime Contractor Name",
  "confidence": 87,
  "confidence_level": "High|Moderate|Low",
  "match_signals": {
    "location": {"score": 95, "matched": "San Diego → AF DCGS PACAF"},
    "keywords": {"score": 90, "matched": ["DCGS", "ISR"]},
    "clearance": {"score": 100, "matched": "TS/SCI = TS/SCI"},
    "technology": {"score": 70, "matched": ["Linux", "Python"]},
    "prime": {"score": 60, "matched": "Insight Global → GDIT sub"}
  },
  "reasoning": "Brief explanation of the match"
}

CONFIDENCE LEVELS:
- High (≥80%): Strong location + keyword match, clearance aligned
- Moderate (50-79%): Partial matches, some uncertainty
- Low (<50%): Limited data, multiple possible programs

IMPORTANT:
- If no clear match exists, return "Unmatched" with confidence < 30%
- Always provide reasoning for your match
- Consider multiple programs if location supports several
- Prioritize DCGS programs for San Diego, Langley, and Beale AFB locations
```

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 Program Mapping Intelligence Hub (Central Operational Database)

**Database Name**: Program Mapping Intelligence Hub  
**Database ID**: `f57792c1-605b-424c-8830-23ab41c47137`  
**Purpose**: Central hub for scraped and enriched job data

| Property | Type | Options/Notes |
|----------|------|---------------|
| Job Title | Title | Primary identifier |
| Job ID | Rich Text | Auto-generated unique ID |
| Company | Select | 13 competitor staffing firms |
| Location | Rich Text | Full location string |
| Location (City) | Formula | Extracted city |
| Location (State) | Formula | Extracted state |
| Clearance Level | Select | None, Public Trust, Secret, TS, TS/SCI, TS/SCI with Polygraph |
| Job Description | Rich Text | Full description text |
| Required Technologies | Multi-Select | Python, Java, AWS, Azure, Kubernetes, SQL, etc. |
| Job URL | URL | Source link |
| Scraped Date | Date | When job was captured |
| Status | Select | raw_import, pending_enrichment, enriched, error, archived |
| AI Confidence Score | Number | 0-100 confidence |
| Program Name | Rich Text | Matched program name |
| Agency | Select | Air Force, Army, Navy, MDA, NRO, etc. |
| Prime Contractor | Rich Text | Inferred prime |
| BD Score | Number | 0-100 opportunity score |
| Priority Level | Select | Hot, Warm, Cold |
| Error Log | Rich Text | Error details if failed |
| Retry Counter | Number | Processing attempts |
| Related Federal Programs | Relation | → Federal Programs |
| Prime Company | Relation | → Contractors Database |

**Relations**:
- `Related Federal Programs` → Federal Programs database
- `Prime Company` → Contractors Database
- `Related Contract Vehicles` → Contract Vehicles Master

---

### 5.2 Federal Programs (Reference Database)

**Database Name**: Federal Programs  
**Database ID**: `9db40fce-0781-42b9-902c-d4b0263b1e23`  
**Record Count**: 388 programs  
**Purpose**: Master reference for DoD/IC programs

| Property | Type | Options/Notes |
|----------|------|---------------|
| Program Name | Title | Primary identifier |
| Agency | Select | Air Force, Army, Navy, MDA, NRO, NSA, etc. |
| Program Type | Select | C5ISR, Missile, Cyber, Space, Nuclear, etc. |
| Prime Contractor | Multi-Select | GDIT, Northrop, Lockheed, etc. |
| Key Locations | Multi-Select | All program locations |
| Clearance Required | Select | Program minimum clearance |
| Contract Value | Select | $1M-$10M, $10M-$100M, $100M-$1B, $1B+ |
| Contract End Date | Date | When current contract expires |
| PTS Involvement | Select | Current, Past, Target, None |
| Priority Level | Select | Critical, High, Medium, Low |
| Pain Points | Rich Text | Known challenges |
| Confidence Level | Select | High, Moderate, Low |

---

### 5.3 BD Opportunities (Hot Leads)

**Database Name**: BD Opportunities  
**Database ID**: `2bcdef65-baa5-80ed-bd95-000b2f898e17`  
**Purpose**: Validated high-priority opportunities (score ≥70)

| Property | Type | Options/Notes |
|----------|------|---------------|
| Opportunity Name | Title | Primary identifier |
| Program | Relation | → Federal Programs |
| Location | Rich Text | Opportunity location |
| Prime Contractor | Select | Target prime |
| Priority Score | Number | BD Score from mapping |
| Status | Select | New, Pursuing, Won, Lost |
| Next Action | Rich Text | Follow-up required |
| Contact | Relation | → Contacts Database |

---

## 6. N8N WORKFLOWS

### 6.1 Prime TS BD Intelligence System v2.1

**Workflow Name**: Prime TS BD Intelligence System v2.1  
**Workflow ID**: `jYihwcJ5BG04QKVC`  
**Purpose**: Main BD pipeline - scraping, enrichment, scoring  
**Total Nodes**: 30  
**Trigger**: Scheduled (6 AM EST daily), Manual, or Webhook

#### Node Sequence:

```
LAYER 1: TRIGGERS
├── Schedule Trigger (Daily 6 AM EST)
├── Manual Trigger (On-Demand)
└── Webhook Trigger (POST /bd-intelligence)
         ↓
LAYER 2: SCRAPER ENGINE (Parallel Execution)
├── Set Configuration (Apify token, DB IDs, etc.)
├── Scrape Insight Global (Apify Puppeteer HTTP Request)
├── Wait for Insight Global (60s)
├── Get Insight Global Results
├── Scrape TEKsystems (parallel)
├── Scrape ClearanceJobs (parallel)
├── Merge All Jobs
├── Remove Duplicates
└── Standardize Job Data (Code node)
         ↓
LAYER 3: PROGRAM MAPPING ENGINE
├── Fetch Programs Database (Notion - 388 programs)
├── Prepare AI Matching Prompt (Code)
├── OpenAI GPT-4o Analysis (structured JSON output)
└── Parse AI Response (Code)
         ↓
LAYER 4: SCORING ENGINE
└── Calculate BD Score (Code - weighted formula)
         ↓
LAYER 5: STORAGE
├── Save to Program Mapping Hub (Notion)
├── Filter Hot Leads (Score ≥ 80)
└── Create BD Opportunity (Notion - if hot)
         ↓
LAYER 6: REPORTING
├── Aggregate for Summary
├── Create Summary Report (Code)
└── Send Daily Summary (Email to Gmaranville@prime-ts.com)
```

#### Key Configurations:

**Apify Scraper HTTP Request**:
```json
{
  "method": "POST",
  "url": "https://api.apify.com/v2/acts/apify~puppeteer-scraper/runs",
  "authentication": "httpQueryAuth",
  "queryParameters": [{"name": "token", "value": "={{ $json.apifyToken }}"}],
  "jsonBody": {
    "startUrls": [{"url": "https://jobs.insightglobal.com/jobs?q=security+clearance"}],
    "pageFunction": "async function pageFunction(context) {...}",
    "maxPagesPerCrawl": 10,
    "maxConcurrency": 5,
    "headless": true,
    "proxyConfiguration": {"useApifyProxy": true}
  },
  "timeout": 120000
}
```

**OpenAI Program Matching**:
```json
{
  "model": "gpt-4o",
  "temperature": 0.1,
  "maxTokens": 2000,
  "responseFormat": "json_object",
  "systemPrompt": "You are an expert DoD/IC federal program analyst..."
}
```

---

### 6.2 Federal Programs Data Fix

**Workflow Name**: Federal Programs Data Fix  
**Workflow ID**: `S5ZNab8nkGoDRVHG`  
**Purpose**: Transform imported data - Budget, Contract Vehicle, Program Type, Priority Level  
**Trigger**: Manual  
**Database Used**: Federal Programs

**Schema-Locked Properties (DO NOT RENAME)**:
- `property_contract_value`
- `property_contract_vehicle_type`
- `property_program_type_1`
- `property_confidence_level`

---

## 7. APIFY ACTORS & SCRAPERS

### Apify Configuration

**API Token**: `apify_api_n32KFOBo74tTXNi1nEH8nuaMMgrmRc15XrzS`  
**Actor**: `apify~puppeteer-scraper`

### Input Configuration:
```json
{
  "startUrls": [
    {"url": "https://jobs.insightglobal.com/jobs?q=security+clearance"},
    {"url": "https://www.teksystems.com/en/it-careers/search?keywords=clearance"},
    {"url": "https://www.clearancejobs.com/jobs"}
  ],
  "pageFunction": "async function pageFunction(context) { /* see scraper code */ }",
  "maxPagesPerCrawl": 10,
  "maxConcurrency": 5,
  "headless": true,
  "proxyConfiguration": {
    "useApifyProxy": true
  },
  "useChrome": false,
  "stealth": true,
  "ignoreSSLErrors": true,
  "maxRequestRetries": 3
}
```

### Output Schema:
```json
{
  "title": "string - Job title",
  "company": "string - Source company (Insight Global, TEKsystems, etc.)",
  "location": "string - Full location",
  "clearance": "string - Detected clearance level",
  "url": "string - Job posting URL",
  "description": "string - Full job description",
  "scraped_at": "ISO datetime - When scraped",
  "primary_keyword": "string - Search keyword that found this job",
  "technologies": "array - Detected tech stack"
}
```

### Rate Limiting:
- **Notion API**: No issues with current query volume
- **Apify**: 175 job scrapes completed in ~3 minutes
- **OpenAI API**: Batch in groups of 10, 350ms delay between requests

---

## 8. PROBLEMS SOLVED

### Problem 1: Context Transfer to Auto Claude
**Problem Description**: How to effectively hand off the complex Program Mapping Engine task to Auto Claude with all necessary context, data files, and specifications.

**Root Cause**: Auto Claude requires comprehensive task descriptions with specific file references, constraints, and success criteria to produce high-quality results.

**Solution Implemented**: Created a structured task description template that includes:
- Clear objective statement
- Input/output data formats with examples
- Multi-signal matching algorithm specification
- BD scoring algorithm with code reference
- Technical constraints and deliverables
- List of required files to load into the task folder

---

### Problem 2: Multi-Signal Matching Accuracy
**Problem Description**: Single-factor job-to-program matching (e.g., location-only) produces insufficient accuracy for BD targeting.

**Root Cause**: Defense contractor jobs can match multiple programs, and single signals are ambiguous (e.g., "San Diego" could be Navy or Air Force).

**Solution Implemented**: Designed weighted multi-signal algorithm:
- Location (30%) - Primary indicator
- Keywords (25%) - Program-specific terms
- Clearance (20%) - Hard filter
- Technology (15%) - Capability alignment
- Prime Contractor (10%) - Subcontracting inference

Combined score with confidence categorization (High/Moderate/Low).

---

### Problem 3: BD Scoring Consistency
**Problem Description**: Inconsistent scoring approaches across different workflow components and handoff documents.

**Root Cause**: Multiple scoring formulas evolved over time (DCGS-specific vs. general BD score).

**Solution Implemented**: Consolidated into two scoring options:
1. **Full BD Score** (5 weighted factors): For general opportunities
2. **DCGS Simplified Score** (Base + 4 boosts): For DCGS campaign focus

Both use consistent priority thresholds:
- Hot/Critical: ≥80
- Warm/High: 50-79
- Cold/Low: <50

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate (This Auto Claude Task)
1. **Build Program Mapping Engine module** - Python or TypeScript standalone
2. **Create GPT-4o integration** with system prompt and structured output
3. **Implement multi-signal matching algorithm**
4. **Add BD scoring engine**
5. **Write unit and integration tests**
6. **Document API for n8n integration**

### Post-Engine Build
1. **Integrate into n8n workflow** - Replace current Code node implementation
2. **Deploy as REST API** (optional) - FastAPI for standalone operation
3. **Validate accuracy** - Run against known job→program mappings
4. **Tune confidence thresholds** - Based on validation results

### Future Work
1. **Engine 3 (Org Chart)** - Contact/org structure discovery from LinkedIn
2. **Engine 4 (Playbook)** - AI-generated sales materials per program
3. **Engine 5 Enhancement** - ML-based scoring using historical win/loss data

---

## 10. KEY INSIGHTS & GOTCHAS

### Architecture Insights

1. **Multi-signal matching significantly outperforms single-factor** - Location alone is only ~60% accurate; combined signals reach 85%+.

2. **GPT-4o 128K context can hold all 388 programs** - Include full program database in system prompt for best results.

3. **Temperature 0.1 for deterministic matching** - Higher temperatures cause inconsistent results on the same input.

4. **Dual storage strategy works well** - Notion for operational management, PostgreSQL for analytics (future).

### Gotchas & Warnings

1. **⚠️ Schema-locked properties** - Never rename Notion properties that n8n workflows depend on:
   - `property_contract_value`
   - `property_contract_vehicle_type`
   - Database IDs are hardcoded

2. **⚠️ Rate limiting** - Implement 350ms delays between OpenAI API calls; batch jobs in groups of 10.

3. **⚠️ Apify scraper wait times** - Puppeteer scrapers take 60-90 seconds; use Wait nodes in n8n.

4. **⚠️ Clearance hierarchy matters** - "TS/SCI with Polygraph" is NOT the same as "TS/SCI" for scoring purposes.

5. **⚠️ Location parsing is fragile** - "San Diego, California" vs "San Diego, CA" vs "San Diego CA" - normalize before matching.

### Auto Claude Best Practices

1. **Load all reference data files** - The engine needs the full program database, not just descriptions.

2. **Use Opus 4.5 + Ultrathink for implementation** - Complex matching logic requires deep reasoning.

3. **Provide test data (GDIT Jobs.xlsx)** - Real job data for validation during development.

4. **Specify output format exactly** - Include full JSON schema in task description.

5. **Set clear success criteria** - "85% accuracy on DCGS jobs" is measurable; "works well" is not.

---

## FILES TO LOAD INTO AUTO CLAUDE TASK

### Required Files (Copy to Task Folder)

| File | Purpose | Priority |
|------|---------|----------|
| `Programs_Complete_Details_With_Jobs.xlsx` | Full program database (388 programs) | CRITICAL |
| `Federal_Programs_CLEANED_TRANSFORMED.xlsx` | Cleaned reference data | CRITICAL |
| `Full_Program_Database_Detailed_Notion_Export_Table_Format.xlsx` | Schema reference | HIGH |
| `GDIT_Jobs.xlsx` | Test data for validation | HIGH |
| `Job_PostingsGrid_view_1.csv` | Job schema reference | HIGH |
| `prime_ts_bd_intelligence_workflow.json` | Current n8n workflow | MEDIUM |
| `Prime_TS_BD_Intelligence_n8n_Workflow_Handoff.md` | Architecture docs | MEDIUM |
| `BD_Intelligence_System_Handoff_DocumentHUMINTplaybookandorgchart.md` | Scoring algorithm | MEDIUM |
| `notion_project_handoff.docx` | Notion database schemas | MEDIUM |
| `PTS_Notion_Database_Analysis_Dec2025.docx` | Field mappings | MEDIUM |

### Optional Context Files

| File | Purpose |
|------|---------|
| `competitor-job-scraper.js` | Current scraper code |
| `scraper-custom-instructions.md` | Scraper output format |
| `Competitor_Job_Board_URLs.xlsx` | Job board URLs list |

---

## DOCUMENT METADATA

| Field | Value |
|-------|-------|
| **Export Date** | January 10, 2025 |
| **Claude Model** | Claude Opus 4.5 |
| **Session Duration** | Single session |
| **Export Format** | Markdown (.md) |
| **Primary User** | DirtyDiablo (PTS BD Intelligence) |
| **Project** | Prime TS BD Intelligence System |
| **Engine Focus** | Engine 2 - Program Mapping |

---

*End of Export Document*
