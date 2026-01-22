"""
Program Mapper
Extracts and maps federal programs from job titles and descriptions.
Builds program-to-job relationships for Past Performance tracking.
"""

import sqlite3
import re
import json
from pathlib import Path
from datetime import datetime
from collections import defaultdict

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"

# Known federal programs and their patterns
FEDERAL_PROGRAMS = {
    # Intelligence Community
    'DCGS': {
        'patterns': [r'DCGS', r'Distributed Common Ground System'],
        'agency': 'DoD',
        'description': 'Distributed Common Ground System'
    },
    'NGA': {
        'patterns': [r'\bNGA\b', r'National Geospatial'],
        'agency': 'NGA',
        'description': 'National Geospatial-Intelligence Agency'
    },
    'NRO': {
        'patterns': [r'\bNRO\b', r'National Reconnaissance'],
        'agency': 'NRO',
        'description': 'National Reconnaissance Office'
    },
    'NSA': {
        'patterns': [r'\bNSA\b', r'National Security Agency'],
        'agency': 'NSA',
        'description': 'National Security Agency'
    },

    # DoD Agencies
    'MDA': {
        'patterns': [r'\bMDA\b', r'Missile Defense Agency', r'Missile Defense'],
        'agency': 'MDA',
        'description': 'Missile Defense Agency'
    },
    'DISA': {
        'patterns': [r'\bDISA\b', r'Defense Information Systems'],
        'agency': 'DISA',
        'description': 'Defense Information Systems Agency'
    },
    'DIA': {
        'patterns': [r'\bDIA\b', r'Defense Intelligence Agency'],
        'agency': 'DIA',
        'description': 'Defense Intelligence Agency'
    },
    'DARPA': {
        'patterns': [r'\bDARPA\b', r'Defense Advanced Research'],
        'agency': 'DARPA',
        'description': 'Defense Advanced Research Projects Agency'
    },

    # Military Branches
    'Army': {
        'patterns': [r'\bArmy\b', r'U\.S\. Army', r'US Army'],
        'agency': 'Army',
        'description': 'U.S. Army'
    },
    'Navy': {
        'patterns': [r'\bNavy\b', r'U\.S\. Navy', r'US Navy', r'NAVSEA', r'NAVAIR'],
        'agency': 'Navy',
        'description': 'U.S. Navy'
    },
    'Air Force': {
        'patterns': [r'Air Force', r'\bUSAF\b', r'AFRL'],
        'agency': 'Air Force',
        'description': 'U.S. Air Force'
    },
    'Space Force': {
        'patterns': [r'Space Force', r'\bUSSF\b', r'Space Systems Command'],
        'agency': 'Space Force',
        'description': 'U.S. Space Force'
    },
    'Marines': {
        'patterns': [r'Marine Corps', r'\bUSMC\b', r'Marines'],
        'agency': 'Marine Corps',
        'description': 'U.S. Marine Corps'
    },

    # Federal Civilian
    'DHS': {
        'patterns': [r'\bDHS\b', r'Homeland Security', r'Department of Homeland'],
        'agency': 'DHS',
        'description': 'Department of Homeland Security'
    },
    'FBI': {
        'patterns': [r'\bFBI\b', r'Federal Bureau of Investigation'],
        'agency': 'FBI',
        'description': 'Federal Bureau of Investigation'
    },
    'VA': {
        'patterns': [r'\bVA\b', r'Veterans Affairs', r'Veterans Administration'],
        'agency': 'VA',
        'description': 'Department of Veterans Affairs'
    },
    'HHS': {
        'patterns': [r'\bHHS\b', r'Health and Human Services'],
        'agency': 'HHS',
        'description': 'Department of Health and Human Services'
    },
    'CMS': {
        'patterns': [r'\bCMS\b', r'Centers for Medicare'],
        'agency': 'CMS',
        'description': 'Centers for Medicare & Medicaid Services'
    },
    'FAA': {
        'patterns': [r'\bFAA\b', r'Federal Aviation'],
        'agency': 'FAA',
        'description': 'Federal Aviation Administration'
    },
    'NASA': {
        'patterns': [r'\bNASA\b', r'National Aeronautics'],
        'agency': 'NASA',
        'description': 'National Aeronautics and Space Administration'
    },
    'DOE': {
        'patterns': [r'\bDOE\b', r'Department of Energy'],
        'agency': 'DOE',
        'description': 'Department of Energy'
    },
    'IRS': {
        'patterns': [r'\bIRS\b', r'Internal Revenue'],
        'agency': 'IRS',
        'description': 'Internal Revenue Service'
    },
    'SSA': {
        'patterns': [r'\bSSA\b', r'Social Security Administration'],
        'agency': 'SSA',
        'description': 'Social Security Administration'
    },
    'State Department': {
        'patterns': [r'State Department', r'Department of State', r'\bDOS\b'],
        'agency': 'State',
        'description': 'Department of State'
    },

    # Specific Programs
    'AEGIS': {
        'patterns': [r'\bAEGIS\b'],
        'agency': 'Navy',
        'description': 'AEGIS Combat System'
    },
    'SLS': {
        'patterns': [r'\bSLS\b', r'Space Launch System'],
        'agency': 'NASA',
        'description': 'Space Launch System'
    },
    'F-35': {
        'patterns': [r'F-35', r'Joint Strike Fighter', r'JSF'],
        'agency': 'DoD',
        'description': 'F-35 Joint Strike Fighter Program'
    },
    'ABMS': {
        'patterns': [r'\bABMS\b', r'Advanced Battle Management'],
        'agency': 'Air Force',
        'description': 'Advanced Battle Management System'
    },
    'JADC2': {
        'patterns': [r'JADC2', r'Joint All-Domain Command'],
        'agency': 'DoD',
        'description': 'Joint All-Domain Command and Control'
    },
}

# Skill/Technology keywords for classification
SKILL_CATEGORIES = {
    'Cybersecurity': [r'cyber', r'security', r'SIEM', r'SOC', r'penetration', r'vulnerability',
                      r'infosec', r'CISSP', r'firewall', r'intrusion'],
    'Cloud': [r'AWS', r'Azure', r'cloud', r'GCP', r'kubernetes', r'docker', r'DevOps'],
    'Software Development': [r'developer', r'software engineer', r'programmer', r'coding',
                              r'java', r'python', r'C\+\+', r'\.NET', r'full stack'],
    'Data Science/AI': [r'data scientist', r'machine learning', r'ML', r'AI', r'artificial intelligence',
                        r'analytics', r'big data', r'data engineer'],
    'Systems Engineering': [r'systems engineer', r'system engineer', r'integration', r'architecture'],
    'Network Engineering': [r'network engineer', r'CCNA', r'CCNP', r'cisco', r'routing', r'switching'],
    'Project Management': [r'project manager', r'program manager', r'PMP', r'scrum master', r'agile'],
    'Database': [r'DBA', r'database', r'SQL', r'Oracle', r'PostgreSQL', r'MongoDB'],
    'Testing/QA': [r'test engineer', r'QA', r'quality assurance', r'SDET', r'automation test'],
}


def extract_programs_from_text(text: str) -> list:
    """Extract federal programs from text."""
    if not text:
        return []

    found_programs = []
    for program_name, program_info in FEDERAL_PROGRAMS.items():
        for pattern in program_info['patterns']:
            if re.search(pattern, text, re.IGNORECASE):
                found_programs.append({
                    'program': program_name,
                    'agency': program_info['agency'],
                    'description': program_info['description']
                })
                break  # Only add once per program

    return found_programs


def extract_skills_from_text(text: str) -> list:
    """Extract skill categories from text."""
    if not text:
        return []

    found_skills = []
    for skill_category, patterns in SKILL_CATEGORIES.items():
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                found_skills.append(skill_category)
                break

    return found_skills


def run_program_mapping():
    """Run program mapping on all jobs."""
    print("="*80)
    print("PROGRAM MAPPER")
    print("="*80)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get all jobs
    print("\nAnalyzing jobs for program matches...")
    cursor.execute("""
        SELECT id, bullhorn_job_id, title, prime_contractor, status, date_added
        FROM jobs
        WHERE title IS NOT NULL
    """)

    jobs = cursor.fetchall()
    print(f"Total jobs to analyze: {len(jobs)}")

    # Track program mappings
    program_jobs = defaultdict(list)
    job_programs = {}
    skill_distribution = defaultdict(int)

    for job in jobs:
        job_id = job['id']
        title = job['title'] or ''

        # Extract programs
        programs = extract_programs_from_text(title)
        job_programs[job_id] = programs

        for prog in programs:
            program_jobs[prog['program']].append({
                'job_id': job_id,
                'bullhorn_id': job['bullhorn_job_id'],
                'title': title,
                'prime': job['prime_contractor'],
                'status': job['status'],
                'date_added': job['date_added']
            })

        # Extract skills
        skills = extract_skills_from_text(title)
        for skill in skills:
            skill_distribution[skill] += 1

    # Also analyze placements
    print("\nAnalyzing placements for program matches...")
    cursor.execute("""
        SELECT id, bullhorn_placement_id, job_title, client_name, status, start_date
        FROM placements
        WHERE job_title IS NOT NULL
    """)

    placements = cursor.fetchall()
    print(f"Total placements to analyze: {len(placements)}")

    placement_programs = defaultdict(list)

    for plc in placements:
        title = plc['job_title'] or ''

        programs = extract_programs_from_text(title)
        for prog in programs:
            placement_programs[prog['program']].append({
                'placement_id': plc['id'],
                'bullhorn_id': plc['bullhorn_placement_id'],
                'title': title,
                'prime': plc['client_name'],
                'status': plc['status'],
                'start_date': plc['start_date']
            })

    # Store mappings in database
    print("\nStoring program mappings...")

    # Clear existing mappings
    cursor.execute("DELETE FROM programs")
    cursor.execute("DELETE FROM job_program_mapping")

    # Insert programs
    for program_name, program_info in FEDERAL_PROGRAMS.items():
        job_count = len(program_jobs.get(program_name, []))
        placement_count = len(placement_programs.get(program_name, []))

        if job_count > 0 or placement_count > 0:
            cursor.execute("""
                INSERT INTO programs (name, acronym, agency, description, total_jobs, total_placements)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                program_info['description'],
                program_name,
                program_info['agency'],
                program_info['description'],
                job_count,
                placement_count
            ))

    conn.commit()

    # Generate report
    print("\n" + "="*80)
    print("PROGRAM MAPPING RESULTS")
    print("="*80)

    # Sort programs by total activity
    sorted_programs = sorted(
        FEDERAL_PROGRAMS.items(),
        key=lambda x: len(program_jobs.get(x[0], [])) + len(placement_programs.get(x[0], [])),
        reverse=True
    )

    report = {
        'generated_at': datetime.now().isoformat(),
        'total_jobs_analyzed': len(jobs),
        'total_placements_analyzed': len(placements),
        'programs': {},
        'skill_distribution': dict(skill_distribution)
    }

    print(f"\n{'Program':<25} {'Agency':<15} {'Jobs':<8} {'Placements':<12}")
    print("-"*65)

    for program_name, program_info in sorted_programs:
        job_count = len(program_jobs.get(program_name, []))
        placement_count = len(placement_programs.get(program_name, []))

        if job_count > 0 or placement_count > 0:
            print(f"{program_name:<25} {program_info['agency']:<15} {job_count:<8} {placement_count:<12}")

            report['programs'][program_name] = {
                'agency': program_info['agency'],
                'description': program_info['description'],
                'total_jobs': job_count,
                'total_placements': placement_count,
                'jobs': program_jobs.get(program_name, [])[:10],  # Sample
                'placements': placement_programs.get(program_name, [])[:10]  # Sample
            }

    # Skill distribution
    print("\n" + "="*80)
    print("SKILL DISTRIBUTION")
    print("="*80)

    for skill, count in sorted(skill_distribution.items(), key=lambda x: x[1], reverse=True):
        print(f"  {skill}: {count} jobs")

    # Save report
    report_path = OUTPUT_DIR / f"program_mapping_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2, default=str)

    print(f"\nReport saved to: {report_path}")

    # Summary
    programs_with_activity = sum(1 for p in FEDERAL_PROGRAMS if
                                  len(program_jobs.get(p, [])) > 0 or
                                  len(placement_programs.get(p, [])) > 0)

    print("\n" + "="*80)
    print("SUMMARY")
    print("="*80)
    print(f"Programs with job/placement matches: {programs_with_activity}")
    print(f"Total jobs mapped to programs: {sum(len(v) for v in program_jobs.values())}")
    print(f"Total placements mapped to programs: {sum(len(v) for v in placement_programs.values())}")

    conn.close()
    return report


if __name__ == "__main__":
    run_program_mapping()
