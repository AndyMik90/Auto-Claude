"""
Past Performance Report Generator
Creates comprehensive reports on past performance by Prime Contractor and Program.
"""

import sqlite3
import json
import csv
from pathlib import Path
from datetime import datetime
from collections import defaultdict

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"

# Defense Prime normalization (consolidate variations)
DEFENSE_PRIME_MAPPING = {
    'leidos': 'Leidos',
    'boeing': 'Boeing',
    'amentum': 'Amentum',
    'general dynamics it': 'General Dynamics IT',
    'gdit': 'General Dynamics IT',
    'peraton': 'Peraton',
    'caci international': 'CACI International',
    'caci': 'CACI International',
    'northrop grumman': 'Northrop Grumman',
    'lockheed martin': 'Lockheed Martin',
    'sra international': 'General Dynamics IT',  # SRA was acquired by GDIT
    'dell federal services': 'Dell Federal Services',
    'raytheon': 'Raytheon',
    'bae systems': 'BAE Systems',
    'l3harris': 'L3Harris',
    'booz allen hamilton': 'Booz Allen Hamilton',
    'saic': 'SAIC',
    'mantech': 'ManTech',
}


def get_normalized_prime(name: str) -> str:
    """Get normalized prime contractor name."""
    if not name:
        return 'Unknown'
    lower = name.lower().strip()
    return DEFENSE_PRIME_MAPPING.get(lower, name)


def generate_past_performance_report():
    """Generate comprehensive past performance report."""
    print("="*80)
    print("PAST PERFORMANCE REPORT GENERATOR")
    print("="*80)

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    # Aggregate data by normalized Prime Contractor
    prime_data = defaultdict(lambda: {
        'placements': [],
        'jobs': [],
        'contacts': set(),
        'recruiters': set(),
        'job_titles': set(),
        'total_placements': 0,
        'total_jobs': 0,
        'date_range': {'first': None, 'last': None},
        'status_breakdown': defaultdict(int),
        'revenue': 0.0,
    })

    # Get all placements
    print("\nAnalyzing placements...")
    cursor.execute("""
        SELECT client_name, status, job_title, candidate_name, owner,
               start_date, end_date, salary, pay_rate, bill_rate,
               source_file
        FROM placements
        WHERE client_name IS NOT NULL
    """)

    for row in cursor.fetchall():
        prime = get_normalized_prime(row['client_name'])
        data = prime_data[prime]

        data['placements'].append(dict(row))
        data['total_placements'] += 1

        if row['status']:
            data['status_breakdown'][row['status']] += 1

        if row['job_title']:
            data['job_titles'].add(row['job_title'])

        if row['candidate_name']:
            data['contacts'].add(row['candidate_name'])

        if row['owner']:
            data['recruiters'].add(row['owner'])

        # Track date range
        for date_field in ['start_date', 'end_date']:
            if row[date_field]:
                date_str = str(row[date_field])[:10]
                if data['date_range']['first'] is None or date_str < data['date_range']['first']:
                    data['date_range']['first'] = date_str
                if data['date_range']['last'] is None or date_str > data['date_range']['last']:
                    data['date_range']['last'] = date_str

    # Get all jobs
    print("Analyzing jobs...")
    cursor.execute("""
        SELECT bullhorn_job_id, job_number, title, prime_contractor, employment_type,
               status, pay_rate, bill_rate, salary, owner, contact, date_added
        FROM jobs
        WHERE prime_contractor IS NOT NULL
    """)

    for row in cursor.fetchall():
        prime = get_normalized_prime(row['prime_contractor'])
        data = prime_data[prime]

        data['jobs'].append(dict(row))
        data['total_jobs'] += 1

        if row['status']:
            data['status_breakdown'][f"job_{row['status']}"] += 1

        if row['title']:
            data['job_titles'].add(row['title'])

        if row['date_added']:
            date_str = str(row['date_added'])[:10]
            if data['date_range']['first'] is None or date_str < data['date_range']['first']:
                data['date_range']['first'] = date_str
            if data['date_range']['last'] is None or date_str > data['date_range']['last']:
                data['date_range']['last'] = date_str

    # Get activity counts per contact
    print("Analyzing activities...")
    cursor.execute("""
        SELECT COUNT(*) as activity_count
        FROM activities
    """)
    total_activities = cursor.fetchone()[0]

    # Generate reports
    print("\nGenerating reports...")

    # 1. Defense Primes Report
    defense_primes = {}
    for prime, data in prime_data.items():
        normalized = get_normalized_prime(prime)
        if normalized.lower() in DEFENSE_PRIME_MAPPING.values() or \
           any(k in prime.lower() for k in DEFENSE_PRIME_MAPPING.keys()):
            if normalized not in defense_primes:
                defense_primes[normalized] = {
                    'total_placements': 0,
                    'total_jobs': 0,
                    'unique_contacts': set(),
                    'unique_job_titles': set(),
                    'unique_recruiters': set(),
                    'status_breakdown': defaultdict(int),
                    'date_range': {'first': None, 'last': None}
                }

            dp = defense_primes[normalized]
            dp['total_placements'] += data['total_placements']
            dp['total_jobs'] += data['total_jobs']
            dp['unique_contacts'].update(data['contacts'])
            dp['unique_job_titles'].update(data['job_titles'])
            dp['unique_recruiters'].update(data['recruiters'])

            for status, count in data['status_breakdown'].items():
                dp['status_breakdown'][status] += count

            if data['date_range']['first']:
                if dp['date_range']['first'] is None or data['date_range']['first'] < dp['date_range']['first']:
                    dp['date_range']['first'] = data['date_range']['first']
            if data['date_range']['last']:
                if dp['date_range']['last'] is None or data['date_range']['last'] > dp['date_range']['last']:
                    dp['date_range']['last'] = data['date_range']['last']

    # Print Defense Primes Summary
    print("\n" + "="*80)
    print("DEFENSE PRIME CONTRACTORS - PAST PERFORMANCE SUMMARY")
    print("="*80)

    total_defense_placements = 0
    total_defense_jobs = 0

    sorted_primes = sorted(defense_primes.items(), key=lambda x: x[1]['total_placements'], reverse=True)

    for prime, data in sorted_primes:
        total_defense_placements += data['total_placements']
        total_defense_jobs += data['total_jobs']

        print(f"\n{'='*60}")
        print(f"PRIME: {prime}")
        print(f"{'='*60}")
        print(f"  Total Placements: {data['total_placements']}")
        print(f"  Total Jobs: {data['total_jobs']}")
        print(f"  Unique Contacts: {len(data['unique_contacts'])}")
        print(f"  Unique Job Titles: {len(data['unique_job_titles'])}")
        print(f"  Unique Recruiters: {len(data['unique_recruiters'])}")
        print(f"  Date Range: {data['date_range']['first']} to {data['date_range']['last']}")

        if data['status_breakdown']:
            print(f"  Status Breakdown:")
            for status, count in sorted(data['status_breakdown'].items()):
                print(f"    {status}: {count}")

    print("\n" + "="*80)
    print("DEFENSE PRIMES TOTALS")
    print("="*80)
    print(f"Total Defense Prime Placements: {total_defense_placements}")
    print(f"Total Defense Prime Jobs: {total_defense_jobs}")
    print(f"Number of Defense Primes: {len(defense_primes)}")

    # Export to JSON
    report_data = {
        'generated_at': datetime.now().isoformat(),
        'summary': {
            'total_defense_placements': total_defense_placements,
            'total_defense_jobs': total_defense_jobs,
            'total_activities': total_activities,
            'defense_primes_count': len(defense_primes)
        },
        'defense_primes': {}
    }

    for prime, data in sorted_primes:
        report_data['defense_primes'][prime] = {
            'total_placements': data['total_placements'],
            'total_jobs': data['total_jobs'],
            'unique_contacts': len(data['unique_contacts']),
            'unique_job_titles': len(data['unique_job_titles']),
            'unique_recruiters': len(data['unique_recruiters']),
            'date_range': data['date_range'],
            'status_breakdown': dict(data['status_breakdown']),
            'sample_job_titles': list(data['unique_job_titles'])[:20],
            'sample_contacts': list(data['unique_contacts'])[:20]
        }

    report_path = OUTPUT_DIR / f"defense_primes_past_performance_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(report_path, 'w') as f:
        json.dump(report_data, f, indent=2, default=str)

    print(f"\nJSON Report saved to: {report_path}")

    # Export to CSV
    csv_path = OUTPUT_DIR / f"defense_primes_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Prime Contractor', 'Total Placements', 'Total Jobs', 'Unique Contacts',
            'Unique Job Titles', 'Unique Recruiters', 'First Date', 'Last Date'
        ])

        for prime, data in sorted_primes:
            writer.writerow([
                prime,
                data['total_placements'],
                data['total_jobs'],
                len(data['unique_contacts']),
                len(data['unique_job_titles']),
                len(data['unique_recruiters']),
                data['date_range']['first'],
                data['date_range']['last']
            ])

    print(f"CSV Report saved to: {csv_path}")

    # 2. All Companies Report
    print("\n" + "="*80)
    print("ALL COMPANIES - SUMMARY")
    print("="*80)

    all_companies = sorted(prime_data.items(), key=lambda x: x[1]['total_placements'], reverse=True)

    print(f"\n{'Company':<40} {'Placements':<12} {'Jobs':<8} {'Contacts':<10}")
    print("-"*75)

    for company, data in all_companies[:30]:  # Top 30
        print(f"{company[:40]:<40} {data['total_placements']:<12} {data['total_jobs']:<8} {len(data['contacts']):<10}")

    # Export all companies CSV
    all_csv_path = OUTPUT_DIR / f"all_companies_summary_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    with open(all_csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Company', 'Total Placements', 'Total Jobs', 'Unique Contacts',
            'Unique Job Titles', 'First Date', 'Last Date'
        ])

        for company, data in all_companies:
            writer.writerow([
                company,
                data['total_placements'],
                data['total_jobs'],
                len(data['contacts']),
                len(data['job_titles']),
                data['date_range']['first'],
                data['date_range']['last']
            ])

    print(f"\nAll companies CSV saved to: {all_csv_path}")

    conn.close()

    # Final summary
    print("\n" + "="*80)
    print("REPORT GENERATION COMPLETE")
    print("="*80)
    print(f"\nOutput files:")
    print(f"  1. {report_path.name}")
    print(f"  2. {csv_path.name}")
    print(f"  3. {all_csv_path.name}")

    return report_data


if __name__ == "__main__":
    generate_past_performance_report()
