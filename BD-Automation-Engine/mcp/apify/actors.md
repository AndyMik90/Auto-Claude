# Apify Actor Configurations

Reference configurations for BD Automation scrapers.

## Job Scraper Actors

### ClearanceJobs Scraper
**Purpose**: Scrape cleared job postings from ClearanceJobs.com

```json
{
  "startUrls": [
    { "url": "https://www.clearancejobs.com/jobs?keywords=DCGS" },
    { "url": "https://www.clearancejobs.com/jobs?keywords=intelligence+analyst&clearance=ts-sci" },
    { "url": "https://www.clearancejobs.com/jobs?location=san-diego-ca&clearance=ts-sci" }
  ],
  "pseudoUrls": [
    { "purl": "https://www.clearancejobs.com/jobs/[.*]" }
  ],
  "linkSelector": "a.job-title",
  "pageFunction": "async function pageFunction(context) { /* extraction logic */ }",
  "maxRequestsPerCrawl": 200,
  "maxConcurrency": 5,
  "proxyConfiguration": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

### Apex Systems Scraper
**Purpose**: Scrape Apex Systems staffing job board

```json
{
  "startUrls": [
    { "url": "https://www.apexsystems.com/find-work/search?q=DCGS" },
    { "url": "https://www.apexsystems.com/find-work/search?q=cleared&location=San%20Diego" }
  ],
  "pageFunction": "async function pageFunction(context) {\n  const $ = context.jQuery;\n  const jobs = [];\n  $('.job-card').each((i, el) => {\n    jobs.push({\n      title: $(el).find('.job-title').text().trim(),\n      location: $(el).find('.job-location').text().trim(),\n      url: $(el).find('a').attr('href'),\n      company: 'Apex Systems'\n    });\n  });\n  return jobs;\n}",
  "maxRequestsPerCrawl": 100
}
```

### Insight Global Scraper
**Purpose**: Scrape Insight Global job postings

```json
{
  "startUrls": [
    { "url": "https://jobs.insightglobal.com/search?q=security+clearance" },
    { "url": "https://jobs.insightglobal.com/search?q=DCGS" }
  ],
  "maxRequestsPerCrawl": 100,
  "proxyConfiguration": {
    "useApifyProxy": true
  }
}
```

### TEKsystems Scraper
**Purpose**: Scrape TEKsystems job board

```json
{
  "startUrls": [
    { "url": "https://www.teksystems.com/en/careers/jobs?keywords=cleared" },
    { "url": "https://www.teksystems.com/en/careers/jobs?keywords=ts%2Fsci" }
  ],
  "maxRequestsPerCrawl": 100
}
```

### LinkedIn Jobs Scraper
**Purpose**: Scrape LinkedIn job postings (requires LinkedIn scraper actor)

```json
{
  "searchUrl": "https://www.linkedin.com/jobs/search/?keywords=DCGS&location=San%20Diego",
  "maxItems": 100,
  "proxy": {
    "useApifyProxy": true,
    "apifyProxyGroups": ["RESIDENTIAL"]
  }
}
```

## Output Field Mapping

All scrapers should output data in this standardized format:

| Field | Type | Description |
|-------|------|-------------|
| `url` | String | Job posting URL |
| `title` | String | Job title |
| `company` | String | Staffing company name |
| `location` | String | City, State |
| `description` | String | Full job description |
| `detected_clearance` | String | Extracted clearance level |
| `primary_keyword` | String | Matched search keyword |
| `pay_rate` | String | Salary/hourly rate if available |
| `employment_type` | String | Contract/Full-time/etc |
| `date_posted` | String | Posting date |
| `scraped_at` | String | ISO timestamp of scrape |

## Keyword Sets

### DCGS-Focused Keywords
```
DCGS, Distributed Common Ground System, DGS-1, DGS-2, PACAF,
intelligence analyst, ISR, GEOINT, SIGINT, MASINT,
imagery analyst, signals analyst, all-source analyst
```

### Clearance Keywords
```
TS/SCI, Top Secret, SCI, CI Poly, Full Scope Poly,
security clearance required, cleared position
```

### Location Keywords
```
San Diego CA, Hampton VA, Norfolk VA, Dayton OH,
Fort Belvoir VA, Langley VA, Wright-Patterson AFB
```

## Schedule Recommendations

| Scraper | Frequency | Time | Keywords |
|---------|-----------|------|----------|
| ClearanceJobs | Daily | 6 AM | DCGS, cleared |
| Apex Systems | Daily | 7 AM | All keywords |
| Insight Global | Daily | 7:30 AM | All keywords |
| TEKsystems | Daily | 8 AM | All keywords |
| LinkedIn | Weekly | Monday 9 AM | DCGS only |

## Cost Estimates

| Actor | CU per 100 items | Monthly (daily runs) |
|-------|------------------|----------------------|
| ClearanceJobs | 0.3 | ~9 CU |
| Apex Systems | 0.4 | ~12 CU |
| Insight Global | 0.4 | ~12 CU |
| TEKsystems | 0.4 | ~12 CU |
| LinkedIn | 1.5 | ~6 CU (weekly) |
| **Total** | | **~51 CU/month** |

Fits within Starter plan (49 CU) with optimization, or Scale plan for buffer.
