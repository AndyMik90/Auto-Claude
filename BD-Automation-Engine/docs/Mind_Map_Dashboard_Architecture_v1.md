# Mind Map Dashboard Architecture Specification
## BD Intelligence Interactive Graph Visualization System
### Version 1.0 | January 2026

---

## Executive Summary

This specification defines an **interactive graph-based mind map system** for the BD Intelligence Dashboard. Unlike traditional hierarchical views, this system allows any entity (Job, Program, Contact, Location, BD Event, etc.) to become the **"Native Node"** - the central focus from which all related data radiates outward through interconnected relationships.

The mind map enables dynamic exploration of BD intelligence, revealing connections that flat tables and traditional dashboards miss. It transforms the question from "show me jobs" to "show me everything connected to this job, then let me explore outward."

---

## Part 1: Entity & Relationship Model

### 1.1 Core Entities (Node Types)

Each entity becomes a draggable, expandable node in the mind map. All nodes share common behaviors but have entity-specific data schemas.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          ENTITY TAXONOMY                                     │
├─────────────────┬───────────────────────────────────────────────────────────┤
│ Entity Type     │ Description                                               │
├─────────────────┼───────────────────────────────────────────────────────────┤
│ 🎯 JOB          │ Open position from competitor job boards                  │
│ 📋 PROGRAM      │ Federal contract/program (AF DCGS, DCGS-A, etc.)         │
│ 🏢 PRIME        │ Prime contractor (GDIT, BAE, Leidos, etc.)               │
│ 🤝 SUBCONTRACTOR│ Subcontractor to a prime on a program                    │
│ 📦 TASK ORDER   │ Task order under a program                               │
│ 👥 TEAM         │ Team/group within a task order                           │
│ 📍 LOCATION     │ Physical site (base, city, facility)                     │
│ 📅 BD EVENT     │ Conference, industry day, symposium                      │
│ 👤 CONTACT      │ Person in the BD database                                │
│ 🏛️ CUSTOMER     │ Government customer/agency                              │
│ 💼 PTS CONTRACTOR│ PTS available consultant/contractor                     │
│ 🎖️ PTS PAST PERF│ PTS past performance on programs                        │
│ 🔧 FUNCTIONAL AREA│ Job function category                                  │
│ 🔐 CLEARANCE    │ Security clearance level                                 │
└─────────────────┴───────────────────────────────────────────────────────────┘
```

### 1.2 Complete Relationship Matrix

This matrix defines ALL possible relationships between entities. Each relationship is **bidirectional** - can be traversed from either end.

```
                    ┌─────────────────────────────────────────────────────────────────────────────────────────────┐
                    │                        RELATIONSHIP MATRIX (Direction: Row → Column)                        │
                    ├────────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────────┤
                    │            │ PROGRAM  │ PRIME    │ TASK ORD │ LOCATION │ CONTACT  │ BD EVENT │ PTS PP       │
┌───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ JOB               │ mapped_to  │ posted_by│ under    │ located  │ hiring_  │ signals  │ relevant │              │
│                   │            │          │          │          │ manager  │ for      │ to       │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ PROGRAM           │ —          │ run_by   │ has_task │ operates │ staffed  │ discussed│ pts_has  │              │
│                   │            │          │ orders   │ at       │ by       │ at       │ history  │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ PRIME             │ runs       │ —        │ manages  │ has_     │ employs  │ attending│ pts_     │              │
│                   │            │          │          │ offices  │          │          │ worked   │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ SUBCONTRACTOR     │ supports   │ subs_for │ works_on │ present  │ employs  │ attending│ pts_     │              │
│                   │            │          │          │ at       │          │          │ competes │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ TASK ORDER        │ under      │ managed  │ —        │ executes │ led_by   │ —        │ pts_has  │              │
│                   │            │ by       │          │ at       │          │          │ placed   │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ LOCATION          │ hosts      │ has_     │ site_for │ —        │ based    │ held_at  │ pts_     │              │
│                   │            │ presence │          │          │          │          │ active   │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ CONTACT           │ works_on   │ employed │ assigned │ based_in │ —        │ may_     │ —        │              │
│                   │            │ by       │ to       │          │          │ attend   │          │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ BD EVENT          │ covers     │ attracts │ —        │ hosted   │ attracts │ —        │ —        │              │
│                   │            │          │          │ at       │          │          │          │              │
├───────────────────┼────────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────┼──────────────┤
│ PTS CONTRACTOR    │ can_fill   │ placed   │ can_     │ can_work │ knows    │ can_     │ achieved │              │
│                   │            │ with     │ support  │ at       │          │ attend   │          │              │
└───────────────────┴────────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────────┘
```

### 1.3 Entity Data Schemas

Each entity type has a specific data schema. When a node is created, it loads this data. Hover/click reveals details.

#### JOB Node Schema
```yaml
JOB:
  core_fields:
    - job_id: string
    - title: string
    - source: enum [Apex Systems, Insight Global, TEKsystems, Direct]
    - url: url
    - bd_priority: enum [🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard]
    - bd_score: number (0-100)
    
  details:
    - location: Location reference
    - clearance: enum [TS/SCI w/ Poly, TS/SCI, TS, Secret, Unknown]
    - employment_type: enum [Contract, FullTime, Temp]
    - pay_rate: string
    - duration: string
    - description: text
    - posted_date: date
    - scraped_date: date
    
  relationships:
    - program: Program reference
    - task_order: TaskOrder reference
    - site: string
    - functional_area: enum
    - customer: Customer reference
    - hiring_manager: Contact reference
    - team_contacts: Contact[] references
    - program_leadership: Contact[] references
    - skills_required: string[]
    - technologies: string[]
    
  pts_alignment:
    - relevant_past_performance: PTS_PP[] references
    - matching_contractors: PTS_Contractor[] references
    - bd_formula_message: text (generated)
```

#### PROGRAM Node Schema
```yaml
PROGRAM:
  core_fields:
    - program_name: string
    - acronym: string
    - program_type: enum [C5ISR, Cyber, Intel, IT Ops, Space, Weapon Systems, Event, R&D]
    
  contract_details:
    - contract_value: string
    - contract_vehicle: string
    - pop_start: date
    - pop_end: date
    - period_of_performance: string
    
  relationships:
    - agency_owner: Customer reference
    - prime_contractor: Prime reference
    - known_subcontractors: Subcontractor[] references
    - task_orders: TaskOrder[] references
    - key_locations: Location[] references
    - clearance_requirements: Clearance[]
    - typical_roles: FunctionalArea[]
    - active_jobs: Job[] references
    - program_contacts: Contact[] references
    
  pts_positioning:
    - pts_involvement: enum [Current, Past, Target, None]
    - pts_past_performance: PTS_PP[] references
    - known_pain_points: text[]
    - bd_strategy: text
```

#### CONTACT Node Schema
```yaml
CONTACT:
  core_fields:
    - full_name: string
    - job_title: string
    - hierarchy_tier: enum [Tier 1-Executive, Tier 2-Director, Tier 3-Program Leadership, Tier 4-Management, Tier 5-Senior IC, Tier 6-IC]
    - bd_priority: enum [🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard]
    
  contact_info:
    - email: string
    - phone: string
    - direct_phone: string
    - mobile: string
    - linkedin_url: url
    
  organizational:
    - employer: Prime reference
    - program: Program reference
    - task_order: TaskOrder reference
    - team: Team reference
    - functional_area: FunctionalArea[]
    
  location:
    - city: string
    - state: string
    - location_hub: Location reference
    
  bd_context:
    - known_pain_points: text[]
    - humint_gathered: text[]
    - outreach_status: enum [Not Contacted, Initial Contact, Follow-up, Meeting Set, Engaged]
    - bd_formula_message: text (generated)
    - related_jobs: Job[] references (hiring authority over)
```

#### BD_EVENT Node Schema
```yaml
BD_EVENT:
  core_fields:
    - event_name: string
    - event_type: enum [Conference, Industry Day, Symposium, Forecast, Classified Session]
    - dates: date_range
    
  details:
    - location: Location reference
    - focus_areas: FunctionalArea[]
    - access_requirements: string
    - clearance_required: Clearance
    - description: text
    
  relationships:
    - attending_primes: Prime[] references
    - attending_tier1_subs: Subcontractor[] references
    - relevant_programs: Program[] references (via attending primes)
    - relevant_contacts: Contact[] references (via programs)
    - relevant_customers: Customer[] references
    
  bd_planning:
    - pts_attending: boolean
    - target_contacts: Contact[] references
    - talking_points: text[]
    - follow_up_actions: text[]
```

#### LOCATION Node Schema
```yaml
LOCATION:
  core_fields:
    - name: string
    - location_hub: enum [Hampton Roads, San Diego Metro, DC Metro, Dayton/Wright-Patt, Other CONUS, OCONUS, Unknown]
    - city: string
    - state: string
    - facility_type: enum [AFB, Navy Base, Army Post, Corporate Office, Data Center, Other]
    
  aggregations:
    - programs_at_location: Program[] references
    - jobs_at_location: Job[] references
    - contacts_at_location: Contact[] references
    - primes_with_presence: Prime[] references
    - events_at_location: BD_Event[] references
    
  pts_presence:
    - pts_contractors_available: PTS_Contractor[] references
    - pts_past_performance_here: PTS_PP[] references
    - pts_task_orders_placed: number
```

---

## Part 2: Native Node Configuration Schemas

The mind map can be configured with different "Native Nodes" - the central starting point from which all exploration radiates. Each configuration defines expansion paths and data loading order.

### 2.1 Configuration Schema Structure

```yaml
NativeNodeConfiguration:
  native_node_type: enum [JOB, PROGRAM, PRIME, LOCATION, BD_EVENT, CONTACT, CUSTOMER, PTS_CONTRACTOR]
  
  expansion_tiers:
    tier_1: # Immediate children (auto-expand)
      nodes: NodeType[]
      relationship: string
      display: enum [full, compact, count_only]
      
    tier_2: # Second level (click to expand)
      nodes: NodeType[]
      relationship: string
      display: enum [full, compact, count_only]
      
    tier_3+: # Deep exploration (progressive loading)
      # ... continues
      
  note_panel_fields:
    # Fields to show in hover/detail panel
    
  color_coding:
    # How to color nodes in this configuration
```

### 2.2 Native Node: JOB

**Use Case:** "I found a job posting. Show me everything about it - program, contacts, how to approach, PTS alignment."

```yaml
JOB_NATIVE_CONFIG:
  native_node_type: JOB
  initial_display:
    - title
    - location
    - clearance
    - bd_priority (color)
    - bd_score
    
  expansion_tiers:
    tier_1: # Direct connections (auto-loaded)
      - node: PROGRAM
        relationship: "mapped_to"
        fields: [program_name, acronym, prime_contractor, contract_value]
        
      - node: LOCATION
        relationship: "located_at"
        fields: [name, facility_type, city, state]
        
      - node: CONTACT (Hiring Manager)
        relationship: "hiring_manager"
        fields: [full_name, job_title, hierarchy_tier, bd_priority]
        
    tier_2: # Program context (click to expand)
      from_program:
        - node: PRIME
          relationship: "program → prime_contractor"
          fields: [name, relevant_programs_count]
          
        - node: TASK_ORDER
          relationship: "program → task_orders"
          fields: [name, task_order_leader]
          
        - node: CUSTOMER
          relationship: "program → agency_owner"
          fields: [name, mission_area]
          
      from_location:
        - node: CONTACT (Team)
          relationship: "location → contacts"
          filter: "same program OR same site"
          fields: [full_name, job_title, hierarchy_tier]
          
        - node: JOB (Related)
          relationship: "location → jobs"
          filter: "same program"
          fields: [title, clearance, bd_priority]
          
    tier_3: # PTS alignment (click to expand)
      - node: PTS_PAST_PERFORMANCE
        relationship: "relevant based on program/location match"
        fields: [program_name, role_types, outcome]
        
      - node: PTS_CONTRACTOR
        relationship: "skills_match AND clearance_match AND location_proximity"
        fields: [name, clearance, skills, availability]
        
    tier_4: # Deep contact exploration
      from_contacts:
        - node: CONTACT (Program Leadership)
          relationship: "program → program_contacts WHERE tier IN [1,2,3]"
          fields: [full_name, job_title, hierarchy_tier, bd_priority]
          
        - node: CONTACT (Team Members)
          relationship: "task_order → team → members"
          fields: [full_name, job_title, hierarchy_tier]
          
  note_panel:
    job_details:
      - description
      - skills_required
      - technologies
      - pay_rate
      - duration
      - posted_date
      
    bd_formula:
      - personalized_opener
      - pain_point_reference
      - labor_gap_reference
      - pts_gdit_past_performance
      - pts_program_alignment
      - pts_role_alignment
      
  color_scheme:
    native_node: "--pts-navy"
    program_nodes: "--program-{branch}"
    contact_nodes: "--priority-{bd_priority}"
    location_nodes: "--pts-blue"
    pts_nodes: "--status-success"
```

**Visual Expansion Example (JOB as Native):**
```
                                    ┌─────────────────────┐
                                    │     🏛️ CUSTOMER     │
                                    │   INSCOM / PEO IEW&S│
                                    └──────────┬──────────┘
                                               │
                    ┌──────────────────────────┼──────────────────────────┐
                    │                          │                          │
            ┌───────▼───────┐          ┌───────▼───────┐          ┌───────▼───────┐
            │  🏢 PRIME     │          │  📋 PROGRAM   │          │ 📦 TASK ORDER │
            │    GDIT       │◄─────────│ Army DCGS-A   │──────────►│  DCGS-A/INSCOM│
            │               │          │   $300M       │          │               │
            └───────┬───────┘          └───────┬───────┘          └───────┬───────┘
                    │                          │                          │
                    │                          │                          │
                    │              ┌───────────┼───────────┐              │
                    │              │           │           │              │
                    │      ┌───────▼───────┐   │   ┌───────▼───────┐      │
                    │      │  📍 LOCATION  │   │   │  📍 LOCATION  │      │
                    │      │ Fort Belvoir  │   │   │   Aberdeen    │      │
                    │      └───────┬───────┘   │   └───────────────┘      │
                    │              │           │                          │
                    │              │   ┌───────┴───────────────┐          │
                    │              │   │                       │          │
                    │      ┌───────▼───▼───┐           ┌───────▼───────┐  │
                    │      │               │           │               │  │
                    │      │   🎯 JOB      │           │   🎯 JOB      │  │
                    │      │   ═══════     │           │   Related     │  │
                    │      │  Sys Admin    │           │   Cyber Role  │  │
                    │      │  🔴 Critical  │           │               │  │
                    │      │  BD Score: 83 │           │               │  │
                    │      └───────┬───────┘           └───────────────┘  │
                    │              │                                      │
        ┌───────────┼──────────────┼──────────────────────────────────────┘
        │           │              │
┌───────▼───────┐   │      ┌───────▼───────┐
│ 🎖️ PTS PP     │   │      │ 👤 CONTACT    │
│ BICES/BICES-X │   │      │ Hiring Mgr    │
│ TS/SCI NetEng │   │      │ Jeffrey       │
└───────────────┘   │      │ Bartsch       │
                    │      │ 🟠 High       │
                    │      └───────┬───────┘
                    │              │
            ┌───────▼───────┐      │
            │ 💼 PTS CTRCT  │      │    ┌───────────────┐
            │ Aaron Himes   │      └────► 👤 CONTACT    │
            │ TS/SCI CI Poly│           │ Team Lead     │
            │ 95% Match     │           │ Joaquin G.    │
            └───────────────┘           └───────────────┘
```

### 2.3 Native Node: BD EVENT

**Use Case:** "I'm attending AFCEA West. Show me every prime, program, contact, and opportunity I should target."

```yaml
BD_EVENT_NATIVE_CONFIG:
  native_node_type: BD_EVENT
  initial_display:
    - event_name
    - dates
    - location
    - focus_areas
    - access_requirements
    
  expansion_tiers:
    tier_1: # Who's attending (auto-loaded)
      - node: PRIME
        relationship: "attending"
        fields: [name, relevant_programs_count]
        
      - node: SUBCONTRACTOR (Tier 1)
        relationship: "attending"
        filter: "tier_1_only"
        fields: [name, primes_they_sub_for]
        
      - node: LOCATION
        relationship: "held_at"
        fields: [name, city, state, facility_type]
        
    tier_2: # What programs will be discussed
      from_primes:
        - node: PROGRAM
          relationship: "prime → programs WHERE focus_area IN event.focus_areas"
          fields: [program_name, acronym, contract_value, bd_priority]
          
    tier_3: # Who to talk to from those programs
      from_programs:
        - node: TASK_ORDER
          relationship: "program → task_orders"
          fields: [name, location, task_order_leader]
          
        - node: TEAM
          relationship: "task_order → team"
          fields: [name, team_lead]
          
    tier_4: # Actual contacts to target
      from_teams:
        - node: CONTACT (Team Lead)
          relationship: "team → team_lead"
          fields: [full_name, job_title, hierarchy_tier, bd_priority, linkedin]
          
        - node: CONTACT (Team Members)
          relationship: "team → members"
          filter: "hierarchy_tier IN [Tier 4, Tier 5]"
          fields: [full_name, job_title, hierarchy_tier]
          
      from_programs:
        - node: CONTACT (Program Leadership)
          relationship: "program → contacts WHERE tier IN [Tier 1, Tier 2, Tier 3]"
          fields: [full_name, job_title, hierarchy_tier, bd_priority]
          
    tier_5: # What pain points & jobs to discuss
      from_contacts:
        - node: JOB
          relationship: "contact.hiring_authority → jobs"
          fields: [title, location, clearance, bd_priority]
          
  note_panel:
    event_details:
      - description
      - schedule_url
      - registration_info
      
    bd_preparation:
      - target_contact_list (prioritized)
      - talking_points_per_contact
      - pts_past_performance_to_mention
      - follow_up_plan
      
  color_scheme:
    native_node: "--pts-blue"
    prime_nodes: "--pts-navy"
    program_nodes: "--program-{branch}"
    contact_nodes: "--priority-{bd_priority}"
```

**Visual Expansion Example (BD EVENT as Native):**
```
                                        ┌─────────────────────────────┐
                                        │       📅 BD EVENT           │
                                        │       ═══════════           │
                                        │    AFCEA WEST 2026          │
                                        │    Feb 10-12, San Diego     │
                                        │    Focus: Naval C4ISR       │
                                        └──────────────┬──────────────┘
                                                       │
                    ┌──────────────────────────────────┼──────────────────────────────────┐
                    │                                  │                                  │
           ┌────────▼────────┐                ┌────────▼────────┐                ┌────────▼────────┐
           │   🏢 PRIME      │                │   🏢 PRIME      │                │   🏢 PRIME      │
           │     GDIT        │                │   BAE Systems   │                │     Leidos      │
           │ 3 Programs      │                │  2 Programs     │                │  4 Programs     │
           └────────┬────────┘                └────────┬────────┘                └─────────────────┘
                    │                                  │
         ┌──────────┼──────────┐            ┌──────────┼──────────┐
         │          │          │            │          │          │
   ┌─────▼─────┐ ┌──▼──────┐ ┌─▼──────┐ ┌───▼────┐ ┌───▼────┐
   │📋 PROGRAM │ │📋 PROGRAM│ │📋 PROGRAM│ │📋 PROG │ │📋 PROG │
   │Navy DCGS-N│ │Army DCGS │ │ BICES   │ │AF DCGS │ │DCGS-N  │
   │  $150M    │ │  $300M   │ │         │ │$500M   │ │        │
   └─────┬─────┘ └─────────┘ └─────────┘ └───┬────┘ └────────┘
         │                                    │
         │    ┌───────────────────────────────┘
         │    │
   ┌─────▼────▼─────┐
   │  📦 TASK ORDER │
   │ DCGS-N / BICES │
   │ Norfolk Site   │
   └───────┬────────┘
           │
           │     ┌────────────────────────────────────┐
           │     │                                    │
   ┌───────▼─────▼───┐                       ┌───────▼───────┐
   │    👥 TEAM      │                       │    👤 CONTACT │
   │ Norfolk Ops     │                       │ Dusty Galbraith│
   │                 │                       │ PM, 🟠 High   │
   └───────┬─────────┘                       └───────┬───────┘
           │                                         │
   ┌───────┼───────────────────────┐                 │
   │       │                       │                 │
┌──▼───┐ ┌─▼────┐ ┌──────┐ ┌──────┴──────┐   ┌──────▼──────┐
│CONTCT│ │CONTCT│ │CONTCT│ │  🎯 JOB     │   │ 🎯 JOB      │
│Merchnt│ │Nicholас││Vanessa│ │ Solutions  │   │ Full Stack  │
│Adams │ │Boyce │ │Bradshw│ │ Architect  │   │ Developer   │
│Tier 3│ │Tier 6│ │Tier 5│ │ 🟠 High    │   │ 🔴 Critical │
└──────┘ └──────┘ └──────┘ └─────────────┘   └─────────────┘
```

### 2.4 Native Node: LOCATION

**Use Case:** "I want to focus on San Diego. Show me all programs, jobs, contacts, and PTS positioning for this area."

```yaml
LOCATION_NATIVE_CONFIG:
  native_node_type: LOCATION
  initial_display:
    - name
    - location_hub
    - city, state
    - facility_type
    - job_count
    - contact_count
    
  expansion_tiers:
    tier_1: # What's at this location (auto-loaded)
      - node: PROGRAM
        relationship: "operates_at"
        fields: [program_name, acronym, prime_contractor]
        
      - node: JOB
        relationship: "located_at"
        fields: [title, clearance, bd_priority, bd_score]
        sort: bd_score DESC
        limit: 10
        
      - node: CONTACT
        relationship: "based_in"
        fields: [full_name, job_title, hierarchy_tier, bd_priority]
        sort: hierarchy_tier ASC, bd_priority DESC
        limit: 15
        
    tier_2: # Organizational context
      from_programs:
        - node: PRIME
          relationship: "program → prime"
          fields: [name, programs_at_location_count]
          
        - node: TASK_ORDER
          relationship: "program → task_orders WHERE location = this"
          fields: [name, task_order_leader]
          
        - node: CUSTOMER
          relationship: "program → agency_owner"
          fields: [name, mission_area]
          
    tier_3: # PTS Positioning
      - node: PTS_PAST_PERFORMANCE
        relationship: "has_performance_at_location"
        fields: [program_name, role_types, dates, outcome]
        
      - node: PTS_CONTRACTOR
        relationship: "can_work_at OR currently_at"
        fields: [name, clearance, skills, availability]
        
    tier_4: # Deep dive (all jobs, all contacts)
      - node: JOB (All)
        relationship: "located_at"
        fields: [title, program, clearance, bd_priority]
        paginated: true
        
      - node: CONTACT (All)
        relationship: "based_in"
        fields: [full_name, job_title, program, hierarchy_tier]
        paginated: true
        
  note_panel:
    location_intel:
      - known_pain_points (aggregated from contacts)
      - hiring_velocity (jobs per month)
      - clearance_distribution (pie chart)
      - functional_area_distribution
      
    pts_positioning:
      - total_pts_placements
      - current_contractors
      - relevant_past_performance
      - competitor_presence
      
  color_scheme:
    native_node: "--pts-blue-dark"
    program_nodes: "--program-{branch}"
    job_nodes: "--priority-{bd_priority}"
    contact_nodes: "--priority-{bd_priority}"
    pts_nodes: "--status-success"
```

### 2.5 Native Node: PROGRAM

```yaml
PROGRAM_NATIVE_CONFIG:
  native_node_type: PROGRAM
  initial_display:
    - program_name
    - acronym
    - contract_value
    - prime_contractor
    - program_type
    
  expansion_tiers:
    tier_1: # Core relationships
      - node: PRIME
        relationship: "run_by"
        
      - node: CUSTOMER
        relationship: "agency_owner"
        
      - node: LOCATION
        relationship: "operates_at"
        
      - node: SUBCONTRACTOR
        relationship: "has_subcontractors"
        
    tier_2: # Operational detail
      - node: TASK_ORDER
        relationship: "has_task_orders"
        
      - node: JOB
        relationship: "has_open_jobs"
        sort: bd_score DESC
        
      - node: CONTACT (Leadership)
        relationship: "program_contacts WHERE tier IN [1,2,3]"
        
    tier_3: # Full contact org
      from_task_orders:
        - node: TEAM
          relationship: "task_order → team"
          
      from_teams:
        - node: CONTACT
          relationship: "team → all_members"
          
    tier_4: # PTS alignment
      - node: PTS_PAST_PERFORMANCE
        relationship: "similar_program OR direct"
        
      - node: PTS_CONTRACTOR
        relationship: "can_fill_roles"
        
  note_panel:
    program_intel:
      - known_pain_points
      - recompete_status
      - recent_news
      - budget_trends
      
    bd_strategy:
      - recommended_approach
      - entry_points
      - warm_contacts
```

### 2.6 Native Node: CONTACT

```yaml
CONTACT_NATIVE_CONFIG:
  native_node_type: CONTACT
  initial_display:
    - full_name
    - job_title
    - hierarchy_tier
    - bd_priority
    - employer
    
  expansion_tiers:
    tier_1: # Who they work for/with
      - node: PROGRAM
        relationship: "works_on"
        
      - node: PRIME
        relationship: "employed_by"
        
      - node: TASK_ORDER
        relationship: "assigned_to"
        
      - node: TEAM
        relationship: "member_of"
        
      - node: LOCATION
        relationship: "based_in"
        
    tier_2: # Their sphere of influence
      - node: CONTACT (Reports To)
        relationship: "reports_to"
        
      - node: CONTACT (Direct Reports)
        relationship: "manages"
        
      - node: CONTACT (Peers)
        relationship: "same_team OR same_task_order"
        
    tier_3: # BD opportunities via this contact
      - node: JOB
        relationship: "hiring_authority OR team_jobs"
        
    tier_4: # PTS relevance
      - node: PTS_CONTRACTOR
        relationship: "could_work_with"
        
      - node: PTS_PAST_PERFORMANCE
        relationship: "knows_about OR relevant_to_role"
        
  note_panel:
    contact_details:
      - email, phone, linkedin
      - humint_gathered
      - outreach_history
      - last_contact_date
      
    bd_formula:
      - personalized_opener
      - pain_points_to_reference
      - jobs_to_mention
      - pts_past_performance_to_cite
      - recommended_approach
      - call_script
```

### 2.7 Native Node: PRIME (Client)

```yaml
PRIME_NATIVE_CONFIG:
  native_node_type: PRIME
  initial_display:
    - name
    - total_contract_value
    - program_count
    - pts_relationship_status
    
  expansion_tiers:
    tier_1: # Portfolio overview
      - node: PROGRAM
        relationship: "runs"
        sort: contract_value DESC
        
      - node: LOCATION
        relationship: "has_offices"
        
    tier_2: # Key people
      - node: CONTACT (Executives)
        relationship: "employs WHERE tier IN [1,2]"
        
      - node: CONTACT (Program Managers)
        relationship: "employs WHERE tier = 3"
        
    tier_3: # Operational detail
      from_programs:
        - node: SUBCONTRACTOR
          relationship: "program → subcontractors"
          
        - node: TASK_ORDER
          relationship: "program → task_orders"
          
        - node: JOB
          relationship: "program → jobs"
          
    tier_4: # PTS history
      - node: PTS_PAST_PERFORMANCE
        relationship: "worked_with"
        
      - node: PTS_CONTRACTOR
        relationship: "placed_with"
        
  note_panel:
    client_intel:
      - total_active_jobs
      - hiring_velocity
      - known_pain_points (aggregated)
      - staffing_firms_used
      
    pts_relationship:
      - placements_made
      - current_contractors
      - warm_contacts
      - bd_strategy
```

### 2.8 Native Node: CUSTOMER (Agency)

```yaml
CUSTOMER_NATIVE_CONFIG:
  native_node_type: CUSTOMER
  initial_display:
    - name
    - mission_area
    - programs_count
    - budget_indicators
    
  expansion_tiers:
    tier_1: # What they own
      - node: PROGRAM
        relationship: "owns"
        
    tier_2: # Who serves them
      from_programs:
        - node: PRIME
          relationship: "program → prime"
          
        - node: LOCATION
          relationship: "program → locations"
          
    tier_3: # Operational detail
      from_programs:
        - node: TASK_ORDER
        - node: JOB
        - node: CONTACT
        
    tier_4: # PTS positioning
      - node: PTS_PAST_PERFORMANCE
        relationship: "served_customer"
```

### 2.9 Native Node: PTS CONTRACTOR

```yaml
PTS_CONTRACTOR_NATIVE_CONFIG:
  native_node_type: PTS_CONTRACTOR
  initial_display:
    - name
    - clearance
    - primary_skills
    - availability_status
    - current_location
    
  expansion_tiers:
    tier_1: # Where they can work
      - node: JOB
        relationship: "skills_match AND clearance_match"
        sort: match_score DESC
        
      - node: LOCATION
        relationship: "can_work_at"
        
    tier_2: # Who they could work for
      from_jobs:
        - node: PROGRAM
        - node: PRIME
        - node: TASK_ORDER
        
    tier_3: # Who to contact to place them
      from_programs:
        - node: CONTACT (Hiring Managers)
        - node: CONTACT (PMs)
        
    tier_4: # PTS support
      - node: PTS_PAST_PERFORMANCE
        relationship: "similar_role_placed"
```

---

## Part 3: UI/UX Specifications

### 3.1 Mind Map Canvas

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │  [🎯 Job] [📋 Program] [🏢 Prime] [📍 Location] [📅 Event] [👤 Contact] [💼 PTS]            │ │
│ │  ──────────────────────────────────────────────────────────────────────────────────────────  │ │
│ │                            NATIVE NODE SELECTOR TABS                                        │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                                 │
│ ┌───────────────────────────────────────────────────────────────────────────────────┬─────────┐ │
│ │                                                                                   │         │ │
│ │                                                                                   │  NOTE   │ │
│ │                                                                                   │  PANEL  │ │
│ │                                                                                   │         │ │
│ │                         INTERACTIVE GRAPH CANVAS                                  │ ─────── │ │
│ │                                                                                   │         │ │
│ │              [Draggable nodes with expansion controls]                            │ Details │ │
│ │                                                                                   │ for     │ │
│ │                        [Pan & Zoom enabled]                                       │ Selected│ │
│ │                                                                                   │ Node    │ │
│ │              [Auto-layout with manual override]                                   │         │ │
│ │                                                                                   │ BD      │ │
│ │                                                                                   │ Formula │ │
│ │                                                                                   │         │ │
│ │                                                                                   │ Actions │ │
│ │                                                                                   │         │ │
│ └───────────────────────────────────────────────────────────────────────────────────┴─────────┘ │
│                                                                                                 │
│ ┌─────────────────────────────────────────────────────────────────────────────────────────────┐ │
│ │ 🔍 Search: [                    ]  📊 Show: [All Types ▼]  🎨 Color By: [BD Priority ▼]    │ │
│ │ 📤 Export: [PNG] [SVG] [OPML] [JSON]  🔄 Layout: [Radial ▼]  ⚙️ Settings                   │ │
│ └─────────────────────────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Node Visual Design

```css
/* Base Node Styles */
.node {
  min-width: 120px;
  max-width: 200px;
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
  cursor: grab;
  transition: transform 0.2s, box-shadow 0.2s;
}

.node:hover {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0,0,0,0.15);
}

.node.selected {
  box-shadow: 0 0 0 3px var(--pts-blue);
}

.node.native {
  border: 3px solid var(--pts-navy);
  min-width: 180px;
}

/* Node Type Colors */
.node.job { background: linear-gradient(135deg, #fff5f5, #fed7d7); border-left: 4px solid #e53e3e; }
.node.program { background: linear-gradient(135deg, #ebf8ff, #bee3f8); border-left: 4px solid #3182ce; }
.node.prime { background: linear-gradient(135deg, #f0fff4, #c6f6d5); border-left: 4px solid #38a169; }
.node.location { background: linear-gradient(135deg, #faf5ff, #e9d8fd); border-left: 4px solid #805ad5; }
.node.event { background: linear-gradient(135deg, #fffff0, #fefcbf); border-left: 4px solid #d69e2e; }
.node.contact { background: linear-gradient(135deg, #fff5f7, #fed7e2); border-left: 4px solid #d53f8c; }
.node.pts { background: linear-gradient(135deg, #e6fffa, #b2f5ea); border-left: 4px solid #319795; }

/* Priority Indicators */
.priority-critical { border-left-color: #e53e3e !important; }
.priority-high { border-left-color: #dd6b20 !important; }
.priority-medium { border-left-color: #d69e2e !important; }
.priority-standard { border-left-color: #718096 !important; }

/* Expansion Controls */
.node-expand-btn {
  position: absolute;
  bottom: -12px;
  left: 50%;
  transform: translateX(-50%);
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: var(--pts-navy);
  color: white;
  font-size: 14px;
  cursor: pointer;
}

.node-expand-btn:hover {
  background: var(--pts-blue);
}
```

### 3.3 Node Content Structure

```html
<!-- Job Node Example -->
<div class="node job priority-critical selected">
  <div class="node-header">
    <span class="node-icon">🎯</span>
    <span class="node-type">JOB</span>
    <span class="bd-score">83</span>
  </div>
  <div class="node-title">Systems Administrator</div>
  <div class="node-subtitle">Fort Belvoir, VA</div>
  <div class="node-tags">
    <span class="tag clearance">TS/SCI w/ Poly</span>
    <span class="tag priority">🔴 Critical</span>
  </div>
  <button class="node-expand-btn" title="Expand connections">+</button>
</div>

<!-- Contact Node Example -->
<div class="node contact priority-high">
  <div class="node-header">
    <span class="node-icon">👤</span>
    <span class="node-type">CONTACT</span>
    <span class="tier-badge">T3</span>
  </div>
  <div class="node-title">Jeffrey Bartsch</div>
  <div class="node-subtitle">Ops Manager</div>
  <div class="node-tags">
    <span class="tag program">Army DCGS-A</span>
    <span class="tag priority">🟠 High</span>
  </div>
  <button class="node-expand-btn">+</button>
</div>
```

### 3.4 Connection Lines (Edges)

```css
/* Edge Styles */
.edge {
  stroke: var(--pts-gray-400);
  stroke-width: 2;
  fill: none;
}

.edge.highlighted {
  stroke: var(--pts-blue);
  stroke-width: 3;
}

.edge.relationship-strong {
  stroke-dasharray: none;
}

.edge.relationship-weak {
  stroke-dasharray: 5, 5;
}

/* Relationship Labels */
.edge-label {
  font-size: 10px;
  fill: var(--pts-gray-600);
  background: white;
  padding: 2px 4px;
}
```

### 3.5 Note Panel (Detail View)

```
┌─────────────────────────────────────┐
│ 🎯 JOB: Systems Administrator       │
│ ═══════════════════════════════════ │
│                                     │
│ 📊 BD SCORE: 83                     │
│ 🎯 PRIORITY: 🔴 Critical            │
│                                     │
│ ──────── DETAILS ────────           │
│ 📍 Location: Fort Belvoir, VA       │
│ 🔐 Clearance: TS/SCI w/ Poly        │
│ 💼 Type: Contract                   │
│ 💰 Rate: N/A                        │
│ 📅 Posted: 2025-10-20               │
│                                     │
│ ──────── PROGRAM ────────           │
│ 📋 Army DCGS-A / INSCOM             │
│ 🏢 Prime: GDIT                      │
│ 🏛️ Customer: INSCOM / PEO IEW&S    │
│                                     │
│ ──────── KEY CONTACTS ────────      │
│ 👤 Hiring: Jeffrey Bartsch (T4)     │
│ 👤 PM: Rebecca Gunning (T3)         │
│ 👤 Team: Joaquin Gonzalez (T5)      │
│                                     │
│ ──────── BD FORMULA ────────        │
│ 📝 Opener:                          │
│ "Given your work managing ops for   │
│ INSCOM's DCGS-A program at Fort     │
│ Belvoir..."                         │
│                                     │
│ 🎯 Pain Point:                      │
│ "I understand the program faces     │
│ surge staffing challenges..."       │
│                                     │
│ 💼 PTS Alignment:                   │
│ "PTS has placed TS/SCI sys admins   │
│ on similar INSCOM programs..."      │
│                                     │
│ ──────── ACTIONS ────────           │
│ [📞 Call Hiring Mgr] [📧 Email]     │
│ [🔗 Open LinkedIn] [📋 Copy All]    │
│ [➕ Add to Call Sheet]              │
└─────────────────────────────────────┘
```

### 3.6 Layout Algorithms

```typescript
// Available layout modes
enum LayoutMode {
  RADIAL = 'radial',        // Nodes radiate from center
  HIERARCHICAL = 'hierarchical', // Top-down tree
  FORCE_DIRECTED = 'force',  // Physics-based spreading
  CIRCULAR = 'circular',     // Nodes on concentric circles
  GRID = 'grid',            // Organized grid
  CUSTOM = 'custom'         // User-arranged
}

// Auto-layout configuration
const layoutConfig = {
  radial: {
    startAngle: 0,
    endAngle: 2 * Math.PI,
    tierSpacing: 150,       // Distance between tiers
    nodeSpacing: 80,        // Minimum distance between nodes
    centerForce: 0.5        // Pull toward center
  },
  hierarchical: {
    direction: 'TB',        // Top-to-bottom
    levelSpacing: 100,
    nodeSpacing: 60,
    alignment: 'center'
  },
  force: {
    linkDistance: 100,
    chargeStrength: -300,
    collisionRadius: 50,
    alpha: 0.3
  }
};
```

---

## Part 4: Interaction Behaviors

### 4.1 Node Interactions

| Action | Behavior |
|--------|----------|
| **Single Click** | Select node → Show details in Note Panel |
| **Double Click** | Expand/collapse child nodes |
| **Right Click** | Context menu (Expand All, Collapse, Hide, Focus, Export) |
| **Drag** | Reposition node (manual layout) |
| **Hover** | Highlight connected edges, show tooltip |
| **Shift+Click** | Multi-select (for bulk operations) |

### 4.2 Canvas Interactions

| Action | Behavior |
|--------|----------|
| **Scroll** | Zoom in/out |
| **Click+Drag Background** | Pan canvas |
| **Cmd/Ctrl+0** | Reset zoom to fit all |
| **Cmd/Ctrl+F** | Open search |
| **Escape** | Deselect all, close panels |

### 4.3 Expansion Controls

```typescript
interface ExpansionBehavior {
  // Click + button to expand one tier
  singleExpand: boolean;
  
  // Double-click to expand all tiers
  fullExpand: boolean;
  
  // Auto-expand on load
  autoExpandTiers: number; // 0 = none, 1 = tier 1 only, etc.
  
  // Progressive loading
  loadOnDemand: boolean;
  maxNodesPerTier: number;
  
  // Animation
  expandAnimation: 'spring' | 'ease' | 'none';
  animationDuration: number; // ms
}
```

### 4.4 Context Menu Options

```
┌─────────────────────────────────────┐
│ 📋 Systems Administrator             │
│ ─────────────────────────────────── │
│ ▶ Expand All Connections            │
│ ▼ Collapse                          │
│ ─────────────────────────────────── │
│ 🎯 Set as Native Node               │
│ 🔍 Focus (Hide Others)              │
│ 👁️ Show Only This Type             │
│ 🙈 Hide This Node                   │
│ ─────────────────────────────────── │
│ 📋 Copy Details                     │
│ 🔗 Copy LinkedIn URL                │
│ 📧 Copy Email                       │
│ ─────────────────────────────────── │
│ ➕ Add to Call Sheet                │
│ 📤 Export This Branch               │
└─────────────────────────────────────┘
```

### 4.5 Node Attachments (XMind Behaviors)

Each node supports attachments that provide additional context, actions, and metadata. These mirror XMind's Insert menu capabilities.

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                          NODE ATTACHMENT TYPES                                       │
├──────────────┬───────────────────────────────────────────────────────────────────────┤
│ Attachment   │ Description & BD Use Case                                            │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 📝 Note      │ Rich text annotation attached to any node. Auto-generated for        │
│              │ contacts (BD Formula), jobs (requirements), programs (intel).        │
│              │ User-editable. Appears in Note Panel when node selected.             │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ ✅ To-Do     │ Checkbox task attached to node. BD use: "Follow up after AFCEA",     │
│              │ "Send intro email", "Research this program". Status: ☐/☑.            │
│              │ Syncs to Daily Playbook's action items.                              │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 📋 Task      │ Full task with due date, assignee, priority. BD use: "Call Jeffrey   │
│              │ Bartsch by Friday", "Prepare HUMINT briefing for PACAF site".        │
│              │ Creates entry in BD Action Plan. Due date + owner + status.          │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 🔗 Hyperlink │ External URL attachment. Auto-populated: LinkedIn profiles, job      │
│              │ posting URLs, program websites, USASpending links, GovWin intel.     │
│              │ User can add custom links (competitor intel, news articles).         │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 💬 Callout   │ Highlighted annotation bubble pointing to node. BD use: flag         │
│              │ critical insights ("PAIN POINT: Single point of failure"),           │
│              │ warnings ("Contract ends Nov 2026"), opportunities ("Hiring 5+").    │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 🏷️ Label    │ Colored tag/badge on node. System labels: BD Priority (🔴🟠🟡⚪),     │
│              │ Tier (T1-T6), Program branch, PTS involvement status.                │
│              │ User labels: Custom tags like "Met at AFCEA", "Warm contact".        │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 💭 Comment   │ Threaded discussion on node. BD use: team collaboration -            │
│              │ "I spoke with Jeffrey 1/10, he mentioned budget issues".             │
│              │ Multiple comments per node. Timestamped with author.                 │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 🖼️ Image    │ Visual attachment. BD use: org charts, headshots (from LinkedIn),    │
│              │ facility photos, conference booth layouts, whiteboard notes.         │
│              │ Thumbnail on node, full view in Note Panel.                          │
├──────────────┼───────────────────────────────────────────────────────────────────────┤
│ 🔢 Equation  │ Calculated field display. BD use: BD Score formulas, contract        │
│              │ value calculations, placement probability, revenue potential.        │
│              │ Example: Revenue = Bill Rate × 2080 × 0.25 margin                    │
└──────────────┴───────────────────────────────────────────────────────────────────────┘
```

#### Attachment Data Schema

```typescript
interface NodeAttachment {
  id: string;
  nodeId: string;
  type: AttachmentType;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  
  // Type-specific data
  data: NoteData | ToDoData | TaskData | HyperlinkData | 
        CalloutData | LabelData | CommentData | ImageData | EquationData;
}

interface NoteData {
  content: string;           // Rich text (markdown supported)
  isAutoGenerated: boolean;  // True for BD Formula, job details, etc.
  source?: string;           // If auto-generated, what generated it
}

interface ToDoData {
  text: string;
  completed: boolean;
  completedAt?: Date;
  completedBy?: string;
}

interface TaskData {
  title: string;
  description?: string;
  dueDate?: Date;
  assignee?: string;
  priority: 'urgent' | 'high' | 'normal' | 'low';
  status: 'not_started' | 'in_progress' | 'completed' | 'blocked';
  linkedPlaybookItem?: string;  // ID in Daily Playbook
}

interface HyperlinkData {
  url: string;
  title: string;
  icon?: string;             // Auto-detected: LinkedIn, GovWin, USASpending
  isAutoGenerated: boolean;  // True for profile links, job URLs
}

interface CalloutData {
  text: string;
  type: 'info' | 'warning' | 'opportunity' | 'pain_point' | 'critical';
  color: string;             // Override color if needed
  position: 'top' | 'right' | 'bottom' | 'left';
}

interface LabelData {
  text: string;
  color: string;
  isSystemLabel: boolean;    // BD Priority, Tier, etc.
  category?: string;         // For grouping custom labels
}

interface CommentData {
  text: string;
  author: string;
  timestamp: Date;
  parentCommentId?: string;  // For threaded replies
}

interface ImageData {
  url: string;
  thumbnailUrl: string;
  alt: string;
  width: number;
  height: number;
  source?: string;           // LinkedIn, uploaded, scraped
}

interface EquationData {
  formula: string;           // LaTeX or plain text formula
  variables: Record<string, number | string>;
  result: number | string;
  displayFormat: string;     // How to show the result
}
```

#### Attachment Visual Indicators

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        NODE WITH ATTACHMENTS                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────┐          │
│    │  👤 CONTACT                           📝💬🔗                │← Icons   │
│    │  ══════════════════════════════════════════════════════════ │  show    │
│    │  Jeffrey Bartsch                    [T4] [🟠 High]          │  attach- │
│    │  Ops Manager, Army DCGS-A                                   │  ments   │
│    │  ──────────────────────────────────────────────────────────│          │
│    │  📍 Fort Belvoir  🔐 TS/SCI                                 │          │
│    │                                                             │          │
│    │  [+]                                                        │          │
│    └─────────────────────────────────────────────────────────────┘          │
│                          │                                                  │
│                          │                                                  │
│    ┌─────────────────────▼─────────────────────────────┐                    │
│    │ 💬 CALLOUT (Pain Point)                           │                    │
│    │ ─────────────────────────────────────────────────│                    │
│    │ "Site has no backup for network admin role -     │                    │
│    │  Kingsley is wearing multiple hats"              │                    │
│    └───────────────────────────────────────────────────┘                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

#### Attachment Icons Legend

| Icon | Type | Appears When |
|------|------|--------------|
| 📝 | Note | Note attachment exists (auto or manual) |
| ✅ | To-Do | One or more to-do items |
| ☑️ | To-Do (done) | All to-dos completed |
| 📋 | Task | Task with due date assigned |
| ⚠️ | Task (overdue) | Task past due date |
| 🔗 | Hyperlink | External links attached |
| 💬 | Callout | Visual callout present |
| 🏷️ | Label | Custom user labels (system labels shown inline) |
| 💭 | Comment | Discussion thread exists |
| 🖼️ | Image | Image attachment |
| 🔢 | Equation | Calculated field |

#### Insert Attachment UI

Right-click context menu includes:

```
┌─────────────────────────────────────┐
│ + Insert...                        │
│ ├── 📝 Note                        │
│ ├── ✅ To-Do                       │
│ ├── 📋 Task                        │
│ ├── 🔗 Hyperlink                   │
│ ├── 💬 Callout                     │
│ ├── 🏷️ Label                      │
│ ├── 💭 Comment                     │
│ ├── 🖼️ Image                      │
│ └── 🔢 Equation                    │
└─────────────────────────────────────┘
```

Keyboard shortcuts:
| Shortcut | Action |
|----------|--------|
| `N` | Add Note to selected node |
| `T` | Add To-Do |
| `Shift+T` | Add Task |
| `Ctrl+K` | Add Hyperlink |
| `C` | Add Callout |
| `L` | Add Label |
| `/` | Add Comment |

---

## Part 4.6: BD Intelligence Data Flow

### The Complete Data Pipeline: Sources → Intelligence → BD Playbook

This section clarifies how all data categories interconnect to produce actionable BD output.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    BD INTELLIGENCE DATA FLOW                                        │
│                          From Raw Data Sources to Actionable BD Playbook                           │
└─────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 1: DATA SOURCES (Raw Collection)                                                               │
├────────────────────────┬─────────────────────────┬──────────────────────────┬─────────────────────────┤
│ 🎯 JOBS               │ 🏢 CLIENTS (Primes)     │ 📋 PROGRAMS              │ 👤 CONTACTS             │
│ ─────────────────────  │ ─────────────────────── │ ────────────────────────  │ ───────────────────────│
│ Sources:              │ Sources:                │ Sources:                 │ Sources:               │
│ • Apex Systems scrape │ • USASpending           │ • USASpending           │ • ZoomInfo             │
│ • Insight Global      │ • GovWin                │ • GovWin                │ • LinkedIn Sales Nav    │
│ • TEKsystems          │ • FPDS                  │ • FPDS                  │ • Conference lists     │
│ • Direct postings     │ • SEC filings           │ • Agency websites       │ • Manual research      │
│ • GDIT Bullhorn       │ • News/press            │ • Contract awards       │ • HUMINT gathering     │
│                       │                         │ • Project knowledge     │                        │
│ Fields Captured:      │ Fields Captured:        │ Fields Captured:        │ Fields Captured:       │
│ • Title               │ • Company name          │ • Program name/acronym  │ • Name, title          │
│ • Location            │ • Contract awards       │ • Agency owner          │ • Email, phone         │
│ • Clearance           │ • Program portfolio     │ • Prime/subs            │ • LinkedIn             │
│ • URL                 │ • Locations             │ • Contract value        │ • Location             │
│ • Posted date         │ • Key personnel         │ • Period of performance │ • Company              │
│ • Employment type     │ • Financials            │ • Locations             │ • Department           │
└────────────────────────┴─────────────────────────┴──────────────────────────┴─────────────────────────┘
                                                   │
                                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 2: INTELLIGENCE MAPPING (Enrichment & Correlation)                                            │
├─────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                       │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │  PROGRAM MAPPING ENGINE                                                                          │ │
│   │  ─────────────────────────────────────────────────────────────────────────────────────────────── │ │
│   │  Jobs + Location + Clearance + Keywords → Mapped to Program                                      │ │
│   │  Algorithm: Location match (70%) + Keyword match (20%) + Clearance alignment (10%)               │ │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                        │
│                                              ▼                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │  CONTACT CLASSIFICATION ENGINE                                                                   │ │
│   │  ─────────────────────────────────────────────────────────────────────────────────────────────── │ │
│   │  Contact Title + Location + Company → Hierarchy Tier + Program Assignment + BD Priority          │ │
│   │  Output: Tier 1-6, Program (AF DCGS-Langley, etc.), BD Priority (Critical/High/Medium/Standard)  │ │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                        │
│                                              ▼                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │  RELATIONSHIP INFERENCE ENGINE                                                                   │ │
│   │  ─────────────────────────────────────────────────────────────────────────────────────────────── │ │
│   │  GENERATES:                                                                                      │ │
│   │  • Job → Program (which program is this job for?)                                                │ │
│   │  • Job → Contact (who is the hiring manager? team leads?)                                        │ │
│   │  • Contact → Program (what program do they work on?)                                             │ │
│   │  • Contact → Task Order (which task order within the program?)                                   │ │
│   │  • Contact → Team (what team are they on?)                                                       │ │
│   │  • Program → Prime (who runs this program?)                                                      │ │
│   │  • Program → Locations (where does this program operate?)                                        │ │
│   │  • Location → Jobs (what jobs are at this location?)                                             │ │
│   │  • Location → Contacts (who is based here?)                                                      │ │
│   │  • BD Event → Primes attending                                                                   │ │
│   │  • BD Event → Programs being discussed                                                           │ │
│   │  • BD Event → Contacts likely to attend                                                          │ │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
│                                              │                                                        │
│                                              ▼                                                        │
│   ┌─────────────────────────────────────────────────────────────────────────────────────────────────┐ │
│   │  DERIVED INTELLIGENCE FIELDS                                                                     │ │
│   │  ─────────────────────────────────────────────────────────────────────────────────────────────── │ │
│   │                                                                                                  │ │
│   │  FOR JOBS:                           FOR CONTACTS:                    FOR PROGRAMS:              │ │
│   │  • BD Score (0-100)                  • Hierarchy Tier (T1-T6)         • Hiring Velocity          │ │
│   │  • Mapped Program                    • BD Priority                     • Open Positions Count    │ │
│   │  • Inferred Task Order               • Location Hub                   • Pain Point Indicators   │ │
│   │  • Hiring Manager                    • Functional Area                • Contract Timeline        │ │
│   │  • Team Contacts                     • Outreach Stage                 • Staffing Firm Activity  │ │
│   │  • Related Past Performance          • HUMINT Notes                   • PTS Involvement Status  │ │
│   │  • Matching PTS Contractors          • BD Formula (generated)         • BD Opportunity Score    │ │
│   │                                                                                                  │ │
│   │  FOR LOCATIONS:                      FOR BD EVENTS:                   FOR PRIMES:                │ │
│   │  • Job Count                         • Target Contact List            • Program Portfolio        │ │
│   │  • Contact Count by Tier             • Primes Attending               • Total Contract Value     │ │
│   │  • Program Presence                  • Programs in Focus              • Hiring Activity          │ │
│   │  • Clearance Distribution            • Pre-Event Prep Plan            • PTS Relationship Status │ │
│   │  • PTS Positioning                   • Post-Event Follow-ups          • Key Contacts             │ │
│   └─────────────────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                                   │
                                                   ▼
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ LAYER 3: BD PLAYBOOK OUTPUT (Actionable Deliverables)                                                │
├───────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                       │
│   All intelligence converges into these BD action outputs:                                           │
│                                                                                                       │
│   ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐  ┌───────────────────┐          │
│   │ 📞 CALL SHEETS    │  │ 📖 BD PLAYBOOKS   │  │ 🗺️ MIND MAPS     │  │ 📅 DAILY PLAYBOOK │          │
│   │ ──────────────────│  │ ──────────────────│  │ ──────────────────│  │ ──────────────────│          │
│   │ Priority contacts │  │ Program deep      │  │ Visual exploration│  │ Today's actions   │          │
│   │ with:             │  │ dives with:       │  │ of relationships  │  │ with:             │          │
│   │ • Phone/Email     │  │ • Pain points     │  │ starting from:    │  │ • Calls to make   │          │
│   │ • Personalized    │  │ • Labor gaps      │  │ • Any Job         │  │ • Emails to send  │          │
│   │   talking points  │  │ • Contact profiles│  │ • Any Program     │  │ • Events prep     │          │
│   │ • Program context │  │ • PTS alignment   │  │ • Any Contact     │  │ • Follow-ups      │          │
│   │ • Jobs to mention │  │ • Action plan     │  │ • Any BD Event    │  │ • Research tasks  │          │
│   │ • BD Formula      │  │ • HUMINT strategy │  │ • Any Location    │  │ • Pipeline status │          │
│   └───────────────────┘  └───────────────────┘  └───────────────────┘  └───────────────────┘          │
│             │                    │                       │                      │                    │
│             └────────────────────┴───────────────────────┴──────────────────────┘                    │
│                                                │                                                      │
│                                                ▼                                                      │
│                              ┌─────────────────────────────────────────┐                              │
│                              │       🎯 BD FORMULA OUTPUT             │                              │
│                              │       (Per Contact/Job)                 │                              │
│                              │ ───────────────────────────────────────│                              │
│                              │  1. Personalized Message                │                              │
│                              │  2. Current Pain Points                 │                              │
│                              │  3. Labor Gaps & Open Jobs              │                              │
│                              │  4. PTS Past Performance with Client    │                              │
│                              │  5. Relevant Past Performance to Program│                              │
│                              │  6. Past Performance Relevant to Role   │                              │
│                              └─────────────────────────────────────────┘                              │
│                                                                                                       │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

### Relationship Logic Summary

```yaml
# Core Relationship Chains for BD Intelligence

JOB_RELATIONSHIPS:
  immediate: # Auto-loaded
    - program: "Job.location + clearance + keywords → Federal Programs match"
    - location: "Job.location → Location entity"
    - hiring_manager: "Job.program + location → Contact WHERE role = hiring_authority"
  derived: # Inferred from immediate
    - prime: "Job.program → Program.prime_contractor"
    - task_order: "Job.program + location → TaskOrder WHERE location matches"
    - team: "Job.task_order → Team"
    - team_contacts: "Job.team → Team.members"
    - program_leadership: "Job.program → Contacts WHERE tier IN [1,2,3]"
  pts_alignment: # PTS-specific
    - past_performance: "Job.skills + clearance → PTS_PP WHERE skills overlap"
    - matching_contractors: "Job.requirements → PTS_Contractors WHERE qualified"

CONTACT_RELATIONSHIPS:
  immediate:
    - employer: "Contact.company → Prime OR Subcontractor"
    - location: "Contact.city → Location entity"
    - program: "Contact.location + company → Program WHERE location + prime matches"
  derived:
    - task_order: "Contact.program + location → TaskOrder"
    - team: "Contact.task_order → Team WHERE same location"
    - hierarchy: "Contact.title → Hierarchy Tier classification"
    - reports_to: "Contact.team → Contact WHERE tier < this.tier"
    - direct_reports: "Contact.team → Contacts WHERE tier > this.tier"
  bd_intelligence:
    - hiring_authority_for: "Contact → Jobs WHERE this is hiring manager"
    - pain_points: "Contact.program + location → Known pain points"
    - bd_priority: "Contact.tier + program → Priority calculation"

PROGRAM_RELATIONSHIPS:
  immediate:
    - prime: "Program.prime_contractor → Prime entity"
    - customer: "Program.agency_owner → Customer entity"
    - locations: "Program.key_locations → Location entities"
  derived:
    - subcontractors: "Program → Known subs from contract data"
    - task_orders: "Program → TaskOrders (inferred from contact clusters)"
    - teams: "Program.task_orders → Teams"
    - contacts: "Program.locations → Contacts WHERE location matches"
    - jobs: "Program → Jobs WHERE mapped_to_program = this"
  analytics:
    - hiring_velocity: "Program.jobs.count / time_period"
    - staffing_gaps: "Program.jobs WHERE unfilled > 30 days"
    - pain_points: "Aggregated from HUMINT + job analysis"

BD_EVENT_RELATIONSHIPS:
  immediate:
    - location: "Event.venue → Location entity"
    - primes_attending: "Event → Primes WHERE typically attends OR registered"
  derived:
    - programs: "Event.focus_areas + primes → Programs alignment"
    - contacts: "Event.programs → Program contacts likely to attend"
  bd_preparation:
    - target_list: "Event.contacts → Prioritized by BD_Priority"
    - talking_points: "Event.contacts → Per-contact BD Formula"
    - follow_up_plan: "Post-event action items"
```

---

## Part 5: Data Loading & Performance

### 5.1 Progressive Loading Strategy

```typescript
interface LoadingStrategy {
  // Initial load
  initialTiers: number; // Load first N tiers immediately
  
  // Pagination
  nodesPerTier: number; // Max nodes to load per expansion
  loadMoreThreshold: number; // Show "Load More" after this many
  
  // Caching
  cacheExpiry: number; // Minutes before refetching
  prefetch: boolean; // Prefetch likely expansions on hover
  
  // Performance
  maxVisibleNodes: number; // Beyond this, auto-collapse distant
  virtualizeEdges: boolean; // Don't render edges for collapsed
}

const defaultStrategy: LoadingStrategy = {
  initialTiers: 1,
  nodesPerTier: 20,
  loadMoreThreshold: 15,
  cacheExpiry: 30,
  prefetch: true,
  maxVisibleNodes: 100,
  virtualizeEdges: true
};
```

### 5.2 Data Fetch Patterns

```typescript
// Fetch node expansion data
async function expandNode(nodeId: string, nodeType: NodeType, tier: number): Promise<NodeData[]> {
  const config = getExpansionConfig(nodeType, tier);
  const relationships = config.relationships;
  
  const fetches = relationships.map(rel => 
    fetchRelatedNodes(nodeId, rel.relationship, rel.filter, rel.limit)
  );
  
  const results = await Promise.all(fetches);
  return results.flat();
}

// Batch fetch for performance
async function batchFetchNodes(nodeIds: string[]): Promise<Map<string, NodeData>> {
  // Single API call for multiple nodes
  const response = await api.post('/nodes/batch', { ids: nodeIds });
  return new Map(response.data.map(n => [n.id, n]));
}
```

---

## Part 6: Export Formats

### 6.1 OPML Export (for XMind)

```xml
<?xml version="1.0" encoding="UTF-8"?>
<opml version="1.0">
  <head>
    <title>BD Intelligence Mind Map - Job: Systems Administrator</title>
    <dateCreated>2026-01-13T12:00:00Z</dateCreated>
  </head>
  <body>
    <outline text="🎯 Systems Administrator" _note="Location: Fort Belvoir, VA&#10;Clearance: TS/SCI w/ Poly&#10;BD Score: 83&#10;Priority: Critical">
      <outline text="📋 Army DCGS-A / INSCOM" _note="Contract Value: $300M&#10;Prime: GDIT">
        <outline text="🏢 GDIT" _note="Programs: 3&#10;Relationship: Prime">
          <outline text="👤 Jeffrey Bartsch" _note="Title: Ops Manager&#10;Tier: 4&#10;Email: jeffrey.bartsch@gdit.com&#10;Phone: (555) 123-4567&#10;LinkedIn: linkedin.com/in/..."/>
        </outline>
        <outline text="📦 DCGS-A / INSCOM Task Order">
          <outline text="👥 Fort Belvoir Team">
            <outline text="👤 Joaquin Gonzalez" _note="Title: National Security Analyst&#10;Tier: 5"/>
          </outline>
        </outline>
      </outline>
      <outline text="📍 Fort Belvoir, VA" _note="Facility: Army Post&#10;Jobs: 8&#10;Contacts: 23"/>
      <outline text="🎖️ PTS Past Performance">
        <outline text="BICES/BICES-X" _note="TS/SCI Network Engineers&#10;Norfolk, Tampa, Europe"/>
      </outline>
    </outline>
  </body>
</opml>
```

### 6.2 JSON Export

```json
{
  "mindMap": {
    "nativeNode": {
      "type": "JOB",
      "id": "job_3009212",
      "title": "Systems Administrator",
      "data": { ... }
    },
    "nodes": [
      { "id": "prog_dcgsa", "type": "PROGRAM", "data": { ... } },
      { "id": "prime_gdit", "type": "PRIME", "data": { ... } },
      { "id": "contact_bartsch", "type": "CONTACT", "data": { ... } }
    ],
    "edges": [
      { "source": "job_3009212", "target": "prog_dcgsa", "relationship": "mapped_to" },
      { "source": "prog_dcgsa", "target": "prime_gdit", "relationship": "run_by" }
    ],
    "layout": {
      "mode": "radial",
      "positions": { ... }
    },
    "metadata": {
      "exportDate": "2026-01-13T12:00:00Z",
      "version": "1.0"
    }
  }
}
```

### 6.3 PNG/SVG Export

- High-resolution canvas export
- Include legend
- Optional: Note panel sidebar
- Configurable: Show/hide node details

---

## Part 7: Implementation Architecture

### 7.1 Technology Stack

```yaml
Frontend:
  framework: React 18+
  graph_library: D3.js + react-force-graph OR vis-network OR Cytoscape.js
  state_management: Zustand (lightweight) or Redux Toolkit
  styling: Tailwind CSS + custom graph styles
  
Performance:
  virtualization: react-window for large node lists
  web_workers: Offload layout calculations
  canvas_rendering: HTML5 Canvas for large graphs (>500 nodes)
  
Export:
  opml: xmlbuilder2
  png/svg: html-to-image
  json: native
```

### 7.2 Component Structure

```
src/
├── components/
│   └── mindmap/
│       ├── MindMapCanvas.tsx         # Main graph container
│       ├── MindMapNode.tsx           # Individual node component
│       ├── MindMapEdge.tsx           # Connection line component
│       ├── NotePanel.tsx             # Detail panel
│       ├── NativeNodeTabs.tsx        # Tab selector
│       ├── ControlBar.tsx            # Search, filters, export
│       ├── ContextMenu.tsx           # Right-click menu
│       └── MiniMap.tsx               # Navigation overview
│
├── hooks/
│   ├── useMindMapData.ts             # Data fetching & caching
│   ├── useMindMapLayout.ts           # Layout calculations
│   ├── useMindMapSelection.ts        # Selection state
│   └── useMindMapExport.ts           # Export functions
│
├── stores/
│   └── mindMapStore.ts               # Zustand store
│
├── configs/
│   ├── nativeNodeConfigs.ts          # All native node configurations
│   └── layoutConfigs.ts              # Layout algorithm configs
│
├── utils/
│   ├── graphUtils.ts                 # Graph manipulation helpers
│   ├── exportUtils.ts                # OPML, JSON, image export
│   └── bdFormulaGenerator.ts         # Generate BD messaging
│
└── data/
    └── mindMapData.json              # Pre-processed relationship data
```

### 7.3 State Model

```typescript
interface MindMapState {
  // Configuration
  nativeNodeType: NodeType;
  nativeNodeId: string;
  layoutMode: LayoutMode;
  
  // Graph data
  nodes: Map<string, NodeData>;
  edges: Edge[];
  expandedNodes: Set<string>;
  
  // Selection
  selectedNodeId: string | null;
  multiSelectedIds: Set<string>;
  hoveredNodeId: string | null;
  
  // View
  zoom: number;
  panOffset: { x: number; y: number };
  filterByType: NodeType[] | null;
  searchQuery: string;
  
  // Actions
  setNativeNode: (type: NodeType, id: string) => void;
  expandNode: (nodeId: string) => Promise<void>;
  collapseNode: (nodeId: string) => void;
  selectNode: (nodeId: string) => void;
  updateLayout: (mode: LayoutMode) => void;
  exportGraph: (format: ExportFormat) => Promise<void>;
}
```

---

## Part 8: Auto Claude Task Specifications

### Task: Mind Map Data Processor

```markdown
## Task: Mind Map Data Correlation Engine

### Input Files
- /mnt/project/jobs_fully_enriched.csv (127 jobs with full relationships)
- /mnt/project/DCGS_Contact_Spreadsheet__391_120925_PERSON.csv (967 contacts)
- /mnt/project/Federal_Program_Cleaned_Notion_Import.csv (388 programs)
- BD Events from system handoff document

### Output
- mindmap_nodes.json (all entities as nodes)
- mindmap_edges.json (all relationships)
- native_node_configs.json (expansion configurations)

### Processing Steps
1. Load all source data
2. Create node records for each entity type
3. Generate unique IDs (type_sourceId format)
4. Build relationship edges by matching:
   - Job → Program (by Program field)
   - Job → Contact (by Hiring Manager, Team Contacts fields)
   - Job → Location (by Location field parsing)
   - Program → Prime (by Prime Contractor field)
   - Program → Location (by Key Locations field)
   - Contact → Program (by location + company matching)
   - Contact → Location (by City, State fields)
5. Calculate derived fields:
   - contact_count per location
   - job_count per location
   - bd_score aggregations
6. Output JSON files

### Schema Compliance
- Follow node schemas defined in Part 1.3
- Follow edge schema: { source, target, relationship, weight }
```

### Task: Mind Map React Component

```markdown
## Task: Interactive Mind Map Component

### Dependencies
- react-force-graph-2d (or cytoscape-react)
- @radix-ui/react-context-menu
- zustand
- tailwindcss

### Implementation
1. Create MindMapCanvas component with D3 force simulation
2. Implement node components with type-specific styling
3. Build expansion system (click + button to load children)
4. Create NotePanel with entity-specific detail views
5. Implement NativeNodeTabs for switching focus
6. Add export functionality (OPML, JSON, PNG)
7. Implement search and filter controls

### Performance Requirements
- Handle 500+ nodes smoothly
- Progressive loading (max 20 nodes per expansion)
- Canvas rendering for >500 nodes

### Styling
- Follow PTS design system from PTS_BD_Design_SKILL.md
- Use priority color coding for BD relevance
- Use program colors for branch identification
```

---

## Part 9: Example Scenarios

### Scenario 1: Pre-Conference Research

**Goal:** Prepare for AFCEA West 2026 - identify all relevant contacts, programs, and talking points.

1. Select **BD Event** as Native Node
2. Search for "AFCEA West 2026"
3. Auto-expand Tier 1: See attending Primes (GDIT, BAE, Leidos)
4. Expand GDIT node → See relevant Programs (Navy DCGS-N, BICES)
5. Expand Navy DCGS-N → See Task Orders, Locations (Norfolk, San Diego)
6. Expand Norfolk → See Contacts (Dusty Galbraith PM, team members)
7. Select Dusty Galbraith → Note Panel shows:
   - Contact details
   - Known pain points
   - Active jobs they're hiring for
   - BD Formula talking points
   - PTS past performance to mention
8. Export to Call Sheet

### Scenario 2: Job Opportunity Deep Dive

**Goal:** A Critical job appeared in San Diego. Map everything about it.

1. Select **Job** as Native Node
2. Search for "San Diego TS/SCI"
3. Select "Secret Cleared Technical Writer" job
4. See immediate context:
   - Program: AF DCGS - PACAF / Navy DCGS-N
   - Location: PACAF San Diego Node
   - Hiring Manager: Kingsley Ero (Acting)
5. Expand Program → See:
   - Prime: BAE Systems / GDIT
   - Customer: PACAF / NAVSEA
   - Contract Value: ~$500M
6. Expand Location → See:
   - All 8 other jobs at this site
   - 15 contacts based here
   - PTS past performance in San Diego area
7. Expand Contacts → See team structure
8. Note Panel generates complete BD Formula message
9. Add Kingsley Ero to priority call list

### Scenario 3: Location-Based Campaign

**Goal:** Build a Norfolk outreach campaign - all contacts, jobs, and programs.

1. Select **Location** as Native Node
2. Search for "Norfolk"
3. See aggregated view:
   - 3 Programs operating here
   - 25 active jobs
   - 47 contacts based here
   - PTS has 12 past placements here
4. Expand by Program:
   - Navy DCGS-N / BICES
   - GCCS-J
5. See contacts grouped by:
   - Hierarchy Tier (Executives → ICs)
   - BD Priority (🔴 → ⚪)
6. Build targeted campaign:
   - Start with Tier 5-6 for HUMINT
   - Progress to Tier 3-4 with intelligence
   - Approach Tier 1-2 with full context
7. Export entire Norfolk branch to playbook

---

## Part 10: Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Exploration Depth** | 5+ tiers deep | Track expansion events |
| **Node Discovery** | 10+ new connections per session | Count newly viewed nodes |
| **Time to Insight** | <2 min from search to BD Formula | Session timing |
| **Export Usage** | 80%+ sessions include export | Track export events |
| **Cross-Entity Navigation** | 3+ entity types explored | Track native node switches |
| **Performance** | <200ms expansion | Measure load times |
| **User Satisfaction** | Reduces research time by 75% | User feedback |

---

## Appendix A: Full Relationship Definitions

### Job Relationships
```yaml
JOB:
  mapped_to: PROGRAM         # Job → Program mapping
  located_at: LOCATION       # Physical job location
  posted_by: PRIME           # Who posted/owns the job
  under: TASK_ORDER          # Task order job falls under
  hiring_manager: CONTACT    # Who is hiring for this role
  team_contacts: CONTACT[]   # Team members who might know candidate
  program_leadership: CONTACT[] # PMs and leadership
  functional_area: FUNC_AREA # Job function category
  clearance_required: CLEARANCE
  skills_match: PTS_CONTRACTOR[] # PTS people who could fill
  relevant_pp: PTS_PP[]      # Relevant PTS past performance
```

### Program Relationships
```yaml
PROGRAM:
  run_by: PRIME              # Prime contractor
  owned_by: CUSTOMER         # Government customer
  has_subcontractors: SUBCONTRACTOR[]
  has_task_orders: TASK_ORDER[]
  operates_at: LOCATION[]    # Key locations
  has_jobs: JOB[]           # Active job postings
  staffed_by: CONTACT[]      # Known personnel
  discussed_at: BD_EVENT[]   # Events covering this program
  pts_history: PTS_PP[]      # PTS involvement
  requires: CLEARANCE[]      # Clearance requirements
  covers: FUNC_AREA[]        # Functional areas
```

### Contact Relationships
```yaml
CONTACT:
  employed_by: PRIME
  works_on: PROGRAM
  assigned_to: TASK_ORDER
  member_of: TEAM
  based_in: LOCATION
  reports_to: CONTACT        # Supervisor
  manages: CONTACT[]         # Direct reports
  peers: CONTACT[]           # Same team/level
  hiring_for: JOB[]          # Jobs they can fill
  may_attend: BD_EVENT[]     # Events they might attend
  knows: PTS_CONTRACTOR[]    # PTS people they've worked with
```

### Location Relationships
```yaml
LOCATION:
  hosts: PROGRAM[]           # Programs operating here
  has_jobs: JOB[]           # Jobs at this location
  has_contacts: CONTACT[]    # People based here
  has_presence: PRIME[]      # Companies with offices
  site_for: TASK_ORDER[]     # Task orders executing here
  held_at: BD_EVENT[]        # Events at this location
  pts_active: PTS_CONTRACTOR[] # PTS people working here
  pts_history: PTS_PP[]      # PTS past performance here
```

### BD Event Relationships
```yaml
BD_EVENT:
  attending: PRIME[]         # Primes attending
  attending_subs: SUBCONTRACTOR[]
  held_at: LOCATION
  covers: PROGRAM[]          # Programs being discussed
  attracts: CONTACT[]        # Key contacts attending
  relevant_to: CUSTOMER[]    # Agencies presenting
  focus_areas: FUNC_AREA[]   # Topics covered
```

---

## Appendix B: Color Reference

```css
/* Node Type Colors */
--node-job: #e53e3e;           /* Red */
--node-program: #3182ce;       /* Blue */
--node-prime: #38a169;         /* Green */
--node-subcontractor: #68d391; /* Light Green */
--node-task-order: #4299e1;    /* Light Blue */
--node-team: #63b3ed;          /* Sky Blue */
--node-location: #805ad5;      /* Purple */
--node-event: #d69e2e;         /* Yellow/Gold */
--node-contact: #d53f8c;       /* Pink */
--node-customer: #9f7aea;      /* Violet */
--node-pts-contractor: #319795;/* Teal */
--node-pts-pp: #38b2ac;        /* Light Teal */
--node-func-area: #a0aec0;     /* Gray */
--node-clearance: #718096;     /* Dark Gray */

/* BD Priority Colors (for nodes) */
--priority-critical: #e53e3e;  /* 🔴 */
--priority-high: #dd6b20;      /* 🟠 */
--priority-medium: #d69e2e;    /* 🟡 */
--priority-standard: #718096;  /* ⚪ */

/* Program/Branch Colors */
--branch-af: #3182ce;          /* Air Force - Blue */
--branch-army: #2f855a;        /* Army - Green */
--branch-navy: #2c5282;        /* Navy - Dark Blue */
--branch-corp: #553c9a;        /* Corporate - Purple */
```

---

*End of Mind Map Dashboard Architecture Specification v1.0*
