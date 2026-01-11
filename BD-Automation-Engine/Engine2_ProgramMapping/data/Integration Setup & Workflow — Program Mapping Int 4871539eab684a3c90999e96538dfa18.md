# Integration Setup & Workflow — Program Mapping Intelligence Hub

### Notion ↔ n8n Integration Setup

**API Configuration**

- Notion API Key: [Secure storage]
- Database ID: [](https://www.notion.so/0a0d7e463d8840b6853a3c9680347644?pvs=21)
- Webhook URL: [[https://your-n8n/webhook/job-data-intake](https://your-n8n/webhook/job-data-intake)]
- Sync Frequency: Every 15 minutes
- Batch Size: 10 records

---

### Webhook Payload Template (Apify → n8n)

```json
{
  "source": "apify",
  "runId": "run_id",
  "timestamp": "iso_timestamp",
  "jobs": [
    {
      "jobId": "generated_id",
      "title": "job_title",
      "company": "company_name",
      "location": "location",
      "description": "full_description",
      "clearance": "clearance_level",
      "technologies": "tech_stack",
      "url": "source_url"
    }
  ]
}
```

---

### Response Handler (n8n → Notion)

- Receive enriched data from n8n
- Map fields to Notion properties
- Update `Status`
- Set `Enrichment Timestamp`
- Recalculate `AI Confidence Score`, `Data Quality Score`, `Priority Score`

### Field mapping (Notion properties)

- title → Job Title
- company → Company
- location → Location
- description → Job Description
- clearance → Clearance Level
- technologies → Required Technologies
- url → Source URL
- computed → AI Confidence Score, Data Quality Score, Priority Score, Tags, Suggested Contract Vehicles

---

### Workflow Triggers

### 1) New Job Import (Webhook → Create)

- Trigger: Apify webhook received at [[https://your-n8n/webhook/job-data-intake](https://your-n8n/webhook/job-data-intake)]
- Actions:
    
    1) Validate JSON structure against template
    
    2) Deduplicate by Company + Job Title + Location over last 7 days
    
    3) Create record(s) with Status = `raw_import`
    
    4) Add Tags → FEDERAL when Source URL contains [`sam.gov`](http://sam.gov)
    
    5) Queue for enrichment by setting Status = `pending_enrichment`
    

### 2) Enrichment Processor (Cron or Queue threshold)

- Trigger: Every 15 minutes OR when pending queue > 10
- Actions:
    
    1) Get records where Status = `pending_enrichment`
    
    2) Batch by Company (size 10)
    
    3) Call enrichment workflow
    
    4) Update records with results
    
    5) Recompute scores and set Status `enriched` or `error`
    

### 3) Daily Rollup (09:00 local)

- Count new jobs in past 24h
- Enrichment rate = enriched / total new
- Top companies by volume
- Flag stale records (no update in > 3 days)
- Write a summary to Enrichment Runs Log

### 4) Weekly Intelligence Report (Mondays)

- Aggregate by Contract Vehicle
- Agency trend analysis
- Competition mapping (Incumbent Contractor + Competition Level)
- Technology requirements shift (Required Technologies)
- Recompete calendar (Contract End Date within 6–12 months)

---

### Quality Assurance Workflow

### Validation Rules (apply post-enrichment)

- Prime Company exists in Contractors Database
- Contract Vehicle is valid option
- AI Confidence Score > threshold (e.g., 0.5)
- No conflicting values vs. existing duplicates
- Enrichment Timestamp within last 24h

### Human Review Queue

- Criteria:
    - AI Confidence Score < 0.5
    - Data conflicts detected
    - Contract Value > $10M
    - Clearance Level ∈ {TS, TS/SCI, TS/SCI w/ Poly}
    - New company/vehicle combinations
- Route to views: 🧰 Needs Human Review, 📝 Manual Review Queue

### Feedback Loop

- Capture human edits and flags
- Log frequent error patterns
- Update prompts and rules
- Retrain on validated rows
- Track improvement metrics over time

---

### n8n Blueprint (High-level)

### Nodes

- Webhook (Apify → n8n)
- Function (validate + normalize)
- Notion (Find or Create)
- Notion (Update)
- IF branches (confidence, errors)
- Cron (15m, 9am daily, weekly Monday)
- Aggregator (weekly report)

### Error handling

- Retry with exponential backoff (max 3)
- On fail: increment Retry Counter, set Validation Status = `flagged`, add to 🧰 Needs Human Review

---

### Monitoring Dashboard (Database design)

[Monitoring Dashboard](Monitoring%20Dashboard%20633a8d599a0d40cdb8da675380f592ec.csv)

- Create a small linked view set referencing Program Mapping Intelligence Hub for charts and counts.
- Suggested metrics:
    - Enrichment Metrics: total, enriched, success rate, avg confidence, avg processing time
    - Contract Intelligence: unique primes, active vehicles, agency distribution, clearance distribution, top 10 technologies
    - Data Quality: completeness avg, validation rate, error rate, duplicate rate, API success
    - Business Intelligence: recompete pipeline (< 6 months), capture opportunities, competitor analysis, agency penetration

---

### Export Templates

### 1) BD Pipeline Export (CSV)

- Fields: Program Name, Agency, Prime Contractor, Contract Vehicle, Contract Value, Contract End Date, Our Position
- View: Create a filtered view and use Export → CSV

### 2) Competitive Intel Export (Exec dashboard)

- Fields: Competitor (Incumbent Contractor), Contracts Won, Agencies, Technologies, Team Partners
- Create a gallery or board view and export/print to PDF

### 3) Technology Requirements Export (Skills gap)

- Fields: Required Technologies, Frequency, Agencies Using, Clearance Required, Trend
- Use board by Required Technologies + count by column

### 4) Weekly Executive Summary (PDF)

- Fields: New Opportunities, High Priority, Upcoming Recompetes, Win Probability
- Use a preformatted page and export to PDF

---

### Appendix: Property Reference

- Main DB: [](https://www.notion.so/0a0d7e463d8840b6853a3c9680347644?pvs=21) and views like 🧪 Enrichment Queue, ⏰ Upcoming Recompetes, 📈 BD Capture Pipeline
- Supporting DBs: [](https://www.notion.so/e11663051b1f4812b665bcfa6a87a2ab?pvs=21), [](https://www.notion.so/ca67175bdf3d442da2e7cc24e9a1bf78?pvs=21), [](https://www.notion.so/9db40fce078142b9902cd4b0263b1e23?pvs=21), [](https://www.notion.so/9b9328d2f96940e39d33a4168620fb1b?pvs=21)