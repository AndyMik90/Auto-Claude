---
name: job-standardization
description: LLM prompt engine for parsing raw job postings into standardized 11-field schema. Use when processing competitor job scrapes from Apex Systems, Insight Global, TEKsystems, or other staffing portals for BD intelligence extraction.
---

# Job Standardization Engine

Transform unstructured job posting data into a consistent, structured format for BD intelligence pipelines.

**Keywords**: job scraper, standardization, parsing, extraction, job posting, staffing, Apex Systems, Insight Global, TEKsystems, data extraction, schema

## Target Output Schema

Every processed job must output these 11 standardized fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| Job Title/Position | String | ✅ | Cleaned, Title Case professional title |
| Date Posted | Date | ✅ | YYYY-MM-DD format |
| Location | String | ✅ | "City, State" or "Remote" |
| Project Duration | String | ⚠️ | Contract length or "Permanent" |
| Rate/Pay Rate | String | ⚠️ | "$X/hour" or "$XXK-XXXK" |
| Security Clearance | String | ⚠️ | TS/SCI, Secret, etc. |
| Position Overview | String | ✅ | 100-200 word summary |
| Position Details | String | ⚠️ | 150-300 word detailed context |
| Key Responsibilities | Array | ✅ | 5-15 bullet points |
| Required Qualifications | Array | ✅ | 5-20 bullet points |
| Additional Information | String | ⚠️ | Benefits, travel, misc |

## System Prompt Template

```
You are a specialized data extraction system for defense contractor job postings. Analyze the raw job description and extract information into the standardized 11-field schema.

### EXTRACTION RULES

**Job Title/Position**
- Use Title Case (e.g., "Network Engineer" not "NETWORK ENGINEER")
- Remove HTML entities (&amp; → &)
- Remove embedded location info from title

**Date Posted**
- Convert to YYYY-MM-DD format
- If only month/year, use first day of month
- If missing, use scrape date as fallback

**Location**
- Format as "City, State" (e.g., "Herndon, VA")
- Standardize variations:
  - "100% Remote" → "Remote"
  - "Ft. Meade" → "Fort George G. Meade, MD"
  - "Washington DC Metro" → "Washington, DC"
- Preserve full military base names

**Security Clearance**
- Standardize abbreviations:
  - "TS/SCI w/ CI Poly" (with polygraph)
  - "TS/SCI" (no polygraph)
  - "Top Secret" → "Top Secret"
  - "Secret" (not "DOD Secret")
- Note if "ability to obtain" vs "active"

**Position Overview (REQUIRED)**
- 100-200 word summary
- Answer: What does this person do day-to-day?
- Extract from "Overview", "Summary", "About the Role" sections

**Key Responsibilities (REQUIRED)**
- Array of 5-15 bullet points
- Action verb sentence fragments
- Extract from "Responsibilities", "Duties", "What You'll Do"
- Remove bullet symbols (•, -, *, ·)

**Required Qualifications (REQUIRED)**
- Array of 5-20 bullet points
- Separate from "Preferred" qualifications
- Include: clearance, education, experience, certifications, skills

### OUTPUT FORMAT
Return valid JSON matching the 11-field schema exactly.
```

## Processing Pipeline

### Step 1: Preprocessing
```python
import html
import re

def preprocess_job_data(raw_job):
    # Decode HTML entities
    if raw_job.get('description'):
        raw_job['description'] = html.unescape(raw_job['description'])
    
    # Clean whitespace
    for key in raw_job:
        if isinstance(raw_job[key], str):
            raw_job[key] = re.sub(r'\s+', ' ', raw_job[key]).strip()
    
    return raw_job
```

### Step 2: LLM Extraction
```python
def standardize_job_with_llm(preprocessed_job, system_prompt):
    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=system_prompt,
        messages=[{"role": "user", "content": json.dumps(preprocessed_job)}]
    )
    return json.loads(response.content[0].text)
```

### Step 3: Validation
```python
def validate_standardized_job(job):
    required_fields = [
        'Job Title/Position', 'Date Posted', 'Location',
        'Position Overview', 'Key Responsibilities', 'Required Qualifications'
    ]
    errors = []
    
    for field in required_fields:
        if not job.get(field):
            errors.append(f"Missing required field: {field}")
    
    # Validate arrays
    if not isinstance(job.get('Key Responsibilities'), list):
        errors.append("Key Responsibilities must be an array")
    if not isinstance(job.get('Required Qualifications'), list):
        errors.append("Required Qualifications must be an array")
    
    # Validate date format
    if job.get('Date Posted'):
        try:
            datetime.strptime(job['Date Posted'], '%Y-%m-%d')
        except ValueError:
            errors.append("Date Posted must be YYYY-MM-DD format")
    
    return len(errors) == 0, errors
```

## Section Header Mappings

Map these section headers to output fields:

| Source Headers | Target Field |
|----------------|--------------|
| Overview, Summary, About the Role | Position Overview |
| Job Details, Work Model, Environment | Position Details |
| Responsibilities, Duties, What You'll Do | Key Responsibilities |
| Requirements, Qualifications, Must Have | Required Qualifications |
| Preferred, Desired, Nice to Have | Additional Information |
| Benefits, Travel, Apply Here | Additional Information |

## Cost Optimization

**Token estimates per job:**
- Input: 1,500-3,000 tokens
- Output: 800-1,200 tokens
- Total: ~2,500-4,500 tokens

**Cost (Claude Sonnet 4):**
- ~$0.015-0.025 per job
- 100 jobs: $1.50-2.50
- 1,000 jobs: $15-25

**Optimization strategies:**
1. Batch 10-20 jobs per API call
2. Use prompt caching for system prompt (saves ~60%)
3. Parallel processing with asyncio
4. Retry logic for rate limits

## Quality Assurance Checklist

After processing a batch, review 10% sample:
- [ ] Job titles cleaned and Title Case
- [ ] Dates in YYYY-MM-DD format
- [ ] Locations standardized to "City, State"
- [ ] Clearance levels formatted consistently
- [ ] Position Overview 100-200 words
- [ ] Responsibilities are actionable (3+ bullets)
- [ ] No HTML tags or formatting artifacts

## Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Responsibilities too generic | LLM summarizing | Add specificity examples in prompt |
| Missing clearance | Embedded in qualifications | Extract from all sections |
| Date parsing failures | Various formats | More format examples |
| Arrays as strings | Output format confusion | Explicit JSON schema in prompt |
