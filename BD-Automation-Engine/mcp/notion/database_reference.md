# Notion Database Reference

Complete reference for PTS BD Intelligence System databases.

## Database IDs

| Database | Collection ID | Purpose |
|----------|---------------|---------|
| DCGS Contacts | `2ccdef65-baa5-8087-a53b-000ba596128e` | 6,288 DCGS program contacts |
| GDIT Other Contacts | `70ea1c94-211d-40e6-a994-e8d7c4807434` | Non-DCGS GDIT contacts |
| GDIT Jobs | `2563119e7914442cbe0fb86904a957a1` | Job postings from GDIT |
| Program Mapping Hub | `f57792c1-605b-424c-8830-23ab41c47137` | Enriched job intelligence |
| BD Opportunities | `2bcdef65-baa5-80ed-bd95-000b2f898e17` | BD pipeline opportunities |
| Federal Programs | `06cd9b22-5d6b-4d37-b0d3-ba99da4971fa` | 388 federal programs |
| Contractors | `3a259041-22bf-4262-a94a-7d33467a1752` | Prime/sub contractor database |
| Contract Vehicles | `0f09543e-9932-44f2-b0ab-7b4c070afb81` | Contract vehicles/IDIQs |

## Database Schemas

### DCGS Contacts
| Property | Type | Description |
|----------|------|-------------|
| Name | Title | Full name |
| Company | Select | Current employer |
| Title | Text | Job title |
| Email | Email | Contact email |
| Phone | Phone | Contact phone |
| LinkedIn | URL | LinkedIn profile |
| Location | Text | City, State |
| Clearance | Select | Security clearance level |
| Program | Select | Associated program |
| Contact_Tier | Select | T1-T6 classification |
| Last_Contact | Date | Most recent interaction |
| Notes | Text | Relationship notes |

### Program Mapping Hub
| Property | Type | Description |
|----------|------|-------------|
| Job Title | Title | Position title |
| Source URL | URL | Original posting URL |
| Company | Select | Staffing company source |
| Location | Text | Job location |
| Clearance | Select | Required clearance |
| Matched_Program | Select | Matched federal program |
| Match_Confidence | Number | 0.0-1.0 confidence |
| Match_Type | Select | direct/fuzzy/inferred |
| BD_Priority_Score | Number | 0-100 score |
| BD_Priority_Tier | Select | Hot/Warm/Cold |
| Status | Select | Processing status |
| Needs_Review | Checkbox | Manual review flag |
| Date_Scraped | Date | Collection date |
| Date_Enriched | Date | Processing date |

### Federal Programs
| Property | Type | Description |
|----------|------|-------------|
| Program Name | Title | Full program name |
| Acronym | Text | Short identifier |
| Agency Owner | Select | DoD, Army, Navy, AF, etc. |
| Prime Contractor | Select | Lead contractor |
| Known Subcontractors | Multi-select | Sub contractors |
| Contract Value | Text | Dollar value |
| Contract Vehicle/Type | Text | IDIQ, TO, etc. |
| Key Locations | Multi-select | Primary locations |
| Clearance Requirements | Select | Required level |
| PTS Involvement | Select | Current/Past/Target/None |
| Priority Level | Select | Critical/High/Medium/Standard |

### BD Opportunities
| Property | Type | Description |
|----------|------|-------------|
| Opportunity Name | Title | BD opportunity name |
| Program | Relation | Linked federal program |
| Status | Select | Pipeline stage |
| Value | Number | Estimated value |
| Win Probability | Number | 0-100% |
| Capture Manager | Person | Assigned CM |
| Due Date | Date | Submission deadline |
| Next Action | Text | Next step |
| Contacts | Relation | Related contacts |

## Query Examples

### Get Hot Priority Jobs
```json
{
  "database_id": "f57792c1-605b-424c-8830-23ab41c47137",
  "filter": {
    "property": "BD_Priority_Tier",
    "select": {
      "equals": "🔥 Hot"
    }
  },
  "sorts": [
    {
      "property": "BD_Priority_Score",
      "direction": "descending"
    }
  ]
}
```

### Get DCGS Contacts by Location
```json
{
  "database_id": "2ccdef65-baa5-8087-a53b-000ba596128e",
  "filter": {
    "property": "Location",
    "rich_text": {
      "contains": "San Diego"
    }
  }
}
```

### Get Programs by Prime Contractor
```json
{
  "database_id": "06cd9b22-5d6b-4d37-b0d3-ba99da4971fa",
  "filter": {
    "property": "Prime Contractor",
    "select": {
      "equals": "GDIT"
    }
  }
}
```

### Get Jobs Needing Review
```json
{
  "database_id": "f57792c1-605b-424c-8830-23ab41c47137",
  "filter": {
    "property": "Needs_Review",
    "checkbox": {
      "equals": true
    }
  }
}
```
