---
name: apify-job-scraping
description: Apify actor configuration and web scraping patterns for competitor job portals. Use when setting up scrapers for ClearanceJobs, LinkedIn, Apex Systems, Insight Global, TEKsystems, or other staffing portal job extraction.
---

# Apify Job Scraping Engine

Configure and manage web scrapers for extracting job postings from competitor portals and job boards for BD intelligence.

**Keywords**: Apify, web scraping, ClearanceJobs, LinkedIn, Apex Systems, Insight Global, TEKsystems, job scraper, actor, webhook

## Target Sources

### Priority 1: Federal Job Boards

| Source | Actor Type | Priority | Notes |
|--------|-----------|----------|-------|
| ClearanceJobs | Custom scraper | Critical | Primary cleared job source |
| USAJobs | API Integration | High | Federal direct hire |
| Indeed (filtered) | Generic scraper | Medium | Filter for defense keywords |

### Priority 2: Competitor Staffing Portals

| Source | Actor Type | Priority | Notes |
|--------|-----------|----------|-------|
| Apex Systems | Custom scraper | High | Major competitor |
| Insight Global | Custom scraper | High | Major competitor |
| TEKsystems | Custom scraper | Medium | Defense contractor jobs |
| Robert Half | Generic scraper | Low | Occasional defense roles |

### Priority 3: Prime Contractor Career Sites

| Source | Actor Type | Notes |
|--------|-----------|-------|
| BAE Systems Careers | Custom scraper | AF DCGS Prime |
| GDIT Careers | Custom scraper | DCGS Sub/Prime |
| Leidos Careers | Custom scraper | IC Competitor |
| SAIC Careers | Custom scraper | DoD Competitor |

## Apify Actor Configuration

### ClearanceJobs Scraper

```json
{
  "actorId": "apify/clearancejobs-scraper",
  "input": {
    "searchQueries": [
      "DCGS",
      "ISR analyst",
      "intelligence surveillance reconnaissance",
      "distributed common ground",
      "TS/SCI",
      "480th ISR"
    ],
    "locations": [
      "San Diego, CA",
      "Hampton, VA",
      "Dayton, OH",
      "Norfolk, VA",
      "Fort Belvoir, VA"
    ],
    "clearanceLevels": [
      "TS/SCI",
      "TS/SCI with Polygraph",
      "Top Secret"
    ],
    "maxResults": 100,
    "sortBy": "date",
    "datePosted": "last7days"
  },
  "webhook": {
    "url": "${N8N_WEBHOOK_URL}",
    "eventTypes": ["ACTOR.RUN.SUCCEEDED"]
  },
  "schedule": {
    "cronExpression": "0 6 * * *",
    "timezone": "America/New_York"
  }
}
```

### LinkedIn Jobs Scraper

```json
{
  "actorId": "apify/linkedin-jobs-scraper",
  "input": {
    "searchQueries": [
      "DCGS intelligence",
      "ISR analyst TS/SCI",
      "defense contractor cleared"
    ],
    "companies": [
      "BAE Systems",
      "General Dynamics",
      "Leidos",
      "SAIC",
      "Booz Allen Hamilton"
    ],
    "locations": [
      "San Diego Metropolitan Area",
      "Greater Hampton Roads",
      "Dayton, Ohio Area",
      "Washington DC-Baltimore Area"
    ],
    "maxResults": 50,
    "proxy": {
      "useApifyProxy": true,
      "apifyProxyGroups": ["RESIDENTIAL"]
    }
  }
}
```

### Competitor Portal Scraper (Generic Template)

```json
{
  "actorId": "apify/web-scraper",
  "input": {
    "startUrls": [
      { "url": "https://www.apexsystems.com/careers?q=DCGS" },
      { "url": "https://www.insightglobal.com/jobs?keyword=intelligence" },
      { "url": "https://www.teksystems.com/jobs?search=TS%2FSCI" }
    ],
    "pageFunction": "// See page function below",
    "maxRequestsPerCrawl": 200,
    "maxConcurrency": 5,
    "useChrome": true
  }
}
```

## Page Function Template

```javascript
async function pageFunction(context) {
    const { $, request, log } = context;

    // Extract job details from page
    const jobs = [];

    $('.job-listing, .job-card, [data-job-id]').each((i, el) => {
        const $job = $(el);

        jobs.push({
            title: $job.find('.job-title, h2, h3').first().text().trim(),
            company: $job.find('.company-name, .employer').text().trim(),
            location: $job.find('.location, .job-location').text().trim(),
            description: $job.find('.description, .job-desc').text().trim(),
            clearance: extractClearance($job.text()),
            url: $job.find('a').attr('href'),
            datePosted: $job.find('.date, .posted-date').text().trim(),
            source: request.userData.source || 'unknown',
            scrapedAt: new Date().toISOString()
        });
    });

    return jobs;
}

function extractClearance(text) {
    const patterns = [
        /TS\/SCI\s*(?:with|w\/)\s*(?:Full.?Scope\s*)?Poly(?:graph)?/i,
        /TS\/SCI\s*(?:with|w\/)\s*CI\s*Poly(?:graph)?/i,
        /TS\/SCI/i,
        /Top\s*Secret/i,
        /Secret/i
    ];

    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match) return match[0];
    }
    return 'Unknown';
}
```

## Output Schema

Each scraped job should conform to this schema:

```json
{
  "id": "string (generated UUID)",
  "title": "string",
  "company": "string",
  "location": "string (City, State)",
  "description": "string",
  "clearance": "string (TS/SCI, Secret, etc.)",
  "url": "string (source URL)",
  "datePosted": "string (YYYY-MM-DD)",
  "source": "string (clearancejobs, linkedin, apex, etc.)",
  "scrapedAt": "string (ISO timestamp)",
  "technologies": ["array of strings"],
  "salary": "string (if available)",
  "jobType": "string (Contract, Permanent, etc.)"
}
```

## n8n Webhook Integration

### Webhook Payload Structure

```json
{
  "eventType": "ACTOR.RUN.SUCCEEDED",
  "actorId": "apify/clearancejobs-scraper",
  "runId": "abc123",
  "datasetId": "xyz789",
  "itemCount": 47,
  "status": "SUCCEEDED"
}
```

### n8n Workflow Trigger

```json
{
  "nodes": [
    {
      "name": "Apify Webhook",
      "type": "n8n-nodes-base.webhook",
      "parameters": {
        "path": "job-data-intake",
        "httpMethod": "POST",
        "responseMode": "onReceived"
      }
    },
    {
      "name": "Fetch Dataset",
      "type": "n8n-nodes-base.httpRequest",
      "parameters": {
        "method": "GET",
        "url": "=https://api.apify.com/v2/datasets/{{$json.datasetId}}/items",
        "authentication": "genericCredentialType",
        "genericAuthType": "httpQueryAuth",
        "queryParameters": {
          "token": "={{$credentials.apifyToken}}"
        }
      }
    }
  ]
}
```

## Scheduling Strategy

| Source | Frequency | Time (EST) | Rationale |
|--------|-----------|------------|-----------|
| ClearanceJobs | Daily | 6:00 AM | Fresh morning data |
| LinkedIn | Daily | 7:00 AM | After ClearanceJobs |
| Apex Systems | 2x/week | Mon/Thu 8 AM | Moderate volume |
| Insight Global | 2x/week | Tue/Fri 8 AM | Moderate volume |
| Prime Careers | Weekly | Saturday 6 AM | Lower priority |

## Rate Limiting & Best Practices

### Avoiding Blocks

1. **Use Residential Proxies** for LinkedIn and career sites
2. **Randomize Request Delays**: 2-5 seconds between requests
3. **Rotate User Agents**: Use realistic browser fingerprints
4. **Respect robots.txt**: Check allowed paths
5. **Session Management**: Maintain cookies across requests

### Cost Optimization

| Strategy | Savings | Implementation |
|----------|---------|----------------|
| Deduplication | ~30% | Hash job ID + title + company |
| Delta Scraping | ~50% | Only scrape new postings |
| Caching | ~20% | Cache company/location data |
| Scheduling | ~40% | Off-peak hours, reduced frequency |

## Error Handling

```javascript
// Retry configuration
{
  "maxRetries": 3,
  "retryDelayMs": 5000,
  "errorHandling": {
    "BLOCKED": "switch-proxy",
    "RATE_LIMITED": "exponential-backoff",
    "TIMEOUT": "retry",
    "CAPTCHA": "manual-review"
  }
}
```

## Monitoring & Alerts

Set up alerts for:

- Actor run failures
- Significant drop in job count (>50% from baseline)
- High error rates (>10%)
- Blocked requests
- Dataset size anomalies

## Data Pipeline Flow

```
Apify Actor Run
      |
      v
Webhook to n8n
      |
      v
Validate & Clean
      |
      v
Deduplicate
      |
      v
Insert to Notion (raw_import)
      |
      v
Trigger Enrichment Pipeline
```

## Monthly Maintenance

- [ ] Review scraper performance metrics
- [ ] Update selectors if sites changed
- [ ] Refresh proxy pool
- [ ] Update search queries based on BD priorities
- [ ] Archive old scraped data
