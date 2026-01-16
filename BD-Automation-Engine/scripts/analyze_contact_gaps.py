#!/usr/bin/env python3
"""
Analyze BD data to find high-value programs with job activity but low contact coverage.
Outputs Bullhorn search criteria for filling contact gaps.
"""

import json
from pathlib import Path
from collections import defaultdict
import re

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "dashboard" / "public" / "data"

def load_json(filename):
    with open(DATA_DIR / filename, 'r', encoding='utf-8') as f:
        return json.load(f)

def extract_company_from_description(desc):
    """Extract company/prime names from job descriptions."""
    companies = set()
    patterns = [
        r'Raytheon', r'Lockheed Martin', r'Northrop Grumman', r'Boeing',
        r'SAIC', r'Leidos', r'BAE Systems', r'L3Harris', r'CACI',
        r'Booz Allen', r'ManTech', r'Peraton', r'General Dynamics',
        r'GDIT', r'Parsons', r'KBR', r'Jacobs', r'MITRE',
        r'Palantir', r'Anduril', r'RTX', r'Collins Aerospace'
    ]
    if desc:
        for pattern in patterns:
            if re.search(pattern, desc, re.IGNORECASE):
                companies.add(pattern)
    return companies

def extract_location_state(location):
    """Extract state from location string."""
    if not location:
        return None
    # Common state abbreviations
    state_map = {
        'AZ': 'Arizona', 'VA': 'Virginia', 'MD': 'Maryland', 'CA': 'California',
        'TX': 'Texas', 'CO': 'Colorado', 'FL': 'Florida', 'GA': 'Georgia',
        'AL': 'Alabama', 'NY': 'New York', 'MA': 'Massachusetts', 'NC': 'North Carolina',
        'OH': 'Ohio', 'PA': 'Pennsylvania', 'NM': 'New Mexico', 'UT': 'Utah',
        'HI': 'Hawaii', 'DC': 'District of Columbia', 'NV': 'Nevada'
    }
    # Try to find state abbreviation
    for abbr, full in state_map.items():
        if abbr in location or full in location:
            return full
    return location.split(',')[-1].strip() if ',' in location else location

def main():
    print("="*80)
    print("BD CONTACT GAP ANALYSIS - BULLHORN SEARCH CRITERIA")
    print("="*80)

    # Load data
    jobs = load_json('jobs.json')
    programs = load_json('programs.json')
    contacts = load_json('contacts.json')

    # Filter to Apex and Insight Global jobs only
    external_jobs = [j for j in jobs if j.get('source') in ['Apex', 'Insight Global']]
    print(f"\nAnalyzing {len(external_jobs)} jobs from Apex/Insight Global")
    print(f"Total programs: {len(programs)}")
    print(f"Total contacts: {len(contacts)}")

    # Build contact coverage by company
    contacts_by_company = defaultdict(list)
    for c in contacts:
        company = c.get('company', 'Unknown')
        contacts_by_company[company].append(c)

    print(f"\nCurrent contact coverage:")
    for company, contact_list in sorted(contacts_by_company.items(), key=lambda x: -len(x[1]))[:10]:
        print(f"  {company}: {len(contact_list)} contacts")

    # Analyze jobs to find companies/programs being hired for
    job_analysis = []
    for job in external_jobs:
        desc = job.get('description', '') or ''
        title = job.get('title', '')
        location = job.get('location', '')
        clearance = job.get('securityClearance', '')

        # Extract companies mentioned
        companies = extract_company_from_description(desc)

        # Extract keywords
        keywords = set()
        keyword_patterns = [
            r'missile', r'radar', r'C2', r'command and control', r'cyber',
            r'DCGS', r'ISR', r'intelligence', r'surveillance', r'reconnaissance',
            r'test systems', r'avionics', r'EW', r'electronic warfare',
            r'network', r'cloud', r'DevSecOps', r'software', r'systems engineer',
            r'SIGINT', r'GEOINT', r'HUMINT', r'MASINT', r'space',
            r'satellite', r'ground station', r'mission systems', r'battle management',
            r'ABMS', r'JADC2', r'F-35', r'F-22', r'MDA', r'BMD',
            r'Army', r'Navy', r'Air Force', r'Space Force', r'Marine',
            r'NORAD', r'NORTHCOM', r'CENTCOM', r'INDOPACOM', r'SOCOM'
        ]
        for pattern in keyword_patterns:
            if re.search(pattern, desc, re.IGNORECASE) or re.search(pattern, title, re.IGNORECASE):
                keywords.add(pattern.lower())

        job_analysis.append({
            'title': title,
            'location': location,
            'state': extract_location_state(location),
            'clearance': clearance,
            'companies': companies,
            'keywords': keywords,
            'source': job.get('source')
        })

    # Find high-priority programs with primes we don't have contacts for
    programs_by_prime = defaultdict(list)
    for prog in programs:
        prime = prog.get('primeContractor', '') or ''
        if prime:
            programs_by_prime[prime].append(prog)

    # Identify primes with programs but low contact coverage
    print("\n" + "="*80)
    print("HIGH-VALUE TARGETS FOR BULLHORN CONTACT EXPORT")
    print("="*80)

    # Aggregate job data by location and implied prime
    location_job_counts = defaultdict(int)
    keyword_job_counts = defaultdict(int)
    company_job_counts = defaultdict(int)

    for ja in job_analysis:
        if ja['state']:
            location_job_counts[ja['state']] += 1
        for kw in ja['keywords']:
            keyword_job_counts[kw] += 1
        for co in ja['companies']:
            company_job_counts[co] += 1

    # Top companies mentioned in jobs
    print("\n### PRIMES WITH HIGH JOB ACTIVITY (Mentioned in Job Descriptions) ###\n")
    for company, count in sorted(company_job_counts.items(), key=lambda x: -x[1]):
        contact_count = len(contacts_by_company.get(company, []))
        gap = "NEED CONTACTS" if contact_count < 50 else f"Have {contact_count}"
        print(f"  {company}: {count} job mentions | {gap}")

    # Build Bullhorn search recommendations
    print("\n" + "="*80)
    print("BULLHORN SEARCH RECOMMENDATIONS")
    print("="*80)

    # Group by prime contractor
    recommendations = []

    # Raytheon (Tucson jobs)
    recommendations.append({
        'prime': 'Raytheon / RTX',
        'reason': 'Multiple missile/test systems jobs in Tucson',
        'locations': ['Tucson, AZ', 'Arizona'],
        'job_titles': [
            'Test Systems Engineer', 'Principal Engineer', 'Electrical Engineer',
            'Systems Engineer', 'Software Engineer', 'Program Manager',
            'Missile Engineer', 'RF Engineer', 'Integration Engineer'
        ],
        'keywords': ['missile', 'radar', 'test systems', 'defense', 'RTX', 'Raytheon'],
        'programs': ['AMRAAM', 'Patriot', 'SM-3', 'SM-6', 'Tomahawk', 'LTAMDS']
    })

    # Lockheed Martin
    recommendations.append({
        'prime': 'Lockheed Martin',
        'reason': 'F-35, Space, C2 programs with hiring activity',
        'locations': ['Fort Worth, TX', 'Denver, CO', 'Marietta, GA', 'Sunnyvale, CA', 'Orlando, FL'],
        'job_titles': [
            'Systems Engineer', 'Software Engineer', 'Program Manager',
            'Avionics Engineer', 'Mission Systems Engineer', 'Integration Engineer',
            'F-35 Engineer', 'Space Systems Engineer'
        ],
        'keywords': ['F-35', 'F-22', 'C-130', 'space', 'satellite', 'Aegis', 'THAAD'],
        'programs': ['F-35', 'THAAD', 'Aegis', 'GPS III', 'SBIRS', 'NGI']
    })

    # Northrop Grumman
    recommendations.append({
        'prime': 'Northrop Grumman',
        'reason': 'IBCS, Space, Cyber programs',
        'locations': ['Huntsville, AL', 'San Diego, CA', 'Baltimore, MD', 'Colorado Springs, CO'],
        'job_titles': [
            'Systems Engineer', 'Software Engineer', 'Cyber Engineer',
            'Mission Systems', 'Battle Management', 'C2 Engineer',
            'Space Systems Engineer', 'SIGINT Engineer'
        ],
        'keywords': ['IBCS', 'B-21', 'BACN', 'Global Hawk', 'Triton', 'space', 'cyber'],
        'programs': ['IBCS', 'B-21', 'BACN', 'Global Hawk', 'Ground Based Strategic Deterrent']
    })

    # SAIC
    recommendations.append({
        'prime': 'SAIC',
        'reason': 'IT Services, Army Enterprise, Platform One',
        'locations': ['Reston, VA', 'San Antonio, TX', 'Huntsville, AL', 'San Diego, CA'],
        'job_titles': [
            'IT Specialist', 'Network Engineer', 'Cloud Engineer',
            'DevSecOps Engineer', 'Cybersecurity Analyst', 'Help Desk',
            'Systems Administrator', 'Program Manager'
        ],
        'keywords': ['AESD', 'Platform One', 'DevSecOps', 'cloud', 'IT services', 'enterprise'],
        'programs': ['AESD', 'Platform One', 'ITES-3S', 'NASA EAST']
    })

    # Leidos
    recommendations.append({
        'prime': 'Leidos',
        'reason': 'DISA, Army IT, Intelligence programs',
        'locations': ['Reston, VA', 'Columbia, MD', 'San Diego, CA', 'Huntsville, AL'],
        'job_titles': [
            'Systems Engineer', 'Software Developer', 'Cyber Analyst',
            'Network Engineer', 'Cloud Architect', 'Data Scientist',
            'Intelligence Analyst', 'Program Manager'
        ],
        'keywords': ['DISA', 'Army', 'intelligence', 'cyber', 'cloud', 'IT'],
        'programs': ['DEOS', 'NEST', 'NGEN', 'Army IT']
    })

    # Peraton
    recommendations.append({
        'prime': 'Peraton',
        'reason': 'ARCYBER, Intelligence Community, Space',
        'locations': ['Herndon, VA', 'Chantilly, VA', 'Fort Meade, MD', 'Colorado Springs, CO'],
        'job_titles': [
            'Cyber Operator', 'Intelligence Analyst', 'Systems Engineer',
            'Network Engineer', 'SIGINT Analyst', 'Space Systems Engineer',
            'Mission Manager', 'Program Manager'
        ],
        'keywords': ['ARCYBER', 'cyber', 'intelligence', 'SIGINT', 'space', 'NRO'],
        'programs': ['ARCYBER IAE', 'NRO Ground', 'Intelligence Community IT']
    })

    # CACI
    recommendations.append({
        'prime': 'CACI',
        'reason': 'Army IT, Cyber, SIGINT programs',
        'locations': ['Arlington, VA', 'Chantilly, VA', 'Aberdeen, MD', 'Fort Bragg, NC'],
        'job_titles': [
            'SIGINT Analyst', 'Cyber Engineer', 'Software Developer',
            'Systems Engineer', 'Network Engineer', 'Intelligence Analyst',
            'Agile Developer', 'Program Manager'
        ],
        'keywords': ['ITEMSS', 'SIGINT', 'cyber', 'Army', 'Agile', 'DevSecOps'],
        'programs': ['ITEMSS', 'BIM', 'Army SIGINT', 'Agile Solution Factory']
    })

    # ManTech
    recommendations.append({
        'prime': 'ManTech',
        'reason': 'Air Force, Cyber, Mission IT',
        'locations': ['Herndon, VA', 'San Antonio, TX', 'Colorado Springs, CO', 'Lackland AFB, TX'],
        'job_titles': [
            'Cyber Analyst', 'IT Specialist', 'Network Engineer',
            'Systems Administrator', 'Mission Support', 'Program Manager',
            'Help Desk', 'Security Analyst'
        ],
        'keywords': ['16AF', 'cyber', 'mission IT', 'Air Force', 'AFCENT'],
        'programs': ['16AF Mission IT', 'AFCENT IT', 'Cyber Mission Support']
    })

    # Print recommendations
    for i, rec in enumerate(recommendations, 1):
        print(f"\n{'='*60}")
        print(f"TARGET {i}: {rec['prime']}")
        print(f"{'='*60}")
        print(f"Reason: {rec['reason']}")
        print(f"\nLocations to search:")
        for loc in rec['locations']:
            print(f"  • {loc}")
        print(f"\nJob Titles to search:")
        for title in rec['job_titles']:
            print(f"  • {title}")
        print(f"\nKeywords/Signals:")
        for kw in rec['keywords']:
            print(f"  • {kw}")
        print(f"\nAssociated Programs:")
        for prog in rec['programs']:
            print(f"  • {prog}")

    # Summary table
    print("\n" + "="*80)
    print("SUMMARY TABLE FOR BULLHORN EXPORTS")
    print("="*80)
    print(f"\n{'Prime':<25} {'Locations':<30} {'Priority':<10}")
    print("-"*65)
    for rec in recommendations:
        locs = ', '.join(rec['locations'][:2])
        print(f"{rec['prime']:<25} {locs:<30} {'HIGH':<10}")

    print("\n" + "="*80)
    print("EXPORT PRIORITY ORDER:")
    print("="*80)
    print("""
1. Raytheon/RTX (Tucson) - Direct job matches, missile programs
2. Northrop Grumman (Huntsville) - IBCS, Army programs
3. SAIC (Multiple) - IT Services, Platform One
4. Lockheed Martin (Multiple) - F-35, Space programs
5. Peraton (Herndon/Chantilly) - ARCYBER, Intel
6. CACI (Arlington/Chantilly) - Army IT, SIGINT
7. Leidos (Reston/Columbia) - DISA, Intelligence
8. ManTech (San Antonio/Herndon) - Air Force IT/Cyber
""")

if __name__ == "__main__":
    main()
