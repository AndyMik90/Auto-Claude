"""
Export to Notion-compatible CSV
Creates CSV files formatted for import into Notion databases.
"""

import sqlite3
import csv
import json
from pathlib import Path
from datetime import datetime

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"


def export_prime_contractors():
    """Export prime contractors to Notion-compatible CSV."""
    print("Exporting Prime Contractors...")

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            name,
            category,
            total_jobs,
            total_placements,
            normalized_name
        FROM prime_contractors
        WHERE total_jobs > 0 OR total_placements > 0
        ORDER BY total_placements DESC
    """)

    rows = cursor.fetchall()

    csv_path = OUTPUT_DIR / "notion_prime_contractors.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Name', 'Category', 'Total Jobs', 'Total Placements', 'Tags'
        ])

        for row in rows:
            tags = []
            if row['category']:
                tags.append(row['category'])
            if row['total_placements'] > 50:
                tags.append('High Volume')
            elif row['total_placements'] > 10:
                tags.append('Medium Volume')
            else:
                tags.append('Low Volume')

            writer.writerow([
                row['name'],
                row['category'] or 'Other',
                row['total_jobs'] or 0,
                row['total_placements'] or 0,
                ', '.join(tags)
            ])

    print(f"  Exported {len(rows)} prime contractors to {csv_path}")
    conn.close()
    return csv_path


def export_placements():
    """Export placements to Notion-compatible CSV."""
    print("Exporting Placements...")

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            bullhorn_placement_id,
            client_name,
            job_title,
            candidate_name,
            status,
            owner,
            start_date,
            end_date,
            salary,
            pay_rate,
            bill_rate,
            source_file
        FROM placements
        ORDER BY start_date DESC
    """)

    rows = cursor.fetchall()

    csv_path = OUTPUT_DIR / "notion_placements.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'ID', 'Prime Contractor', 'Job Title', 'Candidate', 'Status',
            'Recruiter', 'Start Date', 'End Date', 'Salary', 'Pay Rate', 'Bill Rate'
        ])

        for row in rows:
            writer.writerow([
                row['bullhorn_placement_id'],
                row['client_name'],
                row['job_title'],
                row['candidate_name'],
                row['status'],
                row['owner'],
                str(row['start_date'])[:10] if row['start_date'] else '',
                str(row['end_date'])[:10] if row['end_date'] else '',
                f"${row['salary']:,.2f}" if row['salary'] else '',
                f"${row['pay_rate']:.2f}/hr" if row['pay_rate'] else '',
                f"${row['bill_rate']:.2f}/hr" if row['bill_rate'] else '',
            ])

    print(f"  Exported {len(rows)} placements to {csv_path}")
    conn.close()
    return csv_path


def export_jobs():
    """Export jobs to Notion-compatible CSV."""
    print("Exporting Jobs...")

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            bullhorn_job_id,
            job_number,
            title,
            prime_contractor,
            employment_type,
            status,
            pay_rate,
            bill_rate,
            salary,
            owner,
            date_added
        FROM jobs
        ORDER BY date_added DESC
    """)

    rows = cursor.fetchall()

    csv_path = OUTPUT_DIR / "notion_jobs.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Job ID', 'Job Number', 'Title', 'Prime Contractor', 'Employment Type',
            'Status', 'Pay Rate', 'Bill Rate', 'Salary', 'Owner', 'Date Added'
        ])

        for row in rows:
            writer.writerow([
                row['bullhorn_job_id'],
                row['job_number'],
                row['title'],
                row['prime_contractor'],
                row['employment_type'],
                row['status'],
                f"${row['pay_rate']:.2f}/hr" if row['pay_rate'] else '',
                f"${row['bill_rate']:.2f}/hr" if row['bill_rate'] else '',
                f"${row['salary']:,.2f}" if row['salary'] else '',
                row['owner'],
                str(row['date_added'])[:10] if row['date_added'] else ''
            ])

    print(f"  Exported {len(rows)} jobs to {csv_path}")
    conn.close()
    return csv_path


def export_contacts():
    """Export contacts to Notion-compatible CSV."""
    print("Exporting Contacts...")

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            full_name,
            first_name,
            last_name,
            company_name,
            source_file
        FROM candidates
        WHERE full_name IS NOT NULL
        ORDER BY full_name
    """)

    rows = cursor.fetchall()

    csv_path = OUTPUT_DIR / "notion_contacts.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Full Name', 'First Name', 'Last Name', 'Company', 'Source'
        ])

        for row in rows:
            writer.writerow([
                row['full_name'],
                row['first_name'],
                row['last_name'],
                row['company_name'] or '',
                row['source_file'] or ''
            ])

    print(f"  Exported {len(rows)} contacts to {csv_path}")
    conn.close()
    return csv_path


def export_past_performance_summary():
    """Export past performance summary to Notion-compatible CSV."""
    print("Exporting Past Performance Summary...")

    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    cursor.execute("""
        SELECT
            prime_contractor_name,
            total_jobs,
            filled_jobs,
            total_placements,
            avg_bill_rate,
            avg_pay_rate,
            avg_margin,
            fill_rate,
            first_job_date,
            last_job_date
        FROM past_performance
        ORDER BY total_placements DESC
    """)

    rows = cursor.fetchall()

    csv_path = OUTPUT_DIR / "notion_past_performance.csv"
    with open(csv_path, 'w', newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow([
            'Prime Contractor', 'Total Jobs', 'Filled Jobs', 'Total Placements',
            'Avg Bill Rate', 'Avg Pay Rate', 'Avg Margin %', 'Fill Rate %',
            'First Job Date', 'Last Job Date', 'Relationship Strength'
        ])

        for row in rows:
            # Calculate relationship strength
            placements = row['total_placements'] or 0
            if placements >= 100:
                strength = 'Strategic Partner'
            elif placements >= 50:
                strength = 'Key Account'
            elif placements >= 20:
                strength = 'Established'
            elif placements >= 5:
                strength = 'Growing'
            else:
                strength = 'Emerging'

            writer.writerow([
                row['prime_contractor_name'],
                row['total_jobs'] or 0,
                row['filled_jobs'] or 0,
                row['total_placements'] or 0,
                f"${row['avg_bill_rate']:.2f}/hr" if row['avg_bill_rate'] else '',
                f"${row['avg_pay_rate']:.2f}/hr" if row['avg_pay_rate'] else '',
                f"{row['avg_margin']:.1f}%" if row['avg_margin'] else '',
                f"{row['fill_rate']:.1f}%" if row['fill_rate'] else '',
                str(row['first_job_date'])[:10] if row['first_job_date'] else '',
                str(row['last_job_date'])[:10] if row['last_job_date'] else '',
                strength
            ])

    print(f"  Exported {len(rows)} past performance records to {csv_path}")
    conn.close()
    return csv_path


def run_export():
    """Run all exports."""
    print("="*80)
    print("NOTION EXPORT")
    print("="*80)

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = []
    files.append(export_prime_contractors())
    files.append(export_placements())
    files.append(export_jobs())
    files.append(export_contacts())
    files.append(export_past_performance_summary())

    print("\n" + "="*80)
    print("EXPORT COMPLETE")
    print("="*80)
    print("\nGenerated files:")
    for f in files:
        print(f"  - {f.name}")

    print("\nTo import into Notion:")
    print("  1. Open your Notion workspace")
    print("  2. Create a new database or go to existing one")
    print("  3. Click '...' menu -> 'Import' -> 'CSV'")
    print("  4. Select the appropriate CSV file")

    return files


if __name__ == "__main__":
    run_export()
