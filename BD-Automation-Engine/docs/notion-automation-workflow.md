# BD Pipeline Automation Workflow

## Overview

This document describes the automation workflow for the PTS BD Intelligence System using Notion database automations and the dashboard enrichment engine.

## Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Apify Scraper  │────▶│  Notion Jobs DB │────▶│  Auto-Enrichment│
│   (Engine 1)    │     │   (Trigger)     │     │   Service       │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                        │
                        ┌───────────────────────────────┴─────────────────┐
                        │                                                 │
                        ▼                                                 ▼
                ┌───────────────┐                              ┌─────────────────┐
                │ Program Match │                              │ Contact Lookup  │
                │ (Location)    │                              │ (Cross-DB)      │
                └───────────────┘                              └─────────────────┘
                        │                                                 │
                        └───────────────────────┬─────────────────────────┘
                                                │
                                                ▼
                                    ┌─────────────────────┐
                                    │  BD Score + Priority │
                                    │  Calculation         │
                                    └─────────────────────┘
                                                │
                                                ▼
                                    ┌─────────────────────┐
                                    │  Dashboard Display   │
                                    │  + Call Sheet Export │
                                    └─────────────────────┘
```

## Database IDs

| Database | ID | Purpose |
|----------|-----|---------|
| Jobs (Program Mapping Hub) | f57792c1-605b-424c-8830-23ab41c47137 | Scraped job postings |
| Contacts (DCGS) | 2ccdef65-baa5-8087-a53b-000ba596128e | DCGS program contacts |
| Federal Programs | 06cd9b22-5d6b-4d37-b0d3-ba99da4971fa | Program reference data |

## Enrichment Rules

### 1. Jobs → Programs (Location-Based Matching)

| Location | Mapped Program | Priority |
|----------|----------------|----------|
| San Diego, La Mesa | AF DCGS - PACAF | 🔥 Hot |
| Hampton, Langley | AF DCGS - Langley | Normal |
| Dayton, Beavercreek, Wright-Patterson | AF DCGS - Wright-Patt | Normal |
| Norfolk, Suffolk | Navy DCGS-N | Normal |
| Herndon, Falls Church | Corporate HQ | Normal |

### 2. Contacts → Tier (Title-Based Classification)

| Title Patterns | Tier | Label |
|----------------|------|-------|
| VP, President, Chief, CEO, CTO | 1 | Executive |
| Director | 2 | Director |
| Program Manager, Site Lead | 3 | Program Lead |
| Manager, Team Lead | 4 | Manager |
| Senior, Principal | 5 | Senior IC |
| Default | 6 | Individual |

### 3. BD Priority Calculation

| Condition | Priority | Emoji |
|-----------|----------|-------|
| Tier 1-2 OR PACAF program | Critical | 🔴 |
| Tier 3 | High | 🟠 |
| Tier 4 | Medium | 🟡 |
| Tier 5-6 | Standard | ⚪ |

### 4. BD Score (0-100)

| Factor | Points |
|--------|--------|
| Location matches program | +40 |
| TS/SCI clearance | +25 |
| DCGS keyword in title/description | +20 |
| GDIT as prime contractor | +10 |
| Base score | +5 |

## Notion Database Automation Setup

### Trigger 1: New Job Added

1. Go to Jobs database (Program Mapping Hub)
2. Click ⚡ (lightning bolt) → New Automation
3. Configure:
   - **Trigger:** "Page added"
   - **Action 1:** Edit property → Set "Enrichment Status" to "Pending"
   - **Action 2:** Send webhook to n8n
     ```
     URL: ${N8N_ENRICHMENT_WEBHOOK}
     Method: POST
     Body: { "job_id": "{{page.id}}", "action": "enrich" }
     ```

### Trigger 2: Location Property Changed

1. Same database
2. **Trigger:** "Property edited" → "Location" is set
3. **Action:** Send webhook to re-run enrichment

### Trigger 3: Daily Enrichment Batch

1. **Trigger:** "Every day" at 6:00 AM
2. **Action:** Send webhook for batch processing
   ```
   URL: ${N8N_ENRICHMENT_WEBHOOK}
   Body: { "action": "batch_enrich", "date": "{{now}}" }
   ```

## AI Autofill Configuration

### For Jobs Database

1. Add Text property: "Auto-Program"
2. Click property → "Set up AI autofill"
3. Select "Custom autofill"
4. Prompt:
   ```
   Based on the Location field, determine the program:
   - San Diego/La Mesa → AF DCGS - PACAF
   - Hampton/Langley → AF DCGS - Langley
   - Dayton/Beavercreek → AF DCGS - Wright-Patt
   - Norfolk/Suffolk → Navy DCGS-N
   - Herndon/Falls Church → Corporate HQ
   Output only the program name.
   ```
5. Enable "Auto-update on page edits"

### For Contacts Database

1. Add Text property: "Auto-Tier"
2. Configure AI Autofill:
   ```
   Analyze the Job Title field and assign a tier:
   - Tier 1: VP, President, Chief executives
   - Tier 2: Director level
   - Tier 3: Program Manager, Site Lead
   - Tier 4: Manager, Team Lead
   - Tier 5: Senior, Principal individual contributors
   - Tier 6: All others
   Output format: "Tier X - [Label]"
   ```

## n8n Workflow Configuration

### Workflow: Job Enrichment Pipeline

```json
{
  "name": "BD Job Enrichment",
  "nodes": [
    {
      "name": "Webhook Trigger",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "enrich-job",
        "method": "POST"
      }
    },
    {
      "name": "Fetch Job from Notion",
      "type": "n8n-nodes-base.notion",
      "parameters": {
        "operation": "get",
        "pageId": "={{ $json.job_id }}"
      }
    },
    {
      "name": "Match Location to Program",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "code": "// Location matching logic (see autoEnrichment.ts)"
      }
    },
    {
      "name": "Update Notion with Enrichment",
      "type": "n8n-nodes-base.notion",
      "parameters": {
        "operation": "update",
        "pageId": "={{ $json.job_id }}",
        "properties": {
          "Program": "={{ $json.matched_program }}",
          "BD Score": "={{ $json.bd_score }}",
          "BD Priority": "={{ $json.bd_priority }}"
        }
      }
    }
  ]
}
```

## Dashboard Integration

The dashboard at `http://localhost:5173` integrates with these automations:

1. **Real-time data fetch** - Pulls from Notion databases via API
2. **Client-side enrichment** - Uses `autoEnrichment.ts` for instant calculations
3. **Call sheet export** - Generates Excel with prioritized contacts

### Using the Auto-Enrichment Hook

```tsx
import { useAutoEnrichment } from '../hooks/useAutoEnrichment';

function MyComponent() {
  const {
    enrichedJobs,
    enrichedContacts,
    stats,
    callSheet,
    isLoading,
    runEnrichment
  } = useAutoEnrichment();

  return (
    <div>
      <button onClick={runEnrichment}>Run Enrichment</button>
      <p>High Value Jobs: {stats.highValueJobs}</p>
      <p>Critical Contacts: {stats.criticalContacts}</p>
    </div>
  );
}
```

## Rate Limits

- **Notion API:** 3 requests/second
- **Notion MCP:** 180 requests/minute (general), 30/minute (search)
- **AI Autofill:** Updates 5 minutes after page edit

## Monitoring

Check automation status:
1. Database → ••• → Automations
2. Failed automations show ⚠️ icon
3. Click to see error details and re-enable
