"""
Relational Enrichment Engine - Matches jobs to Federal Programs and enriches with related data.

Uses CSV exports from Notion as data sources:
- Federal Programs: Program details, Prime contractors, locations, typical roles
- Contractors: Company information
- Program Mapping Hub: Additional mapping intelligence

Matching Strategy:
1. Location matching (city/state to Key Locations)
2. Job title matching (to Typical Roles)
3. Clearance level matching
4. Keywords/signals matching from job description
5. Prime contractor detection from job description
"""

import os
import re
import csv
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass, field
from difflib import SequenceMatcher

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('BD-RelationalEnrichment')


# ===========================================
# DATA CLASSES
# ===========================================

@dataclass
class FederalProgram:
    """Federal Program record from CSV."""
    name: str
    acronym: str
    agency: str
    prime_contractor: str
    key_locations: List[str]
    subcontractors: List[str]
    clearance_requirements: List[str]
    typical_roles: List[str]
    keywords: List[str]
    program_type: str
    contract_value: str
    priority_level: str

    # Raw data for additional matching
    raw_data: Dict = field(default_factory=dict)

    def __hash__(self):
        return hash(self.name)

    def __eq__(self, other):
        if isinstance(other, FederalProgram):
            return self.name == other.name
        return False

    def __post_init__(self):
        # Normalize lists
        if isinstance(self.key_locations, str):
            self.key_locations = [loc.strip() for loc in self.key_locations.split(';') if loc.strip()]
        if isinstance(self.subcontractors, str):
            self.subcontractors = [s.strip() for s in self.subcontractors.split(';') if s.strip()]
        if isinstance(self.clearance_requirements, str):
            self.clearance_requirements = [c.strip() for c in self.clearance_requirements.split(',') if c.strip()]
        if isinstance(self.typical_roles, str):
            self.typical_roles = [r.strip() for r in self.typical_roles.split(';') if r.strip()]
        if isinstance(self.keywords, str):
            self.keywords = [k.strip().strip('"') for k in self.keywords.split(';') if k.strip()]


@dataclass
class ProgramMatch:
    """Result of matching a job to a program."""
    program_name: str
    acronym: str
    prime_contractor: str
    subcontractors: str
    confidence: float
    match_reasons: List[str]
    task_order: Optional[str] = None
    program_type: str = ""
    agency: str = ""

    def to_dict(self) -> Dict:
        return {
            'program_name': self.program_name,
            'acronym': self.acronym,
            'prime': self.prime_contractor,
            'subcontractors': self.subcontractors,
            'confidence': self.confidence,
            'match_reasons': self.match_reasons,
            'task_order': self.task_order,
            'program_type': self.program_type,
            'agency': self.agency
        }


# ===========================================
# DATA LOADING
# ===========================================

class ProgramDatabase:
    """Manages Federal Programs data from CSV."""

    def __init__(self, csv_path: str = None):
        self.csv_path = csv_path
        self.programs: List[FederalProgram] = []
        self._location_index: Dict[str, List[FederalProgram]] = {}
        self._keyword_index: Dict[str, List[FederalProgram]] = {}
        self._prime_index: Dict[str, List[FederalProgram]] = {}

        if csv_path:
            self.load_from_csv(csv_path)

    def load_from_csv(self, csv_path: str):
        """Load programs from CSV file."""
        path = Path(csv_path)
        if not path.exists():
            raise FileNotFoundError(f"CSV not found: {csv_path}")

        self.programs = []

        with open(path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)

            for row in reader:
                try:
                    program = FederalProgram(
                        name=row.get('Program Name', '').strip(),
                        acronym=row.get('Acronym', '').strip(),
                        agency=row.get('Agency Owner', '').strip(),
                        prime_contractor=row.get('Prime Contractor', '') or row.get('Prime Contractor 1', ''),
                        key_locations=row.get('Key Locations', ''),
                        subcontractors=row.get('Key Subcontractors', '') or row.get('Known Subcontractors', ''),
                        clearance_requirements=row.get('Clearance Requirements', ''),
                        typical_roles=row.get('Typical Roles', ''),
                        keywords=row.get('Keywords/Signals', ''),
                        program_type=row.get('Program Type', '') or row.get('Program Type 1', ''),
                        contract_value=row.get('Contract Value', ''),
                        priority_level=row.get('Priority Level', ''),
                        raw_data=row
                    )

                    if program.name:  # Only add if has a name
                        self.programs.append(program)

                except Exception as e:
                    logger.warning(f"Error parsing program row: {e}")
                    continue

        logger.info(f"Loaded {len(self.programs)} federal programs")
        self._build_indexes()

    def _build_indexes(self):
        """Build indexes for fast lookup."""
        self._location_index = {}
        self._keyword_index = {}
        self._prime_index = {}

        for program in self.programs:
            # Location index
            for loc in program.key_locations:
                loc_key = self._normalize_location(loc)
                if loc_key:
                    if loc_key not in self._location_index:
                        self._location_index[loc_key] = []
                    self._location_index[loc_key].append(program)

            # Keyword index
            for keyword in program.keywords:
                kw_key = keyword.lower().strip()
                if kw_key:
                    if kw_key not in self._keyword_index:
                        self._keyword_index[kw_key] = []
                    self._keyword_index[kw_key].append(program)

            # Prime contractor index
            if program.prime_contractor:
                prime_key = program.prime_contractor.lower().strip()
                if prime_key not in self._prime_index:
                    self._prime_index[prime_key] = []
                self._prime_index[prime_key].append(program)

        logger.info(f"Built indexes: {len(self._location_index)} locations, "
                   f"{len(self._keyword_index)} keywords, {len(self._prime_index)} primes")

    def _normalize_location(self, location: str) -> str:
        """Normalize location string for matching."""
        if not location:
            return ''

        # Extract city and state
        loc = location.strip().lower()

        # Remove common suffixes
        for suffix in ['afb', 'sfb', 'base', 'arsenal', 'proving ground']:
            loc = loc.replace(suffix, '').strip()

        # Map state abbreviations
        state_map = {
            'al': 'alabama', 'az': 'arizona', 'ca': 'california', 'co': 'colorado',
            'fl': 'florida', 'ga': 'georgia', 'md': 'maryland', 'nc': 'north carolina',
            'nm': 'new mexico', 'nv': 'nevada', 'ny': 'new york', 'oh': 'ohio',
            'tx': 'texas', 'ut': 'utah', 'va': 'virginia', 'dc': 'district of columbia'
        }

        for abbr, full in state_map.items():
            if loc.endswith(f' {abbr}'):
                loc = loc[:-len(abbr)-1] + ' ' + full

        return loc.strip()

    def get_programs_by_location(self, location: str) -> List[FederalProgram]:
        """Get programs that operate in a location."""
        loc_key = self._normalize_location(location)

        matches = []
        for idx_loc, programs in self._location_index.items():
            # Check for partial match
            if loc_key in idx_loc or idx_loc in loc_key:
                matches.extend(programs)
            # Check city match
            elif loc_key.split()[0] in idx_loc or idx_loc.split()[0] in loc_key:
                matches.extend(programs)

        return list(set(matches))

    def get_programs_by_keyword(self, text: str) -> List[Tuple[FederalProgram, str]]:
        """Get programs matching keywords in text."""
        text_lower = text.lower()
        matches = []

        for keyword, programs in self._keyword_index.items():
            if keyword in text_lower:
                for p in programs:
                    matches.append((p, keyword))

        return matches

    def get_programs_by_prime(self, prime_name: str) -> List[FederalProgram]:
        """Get programs by prime contractor."""
        prime_key = prime_name.lower().strip()

        matches = []
        for idx_prime, programs in self._prime_index.items():
            if prime_key in idx_prime or idx_prime in prime_key:
                matches.extend(programs)

        return list(set(matches))


# ===========================================
# MATCHING ENGINE
# ===========================================

# Known prime contractors to detect in job descriptions
KNOWN_PRIMES = [
    'Lockheed Martin', 'Northrop Grumman', 'Raytheon', 'Boeing', 'General Dynamics',
    'BAE Systems', 'L3Harris', 'Leidos', 'SAIC', 'Booz Allen Hamilton',
    'CACI', 'ManTech', 'Peraton', 'KBR', 'Jacobs', 'Parsons',
    'GDIT', 'General Dynamics IT', 'Accenture Federal', 'Deloitte',
    'CGI Federal', 'Maximus', 'ICF', 'Guidehouse', 'MITRE',
    'Battelle', 'Dynetics', 'Sierra Nevada', 'Textron', 'Leonardo DRS'
]

# Location aliases for matching
LOCATION_ALIASES = {
    'huntsville': ['redstone', 'huntsville', 'madison'],
    'colorado springs': ['peterson', 'schriever', 'cheyenne mountain'],
    'san antonio': ['lackland', 'randolph', 'joint base san antonio'],
    'washington dc': ['pentagon', 'arlington', 'fort belvoir', 'andrews'],
    'tampa': ['macdill', 'centcom', 'socom'],
    'norfolk': ['naval station norfolk', 'little creek', 'dam neck'],
    'san diego': ['north island', 'coronado', 'point loma'],
}


class ProgramMatcher:
    """Matches jobs to federal programs using multiple signals."""

    def __init__(self, program_db: ProgramDatabase):
        self.program_db = program_db

    def match_job(self, job_title: str, location: str, clearance: str,
                  description: str, company: str = None) -> Optional[ProgramMatch]:
        """
        Match a job to the best federal program.

        Args:
            job_title: Job title
            location: Job location (city, state)
            clearance: Required clearance level
            description: Full job description
            company: Staffing company (for filtering)

        Returns:
            Best matching program or None
        """
        candidates: Dict[str, Dict] = {}  # program_name -> {program, score, reasons}

        # 1. Location matching (weight: 25)
        location_matches = self._match_by_location(location)
        for program in location_matches:
            self._add_candidate(candidates, program, 25, f"Location match: {location}")

        # 2. Detect prime contractor from description (weight: 30)
        detected_prime = self._detect_prime_in_description(description)
        if detected_prime:
            prime_matches = self.program_db.get_programs_by_prime(detected_prime)
            for program in prime_matches:
                self._add_candidate(candidates, program, 30, f"Prime detected: {detected_prime}")

        # 3. Keyword matching (weight: 20)
        keyword_matches = self.program_db.get_programs_by_keyword(description)
        for program, keyword in keyword_matches:
            self._add_candidate(candidates, program, 20, f"Keyword: {keyword}")

        # 4. Job title to typical roles matching (weight: 25)
        for program in self.program_db.programs:
            role_score = self._match_job_title_to_roles(job_title, program.typical_roles)
            if role_score > 0.4:
                weight = int(25 * role_score)
                self._add_candidate(candidates, program, weight, f"Role match ({role_score:.0%})")

        # 5. Clearance matching (weight: 10 bonus)
        if clearance:
            for program in self.program_db.programs:
                if self._clearance_matches(clearance, program.clearance_requirements):
                    if program.name in candidates:
                        candidates[program.name]['score'] += 10
                        candidates[program.name]['reasons'].append(f"Clearance match: {clearance}")

        # 6. Agency/acronym in description (weight: 15)
        for program in self.program_db.programs:
            if program.acronym and len(program.acronym) > 2:
                if re.search(rf'\b{re.escape(program.acronym)}\b', description, re.IGNORECASE):
                    self._add_candidate(candidates, program, 15, f"Acronym: {program.acronym}")

        if not candidates:
            return None

        # Find best match
        best = max(candidates.values(), key=lambda x: x['score'])
        program = best['program']

        # Calculate confidence (0-1)
        max_possible = 100  # Location + Prime + Keyword + Role + Clearance
        confidence = min(1.0, best['score'] / max_possible)

        return ProgramMatch(
            program_name=program.name,
            acronym=program.acronym,
            prime_contractor=program.prime_contractor,
            subcontractors=', '.join(program.subcontractors[:5]),
            confidence=confidence,
            match_reasons=best['reasons'],
            program_type=program.program_type,
            agency=program.agency
        )

    def _add_candidate(self, candidates: Dict, program: FederalProgram,
                       score: int, reason: str):
        """Add or update a candidate program."""
        if program.name not in candidates:
            candidates[program.name] = {
                'program': program,
                'score': 0,
                'reasons': []
            }
        candidates[program.name]['score'] += score
        candidates[program.name]['reasons'].append(reason)

    def _match_by_location(self, location: str) -> List[FederalProgram]:
        """Match programs by location with alias handling."""
        if not location:
            return []

        matches = self.program_db.get_programs_by_location(location)

        # Check aliases
        loc_lower = location.lower()
        for base_loc, aliases in LOCATION_ALIASES.items():
            if any(alias in loc_lower for alias in aliases) or base_loc in loc_lower:
                matches.extend(self.program_db.get_programs_by_location(base_loc))

        return list(set(matches))

    def _detect_prime_in_description(self, description: str) -> Optional[str]:
        """Detect prime contractor mentioned in job description."""
        desc_lower = description.lower()

        for prime in KNOWN_PRIMES:
            if prime.lower() in desc_lower:
                return prime

        return None

    def _match_job_title_to_roles(self, job_title: str, typical_roles: List[str]) -> float:
        """Calculate similarity between job title and typical roles."""
        if not typical_roles:
            return 0.0

        job_lower = job_title.lower()
        best_score = 0.0

        for role in typical_roles:
            role_lower = role.lower()

            # Direct substring match
            if job_lower in role_lower or role_lower in job_lower:
                return 0.9

            # Word overlap
            job_words = set(job_lower.split())
            role_words = set(role_lower.split())
            overlap = len(job_words & role_words)
            if overlap > 0:
                score = overlap / max(len(job_words), len(role_words))
                best_score = max(best_score, score)

            # Fuzzy match
            ratio = SequenceMatcher(None, job_lower, role_lower).ratio()
            best_score = max(best_score, ratio)

        return best_score

    def _clearance_matches(self, job_clearance: str, program_clearances: List[str]) -> bool:
        """Check if job clearance matches program requirements."""
        if not job_clearance or not program_clearances:
            return False

        job_lower = job_clearance.lower()

        for pc in program_clearances:
            pc_lower = pc.lower()

            # Direct match
            if job_lower in pc_lower or pc_lower in job_lower:
                return True

            # Level matching
            if 'ts/sci' in job_lower and 'ts/sci' in pc_lower:
                return True
            if 'top secret' in job_lower and ('ts' in pc_lower or 'top secret' in pc_lower):
                return True
            if 'secret' in job_lower and 'secret' in pc_lower:
                return True

        return False


# ===========================================
# ENRICHMENT ENGINE
# ===========================================

class RelationalEnrichmentEngine:
    """
    Enriches jobs with relational data from Federal Programs, Contacts, etc.
    """

    def __init__(self, data_dir: str = None):
        self.data_dir = data_dir or self._find_data_dir()
        self.program_db: Optional[ProgramDatabase] = None
        self.matcher: Optional[ProgramMatcher] = None
        self._loaded = False

    def _find_data_dir(self) -> str:
        """Find the data directory."""
        # Try relative paths
        candidates = [
            Path(__file__).parent.parent.parent / 'Engine2_ProgramMapping' / 'data',
            Path('Engine2_ProgramMapping/data'),
            Path('BD-Automation-Engine/Engine2_ProgramMapping/data'),
        ]

        for path in candidates:
            if path.exists():
                return str(path)

        raise FileNotFoundError("Could not find data directory")

    def load_data(self):
        """Load all data sources."""
        if self._loaded:
            return

        # Load Federal Programs
        programs_csv = Path(self.data_dir) / 'Federal ProgramsAll.csv'
        if not programs_csv.exists():
            programs_csv = Path(self.data_dir) / 'Federal Programs.csv'

        if programs_csv.exists():
            self.program_db = ProgramDatabase(str(programs_csv))
            self.matcher = ProgramMatcher(self.program_db)
            logger.info(f"Loaded {len(self.program_db.programs)} federal programs")
        else:
            logger.warning("Federal Programs CSV not found")

        self._loaded = True

    def enrich_job(self, job: Dict) -> Dict:
        """
        Enrich a single job with relational data.

        Args:
            job: Job dictionary with title, location, clearance, description

        Returns:
            Job with added relational fields
        """
        self.load_data()

        if not self.matcher:
            return job

        # Extract job fields
        title = job.get('title', job.get('jobTitle', ''))
        location = job.get('location', '')
        clearance = job.get('clearance', '')
        description = job.get('description', '')
        company = job.get('company', '')

        # Match to program
        match = self.matcher.match_job(
            job_title=title,
            location=location,
            clearance=clearance,
            description=description,
            company=company
        )

        if match:
            job['prime'] = match.prime_contractor
            job['subcontractors'] = match.subcontractors
            job['matched_program'] = match.program_name
            job['program_acronym'] = match.acronym
            job['program_type'] = match.program_type
            job['match_confidence'] = round(match.confidence, 2)
            job['match_reasons'] = match.match_reasons

            # Update status if good match
            if match.confidence >= 0.5:
                job['status'] = 'enriched'

        return job

    def enrich_jobs_batch(self, jobs: List[Dict]) -> List[Dict]:
        """Enrich a batch of jobs."""
        self.load_data()

        enriched = []
        matched_count = 0

        for i, job in enumerate(jobs):
            logger.info(f"Enriching {i+1}/{len(jobs)}: {job.get('title', 'Unknown')[:50]}")

            enriched_job = self.enrich_job(job.copy())
            enriched.append(enriched_job)

            if enriched_job.get('matched_program'):
                matched_count += 1

        logger.info(f"Matched {matched_count}/{len(jobs)} jobs to programs")
        return enriched


# ===========================================
# CLI
# ===========================================

def main():
    import argparse
    import json

    parser = argparse.ArgumentParser(description='Relational Enrichment Engine')
    parser.add_argument('--input', '-i', help='Input JSON file with jobs')
    parser.add_argument('--output', '-o', help='Output JSON file')
    parser.add_argument('--data-dir', '-d', help='Data directory with CSV files')
    parser.add_argument('--test', action='store_true', help='Test with sample job')
    parser.add_argument('--list-programs', action='store_true', help='List loaded programs')
    parser.add_argument('--limit', '-l', type=int, help='Limit jobs to process')

    args = parser.parse_args()

    # Initialize engine
    engine = RelationalEnrichmentEngine(data_dir=args.data_dir)
    engine.load_data()

    if args.list_programs:
        print(f"\nLoaded {len(engine.program_db.programs)} programs:")
        for p in engine.program_db.programs[:20]:
            print(f"  - {p.name} ({p.acronym}) | Prime: {p.prime_contractor}")
        if len(engine.program_db.programs) > 20:
            print(f"  ... and {len(engine.program_db.programs) - 20} more")
        return

    if args.test:
        # Test with sample job
        test_job = {
            'title': 'Systems Engineer',
            'location': 'Huntsville, Alabama',
            'clearance': 'Secret',
            'description': '''
                Looking for a Systems Engineer to support Army missile defense programs.
                Work with Northrop Grumman on IBCS integration. Must have experience with
                C2 systems and radar integration. Secret clearance required.
                Location: Redstone Arsenal, Huntsville AL.
            ''',
            'company': 'Insight Global'
        }

        print("\nTest Job:")
        print(f"  Title: {test_job['title']}")
        print(f"  Location: {test_job['location']}")
        print(f"  Clearance: {test_job['clearance']}")

        result = engine.enrich_job(test_job)

        print(f"\nMatch Result:")
        print(f"  Program: {result.get('matched_program', 'None')}")
        print(f"  Acronym: {result.get('program_acronym', 'None')}")
        print(f"  Prime: {result.get('prime', 'None')}")
        print(f"  Subcontractors: {result.get('subcontractors', 'None')}")
        print(f"  Confidence: {result.get('match_confidence', 0):.0%}")
        print(f"  Reasons: {result.get('match_reasons', [])}")
        return

    if args.input:
        # Process file
        with open(args.input, 'r', encoding='utf-8') as f:
            jobs = json.load(f)

        if isinstance(jobs, dict):
            jobs = [jobs]

        if args.limit:
            jobs = jobs[:args.limit]

        print(f"Processing {len(jobs)} jobs...")

        enriched = engine.enrich_jobs_batch(jobs)

        # Stats
        matched = sum(1 for j in enriched if j.get('matched_program'))
        print(f"\nResults: {matched}/{len(enriched)} matched to programs")

        if args.output:
            with open(args.output, 'w', encoding='utf-8') as f:
                json.dump(enriched, f, indent=2)
            print(f"Saved to: {args.output}")

        return

    parser.print_help()


if __name__ == '__main__':
    main()
