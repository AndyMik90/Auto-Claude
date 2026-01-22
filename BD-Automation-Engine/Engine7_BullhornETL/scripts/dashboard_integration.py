"""
Dashboard Integration Module
Integrates Bullhorn ETL data with the BD Intelligence Dashboard.
Creates enriched JSON files for dashboard consumption.
"""

import sqlite3
import json
import csv
from pathlib import Path
from datetime import datetime
from collections import defaultdict
import re

# Paths
ENGINE7_DB = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
ENGINE2_PROGRAMS = Path(__file__).parent.parent.parent / "Engine2_ProgramMapping" / "data" / "Federal Programs MASTER ENRICHED.csv"
DASHBOARD_DATA_DIR = Path(__file__).parent.parent.parent / "dashboard" / "public" / "data"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"


def load_bullhorn_data():
    """Load all data from Bullhorn database."""
    print("Loading Bullhorn database...")

    conn = sqlite3.connect(ENGINE7_DB)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    data = {}

    # Jobs
    cursor.execute("SELECT * FROM jobs")
    data['jobs'] = [dict(row) for row in cursor.fetchall()]
    print(f"  Jobs: {len(data['jobs'])}")

    # Placements
    cursor.execute("SELECT * FROM placements")
    data['placements'] = [dict(row) for row in cursor.fetchall()]
    print(f"  Placements: {len(data['placements'])}")

    # Candidates/Contacts
    cursor.execute("SELECT * FROM candidates LIMIT 10000")  # Limit for performance
    data['contacts'] = [dict(row) for row in cursor.fetchall()]
    print(f"  Contacts: {len(data['contacts'])}")

    # Prime Contractors
    cursor.execute("SELECT * FROM prime_contractors")
    data['primes'] = [dict(row) for row in cursor.fetchall()]
    print(f"  Prime Contractors: {len(data['primes'])}")

    # Past Performance
    cursor.execute("SELECT * FROM past_performance")
    data['past_performance'] = [dict(row) for row in cursor.fetchall()]
    print(f"  Past Performance: {len(data['past_performance'])}")

    # Contact Scores
    cursor.execute("SELECT * FROM contact_scores ORDER BY score DESC LIMIT 5000")
    data['contact_scores'] = [dict(row) for row in cursor.fetchall()]
    print(f"  Contact Scores: {len(data['contact_scores'])}")

    # Program Links
    cursor.execute("SELECT * FROM placement_program_links")
    data['program_links'] = [dict(row) for row in cursor.fetchall()]
    print(f"  Program Links: {len(data['program_links'])}")

    # Activities summary
    cursor.execute("""
        SELECT activity_type, COUNT(*) as count
        FROM activities
        GROUP BY activity_type
    """)
    data['activity_summary'] = [dict(row) for row in cursor.fetchall()]

    conn.close()
    return data


def load_federal_programs():
    """Load federal programs from Engine2."""
    print("Loading Federal Programs...")

    programs = []
    with open(ENGINE2_PROGRAMS, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            programs.append(row)

    print(f"  Programs: {len(programs)}")
    return programs


def load_existing_dashboard_data():
    """Load existing dashboard JSON files."""
    print("Loading existing dashboard data...")

    data = {}

    files_to_load = [
        'contacts.json',
        'jobs.json',
        'programs.json',
        'contractors_enriched.json',
        'correlation_summary.json'
    ]

    for filename in files_to_load:
        filepath = DASHBOARD_DATA_DIR / filename
        if filepath.exists():
            with open(filepath, 'r', encoding='utf-8') as f:
                data[filename.replace('.json', '')] = json.load(f)
                print(f"  {filename}: {len(data[filename.replace('.json', '')])} records")
        else:
            print(f"  {filename}: NOT FOUND")
            data[filename.replace('.json', '')] = []

    return data


def create_past_performance_dashboard_data(bullhorn_data, federal_programs):
    """Create past performance data for dashboard."""
    print("\nCreating Past Performance Dashboard Data...")

    # Build program lookup
    program_lookup = {}
    for prog in federal_programs:
        name = prog.get('Program Name', '')
        if name:
            program_lookup[name.lower()] = prog

    # Enrich past performance with program details
    past_performance = []

    for pp in bullhorn_data['past_performance']:
        prime_name = pp.get('prime_contractor_name', '')

        # Find related programs
        related_programs = []
        for link in bullhorn_data['program_links']:
            # Check if this prime has placements linked to programs
            related_programs.append(link.get('program_name', ''))

        record = {
            'id': f"pp-{pp.get('id', '')}",
            'prime_contractor': prime_name,
            'total_jobs': pp.get('total_jobs', 0),
            'filled_jobs': pp.get('filled_jobs', 0),
            'total_placements': pp.get('total_placements', 0),
            'avg_bill_rate': pp.get('avg_bill_rate', 0),
            'avg_pay_rate': pp.get('avg_pay_rate', 0),
            'avg_margin': pp.get('avg_margin', 0),
            'fill_rate': pp.get('fill_rate', 0),
            'first_job_date': str(pp.get('first_job_date', ''))[:10] if pp.get('first_job_date') else None,
            'last_job_date': str(pp.get('last_job_date', ''))[:10] if pp.get('last_job_date') else None,
            'estimated_annual_revenue': (pp.get('total_placements', 0) or 0) * (pp.get('avg_bill_rate', 0) or 0) * 2080,
            'relationship_strength': 'Strategic' if (pp.get('total_placements', 0) or 0) >= 50 else
                                    'Key Account' if (pp.get('total_placements', 0) or 0) >= 20 else
                                    'Established' if (pp.get('total_placements', 0) or 0) >= 10 else
                                    'Growing' if (pp.get('total_placements', 0) or 0) >= 5 else 'Emerging',
            'is_defense_prime': prime_name in ['Leidos', 'General Dynamics IT', 'Peraton', 'Boeing',
                                                'CACI International', 'Northrop Grumman', 'Lockheed Martin',
                                                'Amentum', 'Dell Federal Services', 'SRA International']
        }
        past_performance.append(record)

    print(f"  Past Performance Records: {len(past_performance)}")
    return past_performance


def create_prime_org_chart(bullhorn_data, federal_programs):
    """Create Prime Contractor Org Chart data."""
    print("\nCreating Prime Contractor Org Chart...")

    # Build program-to-prime mapping
    program_primes = defaultdict(set)
    for prog in federal_programs:
        prime = prog.get('Prime Contractor', '') or prog.get('Prime Contractor (Consolidated)', '')
        name = prog.get('Program Name', '')
        if prime and name:
            # Handle multiple primes
            for p in prime.split('/'):
                p = p.strip()
                if p:
                    program_primes[p.lower()].add(name)

    org_chart = []

    for prime in bullhorn_data['primes']:
        prime_name = prime.get('name', '')
        normalized = prime.get('normalized_name', '').lower()

        # Get programs this prime works on
        prime_programs = list(program_primes.get(normalized, set()))

        # Get contacts for this prime
        contacts = [c for c in bullhorn_data['contact_scores']
                   if prime_name.lower() in (c.get('primes', '') or '').lower()]

        # Get placements
        placements = [p for p in bullhorn_data['placements']
                     if (p.get('client_name') or '').lower() == prime_name.lower()]

        record = {
            'id': f"prime-{prime.get('id', '')}",
            'name': prime_name,
            'normalized_name': normalized,
            'category': prime.get('category', 'Other'),
            'total_jobs': prime.get('total_jobs', 0),
            'total_placements': prime.get('total_placements', 0) or len(placements),
            'total_contacts': len(contacts),
            'top_contacts': [{'name': c['contact_name'], 'score': c['score'], 'tier': c['tier']}
                           for c in contacts[:10]],
            'programs': prime_programs[:20],
            'program_count': len(prime_programs),
            'is_defense_prime': prime.get('category') == 'Defense Prime',
            'relationship_tier': 'Strategic' if len(placements) >= 50 else
                                'Key Account' if len(placements) >= 20 else
                                'Established' if len(placements) >= 10 else
                                'Growing' if len(placements) >= 5 else 'Emerging'
        }
        org_chart.append(record)

    # Sort by placements
    org_chart.sort(key=lambda x: x['total_placements'], reverse=True)

    print(f"  Prime Org Chart Records: {len(org_chart)}")
    return org_chart


def create_contact_org_chart(bullhorn_data):
    """Create Contact Org Chart with tier hierarchy."""
    print("\nCreating Contact Org Chart...")

    # Group contacts by tier
    tier_groups = defaultdict(list)

    for contact in bullhorn_data['contact_scores']:
        tier = contact.get('tier', 'E - New/Inactive')

        record = {
            'id': f"contact-{contact.get('contact_name', '').replace(' ', '-').lower()}",
            'name': contact.get('contact_name', ''),
            'score': contact.get('score', 0),
            'tier': tier,
            'tier_level': ord(tier[0]) - ord('A') + 1 if tier else 5,
            'placements': contact.get('placement_count', 0),
            'activities': contact.get('activity_count', 0),
            'primes': (contact.get('primes', '') or '').split(', ')[:5],
            'prime_count': contact.get('prime_count', 0),
            'last_activity': contact.get('last_activity_date'),
            'scoring_factors': (contact.get('scoring_factors', '') or '').split(', ')
        }
        tier_groups[tier].append(record)

    org_chart = {
        'tiers': {
            'A - Strategic': {
                'description': 'Key decision makers with multiple placements',
                'contacts': tier_groups.get('A - Strategic', []),
                'count': len(tier_groups.get('A - Strategic', []))
            },
            'B - High Value': {
                'description': 'Active contacts with strong engagement',
                'contacts': tier_groups.get('B - High Value', []),
                'count': len(tier_groups.get('B - High Value', []))
            },
            'C - Engaged': {
                'description': 'Regular interactions, growing relationship',
                'contacts': tier_groups.get('C - Engaged', []),
                'count': len(tier_groups.get('C - Engaged', []))
            },
            'D - Developing': {
                'description': 'Initial engagement, potential growth',
                'contacts': tier_groups.get('D - Developing', []),
                'count': len(tier_groups.get('D - Developing', []))
            },
            'E - New/Inactive': {
                'description': 'New or dormant contacts',
                'contacts': tier_groups.get('E - New/Inactive', [])[:500],  # Limit
                'count': len(tier_groups.get('E - New/Inactive', []))
            }
        },
        'summary': {
            'total_contacts': len(bullhorn_data['contact_scores']),
            'tier_distribution': {k: len(v) for k, v in tier_groups.items()}
        }
    }

    print(f"  Contact Org Chart: {len(bullhorn_data['contact_scores'])} contacts across {len(tier_groups)} tiers")
    return org_chart


def create_program_org_chart(bullhorn_data, federal_programs):
    """Create Program Org Chart with relationships."""
    print("\nCreating Program Org Chart...")

    # Build placement counts by program
    program_placements = defaultdict(list)
    for link in bullhorn_data['program_links']:
        prog_name = link.get('program_name', '')
        program_placements[prog_name].append(link)

    org_chart = []

    for prog in federal_programs:
        name = prog.get('Program Name', '')
        if not name:
            continue

        # Get placements for this program
        placements = program_placements.get(name, [])

        # Get prime contractor
        prime = prog.get('Prime Contractor', '') or prog.get('Prime Contractor (Consolidated)', '')

        record = {
            'id': f"prog-{name.replace(' ', '-').lower()[:50]}",
            'name': name,
            'acronym': prog.get('Acronym', ''),
            'agency': prog.get('Agency Owner', ''),
            'prime_contractor': prime,
            'program_type': prog.get('Program Type', ''),
            'priority_level': prog.get('Priority Level', ''),
            'contract_value': prog.get('Contract Value', '') or prog.get('Contract Value (Consolidated)', ''),
            'period_start': prog.get('PoP Start (Consolidated)', ''),
            'period_end': prog.get('PoP End (Consolidated)', ''),
            'locations': prog.get('Key Locations', ''),
            'clearance': prog.get('Clearance Requirements', ''),
            'typical_roles': prog.get('Typical Roles', ''),
            'naics_code': prog.get('NAICS Code (Consolidated)', ''),
            'placement_count': len(placements),
            'has_pts_history': len(placements) > 0,
            'subcontractors': prog.get('Key Subcontractors', '') or prog.get('Known Subcontractors', '')
        }
        org_chart.append(record)

    # Sort by placement count
    org_chart.sort(key=lambda x: x['placement_count'], reverse=True)

    print(f"  Program Org Chart: {len(org_chart)} programs")
    return org_chart


def create_placements_dashboard_data(bullhorn_data):
    """Create placements data for dashboard."""
    print("\nCreating Placements Dashboard Data...")

    placements = []

    for plc in bullhorn_data['placements']:
        record = {
            'id': plc.get('bullhorn_placement_id', ''),
            'prime_contractor': plc.get('client_name', ''),
            'job_title': plc.get('job_title', ''),
            'candidate': plc.get('candidate_name', ''),
            'status': plc.get('status', ''),
            'owner': plc.get('owner', ''),
            'start_date': str(plc.get('start_date', ''))[:10] if plc.get('start_date') else None,
            'end_date': str(plc.get('end_date', ''))[:10] if plc.get('end_date') else None,
            'salary': plc.get('salary', 0),
            'pay_rate': plc.get('pay_rate', 0),
            'bill_rate': plc.get('bill_rate', 0),
            'spread': (plc.get('bill_rate', 0) or 0) - (plc.get('pay_rate', 0) or 0),
            'margin_percent': round(((plc.get('bill_rate', 0) or 0) - (plc.get('pay_rate', 0) or 0)) /
                                   (plc.get('bill_rate', 0) or 1) * 100, 1) if plc.get('bill_rate') else 0
        }
        placements.append(record)

    print(f"  Placements: {len(placements)}")
    return placements


def create_correlation_summary(bullhorn_data, federal_programs, existing_data):
    """Create updated correlation summary."""
    print("\nCreating Correlation Summary...")

    # Get existing data counts
    existing_jobs = len(existing_data.get('jobs', []))
    existing_contacts = len(existing_data.get('contacts', []))
    existing_programs = len(existing_data.get('programs', []))

    # Calculate new totals
    total_placements = len(bullhorn_data['placements'])
    total_bullhorn_contacts = len(bullhorn_data['contacts'])
    total_primes = len(bullhorn_data['primes'])

    # Calculate revenue
    total_revenue = sum(
        (p.get('bill_rate', 0) or 0) * 2080
        for p in bullhorn_data['placements']
        if p.get('bill_rate') and p.get('bill_rate') < 500
    )

    defense_primes = ['Leidos', 'General Dynamics IT', 'Peraton', 'Boeing',
                      'CACI International', 'Northrop Grumman', 'Lockheed Martin']

    defense_revenue = sum(
        (p.get('bill_rate', 0) or 0) * 2080
        for p in bullhorn_data['placements']
        if (p.get('client_name') or '') in defense_primes and p.get('bill_rate') and p.get('bill_rate') < 500
    )

    summary = {
        'generated_at': datetime.now().isoformat(),
        'data_sources': {
            'dashboard': {
                'jobs': existing_jobs,
                'contacts': existing_contacts,
                'programs': existing_programs
            },
            'bullhorn': {
                'placements': total_placements,
                'contacts': total_bullhorn_contacts,
                'primes': total_primes,
                'activities': sum(a.get('count', 0) for a in bullhorn_data['activity_summary'])
            },
            'federal_programs': len(federal_programs)
        },
        'financial_metrics': {
            'total_estimated_revenue': round(total_revenue, 2),
            'defense_primes_revenue': round(defense_revenue, 2),
            'defense_share_percent': round(defense_revenue / total_revenue * 100, 1) if total_revenue > 0 else 0,
            'avg_bill_rate': round(
                sum(p.get('bill_rate', 0) or 0 for p in bullhorn_data['placements'] if p.get('bill_rate') and p.get('bill_rate') < 500) /
                len([p for p in bullhorn_data['placements'] if p.get('bill_rate') and p.get('bill_rate') < 500]) if bullhorn_data['placements'] else 0, 2
            )
        },
        'contact_metrics': {
            'total_scored_contacts': len(bullhorn_data['contact_scores']),
            'tier_distribution': {},
            'avg_score': round(
                sum(c.get('score', 0) for c in bullhorn_data['contact_scores']) /
                len(bullhorn_data['contact_scores']) if bullhorn_data['contact_scores'] else 0, 1
            )
        },
        'program_metrics': {
            'total_programs': len(federal_programs),
            'programs_with_placements': len(set(l.get('program_name') for l in bullhorn_data['program_links'])),
            'total_program_links': len(bullhorn_data['program_links'])
        },
        'prime_metrics': {
            'total_primes': total_primes,
            'defense_primes': len([p for p in bullhorn_data['primes'] if p.get('category') == 'Defense Prime']),
            'top_primes': [
                {'name': p.get('name'), 'placements': p.get('total_placements', 0)}
                for p in sorted(bullhorn_data['primes'], key=lambda x: x.get('total_placements', 0) or 0, reverse=True)[:10]
            ]
        }
    }

    # Calculate tier distribution
    for contact in bullhorn_data['contact_scores']:
        tier = contact.get('tier', 'Unknown')
        summary['contact_metrics']['tier_distribution'][tier] = \
            summary['contact_metrics']['tier_distribution'].get(tier, 0) + 1

    print(f"  Correlation Summary generated")
    return summary


def save_dashboard_files(data_dict):
    """Save all dashboard JSON files."""
    print("\nSaving Dashboard Files...")

    DASHBOARD_DATA_DIR.mkdir(parents=True, exist_ok=True)

    for filename, data in data_dict.items():
        filepath = DASHBOARD_DATA_DIR / f"{filename}.json"
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, default=str)
        print(f"  Saved: {filepath.name} ({len(json.dumps(data, default=str)) // 1024}KB)")


def run_integration():
    """Run full dashboard integration."""
    print("="*80)
    print("DASHBOARD INTEGRATION")
    print("="*80)

    # Load all data sources
    bullhorn_data = load_bullhorn_data()
    federal_programs = load_federal_programs()
    existing_data = load_existing_dashboard_data()

    # Create dashboard data files
    dashboard_files = {}

    # Past Performance
    dashboard_files['past_performance'] = create_past_performance_dashboard_data(bullhorn_data, federal_programs)

    # Prime Org Chart
    dashboard_files['prime_org_chart'] = create_prime_org_chart(bullhorn_data, federal_programs)

    # Contact Org Chart
    dashboard_files['contact_org_chart'] = create_contact_org_chart(bullhorn_data)

    # Program Org Chart
    dashboard_files['program_org_chart'] = create_program_org_chart(bullhorn_data, federal_programs)

    # Placements
    dashboard_files['placements'] = create_placements_dashboard_data(bullhorn_data)

    # Updated Correlation Summary
    dashboard_files['correlation_summary_enriched'] = create_correlation_summary(bullhorn_data, federal_programs, existing_data)

    # Save all files
    save_dashboard_files(dashboard_files)

    print("\n" + "="*80)
    print("INTEGRATION COMPLETE")
    print("="*80)
    print(f"\nFiles saved to: {DASHBOARD_DATA_DIR}")
    print("\nNew dashboard data files:")
    for name in dashboard_files.keys():
        print(f"  - {name}.json")

    return dashboard_files


if __name__ == "__main__":
    run_integration()
