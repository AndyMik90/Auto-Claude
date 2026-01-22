"""
Link Bullhorn Data to Federal Programs Database
Maps placements and jobs to federal programs from Engine2.
"""

import sqlite3
import csv
import json
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
FEDERAL_PROGRAMS_CSV = Path(__file__).parent.parent.parent / "Engine2_ProgramMapping" / "data" / "Federal Programs MASTER ENRICHED.csv"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"


def normalize_company(name: str) -> str:
    """Normalize company name for matching."""
    if not name:
        return ""
    lower = name.lower().strip()
    # Remove common suffixes
    for suffix in ['inc', 'llc', 'corp', 'corporation', 'ltd', 'co', 'company', 'inc.', 'llc.']:
        lower = re.sub(rf'\b{suffix}\b', '', lower)
    lower = re.sub(r'\s+', ' ', lower).strip()
    return lower


def load_federal_programs():
    """Load federal programs from CSV."""
    programs = []

    with open(FEDERAL_PROGRAMS_CSV, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            program = {
                'name': row.get('Program Name', ''),
                'acronym': row.get('Acronym', ''),
                'agency': row.get('Agency Owner', ''),
                'program_type': row.get('Program Type', ''),
                'priority': row.get('Priority Level', ''),
                'prime_contractor': row.get('Prime Contractor', '') or row.get('Prime Contractor (Consolidated)', ''),
                'contract_value': row.get('Contract Value', '') or row.get('Contract Value (Consolidated)', ''),
                'period_start': row.get('PoP Start (Consolidated)', '') or row.get('PoP Start', ''),
                'period_end': row.get('PoP End (Consolidated)', '') or row.get('PoP End', ''),
                'locations': row.get('Key Locations', '') or row.get('Performance Location (TANGO)', ''),
                'typical_roles': row.get('Typical Roles', ''),
                'job_titles': row.get('Job Titles', ''),
                'clearance': row.get('Clearance Requirements', ''),
                'naics': row.get('NAICS Code (Consolidated)', ''),
                'subcontractors': row.get('Key Subcontractors', '') or row.get('Known Subcontractors', ''),
            }
            if program['name']:
                programs.append(program)

    return programs


def match_placement_to_programs(placement: dict, programs: list) -> list:
    """Find matching federal programs for a placement."""
    matches = []

    placement_prime = normalize_company(placement.get('client_name', ''))
    placement_title = (placement.get('job_title', '') or '').lower()

    for program in programs:
        score = 0
        reasons = []

        # Check prime contractor match
        program_prime = normalize_company(program.get('prime_contractor', ''))
        program_subs = normalize_company(program.get('subcontractors', ''))

        if placement_prime and program_prime:
            # Direct prime match
            if placement_prime in program_prime or program_prime in placement_prime:
                score += 50
                reasons.append('Prime match')

            # Check for known primes in program
            for prime_name in ['leidos', 'gdit', 'general dynamics', 'peraton', 'boeing',
                              'caci', 'northrop', 'lockheed', 'saic', 'mantech', 'bah', 'booz allen']:
                if prime_name in placement_prime and prime_name in program_prime:
                    score += 40
                    reasons.append(f'Prime overlap ({prime_name})')
                    break

        # Check subcontractor match
        if placement_prime and program_subs:
            if placement_prime in program_subs:
                score += 30
                reasons.append('Subcontractor match')

        # Check job title match
        program_roles = (program.get('typical_roles', '') or '').lower()
        program_titles = (program.get('job_titles', '') or '').lower()

        if placement_title:
            # Extract key terms from placement title
            key_terms = ['engineer', 'analyst', 'developer', 'administrator', 'manager',
                        'cyber', 'network', 'software', 'systems', 'data', 'cloud',
                        'help desk', 'technician', 'specialist']

            for term in key_terms:
                if term in placement_title:
                    if term in program_roles or term in program_titles:
                        score += 10
                        reasons.append(f'Role match ({term})')

        # Only include if score meets threshold
        if score >= 40:
            matches.append({
                'program_name': program['name'],
                'acronym': program['acronym'],
                'agency': program['agency'],
                'program_prime': program['prime_contractor'],
                'contract_value': program['contract_value'],
                'match_score': score,
                'match_reasons': reasons
            })

    # Sort by score
    matches.sort(key=lambda x: x['match_score'], reverse=True)
    return matches[:5]  # Return top 5 matches


def run_linking():
    """Link Bullhorn data to Federal Programs."""
    print("="*80)
    print("LINKING BULLHORN DATA TO FEDERAL PROGRAMS")
    print("="*80)

    # Load federal programs
    print(f"\nLoading Federal Programs from: {FEDERAL_PROGRAMS_CSV}")
    programs = load_federal_programs()
    print(f"Loaded {len(programs)} programs")

    # Connect to Bullhorn database
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Get placements
    cursor.execute("""
        SELECT id, bullhorn_placement_id, client_name, job_title, candidate_name, status
        FROM placements
        WHERE client_name IS NOT NULL
    """)
    placements = cursor.fetchall()
    print(f"Loaded {len(placements)} placements")

    # Match placements to programs
    print("\nMatching placements to programs...")

    placement_matches = []
    programs_matched = defaultdict(list)
    primes_to_programs = defaultdict(set)

    for plc in placements:
        plc_dict = dict(plc)
        matches = match_placement_to_programs(plc_dict, programs)

        if matches:
            placement_matches.append({
                'placement_id': plc['bullhorn_placement_id'],
                'client_name': plc['client_name'],
                'job_title': plc['job_title'],
                'matches': matches
            })

            for match in matches:
                programs_matched[match['program_name']].append(plc_dict)
                primes_to_programs[plc['client_name']].add(match['program_name'])

    print(f"Placements with program matches: {len(placement_matches)}")
    print(f"Unique programs matched: {len(programs_matched)}")

    # Print summary by prime contractor
    print("\n" + "="*80)
    print("PROGRAMS BY PRIME CONTRACTOR")
    print("="*80)

    for prime in sorted(primes_to_programs.keys()):
        programs_list = sorted(primes_to_programs[prime])
        print(f"\n{prime}:")
        for prog in programs_list:
            placement_count = len(programs_matched[prog])
            print(f"  - {prog} ({placement_count} placements)")

    # Print top matched programs
    print("\n" + "="*80)
    print("TOP MATCHED PROGRAMS")
    print("="*80)

    sorted_programs = sorted(programs_matched.items(), key=lambda x: len(x[1]), reverse=True)
    for program_name, placements_list in sorted_programs[:20]:
        print(f"\n{program_name}:")
        print(f"  Placements: {len(placements_list)}")
        # Show sample job titles
        titles = set(p.get('job_title', '') for p in placements_list[:5])
        titles = [t for t in titles if t]
        if titles:
            print(f"  Sample roles: {', '.join(titles[:3])}")

    # Create cross-reference report
    report = {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_programs': len(programs),
            'total_placements': len(placements),
            'placements_matched': len(placement_matches),
            'programs_matched': len(programs_matched)
        },
        'by_prime': {},
        'by_program': {}
    }

    for prime, program_set in primes_to_programs.items():
        report['by_prime'][prime] = list(program_set)

    for program_name, placements_list in programs_matched.items():
        report['by_program'][program_name] = {
            'placement_count': len(placements_list),
            'primes': list(set(p.get('client_name', '') for p in placements_list)),
            'sample_titles': list(set(p.get('job_title', '') for p in placements_list))[:10]
        }

    # Save report
    report_path = OUTPUT_DIR / f"federal_programs_linkage_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    print(f"\nReport saved to: {report_path}")

    # Create CSV export
    csv_path = OUTPUT_DIR / f"prime_to_programs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(['Prime Contractor', 'Federal Program', 'Placements', 'Sample Job Titles'])

        for prime in sorted(primes_to_programs.keys()):
            for program in sorted(primes_to_programs[prime]):
                placements_list = [p for p in programs_matched[program] if p.get('client_name') == prime]
                titles = list(set(p.get('job_title', '') for p in placements_list))[:3]
                writer.writerow([
                    prime,
                    program,
                    len(placements_list),
                    '; '.join(titles)
                ])

    print(f"CSV export saved to: {csv_path}")

    # Store linkages in database
    print("\nStoring program linkages in database...")

    # Create linkage table if not exists
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS placement_program_links (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            placement_id INTEGER,
            program_name VARCHAR(500),
            program_acronym VARCHAR(50),
            agency VARCHAR(100),
            match_score INTEGER,
            match_reasons TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # Clear existing linkages
    cursor.execute("DELETE FROM placement_program_links")

    # Insert new linkages
    for pm in placement_matches:
        for match in pm['matches']:
            cursor.execute("""
                INSERT INTO placement_program_links
                (placement_id, program_name, program_acronym, agency, match_score, match_reasons)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (
                pm['placement_id'],
                match['program_name'],
                match['acronym'],
                match['agency'],
                match['match_score'],
                ', '.join(match['match_reasons'])
            ))

    conn.commit()
    print(f"Stored {len(placement_matches)} linkages in database")

    conn.close()

    print("\n" + "="*80)
    print("LINKING COMPLETE")
    print("="*80)

    return report


if __name__ == "__main__":
    run_linking()
