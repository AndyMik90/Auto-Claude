# BD Automation Engine

End-to-end Business Development automation pipeline composed of five "engines" that work together to automate BD intelligence gathering.

## Project Overview

This system automates the following workflow every 24 hours:
1. **Scrape** new job postings from various sources
2. **Enrich** jobs with program information
3. **Map** contacts and org charts
4. **Generate** BD playbook insights
5. **Score** and prioritize opportunities

## Folder Structure

```
BD-Automation-Engine/
├── Engine1_Scraper/           # Job data collection
│   ├── Configurations/        # Scraper settings
│   ├── data/                  # Scraped job data
│   └── scripts/               # Scraping scripts
│
├── Engine2_ProgramMapping/    # Job-to-Program tagging
│   ├── Configurations/        # Mapping rules & keywords
│   ├── data/                  # Program knowledge base
│   └── scripts/               # Mapping logic
│
├── Engine3_OrgChart/          # Contact & org mapping
│   ├── Configurations/        # Contact lookup settings
│   ├── data/                  # Contact databases
│   └── OrgCharts/             # Generated org charts
│
├── Engine4_Playbook/          # BD content generation
│   ├── Configurations/        # Playbook settings
│   ├── Templates/             # Email/call templates
│   └── Outputs/               # Generated playbooks
│
├── Engine5_Scoring/           # Opportunity scoring
│   ├── Configurations/        # Scoring weights
│   └── scripts/               # Scoring logic
│
├── agents/                    # Custom sub-agent definitions
├── prompts/                   # Prompt templates
├── outputs/                   # Final outputs
│   ├── BD_Briefings/          # Generated briefing docs
│   └── Logs/                  # Processing logs
│
└── .env.example               # Environment variables template
```

## Quick Start

### 1. Install Dependencies

```bash
# From BD-Automation-Engine directory
pip install -r requirements.txt
```

### 2. Configure Environment

```bash
# Copy and edit environment file
cp .env.example .env
# Fill in your API keys
```

### 3. Prepare Data

1. Export your Notion Programs database to `Engine2_ProgramMapping/data/Programs_KB.csv`
2. Add contact data to `Engine3_OrgChart/data/Contacts.csv`
3. Configure scraper sources in `Engine1_Scraper/Configurations/ScraperEngine_Config.json`

### 4. Run Initial Setup

```bash
# Build keyword dictionary and embeddings
python Engine2_ProgramMapping/scripts/program_kb_setup.py

# Test with sample data
python Engine2_ProgramMapping/scripts/job_mapping.py --test
```

### 5. Create Tasks in Auto Claude

Load the task definitions from `TASKS.md` into Auto Claude's Kanban board.

## Configuration Files

### Engine 1: Scraper

`Engine1_Scraper/Configurations/ScraperEngine_Config.json`:
- Define scraping sources
- Set search terms and filters
- Configure output format

### Engine 2: Program Mapping

`Engine2_ProgramMapping/Configurations/ProgramMapping_Config.json`:
- Program keywords dictionary
- Matching thresholds
- Confidence settings

### Engine 3: Org Chart

`Engine3_OrgChart/Configurations/OrgChart_Config.json`:
- Target roles to find
- Contact lookup priorities
- LinkedIn search parameters

### Engine 4: Playbook

`Engine4_Playbook/Configurations/Playbook_Config.json`:
- Template preferences
- Output format
- AI model settings

### Engine 5: Scoring

`Engine5_Scoring/Configurations/Scoring_Config.json`:
- Scoring weights
- Priority thresholds
- Custom factors

## Integration with n8n

The engines can be orchestrated via n8n workflows:

1. **Trigger**: Daily schedule (e.g., 6 AM)
2. **Scrape**: Call Apify actors or custom scrapers
3. **Process**: Run mapping and scoring scripts
4. **Update**: Write to Notion databases
5. **Notify**: Send summary emails

See `n8n_workflow_template.json` for the complete workflow.

## Integration with Notion

Required Notion Databases:
- **Programs DB**: Master list of DoD programs
- **Jobs DB**: Scraped job postings
- **Contacts DB**: (Optional) Key people

## Auto Claude Tasks

The following tasks are defined for building this system:

1. **Task 1**: New Job Ingestion & Deduplication Pipeline
2. **Task 2**: Program Knowledge Base Prep (Keywords & Embeddings)
3. **Task 3**: Job→Program Mapping Engine (Enrichment Logic)
4. **Task 4**: Update Notion with Enrichment Results
5. **Task 5**: Org Chart Contact Extraction
6. **Task 6**: BD Briefing Document Generation
7. **Task 7**: Workflow Orchestration & Sequencing
8. **Task 8**: Quality Assurance & Feedback Loop

See `TASKS.md` for detailed task definitions.

## Maintenance

### Daily Checks
- Review summary email
- Check Notion "Needs Review" queue
- Verify scraper ran successfully

### Weekly
- Update program keywords
- Review unmatched jobs
- Adjust scoring weights

### Monthly
- Refresh contact data
- Update program database
- Review and archive old data

## Troubleshooting

### Scraper Issues
- Check Apify actor logs
- Verify API tokens are valid
- Review rate limits

### Mapping Issues
- Expand keyword lists
- Lower confidence thresholds
- Check program database completeness

### Notion Sync Issues
- Verify API token permissions
- Check database IDs
- Review property mappings

## Resources

- [Auto Claude Setup Guide](../AUTO_CLAUDE_SETUP_GUIDE.md)
- [Building End-to-End BD Automation Engine (PDF)](../Building%20Your%20End-to-End%20BD%20Automation%20Engine%20(Step-by-Step%20Guide).pdf)
- [Folder Setup Instructions (PDF)](../📁%20Folder_File%20Setup%20Instructions.pdf)
