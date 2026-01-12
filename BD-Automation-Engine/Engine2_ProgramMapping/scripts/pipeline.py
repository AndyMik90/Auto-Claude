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
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(
        description='Program Mapping Pipeline - Process job postings through 6-stage enrichment pipeline',
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

    # Pipeline execution will be implemented in subsequent subtasks
    print(f"Pipeline config loaded: {config.name} v{config.version}")
    print(f"  Input: {config.input_path}")
    print(f"  Output: {config.output_dir}")
    print(f"  Test Mode: {config.test_mode}")
    print(f"  Export Formats: {config.export_formats}")

    # Note: run_pipeline() will be added in subtask-4-7
    print("\n[Pipeline execution to be implemented in subtask-4-7]")
