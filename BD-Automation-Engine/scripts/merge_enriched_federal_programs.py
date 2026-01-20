"""
Merge Enriched Federal Programs Data

This script merges data from multiple enriched sources into the master
Federal Programs database:
1. Federal Programs.csv (current master - 401 programs, 33 columns)
2. Federal Programs TANGO ENRICHED.csv (257 programs with rich contract data)
3. Federal Programs ACTIVE ENRICHED V3.csv (267 programs with FPDS/CALC fields)

Output: Federal Programs MASTER ENRICHED.csv
"""

import pandas as pd
from pathlib import Path
from datetime import datetime
import numpy as np

BASE_DIR = Path(__file__).parent.parent / 'Engine2_ProgramMapping' / 'data'


def load_data_sources():
    """Load all data sources"""
    print("Loading data sources...")

    # Current master
    master = pd.read_csv(BASE_DIR / 'Federal Programs.csv')
    print(f"  Master (Federal Programs.csv): {len(master)} programs, {len(master.columns)} columns")

    # TANGO enriched (richest contract data)
    tango = pd.read_csv(BASE_DIR / 'Federal Programs TANGO ENRICHED.csv')
    print(f"  TANGO Enriched: {len(tango)} programs, {len(tango.columns)} columns")

    # V3 enriched (FPDS + CALC API fields)
    v3 = pd.read_csv(BASE_DIR / 'Federal Programs ACTIVE ENRICHED V3.csv')
    print(f"  V3 Enriched: {len(v3)} programs, {len(v3.columns)} columns")

    return master, tango, v3


def standardize_program_names(df, col='Program Name'):
    """Standardize program names for matching"""
    if col in df.columns:
        df[col + '_normalized'] = df[col].str.strip().str.lower()
    return df


def merge_tango_data(master, tango):
    """Merge TANGO enriched data into master"""
    print("\nMerging TANGO enriched data...")

    # Columns to add from TANGO (not already in master)
    tango_cols_to_add = [
        'Contract Number',
        'tango_piid',
        'tango_description',
        'pop_city',
        'pop_state',
        'pop_zip',
        'pop_country',
        'period_start',
        'period_end',
        'ultimate_completion',
        'subawards_count',
        'subawards_total',
        'recipient_uei',
        'recipient_name',
        'naics_code',
        'psc_code',
        'set_aside',
        'obligated',
        'total_contract_value',
        'parent_piid',
        'parent_description',
        'awarding_office',
        'awarding_agency',
        'funding_office',
        'Match Confidence',
        'Match Score'
    ]

    # Keep only columns that exist in tango
    tango_cols_to_add = [c for c in tango_cols_to_add if c in tango.columns]

    # Create merge subset
    tango_merge = tango[['Program Name'] + tango_cols_to_add].copy()

    # Standardize names for matching
    master = standardize_program_names(master)
    tango_merge = standardize_program_names(tango_merge)

    # Merge on normalized program name
    merged = master.merge(
        tango_merge,
        left_on='Program Name_normalized',
        right_on='Program Name_normalized',
        how='left',
        suffixes=('', '_tango')
    )

    # Remove duplicate Program Name column
    if 'Program Name_tango' in merged.columns:
        merged.drop('Program Name_tango', axis=1, inplace=True)

    # Count successful matches
    matches = merged['Contract Number'].notna().sum()
    print(f"  TANGO merge: {matches}/{len(master)} programs matched ({matches/len(master)*100:.1f}%)")

    return merged


def merge_v3_data(merged, v3):
    """Merge V3 enriched data (FPDS + CALC API fields)"""
    print("\nMerging V3 enriched data...")

    # Columns unique to V3 (not in TANGO or master)
    v3_cols_to_add = [
        'Tech Stack (Basic)',
        'Functional Areas',
        'Job Titles',
        'Contract Signed Date (FPDS)',
        'Contract Effective Date (FPDS)',
        'Current Completion Date (FPDS)',
        'Ultimate Completion Date (FPDS)',
        'Base Contract Value (FPDS)',
        'Base + Options Value (FPDS)',
        'Performance Location (FPDS)',
        'FPDS NAICS Code',
        'FPDS PSC Code',
        'NAICS Description',
        'PSC Description',
        'Labor Rate Min',
        'Labor Rate Max',
        'Labor Rate Average',
        'Education Requirement',
        'Experience Requirement',
        'Annual Salary Range',
        'CALC API Status'
    ]

    # Keep only columns that exist in v3 and not already in merged
    v3_cols_to_add = [c for c in v3_cols_to_add if c in v3.columns and c not in merged.columns]

    if not v3_cols_to_add:
        print("  No additional V3 columns to merge")
        return merged

    # Create merge subset
    v3_merge = v3[['Program Name'] + v3_cols_to_add].copy()

    # Standardize names
    v3_merge = standardize_program_names(v3_merge)

    # Merge
    merged = merged.merge(
        v3_merge,
        left_on='Program Name_normalized',
        right_on='Program Name_normalized',
        how='left',
        suffixes=('', '_v3')
    )

    # Remove duplicate columns
    if 'Program Name_v3' in merged.columns:
        merged.drop('Program Name_v3', axis=1, inplace=True)

    # Count columns added
    added_cols = [c for c in v3_cols_to_add if c in merged.columns]
    print(f"  V3 merge: Added {len(added_cols)} columns")

    return merged


def consolidate_columns(df):
    """Consolidate duplicate/similar columns and clean up"""
    print("\nConsolidating columns...")

    # Consolidate Prime Contractor columns
    prime_cols = ['Prime Contractor', 'Prime Contractor Name', 'Prime Contractor 1']
    existing_prime_cols = [c for c in prime_cols if c in df.columns]
    if len(existing_prime_cols) > 1:
        # Use first non-null value
        df['Prime Contractor (Consolidated)'] = df[existing_prime_cols].bfill(axis=1).iloc[:, 0]
        # Keep original columns for reference but mark consolidated
        print(f"  Consolidated prime contractor columns: {existing_prime_cols}")

    # Consolidate Contract Value columns
    value_cols = ['Contract Value', 'total_contract_value', 'Base + Options Value (FPDS)']
    existing_value_cols = [c for c in value_cols if c in df.columns]
    if len(existing_value_cols) > 1:
        # Prefer TANGO total_contract_value, then FPDS, then original
        priority_order = ['total_contract_value', 'Base + Options Value (FPDS)', 'Contract Value']
        for col in priority_order:
            if col in df.columns:
                df['Contract Value (Consolidated)'] = df[col].combine_first(
                    df.get('Contract Value (Consolidated)', pd.Series([np.nan] * len(df)))
                )
        print(f"  Consolidated contract value columns: {existing_value_cols}")

    # Consolidate PoP columns
    if 'period_start' in df.columns and 'PoP Start' in df.columns:
        df['PoP Start (Consolidated)'] = df['period_start'].combine_first(df['PoP Start'])
        print("  Consolidated PoP Start columns")

    if 'period_end' in df.columns and 'PoP End' in df.columns:
        df['PoP End (Consolidated)'] = df['period_end'].combine_first(df['PoP End'])
        print("  Consolidated PoP End columns")

    if 'ultimate_completion' in df.columns:
        df['Ultimate Completion (Consolidated)'] = df['ultimate_completion'].combine_first(
            df.get('Ultimate Completion Date (FPDS)', pd.Series([np.nan] * len(df)))
        )
        print("  Consolidated ultimate completion columns")

    # Consolidate NAICS/PSC
    if 'naics_code' in df.columns and 'FPDS NAICS Code' in df.columns:
        df['NAICS Code (Consolidated)'] = df['naics_code'].combine_first(df['FPDS NAICS Code'])
        print("  Consolidated NAICS code columns")

    if 'psc_code' in df.columns and 'FPDS PSC Code' in df.columns:
        df['PSC Code (Consolidated)'] = df['psc_code'].combine_first(df['FPDS PSC Code'])
        print("  Consolidated PSC code columns")

    # Consolidate Key Locations with PoP city/state
    if 'pop_city' in df.columns and 'pop_state' in df.columns:
        df['Performance Location (TANGO)'] = df.apply(
            lambda x: f"{x['pop_city']}, {x['pop_state']}" if pd.notna(x['pop_city']) else np.nan,
            axis=1
        )
        print("  Created Performance Location from TANGO data")

    # Remove normalization column
    if 'Program Name_normalized' in df.columns:
        df.drop('Program Name_normalized', axis=1, inplace=True)

    return df


def organize_columns(df):
    """Organize columns in logical order"""
    print("\nOrganizing columns...")

    # Define column order by category
    identity_cols = [
        'Program Name', 'Acronym', 'Agency Owner', 'Program Type'
    ]

    priority_cols = [
        'BD Priority', 'Priority Level', 'Confidence Level', 'PTS Involvement'
    ]

    contract_cols = [
        'Contract Number', 'tango_piid', 'parent_piid',
        'Contract Value', 'Contract Value (Consolidated)', 'total_contract_value',
        'Base Contract Value (FPDS)', 'Base + Options Value (FPDS)',
        'obligated', 'subawards_total', 'subawards_count'
    ]

    contractor_cols = [
        'Prime Contractor', 'Prime Contractor Name', 'Prime Contractor 1',
        'Prime Contractor (Consolidated)', 'recipient_name', 'recipient_uei',
        'Key Subcontractors', 'Known Subcontractors'
    ]

    timeline_cols = [
        'Period of Performance', 'Period of Performance (Original)',
        'PoP Start', 'PoP End', 'period_start', 'period_end',
        'PoP Start (Consolidated)', 'PoP End (Consolidated)',
        'ultimate_completion', 'Ultimate Completion (Consolidated)',
        'Recompete Date', 'Contract Signed Date (FPDS)', 'Contract Effective Date (FPDS)',
        'Current Completion Date (FPDS)', 'Ultimate Completion Date (FPDS)'
    ]

    location_cols = [
        'Key Locations', 'Performance Location (TANGO)', 'Performance Location (FPDS)',
        'pop_city', 'pop_state', 'pop_zip', 'pop_country'
    ]

    classification_cols = [
        'NAICS Code (Consolidated)', 'naics_code', 'FPDS NAICS Code', 'NAICS Description',
        'PSC Code (Consolidated)', 'psc_code', 'FPDS PSC Code', 'PSC Description',
        'set_aside'
    ]

    technical_cols = [
        'Technical Stack', 'Tech Stack (Basic)', 'Keywords/Signals',
        'Functional Areas', 'Typical Roles', 'Job Titles'
    ]

    labor_cols = [
        'Labor Rate Min', 'Labor Rate Max', 'Labor Rate Average',
        'Education Requirement', 'Experience Requirement', 'Annual Salary Range',
        'CALC API Status'
    ]

    admin_cols = [
        'Contract Vehicle', 'Contract Vehicle Used', 'Contract Vehicle/Type',
        'awarding_office', 'awarding_agency', 'funding_office',
        'COR/COTR', 'Program Manager'
    ]

    security_cols = [
        'Clearance Requirements', 'Security Requirements'
    ]

    meta_cols = [
        'Match Confidence', 'Match Score', 'Incumbent Score',
        'Source Evidence', 'Notes', 'Pain Points', 'Related Jobs',
        'tango_description', 'parent_description', 'Budget'
    ]

    # Combine all column groups
    ordered_cols = (
        identity_cols + priority_cols + contract_cols + contractor_cols +
        timeline_cols + location_cols + classification_cols + technical_cols +
        labor_cols + admin_cols + security_cols + meta_cols
    )

    # Keep only columns that exist in df
    ordered_cols = [c for c in ordered_cols if c in df.columns]

    # Add any remaining columns not in the ordered list
    remaining_cols = [c for c in df.columns if c not in ordered_cols]
    final_order = ordered_cols + remaining_cols

    df = df[final_order]

    return df


def generate_statistics(df, tango, v3):
    """Generate statistics about the merged data"""
    print("\n" + "="*60)
    print("MERGE STATISTICS")
    print("="*60)

    total = len(df)

    # Contract number coverage
    contract_filled = df['Contract Number'].notna().sum() if 'Contract Number' in df.columns else 0
    print(f"\nContract Number Coverage: {contract_filled}/{total} ({contract_filled/total*100:.1f}%)")

    # TANGO data coverage
    tango_filled = df['tango_piid'].notna().sum() if 'tango_piid' in df.columns else 0
    print(f"TANGO Data Coverage: {tango_filled}/{total} ({tango_filled/total*100:.1f}%)")

    # Contract value coverage
    value_filled = df['Contract Value (Consolidated)'].notna().sum() if 'Contract Value (Consolidated)' in df.columns else 0
    print(f"Contract Value Coverage: {value_filled}/{total} ({value_filled/total*100:.1f}%)")

    # NAICS/PSC coverage
    naics_filled = df['NAICS Code (Consolidated)'].notna().sum() if 'NAICS Code (Consolidated)' in df.columns else 0
    print(f"NAICS Code Coverage: {naics_filled}/{total} ({naics_filled/total*100:.1f}%)")

    # Timeline coverage
    pop_start = df['PoP Start (Consolidated)'].notna().sum() if 'PoP Start (Consolidated)' in df.columns else 0
    pop_end = df['PoP End (Consolidated)'].notna().sum() if 'PoP End (Consolidated)' in df.columns else 0
    print(f"PoP Start Coverage: {pop_start}/{total} ({pop_start/total*100:.1f}%)")
    print(f"PoP End Coverage: {pop_end}/{total} ({pop_end/total*100:.1f}%)")

    # Labor rate coverage
    labor_filled = df['Labor Rate Average'].notna().sum() if 'Labor Rate Average' in df.columns else 0
    print(f"Labor Rate Coverage: {labor_filled}/{total} ({labor_filled/total*100:.1f}%)")

    # Column count
    print(f"\nTotal Columns: {len(df.columns)}")
    print(f"Total Programs: {len(df)}")

    # Top primes by program count
    if 'Prime Contractor (Consolidated)' in df.columns:
        print("\nTop 10 Prime Contractors by Program Count:")
        top_primes = df['Prime Contractor (Consolidated)'].value_counts().head(10)
        for prime, count in top_primes.items():
            if pd.notna(prime):
                print(f"  {prime[:40]:<40}: {count}")


def main():
    print("="*60)
    print("FEDERAL PROGRAMS MASTER ENRICHMENT")
    print("="*60)
    print(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M')}")

    # Load data
    master, tango, v3 = load_data_sources()

    # Merge TANGO data (primary enrichment source)
    merged = merge_tango_data(master, tango)

    # Merge V3 data (additional FPDS/CALC fields)
    merged = merge_v3_data(merged, v3)

    # Consolidate columns
    merged = consolidate_columns(merged)

    # Organize columns
    merged = organize_columns(merged)

    # Generate statistics
    generate_statistics(merged, tango, v3)

    # Save output
    output_path = BASE_DIR / 'Federal Programs MASTER ENRICHED.csv'
    merged.to_csv(output_path, index=False)

    print("\n" + "="*60)
    print("OUTPUT FILE SAVED")
    print("="*60)
    print(f"File: {output_path}")
    print(f"Programs: {len(merged)}")
    print(f"Columns: {len(merged.columns)}")

    # List all columns
    print("\nColumn List:")
    for i, col in enumerate(merged.columns, 1):
        print(f"  {i:2}. {col}")

    return output_path


if __name__ == '__main__':
    main()
