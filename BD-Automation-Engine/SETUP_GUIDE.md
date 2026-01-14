# BD Automation Engine - Comprehensive Setup Guide

This guide provides complete instructions for setting up the PTS BD Intelligence Automation System using Auto Claude.

## Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Repository Structure](#repository-structure)
4. [Configuration Setup](#configuration-setup)
5. [Required Data Exports](#required-data-exports)
6. [Engine-by-Engine Setup](#engine-by-engine-setup)
7. [Auto Claude Integration](#auto-claude-integration)
8. [n8n Workflow Setup](#n8n-workflow-setup)
9. [Testing the Pipeline](#testing-the-pipeline)
10. [Maintenance & Operations](#maintenance--operations)

---

## Overview

### What This System Does

The BD Automation Engine is a 5-engine pipeline that automates Business Development intelligence gathering for federal defense programs, specifically targeting the DCGS portfolio (~$950M).

**Daily Automated Workflow:**
1. **Scrape** job postings from ClearanceJobs, LinkedIn, and competitor portals
2. **Standardize** raw job data into 11-field schema
3. **Map** jobs to federal programs using location + keyword intelligence
4. **Classify** contacts into 6-tier hierarchy with BD priority
5. **Score** opportunities and generate actionable intelligence

### Target Programs

| Program | Value | Prime | GDIT Role |
|---------|-------|-------|-----------|
| AF DCGS | ~$500M | BAE Systems | Subcontractor |
| Army DCGS-A | ~$300M | GDIT | Prime |
| Navy DCGS-N | ~$150M | GDIT | Prime |

### Key Locations

| Priority | Location | Program |
|----------|----------|---------|
| Critical | San Diego | AF DCGS - PACAF |
| High | Hampton Roads | AF DCGS - Langley |
| High | Dayton | AF DCGS - Wright-Patt |
| Medium | Norfolk | Navy DCGS-N |
| Medium | Fort Belvoir | Army DCGS-A |

---

## Prerequisites

### Required Tools

| Tool | Purpose | Setup Guide |
|------|---------|-------------|
| **Auto Claude** | Autonomous task execution | [Auto Claude Setup](../AUTO_CLAUDE_SETUP_GUIDE.md) |
| **Claude Pro/Max** | AI processing | claude.ai subscription |
| **Notion** | Database storage | developers.notion.com |
| **Apify** | Web scraping | apify.com |
| **n8n** | Workflow orchestration | n8n.io (self-hosted or cloud) |
| **Git** | Version control | Already configured |
| **Python 3.10+** | Script execution | python.org |

### API Keys Needed

```bash
# Collect these before starting
ANTHROPIC_API_KEY=     # Claude API
OPENAI_API_KEY=        # Embeddings (text-embedding-ada-002)
APIFY_API_TOKEN=       # Web scraping
NOTION_TOKEN=          # Notion integration
N8N_API_KEY=           # n8n (if using API)
```

---

## Repository Structure

```
BD-Automation-Engine/
├── .env.example                    # Environment variables template
├── README.md                       # Project overview
├── SETUP_GUIDE.md                  # This file
├── TASKS.md                        # Auto Claude task definitions
│
├── Engine1_Scraper/                # Job data collection
│   ├── Configurations/
│   │   └── ScraperEngine_Config.json
│   ├── data/
│   │   └── Sample_Jobs.json        # Test data
│   └── scripts/                    # Future scraper scripts
│
├── Engine2_ProgramMapping/         # Job-to-Program tagging
│   ├── Configurations/
│   │   └── ProgramMapping_Config.json  # DCGS-focused config
│   ├── data/
│   │   └── Programs_KB_TEMPLATE.csv    # Program database template
│   └── scripts/
│       ├── job_standardizer.py     # 11-field schema extraction
│       └── program_mapper.py       # Location + keyword matching
│
├── Engine3_OrgChart/               # Contact & org mapping
│   ├── Configurations/
│   │   └── OrgChart_Config.json
│   ├── data/
│   │   └── Contacts_TEMPLATE.csv   # Contact database template
│   └── scripts/
│       └── contact_classifier.py   # 6-tier hierarchy classification
│
├── Engine4_Playbook/               # BD content generation
│   ├── Configurations/
│   │   └── Playbook_Config.json
│   ├── Templates/                  # Message templates
│   └── Outputs/                    # Generated content
│
├── Engine5_Scoring/                # Opportunity scoring
│   ├── Configurations/
│   │   └── Scoring_Config.json
│   └── scripts/
│       └── bd_scoring.py           # BD Priority Score calculation
│
├── docs/
│   ├── Claude Skills/              # 10 Claude skills
│   │   ├── README.md
│   │   ├── job-standardization-skill.md
│   │   ├── program-mapping-skill.md
│   │   ├── contact-classification-skill.md
│   │   ├── bd-outreach-messaging-skill.md
│   │   ├── human-intelligence-skill.md
│   │   ├── federal-defense-programs-skill.md
│   │   ├── notion-bd-operations-skill.md
│   │   ├── apify-job-scraping-skill.md
│   │   ├── bd-call-sheet-skill.md
│   │   └── bd-playbook-skill.md
│   └── Claude Exports/             # Conversation exports
│
├── n8n/
│   └── bd_automation_workflow.json # n8n workflow template
│
├── prompts/                        # Prompt templates
│   ├── job_mapping_prompt.md
│   └── briefing_prompt.md
│
└── outputs/
    ├── BD_Briefings/               # Generated briefings
    └── Logs/                       # Processing logs
```

---

## Configuration Setup

### Step 1: Create Environment File

```bash
cd BD-Automation-Engine
cp .env.example .env
```

### Step 2: Configure API Keys

Edit `.env` with your actual values:

```bash
# Required API Keys
ANTHROPIC_API_KEY=sk-ant-api...
OPENAI_API_KEY=sk-...
APIFY_API_TOKEN=apify_api_...
NOTION_TOKEN=secret_...
```

### Step 3: Verify Notion Database IDs

The `.env.example` contains the actual PTS Notion database IDs:

```bash
# These are pre-configured - verify they match your workspace
NOTION_DB_DCGS_CONTACTS=2ccdef65-baa5-8087-a53b-000ba596128e
NOTION_DB_GDIT_OTHER_CONTACTS=70ea1c94-211d-40e6-a994-e8d7c4807434
NOTION_DB_GDIT_JOBS=2563119e7914442cbe0fb86904a957a1
NOTION_DB_PROGRAM_MAPPING_HUB=f57792c1-605b-424c-8830-23ab41c47137
NOTION_DB_BD_OPPORTUNITIES=2bcdef65-baa5-80ed-bd95-000b2f898e17
NOTION_DB_FEDERAL_PROGRAMS=06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
NOTION_DB_CONTRACTORS=3a259041-22bf-4262-a94a-7d33467a1752
NOTION_DB_CONTRACT_VEHICLES=0f09543e-9932-44f2-b0ab-7b4c070afb81
```

### Step 4: Install Python Dependencies

```bash
cd BD-Automation-Engine
pip install anthropic openai requests pandas notion-client
```

---

## Required Data Exports

### Files You Need to Provide

The following files need to be exported from your existing systems and added to the repository:

#### 1. Programs Database Export

**Source:** Notion Federal Programs database
**Destination:** `Engine2_ProgramMapping/data/Programs_KB.csv`

Export columns:
- Program Name
- Acronym
- Agency Owner
- Prime Contractor
- Known Subcontractors
- Contract Value
- Contract Vehicle
- Key Locations
- Clearance Requirements
- Typical Roles
- Keywords
- PTS Involvement
- Priority Level
- Pain Points

#### 2. Contacts Database Export

**Source:** Notion DCGS Contacts Full database
**Destination:** `Engine3_OrgChart/data/Contacts.csv`

Export columns:
- Name
- Job Title
- Email Address
- Phone
- LinkedIn URL
- Company
- Program
- Location
- Clearance
- Hierarchy Tier
- BD Priority
- Location Hub
- Functional Area
- Last Contact Date
- Notes

#### 3. Contractors Database Export

**Source:** Notion Contractors database
**Destination:** `Engine2_ProgramMapping/data/Contractors.csv`

Export columns:
- Company Name
- Aliases
- Primary Focus
- Key Programs
- GDIT Relationship
- Contact Info

#### 4. Contract Vehicles Export

**Source:** Notion Contract Vehicles database
**Destination:** `Engine2_ProgramMapping/data/Contract_Vehicles.csv`

Export columns:
- Vehicle Name
- Agency
- Focus Area
- Term/End Date
- Relevant Programs

#### 5. n8n Workflow Export (If Existing)

**Source:** n8n Dashboard > Workflows > Export
**Destination:** `n8n/` folder

If you have existing n8n workflows for job processing, export them as JSON.

### How to Export from Notion

1. Open the database in Notion
2. Click `...` menu in top right
3. Select **Export** > **Markdown & CSV**
4. Choose **CSV** format
5. Download and place in appropriate folder

---

## Engine-by-Engine Setup

### Engine 1: Scraper Setup

**Purpose:** Collect job postings from multiple sources

1. **Configure Apify Actors:**
   - Log into Apify
   - Create/configure actors for:
     - ClearanceJobs
     - LinkedIn Jobs
     - Competitor portals (Apex, Insight Global)

2. **Set up Webhooks:**
   ```
   Apify Actor Settings > Integrations > Webhooks
   URL: https://your-n8n-instance/webhook/job-data-intake
   Events: ACTOR.RUN.SUCCEEDED
   ```

3. **Configure Search Terms:**
   Edit `Engine1_Scraper/Configurations/ScraperEngine_Config.json`:
   ```json
   {
     "searchQueries": ["DCGS", "ISR analyst", "TS/SCI"],
     "locations": ["San Diego, CA", "Hampton, VA", "Dayton, OH"]
   }
   ```

### Engine 2: Program Mapping Setup

**Purpose:** Match jobs to federal programs

1. **Review Configuration:**
   The `ProgramMapping_Config.json` is pre-configured with DCGS locations and keywords.

2. **Add Your Programs Data:**
   - Export your Federal Programs database from Notion
   - Save as `Engine2_ProgramMapping/data/Programs_KB.csv`

3. **Test the Mapper:**
   ```bash
   cd BD-Automation-Engine
   python Engine2_ProgramMapping/scripts/program_mapper.py \
     --input Engine1_Scraper/data/Sample_Jobs.json \
     --output outputs/test_mapping.json \
     --test
   ```

### Engine 3: OrgChart Setup

**Purpose:** Classify contacts and map organizational relationships

1. **Add Your Contacts:**
   - Export DCGS Contacts Full from Notion
   - Save as `Engine3_OrgChart/data/Contacts.csv`

2. **Test the Classifier:**
   ```bash
   python Engine3_OrgChart/scripts/contact_classifier.py \
     --input Engine3_OrgChart/data/Contacts_TEMPLATE.csv \
     --output outputs/test_classification.json
   ```

### Engine 4: Playbook Setup

**Purpose:** Generate BD content and outreach materials

1. **Configure Templates:**
   Review templates in `Engine4_Playbook/Templates/`

2. **Set Output Preferences:**
   Edit `Engine4_Playbook/Configurations/Playbook_Config.json`

### Engine 5: Scoring Setup

**Purpose:** Calculate BD Priority Scores

1. **Review Scoring Weights:**
   The `Scoring_Config.json` contains weights from the skills.

2. **Test Scoring:**
   ```bash
   python Engine5_Scoring/scripts/bd_scoring.py \
     --input outputs/test_mapping.json \
     --output outputs/test_scored.json \
     --report outputs/scoring_report.json
   ```

---

## Auto Claude Integration

### Step 1: Load Claude Skills

Upload all 10 skills to your Claude Project:

1. Go to Claude.ai > Projects
2. Create or select your BD Automation project
3. Navigate to Project Knowledge
4. Upload all files from `docs/Claude Skills/`

### Step 2: Create Tasks in Auto Claude

Copy tasks from `TASKS.md` into Auto Claude's Kanban board:

1. **Task 1:** New Job Ingestion & Deduplication Pipeline
2. **Task 2:** Program Knowledge Base Prep
3. **Task 3:** Job→Program Mapping Engine
4. **Task 4:** Update Notion with Enrichment Results
5. **Task 5:** Org Chart Contact Extraction
6. **Task 6:** BD Briefing Document Generation
7. **Task 7:** Workflow Orchestration & Sequencing
8. **Task 8:** Quality Assurance & Feedback Loop

### Step 3: Configure Auto Claude Settings

In Auto Claude settings, ensure:
- Claude API key is configured
- Workspace directory points to BD-Automation-Engine
- Git integration is enabled for version control

---

## n8n Workflow Setup

### Step 1: Import Workflow

1. Open n8n Dashboard
2. Go to Workflows > Import
3. Upload `n8n/bd_automation_workflow.json`

### Step 2: Configure Credentials

Add credentials in n8n:
- **Apify:** API token
- **Notion:** Integration token
- **Email:** SMTP settings

### Step 3: Set Environment Variables

In n8n Settings > Variables:
```
NOTION_DB_PROGRAM_MAPPING_HUB=f57792c1-605b-424c-8830-23ab41c47137
PROGRAM_MAPPING_API_URL=http://localhost:5000 (or your API)
NOTIFICATION_EMAIL=bd-team@company.com
```

### Step 4: Test Workflow

1. Trigger the webhook manually with sample data
2. Verify jobs appear in Notion
3. Check enrichment processing
4. Confirm hot lead alerts are sent

---

## Testing the Pipeline

### Quick Test (5 minutes)

```bash
# 1. Test program mapping with sample data
python Engine2_ProgramMapping/scripts/program_mapper.py \
  --input Engine1_Scraper/data/Sample_Jobs.json \
  --output outputs/quick_test.json \
  --test

# 2. Check results
cat outputs/quick_test.json | python -m json.tool
```

### Integration Test (30 minutes)

1. **Create test job in Notion** with status `raw_import`
2. **Trigger enrichment webhook** manually
3. **Verify** program mapping populates
4. **Check** BD Priority Score calculation
5. **Confirm** status transitions correctly

### Full Pipeline Test (2 hours)

1. **Configure Apify** actor with limited results (10 jobs)
2. **Run scraper** manually
3. **Monitor n8n** workflow execution
4. **Verify** all stages complete
5. **Review** BD Briefings output

---

## Maintenance & Operations

### Daily Checks

- [ ] Review summary email
- [ ] Check Notion "Needs Review" queue
- [ ] Verify scraper ran successfully
- [ ] Monitor n8n workflow execution

### Weekly Tasks

- [ ] Update program keywords if needed
- [ ] Review unmatched jobs
- [ ] Adjust scoring weights based on feedback
- [ ] Update pain points from HUMINT gathered

### Monthly Tasks

- [ ] Refresh contact data from LinkedIn
- [ ] Update program database
- [ ] Review and archive old data
- [ ] Validate Notion database schemas
- [ ] Update skills with new patterns

### Quarterly Tasks

- [ ] Full playbook refresh
- [ ] Contract status review
- [ ] Competitive landscape update
- [ ] System performance audit

---

## Troubleshooting

### Common Issues

**Scraper not running:**
- Check Apify actor status
- Verify API token is valid
- Review rate limits

**Mapping confidence too low:**
- Expand keyword lists
- Add location variants
- Lower confidence thresholds

**Notion sync failing:**
- Verify API token permissions
- Check database IDs match
- Review property name mismatches

**n8n workflow errors:**
- Check webhook URL accessibility
- Verify credential configuration
- Review execution logs

### Getting Help

1. Check skill documentation in `docs/Claude Skills/`
2. Review Auto Claude logs in `outputs/Logs/`
3. Ask Claude with relevant skill loaded
4. Open an issue in the repository

---

## Next Steps After Setup

1. **Run your first scrape** with limited data (10-20 jobs)
2. **Review mapping quality** and adjust keywords
3. **Classify existing contacts** using the classifier
4. **Create your first BD playbook** for priority program
5. **Set up weekly reporting** automation

---

## Quick Reference

### Key Notion Collection IDs

```
DCGS Contacts Full:     2ccdef65-baa5-8087-a53b-000ba596128e
GDIT Other Contacts:    70ea1c94-211d-40e6-a994-e8d7c4807434
GDIT Jobs:              2563119e7914442cbe0fb86904a957a1
Program Mapping Hub:    f57792c1-605b-424c-8830-23ab41c47137
Federal Programs:       06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
BD Opportunities:       2bcdef65-baa5-80ed-bd95-000b2f898e17
Contractors:            3a259041-22bf-4262-a94a-7d33467a1752
Contract Vehicles:      0f09543e-9932-44f2-b0ab-7b4c070afb81
```

### Priority Tiers

| Score | Tier | Action |
|-------|------|--------|
| 80-100 | Hot | Immediate outreach |
| 50-79 | Warm | Weekly follow-up |
| 0-49 | Cold | Pipeline tracking |

### Contact Hierarchy

| Tier | Role | BD Priority |
|------|------|-------------|
| 1 | Executive | Critical |
| 2 | Director | Critical |
| 3 | Program Leadership | High |
| 4 | Management | High |
| 5 | Senior IC | Medium |
| 6 | Individual Contributor | Standard |
