"""
Program Mapping Engine
Maps job postings to federal programs using location intelligence,
keyword matching, and multi-factor scoring.

Based on: program-mapping-skill.md
"""

import json
import re
from typing import Dict, List, Optional, Tuple
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

# Default path to Federal Programs CSV
DEFAULT_FEDERAL_PROGRAMS_CSV = Path(__file__).parent.parent / "data" / "Federal Programs.csv"

# Global cache for loaded programs database
_FEDERAL_PROGRAMS_CACHE: Optional[pd.DataFrame] = None

# Global cache for keyword index (keyword -> list of program names)
_KEYWORD_INDEX_CACHE: Optional[Dict[str, List[str]]] = None

# Global cache for location index (location -> list of program names)
_LOCATION_INDEX_CACHE: Optional[Dict[str, List[str]]] = None


@dataclass
class FederalProgram:
    """Represents a federal program from the database."""
    program_name: str
    acronym: str = ""
    agency_owner: str = ""
    program_type: str = ""
    key_locations: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    clearance_requirements: str = ""
    prime_contractor: str = ""
    priority_level: str = ""
    typical_roles: List[str] = field(default_factory=list)


def load_federal_programs(
    csv_path: Optional[str] = None,
    force_reload: bool = False
) -> pd.DataFrame:
    """
    Load the Federal Programs database from CSV.

    Args:
        csv_path: Path to the Federal Programs CSV file. Uses default path if None.
        force_reload: If True, reload from file even if cached.

    Returns:
        DataFrame containing federal programs data.

    Raises:
        ImportError: If pandas is not installed.
        FileNotFoundError: If the CSV file does not exist.
    """
    global _FEDERAL_PROGRAMS_CACHE

    if not HAS_PANDAS:
        raise ImportError(
            "pandas is required for loading Federal Programs database. "
            "Install with: pip install pandas"
        )

    # Return cached data if available and not forcing reload
    if _FEDERAL_PROGRAMS_CACHE is not None and not force_reload and csv_path is None:
        return _FEDERAL_PROGRAMS_CACHE

    # Determine path
    if csv_path is None:
        path = DEFAULT_FEDERAL_PROGRAMS_CSV
    else:
        path = Path(csv_path)

    if not path.exists():
        raise FileNotFoundError(f"Federal Programs CSV not found at: {path}")

    # Load CSV with proper encoding handling
    try:
        df = pd.read_csv(path, encoding='utf-8-sig')
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding='latin-1')

    # Clean column names (remove leading/trailing whitespace)
    df.columns = df.columns.str.strip()

    # Cache if using default path
    if csv_path is None:
        _FEDERAL_PROGRAMS_CACHE = df

    return df


def get_program_count(df: Optional[pd.DataFrame] = None) -> int:
    """
    Get the number of programs in the database.

    Args:
        df: Optional DataFrame. If None, loads from default path.

    Returns:
        Number of programs in the database.
    """
    if df is None:
        df = load_federal_programs()
    return len(df)


def parse_keywords_field(keywords_str: str) -> List[str]:
    """
    Parse the Keywords/Signals field from the CSV.

    The field may contain semicolon-separated values, quoted strings,
    or arrays formatted as strings.

    Args:
        keywords_str: Raw keywords string from CSV.

    Returns:
        List of individual keyword strings.
    """
    if pd.isna(keywords_str) or not keywords_str:
        return []

    keywords_str = str(keywords_str)

    # Handle quoted strings with semicolons
    keywords = []

    # Split by semicolon but respect quoted strings
    parts = re.split(r';\s*(?=(?:[^"]*"[^"]*")*[^"]*$)', keywords_str)

    for part in parts:
        # Remove surrounding quotes and whitespace
        cleaned = part.strip().strip('"').strip("'").strip()
        if cleaned:
            keywords.append(cleaned)

    return keywords


def parse_locations_field(locations_str: str) -> List[str]:
    """
    Parse the Key Locations field from the CSV.

    The field may contain semicolon-separated locations.

    Args:
        locations_str: Raw locations string from CSV.

    Returns:
        List of individual location strings.
    """
    if pd.isna(locations_str) or not locations_str:
        return []

    locations_str = str(locations_str)

    # Split by semicolons
    locations = [loc.strip() for loc in locations_str.split(';')]

    # Remove empty strings and clean up
    return [loc for loc in locations if loc]


def get_program_by_name(
    program_name: str,
    df: Optional[pd.DataFrame] = None
) -> Optional[FederalProgram]:
    """
    Get a federal program by its name.

    Args:
        program_name: Name of the program to find.
        df: Optional DataFrame. If None, loads from default path.

    Returns:
        FederalProgram object if found, None otherwise.
    """
    if df is None:
        df = load_federal_programs()

    # Case-insensitive search
    matches = df[df['Program Name'].str.lower() == program_name.lower()]

    if matches.empty:
        return None

    row = matches.iloc[0]
    return _row_to_program(row)


def get_program_by_acronym(
    acronym: str,
    df: Optional[pd.DataFrame] = None
) -> Optional[FederalProgram]:
    """
    Get a federal program by its acronym.

    Args:
        acronym: Acronym of the program to find.
        df: Optional DataFrame. If None, loads from default path.

    Returns:
        FederalProgram object if found, None otherwise.
    """
    if df is None:
        df = load_federal_programs()

    # Case-insensitive search
    if 'Acronym' not in df.columns:
        return None

    matches = df[df['Acronym'].str.lower() == acronym.lower()]

    if matches.empty:
        return None

    row = matches.iloc[0]
    return _row_to_program(row)


def _row_to_program(row: pd.Series) -> FederalProgram:
    """
    Convert a DataFrame row to a FederalProgram object.

    Args:
        row: pandas Series representing a program row.

    Returns:
        FederalProgram object.
    """
    def safe_get(col: str, default: str = "") -> str:
        val = row.get(col, default)
        return str(val) if pd.notna(val) else default

    return FederalProgram(
        program_name=safe_get('Program Name'),
        acronym=safe_get('Acronym'),
        agency_owner=safe_get('Agency Owner'),
        program_type=safe_get('Program Type'),
        key_locations=parse_locations_field(safe_get('Key Locations')),
        keywords=parse_keywords_field(safe_get('Keywords/Signals')),
        clearance_requirements=safe_get('Clearance Requirements'),
        prime_contractor=safe_get('Prime Contractor'),
        priority_level=safe_get('Priority Level'),
        typical_roles=parse_keywords_field(safe_get('Typical Roles')),
    )


def get_all_programs(df: Optional[pd.DataFrame] = None) -> List[FederalProgram]:
    """
    Get all programs from the database as FederalProgram objects.

    Args:
        df: Optional DataFrame. If None, loads from default path.

    Returns:
        List of FederalProgram objects.
    """
    if df is None:
        df = load_federal_programs()

    programs = []
    for _, row in df.iterrows():
        programs.append(_row_to_program(row))

    return programs


def build_keyword_index(df: Optional[pd.DataFrame] = None) -> Dict[str, List[str]]:
    """
    Build an index mapping keywords to program names.

    Args:
        df: Optional DataFrame. If None, loads from default path.

    Returns:
        Dict mapping lowercase keywords to list of program names.
    """
    if df is None:
        df = load_federal_programs()

    keyword_index: Dict[str, List[str]] = {}

    for _, row in df.iterrows():
        program_name = row.get('Program Name', '')
        if pd.isna(program_name) or not program_name:
            continue

        keywords_raw = row.get('Keywords/Signals', '')
        keywords = parse_keywords_field(keywords_raw)

        # Add program name itself as a keyword
        keywords.append(str(program_name))

        # Add acronym as a keyword
        acronym = row.get('Acronym', '')
        if pd.notna(acronym) and acronym:
            keywords.append(str(acronym))

        for kw in keywords:
            kw_lower = kw.lower().strip()
            if kw_lower:
                if kw_lower not in keyword_index:
                    keyword_index[kw_lower] = []
                if program_name not in keyword_index[kw_lower]:
                    keyword_index[kw_lower].append(program_name)

    return keyword_index


def get_keyword_index(force_reload: bool = False) -> Dict[str, List[str]]:
    """
    Get the keyword index, using cache if available.

    This function provides a cached keyword index for efficient lookups
    during keyword signal extraction.

    Args:
        force_reload: If True, rebuild the index from the CSV.

    Returns:
        Dict mapping lowercase keywords to list of program names.
    """
    global _KEYWORD_INDEX_CACHE

    if _KEYWORD_INDEX_CACHE is None or force_reload:
        _KEYWORD_INDEX_CACHE = build_keyword_index()

    return _KEYWORD_INDEX_CACHE


def build_location_index(df: Optional[pd.DataFrame] = None) -> Dict[str, List[str]]:
    """
    Build an index mapping locations to program names.

    Args:
        df: Optional DataFrame. If None, loads from default path.

    Returns:
        Dict mapping lowercase location strings to list of program names.
    """
    if df is None:
        df = load_federal_programs()

    location_index: Dict[str, List[str]] = {}

    for _, row in df.iterrows():
        program_name = row.get('Program Name', '')
        if pd.isna(program_name) or not program_name:
            continue

        locations_raw = row.get('Key Locations', '')
        locations = parse_locations_field(locations_raw)

        for loc in locations:
            loc_lower = loc.lower().strip()
            if loc_lower:
                if loc_lower not in location_index:
                    location_index[loc_lower] = []
                if program_name not in location_index[loc_lower]:
                    location_index[loc_lower].append(program_name)

    return location_index


def get_location_index(force_reload: bool = False) -> Dict[str, List[str]]:
    """
    Get the location index, using cache if available.

    This function provides a cached location index for efficient lookups
    during location signal extraction. It maps normalized location strings
    (city names, base names, etc.) to the programs that operate in those areas.

    Args:
        force_reload: If True, rebuild the index from the CSV.

    Returns:
        Dict mapping lowercase location strings to list of program names.
    """
    global _LOCATION_INDEX_CACHE

    if _LOCATION_INDEX_CACHE is None or force_reload:
        _LOCATION_INDEX_CACHE = build_location_index()

    return _LOCATION_INDEX_CACHE


def normalize_location_for_matching(location: str) -> str:
    """
    Normalize a location string for matching.

    Handles common variations like:
    - "Ft. Meade" -> "fort meade"
    - "AFB" -> "air force base"
    - Removes parenthetical notes

    Args:
        location: Raw location string from job posting.

    Returns:
        Normalized lowercase location string.
    """
    if not location:
        return ""

    loc = location.lower().strip()

    # Remove parenthetical notes like "(DGS-1)" or "(test & evaluation)"
    loc = re.sub(r'\([^)]*\)', '', loc).strip()

    # Normalize common abbreviations
    loc = re.sub(r'\bft\.?\s+', 'fort ', loc)
    loc = re.sub(r'\bafb\b', 'air force base', loc)
    loc = re.sub(r'\bjba\b', 'joint base andrews', loc)
    loc = re.sub(r'\bjblm\b', 'joint base lewis-mcchord', loc)
    loc = re.sub(r'\bjbsa\b', 'joint base san antonio', loc)

    return loc.strip()


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

def extract_location_signal(
    job: Dict,
    use_dynamic_locations: bool = True
) -> Tuple[Optional[str], int, List[Tuple[str, int, str]]]:
    """
    Extract program signal from job location.

    This function searches job locations against both hardcoded DCGS/IC location
    mappings and dynamic location data from the Federal Programs CSV database.

    Args:
        job: Job dictionary with 'location' field
        use_dynamic_locations: If True, also use locations from Federal Programs CSV.
                               If False or CSV unavailable, use only hardcoded locations.

    Returns:
        Tuple of (best_program_name, best_score, all_location_signals)
        - best_program_name: The highest-scoring matched program (or None)
        - best_score: The score for the best match
        - all_location_signals: List of (program_name, score, signal_description) tuples
          for all location matches found (useful for secondary candidates)
    """
    location = job.get('location', '') or job.get('Location', '')
    if not location:
        return None, 0, []

    location_lower = location.lower()
    normalized_location = normalize_location_for_matching(location)

    all_signals: List[Tuple[str, int, str]] = []
    program_scores: Dict[str, Tuple[int, str]] = {}

    # Check hardcoded DCGS/IC locations first (exact matches)
    for loc_key, program in ALL_LOCATIONS.items():
        if loc_key.lower() in location_lower:
            score = SCORING_WEIGHTS['location_match_exact']
            signal_desc = f"Location match: {loc_key} -> {program}"

            # Keep highest score per program
            if program not in program_scores or program_scores[program][0] < score:
                program_scores[program] = (score, signal_desc)

    # Try dynamic locations from Federal Programs CSV
    location_index = None
    if use_dynamic_locations and HAS_PANDAS:
        try:
            location_index = get_location_index()
        except (FileNotFoundError, ImportError):
            location_index = None

    if location_index:
        # Check for matches in the dynamic location index
        for csv_location, program_list in location_index.items():
            csv_loc_lower = csv_location.lower()

            # Skip very short location strings to avoid false positives
            if len(csv_loc_lower) < 3:
                continue

            # Try multiple matching strategies
            match_found = False
            match_type = ""

            # Strategy 1: Direct substring match
            if csv_loc_lower in location_lower or csv_loc_lower in normalized_location:
                match_found = True
                match_type = "exact"

            # Strategy 2: Location substring appears in CSV location
            # (e.g., job has "Colorado Springs" and CSV has "Colorado Springs CO")
            if not match_found:
                # Extract city/base names from job location
                for word in location_lower.split(','):
                    word = word.strip()
                    if len(word) >= 4 and word in csv_loc_lower:
                        match_found = True
                        match_type = "partial"
                        break

            # Strategy 3: State-based region matching (weaker signal)
            if not match_found:
                # Check for state abbreviations
                state_pattern = r'\b([A-Z]{2})\b'
                job_states = set(re.findall(state_pattern, location))
                csv_states = set(re.findall(state_pattern, csv_location))
                if job_states & csv_states:  # Intersection
                    match_found = True
                    match_type = "region"

            if match_found:
                # Determine score based on match type
                if match_type == "exact":
                    score = SCORING_WEIGHTS['location_match_exact']
                elif match_type == "partial":
                    score = SCORING_WEIGHTS['location_match_region'] + 5
                else:  # region
                    score = SCORING_WEIGHTS['location_match_region']

                for program_name in program_list:
                    signal_desc = f"Location match ({match_type}): {location} -> {program_name} via '{csv_location}'"

                    # Keep highest score per program
                    if program_name not in program_scores or program_scores[program_name][0] < score:
                        program_scores[program_name] = (score, signal_desc)

    # Convert to signals list
    for program_name, (score, signal_desc) in program_scores.items():
        all_signals.append((program_name, score, signal_desc))

    # Find best match
    if program_scores:
        best_program = max(program_scores.keys(), key=lambda p: program_scores[p][0])
        best_score = program_scores[best_program][0]
        return best_program, best_score, all_signals

    return None, 0, []


def extract_keyword_signals(
    job: Dict,
    use_dynamic_keywords: bool = True
) -> List[Tuple[str, int, str]]:
    """
    Extract program signals from job text using keywords.

    This function searches job titles and descriptions for keywords that map
    to federal programs. It uses the Federal Programs CSV database for dynamic
    keyword matching, with fallback to hardcoded keywords.

    Args:
        job: Job dictionary with 'title' and 'description' fields
        use_dynamic_keywords: If True, use keywords from Federal Programs CSV.
                              If False or CSV unavailable, use hardcoded keywords.

    Returns:
        List of (program_name, score, signal_description) tuples.
        - program_name: Name of the matched federal program
        - score: Weight for this signal (50 for title, 20 for description)
        - signal_description: Human-readable description of the match
    """
    signals = []

    # Combine all text fields
    title = (job.get('title', '') or job.get('Job Title/Position', '')).lower()
    description = (job.get('description', '') or job.get('Position Overview', '')).lower()
    full_text = f"{title} {description}"

    # Track matched programs to avoid duplicate signals per program
    matched_programs: Dict[str, Tuple[int, str]] = {}

    # Try to use dynamic keywords from Federal Programs CSV
    keyword_index = None
    if use_dynamic_keywords and HAS_PANDAS:
        try:
            keyword_index = get_keyword_index()
        except (FileNotFoundError, ImportError):
            keyword_index = None

    if keyword_index:
        # Use dynamic keywords from Federal Programs CSV
        for keyword, program_list in keyword_index.items():
            keyword_lower = keyword.lower()

            # Skip very short keywords to avoid false positives
            if len(keyword_lower) < 3:
                continue

            for program_name in program_list:
                # Check title (highest weight)
                if keyword_lower in title:
                    score = SCORING_WEIGHTS['program_name_in_title']
                    signal_desc = f"'{keyword}' in title"

                    # Keep only the highest-scoring signal per program
                    if program_name not in matched_programs or matched_programs[program_name][0] < score:
                        matched_programs[program_name] = (score, signal_desc)

                # Check description (lower weight)
                elif keyword_lower in description:
                    score = SCORING_WEIGHTS['program_name_in_description']
                    signal_desc = f"'{keyword}' in description"

                    # Keep only the highest-scoring signal per program
                    if program_name not in matched_programs or matched_programs[program_name][0] < score:
                        matched_programs[program_name] = (score, signal_desc)
    else:
        # Fallback to hardcoded PROGRAM_KEYWORDS
        for program, keywords in PROGRAM_KEYWORDS.items():
            for keyword in keywords:
                keyword_lower = keyword.lower()

                # Check title (highest weight)
                if keyword_lower in title:
                    score = SCORING_WEIGHTS['program_name_in_title']
                    signal_desc = f"'{keyword}' in title"

                    if program not in matched_programs or matched_programs[program][0] < score:
                        matched_programs[program] = (score, signal_desc)

                # Check description (lower weight)
                elif keyword_lower in description:
                    score = SCORING_WEIGHTS['program_name_in_description']
                    signal_desc = f"'{keyword}' in description"

                    if program not in matched_programs or matched_programs[program][0] < score:
                        matched_programs[program] = (score, signal_desc)

    # Convert matched_programs dict to signals list
    for program_name, (score, signal_desc) in matched_programs.items():
        signals.append((program_name, score, signal_desc))

    # Check for DCGS-specific keywords (always check for these)
    dcgs_keywords = ['dcgs', '480th', 'dgs-', 'distributed common ground', 'isr']
    dcgs_matched = False
    for kw in dcgs_keywords:
        if kw in full_text:
            # Only add DCGS Family signal if not already matched through dynamic keywords
            if "DCGS Family" not in matched_programs:
                signals.append((
                    "DCGS Family",
                    SCORING_WEIGHTS['dcgs_specific_keyword'],
                    f"DCGS keyword: '{kw}'"
                ))
            dcgs_matched = True
            break

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


def map_job_to_program(job: Dict) -> MappingResult:
    """
    Main function to map a job posting to a federal program.

    Args:
        job: Job dictionary (raw or standardized)

    Returns:
        MappingResult with program match details
    """
    all_signals = []
    program_scores = {}

    # Get location signals (now returns all matching programs)
    loc_program, loc_score, location_signals = extract_location_signal(job)
    for program, score, signal_desc in location_signals:
        all_signals.append(signal_desc)
        program_scores[program] = program_scores.get(program, 0) + score

    # Get keyword signals
    keyword_signals = extract_keyword_signals(job)
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
