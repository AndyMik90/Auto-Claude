"""
Pipeline Orchestrator for Program Mapping Engine v2.0
Coordinates the 6-stage pipeline: Ingest -> Parse -> Standardize -> Match -> Score -> Export

Based on: spec.md requirements for Program Mapping Engine
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any, Callable
from dataclasses import dataclass, field

# Import Playbook Generator (optional)
try:
    from Engine4_Playbook.scripts.bd_playbook_generator import (
        generate_playbooks_batch,
        PlaybookOutput,
    )
    HAS_PLAYBOOK_GENERATOR = True
except ImportError:
    HAS_PLAYBOOK_GENERATOR = False


# ============================================
# CONFIGURATION
# ============================================

# Default configuration file path
DEFAULT_CONFIG_PATH = Path(__file__).parent.parent / "Configurations" / "ProgramMapping_Config.json"

# Default input/output paths
DEFAULT_INPUT_DIR = Path(__file__).parent.parent.parent / "Engine1_Scraper" / "data"
DEFAULT_OUTPUT_DIR = Path(__file__).parent.parent.parent.parent / "outputs"


# ============================================
# PIPELINE CONFIGURATION DATACLASS
# ============================================

@dataclass
class PipelineConfig:
    """
    Configuration for the Program Mapping Pipeline.

    Holds all settings for the 6-stage pipeline including:
    - Input/output paths
    - Processing thresholds
    - Scoring weights
    - Export options

    Attributes:
        name: Pipeline configuration name
        version: Pipeline version string
        description: Human-readable description

        # Input/Output Paths
        input_path: Path to input JSON file or directory
        output_dir: Base directory for all outputs
        notion_output_dir: Directory for Notion CSV exports
        n8n_output_dir: Directory for n8n JSON exports

        # Processing Options
        test_mode: If True, process only first 3 jobs
        batch_size: Number of jobs to process before saving progress
        skip_llm: If True, skip Claude API calls (use for testing)

        # API Settings
        anthropic_api_key: Claude API key (uses env var if not set)
        anthropic_model: Model to use for extraction

        # Thresholds
        direct_match_threshold: Minimum confidence for direct match (0.70)
        fuzzy_match_threshold: Minimum confidence for fuzzy match (0.50)

        # Scoring Weights
        scoring_weights: Dict of signal type to score weight

        # BD Priority Tier Settings
        hot_tier_min: Minimum score for Hot tier (80)
        warm_tier_min: Minimum score for Warm tier (50)

        # Export Options
        export_formats: List of formats to export ('notion', 'n8n')
        include_raw_data: Include original job data in exports
    """
    # Identity
    name: str = "PTS BD Program Mapping Engine"
    version: str = "2.0.0"
    description: str = "Maps job postings to federal programs using multi-signal scoring"

    # Input/Output Paths
    input_path: Optional[str] = None
    output_dir: Optional[str] = None
    notion_output_dir: Optional[str] = None
    n8n_output_dir: Optional[str] = None

    # Processing Options
    test_mode: bool = False
    batch_size: int = 50
    skip_llm: bool = False

    # API Settings
    anthropic_api_key: Optional[str] = None
    anthropic_model: str = "claude-sonnet-4-20250514"

    # Thresholds
    direct_match_threshold: float = 0.70
    fuzzy_match_threshold: float = 0.50

    # Scoring Weights (from config file or defaults)
    scoring_weights: Dict[str, int] = field(default_factory=lambda: {
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
    })

    # BD Priority Tier Settings
    hot_tier_min: int = 80
    warm_tier_min: int = 50

    # Export Options
    export_formats: List[str] = field(default_factory=lambda: ["notion", "n8n"])
    include_raw_data: bool = True

    # Playbook Generation Options
    generate_playbooks: bool = True  # Generate playbooks for Hot tier
    playbook_output_dir: Optional[str] = None
    playbook_min_score: int = 80  # Minimum score to generate playbook
    playbook_formats: List[str] = field(default_factory=lambda: ["full", "email", "call", "talking"])
    include_contacts_in_playbook: bool = True

    # Progress Callback
    progress_callback: Optional[Callable[[int, int, str], None]] = None

    def __post_init__(self):
        """Resolve API key from environment if not set."""
        if self.anthropic_api_key is None:
            self.anthropic_api_key = os.environ.get('ANTHROPIC_API_KEY')

        # Set default paths if not provided
        if self.output_dir is None:
            self.output_dir = str(DEFAULT_OUTPUT_DIR)

        if self.notion_output_dir is None:
            self.notion_output_dir = str(Path(self.output_dir) / "notion")

        if self.n8n_output_dir is None:
            self.n8n_output_dir = str(Path(self.output_dir) / "n8n")

        if self.playbook_output_dir is None:
            self.playbook_output_dir = str(Path(self.output_dir) / "BD_Briefings")

    def to_dict(self) -> Dict[str, Any]:
        """Convert config to dictionary (excluding non-serializable fields)."""
        return {
            "name": self.name,
            "version": self.version,
            "description": self.description,
            "input_path": self.input_path,
            "output_dir": self.output_dir,
            "notion_output_dir": self.notion_output_dir,
            "n8n_output_dir": self.n8n_output_dir,
            "test_mode": self.test_mode,
            "batch_size": self.batch_size,
            "skip_llm": self.skip_llm,
            "anthropic_model": self.anthropic_model,
            "direct_match_threshold": self.direct_match_threshold,
            "fuzzy_match_threshold": self.fuzzy_match_threshold,
            "scoring_weights": self.scoring_weights,
            "hot_tier_min": self.hot_tier_min,
            "warm_tier_min": self.warm_tier_min,
            "export_formats": self.export_formats,
            "include_raw_data": self.include_raw_data,
            "generate_playbooks": self.generate_playbooks,
            "playbook_output_dir": self.playbook_output_dir,
            "playbook_min_score": self.playbook_min_score,
            "playbook_formats": self.playbook_formats,
            "include_contacts_in_playbook": self.include_contacts_in_playbook,
        }


# ============================================
# CONFIGURATION LOADING
# ============================================

def load_config(
    config_path: Optional[str] = None,
    overrides: Optional[Dict[str, Any]] = None
) -> PipelineConfig:
    """
    Load pipeline configuration from JSON file with optional overrides.

    The configuration is loaded from ProgramMapping_Config.json and merged
    with any command-line or programmatic overrides.

    Args:
        config_path: Path to configuration JSON file. Uses default if None.
        overrides: Dict of config values to override after loading file.

    Returns:
        PipelineConfig instance with merged configuration.

    Example:
        >>> config = load_config()
        >>> config.name
        'PTS BD Program Mapping Engine'

        >>> config = load_config(overrides={'test_mode': True})
        >>> config.test_mode
        True
    """
    # Determine config file path
    if config_path is None:
        path = DEFAULT_CONFIG_PATH
    else:
        path = Path(config_path)

    # Load base config from file if it exists
    file_config = {}
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                raw_config = json.load(f)

            # Extract relevant fields from the config file structure
            # The config file has a nested structure with various sections

            # Mapping settings
            mapping_settings = raw_config.get('mapping_settings', {})
            file_config['name'] = mapping_settings.get('name', PipelineConfig.name)
            file_config['version'] = mapping_settings.get('version', PipelineConfig.version)
            file_config['description'] = mapping_settings.get('description', PipelineConfig.description)

            # Scoring weights
            scoring = raw_config.get('scoring', {})
            if scoring:
                file_config['scoring_weights'] = {
                    'program_name_in_title': scoring.get('programNameInTitle', 50),
                    'program_name_in_description': scoring.get('programNameInDescription', 20),
                    'acronym_match': scoring.get('acronymMatch', 40),
                    'location_match_exact': scoring.get('locationMatchExact', 20),
                    'location_match_region': scoring.get('locationMatchRegion', 10),
                    'technology_keyword': scoring.get('technologyKeyword', 15),
                    'role_type_match': scoring.get('roleTypeMatch', 10),
                    'clearance_alignment': scoring.get('clearanceAlignment', 5),
                    'clearance_mismatch': scoring.get('clearanceMismatch', -20),
                    'dcgs_specific_keyword': scoring.get('dcgsSpecificKeyword', 10),
                }

            # Thresholds
            thresholds = raw_config.get('thresholds', {})
            if thresholds:
                direct = thresholds.get('direct', {})
                fuzzy = thresholds.get('fuzzy', {})
                file_config['direct_match_threshold'] = direct.get('min', 0.70)
                file_config['fuzzy_match_threshold'] = fuzzy.get('min', 0.50)

            # BD Priority Tiers
            tiers = raw_config.get('bdPriorityTiers', {})
            if tiers:
                hot = tiers.get('hot', {})
                warm = tiers.get('warm', {})
                file_config['hot_tier_min'] = hot.get('min', 80)
                file_config['warm_tier_min'] = warm.get('min', 50)

            # Output paths
            output = raw_config.get('output', {})
            if output:
                # Extract base output directory from paths
                enriched_path = output.get('enrichedJobsPath', '')
                if enriched_path:
                    # Use parent directory of the enriched jobs path
                    pass  # Keep defaults for now

            # Export configuration (if present in extended config)
            export_config = raw_config.get('export', {})
            if export_config:
                file_config['notion_output_dir'] = export_config.get('notion_output_path')
                file_config['n8n_output_dir'] = export_config.get('n8n_output_path')

        except (json.JSONDecodeError, IOError) as e:
            # Log warning but continue with defaults
            pass

    # Apply overrides
    if overrides:
        file_config.update(overrides)

    # Remove None values to allow dataclass defaults
    file_config = {k: v for k, v in file_config.items() if v is not None}

    # Create config instance
    return PipelineConfig(**file_config)


def save_config(config: PipelineConfig, output_path: str) -> None:
    """
    Save pipeline configuration to JSON file.

    Useful for saving the current configuration state or creating
    configuration templates.

    Args:
        config: PipelineConfig instance to save
        output_path: Path to write JSON file
    """
    config_dict = config.to_dict()

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(config_dict, f, indent=2)


def validate_config(config: PipelineConfig) -> List[str]:
    """
    Validate pipeline configuration and return any issues.

    Checks for:
    - Valid threshold ranges
    - Valid tier min values
    - Required paths exist (if specified)

    Args:
        config: PipelineConfig instance to validate

    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []

    # Validate thresholds
    if not 0.0 <= config.direct_match_threshold <= 1.0:
        errors.append(f"direct_match_threshold must be 0.0-1.0, got {config.direct_match_threshold}")

    if not 0.0 <= config.fuzzy_match_threshold <= 1.0:
        errors.append(f"fuzzy_match_threshold must be 0.0-1.0, got {config.fuzzy_match_threshold}")

    if config.fuzzy_match_threshold >= config.direct_match_threshold:
        errors.append("fuzzy_match_threshold must be less than direct_match_threshold")

    # Validate tier thresholds
    if not 0 <= config.hot_tier_min <= 100:
        errors.append(f"hot_tier_min must be 0-100, got {config.hot_tier_min}")

    if not 0 <= config.warm_tier_min <= 100:
        errors.append(f"warm_tier_min must be 0-100, got {config.warm_tier_min}")

    if config.warm_tier_min >= config.hot_tier_min:
        errors.append("warm_tier_min must be less than hot_tier_min")

    # Validate batch size
    if config.batch_size < 1:
        errors.append(f"batch_size must be positive, got {config.batch_size}")

    # Validate export formats
    valid_formats = {'notion', 'n8n'}
    invalid_formats = set(config.export_formats) - valid_formats
    if invalid_formats:
        errors.append(f"Invalid export formats: {invalid_formats}. Valid: {valid_formats}")

    # Validate API key if LLM is not skipped
    if not config.skip_llm and not config.anthropic_api_key:
        errors.append("ANTHROPIC_API_KEY required when skip_llm is False")

    # Validate input path exists if specified
    if config.input_path:
        input_path = Path(config.input_path)
        if not input_path.exists():
            errors.append(f"Input path does not exist: {config.input_path}")

    return errors


# ============================================
# IMPORTS FOR PIPELINE STAGES
# ============================================

# Import other pipeline components (will be used in stages 2-6)
try:
    from Engine2_ProgramMapping.scripts.job_standardizer import (
        preprocess_job_data,
        standardize_job_with_llm,
        normalize_location,
        normalize_clearance,
        validate_standardized_job,
    )
    HAS_STANDARDIZER = True
except ImportError:
    HAS_STANDARDIZER = False

try:
    from Engine2_ProgramMapping.scripts.program_mapper import (
        map_job_to_program,
        process_jobs_batch as map_jobs_batch,
    )
    HAS_MAPPER = True
except ImportError:
    HAS_MAPPER = False

try:
    from Engine5_Scoring.scripts.bd_scoring import (
        calculate_bd_score,
        score_batch,
    )
    HAS_SCORING = True
except ImportError:
    HAS_SCORING = False

try:
    from Engine2_ProgramMapping.scripts.exporters import (
        NotionCSVExporter,
        N8nWebhookExporter,
        export_batch as export_to_formats,
    )
    HAS_EXPORTERS = True
except ImportError:
    HAS_EXPORTERS = False


# ============================================
# STAGE 1: INGEST
# ============================================

def ingest_jobs(input_path: str) -> List[Dict[str, Any]]:
    """
    Stage 1: Ingest raw job data from Engine1_Scraper JSON output.

    Loads job postings from a JSON file produced by Engine1_Scraper.
    Validates basic structure and returns list of job dictionaries.

    Args:
        input_path: Path to JSON file containing scraped job postings.
                   Expected format: Array of job objects with fields like
                   id, title, company, location, description, etc.

    Returns:
        List of job dictionaries ready for parsing/standardization.

    Raises:
        FileNotFoundError: If input file does not exist.
        ValueError: If JSON is invalid or not a list.

    Example:
        >>> jobs = ingest_jobs('Engine1_Scraper/data/Sample_Jobs.json')
        >>> len(jobs)
        5
        >>> jobs[0]['title']
        'Senior Network Engineer - DCGS'
    """
    path = Path(input_path)

    # Validate file exists
    if not path.exists():
        raise FileNotFoundError(f"Input file not found: {input_path}")

    if not path.is_file():
        raise ValueError(f"Input path is not a file: {input_path}")

    # Load JSON data
    try:
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
    except json.JSONDecodeError as e:
        raise ValueError(f"Invalid JSON in {input_path}: {e}")

    # Validate data is a list
    if not isinstance(data, list):
        raise ValueError(f"Expected JSON array, got {type(data).__name__}")

    return data


# ============================================
# STAGE 2-3: PARSE AND STANDARDIZE
# ============================================

def parse_and_standardize(
    jobs: List[Dict[str, Any]],
    config: PipelineConfig,
    on_progress: Optional[Callable[[int, int, str], None]] = None
) -> List[Dict[str, Any]]:
    """
    Stage 2-3: Parse raw job text and standardize into 18-field schema.

    Uses the job_standardizer module to:
    1. Preprocess raw job data (clean HTML, normalize whitespace)
    2. Extract structured fields using Claude LLM
    3. Post-process with normalizations (location, clearance)
    4. Validate against schema

    Args:
        jobs: List of raw job dictionaries from ingest stage.
        config: PipelineConfig with API settings and processing options.
        on_progress: Optional callback(current, total, message) for progress.

    Returns:
        List of standardized job dictionaries with 18 extraction fields.

    Raises:
        ImportError: If job_standardizer module is not available.
    """
    if not HAS_STANDARDIZER:
        raise ImportError(
            "job_standardizer module not found. "
            "Ensure Engine2_ProgramMapping/scripts/job_standardizer.py exists."
        )

    results = []
    total = len(jobs)

    for i, raw_job in enumerate(jobs):
        try:
            # Stage 2: Preprocess
            cleaned = preprocess_job_data(raw_job)

            # Stage 3: Standardize with LLM (unless skip_llm is set)
            if config.skip_llm:
                # Use raw data as-is if skipping LLM
                standardized = cleaned.copy()
            else:
                standardized = standardize_job_with_llm(
                    cleaned,
                    api_key=config.anthropic_api_key
                )

            # Post-process normalizations
            if standardized.get('Location'):
                standardized['Location'] = normalize_location(standardized['Location'])
            if standardized.get('Security Clearance'):
                standardized['Security Clearance'] = normalize_clearance(
                    standardized['Security Clearance']
                )

            # Add metadata
            standardized['Processed At'] = datetime.now().isoformat()
            standardized['Source'] = raw_job.get('source', 'unknown')
            standardized['Source URL'] = raw_job.get('url', raw_job.get('link', ''))
            standardized['Scraped At'] = raw_job.get('scraped_at', raw_job.get('date', ''))

            # Preserve original data for reference
            standardized['_raw'] = raw_job

            results.append(standardized)

            if on_progress:
                on_progress(i + 1, total, f"Standardized: {standardized.get('Job Title/Position', 'Unknown')[:50]}")

        except Exception as e:
            # Add failed job with error info
            error_job = raw_job.copy()
            error_job['_error'] = str(e)
            error_job['_stage'] = 'standardize'
            results.append(error_job)

            if on_progress:
                on_progress(i + 1, total, f"Error: {str(e)[:50]}")

    return results


# ============================================
# STAGE 4: MATCH TO PROGRAMS
# ============================================

def match_to_programs(
    jobs: List[Dict[str, Any]],
    config: PipelineConfig,
    on_progress: Optional[Callable[[int, int, str], None]] = None
) -> List[Dict[str, Any]]:
    """
    Stage 4: Map standardized jobs to federal programs.

    Uses the program_mapper module to:
    1. Extract location signals (DCGS sites, IC locations)
    2. Extract keyword signals (program names, acronyms)
    3. Calculate match confidence and type
    4. Identify secondary candidates

    Args:
        jobs: List of standardized job dictionaries.
        config: PipelineConfig with matching thresholds.
        on_progress: Optional callback(current, total, message) for progress.

    Returns:
        List of jobs enriched with _mapping data:
        - program_name: Best matched program
        - match_confidence: 0.0-1.0 confidence score
        - match_type: 'direct', 'fuzzy', or 'inferred'
        - signals: List of matching signals
        - secondary_candidates: Other potential matches
    """
    if not HAS_MAPPER:
        raise ImportError(
            "program_mapper module not found. "
            "Ensure Engine2_ProgramMapping/scripts/program_mapper.py exists."
        )

    results = []
    total = len(jobs)

    for i, job in enumerate(jobs):
        try:
            # Skip jobs that failed previous stages
            if job.get('_error'):
                results.append(job)
                continue

            # Map to program using multi-signal scoring
            mapping_result = map_job_to_program(job)

            # Create enriched job with mapping data
            enriched = job.copy()
            enriched['_mapping'] = {
                'program_name': mapping_result.program_name,
                'match_confidence': mapping_result.match_confidence,
                'match_type': mapping_result.match_type,
                'bd_priority_score': mapping_result.bd_priority_score,
                'priority_tier': mapping_result.priority_tier,
                'signals': mapping_result.signals,
                'secondary_candidates': mapping_result.secondary_candidates,
            }

            # Also set top-level enrichment fields for easier access
            enriched['Matched Program'] = mapping_result.program_name
            enriched['Match Confidence'] = mapping_result.match_confidence
            enriched['Match Type'] = mapping_result.match_type
            enriched['Match Signals'] = mapping_result.signals

            results.append(enriched)

            if on_progress:
                on_progress(
                    i + 1, total,
                    f"Matched: {mapping_result.program_name} ({mapping_result.match_type})"
                )

        except Exception as e:
            # Preserve job with error info
            error_job = job.copy()
            error_job['_error'] = str(e)
            error_job['_stage'] = 'match'
            results.append(error_job)

            if on_progress:
                on_progress(i + 1, total, f"Error: {str(e)[:50]}")

    return results


# ============================================
# STAGE 5: CALCULATE BD SCORES
# ============================================

def calculate_bd_scores(
    jobs: List[Dict[str, Any]],
    config: PipelineConfig,
    on_progress: Optional[Callable[[int, int, str], None]] = None
) -> List[Dict[str, Any]]:
    """
    Stage 5: Calculate BD Priority Scores and tier classifications.

    Uses the bd_scoring module to:
    1. Calculate base score (50)
    2. Apply clearance boosts (0-35)
    3. Apply program boosts (0-15)
    4. Apply location boosts (0-10)
    5. Apply confidence boosts (0-20)
    6. Determine tier (Hot/Warm/Cold)

    Args:
        jobs: List of jobs with _mapping data.
        config: PipelineConfig with tier thresholds.
        on_progress: Optional callback(current, total, message) for progress.

    Returns:
        List of jobs enriched with _scoring data:
        - BD Priority Score: 0-100 score
        - Priority Tier: Hot/Warm/Cold
        - Score Breakdown: Component scores
        - Recommendations: Action items
    """
    if not HAS_SCORING:
        raise ImportError(
            "bd_scoring module not found. "
            "Ensure Engine5_Scoring/scripts/bd_scoring.py exists."
        )

    results = []
    total = len(jobs)

    for i, job in enumerate(jobs):
        try:
            # Skip jobs that failed previous stages
            if job.get('_error'):
                results.append(job)
                continue

            # Prepare scoring input from job + mapping data
            scoring_input = job.copy()

            # Add mapping data if available
            if '_mapping' in job:
                mapping = job['_mapping']
                scoring_input['match_confidence'] = mapping.get('match_confidence', 0.5)
                scoring_input['program'] = mapping.get('program_name', '')

            # Calculate BD score
            scoring_result = calculate_bd_score(scoring_input)

            # Create enriched job with scoring data
            enriched = job.copy()
            enriched['_scoring'] = {
                'BD Priority Score': scoring_result.bd_score,
                'Priority Tier': f"{scoring_result.tier_emoji} {scoring_result.tier}",
                'Score Breakdown': scoring_result.score_breakdown,
                'Recommendations': scoring_result.recommendations,
            }

            # Also set top-level enrichment fields
            enriched['BD Priority Score'] = scoring_result.bd_score
            enriched['Priority Tier'] = f"{scoring_result.tier_emoji} {scoring_result.tier}"

            results.append(enriched)

            if on_progress:
                on_progress(
                    i + 1, total,
                    f"Scored: {scoring_result.bd_score} ({scoring_result.tier})"
                )

        except Exception as e:
            # Preserve job with error info
            error_job = job.copy()
            error_job['_error'] = str(e)
            error_job['_stage'] = 'score'
            results.append(error_job)

            if on_progress:
                on_progress(i + 1, total, f"Error: {str(e)[:50]}")

    return results


# ============================================
# STAGE 6: EXPORT RESULTS
# ============================================

def export_results(
    jobs: List[Dict[str, Any]],
    config: PipelineConfig,
    on_progress: Optional[Callable[[int, int, str], None]] = None
) -> Dict[str, Any]:
    """
    Stage 6: Export enriched jobs to Notion CSV and n8n JSON formats.

    Uses the exporters module to:
    1. Export to Notion-compatible CSV (24 columns)
    2. Export to n8n webhook JSON (with _mapping and _scoring)
    3. Generate export report

    Args:
        jobs: List of fully enriched jobs with _mapping and _scoring.
        config: PipelineConfig with export formats and paths.
        on_progress: Optional callback(current, total, message) for progress.

    Returns:
        Dict with export results:
        - notion: ExportResult for Notion CSV
        - n8n: ExportResult for n8n JSON
        - report: Export summary statistics
    """
    if not HAS_EXPORTERS:
        raise ImportError(
            "exporters module not found. "
            "Ensure Engine2_ProgramMapping/scripts/exporters.py exists."
        )

    results = {}

    if on_progress:
        on_progress(0, len(config.export_formats), "Starting export...")

    # Export to Notion CSV
    if 'notion' in config.export_formats:
        exporter = NotionCSVExporter(output_dir=config.notion_output_dir)
        notion_result = exporter.export_jobs(jobs)
        results['notion'] = {
            'success': notion_result.success,
            'file_path': notion_result.file_path,
            'record_count': notion_result.record_count,
            'errors': notion_result.errors,
        }

        if on_progress:
            on_progress(1, len(config.export_formats), f"Notion CSV: {notion_result.file_path}")

    # Export to n8n JSON
    if 'n8n' in config.export_formats:
        exporter = N8nWebhookExporter(output_dir=config.n8n_output_dir)
        n8n_result = exporter.export_jobs(jobs)
        results['n8n'] = {
            'success': n8n_result.success,
            'file_path': n8n_result.file_path,
            'record_count': n8n_result.record_count,
            'errors': n8n_result.errors,
        }

        if on_progress:
            on_progress(2, len(config.export_formats), f"n8n JSON: {n8n_result.file_path}")

    # Generate summary report
    results['report'] = {
        'total_jobs': len(jobs),
        'successful_jobs': sum(1 for j in jobs if '_error' not in j),
        'failed_jobs': sum(1 for j in jobs if '_error' in j),
        'export_formats': config.export_formats,
        'timestamp': datetime.now().isoformat(),
    }

    return results


# ============================================
# STAGE 7: PLAYBOOK GENERATION
# ============================================

def generate_bd_playbooks(
    jobs: List[Dict[str, Any]],
    config: PipelineConfig,
    on_progress: Optional[Callable[[int, int, str], None]] = None
) -> Dict[str, Any]:
    """
    Stage 7: Generate BD Playbooks for Hot-tier opportunities.

    Uses Engine4_Playbook to create comprehensive sales playbooks for
    opportunities with BD Score >= min_score (default: 80).

    Args:
        jobs: List of enriched jobs with _mapping and _scoring.
        config: PipelineConfig with playbook settings.
        on_progress: Optional callback(current, total, message) for progress.

    Returns:
        Dict with playbook generation results:
        - generated: Number of playbooks generated
        - skipped: Number of jobs below threshold
        - output_dir: Directory where playbooks were saved
        - playbooks: List of playbook metadata
    """
    if not HAS_PLAYBOOK_GENERATOR:
        return {
            'generated': 0,
            'skipped': len(jobs),
            'output_dir': None,
            'playbooks': [],
            'error': 'Playbook generator not available'
        }

    if not config.generate_playbooks:
        return {
            'generated': 0,
            'skipped': len(jobs),
            'output_dir': None,
            'playbooks': [],
            'note': 'Playbook generation disabled in config'
        }

    # Count eligible jobs
    eligible = [j for j in jobs if j.get('_scoring', {}).get('BD Priority Score',
                j.get('BD Priority Score', 0)) >= config.playbook_min_score]

    if on_progress:
        on_progress(0, len(eligible), f"Found {len(eligible)} Hot-tier opportunities")

    if not eligible:
        return {
            'generated': 0,
            'skipped': len(jobs),
            'output_dir': config.playbook_output_dir,
            'playbooks': [],
            'note': f'No jobs with score >= {config.playbook_min_score}'
        }

    # Generate playbooks
    playbook_results = generate_playbooks_batch(
        jobs=eligible,
        output_dir=config.playbook_output_dir,
        min_score=config.playbook_min_score,
        include_contacts=config.include_contacts_in_playbook,
        output_formats=config.playbook_formats,
    )

    # Build result metadata
    playbooks_metadata = []
    for output in playbook_results:
        playbooks_metadata.append({
            'job_title': output.data.job_title,
            'program_name': output.data.program_name,
            'bd_score': output.data.bd_score,
            'priority_tier': output.data.priority_tier,
            'output_paths': output.output_paths,
            'generated_at': output.generated_at,
        })

    if on_progress:
        on_progress(len(playbook_results), len(eligible),
                   f"Generated {len(playbook_results)} playbooks")

    return {
        'generated': len(playbook_results),
        'skipped': len(jobs) - len(eligible),
        'output_dir': config.playbook_output_dir,
        'playbooks': playbooks_metadata,
    }


# ============================================
# MAIN PIPELINE ORCHESTRATOR
# ============================================

def run_pipeline(config: PipelineConfig) -> Dict[str, Any]:
    """
    Run the complete 7-stage pipeline.

    Orchestrates the full processing flow:
    1. INGEST: Load raw jobs from JSON
    2. PARSE: Clean and preprocess text
    3. STANDARDIZE: Extract structured fields with LLM
    4. MATCH: Map to federal programs
    5. SCORE: Calculate BD priority scores
    6. EXPORT: Write to Notion CSV and n8n JSON
    7. PLAYBOOKS: Generate BD playbooks for Hot-tier opportunities

    Args:
        config: PipelineConfig with all settings

    Returns:
        Dict with pipeline results:
        - jobs: List of enriched jobs
        - stats: Processing statistics
        - exports: Export file paths and results
        - errors: Any pipeline errors
    """
    start_time = datetime.now()
    pipeline_results = {
        'jobs': [],
        'stats': {
            'total_ingested': 0,
            'total_processed': 0,
            'successful': 0,
            'failed': 0,
            'by_tier': {'Hot': 0, 'Warm': 0, 'Cold': 0},
            'by_match_type': {'direct': 0, 'fuzzy': 0, 'inferred': 0},
        },
        'exports': {},
        'playbooks': {},
        'errors': [],
        'config': config.to_dict(),
    }

    # Progress callback
    def progress(current, total, message):
        if config.progress_callback:
            config.progress_callback(current, total, message)
        print(f"  [{current}/{total}] {message}")

    try:
        # Stage 1: Ingest
        print(f"\n{'='*60}")
        print("STAGE 1: INGEST")
        print(f"{'='*60}")

        jobs = ingest_jobs(config.input_path)
        pipeline_results['stats']['total_ingested'] = len(jobs)
        print(f"  Loaded {len(jobs)} jobs from {config.input_path}")

        # Apply test mode limit
        if config.test_mode:
            jobs = jobs[:3]
            print(f"  Test mode: processing first {len(jobs)} jobs")

        # Stage 2-3: Parse and Standardize
        print(f"\n{'='*60}")
        print("STAGE 2-3: PARSE AND STANDARDIZE")
        print(f"{'='*60}")

        jobs = parse_and_standardize(jobs, config, on_progress=progress)

        # Stage 4: Match to Programs
        print(f"\n{'='*60}")
        print("STAGE 4: MATCH TO PROGRAMS")
        print(f"{'='*60}")

        jobs = match_to_programs(jobs, config, on_progress=progress)

        # Stage 5: Calculate BD Scores
        print(f"\n{'='*60}")
        print("STAGE 5: CALCULATE BD SCORES")
        print(f"{'='*60}")

        jobs = calculate_bd_scores(jobs, config, on_progress=progress)

        # Stage 6: Export Results
        print(f"\n{'='*60}")
        print("STAGE 6: EXPORT RESULTS")
        print(f"{'='*60}")

        export_results_data = export_results(jobs, config, on_progress=progress)
        pipeline_results['exports'] = export_results_data

        # Stage 7: Generate Playbooks (for Hot-tier)
        print(f"\n{'='*60}")
        print("STAGE 7: GENERATE BD PLAYBOOKS")
        print(f"{'='*60}")

        playbook_results = generate_bd_playbooks(jobs, config, on_progress=progress)
        pipeline_results['playbooks'] = playbook_results

        # Calculate final statistics
        pipeline_results['jobs'] = jobs
        pipeline_results['stats']['total_processed'] = len(jobs)

        for job in jobs:
            if '_error' in job:
                pipeline_results['stats']['failed'] += 1
            else:
                pipeline_results['stats']['successful'] += 1

                # Count by tier
                tier = job.get('Priority Tier', 'Cold')
                if 'Hot' in tier:
                    pipeline_results['stats']['by_tier']['Hot'] += 1
                elif 'Warm' in tier:
                    pipeline_results['stats']['by_tier']['Warm'] += 1
                else:
                    pipeline_results['stats']['by_tier']['Cold'] += 1

                # Count by match type
                match_type = job.get('Match Type', 'inferred')
                if match_type in pipeline_results['stats']['by_match_type']:
                    pipeline_results['stats']['by_match_type'][match_type] += 1

    except Exception as e:
        pipeline_results['errors'].append(str(e))
        print(f"\n  Pipeline error: {e}")

    # Calculate duration
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    pipeline_results['stats']['duration_seconds'] = duration

    # Print summary
    print(f"\n{'='*60}")
    print("PIPELINE COMPLETE")
    print(f"{'='*60}")
    print(f"  Duration: {duration:.1f} seconds")
    print(f"  Processed: {pipeline_results['stats']['successful']}/{pipeline_results['stats']['total_processed']} jobs")
    print(f"  By Tier: Hot={pipeline_results['stats']['by_tier']['Hot']}, "
          f"Warm={pipeline_results['stats']['by_tier']['Warm']}, "
          f"Cold={pipeline_results['stats']['by_tier']['Cold']}")
    print(f"  By Match: Direct={pipeline_results['stats']['by_match_type']['direct']}, "
          f"Fuzzy={pipeline_results['stats']['by_match_type']['fuzzy']}, "
          f"Inferred={pipeline_results['stats']['by_match_type']['inferred']}")

    if pipeline_results['exports'].get('notion'):
        print(f"  Notion CSV: {pipeline_results['exports']['notion'].get('file_path', 'N/A')}")
    if pipeline_results['exports'].get('n8n'):
        print(f"  n8n JSON: {pipeline_results['exports']['n8n'].get('file_path', 'N/A')}")
    if pipeline_results['playbooks'].get('generated', 0) > 0:
        print(f"  Playbooks: {pipeline_results['playbooks']['generated']} generated → {pipeline_results['playbooks'].get('output_dir', 'N/A')}")

    return pipeline_results


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Program Mapping Pipeline - Process job postings through 7-stage enrichment pipeline',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Process sample jobs
  python pipeline.py --input ../Engine1_Scraper/data/Sample_Jobs.json --output ../outputs/

  # Test mode (first 3 jobs only)
  python pipeline.py --input ../Engine1_Scraper/data/Sample_Jobs.json --output ../outputs/ --test

  # Skip LLM processing (use existing standardized data)
  python pipeline.py --input ../Engine1_Scraper/data/Sample_Jobs.json --output ../outputs/ --skip-llm
        """
    )

    parser.add_argument(
        '--input', '-i',
        required=True,
        help='Input JSON file or directory with job postings'
    )
    parser.add_argument(
        '--output', '-o',
        required=True,
        help='Output directory for exports'
    )
    parser.add_argument(
        '--config', '-c',
        help='Path to configuration JSON file (default: ProgramMapping_Config.json)'
    )
    parser.add_argument(
        '--test',
        action='store_true',
        help='Test mode - process only first 3 jobs'
    )
    parser.add_argument(
        '--skip-llm',
        action='store_true',
        dest='skip_llm',
        help='Skip LLM-based extraction (for testing or pre-standardized data)'
    )
    parser.add_argument(
        '--format',
        choices=['notion', 'n8n', 'both'],
        default='both',
        help='Export format (default: both)'
    )
    parser.add_argument(
        '--batch-size',
        type=int,
        default=50,
        help='Number of jobs to process per batch (default: 50)'
    )
    parser.add_argument(
        '--show-config',
        action='store_true',
        help='Show loaded configuration and exit'
    )
    parser.add_argument(
        '--no-playbooks',
        action='store_true',
        dest='no_playbooks',
        help='Disable playbook generation for Hot-tier opportunities'
    )
    parser.add_argument(
        '--playbook-min-score',
        type=int,
        default=80,
        help='Minimum BD score for playbook generation (default: 80)'
    )

    args = parser.parse_args()

    # Build overrides from command line
    overrides = {
        'input_path': args.input,
        'output_dir': args.output,
        'test_mode': args.test,
        'skip_llm': args.skip_llm,
        'batch_size': args.batch_size,
    }

    if args.format == 'both':
        overrides['export_formats'] = ['notion', 'n8n']
    else:
        overrides['export_formats'] = [args.format]

    # Playbook options
    overrides['generate_playbooks'] = not args.no_playbooks
    overrides['playbook_min_score'] = args.playbook_min_score

    # Load configuration
    config = load_config(config_path=args.config, overrides=overrides)

    # Validate configuration
    errors = validate_config(config)
    if errors:
        print("Configuration errors:")
        for error in errors:
            print(f"  - {error}")
        exit(1)

    # Show config if requested
    if args.show_config:
        print("Pipeline Configuration:")
        print(json.dumps(config.to_dict(), indent=2))
        exit(0)

    # Run the pipeline
    print(f"Pipeline config loaded: {config.name} v{config.version}")
    print(f"  Input: {config.input_path}")
    print(f"  Output: {config.output_dir}")
    print(f"  Test Mode: {config.test_mode}")
    print(f"  Export Formats: {config.export_formats}")

    # Execute the pipeline
    results = run_pipeline(config)

    # Exit with error code if pipeline had failures
    if results['errors']:
        print(f"\nPipeline completed with errors:")
        for error in results['errors']:
            print(f"  - {error}")
        exit(1)

    # Print final message
    print(f"\nProcessed {results['stats']['successful']} jobs successfully.")
