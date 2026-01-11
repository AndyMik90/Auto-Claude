---
name: bd-call-sheet
description: Generate structured call sheets for BD outreach campaigns. Use when preparing for contact outreach to create organized call lists with talking points, pain points, and conversation guides by program and tier.
---

# BD Call Sheet Generator

Create structured, prioritized call sheets for BD outreach campaigns with talking points, pain points, and tier-appropriate conversation guides.

**Keywords**: call sheet, outreach, BD campaign, talking points, pain points, conversation guide, call list, program manager, contact prioritization

## Call Sheet Structure

### Header Information

```markdown
# BD Call Sheet
**Campaign:** [Campaign Name]
**Date Generated:** [YYYY-MM-DD]
**Target Program:** [Program Name]
**BD Owner:** [Your Name]
**Total Contacts:** [Count]
**Priority Breakdown:** [X Hot / Y Warm / Z Cold]
```

### Contact Entry Format

```markdown
## Contact #[N]: [Full Name]
**Priority:** [Hot/Warm/Cold] | **Tier:** [1-6]

### Quick Reference
| Field | Value |
|-------|-------|
| Title | [Job Title] |
| Company | [Company Name] |
| Program | [Program Name] |
| Location | [City, State] |
| Phone | [Phone Number] |
| Email | [Email Address] |
| LinkedIn | [Profile URL] |
| Last Contact | [Date or "Never"] |

### Talking Points
1. [Pain point or value prop #1]
2. [Pain point or value prop #2]
3. [Specific ask or next step]

### Conversation Guide
**Opening:** "[Tier-appropriate opener]"
**Bridge:** "[Connection to their pain point]"
**Ask:** "[Specific call-to-action]"

### Notes
[Previous interactions, intel gathered, warnings]
```

## Priority Assignment Rules

### Hot Priority (Immediate Outreach)

Assign HOT when ANY of these conditions are met:

| Condition | Score Contribution |
|-----------|-------------------|
| BD Priority Score >= 80 | Required |
| Tier 1-3 (Executive/Director/PM) | +20 |
| DCGS program contact | +15 |
| Recent job posting in their org | +10 |
| San Diego/PACAF location | +10 |
| Previous positive interaction | +10 |

### Warm Priority (Weekly Follow-up)

Assign WARM when:
- BD Priority Score 50-79
- OR Tier 4-5 with relevant program alignment
- OR Intelligence source for higher-tier approach

### Cold Priority (Pipeline Tracking)

Assign COLD when:
- BD Priority Score < 50
- OR No clear program alignment
- OR Tier 6 without specific intel value

## Call Sheet Templates by Campaign Type

### Template 1: Program-Specific Campaign

```markdown
# [PROGRAM NAME] Outreach Campaign
**Objective:** [Specific goal]
**Timeline:** [Start] - [End]
**Success Metric:** [Meetings booked / Intel gathered / etc.]

## Campaign Context
[2-3 sentences about why targeting this program now]

## Key Pain Points to Address
1. [Validated pain point #1 - source: Tier X contact]
2. [Validated pain point #2 - source: Tier X contact]
3. [Validated pain point #3 - source: Tier X contact]

## Contacts (Sorted by Priority)

### HOT CONTACTS
[Contact entries...]

### WARM CONTACTS
[Contact entries...]

### COLD CONTACTS (Pipeline)
[Contact entries...]

## Campaign Tracking
| Contact | Status | Next Action | Date | Notes |
|---------|--------|-------------|------|-------|
| | | | | |
```

### Template 2: Location-Based Campaign

```markdown
# [LOCATION] BD Blitz
**Location Hub:** [Hampton Roads / San Diego Metro / etc.]
**Programs Covered:** [List of programs at this location]
**Total Contacts:** [Count]

## Location Context
[Intel about this location - vacancies, pain points, key events]

## Contacts by Program

### [Program 1]
[Contact entries...]

### [Program 2]
[Contact entries...]
```

### Template 3: Event Follow-up Campaign

```markdown
# Post-[EVENT NAME] Follow-up
**Event Date:** [Date]
**Contacts Met:** [Count]
**Follow-up Deadline:** [Date + 5 business days]

## Event Notes
[Key takeaways, announcements, trends discussed]

## Follow-up Contacts
[Contact entries with event-specific talking points]
```

## Talking Points by Tier

### Tier 1-2 (Executive/Director)

**Focus:** Strategic partnership, enterprise value

```
- "We've been supporting [RELATED PROGRAM] and see strong alignment with your portfolio priorities..."
- "Based on conversations with your team, I understand there's pressure on [PAIN POINT]..."
- "I'd like to discuss how we can support your [CURRENT_YEAR] objectives..."
```

### Tier 3 (Program Leadership)

**Focus:** Program-specific solutions, delivery confidence

```
- "Your team mentioned [SPECIFIC PAIN POINT] - we've solved similar challenges on [PAST PERFORMANCE]..."
- "I understand you're looking to fill [ROLE] - we have candidates with exact match experience..."
- "Can we schedule 30 minutes to discuss how we can help with [SPECIFIC NEED]?"
```

### Tier 4 (Management)

**Focus:** Operational support, team augmentation

```
- "I heard your team is dealing with [PAIN POINT] - we can provide immediate support..."
- "We have [X] cleared resources available for [PROGRAM/LOCATION]..."
- "What's your timeline for bringing on additional support?"
```

### Tier 5-6 (IC/Senior IC)

**Focus:** Relationship building, intelligence gathering

```
- "I'd love to learn more about what you're working on at [PROGRAM]..."
- "How's the team doing with [KNOWN CHALLENGE]?"
- "Who should I be talking to about staffing needs on your team?"
```

## Pain Point Reference by Program

### AF DCGS - PACAF (San Diego)

| Pain Point | Source | Validated | Talking Point |
|------------|--------|-----------|---------------|
| Acting site lead | Tier 6 IC | Yes | "We can provide experienced leadership to reduce that burden..." |
| Single points of failure | Tier 5 Sr | Yes | "Our cross-training approach ensures continuity..." |
| No backup for net/sec | Tier 4 Mgr | Verify | "We have network specialists available immediately..." |

### AF DCGS - Langley (Hampton Roads)

| Pain Point | Source | Validated | Talking Point |
|------------|--------|-----------|---------------|
| High ISR volume | Tier 6 IC | Yes | "We can augment your analyst capacity quickly..." |
| Analyst burnout | Tier 5 Sr | Yes | "Additional headcount can provide relief..." |
| PMO vacancy pressure | Tier 3 PM | Yes | "Let me show you our pipeline of qualified candidates..." |

### AF DCGS - Wright-Patt (Dayton)

| Pain Point | Source | Validated | Talking Point |
|------------|--------|-----------|---------------|
| Radar engineer vacancy | Tier 4 Mgr | Yes | "We've identified candidates with NASIC experience..." |
| DevSecOps shortage | Tier 5 Sr | Verify | "Platform One veterans in our network..." |

## Call Outcome Tracking

After each call, update:

```markdown
## Call Log Entry

**Contact:** [Name]
**Date/Time:** [Timestamp]
**Duration:** [Minutes]
**Outcome:** [Connected / Voicemail / No Answer / Email Instead]

**Key Intel Gathered:**
- [Point 1]
- [Point 2]

**Next Steps:**
- [ ] [Action item with date]

**Follow-up Date:** [Date]
**Notes:** [Free text]
```

## Call Sheet Generation Checklist

Before generating call sheet:

- [ ] Verify contact data is current (within 30 days)
- [ ] Check for recent interactions in CRM
- [ ] Validate pain points with multiple sources
- [ ] Confirm phone numbers/emails are valid
- [ ] Review any do-not-contact flags
- [ ] Sort by priority and tier
- [ ] Add campaign-specific talking points
- [ ] Include relevant past performance references

## Integration with Notion

### Call Sheet Database Schema

| Property | Type | Description |
|----------|------|-------------|
| Campaign Name | Title | Campaign identifier |
| Generated Date | Date | Creation timestamp |
| Target Program | Select | Program focus |
| Contact Count | Number | Total contacts |
| Hot Count | Number | Priority breakdown |
| Warm Count | Number | Priority breakdown |
| Cold Count | Number | Priority breakdown |
| Status | Select | Active/Completed/Paused |
| BD Owner | Person | Assigned BD rep |
| Notion Doc Link | URL | Full call sheet document |

### Automation Triggers

1. **Weekly Call Sheet**: Auto-generate Monday 6 AM for active campaigns
2. **Event Follow-up**: Generate within 24 hours of event completion
3. **Hot Lead Alert**: Immediate notification for new Hot priority contacts
4. **Stale Contact Alert**: Flag contacts not contacted in 30+ days
