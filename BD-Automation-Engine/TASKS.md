# Auto Claude Task Definitions for BD Automation Engine

This document contains all task definitions to be created in Auto Claude for building the BD Automation Engine. Copy each task into Auto Claude's Kanban board.

---

## Task 1: New Job Ingestion & Deduplication Pipeline

### Title
New Job Ingestion & Deduplication Pipeline

### Description
Set up the initial pipeline that handles incoming job postings. When a new batch of job JSON arrives (via Apify webhook to n8n), the system should parse it and insert the jobs into the "Job Postings" Notion database.

**Requirements:**

1. **Validate Input**: Ensure the incoming JSON matches the expected schema (fields: title, company, location, description, clearance, technologies, URL, etc.). If the JSON is malformed or missing key fields, log an error or push it to a "validation failed" list.

2. **Deduplicate Entries**: Avoid inserting duplicate job postings. Check if a job with the same Company + Job Title + Location was already processed in the last ~7 days. Implement a lookup in the Notion Job database (or maintain a cache list) to skip duplicates.

3. **Create Notion Records**: For each unique job, create a new entry in the Notion Job Postings database with basic fields. Map JSON fields to Notion properties one-to-one (title → Job Title, company → Company, etc.). Set an initial Status property to "raw_import".

4. **Source Detection**: If the Source URL contains certain indicators (like "sam.gov" or a known federal site), auto-tag a "Source" or "Category" property as "FEDERAL" vs "Commercial".

5. **Batch Handling**: Process jobs in small batches (5-10 at a time) to avoid overload.

6. **Output/Next Step**: After creating records, set Status to "pending_enrichment" or trigger the enrichment workflow.

### Key Files/Data
- Notion database ID for jobs
- n8n workflow configuration
- Optional: `scripts/deduplication.js` for n8n Function node

### Agent Profile
Claude 2 (100k) with Standard reasoning. Low temperature for precise output.

---

## Task 2: Program Knowledge Base Prep (Keywords & Embeddings)

### Title
Program Knowledge Base Prep (Keywords & Embeddings)

### Description
Prepare the Program Knowledge Base so the mapping engine can use it for matching. This involves: (A) building curated keyword lists for programs, and (B) setting up semantic embeddings for program descriptions.

**Requirements:**

1. **Load Program Data**: Read the programs CSV (`data/Programs_KB.csv`) which contains fields like Program Name, Customer Agency, Prime Contractor, Description, Key Locations, etc. Parse into a list/dictionary in Python.

2. **Build Keyword Dictionary**: For each program, compile keywords/phrases that are strong clues:
   - Program names and common abbreviations
   - Project code names or nicknames
   - Prime contractor names
   - Key locations
   - Technical keywords unique to the program
   - Known subcontractors or partner companies

3. **Create Reverse Index**: Build a dictionary mapping each keyword to relevant program(s) for quick lookups.

4. **Compute Program Embeddings**: Using OpenAI ADA (or similar), generate a vector for each program's description. Store vectors for semantic matching.

5. **Testing**: Include a small test - pick a sample program and verify keywords are in dictionary and embedding vector was created.

**Output Files:**
- `data/program_keywords.json` - Keyword dictionary
- `data/program_embeddings.json` - Program vectors

### Key Files/Data
- Input: `Engine2_ProgramMapping/data/Programs_KB.csv`
- Output: `Engine2_ProgramMapping/data/program_keywords.json`
- Output: `Engine2_ProgramMapping/data/program_embeddings.json`

### Agent Profile
Claude 2 100k with UltraThink mode ON. Enable Auto-Optimize Phases. Low temperature for consistent results.

---

## Task 3: Job→Program Mapping Engine (Enrichment Logic)

### Title
Job→Program Mapping Engine (Enrichment Logic)

### Description
Create the core logic that takes a job posting and determines which program it most likely belongs to. Output: Program Name, Prime Contractor, Customer Agency, and confidence score.

**Requirements:**

1. **Input & Preprocessing**: Accept job details (title, company, location, description, etc.). Clean text by lowercasing, removing stopwords, standardizing terms (e.g., "U.S." -> "US").

2. **Dictionary Keyword Matching**: Use keyword dictionary from Task 2 to scan job text. Implement scoring:
   - Program name/acronym match: +5
   - Prime contractor match: +3
   - Key location match: +2
   - Technical terms: +1 each

3. **Semantic Vector Search**: Embed job posting text and compare to program vectors. Find top 3 closest matches with similarity scores.

4. **Combine Signals**: Merge keyword and vector insights:
   - If same program tops both: high confidence
   - If different: compare scores and decide
   - Create composite score with weights

5. **LLM Validation (optional)**: For confidence < 0.5, optionally call Claude/GPT to double-check with candidates.

6. **Confidence Scoring**: Assign final confidence (0-1 or High/Med/Low).

7. **Program Details Lookup**: Once program determined, retrieve official Program Name, Prime Contractor, and Customer Agency.

8. **Output**: Return structured result:
```json
{
  "Program Name": "...",
  "Prime Contractor": "...",
  "Customer Agency": "...",
  "Confidence": 0.87,
  "Secondary Candidates": ["..."],
  "Notes": "Direct keyword match on acronym; high semantic similarity."
}
```

### Key Files/Data
- Uses: `program_keywords.json`, `program_embeddings.json`
- Creates: `Engine2_ProgramMapping/scripts/job_mapping.py`

### Agent Profile
Claude 2 100k, UltraThink mode. Allow auto-optimize phases. Temperature low-medium (0.2-0.3).

---

## Task 4: Update Notion with Enrichment Results

### Title
Update Notion with Enrichment Results

### Description
Integrate the output of Task 3 back into Notion. For each job record that was "pending_enrichment", fill in Program Name, Prime Contractor, Agency, Confidence, and mark as "enriched".

**Requirements:**

1. **Receive Result**: Task 3's code will return mapping result. In n8n, map result to Notion update.

2. **Map Fields**:
   - Program Name ← result["Program Name"]
   - Prime Contractor ← result["Prime Contractor"]
   - Customer Agency ← result["Customer Agency"]
   - AI Confidence Score ← result["Confidence"] (multiply by 100 for percentage)
   - Tags/Secondary ← result["Secondary Candidates"] (optional)

3. **Update Status**: Change Status from "pending_enrichment" to "enriched" or "needs_review" based on confidence threshold.

4. **Batch Processing**: Loop through batch of jobs and update each page.

5. **Verification**: Read back one page to ensure fields set correctly.

6. **Logging**: Log updates: "Updated Job ID X with Program Y (Confidence 0.9)".

### Key Files/Data
- Notion database IDs
- n8n Notion Update nodes
- Optional: `scripts/update_notion.py`

### Agent Profile
Claude 2 with focused profile. Temperature 0 for precise mapping.

---

## Task 5: Org Chart Contact Extraction

### Title
Org Chart Contact Extraction

### Description
Automate retrieval of relevant contacts for the program associated with each job. Given Program name and Prime contractor, query contacts database or external API to get names and roles.

**Requirements:**

1. **Data Source for Contacts**: Use internal CSV (`Contacts.csv`) or external system like Bullhorn CRM.

2. **Lookup Logic**:
   - By Program Name: Find contacts where "Program" field matches
   - By Prime Contractor: Find contacts whose company is the prime

3. **Filter for Relevance**: Prioritize titles like "Program Manager", "Project Lead", "Recruiter", etc.

4. **Output Contacts**: Structure output as 2-5 names with title, company, email/LinkedIn if available.

5. **Integration with Notion**: Optionally create entries in a People/Contacts database.

6. **API Option (Advanced)**: Outline how to query Bullhorn API (leave as placeholder function).

7. **Result Formatting**: For each program, output like:
   "Contacts: Jane Doe – Program Manager at CompanyY (jane.doe@companyy.com); John Smith – Technical Lead, CompanyY"

### Key Files/Data
- Input: `Engine3_OrgChart/data/Contacts.csv`
- Creates: `Engine3_OrgChart/scripts/contact_lookup.py`
- Output: Contact list per program

### Agent Profile
Claude 2, standard mode. Low temperature for correctness.

---

## Task 6: BD Briefing Document Generation

### Title
BD Briefing Document Generation

### Description
Create an automated Business Development briefing for each enriched job/program. This is a Markdown report consolidating: job details, program context, relevant contacts, and BD recommendations.

**Requirements:**

1. **Gather Inputs**: For a given enriched job, collect:
   - Basic job info (title, company, location, clearance, description summary)
   - Program info (name, agency, prime, description)
   - Contract vehicle if known
   - Key contacts from Task 5
   - Business signals (hiring patterns, timing)
   - Competitive landscape

2. **Markdown Formatting**: Structure with sections:
   - Opportunity Overview
   - Program Background
   - Key Details (bullet list)
   - Org Chart/Contacts
   - Business Development Notes
   - Recommendations (Next Steps)

3. **Use AI for Generation**: Feed structured data into Claude/GPT prompt to produce nicely worded content. Use template from `prompts/briefing_prompt.md`.

4. **Output Location**:
   - Save to `outputs/BD_Briefings/ProgramX_Briefing.md`
   - Optionally create Notion page
   - Optionally email to BD team

5. **Quality Check**: Ensure no hallucinated details. Professional, concise tone.

### Key Files/Data
- Input: Enriched job record, program DB, contacts
- Template: `prompts/briefing_prompt.md`
- Output: `outputs/BD_Briefings/[ProgramName]_Briefing.md`

### Agent Profile
Claude 2 100k with Creative/Business tone. Temperature 0.5 for fluent narrative.

---

## Task 7: Workflow Orchestration & Sequencing

### Title
Workflow Orchestration & Sequencing

### Description
Ensure all pieces work together in sequence through n8n workflow. Design and implement control flow from scraping to final briefing.

**Requirements:**

1. **n8n Workflow Design**:
   - Trigger: Webhook from Apify with new jobs
   - Ingestion: Validate and create Notion records
   - Set Status to pending_enrichment
   - Enrichment Trigger: Cron every 15 min or >10 pending jobs
   - Enrichment Loop: For each pending job, call job_mapping.py
   - Update Step: Write results back to Notion
   - Org Chart Step: Trigger contact_lookup.py
   - Briefing Step: Generate briefings for Hot leads
   - Output Delivery: Email or store briefings
   - End/Repeat

2. **Error Handling**: If mapping script fails, set Status to "error", send alert.

3. **Manual QA Checkpoints**: After first 10 records, pause for human review.

4. **Testing**: Simulate flow with dummy input, verify each step.

5. **Documentation**: Document workflow with diagram or step list.

### Key Files/Data
- n8n workflow export: `n8n_workflow_template.json`
- All scripts from previous tasks

### Agent Profile
Claude (any) with Planner/Architect persona. UltraThink for edge cases. Low temperature.

---

## Task 8: Quality Assurance & Feedback Loop

### Title
Quality Assurance & Feedback Loop

### Description
Implement mechanisms to maintain and improve system accuracy over time: immediate QA gating for low-confidence outputs and feedback loop for continuous learning.

**Requirements:**

1. **Confidence Threshold & Human Review Queue**:
   - If Confidence < 0.5 or mapping unsure, set Status to "needs_review"
   - Create Notion filtered view "Needs Human Review"
   - Define criteria for human review (high clearance, new company, etc.)

2. **Batch QA Pause**: After first 10 jobs, do manual QA pass. System produces summary: "Batch of 10 processed: 7 tagged, 3 flagged for review."

3. **Collect Human Feedback**: When human corrects mapping, capture that. Store original suggested program in hidden field.

4. **Update Knowledge Base**: Use feedback to update:
   - Programs_KB.csv or Notion Program DB
   - Keyword dictionary with missed terms

5. **Model Fine-tuning (future)**: Note option to train small model on corrected mappings.

6. **Monitoring Dashboard**: Set up Notion dashboard with metrics:
   - Success rate
   - Average confidence
   - Error rate
   - Jobs per program

### Key Files/Data
- Notion views and filters
- Optional: `feedback_log.csv`
- Optional: `QA_Plan.md` documentation

### Agent Profile
Claude 2 with analytical tone. UltraThink for thorough consideration. Low temperature.

---

## Implementation Order

Recommended sequence for building:

```
Phase 1: Foundation
├── Task 2: Program KB Prep ──────┐
└── Task 1: Job Ingestion ────────┼── Can run in parallel
                                  │
Phase 2: Core Engine              │
├── Task 3: Mapping Engine ◄──────┘
└── Task 4: Notion Update ◄── Depends on Task 3

Phase 3: Enhancement
├── Task 5: Org Chart ◄── Depends on Task 3
└── Task 6: Briefing Generation ◄── Depends on Tasks 3, 5

Phase 4: Integration
├── Task 7: Orchestration ◄── Depends on all above
└── Task 8: QA & Feedback ◄── Final integration
```

---

## Quick Start

1. **Open Auto Claude**
2. **Go to Kanban Board**
3. **Create Tasks**: Copy each task above into Auto Claude
4. **Start with Task 2**: Prepare the knowledge base first
5. **Monitor progress** in Agent Terminals
6. **Review & test** each component before moving on

---

## Tips for Success

1. **Use the PDF guides**: Reference the original PDFs for detailed context
2. **Test incrementally**: Verify each task works before starting the next
3. **Keep data updated**: Maintain your Programs_KB.csv and keywords
4. **Monitor confidence**: Watch for patterns in low-confidence matches
5. **Iterate on prompts**: Refine prompt templates based on results
