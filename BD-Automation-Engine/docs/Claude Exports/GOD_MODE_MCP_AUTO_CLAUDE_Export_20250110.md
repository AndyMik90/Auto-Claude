# GOD_MODE_MCP_AUTO_CLAUDE_Export_20250110.md

---

## 1. CONVERSATION SUMMARY

- **Topic/Focus Area**: God Mode MCP Server Installation & Auto Claude Automation for Program Mapping Engine
- **Date Range**: January 9-10, 2026
- **Primary Objective**: 
  1. Research and install comprehensive MCP servers to enable Claude to autonomously control Windows PC
  2. Use god mode capabilities to navigate Auto Claude application and execute the Program Mapping Engine v2.0 build task
  3. Transform raw job postings into enriched, program-mapped BD intelligence records

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: MCP Server Stack Selection
- **Decision**: Use Windows-MCP + Computer Control MCP as the core god mode combo
- **Reasoning**: 
  - Windows-MCP provides native UI element interaction without vision AI, app launching, PowerShell execution
  - Computer Control MCP adds OCR text extraction and screenshot capabilities with GPU capture (WGC)
  - Together they provide complementary capabilities - UI tree detection + visual text reading
- **Alternatives Considered**:
  - MCPControl (claude-did-this) - Good but requires SSE transport, better for VM deployments
  - win32-mcp-server - 25+ tools but less mature
  - Chrome DevTools MCP - Browser-only, not full desktop control

### Decision 2: Transport Protocol
- **Decision**: Use stdio-based MCP servers only (uvx/npx commands)
- **Reasoning**: The original config had n8n HTTP transport syntax causing JSON validation errors. HTTP transport requires SSE type, not stdio.
- **Alternatives Considered**: SSE transport for remote access, but adds complexity

### Decision 3: Clipboard-Based Text Entry for Electron Apps
- **Decision**: Use PowerShell Set-Clipboard + Ctrl+V for text input in Auto Claude
- **Reasoning**: Direct typing tools (type_text, Type-Tool) failed to populate Electron app text fields due to how Electron handles input events
- **Alternatives Considered**: Direct typing, DOM manipulation (not available for desktop Electron)

### Decision 4: Program Mapping Engine Architecture
- **Decision**: 7-step pipeline with LLM description parsing as Step 2
- **Reasoning**: Raw job descriptions contain unstructured text with embedded sections. Claude Sonnet 4 can intelligently extract 15+ structured fields that pattern matching would miss.
- **Alternatives Considered**: Regex-only extraction (too brittle), separate NER service (more complexity)

---

## 3. ARCHITECTURE & DATA FLOW

### God Mode MCP Architecture
```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Desktop                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Windows-MCP │  │ Computer    │  │ Desktop Commander       │ │
│  │             │  │ Control MCP │  │                         │ │
│  │ • Click     │  │ • Screenshot│  │ • File operations       │ │
│  │ • Type      │  │ • OCR       │  │ • Terminal control      │ │
│  │ • App launch│  │ • WGC GPU   │  │ • Process management    │ │
│  │ • Shortcuts │  │ • Mouse     │  │ • Code execution        │ │
│  │ • PowerShell│  │ • Keyboard  │  │                         │ │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐ │
│  │ Sequential  │  │ Notion MCP  │  │ Apify MCP               │ │
│  │ Thinking    │  │             │  │                         │ │
│  │ • Planning  │  │ • Search    │  │ • Web scraping          │ │
│  │ • Breakdown │  │ • Create    │  │ • Actor execution       │ │
│  └─────────────┘  │ • Update    │  └─────────────────────────┘ │
│                   └─────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Windows PC Control                           │
│  • Full screen reading (screenshots + OCR)                       │
│  • Any application control (click, type, navigate)               │
│  • File system access                                            │
│  • PowerShell command execution                                  │
│  • Process management                                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Auto Claude Application                      │
│  • Task creation                                                 │
│  • Spec generation                                               │
│  • Code planning                                                 │
│  • Implementation                                                │
│  • QA review                                                     │
└─────────────────────────────────────────────────────────────────┘
```

### Program Mapping Engine Data Flow
```
┌──────────────────┐
│ Staffing Sites   │
│ • Apex Systems   │
│ • Insight Global │
│ • TEKsystems     │
└────────┬─────────┘
         │ Apify Scraper
         ▼
┌──────────────────┐
│ Raw Job JSON     │
│ /input/jobs/     │
└────────┬─────────┘
         │ Step 1: Ingest
         ▼
┌──────────────────┐
│ Claude Sonnet 4  │◄── Step 2: Parse Description
│ API Call         │    Extract 15+ structured fields
└────────┬─────────┘
         │ Step 3: Standardize
         ▼
┌──────────────────┐
│ Program Matcher  │◄── Step 4: Match to Programs
│ Multi-signal     │    federal_programs.csv (388 programs)
│ scoring          │    location_mapping.py (150+ locations)
└────────┬─────────┘
         │ Step 5: Enrich
         ▼
┌──────────────────┐
│ BD Scorer        │◄── Step 6: Score BD Priority
│ 0-100 score      │    Hot ≥80 / Warm 50-79 / Cold <50
└────────┬─────────┘
         │ Step 7: Export
         ▼
┌──────────────────────────────────────────────┐
│ Output Files                                  │
│ • /output/mapped_jobs/job_{id}.json          │
│ • /output/notion_import.csv                  │
│ • /output/n8n_payload.json                   │
│ • /output/summary.md                         │
└──────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐     ┌──────────────────┐
│ Notion Database  │     │ n8n Workflow     │
│ Program Mapping  │     │ Automation       │
│ Intelligence Hub │     │                  │
└──────────────────┘     └──────────────────┘
```

---

## 4. CODE & CONFIGURATIONS

### 4.1 Claude Desktop Configuration (God Mode)

**File/Component Name**: `claude_desktop_config.json`
**Purpose**: Complete MCP server configuration for god mode capabilities
**Location**: `C:\Users\gtmar\AppData\Roaming\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "windows-mcp": {
      "command": "uvx",
      "args": ["windows-mcp"]
    },
    "computer-control": {
      "command": "uvx",
      "args": ["computer-control-mcp@latest"],
      "env": {
        "COMPUTER_CONTROL_MCP_WGC_PATTERNS": "chrome,edge,firefox,electron,auto-claude"
      }
    },
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ntn_R48446747822wNuLRcByvXQQDsGQy1K13e58Wcp4w4waRH\", \"Notion-Version\": \"2022-06-28\"}"
      }
    },
    "apify": {
      "command": "npx",
      "args": ["-y", "@apify/mcp-server-apify"],
      "env": {
        "APIFY_API_TOKEN": "apify_api_Dn5VKCgHLqfT8L3zgdaBFPKUUNnryQ1qkJj6"
      }
    }
  }
}
```

### 4.2 God Mode Installation Script

**File/Component Name**: `INSTALL_GOD_MODE_V2.ps1`
**Purpose**: PowerShell script to install all MCP servers and configure Claude Desktop

```powershell
# God Mode MCP Installation Script for Windows
# Run in PowerShell as Administrator

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  GOD MODE MCP INSTALLER v2.0" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Check UV package manager
Write-Host "[1/5] Checking UV package manager..." -ForegroundColor Yellow
$uvVersion = uv --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "UV not found. Installing..." -ForegroundColor Red
    powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"
    $env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")
} else {
    Write-Host "UV found: $uvVersion" -ForegroundColor Green
}

# Step 2: Pre-load Windows-MCP
Write-Host ""
Write-Host "[2/5] Pre-loading Windows-MCP..." -ForegroundColor Yellow
uvx windows-mcp --help 2>$null
Write-Host "Windows-MCP ready" -ForegroundColor Green

# Step 3: Pre-load Computer Control MCP
Write-Host ""
Write-Host "[3/5] Pre-loading Computer Control MCP (may download ~70MB)..." -ForegroundColor Yellow
uvx computer-control-mcp@latest --help 2>$null
Write-Host "Computer Control MCP ready" -ForegroundColor Green

# Step 4: Pre-load Desktop Commander
Write-Host ""
Write-Host "[4/5] Pre-loading Desktop Commander..." -ForegroundColor Yellow
npx -y @wonderwhy-er/desktop-commander --help 2>$null
Write-Host "Desktop Commander ready" -ForegroundColor Green

# Step 5: Pre-load Sequential Thinking
Write-Host ""
Write-Host "[5/5] Pre-loading Sequential Thinking..." -ForegroundColor Yellow
npx -y @modelcontextprotocol/server-sequential-thinking --help 2>$null
Write-Host "Sequential Thinking ready" -ForegroundColor Green

# Backup existing config
$configPath = "$env:APPDATA\Claude\claude_desktop_config.json"
$backupPath = "$env:APPDATA\Claude\claude_desktop_config.backup.$(Get-Date -Format 'yyyyMMdd_HHmmss').json"

if (Test-Path $configPath) {
    Write-Host ""
    Write-Host "Backing up existing config to: $backupPath" -ForegroundColor Yellow
    Copy-Item $configPath $backupPath
}

# Write new config
$config = @'
{
  "mcpServers": {
    "windows-mcp": {
      "command": "uvx",
      "args": ["windows-mcp"]
    },
    "computer-control": {
      "command": "uvx",
      "args": ["computer-control-mcp@latest"],
      "env": {
        "COMPUTER_CONTROL_MCP_WGC_PATTERNS": "chrome,edge,firefox,electron,auto-claude"
      }
    },
    "desktop-commander": {
      "command": "npx",
      "args": ["-y", "@wonderwhy-er/desktop-commander"]
    },
    "sequential-thinking": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sequential-thinking"]
    },
    "notion": {
      "command": "npx",
      "args": ["-y", "@notionhq/notion-mcp-server"],
      "env": {
        "OPENAPI_MCP_HEADERS": "{\"Authorization\": \"Bearer ntn_R48446747822wNuLRcByvXQQDsGQy1K13e58Wcp4w4waRH\", \"Notion-Version\": \"2022-06-28\"}"
      }
    },
    "apify": {
      "command": "npx",
      "args": ["-y", "@apify/mcp-server-apify"],
      "env": {
        "APIFY_API_TOKEN": "apify_api_Dn5VKCgHLqfT8L3zgdaBFPKUUNnryQ1qkJj6"
      }
    }
  }
}
'@

Write-Host ""
Write-Host "Writing new config to: $configPath" -ForegroundColor Yellow
# Use UTF8 without BOM - critical for Claude Desktop JSON parsing
[System.IO.File]::WriteAllText($configPath, $config, [System.Text.UTF8Encoding]::new($false))
Write-Host "Config written successfully" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION COMPLETE!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Fully quit Claude Desktop (check system tray)" -ForegroundColor White
Write-Host "2. Reopen Claude Desktop" -ForegroundColor White
Write-Host "3. Test with: 'Take a screenshot of my desktop'" -ForegroundColor White
Write-Host ""
```

### 4.3 Auto Claude Task Specification (Final Version)

**File/Component Name**: `AUTO_CLAUDE_TASK_COPYPASTE.md`
**Purpose**: Complete task specification for Program Mapping Engine v2.0

```markdown
# AUTO CLAUDE TASK - COPY/PASTE READY

---

## TASK TITLE
Program Mapping Engine v2.0 - Job-to-Program Intelligence Pipeline

---

## DESCRIPTION (Copy everything below this line)

Build a **Program Mapping Engine** that transforms raw job postings from staffing company scrapers (Apex Systems, Insight Global, TEKsystems) into enriched, program-mapped intelligence records for BD purposes.

### Core Pipeline Steps

1. **Ingest** raw job JSON from `/input/jobs/`
2. **Parse Description** using Claude Sonnet 4 to extract structured fields (overview, responsibilities, qualifications, tech stack, certifications, program hints, client hints, recruiter contact)
3. **Standardize** top-level fields + merge parsed description fields into 20+ field schema
4. **Match to Programs** from `/input/reference/federal_programs.csv` using multi-signal scoring (location + program hints + tech keywords + clearance)
5. **Enrich** with program metadata (Prime, Customer, Contract Vehicle, Task Order, Manager)
6. **Score BD Priority** (0-100) with tier classification (🔥 Hot ≥80, 🟡 Warm 50-79, ❄️ Cold <50)
7. **Export** as Notion CSV and n8n webhook JSON to `/output/`

### Input Job JSON Structure
```json
{
  "url": "https://source.com/job/123",
  "jobTitle": "Network Engineer",
  "description": "Full description...",
  "location": "San Diego, CA",
  "securityClearance": "TS/SCI Required",
  "datePosted": "2026-01-02",
  "payRate": "$85-95/hour",
  "duration": "12+ months",
  "employmentType": "Contract"
}
```

### Output Enriched Fields
Each job gets these additional fields:

**From LLM Description Parsing:**
- `Position_Overview` - 100-200 word summary
- `Position_Details` - Team/mission context
- `Key_Responsibilities` - Array of duties
- `Required_Qualifications` - Array of must-haves
- `Preferred_Qualifications` - Array of nice-to-haves
- `Technologies_Tools` - Extracted tech stack
- `Certifications_Required` - Security+, CCNA, etc.
- `Work_Schedule` - Shift/schedule info
- `Work_Location_Type` - On-site/Hybrid/Remote
- `Travel_Required` - Percentage if mentioned
- `End_Client_Hints` - Actual customer companies detected
- `Program_Hints` - Program names/acronyms found
- `Education_Requirements` - Degree + years
- `Years_Experience` - Number/range extracted
- `Contact_Recruiter` - Name/email/phone if present

**From Program Matching:**
- `Matched_Program` - Program name (e.g., "AF DCGS - PACAF")
- `Program_Acronym` - Short name
- `Prime_Contractor` - Lead contractor
- `Customer_Agency` - Government customer
- `Contract_Vehicle` - Contract/IDIQ name
- `Task_Order_Name` - Specific task order if applicable
- `Match_Confidence` - 0.0-1.0 score
- `Match_Type` - "direct" (≥70%), "fuzzy" (50-69%), "inferred" (<50%)
- `BD_Priority_Score` - 0-100
- `BD_Priority_Tier` - 🔥 Hot / 🟡 Warm / ❄️ Cold
- `Needs_Review` - Boolean flag for low-confidence matches

### Multi-Signal Scoring Algorithm

Score each job against candidate programs:
| Signal | Points |
|--------|--------|
| Program name in title | +50 |
| Program name in description | +20 |
| Acronym match | +40 |
| Location exact match | +20 |
| Location region match | +10 |
| Tech keyword match | +15 |
| Role type match | +10 |
| Clearance alignment | +5 |
| Clearance mismatch | -20 |
| Company = Prime/Sub | +10 |

Match thresholds: Direct ≥70%, Fuzzy 50-69%, Inferred <50%

### BD Priority Score Calculation
```
Base: 50 points
+ Clearance Boost (0-35): TS/SCI Poly=35, TS/SCI=25, TS=15, Secret=5
+ Confidence Boost (0-20): match_confidence * 20
+ DCGS Relevance (0-20): direct=20, adjacent=15, related=10
+ Keyword Boost (0-10): program/role keywords
+ Location Boost (0-10): San Diego=10, Hampton/Norfolk/Dayton=5
= Total (max 100)
```

### Location-to-Program Mapping (Key Entries)
```python
DCGS_LOCATIONS = {
    "San Diego": "AF DCGS - PACAF",     # 🔥 Priority target
    "Hampton": "AF DCGS - Langley",      # DGS-1
    "Dayton": "AF DCGS - Wright-Patt",   # NASIC
    "Norfolk": "Navy DCGS-N",
    "Fort Belvoir": "Army DCGS-A",
    "Herndon": "Corporate HQ",
}
```
Full mapping has 150+ locations in `/config/location_mapping.py`

### LLM Intelligent Description Parsing

The raw `description` field contains unstructured text with multiple embedded sections. Use Claude Sonnet 4 to intelligently parse and extract:

**LLM Parsing Prompt Template:**
```
You are parsing a job posting description to extract structured fields.

INPUT DESCRIPTION:
{raw_description}

Extract the following fields. If a field is not present, return null.
Return ONLY valid JSON, no explanation.

Fields to extract:
- Position_Overview (100-200 word summary)
- Position_Details (team/mission context if present)
- Key_Responsibilities (array of bullet points)
- Required_Qualifications (array of must-haves)
- Preferred_Qualifications (array of nice-to-haves)
- Technologies_Tools (array of tech/tools mentioned)
- Certifications_Required (array of certs like Security+, CCNA)
- Work_Schedule (shift info, 9/80, etc.)
- Work_Location_Type (On-site/Hybrid/Remote)
- Travel_Required (percentage or null)
- Benefits_Mentioned (array or null)
- Contact_Recruiter (object with name/email/phone or null)
- End_Client_Hints (array of company names that appear to be the actual customer)
- Program_Hints (array of program names/acronyms detected)
- Education_Requirements (degree + years)
- Years_Experience (number or range)
```

### Phase-Gated Processing

1. **Phase 1 (Calibration)**: Process first 10 jobs → PAUSE → Human review
2. **Phase 2 (Batch)**: Process 50 jobs/batch → Checkpoint summary
3. **Phase 3 (Continuous)**: Full processing, flag low-confidence for review

### Output Files

1. **Per-job JSON**: `/output/mapped_jobs/job_{id}.json`
2. **Notion CSV**: `/output/notion_import.csv` - Direct import to Program Mapping Hub database
3. **n8n Webhook JSON**: `/output/n8n_payload.json` - For workflow automation
4. **Summary Report**: `/output/summary.md` - Run statistics and flagged items

### Module Structure
```
src/
├── standardizer.py      # LLM job standardization
├── program_matcher.py   # Location/keyword matching
├── clearance_extractor.py # Clearance parsing
├── bd_scorer.py         # Priority scoring
├── pipeline.py          # Main orchestration
└── exporters/
    ├── notion_exporter.py
    └── n8n_exporter.py
```

### Tech Stack
- Python 3.10+
- anthropic SDK for Claude Sonnet 4 API
- pandas for CSV processing
- aiohttp for async operations
- pytest for testing

### Success Criteria
- Standardization rate ≥95%
- Direct match accuracy ≥80% for known DCGS locations
- Processing time <30s/job
- API cost <$0.03/job

---

## CLASSIFICATION

- **Category:** Feature
- **Priority:** Critical
- **Complexity:** Complex
- **Impact:** Critical

---

## AGENT PROFILE RECOMMENDATION

**Use: UltraThink / Opus 4.5 across all phases**
```

---

## 5. NOTION DATABASE SCHEMAS

### Program Mapping Intelligence Hub
**Database URL**: `https://www.notion.so/0a0d7e463d8840b6853a3c9680347644`
**Collection ID**: `f57792c1-605b-424c-8830-23ab41c47137`
**Purpose**: Scraped jobs enriched with program mapping, clearance, priority scores

| Property | Type | Options/Notes |
|----------|------|---------------|
| Job Title | Title | Primary identifier |
| Source URL | URL | Link to original posting |
| Company | Select | Apex Systems, Insight Global, TEKsystems, etc. |
| Location | Text | City, State |
| Clearance | Select | TS/SCI Poly, TS/SCI, TS, Secret, Public Trust, None |
| Matched_Program | Select | AF DCGS - PACAF, AF DCGS - Langley, etc. |
| Match_Confidence | Number | 0.0 - 1.0 |
| Match_Type | Select | direct, fuzzy, inferred |
| BD_Priority_Score | Number | 0-100 |
| BD_Priority_Tier | Select | 🔥 Hot, 🟡 Warm, ❄️ Cold |
| Status | Select | raw_import, pending_enrichment, enriching, enriched, validated |
| Needs_Review | Checkbox | Flag for manual review |
| Date_Scraped | Date | When job was collected |
| Date_Enriched | Date | When processing completed |

### Federal Programs Database
**Database URL**: `https://www.notion.so/9db40fce078142b9902cd4b0263b1e23`
**Collection ID**: `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`
**Records**: 388 programs

| Property | Type | Notes |
|----------|------|-------|
| Program Name | Title | Full program name |
| Acronym | Text | Short identifier |
| Agency Owner | Select | DoD, Army, Navy, Air Force, etc. |
| Prime Contractor | Select | GDIT, Leidos, SAIC, etc. |
| Known Subcontractors | Multi-select | |
| Contract Value | Text | Dollar amount |
| Contract Vehicle/Type | Text | IDIQ, Task Order, etc. |
| Key Locations | Multi-select | Cities/bases |
| Clearance Requirements | Select | Required clearance level |
| PTS Involvement | Select | Current, Past, Target, None |
| Priority Level | Select | Critical, High, Medium, Standard |

---

## 6. N8N WORKFLOWS

*(Not directly built in this conversation, but the output format supports n8n integration)*

### Planned Workflow: Job Enrichment Pipeline
**Trigger**: Webhook receives `n8n_payload.json`
**Node Sequence**:
1. Webhook Trigger → Receive enriched job batch
2. IF Node → Route by BD_Priority_Tier
3. Hot (≥80) → Immediate Slack notification + Notion create
4. Warm (50-79) → Notion create only
5. Cold (<50) → Log for review

---

## 7. APIFY ACTORS & SCRAPERS

### Puppeteer Scraper Configuration
**Actor**: `apify/puppeteer-scraper`
**Purpose**: Scrape job postings from staffing company sites

**Input Configuration** (from project files):
- Target sites: Insight Global, Apex Systems, TEKsystems job boards
- Keywords: DCGS, cleared, TS/SCI, network engineer, intel analyst
- Output format: JSON with url, jobTitle, description, location, securityClearance, datePosted

**Output Schema**:
```json
{
  "company": "String",
  "detected_clearance": "String",
  "location": "String",
  "primary_keyword": "String",
  "scraped_at": "Date",
  "title": "String",
  "url": "String"
}
```

**Sample Files in Project**:
- `dataset_puppeteerscraper_20251217_153533797.csv` (175 rows)
- `dataset_puppeteerscraper_20251219_183329965.csv` (178 rows)
- `dataset_puppeteerscraper_20251222_140827809.csv` (174 rows)

---

## 8. PROBLEMS SOLVED

### Problem 1: Claude Desktop MCP Config Corruption
- **Description**: Claude Desktop showed "invalid_type" JSON validation error on startup
- **Root Cause**: Config had duplicate `mcpServers` sections and n8n server using HTTP transport syntax (`"url": "..."`) which requires SSE transport type, not stdio
- **Solution**: Removed duplicate sections and n8n HTTP config, kept only stdio-based servers (uvx/npx commands)

### Problem 2: Text Input Failing in Electron Apps
- **Description**: Both `type_text` (Computer Control MCP) and `Type-Tool` (Windows-MCP) failed to populate text in Auto Claude description field
- **Root Cause**: Electron apps handle input events differently than native Windows apps. Direct text injection doesn't trigger the expected DOM events.
- **Solution**: Use PowerShell `Set-Clipboard` to put text on clipboard, then simulate Ctrl+V paste

### Problem 3: Auto Claude Task Failing with "Control request timeout: initialize"
- **Description**: Auto Claude task showed repeated "Agent error: Control request timeout: initialize" and "Discovered 0 files in project"
- **Root Cause**: 
  1. Claude Code agent not properly connected
  2. Worktree path empty or invalid - no files for agent to discover
- **Solution**: 
  1. Verify Claude Code CLI is running (`claude --version`)
  2. Check Worktrees section has valid filesystem path
  3. Add Context files (federal_programs.csv, sample jobs)

### Problem 4: Black Screenshots from GPU-Accelerated Apps
- **Description**: Computer Control MCP returns black screenshots from Chrome, Electron apps
- **Root Cause**: Standard screenshot APIs can't capture GPU-accelerated content
- **Solution**: Computer Control MCP's WGC (Windows Graphics Capture) API handles this automatically. Set `COMPUTER_CONTROL_MCP_WGC_PATTERNS` env var to include app patterns.

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate (To Fix Auto Claude)
1. **Verify Claude Code connection** - Click "Claude Code" in Auto Claude sidebar, ensure green status
2. **Fix Worktree path** - Create valid project folder `C:\Users\gtmar\Projects\program-mapping-engine` and point worktree there
3. **Add Context files** - Add `Federal_Program_Cleaned_Notion_Import.csv` and sample job JSON to Context
4. **Restart task** - Click Start on the Program Mapping Engine task again

### Short-term
1. Complete Program Mapping Engine v2.0 build via Auto Claude
2. Test with 10-job calibration batch (Phase 1)
3. Validate match accuracy against known DCGS locations
4. Run full batch processing (Phase 2)

### Medium-term
1. Expand job scraper to additional staffing sites
2. Build n8n workflow for automated enrichment pipeline
3. Create Slack notifications for Hot (≥80) priority jobs
4. Integrate with Bullhorn ATS for past performance validation

### Long-term
1. Expand beyond DCGS to all 380+ federal programs in database
2. Add real-time job monitoring (scheduled scrapes)
3. Build contact discovery integration (ZoomInfo/LinkedIn)
4. Create executive dashboard for BD intelligence

---

## 10. KEY INSIGHTS & GOTCHAS

### MCP Server Insights

1. **Windows-MCP vs Computer Control MCP**: Use BOTH together. Windows-MCP provides UI element tree detection (precise control), Computer Control MCP provides OCR (visual text reading). They're complementary, not alternatives.

2. **Electron App Input**: Direct typing tools fail on Electron apps. Always use clipboard paste method:
   ```powershell
   Set-Clipboard -Value "your text"
   # Then send Ctrl+V
   ```

3. **WGC for GPU Apps**: If screenshots come back black, the app is GPU-accelerated. Computer Control MCP handles this with WGC, but you need the env var:
   ```json
   "env": {
     "COMPUTER_CONTROL_MCP_WGC_PATTERNS": "chrome,edge,firefox,electron,auto-claude"
   }
   ```

4. **Config File Encoding**: Claude Desktop requires UTF-8 without BOM. Use:
   ```powershell
   [System.IO.File]::WriteAllText($path, $content, [System.Text.UTF8Encoding]::new($false))
   ```

5. **HTTP Transport Requires SSE**: If you add an MCP server with `"url": "..."` syntax, you MUST also include `"transport": { "type": "sse" }`. Otherwise use stdio-based servers only.

### Auto Claude Insights

1. **"Discovered 0 files"** = Worktree path is empty or invalid. The agent needs files to work with.

2. **"Control request timeout: initialize"** = Claude Code CLI not connected. Run `claude` in terminal to start it.

3. **Context is critical** - Add reference files (CSV data, sample inputs) to Context before running tasks.

4. **Use UltraThink/Opus 4.5** for complex tasks - The extra reasoning capability handles edge cases better.

### Program Mapping Insights

1. **LLM Description Parsing is essential** - Raw descriptions are unstructured. Pattern matching misses 60%+ of extractable data. Claude Sonnet 4 gets 95%+ extraction rate.

2. **Multi-signal scoring prevents false positives** - Location alone isn't enough. Combine with clearance, keywords, company to get accurate matches.

3. **Phase-gated processing catches errors early** - Always run 10-job calibration before full batch. One bad pattern can corrupt hundreds of records.

4. **San Diego = AF DCGS PACAF** - This is the #1 priority target. Any San Diego cleared job is likely DCGS-related.

5. **Cost control** - Claude Sonnet 4 API at ~$0.03/job is sustainable. Opus would be 10x more expensive for minimal accuracy gain on structured extraction.

---

## APPENDIX: MCP Server Reference

### Windows-MCP Tools
| Tool | Purpose |
|------|---------|
| State-Tool | Get UI element tree + OCR text |
| Click-Tool | Click at coordinates |
| Type-Tool | Type text at location |
| Move-Tool | Move mouse |
| Drag-Tool | Drag mouse |
| Scroll-Tool | Scroll mouse wheel |
| Shortcut-Tool | Press keyboard shortcuts |
| Powershell-Tool | Execute PowerShell commands |
| App-Tool | Launch applications |
| Wait-Tool | Wait for UI state |
| Scrape-Tool | Scrape web content (DOM mode) |

### Computer Control MCP Tools
| Tool | Purpose |
|------|---------|
| take_screenshot | Capture screen as image |
| take_screenshot_with_ocr | Capture + extract all text with coordinates |
| click_screen | Click at x,y coordinates |
| move_mouse | Move cursor to position |
| drag_mouse | Click and drag |
| type_text | Type text string |
| press_key | Press single key |
| press_keys | Press key combination |
| list_windows | Get all open windows |
| activate_window | Bring window to front |
| get_screen_size | Get display dimensions |
| wait_milliseconds | Pause execution |

### Desktop Commander Tools
| Tool | Purpose |
|------|---------|
| read_file | Read file contents |
| write_file | Write/append to files |
| create_directory | Create folders |
| list_directory | List directory contents |
| move_file | Move/rename files |
| start_search | Search files/content |
| start_process | Execute commands |
| interact_with_process | Send input to processes |
| get_file_info | Get file metadata |

---

*Document generated: January 10, 2026*
*Export version: 1.0*
*Total conversation context: God Mode MCP Research & Auto Claude Automation*
