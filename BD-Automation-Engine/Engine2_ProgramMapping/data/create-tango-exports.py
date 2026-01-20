#!/usr/bin/env python3
"""
Create specialized exports from Tango-enriched federal programs data.
"""

import csv
from collections import defaultdict
from pathlib import Path

INPUT_FILE = Path("Federal Programs TANGO ENRICHED.csv")
EXPORTS_DIR = Path("exports")

def load_data():
    """Load enriched program data."""
    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        return list(csv.DictReader(f))

def export_location_intelligence(programs):
    """Export location analysis - programs by state and city."""
    output_file = EXPORTS_DIR / "location_intelligence.csv"

    # Aggregate by location
    location_data = []
    for p in programs:
        if p.get('pop_city') or p.get('pop_state'):
            location_data.append({
                'Program Name': p.get('Program Name', ''),
                'Acronym': p.get('Acronym', ''),
                'Agency': p.get('Agency', ''),
                'Prime Contractor': p.get('Prime Contractor', ''),
                'City': p.get('pop_city', ''),
                'State': p.get('pop_state', ''),
                'ZIP Code': p.get('pop_zip', ''),
                'Contract Number': p.get('Contract Number', ''),
                'Contract Value': p.get('Contract Value', ''),
                'Period Start': p.get('period_start', ''),
                'Period End': p.get('period_end', ''),
            })

    # Write file
    if location_data:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=location_data[0].keys())
            writer.writeheader()
            writer.writerows(location_data)

    print(f"Location intelligence: {len(location_data)} programs -> {output_file}")

    # Summary by state
    states = defaultdict(int)
    for p in location_data:
        state = p.get('State', 'Unknown')
        if state:
            states[state] += 1

    print("  Top 10 states:")
    for state, count in sorted(states.items(), key=lambda x: -x[1])[:10]:
        print(f"    {state}: {count} programs")

def export_subaward_intelligence(programs):
    """Export programs with subaward data."""
    output_file = EXPORTS_DIR / "subaward_intelligence.csv"

    subaward_data = []
    for p in programs:
        if p.get('subawards_count'):
            try:
                count = int(p.get('subawards_count', 0))
            except:
                count = 0

            subaward_data.append({
                'Program Name': p.get('Program Name', ''),
                'Acronym': p.get('Acronym', ''),
                'Agency': p.get('Agency', ''),
                'Prime Contractor': p.get('Prime Contractor', ''),
                'Contract Number': p.get('Contract Number', ''),
                'Contract Value': p.get('Contract Value', ''),
                'Subaward Count': p.get('subawards_count', ''),
                'Subaward Total': p.get('subawards_total', ''),
                'Recipient UEI': p.get('recipient_uei', ''),
                'Recipient Name': p.get('recipient_name', ''),
                'City': p.get('pop_city', ''),
                'State': p.get('pop_state', ''),
            })

    # Sort by subaward count
    subaward_data.sort(key=lambda x: int(x.get('Subaward Count', 0) or 0), reverse=True)

    # Write file
    if subaward_data:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=subaward_data[0].keys())
            writer.writeheader()
            writer.writerows(subaward_data)

    print(f"Subaward intelligence: {len(subaward_data)} programs -> {output_file}")

    # Top 10 by subaward count
    print("  Top 10 by subaward count:")
    for p in subaward_data[:10]:
        name = p['Program Name'][:40].encode('ascii', 'replace').decode('ascii')
        print(f"    {p['Subaward Count']:>5} subawards - {name}")

def export_contract_timeline(programs):
    """Export contract timeline with period of performance."""
    output_file = EXPORTS_DIR / "contract_timeline.csv"

    timeline_data = []
    for p in programs:
        if p.get('period_start') or p.get('period_end'):
            timeline_data.append({
                'Program Name': p.get('Program Name', ''),
                'Acronym': p.get('Acronym', ''),
                'Agency': p.get('Agency', ''),
                'Prime Contractor': p.get('Prime Contractor', ''),
                'Contract Number': p.get('Contract Number', ''),
                'Period Start': p.get('period_start', ''),
                'Period End': p.get('period_end', ''),
                'Ultimate Completion': p.get('ultimate_completion', ''),
                'Contract Value': p.get('Contract Value', ''),
                'Awarding Office': p.get('awarding_office', ''),
                'Awarding Agency': p.get('awarding_agency', ''),
                'Parent PIID': p.get('parent_piid', ''),
            })

    # Sort by end date
    timeline_data.sort(key=lambda x: x.get('Period End', '9999'), reverse=False)

    # Write file
    if timeline_data:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=timeline_data[0].keys())
            writer.writeheader()
            writer.writerows(timeline_data)

    print(f"Contract timeline: {len(timeline_data)} programs -> {output_file}")

    # Count expiring soon (2025-2026)
    expiring_soon = [p for p in timeline_data if p.get('Period End', '').startswith(('2025', '2026'))]
    print(f"  Contracts expiring 2025-2026: {len(expiring_soon)}")

def export_vendor_uei_lookup(programs):
    """Export vendor UEI lookup table for SAM.gov queries."""
    output_file = EXPORTS_DIR / "vendor_uei_lookup.csv"

    # Deduplicate by UEI
    uei_map = {}
    for p in programs:
        uei = p.get('recipient_uei', '')
        if uei and uei not in uei_map:
            uei_map[uei] = {
                'UEI': uei,
                'Vendor Name': p.get('recipient_name', '') or p.get('Prime Contractor', ''),
                'Contract Number': p.get('Contract Number', ''),
                'Program Name': p.get('Program Name', ''),
                'Agency': p.get('Agency', ''),
                'City': p.get('pop_city', ''),
                'State': p.get('pop_state', ''),
            }

    vendor_data = list(uei_map.values())

    # Write file
    if vendor_data:
        with open(output_file, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=vendor_data[0].keys())
            writer.writeheader()
            writer.writerows(vendor_data)

    print(f"Vendor UEI lookup: {len(vendor_data)} unique vendors -> {output_file}")

def export_naics_psc_analysis(programs):
    """Export NAICS and PSC code analysis."""
    output_file = EXPORTS_DIR / "naics_psc_analysis.csv"

    # Aggregate by NAICS
    naics_counts = defaultdict(int)
    psc_counts = defaultdict(int)

    for p in programs:
        naics = p.get('naics_code', '')
        psc = p.get('psc_code', '')
        if naics:
            naics_counts[naics] += 1
        if psc:
            psc_counts[psc] += 1

    # Write NAICS analysis
    naics_data = [{'NAICS Code': k, 'Program Count': v} for k, v in sorted(naics_counts.items(), key=lambda x: -x[1])]
    with open(EXPORTS_DIR / "naics_summary.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['NAICS Code', 'Program Count'])
        writer.writeheader()
        writer.writerows(naics_data)

    # Write PSC analysis
    psc_data = [{'PSC Code': k, 'Program Count': v} for k, v in sorted(psc_counts.items(), key=lambda x: -x[1])]
    with open(EXPORTS_DIR / "psc_summary.csv", 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=['PSC Code', 'Program Count'])
        writer.writeheader()
        writer.writerows(psc_data)

    print(f"NAICS analysis: {len(naics_data)} codes -> {EXPORTS_DIR / 'naics_summary.csv'}")
    print(f"PSC analysis: {len(psc_data)} codes -> {EXPORTS_DIR / 'psc_summary.csv'}")
    print("  Top 5 NAICS codes:")
    for item in naics_data[:5]:
        print(f"    {item['NAICS Code']}: {item['Program Count']} programs")

def main():
    print("=" * 70)
    print("CREATING SPECIALIZED EXPORTS FROM TANGO-ENRICHED DATA")
    print("=" * 70)
    print()

    # Load data
    programs = load_data()
    print(f"Loaded {len(programs)} programs from {INPUT_FILE}")
    print()

    # Ensure exports directory exists
    EXPORTS_DIR.mkdir(exist_ok=True)

    # Create exports
    print("Creating exports...")
    print("-" * 50)

    export_location_intelligence(programs)
    print()

    export_subaward_intelligence(programs)
    print()

    export_contract_timeline(programs)
    print()

    export_vendor_uei_lookup(programs)
    print()

    export_naics_psc_analysis(programs)
    print()

    print("=" * 70)
    print("EXPORT COMPLETE")
    print("=" * 70)
    print(f"All exports saved to: {EXPORTS_DIR.absolute()}")

if __name__ == "__main__":
    main()
