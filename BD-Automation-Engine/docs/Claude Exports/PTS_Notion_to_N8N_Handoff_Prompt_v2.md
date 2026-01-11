# PTS BD Intelligence System
## Notion → n8n Cross-Project Handoff Prompt v2.0
### January 2026

---

## 📋 PURPOSE

Use this prompt in your **Notion BD Intelligence Project** chats to generate structured handoff documentation that feeds directly into your **n8n Automation Project**. This ensures continuity between Claude projects and maximizes automation potential.

---

## 🚀 COPY THIS PROMPT INTO YOUR NOTION PROJECT CHAT:

```
I need you to create a structured handoff document for my n8n automation project. This document transfers context, decisions, and workflow requirements from our Notion work to my dedicated n8n workflow development project.

## System Context: PTS BD Intelligence System

**Architecture:** 16-database Notion workspace with hub-and-spoke model
**Purpose:** Automated competitive intelligence for defense contractor BD
**Data Flow:** Apify Scrapers → n8n Webhook → Program Mapping Hub → GPT-4o Enrichment → BD Opportunities → Slack/Email Alerts

### Core Databases (Collection IDs for MCP Operations)

| Database | Collection ID | Role |
|----------|---------------|------|
| 🧭 Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Central hub - all jobs flow here |
| 🎯 BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | Sales pipeline output |
| 📓 Enrichment Runs Log | `20dca021-f026-42a5-aaf7-2b1c87c4a13d` | Workflow telemetry |
| 🏛️ Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | Program reference (388+) |
| 🏢 Contractors Database | `3a259041-22bf-4262-a94a-7d33467a1752` | Company profiles |
| 🚚 Contract Vehicles | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | GWAC/IDIQ reference |
| ⭐ DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | HUMINT contacts (965+) |
| 💼 GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | GDIT job tracking |
| 🔍 Insight Global Jobs | `69f0d6de-24c8-4878-9eed-b2e4f6c7d63f` | IG scraped jobs |

### Active n8n Workflows (3)
1. **Apify Job Import** - Webhook creates jobs in Hub (Status: `raw_import`)
2. **Enrichment Processor** - 15min schedule, GPT-4o, updates scores
3. **Priority Alert** - Triggers on Priority Score changes (Hot/Warm/Cold)

### n8n Environment
- **Instance:** https://primetech.app.n8n.cloud (v2.26.3)
- **MCP Server:** https://primetech.app.n8n.cloud/mcp-server/http
- **Apify Token:** [stored in n8n credentials]

### ⚠️ SCHEMA-LOCKED PROPERTIES (n8n Dependencies)
These Hub properties are used by n8n workflows - coordinate before modifying:
```
Status, Enrichment Timestamp, AI Confidence Score, Priority Score,
Apify Run ID, Source URL, Job Title, Company, Job Description, Clearance Level
```

**Status State Machine (exact values required):**
```
raw_import → pending_enrichment → enriching → enriched → validated → error
```

---

## HANDOFF DOCUMENT STRUCTURE

Generate a handoff document with these sections:

### 1. 📊 SESSION SUMMARY
- Main focus of our conversation
- Problems we solved or identified
- Key decisions made
- Notion operations performed (with page/database URLs if applicable)

### 2. 🔄 WORKFLOW REQUIREMENTS FOR N8N
Capture workflow automation needs in this format:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WORKFLOW: [Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Trigger:     [Schedule/Webhook/Manual/Database Change]
Input:       [Data sources, parameters needed]
Process:     
  1. [Step 1]
  2. [Step 2]
  3. [Step 3]
Output:      [What it produces/updates]

NOTION INTEGRATION:
  Read From:  [Database(s) + Collection ID(s)]
  Write To:   [Database(s) + Collection ID(s)]
  Properties: [Specific fields accessed]

Priority:    [🔴 High / 🟡 Medium / 🟢 Low]
Complexity:  [Simple / Medium / Complex]
Dependencies: [Other workflows, external APIs]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 3. 📐 NOTION SCHEMA CHANGES
Document any schema modifications needed:

| Database | Property | Type | Change | n8n Impact |
|----------|----------|------|--------|------------|
| [Name] | [Field] | [Type] | Add/Modify/Delete | ⚠️ Requires workflow update / ✅ Safe |

### 4. 🔗 DATA MAPPING SPECIFICATIONS
For any data transformations discussed:

```
SOURCE → TARGET MAPPING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Source: [Database/API/File]
Target: [Database] (Collection: [ID])

Field Mappings:
  source.field_a    →  target.Property_A
  source.field_b    →  target.Property_B (transform: [logic])
  [computed]        →  target.Property_C (formula: [logic])

Validation Rules:
  - [Rule 1]
  - [Rule 2]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 5. 🔌 API & INTEGRATION NOTES
- External APIs discussed (SAM.gov, FPDS, LinkedIn, etc.)
- Authentication requirements
- Rate limiting considerations
- Webhook configurations needed

### 6. ⚠️ TECHNICAL GOTCHAS & BLOCKERS
- Issues discovered during Notion operations
- Workarounds implemented
- Limitations to be aware of
- Multi-source database restrictions encountered

### 7. 📝 BD SCORING IMPLICATIONS
If scoring algorithm changes were discussed:

```
SCORING CHANGE IMPACT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current Algorithm:
  Clearance Alignment:  35 pts
  Program Relevance:    20 pts
  Location Proximity:   15 pts
  Contract Value:       15 pts
  Recompete Timing:     15 pts
  ─────────────────────────
  Total:               100 pts

Proposed Changes:
  [Component]: [Old Value] → [New Value]
  Rationale: [Why]
  
n8n Workflow Impact:
  - Enrichment Processor needs update: [Yes/No]
  - Alert thresholds affected: [Yes/No]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 8. 🎯 PRIORITY ACTIONS FOR N8N PROJECT
Ranked list of what to build/fix next:

| Priority | Action | Type | Est. Effort | Dependencies |
|----------|--------|------|-------------|--------------|
| 1 | [Action] | New Workflow / Modify / Fix | [Hours] | [None / Workflow X] |
| 2 | [Action] | ... | ... | ... |
| 3 | [Action] | ... | ... | ... |

### 9. 💡 AUTOMATION OPPORTUNITIES IDENTIFIED
Ideas for future n8n workflows discovered during our Notion work:

```
OPPORTUNITY: [Name]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Current State: [Manual process / Gap in system]
Proposed Automation: [What n8n could do]
Business Value: [Time saved / Accuracy improved / etc.]
Implementation Notes: [Technical considerations]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 10. 📎 RELEVANT CONTEXT & ARTIFACTS
- Key conversation excerpts
- Notion page URLs created/modified
- Screenshots or data samples (describe if applicable)
- Related documentation references

---

## OUTPUT FORMAT

Generate the handoff as clean Markdown that can be:
1. ✅ Pasted directly into the n8n project Claude chat
2. ✅ Saved as a .md file for documentation
3. ✅ Used as input for n8n MCP workflow triggers

## IMPORTANT NOTES

- Always use **Collection IDs** (not Database IDs) for Notion references
- Flag any changes to schema-locked properties with ⚠️
- Include specific Notion page URLs when referencing created/modified content
- Note any rate limit issues encountered during bulk operations
- Reference the Prompt Playbook patterns used if applicable

---

Based on our conversation today, please generate the handoff document following this structure. Focus on actionable items for the n8n project, especially:
- Workflow automation opportunities
- Schema changes that require n8n coordination
- Data transformation requirements
- Integration points identified
```

---

## 🔄 REVERSE HANDOFF: n8n → Notion Project

When working in your **n8n project** and need to hand off to the **Notion project**, use this condensed prompt:

```
Generate a Notion Project handoff with:

1. **Workflow Changes Made:** [List n8n workflows created/modified]
2. **Schema Requirements:** Properties needed in Notion databases
3. **Webhook Configurations:** Endpoints the Notion project should know about
4. **Testing Data Needed:** Sample records to create for workflow testing
5. **Status Field Values:** Any new status values added to the state machine
6. **Error Patterns:** Common errors seen that Notion data quality could prevent

Format for direct paste into the Notion BD Intelligence Project chat.
```

---

## 📊 CURRENT SYSTEM STATE REFERENCE

### ✅ Working Now
- 16-database Notion architecture with hub-and-spoke model
- Program Mapping Hub (65 fields, 23 views)
- Federal Programs (388+ programs, enriched)
- DCGS Contacts Full (965+ contacts)
- 3 active n8n workflows
- Notion MCP + n8n MCP both connected
- Prompt Workshop methodology active

### ⏳ In Progress
- BD Opportunities workflow optimization (Hub → BD Opp pipeline)
- ~550 GDIT Jobs need program mapping
- 11 Hub formula field implementations
- Enrichment Runs Log → n8n connection

### 📋 Planned
- Workflow 4: Hub → BD Opportunities automated promotion
- SAM.gov contract notification integration
- Weekly executive summary automation
- Dashboard generation workflow

### ⚠️ Known Constraints
- Multi-source databases cannot be modified via API
- Rate limits: 180 req/min general, 30 searches/min
- Schema-locked properties require n8n coordination
- Status values must match exactly for workflow triggers

---

## 📚 RELATED DOCUMENTATION

When using this handoff prompt, these documents provide additional context:

| Document | Purpose | Location |
|----------|---------|----------|
| `PTS_Claude_Notion_MCP_Prompt_Playbook.md` | Prompt templates, Collection IDs | Project Knowledge |
| `PTS_Claude_Notion_MCP_Integration_Guide.docx` | Full MCP tool documentation | Project Knowledge |
| `PTS_BD_Intelligence_Architecture_Blueprint_v3_3_FINAL.docx` | Complete database schemas | Project Knowledge |
| `PTS_GDIT_Program_Keyword_Mapping_Guide_v1.docx` | Program classification rules | Project Knowledge |
| `PTS_Enhanced_Custom_Instructions_v2.md` | Project custom instructions | Project Settings |

---

**Document:** PTS_Notion_to_N8N_Handoff_Prompt_v2.md  
**Version:** 2.0  
**Last Updated:** January 2026  
**Author:** PTS BD Intelligence System
