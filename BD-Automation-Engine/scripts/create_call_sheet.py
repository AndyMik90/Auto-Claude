#!/usr/bin/env python3
"""
Create a high-confidence call sheet CSV matching GDIT jobs to GDIT contacts.
Script: George Maranville approach - approved GDIT supplier reaching out to hiring managers.
"""

import json
import csv
from pathlib import Path
from collections import defaultdict
import re

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "dashboard" / "public" / "data"
OUTPUT_DIR = BASE_DIR / "outputs"
OUTPUT_DIR.mkdir(exist_ok=True)

def load_json(filename):
    with open(DATA_DIR / filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def normalize_state(loc):
    """Normalize state for matching."""
    if not loc:
        return None
    loc = loc.lower().strip()
    state_map = {
        'arizona': 'az', 'virginia': 'va', 'maryland': 'md', 'california': 'ca',
        'texas': 'tx', 'colorado': 'co', 'florida': 'fl', 'georgia': 'ga',
        'alabama': 'al', 'new york': 'ny', 'massachusetts': 'ma',
        'north carolina': 'nc', 'ohio': 'oh', 'pennsylvania': 'pa',
        'new mexico': 'nm', 'utah': 'ut', 'hawaii': 'hi', 'nevada': 'nv',
        'district of columbia': 'dc', 'washington dc': 'dc', 'dc': 'dc'
    }
    for full, abbr in state_map.items():
        if full in loc:
            return abbr
    for abbr in state_map.values():
        if f', {abbr}' in loc or loc.endswith(f' {abbr}') or loc == abbr:
            return abbr
    # Check for abbreviations in location
    parts = loc.replace(',', ' ').split()
    for part in parts:
        if part.upper() in ['VA', 'MD', 'TX', 'CA', 'CO', 'FL', 'GA', 'AL', 'MA', 'NC', 'AZ', 'HI', 'DC']:
            return part.lower()
    return None

def extract_program_from_job(job_name):
    """Extract GDIT program from job name."""
    name = job_name.upper()
    programs = {
        'JUSTIFIED': 'JUSTIFIED',
        'MPCO': 'MPCO',
        'BIM': 'BIM',
        'ISEE': 'ISEE',
        'BICES': 'BICES',
        'ADCNOMS': 'ADCNOMS',
    }
    for key, prog in programs.items():
        if key in name:
            return prog
    return None

def get_role_keywords(title):
    """Extract role keywords from title."""
    if not title:
        return set()
    title_lower = title.lower()
    keywords = set()

    # Security roles
    if any(x in title_lower for x in ['isso', 'issm', 'security']):
        keywords.add('security')
    if any(x in title_lower for x in ['network', 'system admin', 'sysadmin']):
        keywords.add('network')
    if any(x in title_lower for x in ['engineer', 'engineering']):
        keywords.add('engineer')
    if any(x in title_lower for x in ['manager', 'lead', 'director']):
        keywords.add('manager')
    if any(x in title_lower for x in ['analyst']):
        keywords.add('analyst')
    if any(x in title_lower for x in ['it', 'ia', 'information']):
        keywords.add('it')

    return keywords

def is_hiring_manager(contact):
    """Check if contact is likely a hiring manager (Tier 1-4)."""
    title = (contact.get('jobTitle') or '').lower()
    tier = contact.get('tier', 6)

    # Tier 1-4 are managers
    if tier <= 4:
        return True

    # Also check title keywords
    manager_keywords = ['manager', 'director', 'lead', 'chief', 'head', 'vp', 'president', 'supervisor']
    return any(kw in title for kw in manager_keywords)

def match_contact_to_job(contact, job):
    """Calculate match score. Returns (score, reasons)."""
    score = 0
    reasons = []

    contact_title = (contact.get('jobTitle') or '').lower()
    contact_state = contact.get('state', '')
    contact_city = (contact.get('city') or '').lower()
    contact_tier = contact.get('tier', 6)

    job_title = job.get('title', '')
    job_location = job.get('location', '')
    job_program = job.get('program', '')

    # 1. Must be a manager/decision maker (Tier 1-4) - required
    if not is_hiring_manager(contact):
        return 0, []

    score += 20
    reasons.append(f"Tier {contact_tier} contact")

    # 2. Location match (30 points)
    job_state = normalize_state(job_location)
    contact_state_norm = normalize_state(contact_state)

    if job_state and contact_state_norm:
        if job_state == contact_state_norm:
            score += 30
            reasons.append(f"Location match: {contact_state}")
        elif contact_state_norm in ['va', 'md', 'dc'] and job_state in ['va', 'md', 'dc']:
            # DMV area match
            score += 25
            reasons.append("DMV area match")

    # 3. Role/function match (30 points)
    job_keywords = get_role_keywords(job_title)
    contact_keywords = get_role_keywords(contact_title)

    overlap = job_keywords & contact_keywords
    if overlap:
        score += min(len(overlap) * 15, 30)
        reasons.append(f"Role match: {', '.join(overlap)}")

    # 4. Program match (20 points)
    job_prog = extract_program_from_job(job_title) or job_program
    if job_prog:
        # Check if contact title mentions program
        if job_prog.lower() in contact_title:
            score += 20
            reasons.append(f"Program match: {job_prog}")

    return score, reasons

def main():
    print("Loading data...")
    jobs = load_json('jobs.json')
    contacts = load_json('contacts.json')

    # Filter to GDIT jobs only (these are the ones we can call GDIT contacts about)
    gdit_jobs = [j for j in jobs if j.get('source') == 'GDIT' and j.get('status') == 'Open']
    print(f"GDIT Open jobs: {len(gdit_jobs)}")

    # Filter to manager-level contacts only
    manager_contacts = [c for c in contacts if is_hiring_manager(c)]
    print(f"Manager-level contacts (Tier 1-4): {len(manager_contacts)}")

    # Find matches
    print("\nFinding high-confidence matches (score >= 50)...")
    matches = []

    for job in gdit_jobs:
        job_matches = []
        for contact in manager_contacts:
            score, reasons = match_contact_to_job(contact, job)
            if score >= 50:
                job_matches.append({
                    'contact': contact,
                    'score': score,
                    'reasons': reasons
                })

        # Sort by score and take top 5 contacts per job
        job_matches.sort(key=lambda x: -x['score'])
        for match in job_matches[:5]:
            matches.append({
                'job': job,
                'contact': match['contact'],
                'score': match['score'],
                'reasons': match['reasons']
            })

    print(f"Found {len(matches)} high-confidence matches")

    # Sort all matches by score
    matches.sort(key=lambda x: -x['score'])

    # Create CSV
    csv_path = OUTPUT_DIR / "gdit_call_sheet.csv"

    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)

        # Header
        writer.writerow([
            # Job Info
            'Job_ID', 'Job_Title', 'Job_Location', 'Job_Status', 'Job_Program',
            # Contact Info
            'Contact_Name', 'Contact_Title', 'Contact_Tier',
            'Contact_Email', 'Contact_Phone', 'Contact_LinkedIn',
            'Contact_City', 'Contact_State',
            # Match Info
            'Match_Score', 'Match_Reasons',
            # SCRIPT TEMPLATE FIELDS
            'FIRST_NAME', 'FULL_NAME', 'COMPANY_NAME', 'OPEN_JOB_TITLE',
            'JOB_LOCATION', 'PROGRAM_NAME', 'CONTACT_TITLE_SHORT'
        ])

        for match in matches:
            job = match['job']
            contact = match['contact']

            # Template fields
            first_name = contact.get('firstName') or contact.get('name', '').split()[0]
            full_name = contact.get('name', '')
            company_name = 'GDIT'

            # Clean job title (remove job number prefix)
            job_title = job.get('title', '')
            if '|' in job_title:
                open_job_title = job_title.split('|')[-1].strip()
            else:
                open_job_title = job_title

            job_location = job.get('location', '')
            program_name = extract_program_from_job(job_title) or job.get('program', '') or 'your program'

            # Short contact title
            contact_title = contact.get('jobTitle', '')
            contact_title_short = ' '.join(contact_title.split()[:4]) if contact_title else ''

            writer.writerow([
                # Job Info
                job.get('id', ''),
                job.get('title', ''),
                job.get('location', ''),
                job.get('status', ''),
                job.get('program', ''),
                # Contact Info
                contact.get('name', ''),
                contact.get('jobTitle', ''),
                contact.get('tier', ''),
                contact.get('email', ''),
                contact.get('phone', ''),
                contact.get('linkedIn', ''),
                contact.get('city', ''),
                contact.get('state', ''),
                # Match Info
                match['score'],
                ' | '.join(match['reasons']),
                # Template Fields
                first_name,
                full_name,
                company_name,
                open_job_title,
                job_location,
                program_name,
                contact_title_short
            ])

    print(f"\nCall sheet saved to: {csv_path}")

    # Create George's script template
    script_path = OUTPUT_DIR / "george_call_script.txt"
    with open(script_path, 'w', encoding='utf-8') as f:
        f.write("""
================================================================================
GEORGE MARANVILLE - BD CALL SCRIPT
Prime Technical Services - Approved GDIT Supplier
================================================================================

CSV TEMPLATE FIELDS (use these in mail merge or copy from CSV):
- {FIRST_NAME}         - Contact's first name
- {FULL_NAME}          - Contact's full name
- {COMPANY_NAME}       - GDIT
- {OPEN_JOB_TITLE}     - The open job title
- {JOB_LOCATION}       - Location of the job
- {PROGRAM_NAME}       - GDIT Program name (JUSTIFIED, MPCO, etc.)
- {CONTACT_TITLE_SHORT} - Contact's title (abbreviated)

================================================================================
PHONE SCRIPT - OPENING
================================================================================

"Hi {FIRST_NAME}, this is George Maranville with Prime Tech.

I'm a portfolio manager for {COMPANY_NAME}. Some of my {OPEN_JOB_TITLE}
contractors in {JOB_LOCATION} have been getting calls about this role,
and I was reaching out as an approved GDIT supplier to let you know -
if you're struggling to find the right talent, we can be of service
to you immediately."

[PAUSE - Let them respond]

================================================================================
IF THEY'RE INTERESTED / HAVE NEEDS
================================================================================

"Great! We've got several {OPEN_JOB_TITLE} candidates with active clearances
who are currently wrapping up projects. They're specifically interested in
{PROGRAM_NAME} work in the {JOB_LOCATION} area.

What's the timeline looking like on your end? Are you looking to fill this
in the next few weeks, or is there flexibility?"

================================================================================
IF THEY'RE NOT THE RIGHT PERSON
================================================================================

"I understand. Who would be the right person to speak with about staffing
needs for {PROGRAM_NAME}? I want to make sure I'm connecting with the
right hiring manager."

================================================================================
QUALIFYING QUESTIONS
================================================================================

1. "How urgent is this {OPEN_JOB_TITLE} need for {PROGRAM_NAME}?"

2. "Are there any specific skills or certifications you're looking for
   beyond what's in the posting?"

3. "What's been the biggest challenge filling this role so far?"

4. "Is there budget flexibility, or is the rate locked in?"

================================================================================
CLOSE
================================================================================

"I've got a couple of strong candidates I can send over today. What's
the best email to send their profiles to?

And {FIRST_NAME}, if these don't work out, I'd like to stay in touch -
we're always building our bench for {COMPANY_NAME} programs. Is there
a good time for a quick follow-up call next week?"

================================================================================
VOICEMAIL
================================================================================

"Hi {FIRST_NAME}, this is George Maranville with Prime Tech - we're an
approved GDIT supplier.

I'm calling about your {OPEN_JOB_TITLE} opening in {JOB_LOCATION}. Some
of my contractors have mentioned this role, and I wanted to reach out
directly to see if we can help you fill it quickly.

Give me a call back at [YOUR NUMBER] or shoot me an email at
gmaranville@primetechservices.com.

Thanks!"

================================================================================
EMAIL FOLLOW-UP
================================================================================

Subject: {OPEN_JOB_TITLE} - {JOB_LOCATION} - Prime Tech Can Help

Hi {FIRST_NAME},

I'm George Maranville with Prime Technical Services - an approved GDIT
staffing supplier.

I noticed your {OPEN_JOB_TITLE} opening in {JOB_LOCATION} and wanted to
reach out directly. We have several cleared candidates specifically
looking for {PROGRAM_NAME} opportunities who could be a great fit.

Would you have 10 minutes this week to discuss your requirements?

Best regards,
George Maranville
Portfolio Manager
Prime Technical Services
[PHONE]
gmaranville@primetechservices.com

================================================================================
""")

    print(f"Script template saved to: {script_path}")

    # Summary stats
    print("\n" + "="*60)
    print("SUMMARY")
    print("="*60)
    print(f"Total matches: {len(matches)}")
    print(f"Unique jobs with contacts: {len(set(m['job']['id'] for m in matches))}")
    print(f"Unique contacts matched: {len(set(m['contact']['id'] for m in matches))}")

    # Show top 10 matches
    print("\nTop 10 highest-confidence matches:")
    for i, match in enumerate(matches[:10], 1):
        job = match['job']
        contact = match['contact']
        job_title = job.get('title', '').split('|')[-1].strip() if '|' in job.get('title', '') else job.get('title', '')
        print(f"{i}. [{match['score']}] {contact.get('name')} ({contact.get('jobTitle')[:30]}...)")
        print(f"   -> {job_title[:50]}...")
        print(f"   Location: {contact.get('city')}, {contact.get('state')} | {job.get('location')}")
        print()

if __name__ == "__main__":
    main()
