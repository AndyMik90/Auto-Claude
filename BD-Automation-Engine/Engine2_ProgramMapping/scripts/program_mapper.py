"""
Program Mapping Engine
Maps job postings to federal programs using location intelligence,
keyword matching, and multi-factor scoring.

Integrates with Federal Programs CSV database for dynamic matching.
Based on: program-mapping-skill.md
"""

import json
import re
from typing import Dict, List, Optional, Tuple, Set
from dataclasses import dataclass, field
from pathlib import Path
import os

# Try to import pandas for CSV loading
try:
    import pandas as pd
    HAS_PANDAS = True
except ImportError:
    HAS_PANDAS = False

# Try to import OpenAI for embeddings
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


# ============================================
# FEDERAL PROGRAMS DATABASE
# ============================================

@dataclass
class FederalProgram:
    """Represents a federal program from the database."""
    name: str
    acronym: str
    agency_owner: str
    key_locations: List[str]
    keywords: List[str]
    clearance_requirements: str
    prime_contractor: str
    priority_level: str
    technical_stack: List[str]
    typical_roles: List[str]


class FederalProgramsDB:
    """
    Loads and manages the Federal Programs CSV database.
    Provides dynamic keyword and location matching.
    """

    def __init__(self, csv_path: Optional[str] = None):
        """
        Initialize the Federal Programs database.

        Args:
            csv_path: Path to Federal Programs.csv (auto-detected if not provided)
        """
        self.programs: List[FederalProgram] = []
        self._location_to_programs: Dict[str, List[str]] = {}
        self._keyword_to_programs: Dict[str, List[str]] = {}
        self._acronym_to_program: Dict[str, str] = {}

        if csv_path is None:
            # Auto-detect path relative to this file
            script_dir = Path(__file__).parent
            csv_path = script_dir.parent / "data" / "Federal Programs.csv"

        if Path(csv_path).exists():
            self._load_csv(csv_path)

    def _load_csv(self, csv_path: str) -> None:
        """Load programs from CSV file."""
        if not HAS_PANDAS:
            print("Warning: pandas not installed, Federal Programs DB not loaded")
            return

        df = pd.read_csv(csv_path, encoding='utf-8-sig')

        for _, row in df.iterrows():
            # Parse keywords from Keywords/Signals column
            keywords = self._parse_semicolon_list(row.get('Keywords/Signals', ''))

            # Parse locations from Key Locations column
            locations = self._parse_semicolon_list(row.get('Key Locations', ''))

            # Parse technical stack
            tech_stack = self._parse_semicolon_list(row.get('Technical Stack', ''))

            # Parse typical roles
            roles = self._parse_semicolon_list(row.get('Typical Roles', ''))

            program = FederalProgram(
                name=str(row.get('Program Name', '')).strip(),
                acronym=str(row.get('Acronym', '')).strip(),
                agency_owner=str(row.get('Agency Owner', '')).strip(),
                key_locations=locations,
                keywords=keywords,
                clearance_requirements=str(row.get('Clearance Requirements', '')).strip(),
                prime_contractor=str(row.get('Prime Contractor', '') or row.get('Prime Contractor 1', '')).strip(),
                priority_level=str(row.get('Priority Level', '')).strip(),
                technical_stack=tech_stack,
                typical_roles=roles,
            )

            if program.name:
                self.programs.append(program)

                # Build location index
                for loc in locations:
                    loc_key = loc.lower().strip()
                    if loc_key:
                        if loc_key not in self._location_to_programs:
                            self._location_to_programs[loc_key] = []
                        self._location_to_programs[loc_key].append(program.name)

                # Build keyword index
                for kw in keywords:
                    kw_key = kw.lower().strip()
                    if kw_key and len(kw_key) > 2:  # Skip very short keywords
                        if kw_key not in self._keyword_to_programs:
                            self._keyword_to_programs[kw_key] = []
                        self._keyword_to_programs[kw_key].append(program.name)

                # Build acronym index
                if program.acronym:
                    self._acronym_to_program[program.acronym.lower()] = program.name

    def _parse_semicolon_list(self, value: str) -> List[str]:
        """Parse a semicolon or comma separated list, cleaning up quotes and artifacts."""
        if pd.isna(value) or not value:
            return []

        value = str(value)
        # Handle both semicolon and comma separators
        items = re.split(r'[;,]', value)

        result = []
        for item in items:
            # Clean up quotes and special characters
            cleaned = re.sub(r'["""\']', '', item).strip()
            if cleaned and len(cleaned) > 1:
                result.append(cleaned)

        return result

    def get_programs_by_location(self, location: str) -> List[str]:
        """Find programs associated with a location."""
        location_lower = location.lower()
        matches = set()

        # Exact match
        if location_lower in self._location_to_programs:
            matches.update(self._location_to_programs[location_lower])

        # Partial match (location contains key or key contains location)
        for loc_key, programs in self._location_to_programs.items():
            if loc_key in location_lower or location_lower in loc_key:
                matches.update(programs)

        return list(matches)

    def get_programs_by_keyword(self, text: str) -> Dict[str, int]:
        """
        Find programs matching keywords in text.

        Returns:
            Dict mapping program name to match count
        """
        text_lower = text.lower()
        program_scores: Dict[str, int] = {}

        # Check all indexed keywords
        for keyword, programs in self._keyword_to_programs.items():
            if keyword in text_lower:
                for prog in programs:
                    program_scores[prog] = program_scores.get(prog, 0) + 1

        # Also check acronyms (higher weight)
        for acronym, program in self._acronym_to_program.items():
            # Use word boundary matching for acronyms
            if re.search(rf'\b{re.escape(acronym)}\b', text_lower):
                program_scores[program] = program_scores.get(program, 0) + 3

        return program_scores

    def get_program_by_name(self, name: str) -> Optional[FederalProgram]:
        """Get program by name or acronym."""
        name_lower = name.lower()

        # Check acronym first
        if name_lower in self._acronym_to_program:
            target_name = self._acronym_to_program[name_lower]
            for prog in self.programs:
                if prog.name == target_name:
                    return prog

        # Check by name
        for prog in self.programs:
            if prog.name.lower() == name_lower:
                return prog

        return None

    @property
    def total_programs(self) -> int:
        """Return total number of programs loaded."""
        return len(self.programs)

    @property
    def all_keywords(self) -> Set[str]:
        """Return all unique keywords."""
        return set(self._keyword_to_programs.keys())

    @property
    def all_locations(self) -> Set[str]:
        """Return all unique locations."""
        return set(self._location_to_programs.keys())


# Global database instance (lazy loaded)
_federal_programs_db: Optional[FederalProgramsDB] = None


def get_federal_programs_db(csv_path: Optional[str] = None) -> FederalProgramsDB:
    """
    Get or create the Federal Programs database instance.

    Args:
        csv_path: Optional path to CSV (uses default if not provided)

    Returns:
        FederalProgramsDB instance
    """
    global _federal_programs_db
    if _federal_programs_db is None:
        _federal_programs_db = FederalProgramsDB(csv_path)
    return _federal_programs_db


def load_federal_programs(csv_path: str) -> int:
    """
    Load Federal Programs CSV database.

    Args:
        csv_path: Path to Federal Programs.csv

    Returns:
        Number of programs loaded
    """
    global _federal_programs_db
    _federal_programs_db = FederalProgramsDB(csv_path)
    return _federal_programs_db.total_programs


# ============================================
# DCGS LOCATION MAPPING
# ============================================

DCGS_LOCATIONS = {
    # AF DCGS - PACAF (Critical Priority)
    "San Diego": "AF DCGS - PACAF",
    "La Mesa": "AF DCGS - PACAF",

    # AF DCGS - Langley (DGS-1)
    "Hampton": "AF DCGS - Langley",
    "Newport News": "AF DCGS - Langley",
    "Langley": "AF DCGS - Langley",
    "Yorktown": "AF DCGS - Langley",

    # AF DCGS - Wright-Patterson (NASIC)
    "Dayton": "AF DCGS - Wright-Patt",
    "Beavercreek": "AF DCGS - Wright-Patt",
    "Fairborn": "AF DCGS - Wright-Patt",

    # Navy DCGS-N
    "Norfolk": "Navy DCGS-N",
    "Suffolk": "Navy DCGS-N",
    "Tracy": "Navy DCGS-N",

    # Army DCGS-A
    "Fort Belvoir": "Army DCGS-A",
    "Fort Detrick": "Army DCGS-A",
    "Aberdeen": "Army DCGS-A",

    # Corporate HQ
    "Herndon": "Corporate HQ",
    "Falls Church": "Corporate HQ",
    "Reston": "Corporate HQ",
}

IC_DOD_LOCATIONS = {
    "Fort Meade": "NSA/USCYBERCOM Programs",
    "Fort George G. Meade": "NSA/USCYBERCOM Programs",
    "Colorado Springs": "Space Force/MDA Programs",
    "Tampa": "SOCOM Programs",
    "MacDill": "SOCOM Programs",
    "Springfield": "NGA Programs",
    "McLean": "IC Corporate",
    "Chantilly": "NRO/IC Programs",
}

# Combine all locations
ALL_LOCATIONS = {**DCGS_LOCATIONS, **IC_DOD_LOCATIONS}


# ============================================
# PROGRAM KEYWORDS
# ============================================

PROGRAM_KEYWORDS = {
    "AF DCGS": [
        "dcgs", "distributed common ground", "isr", "480th",
        "dgs-1", "dgs-2", "nasic", "pacaf", "beale", "langley",
        "intelligence surveillance reconnaissance"
    ],
    "Army DCGS-A": [
        "dcgs-a", "inscom", "g2", "army intelligence", "army dcgs"
    ],
    "Navy DCGS-N": [
        "dcgs-n", "n2", "naval intelligence", "navy dcgs"
    ],
    "NSA Programs": [
        "sigint", "nsa", "uscybercom", "cnss", "fort meade", "signals intelligence"
    ],
    "DIA Programs": [
        "dia", "humint", "j2", "defense intelligence"
    ],
    "NGA Programs": [
        "geoint", "nga", "imagery", "geospatial"
    ],
    "NRO Programs": [
        "nro", "reconnaissance", "satellite"
    ],
    "Space Force": [
        "ussf", "spacecom", "space force", "space delta"
    ],
}


# ============================================
# SCORING WEIGHTS
# ============================================

SCORING_WEIGHTS = {
    "program_name_in_title": 50,
    "program_name_in_description": 20,
    "acronym_match": 40,
    "location_match_exact": 20,
    "location_match_region": 10,
    "technology_keyword": 15,
    "role_type_match": 10,
    "clearance_alignment": 5,
    "clearance_mismatch": -20,
    "dcgs_specific_keyword": 10,
}


# ============================================
# DATA CLASSES
# ============================================

@dataclass
class MappingResult:
    """Result of mapping a job to a program."""
    program_name: str
    match_confidence: float
    match_type: str  # 'direct', 'fuzzy', 'inferred'
    bd_priority_score: int
    priority_tier: str  # 'Hot', 'Warm', 'Cold'
    signals: List[str]
    secondary_candidates: List[str]


# ============================================
# MATCHING FUNCTIONS
# ============================================

def extract_location_signal(job: Dict, use_federal_db: bool = True) -> Tuple[List[str], int]:
    """
    Extract program signals from job location.

    Args:
        job: Job dictionary with 'location' field
        use_federal_db: Whether to use Federal Programs CSV database

    Returns:
        Tuple of (list_of_program_names, total_score)
    """
    location = job.get('location', '') or job.get('Location', '')
    if not location:
        return [], 0

    programs_found = []
    total_score = 0

    # Check hardcoded DCGS/IC locations (high confidence)
    for loc_key, program in ALL_LOCATIONS.items():
        if loc_key.lower() in location.lower():
            programs_found.append(program)
            total_score += SCORING_WEIGHTS['location_match_exact']

    # Check Federal Programs database for additional matches
    if use_federal_db:
        db = get_federal_programs_db()
        if db.total_programs > 0:
            db_matches = db.get_programs_by_location(location)
            for prog in db_matches:
                if prog not in programs_found:
                    programs_found.append(prog)
                    total_score += SCORING_WEIGHTS['location_match_region']

    return programs_found, total_score


def extract_keyword_signals(job: Dict, use_federal_db: bool = True) -> List[Tuple[str, int, str]]:
    """
    Extract program signals from job text using keywords.
    Uses both hardcoded keywords and Federal Programs database.

    Args:
        job: Job dictionary
        use_federal_db: Whether to use Federal Programs CSV database

    Returns:
        List of (program_name, score, signal_description)
    """
    signals = []

    # Combine all text fields
    title = (job.get('title', '') or job.get('Job Title/Position', '')).lower()
    description = (job.get('description', '') or job.get('Position Overview', '')).lower()
    responsibilities = ' '.join(job.get('Key Responsibilities', []) or []).lower()
    qualifications = ' '.join(job.get('Required Qualifications', []) or []).lower()

    # Also check intelligence fields if present
    program_hints = ' '.join(job.get('Program Hints', []) or []).lower()
    client_hints = ' '.join(job.get('Client Hints', []) or []).lower()

    full_text = f"{title} {description} {responsibilities} {qualifications} {program_hints} {client_hints}"

    # Track which programs we've already scored to avoid duplicates
    scored_programs = set()

    # Check hardcoded PROGRAM_KEYWORDS (high confidence signals)
    for program, keywords in PROGRAM_KEYWORDS.items():
        for keyword in keywords:
            keyword_lower = keyword.lower()

            # Check title (highest weight)
            if keyword_lower in title:
                if program not in scored_programs:
                    signals.append((
                        program,
                        SCORING_WEIGHTS['program_name_in_title'],
                        f"'{keyword}' in title"
                    ))
                    scored_programs.add(program)
                break
            # Check description
            elif keyword_lower in description:
                if program not in scored_programs:
                    signals.append((
                        program,
                        SCORING_WEIGHTS['program_name_in_description'],
                        f"'{keyword}' in description"
                    ))
                    scored_programs.add(program)
                break

    # Check for DCGS-specific keywords
    dcgs_keywords = ['dcgs', '480th', 'dgs-', 'distributed common ground', 'isr']
    for kw in dcgs_keywords:
        if kw in full_text:
            signals.append((
                "DCGS Family",
                SCORING_WEIGHTS['dcgs_specific_keyword'],
                f"DCGS keyword: '{kw}'"
            ))
            break

    # Check Federal Programs database for dynamic keyword matching
    if use_federal_db:
        db = get_federal_programs_db()
        if db.total_programs > 0:
            # Get keyword matches from database
            db_matches = db.get_programs_by_keyword(full_text)

            # Add signals for database matches (lower weight to avoid over-scoring)
            for program_name, match_count in sorted(db_matches.items(), key=lambda x: -x[1]):
                if program_name not in scored_programs:
                    # Higher score for more keyword matches
                    score = min(match_count * 5, SCORING_WEIGHTS['technology_keyword'])
                    signals.append((
                        program_name,
                        score,
                        f"DB match ({match_count} keywords)"
                    ))
                    scored_programs.add(program_name)

    # Check Program Hints field (explicit program mentions in job)
    if program_hints:
        for hint in job.get('Program Hints', []) or []:
            db = get_federal_programs_db()
            prog = db.get_program_by_name(hint)
            if prog and prog.name not in scored_programs:
                signals.append((
                    prog.name,
                    SCORING_WEIGHTS['program_name_in_title'],  # High score for explicit mention
                    f"Explicit program hint: '{hint}'"
                ))
                scored_programs.add(prog.name)

    return signals


def calculate_match_confidence(total_score: int) -> Tuple[float, str]:
    """
    Convert raw score to confidence level and match type.

    Args:
        total_score: Sum of all signal scores

    Returns:
        Tuple of (confidence 0.0-1.0, match_type)
    """
    # Normalize score to 0-1 range (max theoretical ~150)
    confidence = min(1.0, total_score / 100)

    if confidence >= 0.70:
        return confidence, 'direct'
    elif confidence >= 0.50:
        return confidence, 'fuzzy'
    else:
        return confidence, 'inferred'


def calculate_bd_priority_score(job: Dict, match_confidence: float) -> Tuple[int, str]:
    """
    Calculate BD Priority Score (0-100) and tier.

    Args:
        job: Job dictionary
        match_confidence: Confidence from matching (0.0-1.0)

    Returns:
        Tuple of (score, tier_name)
    """
    score = 50  # Base score

    # Clearance boost (0-35)
    clearance = (job.get('clearance', '') or job.get('Security Clearance', '')).lower()
    clearance_boosts = {
        'poly': 35,
        'ts/sci': 25,
        'top secret': 15,
        'secret': 5,
    }
    for key, boost in clearance_boosts.items():
        if key in clearance:
            score += boost
            break

    # Match confidence boost (0-20)
    score += int(match_confidence * 20)

    # DCGS relevance boost (0-20)
    description = (job.get('description', '') or job.get('Position Overview', '')).lower()
    if 'dcgs' in description:
        score += 20

    # Priority location boost (0-10)
    location = (job.get('location', '') or job.get('Location', '')).lower()
    if 'san diego' in location:
        score += 10

    # Cap at 100
    score = min(score, 100)

    # Determine tier
    if score >= 80:
        tier = 'Hot'
    elif score >= 50:
        tier = 'Warm'
    else:
        tier = 'Cold'

    return score, tier


def map_job_to_program(job: Dict, use_federal_db: bool = True) -> MappingResult:
    """
    Main function to map a job posting to a federal program.

    Args:
        job: Job dictionary (raw or standardized)
        use_federal_db: Whether to use Federal Programs CSV database

    Returns:
        MappingResult with program match details
    """
    all_signals = []
    program_scores = {}

    # Get location signals (now returns list of programs)
    loc_programs, loc_score = extract_location_signal(job, use_federal_db)
    for loc_program in loc_programs:
        all_signals.append(f"Location match: {loc_program}")
        # Distribute score among matched programs
        per_program_score = loc_score // max(len(loc_programs), 1)
        program_scores[loc_program] = program_scores.get(loc_program, 0) + per_program_score

    # Get keyword signals
    keyword_signals = extract_keyword_signals(job, use_federal_db)
    for program, score, signal_desc in keyword_signals:
        all_signals.append(signal_desc)
        program_scores[program] = program_scores.get(program, 0) + score

    # Find best match
    if program_scores:
        best_program = max(program_scores, key=program_scores.get)
        best_score = program_scores[best_program]

        # Get secondary candidates
        sorted_programs = sorted(program_scores.items(), key=lambda x: x[1], reverse=True)
        secondary = [p[0] for p in sorted_programs[1:4] if p[1] > 20]
    else:
        best_program = "Unmatched"
        best_score = 0
        secondary = []

    # Calculate confidence
    confidence, match_type = calculate_match_confidence(best_score)

    # Calculate BD priority
    bd_score, tier = calculate_bd_priority_score(job, confidence)

    return MappingResult(
        program_name=best_program,
        match_confidence=confidence,
        match_type=match_type,
        bd_priority_score=bd_score,
        priority_tier=tier,
        signals=all_signals,
        secondary_candidates=secondary
    )


# ============================================
# BATCH PROCESSING
# ============================================

def process_jobs_batch(jobs: List[Dict]) -> List[Dict]:
    """
    Process a batch of jobs through the mapping engine.

    Args:
        jobs: List of job dictionaries

    Returns:
        List of enriched job dictionaries
    """
    results = []

    for job in jobs:
        result = map_job_to_program(job)

        enriched = job.copy()
        enriched['_mapping'] = {
            'program_name': result.program_name,
            'match_confidence': result.match_confidence,
            'match_type': result.match_type,
            'bd_priority_score': result.bd_priority_score,
            'priority_tier': result.priority_tier,
            'signals': result.signals,
            'secondary_candidates': result.secondary_candidates,
        }

        results.append(enriched)

    return results


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Map jobs to federal programs')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file with jobs')
    parser.add_argument('--output', '-o', required=True, help='Output JSON file')
    parser.add_argument('--test', action='store_true', help='Process only first 5 jobs')

    args = parser.parse_args()

    # Load jobs
    with open(args.input, 'r') as f:
        jobs = json.load(f)

    if args.test:
        jobs = jobs[:5]
        print(f"Test mode: processing {len(jobs)} jobs")

    # Process
    results = process_jobs_batch(jobs)

    # Save results
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)

    # Summary
    by_tier = {'Hot': 0, 'Warm': 0, 'Cold': 0}
    by_type = {'direct': 0, 'fuzzy': 0, 'inferred': 0}

    for r in results:
        mapping = r.get('_mapping', {})
        tier = mapping.get('priority_tier', 'Cold')
        mtype = mapping.get('match_type', 'inferred')
        by_tier[tier] = by_tier.get(tier, 0) + 1
        by_type[mtype] = by_type.get(mtype, 0) + 1

    print(f"\nProcessed {len(results)} jobs:")
    print(f"  By Tier: Hot={by_tier['Hot']}, Warm={by_tier['Warm']}, Cold={by_tier['Cold']}")
    print(f"  By Match: Direct={by_type['direct']}, Fuzzy={by_type['fuzzy']}, Inferred={by_type['inferred']}")
