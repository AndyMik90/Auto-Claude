# Engine 7: Bullhorn ETL & Past Performance System

Comprehensive ETL (Extract, Transform, Load) pipeline for processing Bullhorn CRM export data to build a Past Performance database by Prime Contractor and Federal Program.

## Overview

Engine 7 processes Bullhorn staffing CRM exports to:
- Extract jobs, placements, contacts, and activities
- Normalize and deduplicate company/prime contractor names
- Build past performance metrics by Prime Contractor
- Map jobs to federal programs and agencies
- Export data to Notion-compatible CSV format

## Data Sources

Processes files from `docs/Bullhorn Exports/`:

| File Type | Description | Records |
|-----------|-------------|---------|
| Leidos Jobs Bullhorn.txt | Newline-separated job records | 1,460 jobs |
| Notes Activity Reports | Activity notes with contacts | 22,213 activities |
| Client Visits Reports | Salesperson/contact visits | 18,162 visits |
| Placements Reports | Placement history with financials | 2,202 placements |
| Submissions Reports | Job submission tracking | 236 submissions |

## Database Schema

SQLite database (`data/bullhorn_master.db`) with:

### Core Tables
- **jobs** - Job orders from Leidos
- **placements** - Placement records with company, candidate, rates
- **candidates** - Contact/candidate records (44,745 records)
- **activities** - Notes and client visits

### Business Development Tables
- **prime_contractors** - Normalized company names with categories
- **programs** - Federal programs (DCGS, MDA, DISA, etc.)
- **past_performance** - Aggregated metrics by prime

## Scripts

| Script | Purpose |
|--------|---------|
| `bullhorn_etl_v2.py` | Main ETL processor |
| `database_schema.py` | Database creation and schema |
| `data_cleanup.py` | Company name normalization |
| `program_mapper.py` | Federal program extraction |
| `past_performance_report.py` | Past performance report generation |
| `export_to_notion.py` | Notion CSV export |

## Usage

```bash
# Run full ETL pipeline
cd Engine7_BullhornETL/scripts
python bullhorn_etl_v2.py

# Run data cleanup/normalization
python data_cleanup.py

# Generate past performance reports
python past_performance_report.py

# Map programs to jobs
python program_mapper.py

# Export to Notion
python export_to_notion.py
```

## Output Files

Generated in `outputs/`:

| File | Description |
|------|-------------|
| `etl_report_v2_*.json` | Full ETL run report |
| `defense_primes_past_performance_*.json` | Defense prime analysis |
| `defense_primes_summary_*.csv` | Defense prime summary |
| `all_companies_summary_*.csv` | All companies summary |
| `program_mapping_*.json` | Program mapping results |
| `notion_*.csv` | Notion-compatible exports |

## Key Metrics (Current Data)

### Defense Prime Contractors
| Prime | Placements | Jobs | Date Range |
|-------|------------|------|------------|
| Leidos | 209 | 135 | 2015-2026 |
| General Dynamics IT | 123 | 0 | 2015-2025 |
| Peraton | 72 | 0 | 2018-2025 |
| Dell Federal Services | 31 | 0 | 2015-2017 |
| Boeing | 13 | 0 | 2022-2025 |
| CACI International | 3 | 0 | 2024 |
| Northrop Grumman | 3 | 0 | 2022-2023 |
| Lockheed Martin | 1 | 0 | 2024 |
| Amentum | 1 | 0 | 2023 |

**Total Defense Prime Placements: 456**

### All Companies
- 41 unique companies
- 2,202 total placements
- $4.58M estimated revenue
- 44,745 contacts in database

## Data Flow

```
Bullhorn Exports (XLS/TXT)
        │
        ▼
┌───────────────────┐
│  bullhorn_etl_v2  │ ─────► SQLite Database
└───────────────────┘
        │
        ▼
┌───────────────────┐
│   data_cleanup    │ ─────► Normalized Names
└───────────────────┘
        │
        ▼
┌───────────────────┐
│  program_mapper   │ ─────► Program Mappings
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ past_performance  │ ─────► JSON/CSV Reports
└───────────────────┘
        │
        ▼
┌───────────────────┐
│ export_to_notion  │ ─────► Notion CSVs
└───────────────────┘
```

## Requirements

```
pandas>=2.0.0
openpyxl>=3.1.0
xlrd>=2.0.1
tqdm>=4.65.0
```

## Integration with Other Engines

- **Engine 2 (Program Mapping)**: Uses program patterns for job classification
- **Engine 3 (OrgChart)**: Contacts feed into contact classification
- **Engine 5 (Scoring)**: Past performance metrics feed into BD scoring
- **Notion**: CSV exports ready for database import

## Notes

- Duplicate files are automatically detected via MD5 hash
- Empty files are skipped
- Company names are normalized to standard forms
- Date range: 2008-2026 (primary activity 2015-2026)
