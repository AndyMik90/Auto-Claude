# Required Data Exports

This document lists all files and data exports needed for the BD Automation Engine. Updated after January 2026 data import.

## Status Checklist

Use this checklist to track what you've exported:

### Core Databases
- [x] **Federal Programs Database** (CSV) - `Programs_KB.csv` ADDED
- [x] **DCGS Contacts Full Database** (CSV) - `DCGS_Contacts.csv` ADDED (6,288 contacts)
- [x] **DCGS Contacts Sorted** (CSV) - `DCGS Contact Sorted.csv` ADDED
- [x] **GDIT Other Contacts Database** (CSV) - `GDIT_Other_Contacts.csv` ADDED
- [x] **GDIT PTS Contacts** (CSV) - `GDIT PTS Contacts.csv` ADDED
- [x] **Contractors Database** (CSV) - `Contractors.csv` ADDED
- [x] **Contract Vehicles Database** (CSV) - `Contract_Vehicles.csv` ADDED

### Additional Contact Databases
- [x] **GBSD Contact Chart** (CSV) - `GBSD Contact Chart Updated 9 4.csv` ADDED
- [x] **Lockheed Martin Contacts** (CSV) - `Lockheed Contact.csv` ADDED

### Job Data
- [x] **GDIT Jobs** (CSV) - `GDIT Jobs 2.csv` ADDED
- [x] **Insight Global Jobs - Program Mapped** (CSV) - ADDED
- [x] **Program Mapping Intelligence Hub** (CSV) - ADDED
- [x] **BD Opportunities** (CSV) - ADDED

### n8n Workflows
- [x] **17 n8n Workflows** (JSON) - ALL ADDED including:
  - PTS BD WF1-WF6 (Job Intake, Enrichment, BD Ops, Classification, Alerts, Reports)
  - Prime TS BD Intelligence System v2.1
  - AI Agent workflow, Agent Logger, Error Logging
  - Clearance Job RAG Agent, Firecrawl Search Agent
  - Federal Programs Data Fix, Apify Integration

### Claude Conversation Exports
- [x] **20+ Claude Exports** (Markdown) - ALL ADDED including:
  - DCGS BD Intelligence System conversations
  - Apify MCP Server Audit
  - Job Scraper Engine Optimization
  - Program Mapping Engine exports
  - PTS BD Skills Master Audit
  - Notion MCP Integration Documentation

### Scraper Data
- [x] **Apify Input Configurations** (JSON) - 3 variants ADDED
- [x] **Puppeteer Scraper Outputs** (JSON/CSV) - 10 dataset files ADDED

---

## Current Data Inventory

### Engine 1: Scraper Data
| File | Records | Date | Source |
|------|---------|------|--------|
| dataset_puppeteer-scraper_2025-12-17.csv | 176 | Dec 2025 | ClearanceJobs |
| dataset_puppeteer-scraper_2026-01-05.json | 325 | Jan 5 | Insight Global |
| dataset_puppeteer-scraper_2026-01-06.json | 1,209 | Jan 6 | Apex Systems |
| dataset_puppeteer-scraper_2026-01-08_*.json | 650-1,105 | Jan 8 | Multiple (5 files) |

### Engine 2: Program Mapping Data
| File | Records | Description |
|------|---------|-------------|
| Programs_KB.csv | 402 lines | Federal Programs database |
| Contractors.csv | 16 lines | Contractor companies |
| Contract_Vehicles.csv | 10 lines | Contract vehicles |
| GDIT Jobs 2.csv | 701 lines | GDIT job postings |
| Program Mapping Intelligence Hub.csv | 568 lines | Enriched job data |
| BD Opportunities.csv | 4 lines | BD pipeline |

### Engine 3: Contact Data
| File | Records | Description |
|------|---------|-------------|
| DCGS_Contacts.csv | 6,288 lines | Full DCGS contacts |
| DCGS Contact Sorted.csv | 1,199 lines | Filtered/sorted view |
| GDIT_Other_Contacts.csv | 1,053 lines | Other GDIT contacts |
| GDIT PTS Contacts.csv | 343 lines | PTS-specific contacts |
| GBSD Contact Chart.csv | 73 lines | GBSD program contacts |
| Lockheed Contact.csv | 1,641 lines | Lockheed Martin contacts |

---

## File Locations

### Contacts (Engine 3)
All contact databases are now correctly located in:
```
Engine3_OrgChart/data/
├── DCGS_Contacts.csv
├── DCGS_ContactsAll.csv
├── DCGS Contact Sorted.csv
├── DCGS Contact SortedAll.csv
├── GDIT_Other_Contacts.csv
├── GDIT Other ContactsAll.csv
├── GDIT PTS Contacts.csv
├── GDIT PTS Contacts All.csv
├── GBSD Contact Chart Updated 9 4.csv
├── GBSD Contact Chart Updated 9 4 All.csv
├── Lockheed Contact.csv
└── Lockheed ContactAll.csv
```

### Programs & Jobs (Engine 2)
Program, contractor, and job data in:
```
Engine2_ProgramMapping/data/
├── Programs_KB.csv
├── Contractors.csv
├── Contract_Vehicles.csv
├── GDIT Jobs 2.csv
├── Program Mapping Intelligence Hub.csv
├── BD Opportunities.csv
└── Insight Global Jobs - Program Mapped (Dec 2025).csv
```

### n8n Workflows
All 17 workflows in:
```
n8n/
├── PTS_BD_WF1_Apify_Job_Scraper_Intake.json
├── PTS_BD_WF2_AI_Enrichment_Processor.json
├── PTS_BD_WF3_Hub_to_BD_Opportunities.json
├── PTS_BD_WF4_Contact_Classification.json
├── PTS_BD_WF5_Hot_Lead_Alerts.json
├── PTS_BD_WF6_Weekly_Summary_Report.json
├── Prime_TS_BD_Intelligence_System_v2.1.json
└── ... (10 more utility workflows)
```

### Claude Exports
All 20+ exports in:
```
docs/Claude Exports/
├── DCGS_BD_Intelligence_System_*.md
├── Apify_MCP_Server_Audit_*.md
├── Job_Scraper_Engine_Optimization_*.md
├── ProgramMappingEngine_*.md
├── PTS_BD_Skills_Master_Audit_*.md
└── ... (15+ more exports)
```

---

## Data Schema Reference

### Notion Collection IDs (Verified)
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

---

## Still Needed (Optional)

The following are optional enhancements:

- [ ] **ZoomInfo Contact Exports** - For contact enrichment
- [ ] **LinkedIn Sales Navigator Exports** - For relationship mapping
- [ ] **Bullhorn CRM Export** - If using CRM integration
- [ ] **Additional Apify Actor Results** - For expanded job coverage

---

## Data Quality Notes

### Contact Data Quality
- DCGS Contacts: 6,288 entries with hierarchy tiers assigned
- GDIT Other: 1,053 entries with location mapping
- Lockheed: 1,641 entries (needs hierarchy classification)

### Program Data Quality
- Federal Programs: 402 entries with DCGS focus
- Contractors: 16 major contractors mapped
- Contract Vehicles: 10 vehicles tracked

### Job Data Quality
- Multiple scraper runs from Dec 2025 - Jan 2026
- Insight Global and Apex Systems data included
- Program mapping partially complete

---

## Next Steps

1. **Verify API Keys** - Add to `.env` file:
   - ANTHROPIC_API_KEY
   - OPENAI_API_KEY
   - APIFY_API_TOKEN
   - NOTION_TOKEN

2. **Test Pipeline** - Run with sample data:
   ```bash
   python Engine2_ProgramMapping/scripts/program_mapper.py --test
   ```

3. **Import n8n Workflows** - Load the 6 core PTS BD workflows

4. **Configure Apify Actors** - Use the input JSON files as templates

See [SETUP_GUIDE.md](./SETUP_GUIDE.md) for complete instructions.
