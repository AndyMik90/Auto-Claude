"""
Data Cleanup and Normalization Script
Normalizes company names and improves data quality in the Bullhorn database.
"""

import sqlite3
import re
from pathlib import Path
from datetime import datetime

DATABASE_PATH = Path(__file__).parent.parent / "data" / "bullhorn_master.db"

# Company name normalization rules
COMPANY_NORMALIZATIONS = {
    # Defense Primes
    'Leidos - ONLY ONE YOU ARE TO USE': 'Leidos',
    'LEIDOS': 'Leidos',
    'Boeing - ONLY ONE YOU ARE TO USE': 'Boeing',
    'BOEING': 'Boeing',
    'AMENTUM THIS IS THE ONLY ONE TO USE': 'Amentum',
    'AMENTUM': 'Amentum',
    'GDIT': 'General Dynamics IT',
    'General Dynamics IT': 'General Dynamics IT',
    'Peraton': 'Peraton',
    'PERATON': 'Peraton',
    'CACI': 'CACI International',
    'Northrop Grumman': 'Northrop Grumman',
    'NORTHROP GRUMMAN': 'Northrop Grumman',
    'Lockheed Martin': 'Lockheed Martin',
    'LOCKHEED MARTIN': 'Lockheed Martin',
    'SRA International': 'SRA International',

    # Tech Companies
    'Microsoft': 'Microsoft',
    'MICROSOFT': 'Microsoft',
    'Dell Technologies': 'Dell Technologies',
    'DELL SERVICES FEDERAL GOVERNMENT, INC.': 'Dell Federal Services',
    'Hewlett Packard': 'Hewlett Packard',
    'HP': 'Hewlett Packard',
    'Deloitte': 'Deloitte',
    'DELOITTE': 'Deloitte',

    # Commercial
    'Home Depot': 'The Home Depot',
    'Home Depot - SSC': 'The Home Depot',
    'The Home Depot': 'The Home Depot',
    'Delta Airlines': 'Delta Air Lines',
    'Georgia Power Company': 'Georgia Power',
    'The Southern Company': 'Southern Company',
    'Norfolk Southern': 'Norfolk Southern',
    'Cox Enterprises': 'Cox Enterprises',
    'Genuine Parts Company': 'Genuine Parts Company',
    'UPS Capital': 'UPS Capital',
    'ADP': 'ADP',
    'Fedex Truckload Brokerage': 'FedEx',

    # Research/Education
    'Georgia Tech Research Institute (GTRI)': 'GTRI',
    'Emory University': 'Emory University',

    # Manufacturing
    'Koch Industries - Georgia Pacific': 'Georgia-Pacific',
    'Lonza (Arch) - Conley, GA': 'Lonza',
    'Lonza - Hayward, CA': 'Lonza',
    'Lonza - Walkersville, MD': 'Lonza',
    'Pangborn Corporation': 'Pangborn Corporation',
    'North American Container': 'North American Container',
    'CRH Americas': 'CRH Americas',
    'Peachtree Protective Covers': 'Peachtree Protective Covers',

    # Healthcare/Other
    'Altera Digital Health': 'Altera Digital Health',
    'First Advantage Corp.': 'First Advantage',
    'ITsavvy': 'ITsavvy',
    'Merlin International, Inc.': 'Merlin International',
}

# Category mapping for companies
COMPANY_CATEGORIES = {
    'Leidos': 'Defense Prime',
    'Boeing': 'Defense Prime',
    'Amentum': 'Defense Prime',
    'General Dynamics IT': 'Defense Prime',
    'Peraton': 'Defense Prime',
    'CACI International': 'Defense Prime',
    'Northrop Grumman': 'Defense Prime',
    'Lockheed Martin': 'Defense Prime',
    'SRA International': 'Defense Prime',
    'Dell Federal Services': 'Defense Prime',

    'Microsoft': 'Technology',
    'Dell Technologies': 'Technology',
    'Hewlett Packard': 'Technology',
    'Deloitte': 'Consulting',
    'GTRI': 'Research',
    'Emory University': 'Education',

    'The Home Depot': 'Retail',
    'Delta Air Lines': 'Transportation',
    'Georgia Power': 'Utilities',
    'Southern Company': 'Utilities',
    'Norfolk Southern': 'Transportation',
    'Cox Enterprises': 'Media/Telecom',
    'UPS Capital': 'Transportation',
    'FedEx': 'Transportation',
    'ADP': 'HR Services',
    'Genuine Parts Company': 'Retail',

    'Georgia-Pacific': 'Manufacturing',
    'Lonza': 'Pharmaceutical',
    'Pangborn Corporation': 'Manufacturing',
    'North American Container': 'Manufacturing',
    'CRH Americas': 'Construction',

    'Altera Digital Health': 'Healthcare IT',
    'First Advantage': 'HR Services',
    'ITsavvy': 'Technology',
    'Merlin International': 'Technology',
    'Peachtree Protective Covers': 'Manufacturing',
}


def normalize_company_name(name: str) -> str:
    """Normalize a company name to standard form."""
    if not name:
        return name

    # Check direct mapping first
    if name in COMPANY_NORMALIZATIONS:
        return COMPANY_NORMALIZATIONS[name]

    # Clean up common patterns
    cleaned = name.strip()
    cleaned = re.sub(r'\s*-\s*ONLY ONE.*$', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s*THIS IS THE ONLY ONE.*$', '', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\s+', ' ', cleaned)

    # Check mapping again after cleanup
    if cleaned in COMPANY_NORMALIZATIONS:
        return COMPANY_NORMALIZATIONS[cleaned]

    return cleaned


def run_cleanup():
    """Run data cleanup on the database."""
    print("="*80)
    print("DATA CLEANUP AND NORMALIZATION")
    print(f"Database: {DATABASE_PATH}")
    print("="*80)

    conn = sqlite3.connect(DATABASE_PATH)
    cursor = conn.cursor()

    # 1. Update placements with normalized company names
    print("\n1. Normalizing company names in placements...")
    cursor.execute("SELECT DISTINCT client_name FROM placements WHERE client_name IS NOT NULL")
    companies = cursor.fetchall()

    updates = 0
    for (company,) in companies:
        normalized = normalize_company_name(company)
        if normalized != company:
            cursor.execute(
                "UPDATE placements SET client_name = ? WHERE client_name = ?",
                (normalized, company)
            )
            updates += cursor.rowcount
            print(f"  '{company}' -> '{normalized}'")

    print(f"  Updated {updates} placement records")

    # 2. Update prime_contractors table
    print("\n2. Updating prime_contractors table...")
    cursor.execute("SELECT id, name FROM prime_contractors")
    primes = cursor.fetchall()

    for prime_id, name in primes:
        normalized = normalize_company_name(name)
        category = COMPANY_CATEGORIES.get(normalized, 'Other')

        cursor.execute(
            "UPDATE prime_contractors SET normalized_name = ? WHERE id = ?",
            (normalized.lower(), prime_id)
        )

    # 3. Merge duplicate prime contractors
    print("\n3. Consolidating duplicate prime contractors...")

    # Get all unique normalized names
    cursor.execute("""
        SELECT normalized_name, GROUP_CONCAT(id), COUNT(*) as cnt
        FROM prime_contractors
        GROUP BY normalized_name
        HAVING cnt > 1
    """)
    duplicates = cursor.fetchall()

    for norm_name, ids, count in duplicates:
        print(f"  Found {count} records for '{norm_name}'")

    # 4. Recalculate placement counts
    print("\n4. Recalculating placement counts per prime...")
    cursor.execute("""
        UPDATE prime_contractors
        SET total_placements = (
            SELECT COUNT(*) FROM placements
            WHERE placements.client_name = prime_contractors.name
               OR LOWER(placements.client_name) = prime_contractors.normalized_name
        )
    """)

    # 5. Create company_category column if not exists and populate
    print("\n5. Adding company categories...")
    try:
        cursor.execute("ALTER TABLE prime_contractors ADD COLUMN category VARCHAR(50)")
    except sqlite3.OperationalError:
        pass  # Column already exists

    for company, category in COMPANY_CATEGORIES.items():
        cursor.execute(
            "UPDATE prime_contractors SET category = ? WHERE name = ? OR normalized_name = ?",
            (category, company, company.lower())
        )

    # 6. Update past_performance with normalized names
    print("\n6. Updating past_performance table...")
    cursor.execute("SELECT DISTINCT prime_contractor_name FROM past_performance")
    pp_primes = cursor.fetchall()

    for (name,) in pp_primes:
        normalized = normalize_company_name(name)
        if normalized != name:
            cursor.execute(
                "UPDATE past_performance SET prime_contractor_name = ? WHERE prime_contractor_name = ?",
                (normalized, name)
            )

    conn.commit()

    # 7. Print summary
    print("\n" + "="*80)
    print("CLEANUP SUMMARY")
    print("="*80)

    cursor.execute("""
        SELECT name, category, total_jobs, total_placements
        FROM prime_contractors
        WHERE total_placements > 0 OR total_jobs > 0
        ORDER BY total_placements DESC
    """)

    print("\nPrime Contractors with Activity:")
    print(f"{'Company':<35} {'Category':<20} {'Jobs':<8} {'Placements':<10}")
    print("-"*75)

    for row in cursor.fetchall():
        name, category, jobs, placements = row
        print(f"{name:<35} {category or 'N/A':<20} {jobs or 0:<8} {placements or 0:<10}")

    # Defense Primes summary
    print("\n" + "="*80)
    print("DEFENSE PRIME CONTRACTORS SUMMARY")
    print("="*80)

    cursor.execute("""
        SELECT name, total_jobs, total_placements
        FROM prime_contractors
        WHERE category = 'Defense Prime'
        ORDER BY total_placements DESC
    """)

    total_defense_placements = 0
    for row in cursor.fetchall():
        name, jobs, placements = row
        total_defense_placements += placements or 0
        print(f"  {name}: {placements or 0} placements, {jobs or 0} jobs")

    print(f"\nTotal Defense Prime Placements: {total_defense_placements}")

    conn.close()
    print("\nCleanup complete!")


if __name__ == "__main__":
    run_cleanup()
