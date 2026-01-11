# Program Mapping Engine - Claude Export
## PTS BD Intelligence System

**Export Date:** January 10, 2026  
**Conversation ID:** Program Mapping Engine Task Specification  
**System:** Prime Technical Services BD Intelligence System

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
**Program Mapping Engine Development** - Building a standalone TypeScript-based classification system to replace GPT-4o enrichment in the PTS BD Intelligence pipeline.

### Date Range
January 10, 2026 (single session)

### Primary Objective
Create a comprehensive Auto Claude task specification and supporting configuration files to build a deterministic Program Mapping Engine that:
1. Classifies defense contractor job postings to federal DoD/IC programs
2. Replaces expensive, non-deterministic GPT-4o enrichment (~$0.02-0.05/job)
3. Provides auditable confidence scores with reasoning chains
4. Integrates with existing n8n workflows and Notion databases

### Context
The user (DirtyDiablo) works for Prime Technical Services (PTS), a defense contracting company. They've built a BD Intelligence System that scrapes competitor job boards, maps jobs to federal programs, and calculates BD opportunity scores. The current GPT-4o enrichment step is expensive and non-deterministic, requiring replacement with a rule-based engine.

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: TypeScript Over Python
- **Decision:** Build the Program Mapping Engine in TypeScript
- **Reasoning:** 
  - Better type safety for complex classification logic
  - Easier integration with n8n (Node.js-based)
  - Strict mode catches errors at compile time
  - Aligns with modern serverless deployment patterns
- **Alternatives Considered:** Python (rejected due to n8n integration complexity)

### Decision 2: Deterministic Rule-Based Classification Over ML
- **Decision:** Use weighted rule-based scoring instead of ML model
- **Reasoning:**
  - 25 programs is small enough for explicit rules
  - Audit trail required for BD decisions
  - Zero inference cost
  - Explainable results (match reasons)
  - Can be tuned without retraining
- **Alternatives Considered:** Fine-tuned classifier, embeddings-based matching

### Decision 3: Cascade Classification Priority
- **Decision:** Implement 5-level cascade: Explicit Mention → Location+Role → Keyword → Location Only → Default
- **Reasoning:**
  - Explicit program acronyms are highest confidence
  - Location + role combination is strong signal
  - Keywords alone may be ambiguous
  - Provides graceful degradation
- **Alternatives Considered:** Single-pass scoring, ML ensemble

### Decision 4: JSON Configuration Files Over Hardcoded Data
- **Decision:** Store programs, locations, and scoring weights in external JSON files
- **Reasoning:**
  - Easy to update without code changes
  - Can be versioned independently
  - Enables A/B testing of classification rules
  - Supports multiple contractors (future)
- **Alternatives Considered:** Database storage, TypeScript constants

### Decision 5: Auto Claude with Ultrathink for Complex Phases
- **Decision:** Use "Complex tasks 4.5 + ultrathink" agent profile
- **Reasoning:**
  - Architecture design benefits from deep reasoning
  - Multi-factor scoring algorithm is complex
  - Better code quality on first pass
- **Alternatives Considered:** Standard Sonnet, manual development

---

## 3. ARCHITECTURE & DATA FLOW

### Current System Architecture (Pre-Engine)
```
[Apify Scrapers]
       │ Scrape GDIT, CACI, Leidos, Booz Allen job boards
       ▼
[n8n: Job Import Workflow]
       │ Webhook: POST /webhook/job-import
       │ Creates pages (Status: raw_import)
       ▼
┌───────────────────────────────────────────────────────────────┐
│           🧭 PROGRAM MAPPING INTELLIGENCE HUB                 │
│           (Central Nexus - 65 fields, 23 views)               │
│           Collection ID: f57792c1-605b-424c-8830-23ab41c47137 │
│                                                               │
│  Status: raw_import → pending_enrichment → enriching          │
│          → enriched → validated → error                       │
└───────────────────────────────────────────────────────────────┘
       │ GPT-4o Enrichment (BEING REPLACED)
       ▼
[n8n: Enrichment Processor] ──→ [OpenAI GPT-4o] 💰 EXPENSIVE
       │ Updates Hub (Program Name, AI Confidence, Priority Score)
       │ Status → enriched
       ▼
[n8n: Priority Alert] ──→ [Slack/Email]
       │ Hot ≥80 / Warm 50-79 / Cold <50
       ▼
┌───────────────────────────────────────────────────────────────┐
│                    OUTPUT DATABASES                           │
│  ├── 🎯 BD Opportunities (Pipeline)                           │
│  ├── 📅 BD Events (Conferences/Events)                        │
│  └── 📓 Enrichment Runs Log (Telemetry)                       │
└───────────────────────────────────────────────────────────────┘
```

### Future System Architecture (With Program Mapping Engine)
```
[Apify Scrapers]
       │
       ▼
[n8n: Job Import Workflow]
       │
       ▼
[Program Mapping Hub] (Status: raw_import)
       │
       ▼
┌─────────────────────────────────────────────────────────────┐
│   🆕 PROGRAM MAPPING ENGINE (TypeScript)                    │
│                                                              │
│   Input: JobInput (title, company, location, description)   │
│                     │                                        │
│                     ▼                                        │
│   ┌─────────────────────────────────────────────┐           │
│   │ 1. Explicit Program Mention (weight: 1.0)   │           │
│   │    Check for I2TS4, BICES, JUSTIFIED, etc.  │           │
│   └─────────────────────────────────────────────┘           │
│                     │ no match                              │
│                     ▼                                        │
│   ┌─────────────────────────────────────────────┐           │
│   │ 2. Location + Role Match (weight: 0.8)      │           │
│   │    Fort Meade + Net Admin = INSCOM          │           │
│   └─────────────────────────────────────────────┘           │
│                     │ no match                              │
│                     ▼                                        │
│   ┌─────────────────────────────────────────────┐           │
│   │ 3. Keyword Match (weight: 0.6)              │           │
│   │    "Coalition Intel" → BICES                 │           │
│   └─────────────────────────────────────────────┘           │
│                     │ no match                              │
│                     ▼                                        │
│   ┌─────────────────────────────────────────────┐           │
│   │ 4. Location Only (weight: 0.4)              │           │
│   │    Quantico VA → likely NCIS                 │           │
│   └─────────────────────────────────────────────┘           │
│                     │ no match                              │
│                     ▼                                        │
│   ┌─────────────────────────────────────────────┐           │
│   │ 5. Default → "Other" (weight: 0)            │           │
│   └─────────────────────────────────────────────┘           │
│                                                              │
│   Output: ClassificationResult                              │
│   - programCode, programName                                │
│   - confidenceScore, confidenceLevel                        │
│   - matchReasons[] (audit trail)                            │
│   - priorityScore, clearanceBoost, programRelevanceBoost    │
└─────────────────────────────────────────────────────────────┘
       │
       ▼
[n8n: Update Hub] (Status: enriched)
       │
       ▼
[Priority Alerts] → [BD Opportunities]
```

### API Connections & Integration Points

| System | Connection Type | Purpose |
|--------|----------------|---------|
| Apify Cloud | Webhook POST | Job scraping triggers |
| n8n (primetech.app.n8n.cloud) | HTTP Webhook | Job import, enrichment orchestration |
| Notion API | MCP Integration | Read/write Program Mapping Hub |
| Program Mapping Engine | Local/Lambda | Classification processing |
| Slack | n8n Integration | Hot/Warm/Cold alerts |

### Key Collection IDs (Notion)

| Database | Collection ID |
|----------|---------------|
| Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` |
| Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` |
| BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` |
| Enrichment Runs Log | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` |
| GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` |

---

## 4. CODE & CONFIGURATIONS

### 4.1 Auto Claude Task Specification

**File/Component Name:** `PTS_AutoClaude_ProgramMappingEngine_Task.md`  
**Purpose:** Complete task description for Auto Claude to build the Program Mapping Engine

**Code/Config:**
```markdown
# Auto Claude Task: Program Mapping Engine

## 📋 Task Title
**PTS Program Mapping Engine - Intelligent Classification System**

---

## 🎯 Agent Profile
**Recommended:** `Auto optimize per phase optimization` + `Complex tasks 4.5 + ultrathink`

### Phase Optimization Rationale:
| Phase | Model/Mode | Reasoning |
|-------|------------|-----------|
| **Architecture Design** | Claude 4.5 + ultrathink | Complex system design requiring deep reasoning |
| **Data Structure Definition** | Claude 4.5 | Type definitions, JSON schemas |
| **Core Algorithm Implementation** | Claude 4.5 + ultrathink | Multi-factor scoring algorithm |
| **Keyword/Location Matching** | Sonnet 4 | Pattern matching, string ops |
| **Testing & Validation** | Sonnet 4 | Test case execution |
| **Documentation** | Sonnet 4 | README, comments |

---

## 📄 Description

### Overview
Build a standalone **Program Mapping Engine** that classifies defense contractor job postings to their associated federal DoD/IC programs. This engine will replace the current GPT-4o enrichment step in the n8n workflow, providing deterministic, auditable, and cost-effective program classification.

### Business Context
Prime Technical Services (PTS) operates a BD (Business Development) Intelligence System that:
1. Scrapes competitor job boards (GDIT, CACI, Leidos, Booz Allen, etc.)
2. Imports jobs into Notion via Apify → n8n webhook
3. Uses AI (currently GPT-4o) to map jobs to federal programs
4. Calculates BD opportunity scores (Hot ≥80 / Warm 50-79 / Cold <50)
5. Triggers alerts for high-priority opportunities

**Problem:** GPT-4o enrichment is:
- Expensive (~$0.02-0.05 per job classification)
- Non-deterministic (same input can produce different outputs)
- Black-box (no audit trail of why a classification was made)
- Rate-limited (processing ~550 jobs takes time)

**Solution:** A rule-based + weighted scoring engine that:
- Processes jobs deterministically
- Provides confidence scores with reasoning
- Costs $0 per classification (runs locally)
- Can be audited and tuned

---

## 🔧 Technical Requirements

### 1. Input Schema
The engine receives job data from the Program Mapping Hub (Notion database):

```typescript
interface JobInput {
  // Required fields
  jobTitle: string;           // e.g., "Network Administrator"
  company: string;            // e.g., "GDIT" or "Insight Global"
  location: string;           // e.g., "Fort Meade, MD"
  jobDescription: string;     // Full job posting text
  
  // Optional enrichment fields
  clearanceLevel?: string;    // e.g., "TS/SCI", "Secret", "None"
  sourceUrl?: string;         // Original job posting URL
  
  // Metadata
  recordId?: string;          // Notion page ID for updates
  status?: string;            // Current workflow status
}
```

### 2. Output Schema
The engine produces classification results:

```typescript
interface ClassificationResult {
  // Primary classification
  programCode: string;        // e.g., "INSCOM", "BICES", "Other"
  programName: string;        // e.g., "INSCOM IT Support Services (I2TS4)"
  
  // Confidence scoring
  confidenceScore: number;    // 0.0 - 1.0
  confidenceLevel: "High" | "Moderate" | "Low";
  
  // Match reasoning (audit trail)
  matchReasons: MatchReason[];
  
  // Alternative matches (for review)
  alternativeMatches?: AlternativeMatch[];
  
  // BD Scoring inputs
  priorityScore: number;      // 0-100 (calculated)
  clearanceBoost: number;     // 0-35 points
  programRelevanceBoost: number; // 0-20 points
}

interface MatchReason {
  type: "explicit_mention" | "location_match" | "keyword_match" | "role_match";
  evidence: string;           // The matched text
  weight: number;             // How much this contributed
}

interface AlternativeMatch {
  programCode: string;
  confidenceScore: number;
  reason: string;
}
```

### 3. Classification Algorithm

#### Priority Order (Cascade):
1. **Explicit Program Mention** (weight: 100%)
   - Check job title and description for exact program acronyms
   - Examples: "I2TS4", "BICES", "JUSTIFIED", "MPCO"
   
2. **Location + Role Match** (weight: 80%)
   - Cross-reference location with program key locations
   - Validate role type matches typical program roles
   
3. **Keyword Match** (weight: 60%)
   - Search description for program-specific keywords
   - Weight by specificity (unique vs. common keywords)
   
4. **Location Only** (weight: 40%)
   - If location strongly indicates a program but no keyword match

5. **Default** (weight: 0%)
   - Return "Other" with Low confidence

#### Confidence Calculation:
```
High (>0.8):    Location + Title + Clearance ALL match known patterns
Moderate (0.5-0.8): 2 of 3 indicators match
Low (<0.5):     Only 1 indicator, or location unknown
```

---

## ⚠️ Constraints

1. **No External API Calls** - Must run 100% locally (no GPT-4o, no cloud services)
2. **Deterministic** - Same input always produces same output
3. **Auditable** - Every classification includes reasoning chain
4. **Extensible** - Easy to add new programs, keywords, locations
5. **Fast** - Process 1000+ jobs per minute
6. **Type-Safe** - Full TypeScript with strict mode

---

## 📊 Success Criteria

| Metric | Target |
|--------|--------|
| Classification Accuracy | ≥90% match vs. manual review |
| Processing Speed | <10ms per job |
| Confidence Calibration | High confidence = >95% correct |
| Code Coverage | ≥80% unit test coverage |
| Documentation | Complete README + JSDoc |
```

---

### 4.2 Programs Configuration

**File/Component Name:** `config/programs.json`  
**Purpose:** Complete program reference data for all 25 GDIT programs with keywords, locations, and role patterns

**Code/Config:**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": "1.0.0",
  "lastUpdated": "2026-01-07",
  "source": "PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx",
  "programs": [
    {
      "code": "INSCOM",
      "name": "INSCOM IT Support Services (I2TS4)",
      "acronyms": ["I2TS4", "I2TS-III", "IT2S4", "I2TS"],
      "agency": "Army",
      "primeContractor": "GDIT",
      "priority": "High",
      "clearance": ["TS/SCI"],
      "keywords": ["I2TS4", "I2TS", "INSCOM", "Intelligence Support"],
      "keyLocations": [
        "Fort Meade MD",
        "Fort Belvoir VA",
        "Fort Liberty NC",
        "Fort Sam Houston TX",
        "Fort Carson CO",
        "Fort Bliss TX",
        "Redstone Arsenal AL",
        "Hunter AAF GA",
        "Savannah GA",
        "Fort Eisenhower GA",
        "Camp Bullis TX",
        "Joint Base Lewis-McChord WA"
      ],
      "typicalRoles": [
        "Network Administrator",
        "Systems Administrator",
        "Help Desk",
        "Intel IT Support",
        "Field Service"
      ]
    },
    {
      "code": "JUSTIFIED",
      "name": "Air Force SAP Security Support Services",
      "acronyms": ["Justified"],
      "agency": "Air Force",
      "primeContractor": "GDIT",
      "priority": "High",
      "clearance": ["TS/SCI", "SAP"],
      "keywords": ["JUSTIFIED", "SAP Security", "ASR", "PSR", "Activity Security Representative", "Physical Security Representative"],
      "keyLocations": [
        "Pentagon VA",
        "Kirtland AFB NM",
        "Schriever SFB CO",
        "Hanscom AFB MA",
        "Langley AFB VA",
        "Eglin AFB FL",
        "JBAB DC",
        "San Antonio TX",
        "Robins AFB GA",
        "Colorado Springs CO"
      ],
      "typicalRoles": [
        "IT/IA Specialist",
        "ISSO",
        "ISSM",
        "Activity Security Representative",
        "Physical Security Representative",
        "Network Admin",
        "Systems Admin"
      ]
    },
    {
      "code": "BICES",
      "name": "Battlefield Information Collection & Exploitation System",
      "acronyms": ["BICES"],
      "agency": "DoD",
      "primeContractor": "CACI (GDIT sub)",
      "priority": "High",
      "clearance": ["Secret", "TS/SCI"],
      "keywords": ["BICES", "Coalition Intel", "Mission Partner"],
      "keyLocations": [
        "Tampa FL",
        "MacDill AFB FL",
        "Springfield VA",
        "Norfolk VA",
        "Doral FL",
        "Colorado Springs CO",
        "Hawaii",
        "Pearl Harbor HI"
      ],
      "typicalRoles": [
        "Network Engineer",
        "Systems Engineer",
        "Linux Admin",
        "Windows Admin",
        "SharePoint Engineer",
        "Cyber Analyst",
        "NOSC Analyst",
        "VoIP/CUCM Admin"
      ]
    },
    {
      "code": "BICES-X",
      "name": "DIA Battlefield Information Networks / BICES-X",
      "acronyms": ["BICES-X", "BICESX"],
      "agency": "DIA",
      "primeContractor": "CACI (GDIT sub)",
      "priority": "High",
      "clearance": ["TS/SCI"],
      "keywords": ["BICES-X", "BICESX", "DIA BICES"],
      "keyLocations": [
        "MacDill AFB FL",
        "Tampa FL",
        "Springfield VA",
        "Offutt AFB NE",
        "Stuttgart Germany"
      ],
      "typicalRoles": [
        "Network Administrator",
        "Systems Architect",
        "Systems Administrator"
      ]
    },
    {
      "code": "MPCO",
      "name": "Mission Partner Environment (Field Ops / MPCO)",
      "acronyms": ["MPCO", "MPE"],
      "agency": "DoD",
      "primeContractor": "GDIT",
      "priority": "High",
      "clearance": ["Secret", "TS/SCI"],
      "keywords": ["MPCO", "MPE", "Mission Partner Environment", "Mission Partner"],
      "keyLocations": [
        "Tampa FL",
        "Pearl Harbor HI",
        "Colorado Springs CO",
        "Norfolk VA",
        "Springfield VA",
        "Langley VA"
      ],
      "typicalRoles": [
        "Network Administrator",
        "Systems Administrator",
        "Information Security Analyst",
        "Solarwinds Analyst",
        "NOSC Analyst"
      ]
    },
    {
      "code": "DEOS",
      "name": "Defense Enterprise Office Solutions",
      "acronyms": ["DEOS"],
      "agency": "DoD",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["Secret"],
      "keywords": ["DEOS", "O365", "Microsoft 365", "Office 365", "Teams", "SharePoint Online"],
      "keyLocations": [
        "Fort Meade MD",
        "Chantilly VA",
        "Durham NC",
        "Remote",
        "Hybrid"
      ],
      "typicalRoles": [
        "M365 Admin",
        "Cloud Engineer",
        "Exchange Admin",
        "Teams Support",
        "SharePoint Admin"
      ]
    },
    {
      "code": "NCIS",
      "name": "Naval Criminal Investigative Service IT Support",
      "acronyms": ["NCIS"],
      "agency": "Navy",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["TS/SCI"],
      "keywords": ["NCIS", "Naval Criminal"],
      "keyLocations": ["Quantico VA"],
      "typicalRoles": [
        "Cyber Security Analyst",
        "IT Support",
        "Network Administrator"
      ]
    },
    {
      "code": "ADCS4",
      "name": "Air Defense Command & Control System 4",
      "acronyms": ["ADCS4"],
      "agency": "Air Force",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["Secret"],
      "keywords": ["ADCS4", "Air Defense Command"],
      "keyLocations": ["Hampton VA", "Tyndall AFB FL"],
      "typicalRoles": [
        "Network Administrator",
        "Systems Administrator"
      ]
    },
    {
      "code": "ADCNOMS",
      "name": "Air Defense Communications Network Operations & Maintenance Support",
      "acronyms": ["ADCNOMS"],
      "agency": "Air Force",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["Secret"],
      "keywords": ["ADCNOMS", "Air Defense Communications"],
      "keyLocations": ["Schriever SFB CO", "Fort Huachuca AZ"],
      "typicalRoles": [
        "Network Admin",
        "Communications Specialist"
      ]
    },
    {
      "code": "DSMS",
      "name": "Defense Security Management System / DTRA Support",
      "acronyms": ["DSMS", "DTRA"],
      "agency": "DoD",
      "primeContractor": "GDIT/Leidos",
      "priority": "Medium",
      "clearance": ["TS/SCI"],
      "keywords": ["DSMS", "DTRA", "Defense Security", "Defense Threat Reduction"],
      "keyLocations": ["Fort Belvoir VA", "Kirtland AFB NM"],
      "typicalRoles": [
        "Security Analyst",
        "IT Support",
        "Systems Administrator"
      ]
    },
    {
      "code": "SITEC",
      "name": "SITEC III – Enterprise Operations & Maintenance",
      "acronyms": ["SITEC", "SITEC III"],
      "agency": "Army",
      "primeContractor": "Peraton (GDIT sub)",
      "priority": "Medium",
      "clearance": ["Secret"],
      "keywords": ["SITEC", "SITEC III"],
      "keyLocations": ["Fort Liberty NC"],
      "typicalRoles": [
        "Network Admin",
        "Systems Admin",
        "Field Support"
      ]
    },
    {
      "code": "WARHAWK",
      "name": "WARHAWK Software Development",
      "acronyms": ["WARHAWK"],
      "agency": "DoD",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["Secret"],
      "keywords": ["WARHAWK"],
      "keyLocations": ["Remote"],
      "typicalRoles": [
        "Software Developer",
        "DevSecOps Engineer"
      ]
    },
    {
      "code": "CMS",
      "name": "Centers for Medicare & Medicaid Services Cloud/HFPP",
      "acronyms": ["CMS", "HFPP"],
      "agency": "HHS",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["None", "Public Trust"],
      "keywords": ["CMS", "HFPP", "Medicare", "Medicaid"],
      "keyLocations": ["Remote", "Baltimore MD"],
      "typicalRoles": [
        "Cloud Engineer",
        "DevOps",
        "Data Analyst"
      ]
    },
    {
      "code": "BAO",
      "name": "Blanket Ordering Agreement (General Software)",
      "acronyms": ["BAO"],
      "agency": "Various",
      "primeContractor": "GDIT",
      "priority": "Low",
      "clearance": ["Varies"],
      "keywords": ["BAO", "Blanket Ordering"],
      "keyLocations": ["Remote", "Various"],
      "typicalRoles": [
        "Software Developer",
        "IT Support"
      ]
    },
    {
      "code": "DLA",
      "name": "DLA J6 Enterprise Technology Services",
      "acronyms": ["DLA", "J6"],
      "agency": "DLA",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["Secret"],
      "keywords": ["DLA", "J6", "Defense Logistics"],
      "keyLocations": ["Fort Belvoir VA", "Springfield VA"],
      "typicalRoles": [
        "Enterprise Architect",
        "Systems Engineer",
        "Database Admin"
      ]
    },
    {
      "code": "SCITES",
      "name": "SCITLS / SCITES Logistics IT",
      "acronyms": ["SCITES", "SCITLS"],
      "agency": "Army",
      "primeContractor": "GDIT",
      "priority": "Low",
      "clearance": ["Secret"],
      "keywords": ["SCITES", "SCITLS", "Logistics IT"],
      "keyLocations": ["Various"],
      "typicalRoles": [
        "IT Support",
        "Logistics Analyst"
      ]
    },
    {
      "code": "NSST",
      "name": "Navy Shipboard Systems Training",
      "acronyms": ["NSST"],
      "agency": "Navy",
      "primeContractor": "GDIT",
      "priority": "Low",
      "clearance": ["Secret"],
      "keywords": ["NSST", "Navy Training"],
      "keyLocations": ["Orlando FL"],
      "typicalRoles": [
        "Logistics Associate",
        "Trainer",
        "Simulator/IT Technician"
      ]
    },
    {
      "code": "JSP ETM",
      "name": "Joint Service Provider Enterprise Technology Modernization",
      "acronyms": ["JSP ETM", "JSP"],
      "agency": "DoD",
      "primeContractor": "CACI (GDIT sub)",
      "priority": "High",
      "clearance": ["Secret", "TS/SCI"],
      "keywords": ["JSP", "JSP ETM", "Pentagon IT", "Joint Service Provider"],
      "keyLocations": ["Pentagon VA", "NCR"],
      "typicalRoles": [
        "Network Engineer",
        "Intercept Monitor",
        "Help Desk",
        "VTC Support"
      ]
    },
    {
      "code": "ISEE",
      "name": "Intelligence Systems Security Engineering",
      "acronyms": ["ISEE", "ISSE"],
      "agency": "DoD",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["CI Poly", "TS/SCI"],
      "keywords": ["ISEE", "ISSE", "Intel Systems"],
      "keyLocations": ["Tampa FL"],
      "typicalRoles": [
        "Exchange Engineer",
        "Intel Systems Security Engineer"
      ]
    },
    {
      "code": "DHA D2D",
      "name": "Defense Health Agency Desktop to Datacenter",
      "acronyms": ["D2D", "DHA D2D"],
      "agency": "DHA",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["Secret"],
      "keywords": ["DHA", "D2D", "Desktop to Datacenter", "Defense Health"],
      "keyLocations": ["San Antonio TX", "NCR", "Hawaii"],
      "typicalRoles": [
        "IT Support",
        "Network Engineer",
        "Systems Administrator"
      ]
    },
    {
      "code": "F-35 JSF",
      "name": "F-35 Joint Strike Fighter Program Support",
      "acronyms": ["F-35", "JSF"],
      "agency": "DoD",
      "primeContractor": "GDIT",
      "priority": "Low",
      "clearance": ["Secret"],
      "keywords": ["F-35", "JSF", "Joint Strike Fighter"],
      "keyLocations": ["Dayton OH"],
      "typicalRoles": [
        "Help Desk Tech",
        "IT Support"
      ]
    },
    {
      "code": "CENTCOM",
      "name": "CENTCOM Enterprise IT Modernization",
      "acronyms": ["CENTCOM", "EITM"],
      "agency": "CENTCOM",
      "primeContractor": "GDIT",
      "priority": "Medium",
      "clearance": ["Secret", "Top Secret"],
      "keywords": ["CENTCOM", "EITM"],
      "keyLocations": ["MacDill AFB FL", "OCONUS"],
      "typicalRoles": [
        "IT Modernization",
        "Enterprise IT"
      ]
    },
    {
      "code": "AFNORTH",
      "name": "Air Forces Northern Command Support",
      "acronyms": ["AFNORTH"],
      "agency": "Air Force",
      "primeContractor": "GDIT",
      "priority": "Low",
      "clearance": ["Secret"],
      "keywords": ["AFNORTH", "NORAD"],
      "keyLocations": ["Tyndall AFB FL", "Peterson AFB CO"],
      "typicalRoles": [
        "IT Support",
        "Network Engineer"
      ]
    },
    {
      "code": "CBOSS",
      "name": "C-Band Operations Support Services",
      "acronyms": ["CBOSS"],
      "agency": "Space Force",
      "primeContractor": "GDIT",
      "priority": "Low",
      "clearance": ["Secret"],
      "keywords": ["CBOSS", "C-Band"],
      "keyLocations": ["Various"],
      "typicalRoles": [
        "Operations Support",
        "SATCOM"
      ]
    },
    {
      "code": "Other",
      "name": "Other/Unclassified Programs",
      "acronyms": [],
      "agency": "Various",
      "primeContractor": "Various",
      "priority": "Low",
      "clearance": ["Any"],
      "keywords": [],
      "keyLocations": ["Any"],
      "typicalRoles": []
    }
  ]
}
```

---

### 4.3 Locations Configuration

**File/Component Name:** `config/locations.json`  
**Purpose:** Location-to-program mapping with 50+ location aliases for fuzzy matching

**Code/Config:**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": "1.0.0",
  "lastUpdated": "2026-01-07",
  "source": "PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx",
  "locationProgramMap": {
    "Pentagon VA": ["JUSTIFIED", "JSP ETM"],
    "Fort Meade MD": ["INSCOM", "DEOS"],
    "Fort Belvoir VA": ["INSCOM", "DSMS", "DLA"],
    "Fort Liberty NC": ["INSCOM", "SITEC"],
    "Fort Bragg NC": ["INSCOM", "SITEC"],
    "Tampa FL": ["BICES", "BICES-X", "MPCO", "CENTCOM", "ISEE"],
    "MacDill AFB FL": ["BICES", "BICES-X", "MPCO", "CENTCOM"],
    "MacDill AFB": ["BICES", "BICES-X", "MPCO", "CENTCOM"],
    "Kirtland AFB NM": ["JUSTIFIED", "DSMS"],
    "Schriever SFB CO": ["JUSTIFIED", "ADCNOMS"],
    "Colorado Springs CO": ["JUSTIFIED", "MPCO", "BICES"],
    "Hanscom AFB MA": ["JUSTIFIED"],
    "Langley AFB VA": ["JUSTIFIED", "MPCO"],
    "Langley VA": ["JUSTIFIED", "MPCO"],
    "Quantico VA": ["NCIS"],
    "Hampton VA": ["ADCS4"],
    "Tyndall AFB FL": ["ADCS4", "AFNORTH"],
    "Springfield VA": ["BICES", "BICES-X", "DLA", "MPCO"],
    "Norfolk VA": ["BICES", "MPCO"],
    "Pearl Harbor HI": ["BICES-X", "MPCO"],
    "Hawaii": ["BICES-X", "MPCO", "DHA D2D"],
    "Fort Sam Houston TX": ["INSCOM"],
    "San Antonio TX": ["JUSTIFIED", "DHA D2D"],
    "Chantilly VA": ["DEOS"],
    "Durham NC": ["DEOS"],
    "Fort Huachuca AZ": ["ADCNOMS"],
    "Orlando FL": ["NSST"],
    "Dayton OH": ["F-35 JSF"],
    "Peterson AFB CO": ["AFNORTH"],
    "Offutt AFB NE": ["BICES-X"],
    "Stuttgart Germany": ["BICES-X"],
    "Eglin AFB FL": ["JUSTIFIED"],
    "JBAB DC": ["JUSTIFIED"],
    "Joint Base Anacostia-Bolling DC": ["JUSTIFIED"],
    "Robins AFB GA": ["JUSTIFIED"],
    "Fort Carson CO": ["INSCOM"],
    "Fort Bliss TX": ["INSCOM"],
    "Redstone Arsenal AL": ["INSCOM"],
    "Hunter AAF GA": ["INSCOM"],
    "Savannah GA": ["INSCOM"],
    "Fort Eisenhower GA": ["INSCOM"],
    "Camp Bullis TX": ["INSCOM"],
    "Joint Base Lewis-McChord WA": ["INSCOM"],
    "JBLM WA": ["INSCOM"],
    "Doral FL": ["BICES"],
    "Baltimore MD": ["CMS"],
    "NCR": ["JSP ETM", "DHA D2D"],
    "National Capital Region": ["JSP ETM", "DHA D2D"],
    "Washington DC": ["JSP ETM", "JUSTIFIED"],
    "Remote": ["DEOS", "CMS", "WARHAWK", "BAO"],
    "Hybrid": ["DEOS", "CMS", "WARHAWK", "BAO"],
    "Telework": ["DEOS", "CMS", "WARHAWK", "BAO"],
    "OCONUS": ["CENTCOM", "BICES-X"]
  },
  "locationAliases": {
    "Ft. Meade": "Fort Meade MD",
    "Ft Meade": "Fort Meade MD",
    "Ft. Belvoir": "Fort Belvoir VA",
    "Ft Belvoir": "Fort Belvoir VA",
    "Ft. Liberty": "Fort Liberty NC",
    "Ft Liberty": "Fort Liberty NC",
    "Ft. Bragg": "Fort Liberty NC",
    "Ft Bragg": "Fort Liberty NC",
    "Fort Bragg": "Fort Liberty NC",
    "Ft. Sam Houston": "Fort Sam Houston TX",
    "Ft Sam Houston": "Fort Sam Houston TX",
    "Ft. Carson": "Fort Carson CO",
    "Ft Carson": "Fort Carson CO",
    "Ft. Bliss": "Fort Bliss TX",
    "Ft Bliss": "Fort Bliss TX",
    "Ft. Huachuca": "Fort Huachuca AZ",
    "Ft Huachuca": "Fort Huachuca AZ",
    "Ft. Eisenhower": "Fort Eisenhower GA",
    "Ft Eisenhower": "Fort Eisenhower GA",
    "MacDill": "MacDill AFB FL",
    "Schriever": "Schriever SFB CO",
    "Schriever AFB": "Schriever SFB CO",
    "Kirtland": "Kirtland AFB NM",
    "Hanscom": "Hanscom AFB MA",
    "Langley": "Langley AFB VA",
    "Tyndall": "Tyndall AFB FL",
    "Peterson": "Peterson AFB CO",
    "Offutt": "Offutt AFB NE",
    "Eglin": "Eglin AFB FL",
    "Robins": "Robins AFB GA",
    "Pearl Harbor": "Pearl Harbor HI",
    "Colorado Springs": "Colorado Springs CO",
    "San Antonio": "San Antonio TX",
    "JBAB": "JBAB DC"
  },
  "stateToRegion": {
    "VA": "NCR",
    "MD": "NCR",
    "DC": "NCR",
    "FL": "Southeast",
    "GA": "Southeast",
    "NC": "Southeast",
    "TX": "Southwest",
    "NM": "Southwest",
    "AZ": "Southwest",
    "CO": "Mountain",
    "HI": "Pacific",
    "WA": "Pacific",
    "OH": "Midwest",
    "NE": "Midwest",
    "MA": "Northeast"
  }
}
```

---

### 4.4 Scoring Weights Configuration

**File/Component Name:** `config/scoring-weights.json`  
**Purpose:** BD scoring algorithm weights for calculating priority scores and confidence levels

**Code/Config:**
```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "version": "1.0.0",
  "lastUpdated": "2026-01-07",
  "source": "PTS_BD_Intelligence_Architecture_Blueprint_v3_3_FINAL.docx",
  
  "classificationWeights": {
    "explicitProgramMention": {
      "weight": 1.0,
      "description": "Direct program acronym in title/description",
      "examples": ["I2TS4", "BICES", "JUSTIFIED"]
    },
    "locationAndRoleMatch": {
      "weight": 0.8,
      "description": "Location matches program AND role type matches",
      "examples": ["Fort Meade + Network Admin = INSCOM"]
    },
    "keywordMatch": {
      "weight": 0.6,
      "description": "Program-specific keywords found in description",
      "examples": ["Coalition Intel", "SAP Security"]
    },
    "locationOnly": {
      "weight": 0.4,
      "description": "Location matches but no keyword/role confirmation",
      "examples": ["Quantico VA → likely NCIS"]
    },
    "roleOnly": {
      "weight": 0.2,
      "description": "Role matches typical program roles but no location/keyword",
      "examples": ["ISSO position with no location"]
    }
  },

  "bdScoringAlgorithm": {
    "baseScore": 50,
    "maxScore": 100,
    
    "components": {
      "clearanceBoost": {
        "maxPoints": 35,
        "values": {
          "TS/SCI w/ Poly": 35,
          "TS/SCI Poly": 35,
          "CI Poly": 35,
          "TS/SCI": 25,
          "Top Secret/SCI": 25,
          "TS": 15,
          "Top Secret": 15,
          "Secret": 5,
          "Public Trust": 2,
          "None": 0,
          "Unknown": 0
        }
      },
      "confidenceBoost": {
        "maxPoints": 20,
        "values": {
          "High": 20,
          "Moderate": 10,
          "Low": 0
        }
      },
      "programRelevanceBoost": {
        "maxPoints": 20,
        "values": {
          "Direct": 20,
          "Adjacent": 15,
          "Related": 10,
          "General": 0
        }
      },
      "keywordBoost": {
        "maxPoints": 10,
        "description": "Bonus for DCGS, ISR, 480TH, NASIC keywords in program"
      }
    }
  },

  "confidenceThresholds": {
    "high": {
      "minScore": 0.8,
      "criteria": "Location + Title + Clearance ALL match known program patterns"
    },
    "moderate": {
      "minScore": 0.5,
      "criteria": "2 of 3 indicators match"
    },
    "low": {
      "minScore": 0.0,
      "criteria": "Only 1 indicator, or location unknown"
    }
  },

  "priorityThresholds": {
    "hot": {
      "minScore": 80,
      "color": "red",
      "action": "Immediate pursuit, assign BD lead"
    },
    "warm": {
      "minScore": 50,
      "color": "yellow",
      "action": "Monitor, prep capability statement"
    },
    "cold": {
      "minScore": 0,
      "color": "green",
      "action": "Track only, no active pursuit"
    }
  },

  "programPriorityWeights": {
    "High": 1.0,
    "Medium": 0.7,
    "Low": 0.4
  },

  "companyPriorityWeights": {
    "GDIT": 1.0,
    "CACI": 0.9,
    "Leidos": 0.9,
    "Booz Allen": 0.85,
    "Peraton": 0.8,
    "Insight Global": 0.7,
    "TEKsystems": 0.65,
    "Other": 0.5
  }
}
```

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 Program Mapping Hub (Central Database)

**Database Name:** 🧭 Program Mapping Intelligence Hub  
**Collection ID:** `f57792c1-605b-424c-8830-23ab41c47137`  
**Purpose:** Central jobs + enrichment hub (65 fields, 23 views)

#### Core Identity Fields (8 fields)

| Property | Type | Schema-Locked | Description |
|----------|------|---------------|-------------|
| Job Title | title | ⚠️ YES | Primary identifier |
| Company | text | ⚠️ YES | Staffing firm source |
| Program Name | text | No | AI-mapped DoD/IC program name |
| Source URL | url | ⚠️ YES | Original job posting link (dedup key) |
| Job Description | text | ⚠️ YES | Full posting text (AI input) |
| Location | text | No | Job location (city, state) |
| City | formula | No | Parsed from Location - PLACEHOLDER |
| State | formula | No | Parsed from Location - PLACEHOLDER |

#### Status & Workflow Fields

| Property | Type | Schema-Locked | Options |
|----------|------|---------------|---------|
| Status | select | ⚠️ YES | `raw_import`, `pending_enrichment`, `enriching`, `enriched`, `validated`, `error` |
| Enrichment Timestamp | date | ⚠️ YES | Processing timing |
| Apify Run ID | text | ⚠️ YES | Batch tracking |

#### Government Context Fields

| Property | Type | Options |
|----------|------|---------|
| Agency | select | DoD, Army, Navy, Air Force, Space Force, CIA, NSA, DIA, NGA, FBI, DHS, State, Treasury, VA, NASA, DOE, Other |
| Contract Vehicle | select | CIO-SP3, SEWP, Alliant 2, DISA Encore III, GSA Schedules, 8(a) STARS III, OASIS+, Custom |
| Clearance Level | select | None, Public Trust, Secret, TS, TS/SCI, TS/SCI w/ Poly |
| Contract Value | number | Currency - dollar amount |
| Contract End Date | date | For recompete tracking |

#### Scoring Fields

| Property | Type | Schema-Locked | Description |
|----------|------|---------------|-------------|
| Priority Score | number | ⚠️ YES | 0-100 BD score |
| AI Confidence Score | number | ⚠️ YES | 0-1 GPT-4o/Engine confidence |

### 5.2 Federal Programs (Reference Database)

**Database Name:** 🏛️ Federal Programs  
**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`  
**Purpose:** DoD/IC program catalog (388+ programs)

| Property | Type | Schema-Locked | Description |
|----------|------|---------------|-------------|
| Program Name | title | ⚠️ YES | Primary identifier |
| property_contract_value | number | ⚠️ YES | Contract value |
| property_contract_vehicle_type | select | ⚠️ YES | Vehicle type |
| property_program_type_1 | select | ⚠️ YES | Program classification |
| property_confidence_level | select | ⚠️ YES | Data quality |

### 5.3 BD Opportunities (Output Database)

**Database Name:** 🎯 BD Opportunities  
**Collection ID:** `2bcdef65-baa5-80ed-bd95-000b2f898e17`  
**Purpose:** Sales pipeline (16 fields)

| Property | Type | Description |
|----------|------|-------------|
| Opportunity Name | title | Primary identifier |
| Source Job Title | text | From Program Mapping Hub |
| Matched Program | relation | Link to Federal Programs |
| Priority Score | number | 0-100 |
| BD Status | select | New, Qualifying, Pursuing, Won, Lost |
| Assigned To | people | BD lead |

---

## 6. N8N WORKFLOWS

### 6.1 Workflow 1: Apify Job Import

**Workflow Name:** Apify Job Import  
**Purpose:** Receive scraped jobs from Apify and create records in Notion

| Attribute | Value |
|-----------|-------|
| **Trigger** | Webhook: POST `/webhook/job-import` |
| **Database** | Program Mapping Hub (`f57792c1-605b-424c-8830-23ab41c47137`) |
| **Status Set** | `raw_import` |

**Node Sequence:**
```
[Webhook Trigger] → [JSON Parser] → [Notion: Create Page] → [Response]
```

**Properties Written:**
- Job Title
- Company
- Location
- Job Description
- Source URL
- Clearance Level
- Status (raw_import)
- Apify Run ID

### 6.2 Workflow 2: Enrichment Processor (TO BE MODIFIED)

**Workflow Name:** Enrichment Processor  
**Purpose:** Fetch pending jobs, send to ~~GPT-4o~~ Program Mapping Engine, update with enriched data

| Attribute | Current Value | Future Value |
|-----------|--------------|--------------|
| **Trigger** | Schedule: Every 15 minutes | Schedule: Every 15 minutes |
| **Filter** | Status = `pending_enrichment` | Status = `pending_enrichment` |
| **Enrichment** | GPT-4o API Call 💰 | Program Mapping Engine (HTTP/Local) |

**Node Sequence (Current):**
```
[Schedule Trigger] → [Notion: Query] → [GPT-4o: Classify] → [Notion: Update] → [Log to Enrichment Runs]
```

**Node Sequence (Future with Engine):**
```
[Schedule Trigger] → [Notion: Query] → [HTTP: POST to Engine] → [Notion: Update] → [Log to Enrichment Runs]
```

**Properties Written:**
- Program Name
- Agency
- AI Confidence Score
- Priority Score
- Status (`enriched`)

### 6.3 Workflow 3: Priority Alert Notification

**Workflow Name:** Priority Alert  
**Purpose:** Send Hot/Warm/Cold alerts when Priority Score updates

| Attribute | Value |
|-----------|-------|
| **Trigger** | Property change on Priority Score |
| **Alert Thresholds** | 🔥 Hot: ≥80 \| 🟡 Warm: 50-79 \| ❄️ Cold: <50 |

**Node Sequence:**
```
[Notion Trigger: Property Change] → [Switch: Score Threshold] → [Slack/Email: Send Alert]
```

### n8n MCP Server

- **URL:** `https://primetech.app.n8n.cloud/mcp-server/http`
- **Instance:** primetech.app.n8n.cloud (v2.26.3)

---

## 7. APIFY ACTORS & SCRAPERS

### Overview

The PTS BD Intelligence System uses Apify for web scraping competitor job boards.

### Target Job Boards

| Competitor | Actor Status | Notes |
|------------|-------------|-------|
| GDIT | Active | Primary target |
| CACI | Active | Major competitor |
| Leidos | Active | Major competitor |
| Booz Allen | Active | Major competitor |
| Insight Global | Active | Staffing firm |
| TEKsystems | Active | Staffing firm |
| Peraton | Planned | Growing competitor |

### Output Schema (Jobs)

```json
{
  "jobTitle": "Network Administrator",
  "company": "GDIT",
  "location": "Fort Meade, MD",
  "jobDescription": "Full job posting text...",
  "sourceUrl": "https://gdit.com/careers/job/12345",
  "clearanceLevel": "TS/SCI",
  "postedDate": "2026-01-08",
  "apifyRunId": "abc123xyz"
}
```

### Webhook Integration

- **Webhook URL:** `https://primetech.app.n8n.cloud/webhook/job-import`
- **Method:** POST
- **Payload:** Array of job objects

---

## 8. PROBLEMS SOLVED

### Problem 1: GPT-4o Enrichment Cost
- **Problem Description:** GPT-4o costs ~$0.02-0.05 per job classification, totaling $11-27.50 for 550 jobs
- **Root Cause:** Using LLM for deterministic classification task
- **Solution Implemented:** Designed rule-based Program Mapping Engine with weighted scoring

### Problem 2: Non-Deterministic Classification
- **Problem Description:** Same job input can produce different program classifications on different runs
- **Root Cause:** LLM temperature and prompt sensitivity
- **Solution Implemented:** Deterministic cascade algorithm with explicit priority order

### Problem 3: Lack of Audit Trail
- **Problem Description:** Cannot explain why a job was classified to a specific program
- **Root Cause:** GPT-4o is a black box
- **Solution Implemented:** `matchReasons[]` array in output with type, evidence, and weight for each match

### Problem 4: Location Variations
- **Problem Description:** Same location written differently (Ft. Meade vs Fort Meade vs Fort Meade MD)
- **Root Cause:** Inconsistent data entry from job boards
- **Solution Implemented:** `locationAliases` mapping in locations.json with 30+ variations

### Problem 5: Program Expansion Difficulty
- **Problem Description:** Adding new programs requires GPT-4o prompt engineering
- **Root Cause:** Coupled classification logic and program data
- **Solution Implemented:** Externalized program data to JSON config, easy to add/modify

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate (This Week)

| Item | Status | Owner |
|------|--------|-------|
| Create GitHub repo with folder structure | ⏳ Pending | User |
| Upload config JSON files to repo | ⏳ Pending | User |
| Copy reference docs to `docs/` folder | ⏳ Pending | User |
| Create Auto Claude task with task spec | ⏳ Pending | User |
| Run Auto Claude to generate engine code | ⏳ Pending | Auto Claude |

### Short-Term (Next 2 Weeks)

| Item | Status | Notes |
|------|--------|-------|
| Review generated TypeScript code | ⏳ Pending | Validate algorithm logic |
| Run unit tests locally | ⏳ Pending | Target 80%+ coverage |
| Test against 50 sample jobs | ⏳ Pending | Compare vs. manual classification |
| Tune scoring weights based on results | ⏳ Pending | Adjust in scoring-weights.json |

### Medium-Term (Next Month)

| Item | Status | Notes |
|------|--------|-------|
| Integrate engine with n8n workflow | ⏳ Pending | Replace GPT-4o node |
| Process ~550 backlog GDIT Jobs | ⏳ Pending | Using new engine |
| Add remaining contractors (Leidos, Booz Allen) | ⏳ Pending | Expand programs.json |
| Deploy engine to Lambda/Cloud Run | ⏳ Pending | For production use |

### Future Considerations

- Add "learning mode" that flags low-confidence classifications for manual review
- Implement feedback loop to improve classification accuracy
- Expand to additional contractor job boards
- Add contract vehicle detection from job descriptions
- Integrate with SAM.gov for contract data enrichment

---

## 10. KEY INSIGHTS & GOTCHAS

### 🔴 Critical Warnings

1. **Schema-Locked Properties:** Never rename or delete these properties without updating n8n workflows:
   - `Status`, `Priority Score`, `AI Confidence Score`, `Source URL`, `Apify Run ID`
   - `Job Title`, `Company`, `Job Description`, `Clearance Level`, `Enrichment Timestamp`

2. **Status Values Must Be Exact:** The n8n workflow depends on exact status values:
   ```
   raw_import → pending_enrichment → enriching → enriched → validated → error
   ```

3. **Use Collection IDs, Not Database IDs:** For Notion MCP operations, Collection IDs are more stable:
   - Program Mapping Hub: `f57792c1-605b-424c-8830-23ab41c47137`
   - NOT the Database ID

4. **Fort Bragg Renamed to Fort Liberty:** All references should use "Fort Liberty NC" as the canonical name

### 🟡 Important Learnings

1. **Location Matching is Tricky:** Job boards use inconsistent location formats. The `locationAliases` map handles:
   - "Ft." vs "Fort"
   - State abbreviations present/absent
   - Base name only vs full address

2. **High-Priority Programs are GDIT Direct Contracts:**
   - INSCOM (I2TS4)
   - JUSTIFIED
   - MPCO
   - JSP ETM
   
   BICES and BICES-X are CACI prime with GDIT as subcontractor

3. **Clearance Scoring Has Significant Impact:**
   - TS/SCI w/ Poly = 35 points (35% of max score)
   - TS/SCI = 25 points
   - Secret = 5 points
   - This heavily influences Hot/Warm/Cold classification

4. **Remote/Hybrid Jobs Default to DEOS, CMS, WARHAWK, BAO:**
   - These programs commonly use remote workers
   - Low location signal means lower confidence

5. **Rate Limits for Notion MCP:**
   - General: 180 requests/minute (3/second)
   - Search-specific: 30 searches/minute
   - Batch in groups of 10 with delays for bulk operations

### 🟢 Best Practices

1. **Always Fetch Schema Before Updates:** Notion property names are case-sensitive

2. **Use Relations Instead of Text:** For cross-database links (Program Name → Federal Programs)

3. **Log to Enrichment Runs Log:** Track all batch processing for auditing

4. **Test Classification Locally First:** Before running against 550 jobs, validate with 10-20 samples

5. **Preserve Original Data:** Keep raw job description even after enrichment for re-processing

---

## Appendix A: File Locations

| File | Location | Purpose |
|------|----------|---------|
| Task Specification | `PTS_AutoClaude_ProgramMappingEngine_Task.md` | Auto Claude task description |
| Programs Config | `config/programs.json` | 25 GDIT programs |
| Locations Config | `config/locations.json` | Location mapping + aliases |
| Scoring Weights | `config/scoring-weights.json` | BD algorithm weights |
| Reference Guide | `docs/PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx` | Source document |
| Architecture Blueprint | `docs/PTS_BD_Intelligence_Architecture_Blueprint_v3_3_FINAL.docx` | Full system design |

---

## Appendix B: Sample Classification Input/Output

### Input
```json
{
  "jobTitle": "Network Administrator - I2TS4",
  "company": "GDIT",
  "location": "Fort Meade, MD",
  "jobDescription": "Seeking a Network Administrator to support INSCOM IT infrastructure. Requires TS/SCI clearance. Will manage Cisco routers and Windows servers at Fort Meade.",
  "clearanceLevel": "TS/SCI"
}
```

### Expected Output
```json
{
  "programCode": "INSCOM",
  "programName": "INSCOM IT Support Services (I2TS4)",
  "confidenceScore": 0.95,
  "confidenceLevel": "High",
  "matchReasons": [
    {
      "type": "explicit_mention",
      "evidence": "I2TS4 in job title",
      "weight": 1.0
    },
    {
      "type": "keyword_match",
      "evidence": "INSCOM in description",
      "weight": 0.8
    },
    {
      "type": "location_match",
      "evidence": "Fort Meade, MD → INSCOM",
      "weight": 0.7
    }
  ],
  "alternativeMatches": [
    {
      "programCode": "DEOS",
      "confidenceScore": 0.3,
      "reason": "Fort Meade location also maps to DEOS"
    }
  ],
  "priorityScore": 85,
  "clearanceBoost": 25,
  "programRelevanceBoost": 20
}
```

---

*Document generated by Claude on January 10, 2026*  
*PTS BD Intelligence System | Prime Technical Services*
