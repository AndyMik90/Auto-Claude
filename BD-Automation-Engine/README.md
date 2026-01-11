# BD Automation Engine

End-to-end Business Development automation pipeline for federal defense programs, specifically optimized for the DCGS portfolio (~$950M).

## Project Overview

This system automates the following workflow every 24 hours:

1. **Scrape** new job postings from ClearanceJobs, LinkedIn, and competitor portals
2. **Standardize** raw data into 11-field schema using LLM extraction
3. **Map** jobs to federal programs using location intelligence and keyword matching
4. **Classify** contacts into 6-tier hierarchy with BD priority assignment
5. **Score** opportunities and generate actionable BD intelligence

## Target Portfolio

| Program | Value | Prime | GDIT Role |
|---------|-------|-------|-----------|
| AF DCGS | ~$500M | BAE Systems | Subcontractor |
| Army DCGS-A | ~$300M | GDIT | Prime |
| Navy DCGS-N | ~$150M | GDIT | Prime |

## Quick Start

### 1. Install Dependencies

```bash
cd BD-Automation-Engine
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your API keys
```

### 3. Export Required Data

See [REQUIRED_EXPORTS.md](./REQUIRED_EXPORTS.md) for the complete list of Notion database exports needed.

### 4. Run Initial Test

```bash
# Test program mapping with sample data
python Engine2_ProgramMapping/scripts/program_mapper.py \
  --input Engine1_Scraper/data/Sample_Jobs.json \
  --output outputs/test_mapping.json \
  --test
```

### 5. Follow Setup Guide

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete setup instructions.

## Folder Structure

```
BD-Automation-Engine/
├── .env.example                    # Environment template with Notion IDs
├── README.md                       # This file
├── SETUP_GUIDE.md                  # Comprehensive setup instructions
├── REQUIRED_EXPORTS.md             # Data export checklist
├── TASKS.md                        # Auto Claude task definitions
├── requirements.txt                # Python dependencies
│
├── Engine1_Scraper/                # Job data collection
│   ├── Configurations/             # Apify actor settings
│   ├── data/                       # Scraped job data
│   └── scripts/                    # Scraping scripts
│
├── Engine2_ProgramMapping/         # Job-to-Program tagging
│   ├── Configurations/             # DCGS-focused mapping config
│   ├── data/                       # Program KB, templates
│   └── scripts/                    # job_standardizer.py, program_mapper.py
│
├── Engine3_OrgChart/               # Contact & org mapping
│   ├── Configurations/             # Classification settings
│   ├── data/                       # Contact databases
│   └── scripts/                    # contact_classifier.py
│
├── Engine4_Playbook/               # BD content generation
│   ├── Configurations/             # Playbook settings
│   ├── Templates/                  # Message templates
│   └── Outputs/                    # Generated content
│
├── Engine5_Scoring/                # Opportunity scoring
│   ├── Configurations/             # Scoring weights
│   └── scripts/                    # bd_scoring.py
│
├── docs/
│   ├── Claude Skills/              # 10 Claude skills suite
│   └── Claude Exports/             # Conversation exports
│
├── n8n/                            # Workflow automation
│   └── bd_automation_workflow.json
│
├── prompts/                        # Prompt templates
└── outputs/                        # Generated outputs
    ├── BD_Briefings/
    └── Logs/
```

## Claude Skills Suite

The `docs/Claude Skills/` folder contains 10 specialized skills:

| Skill | Purpose |
|-------|---------|
| job-standardization | Parse raw jobs to 11-field schema |
| program-mapping | Map jobs to DCGS programs |
| contact-classification | 6-tier hierarchy classification |
| bd-outreach-messaging | Personalized outreach generation |
| humint-intelligence | Intelligence gathering methodology |
| federal-defense-programs | Program intelligence reference |
| notion-bd-operations | Database operation patterns |
| apify-job-scraping | Scraper configuration |
| bd-call-sheet | Call list generation |
| bd-playbook | Strategic playbook creation |

## Notion Database Integration

Pre-configured database IDs (verify in your workspace):

```bash
DCGS Contacts Full:     2ccdef65-baa5-8087-a53b-000ba596128e
GDIT Other Contacts:    70ea1c94-211d-40e6-a994-e8d7c4807434
GDIT Jobs:              2ccdef65-baa5-80b0-9a80-000bd2745f63
Program Mapping Hub:    f57792c1-605b-424c-8830-23ab41c47137
Federal Programs:       06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
BD Opportunities:       2bcdef65-baa5-80ed-bd95-000b2f898e17
Contractors:            3a259041-22bf-4262-a94a-7d33467a1752
Contract Vehicles:      0f09543e-9932-44f2-b0ab-7b4c070afb81
```

## Python Scripts

### Job Standardization
```bash
python Engine2_ProgramMapping/scripts/job_standardizer.py \
  --input raw_jobs.json \
  --output standardized_jobs.json
```

### Program Mapping
```bash
python Engine2_ProgramMapping/scripts/program_mapper.py \
  --input jobs.json \
  --output enriched_jobs.json
```

### Contact Classification
```bash
python Engine3_OrgChart/scripts/contact_classifier.py \
  --input contacts.csv \
  --output classified_contacts.json
```

### BD Scoring
```bash
python Engine5_Scoring/scripts/bd_scoring.py \
  --input enriched_jobs.json \
  --output scored_jobs.json \
  --report scoring_report.json
```

## Priority System

### BD Priority Tiers

| Score | Tier | Emoji | Action |
|-------|------|-------|--------|
| 80-100 | Hot | Fire | Immediate outreach |
| 50-79 | Warm | Yellow | Weekly follow-up |
| 0-49 | Cold | Snowflake | Pipeline tracking |

### Contact Hierarchy

| Tier | Role | Priority |
|------|------|----------|
| 1 | Executive | Critical |
| 2 | Director | Critical |
| 3 | Program Leadership | High |
| 4 | Management | High |
| 5 | Senior IC | Medium |
| 6 | Individual Contributor | Standard |

## Auto Claude Integration

Load task definitions from `TASKS.md` into Auto Claude:

1. Task 1: New Job Ingestion & Deduplication Pipeline
2. Task 2: Program Knowledge Base Prep
3. Task 3: Job→Program Mapping Engine
4. Task 4: Update Notion with Enrichment Results
5. Task 5: Org Chart Contact Extraction
6. Task 6: BD Briefing Document Generation
7. Task 7: Workflow Orchestration & Sequencing
8. Task 8: Quality Assurance & Feedback Loop

## n8n Workflow

Import `n8n/bd_automation_workflow.json` for:

- Webhook trigger from Apify
- Job validation and deduplication
- Notion record creation
- Enrichment processing
- Hot lead alerts

## Maintenance

### Daily
- Review hot lead alerts
- Check Notion "Needs Review" queue
- Verify scrapers ran successfully

### Weekly
- Update program keywords
- Review unmatched jobs
- Gather HUMINT and update pain points

### Monthly
- Refresh contact databases
- Update competitive intelligence
- Review and archive old data

## Resources

- [Comprehensive Setup Guide](./SETUP_GUIDE.md)
- [Required Data Exports](./REQUIRED_EXPORTS.md)
- [Auto Claude Tasks](./TASKS.md)
- [Claude Skills Documentation](./docs/Claude%20Skills/README.md)
- [Auto Claude Setup Guide](../AUTO_CLAUDE_SETUP_GUIDE.md)

## License

Private - Prime Technical Services BD Intelligence System
