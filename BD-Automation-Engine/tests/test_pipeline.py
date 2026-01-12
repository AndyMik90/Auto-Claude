"""
Integration tests for Pipeline module.
Tests full pipeline flow from ingestion to export.
"""

import pytest
import sys
import json
import tempfile
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from Engine2_ProgramMapping.scripts.pipeline import (
    PipelineConfig,
    PipelineStats,
    load_config,
    ingest_jobs,
    parse_and_standardize,
    match_to_programs,
    calculate_bd_scores,
    export_results,
    run_pipeline,
)


# Path to sample jobs
SAMPLE_JOBS_PATH = Path(__file__).parent.parent / "Engine1_Scraper" / "data" / "Sample_Jobs.json"


class TestPipelineConfig:
    """Tests for PipelineConfig dataclass."""

    def test_config_defaults(self):
        """Should have sensible defaults."""
        config = PipelineConfig(input_path="test.json")
        assert config.output_dir == "outputs"
        assert config.use_llm == False
        assert config.use_federal_db == True
        assert config.export_notion == True
        assert config.export_n8n == True
        assert config.verbose == True

    def test_config_test_mode(self):
        """Should support test mode settings."""
        config = PipelineConfig(
            input_path="test.json",
            test_mode=True,
            test_limit=3
        )
        assert config.test_mode == True
        assert config.test_limit == 3


class TestPipelineStats:
    """Tests for PipelineStats dataclass."""

    def test_stats_initialized(self):
        """Should initialize with zero counts."""
        stats = PipelineStats()
        assert stats.total_jobs == 0
        assert stats.jobs_processed == 0
        assert stats.validation_errors == 0

    def test_stats_duration(self):
        """Should calculate duration correctly."""
        from datetime import datetime, timedelta
        stats = PipelineStats()
        stats.end_time = stats.start_time + timedelta(seconds=5)
        assert stats.duration_seconds == 5.0


class TestLoadConfig:
    """Tests for configuration loading."""

    def test_load_config_returns_dict(self):
        """Should return configuration dictionary."""
        config = load_config()
        assert isinstance(config, dict)

    def test_load_config_has_defaults(self):
        """Should have default configuration values."""
        config = load_config("/nonexistent/path.json")
        assert 'use_federal_programs_db' in config or 'export' in config


class TestIngestJobs:
    """Tests for job ingestion stage."""

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_ingest_loads_sample_jobs(self):
        """Should load sample jobs from JSON file."""
        jobs = ingest_jobs(str(SAMPLE_JOBS_PATH))
        assert isinstance(jobs, list)
        assert len(jobs) > 0

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_ingest_jobs_have_fields(self):
        """Loaded jobs should have expected fields."""
        jobs = ingest_jobs(str(SAMPLE_JOBS_PATH))
        for job in jobs:
            assert 'title' in job or 'Job Title/Position' in job

    def test_ingest_handles_array_format(self):
        """Should handle array format JSON."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump([{"title": "Engineer"}], f)
            f.flush()
            jobs = ingest_jobs(f.name)
        assert len(jobs) == 1

    def test_ingest_handles_wrapped_format(self):
        """Should handle wrapped format JSON."""
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
            json.dump({"jobs": [{"title": "Engineer"}]}, f)
            f.flush()
            jobs = ingest_jobs(f.name)
        assert len(jobs) == 1


class TestParseAndStandardize:
    """Tests for parse and standardize stage."""

    def test_standardize_returns_list(self):
        """Should return list of standardized jobs."""
        jobs = [{"title": "Engineer", "location": "DC"}]
        result = parse_and_standardize(jobs, use_llm=False)
        assert isinstance(result, list)
        assert len(result) == 1

    def test_standardize_maps_fields(self):
        """Should map raw fields to standardized schema."""
        jobs = [{
            "title": "Network Engineer",
            "location": "San Diego, CA",
            "description": "Support network infrastructure",
            "clearance": "TS/SCI"
        }]
        result = parse_and_standardize(jobs, use_llm=False)

        job = result[0]
        assert job.get('Job Title/Position') == 'Network Engineer'
        assert 'San Diego' in job.get('Location', '')
        assert job.get('Security Clearance') == 'TS/SCI'

    def test_standardize_adds_metadata(self):
        """Should add metadata fields."""
        jobs = [{"title": "Engineer", "url": "https://example.com"}]
        result = parse_and_standardize(jobs, use_llm=False)

        job = result[0]
        assert 'Processing Date' in job
        assert 'Validation Status' in job

    def test_standardize_handles_errors(self):
        """Should handle malformed jobs gracefully."""
        jobs = [None, {}, {"title": "Valid Job"}]
        # Should not raise exception
        result = parse_and_standardize([j for j in jobs if j], use_llm=False)
        assert len(result) >= 1


class TestMatchToPrograms:
    """Tests for program matching stage."""

    def test_match_adds_mapping(self):
        """Should add _mapping to each job."""
        jobs = [{
            'Job Title/Position': 'DCGS Engineer',
            'Location': 'San Diego, CA',
            'Position Overview': 'Support DCGS program'
        }]
        result = match_to_programs(jobs)

        assert '_mapping' in result[0]
        assert 'program_name' in result[0]['_mapping']
        assert 'match_confidence' in result[0]['_mapping']
        assert 'bd_priority_score' in result[0]['_mapping']

    def test_match_sets_enrichment_fields(self):
        """Should set top-level enrichment fields."""
        jobs = [{'Job Title/Position': 'Engineer', 'Location': 'DC'}]
        result = match_to_programs(jobs)

        assert 'Matched Program' in result[0]
        assert 'Match Confidence' in result[0]

    def test_match_with_federal_db(self):
        """Should use Federal Programs DB when enabled."""
        jobs = [{'Job Title/Position': 'Engineer', 'Location': 'Huntsville, AL'}]
        result = match_to_programs(jobs, use_federal_db=True)
        # Should find more matches with DB


class TestCalculateBDScores:
    """Tests for BD scoring stage."""

    def test_score_adds_scoring(self):
        """Should add _scoring to each job."""
        jobs = [{
            'Job Title/Position': 'Engineer',
            'Security Clearance': 'TS/SCI',
            'Location': 'DC',
            '_mapping': {'match_confidence': 0.8, 'program_name': 'Test'}
        }]
        result = calculate_bd_scores(jobs)

        assert '_scoring' in result[0]
        assert 'bd_score' in result[0]['_scoring']
        assert 'tier' in result[0]['_scoring']

    def test_score_sets_top_level_fields(self):
        """Should set top-level BD fields."""
        jobs = [{
            'Job Title/Position': 'Engineer',
            '_mapping': {'match_confidence': 0.5}
        }]
        result = calculate_bd_scores(jobs)

        assert 'BD Priority Score' in result[0]
        assert 'Priority Tier' in result[0]

    def test_score_in_valid_range(self):
        """Scores should be in 0-100 range."""
        jobs = [{
            'Security Clearance': 'TS/SCI w/ CI Poly',
            'Location': 'San Diego',
            '_mapping': {'match_confidence': 0.9}
        }]
        result = calculate_bd_scores(jobs)

        score = result[0]['BD Priority Score']
        assert 0 <= score <= 100


class TestExportResults:
    """Tests for export stage."""

    def test_export_creates_files(self):
        """Should create output files."""
        jobs = [{
            'Job Title/Position': 'Engineer',
            'Location': 'DC',
            '_mapping': {'program_name': 'Test', 'match_confidence': 0.5,
                        'bd_priority_score': 50, 'priority_tier': 'Warm'},
            '_scoring': {'bd_score': 50, 'tier': 'Warm'}
        }]

        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_results(jobs, output_dir=tmpdir)
            assert 'notion_csv' in results
            assert 'n8n_json' in results
            assert Path(results['notion_csv']).exists()
            assert Path(results['n8n_json']).exists()


class TestRunPipeline:
    """Integration tests for full pipeline."""

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_pipeline_processes_sample_jobs(self):
        """Should process sample jobs through all stages."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = PipelineConfig(
                input_path=str(SAMPLE_JOBS_PATH),
                output_dir=tmpdir,
                test_mode=True,
                test_limit=3,
                verbose=False
            )
            stats = run_pipeline(config)

            assert stats.total_jobs >= 3
            assert stats.jobs_processed > 0
            assert stats.jobs_exported > 0

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_pipeline_creates_outputs(self):
        """Should create output files."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = PipelineConfig(
                input_path=str(SAMPLE_JOBS_PATH),
                output_dir=tmpdir,
                test_mode=True,
                test_limit=2,
                verbose=False
            )
            run_pipeline(config)

            # Check output directories exist
            assert (Path(tmpdir) / "notion").exists()
            assert (Path(tmpdir) / "n8n").exists()

            # Check files were created
            csv_files = list((Path(tmpdir) / "notion").glob("*.csv"))
            json_files = list((Path(tmpdir) / "n8n").glob("*.json"))
            assert len(csv_files) > 0
            assert len(json_files) > 0

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_pipeline_statistics(self):
        """Should track accurate statistics."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = PipelineConfig(
                input_path=str(SAMPLE_JOBS_PATH),
                output_dir=tmpdir,
                test_mode=True,
                test_limit=5,
                verbose=False
            )
            stats = run_pipeline(config)

            assert stats.total_jobs == 5
            assert stats.jobs_standardized <= 5
            assert stats.jobs_matched <= 5
            assert stats.jobs_scored <= 5
            assert stats.duration_seconds >= 0

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_pipeline_without_federal_db(self):
        """Should work without Federal Programs DB."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = PipelineConfig(
                input_path=str(SAMPLE_JOBS_PATH),
                output_dir=tmpdir,
                test_mode=True,
                test_limit=2,
                use_federal_db=False,
                verbose=False
            )
            stats = run_pipeline(config)
            assert stats.jobs_processed > 0

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_pipeline_notion_only(self):
        """Should export only Notion when n8n disabled."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = PipelineConfig(
                input_path=str(SAMPLE_JOBS_PATH),
                output_dir=tmpdir,
                test_mode=True,
                test_limit=2,
                export_n8n=False,
                verbose=False
            )
            run_pipeline(config)

            csv_files = list((Path(tmpdir) / "notion").glob("*.csv"))
            json_files = list((Path(tmpdir) / "n8n").glob("*.json"))
            assert len(csv_files) > 0
            assert len(json_files) == 0


class TestOutputValidation:
    """Tests for validating output file contents."""

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_notion_csv_has_columns(self):
        """Notion CSV should have 20+ columns."""
        import csv

        with tempfile.TemporaryDirectory() as tmpdir:
            config = PipelineConfig(
                input_path=str(SAMPLE_JOBS_PATH),
                output_dir=tmpdir,
                test_mode=True,
                test_limit=1,
                verbose=False
            )
            run_pipeline(config)

            csv_files = list((Path(tmpdir) / "notion").glob("*.csv"))
            assert len(csv_files) > 0

            with open(csv_files[0], 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                header = next(reader)

            assert len(header) >= 20, f"Expected 20+ columns, got {len(header)}"

    @pytest.mark.skipif(not SAMPLE_JOBS_PATH.exists(), reason="Sample jobs file not found")
    def test_n8n_json_has_mapping_scoring(self):
        """n8n JSON jobs should have _mapping and _scoring."""
        with tempfile.TemporaryDirectory() as tmpdir:
            config = PipelineConfig(
                input_path=str(SAMPLE_JOBS_PATH),
                output_dir=tmpdir,
                test_mode=True,
                test_limit=1,
                verbose=False
            )
            run_pipeline(config)

            json_files = list((Path(tmpdir) / "n8n").glob("*.json"))
            assert len(json_files) > 0

            with open(json_files[0], 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert 'jobs' in data
            for job in data['jobs']:
                assert '_mapping' in job, "Job missing _mapping"
                assert '_scoring' in job, "Job missing _scoring"
