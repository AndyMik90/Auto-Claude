# Notion Database Cleanup Plan

**Generated:** January 13, 2026
**Purpose:** Document recommended cleanup actions for BD Intelligence databases

---

## Executive Summary

The schema analysis identified several optimization opportunities across the main databases:
- **Duplicate/similar properties** that can be consolidated
- **Empty multi-select options** that need population or removal
- **Complex formulas** that could be simplified for performance

---

## Database-Specific Cleanup Actions

### 1. Jobs Database (Program Mapping Intelligence Hub)

#### High Priority - Consolidate Status Fields
| Current Fields | Action | Notes |
|---------------|--------|-------|
| `Status` | **KEEP** | Primary workflow status |
| `Outreach Status` | **KEEP** | BD-specific tracking |
| `Validation Status` | **KEEP** | Data quality tracking |
| `Set-aside Status` | **RENAME** to `Set-Aside Type` | Avoid confusion with Status |

#### Medium Priority - Clean Up Company Fields
| Current Fields | Action | Notes |
|---------------|--------|-------|
| `Company` | **KEEP** | Source company (scraped) |
| `Prime Company` (relation) | **KEEP** | Link to Contractors DB |
| `Prime Contractor` (text) | **MIGRATE** to Prime Company relation, then remove |
| `Our Company Canonical` | **KEEP** | For eligibility matching |
| `Is Our Company Sub?` | **KEEP** | Calculated flag |
| `Is Our Company Sub? 1` | **REMOVE** | Duplicate formula |

#### Low Priority - Formula Optimization
These formulas work but could be simplified for performance:
- `BD Priority Index` - Consider pre-computing in N8N
- `Pursuit Cost Index` - Consider pre-computing in N8N
- `Win Probability Score` - Consider pre-computing in N8N
- `Revenue Potential` - Consider pre-computing in N8N
- `Enrichment Readiness Score` - Consider simplifying logic

#### Populate Empty Multi-Selects
| Field | Action |
|-------|--------|
| `NAICS Parsed` | Auto-populate from Contract NAICS field via N8N |
| `Subcontractors` | Auto-populate from job descriptions |
| `Required Technologies` | Auto-populate from job descriptions via LLM |

---

### 2. Federal Programs Database

#### High Priority - Remove Duplicate Fields
| Keep | Remove | Migration |
|------|--------|-----------|
| `Prime Contractor` (relation) | `Prime Contractor 1` (text) | Already migrated |
| `Period of Performance` (date) | `Period of Performance (Original)` (text) | Migrate text to date |
| `Contract Vehicle Used` (relation) | `Contract Vehicle/Type` (text) | Already migrated |
| `Program Type` (select) | `Program Type 1` (text) | Already migrated |
| `BD Approach Notes` (new) | Keep `Notes` | Separate purposes |

#### Populate Empty Multi-Selects
| Field | Action |
|-------|--------|
| `Security Requirements` | Auto-populate: TS/SCI, TS, Secret from clearance data |
| `Technical Stack` | Auto-populate from job descriptions via LLM |

---

### 3. Contact Databases (DCGS & GDIT)

#### Consolidate Duplicate Fields
| Keep | Remove/Consolidate | Notes |
|------|-------------------|-------|
| `Name` (title) | | Full name |
| `First Name` | KEEP | For personalization |
| `Last Name` | KEEP | For search |
| `Phone Number` | `Direct Phone Number` (merge) | Pick one |
| `Date` | Clarify purpose | Unclear - review usage |
| `Last Contact Date` (new) | KEEP | BD tracking |
| `Next Outreach Date` (new) | KEEP | BD tracking |

---

## Implementation Priority

### Phase 1 (Immediate - Done)
- [x] Add missing BD Dashboard fields
- [x] Add BD Priority to Programs
- [x] Add Outreach tracking to Contacts
- [x] Add Relationship Status to Contractors

### Phase 1.5 (This Week)
- [ ] Rename `Set-aside Status` to `Set-Aside Type`
- [ ] Remove `Is Our Company Sub? 1` duplicate
- [ ] Review and merge phone number fields in Contacts
- [ ] Clear `Prime Contractor 1`, `Contract Vehicle/Type`, `Program Type 1` text fields

### Phase 2 (Next Sprint)
- [ ] Create N8N workflow to auto-populate empty multi-selects
- [ ] Optimize complex formulas or move to N8N pre-computation
- [ ] Set up data quality dashboard to track completeness

---

## SQL-Like Cleanup Queries (For Manual Execution)

These are conceptual - implement via N8N or Notion API scripts:

```
-- Find jobs with both text and relation prime contractor
SELECT * FROM jobs
WHERE "Prime Contractor" IS NOT NULL
AND "Prime Company" IS NOT NULL;

-- Find programs with duplicate fields populated
SELECT * FROM programs
WHERE "Prime Contractor 1" IS NOT NULL
AND "Prime Contractor" IS NOT NULL;

-- Find contacts without BD Priority
SELECT * FROM contacts
WHERE "BD Priority" IS NULL;
```

---

## Notes

- All cleanup should be done during off-hours to avoid disruption
- Create backups before bulk changes
- Test changes on a single record first
- Use N8N for bulk data migrations with error handling
