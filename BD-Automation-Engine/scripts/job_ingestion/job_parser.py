"""
Job Parser - Normalizes job data from Apex Systems and Insight Global scrapers.

Handles different date formats, field naming conventions, and extracts
company information from URLs.
"""

import json
import re
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field, asdict
from pathlib import Path


# ===========================================
# CLEARANCE NORMALIZATION
# ===========================================

CLEARANCE_PATTERNS = {
    'TS/SCI CI Poly': [
        r'ts/sci.*ci.*poly', r'top secret.*sci.*ci.*poly',
        r'ts/sci with ci poly', r'tssci ci poly'
    ],
    'TS/SCI FS Poly': [
        r'ts/sci.*fs.*poly', r'ts/sci.*full.*scope.*poly',
        r'top secret.*sci.*full.*scope', r'tssci.*fsp',
        r'ts/sci with full scope poly'
    ],
    'TS/SCI': [
        r'ts/sci(?!.*poly)', r'top secret.*sci(?!.*poly)',
        r'tssci(?!.*poly)', r'ts sci(?!.*poly)'
    ],
    'Top Secret': [
        r'top secret(?!.*sci)', r'\bts\b(?!.*sci)',
        r'active ts(?!.*sci)', r'ts clearance(?!.*sci)'
    ],
    'Secret': [
        r'\bsecret\b(?!.*top)', r'dod secret',
        r'secret clearance', r'secret security clearance'
    ],
    'Public Trust': [
        r'public trust', r'moderate risk public trust',
        r'high risk public trust', r'mrpt', r'hrpt'
    ]
}


def normalize_clearance(raw_clearance: str) -> Optional[str]:
    """Normalize clearance string to standard selection values."""
    if not raw_clearance:
        return None

    text = raw_clearance.lower().strip()

    # Check patterns in order of specificity (most specific first)
    for clearance_level, patterns in CLEARANCE_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, text, re.IGNORECASE):
                return clearance_level

    return None  # Unknown clearance


# ===========================================
# EMPLOYMENT TYPE NORMALIZATION
# ===========================================

EMPLOYMENT_TYPE_MAP = {
    'Contract': ['contract', 'contractor', 'w2'],
    'Contract-to-perm': ['contract-to-perm', 'contract to perm', 'cth', 'c2h',
                         'contract to hire', 'contract-to-hire', 'perm possible'],
    'Perm': ['fulltime', 'full-time', 'full time', 'permanent', 'direct hire', 'perm'],
    'Surge': []  # Will be determined by duration < 6 months
}


def normalize_employment_type(raw_type: str, duration: str = None) -> str:
    """Normalize employment type to standard selections."""
    if not raw_type:
        return 'Contract'  # Default

    text = raw_type.lower().strip()

    for emp_type, patterns in EMPLOYMENT_TYPE_MAP.items():
        for pattern in patterns:
            if pattern in text:
                return emp_type

    # Check duration for Surge classification
    if duration:
        duration_lower = duration.lower()
        if any(x in duration_lower for x in ['6 month', '3 month', '90 day', 'short term']):
            return 'Surge'

    return 'Contract'  # Default


# ===========================================
# DATE NORMALIZATION
# ===========================================

DATE_FORMATS = [
    '%Y-%m-%d',           # 2025-10-13 (Apex format)
    '%b %d, %Y',          # Nov 05, 2025 (Insight Global format)
    '%B %d, %Y',          # November 05, 2025
    '%m/%d/%Y',           # 10/13/2025
    '%d/%m/%Y',           # 13/10/2025
]


def normalize_date(raw_date: str) -> Optional[str]:
    """Normalize date to ISO format (YYYY-MM-DD)."""
    if not raw_date:
        return None

    text = raw_date.strip()

    for fmt in DATE_FORMATS:
        try:
            parsed = datetime.strptime(text, fmt)
            return parsed.strftime('%Y-%m-%d')
        except ValueError:
            continue

    # If all formats fail, return as-is if it looks like a date
    if re.match(r'\d{4}-\d{2}-\d{2}', text):
        return text

    return None


# ===========================================
# COMPANY EXTRACTION
# ===========================================

def extract_company_from_url(url: str) -> str:
    """Extract staffing company name from job URL."""
    if not url:
        return 'Unknown'

    url_lower = url.lower()

    if 'apexsystems.com' in url_lower:
        return 'Apex Systems'
    elif 'insightglobal.com' in url_lower:
        return 'Insight Global'
    elif 'teksystems.com' in url_lower:
        return 'TEKsystems'
    elif 'kforce.com' in url_lower:
        return 'Kforce'
    elif 'randstad.com' in url_lower:
        return 'Randstad'
    elif 'roberthalftechnology' in url_lower or 'roberthalf.com' in url_lower:
        return 'Robert Half'

    return 'Unknown'


# ===========================================
# JOB DATA CLASS
# ===========================================

@dataclass
class NormalizedJob:
    """Normalized job data structure matching Notion schema."""
    # Direct extraction fields
    title: str
    company: str  # Staffing company
    location: str
    date_posted: Optional[str]
    duration: Optional[str]
    employment_type: str
    job_number: str
    url: str
    clearance: Optional[str]

    # Raw description for AI enrichment
    description: str

    # Status tracking
    status: str = 'pending_enrichment'

    # AI-enriched fields (populated later)
    experience_years: Optional[int] = None
    skills: Optional[str] = None
    technologies: Optional[str] = None
    certifications_required: Optional[str] = None
    certifications_extra: Optional[str] = None

    # Relational enrichment fields (populated later)
    prime: Optional[str] = None
    subcontractors: Optional[str] = None
    task_order: Optional[str] = None
    hiring_leader: Optional[str] = None
    program_manager: Optional[str] = None
    pts_past_programs: Optional[str] = None
    pts_past_jobs: Optional[str] = None
    pts_past_contractors: Optional[str] = None
    pts_past_contacts: Optional[str] = None

    # Metadata
    scraped_at: Optional[str] = None
    source_file: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary."""
        return asdict(self)

    def to_notion_properties(self) -> Dict[str, Any]:
        """Convert to Notion property format.

        Maps to the GDIT Jobs database schema:
        - Job Title (title)
        - Job URL (url)
        - Location (rich_text)
        - Clearance (select)
        - Scraped Date (date)
        - Prime Contractor (rich_text)
        - Program (rich_text)
        - State (select)
        - BD Score (number)
        - BD Priority (select)
        - Confidence (select)
        - DCGS Relevance (select)
        - Task Order / Site (rich_text)
        """
        props = {
            'Job Title': {'title': [{'text': {'content': self.title[:2000]}}]},
            'Location': {'rich_text': [{'text': {'content': self.location or ''}}]},
            'Job URL': {'url': self.url if self.url else None},
        }

        # Add optional fields
        if self.clearance:
            props['Clearance'] = {'select': {'name': self.clearance}}

        if self.date_posted:
            props['Scraped Date'] = {'date': {'start': self.date_posted}}

        # Relational fields mapped to database schema
        if self.prime:
            props['Prime Contractor'] = {'rich_text': [{'text': {'content': self.prime}}]}

        if self.task_order:
            props['Program'] = {'rich_text': [{'text': {'content': self.task_order}}]}

        # Extract state from location
        if self.location:
            state = self._extract_state(self.location)
            if state:
                props['State'] = {'select': {'name': state}}

        # Note: The following fields exist in our data but not in the Notion DB:
        # Company, Job Number, Duration, Employment Type, Status,
        # Experience (Years), Skills, Technologies, Certifications,
        # Subcontractors, Hiring Leader, Program Manager
        # These would need to be added to the Notion database schema to be uploaded

        return props

    def _extract_state(self, location: str) -> Optional[str]:
        """Extract US state abbreviation from location string."""
        if not location:
            return None

        # State abbreviations
        states = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
                  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
                  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
                  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
                  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC']

        # Look for state abbreviation pattern (e.g., "City, ST" or "City, ST ZIP")
        import re
        match = re.search(r',\s*([A-Z]{2})(?:\s|\d|$)', location)
        if match and match.group(1) in states:
            return match.group(1)

        return None


# ===========================================
# PARSER FUNCTIONS
# ===========================================

def parse_apex_job(raw: Dict, source_file: str = None) -> NormalizedJob:
    """Parse Apex Systems job format."""
    return NormalizedJob(
        title=raw.get('jobTitle', 'Unknown Title'),
        company=extract_company_from_url(raw.get('url', '')),
        location=raw.get('location', ''),
        date_posted=normalize_date(raw.get('datePosted')),
        duration=raw.get('duration'),
        employment_type=normalize_employment_type(raw.get('employmentType'), raw.get('duration')),
        job_number=str(raw.get('jobNumber', '')),
        url=raw.get('url', ''),
        clearance=normalize_clearance(raw.get('securityClearance')),
        description=raw.get('description', ''),
        scraped_at=raw.get('scrapedAt'),
        source_file=source_file
    )


def parse_insight_global_job(raw: Dict, source_file: str = None) -> NormalizedJob:
    """Parse Insight Global job format."""
    return NormalizedJob(
        title=raw.get('jobTitle', 'Unknown Title'),
        company=extract_company_from_url(raw.get('url', '')),
        location=raw.get('location', ''),
        date_posted=normalize_date(raw.get('datePosted')),
        duration=raw.get('duration'),
        employment_type=normalize_employment_type(raw.get('employmentType'), raw.get('duration')),
        job_number=str(raw.get('jobNumber', '')),
        url=raw.get('url', ''),
        clearance=normalize_clearance(raw.get('securityClearance')),
        description=raw.get('description', ''),
        scraped_at=raw.get('scrapedAt'),
        source_file=source_file
    )


def detect_source_and_parse(raw: Dict, source_file: str = None) -> NormalizedJob:
    """Auto-detect source and parse accordingly."""
    url = raw.get('url', '')

    if 'apexsystems.com' in url.lower():
        return parse_apex_job(raw, source_file)
    elif 'insightglobal.com' in url.lower():
        return parse_insight_global_job(raw, source_file)
    else:
        # Default to Apex format as it's more common
        return parse_apex_job(raw, source_file)


def parse_job_file(file_path: str) -> List[NormalizedJob]:
    """Parse a JSON file containing job scrape data."""
    path = Path(file_path)

    if not path.exists():
        raise FileNotFoundError(f"File not found: {file_path}")

    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle both array and single object
    if isinstance(data, list):
        jobs = data
    else:
        jobs = [data]

    normalized = []
    for raw in jobs:
        try:
            job = detect_source_and_parse(raw, str(path.name))
            normalized.append(job)
        except Exception as e:
            print(f"Error parsing job: {e}")
            continue

    return normalized


def deduplicate_jobs(jobs: List[NormalizedJob]) -> List[NormalizedJob]:
    """Remove duplicate jobs based on job_number."""
    seen = set()
    unique = []

    for job in jobs:
        key = f"{job.company}:{job.job_number}"
        if key not in seen:
            seen.add(key)
            unique.append(job)

    return unique


# ===========================================
# CLI INTERFACE
# ===========================================

def main():
    """CLI for testing job parser."""
    import argparse

    parser = argparse.ArgumentParser(description='Job Parser - Normalize scrape data')
    parser.add_argument('files', nargs='+', help='JSON files to parse')
    parser.add_argument('--output', '-o', help='Output JSON file')
    parser.add_argument('--dedupe', action='store_true', help='Remove duplicates')
    parser.add_argument('--stats', action='store_true', help='Show statistics')

    args = parser.parse_args()

    all_jobs = []

    for file_path in args.files:
        print(f"Parsing: {file_path}")
        jobs = parse_job_file(file_path)
        print(f"  Found {len(jobs)} jobs")
        all_jobs.extend(jobs)

    if args.dedupe:
        before = len(all_jobs)
        all_jobs = deduplicate_jobs(all_jobs)
        print(f"Deduplication: {before} -> {len(all_jobs)} jobs")

    if args.stats:
        print("\n=== Statistics ===")
        print(f"Total Jobs: {len(all_jobs)}")

        # By company
        by_company = {}
        for job in all_jobs:
            by_company[job.company] = by_company.get(job.company, 0) + 1
        print("\nBy Company:")
        for company, count in sorted(by_company.items(), key=lambda x: -x[1]):
            print(f"  {company}: {count}")

        # By clearance
        by_clearance = {}
        for job in all_jobs:
            key = job.clearance or 'Unknown'
            by_clearance[key] = by_clearance.get(key, 0) + 1
        print("\nBy Clearance:")
        for clearance, count in sorted(by_clearance.items(), key=lambda x: -x[1]):
            print(f"  {clearance}: {count}")

        # By employment type
        by_type = {}
        for job in all_jobs:
            by_type[job.employment_type] = by_type.get(job.employment_type, 0) + 1
        print("\nBy Employment Type:")
        for emp_type, count in sorted(by_type.items(), key=lambda x: -x[1]):
            print(f"  {emp_type}: {count}")

    if args.output:
        output_data = [job.to_dict() for job in all_jobs]
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, indent=2)
        print(f"\nSaved to: {args.output}")

    return all_jobs


if __name__ == '__main__':
    main()
