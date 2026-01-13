# BD Automation Engine

End-to-end Business Development automation pipeline for federal defense programs, specifically optimized for the DCGS portfolio (~$950M).

## Project Overview

This system provides a **complete, production-ready** BD intelligence pipeline that runs autonomously every 6-24 hours:

1. **Scrape** new job postings from ClearanceJobs, LinkedIn, and competitor portals
2. **Standardize** raw data into 28-field schema using LLM extraction
3. **Map** jobs to federal programs using location intelligence and keyword matching
4. **Score** opportunities with BD Priority Scores (0-100) and tier classification
5. **Generate** BD briefing documents with contact information
6. **Evaluate** results through QA gating with human review queue
7. **Export** to Notion, n8n, and downstream systems
8. **Notify** via email and webhooks for hot leads

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
# Edit .env with your API keys:
# - ANTHROPIC_API_KEY (required)
# - NOTION_TOKEN (optional)
# - N8N_WEBHOOK_URL (optional)
# - SMTP credentials (optional for email)
```

### 3. Verify Setup

```bash
python quickstart.py --check
```

### 4. Run Test Pipeline

```bash
python quickstart.py --test
```

### 5. Run Full Pipeline

```bash
# Full pipeline with all stages
python orchestrator.py --input Engine1_Scraper/data/Sample_Jobs.json

# Hot leads only with email notifications
python orchestrator.py --input data/jobs.json --hot-leads-only --email

# Start scheduled runs (every 6 hours)
python orchestrator.py --schedule --interval 6
```

## Architecture

### 6-Engine Pipeline

```
                    ┌─────────────────────────────────────────────────────┐
                    │              BD AUTOMATION ENGINE                    │
                    │                Master Orchestrator                   │
                    └─────────────────────────────────────────────────────┘
                                           │
        ┌──────────────────────────────────┼──────────────────────────────────┐
        │                                  │                                  │
        ▼                                  ▼                                  ▼
┌───────────────┐              ┌───────────────────┐              ┌───────────────┐
│   Engine 1    │              │     Engine 2      │              │   Engine 3    │
│   Scraper     │──────────────│  Program Mapping  │──────────────│   OrgChart    │
│  (Apify)      │              │   (6-Stage)       │              │  (Contacts)   │
└───────────────┘              └───────────────────┘              └───────────────┘
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                      │
                    ▼                                      ▼
           ┌───────────────┐                      ┌───────────────┐
           │   Engine 4    │                      │   Engine 5    │
           │   Briefing    │                      │   Scoring     │
           │  Generator    │                      │  (BD Score)   │
           └───────────────┘                      └───────────────┘
                    │                                      │
                    └──────────────────┬───────────────────┘
                                       │
                                       ▼
                              ┌───────────────┐
                              │   Engine 6    │
                              │      QA       │
                              │  Feedback     │
                              └───────────────┘
                                       │
            ┌──────────────────────────┼──────────────────────────┐
            │                          │                          │
            ▼                          ▼                          ▼
     ┌────────────┐           ┌────────────┐            ┌────────────┐
     │   Notion   │           │    n8n     │            │   Email    │
     │   Export   │           │  Webhook   │            │   Alerts   │
     └────────────┘           └────────────┘            └────────────┘
```

### Pipeline Stages (Engine 2)

| Stage | Description | Output |
|-------|-------------|--------|
| 1. Ingest | Load raw jobs from JSON | Raw job list |
| 2. Preprocess | Clean HTML, normalize text | Cleaned jobs |
| 3. Standardize | LLM extraction to 28 fields | Structured jobs |
| 4. Match | Map to federal programs | Enriched jobs |
| 5. Score | Calculate BD priority scores | Scored jobs |
| 6. Export | Write to Notion CSV/n8n JSON | Export files |

## Folder Structure

```
BD-Automation-Engine/
├── orchestrator.py              # Master pipeline orchestrator
├── quickstart.py                # Quick start and validation
├── requirements.txt             # Python dependencies
├── .env.example                 # Environment template
│
├── Engine1_Scraper/             # Job data collection (Apify)
│   ├── Configurations/          # Scraper settings
│   └── data/                    # Raw job data (10+ sources)
│
├── Engine2_ProgramMapping/      # Core pipeline engine
│   ├── Configurations/          # ProgramMapping_Config.json
│   ├── data/                    # Federal Programs KB (400+ programs)
│   └── scripts/
│       ├── pipeline.py          # 6-stage orchestrator
│       ├── job_standardizer.py  # LLM extraction (28 fields)
│       ├── program_mapper.py    # Multi-signal matching
│       └── exporters.py         # Notion CSV / n8n JSON
│
├── Engine3_OrgChart/            # Contact management
│   ├── data/                    # 6,288+ DCGS contacts
│   └── scripts/
│       ├── contact_lookup.py    # Program-based lookup
│       └── contact_classifier.py # 6-tier classification
│
├── Engine4_Briefing/            # BD content generation
│   ├── Templates/               # Document templates
│   └── scripts/
│       └── briefing_generator.py # Markdown briefings
│
├── Engine5_Scoring/             # Opportunity scoring
│   ├── Configurations/          # Scoring weights
│   └── scripts/
│       └── bd_scoring.py        # BD Priority Score (0-100)
│
├── Engine6_QA/                  # Quality assurance
│   ├── data/                    # review_queue.json
│   └── scripts/
│       └── qa_feedback.py       # QA gating & feedback
│
├── services/                    # Infrastructure services
│   ├── database.py              # PostgreSQL persistence
│   ├── scheduler.py             # 24-hour automated runs
│   ├── notion_sync.py           # Notion database sync
│   └── bullhorn_integration.py  # CRM contact enrichment
│
├── n8n/                         # Workflow automation (18 workflows)
│   └── BD_Master_Orchestration_Workflow.json
│
├── tests/                       # Test suite
│   └── test_orchestrator.py     # Comprehensive tests
│
├── outputs/                     # Generated outputs
│   ├── BD_Briefings/            # Markdown briefings
│   ├── notion/                  # CSV exports
│   ├── n8n/                     # JSON exports
│   └── Logs/                    # Pipeline logs
│
└── docs/                        # Documentation
    ├── Claude Skills/           # 10 Claude skills
    └── Claude Exports/          # Conversation history
```

## 28-Field Schema

### Required Fields (6)
1. Job Title/Position
2. Date Posted
3. Location
4. Position Overview
5. Key Responsibilities
6. Required Qualifications

### Intelligence Fields (8)
7. Security Clearance
8. Program Hints
9. Client Hints
10. Contract Vehicle Hints
11. Prime Contractor
12. Recruiter Contact
13. Technologies
14. Certifications Required

### Enrichment Fields (6)
15. Matched Program
16. Match Confidence (0.0-1.0)
17. Match Type (direct/fuzzy/inferred)
18. BD Priority Score (0-100)
19. Priority Tier (Hot/Warm/Cold)
20. Match Signals

### Metadata Fields (4)
21. Source
22. Source URL
23. Scraped At
24. Processed At

## Priority System

### BD Priority Tiers

| Score | Tier | Action |
|-------|------|--------|
| 80-100 | Hot | Immediate outreach, escalate to BD leadership |
| 50-79 | Warm | Weekly follow-up queue |
| 0-49 | Cold | Pipeline tracking, monitor for changes |

### Contact Hierarchy

| Tier | Role | Priority |
|------|------|----------|
| 1 | Executive | Critical |
| 2 | Director | Critical |
| 3 | Program Leadership | High |
| 4 | Management | High |
| 5 | Senior IC | Medium |
| 6 | Individual Contributor | Standard |

## CLI Commands

### Full Pipeline
```bash
# Run complete pipeline
python orchestrator.py --input data/jobs.json

# Test mode (first 3 jobs)
python orchestrator.py --input data/jobs.json --test

# Hot leads only with email
python orchestrator.py --input data/jobs.json --hot-leads-only --email

# Skip specific stages
python orchestrator.py --input data/jobs.json --no-briefings --no-qa
```

### Scheduled Runs
```bash
# Start scheduler (every 6 hours)
python orchestrator.py --schedule --interval 6

# Or use the scheduler service directly
python services/scheduler.py --interval 12 --run-now
```

### Individual Engines
```bash
# Program Mapping
python Engine2_ProgramMapping/scripts/pipeline.py \
  --input data/jobs.json --output outputs/ --test

# BD Scoring
python Engine5_Scoring/scripts/bd_scoring.py \
  --input enriched_jobs.json --output scored.json --report report.json

# Contact Lookup
python Engine3_OrgChart/scripts/contact_lookup.py

# Briefing Generation
python Engine4_Briefing/scripts/briefing_generator.py
```

### Database Operations
```bash
# Initialize database schema
python services/database.py --init

# Show statistics
python services/database.py --stats

# View hot leads
python services/database.py --hot-leads
```

### Notion Sync
```bash
# Test Notion connection
python services/notion_sync.py --test

# Get jobs needing review
python services/notion_sync.py --get-reviews

# Sync jobs to Notion
python services/notion_sync.py --sync-jobs data/jobs.json
```

## Running Tests

```bash
# Run all tests
pytest tests/ -v

# Run with coverage
pytest tests/ --cov=. --cov-report=html

# Run specific test
pytest tests/test_orchestrator.py::TestBDOrchestrator -v
```

## n8n Workflows

Import `n8n/BD_Master_Orchestration_Workflow.json` for:

- Scheduled triggers (every 6 hours)
- Webhook triggers for manual runs
- Job standardization
- Program mapping
- BD scoring
- QA evaluation
- Hot lead alerts
- Notion opportunity creation
- Pipeline reporting

## Services

### Database (PostgreSQL)
- Persistent storage for jobs, mappings, scores, QA results
- Pipeline run history and statistics
- Dashboard data generation

### Scheduler
- Automated 24-hour pipeline execution
- File watching for new job data
- Retry logic with configurable intervals

### Notion Sync
- Bidirectional sync with Notion databases
- Review queue management
- Dashboard statistics

### Bullhorn Integration
- CRM contact enrichment
- Candidate sync and management
- Job order creation

## Environment Variables

```bash
# Required
ANTHROPIC_API_KEY=sk-ant-...

# Notion Integration
NOTION_TOKEN=ntn_...
NOTION_DB_GDIT_JOBS=...
NOTION_DB_BD_OPPORTUNITIES=...

# n8n Webhooks
N8N_WEBHOOK_URL=https://...
N8N_ENRICHMENT_WEBHOOK=https://...

# Email Notifications
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-password
NOTIFICATION_EMAIL=bd-team@company.com

# Database (Optional)
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=bd_automation
POSTGRES_USER=postgres
POSTGRES_PASSWORD=...
```

## Maintenance

### Daily
- Review hot lead email alerts
- Check Notion "Needs Review" queue
- Verify scheduled runs completed

### Weekly
- Update program keywords based on feedback
- Review unmatched jobs for new patterns
- Gather HUMINT and update pain points

### Monthly
- Refresh contact databases
- Update competitive intelligence
- Archive old data and clean logs

## Resources

- [Comprehensive Setup Guide](./SETUP_GUIDE.md)
- [Required Data Exports](./REQUIRED_EXPORTS.md)
- [Auto Claude Tasks](./TASKS.md)
- [Claude Skills Documentation](./docs/Claude%20Skills/README.md)

## License

Private - Prime Technical Services BD Intelligence System
