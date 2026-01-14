# PTS BD Intelligence Skill Suite

## Overview

A comprehensive set of 10 custom skills designed to systematize the PTS Business Development intelligence system for federal defense programs, specifically optimized for DCGS (Distributed Common Ground System) campaigns.

**Target:** Top 0.1% Claude/Claude Code proficiency for BD intelligence operations

## Skills Included

| # | Skill | Trigger Keywords | Purpose |
|---|-------|------------------|---------|
| 1 | **[job-standardization](./job-standardization-skill.md)** | job scraper, parsing, extraction | LLM prompt engine for 11-field schema |
| 2 | **[program-mapping](./program-mapping-skill.md)** | federal programs, DCGS, location matching | Multi-signal scoring for job-to-program matching |
| 3 | **[contact-classification](./contact-classification-skill.md)** | hierarchy tier, BD priority, seniority | 6-tier contact classification system |
| 4 | **[bd-outreach-messaging](./bd-outreach-messaging-skill.md)** | BD formula, outreach, cold call | The 6-step BD Formula for personalized messaging |
| 5 | **[humint-intelligence](./human-intelligence-skill.md)** | HUMINT, pain points, intelligence | Tiered approach to intelligence gathering |
| 6 | **[federal-defense-programs](./federal-defense-programs-skill.md)** | prime contractor, subcontractor, GDIT | Program intelligence and contract details |
| 7 | **[notion-bd-operations](./notion-bd-operations-skill.md)** | Notion, database, MCP, contacts | Database patterns and bulk operations |
| 8 | **[apify-job-scraping](./apify-job-scraping-skill.md)** | Apify, job scraper, ClearanceJobs, LinkedIn | Actor configuration and webhook integration |
| 9 | **[bd-call-sheet](./bd-call-sheet-skill.md)** | call sheet, outreach, talking points | Structured call lists with conversation guides |
| 10 | **[bd-playbook](./bd-playbook-skill.md)** | playbook, strategy, pursuit plan | Comprehensive BD playbooks for program pursuit |

## Quick Reference: Notion Collection IDs

These are the actual database IDs used across the skills:

```bash
# Contact Databases
DCGS Contacts Full:     2ccdef65-baa5-8087-a53b-000ba596128e
GDIT Other Contacts:    70ea1c94-211d-40e6-a994-e8d7c4807434

# Job & Opportunity Tracking
GDIT Jobs:              2563119e7914442cbe0fb86904a957a1
Program Mapping Hub:    f57792c1-605b-424c-8830-23ab41c47137
BD Opportunities:       2bcdef65-baa5-80ed-bd95-000b2f898e17

# Reference Databases
Federal Programs:       06cd9b22-5d6b-4d37-b0d3-ba99da4971fa
Contractors:            3a259041-22bf-4262-a94a-7d33467a1752
Contract Vehicles:      0f09543e-9932-44f2-b0ab-7b4c070afb81
```

## Installation

### Method 1: Claude.ai Project Knowledge

1. Go to your Claude Project
2. Navigate to **Project Knowledge** section
3. Click **Add Content** > **Upload Files**
4. Upload each skill `.md` file from this folder
5. Skills will automatically trigger based on keywords

### Method 2: Claude Code (Local Skills)

1. Copy skill files to your Claude Code knowledge directory:
```bash
cp BD-Automation-Engine/docs/Claude\ Skills/*.md ~/.claude/skills/
```

2. Skills will be automatically discovered on next Claude Code session

### Method 3: Individual Skill Upload

For specific skills only:
1. Open the skill's `.md` file
2. Copy the entire contents
3. Paste into Claude Project Knowledge as a new file
4. Name the file with the skill name (e.g., `job-standardization.md`)

## Usage Examples

### Job Standardization
```
User: "Process this batch of scraped jobs from Insight Global and standardize them"
Claude: [Reads job-standardization skill] -> Applies 11-field schema extraction
```

### Program Mapping
```
User: "Map these jobs to federal programs and calculate BD scores"
Claude: [Reads program-mapping skill] -> Uses location intelligence + multi-signal scoring
```

### Contact Classification
```
User: "Classify this contact by tier and assign BD priority"
Claude: [Reads contact-classification skill] -> Applies 6-tier hierarchy logic
```

### BD Outreach
```
User: "Create a personalized outreach message for this PM at Langley"
Claude: [Reads bd-outreach-messaging skill] -> Uses 6-step BD Formula
```

### HUMINT Planning
```
User: "Plan our HUMINT gathering approach for the San Diego site"
Claude: [Reads humint-intelligence skill] -> Creates tiered contact sequencing
```

### Job Scraping Setup
```
User: "Set up an Apify actor for ClearanceJobs scraping"
Claude: [Reads apify-job-scraping skill] -> Provides actor config and webhook setup
```

### Call Sheet Generation
```
User: "Create a BD call sheet for AF DCGS contacts"
Claude: [Reads bd-call-sheet skill] -> Generates structured call list with talking points
```

### Playbook Creation
```
User: "Build a BD playbook for the Army DCGS-A program"
Claude: [Reads bd-playbook skill] -> Creates comprehensive pursuit strategy
```

## Skill Dependencies

Some skills reference each other:

```
Pipeline Skills:
job-standardization -> program-mapping -> bd-scoring

Contact Skills:
contact-classification -> bd-outreach-messaging -> bd-call-sheet

Strategic Skills:
federal-defense-programs + humint-intelligence -> bd-playbook

Data Layer:
notion-bd-operations <-> All skills (data storage/retrieval)

Ingestion:
apify-job-scraping -> job-standardization (data pipeline start)
```

## DCGS Portfolio Target

| Program | Value | Prime | GDIT Role | Priority Locations |
|---------|-------|-------|-----------|-------------------|
| AF DCGS | ~$500M | BAE Systems | Subcontractor | San Diego, Langley, Wright-Patt |
| Army DCGS-A | ~$300M | GDIT | Prime | Fort Belvoir, Fort Detrick, Aberdeen |
| Navy DCGS-N | ~$150M | GDIT | Prime | Norfolk, Suffolk, Tracy |

## Integration with BD Engine

### n8n Workflows
Skills designed to integrate with:
- Apify Job Import Workflow
- Enrichment Processor Workflow
- Priority Alert Notification Workflow

### Python Scripts
Corresponding scripts in `BD-Automation-Engine/Engine*/scripts/`:
- `job_standardizer.py` (Engine2)
- `program_mapper.py` (Engine2)
- `contact_classifier.py` (Engine3)
- `bd_scoring.py` (Engine5)

## Best Practices

### DO:
- Read relevant skill before starting task
- Combine multiple skills for complex workflows
- Update skills when processes change
- Use exact schema values from skills
- Validate pain points with multiple sources

### DON'T:
- Ignore skill guidance for "faster" approach
- Use generic templates when skills provide specific ones
- Skip classification steps
- Approach executives before HUMINT gathering
- Use unvalidated intel in outreach

## Troubleshooting

### Skill Not Triggering
- Check keyword match in query
- Verify skill uploaded to Project Knowledge
- Use explicit reference: "Using the bd-call-sheet skill..."

### Outdated Information
- Update pain points and contacts as new HUMINT gathered
- Refresh Notion Collection IDs if databases recreated
- Review and update program details quarterly

### Schema Mismatches
- Verify Notion property names match exactly
- Check select field values include emoji prefix
- Confirm multi-select fields use array format

## Changelog

### v2.0.0 (January 2026)
- Added 3 missing skills: apify-job-scraping, bd-call-sheet, bd-playbook
- Updated README with complete documentation
- Added Collection ID quick reference
- Linked to corresponding Python scripts

### v1.0.0 (January 2026)
- Initial release
- 7 core skills for BD intelligence system
- DCGS program focus

---

**Created for:** Prime Technical Services BD Intelligence System
**Optimized for:** Claude.ai and Claude Code
**Target:** Top 0.1% user proficiency
