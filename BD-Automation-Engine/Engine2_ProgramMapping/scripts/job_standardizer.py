"""
Job Standardization Engine
Transforms unstructured job posting data into standardized 11-field schema.

Based on: job-standardization-skill.md
"""

import html
import re
import json
from datetime import datetime
from typing import Dict, List, Optional, Tuple
import os

# Try to import anthropic, but make it optional for template
try:
    import anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False


# ============================================
# SCHEMA DEFINITION (20+ Field Schema)
# ============================================

# Required Fields (6) - Must be extracted from job posting
REQUIRED_FIELDS = [
    'Job Title/Position',       # Title Case, cleaned
    'Date Posted',              # YYYY-MM-DD format
    'Location',                 # "City, State" format
    'Position Overview',        # 100-200 word summary
    'Key Responsibilities',     # Array of 5-15 bullet points
    'Required Qualifications'   # Array of 5-20 bullet points
]

# Intelligence Fields (8) - Extracted for BD intelligence
INTELLIGENCE_FIELDS = [
    'Security Clearance',       # Standardized (TS/SCI w/ Poly, TS/SCI, Top Secret, Secret)
    'Program Hints',            # Extracted program names/acronyms from description
    'Client Hints',             # Agency, department, command mentions
    'Contract Vehicle Hints',   # GWAC, IDIQ, BPA mentions
    'Prime Contractor',         # Identified prime contractor
    'Recruiter Contact',        # Name, email, phone if available
    'Technologies',             # Array of tech stack mentions
    'Certifications Required'   # Array of cert requirements
]

# Optional Fields (3) - Additional info if available
OPTIONAL_FIELDS = [
    'Project Duration',         # Contract length or "Permanent"
    'Rate/Pay Rate',            # "$X/hour" or "$XXK-XXXK/year"
    'Position Details',         # 150-300 word detailed context
    'Additional Information'    # Benefits, travel, misc details
]

# Enrichment Fields (6) - Added during pipeline processing
ENRICHMENT_FIELDS = [
    'Matched Program',          # Best-matched federal program name
    'Match Confidence',         # 0.0-1.0 confidence score
    'Match Type',               # direct/fuzzy/inferred
    'BD Priority Score',        # 0-100 numeric score
    'Priority Tier',            # Hot/Warm/Cold
    'Match Signals'             # Array of signals that contributed to match
]

# Metadata Fields (4) - From raw scraper data
METADATA_FIELDS = [
    'Source',                   # Scraper source (clearancejobs, linkedin, indeed)
    'Source URL',               # Original job posting URL
    'Scraped At',               # ISO timestamp of scrape
    'Processed At'              # ISO timestamp of processing
]

# Combined field lists for different use cases
EXTRACTION_FIELDS = REQUIRED_FIELDS + INTELLIGENCE_FIELDS + OPTIONAL_FIELDS  # 18 fields for LLM extraction
ALL_FIELDS = REQUIRED_FIELDS + INTELLIGENCE_FIELDS + OPTIONAL_FIELDS + ENRICHMENT_FIELDS + METADATA_FIELDS  # 24 total fields


# ============================================
# SYSTEM PROMPT FOR LLM
# ============================================

SYSTEM_PROMPT = """You are a specialized data extraction system for defense contractor job postings. Analyze the raw job description and extract information into the standardized 11-field schema.

### EXTRACTION RULES

**Job Title/Position**
- Use Title Case (e.g., "Network Engineer" not "NETWORK ENGINEER")
- Remove HTML entities (&amp; → &)
- Remove embedded location info from title

**Date Posted**
- Convert to YYYY-MM-DD format
- If only month/year, use first day of month
- If missing, use scrape date as fallback

**Location**
- Format as "City, State" (e.g., "Herndon, VA")
- Standardize variations:
  - "100% Remote" → "Remote"
  - "Ft. Meade" → "Fort George G. Meade, MD"
  - "Washington DC Metro" → "Washington, DC"
- Preserve full military base names

**Security Clearance**
- Standardize abbreviations:
  - "TS/SCI w/ CI Poly" (with polygraph)
  - "TS/SCI" (no polygraph)
  - "Top Secret" → "Top Secret"
  - "Secret" (not "DOD Secret")
- Note if "ability to obtain" vs "active"

**Position Overview (REQUIRED)**
- 100-200 word summary
- Answer: What does this person do day-to-day?
- Extract from "Overview", "Summary", "About the Role" sections

**Position Details**
- 150-300 word detailed context
- Work environment, team structure, project scope

**Key Responsibilities (REQUIRED)**
- Array of 5-15 bullet points
- Action verb sentence fragments
- Extract from "Responsibilities", "Duties", "What You'll Do"
- Remove bullet symbols (•, -, *, ·)

**Required Qualifications (REQUIRED)**
- Array of 5-20 bullet points
- Separate from "Preferred" qualifications
- Include: clearance, education, experience, certifications, skills

**Project Duration**
- Contract length or "Permanent"
- Extract from contract type mentions

**Rate/Pay Rate**
- "$X/hour" or "$XXK-XXXK/year"
- Extract from compensation sections

**Additional Information**
- Benefits, travel requirements, misc details

### OUTPUT FORMAT
Return valid JSON matching the 11-field schema exactly. Use null for missing optional fields.
"""


# ============================================
# PREPROCESSING
# ============================================

def preprocess_job_data(raw_job: Dict) -> Dict:
    """
    Clean and normalize raw job data before LLM processing.

    Args:
        raw_job: Raw job dictionary from scraper

    Returns:
        Cleaned job dictionary
    """
    cleaned = raw_job.copy()

    # Decode HTML entities
    for key in cleaned:
        if isinstance(cleaned[key], str):
            cleaned[key] = html.unescape(cleaned[key])
            # Clean excessive whitespace
            cleaned[key] = re.sub(r'\s+', ' ', cleaned[key]).strip()
            # Remove common HTML artifacts
            cleaned[key] = re.sub(r'<[^>]+>', '', cleaned[key])

    return cleaned


def normalize_location(location: str) -> str:
    """
    Standardize location string.

    Args:
        location: Raw location string

    Returns:
        Normalized "City, State" format
    """
    location = location.strip()

    # Common standardizations
    replacements = {
        r'100%\s*Remote': 'Remote',
        r'Ft\.?\s*Meade': 'Fort George G. Meade, MD',
        r'Ft\.?\s*Belvoir': 'Fort Belvoir, VA',
        r'Ft\.?\s*Detrick': 'Fort Detrick, MD',
        r'Washington\s*,?\s*DC\s*Metro': 'Washington, DC',
        r'DC\s*Metro': 'Washington, DC',
        r'Hampton\s*Roads': 'Hampton, VA',
    }

    for pattern, replacement in replacements.items():
        location = re.sub(pattern, replacement, location, flags=re.IGNORECASE)

    return location


def normalize_clearance(clearance: str) -> str:
    """
    Standardize security clearance string.

    Args:
        clearance: Raw clearance string

    Returns:
        Standardized clearance level
    """
    clearance_lower = clearance.lower()

    # Check for polygraph variants
    if 'poly' in clearance_lower:
        if 'full' in clearance_lower or 'scope' in clearance_lower:
            return 'TS/SCI w/ Full Scope Poly'
        elif 'ci' in clearance_lower:
            return 'TS/SCI w/ CI Poly'
        else:
            return 'TS/SCI w/ Poly'

    # Check for SCI
    if 'sci' in clearance_lower:
        return 'TS/SCI'

    # Check for TS
    if 'ts' in clearance_lower or 'top secret' in clearance_lower:
        return 'Top Secret'

    # Check for Secret
    if 'secret' in clearance_lower:
        return 'Secret'

    return clearance


# ============================================
# LLM EXTRACTION
# ============================================

def standardize_job_with_llm(
    preprocessed_job: Dict,
    api_key: Optional[str] = None
) -> Dict:
    """
    Use Claude to extract standardized fields from job posting.

    Args:
        preprocessed_job: Cleaned job dictionary
        api_key: Anthropic API key (uses env var if not provided)

    Returns:
        Standardized job dictionary with 11 fields
    """
    if not HAS_ANTHROPIC:
        raise ImportError("anthropic package not installed. Run: pip install anthropic")

    api_key = api_key or os.environ.get('ANTHROPIC_API_KEY')
    if not api_key:
        raise ValueError("ANTHROPIC_API_KEY not set")

    client = anthropic.Anthropic(api_key=api_key)

    response = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[
            {"role": "user", "content": json.dumps(preprocessed_job, indent=2)}
        ]
    )

    # Parse response
    try:
        result = json.loads(response.content[0].text)
    except json.JSONDecodeError:
        # Try to extract JSON from response
        text = response.content[0].text
        json_match = re.search(r'\{.*\}', text, re.DOTALL)
        if json_match:
            result = json.loads(json_match.group())
        else:
            raise ValueError(f"Could not parse LLM response as JSON: {text[:200]}")

    return result


# ============================================
# VALIDATION
# ============================================

def validate_standardized_job(job: Dict) -> Tuple[bool, List[str]]:
    """
    Validate that standardized job has all required fields.

    Args:
        job: Standardized job dictionary

    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []

    # Check required fields
    for field in REQUIRED_FIELDS:
        if not job.get(field):
            errors.append(f"Missing required field: {field}")

    # Validate arrays
    if not isinstance(job.get('Key Responsibilities'), list):
        errors.append("Key Responsibilities must be an array")
    elif len(job.get('Key Responsibilities', [])) < 3:
        errors.append("Key Responsibilities should have at least 3 items")

    if not isinstance(job.get('Required Qualifications'), list):
        errors.append("Required Qualifications must be an array")
    elif len(job.get('Required Qualifications', [])) < 3:
        errors.append("Required Qualifications should have at least 3 items")

    # Validate date format
    if job.get('Date Posted'):
        try:
            datetime.strptime(job['Date Posted'], '%Y-%m-%d')
        except ValueError:
            errors.append("Date Posted must be YYYY-MM-DD format")

    # Validate Position Overview length
    overview = job.get('Position Overview', '')
    word_count = len(overview.split())
    if word_count < 50:
        errors.append(f"Position Overview too short ({word_count} words, need 100+)")
    elif word_count > 300:
        errors.append(f"Position Overview too long ({word_count} words, max 200)")

    return len(errors) == 0, errors


# ============================================
# BATCH PROCESSING
# ============================================

def process_job_batch(
    jobs: List[Dict],
    api_key: Optional[str] = None,
    on_progress: Optional[callable] = None
) -> List[Dict]:
    """
    Process a batch of jobs through the standardization pipeline.

    Args:
        jobs: List of raw job dictionaries
        api_key: Anthropic API key
        on_progress: Callback function(current, total, job_result)

    Returns:
        List of standardized job dictionaries with validation status
    """
    results = []
    total = len(jobs)

    for i, raw_job in enumerate(jobs):
        try:
            # Preprocess
            cleaned = preprocess_job_data(raw_job)

            # Extract with LLM
            standardized = standardize_job_with_llm(cleaned, api_key)

            # Post-process normalizations
            if standardized.get('Location'):
                standardized['Location'] = normalize_location(standardized['Location'])
            if standardized.get('Security Clearance'):
                standardized['Security Clearance'] = normalize_clearance(standardized['Security Clearance'])

            # Validate
            is_valid, errors = validate_standardized_job(standardized)

            result = {
                'original': raw_job,
                'standardized': standardized,
                'is_valid': is_valid,
                'validation_errors': errors,
                'status': 'success'
            }

        except Exception as e:
            result = {
                'original': raw_job,
                'standardized': None,
                'is_valid': False,
                'validation_errors': [str(e)],
                'status': 'error'
            }

        results.append(result)

        if on_progress:
            on_progress(i + 1, total, result)

    return results


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Standardize job postings')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file with jobs')
    parser.add_argument('--output', '-o', required=True, help='Output JSON file')
    parser.add_argument('--test', action='store_true', help='Process only first 3 jobs')

    args = parser.parse_args()

    # Load jobs
    with open(args.input, 'r') as f:
        jobs = json.load(f)

    if args.test:
        jobs = jobs[:3]
        print(f"Test mode: processing {len(jobs)} jobs")

    # Process with progress
    def show_progress(current, total, result):
        status = 'OK' if result['is_valid'] else 'ERRORS'
        title = result['original'].get('title', 'Unknown')[:50]
        print(f"[{current}/{total}] {status}: {title}")

    results = process_job_batch(jobs, on_progress=show_progress)

    # Save results
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)

    # Summary
    valid_count = sum(1 for r in results if r['is_valid'])
    print(f"\nComplete: {valid_count}/{len(results)} jobs standardized successfully")
