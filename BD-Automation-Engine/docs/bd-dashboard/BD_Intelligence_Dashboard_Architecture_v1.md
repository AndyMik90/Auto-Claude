# BD Intelligence Dashboard Architecture & Implementation Plan

**Version:** 1.0  
**Date:** January 13, 2026  
**Author:** Claude AI for DirtyDiablo (PTS Portfolio Manager)  
**Purpose:** Complete architecture specification for Auto Claude implementation

---

## EXECUTIVE SUMMARY

### The Vision
Build a unified **BD Intelligence Dashboard** that consolidates all automation engines into an actionable, executive-ready interface. The dashboard transforms raw data from job scrapes, program mapping, contact databases, and HUMINT into daily actionable call lists with personalized BD Formula messaging.

### The Problem Being Solved
Currently, BD intelligence is scattered across:
- Multiple Notion databases (6+ primary databases)
- N8n workflow outputs
- Apify scraper results
- Manual Excel call sheets
- Weekly HUMINT reports

### The Solution
A single web-based dashboard with **8 interconnected tabs** that present the fully enriched, BD-ready output of all automation engines:

| Tab | Purpose | Primary Output |
|-----|---------|----------------|
| **Jobs** | Active opportunities with full BD context | Job → Program → Contacts → Outreach ready |
| **Programs** | Program intelligence hub | Contract details, pain points, PTS alignment |
| **Primes/Clients** | Company relationship intelligence | GDIT, BAE, Leidos portfolios |
| **Locations** | Geographic opportunity mapping | Site-specific BD strategy |
| **Customers** | Agency/command intelligence | DoD, IC customer profiles |
| **Contacts** | BD-ready contact database | Prioritized outreach list |
| **Contractors** | PTS bench & placement tracking | Available talent alignment |
| **Daily Playbook** | Today's action list | Calls, emails, meetings |

### Success Metrics
- **Time Savings:** Reduce manual analysis from 4+ hours/day to 15 minutes
- **Quality:** 100% of outreach includes program-specific personalization
- **Coverage:** No job opportunity goes untracked
- **Velocity:** Daily automated call sheet generation

---

## PART 1: SYSTEM ARCHITECTURE OVERVIEW

### 1.1 High-Level Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         BD INTELLIGENCE ENGINE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐ │
│  │   Apify     │    │   ZoomInfo  │    │   GDIT      │    │   Manual    │ │
│  │  Scrapers   │    │   Exports   │    │  Bullhorn   │    │   HUMINT    │ │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘    └──────┬──────┘ │
│         │                  │                  │                  │        │
│         ▼                  ▼                  ▼                  ▼        │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    N8N AUTOMATION LAYER                             │  │
│  │  • Job Import Webhook                                               │  │
│  │  • Contact Import Pipeline                                          │  │
│  │  • LLM Enrichment Queue (GPT-4o)                                    │  │
│  │  • Deduplication Engine                                             │  │
│  └────────────────────────────┬────────────────────────────────────────┘  │
│                               │                                           │
│                               ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                 PROGRAM MAPPING ENGINE                              │  │
│  │  • Location → Program Matching                                      │  │
│  │  • Multi-Signal Scoring Algorithm                                   │  │
│  │  • BD Priority Calculation (0-100)                                  │  │
│  │  • Clearance Alignment Check                                        │  │
│  └────────────────────────────┬────────────────────────────────────────┘  │
│                               │                                           │
│                               ▼                                           │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                 NOTION DATABASE LAYER                               │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │  │
│  │  │  DCGS    │  │  GDIT    │  │ Federal  │  │ Program  │            │  │
│  │  │ Contacts │  │  Jobs    │  │ Programs │  │   Hub    │            │  │
│  │  │   965    │  │   700    │  │   388    │  │  Scrapes │            │  │
│  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘            │  │
│  │       │             │             │             │                   │  │
│  │       └─────────────┴─────────────┴─────────────┘                   │  │
│  │                          │                                          │  │
│  └──────────────────────────┼──────────────────────────────────────────┘  │
│                             │                                             │
│                             ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │              BD INTELLIGENCE DASHBOARD                              │  │
│  │                                                                     │  │
│  │   ┌─────┐ ┌─────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐        │  │
│  │   │Jobs │ │Programs │ │Primes  │ │Locations │ │Customers  │        │  │
│  │   └─────┘ └─────────┘ └────────┘ └──────────┘ └───────────┘        │  │
│  │                                                                     │  │
│  │   ┌─────────┐ ┌─────────────┐ ┌────────────────┐                   │  │
│  │   │Contacts │ │Contractors  │ │Daily Playbook  │                   │  │
│  │   └─────────┘ └─────────────┘ └────────────────┘                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DASHBOARD APPLICATION STACK                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  FRONTEND LAYER (React + Tailwind)                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • Tab Navigation Component                                         │   │
│  │  • Data Grid Component (sortable, filterable)                       │   │
│  │  • Priority Color System (🔴🟠🟡⚪)                                   │   │
│  │  • Contact Card Component                                           │   │
│  │  • Job Intelligence Card                                            │   │
│  │  • Program Overview Panel                                           │   │
│  │  • Export Controls (Excel, PDF, Call Sheet)                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  DATA LAYER (JSON + localStorage/API)                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • jobs_fully_enriched.json           (from Program Mapping Engine) │   │
│  │  • contacts_classified.json           (from Contact Classification) │   │
│  │  • programs_complete.json             (from Federal Programs DB)    │   │
│  │  • primes_relationships.json          (from Prime/Sub mapping)      │   │
│  │  • locations_hub_data.json            (aggregated by site)          │   │
│  │  • customers_agencies.json            (DoD/IC customer profiles)    │   │
│  │  • contractors_bench.json             (PTS talent pool)             │   │
│  │  • daily_playbook.json                (generated daily)             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  INTELLIGENCE LAYER (Computed Views)                                       │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  • BD Formula Generator (per contact/job)                           │   │
│  │  • Pain Point Aggregator (by program/site)                          │   │
│  │  • Labor Gap Analyzer (jobs vs. contacts)                           │   │
│  │  • PTS Past Performance Matcher                                     │   │
│  │  • Outreach Prioritizer (daily call list)                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Data Relationship Model

```
                           ┌──────────────┐
                           │     JOB      │
                           │ (Opportunity)│
                           └──────┬───────┘
                                  │
           ┌──────────────────────┼──────────────────────┐
           │                      │                      │
           ▼                      ▼                      ▼
    ┌──────────────┐      ┌──────────────┐      ┌──────────────┐
    │   PROGRAM    │      │   LOCATION   │      │  CLEARANCE   │
    │ (Task Order) │      │    (Site)    │      │   (Level)    │
    └──────┬───────┘      └──────┬───────┘      └──────────────┘
           │                     │
           │        ┌────────────┴────────────┐
           │        │                         │
           ▼        ▼                         ▼
    ┌──────────────┐                 ┌──────────────┐
    │    PRIME     │                 │   CUSTOMER   │
    │ (Contractor) │                 │   (Agency)   │
    └──────┬───────┘                 └──────────────┘
           │
           ▼
    ┌──────────────┐      ┌──────────────┐
    │   CONTACTS   │◄────►│  PTS PAST    │
    │ (People)     │      │ PERFORMANCE  │
    └──────┬───────┘      └──────────────┘
           │
           ▼
    ┌──────────────┐
    │  CONTRACTORS │
    │ (PTS Bench)  │
    └──────────────┘
```

---

## PART 2: TAB SPECIFICATIONS

### TAB 1: JOBS (Primary Intelligence View)

#### Purpose
Display all active job opportunities with complete BD context - this is the "action view" showing what jobs exist and everything needed to pursue them.

#### Data Model (Per Job Record)

```json
{
  "job_id": "IG-2026-001",
  "source": "Insight Global",
  "scraped_date": "2026-01-13",
  
  "// --- Core Job Information ---": "",
  "job_title": "Network Engineer",
  "location": "San Diego, CA",
  "clearance": "TS/SCI",
  "pay_rate": "$85-95/hour",
  "duration": "12+ months",
  "employment_type": "Contract",
  "description_snippet": "Support DCGS operations...",
  "job_url": "https://insightglobal.com/jobs/...",
  
  "// --- Program Intelligence ---": "",
  "matched_program": "AF DCGS - PACAF",
  "task_order": "PACAF Node Operations",
  "customer_agency": "U.S. Air Force (480th ISR Wing)",
  "prime_contractor": "BAE Systems",
  "sub_contractor": "GDIT",
  "contract_value": "$500M",
  "contract_vehicle": "AFLCMC SOF GLSS",
  
  "// --- BD Scoring ---": "",
  "bd_priority": "🔴 Critical",
  "bd_score": 92,
  "match_confidence": 0.95,
  "dcgs_relevance": "direct",
  "score_breakdown": {
    "clearance_boost": 25,
    "location_boost": 10,
    "dcgs_keyword_boost": 20,
    "confidence_boost": 19
  },
  
  "// --- Contact Intelligence ---": "",
  "site_lead": "Kingsley Ero (Acting)",
  "hiring_manager": "TBD",
  "team_lead": "Tara Stephenson",
  "program_manager": "David Winkelman (VP)",
  "team_contacts": ["Raquel Adame", "Tomasito Alcantar"],
  
  "// --- PTS Alignment ---": "",
  "pts_past_performance": ["BICES", "GSM-O II", "NATO BICES"],
  "pts_similar_placements": [
    {"role": "Network Engineer", "program": "BICES-X", "location": "Norfolk"}
  ],
  "pts_available_contractors": 3,
  
  "// --- Pain Points (from HUMINT) ---": "",
  "program_pain_points": [
    "Acting site lead stretched thin, no backup",
    "Single points of failure on network team"
  ],
  
  "// --- BD Formula Output ---": "",
  "personalized_message": "Given your work supporting the PACAF node in San Diego, I understand the challenges of running lean with critical mission requirements...",
  "recommended_contacts": [
    {"name": "Kingsley Ero", "tier": 3, "priority": "🔴"},
    {"name": "Tara Stephenson", "tier": 5, "priority": "🟠"}
  ]
}
```

#### UI Layout Specification

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  📊 JOBS INTELLIGENCE                                    [Export] [Filter]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔍 Search: [____________] Program: [All ▼] Location: [All ▼] Priority: [▼] │
│                                                                             │
│  Found: 127 active jobs | 🔴 23 Critical | 🟠 45 High | 🟡 42 Medium        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─── 🔴 CRITICAL (23 jobs) ───────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  ┌──────────────────────────────────────────────────────────────┐   │   │
│  │  │ Network Engineer                                   Score: 92 │   │   │
│  │  │ 📍 San Diego, CA  │  🔐 TS/SCI  │  💰 $85-95/hr              │   │   │
│  │  ├──────────────────────────────────────────────────────────────┤   │   │
│  │  │ PROGRAM: AF DCGS - PACAF                                     │   │   │
│  │  │ Task Order: PACAF Node Operations                            │   │   │
│  │  │ Customer: 480th ISR Wing  │  Prime: BAE (GDIT Sub)           │   │   │
│  │  ├──────────────────────────────────────────────────────────────┤   │   │
│  │  │ 👤 CONTACTS:                                                  │   │   │
│  │  │ • Kingsley Ero (Acting Site Lead) - 🔴 Call Today            │   │   │
│  │  │ • Tara Stephenson (Network Analyst) - 🟠 This Week           │   │   │
│  │  ├──────────────────────────────────────────────────────────────┤   │   │
│  │  │ 🎯 PTS ALIGNMENT:                                             │   │   │
│  │  │ • Past Perf: BICES, GSM-O II (Network Eng @ Norfolk)         │   │   │
│  │  │ • Available Contractors: 3 matching                           │   │   │
│  │  ├──────────────────────────────────────────────────────────────┤   │   │
│  │  │ ⚠️ PAIN POINTS:                                               │   │   │
│  │  │ • Acting site lead stretched thin                             │   │   │
│  │  │ • Single points of failure on network team                    │   │   │
│  │  ├──────────────────────────────────────────────────────────────┤   │   │
│  │  │ 💬 BD MESSAGE:                                                │   │   │
│  │  │ "Given your work supporting the PACAF node in San Diego..."  │   │   │
│  │  │                                         [Copy] [View Full]    │   │   │
│  │  └──────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Column Specifications (Grid View)

| Column | Width | Sort | Filter | Notes |
|--------|-------|------|--------|-------|
| Priority | 60px | ✅ | ✅ (🔴🟠🟡⚪) | Color-coded emoji |
| BD Score | 60px | ✅ | ✅ (Range) | 0-100 numeric |
| Job Title | 200px | ✅ | ✅ (Text) | Bold, link to source |
| Location | 120px | ✅ | ✅ (Select) | City, State |
| Clearance | 80px | ✅ | ✅ (Select) | TS/SCI, TS, Secret |
| Program | 150px | ✅ | ✅ (Select) | Matched program name |
| Task Order | 150px | ✅ | ✅ | Task order name |
| Customer | 120px | ✅ | ✅ (Select) | Agency/Command |
| Prime | 100px | ✅ | ✅ (Select) | Prime contractor |
| Site Lead | 120px | ✅ | ❌ | Contact name |
| Hiring Mgr | 120px | ✅ | ❌ | Contact name |
| PTS Match | 80px | ✅ | ❌ | # of similar placements |
| Available | 60px | ✅ | ❌ | # contractors available |
| Scraped | 80px | ✅ | ✅ (Date) | Date scraped |
| Actions | 100px | ❌ | ❌ | [View] [Export] buttons |

---

### TAB 2: PROGRAMS

#### Purpose
Program-centric view of DCGS portfolio with complete contract intelligence, pain points, and PTS positioning.

#### Data Model (Per Program)

```json
{
  "program_id": "af-dcgs-pacaf",
  "program_name": "AF DCGS - PACAF",
  "acronym": "PACAF",
  "full_name": "Pacific Air Forces Distributed Common Ground System",
  
  "// --- Contract Intelligence ---": "",
  "contract_value": "$500M (total AF DCGS)",
  "contract_vehicle": "AFLCMC SOF GLSS",
  "contract_type": "IDIQ",
  "pop_start": "2022-01-01",
  "pop_end": "2027-12-31",
  "current_option_year": 2,
  "next_review_date": "2026-11-01",
  
  "// --- Prime/Sub Structure ---": "",
  "prime_contractor": "BAE Systems",
  "sub_contractors": ["GDIT", "Leidos", "Booz Allen"],
  "gdit_role": "Subcontractor - Network/Systems Support",
  "pts_involvement": "Target",
  
  "// --- Locations & Sites ---": "",
  "key_locations": ["San Diego, CA"],
  "sites": [
    {
      "site_name": "PACAF San Diego Node",
      "address": "San Diego, CA",
      "mission": "Pacific theater ISR processing",
      "headcount_estimate": 25
    }
  ],
  
  "// --- Customer Information ---": "",
  "customer_agency": "U.S. Air Force",
  "customer_command": "Pacific Air Forces",
  "customer_unit": "480th ISR Wing (PACAF Element)",
  "mission_area": "ISR Processing, Pacific Theater Operations",
  
  "// --- Pain Points (HUMINT) ---": "",
  "pain_points": [
    {
      "pain_point": "Acting site lead stretched thin, no backup",
      "source": "Tier 5 contact - Dec 2024",
      "confidence": "High",
      "implications": "Opportunity to place PM-level support"
    },
    {
      "pain_point": "Single points of failure on network team",
      "source": "Tier 6 contact - Nov 2024",
      "confidence": "Medium",
      "implications": "Network engineer cross-training gap"
    }
  ],
  
  "// --- Labor Intelligence ---": "",
  "active_job_count": 8,
  "job_titles": ["Network Engineer", "Systems Administrator", "ISR Analyst"],
  "hiring_velocity": "High",
  "turnover_signals": "Medium",
  
  "// --- PTS Positioning ---": "",
  "pts_past_performance_alignment": {
    "direct_gdit": ["BICES", "GSM-O II", "NATO BICES"],
    "similar_mission": ["SOCOM JICCENT", "DIA I2OS"],
    "similar_customer": ["Platform One (USAF)"],
    "clearance_match": "TS/SCI - Full alignment"
  },
  "pts_differentiator": "Only SDVOSB with direct GDIT DCGS experience",
  
  "// --- Key Contacts ---": "",
  "contacts": {
    "site_lead": "Kingsley Ero (Acting)",
    "deputy": "TBD",
    "network_lead": "Tara Stephenson",
    "pm_oversight": "David Winkelman (VP)"
  },
  
  "// --- BD Strategy ---": "",
  "bd_priority": "🔴 Critical",
  "approach": "Bottom-up HUMINT gathering → Site Lead engagement",
  "next_actions": [
    "Call Tara Stephenson (network intel)",
    "Prepare capability brief for Kingsley"
  ]
}
```

#### UI Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🏛️ PROGRAMS                                            [Export] [Filter]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [AF DCGS (3)] [Army DCGS-A (1)] [Navy DCGS-N (1)] [Corporate] [All]       │
│                                                                             │
│  Total Value: $950M | Active Jobs: 127 | Key Contacts: 234                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔴 AF DCGS - PACAF                                        $500M    │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │ ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐      │   │
│  │ │ CONTRACT        │  │ STRUCTURE       │  │ ACTIVITY        │      │   │
│  │ ├─────────────────┤  ├─────────────────┤  ├─────────────────┤      │   │
│  │ │ Value: $500M    │  │ Prime: BAE      │  │ Jobs: 8 active  │      │   │
│  │ │ Vehicle: IDIQ   │  │ Sub: GDIT       │  │ Hiring: High    │      │   │
│  │ │ Option Yr: 2    │  │ PTS: Target     │  │ Turnover: Med   │      │   │
│  │ │ Review: Nov '26 │  │                 │  │                 │      │   │
│  │ └─────────────────┘  └─────────────────┘  └─────────────────┘      │   │
│  │                                                                     │   │
│  │ ⚠️ PAIN POINTS                                                      │   │
│  │ • Acting site lead stretched thin, no backup (High confidence)     │   │
│  │ • Single points of failure on network team (Medium confidence)     │   │
│  │                                                                     │   │
│  │ 👤 KEY CONTACTS                                                     │   │
│  │ • Kingsley Ero (Acting Site Lead) - 🔴 Critical                    │   │
│  │ • Tara Stephenson (Network) - 🟠 High                              │   │
│  │ • David Winkelman (VP) - 🔴 Critical (Exec)                        │   │
│  │                                                                     │   │
│  │ 🎯 PTS ALIGNMENT                                                    │   │
│  │ Direct GDIT: BICES, GSM-O II | Similar: SOCOM JICCENT              │   │
│  │                                                                     │   │
│  │ 📋 NEXT ACTIONS                                                     │   │
│  │ ☐ Call Tara Stephenson (network intel)                             │   │
│  │ ☐ Prepare capability brief for Kingsley                            │   │
│  │                                                       [View Full]   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### TAB 3: PRIMES/CLIENTS

#### Purpose
Contractor relationship intelligence - track GDIT, BAE, and other primes across the portfolio.

#### Data Model (Per Company)

```json
{
  "company_id": "gdit",
  "company_name": "General Dynamics IT",
  "short_name": "GDIT",
  "relationship_status": "Active Partner",
  
  "// --- Portfolio Overview ---": "",
  "total_dcgs_value": "$950M",
  "programs_as_prime": ["Army DCGS-A", "Navy DCGS-N"],
  "programs_as_sub": ["AF DCGS (to BAE)"],
  "total_jobs_tracked": 700,
  
  "// --- Relationship History ---": "",
  "pts_relationship_start": "2018",
  "programs_supported": ["BICES", "BICES-X", "GSM-O II", "NATO BICES"],
  "placements_made": 47,
  "active_placements": 12,
  
  "// --- Key Contacts ---": "",
  "executive_contacts": [
    {"name": "David Winkelman", "title": "VP, Defense Intel", "tier": 1}
  ],
  "pm_contacts": [
    {"name": "Craig Lindahl", "title": "Sr. PM", "program": "AF DCGS"}
  ],
  "staffing_contacts": [
    {"name": "Christine Carpenter", "title": "Network Ops Mgr"}
  ],
  
  "// --- Hiring Activity ---": "",
  "active_requisitions": 127,
  "avg_time_to_fill": "45 days",
  "high_demand_roles": ["Network Engineer", "ISR Analyst", "Systems Admin"],
  "clearance_distribution": {
    "TS/SCI w/ Poly": "15%",
    "TS/SCI": "45%",
    "TS": "20%",
    "Secret": "20%"
  }
}
```

---

### TAB 4: LOCATIONS

#### Purpose
Geographic opportunity mapping - see all BD intelligence grouped by site/location.

#### Data Model (Per Location)

```json
{
  "location_id": "san-diego",
  "city": "San Diego",
  "state": "CA",
  "region": "West Coast",
  "location_hub": "San Diego Metro",
  
  "// --- Programs at Location ---": "",
  "programs": ["AF DCGS - PACAF", "Navy DCGS-N (partial)"],
  "primary_program": "AF DCGS - PACAF",
  "mission_type": "ISR Processing",
  
  "// --- Site Details ---": "",
  "site_name": "PACAF San Diego Node",
  "base_installation": "N/A (Contractor facility)",
  "customer_command": "Pacific Air Forces",
  
  "// --- Workforce Intelligence ---": "",
  "estimated_headcount": 25,
  "active_jobs": 8,
  "job_titles": ["Network Engineer", "Systems Admin", "ISR Analyst"],
  "clearance_requirement": "TS/SCI",
  
  "// --- Contact Coverage ---": "",
  "total_contacts": 15,
  "contacts_by_tier": {
    "Tier 3": 1,
    "Tier 4": 2,
    "Tier 5": 5,
    "Tier 6": 7
  },
  "coverage_gaps": ["No Tier 1-2 contacts"],
  
  "// --- BD Status ---": "",
  "bd_priority": "🔴 Critical",
  "active_campaign": true,
  "last_contact_date": "2025-12-15",
  "next_scheduled": "2026-01-14"
}
```

---

### TAB 5: CUSTOMERS/AGENCIES

#### Purpose
Agency/command intelligence - understand the government customer for each program.

#### Data Model (Per Customer)

```json
{
  "customer_id": "usaf-pacaf",
  "agency": "U.S. Air Force",
  "command": "Pacific Air Forces",
  "unit": "480th ISR Wing",
  
  "// --- Mission Profile ---": "",
  "mission_area": "ISR Processing",
  "operational_focus": "Pacific Theater Operations",
  "classification": "TS/SCI environment",
  
  "// --- Programs Supported ---": "",
  "programs": ["AF DCGS - PACAF", "AF DCGS - Langley (480th HQ)"],
  "total_contract_value": "$500M",
  
  "// --- Acquisition Profile ---": "",
  "contracting_office": "AFLCMC",
  "acquisition_method": "IDIQ Task Orders",
  "small_business_goals": "12% SDVOSB target",
  
  "// --- PTS Positioning ---": "",
  "pts_existing_work": false,
  "pts_target_programs": ["AF DCGS - PACAF"],
  "past_performance_relevance": ["Platform One (USAF DevSecOps)"]
}
```

---

### TAB 6: CONTACTS

#### Purpose
BD-ready contact database with full classification, prioritization, and outreach messaging.

#### Data Model (Per Contact)

```json
{
  "contact_id": "kingsley-ero",
  "full_name": "Kingsley Ero",
  "first_name": "Kingsley",
  "last_name": "Ero",
  
  "// --- Professional Profile ---": "",
  "job_title": "Acting Site Lead",
  "company": "GDIT",
  "email": "kingsley.ero@gdit.com",
  "phone": "(555) 123-4567",
  "linkedin": "https://linkedin.com/in/kingsleyero",
  
  "// --- Classification ---": "",
  "hierarchy_tier": "Tier 3 - Program Leadership",
  "bd_priority": "🔴 Critical",
  "program": "AF DCGS - PACAF",
  "location_hub": "San Diego Metro",
  "functional_area": "Program Management",
  
  "// --- Program Context ---": "",
  "site": "PACAF San Diego Node",
  "task_order": "PACAF Node Operations",
  "customer": "480th ISR Wing",
  "reports_to": "David Winkelman (VP)",
  "direct_reports": ["Tara Stephenson", "Network Team"],
  
  "// --- HUMINT Intelligence ---": "",
  "pain_points_mentioned": [
    "Wearing multiple hats as acting lead",
    "No backup for critical functions"
  ],
  "hiring_authority": "High - direct influence on staffing",
  "decision_maker": true,
  "budget_authority": "Medium - task order level",
  
  "// --- Outreach Status ---": "",
  "contacted": false,
  "last_contact_date": null,
  "contact_history": [],
  "preferred_channel": "Phone",
  "best_time": "Tuesday-Thursday, 10am-2pm PST",
  
  "// --- BD Formula Components ---": "",
  "personalized_opener": "Given your work leading the PACAF node in San Diego, and the challenges of running an acting site lead position...",
  "pain_point_reference": "I understand the PACAF team is dealing with single points of failure and limited redundancy...",
  "labor_gap_reference": "I noticed your team has open positions for Network Engineer and Systems Administrator...",
  "pts_past_perf_reference": "PTS has supported GDIT on BICES and GSM-O II since 2018, providing TS/SCI network engineers...",
  "program_alignment": "Our recent work on SOCOM JICCENT aligns closely with your ISR processing mission...",
  "role_alignment": "For site leadership support, we've placed program managers with similar cross-functional responsibilities...",
  
  "// --- Complete BD Message ---": "",
  "bd_message_email": "Subject: PACAF Node Staffing Support\n\nHi Kingsley,\n\n[Full personalized email following BD Formula]...",
  "bd_message_linkedin": "Hi Kingsley - I noticed your work leading the PACAF node in San Diego...",
  "bd_message_call_script": "Hi Kingsley, this is [Name] from Prime Technical Services..."
}
```

#### UI Layout (Contact Card)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ 👤 CONTACTS                                              [Export] [Filter]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Priority: [All ▼] Program: [All ▼] Tier: [All ▼] Location: [All ▼]        │
│                                                                             │
│  🔴 23 Critical | 🟠 45 High | 🟡 87 Medium | ⚪ 812 Standard                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ 🔴 CRITICAL - Call Today                                           │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                     │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  Kingsley Ero                                    Tier 3      │  │   │
│  │  │  Acting Site Lead @ GDIT                         🔴 Critical │  │   │
│  │  ├──────────────────────────────────────────────────────────────┤  │   │
│  │  │  📍 San Diego, CA (AF DCGS - PACAF)                          │  │   │
│  │  │  📧 kingsley.ero@gdit.com                                    │  │   │
│  │  │  📞 (555) 123-4567                                           │  │   │
│  │  │  🔗 [LinkedIn]                                               │  │   │
│  │  ├──────────────────────────────────────────────────────────────┤  │   │
│  │  │  ⚠️ KNOWN PAIN POINTS:                                        │  │   │
│  │  │  • Wearing multiple hats as acting lead                      │  │   │
│  │  │  • No backup for critical functions                          │  │   │
│  │  ├──────────────────────────────────────────────────────────────┤  │   │
│  │  │  💬 PERSONALIZED OPENER:                                      │  │   │
│  │  │  "Given your work leading the PACAF node in San Diego,       │  │   │
│  │  │   and the challenges of running as acting site lead..."      │  │   │
│  │  │                                                              │  │   │
│  │  │  [📞 Call Script] [📧 Email] [💼 LinkedIn] [📋 Copy All]      │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### TAB 7: CONTRACTORS (PTS Bench)

#### Purpose
Track PTS contractor bench and match available talent to open opportunities.

#### Data Model (Per Contractor)

```json
{
  "contractor_id": "aaron-himes",
  "full_name": "Aaron Himes",
  
  "// --- Clearance & Availability ---": "",
  "clearance": "TS/SCI w/ CI Poly",
  "clearance_status": "Active",
  "availability": "Immediately Available",
  "current_status": "On Bench",
  
  "// --- Skills Profile ---": "",
  "primary_role": "Network Engineer",
  "skills": ["Cisco", "JRSS", "DISA Networks", "AWS GovCloud"],
  "certifications": ["CCNA", "Security+", "AWS Solutions Architect"],
  "years_experience": 12,
  
  "// --- Past Placements ---": "",
  "past_placements": [
    {
      "program": "BICES-X",
      "role": "Senior Network Engineer",
      "location": "Norfolk, VA",
      "duration": "2 years",
      "prime": "GDIT"
    }
  ],
  
  "// --- Job Matches ---": "",
  "matching_jobs": [
    {
      "job_id": "IG-2026-001",
      "title": "Network Engineer",
      "program": "AF DCGS - PACAF",
      "location": "San Diego, CA",
      "match_score": 95
    }
  ],
  
  "// --- Presentation Status ---": "",
  "presented_to": [],
  "interview_scheduled": false,
  "placement_probability": "High"
}
```

---

### TAB 8: DAILY PLAYBOOK

#### Purpose
The primary action view - today's calls, emails, and meetings with complete BD Formula messaging ready to use.

#### Data Model (Daily Generation)

```json
{
  "playbook_date": "2026-01-13",
  "generated_at": "2026-01-13T06:00:00Z",
  
  "// --- Summary Metrics ---": "",
  "total_actions": 15,
  "calls_scheduled": 8,
  "emails_to_send": 5,
  "meetings_today": 2,
  
  "// --- Priority Actions ---": "",
  "critical_actions": [
    {
      "action_type": "call",
      "contact": "Kingsley Ero",
      "title": "Acting Site Lead",
      "program": "AF DCGS - PACAF",
      "phone": "(555) 123-4567",
      "reason": "🔴 Critical - PACAF Site Lead, active hiring",
      "call_script": "Hi Kingsley, this is [Name] from Prime Technical Services. I'm calling about your PACAF node work in San Diego...",
      "pain_points": ["Acting lead stretched thin", "Single points of failure"],
      "jobs_to_reference": ["Network Engineer (2)", "Systems Admin (1)"],
      "pts_alignment": "BICES network engineers, GSM-O II ops support",
      "goal": "Schedule 30-min capability brief",
      "notes": ""
    }
  ],
  
  "// --- Call Sequence (Ordered) ---": "",
  "call_sequence": [
    {"order": 1, "contact": "Kingsley Ero", "tier": 3, "priority": "🔴"},
    {"order": 2, "contact": "Tara Stephenson", "tier": 5, "priority": "🟠"},
    {"order": 3, "contact": "Craig Lindahl", "tier": 3, "priority": "🟠"}
  ],
  
  "// --- Email Queue ---": "",
  "email_queue": [
    {
      "contact": "David Winkelman",
      "tier": 1,
      "subject": "Strategic Staffing Partnership - DCGS Portfolio",
      "email_body": "[Full email following BD Formula]"
    }
  ],
  
  "// --- Today's Meetings ---": "",
  "meetings": [
    {
      "time": "14:00",
      "contact": "Christine Carpenter",
      "type": "Call",
      "agenda": "Network ops staffing discussion",
      "prep_notes": "Review BICES case study, bring 3 candidate profiles"
    }
  ],
  
  "// --- Follow-Up Tracking ---": "",
  "awaiting_response": [
    {"contact": "Robert Nicholson", "sent_date": "2026-01-10", "type": "email"}
  ]
}
```

#### UI Layout (Daily Playbook)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  🎯 DAILY PLAYBOOK - Monday, January 13, 2026           [Refresh] [Export]  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TODAY'S METRICS                                                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐                    │
│  │ 📞 CALLS │  │ 📧 EMAILS │  │ 📅 MTGS  │  │ ⏳ F/UP  │                    │
│  │    8     │  │    5     │  │    2     │  │    4     │                    │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘                    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  🔴 CRITICAL CALLS (Do First)                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ☐ #1  Kingsley Ero - Acting Site Lead                              │   │
│  │        📍 AF DCGS - PACAF (San Diego)                               │   │
│  │        📞 (555) 123-4567                                            │   │
│  │        ─────────────────────────────────────────────────────────    │   │
│  │        💬 SCRIPT:                                                    │   │
│  │        "Hi Kingsley, this is [Name] from Prime Technical Services.  │   │
│  │         I'm calling about your PACAF node work in San Diego.        │   │
│  │         I understand your team is dealing with single points of     │   │
│  │         failure and limited backup coverage..."                     │   │
│  │                                                                      │   │
│  │        🎯 GOAL: Schedule 30-min capability brief                    │   │
│  │        📋 JOBS: Network Engineer (2), Systems Admin (1)             │   │
│  │        🏆 PTS: BICES network engineers, GSM-O II ops                │   │
│  │                                                                      │   │
│  │        [✓ Completed] [→ Voicemail] [📅 Reschedule] [📝 Notes]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ☐ #2  Tara Stephenson - Network Analyst                           │   │
│  │        📍 AF DCGS - PACAF (San Diego)                               │   │
│  │        📞 (555) 987-6543                                            │   │
│  │        ─────────────────────────────────────────────────────────    │   │
│  │        💬 SCRIPT:                                                    │   │
│  │        "Hi Tara, this is [Name] from PTS. I noticed you're the     │   │
│  │         sole network/security person at the PACAF node..."         │   │
│  │                                                                      │   │
│  │        🎯 GOAL: Gather HUMINT on team dynamics, pain points        │   │
│  │                                                                      │   │
│  │        [✓ Completed] [→ Voicemail] [📅 Reschedule] [📝 Notes]       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  📧 EMAIL QUEUE                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  ☐ David Winkelman (VP) - Strategic Partnership Intro               │   │
│  │  ☐ Craig Lindahl (Sr. PM) - Wright-Patt Radar Engineer Need         │   │
│  │  ☐ Dusty Galbraith (PM) - Navy DCGS-N Norfolk Support               │   │
│  │                                                    [Send All] [Queue] │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## PART 3: DATA FLOW & INTEGRATION ARCHITECTURE

### 3.1 End-to-End Data Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      COMPLETE DATA PIPELINE                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STAGE 1: DATA INGESTION                                                   │
│  ═══════════════════════                                                   │
│                                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                     │
│  │   Apify     │    │  ZoomInfo   │    │   GDIT      │                     │
│  │  Scrapers   │    │  Exports    │    │  Bullhorn   │                     │
│  │             │    │             │    │             │                     │
│  │ • Apex Sys  │    │ • CSV       │    │ • API/CSV   │                     │
│  │ • Insight   │    │ • 19 cols   │    │ • 700 jobs  │                     │
│  │ • TEK       │    │ • Contacts  │    │             │                     │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                     │
│         │                  │                  │                            │
│         ▼                  ▼                  ▼                            │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                     N8N WEBHOOK LAYER                               │  │
│  │                                                                     │  │
│  │  Apify Webhook ─────► Job Import Workflow                           │  │
│  │                       • Validate JSON structure                     │  │
│  │                       • Map to Notion schema                        │  │
│  │                       • Set status: raw_import                      │  │
│  │                                                                     │  │
│  │  Manual Upload ─────► Contact Import Workflow                       │  │
│  │                       • Dedupe against existing                     │  │
│  │                       • Classify by title                           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                               │                                           │
│                               ▼                                           │
│  STAGE 2: ENRICHMENT                                                      │
│  ═══════════════════                                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    LLM ENRICHMENT LAYER                             │  │
│  │                                                                     │  │
│  │  Job Standardization (GPT-4o):                                     │  │
│  │  ├─ Input: Raw job JSON                                            │  │
│  │  ├─ Process: 11-field extraction                                   │  │
│  │  └─ Output: Standardized job record                                │  │
│  │                                                                     │  │
│  │  Program Mapping (Rules + GPT-4o):                                 │  │
│  │  ├─ Input: Standardized job                                        │  │
│  │  ├─ Process: Multi-signal scoring                                  │  │
│  │  └─ Output: Matched program, confidence, BD score                  │  │
│  │                                                                     │  │
│  │  Contact Classification (Rules):                                   │  │
│  │  ├─ Input: Contact record                                          │  │
│  │  ├─ Process: Title → Tier, Location → Program                      │  │
│  │  └─ Output: Hierarchy tier, BD priority, program                   │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                               │                                           │
│                               ▼                                           │
│  STAGE 3: CORRELATION                                                     │
│  ════════════════════                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    DATA CORRELATION ENGINE                          │  │
│  │                                                                     │  │
│  │  Job ←→ Program:                                                    │  │
│  │  • Match by location (deterministic)                               │  │
│  │  • Match by keywords (probabilistic)                               │  │
│  │  • Match by clearance (validation)                                 │  │
│  │                                                                     │  │
│  │  Job ←→ Contacts:                                                   │  │
│  │  • Find contacts at matched program/site                           │  │
│  │  • Identify hiring manager (if known)                              │  │
│  │  • Link team contacts                                              │  │
│  │                                                                     │  │
│  │  Job ←→ PTS Past Performance:                                       │  │
│  │  • Match by program similarity                                     │  │
│  │  • Match by role type                                              │  │
│  │  • Match by clearance                                              │  │
│  │                                                                     │  │
│  │  Job ←→ Contractors:                                                │  │
│  │  • Match by skills                                                 │  │
│  │  • Match by clearance                                              │  │
│  │  • Match by location preference                                    │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                               │                                           │
│                               ▼                                           │
│  STAGE 4: OUTPUT GENERATION                                               │
│  ══════════════════════════                                               │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    BD FORMULA GENERATOR                             │  │
│  │                                                                     │  │
│  │  For each contact:                                                  │  │
│  │  1. Personalized opener (from program context)                     │  │
│  │  2. Pain point reference (from HUMINT database)                    │  │
│  │  3. Labor gap reference (from active jobs)                         │  │
│  │  4. PTS-GDIT past performance (from history)                       │  │
│  │  5. Program alignment (from similar missions)                      │  │
│  │  6. Role alignment (from job title matching)                       │  │
│  │                                                                     │  │
│  │  Output: Complete outreach message (email, LinkedIn, call script)  │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                               │                                           │
│                               ▼                                           │
│  STAGE 5: DASHBOARD OUTPUT                                                │
│  ═════════════════════════                                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐  │
│  │                    BD INTELLIGENCE DASHBOARD                        │  │
│  │                                                                     │  │
│  │  JSON Exports (Daily 6am):                                         │  │
│  │  ├─ jobs_intelligence.json       (all enriched jobs)               │  │
│  │  ├─ contacts_actionable.json     (prioritized contact list)        │  │
│  │  ├─ programs_complete.json       (program intelligence)            │  │
│  │  ├─ daily_playbook.json          (today's actions)                 │  │
│  │  └─ contractors_matches.json     (talent matching)                 │  │
│  │                                                                     │  │
│  │  Excel Exports (On-Demand):                                        │  │
│  │  ├─ DCGS_BD_Call_Sheet.xlsx      (priority call list)              │  │
│  │  ├─ Program_Intelligence.xlsx    (program details)                 │  │
│  │  └─ Contact_Export.xlsx          (full contact database)           │  │
│  └─────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Integration Points

| System | Integration Type | Data Flow | Frequency |
|--------|-----------------|-----------|-----------|
| **Apify** | Webhook → N8n | Job scrapes → Hub | On completion |
| **N8n** | Webhook + Schedule | Processing pipeline | 15 min + triggers |
| **Notion** | MCP Connector | CRUD operations | Real-time |
| **GPT-4o** | API | LLM enrichment | Per-record |
| **Dashboard** | JSON/REST | Data retrieval | On-demand |
| **Excel** | File export | Call sheets, reports | On-demand |

---

## PART 4: UI/UX SPECIFICATIONS

### 4.1 Design System

#### Color Palette (PTS Brand)

```css
/* Primary - Navy Blue */
--pts-navy: #1e3a5f;
--pts-navy-light: #2c5282;
--pts-navy-dark: #1a365d;

/* Priority Colors - BD System */
--priority-critical: #e53e3e;    /* 🔴 Red */
--priority-high: #dd6b20;        /* 🟠 Orange */
--priority-medium: #d69e2e;      /* 🟡 Yellow */
--priority-standard: #718096;    /* ⚪ Gray */

/* Program Colors */
--program-af: #3182ce;           /* Air Force - Blue */
--program-army: #2f855a;         /* Army - Green */
--program-navy: #2c5282;         /* Navy - Dark Blue */
--program-corp: #553c9a;         /* Corporate - Purple */

/* Backgrounds */
--bg-primary: #ffffff;
--bg-secondary: #f7fafc;
--bg-critical: #fff5f5;
--bg-high: #fffaf0;
--bg-medium: #fffff0;
```

#### Typography

```css
--font-primary: 'Inter', system-ui, sans-serif;
--font-mono: 'JetBrains Mono', monospace;

--text-xs: 11px;
--text-sm: 13px;
--text-base: 14px;
--text-lg: 18px;
--text-xl: 24px;
```

### 4.2 Component Specifications

#### Tab Navigation

```
┌────────────────────────────────────────────────────────────────────────────┐
│  [Jobs] [Programs] [Primes] [Locations] [Customers] [Contacts] [Bench] [▶] │
│   127     6          3         12          5          967        23        │
└────────────────────────────────────────────────────────────────────────────┘

- Active tab: Navy background, white text
- Inactive tab: White background, navy text
- Badge count: Shows record count per tab
- [▶] = Daily Playbook (highlighted when actions pending)
```

#### Data Grid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Column headers: Navy background, white text, sortable (▲▼)                │
│  Filter row: Light gray background, input fields                           │
│  Data rows: Alternating white/light-gray                                   │
│  Priority column: Color-coded background per priority                      │
│  Hover state: Light blue highlight                                         │
│  Selected row: Blue border                                                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Contact Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  [Avatar]  Name                                          Tier Badge  │  │
│  │            Title @ Company                               Priority    │  │
│  │            ─────────────────────────────────────────────────────     │  │
│  │            📍 Location (Program)                                      │  │
│  │            📧 email@domain.com                                        │  │
│  │            📞 (555) 123-4567                                          │  │
│  │            🔗 [LinkedIn]                                              │  │
│  │            ─────────────────────────────────────────────────────     │  │
│  │            Pain Points section (if available)                        │  │
│  │            Personalized Message section                              │  │
│  │            ─────────────────────────────────────────────────────     │  │
│  │            [Call Script] [Email] [LinkedIn] [Copy All]               │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Job Intelligence Card

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ┌──────────────────────────────────────────────────────────────────────┐  │
│  │  Job Title                                               Score: XX  │  │
│  │  📍 Location | 🔐 Clearance | 💰 Pay Rate                Priority   │  │
│  │  ═══════════════════════════════════════════════════════════════    │  │
│  │                                                                      │  │
│  │  PROGRAM INTELLIGENCE                                                │  │
│  │  • Program: [Name]                                                   │  │
│  │  • Task Order: [Name]                                                │  │
│  │  • Customer: [Agency] | Prime: [Contractor]                         │  │
│  │  ───────────────────────────────────────────────────────────────    │  │
│  │                                                                      │  │
│  │  KEY CONTACTS                                                        │  │
│  │  • Site Lead: [Name] - Priority                                     │  │
│  │  • Hiring Mgr: [Name] - Priority                                    │  │
│  │  ───────────────────────────────────────────────────────────────    │  │
│  │                                                                      │  │
│  │  PTS ALIGNMENT                                                       │  │
│  │  • Past Perf: [Programs]                                            │  │
│  │  • Contractors Available: X                                         │  │
│  │  ───────────────────────────────────────────────────────────────    │  │
│  │                                                                      │  │
│  │  PAIN POINTS (from HUMINT)                                           │  │
│  │  • [Pain point 1]                                                   │  │
│  │  • [Pain point 2]                                                   │  │
│  │  ───────────────────────────────────────────────────────────────    │  │
│  │                                                                      │  │
│  │  [View Details] [Export] [Add to Playbook]                          │  │
│  └──────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Responsive Behavior

| Breakpoint | Layout | Notes |
|------------|--------|-------|
| Desktop (>1200px) | Full layout, side panels | Optimal experience |
| Tablet (768-1200px) | Stacked panels | Cards full-width |
| Mobile (<768px) | Single column | Tab navigation as hamburger |

---

## PART 5: IMPLEMENTATION ROADMAP

### Phase 1: Core Infrastructure (Week 1-2)

**Objective:** Establish data pipeline and basic dashboard shell

#### Tasks:
1. **Data Export Scripts**
   - Export all Notion databases to JSON
   - Build correlation engine (job ↔ program ↔ contact)
   - Generate unified data files

2. **Dashboard Shell (React)**
   - Tab navigation component
   - Basic data grid component
   - Filter/sort infrastructure
   - PTS design system setup

3. **Data Integration**
   - Load JSON data files
   - Implement search/filter
   - Basic views for each tab

#### Deliverables:
- `dashboard_app/` React application
- `data/` directory with JSON exports
- `scripts/` data processing utilities
- Basic working dashboard with 8 tabs

---

### Phase 2: Jobs & Contacts Intelligence (Week 3-4)

**Objective:** Full Jobs and Contacts tabs with BD Formula integration

#### Tasks:
1. **Jobs Tab Complete**
   - Job intelligence cards
   - Program context display
   - Contact linkage display
   - PTS alignment display
   - Pain points integration

2. **Contacts Tab Complete**
   - Contact cards with full profile
   - BD Formula message generation
   - Outreach status tracking
   - Export to call sheet

3. **BD Formula Generator**
   - Automated personalized opener
   - Pain point reference injection
   - Labor gap reference (from jobs)
   - PTS past performance matching
   - Program alignment text
   - Role-specific messaging

#### Deliverables:
- Complete Jobs intelligence view
- Complete Contacts BD-ready view
- BD Formula generation engine
- Excel call sheet export

---

### Phase 3: Program & Company Intelligence (Week 5-6)

**Objective:** Complete Programs, Primes/Clients, Customers tabs

#### Tasks:
1. **Programs Tab Complete**
   - Program overview cards
   - Pain points aggregation
   - Contact coverage analysis
   - Job activity tracking
   - PTS positioning display

2. **Primes/Clients Tab Complete**
   - Company portfolio view
   - Relationship history
   - Hiring activity dashboard
   - Contact hierarchy view

3. **Customers Tab Complete**
   - Agency/command profiles
   - Program linkage
   - Acquisition intelligence

#### Deliverables:
- Complete program intelligence view
- Company relationship dashboard
- Customer/agency profiles
- Cross-reference navigation

---

### Phase 4: Locations, Contractors & Daily Playbook (Week 7-8)

**Objective:** Complete remaining tabs and daily automation

#### Tasks:
1. **Locations Tab Complete**
   - Geographic view
   - Site-specific intelligence
   - Contact coverage mapping

2. **Contractors Tab Complete**
   - PTS bench display
   - Job matching engine
   - Availability tracking
   - Presentation status

3. **Daily Playbook Tab**
   - Automated daily generation
   - Call sequence optimization
   - Email queue management
   - Meeting preparation
   - Progress tracking

4. **Automation Integration**
   - Daily 6am data refresh
   - Playbook auto-generation
   - Status sync to Notion

#### Deliverables:
- Complete all 8 tabs
- Daily playbook automation
- Full end-to-end pipeline
- Production-ready dashboard

---

## PART 6: AUTO CLAUDE TASK SPECIFICATIONS

### Task 1: Data Export & Correlation Engine

```markdown
# Task: Build Data Export and Correlation Engine

## Objective
Create a Python-based data processing pipeline that:
1. Exports all Notion databases to JSON
2. Correlates data across databases
3. Generates unified output files for the dashboard

## Input Files
- /mnt/project/jobs_fully_enriched.csv (current enriched jobs)
- /mnt/project/DCGS_Contact_Spreadsheet__391_120925_PERSON.csv (contacts)
- /mnt/project/Federal_Program_Cleaned_Notion_Import.csv (programs)
- /mnt/project/GDIT_Jobs.csv (GDIT Bullhorn jobs)

## Output Files
- /output/data/jobs_intelligence.json
- /output/data/contacts_actionable.json
- /output/data/programs_complete.json
- /output/data/primes_relationships.json
- /output/data/locations_hub.json
- /output/data/customers_agencies.json
- /output/data/daily_playbook.json

## Processing Steps
1. Load all CSV files
2. Enrich each job with:
   - Linked program details
   - Linked contacts (by program/location)
   - PTS past performance matches
   - BD score and priority
3. Classify each contact with:
   - Hierarchy tier
   - BD priority
   - Program assignment
   - Location hub
   - BD Formula messaging
4. Aggregate by program, prime, location, customer
5. Generate daily playbook with prioritized actions

## Success Criteria
- All JSON files generated without errors
- Jobs have complete program/contact linkage
- Contacts have BD Formula messaging
- Daily playbook contains prioritized call list
```

### Task 2: React Dashboard Application

```markdown
# Task: Build BD Intelligence Dashboard (React)

## Objective
Create a single-page React application with 8 tabs displaying
BD intelligence data from JSON files.

## Technical Requirements
- React 18+ with functional components
- Tailwind CSS for styling
- No external backend required (JSON file loading)
- Responsive design (desktop/tablet/mobile)

## Tabs to Implement
1. Jobs - Data grid with job intelligence cards
2. Programs - Program overview cards
3. Primes/Clients - Company relationship view
4. Locations - Geographic grouping view
5. Customers - Agency/command profiles
6. Contacts - BD-ready contact cards
7. Contractors - PTS bench matching
8. Daily Playbook - Action list with scripts

## Components Required
- TabNavigation - Tab bar with counts
- DataGrid - Sortable, filterable table
- JobCard - Job intelligence display
- ContactCard - Contact with BD messaging
- ProgramCard - Program overview
- PlaybookItem - Action item with script
- FilterBar - Search and filter controls
- ExportButton - Excel/PDF export

## Design System
- PTS color palette (navy/blue)
- Priority colors (🔴🟠🟡⚪)
- Inter font family
- Professional, clean aesthetic

## Data Loading
- Load JSON from /data/ directory
- No API calls required
- Client-side filtering/sorting
- LocalStorage for user preferences

## Success Criteria
- All 8 tabs functional
- Data displays correctly
- Filters and sorts work
- Export functionality works
- Responsive on all devices
```

### Task 3: BD Formula Generator

```markdown
# Task: Build BD Formula Message Generator

## Objective
Create a Python module that generates personalized BD outreach
messages following the 6-step PTS BD Formula.

## Input
- Contact record (name, title, program, location)
- Program record (pain points, active jobs)
- PTS past performance database
- Job matches for their program/location

## Output
- Personalized email (Tier 3-4 format)
- LinkedIn connection request (300 char)
- LinkedIn InMail message
- Cold call script

## BD Formula Steps
1. Personalized opener (program/role specific)
2. Pain point reference (from HUMINT)
3. Labor gap reference (from active jobs)
4. PTS-GDIT past performance
5. Program alignment (similar missions)
6. Role alignment (job title matching)

## Message Templates
- Apply tone guidelines by tier
- Tier 5-6: Friendly, curious
- Tier 3-4: Professional, data-backed
- Tier 1-2: Strategic, concise

## Success Criteria
- All contacts have personalized messages
- Messages follow BD Formula exactly
- No generic/template placeholders
- Appropriate length per channel
```

### Task 4: Daily Playbook Generator

```markdown
# Task: Build Daily Playbook Auto-Generator

## Objective
Create a script that runs daily at 6am to generate the
prioritized action list for BD outreach.

## Input
- contacts_actionable.json
- jobs_intelligence.json
- Contact outreach history
- Meeting calendar

## Output
- daily_playbook.json with:
  - Call sequence (ordered by priority)
  - Email queue (ready-to-send)
  - Meeting prep notes
  - Follow-up tracking

## Prioritization Logic
1. 🔴 Critical contacts (Tier 1-2, PACAF)
2. 🟠 High contacts (Tier 3 PMs, active hiring)
3. 🟡 Medium contacts (Tier 4 managers)
4. ⚪ Standard (Tier 5-6 for HUMINT)

## Call Sequence Rules
- Max 8 critical calls per day
- Space calls by program (avoid back-to-back same program)
- Include call script per contact
- Track voicemail fallback options

## Email Queue Rules
- Generate from contacts not reached by phone
- Apply email templates by tier
- Max 5 emails per day
- Track open/response status

## Success Criteria
- Playbook generates daily without intervention
- Call sequence is optimized
- All actions have complete scripts
- Progress tracking updates Notion
```

---

## PART 7: FILE STRUCTURE

### Dashboard Application Structure

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
│   │   ├── grids/
│   │   │   ├── DataGrid.jsx
│   │   │   └── GridColumns.jsx
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
│   │   ├── jobs_intelligence.json
│   │   ├── contacts_actionable.json
│   │   ├── programs_complete.json
│   │   ├── primes_relationships.json
│   │   ├── locations_hub.json
│   │   ├── customers_agencies.json
│   │   ├── contractors_bench.json
│   │   └── daily_playbook.json
│   ├── utils/
│   │   ├── dataLoader.js
│   │   ├── filtering.js
│   │   ├── sorting.js
│   │   └── export.js
│   ├── styles/
│   │   ├── colors.css
│   │   └── components.css
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

## PART 8: SUCCESS METRICS

### Quantitative Metrics

| Metric | Current State | Target | Measurement |
|--------|---------------|--------|-------------|
| Manual analysis time | 4+ hours/day | 15 minutes/day | Time tracking |
| Jobs with complete BD context | 30% | 100% | Data completeness |
| Contacts with personalized messaging | 0% | 100% | BD Formula coverage |
| Daily call list automation | Manual | 100% automated | Playbook generation |
| Program pain point coverage | 50% | 90% | HUMINT integration |
| PTS past performance alignment | Manual | Automated | System matching |

### Qualitative Metrics

- **User Experience:** Single dashboard vs. 6+ tools
- **Data Quality:** Enriched vs. raw data
- **Actionability:** Ready-to-use messages vs. research required
- **Consistency:** BD Formula compliance across all outreach
- **Scalability:** Handle 1000+ contacts without degradation

---

## APPENDIX A: NOTION DATABASE SCHEMAS

### DCGS Contacts Full
```
Collection ID: 2ccdef65-baa5-8087-a53b-000ba596128e
Fields:
- First Name (Text)
- Last Name (Text)
- Job Title (Text)
- Email Address (Email)
- Phone Number (Phone)
- Direct Phone Number (Phone)
- Mobile phone (Phone)
- LinkedIn Contact Profile URL (URL)
- Person City (Text)
- Person State (Text)
- Program (Select): AF DCGS - Langley, AF DCGS - Wright-Patt, AF DCGS - PACAF, AF DCGS - Other, Army DCGS-A, Navy DCGS-N, Corporate HQ, Enterprise Security, Unassigned
- Hierarchy Tier (Select): Tier 1-6
- BD Priority (Select): 🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard
- Location Hub (Select): Hampton Roads, San Diego Metro, DC Metro, Dayton/Wright-Patt, Other CONUS, OCONUS, Unknown
- Functional Area (Multi-Select)
```

### Program Mapping Intelligence Hub
```
Collection ID: f57792c1-605b-424c-8830-23ab41c47137
Fields:
- Job Title (Text)
- Location (Text)
- Clearance (Select)
- Status (Select): raw_import, pending_enrichment, enriching, enriched, validated, error
- Priority Score (Number)
- Confidence (Number)
- Matched Program (Text)
- Source URL (URL)
- Import Date (Date)
```

### Federal Programs
```
Collection ID: 06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
Fields:
- Program Name (Text)
- Acronym (Text)
- Agency Owner (Text)
- Prime Contractor (Text)
- Known Subcontractors (Text)
- Contract Value (Text)
- Contract Vehicle/Type (Text)
- Key Locations (Text)
- Clearance Requirements (Text)
- Typical Roles (Text)
- Keywords/Signals (Text)
- PTS Involvement (Select): Current, Past, Target, None
- Priority Level (Select)
- Pain Points (Text)
```

---

## APPENDIX B: BD FORMULA REFERENCE

### The 6-Step Formula

1. **Personalized Message** - Role-specific icebreaker
2. **Current Pain Points** - Program-specific challenges (HUMINT)
3. **Labor Gaps & Open Jobs** - Current vacancies
4. **PTS Past Performance with GDIT** - Direct partnership history
5. **Relevant Past Performance to Program** - Similar mission experience
6. **Past Performance Relevant to Job Title** - Role-specific capabilities

### Tone by Tier

| Tier | Tone | Length | Focus |
|------|------|--------|-------|
| 5-6 (ICs) | Friendly, curious | Short | Mission, team |
| 4 (Managers) | Collaborative | Medium | Solutions |
| 3 (PMs) | Professional | Medium | Results, data |
| 1-2 (Execs) | Strategic | Short | Value, partnership |

### PTS Past Performance Reference

| Program | Description | Relevance |
|---------|-------------|-----------|
| BICES/BICES-X | TS/SCI network engineers (Norfolk, Tampa) | Coalition intel |
| GSM-O II | Network engineers for DISA ops | Critical infrastructure |
| NATO BICES | Coalition intel network analysts | International ops |
| SOCOM JICCENT | Joint Intelligence Center | ISR processing |
| Platform One | USAF DevSecOps | AF modernization |
| DISA JRSS | Multi-site network security | Enterprise security |

---

## DOCUMENT CONTROL

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-13 | Claude AI | Initial architecture document |

---

**END OF ARCHITECTURE DOCUMENT**

This document provides the complete specification for building the BD Intelligence Dashboard. Each section can be used as a standalone task specification for Auto Claude implementation.
