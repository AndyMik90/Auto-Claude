# Apex Systems Job Scraper - Claude Export
**Date**: January 8, 2026  
**Export Version**: V13 (Final)

---

## 1. CONVERSATION SUMMARY

### Topic/Focus Area
Apify Puppeteer Scraper for Apex Systems cleared job postings

### Date Range
January 5-8, 2026 (builds on prior work from V1-V7)

### Primary Objective
Build a production-ready web scraper to extract cleared job postings from Apex Systems' job board, with clean data output suitable for downstream processing via n8n workflows and LLM parsing for BD intelligence extraction.

### Scope
- Scrape only jobs from the "Clearance" keyword search filter
- Extract structured job data (title, location, clearance, pay, duration, description)
- Remove all Apex Systems boilerplate/marketing content from descriptions
- Output clean JSON for integration with n8n → Claude API → Notion pipeline

---

## 2. TECHNICAL DECISIONS MADE

### Decision 1: Use Puppeteer Scraper over Web Scraper
- **Reasoning**: Apex Systems uses dynamic JavaScript rendering; Puppeteer handles SPAs better
- **Alternatives considered**: Apify Web Scraper (couldn't handle dynamic content)

### Decision 2: Extract from JSON-LD structured data
- **Reasoning**: Apex embeds `<script type="application/ld+json">` with clean JobPosting schema data
- **Alternatives considered**: DOM scraping with CSS selectors (more fragile, less reliable)

### Decision 3: Two-stage LLM pipeline architecture
- **Reasoning**: Raw scraping + LLM parsing separates concerns and allows format-agnostic extraction
- **Stage 1**: Puppeteer extracts raw job data
- **Stage 2**: Claude API parses descriptions for BD intelligence (skills, technologies, client hints)

### Decision 4: Explicit pagination via multiple startUrls
- **Reasoning**: Auto-pagination was unreliable; glob patterns caused scraper to wander to unfiltered pages
- **Implementation**: All 4 search result pages listed as explicit startUrls

### Decision 5: Use `a.job-title-link` selector
- **Reasoning**: Each job row has 4 links (title, city, state, date) all pointing to same URL; need to select only job title to get accurate count and avoid confusion
- **Alternatives considered**: `a[href*='/job/']` (counted 100 links per page instead of 25)

### Decision 6: Comprehensive boilerplate removal in scraper
- **Reasoning**: Keep raw data clean before LLM processing; reduces token usage and improves LLM accuracy
- **Implementation**: 20+ regex patterns for start, end, and inline boilerplate

---

## 3. ARCHITECTURE & DATA FLOW

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA FLOW PIPELINE                           │
└─────────────────────────────────────────────────────────────────────┘

┌──────────────┐     ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Apex Systems │     │    Apify     │     │     n8n      │     │   Notion     │
│   Job Board  │────▶│  Puppeteer   │────▶│   Workflow   │────▶│   Database   │
│              │     │   Scraper    │     │              │     │              │
└──────────────┘     └──────────────┘     └──────────────┘     └──────────────┘
                            │                    │
                            │                    │
                            ▼                    ▼
                     ┌──────────────┐     ┌──────────────┐
                     │  JSON Output │     │  Claude API  │
                     │  (50+ jobs)  │     │  LLM Parsing │
                     └──────────────┘     └──────────────┘

STAGE 1: Apify Scraper
├── Input: 4 search result page URLs (Clearance filter)
├── Process: Visit each job page, extract JSON-LD + body text
├── Output: Clean JSON with job data + description
└── Trigger: Manual run or scheduled

STAGE 2: n8n Workflow (Planned)
├── Input: Apify webhook with scraped jobs
├── Process: Split items → Claude API for BD intel extraction → Merge
├── Output: Enriched job records
└── Destination: Notion database

DATA SCHEMA (Scraper Output):
{
  "url": "https://www.apexsystems.com/job/XXXXXXX_usa/job-title",
  "jobNumber": "XXXXXXX",
  "jobTitle": "Job Title",
  "location": "City, ST",
  "employmentType": "Contract|FullTime",
  "datePosted": "YYYY-MM-DD",
  "securityClearance": "Secret|TS/SCI|...",
  "payRate": "$XX-XX/hr|Negotiable|...",
  "duration": "X months...",
  "description": "Clean job description...",
  "scrapedAt": "ISO timestamp"
}
```

---

## 4. CODE & CONFIGURATIONS

### File: apex_clearance_scraper_v13.json
**Purpose**: Final Apify Puppeteer Scraper configuration for Apex Systems cleared job postings

```json
{
  "browserLog": false,
  "closeCookieModals": false,
  "debugLog": false,
  "downloadCss": true,
  "downloadMedia": true,
  "globs": [
    {
      "glob": "https://www.apexsystems.com/job/*_usa/*"
    }
  ],
  "headless": true,
  "ignoreCorsAndCsp": false,
  "ignoreSslErrors": false,
  "keepUrlFragments": false,
  "linkSelector": "a.job-title-link",
  "maxConcurrency": 3,
  "maxCrawlingDepth": 1,
  "maxPagesPerCrawl": 0,
  "maxRequestRetries": 5,
  "maxResultsPerCrawl": 0,
  "maxScrollHeightPixels": 5000,
  "pageFunction": "async function pageFunction(context) {\n    const { page, request, log } = context;\n    \n    // Handle search results / listing pages\n    if (request.url.includes('/search-results-usa')) {\n        log.info(`Listing page: ${request.url}`);\n        await new Promise(r => setTimeout(r, 3000));\n        \n        // Count job title links specifically\n        const jobCount = await page.evaluate(() => {\n            const jobLinks = document.querySelectorAll('a.job-title-link');\n            return jobLinks.length;\n        });\n        log.info(`Found ${jobCount} job title links on this page`);\n        \n        return null;\n    }\n    \n    // Handle individual job pages\n    if (request.url.includes('/job/')) {\n        log.info(`Extracting job: ${request.url}`);\n        await new Promise(r => setTimeout(r, 2000));\n        \n        const jobData = await page.evaluate(() => {\n            const result = {};\n            \n            const decodeHtml = (html) => {\n                const txt = document.createElement('textarea');\n                txt.innerHTML = html;\n                return txt.value;\n            };\n            \n            const jsonLdScript = document.querySelector('script[type=\"application/ld+json\"]');\n            if (jsonLdScript) {\n                try {\n                    const jsonLd = JSON.parse(jsonLdScript.textContent);\n                    if (jsonLd['@type'] === 'JobPosting') {\n                        result.jobTitle = jsonLd.title || null;\n                        \n                        let desc = jsonLd.description || '';\n                        desc = decodeHtml(desc);\n                        \n                        // ===== END BOILERPLATE =====\n                        const eeoIndex = desc.indexOf('EEO Employer');\n                        if (eeoIndex > 0) desc = desc.substring(0, eeoIndex);\n                        const eeoIndex2 = desc.indexOf('Apex Systems is an equal opportunity employer');\n                        if (eeoIndex2 > 0) desc = desc.substring(0, eeoIndex2);\n                        \n                        desc = desc.replace(/\\*?Please note that as a contract employee of Apex Systems[\\s\\S]*$/i, '');\n                        desc = desc.replace(/Apex Benefits Overview[\\s\\S]*$/i, '');\n                        desc = desc.replace(/\\s*Apex Systems Military & Veteran Programs[\\s\\S]*$/i, '');\n                        desc = desc.replace(/\\s*If you have visited our website in search of information[\\s\\S]*$/i, '');\n                        \n                        // ===== START BOILERPLATE =====\n                        \n                        // \"Job #: XXXXX Apex Systems is currently hiring...\" or \"Job #: XXXXX Apex Systems is seeking...\"\n                        desc = desc.replace(/^Job\\s*#?:?\\s*\\d+\\s*Apex Systems is (?:currently hiring|seeking)[^.]+\\.\\s*/i, '');\n                        desc = desc.replace(/^Job\\s*#?:?\\s*\\d+\\s*/i, '');\n                        \n                        // \"Apex Systems is currently hiring for...\"\n                        desc = desc.replace(/^Apex Systems is currently hiring for [^@]+@apexsystems\\.com\\.?\\s*/i, '');\n                        desc = desc.replace(/^Apex Systems is currently hiring for (?:a |an )?[^.]+(?:solutions|services|leader|company|clients)[^.]*\\.\\s*/i, '');\n                        \n                        // \"Apex Systems is seeking...\"\n                        desc = desc.replace(/^Apex Systems is seeking [^.]+\\.\\s*/i, '');\n                        \n                        // \"Apex Systems has an opening...\"\n                        desc = desc.replace(/^Apex Systems has an opening available for [^@]+@apexsystems\\.com\\.?\\s*/i, '');\n                        desc = desc.replace(/^Apex Systems has an opening available for [^!]+!\\s*/i, '');\n                        \n                        // \"Apex Systems, a World-Class...\"\n                        desc = desc.replace(/^Apex Systems,? a World-Class Technology Solutions Provider[^@]+@apexsystems\\.com\\.?\\s*/i, '');\n                        \n                        // \"Apex Systems is a world class...Here are the details:\"\n                        desc = desc.replace(/^Apex Systems is a world class[\\s\\S]*?Here are the details:\\s*/i, '');\n                        \n                        // \"Apex Systems has an opportunity for...\"\n                        desc = desc.replace(/^Apex (?:Systems )?has an opportunity for[^.]+\\.\\s*/i, '');\n                        \n                        // \"Looking for an exciting...If you are interested in applying, send your resume...\"\n                        desc = desc.replace(/^Looking for an exciting[^.]+\\.\\s*This is perfect for you\\.\\s*/i, '');\n                        \n                        // ===== INLINE BOILERPLATE =====\n                        \n                        desc = desc.replace(/Apex Systems is hiring for (?:multiple )?[^!]+!\\s*/gi, '');\n                        desc = desc.replace(/If interested in applying[^@]+@apexsystems\\.com\\s*(?:\\([^)]+\\))?\\s*/gi, '');\n                        desc = desc.replace(/If you are interested(?:,| in)? (?:please )?(?:apply|send|discussing)[^@]*@apexsystems\\.com[^!]*[!.]?\\s*/gi, '');\n                        desc = desc.replace(/If you are interested in applying,? send your resume[^.]+\\.\\s*/gi, '');\n                        desc = desc.replace(/\\*{0,2}Please note that only qualified candidates will be contacted\\s*/gi, '');\n                        desc = desc.replace(/apply TODAY!?\\s*(?:and\\/or)?\\s*/gi, '');\n                        desc = desc.replace(/please send your resume to [^@]+@apexsystems\\.com[^!]*[!.]?\\s*/gi, '');\n                        \n                        // Fallback patterns\n                        desc = desc.replace(/^To apply,? email [^\\n]{0,60}@apexsystems\\.com[^\\n]*\\n?/i, '');\n                        desc = desc.replace(/^For applicants[^\\n]{0,100}@apexsystems\\.com[^\\n]*\\n?/i, '');\n                        \n                        // Clean whitespace\n                        desc = desc.replace(/\\n{3,}/g, '\\n\\n');\n                        \n                        result.description = desc.trim();\n                        \n                        result.employmentType = jsonLd.employmentType || null;\n                        result.datePosted = jsonLd.datePosted || null;\n                        if (jsonLd.identifier && jsonLd.identifier.value) {\n                            result.jobNumber = String(jsonLd.identifier.value);\n                        }\n                        if (jsonLd.jobLocation && jsonLd.jobLocation.address) {\n                            const addr = jsonLd.jobLocation.address;\n                            result.location = [addr.addressLocality, addr.addressRegion].filter(Boolean).join(', ');\n                        }\n                    }\n                } catch (e) { }\n            }\n            \n            const bodyText = document.body.innerText;\n            \n            const extractField = (patterns) => {\n                for (const pattern of patterns) {\n                    const match = bodyText.match(pattern);\n                    if (match) return match[1].trim().split('\\n')[0];\n                }\n                return null;\n            };\n            \n            result.securityClearance = extractField([\n                /Security Clearance:\\s*([^\\n]{5,80})/i,\n                /Clearance requirement:\\s*([^\\n]{5,80})/i,\n                /Clearance[^:]*:\\s*((?:Active\\s+)?(?:TS\\/SCI|Top Secret|Secret|Public Trust)[^\\n]{0,60})/i,\n                /((?:Top Secret|TS\\/SCI|Secret)\\s+clearance[^\\n]{0,40}(?:required|preferred|acceptable)[^\\n]{0,30})/i,\n                /((?:Active|Current)\\s+(?:Top Secret|TS\\/SCI|Secret)[^\\n]{0,40})/i\n            ]);\n            \n            result.payRate = extractField([\n                /Pay Rate:\\s*([^\\n]+)/i, \n                /Rate:\\s*(\\$[^\\n]+|Negotiable[^\\n]*)/i,\n                /Pay:\\s*(\\$[^\\n]+)/i,\n                /Base Salary[:\\s]*(\\$?[\\d,]+-?[\\d,]*(?:k|K)?)/i,\n                /Salary[:\\s]*(\\$?[\\d,]+-?[\\d,]*(?:k|K)?)/i\n            ]);\n            \n            result.duration = extractField([\n                /Project Duration:\\s*([^\\n]+)/i, \n                /Duration:\\s*([^\\n]+)/i, \n                /Contract Length:\\s*([^\\n]+)/i\n            ]);\n            \n            return result;\n        });\n        \n        return { url: request.url, ...jobData, scrapedAt: new Date().toISOString() };\n    }\n    \n    log.warning(`Unknown page type: ${request.url}`);\n    return null;\n}",
  "pageFunctionTimeoutSecs": 120,
  "pageLoadTimeoutSecs": 120,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": [
      "RESIDENTIAL"
    ]
  },
  "proxyRotation": "RECOMMENDED",
  "respectRobotsTxtFile": false,
  "startUrls": [
    {
      "url": "https://www.apexsystems.com/search-results-usa?catalogcode=USA&address=&radius=50&page=1&rows=25&query=Clearance&remote="
    },
    {
      "url": "https://www.apexsystems.com/search-results-usa?catalogcode=USA&address=&radius=50&page=2&rows=25&query=Clearance&remote="
    },
    {
      "url": "https://www.apexsystems.com/search-results-usa?catalogcode=USA&address=&radius=50&page=3&rows=25&query=Clearance&remote="
    },
    {
      "url": "https://www.apexsystems.com/search-results-usa?catalogcode=USA&address=&radius=50&page=4&rows=25&query=Clearance&remote="
    }
  ],
  "useChrome": true,
  "waitUntil": [
    "domcontentloaded"
  ],
  "pseudoUrls": [],
  "excludes": [],
  "initialCookies": [],
  "customData": {}
}
```

### File: apex_llm_parsing_prompt.md (From Previous Session)
**Purpose**: Claude API prompt template for extracting BD intelligence from job descriptions

```markdown
You are a BD intelligence analyst extracting structured data from job postings for defense contractor competitive intelligence.

## Input
Job posting with raw description text.

## Output Schema
Return ONLY valid JSON with no markdown formatting:

{
  "position": "exact job title",
  "location": {
    "city": "city name",
    "state": "2-letter state code",
    "workArrangement": "On-Site|Remote|Hybrid"
  },
  "contract": {
    "employeeType": "Contract|FullTime|ContractToHire",
    "duration": "duration if mentioned or null",
    "rate": "pay rate/salary if mentioned or null"
  },
  "clearance": {
    "level": "Public Trust|Secret|Top Secret|TS/SCI|TS/SCI CI Poly|TS/SCI FSP",
    "status": "Active required|Must be obtainable|Preferred|null"
  },
  "experience": {
    "years": "X+ years or range",
    "degree": "degree requirement or null"
  },
  "skills": ["skill1", "skill2"],
  "technologies": ["tech1", "tech2"],
  "certifications": ["cert1", "cert2"],
  "bdIntel": {
    "clientHints": ["company names mentioned as end client"],
    "programHints": ["program names, contract names"],
    "contractVehicle": ["IDIQ, BPA, task order names"],
    "organization": "specific org/division mentioned"
  },
  "workSchedule": "9/80, 4/10, standard, etc or null",
  "recruiter": {
    "name": "recruiter name or null",
    "email": "email@apexsystems.com or null"
  }
}

## Extraction Rules
1. Extract ALL technical skills and technologies mentioned
2. For clearance, normalize to standard levels
3. clientHints = actual end client (Raytheon, GDIT, etc.), NOT Apex Systems
4. programHints = specific program names (CANES, TEE, etc.)
5. If a field has no data, use null (not empty string)
6. recruiter info may appear at start or end of description
```

---

## 5. NOTION DATABASE SCHEMAS

*Not directly configured in this session. The n8n workflow will populate a Notion database with the following recommended schema:*

### Database: Apex Cleared Jobs

| Property | Type | Notes |
|----------|------|-------|
| Job Number | Title | Primary key |
| Job Title | Text | Position name |
| Location | Text | City, ST format |
| Clearance Level | Select | Secret, TS/SCI, TS/SCI CI Poly, etc. |
| Employment Type | Select | Contract, FullTime, ContractToHire |
| Pay Rate | Text | Raw pay string |
| Duration | Text | Contract duration |
| Date Posted | Date | From scraper |
| Scraped At | Date | Timestamp |
| URL | URL | Link to job posting |
| Description | Text | Cleaned description |
| Client Hints | Multi-select | BD intel - end clients |
| Program Hints | Multi-select | BD intel - programs |
| Technologies | Multi-select | Tech stack |
| Skills | Multi-select | Required skills |
| Status | Select | New, Reviewed, Applied, etc. |

---

## 6. N8N WORKFLOWS

### Planned Workflow: Apex Jobs → Claude → Notion

```
Workflow Name: Apex Cleared Jobs Pipeline
Trigger: Apify Webhook (on scrape completion)

Node Sequence:
1. [Webhook] Apify Actor Complete
   └─▶ Receives JSON array of scraped jobs

2. [Split In Batches] Process Jobs
   └─▶ Split into individual items
   └─▶ Batch size: 1

3. [HTTP Request] Claude API
   └─▶ POST to https://api.anthropic.com/v1/messages
   └─▶ Headers: x-api-key, anthropic-version
   └─▶ Body: System prompt + job description
   └─▶ Model: claude-sonnet-4-20250514

4. [Code] Parse Claude Response
   └─▶ Extract JSON from Claude response
   └─▶ Merge with original job data

5. [Notion] Create Database Item
   └─▶ Map fields to Notion properties
   └─▶ Create new page per job

Error Handling:
- Retry on 429 (rate limit)
- Log failures to separate Notion DB
```

---

## 7. APIFY ACTORS & SCRAPERS

### Actor: Puppeteer Scraper
- **Actor ID**: apify/puppeteer-scraper
- **Purpose**: Scrape Apex Systems cleared job postings

### Input Configuration (V13 Final)
See Section 4 for complete JSON configuration.

### Key Settings
| Setting | Value | Purpose |
|---------|-------|---------|
| `linkSelector` | `a.job-title-link` | Only follow job title links (not city/state/date) |
| `maxCrawlingDepth` | 1 | Only follow links from start pages |
| `maxConcurrency` | 3 | Parallel requests |
| `globs` | `https://www.apexsystems.com/job/*_usa/*` | Only match USA job pages |
| `proxyConfiguration` | Residential proxies | Avoid blocking |
| `waitUntil` | domcontentloaded | Wait for page load |

### Output Schema
```json
{
  "url": "string - full job URL",
  "jobNumber": "string - 7 digit ID",
  "jobTitle": "string - position title",
  "location": "string - City, ST",
  "employmentType": "Contract|FullTime",
  "datePosted": "string - YYYY-MM-DD",
  "securityClearance": "string|null - clearance level",
  "payRate": "string|null - pay info",
  "duration": "string|null - contract length",
  "description": "string - cleaned job description",
  "scrapedAt": "string - ISO timestamp"
}
```

### Expected Output
- **Jobs per run**: ~50-76 unique jobs (depends on duplicates across pages)
- **Pages scraped**: 4 search result pages + individual job pages
- **Run time**: ~5-10 minutes

---

## 8. PROBLEMS SOLVED

### Problem 1: Scraper counting 100 links per page instead of 25
- **Root cause**: Each job row has 4 clickable links (title, city, state, date) all pointing to same URL
- **Solution**: Changed `linkSelector` from `a[href*='/job/']` to `a.job-title-link`

### Problem 2: Scraper wandering to non-clearance jobs
- **Root cause**: Glob pattern `https://www.apexsystems.com/job/*/*` was too broad; auto-pagination was following links to unfiltered pages
- **Solution**: 
  - Changed glob to `https://www.apexsystems.com/job/*_usa/*`
  - Set `maxCrawlingDepth: 1`
  - Added all 4 search pages as explicit startUrls

### Problem 3: Apex boilerplate in descriptions
- **Root cause**: Multiple intro/outro patterns in job descriptions
- **Solution**: 20+ regex patterns to remove:
  - START: "Apex Systems is currently hiring...", "Job #: XXXXX...", etc.
  - END: EEO notices, benefits boilerplate, Military & Veteran programs
  - INLINE: "If interested in applying...", recruiter email prompts

### Problem 4: Jobs appearing on multiple search result pages
- **Root cause**: Apex shows featured/promoted jobs on multiple pages
- **Solution**: Puppeteer automatically deduplicates URLs; this is expected behavior

### Problem 5: Some clearance fields not being extracted
- **Root cause**: Varied formats in job postings (some use "Security Clearance:", others inline)
- **Solution**: Multiple regex patterns with fallbacks for clearance extraction

---

## 9. PENDING ITEMS / NEXT STEPS

### Immediate
- [ ] Test V13 scraper to verify 25 links per page count
- [ ] Verify all 76 unique jobs are scraped (or document actual unique count)
- [ ] Confirm remaining boilerplate patterns are caught

### Short-term
- [ ] Build n8n workflow: Apify webhook → Claude API → Notion
- [ ] Configure Claude API call with LLM parsing prompt
- [ ] Create Notion database with proper schema
- [ ] Test end-to-end pipeline

### Medium-term
- [ ] Set up scheduled scraper runs (daily/weekly)
- [ ] Add deduplication logic in n8n (check if job already exists in Notion)
- [ ] Build dashboard for tracking new opportunities
- [ ] Integrate with BD pipeline for program matching

### Future Enhancements
- [ ] Expand to other staffing companies (Insight Global, etc.)
- [ ] Cross-reference with DoD program database
- [ ] Auto-match jobs to tracked programs
- [ ] Alert system for high-priority opportunities

---

## 10. KEY INSIGHTS & GOTCHAS

### Apex Systems Specific

1. **JSON-LD is your friend**: Apex embeds structured JobPosting data in `<script type="application/ld+json">`. This is more reliable than DOM scraping.

2. **Each job row has 4 links**: Title, city, state, and date all link to the same job URL. Use `a.job-title-link` selector specifically.

3. **Boilerplate varies wildly**: No two recruiters format their intro the same way. Expect to add new patterns over time.

4. **Jobs appear on multiple pages**: Featured/promoted jobs show on multiple search result pages. Deduplication is expected and correct.

5. **URL structure**: Jobs use format `/job/XXXXXXX_usa/job-title-slug`. The `_usa` suffix indicates USA positions.

### Puppeteer Scraper Gotchas

1. **maxCrawlingDepth matters**: Set to 1 to prevent following links FROM job pages (which would lead to unfiltered results).

2. **Glob patterns are powerful but dangerous**: Too broad = scrape the whole site. Too narrow = miss jobs.

3. **linkSelector controls what gets enqueued**: Be specific to avoid noise.

4. **Proxy rotation is essential**: Without residential proxies, you'll get blocked quickly.

5. **Wait times between requests**: 2-3 second delays prevent rate limiting and ensure page loads complete.

### Regex Pattern Tips

1. **Order matters**: Apply END patterns before START patterns (removing end boilerplate first makes start patterns simpler).

2. **Use `[\s\S]*` not `.*` for multiline**: JavaScript regex `.` doesn't match newlines.

3. **Case insensitive globally**: Always use `/i` flag for boilerplate patterns.

4. **Anchor patterns when possible**: `^` for start patterns prevents false matches mid-description.

5. **Test patterns incrementally**: One bad regex can break everything.

### Data Quality Observations

From V11 test run (50 jobs):
- **94%** had clearance keywords in description
- **42%** had `securityClearance` field extracted
- **40%** had `payRate` extracted
- **28%** had `duration` extracted
- **100%** had `location` extracted

The discrepancy between "clearance in description" and "securityClearance field extracted" indicates the regex patterns may need expansion for non-standard formats.

---

## VERSION HISTORY

| Version | Date | Changes |
|---------|------|---------|
| V1-V3 | Jan 5 | Generic field extraction |
| V4 | Jan 5 | BD-focused intelligence schema |
| V5 | Jan 5 | Strict pattern matching (regression) |
| V6 | Jan 5 | Balanced approach |
| V7 | Jan 6 | Two-stage LLM pipeline architecture |
| V8 | Jan 8 | Clean clearance-only URL |
| V9 | Jan 8 | Improved boilerplate removal |
| V10 | Jan 8 | Military programs + inline patterns |
| V11 | Jan 8 | Explicit 4-page startUrls |
| V12 | Jan 8 | Additional inline pattern fixes |
| V13 | Jan 8 | `a.job-title-link` selector (FINAL) |

---

## APPENDIX: BOILERPLATE PATTERNS REFERENCE

### START Patterns (applied to beginning of description)

| Pattern | Example |
|---------|---------|
| `^Job\s*#?:?\s*\d+\s*Apex Systems is (?:currently hiring\|seeking)` | "Job #: 2089337 Apex Systems is currently hiring for..." |
| `^Job\s*#?:?\s*\d+\s*` | "Job #: 2089337 " |
| `^Apex Systems is currently hiring for [^@]+@apexsystems\.com` | "Apex Systems is currently hiring for X...email@apexsystems.com" |
| `^Apex Systems is currently hiring for (?:a \|an )?[^.]+(?:solutions\|services\|...)` | "Apex Systems is currently hiring for a X with a technology company." |
| `^Apex Systems is seeking [^.]+\.` | "Apex Systems is seeking an experienced developer." |
| `^Apex Systems has an opening available for [^@]+@apexsystems\.com` | "Apex Systems has an opening...@apexsystems.com" |
| `^Apex Systems has an opening available for [^!]+!` | "Apex Systems has an opening...apply TODAY!" |
| `^Apex Systems,? a World-Class Technology Solutions Provider[^@]+@apexsystems\.com` | "Apex Systems, a World-Class...@apexsystems.com" |
| `^Apex Systems is a world class[\s\S]*?Here are the details:` | "Apex Systems is a world class...Here are the details:" |
| `^Apex (?:Systems )?has an opportunity for[^.]+\.` | "Apex has an opportunity for X." |
| `^Looking for an exciting[^.]+\.\s*This is perfect for you\.` | "Looking for an exciting career? This is perfect for you." |

### END Patterns (applied to end of description)

| Pattern | Description |
|---------|-------------|
| `EEO Employer` | indexOf truncation |
| `Apex Systems is an equal opportunity employer` | indexOf truncation |
| `\*?Please note that as a contract employee of Apex Systems[\s\S]*$` | Benefits boilerplate |
| `Apex Benefits Overview[\s\S]*$` | Benefits section |
| `\s*Apex Systems Military & Veteran Programs[\s\S]*$` | Military programs section |
| `\s*If you have visited our website in search of information[\s\S]*$` | ADA accommodation notice |

### INLINE Patterns (applied anywhere in description)

| Pattern | Description |
|---------|-------------|
| `Apex Systems is hiring for (?:multiple )?[^!]+!` | "Apex Systems is hiring for multiple Engineers!" |
| `If interested in applying[^@]+@apexsystems\.com\s*(?:\([^)]+\))?` | "If interested in applying...@apexsystems.com (Job ID: X)" |
| `If you are interested(?:,\| in)? (?:please )?(?:apply\|send\|discussing)[^@]*@apexsystems\.com` | Various "If you are interested" patterns |
| `If you are interested in applying,? send your resume[^.]+\.` | "If you are interested in applying, send your resume to..." |
| `\*{0,2}Please note that only qualified candidates will be contacted` | "**Please note that only qualified candidates..." |
| `apply TODAY!?\s*(?:and\/or)?` | "apply TODAY and/or" |
| `please send your resume to [^@]+@apexsystems\.com[^!]*[!.]?` | "please send your resume to X@apexsystems.com" |

---

*Document generated by Claude on January 8, 2026*
