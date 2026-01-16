"""
PTS Past Performance Lookup - Matches jobs to PTS's historical work.

Identifies:
1. PTS Past Programs - Programs where PTS is currently involved or was a sub
2. PTS Past Contractors - Prime contractors PTS has worked with
3. PTS Past Contacts - Contacts from historical programs
"""

import os
import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Set, Tuple
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('BD-PTSPastPerf')


# ===========================================
# DATA CLASSES
# ===========================================

@dataclass
class FederalProgram:
    """Federal program data from Notion."""
    id: str
    name: str
    prime: str
    subcontractors: str
    pts_involvement: str  # Current, Target, None
    locations: str
    keywords: str
    typical_roles: str
    contract_value: str
    clearance_requirements: List[str]

    @property
    def is_pts_program(self) -> bool:
        """Check if PTS has involvement in this program."""
        if self.pts_involvement and self.pts_involvement.lower() == 'current':
            return True
        # Also check if PTS is listed as a subcontractor
        if self.subcontractors:
            subs_lower = self.subcontractors.lower()
            if any(x in subs_lower for x in ['pts', 'prime technical', 'prime tech']):
                return True
        return False

    @property
    def primes_list(self) -> List[str]:
        """Parse prime contractors to list."""
        if not self.prime:
            return []
        # Split by common delimiters
        primes = re.split(r'[;,/]', self.prime)
        return [p.strip() for p in primes if p.strip()]

    @property
    def subs_list(self) -> List[str]:
        """Parse subcontractors to list."""
        if not self.subcontractors:
            return []
        subs = re.split(r'[;,]', self.subcontractors)
        return [s.strip() for s in subs if s.strip()]


# ===========================================
# PTS PAST PERFORMANCE LOADER
# ===========================================

class PTSPastPerformanceLoader:
    """Loads PTS past performance data from Notion."""

    def __init__(self):
        self.token = os.getenv('NOTION_TOKEN')
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        }
        self.programs_db_id = os.getenv('NOTION_DB_FEDERAL_PROGRAMS')
        self.contractors_db_id = os.getenv('NOTION_DB_CONTRACTORS')

    def _extract_text(self, prop: Dict, prop_type: str = 'rich_text') -> str:
        """Extract text from Notion property."""
        if not prop:
            return ''
        if prop_type == 'title':
            items = prop.get('title', [])
        elif prop_type == 'rich_text':
            items = prop.get('rich_text', [])
        else:
            return ''
        if items:
            return items[0].get('plain_text', '')
        return ''

    def _extract_select(self, prop: Dict) -> str:
        """Extract select value."""
        if not prop:
            return ''
        select = prop.get('select')
        return select.get('name', '') if select else ''

    def _extract_multi_select(self, prop: Dict) -> List[str]:
        """Extract multi-select values."""
        if not prop:
            return []
        items = prop.get('multi_select', [])
        return [item.get('name', '') for item in items]

    def load_federal_programs(self) -> List[FederalProgram]:
        """Load all federal programs."""
        programs = []
        has_more = True
        start_cursor = None

        logger.info("Loading Federal Programs...")

        while has_more:
            url = f'https://api.notion.com/v1/databases/{self.programs_db_id}/query'
            body = {'page_size': 100}
            if start_cursor:
                body['start_cursor'] = start_cursor

            response = requests.post(url, headers=self.headers, json=body)

            if response.status_code != 200:
                logger.error(f"Failed to query programs: {response.status_code}")
                break

            data = response.json()
            results = data.get('results', [])

            for page in results:
                try:
                    props = page.get('properties', {})
                    program = FederalProgram(
                        id=page.get('id', ''),
                        name=self._extract_text(props.get('Program Name'), 'title'),
                        prime=self._extract_text(props.get('Prime Contractor Name')),
                        subcontractors=self._extract_text(props.get('Known Subcontractors')),
                        pts_involvement=self._extract_select(props.get('PTS Involvement')),
                        locations=self._extract_text(props.get('Key Locations')),
                        keywords=self._extract_text(props.get('Keywords/Signals')),
                        typical_roles=self._extract_text(props.get('Typical Roles')),
                        contract_value=self._extract_text(props.get('Contract Value')),
                        clearance_requirements=self._extract_multi_select(props.get('Clearance Requirements'))
                    )
                    if program.name:
                        programs.append(program)
                except Exception as e:
                    logger.warning(f"Failed to parse program: {e}")

            has_more = data.get('has_more', False)
            start_cursor = data.get('next_cursor')

        logger.info(f"Loaded {len(programs)} federal programs")
        return programs


# ===========================================
# PTS PAST PERFORMANCE MATCHER
# ===========================================

class PTSPastPerformanceMatcher:
    """Matches jobs to PTS past performance."""

    def __init__(self, programs: List[FederalProgram]):
        self.programs = programs
        self._build_indexes()

    def _build_indexes(self):
        """Build indexes for fast lookup."""
        # Programs where PTS is involved
        self.pts_programs = [p for p in self.programs if p.is_pts_program]

        # Prime contractors PTS has worked with
        self.pts_primes = set()
        for prog in self.pts_programs:
            for prime in prog.primes_list:
                self.pts_primes.add(prime.lower())

        # All prime contractors for general matching
        self.all_primes = {}
        for prog in self.programs:
            for prime in prog.primes_list:
                prime_lower = prime.lower()
                if prime_lower not in self.all_primes:
                    self.all_primes[prime_lower] = []
                self.all_primes[prime_lower].append(prog)

        logger.info(f"PTS Programs: {len(self.pts_programs)}")
        logger.info(f"PTS Primes worked with: {len(self.pts_primes)}")

    def find_past_performance(self, job: Dict) -> Dict:
        """Find PTS past performance relevant to a job.

        Returns dict with:
        - pts_past_programs: List of program names where PTS has been involved
        - pts_past_contractors: List of contractors PTS has worked with (that are on this job)
        - related_programs: Programs related to this job (even if not PTS programs)
        """
        result = {
            'pts_past_programs': [],
            'pts_past_contractors': [],
            'related_programs': []
        }

        job_prime = (job.get('prime', '') or '').lower()
        job_program = (job.get('task_order', '') or '').lower()
        job_location = (job.get('location', '') or '').lower()

        # Check if job's prime is one PTS has worked with
        if job_prime:
            for pts_prime in self.pts_primes:
                if self._fuzzy_match(job_prime, pts_prime):
                    result['pts_past_contractors'].append(pts_prime.title())
                    break

        # Find PTS programs related to this job
        for prog in self.pts_programs:
            score = self._score_program_match(prog, job_prime, job_program, job_location)
            if score > 0:
                result['pts_past_programs'].append(prog.name)

        # Find all related programs (for context)
        for prog in self.programs:
            if prog.name in result['pts_past_programs']:
                continue
            score = self._score_program_match(prog, job_prime, job_program, job_location)
            if score > 30:
                result['related_programs'].append(prog.name)

        # Dedupe and limit
        result['pts_past_programs'] = list(set(result['pts_past_programs']))[:5]
        result['pts_past_contractors'] = list(set(result['pts_past_contractors']))[:5]
        result['related_programs'] = list(set(result['related_programs']))[:3]

        return result

    def _fuzzy_match(self, a: str, b: str) -> bool:
        """Check if two strings fuzzy match."""
        a, b = a.lower().strip(), b.lower().strip()
        if a == b:
            return True
        if a in b or b in a:
            return True
        # Check word overlap
        a_words = set(a.split())
        b_words = set(b.split())
        overlap = a_words & b_words
        if len(overlap) >= 1 and any(len(w) > 3 for w in overlap):
            return True
        return False

    def _score_program_match(self, prog: FederalProgram, job_prime: str,
                             job_program: str, job_location: str) -> float:
        """Score how well a program matches a job."""
        score = 0.0

        # Prime contractor match
        if job_prime:
            for prime in prog.primes_list:
                if self._fuzzy_match(job_prime, prime.lower()):
                    score += 40
                    break

        # Program name match
        if job_program:
            prog_name_lower = prog.name.lower()
            if self._fuzzy_match(job_program, prog_name_lower):
                score += 50
            # Check keyword overlap
            job_words = set(job_program.split())
            prog_words = set(prog_name_lower.split())
            overlap = job_words & prog_words
            significant_overlap = [w for w in overlap if len(w) > 3]
            score += len(significant_overlap) * 10

        # Location match
        if job_location and prog.locations:
            loc_lower = prog.locations.lower()
            # Extract state from job location
            state_match = re.search(r',\s*([A-Z]{2})(?:\s|$)', job_location.upper())
            if state_match:
                state = state_match.group(1)
                if state.lower() in loc_lower:
                    score += 20

        # Keywords match
        if prog.keywords and job_program:
            keywords_lower = prog.keywords.lower()
            for word in job_program.split():
                if len(word) > 3 and word in keywords_lower:
                    score += 5

        return score


# ===========================================
# MAIN FUNCTION
# ===========================================

def find_pts_past_performance_for_jobs(jobs: List[Dict], programs: List[FederalProgram] = None) -> List[Dict]:
    """Find PTS past performance for a list of jobs.

    Updates jobs with:
    - pts_past_programs: Programs where PTS has been involved
    - pts_past_contractors: Contractors PTS has worked with
    """
    # Load programs if not provided
    if programs is None:
        loader = PTSPastPerformanceLoader()
        programs = loader.load_federal_programs()

    # Build matcher
    matcher = PTSPastPerformanceMatcher(programs)

    # Match each job
    matched_programs = 0
    matched_contractors = 0

    for i, job in enumerate(jobs):
        result = matcher.find_past_performance(job)

        # Update job
        if result['pts_past_programs']:
            job['pts_past_programs'] = ', '.join(result['pts_past_programs'])
            matched_programs += 1

        if result['pts_past_contractors']:
            job['pts_past_contractors'] = ', '.join(result['pts_past_contractors'])
            matched_contractors += 1

        if (i + 1) % 50 == 0:
            logger.info(f"Processed {i + 1}/{len(jobs)} jobs")

    logger.info(f"Jobs with PTS past programs: {matched_programs}/{len(jobs)}")
    logger.info(f"Jobs with PTS past contractors: {matched_contractors}/{len(jobs)}")

    return jobs


if __name__ == '__main__':
    import json

    # Test with enriched jobs
    with open('outputs/all_jobs_with_hiring_leaders.json', 'r') as f:
        jobs = json.load(f)

    print(f"Finding PTS past performance for {len(jobs)} jobs...")

    # Load programs
    loader = PTSPastPerformanceLoader()
    programs = loader.load_federal_programs()

    # Show PTS programs
    pts_programs = [p for p in programs if p.is_pts_program]
    print(f"\n=== PTS Programs ({len(pts_programs)}) ===")
    for p in pts_programs[:10]:
        print(f"  - {p.name} (Prime: {p.prime}, Involvement: {p.pts_involvement})")

    # Find past performance
    jobs = find_pts_past_performance_for_jobs(jobs[:20], programs)  # Test with first 20

    # Show results
    print("\n=== Sample Results ===")
    for job in jobs[:5]:
        print(f"\nJob: {job['title']}")
        print(f"  Prime: {job.get('prime')}")
        print(f"  Program: {job.get('task_order')}")
        print(f"  PTS Past Programs: {job.get('pts_past_programs', 'None')}")
        print(f"  PTS Past Contractors: {job.get('pts_past_contractors', 'None')}")
