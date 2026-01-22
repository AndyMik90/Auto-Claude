"""
Bullhorn ETL Processor
Comprehensive data extraction, transformation, and loading for all Bullhorn exports.
Handles: Jobs, Candidates, Placements, Activities, Notes
"""

import os
import sys
import re
import csv
import json
import hashlib
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database_schema import create_database, get_connection, DATABASE_PATH

# =========================================
# CONFIGURATION
# =========================================

BULLHORN_EXPORTS_DIR = Path("C:/Users/gtmar/Projects/Auto-Claude/BD-Automation-Engine/docs/Bullhorn Exports")
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"
STAGING_DIR = Path(__file__).parent.parent / "data" / "staging"

# Known Prime Contractors (will be expanded during processing)
KNOWN_PRIMES = {
    'leidos': 'Leidos',
    'booz allen': 'Booz Allen Hamilton',
    'booz allen hamilton': 'Booz Allen Hamilton',
    'bah': 'Booz Allen Hamilton',
    'gdit': 'General Dynamics IT',
    'general dynamics': 'General Dynamics IT',
    'northrop grumman': 'Northrop Grumman',
    'northrop': 'Northrop Grumman',
    'raytheon': 'Raytheon',
    'lockheed martin': 'Lockheed Martin',
    'lockheed': 'Lockheed Martin',
    'lmi': 'LMI',
    'caci': 'CACI International',
    'saic': 'SAIC',
    'peraton': 'Peraton',
    'perspecta': 'Perspecta',
    'mantech': 'ManTech',
    'jacobs': 'Jacobs',
    'parsons': 'Parsons',
    'kbr': 'KBR',
    'aecom': 'AECOM',
    'serco': 'Serco',
    'accenture federal': 'Accenture Federal Services',
    'deloitte': 'Deloitte',
    'ibm': 'IBM',
    'microsoft': 'Microsoft',
    'amazon': 'Amazon Web Services',
    'aws': 'Amazon Web Services',
    'google': 'Google',
    'oracle': 'Oracle',
    'dell': 'Dell Technologies',
    'hp': 'HP Inc',
    'hewlett packard': 'HP Inc',
}

# =========================================
# UTILITY FUNCTIONS
# =========================================

def normalize_company_name(name: str) -> str:
    """Normalize company name for matching."""
    if not name:
        return ""
    name = name.lower().strip()
    name = re.sub(r'[^\w\s]', '', name)
    name = re.sub(r'\s+', ' ', name)
    # Remove common suffixes
    for suffix in ['inc', 'llc', 'corp', 'corporation', 'ltd', 'limited', 'co', 'company']:
        name = re.sub(rf'\b{suffix}\b', '', name)
    return name.strip()


def extract_job_number(title: str) -> Optional[str]:
    """Extract job number from title (e.g., #9373)."""
    if not title:
        return None
    match = re.search(r'#(\d+)', title)
    return match.group(0) if match else None


def parse_currency(value: str) -> Optional[float]:
    """Parse currency string to float."""
    if not value or value == '$0.00':
        return 0.0
    try:
        # Remove $ and commas
        clean = re.sub(r'[$,]', '', str(value))
        return float(clean) if clean else 0.0
    except (ValueError, TypeError):
        return None


def parse_date(date_str: str) -> Optional[datetime]:
    """Parse various date formats."""
    if not date_str or date_str.strip() == '':
        return None

    date_formats = [
        '%m/%d/%Y, %I:%M %p',  # 01/12/2026, 2:18 PM
        '%m/%d/%Y %I:%M %p',
        '%m/%d/%Y',
        '%Y-%m-%d',
        '%Y-%m-%d %H:%M:%S',
        '%d-%b-%Y',
        '%b %d, %Y',
        '%m-%d-%Y',
        '%m/%d/%y',
    ]

    for fmt in date_formats:
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except ValueError:
            continue
    return None


def get_file_hash(file_path: Path) -> str:
    """Get MD5 hash of file for duplicate detection."""
    hasher = hashlib.md5()
    with open(file_path, 'rb') as f:
        buf = f.read(65536)
        while len(buf) > 0:
            hasher.update(buf)
            buf = f.read(65536)
    return hasher.hexdigest()


def identify_prime_contractor(text: str) -> Optional[str]:
    """Identify prime contractor from text."""
    if not text:
        return None
    normalized = normalize_company_name(text)
    for key, value in KNOWN_PRIMES.items():
        if key in normalized:
            return value
    return None


# =========================================
# TEXT FILE PROCESSOR (Leidos Jobs)
# =========================================

class LeidosJobsProcessor:
    """Process the Leidos Jobs Bullhorn.txt file."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.jobs = []
        self.contacts = set()
        self.owners = set()
        self.stats = {
            'total_lines': 0,
            'parsed_records': 0,
            'skipped_records': 0,
            'data_quality_issues': []
        }

    def process(self) -> List[Dict]:
        """Process the text file and extract jobs."""
        print(f"\n{'='*60}")
        print(f"Processing: {self.file_path.name}")
        print(f"{'='*60}")

        with open(self.file_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = f.readlines()

        self.stats['total_lines'] = len(lines)
        print(f"Total lines: {len(lines)}")

        # Find header line
        header_idx = 0
        for i, line in enumerate(lines):
            if 'Date Added' in line and 'Job Title' in line:
                header_idx = i
                break

        # Parse header
        header_line = lines[header_idx]
        headers = [h.strip() for h in header_line.split('\t')]
        print(f"Headers found: {headers}")

        # Parse data lines
        for i, line in enumerate(lines[header_idx + 1:], start=header_idx + 2):
            if not line.strip():
                continue

            try:
                job = self._parse_job_line(line, headers, i)
                if job:
                    self.jobs.append(job)
                    self.stats['parsed_records'] += 1

                    if job.get('contact'):
                        self.contacts.add(job['contact'])
                    if job.get('owner'):
                        self.owners.add(job['owner'])
            except Exception as e:
                self.stats['skipped_records'] += 1
                self.stats['data_quality_issues'].append({
                    'line': i,
                    'error': str(e),
                    'content': line[:100]
                })

        print(f"Parsed records: {self.stats['parsed_records']}")
        print(f"Skipped records: {self.stats['skipped_records']}")
        print(f"Unique contacts: {len(self.contacts)}")
        print(f"Unique owners: {len(self.owners)}")

        return self.jobs

    def _parse_job_line(self, line: str, headers: List[str], line_num: int) -> Optional[Dict]:
        """Parse a single job line."""
        parts = line.split('\t')

        if len(parts) < 6:
            return None

        # Map parts to headers
        job = {
            'source_file': self.file_path.name,
            'source_line': line_num
        }

        # Standard field mapping
        field_map = {
            'Date Added': 'date_added',
            'Job Title': 'title',
            'Owner': 'owner',
            'Contact': 'contact',
            'Employment Type': 'employment_type',
            'Open/Closed': 'open_closed',
            'Status': 'status',
            'Pay Rate': 'pay_rate',
            'Client Bill Rate': 'bill_rate',
            'Salary': 'salary',
            'Perm Fee (%)': 'perm_fee_percent'
        }

        for i, header in enumerate(headers):
            if i < len(parts):
                value = parts[i].strip()
                db_field = field_map.get(header)
                if db_field:
                    job[db_field] = value

        # Extract job number from title
        job['job_number'] = extract_job_number(job.get('title', ''))

        # Parse date
        if job.get('date_added'):
            parsed_date = parse_date(job['date_added'])
            job['date_added'] = parsed_date

        # Parse currency fields
        for field in ['pay_rate', 'bill_rate', 'salary']:
            if job.get(field):
                job[field] = parse_currency(job[field])

        # Parse perm fee
        if job.get('perm_fee_percent'):
            try:
                job['perm_fee_percent'] = int(job['perm_fee_percent'])
            except (ValueError, TypeError):
                job['perm_fee_percent'] = 0

        # Identify prime contractor from title
        job['prime_contractor'] = identify_prime_contractor(job.get('title', ''))
        if not job['prime_contractor']:
            # This is Leidos data
            job['prime_contractor'] = 'Leidos'

        # Create unique ID
        job['bullhorn_job_id'] = f"LJ-{job.get('job_number', '')}-{line_num}"

        return job


# =========================================
# XLS FILE PROCESSOR
# =========================================

class XLSProcessor:
    """Process XLS files from Bullhorn exports."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.data = []
        self.headers = []
        self.entity_type = None
        self.stats = {
            'total_rows': 0,
            'parsed_records': 0,
            'skipped_records': 0
        }

    def detect_entity_type(self, headers: List[str]) -> str:
        """Detect what type of entity this file contains."""
        headers_lower = [h.lower() for h in headers if h]

        # Check for specific patterns
        if any('placement' in h for h in headers_lower):
            return 'placement'
        if any('note' in h for h in headers_lower) or any('activity' in h for h in headers_lower):
            return 'activity'
        if any('candidate' in h for h in headers_lower) or (
            'first name' in headers_lower and 'last name' in headers_lower
        ):
            return 'candidate'
        if any('job' in h for h in headers_lower) or 'job title' in headers_lower:
            return 'job'
        if 'company' in headers_lower or 'client' in headers_lower:
            return 'company'

        return 'unknown'

    def process(self) -> Tuple[str, List[Dict]]:
        """Process the XLS file and return entity type and data."""
        print(f"\n{'='*60}")
        print(f"Processing: {self.file_path.name}")
        print(f"{'='*60}")

        try:
            import pandas as pd

            # Try reading with xlrd (for old .xls format)
            try:
                df = pd.read_excel(self.file_path, engine='xlrd')
            except Exception as e1:
                # Try with openpyxl if xlrd fails
                try:
                    df = pd.read_excel(self.file_path, engine='openpyxl')
                except Exception as e2:
                    print(f"  ERROR: Could not read file: {e1} / {e2}")
                    return 'error', []

            self.headers = list(df.columns)
            self.stats['total_rows'] = len(df)

            print(f"  Rows: {len(df)}")
            print(f"  Columns: {len(self.headers)}")
            print(f"  Headers: {self.headers[:10]}...")

            # Detect entity type
            self.entity_type = self.detect_entity_type(self.headers)
            print(f"  Entity Type: {self.entity_type}")

            # Convert to list of dicts
            self.data = df.to_dict('records')

            # Clean up data
            for i, row in enumerate(self.data):
                cleaned_row = {}
                for key, value in row.items():
                    # Handle NaN values
                    if pd.isna(value):
                        cleaned_row[key] = None
                    else:
                        cleaned_row[key] = value
                cleaned_row['source_file'] = self.file_path.name
                cleaned_row['source_row'] = i + 2  # Account for header
                self.data[i] = cleaned_row
                self.stats['parsed_records'] += 1

            print(f"  Parsed records: {self.stats['parsed_records']}")
            return self.entity_type, self.data

        except ImportError:
            print("  ERROR: pandas not installed. Run: pip install pandas xlrd openpyxl")
            return 'error', []
        except Exception as e:
            print(f"  ERROR: {str(e)}")
            return 'error', []


# =========================================
# MAIN ETL ORCHESTRATOR
# =========================================

class BullhornETL:
    """Main ETL orchestrator for all Bullhorn data."""

    def __init__(self):
        self.conn = None
        self.run_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.file_hashes = {}
        self.duplicate_files = []
        self.processed_files = []
        self.stats = {
            'files_processed': 0,
            'files_skipped': 0,
            'duplicate_files': 0,
            'total_jobs': 0,
            'total_candidates': 0,
            'total_placements': 0,
            'total_activities': 0,
            'primes_identified': set(),
            'programs_identified': set()
        }

    def initialize(self):
        """Initialize database and connections."""
        print("\n" + "="*80)
        print("BULLHORN ETL PROCESSOR")
        print(f"Run ID: {self.run_id}")
        print("="*80)

        # Create database
        create_database()
        self.conn = get_connection()

        # Create output directories
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        STAGING_DIR.mkdir(parents=True, exist_ok=True)

    def scan_files(self) -> List[Path]:
        """Scan for all files to process."""
        print(f"\nScanning directory: {BULLHORN_EXPORTS_DIR}")

        files = list(BULLHORN_EXPORTS_DIR.glob('*'))
        print(f"Found {len(files)} files")

        # Check for duplicates by hash
        unique_files = []
        for f in files:
            if f.is_file():
                file_hash = get_file_hash(f)
                if file_hash in self.file_hashes:
                    self.duplicate_files.append({
                        'file': f.name,
                        'duplicate_of': self.file_hashes[file_hash]
                    })
                    print(f"  DUPLICATE: {f.name} == {self.file_hashes[file_hash]}")
                    self.stats['duplicate_files'] += 1
                else:
                    self.file_hashes[file_hash] = f.name
                    unique_files.append(f)

        print(f"Unique files: {len(unique_files)}")
        print(f"Duplicate files: {len(self.duplicate_files)}")

        return unique_files

    def process_all(self):
        """Process all files."""
        files = self.scan_files()

        all_jobs = []
        all_candidates = []
        all_placements = []
        all_activities = []

        for file_path in files:
            try:
                if file_path.suffix.lower() == '.txt':
                    # Process text file
                    processor = LeidosJobsProcessor(file_path)
                    jobs = processor.process()
                    all_jobs.extend(jobs)

                    # Record file processing
                    self._record_file_processed(file_path, 'txt', 'job', len(jobs))

                elif file_path.suffix.lower() == '.xls':
                    # Process XLS file
                    processor = XLSProcessor(file_path)
                    entity_type, data = processor.process()

                    if entity_type == 'job':
                        all_jobs.extend(data)
                    elif entity_type == 'candidate':
                        all_candidates.extend(data)
                    elif entity_type == 'placement':
                        all_placements.extend(data)
                    elif entity_type == 'activity':
                        all_activities.extend(data)

                    # Record file processing
                    self._record_file_processed(file_path, 'xls', entity_type, len(data))

                self.stats['files_processed'] += 1
                self.processed_files.append(file_path.name)

            except Exception as e:
                print(f"ERROR processing {file_path.name}: {str(e)}")
                self.stats['files_skipped'] += 1

        # Load all data to database
        print("\n" + "="*80)
        print("LOADING DATA TO DATABASE")
        print("="*80)

        self._load_jobs(all_jobs)
        self._load_candidates(all_candidates)
        self._load_placements(all_placements)
        self._load_activities(all_activities)

        # Build relationships
        self._build_prime_contractors()
        self._build_programs()
        self._build_past_performance()

        self.conn.commit()

    def _record_file_processed(self, file_path: Path, file_type: str, entity_type: str, record_count: int):
        """Record file processing in database."""
        cursor = self.conn.cursor()
        cursor.execute("""
            INSERT INTO source_files (filename, file_path, file_size_bytes, file_type,
                                       entity_type, record_count, processed_date, processing_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            file_path.name,
            str(file_path),
            file_path.stat().st_size,
            file_type,
            entity_type,
            record_count,
            datetime.now(),
            'completed'
        ))

    def _load_jobs(self, jobs: List[Dict]):
        """Load jobs to database with deduplication."""
        print(f"\nLoading {len(jobs)} jobs...")
        cursor = self.conn.cursor()

        inserted = 0
        duplicates = 0
        errors = 0

        for job in jobs:
            try:
                # Check for duplicate by job_number or bullhorn_job_id
                job_id = job.get('bullhorn_job_id') or job.get('job_number')
                if job_id:
                    cursor.execute("SELECT id FROM jobs WHERE bullhorn_job_id = ? OR job_number = ?",
                                   (job_id, job.get('job_number')))
                    if cursor.fetchone():
                        duplicates += 1
                        continue

                cursor.execute("""
                    INSERT INTO jobs (bullhorn_job_id, job_number, title, client_corporation,
                                      prime_contractor, employment_type, status, pay_rate,
                                      bill_rate, salary, perm_fee_percent, owner, contact,
                                      date_added, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    job.get('bullhorn_job_id'),
                    job.get('job_number'),
                    job.get('title'),
                    job.get('client_corporation'),
                    job.get('prime_contractor'),
                    job.get('employment_type'),
                    job.get('status'),
                    job.get('pay_rate'),
                    job.get('bill_rate'),
                    job.get('salary'),
                    job.get('perm_fee_percent'),
                    job.get('owner'),
                    job.get('contact'),
                    job.get('date_added'),
                    job.get('source_file')
                ))
                inserted += 1

                # Track prime contractor
                if job.get('prime_contractor'):
                    self.stats['primes_identified'].add(job['prime_contractor'])

            except Exception as e:
                errors += 1

        self.stats['total_jobs'] = inserted
        print(f"  Inserted: {inserted}, Duplicates: {duplicates}, Errors: {errors}")

    def _load_candidates(self, candidates: List[Dict]):
        """Load candidates to database."""
        print(f"\nLoading {len(candidates)} candidates...")
        cursor = self.conn.cursor()

        inserted = 0
        duplicates = 0

        for cand in candidates:
            try:
                # Create unique identifier
                email = cand.get('email') or cand.get('Email')
                name = cand.get('full_name') or f"{cand.get('first_name', '')} {cand.get('last_name', '')}".strip()

                if email:
                    cursor.execute("SELECT id FROM candidates WHERE email = ?", (email,))
                    if cursor.fetchone():
                        duplicates += 1
                        continue

                cursor.execute("""
                    INSERT INTO candidates (bullhorn_candidate_id, first_name, last_name, full_name,
                                            email, phone, occupation, company_name, status, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    cand.get('bullhorn_candidate_id') or cand.get('id'),
                    cand.get('first_name') or cand.get('First Name'),
                    cand.get('last_name') or cand.get('Last Name'),
                    name,
                    email,
                    cand.get('phone') or cand.get('Phone'),
                    cand.get('occupation') or cand.get('Occupation'),
                    cand.get('company_name') or cand.get('Company'),
                    cand.get('status') or cand.get('Status'),
                    cand.get('source_file')
                ))
                inserted += 1

            except Exception as e:
                pass

        self.stats['total_candidates'] = inserted
        print(f"  Inserted: {inserted}, Duplicates: {duplicates}")

    def _load_placements(self, placements: List[Dict]):
        """Load placements to database."""
        print(f"\nLoading {len(placements)} placements...")
        cursor = self.conn.cursor()

        inserted = 0
        for plc in placements:
            try:
                cursor.execute("""
                    INSERT INTO placements (bullhorn_placement_id, bullhorn_job_id, bullhorn_candidate_id,
                                            placement_date, status, outcome, job_title, candidate_name,
                                            client_name, owner, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    plc.get('id') or plc.get('Placement ID'),
                    plc.get('job_id') or plc.get('Job ID'),
                    plc.get('candidate_id') or plc.get('Candidate ID'),
                    plc.get('placement_date') or plc.get('Placement Date'),
                    plc.get('status') or plc.get('Status'),
                    plc.get('outcome') or plc.get('Outcome'),
                    plc.get('job_title') or plc.get('Job Title'),
                    plc.get('candidate_name') or plc.get('Candidate'),
                    plc.get('client_name') or plc.get('Client'),
                    plc.get('owner') or plc.get('Owner'),
                    plc.get('source_file')
                ))
                inserted += 1
            except Exception as e:
                pass

        self.stats['total_placements'] = inserted
        print(f"  Inserted: {inserted}")

    def _load_activities(self, activities: List[Dict]):
        """Load activities to database."""
        print(f"\nLoading {len(activities)} activities...")
        cursor = self.conn.cursor()

        inserted = 0
        for act in activities:
            try:
                cursor.execute("""
                    INSERT INTO activities (bullhorn_activity_id, activity_type, action,
                                            bullhorn_job_id, bullhorn_candidate_id, activity_date,
                                            actor, note_text, comments, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    act.get('id') or act.get('Activity ID'),
                    act.get('activity_type') or act.get('Type') or act.get('Activity Type'),
                    act.get('action') or act.get('Action'),
                    act.get('job_id') or act.get('Job ID'),
                    act.get('candidate_id') or act.get('Candidate ID'),
                    act.get('activity_date') or act.get('Date') or act.get('Activity Date'),
                    act.get('actor') or act.get('User') or act.get('Owner'),
                    act.get('note_text') or act.get('Notes') or act.get('Note'),
                    act.get('comments') or act.get('Comments'),
                    act.get('source_file')
                ))
                inserted += 1
            except Exception as e:
                pass

        self.stats['total_activities'] = inserted
        print(f"  Inserted: {inserted}")

    def _build_prime_contractors(self):
        """Build prime contractors table from job data."""
        print("\nBuilding Prime Contractors...")
        cursor = self.conn.cursor()

        # Get unique primes from jobs
        cursor.execute("""
            SELECT DISTINCT prime_contractor, COUNT(*) as job_count,
                   MIN(date_added) as first_date, MAX(date_added) as last_date
            FROM jobs
            WHERE prime_contractor IS NOT NULL
            GROUP BY prime_contractor
        """)

        primes = cursor.fetchall()
        print(f"  Found {len(primes)} unique prime contractors")

        for prime_name, job_count, first_date, last_date in primes:
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO prime_contractors (name, normalized_name, total_jobs,
                                                             first_engagement_date, last_engagement_date)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    prime_name,
                    normalize_company_name(prime_name),
                    job_count,
                    first_date,
                    last_date
                ))
            except Exception as e:
                pass

        self.conn.commit()

    def _build_programs(self):
        """Build programs table from job data patterns."""
        print("\nBuilding Programs...")
        # Programs will be inferred from job titles and custom fields
        # This is a placeholder for program extraction logic
        cursor = self.conn.cursor()

        # Extract potential programs from job titles
        cursor.execute("SELECT id, title, custom_text1 FROM jobs WHERE title IS NOT NULL")
        jobs = cursor.fetchall()

        program_patterns = [
            (r'DCGS', 'DCGS'),
            (r'MDA', 'Missile Defense Agency'),
            (r'DISA', 'DISA'),
            (r'Space Force', 'Space Force'),
            (r'Army', 'Army'),
            (r'Navy', 'Navy'),
            (r'Air Force', 'Air Force'),
            (r'DHS', 'Department of Homeland Security'),
            (r'VA', 'Veterans Affairs'),
            (r'FBI', 'FBI'),
            (r'CIA', 'CIA'),
            (r'NSA', 'NSA'),
            (r'NGA', 'NGA'),
            (r'NRO', 'NRO'),
        ]

        programs_found = set()
        for job_id, title, custom in jobs:
            text = f"{title or ''} {custom or ''}".upper()
            for pattern, program_name in program_patterns:
                if re.search(pattern, text, re.IGNORECASE):
                    programs_found.add(program_name)

        print(f"  Programs identified: {len(programs_found)}")
        for prog in programs_found:
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO programs (name, normalized_name)
                    VALUES (?, ?)
                """, (prog, normalize_company_name(prog)))
                self.stats['programs_identified'].add(prog)
            except Exception:
                pass

        self.conn.commit()

    def _build_past_performance(self):
        """Build past performance summary."""
        print("\nBuilding Past Performance Summary...")
        cursor = self.conn.cursor()

        # Get summary by prime contractor
        cursor.execute("""
            SELECT prime_contractor,
                   COUNT(*) as total_jobs,
                   SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_jobs,
                   SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed_jobs,
                   SUM(CASE WHEN status = 'Filled' OR status = 'Placed' THEN 1 ELSE 0 END) as filled_jobs,
                   AVG(bill_rate) as avg_bill_rate,
                   AVG(pay_rate) as avg_pay_rate,
                   MIN(date_added) as first_job,
                   MAX(date_added) as last_job
            FROM jobs
            WHERE prime_contractor IS NOT NULL
            GROUP BY prime_contractor
        """)

        perf_data = cursor.fetchall()

        for row in perf_data:
            prime, total, open_j, closed_j, filled_j, avg_bill, avg_pay, first, last = row

            # Get prime contractor ID
            cursor.execute("SELECT id FROM prime_contractors WHERE name = ?", (prime,))
            prime_row = cursor.fetchone()
            prime_id = prime_row[0] if prime_row else None

            # Calculate fill rate
            fill_rate = (filled_j / total * 100) if total > 0 else 0

            # Calculate margin
            margin = ((avg_bill - avg_pay) / avg_bill * 100) if avg_bill and avg_pay and avg_bill > 0 else 0

            cursor.execute("""
                INSERT OR REPLACE INTO past_performance
                (prime_contractor_id, prime_contractor_name, total_jobs, open_jobs, closed_jobs,
                 filled_jobs, avg_bill_rate, avg_pay_rate, avg_margin, fill_rate,
                 first_job_date, last_job_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prime_id, prime, total, open_j, closed_j, filled_j,
                avg_bill, avg_pay, margin, fill_rate, first, last
            ))

        self.conn.commit()
        print("  Past performance summary built")

    def generate_reports(self):
        """Generate summary reports."""
        print("\n" + "="*80)
        print("GENERATING REPORTS")
        print("="*80)

        cursor = self.conn.cursor()

        # Summary report
        report = {
            'run_id': self.run_id,
            'generated_at': datetime.now().isoformat(),
            'files_processed': self.stats['files_processed'],
            'duplicate_files_skipped': self.stats['duplicate_files'],
            'duplicate_file_list': self.duplicate_files,
            'totals': {
                'jobs': self.stats['total_jobs'],
                'candidates': self.stats['total_candidates'],
                'placements': self.stats['total_placements'],
                'activities': self.stats['total_activities']
            },
            'prime_contractors': list(self.stats['primes_identified']),
            'programs': list(self.stats['programs_identified'])
        }

        # Get past performance summary
        cursor.execute("""
            SELECT prime_contractor_name, total_jobs, filled_jobs, avg_bill_rate,
                   avg_pay_rate, fill_rate, first_job_date, last_job_date
            FROM past_performance
            ORDER BY total_jobs DESC
        """)
        report['past_performance'] = [
            {
                'prime': row[0],
                'total_jobs': row[1],
                'filled_jobs': row[2],
                'avg_bill_rate': row[3],
                'avg_pay_rate': row[4],
                'fill_rate': row[5],
                'first_job': row[6],
                'last_job': row[7]
            }
            for row in cursor.fetchall()
        ]

        # Save report
        report_path = OUTPUT_DIR / f"etl_report_{self.run_id}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"\nReport saved to: {report_path}")

        # Print summary
        print("\n" + "="*80)
        print("ETL SUMMARY")
        print("="*80)
        print(f"Files processed: {self.stats['files_processed']}")
        print(f"Duplicate files: {self.stats['duplicate_files']}")
        print(f"Total jobs: {self.stats['total_jobs']}")
        print(f"Total candidates: {self.stats['total_candidates']}")
        print(f"Total placements: {self.stats['total_placements']}")
        print(f"Total activities: {self.stats['total_activities']}")
        print(f"Prime contractors: {len(self.stats['primes_identified'])}")
        print(f"Programs: {len(self.stats['programs_identified'])}")
        print(f"\nDatabase: {DATABASE_PATH}")

        return report

    def run(self):
        """Run full ETL process."""
        self.initialize()
        self.process_all()
        return self.generate_reports()


# =========================================
# MAIN ENTRY POINT
# =========================================

if __name__ == "__main__":
    etl = BullhornETL()
    etl.run()
