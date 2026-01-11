# PTS BD Intelligence System - Comprehensive Audit & Skill Suite

## Executive Summary

This document captures the complete analysis of your BD intelligence system and the 10 custom skills created to reach top 0.1% Claude proficiency.

---

## System Analysis Results

### What You've Built

Your BD intelligence system is a sophisticated multi-stage pipeline:

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│  JOB SCRAPING   │───▶│ PROGRAM MAPPING  │───▶│    CONTACT      │
│  (Apify)        │    │  (GPT-4o/Claude) │    │   DISCOVERY     │
└─────────────────┘    └──────────────────┘    │ (ZoomInfo/LI)   │
                                               └─────────────────┘
                                                       │
                                                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   OUTREACH      │◀───│   BD PLAYBOOK    │◀───│    HUMINT       │
│   EXECUTION     │    │   GENERATION     │    │   GATHERING     │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

### Current Maturity Assessment

| Component | Status | Maturity | Gap |
|-----------|--------|----------|-----|
| Job Scraping (Apify) | ✅ Active | 80% | Needs LinkedIn integration |
| Job Standardization (LLM) | ✅ Designed | 70% | Needs automated pipeline |
| Program Mapping Engine | ✅ Designed | 75% | Needs GCP integration |
| Contact Classification | ✅ Active | 90% | Minor refinements |
| BD Outreach Methodology | ✅ Active | 85% | More pain point HUMINT |
| HUMINT Gathering | 🔄 In Progress | 60% | Needs systematic cadence |
| Notion Database Ops | ✅ Active | 85% | Performance optimization |
| n8n Automation | 🔄 Designed | 50% | Hub→Opportunities pipeline |

### Database Inventory

| Database | Collection ID | Records | Health |
|----------|---------------|---------|--------|
| DCGS Contacts Full | `2ccdef65-baa5-8087-a53b-000ba596128e` | ~965 | ✅ Good |
| GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | ~1,052 | ✅ Good |
| GDIT Jobs | `2ccdef65-baa5-80b0-9a80-000bd2745f63` | ~700 | ✅ Good |
| Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Variable | ✅ Good |
| Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | 388 | ✅ Good |
| BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | Variable | ⚠️ Needs pipeline |

### Key Architectural Decisions

1. **Database split at 1,000 records** - Solved Notion performance issues
2. **Hub-and-spoke model** - Program Mapping Hub as central processing node
3. **Status flow machine** - raw_import → enriching → validated → error
4. **Priority scoring** - Hot (≥80), Warm (50-79), Cold (<50)
5. **6-tier hierarchy** - Executive through Individual Contributor

---

## Custom Skills Created

### Skill 1: job-standardization
**Purpose:** Transform raw job scrapes into 11-field standardized schema
**Key Features:**
- Section header mapping
- Clearance extraction patterns
- Validation rules
- Cost optimization ($0.015-0.025/job)

### Skill 2: program-mapping
**Purpose:** Match jobs to federal programs with BD scoring
**Key Features:**
- Location-to-program mapping (150+ locations)
- Multi-signal scoring algorithm (12 signals)
- Confidence thresholds (direct/fuzzy/inferred)
- BD Priority Score calculation

### Skill 3: contact-classification
**Purpose:** 6-tier hierarchy with automated BD priority
**Key Features:**
- Title-based tier detection
- Location-based program assignment
- BD Priority assignment rules
- Functional area classification

### Skill 4: bd-outreach-messaging
**Purpose:** The 6-step BD Formula for personalized outreach
**Key Features:**
- Step-by-step formula documentation
- Program-specific pain points
- PTS past performance alignment
- Templates for LinkedIn, Email, Phone

### Skill 5: humint-intelligence
**Purpose:** Tiered approach to intelligence gathering
**Key Features:**
- Tier 5-6 → Tier 1-2 escalation path
- Question frameworks by tier
- HUMINT documentation templates
- Pain point validation rules

### Skill 6: federal-defense-programs
**Purpose:** Program intelligence reference
**Key Features:**
- DCGS portfolio breakdown ($950M)
- Prime/sub relationships
- Contract vehicle reference
- Keyword matching tables

### Skill 7: notion-bd-operations
**Purpose:** MCP patterns and database best practices
**Key Features:**
- Search/Fetch/Update patterns
- Schema requirements with exact values
- Bulk operation strategies
- Troubleshooting guide

### Skill 8: apify-job-scraping
**Purpose:** Actor selection and cost optimization
**Key Features:**
- Competitor portal configurations
- Clearance detection patterns
- Two-stage processing strategy
- Cost comparison tables

### Skill 9: bd-call-sheet
**Purpose:** Excel generation with priority coding
**Key Features:**
- Column specifications
- Priority color coding (hex codes)
- Python/openpyxl implementation
- Personalized message generation

### Skill 10: bd-playbook
**Purpose:** Word document structure for BD campaigns
**Key Features:**
- 5-section template
- Executive summary format
- Contact profile structure
- Action plan framework

---

## Installation Instructions

### For Claude.ai Projects

1. Download `pts-bd-skills-complete.zip`
2. Extract all files
3. Go to your Claude Project → Project Knowledge
4. Upload each `SKILL.md` file individually
5. Skills auto-trigger based on keywords

### For Claude Code

```bash
# Extract to Claude skills directory
unzip pts-bd-skills-complete.zip -d ~/.claude/skills/
```

---

## Recommended Next Steps

### Immediate (This Week)
1. ☐ Upload all 10 skills to Project Knowledge
2. ☐ Test each skill with sample queries
3. ☐ Run PACAF outreach campaign using bd-outreach-messaging

### Short-Term (Next 2 Weeks)
1. ☐ Implement Hub → BD Opportunities n8n pipeline
2. ☐ Add LinkedIn scraper to Apify workflow
3. ☐ Schedule weekly HUMINT documentation cadence

### Medium-Term (Next Month)
1. ☐ GCP Vertex AI integration for automated enrichment
2. ☐ Expand beyond DCGS to full Federal Programs portfolio
3. ☐ Build PTS Past Performance database from Bullhorn

---

## Files Delivered

| File | Description |
|------|-------------|
| `pts-bd-skills-complete.zip` | All 10 skills + README |
| `pts-bd-skills/` | Unzipped skill folder structure |
| `PTS_BD_Design_SKILL.md` | Design standards skill (created earlier) |

---

**Analysis Date:** January 9, 2026
**Skills Version:** 1.0.0
**Target:** Top 0.1% Claude Proficiency
