# PTS BD Intelligence Skill Suite

## Overview

A comprehensive set of 10 custom skills designed to systematize the PTS Business Development intelligence system for federal defense programs, specifically optimized for DCGS (Distributed Common Ground System) campaigns.

**Target:** Top 0.1% Claude/Claude Code proficiency for BD intelligence operations

## Skills Included

| # | Skill | Trigger Keywords | Purpose |
|---|-------|------------------|---------|
| 1 | **job-standardization** | job scraper, parsing, extraction | LLM prompt engine for 11-field schema |
| 2 | **program-mapping** | federal programs, DCGS, location matching | Multi-signal scoring for job-to-program matching |
| 3 | **contact-classification** | hierarchy tier, BD priority, seniority | 6-tier contact classification system |
| 4 | **bd-outreach-messaging** | BD formula, outreach, cold call | The 6-step BD Formula for personalized messaging |
| 5 | **humint-intelligence** | HUMINT, pain points, intelligence | Tiered approach to intelligence gathering |
| 6 | **federal-defense-programs** | prime contractor, subcontractor, GDIT | Program intelligence and contract details |
| 7 | **notion-bd-operations** | Notion, database, MCP, contacts | Database patterns and bulk operations |
| 8 | **apify-job-scraping** | Apify, job scraper, Puppeteer | Actor selection and cost optimization |
| 9 | **bd-call-sheet** | call sheet, Excel, priority | Excel generation with color-coding |
| 10 | **bd-playbook** | playbook, Word document, executive summary | BD document structure and templates |

## Installation

### Method 1: Claude.ai Project Knowledge

1. Go to your Claude Project
2. Navigate to **Project Knowledge** section
3. Click **Add Content** → **Upload Files**
4. Upload each `SKILL.md` file from the `skills/` folder
5. Skills will automatically trigger based on keywords

### Method 2: Claude Code (Local Skills)

1. Copy skill folders to your Claude Code skills directory:
```bash
cp -r skills/* ~/.claude/skills/
```

2. Skills will be automatically discovered on next Claude Code session

### Method 3: Individual Skill Upload

For specific skills only:
1. Open the skill's `SKILL.md` file
2. Copy the entire contents
3. Paste into Claude Project Knowledge as a new file
4. Name the file with the skill name (e.g., `job-standardization.md`)

## Usage Examples

### Job Standardization
```
User: "Process this batch of scraped jobs from Insight Global and standardize them"
Claude: [Reads job-standardization skill] → Applies 11-field schema extraction
```

### Program Mapping
```
User: "Map these jobs to federal programs and calculate BD scores"
Claude: [Reads program-mapping skill] → Uses location intelligence + multi-signal scoring
```

### Contact Classification
```
User: "Classify this contact by tier and assign BD priority"
Claude: [Reads contact-classification skill] → Applies 6-tier hierarchy logic
```

### BD Outreach
```
User: "Create a personalized outreach message for this PM at Langley"
Claude: [Reads bd-outreach-messaging skill] → Uses 6-step BD Formula
```

### HUMINT Planning
```
User: "Plan our HUMINT gathering approach for the San Diego site"
Claude: [Reads humint-intelligence skill] → Creates tiered contact sequencing
```

### Call Sheet Generation
```
User: "Create a BD call sheet for AF DCGS contacts"
Claude: [Reads bd-call-sheet skill] → Generates Excel with priority coding
```

### Playbook Creation
```
User: "Build a BD playbook for the Army DCGS-A program"
Claude: [Reads bd-playbook skill] → Creates 5-section Word document
```

## Skill Dependencies

Some skills reference each other:

```
bd-call-sheet
├── contact-classification (tier logic)
├── bd-outreach-messaging (personalized messages)
└── federal-defense-programs (pain points)

bd-playbook
├── contact-classification (contact profiles)
├── bd-outreach-messaging (outreach strategies)
├── humint-intelligence (pain point documentation)
└── federal-defense-programs (program intelligence)

program-mapping
├── federal-defense-programs (program reference)
└── contact-classification (location mapping)
```

## Skill Maintenance

### Updating Skills
1. Edit the `SKILL.md` file
2. Re-upload to Project Knowledge (replace existing)
3. Changes take effect immediately

### Version Control
Keep skills in version control:
```bash
git add skills/
git commit -m "Update BD skills - added new pain points"
```

### Testing Skills
After updates, test with sample queries:
- "Classify this contact: John Smith, VP of Operations, San Diego"
- "What are the pain points for AF DCGS PACAF?"
- "Create a personalized message for a Tier 3 PM"

## Integration with Existing System

### Notion Databases
Skills reference these Collection IDs:
- DCGS Contacts Full: `2ccdef65-baa5-8087-a53b-000ba596128e`
- Federal Programs: `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`
- Program Mapping Hub: `f57792c1-605b-424c-8830-23ab41c47137`

### Apify Actors
Skills reference these scrapers:
- `apify/puppeteer-scraper` (competitor portals)
- `curious_coder/linkedin-jobs-scraper` (LinkedIn)
- `valig/indeed-jobs-scraper` (Indeed)

### n8n Workflows
Skills designed to integrate with:
- Apify Job Import Workflow
- Enrichment Processor Workflow
- Priority Alert Notification Workflow

## Best Practices

### DO:
✅ Read relevant skill before starting task
✅ Combine multiple skills for complex workflows
✅ Update skills when processes change
✅ Use exact schema values from skills

### DON'T:
❌ Ignore skill guidance for "faster" approach
❌ Use generic templates when skills provide specific ones
❌ Skip classification steps
❌ Approach executives before HUMINT gathering

## Troubleshooting

### Skill Not Triggering
- Check keyword match in query
- Verify skill uploaded to Project Knowledge
- Use explicit reference: "Using the bd-call-sheet skill..."

### Outdated Information
- Skills contain December 2025 data
- Update pain points and contacts as new HUMINT gathered
- Refresh Notion Collection IDs if databases recreated

### Schema Mismatches
- Verify Notion property names match exactly
- Check select field values include emoji prefix
- Confirm multi-select fields use array format

## Changelog

### v1.0.0 (January 2026)
- Initial release
- 10 core skills for BD intelligence system
- DCGS program focus
- Integration with Notion, Apify, n8n

---

**Created for:** Prime Technical Services BD Intelligence System
**Optimized for:** Claude.ai and Claude Code
**Target:** Top 0.1% user proficiency
