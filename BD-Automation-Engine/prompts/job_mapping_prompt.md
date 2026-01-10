# Job Mapping Prompt Template

Use this prompt to match a job posting to a DoD program.

---

## Prompt

```
You are an expert in U.S. defense programs and job analysis. I will give you a job posting and a list of known programs. Identify which program the job most likely supports.

Job Posting:
- **Title:** {Job Title}
- **Company:** {Company Name}
- **Location:** {Location}
- **Clearance:** {Clearance Requirement}
- **Description:** {Job Description (summary if very long)}

Known Programs:
{List of Program Names with brief info, e.g.:
- "Program A – Air Force cyber defense program (Prime: X Corp)"
- "Program B – Army intel system (Prime: Y Inc)"
- ...}

**Task:**
1. Read the job details and compare with the known programs.
2. Pick the program that best matches the job's context (mission, tech, clearance, company).
3. Explain briefly why you chose that program.
4. If unsure, list top 2 possibilities and what info is needed to confirm.
5. Provide a confidence score (0.0 - 1.0).

Respond with:
- Program Name: [Selected program]
- Confidence: [0.0 - 1.0]
- Rationale: [One-line explanation]
- Secondary Candidates: [If applicable]
```

---

## Example Usage

**Input:**
```
Job Posting:
- Title: Senior Software Engineer - ICBM Systems
- Company: Northrop Grumman
- Location: Huntsville, AL
- Clearance: TS/SCI
- Description: Work on next-generation strategic deterrent systems, developing mission-critical software for the Ground Based Strategic Deterrent program.

Known Programs:
- GBSD Sentinel – Air Force ICBM modernization (Prime: Northrop Grumman)
- F-35 Lightning II – Joint Strike Fighter (Prime: Lockheed Martin)
- GPS III – Air Force navigation satellite (Prime: Lockheed Martin)
```

**Expected Output:**
```
Program Name: GBSD Sentinel
Confidence: 0.95
Rationale: Direct mention of "Ground Based Strategic Deterrent" and "ICBM", company is Northrop Grumman (prime), location is Huntsville (GBSD HQ).
Secondary Candidates: None - this is a definitive match.
```

---

## Variables to Replace

| Variable | Description | Example |
|----------|-------------|---------|
| `{Job Title}` | Position title | "Senior Software Engineer" |
| `{Company Name}` | Hiring company | "Northrop Grumman" |
| `{Location}` | Job location | "Huntsville, AL" |
| `{Clearance Requirement}` | Security clearance | "TS/SCI" |
| `{Job Description}` | Role description | "Work on next-gen..." |

---

## Tips for Best Results

1. Include program abbreviations and full names in the program list
2. Add prime contractor info for each program
3. Keep job description to key points (under 200 words)
4. Include any technical keywords from the posting
