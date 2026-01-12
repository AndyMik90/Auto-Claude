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
# SCHEMA DEFINITION (Expanded 28-Field Schema)
# ============================================

# Core fields from original 11-field schema
REQUIRED_FIELDS = [
    'Job Title/Position',
    'Date Posted',
    'Location',
    'Position Overview',
    'Key Responsibilities',
    'Required Qualifications'
]

OPTIONAL_FIELDS = [
    'Project Duration',
    'Rate/Pay Rate',
    'Security Clearance',
    'Position Details',
    'Additional Information'
]

# Intelligence fields extracted from job text for program mapping
INTELLIGENCE_FIELDS = [
    'Program Hints',           # Explicit program/contract mentions (e.g., "DCGS", "ABMS")
    'Client Hints',            # Agency/organization clues (e.g., "Air Force", "NSA")
    'Contract Vehicle Hints',  # Contract vehicle mentions (e.g., "ITES-3S", "RS3")
    'Prime Contractor',        # Company name if identifiable
    'Recruiter Contact',       # Recruiter name/email/phone
    'Technologies',            # Technical stack (e.g., ["Python", "AWS", "Kubernetes"])
    'Certifications Required', # Required certs (e.g., ["Security+", "CISSP"])
    'Clearance Level Parsed',  # Normalized clearance (e.g., "TS/SCI w/ CI Poly")
]

# Enrichment fields added during pipeline processing
ENRICHMENT_FIELDS = [
    'Matched Program',         # Best-match program from Federal Programs DB
    'Match Confidence',        # Confidence score 0.0-1.0
    'Match Type',              # 'direct', 'fuzzy', or 'inferred'
    'BD Priority Score',       # 0-100 score for prioritization
    'Priority Tier',           # 'Hot', 'Warm', or 'Cold'
    'Secondary Programs',      # Alternative program matches
]

# Metadata fields for tracking
METADATA_FIELDS = [
    'Source URL',              # Original job posting URL
    'Scrape Date',             # When the job was scraped
    'Processing Date',         # When standardization occurred
    'Validation Status',       # 'valid', 'partial', 'invalid'
]

# Fields used for LLM extraction (excludes enrichment/metadata)
EXTRACTION_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS + INTELLIGENCE_FIELDS

# All fields in the complete schema
ALL_FIELDS = REQUIRED_FIELDS + OPTIONAL_FIELDS + INTELLIGENCE_FIELDS + ENRICHMENT_FIELDS + METADATA_FIELDS


# ============================================
# SYSTEM PROMPT FOR LLM
# ============================================

SYSTEM_PROMPT = """You are a specialized data extraction system for defense contractor job postings. Analyze the raw job description and extract information into the standardized 19-field schema (11 core + 8 intelligence fields).

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

### INTELLIGENCE FIELDS (For Program Mapping)

**Program Hints**
- Extract explicit program/contract names mentioned (e.g., "DCGS", "ABMS", "Platform One")
- Look for acronyms and full program names
- Return as array of strings, empty array if none found

**Client Hints**
- Extract agency/organization clues (e.g., "Air Force", "NSA", "Army INSCOM", "16th AF")
- Look for DoD branches, IC agencies, commands, specific units
- Return as array of strings

**Contract Vehicle Hints**
- Extract contract vehicle mentions (e.g., "ITES-3S", "RS3", "IDIQ", "BPA")
- Common vehicles: SEWP, STARS, GSA Schedule, 8(a), OASIS
- Return as array of strings

**Prime Contractor**
- If the posting identifies the company, extract the prime contractor name
- Common primes: SAIC, Leidos, Booz Allen, CACI, Northrop Grumman, Raytheon, Lockheed Martin
- Return as string or null

**Recruiter Contact**
- Extract recruiter name, email, or phone if present
- Format: {"name": "...", "email": "...", "phone": "..."} or null
- Return object with available fields

**Technologies**
- Extract technical stack mentioned (programming languages, tools, platforms)
- Examples: Python, Java, AWS, Azure, Kubernetes, Splunk, ServiceNow
- Return as array of strings

**Certifications Required**
- Extract certification requirements separately from general qualifications
- Common: Security+, CISSP, CEH, AWS Certified, PMP, ITIL, CompTIA
- Return as array of strings

**Clearance Level Parsed**
- Normalized clearance level for machine processing
- Use exact values: "Public Trust", "Secret", "Top Secret", "TS/SCI", "TS/SCI w/ Poly", "TS/SCI w/ CI Poly", "TS/SCI w/ Full Scope Poly"
- Include note if "ability to obtain" vs "active required"
- Return as string

### OUTPUT FORMAT
Return valid JSON matching the 19-field schema. Use null for missing optional fields, empty arrays [] for list fields with no values.

Example structure:
{
  "Job Title/Position": "...",
  "Date Posted": "YYYY-MM-DD",
  "Location": "City, State",
  "Position Overview": "...",
  "Key Responsibilities": ["...", "..."],
  "Required Qualifications": ["...", "..."],
  "Project Duration": "..." or null,
  "Rate/Pay Rate": "..." or null,
  "Security Clearance": "..." or null,
  "Position Details": "..." or null,
  "Additional Information": "..." or null,
  "Program Hints": ["...", "..."],
  "Client Hints": ["...", "..."],
  "Contract Vehicle Hints": [],
  "Prime Contractor": "..." or null,
  "Recruiter Contact": {"name": "...", "email": "..."} or null,
  "Technologies": ["...", "..."],
  "Certifications Required": ["...", "..."],
  "Clearance Level Parsed": "..."
}
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

# Valid clearance levels for validation
VALID_CLEARANCE_LEVELS = [
    'Public Trust',
    'Secret',
    'Top Secret',
    'TS/SCI',
    'TS/SCI w/ Poly',
    'TS/SCI w/ CI Poly',
    'TS/SCI w/ Full Scope Poly',
]


def validate_standardized_job(job: Dict, strict: bool = False) -> Tuple[bool, List[str]]:
    """
    Validate that standardized job has all required fields and valid intelligence fields.

    Args:
        job: Standardized job dictionary
        strict: If True, validate intelligence fields strictly (default False for backwards compat)

    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []
    warnings = []

    # Check required fields
    for field in REQUIRED_FIELDS:
        if not job.get(field):
            errors.append(f"Missing required field: {field}")

    # Validate arrays (core fields)
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
    if overview:
        word_count = len(overview.split())
        if word_count < 50:
            warnings.append(f"Position Overview short ({word_count} words, prefer 100+)")
        elif word_count > 300:
            warnings.append(f"Position Overview long ({word_count} words, prefer max 200)")

    # ============================================
    # INTELLIGENCE FIELDS VALIDATION
    # ============================================

    # Validate array intelligence fields (should be lists, can be empty)
    array_intel_fields = [
        'Program Hints',
        'Client Hints',
        'Contract Vehicle Hints',
        'Technologies',
        'Certifications Required',
    ]

    for field in array_intel_fields:
        value = job.get(field)
        if value is not None and not isinstance(value, list):
            if strict:
                errors.append(f"{field} must be an array (got {type(value).__name__})")
            else:
                warnings.append(f"{field} should be an array")

    # Validate Clearance Level Parsed (if present, must be valid)
    clearance_parsed = job.get('Clearance Level Parsed')
    if clearance_parsed:
        # Extract base clearance level (before any notes about "ability to obtain")
        base_clearance = clearance_parsed.split(' - ')[0].strip()
        if base_clearance not in VALID_CLEARANCE_LEVELS:
            warnings.append(f"Non-standard clearance level: {clearance_parsed}")

    # Validate Recruiter Contact structure
    recruiter = job.get('Recruiter Contact')
    if recruiter is not None:
        if not isinstance(recruiter, dict):
            if strict:
                errors.append("Recruiter Contact must be an object with name/email/phone fields")
        else:
            valid_keys = {'name', 'email', 'phone'}
            extra_keys = set(recruiter.keys()) - valid_keys
            if extra_keys:
                warnings.append(f"Recruiter Contact has unexpected keys: {extra_keys}")

    # Validate Prime Contractor (string or null)
    prime = job.get('Prime Contractor')
    if prime is not None and not isinstance(prime, str):
        if strict:
            errors.append("Prime Contractor must be a string or null")

    # ============================================
    # ENRICHMENT FIELDS VALIDATION (if present)
    # ============================================

    # Match Confidence must be 0.0-1.0
    confidence = job.get('Match Confidence')
    if confidence is not None:
        if not isinstance(confidence, (int, float)) or not (0.0 <= confidence <= 1.0):
            errors.append("Match Confidence must be a number between 0.0 and 1.0")

    # BD Priority Score must be 0-100
    bd_score = job.get('BD Priority Score')
    if bd_score is not None:
        if not isinstance(bd_score, (int, float)) or not (0 <= bd_score <= 100):
            errors.append("BD Priority Score must be a number between 0 and 100")

    # Priority Tier must be valid
    tier = job.get('Priority Tier')
    if tier is not None and tier not in ['Hot', 'Warm', 'Cold']:
        errors.append("Priority Tier must be 'Hot', 'Warm', or 'Cold'")

    # Match Type must be valid
    match_type = job.get('Match Type')
    if match_type is not None and match_type not in ['direct', 'fuzzy', 'inferred']:
        errors.append("Match Type must be 'direct', 'fuzzy', or 'inferred'")

    return len(errors) == 0, errors


def get_validation_status(job: Dict) -> str:
    """
    Get validation status string for a job.

    Args:
        job: Standardized job dictionary

    Returns:
        'valid', 'partial', or 'invalid'
    """
    is_valid, errors = validate_standardized_job(job, strict=False)

    if is_valid:
        # Check if all intelligence fields are present
        intel_present = all(
            job.get(field) is not None
            for field in INTELLIGENCE_FIELDS
        )
        return 'valid' if intel_present else 'partial'

    return 'invalid'


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
