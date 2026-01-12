"""
Program Mapping Pipeline Orchestrator
6-Stage pipeline for processing job postings through standardization,
program mapping, scoring, and export.

Stages:
1. Ingest - Load raw JSON from scraper
2. Parse - Parse raw job data
3. Standardize - Extract standardized fields (optional LLM)
4. Match - Map to federal programs
5. Score - Calculate BD priority scores
6. Export - Export to Notion CSV and n8n JSON

Based on: program-mapping-skill.md
"""

import json
import sys
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field

# Add parent paths for imports
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from Engine2_ProgramMapping.scripts.job_standardizer import (
    preprocess_job_data,
    normalize_location,
    normalize_clearance,
    validate_standardized_job,
    get_validation_status,
    REQUIRED_FIELDS,
    EXTRACTION_FIELDS,
)
from Engine2_ProgramMapping.scripts.program_mapper import (
    map_job_to_program,
    process_jobs_batch as mapper_process_batch,
    get_federal_programs_db,
)
from Engine2_ProgramMapping.scripts.exporters import (
    NotionCSVExporter,
    N8nWebhookExporter,
    export_batch,
    create_output_directories,
)
from Engine5_Scoring.scripts.bd_scoring import (
    calculate_bd_score,
    score_batch,
    generate_scoring_report,
)


# ============================================
# PIPELINE CONFIGURATION
# ============================================

@dataclass
class PipelineConfig:
    """Configuration for the pipeline."""
    input_path: str
    output_dir: str = "outputs"
    use_llm: bool = False  # Whether to use LLM for standardization
    use_federal_db: bool = True  # Whether to use Federal Programs CSV
    export_notion: bool = True
    export_n8n: bool = True
    test_mode: bool = False  # Process only first N jobs
    test_limit: int = 5
    verbose: bool = True


@dataclass
class PipelineStats:
    """Statistics from pipeline run."""
    total_jobs: int = 0
    jobs_processed: int = 0
    jobs_standardized: int = 0
    jobs_matched: int = 0
    jobs_scored: int = 0
    jobs_exported: int = 0
    validation_errors: int = 0
    processing_errors: int = 0
    start_time: datetime = field(default_factory=datetime.now)
    end_time: Optional[datetime] = None

    @property
    def duration_seconds(self) -> float:
        if self.end_time:
            return (self.end_time - self.start_time).total_seconds()
        return 0.0


def load_config(config_path: Optional[str] = None) -> Dict:
    """
    Load pipeline configuration from JSON file.

    Args:
        config_path: Path to config file (uses default if not provided)

    Returns:
        Configuration dictionary
    """
    if config_path is None:
        config_path = Path(__file__).parent.parent / "Configurations" / "ProgramMapping_Config.json"

    if Path(config_path).exists():
        with open(config_path, 'r') as f:
            return json.load(f)

    # Return defaults if no config file
    return {
        "use_federal_programs_db": True,
        "export": {
            "notion_output_path": "outputs/notion",
            "n8n_output_path": "outputs/n8n",
        }
    }


# ============================================
# STAGE 1: INGEST
# ============================================

def ingest_jobs(input_path: str) -> List[Dict]:
    """
    Stage 1: Load raw JSON jobs from scraper output.

    Args:
        input_path: Path to JSON file with scraped jobs

    Returns:
        List of raw job dictionaries
    """
    with open(input_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Handle both array and wrapped formats
    if isinstance(data, list):
        return data
    elif isinstance(data, dict):
        return data.get('jobs', [data])
    else:
        raise ValueError(f"Unexpected data format in {input_path}")


# ============================================
# STAGE 2-3: PARSE & STANDARDIZE
# ============================================

def parse_and_standardize(
    jobs: List[Dict],
    use_llm: bool = False,
    api_key: Optional[str] = None,
    on_progress: Optional[callable] = None
) -> List[Dict]:
    """
    Stage 2-3: Parse and standardize raw job data.

    Without LLM: Maps raw fields to standardized schema using heuristics.
    With LLM: Uses Claude to extract all fields from job text.

    Args:
        jobs: List of raw job dictionaries
        use_llm: Whether to use LLM for extraction
        api_key: Anthropic API key (required if use_llm=True)
        on_progress: Optional callback(current, total, job)

    Returns:
        List of standardized job dictionaries
    """
    results = []

    for i, raw_job in enumerate(jobs):
        try:
            if use_llm and api_key:
                # Full LLM extraction (imported at top)
                from Engine2_ProgramMapping.scripts.job_standardizer import standardize_job_with_llm
                preprocessed = preprocess_job_data(raw_job)
                standardized = standardize_job_with_llm(preprocessed, api_key)
            else:
                # Heuristic mapping without LLM
                standardized = _map_raw_to_standardized(raw_job)

            # Post-process normalizations
            if standardized.get('Location'):
                standardized['Location'] = normalize_location(standardized['Location'])
            if standardized.get('Security Clearance'):
                standardized['Security Clearance'] = normalize_clearance(standardized['Security Clearance'])

            # Add metadata
            standardized['Source URL'] = raw_job.get('url', '')
            standardized['Scrape Date'] = raw_job.get('scrapedAt', '')
            standardized['Processing Date'] = datetime.now().strftime('%Y-%m-%d')

            # Validate
            is_valid, errors = validate_standardized_job(standardized)
            standardized['Validation Status'] = 'valid' if is_valid else 'partial'
            standardized['_validation_errors'] = errors

            results.append(standardized)

        except Exception as e:
            # Create minimal standardized job on error
            results.append({
                'Job Title/Position': raw_job.get('title', 'Unknown'),
                'Location': raw_job.get('location', ''),
                'Validation Status': 'invalid',
                '_validation_errors': [str(e)],
                '_raw': raw_job,
            })

        if on_progress:
            on_progress(i + 1, len(jobs), results[-1])

    return results


def _map_raw_to_standardized(raw_job: Dict) -> Dict:
    """
    Map raw job fields to standardized schema without LLM.
    Uses field name mapping and basic transformations.
    """
    standardized = {}

    # Field mapping from raw to standardized (supports multiple scraper formats)
    field_map = {
        # Title variations
        'title': 'Job Title/Position',
        'jobTitle': 'Job Title/Position',
        'Job Title': 'Job Title/Position',
        # Date variations
        'datePosted': 'Date Posted',
        'date_posted': 'Date Posted',
        # Location
        'location': 'Location',
        # Description variations
        'description': 'Position Overview',
        'job_description': 'Position Overview',
        # Clearance variations
        'clearance': 'Security Clearance',
        'securityClearance': 'Security Clearance',
        'security_clearance': 'Security Clearance',
        # Duration/type variations
        'jobType': 'Project Duration',
        'duration': 'Project Duration',
        'employmentType': 'Position Details',
        # Pay variations
        'salary': 'Rate/Pay Rate',
        'payRate': 'Rate/Pay Rate',
        'pay_rate': 'Rate/Pay Rate',
        # Company
        'company': 'Prime Contractor',
        # Tech
        'technologies': 'Technologies',
        # URL
        'url': 'Source URL',
        # Job number
        'jobNumber': 'Additional Info',
    }

    for raw_field, std_field in field_map.items():
        value = raw_job.get(raw_field)
        if value is not None:
            standardized[std_field] = value

    # Transform date format if needed
    if 'Date Posted' in standardized:
        date_str = standardized['Date Posted']
        # Try to normalize date format
        for fmt in ['%Y-%m-%d', '%Y-%m-%dT%H:%M:%SZ', '%m/%d/%Y', '%B %d, %Y']:
            try:
                parsed = datetime.strptime(date_str.split('T')[0], fmt.split('T')[0])
                standardized['Date Posted'] = parsed.strftime('%Y-%m-%d')
                break
            except (ValueError, AttributeError):
                continue

    # Extract intelligence fields from description
    description = raw_job.get('description', '')
    standardized['Program Hints'] = _extract_program_hints(description)
    standardized['Client Hints'] = _extract_client_hints(description)
    standardized['Contract Vehicle Hints'] = []

    # Parse clearance level
    clearance = raw_job.get('clearance', '')
    standardized['Clearance Level Parsed'] = normalize_clearance(clearance) if clearance else None

    # Set certifications and technologies as arrays
    techs = raw_job.get('technologies', [])
    if isinstance(techs, str):
        techs = [t.strip() for t in techs.split(',')]
    standardized['Technologies'] = techs
    standardized['Certifications Required'] = _extract_certifications(description)

    # Create placeholder arrays for required fields
    if 'Key Responsibilities' not in standardized:
        standardized['Key Responsibilities'] = _extract_bullets(description, 'responsibilities')
    if 'Required Qualifications' not in standardized:
        standardized['Required Qualifications'] = _extract_bullets(description, 'qualifications')

    return standardized


def _extract_program_hints(text: str) -> List[str]:
    """Extract program names/acronyms from text."""
    import re
    hints = []
    programs = ['DCGS', 'ABMS', 'Platform One', 'ITES-3S', 'RS3', 'IBCS', 'AICCS']
    text_upper = text.upper()
    for prog in programs:
        if prog.upper() in text_upper:
            hints.append(prog)
    return hints


def _extract_client_hints(text: str) -> List[str]:
    """Extract agency/client names from text."""
    hints = []
    agencies = ['Air Force', 'Army', 'Navy', 'NSA', 'NGA', 'NRO', 'DIA', 'SOCOM', 'CYBERCOM']
    text_lower = text.lower()
    for agency in agencies:
        if agency.lower() in text_lower:
            hints.append(agency)
    return hints


def _extract_certifications(text: str) -> List[str]:
    """Extract certification mentions from text."""
    import re
    certs = []
    cert_patterns = [
        r'Security\+', r'CISSP', r'CEH', r'CCNA', r'CCNP', r'PMP',
        r'ITIL', r'CompTIA', r'AWS Certified', r'Azure Certified'
    ]
    for pattern in cert_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            certs.append(pattern.replace(r'\+', '+'))
    return certs


def _extract_bullets(text: str, section: str) -> List[str]:
    """Extract bullet points from a text section."""
    # Simple extraction - split by newlines and filter
    lines = text.split('\n')
    bullets = []
    in_section = False

    for line in lines:
        line = line.strip()
        if section.lower() in line.lower():
            in_section = True
            continue
        if in_section and line:
            # Remove bullet characters
            cleaned = line.lstrip('•-*·').strip()
            if len(cleaned) > 10:
                bullets.append(cleaned)
            if len(bullets) >= 5:
                break

    # If no structured bullets found, create from description
    if not bullets and text:
        sentences = text.split('.')
        bullets = [s.strip() + '.' for s in sentences[:5] if len(s.strip()) > 20]

    return bullets[:10]


# ============================================
# STAGE 4: MATCH TO PROGRAMS
# ============================================

def match_to_programs(
    jobs: List[Dict],
    use_federal_db: bool = True
) -> List[Dict]:
    """
    Stage 4: Map standardized jobs to federal programs.

    Args:
        jobs: List of standardized job dictionaries
        use_federal_db: Whether to use Federal Programs CSV database

    Returns:
        List of jobs with _mapping data added
    """
    results = []

    for job in jobs:
        result = map_job_to_program(job, use_federal_db)

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

        # Also set top-level enrichment fields for export
        enriched['Matched Program'] = result.program_name
        enriched['Match Confidence'] = result.match_confidence
        enriched['Match Type'] = result.match_type
        enriched['Secondary Programs'] = result.secondary_candidates

        results.append(enriched)

    return results


# ============================================
# STAGE 5: CALCULATE BD SCORES
# ============================================

def calculate_bd_scores(jobs: List[Dict]) -> List[Dict]:
    """
    Stage 5: Calculate BD Priority Scores for jobs.

    Args:
        jobs: List of jobs with _mapping data

    Returns:
        List of jobs with _scoring data added
    """
    results = []

    for job in jobs:
        # Prepare item for scoring
        scoring_item = {
            'clearance': job.get('Security Clearance', ''),
            'program': job.get('_mapping', {}).get('program_name', ''),
            'location': job.get('Location', ''),
            'match_confidence': job.get('_mapping', {}).get('match_confidence', 0.5),
            'date_posted': job.get('Date Posted', ''),
        }

        scoring_result = calculate_bd_score(scoring_item)

        enriched = job.copy()
        enriched['_scoring'] = {
            'bd_score': scoring_result.bd_score,
            'tier': scoring_result.tier,
            'tier_emoji': scoring_result.tier_emoji,
            'score_breakdown': scoring_result.score_breakdown,
            'recommendations': scoring_result.recommendations,
        }

        # Set top-level fields for export
        enriched['BD Priority Score'] = scoring_result.bd_score
        enriched['Priority Tier'] = scoring_result.tier

        results.append(enriched)

    return results


# ============================================
# STAGE 6: EXPORT RESULTS
# ============================================

def export_results(
    jobs: List[Dict],
    output_dir: str = "outputs",
    export_notion: bool = True,
    export_n8n: bool = True,
    filename_prefix: Optional[str] = None
) -> Dict[str, str]:
    """
    Stage 6: Export processed jobs to various formats.

    Args:
        jobs: List of fully processed job dictionaries
        output_dir: Base output directory
        export_notion: Whether to export Notion CSV
        export_n8n: Whether to export n8n JSON
        filename_prefix: Optional prefix for output filenames

    Returns:
        Dictionary with paths to exported files
    """
    # Create output directories
    create_output_directories(output_dir)

    return export_batch(
        jobs,
        notion_output=f"{output_dir}/notion" if export_notion else None,
        n8n_output=f"{output_dir}/n8n" if export_n8n else None,
        filename_prefix=filename_prefix,
    )


# ============================================
# MAIN PIPELINE
# ============================================

def run_pipeline(config: PipelineConfig) -> PipelineStats:
    """
    Run the complete 6-stage pipeline.

    Args:
        config: PipelineConfig with settings

    Returns:
        PipelineStats with results
    """
    stats = PipelineStats()

    def log(msg: str):
        if config.verbose:
            print(msg)

    try:
        # Stage 1: Ingest
        log(f"\n=== Stage 1: Ingest ===")
        log(f"Loading jobs from {config.input_path}")
        jobs = ingest_jobs(config.input_path)
        stats.total_jobs = len(jobs)

        if config.test_mode:
            jobs = jobs[:config.test_limit]
            log(f"Test mode: processing {len(jobs)} jobs")

        log(f"Loaded {len(jobs)} jobs")

        # Stage 2-3: Parse & Standardize
        log(f"\n=== Stage 2-3: Parse & Standardize ===")

        def on_progress(current, total, job):
            if config.verbose:
                title = job.get('Job Title/Position', 'Unknown')[:40]
                status = job.get('Validation Status', 'unknown')
                print(f"  [{current}/{total}] {status}: {title}")

        standardized = parse_and_standardize(
            jobs,
            use_llm=config.use_llm,
            on_progress=on_progress if config.verbose else None
        )
        stats.jobs_standardized = len([j for j in standardized if j.get('Validation Status') != 'invalid'])
        stats.validation_errors = len([j for j in standardized if j.get('Validation Status') == 'invalid'])
        log(f"Standardized {stats.jobs_standardized} jobs ({stats.validation_errors} validation errors)")

        # Stage 4: Match to Programs
        log(f"\n=== Stage 4: Match to Programs ===")
        if config.use_federal_db:
            db = get_federal_programs_db()
            log(f"Using Federal Programs DB ({db.total_programs} programs)")

        matched = match_to_programs(standardized, config.use_federal_db)
        stats.jobs_matched = len([j for j in matched if j.get('_mapping', {}).get('program_name') != 'Unmatched'])
        log(f"Matched {stats.jobs_matched}/{len(matched)} jobs to programs")

        # Stage 5: Calculate BD Scores
        log(f"\n=== Stage 5: Calculate BD Scores ===")
        scored = calculate_bd_scores(matched)
        stats.jobs_scored = len(scored)

        # Summary by tier
        tiers = {'Hot': 0, 'Warm': 0, 'Cold': 0}
        for job in scored:
            tier = job.get('_scoring', {}).get('tier', 'Cold')
            tiers[tier] = tiers.get(tier, 0) + 1
        log(f"Scored {stats.jobs_scored} jobs: Hot={tiers['Hot']}, Warm={tiers['Warm']}, Cold={tiers['Cold']}")

        # Stage 6: Export
        log(f"\n=== Stage 6: Export ===")
        export_paths = export_results(
            scored,
            output_dir=config.output_dir,
            export_notion=config.export_notion,
            export_n8n=config.export_n8n,
        )
        stats.jobs_exported = len(scored)

        for format_name, path in export_paths.items():
            log(f"  {format_name}: {path}")

        stats.jobs_processed = len(scored)

    except Exception as e:
        stats.processing_errors += 1
        log(f"\nERROR: {e}")
        raise

    finally:
        stats.end_time = datetime.now()

    log(f"\n=== Pipeline Complete ===")
    log(f"Processed {stats.jobs_processed} jobs in {stats.duration_seconds:.1f}s")

    return stats


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Program Mapping Pipeline - 6-stage job processing',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python pipeline.py --input data/jobs.json --output outputs/
  python pipeline.py -i data/Sample_Jobs.json -o outputs/ --test
  python pipeline.py -i data/jobs.json --no-notion --verbose
        """
    )

    parser.add_argument('--input', '-i', required=True, help='Input JSON file with jobs')
    parser.add_argument('--output', '-o', default='outputs', help='Output directory (default: outputs)')
    parser.add_argument('--test', action='store_true', help='Test mode - process only first 5 jobs')
    parser.add_argument('--test-limit', type=int, default=5, help='Number of jobs in test mode')
    parser.add_argument('--use-llm', action='store_true', help='Use LLM for standardization (requires API key)')
    parser.add_argument('--no-federal-db', action='store_true', help='Disable Federal Programs database')
    parser.add_argument('--no-notion', action='store_true', help='Skip Notion CSV export')
    parser.add_argument('--no-n8n', action='store_true', help='Skip n8n JSON export')
    parser.add_argument('--quiet', '-q', action='store_true', help='Minimal output')

    args = parser.parse_args()

    config = PipelineConfig(
        input_path=args.input,
        output_dir=args.output,
        use_llm=args.use_llm,
        use_federal_db=not args.no_federal_db,
        export_notion=not args.no_notion,
        export_n8n=not args.no_n8n,
        test_mode=args.test,
        test_limit=args.test_limit,
        verbose=not args.quiet,
    )

    try:
        stats = run_pipeline(config)
        print(f"\nProcessed {stats.jobs_processed} jobs successfully")
        sys.exit(0)
    except Exception as e:
        print(f"\nPipeline failed: {e}")
        sys.exit(1)
