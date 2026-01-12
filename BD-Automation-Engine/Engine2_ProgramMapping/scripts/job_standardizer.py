"""
Job Standardization Engine
Transforms unstructured job posting data into standardized 20+ field schema.

Based on: job-standardization-skill.md
Schema: 6 Required + 8 Intelligence + 4 Optional + 6 Enrichment + 4 Metadata = 28 total fields
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

SYSTEM_PROMPT = """You are a specialized data extraction system for defense contractor job postings. Analyze the raw job description and extract information into the standardized 18-field schema.

### EXTRACTION RULES

## Required Fields (6)

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

**Position Overview (REQUIRED)**
- 100-200 word summary
- Answer: What does this person do day-to-day?
- Extract from "Overview", "Summary", "About the Role" sections

**Key Responsibilities (REQUIRED)**
- Array of 5-15 bullet points
- Action verb sentence fragments
- Extract from "Responsibilities", "Duties", "What You'll Do"
- Remove bullet symbols (•, -, *, ·)

**Required Qualifications (REQUIRED)**
- Array of 5-20 bullet points
- Separate from "Preferred" qualifications
- Include: clearance, education, experience, certifications, skills

## Intelligence Fields (8)

**Security Clearance**
- Standardize abbreviations:
  - "TS/SCI w/ CI Poly" (with polygraph)
  - "TS/SCI w/ Full Scope Poly" (full scope polygraph)
  - "TS/SCI" (no polygraph)
  - "Top Secret" → "Top Secret"
  - "Secret" (not "DOD Secret")
- Note if "ability to obtain" vs "active"

**Program Hints**
- Array of program names/acronyms mentioned in the description
- Look for: NSA programs, DoD programs, IC program names
- Extract acronyms in ALL CAPS that appear to be program names
- Common patterns: three/four letter acronyms, names ending in "-NET", "-SAT", "-COM"
- Examples: "SIGINT", "JWICS", "NIPR", "SIPR", "CENTCOM", "SOCOM"
- Return as array of strings, or null if none found

**Client Hints**
- Array of agency, department, or command mentions
- Look for: federal agency names, military commands, intelligence community references
- Examples: "NSA", "CIA", "DIA", "NGA", "FBI", "DoD", "Army", "Navy", "Air Force"
- Include: combatant commands (CENTCOM, EUCOM), service branches, civilian agencies
- Return as array of strings, or null if none found

**Contract Vehicle Hints**
- Array of contract vehicle mentions
- Look for: GWAC, IDIQ, BPA, task order references
- Common vehicles: "GSA Schedule", "SEWP", "OASIS", "CIO-SP3", "Alliant 2"
- Include contract numbers if mentioned (e.g., "FA8773-xx-xxxx")
- Return as array of strings, or null if none found

**Prime Contractor**
- Identified prime contractor if this is a subcontract position
- Look for phrases: "supporting [Company]", "prime contractor is", "teaming with"
- Common primes: Booz Allen, Leidos, SAIC, Northrop Grumman, Raytheon, General Dynamics
- Return company name string, or null if position is direct-hire

**Recruiter Contact**
- Object with recruiter contact information if available
- Extract: name, email, phone number
- Format: {"name": "John Doe", "email": "jdoe@company.com", "phone": "555-123-4567"}
- Return null if no contact info found

**Technologies**
- Array of technology stack mentions
- Include: programming languages, frameworks, tools, platforms, databases
- Cloud platforms: AWS, Azure, GCP, OpenStack
- Security tools: Splunk, Elastic, Nessus, Tenable, CrowdStrike
- DevOps: Kubernetes, Docker, Terraform, Ansible, Jenkins
- Languages: Python, Java, Go, JavaScript, C++, Rust
- Return as array of strings, minimum 3 items if technologies mentioned

**Certifications Required**
- Array of certification requirements
- Security certs: Security+, CISSP, CISM, CEH, GIAC (GSEC, GPEN, etc.)
- Cloud certs: AWS Solutions Architect, Azure Administrator, GCP Professional
- IT certs: CCNA, CCNP, ITIL, PMP, Agile/Scrum certifications
- DoD 8570/8140 baseline certifications
- Include certification level if specified (e.g., "CISSP" not just "ISC2 cert")
- Return as array of strings, or null if none mentioned

## Optional Fields (4)

**Project Duration**
- Contract length or "Permanent"
- Extract from contract type mentions

**Rate/Pay Rate**
- "$X/hour" or "$XXK-XXXK/year"
- Extract from compensation sections

**Position Details**
- 150-300 word detailed context
- Work environment, team structure, project scope

**Additional Information**
- Benefits, travel requirements, misc details

### OUTPUT FORMAT
Return valid JSON with all 18 fields. Use null for missing optional fields. Arrays should be empty [] if no items found, or null if the field type is not applicable.

Example structure:
{
  "Job Title/Position": "string",
  "Date Posted": "YYYY-MM-DD",
  "Location": "City, State",
  "Position Overview": "string (100-200 words)",
  "Key Responsibilities": ["item1", "item2", ...],
  "Required Qualifications": ["item1", "item2", ...],
  "Security Clearance": "standardized clearance level",
  "Program Hints": ["PROGRAM1", "PROGRAM2"] or null,
  "Client Hints": ["Agency1", "Command2"] or null,
  "Contract Vehicle Hints": ["Vehicle1"] or null,
  "Prime Contractor": "Company Name" or null,
  "Recruiter Contact": {"name": "", "email": "", "phone": ""} or null,
  "Technologies": ["Tech1", "Tech2", ...],
  "Certifications Required": ["Cert1", "Cert2"] or null,
  "Project Duration": "string" or null,
  "Rate/Pay Rate": "string" or null,
  "Position Details": "string" or null,
  "Additional Information": "string" or null
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
        Standardized job dictionary with 18 extraction fields
        (6 Required + 8 Intelligence + 4 Optional)
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

# Valid standardized clearance levels
VALID_CLEARANCES = [
    'TS/SCI w/ Full Scope Poly',
    'TS/SCI w/ CI Poly',
    'TS/SCI w/ Poly',
    'TS/SCI',
    'Top Secret',
    'Secret',
    'Public Trust',
    'None',
]

# Valid match types for enrichment
VALID_MATCH_TYPES = ['direct', 'fuzzy', 'inferred']

# Valid priority tiers
VALID_TIERS = ['Hot', 'Warm', 'Cold']


def _validate_required_fields(job: Dict, errors: List[str]) -> None:
    """Validate the 6 required fields."""
    # Job Title/Position - must be non-empty string
    title = job.get('Job Title/Position')
    if not title or not isinstance(title, str):
        errors.append("Missing required field: Job Title/Position")
    elif len(title.strip()) < 3:
        errors.append("Job Title/Position is too short (minimum 3 characters)")

    # Date Posted - must be YYYY-MM-DD format
    date_posted = job.get('Date Posted')
    if not date_posted:
        errors.append("Missing required field: Date Posted")
    elif isinstance(date_posted, str):
        try:
            datetime.strptime(date_posted, '%Y-%m-%d')
        except ValueError:
            errors.append("Date Posted must be YYYY-MM-DD format")

    # Location - must be non-empty string (City, State or special values)
    location = job.get('Location')
    if not location or not isinstance(location, str):
        errors.append("Missing required field: Location")
    elif len(location.strip()) < 2:
        errors.append("Location is too short")

    # Position Overview - 100-200 words (warn if outside range)
    overview = job.get('Position Overview', '')
    if not overview or not isinstance(overview, str):
        errors.append("Missing required field: Position Overview")
    else:
        word_count = len(overview.split())
        if word_count < 50:
            errors.append(f"Position Overview too short ({word_count} words, need 100+)")
        elif word_count > 300:
            errors.append(f"Position Overview too long ({word_count} words, max 200)")

    # Key Responsibilities - array of 5-15 bullet points
    responsibilities = job.get('Key Responsibilities')
    if not isinstance(responsibilities, list):
        errors.append("Key Responsibilities must be an array")
    elif len(responsibilities) < 3:
        errors.append("Key Responsibilities should have at least 3 items")
    elif len(responsibilities) > 20:
        errors.append("Key Responsibilities has too many items (max 20)")
    else:
        # Validate each item is a non-empty string
        for i, item in enumerate(responsibilities):
            if not isinstance(item, str) or not item.strip():
                errors.append(f"Key Responsibilities[{i}] must be a non-empty string")
                break

    # Required Qualifications - array of 5-20 bullet points
    qualifications = job.get('Required Qualifications')
    if not isinstance(qualifications, list):
        errors.append("Required Qualifications must be an array")
    elif len(qualifications) < 3:
        errors.append("Required Qualifications should have at least 3 items")
    elif len(qualifications) > 30:
        errors.append("Required Qualifications has too many items (max 30)")
    else:
        # Validate each item is a non-empty string
        for i, item in enumerate(qualifications):
            if not isinstance(item, str) or not item.strip():
                errors.append(f"Required Qualifications[{i}] must be a non-empty string")
                break


def _validate_intelligence_fields(job: Dict, errors: List[str]) -> None:
    """Validate the 8 intelligence fields."""
    # Security Clearance - standardized string or null
    clearance = job.get('Security Clearance')
    if clearance is not None:
        if not isinstance(clearance, str):
            errors.append("Security Clearance must be a string or null")
        elif clearance not in VALID_CLEARANCES:
            # Allow variations but log as warning (not error)
            # Check if it's at least a reasonable clearance string
            clearance_lower = clearance.lower()
            has_valid_keyword = any(kw in clearance_lower for kw in ['secret', 'ts', 'sci', 'poly', 'trust', 'none'])
            if not has_valid_keyword:
                errors.append(f"Security Clearance '{clearance}' is not a recognized format")

    # Program Hints - array of strings or null
    program_hints = job.get('Program Hints')
    if program_hints is not None:
        if not isinstance(program_hints, list):
            errors.append("Program Hints must be an array or null")
        else:
            for i, hint in enumerate(program_hints):
                if not isinstance(hint, str):
                    errors.append(f"Program Hints[{i}] must be a string")
                    break

    # Client Hints - array of strings or null
    client_hints = job.get('Client Hints')
    if client_hints is not None:
        if not isinstance(client_hints, list):
            errors.append("Client Hints must be an array or null")
        else:
            for i, hint in enumerate(client_hints):
                if not isinstance(hint, str):
                    errors.append(f"Client Hints[{i}] must be a string")
                    break

    # Contract Vehicle Hints - array of strings or null
    contract_hints = job.get('Contract Vehicle Hints')
    if contract_hints is not None:
        if not isinstance(contract_hints, list):
            errors.append("Contract Vehicle Hints must be an array or null")
        else:
            for i, hint in enumerate(contract_hints):
                if not isinstance(hint, str):
                    errors.append(f"Contract Vehicle Hints[{i}] must be a string")
                    break

    # Prime Contractor - string or null
    prime = job.get('Prime Contractor')
    if prime is not None and not isinstance(prime, str):
        errors.append("Prime Contractor must be a string or null")

    # Recruiter Contact - object with name/email/phone or null
    recruiter = job.get('Recruiter Contact')
    if recruiter is not None:
        if not isinstance(recruiter, dict):
            errors.append("Recruiter Contact must be an object or null")
        else:
            # Validate email format if present
            email = recruiter.get('email')
            if email and isinstance(email, str):
                if '@' not in email or '.' not in email:
                    errors.append("Recruiter Contact email is not valid format")

    # Technologies - array of strings (can be empty but should exist)
    technologies = job.get('Technologies')
    if technologies is not None:
        if not isinstance(technologies, list):
            errors.append("Technologies must be an array or null")
        else:
            for i, tech in enumerate(technologies):
                if not isinstance(tech, str):
                    errors.append(f"Technologies[{i}] must be a string")
                    break

    # Certifications Required - array of strings or null
    certifications = job.get('Certifications Required')
    if certifications is not None:
        if not isinstance(certifications, list):
            errors.append("Certifications Required must be an array or null")
        else:
            for i, cert in enumerate(certifications):
                if not isinstance(cert, str):
                    errors.append(f"Certifications Required[{i}] must be a string")
                    break


def _validate_optional_fields(job: Dict, errors: List[str]) -> None:
    """Validate the 4 optional fields."""
    # Project Duration - string or null
    duration = job.get('Project Duration')
    if duration is not None and not isinstance(duration, str):
        errors.append("Project Duration must be a string or null")

    # Rate/Pay Rate - string or null
    rate = job.get('Rate/Pay Rate')
    if rate is not None and not isinstance(rate, str):
        errors.append("Rate/Pay Rate must be a string or null")

    # Position Details - string or null
    details = job.get('Position Details')
    if details is not None and not isinstance(details, str):
        errors.append("Position Details must be a string or null")

    # Additional Information - string or null
    additional = job.get('Additional Information')
    if additional is not None and not isinstance(additional, str):
        errors.append("Additional Information must be a string or null")


def _validate_enrichment_fields(job: Dict, errors: List[str]) -> None:
    """Validate the 6 enrichment fields (if present)."""
    # Matched Program - string or null
    matched = job.get('Matched Program')
    if matched is not None and not isinstance(matched, str):
        errors.append("Matched Program must be a string or null")

    # Match Confidence - float 0.0-1.0 or null
    confidence = job.get('Match Confidence')
    if confidence is not None:
        if not isinstance(confidence, (int, float)):
            errors.append("Match Confidence must be a number or null")
        elif confidence < 0.0 or confidence > 1.0:
            errors.append(f"Match Confidence must be 0.0-1.0, got {confidence}")

    # Match Type - direct/fuzzy/inferred or null
    match_type = job.get('Match Type')
    if match_type is not None:
        if not isinstance(match_type, str):
            errors.append("Match Type must be a string or null")
        elif match_type not in VALID_MATCH_TYPES:
            errors.append(f"Match Type must be one of {VALID_MATCH_TYPES}, got '{match_type}'")

    # BD Priority Score - int 0-100 or null
    bd_score = job.get('BD Priority Score')
    if bd_score is not None:
        if not isinstance(bd_score, (int, float)):
            errors.append("BD Priority Score must be a number or null")
        elif bd_score < 0 or bd_score > 100:
            errors.append(f"BD Priority Score must be 0-100, got {bd_score}")

    # Priority Tier - Hot/Warm/Cold or null
    tier = job.get('Priority Tier')
    if tier is not None:
        if not isinstance(tier, str):
            errors.append("Priority Tier must be a string or null")
        else:
            # Handle tier with emoji prefix (e.g., "🔥 Hot")
            tier_clean = tier.split()[-1] if tier else tier
            if tier_clean not in VALID_TIERS:
                errors.append(f"Priority Tier must be one of {VALID_TIERS}, got '{tier}'")

    # Match Signals - array of strings or null
    signals = job.get('Match Signals')
    if signals is not None:
        if not isinstance(signals, list):
            errors.append("Match Signals must be an array or null")
        else:
            for i, signal in enumerate(signals):
                if not isinstance(signal, str):
                    errors.append(f"Match Signals[{i}] must be a string")
                    break


def _validate_metadata_fields(job: Dict, errors: List[str]) -> None:
    """Validate the 4 metadata fields (if present)."""
    # Source - non-empty string
    source = job.get('Source')
    if source is not None:
        if not isinstance(source, str):
            errors.append("Source must be a string")
        elif not source.strip():
            errors.append("Source cannot be empty")

    # Source URL - valid URL string
    url = job.get('Source URL')
    if url is not None:
        if not isinstance(url, str):
            errors.append("Source URL must be a string")
        elif url and not (url.startswith('http://') or url.startswith('https://')):
            errors.append("Source URL must be a valid HTTP/HTTPS URL")

    # Scraped At - ISO timestamp string
    scraped_at = job.get('Scraped At')
    if scraped_at is not None:
        if not isinstance(scraped_at, str):
            errors.append("Scraped At must be a string")
        else:
            # Try to parse ISO format
            try:
                datetime.fromisoformat(scraped_at.replace('Z', '+00:00'))
            except ValueError:
                errors.append("Scraped At must be ISO timestamp format")

    # Processed At - ISO timestamp string
    processed_at = job.get('Processed At')
    if processed_at is not None:
        if not isinstance(processed_at, str):
            errors.append("Processed At must be a string")
        else:
            try:
                datetime.fromisoformat(processed_at.replace('Z', '+00:00'))
            except ValueError:
                errors.append("Processed At must be ISO timestamp format")


def validate_standardized_job(
    job: Dict,
    validate_enrichment: bool = False,
    validate_metadata: bool = False,
    strict: bool = False
) -> Tuple[bool, List[str]]:
    """
    Validate that standardized job has all required fields and proper formats.

    Validates the 18-field extraction schema:
    - 6 Required Fields (always validated)
    - 8 Intelligence Fields (always validated)
    - 4 Optional Fields (always validated)

    Optionally validates:
    - 6 Enrichment Fields (when validate_enrichment=True)
    - 4 Metadata Fields (when validate_metadata=True)

    Args:
        job: Standardized job dictionary
        validate_enrichment: Also validate enrichment fields (Matched Program, etc.)
        validate_metadata: Also validate metadata fields (Source, Source URL, etc.)
        strict: If True, treat warnings as errors

    Returns:
        Tuple of (is_valid, list_of_errors)
    """
    errors = []

    # Validate required fields (6)
    _validate_required_fields(job, errors)

    # Validate intelligence fields (8)
    _validate_intelligence_fields(job, errors)

    # Validate optional fields (4)
    _validate_optional_fields(job, errors)

    # Optionally validate enrichment fields (6)
    if validate_enrichment:
        _validate_enrichment_fields(job, errors)

    # Optionally validate metadata fields (4)
    if validate_metadata:
        _validate_metadata_fields(job, errors)

    return len(errors) == 0, errors


def validate_job_batch(
    jobs: List[Dict],
    validate_enrichment: bool = False,
    validate_metadata: bool = False
) -> Tuple[int, int, List[Dict]]:
    """
    Validate a batch of standardized jobs.

    Args:
        jobs: List of standardized job dictionaries
        validate_enrichment: Also validate enrichment fields
        validate_metadata: Also validate metadata fields

    Returns:
        Tuple of (valid_count, invalid_count, list_of_validation_results)
    """
    results = []
    valid_count = 0
    invalid_count = 0

    for i, job in enumerate(jobs):
        is_valid, errors = validate_standardized_job(
            job,
            validate_enrichment=validate_enrichment,
            validate_metadata=validate_metadata
        )

        if is_valid:
            valid_count += 1
        else:
            invalid_count += 1

        results.append({
            'index': i,
            'is_valid': is_valid,
            'errors': errors,
            'job_title': job.get('Job Title/Position', 'Unknown')
        })

    return valid_count, invalid_count, results


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
