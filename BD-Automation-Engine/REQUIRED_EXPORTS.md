# Required Data Exports

This document lists all files and data exports you need to provide to complete the BD Automation Engine setup.

## Status Checklist

Use this checklist to track what you've exported:

- [ ] **Federal Programs Database** (CSV)
- [ ] **DCGS Contacts Database** (CSV)
- [ ] **GDIT Other Contacts Database** (CSV)
- [ ] **Contractors Database** (CSV)
- [ ] **Contract Vehicles Database** (CSV)
- [ ] **Existing n8n Workflows** (JSON) - if applicable
- [ ] **Claude Conversation Exports** (Markdown) - optional but recommended

---

## 1. Federal Programs Database Export

**Source:** Notion - Federal Programs Database
**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`
**Destination:** `Engine2_ProgramMapping/data/Programs_KB.csv`

### Required Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| Program Name | Text | Full program name | AF DCGS |
| Acronym | Text | Common abbreviation | DCGS |
| Agency Owner | Select | Owning agency | USAF/ACC |
| Prime Contractor | Select | Primary contractor | BAE Systems |
| Known Subcontractors | Multi-select | List of subs | GDIT, Leidos, SAIC |
| Contract Value | Number | Estimated value | ~500M |
| Contract Vehicle | Text | Vehicle name | AFLCMC SOF GLSS |
| Key Locations | Multi-select | Work locations | Langley VA, San Diego CA |
| Clearance Requirements | Select | Required clearance | TS/SCI |
| Typical Roles | Multi-select | Common positions | Intelligence Analysts, Network Engineers |
| Keywords | Text | Search keywords | dcgs, isr, 480th |
| PTS Involvement | Select | Current status | Current Subcontractor |
| Priority Level | Select | BD priority | Critical |
| Pain Points | Text | Known issues | PACAF understaffed |
| Notes | Text | Additional info | Option Year 2 |

### How to Export

1. Open Federal Programs database in Notion
2. Click `...` menu > **Export**
3. Select **CSV** format
4. Download and rename to `Programs_KB.csv`
5. Place in `Engine2_ProgramMapping/data/`

---

## 2. DCGS Contacts Database Export

**Source:** Notion - DCGS Contacts Full Database
**Collection ID:** `2ccdef65-baa5-8087-a53b-000ba596128e`
**Destination:** `Engine3_OrgChart/data/DCGS_Contacts.csv`

### Required Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| Name | Title | Full name | John Smith |
| Job Title | Text | Current title | Program Manager |
| Email Address | Email | Work email | john.smith@bae.com |
| Phone | Phone | Work phone | 555-123-4567 |
| LinkedIn URL | URL | Profile link | linkedin.com/in/... |
| Company | Select | Employer | BAE Systems |
| Program | Select | Primary program | AF DCGS - Langley |
| Location | Text | Work location | Hampton, VA |
| Clearance | Select | Clearance level | TS/SCI |
| Hierarchy Tier | Select | Classification | Tier 3 - Program Leadership |
| BD Priority | Select | Outreach priority | High |
| Location Hub | Select | Geographic hub | Hampton Roads |
| Functional Area | Multi-select | Job function | Program Management |
| Last Contact Date | Date | Last interaction | 2025-01-01 |
| Notes | Text | Intel/context | Key decision maker |
| Source | Select | How identified | LinkedIn |

### How to Export

1. Open DCGS Contacts Full database in Notion
2. Filter to active contacts if desired
3. Click `...` menu > **Export** > **CSV**
4. Download and rename to `DCGS_Contacts.csv`
5. Place in `Engine3_OrgChart/data/`

---

## 3. GDIT Other Contacts Database Export

**Source:** Notion - GDIT Other Contacts Database
**Collection ID:** `70ea1c94-211d-40e6-a994-e8d7c4807434`
**Destination:** `Engine3_OrgChart/data/GDIT_Other_Contacts.csv`

### Required Columns

Same schema as DCGS Contacts above.

### How to Export

Same process as DCGS Contacts.

---

## 4. Contractors Database Export

**Source:** Notion - Contractors Database
**Collection ID:** `3a259041-22bf-4262-a94a-7d33467a1752`
**Destination:** `Engine2_ProgramMapping/data/Contractors.csv`

### Required Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| Company Name | Title | Legal name | BAE Systems |
| Aliases | Text | Other names | BAE, BAE Systems Inc |
| Primary Focus | Multi-select | Core capabilities | ISR, EW, Cyber |
| Key Programs | Relation | Programs involved | AF DCGS |
| GDIT Relationship | Select | Teaming status | Sub to BAE |
| Strengths | Text | Competitive advantages | ISR market leader |
| Weaknesses | Text | Known gaps | Limited Army presence |
| Key Contacts | Relation | Linked contacts | (relation) |
| Notes | Text | Additional intel | Primary competitor for... |

### How to Export

1. Open Contractors database in Notion
2. Click `...` menu > **Export** > **CSV**
3. Download and place in `Engine2_ProgramMapping/data/`

---

## 5. Contract Vehicles Database Export

**Source:** Notion - Contract Vehicles Database
**Collection ID:** `0f09543e-9932-44f2-b0ab-7b4c070afb81`
**Destination:** `Engine2_ProgramMapping/data/Contract_Vehicles.csv`

### Required Columns

| Column | Type | Description | Example |
|--------|------|-------------|---------|
| Vehicle Name | Title | Official name | ALLIANT 2 |
| Acronym | Text | Short name | A2 |
| Agency | Select | Owning agency | GSA |
| Focus Area | Multi-select | Service types | IT Services |
| Term End Date | Date | Expiration | 2028-12-31 |
| Status | Select | Current status | Active |
| Relevant Programs | Relation | Associated programs | (relation) |
| PTS Position | Select | Our status | Holder |
| Notes | Text | Additional info | GWAC vehicle |

### How to Export

1. Open Contract Vehicles database in Notion
2. Click `...` menu > **Export** > **CSV**
3. Download and place in `Engine2_ProgramMapping/data/`

---

## 6. Existing n8n Workflows (If Applicable)

**Source:** n8n Dashboard
**Destination:** `n8n/` folder

If you have existing n8n workflows for:
- Job data import
- Notion updates
- Alert notifications

### How to Export

1. Open n8n Dashboard
2. Navigate to each workflow
3. Click `...` menu > **Download**
4. Save JSON files to `n8n/` folder

---

## 7. Claude Conversation Exports (Optional)

**Source:** Claude.ai Conversations
**Destination:** `docs/Claude Exports/`

Export any Claude conversations that contain:
- Development decisions
- Architecture discussions
- Code implementations
- Configuration details

### How to Export

1. Open the Claude conversation
2. Click conversation menu > **Export**
3. Select Markdown format
4. Save to `docs/Claude Exports/`

Use this prompt in the conversation first to structure the export:
```
Please provide a structured summary of our conversation including:
1. Key decisions made
2. Code implementations
3. Configuration values
4. Architecture patterns
5. Next steps discussed
```

---

## File Placement Summary

After all exports, your folder structure should look like:

```
BD-Automation-Engine/
├── Engine1_Scraper/
│   └── data/
│       └── Sample_Jobs.json (provided)
│
├── Engine2_ProgramMapping/
│   └── data/
│       ├── Programs_KB.csv          ← YOUR EXPORT
│       ├── Programs_KB_TEMPLATE.csv (provided)
│       ├── Contractors.csv          ← YOUR EXPORT
│       └── Contract_Vehicles.csv    ← YOUR EXPORT
│
├── Engine3_OrgChart/
│   └── data/
│       ├── DCGS_Contacts.csv        ← YOUR EXPORT
│       ├── GDIT_Other_Contacts.csv  ← YOUR EXPORT
│       └── Contacts_TEMPLATE.csv (provided)
│
├── n8n/
│   ├── bd_automation_workflow.json (provided)
│   └── [your-existing-workflows].json  ← YOUR EXPORTS
│
└── docs/
    └── Claude Exports/
        └── [conversation-exports].md    ← YOUR EXPORTS
```

---

## Data Validation Checklist

After placing your exports, verify:

### Programs Data
- [ ] All programs have unique names
- [ ] Keywords are comma-separated in text field
- [ ] Contract values include "~" prefix for estimates
- [ ] Priority levels use: Critical, High, Medium, Low

### Contacts Data
- [ ] Email addresses are valid format
- [ ] LinkedIn URLs are full paths (linkedin.com/in/...)
- [ ] Hierarchy Tiers use exact format: "Tier X - Name"
- [ ] BD Priority uses emoji prefix: "Critical", "High", "Medium", "Standard"
- [ ] Location Hub matches: Hampton Roads, San Diego Metro, DC Metro, etc.

### Contractors Data
- [ ] Company names are consistent with contacts
- [ ] Aliases include all known variations
- [ ] GDIT Relationship is accurate

### Contract Vehicles Data
- [ ] Term end dates are future or clearly marked expired
- [ ] PTS Position is accurate (Holder, Not Holder, Pursuing)

---

## Next Steps After Export

1. Run validation script (coming soon):
   ```bash
   python scripts/validate_data.py
   ```

2. Test with sample processing:
   ```bash
   python Engine2_ProgramMapping/scripts/program_mapper.py --test
   ```

3. Verify Notion sync:
   - Check that Collection IDs match your workspace
   - Test API connection with a simple read operation

4. Continue with [SETUP_GUIDE.md](./SETUP_GUIDE.md) - Engine Setup section
