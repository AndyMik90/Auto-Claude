# PTS BD Intelligence System - Claude Export
**Export Date:** January 2, 2026  
**Session Type:** Database Verification & n8n Workflow Deployment  
**n8n Instance:** https://primetech.app.n8n.cloud/

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
- Notion Database Schema Verification
- n8n Workflow Deployment via MCP (Model Context Protocol)
- PTS BD Intelligence System - 6-Workflow Automation Suite

### Date Range
- Session Date: January 2, 2026
- Session Duration: ~45 minutes
- Previous Sessions: Multiple (see userMemories for full context)

### Primary Objective
1. Verify all Notion database schemas and properties match the workflow requirements
2. Confirm correct database Collection IDs vs Page IDs
3. Deploy all 6 production workflows directly to n8n using MCP API
4. Create comprehensive documentation of the deployed system

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Use Collection IDs vs Page IDs for Notion API
- **Decision:** Use Collection/Data Source IDs (not Page IDs) when querying Notion databases via API
- **Reasoning:** Notion databases have two identifiers - the Page ID (visible in URL) and the Collection ID (internal data source). The API requires the Collection ID for database queries.
- **Key Learning:** 
  - Page ID example: `9db40fce-0781-42b9-902c-d4b0263b1e23`
  - Collection ID example: `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`

### Decision 2: HTTP Request Nodes vs Native Notion Nodes
- **Decision:** Use HTTP Request nodes with direct Notion API calls instead of native n8n Notion nodes
- **Reasoning:** Greater control over query filters, better error handling, explicit header management for Notion-Version
- **Alternative Considered:** Native Notion nodes (rejected due to limited filter flexibility)

### Decision 3: GPT-4o-mini for AI Enrichment
- **Decision:** Use `gpt-4o-mini` model for AI-powered program matching and contact classification
- **Reasoning:** Cost-effective for high-volume processing, sufficient accuracy for pattern matching tasks
- **Configuration:** Temperature 0.2 for consistent outputs, max_tokens 200-500 depending on task

### Decision 4: 5-Factor Weighted BD Scoring Algorithm
- **Decision:** Implement weighted scoring: Clearance (40%) + Contract Value (40%) + Base (20%)
- **Reasoning:** Clearance alignment is the primary indicator of job difficulty to fill, directly correlating with BD value
- **Score Thresholds:** Hot ≥80, Warm ≥50, Cold <50

### Decision 5: Batch Processing with Rate Limiting
- **Decision:** Process items individually with 350-500ms delays between API calls
- **Reasoning:** Notion API rate limits (3 requests/second), OpenAI rate limits
- **Implementation:** Wait nodes between iterations in batch loops

---

## 3. ARCHITECTURE & DATA FLOW

### System Overview
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PTS BD INTELLIGENCE SYSTEM - DATA FLOW                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [Apify Scraper]                                                            │
│       │ (Webhook POST)                                                      │
│       ▼                                                                     │
│  ┌─────────────┐    ┌──────────────────┐    ┌────────────────────┐         │
│  │   WF1       │    │      WF2         │    │       WF3          │         │
│  │  Apify      │───▶│  AI Enrichment   │───▶│  Hub → BD Opps     │         │
│  │  Intake     │    │  (GPT-4o-mini)   │    │                    │         │
│  └─────────────┘    └──────────────────┘    └────────────────────┘         │
│       │                    │                         │                      │
│       ▼                    ▼                         ▼                      │
│  ┌─────────────────────────────────────────────────────────────────┐       │
│  │              NOTION DATABASES                                    │       │
│  │  ┌──────────────────┐  ┌──────────────┐  ┌─────────────────┐   │       │
│  │  │ Program Mapping  │◄─┤   Federal    │  │ BD Opportunities│   │       │
│  │  │      Hub         │  │   Programs   │  │                 │   │       │
│  │  │ (Central DB)     │  │ (Reference)  │  │   (Pipeline)    │   │       │
│  │  └──────────────────┘  └──────────────┘  └─────────────────┘   │       │
│  │          │                                        │            │       │
│  │          │         ┌─────────────────┐           │            │       │
│  │          └────────▶│  DCGS Contacts  │◄──────────┘            │       │
│  │                    │     (Targets)   │                        │       │
│  │                    └─────────────────┘                        │       │
│  └─────────────────────────────────────────────────────────────────┘       │
│                                    │                                        │
│       ┌────────────────────────────┼────────────────────────────┐          │
│       │                            │                            │          │
│       ▼                            ▼                            ▼          │
│  ┌─────────────┐          ┌──────────────┐          ┌──────────────┐       │
│  │    WF4      │          │     WF5      │          │     WF6      │       │
│  │  Contact    │          │  Hot Lead    │          │   Weekly     │       │
│  │  Classify   │          │   Alerts     │          │   Summary    │       │
│  │ (AI-based)  │          │  (Email)     │          │  (Report)    │       │
│  └─────────────┘          └──────────────┘          └──────────────┘       │
│       │                          │                         │               │
│       ▼                          ▼                         ▼               │
│  [DCGS Contacts              [Email to                [Email to            │
│   BD Priority]               Gmaranville@             Gmaranville@         │
│                              prime-ts.com]            prime-ts.com]        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Data Flow Details

1. **Apify → WF1**: Webhook POST with scraped job data
2. **WF1 → Notion Hub**: Creates raw job records with `status: raw_import`
3. **WF2 reads Hub**: Queries for `status = raw_import OR pending_enrichment`
4. **WF2 → OpenAI**: Sends job + programs context for AI matching
5. **WF2 → Hub**: Updates with matched program, confidence score, BD score
6. **WF3 reads Hub**: Queries for `status = enriched AND Priority Score ≥ 70`
7. **WF3 → BD Opportunities**: Creates opportunity records with relations
8. **WF4 reads Contacts**: Queries for empty BD Priority
9. **WF4 → OpenAI**: Classifies contact hierarchy/priority
10. **WF5 reads BD Opps**: Queries for Hot priority, sends daily email
11. **WF6 reads Hub + BD Opps**: Compiles weekly metrics, sends Monday report

### API Connections

| Service | Endpoint | Authentication |
|---------|----------|----------------|
| Notion API | `https://api.notion.com/v1/` | Bearer Token (Credential ID: WrAqBcxNV9pskdOG) |
| OpenAI API | `https://api.openai.com/v1/` | API Key (Credential ID: lZeQTKtsKzyQqo7e) |
| SMTP (Gmail) | smtp.gmail.com:587 | App Password (Credential ID: knh7NFxZJw45izKU) |
| Apify | Webhook to n8n | None (Public webhook) |

### Webhook URLs
- **WF1 Intake**: `https://primetech.app.n8n.cloud/webhook/apify-job-intake`

---

## 4. CODE & CONFIGURATIONS

### 4.1 Workflow 1: Apify Job Scraper Intake

**File:** `workflow_1_apify_intake_v2.json`  
**Purpose:** Receives job data from Apify scrapers via webhook, transforms/validates, creates records in Program Mapping Hub  
**n8n ID:** `oFAM7yH4gpJchKjI`

```json
{
  "name": "PTS BD - WF1 Apify Job Scraper Intake",
  "nodes": [
    {
      "parameters": {
        "httpMethod": "POST",
        "path": "apify-job-intake",
        "responseMode": "onReceived",
        "options": {}
      },
      "id": "webhook-trigger",
      "name": "Apify Webhook",
      "type": "n8n-nodes-base.webhook",
      "typeVersion": 2.1,
      "position": [240, 300],
      "webhookId": "apify-job-intake-webhook"
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "// Validate and transform incoming Apify payload\nconst input = $input.all();\nconst results = [];\n\nfor (const item of input) {\n  const data = item.json;\n  \n  // Handle different Apify payload formats\n  let jobs = [];\n  if (Array.isArray(data)) {\n    jobs = data;\n  } else if (data.jobs && Array.isArray(data.jobs)) {\n    jobs = data.jobs;\n  } else if (data.title) {\n    jobs = [data];\n  }\n  \n  for (const job of jobs) {\n    if (!job.title) continue;\n    \n    // Normalize clearance level\n    const clearanceMap = {\n      'ts/sci with poly': 'TS/SCI w/ Poly',\n      'ts/sci with polygraph': 'TS/SCI w/ Poly',\n      'ts/sci': 'TS/SCI',\n      'top secret/sci': 'TS/SCI',\n      'top secret': 'Top Secret',\n      'ts': 'Top Secret',\n      'secret': 'Secret',\n      'public trust': 'Public Trust'\n    };\n    \n    const rawClearance = (job.detected_clearance || job.clearance || 'Unknown').toLowerCase().trim();\n    let normalizedClearance = 'Unknown';\n    for (const [key, value] of Object.entries(clearanceMap)) {\n      if (rawClearance.includes(key)) {\n        normalizedClearance = value;\n        break;\n      }\n    }\n    \n    // Parse location\n    const locationStr = job.location || '';\n    const locationParts = locationStr.split(',').map(s => s.trim());\n    const city = locationParts[0] || '';\n    const state = locationParts[1] || '';\n    \n    // Generate unique ID\n    const jobId = 'JOB-' + Date.now() + '-' + Math.random().toString(36).substr(2, 8);\n    const dedupeKey = (job.title.toLowerCase() + '-' + (job.company || '').toLowerCase() + '-' + city.toLowerCase()).replace(/[^a-z0-9-]/g, '');\n    \n    results.push({\n      json: {\n        jobId: jobId,\n        title: job.title.substring(0, 200),\n        company: job.company || 'Unknown',\n        location: locationStr,\n        city: city,\n        state: state,\n        clearanceLevel: normalizedClearance,\n        url: job.url || '',\n        scrapedAt: job.scraped_at || new Date().toISOString(),\n        source: job.source || job.company || 'Apify Scrape',\n        deduplicationKey: dedupeKey,\n        primaryKeyword: job.primary_keyword || '',\n        status: 'raw_import'\n      }\n    });\n  }\n}\n\nif (results.length === 0) {\n  return [{ json: { error: 'No valid jobs found in payload', itemCount: 0 } }];\n}\n\nreturn results;"
      },
      "id": "transform-payload",
      "name": "Transform & Validate Payload",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [460, 300],
      "onError": "continueRegularOutput"
    },
    {
      "parameters": {
        "batchSize": 1,
        "options": { "reset": false }
      },
      "id": "batch-processor",
      "name": "Batch Processor",
      "type": "n8n-nodes-base.splitInBatches",
      "typeVersion": 3,
      "position": [680, 300]
    },
    {
      "parameters": {
        "method": "POST",
        "url": "https://api.notion.com/v1/pages",
        "authentication": "predefinedCredentialType",
        "nodeCredentialType": "notionApi",
        "sendHeaders": true,
        "headerParameters": {
          "parameters": [{ "name": "Notion-Version", "value": "2022-06-28" }]
        },
        "sendBody": true,
        "specifyBody": "json",
        "jsonBody": "={\n  \"parent\": { \"database_id\": \"f57792c1-605b-424c-8830-23ab41c47137\" },\n  \"properties\": {\n    \"Job Title\": { \"title\": [{ \"text\": { \"content\": \"{{ $json.title }}\" } }] },\n    \"Company\": { \"rich_text\": [{ \"text\": { \"content\": \"{{ $json.company }}\" } }] },\n    \"Location\": { \"rich_text\": [{ \"text\": { \"content\": \"{{ $json.location }}\" } }] },\n    \"Clearance Level\": { \"select\": { \"name\": \"{{ $json.clearanceLevel }}\" } },\n    \"Source URL\": { \"url\": \"{{ $json.url }}\" },\n    \"Source Program\": { \"select\": { \"name\": \"{{ $json.source }}\" } },\n    \"Status\": { \"select\": { \"name\": \"raw_import\" } }\n  }\n}",
        "options": {}
      },
      "id": "create-notion-page",
      "name": "Create Job in Hub",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [900, 300],
      "credentials": {
        "notionApi": { "id": "WrAqBcxNV9pskdOG", "name": "Notion - Prime TS BD" }
      },
      "onError": "continueRegularOutput",
      "retryOnFail": true,
      "maxTries": 3,
      "waitBetweenTries": 1000
    },
    {
      "parameters": { "amount": 0.35, "unit": "seconds" },
      "id": "rate-limit-delay",
      "name": "Rate Limit Delay",
      "type": "n8n-nodes-base.wait",
      "typeVersion": 1.1,
      "position": [1120, 300]
    },
    {
      "parameters": {
        "aggregate": "aggregateAllItemData",
        "destinationFieldName": "processedJobs",
        "options": {}
      },
      "id": "aggregate-results",
      "name": "Aggregate Results",
      "type": "n8n-nodes-base.aggregate",
      "typeVersion": 1,
      "position": [1340, 300]
    },
    {
      "parameters": {
        "mode": "runOnceForAllItems",
        "language": "javaScript",
        "jsCode": "// Create summary of import\nconst firstItem = $input.first();\nconst jobs = (firstItem && firstItem.json && firstItem.json.processedJobs) ? firstItem.json.processedJobs : [];\nconst timestamp = new Date().toISOString();\n\nconst sourcesSet = new Set();\nconst clearanceCounts = {};\n\nfor (const job of jobs) {\n  if (job.source) sourcesSet.add(job.source);\n  const cl = job.clearanceLevel || 'Unknown';\n  clearanceCounts[cl] = (clearanceCounts[cl] || 0) + 1;\n}\n\nreturn [{\n  json: {\n    summary: {\n      totalImported: jobs.length,\n      timestamp: timestamp,\n      sources: Array.from(sourcesSet),\n      clearanceLevels: clearanceCounts\n    }\n  }\n}];"
      },
      "id": "create-summary",
      "name": "Create Import Summary",
      "type": "n8n-nodes-base.code",
      "typeVersion": 2,
      "position": [1560, 300],
      "onError": "continueRegularOutput"
    }
  ],
  "connections": {
    "Apify Webhook": { "main": [[{ "node": "Transform & Validate Payload", "type": "main", "index": 0 }]] },
    "Transform & Validate Payload": { "main": [[{ "node": "Batch Processor", "type": "main", "index": 0 }]] },
    "Batch Processor": { "main": [[{ "node": "Create Job in Hub", "type": "main", "index": 0 }], [{ "node": "Aggregate Results", "type": "main", "index": 0 }]] },
    "Create Job in Hub": { "main": [[{ "node": "Rate Limit Delay", "type": "main", "index": 0 }]] },
    "Rate Limit Delay": { "main": [[{ "node": "Batch Processor", "type": "main", "index": 0 }]] },
    "Aggregate Results": { "main": [[{ "node": "Create Import Summary", "type": "main", "index": 0 }]] }
  },
  "settings": { "executionOrder": "v1", "saveDataErrorExecution": "all", "saveDataSuccessExecution": "all", "saveManualExecutions": true }
}
```

### 4.2 Workflow 2: AI Enrichment Processor

**File:** `workflow_2_ai_enrichment_v2.json`  
**Purpose:** Enriches job records with AI-matched federal programs, calculates BD priority scores  
**n8n ID:** `pdzM84gixhnOXEOp`  
**Schedule:** Every 15 minutes

**Key Code Node - BD Score Calculation:**
```javascript
// Parse AI response and calculate BD score
const contextItem = $('Prepare AI Context').item;
const job = contextItem ? contextItem.json : {};
const aiResponse = $input.item.json;

let matchData;
try {
  let text = aiResponse.text || '';
  text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    matchData = JSON.parse(jsonMatch[0]);
  } else {
    matchData = { matched_program: 'PARSE_ERROR', confidence_score: 0 };
  }
} catch (e) {
  matchData = { matched_program: 'PARSE_ERROR', confidence_score: 0 };
}

// 5-Factor BD Score Algorithm
const clearanceScores = { 
  'TS/SCI w/ Poly': 100, 
  'TS/SCI': 90, 
  'TS': 75, 
  'Secret': 50, 
  'Public Trust': 30 
};
const hiringDemand = clearanceScores[job.clearance] || 20;
const contractValue = matchData.confidence_score || 50;

const bdScore = Math.round((hiringDemand * 0.4) + (contractValue * 0.4) + 20);

let priorityLevel = 'Cold';
if (bdScore >= 80) priorityLevel = 'Hot';
else if (bdScore >= 50) priorityLevel = 'Warm';

return {
  json: {
    pageId: job.pageId,
    matchedProgram: matchData.matched_program || 'NO_MATCH',
    matchConfidence: matchData.confidence_score || 0,
    programType: matchData.program_type || 'Unknown',
    bdScore: bdScore,
    priorityLevel: priorityLevel
  }
};
```

**AI Prompt Template:**
```
Match this job to the best program.

JOB:
- Title: {{ $json.title }}
- Company: {{ $json.company }}
- Location: {{ $json.location }}
- Clearance: {{ $json.clearance }}

PROGRAMS:
{{ $json.programsContext }}

Respond with JSON only:
{"matched_program": "Program Name or NO_MATCH", "confidence_score": 0-100, "program_type": "IT/Cyber/Intel/Other"}
```

### 4.3 Workflow 3: Hub to BD Opportunities

**n8n ID:** `Ae2ZaSTMwyHK2hUm`  
**Purpose:** Creates BD Opportunity records from high-scoring Hub jobs  
**Schedule:** Every 1 hour  
**Trigger Condition:** `Priority Score ≥ 70`

**Notion Create Body:**
```json
{
  "parent": { "database_id": "2bcdef65-baa5-80ed-bd95-000b2f898e17" },
  "properties": {
    "Opportunity ID": { "title": [{ "text": { "content": "{{ $json.opportunityId }}" } }] },
    "Source Job Title": { "rich_text": [{ "text": { "content": "{{ $json.jobTitle }}" } }] },
    "Source Company": { "rich_text": [{ "text": { "content": "{{ $json.company }}" } }] },
    "Matched Program": { "rich_text": [{ "text": { "content": "{{ $json.program }}" } }] },
    "Priority Score": { "number": {{ $json.priorityScore }} },
    "Priority Level": { "select": { "name": "{{ $json.priorityLevel }}" } },
    "Status": { "select": { "name": "New" } },
    "Source Hub Record": { "relation": [{ "id": "{{ $json.hubPageId }}" }] }
  }
}
```

### 4.4 Workflow 4: Contact Classification

**n8n ID:** `oBm1uAznir4nRkVx`  
**Purpose:** AI-classifies DCGS contacts by hierarchy tier and BD priority  
**Schedule:** Every 6 hours

**BD Priority Mapping:**
```javascript
const priorityMap = {
  'Critical': '🔴 Critical',
  'High': '🟠 High',
  'Medium': '🟡 Medium',
  'Standard': '⚪ Standard'
};

const tierMap = {
  'Tier 1': 'Tier 1 - Executive',
  'Tier 2': 'Tier 2 - Director',
  'Tier 3': 'Tier 3 - Program Leadership',
  'Tier 4': 'Tier 4 - Management',
  'Tier 5': 'Tier 5 - Senior IC',
  'Tier 6': 'Tier 6 - Individual Contributor'
};
```

### 4.5 Workflow 5: Hot Lead Alerts

**n8n ID:** `gbVtJiUif29JaIHs`  
**Purpose:** Daily email alert for Hot priority opportunities  
**Schedule:** Daily at 8 AM EST  
**Recipient:** Gmaranville@prime-ts.com

### 4.6 Workflow 6: Weekly Summary Report

**n8n ID:** `F39P6WBUSYPRmxsu`  
**Purpose:** Weekly executive summary with metrics and top opportunities  
**Schedule:** Monday at 7 AM EST  
**Recipient:** Gmaranville@prime-ts.com

---

## 5. NOTION DATABASE SCHEMAS

### 5.1 Program Mapping Intelligence Hub

**Collection ID:** `f57792c1-605b-424c-8830-23ab41c47137`  
**Page URL:** `https://www.notion.so/0a0d7e463d8840b6853a3c9680347644`

| Property | Type | Values/Options |
|----------|------|----------------|
| Job Title | title | - |
| Company | rich_text | - |
| Location | rich_text | - |
| Status | select | raw_import, pending_enrichment, enriching, enriched, validated, error |
| Clearance Level | select | None, Public Trust, Secret, TS, TS/SCI, TS/SCI w/ Poly, Unknown |
| Agency | select | DoD, Army, Navy, Air Force, Space Force, CIA, NSA, DIA, NGA, FBI, DHS, State, Treasury, VA, NASA, DOE, Other |
| AI Confidence Score | number | 0-100 |
| Priority Score | number | 0-100 |
| Program Name | rich_text | - |
| Contract Value | number | $ |
| Related Federal Programs | relation | → Federal Programs |
| Source URL | url | - |
| Source Program | select | - |
| Job Description | rich_text | - |
| Enrichment Timestamp | date | - |
| Prime Company | relation | → Contractors |
| Tags | multi_select | - |
| Validation Status | select | - |

### 5.2 Federal Programs

**Collection ID:** `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa`  
**Page URL:** `https://www.notion.so/9db40fce078142b9902cd4b0263b1e23`

| Property | Type | Values/Options |
|----------|------|----------------|
| Program Name | title | - |
| Acronym | text | - |
| Agency Owner | select | DoD, Army, Navy, Air Force, Space Force, CIA, NSA, DIA, NGA, FBI, DHS, State, Treasury, VA, NASA, DOE, Other, MDA, DISA, Marines, IC, NRO, SOCOM |
| Program Type | select | IT, IT Ops, Professional Services, R&D, Engineering, Intel, Cyber, C5ISR, Weapon Systems, Space, Network, Logistics, Data, Health IT, Security, Sustainment, BOS, Consulting, EW, Event |
| Budget | number | - |
| Contract Vehicle | select | IDIQ, Services, Program, Single Award, Task Order, R&D, GWAC, Recompete, Production, BOA, OTA, BPA, Multi-Year, Sustainment, FFP, Other |
| Clearance Requirements | multi_select | None, Public Trust, Secret, Top Secret, TS/SCI, TS/SCI w/ Poly |
| Priority Level | select | High, Medium, Low |
| Related Jobs | relation | → Program Mapping Hub |
| Keywords/Signals | text | - |
| Typical Roles | text | - |
| Prime Contractor | relation | → Contractors |
| Key Subcontractors | relation | → Contractors |
| Period of Performance | date | - |
| Recompete Date | date | - |
| Incumbent Score | select | Excellent, Good, Fair, Poor, Unknown |
| PTS Involvement | select | Current, Past, Target, None |
| Contract Vehicle Used | relation | → Contract Vehicles |

### 5.3 BD Opportunities

**Collection ID:** `2bcdef65-baa5-80ed-bd95-000b2f898e17`  
**Page URL:** `https://www.notion.so/2bcdef65baa58015bf09c01813f24b0a`

| Property | Type | Values/Options |
|----------|------|----------------|
| Opportunity ID | title | BD-XXX-XXXXXX |
| Status | select | New, Contacted, In Progress, Won, Lost |
| Priority Level | select | Hot, Warm, Cool, Cold |
| Priority Score | number | 0-100 |
| Matched Program | rich_text | - |
| Source Job Title | rich_text | - |
| Source Company | rich_text | - |
| Company | text | - |
| Value | number (dollar) | - |
| Source Hub Record | relation | → Program Mapping Hub |
| Related Program | relation | → Federal Programs |
| Next Action | text | - |
| Created Date | date | - |
| Next Follow-up | date | - |
| Contact Email | email | - |
| Notes | text | - |
| Key Contact | person | - |

### 5.4 DCGS Contacts Full

**Collection ID:** `2ccdef65-baa5-8087-a53b-000ba596128e`  
**Page URL:** `https://www.notion.so/2ccdef65baa580d09b66c67d66e7a54d`

| Property | Type | Values/Options |
|----------|------|----------------|
| Name | title | Last Name |
| First Name | text | - |
| Job Title | text | - |
| Email Address | email | - |
| Phone Number | phone | - |
| Direct Phone Number | phone | - |
| Mobile phone | phone | - |
| BD Priority | select | 🔴 Critical, 🟠 High, 🟡 Medium, ⚪ Standard |
| Hierarchy Tier | select | Tier 1 - Executive, Tier 2 - Director, Tier 3 - Program Leadership, Tier 4 - Management, Tier 5 - Senior IC, Tier 6 - Individual Contributor |
| Functional Area | multi_select | Program Management, Network Engineering, Cyber Security, ISR/Intelligence, Systems Administration, Software Engineering, Field Service, Security/FSO, Business Development, Training, Administrative |
| Location Hub | select | Hampton Roads, San Diego Metro, DC Metro, Dayton/Wright-Patt, Other CONUS, OCONUS, Unknown |
| Program | select | AF DCGS - Langley, AF DCGS - Wright-Patt, AF DCGS - PACAF, AF DCGS - Other, Army DCGS-A, Navy DCGS-N, Corporate HQ, Enterprise Security, Unassigned, Sentinel GBSD, Lockheed Martin, F-35 |
| LinkedIn Contact Profile URL | url | - |
| Person City | text | - |
| Person State | text | - |
| Verified | select | Wrong Program, Email Verified, Phone Verified, LinkedIn Verified, Unverified |
| Company Name | text | - |

---

## 6. N8N WORKFLOWS - DEPLOYED

### Deployed Workflow Summary

| # | Workflow Name | n8n ID | Nodes | Schedule | Status |
|---|---------------|--------|-------|----------|--------|
| 1 | PTS BD - WF1 Apify Job Scraper Intake | `oFAM7yH4gpJchKjI` | 7 | Webhook | ✅ Deployed |
| 2 | PTS BD - WF2 AI Enrichment Processor | `pdzM84gixhnOXEOp` | 11 | Every 15 min | ✅ Deployed |
| 3 | PTS BD - WF3 Hub to BD Opportunities | `Ae2ZaSTMwyHK2hUm` | 7 | Every 1 hour | ✅ Deployed |
| 4 | PTS BD - WF4 Contact Classification | `oBm1uAznir4nRkVx` | 9 | Every 6 hours | ✅ Deployed |
| 5 | PTS BD - WF5 Hot Lead Alerts | `gbVtJiUif29JaIHs` | 7 | Daily 8 AM | ✅ Deployed |
| 6 | PTS BD - WF6 Weekly Summary Report | `F39P6WBUSYPRmxsu` | 7 | Monday 7 AM | ✅ Deployed |

### Direct Links

- WF1: https://primetech.app.n8n.cloud/workflow/oFAM7yH4gpJchKjI
- WF2: https://primetech.app.n8n.cloud/workflow/pdzM84gixhnOXEOp
- WF3: https://primetech.app.n8n.cloud/workflow/Ae2ZaSTMwyHK2hUm
- WF4: https://primetech.app.n8n.cloud/workflow/oBm1uAznir4nRkVx
- WF5: https://primetech.app.n8n.cloud/workflow/gbVtJiUif29JaIHs
- WF6: https://primetech.app.n8n.cloud/workflow/F39P6WBUSYPRmxsu

### Credentials Configured

| Credential | Type | ID | Used In |
|------------|------|-----|---------|
| Notion - Prime TS BD | notionApi | `WrAqBcxNV9pskdOG` | All workflows |
| OpenAI - Prime TS BD | openAiApi | `lZeQTKtsKzyQqo7e` | WF2, WF4 |
| SMTP - Gmail | smtp | `knh7NFxZJw45izKU` | WF5, WF6 |

---

## 7. APIFY ACTORS & SCRAPERS

### Expected Webhook Payload Format

The WF1 intake webhook expects job data in one of these formats:

**Format 1: Array of jobs**
```json
[
  {
    "title": "Senior Software Engineer",
    "company": "GDIT",
    "location": "San Diego, CA",
    "detected_clearance": "TS/SCI",
    "url": "https://careers.gdit.com/job/123",
    "scraped_at": "2026-01-02T12:00:00Z",
    "source": "GDIT Careers",
    "primary_keyword": "software engineer"
  }
]
```

**Format 2: Wrapped in jobs key**
```json
{
  "jobs": [
    { "title": "...", "company": "...", ... }
  ]
}
```

**Format 3: Single job object**
```json
{
  "title": "Cybersecurity Analyst",
  "company": "Leidos",
  "location": "Fort Meade, MD",
  "detected_clearance": "TS/SCI w/ Poly",
  "url": "https://careers.leidos.com/job/456"
}
```

### Clearance Normalization Map

```javascript
const clearanceMap = {
  'ts/sci with poly': 'TS/SCI w/ Poly',
  'ts/sci with polygraph': 'TS/SCI w/ Poly',
  'ts/sci': 'TS/SCI',
  'top secret/sci': 'TS/SCI',
  'top secret': 'Top Secret',
  'ts': 'Top Secret',
  'secret': 'Secret',
  'public trust': 'Public Trust'
};
```

### Webhook Configuration for Apify

Configure Apify actor to POST to:
```
https://primetech.app.n8n.cloud/webhook/apify-job-intake
```

Headers: `Content-Type: application/json`

---

## 8. PROBLEMS SOLVED

### Problem 1: Notion Page ID vs Collection ID Confusion

**Description:** Initial attempts to query Notion databases using the Page ID from the URL failed with 404 errors.

**Root Cause:** Notion databases have two different identifiers:
- Page ID: `9db40fce-0781-42b9-902c-d4b0263b1e23` (visible in URL)
- Collection ID: `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` (internal data source)

**Solution:** Used Notion MCP `notion-fetch` tool to retrieve database metadata, which revealed the actual Collection ID in the `data-source` section. Updated all workflow configurations to use Collection IDs.

### Problem 2: n8n Node Type Version Compatibility

**Description:** Workflows built with outdated node typeVersions failed validation on n8n 1.122.4.

**Root Cause:** Node schemas change between n8n versions. Using typeVersion 1.0 for nodes that now require 2.0+ caused validation failures.

**Solution:** Updated all node typeVersions to match n8n 1.122.4 requirements:
- webhook: 2.1
- code: 2
- httpRequest: 4.2
- filter: 2.2
- scheduleTrigger: 1.2
- openAi: 1.8
- emailSend: 2.1
- wait: 1.1
- splitInBatches: 3
- aggregate: 1

### Problem 3: Notion Property Type Mismatches

**Description:** Some properties were configured as `select` in workflows but were actually `rich_text` or `text` in the database.

**Root Cause:** Database schema had evolved during development, but workflow configurations weren't updated.

**Solution:** Used Notion MCP to fetch full database schemas and verified each property type. Updated workflow JSON bodies to match actual property types (e.g., Company changed from select to rich_text).

### Problem 4: AI Response Parsing Failures

**Description:** GPT responses sometimes included markdown code fences that broke JSON parsing.

**Root Cause:** Despite prompt instructions to return "JSON only", the model occasionally wrapped responses in ```json fences.

**Solution:** Added robust parsing logic to strip markdown fences before JSON parsing:
```javascript
text = text.replace(/```json\n?/gi, '').replace(/```\n?/gi, '').trim();
const jsonMatch = text.match(/\{[\s\S]*\}/);
if (jsonMatch) {
  matchData = JSON.parse(jsonMatch[0]);
}
```

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate Actions Required

1. **Activate Workflows** - All workflows deployed in INACTIVE state
   - Test each manually first
   - Activate in order: WF1 → WF2 → WF3 → WF4 → WF5 → WF6

2. **Configure Apify Webhook** - Point Apify actors to:
   ```
   https://primetech.app.n8n.cloud/webhook/apify-job-intake
   ```

3. **Verify Email Delivery** - Test WF5/WF6 email sending
   - Check SMTP credential validity
   - Verify Gmail app password

### Future Enhancements

1. **Error Monitoring Workflow** - Create WF7 for execution failure alerts
2. **Deduplication Logic** - Enhance WF1 to check existing records before creating
3. **Federal Programs Sync** - Automate program database updates from SAM.gov
4. **Contact Enrichment** - Add LinkedIn profile scraping for DCGS contacts
5. **Dashboard Integration** - Connect to visualization tool (Retool, Metabase)

### Known Limitations

- WF2 processes max 10 jobs per run (increase after testing)
- WF3 only creates opportunities for score ≥70 (adjust threshold as needed)
- WF4 processes max 10 contacts per run
- Weekly report doesn't filter by date yet (fetches all records)

---

## 10. KEY INSIGHTS & GOTCHAS

### Notion API Gotchas

1. **Always use Collection ID** for database queries, not Page ID
2. **Notion-Version header** is required: `2022-06-28`
3. **Property names are case-sensitive** - "Job Title" ≠ "job title"
4. **Select vs Multi-Select** - Select expects `{ "name": "value" }`, multi-select expects array
5. **Relations require page IDs** - `{ "relation": [{ "id": "page-uuid" }] }`

### n8n Best Practices Discovered

1. **Use HTTP Request nodes** for Notion instead of native nodes for better control
2. **Add retryOnFail** to all API nodes with maxTries: 3
3. **Wait nodes after API calls** - 350ms minimum for Notion rate limits
4. **Use continueRegularOutput** for error handling to prevent workflow stops
5. **Code nodes for complex logic** - More reliable than expression-heavy node configs

### AI Integration Tips

1. **Temperature 0.2** for consistent, deterministic outputs
2. **Explicit JSON-only instruction** in system prompt
3. **Always strip markdown fences** before parsing
4. **Include fallback values** for parse failures
5. **Limit context size** - Send max 50 programs to avoid token limits

### Deployment Lessons

1. **Validate workflows before deployment** using n8n MCP tools
2. **Deploy inactive first** - Always test manually before enabling schedules
3. **Check credential IDs** - They change between environments
4. **Use descriptive node names** - Helps debugging in execution logs
5. **Save execution data** - Enable saveDataSuccessExecution for troubleshooting

### Database Design Insights

1. **Hub-and-spoke model works** - Central Hub with relations to reference DBs
2. **Status field is critical** - Controls workflow triggers and filtering
3. **Priority scoring enables automation** - Numeric scores better than categories alone
4. **Relations require bidirectional setup** - Define on both databases

---

## APPENDIX: Quick Reference

### Database IDs

```javascript
const DATABASE_IDS = {
  PROGRAM_MAPPING_HUB: "f57792c1-605b-424c-8830-23ab41c47137",
  FEDERAL_PROGRAMS: "06cd9b22-5d6b-4d37-b0d3-ba99da4971fa",
  BD_OPPORTUNITIES: "2bcdef65-baa5-80ed-bd95-000b2f898e17",
  DCGS_CONTACTS: "2ccdef65-baa5-8087-a53b-000ba596128e"
};
```

### Credential IDs

```javascript
const CREDENTIALS = {
  NOTION_API: "WrAqBcxNV9pskdOG",
  OPENAI_API: "lZeQTKtsKzyQqo7e",
  SMTP_GMAIL: "knh7NFxZJw45izKU"
};
```

### Workflow IDs

```javascript
const WORKFLOWS = {
  WF1_APIFY_INTAKE: "oFAM7yH4gpJchKjI",
  WF2_AI_ENRICHMENT: "pdzM84gixhnOXEOp",
  WF3_HUB_TO_BD_OPPS: "Ae2ZaSTMwyHK2hUm",
  WF4_CONTACT_CLASSIFY: "oBm1uAznir4nRkVx",
  WF5_HOT_LEAD_ALERTS: "gbVtJiUif29JaIHs",
  WF6_WEEKLY_SUMMARY: "F39P6WBUSYPRmxsu"
};
```

### Status Flow

```
raw_import → pending_enrichment → enriching → enriched → validated
                                                    ↓
                                          [Creates BD Opportunity]
```

### Priority Thresholds

```
Score ≥ 80  →  Hot    (🔴)
Score ≥ 50  →  Warm   (🟡)
Score < 50  →  Cold   (⚪)
```

---

**Document Generated:** January 2, 2026  
**Export By:** Claude AI Assistant  
**n8n Instance:** primetech.app.n8n.cloud (v1.122.4)
