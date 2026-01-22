"""
Bullhorn ETL Processor v2.0
Comprehensive data extraction, transformation, and loading for all Bullhorn exports.

FILE TYPES SUPPORTED:
1. Leidos Jobs Bullhorn.txt - Newline-separated job records (11 fields per record)
2. Notes Activity Reports (8 cols) - Notes with Type, Action, About, Status, Note Body
3. Client Visits Reports (26 cols) - Salesperson/Contact activity data
4. Placements Reports (36 cols) - Placements with Company, Contact, Job, Salary, BR, PR
5. Submissions Reports (5 cols) - Job submissions
6. Notes Summary (4 cols) - Aggregated counts
"""

import os
import sys
import re
import json
import hashlib
import sqlite3
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict
import pandas as pd

# Add parent to path for imports
sys.path.insert(0, str(Path(__file__).parent))

from database_schema import create_database, get_connection, DATABASE_PATH

# =========================================
# CONFIGURATION
# =========================================

BULLHORN_EXPORTS_DIR = Path("C:/Users/gtmar/Projects/Auto-Claude/BD-Automation-Engine/docs/Bullhorn Exports")
OUTPUT_DIR = Path(__file__).parent.parent / "outputs"
STAGING_DIR = Path(__file__).parent.parent / "data" / "staging"

# Company name normalization mappings
COMPANY_NORMALIZATIONS = {
    'Leidos - ONLY ONE YOU ARE TO USE': 'Leidos',
    'Boeing - ONLY ONE YOU ARE TO USE': 'Boeing',
    'BOEING': 'Boeing',
    'LEIDOS': 'Leidos',
    'Peraton': 'Peraton',
    'SAIC': 'SAIC',
    'Raytheon': 'Raytheon',
    'Lockheed Martin': 'Lockheed Martin',
    'CACI': 'CACI',
    'ManTech': 'ManTech',
    'General Dynamics': 'General Dynamics IT',
    'Northrop Grumman': 'Northrop Grumman',
    'Booz Allen Hamilton': 'Booz Allen Hamilton',
    'Accenture Federal': 'Accenture Federal Services',
    'Jacobs': 'Jacobs',
    'KBR': 'KBR',
    'AECOM': 'AECOM',
    'LMI': 'LMI',
}

# =========================================
# UTILITY FUNCTIONS
# =========================================

def normalize_company_name(name: str) -> str:
    """Normalize company name for matching."""
    if not name:
        return ""

    # Direct mapping first
    for key, value in COMPANY_NORMALIZATIONS.items():
        if key.lower() in name.lower():
            return value

    # Clean up
    name = name.strip()
    name = re.sub(r'\s*-\s*ONLY ONE.*$', '', name, flags=re.IGNORECASE)
    name = re.sub(r'\s+', ' ', name)
    return name.strip()


def extract_job_number(text: str) -> Optional[str]:
    """Extract job number from text (e.g., #9373 or 9373)."""
    if not text:
        return None
    match = re.search(r'#?(\d{4,5})', str(text))
    return match.group(1) if match else None


def parse_currency(value) -> Optional[float]:
    """Parse currency value to float."""
    if pd.isna(value) or value == '' or value is None:
        return 0.0
    try:
        clean = re.sub(r'[$,]', '', str(value))
        return float(clean) if clean else 0.0
    except (ValueError, TypeError):
        return 0.0


def parse_date(date_val) -> Optional[datetime]:
    """Parse various date formats."""
    if pd.isna(date_val) or date_val is None:
        return None

    if isinstance(date_val, datetime):
        return date_val

    date_str = str(date_val).strip()
    if not date_str:
        return None

    date_formats = [
        '%m/%d/%Y, %I:%M %p',
        '%m/%d/%Y %I:%M %p',
        '%m/%d/%Y',
        '%Y-%m-%d %H:%M:%S',
        '%Y-%m-%d',
        '%d-%b-%Y',
        '%m-%d-%Y',
        '%m/%d/%y',
    ]

    for fmt in date_formats:
        try:
            return datetime.strptime(date_str, fmt)
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


def extract_period_from_header(text: str) -> Tuple[Optional[str], Optional[str]]:
    """Extract date period from header text like 'Period 01/01/2025 to 01/01/2026'."""
    if not text:
        return None, None
    match = re.search(r'Period\s+(\d{2}/\d{2}/\d{4})\s+to\s+(\d{2}/\d{2}/\d{4})', str(text))
    if match:
        return match.group(1), match.group(2)
    return None, None


# =========================================
# FILE TYPE PROCESSORS
# =========================================

class LeidosJobsProcessor:
    """Process Leidos Jobs Bullhorn.txt - newline-separated format."""

    FIELDS = [
        'date_added', 'title', 'owner', 'contact', 'employment_type',
        'open_closed', 'status', 'pay_rate', 'bill_rate', 'salary', 'perm_fee_percent'
    ]

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.jobs = []
        self.stats = {
            'total_lines': 0,
            'records_parsed': 0,
            'records_skipped': 0
        }

    def process(self) -> List[Dict]:
        """Process the newline-separated text file."""
        print(f"\n{'='*60}")
        print(f"Processing: {self.file_path.name}")
        print(f"Type: Leidos Jobs (newline-separated)")
        print(f"{'='*60}")

        with open(self.file_path, 'r', encoding='utf-8', errors='replace') as f:
            lines = [line.strip() for line in f.readlines()]

        self.stats['total_lines'] = len(lines)

        # Skip header lines (first 11 lines are headers)
        data_lines = lines[11:]

        # Each record is 11 consecutive lines
        num_records = len(data_lines) // 11
        print(f"Total lines: {len(lines)}")
        print(f"Expected records: {num_records}")

        for i in range(num_records):
            start_idx = i * 11
            record_lines = data_lines[start_idx:start_idx + 11]

            if len(record_lines) < 11:
                self.stats['records_skipped'] += 1
                continue

            try:
                job = self._parse_record(record_lines, i + 1)
                if job:
                    self.jobs.append(job)
                    self.stats['records_parsed'] += 1
            except Exception as e:
                self.stats['records_skipped'] += 1

        print(f"Records parsed: {self.stats['records_parsed']}")
        print(f"Records skipped: {self.stats['records_skipped']}")

        return self.jobs

    def _parse_record(self, lines: List[str], record_num: int) -> Optional[Dict]:
        """Parse a single record from 11 lines."""
        job = {
            'source_file': self.file_path.name,
            'source_record': record_num,
            'prime_contractor': 'Leidos',  # This is Leidos-specific data
        }

        for i, field in enumerate(self.FIELDS):
            value = lines[i] if i < len(lines) else None
            job[field] = value

        # Extract job number from title
        job['job_number'] = extract_job_number(job.get('title', ''))

        # Create unique ID
        job['bullhorn_job_id'] = f"LJ-{job.get('job_number', record_num)}"

        # Parse date
        job['date_added'] = parse_date(job.get('date_added'))

        # Parse currency fields
        job['pay_rate'] = parse_currency(job.get('pay_rate'))
        job['bill_rate'] = parse_currency(job.get('bill_rate'))
        job['salary'] = parse_currency(job.get('salary'))

        # Parse perm fee
        try:
            job['perm_fee_percent'] = int(job.get('perm_fee_percent', 0) or 0)
        except (ValueError, TypeError):
            job['perm_fee_percent'] = 0

        return job


class NotesProcessor:
    """Process Notes Activity Reports (8-column format)."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.notes = []
        self.contacts_mentioned = set()
        self.stats = {
            'records_parsed': 0,
            'period_start': None,
            'period_end': None
        }

    def process(self) -> List[Dict]:
        """Process notes activity report."""
        print(f"\n{'='*60}")
        print(f"Processing: {self.file_path.name}")
        print(f"Type: Notes Activity Report")
        print(f"{'='*60}")

        df = pd.read_excel(self.file_path, engine='xlrd', header=None)

        # Extract period from row 0
        period_text = str(df.iloc[0, 0]) if len(df) > 0 else ''
        self.stats['period_start'], self.stats['period_end'] = extract_period_from_header(period_text)
        print(f"Period: {self.stats['period_start']} to {self.stats['period_end']}")

        # Headers in row 2
        headers = ['department', 'note_author', 'date_added', 'type', 'note_action', 'about', 'status', 'note_body']

        # Data starts at row 3
        for idx in range(3, len(df)):
            row = df.iloc[idx]

            note = {
                'source_file': self.file_path.name,
                'source_row': idx + 1,
                'period_start': self.stats['period_start'],
                'period_end': self.stats['period_end']
            }

            for i, header in enumerate(headers):
                if i < len(row):
                    value = row.iloc[i]
                    note[header] = value if pd.notna(value) else None

            # Parse date
            note['date_added'] = parse_date(note.get('date_added'))

            # Track contacts mentioned
            about = note.get('about')
            if about and pd.notna(about):
                self.contacts_mentioned.add(str(about).strip())

            self.notes.append(note)
            self.stats['records_parsed'] += 1

        print(f"Records parsed: {self.stats['records_parsed']}")
        print(f"Unique contacts mentioned: {len(self.contacts_mentioned)}")

        return self.notes


class ClientVisitsProcessor:
    """Process Client Visits Reports (26-column format)."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.visits = []
        self.contacts = set()
        self.salespeople = set()
        self.stats = {
            'records_parsed': 0,
            'period_start': None,
            'period_end': None
        }

    def process(self) -> List[Dict]:
        """Process client visits report."""
        print(f"\n{'='*60}")
        print(f"Processing: {self.file_path.name}")
        print(f"Type: Client Visits Report")
        print(f"{'='*60}")

        df = pd.read_excel(self.file_path, engine='xlrd', header=None)

        # Extract period from row 0
        period_text = str(df.iloc[0, 0]) if len(df) > 0 else ''
        self.stats['period_start'], self.stats['period_end'] = extract_period_from_header(period_text)
        print(f"Period: {self.stats['period_start']} to {self.stats['period_end']}")

        # Headers are spread across row 2 with empty columns
        # Col 0: Department, Col 2: Salesperson, Col 4: Contact Name, Col 6: Date Added, Col 9: Status
        header_mapping = {
            0: 'department',
            2: 'salesperson',
            4: 'contact_name',
            6: 'date_added',
            9: 'status'
        }

        # Data starts at row 3
        for idx in range(3, len(df)):
            row = df.iloc[idx]

            visit = {
                'source_file': self.file_path.name,
                'source_row': idx + 1,
                'period_start': self.stats['period_start'],
                'period_end': self.stats['period_end'],
                'activity_type': 'Client Visit'
            }

            for col_idx, field_name in header_mapping.items():
                if col_idx < len(row):
                    value = row.iloc[col_idx]
                    visit[field_name] = value if pd.notna(value) else None

            # Parse date
            visit['date_added'] = parse_date(visit.get('date_added'))

            # Track contacts and salespeople
            contact = visit.get('contact_name')
            if contact and pd.notna(contact):
                self.contacts.add(str(contact).strip())

            salesperson = visit.get('salesperson')
            if salesperson and pd.notna(salesperson):
                self.salespeople.add(str(salesperson).strip())

            self.visits.append(visit)
            self.stats['records_parsed'] += 1

        print(f"Records parsed: {self.stats['records_parsed']}")
        print(f"Unique contacts: {len(self.contacts)}")
        print(f"Unique salespeople: {len(self.salespeople)}")

        return self.visits


class PlacementsProcessor:
    """Process Placements Reports (36-column format)."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.placements = []
        self.companies = set()
        self.contacts = set()
        self.stats = {
            'records_parsed': 0,
            'period_start': None,
            'period_end': None,
            'total_revenue': 0.0
        }

    def process(self) -> List[Dict]:
        """Process placements report."""
        print(f"\n{'='*60}")
        print(f"Processing: {self.file_path.name}")
        print(f"Type: Placements Report")
        print(f"{'='*60}")

        df = pd.read_excel(self.file_path, engine='xlrd', header=None)

        # Extract period from row 0 col 1
        period_text = str(df.iloc[0, 1]) if len(df) > 0 and df.shape[1] > 1 else ''
        self.stats['period_start'], self.stats['period_end'] = extract_period_from_header(period_text)
        print(f"Period: {self.stats['period_start']} to {self.stats['period_end']}")

        # Header mapping for placements (row 1)
        # Col 0: Department, 2: PlacementID, 3: Status, 4: Company, 5: Contact
        # Col 6: Reporting To, 7: Employee Type, 8: JobID, 9: Job Title
        # Col 10: Owner, 11: Recruiter, 12: Placement info, 13: Candidate
        # Col 14: Date Added, 15: Start Date, 16: End Date
        # Col 17: Salary, 18: Fee%, 19: Flat Fee, 20: BR, 21: PR, 22: Spread
        # Col 23: Unit, 24: Estimated Revenue, 25: Gross Margin

        header_mapping = {
            0: 'department',
            2: 'placement_id',
            3: 'status',
            4: 'company',
            5: 'contact',
            6: 'reporting_to',
            7: 'employee_type',
            8: 'job_id',
            9: 'job_title',
            10: 'owner',
            11: 'recruiter',
            12: 'placement_info',
            13: 'candidate',
            14: 'date_added',
            15: 'start_date',
            16: 'end_date',
            17: 'salary',
            18: 'fee_percent',
            19: 'flat_fee',
            20: 'bill_rate',
            21: 'pay_rate',
            22: 'spread',
            23: 'unit',
            24: 'estimated_revenue',
            25: 'gross_margin'
        }

        # Data starts at row 2
        for idx in range(2, len(df)):
            row = df.iloc[idx]

            placement = {
                'source_file': self.file_path.name,
                'source_row': idx + 1,
                'period_start': self.stats['period_start'],
                'period_end': self.stats['period_end']
            }

            for col_idx, field_name in header_mapping.items():
                if col_idx < len(row):
                    value = row.iloc[col_idx]
                    placement[field_name] = value if pd.notna(value) else None

            # Normalize company name
            if placement.get('company'):
                placement['company_raw'] = placement['company']
                placement['company'] = normalize_company_name(str(placement['company']))

            # Parse dates
            placement['date_added'] = parse_date(placement.get('date_added'))
            placement['start_date'] = parse_date(placement.get('start_date'))
            placement['end_date'] = parse_date(placement.get('end_date'))

            # Parse currency fields
            placement['salary'] = parse_currency(placement.get('salary'))
            placement['bill_rate'] = parse_currency(placement.get('bill_rate'))
            placement['pay_rate'] = parse_currency(placement.get('pay_rate'))
            placement['spread'] = parse_currency(placement.get('spread'))
            placement['flat_fee'] = parse_currency(placement.get('flat_fee'))
            placement['estimated_revenue'] = parse_currency(placement.get('estimated_revenue'))
            placement['gross_margin'] = parse_currency(placement.get('gross_margin'))

            # Parse fee percent
            try:
                placement['fee_percent'] = float(placement.get('fee_percent', 0) or 0)
            except (ValueError, TypeError):
                placement['fee_percent'] = 0.0

            # Extract job number
            placement['job_number'] = extract_job_number(placement.get('job_id'))

            # Create unique ID
            placement['bullhorn_placement_id'] = f"PL-{placement.get('placement_id', idx)}"

            # Track companies and contacts
            company = placement.get('company')
            if company:
                self.companies.add(company)

            contact = placement.get('contact')
            if contact and pd.notna(contact):
                self.contacts.add(str(contact).strip())

            # Track revenue
            rev = placement.get('estimated_revenue', 0) or 0
            self.stats['total_revenue'] += float(rev)

            self.placements.append(placement)
            self.stats['records_parsed'] += 1

        print(f"Records parsed: {self.stats['records_parsed']}")
        print(f"Unique companies: {len(self.companies)}")
        print(f"Companies: {sorted(self.companies)}")
        print(f"Unique contacts: {len(self.contacts)}")
        print(f"Total estimated revenue: ${self.stats['total_revenue']:,.2f}")

        return self.placements


class SubmissionsProcessor:
    """Process Submissions Reports (5-column format)."""

    def __init__(self, file_path: Path):
        self.file_path = file_path
        self.submissions = []
        self.stats = {
            'records_parsed': 0,
            'period_start': None,
            'period_end': None
        }

    def process(self) -> List[Dict]:
        """Process submissions report."""
        print(f"\n{'='*60}")
        print(f"Processing: {self.file_path.name}")
        print(f"Type: Submissions Report")
        print(f"{'='*60}")

        df = pd.read_excel(self.file_path, engine='xlrd', header=None)

        # Extract period from row 0
        period_text = str(df.iloc[0, 0]) if len(df) > 0 else ''
        self.stats['period_start'], self.stats['period_end'] = extract_period_from_header(period_text)
        print(f"Period: {self.stats['period_start']} to {self.stats['period_end']}")

        # Headers in row 2
        # Col 0: :JOBPOSTING:, Col 1: Company, Col 2: :CANDIDATE: Name, Col 3: Date Submitted, Col 4: Current Submission Status
        header_mapping = {
            0: 'job_posting',
            1: 'company',
            2: 'candidate_name',
            3: 'date_submitted',
            4: 'submission_status'
        }

        # Data starts at row 3
        for idx in range(3, len(df)):
            row = df.iloc[idx]

            submission = {
                'source_file': self.file_path.name,
                'source_row': idx + 1,
                'period_start': self.stats['period_start'],
                'period_end': self.stats['period_end']
            }

            for col_idx, field_name in header_mapping.items():
                if col_idx < len(row):
                    value = row.iloc[col_idx]
                    submission[field_name] = value if pd.notna(value) else None

            # Parse date
            submission['date_submitted'] = parse_date(submission.get('date_submitted'))

            # Normalize company
            if submission.get('company'):
                submission['company'] = normalize_company_name(str(submission['company']))

            # Extract job number
            submission['job_number'] = extract_job_number(submission.get('job_posting'))

            self.submissions.append(submission)
            self.stats['records_parsed'] += 1

        print(f"Records parsed: {self.stats['records_parsed']}")

        return self.submissions


# =========================================
# MAIN ETL ORCHESTRATOR
# =========================================

class BullhornETLv2:
    """Main ETL orchestrator v2 - handles all file formats correctly."""

    def __init__(self):
        self.conn = None
        self.run_id = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.file_hashes = {}
        self.duplicate_files = []

        # Data collections
        self.all_jobs = []
        self.all_placements = []
        self.all_notes = []
        self.all_visits = []
        self.all_submissions = []
        self.all_contacts = set()
        self.all_companies = set()

        self.stats = {
            'files_processed': 0,
            'files_skipped': 0,
            'duplicate_files': 0,
            'empty_files': 0,
            'total_jobs': 0,
            'total_placements': 0,
            'total_notes': 0,
            'total_visits': 0,
            'total_submissions': 0,
            'total_revenue': 0.0
        }

    def initialize(self):
        """Initialize database and connections."""
        print("\n" + "="*80)
        print("BULLHORN ETL PROCESSOR v2.0")
        print(f"Run ID: {self.run_id}")
        print("="*80)

        create_database()
        self.conn = get_connection()
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        STAGING_DIR.mkdir(parents=True, exist_ok=True)

    def identify_file_type(self, file_path: Path) -> str:
        """Identify file type based on structure."""
        if file_path.suffix.lower() == '.txt':
            return 'leidos_jobs'

        try:
            df = pd.read_excel(file_path, engine='xlrd', header=None)

            # Check for empty files
            if len(df) <= 1 or df.iloc[0, 0] == 'No data was returned for selected filter criteria':
                return 'empty'

            num_cols = df.shape[1]

            # Check row 1 for type indicators
            row1_text = ' '.join(str(x) for x in df.iloc[1].tolist() if pd.notna(x))

            if num_cols == 36 or ':PLACEME' in row1_text:
                return 'placements'
            elif 'Client Visits' in row1_text:
                return 'client_visits'
            elif num_cols == 5 and 'Submissions' in row1_text:
                return 'submissions'
            elif num_cols == 8:
                return 'notes'
            elif num_cols == 4:
                return 'notes_summary'
            else:
                return 'unknown'

        except Exception as e:
            print(f"Error identifying {file_path.name}: {e}")
            return 'error'

    def scan_and_dedupe_files(self) -> List[Tuple[Path, str]]:
        """Scan files and remove duplicates."""
        print(f"\nScanning directory: {BULLHORN_EXPORTS_DIR}")

        files_to_process = []
        all_files = list(BULLHORN_EXPORTS_DIR.glob('*'))
        print(f"Found {len(all_files)} files")

        for f in all_files:
            if not f.is_file():
                continue

            # Check for duplicates by hash
            file_hash = get_file_hash(f)
            if file_hash in self.file_hashes:
                self.duplicate_files.append({
                    'file': f.name,
                    'duplicate_of': self.file_hashes[file_hash]
                })
                print(f"  DUPLICATE: {f.name} == {self.file_hashes[file_hash]}")
                self.stats['duplicate_files'] += 1
                continue

            self.file_hashes[file_hash] = f.name

            # Identify file type
            file_type = self.identify_file_type(f)

            if file_type == 'empty':
                print(f"  EMPTY: {f.name}")
                self.stats['empty_files'] += 1
                continue

            if file_type == 'error':
                print(f"  ERROR: {f.name}")
                self.stats['files_skipped'] += 1
                continue

            files_to_process.append((f, file_type))

        print(f"\nFiles to process: {len(files_to_process)}")
        print(f"Duplicate files: {self.stats['duplicate_files']}")
        print(f"Empty files: {self.stats['empty_files']}")

        return files_to_process

    def process_all_files(self):
        """Process all files."""
        files = self.scan_and_dedupe_files()

        for file_path, file_type in files:
            try:
                if file_type == 'leidos_jobs':
                    processor = LeidosJobsProcessor(file_path)
                    jobs = processor.process()
                    self.all_jobs.extend(jobs)

                elif file_type == 'placements':
                    processor = PlacementsProcessor(file_path)
                    placements = processor.process()
                    self.all_placements.extend(placements)
                    self.all_companies.update(processor.companies)
                    self.all_contacts.update(processor.contacts)
                    self.stats['total_revenue'] += processor.stats['total_revenue']

                elif file_type == 'notes':
                    processor = NotesProcessor(file_path)
                    notes = processor.process()
                    self.all_notes.extend(notes)
                    self.all_contacts.update(processor.contacts_mentioned)

                elif file_type == 'client_visits':
                    processor = ClientVisitsProcessor(file_path)
                    visits = processor.process()
                    self.all_visits.extend(visits)
                    self.all_contacts.update(processor.contacts)

                elif file_type == 'submissions':
                    processor = SubmissionsProcessor(file_path)
                    submissions = processor.process()
                    self.all_submissions.extend(submissions)

                elif file_type == 'notes_summary':
                    print(f"\n{'='*60}")
                    print(f"Skipping notes summary: {file_path.name}")
                    print(f"{'='*60}")
                    continue

                else:
                    print(f"\n{'='*60}")
                    print(f"Unknown file type: {file_path.name}")
                    print(f"{'='*60}")
                    continue

                self.stats['files_processed'] += 1

            except Exception as e:
                print(f"ERROR processing {file_path.name}: {e}")
                self.stats['files_skipped'] += 1

        # Update stats
        self.stats['total_jobs'] = len(self.all_jobs)
        self.stats['total_placements'] = len(self.all_placements)
        self.stats['total_notes'] = len(self.all_notes)
        self.stats['total_visits'] = len(self.all_visits)
        self.stats['total_submissions'] = len(self.all_submissions)

    def load_to_database(self):
        """Load all processed data to database."""
        print("\n" + "="*80)
        print("LOADING DATA TO DATABASE")
        print("="*80)

        cursor = self.conn.cursor()

        # Load Jobs
        print(f"\nLoading {len(self.all_jobs)} jobs...")
        inserted_jobs = 0
        for job in self.all_jobs:
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO jobs
                    (bullhorn_job_id, job_number, title, prime_contractor, employment_type,
                     status, pay_rate, bill_rate, salary, perm_fee_percent, owner, contact,
                     date_added, source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    job.get('bullhorn_job_id'),
                    job.get('job_number'),
                    job.get('title'),
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
                inserted_jobs += 1
            except Exception as e:
                pass
        print(f"  Inserted: {inserted_jobs}")

        # Load Placements
        print(f"\nLoading {len(self.all_placements)} placements...")
        inserted_placements = 0
        for plc in self.all_placements:
            try:
                cursor.execute("""
                    INSERT OR IGNORE INTO placements
                    (bullhorn_placement_id, bullhorn_job_id, status, client_name, job_title,
                     candidate_name, owner, start_date, end_date, salary, pay_rate, bill_rate,
                     source_file)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    plc.get('bullhorn_placement_id'),
                    plc.get('job_number'),
                    plc.get('status'),
                    plc.get('company'),
                    plc.get('job_title'),
                    plc.get('candidate'),
                    plc.get('owner'),
                    plc.get('start_date'),
                    plc.get('end_date'),
                    plc.get('salary'),
                    plc.get('pay_rate'),
                    plc.get('bill_rate'),
                    plc.get('source_file')
                ))
                inserted_placements += 1
            except Exception as e:
                pass
        print(f"  Inserted: {inserted_placements}")

        # Load Activities (Notes + Visits)
        print(f"\nLoading {len(self.all_notes) + len(self.all_visits)} activities...")
        inserted_activities = 0

        for note in self.all_notes:
            try:
                cursor.execute("""
                    INSERT INTO activities
                    (activity_type, action, activity_date, actor, note_text, source_file)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (
                    note.get('type'),
                    note.get('note_action'),
                    note.get('date_added'),
                    note.get('note_author'),
                    note.get('note_body'),
                    note.get('source_file')
                ))
                inserted_activities += 1
            except Exception as e:
                pass

        for visit in self.all_visits:
            try:
                cursor.execute("""
                    INSERT INTO activities
                    (activity_type, activity_date, actor, note_text, source_file)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    'Client Visit',
                    visit.get('date_added'),
                    visit.get('salesperson'),
                    f"Contact: {visit.get('contact_name')}",
                    visit.get('source_file')
                ))
                inserted_activities += 1
            except Exception as e:
                pass

        print(f"  Inserted: {inserted_activities}")

        # Build Prime Contractors
        print("\nBuilding Prime Contractors...")
        for company in self.all_companies:
            if company:
                try:
                    cursor.execute("""
                        INSERT OR IGNORE INTO prime_contractors (name, normalized_name)
                        VALUES (?, ?)
                    """, (company, company.lower()))
                except Exception:
                    pass

        # Also add Leidos (from jobs)
        cursor.execute("""
            INSERT OR IGNORE INTO prime_contractors (name, normalized_name)
            VALUES ('Leidos', 'leidos')
        """)

        # Count jobs per prime
        cursor.execute("""
            UPDATE prime_contractors
            SET total_jobs = (
                SELECT COUNT(*) FROM jobs WHERE prime_contractor = prime_contractors.name
            )
        """)

        # Count placements per prime
        cursor.execute("""
            UPDATE prime_contractors
            SET total_placements = (
                SELECT COUNT(*) FROM placements WHERE client_name = prime_contractors.name
            )
        """)

        self.conn.commit()

        # Get final counts
        cursor.execute("SELECT COUNT(*) FROM prime_contractors")
        prime_count = cursor.fetchone()[0]
        print(f"  Prime contractors: {prime_count}")

    def build_past_performance(self):
        """Build past performance summary."""
        print("\nBuilding Past Performance Summary...")
        cursor = self.conn.cursor()

        # Get all prime contractors
        cursor.execute("SELECT id, name FROM prime_contractors")
        primes = cursor.fetchall()

        for prime_id, prime_name in primes:
            # Get job stats
            cursor.execute("""
                SELECT
                    COUNT(*) as total_jobs,
                    SUM(CASE WHEN status = 'Open' THEN 1 ELSE 0 END) as open_jobs,
                    SUM(CASE WHEN status = 'Closed' THEN 1 ELSE 0 END) as closed_jobs,
                    SUM(CASE WHEN status IN ('Filled', 'Placed') THEN 1 ELSE 0 END) as filled_jobs,
                    AVG(bill_rate) as avg_bill_rate,
                    AVG(pay_rate) as avg_pay_rate,
                    MIN(date_added) as first_job,
                    MAX(date_added) as last_job
                FROM jobs
                WHERE prime_contractor = ?
            """, (prime_name,))
            job_stats = cursor.fetchone()

            # Get placement stats
            cursor.execute("""
                SELECT
                    COUNT(*) as total_placements,
                    AVG(bill_rate) as avg_bill_rate,
                    AVG(pay_rate) as avg_pay_rate,
                    MIN(start_date) as first_placement,
                    MAX(start_date) as last_placement
                FROM placements
                WHERE client_name = ?
            """, (prime_name,))
            placement_stats = cursor.fetchone()

            # Calculate fill rate
            total_jobs = job_stats[0] or 0
            filled_jobs = job_stats[3] or 0
            fill_rate = (filled_jobs / total_jobs * 100) if total_jobs > 0 else 0

            # Calculate margin
            avg_bill = job_stats[4] or 0
            avg_pay = job_stats[5] or 0
            margin = ((avg_bill - avg_pay) / avg_bill * 100) if avg_bill > 0 else 0

            # Insert/update past performance
            cursor.execute("""
                INSERT OR REPLACE INTO past_performance
                (prime_contractor_id, prime_contractor_name, total_jobs, open_jobs,
                 closed_jobs, filled_jobs, total_placements, avg_bill_rate, avg_pay_rate,
                 avg_margin, fill_rate, first_job_date, last_job_date,
                 first_placement_date, last_placement_date)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (
                prime_id,
                prime_name,
                job_stats[0] or 0,
                job_stats[1] or 0,
                job_stats[2] or 0,
                job_stats[3] or 0,
                placement_stats[0] or 0,
                avg_bill,
                avg_pay,
                margin,
                fill_rate,
                job_stats[6],
                job_stats[7],
                placement_stats[3],
                placement_stats[4]
            ))

        self.conn.commit()
        print("  Past performance summary built")

    def build_contacts_database(self):
        """Build comprehensive contacts database."""
        print("\nBuilding Contacts Database...")
        cursor = self.conn.cursor()

        # Extract contacts from placements
        for plc in self.all_placements:
            contact_name = plc.get('contact')
            candidate_name = plc.get('candidate')
            company = plc.get('company')

            for name in [contact_name, candidate_name]:
                if name and pd.notna(name):
                    name_str = str(name).strip()
                    if name_str:
                        # Parse name
                        parts = name_str.split()
                        first_name = parts[0] if parts else ''
                        last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

                        try:
                            cursor.execute("""
                                INSERT OR IGNORE INTO candidates
                                (full_name, first_name, last_name, company_name, source_file)
                                VALUES (?, ?, ?, ?, ?)
                            """, (name_str, first_name, last_name, company, plc.get('source_file')))
                        except Exception:
                            pass

        # Extract contacts from notes
        for note in self.all_notes:
            about = note.get('about')
            if about and pd.notna(about):
                name_str = str(about).strip()
                if name_str:
                    parts = name_str.split()
                    first_name = parts[0] if parts else ''
                    last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

                    try:
                        cursor.execute("""
                            INSERT OR IGNORE INTO candidates
                            (full_name, first_name, last_name, source_file)
                            VALUES (?, ?, ?, ?)
                        """, (name_str, first_name, last_name, note.get('source_file')))
                    except Exception:
                        pass

        # Extract contacts from visits
        for visit in self.all_visits:
            contact_name = visit.get('contact_name')
            if contact_name and pd.notna(contact_name):
                name_str = str(contact_name).strip()
                if name_str:
                    parts = name_str.split()
                    first_name = parts[0] if parts else ''
                    last_name = ' '.join(parts[1:]) if len(parts) > 1 else ''

                    try:
                        cursor.execute("""
                            INSERT OR IGNORE INTO candidates
                            (full_name, first_name, last_name, source_file)
                            VALUES (?, ?, ?, ?)
                        """, (name_str, first_name, last_name, visit.get('source_file')))
                    except Exception:
                        pass

        self.conn.commit()

        cursor.execute("SELECT COUNT(*) FROM candidates")
        contact_count = cursor.fetchone()[0]
        print(f"  Contacts loaded: {contact_count}")

    def generate_reports(self):
        """Generate comprehensive reports."""
        print("\n" + "="*80)
        print("GENERATING REPORTS")
        print("="*80)

        cursor = self.conn.cursor()

        # Build comprehensive report
        report = {
            'run_id': self.run_id,
            'generated_at': datetime.now().isoformat(),
            'summary': {
                'files_processed': self.stats['files_processed'],
                'duplicate_files': self.stats['duplicate_files'],
                'empty_files': self.stats['empty_files'],
                'files_skipped': self.stats['files_skipped']
            },
            'data_counts': {
                'jobs': self.stats['total_jobs'],
                'placements': self.stats['total_placements'],
                'notes': self.stats['total_notes'],
                'client_visits': self.stats['total_visits'],
                'submissions': self.stats['total_submissions'],
                'total_activities': self.stats['total_notes'] + self.stats['total_visits']
            },
            'financial': {
                'total_estimated_revenue': self.stats['total_revenue']
            },
            'entities': {
                'unique_companies': list(self.all_companies),
                'unique_contacts_count': len(self.all_contacts)
            },
            'duplicate_files_detail': self.duplicate_files
        }

        # Get past performance summary
        cursor.execute("""
            SELECT prime_contractor_name, total_jobs, filled_jobs, total_placements,
                   avg_bill_rate, avg_pay_rate, avg_margin, fill_rate,
                   first_job_date, last_job_date
            FROM past_performance
            ORDER BY total_jobs DESC
        """)

        report['past_performance'] = []
        for row in cursor.fetchall():
            report['past_performance'].append({
                'prime_contractor': row[0],
                'total_jobs': row[1],
                'filled_jobs': row[2],
                'total_placements': row[3],
                'avg_bill_rate': round(row[4], 2) if row[4] else 0,
                'avg_pay_rate': round(row[5], 2) if row[5] else 0,
                'avg_margin_percent': round(row[6], 2) if row[6] else 0,
                'fill_rate_percent': round(row[7], 2) if row[7] else 0,
                'first_job': str(row[8]) if row[8] else None,
                'last_job': str(row[9]) if row[9] else None
            })

        # Get contact count
        cursor.execute("SELECT COUNT(*) FROM candidates")
        report['entities']['contacts_in_database'] = cursor.fetchone()[0]

        # Save report
        report_path = OUTPUT_DIR / f"etl_report_v2_{self.run_id}.json"
        with open(report_path, 'w') as f:
            json.dump(report, f, indent=2, default=str)

        print(f"\nReport saved to: {report_path}")

        # Print summary
        print("\n" + "="*80)
        print("ETL SUMMARY")
        print("="*80)
        print(f"Files processed: {self.stats['files_processed']}")
        print(f"Duplicate files: {self.stats['duplicate_files']}")
        print(f"Empty files: {self.stats['empty_files']}")
        print(f"\nData extracted:")
        print(f"  Jobs: {self.stats['total_jobs']}")
        print(f"  Placements: {self.stats['total_placements']}")
        print(f"  Notes: {self.stats['total_notes']}")
        print(f"  Client Visits: {self.stats['total_visits']}")
        print(f"  Submissions: {self.stats['total_submissions']}")
        print(f"\nCompanies: {list(self.all_companies)}")
        print(f"Unique contacts: {len(self.all_contacts)}")
        print(f"Total estimated revenue: ${self.stats['total_revenue']:,.2f}")
        print(f"\nDatabase: {DATABASE_PATH}")

        # Print past performance
        print("\n" + "="*80)
        print("PAST PERFORMANCE BY PRIME CONTRACTOR")
        print("="*80)
        for perf in report['past_performance']:
            print(f"\n{perf['prime_contractor']}:")
            print(f"  Jobs: {perf['total_jobs']} (Filled: {perf['filled_jobs']}, Fill Rate: {perf['fill_rate_percent']}%)")
            print(f"  Placements: {perf['total_placements']}")
            print(f"  Avg Bill Rate: ${perf['avg_bill_rate']}/hr, Avg Pay Rate: ${perf['avg_pay_rate']}/hr")
            print(f"  Avg Margin: {perf['avg_margin_percent']}%")
            print(f"  Date Range: {perf['first_job'] or 'N/A'} to {perf['last_job'] or 'N/A'}")

        return report

    def run(self):
        """Run the complete ETL process."""
        self.initialize()
        self.process_all_files()
        self.load_to_database()
        self.build_contacts_database()
        self.build_past_performance()
        return self.generate_reports()


# =========================================
# MAIN ENTRY POINT
# =========================================

if __name__ == "__main__":
    etl = BullhornETLv2()
    etl.run()
