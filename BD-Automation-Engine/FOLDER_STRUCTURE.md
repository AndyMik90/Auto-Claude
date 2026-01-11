# BD Automation Engine - Complete Folder Structure

This document provides a comprehensive overview of all files and folders in the BD Automation Engine after the January 2026 reorganization.

## Root Structure

```
BD-Automation-Engine/
├── .env.example                    # Environment variables (8 Notion DB IDs configured)
├── README.md                       # Project overview
├── SETUP_GUIDE.md                  # Complete setup instructions
├── REQUIRED_EXPORTS.md             # Data export checklist
├── FOLDER_STRUCTURE.md             # This file
├── TASKS.md                        # Auto Claude task definitions
├── requirements.txt                # Python dependencies
│
├── Engine1_Scraper/                # Job data collection (Apify)
├── Engine2_ProgramMapping/         # Job-to-Program tagging
├── Engine3_OrgChart/               # Contact classification
├── Engine4_Playbook/               # BD content generation
├── Engine5_Scoring/                # Opportunity scoring
│
├── docs/                           # Documentation
│   ├── Claude Skills/              # 10 Claude skills
│   └── Claude Exports/             # Conversation exports
│
├── n8n/                            # Workflow automation (17 workflows)
├── prompts/                        # Prompt templates
└── outputs/                        # Generated outputs
```

---

## Engine 1: Scraper (Job Data Collection)

```
Engine1_Scraper/
├── Configurations/
│   ├── ScraperEngine_Config.json       # Main scraper configuration
│   ├── apify_input_primary.json        # Primary Apify actor input
│   ├── apify_input_variant1.json       # Variant input configuration
│   ├── apify_input_variant2.json       # Variant input configuration
│   ├── apex_insight_sample.json        # Sample Apex/Insight Global config
│   └── Apex_Systems_Scraping_Guide.docx # Scraping documentation
│
└── data/
    ├── Sample_Jobs.json                # Test data for development
    ├── dataset_puppeteer-scraper_2025-12-17_*.csv    # Historical scrape
    ├── dataset_puppeteer-scraper_2026-01-05_*.json   # Recent scrapes
    ├── dataset_puppeteer-scraper_2026-01-06_*.json   # Recent scrapes
    ├── dataset_puppeteer-scraper_2026-01-08_*.json   # Recent scrapes (5 files)
    └── dataset_puppeteer-scraper-task-insight-global_*.json
```

**Purpose:** Collects raw job postings from ClearanceJobs, LinkedIn, Apex Systems, Insight Global, and other sources via Apify Puppeteer scrapers.

---

## Engine 2: Program Mapping (Job Enrichment)

```
Engine2_ProgramMapping/
├── Configurations/
│   └── ProgramMapping_Config.json      # DCGS location mappings, keywords, scoring
│
├── data/
│   ├── Programs_KB.csv                 # Federal Programs database (LIVE)
│   ├── Programs_KBAll.csv              # Full export
│   ├── Programs_KB_TEMPLATE.csv        # Template for reference
│   ├── Federal Programs.csv            # Alternate export
│   ├── Contractors.csv                 # Contractors database
│   ├── Contractors Database.csv        # Alternate format
│   ├── Contract_Vehicles.csv           # Contract vehicles
│   ├── BD Opportunities.csv            # BD pipeline data
│   ├── BD IntelliRepo File Management.csv  # File tracking
│   ├── Program Mapping Intelligence Hub.csv # Enriched hub data
│   ├── GDIT Jobs 2.csv                 # GDIT-specific jobs
│   ├── Insight Global Jobs - Program Mapped (Dec 2025).csv  # Mapped jobs
│   ├── 📊 Insight Global Jobs - Program Mapped.csv  # Mapped jobs
│   └── Integration Setup & Workflow — Program Mapping Int*.md
│
└── scripts/
    ├── job_standardizer.py             # Transforms raw jobs to 11-field schema
    └── program_mapper.py               # Maps jobs to DCGS programs
```

**Purpose:** Enriches scraped jobs with program information using location intelligence, keyword matching, and clearance alignment.

---

## Engine 3: OrgChart (Contact Classification)

```
Engine3_OrgChart/
├── Configurations/
│   └── OrgChart_Config.json            # Classification settings
│
├── data/
│   ├── Contacts_TEMPLATE.csv           # Template for reference
│   ├── DCGS_Contacts.csv               # DCGS Contacts Full (6,288 lines)
│   ├── DCGS_ContactsAll.csv            # Full export
│   ├── DCGS Contact Sorted.csv         # Sorted/filtered view
│   ├── DCGS Contact SortedAll.csv      # Full sorted export
│   ├── GDIT_Other_Contacts.csv         # Other GDIT contacts
│   ├── GDIT Other ContactsAll.csv      # Full export
│   ├── GDIT PTS Contacts.csv           # PTS-specific contacts
│   ├── GDIT PTS Contacts All.csv       # Full export
│   ├── GBSD Contact Chart Updated 9 4.csv  # GBSD contacts
│   ├── GBSD Contact Chart Updated 9 4 All.csv
│   ├── Lockheed Contact.csv            # Lockheed Martin contacts
│   └── Lockheed ContactAll.csv         # Full export
│
└── scripts/
    └── contact_classifier.py           # 6-tier hierarchy classification
```

**Purpose:** Classifies contacts into 6-tier hierarchy (Executive → IC) with BD priority assignment and location hub mapping.

---

## Engine 4: Playbook (BD Content Generation)

```
Engine4_Playbook/
├── Configurations/
│   └── Playbook_Config.json            # Playbook generation settings
│
├── Templates/
│   └── PTS_Notion_Project_Handoff_Document.docx
│
└── Outputs/
    └── (generated playbooks go here)
```

**Purpose:** Generates BD playbooks, call sheets, and outreach materials using validated pain points and contact intelligence.

---

## Engine 5: Scoring (Opportunity Prioritization)

```
Engine5_Scoring/
├── Configurations/
│   └── Scoring_Config.json             # Scoring weights and thresholds
│
└── scripts/
    └── bd_scoring.py                   # BD Priority Score calculation
```

**Purpose:** Calculates BD Priority Scores (0-100) and assigns opportunities to Hot/Warm/Cold tiers.

---

## Documentation (docs/)

### Claude Skills (10 skills)

```
docs/Claude Skills/
├── README.md                           # Skills overview and usage
├── Claude Skills Readme.md             # Original readme
├── job-standardization-skill.md        # 11-field schema extraction
├── program-mapping-skill.md            # Location + keyword matching
├── contact-classification-skill.md     # 6-tier hierarchy
├── bd-outreach-messaging-skill.md      # 6-step BD Formula
├── human-intelligence-skill.md         # HUMINT methodology
├── federal-defense-programs-skill.md   # DCGS portfolio intelligence
├── notion-bd-operations-skill.md       # MCP database patterns
├── apify-job-scraping-skill.md         # Scraper configuration
├── bd-call-sheet-skill.md              # Call list generation
└── bd-playbook-skill.md                # Strategic playbook creation
```

### Claude Exports (20+ exports)

```
docs/Claude Exports/
├── Claude Export Prompt                # Template for exporting
├── Apex_Systems_Job_Scraper_*.md       # Apex scraping conversation
├── Apify_MCP_Server_Audit_*.md         # MCP audit
├── DCGS_BD_Email_Campaign_*.md         # Email campaign design
├── DCGS_BD_Intelligence_System_*.md    # Core system conversations (3 files)
├── Federal_Programs_Data_Transformation_*.md
├── GOD_MODE_MCP_AUTO_CLAUDE_*.md       # Advanced automation
├── Job_Scraper_Engine_Optimization_*.md
├── NOTION_PROJECT_HANDOFF_COMPLETE.md
├── Notion_MCP_Integration_Documentation_*.md
├── ProgramMappingEngine_Claude_Export_*.md
├── Program_Mapping_Engine_AutoClaude_Task_*.md
├── PTS_BD_Intelligence_System_*.md     # Multiple versions
├── PTS_BD_Skills_Audit_Report.md
├── PTS_BD_Skills_Master_Audit_*.md
├── PTS_Claude_Notion_MCP_Prompt_Playbook.md
├── PTS_Notion_Project_Handoff_Document.md
├── PTS_Notion_to_N8N_Handoff_Prompt_v2.md
├── ZoomInfo_Search_Strategy_DCGS_*.md
└── pts-bd-skills-complete.zip          # Skills bundle
```

---

## n8n Workflows (17 workflows)

```
n8n/
├── bd_automation_workflow.json         # Template workflow
│
├── # Core PTS BD Workflows
├── PTS_BD_WF1_Apify_Job_Scraper_Intake.json
├── PTS_BD_WF1_Apify_Job_Scraper_Intake_v2.json
├── PTS_BD_WF2_AI_Enrichment_Processor.json
├── PTS_BD_WF3_Hub_to_BD_Opportunities.json
├── PTS_BD_WF4_Contact_Classification.json
├── PTS_BD_WF5_Hot_Lead_Alerts.json
├── PTS_BD_WF6_Weekly_Summary_Report.json
├── Prime_TS_BD_Intelligence_System_v2.1.json
│
├── # Utility Workflows
├── Agent_Logger.json
├── Error_Logging.json
├── Apify_Integration.json
├── AI_Agent_workflow.json
├── Clearance_Job_RAG_Agent.json
├── Firecrawl_Search_Agent.json
├── Federal_Programs_Data_Fix.json
└── Hub_to_BD_Opportunities_Pipeline.json
```

---

## Prompts

```
prompts/
├── job_mapping_prompt.md               # Job-to-program mapping prompt
└── briefing_prompt.md                  # BD briefing generation prompt
```

---

## Outputs

```
outputs/
├── BD_Briefings/                       # Generated BD briefing documents
└── Logs/                               # Processing logs
```

---

## Data Flow Summary

```
┌─────────────────┐
│  Apify Scrapers │ ← Engine1 Configurations
└────────┬────────┘
         │ raw jobs
         ▼
┌─────────────────┐
│ Job Standardizer│ ← Engine2/scripts
└────────┬────────┘
         │ 11-field schema
         ▼
┌─────────────────┐
│ Program Mapper  │ ← Engine2/scripts + Programs_KB.csv
└────────┬────────┘
         │ enriched jobs
         ▼
┌─────────────────┐    ┌─────────────────┐
│ Contact Lookup  │ ←→ │ Engine3 Contacts │
└────────┬────────┘    └─────────────────┘
         │ matched contacts
         ▼
┌─────────────────┐
│   BD Scoring    │ ← Engine5/scripts
└────────┬────────┘
         │ scored opportunities
         ▼
┌─────────────────┐    ┌─────────────────┐
│ Playbook Gen    │ → │ outputs/Briefings│
└─────────────────┘    └─────────────────┘
```

---

## File Counts by Engine

| Engine | Config Files | Data Files | Scripts | Total |
|--------|--------------|------------|---------|-------|
| Engine1 (Scraper) | 6 | 10 | 0 | 16 |
| Engine2 (Mapping) | 1 | 20 | 2 | 23 |
| Engine3 (OrgChart) | 1 | 14 | 1 | 16 |
| Engine4 (Playbook) | 1 | 0 | 0 | 1 |
| Engine5 (Scoring) | 1 | 0 | 1 | 2 |
| n8n | 0 | 0 | 0 | 17 |
| Claude Skills | 0 | 0 | 0 | 12 |
| Claude Exports | 0 | 0 | 0 | 22 |

**Total Files:** ~100+ organized files across the BD Automation Engine
