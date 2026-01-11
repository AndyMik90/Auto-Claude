"""
Program Mapping Engine
Maps job postings to federal programs using location intelligence,
keyword matching, and multi-factor scoring.

Based on: program-mapping-skill.md
"""

import json
import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path
import os

# Try to import OpenAI for embeddings
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False


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

def extract_location_signal(job: Dict) -> Tuple[Optional[str], int]:
    """
    Extract program signal from job location.

    Args:
        job: Job dictionary with 'location' field

    Returns:
        Tuple of (program_name, score)
    """
    location = job.get('location', '') or job.get('Location', '')

    # Check exact matches
    for loc_key, program in ALL_LOCATIONS.items():
        if loc_key.lower() in location.lower():
            return program, SCORING_WEIGHTS['location_match_exact']

    return None, 0


def extract_keyword_signals(job: Dict) -> List[Tuple[str, int, str]]:
    """
    Extract program signals from job text using keywords.

    Args:
        job: Job dictionary

    Returns:
        List of (program_name, score, signal_description)
    """
    signals = []

    # Combine all text fields
    title = (job.get('title', '') or job.get('Job Title/Position', '')).lower()
    description = (job.get('description', '') or job.get('Position Overview', '')).lower()
    full_text = f"{title} {description}"

    for program, keywords in PROGRAM_KEYWORDS.items():
        for keyword in keywords:
            keyword_lower = keyword.lower()

            # Check title (highest weight)
            if keyword_lower in title:
                signals.append((
                    program,
                    SCORING_WEIGHTS['program_name_in_title'],
                    f"'{keyword}' in title"
                ))
            # Check description
            elif keyword_lower in description:
                signals.append((
                    program,
                    SCORING_WEIGHTS['program_name_in_description'],
                    f"'{keyword}' in description"
                ))

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

    # Get location signal
    loc_program, loc_score = extract_location_signal(job)
    if loc_program:
        all_signals.append(f"Location match: {loc_program}")
        program_scores[loc_program] = program_scores.get(loc_program, 0) + loc_score

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
