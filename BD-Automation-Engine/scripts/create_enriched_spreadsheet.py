#!/usr/bin/env python3
"""
Create Enriched Jobs Spreadsheet
Combines scraped job data with program mapping, contact matching, and org chart enrichment.

Pipeline: Job Data -> Program Mapping -> Contact Matching -> OrgChart Enrichment -> CSV/JSON Export
"""

import json
import csv
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Any
from collections import defaultdict


# ============================================
# PATHS
# ============================================

BASE_DIR = Path(__file__).parent.parent
OUTPUTS_DIR = BASE_DIR / "outputs"
BD_DASHBOARD_DIR = OUTPUTS_DIR / "bd_dashboard"

# Input files (pre-enriched data)
JOBS_INPUT = OUTPUTS_DIR / "insight_global_full" / "n8n" / "jobs_webhook_20260113_003131.json"
PROGRAMS_INPUT = BD_DASHBOARD_DIR / "programs_enriched.json"
CONTACTS_INPUT = BD_DASHBOARD_DIR / "contacts_classified.json"

# Output files
OUTPUT_DIR = OUTPUTS_DIR / "enriched_spreadsheet"


# ============================================
# LOCATION TO CONTACT MAPPING
# ============================================

LOCATION_CONTACT_MAP = {
    # San Diego Metro
    "san diego": ["AF DCGS - PACAF", "Navy DCGS-N"],
    "la mesa": ["AF DCGS - PACAF"],
    "pacific beach": ["AF DCGS - PACAF"],

    # Hampton Roads
    "hampton": ["AF DCGS - Langley"],
    "newport news": ["AF DCGS - Langley"],
    "langley": ["AF DCGS - Langley"],
    "norfolk": ["Navy DCGS-N"],
    "suffolk": ["Navy DCGS-N"],
    "virginia beach": ["Navy DCGS-N"],

    # Dayton/Wright-Patt
    "dayton": ["AF DCGS - Wright-Patt"],
    "beavercreek": ["AF DCGS - Wright-Patt"],
    "fairborn": ["AF DCGS - Wright-Patt"],
    "wright-patterson": ["AF DCGS - Wright-Patt"],

    # DC Metro
    "herndon": ["Corporate HQ"],
    "falls church": ["Corporate HQ"],
    "reston": ["Corporate HQ"],
    "fort belvoir": ["Army DCGS-A"],
    "fort meade": ["NSA/CYBERCOM", "Cyber"],
    "springfield": ["NGA Programs"],
    "mclean": ["IC Corporate"],
    "chantilly": ["NRO/IC"],
    "arlington": ["Pentagon", "Corporate HQ"],

    # Huntsville
    "huntsville": ["MDA", "C2BMC", "Army Missile"],
    "redstone": ["Army Missile", "MDA"],

    # Colorado
    "colorado springs": ["Space Force", "NORAD"],
    "peterson": ["Space Force"],
    "schriever": ["Space Force"],

    # Florida
    "tampa": ["SOCOM", "CENTCOM"],
    "macdill": ["SOCOM", "CENTCOM"],
    "eglin": ["53rd Air Wing", "Air Force"],

    # Other bases
    "fort bragg": ["Army SOF"],
    "fayetteville": ["Army SOF"],
    "aberdeen": ["Army DCGS-A"],
    "fort huachuca": ["Army Intel"],
}


# ============================================
# HELPER FUNCTIONS
# ============================================

def load_json_file(filepath: Path, limit: int = None) -> Any:
    """Load a JSON file, optionally limiting the number of items."""
    if not filepath.exists():
        print(f"Warning: File not found: {filepath}")
        return None

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    return data


def load_jobs_chunked(filepath: Path, chunk_size: int = 100) -> List[Dict]:
    """Load jobs from a large JSON file in chunks."""
    print(f"Loading jobs from {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    jobs = data.get('jobs', [])
    print(f"Loaded {len(jobs)} jobs")
    return jobs


def load_contacts_by_location(filepath: Path) -> Dict[str, List[Dict]]:
    """Load contacts and index by location/program for quick lookup."""
    print(f"Loading contacts from {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Build index: program -> contacts
    program_contacts = defaultdict(list)
    total_contacts = 0

    # Process contacts by tier
    by_tier = data.get('by_tier', {})
    for tier, contacts in by_tier.items():
        for contact in contacts:
            program = contact.get('program', '')
            if program:
                program_contacts[program.lower()].append(contact)
                total_contacts += 1

    print(f"Indexed {total_contacts} contacts across {len(program_contacts)} programs")
    return dict(program_contacts)


def load_programs(filepath: Path) -> Dict[str, Dict]:
    """Load programs and index by name."""
    print(f"Loading programs from {filepath}...")

    with open(filepath, 'r', encoding='utf-8') as f:
        data = json.load(f)

    programs = data.get('programs', [])

    # Build index: program_name (lowercase) -> program data
    program_index = {}
    for prog in programs:
        name = prog.get('name', '')
        if name:
            program_index[name.lower()] = prog

    print(f"Indexed {len(program_index)} programs")
    return program_index


def extract_location_key(location: str) -> str:
    """Extract a normalized location key for matching."""
    if not location:
        return ""

    # Normalize
    loc = location.lower().strip()

    # Try to match against known locations
    for key in LOCATION_CONTACT_MAP.keys():
        if key in loc:
            return key

    return loc


def match_contacts_for_job(job: Dict, contact_index: Dict, program_index: Dict) -> List[Dict]:
    """Find matching contacts for a job based on location and program."""
    matches = []

    # Get job's mapped program
    mapping = job.get('_mapping', {})
    matched_program = mapping.get('program_name', '')

    # Get job location
    location = job.get('location', '')
    loc_key = extract_location_key(location)

    # Strategy 1: Match by program name
    if matched_program and matched_program.lower() in contact_index:
        contacts = contact_index[matched_program.lower()]
        for c in contacts[:3]:  # Limit to top 3
            matches.append({
                'name': f"{c.get('first_name', '')} {c.get('name', '')}".strip(),
                'title': c.get('title', ''),
                'tier': c.get('tier', 6),
                'email': c.get('email', ''),
                'match_reason': 'program'
            })

    # Strategy 2: Match by location if we have location->program mappings
    if loc_key and loc_key in LOCATION_CONTACT_MAP:
        related_programs = LOCATION_CONTACT_MAP[loc_key]
        for prog in related_programs:
            prog_lower = prog.lower()
            if prog_lower in contact_index:
                contacts = contact_index[prog_lower]
                for c in contacts[:2]:  # Limit to top 2 per program
                    match = {
                        'name': f"{c.get('first_name', '')} {c.get('name', '')}".strip(),
                        'title': c.get('title', ''),
                        'tier': c.get('tier', 6),
                        'email': c.get('email', ''),
                        'match_reason': 'location'
                    }
                    if match not in matches:
                        matches.append(match)

    return matches[:5]  # Return max 5 contacts


def enrich_job(job: Dict, contact_index: Dict, program_index: Dict) -> Dict:
    """Enrich a job with contact matching and program details."""
    enriched = job.copy()

    # Get matched contacts
    matched_contacts = match_contacts_for_job(job, contact_index, program_index)
    enriched['matched_contacts'] = matched_contacts
    enriched['matched_contact_count'] = len(matched_contacts)

    # Get primary contact info
    if matched_contacts:
        primary = matched_contacts[0]
        enriched['primary_contact_name'] = primary['name']
        enriched['primary_contact_title'] = primary['title']
        enriched['primary_contact_tier'] = primary['tier']
        enriched['primary_contact_email'] = primary['email']
    else:
        enriched['primary_contact_name'] = ''
        enriched['primary_contact_title'] = ''
        enriched['primary_contact_tier'] = ''
        enriched['primary_contact_email'] = ''

    # Get program details
    mapping = job.get('_mapping', {})
    program_name = mapping.get('program_name', '')
    if program_name and program_name.lower() in program_index:
        prog = program_index[program_name.lower()]
        enriched['program_prime_contractor'] = prog.get('prime_contractor', '')
        enriched['program_contract_value'] = prog.get('contract_value', '')
        enriched['program_status'] = prog.get('status', '')
        enriched['program_location'] = prog.get('location', '')
    else:
        enriched['program_prime_contractor'] = ''
        enriched['program_contract_value'] = ''
        enriched['program_status'] = ''
        enriched['program_location'] = ''

    return enriched


def job_to_flat_row(job: Dict) -> Dict:
    """Convert an enriched job to a flat row for CSV export."""
    mapping = job.get('_mapping', {})
    scoring = job.get('_scoring', {})
    breakdown = scoring.get('Score Breakdown', {})

    # Get recommendations as string
    recommendations = scoring.get('Recommendations', [])
    rec_str = '; '.join(recommendations) if recommendations else ''

    # Get signals as string (first 5)
    signals = mapping.get('signals', [])[:5]
    signals_str = '; '.join(signals) if signals else ''

    # Build flat row
    row = {
        # Core job fields
        'Job URL': job.get('url', ''),
        'Job Title': job.get('title', job.get('jobTitle', '')),
        'Company': job.get('company', ''),
        'Location': job.get('location', ''),
        'Security Clearance': job.get('clearance', job.get('securityClearance', '')),
        'Employment Type': job.get('employmentType', job.get('jobType', '')),
        'Pay Rate': job.get('payRate', ''),
        'Date Posted': job.get('datePosted', ''),
        'Source': job.get('source', job.get('Source', '')),
        'Scraped At': job.get('scrapedAt', job.get('Processed At', '')),

        # Program mapping
        'Matched Program': mapping.get('program_name', ''),
        'Match Confidence': mapping.get('match_confidence', 0),
        'Match Type': mapping.get('match_type', ''),
        'Secondary Candidates': ', '.join(mapping.get('secondary_candidates', [])),
        'Match Signals': signals_str,

        # BD Scoring
        'BD Priority Score': scoring.get('BD Priority Score', breakdown.get('final_score', 0)),
        'Priority Tier': scoring.get('Priority Tier', ''),
        'Base Score': breakdown.get('base_score', 50),
        'Clearance Boost': breakdown.get('clearance_boost', 0),
        'Program Boost': breakdown.get('program_boost', 0),
        'Location Boost': breakdown.get('location_boost', 0),
        'Confidence Boost': breakdown.get('confidence_boost', 0),
        'Recency Boost': breakdown.get('recency_boost', 0),
        'Recommendations': rec_str,

        # Contact enrichment
        'Primary Contact': job.get('primary_contact_name', ''),
        'Contact Title': job.get('primary_contact_title', ''),
        'Contact Tier': job.get('primary_contact_tier', ''),
        'Contact Email': job.get('primary_contact_email', ''),
        'Matched Contacts Count': job.get('matched_contact_count', 0),

        # Program enrichment
        'Prime Contractor': job.get('program_prime_contractor', ''),
        'Contract Value': job.get('program_contract_value', ''),
        'Program Status': job.get('program_status', ''),
        'Program Locations': job.get('program_location', ''),
    }

    return row


def export_to_csv(jobs: List[Dict], output_path: Path):
    """Export enriched jobs to CSV."""
    if not jobs:
        print("No jobs to export")
        return

    # Flatten all jobs
    rows = [job_to_flat_row(job) for job in jobs]

    # Get all field names from first row
    fieldnames = list(rows[0].keys())

    # Write CSV
    with open(output_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Exported {len(rows)} jobs to {output_path}")


def export_to_json(jobs: List[Dict], output_path: Path):
    """Export enriched jobs to JSON."""
    output = {
        'generated_at': datetime.now().isoformat(),
        'total_count': len(jobs),
        'jobs': jobs,
        'summary': {
            'hot_leads': len([j for j in jobs if j.get('_scoring', {}).get('BD Priority Score', 0) >= 80]),
            'warm_leads': len([j for j in jobs if 50 <= j.get('_scoring', {}).get('BD Priority Score', 0) < 80]),
            'with_contacts': len([j for j in jobs if j.get('matched_contact_count', 0) > 0]),
            'with_program': len([j for j in jobs if j.get('_mapping', {}).get('program_name', '') not in ['', 'Unmatched']]),
        }
    }

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2)

    print(f"Exported {len(jobs)} jobs to {output_path}")


# ============================================
# MAIN PIPELINE
# ============================================

def run_enrichment_pipeline():
    """Main enrichment pipeline."""
    print("=" * 60)
    print("BD AUTOMATION ENGINE - ENRICHED SPREADSHEET GENERATOR")
    print("=" * 60)
    print()

    # Create output directory
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    # Step 1: Load data
    print("STEP 1: Loading data sources...")
    jobs = load_jobs_chunked(JOBS_INPUT)
    contact_index = load_contacts_by_location(CONTACTS_INPUT)
    program_index = load_programs(PROGRAMS_INPUT)
    print()

    if not jobs:
        print("ERROR: No jobs loaded. Exiting.")
        return

    # Step 2: Enrich jobs
    print("STEP 2: Enriching jobs with contact and program data...")
    enriched_jobs = []
    for i, job in enumerate(jobs):
        enriched = enrich_job(job, contact_index, program_index)
        enriched_jobs.append(enriched)

        if (i + 1) % 100 == 0:
            print(f"  Processed {i + 1}/{len(jobs)} jobs...")

    print(f"  Enriched {len(enriched_jobs)} jobs")
    print()

    # Step 3: Generate summary stats
    print("STEP 3: Generating summary statistics...")

    # Count by priority tier
    tier_counts = defaultdict(int)
    for job in enriched_jobs:
        tier = job.get('_scoring', {}).get('Priority Tier', 'Unknown')
        tier_counts[tier] += 1

    print("  Priority Tier Distribution:")
    for tier, count in sorted(tier_counts.items(), key=lambda x: -x[1]):
        # Remove emoji for console output compatibility
        tier_clean = ''.join(c for c in str(tier) if ord(c) < 128).strip()
        if not tier_clean:
            tier_clean = "Unknown"
        print(f"    {tier_clean}: {count}")

    # Count with contacts
    with_contacts = len([j for j in enriched_jobs if j.get('matched_contact_count', 0) > 0])
    print(f"  Jobs with matched contacts: {with_contacts}/{len(enriched_jobs)}")

    # Count with program match
    with_program = len([j for j in enriched_jobs if j.get('_mapping', {}).get('program_name', '') not in ['', 'Unmatched']])
    print(f"  Jobs with program match: {with_program}/{len(enriched_jobs)}")
    print()

    # Step 4: Export results
    print("STEP 4: Exporting enriched data...")
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # Export CSV
    csv_path = OUTPUT_DIR / f"jobs_enriched_{timestamp}.csv"
    export_to_csv(enriched_jobs, csv_path)

    # Export JSON
    json_path = OUTPUT_DIR / f"jobs_enriched_{timestamp}.json"
    export_to_json(enriched_jobs, json_path)

    print()
    print("=" * 60)
    print("ENRICHMENT COMPLETE!")
    print("=" * 60)
    print(f"CSV Output: {csv_path}")
    print(f"JSON Output: {json_path}")
    print()

    # Return paths for downstream processing
    return {
        'csv': csv_path,
        'json': json_path,
        'jobs_count': len(enriched_jobs),
        'with_contacts': with_contacts,
        'with_program': with_program,
    }


if __name__ == '__main__':
    run_enrichment_pipeline()
