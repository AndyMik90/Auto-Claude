"""
Tests for exporters.py - Export Modules

Tests Notion CSV and n8n webhook JSON export functionality.
"""

import pytest
import json
import csv
import tempfile
import sys
from pathlib import Path

# Add the BD-Automation-Engine to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "BD-Automation-Engine"))

from Engine2_ProgramMapping.scripts.exporters import (
    NotionCSVExporter,
    N8nWebhookExporter,
    export_batch,
    generate_export_report,
    ExportResult,
    NOTION_COLUMN_ORDER,
    NOTION_REQUIRED_COLUMNS,
    NOTION_INTELLIGENCE_COLUMNS,
    NOTION_ENRICHMENT_COLUMNS,
    NOTION_METADATA_COLUMNS,
)


# ============================================
# COLUMN DEFINITION TESTS
# ============================================

class TestColumnDefinitions:
    """Test column definitions for exports."""

    def test_notion_required_columns_count(self):
        """Verify 6 required columns defined."""
        assert len(NOTION_REQUIRED_COLUMNS) == 6

    def test_notion_intelligence_columns_count(self):
        """Verify 8 intelligence columns defined."""
        assert len(NOTION_INTELLIGENCE_COLUMNS) == 8

    def test_notion_enrichment_columns_count(self):
        """Verify 6 enrichment columns defined."""
        assert len(NOTION_ENRICHMENT_COLUMNS) == 6

    def test_notion_metadata_columns_count(self):
        """Verify 4 metadata columns defined."""
        assert len(NOTION_METADATA_COLUMNS) == 4

    def test_notion_column_order_total(self):
        """Verify total column count is 24."""
        assert len(NOTION_COLUMN_ORDER) == 24

    def test_column_order_includes_required(self):
        """Verify column order includes all required columns."""
        for col in NOTION_REQUIRED_COLUMNS:
            assert col in NOTION_COLUMN_ORDER


# ============================================
# NOTION CSV EXPORTER TESTS
# ============================================

class TestNotionCSVExporter:
    """Test Notion CSV export functionality."""

    @pytest.fixture
    def exporter(self, tmp_path):
        """Create exporter with temporary output directory."""
        return NotionCSVExporter(output_dir=str(tmp_path))

    @pytest.fixture
    def sample_jobs(self):
        """Create sample enriched jobs for testing."""
        return [
            {
                'Job Title/Position': 'Software Engineer',
                'Date Posted': '2026-01-12',
                'Location': 'San Diego, CA',
                'Position Overview': 'Work on systems',
                'Key Responsibilities': ['Code', 'Review', 'Test'],
                'Required Qualifications': ['Python', 'AWS'],
                'Security Clearance': 'TS/SCI',
                'Program Hints': ['DCGS'],
                'Client Hints': ['DoD'],
                'Contract Vehicle Hints': None,
                'Prime Contractor': 'BAE',
                'Recruiter Contact': {'name': 'John', 'email': 'j@e.com'},
                'Technologies': ['Python', 'AWS'],
                'Certifications Required': ['Security+'],
                '_mapping': {
                    'program_name': 'AF DCGS',
                    'match_confidence': 0.85,
                    'match_type': 'direct',
                    'bd_priority_score': 75,
                    'priority_tier': 'Warm',
                    'signals': ['location match'],
                },
                'Source': 'test',
                'Source URL': 'http://test.com',
                'Scraped At': '2026-01-12T00:00:00Z',
                'Processed At': '2026-01-12T01:00:00Z',
            }
        ]

    def test_export_creates_file(self, exporter, sample_jobs, tmp_path):
        """Test export creates CSV file."""
        result = exporter.export_jobs(sample_jobs, filename='test.csv')

        assert result.success is True
        assert Path(result.file_path).exists()

    def test_export_returns_correct_count(self, exporter, sample_jobs):
        """Test export returns correct record count."""
        result = exporter.export_jobs(sample_jobs)

        assert result.record_count == len(sample_jobs)

    def test_export_includes_header(self, exporter, sample_jobs, tmp_path):
        """Test export includes header row."""
        result = exporter.export_jobs(sample_jobs, filename='test.csv')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)

        assert header == list(NOTION_COLUMN_ORDER)

    def test_export_has_correct_columns(self, exporter, sample_jobs, tmp_path):
        """Test exported CSV has 24 columns."""
        result = exporter.export_jobs(sample_jobs, filename='test.csv')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)

        assert len(header) == 24

    def test_array_fields_formatted(self, exporter, sample_jobs, tmp_path):
        """Test array fields are comma-separated."""
        result = exporter.export_jobs(sample_jobs, filename='test.csv')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            row = next(reader)

        # Key Responsibilities should be comma-separated
        assert 'Code' in row['Key Responsibilities']
        assert ',' in row['Key Responsibilities']

    def test_confidence_formatted_as_percentage(self, exporter, sample_jobs, tmp_path):
        """Test confidence is formatted as percentage."""
        result = exporter.export_jobs(sample_jobs, filename='test.csv')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            row = next(reader)

        # Should be "85%" not "0.85"
        assert '%' in row['Match Confidence']

    def test_export_without_header(self, exporter, sample_jobs, tmp_path):
        """Test export without header row."""
        result = exporter.export_jobs(sample_jobs, filename='test.csv', include_header=False)

        with open(result.file_path, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            first_row = next(reader)

        # First row should be data, not header
        assert first_row[0] == 'Software Engineer'


class TestNotionCSVBatchExport:
    """Test Notion CSV batch export."""

    def test_batch_export_creates_multiple_files(self, tmp_path):
        """Test batch export creates multiple files for large dataset."""
        exporter = NotionCSVExporter(output_dir=str(tmp_path))

        # Create 5 jobs
        jobs = [
            {'Job Title/Position': f'Job {i}'} for i in range(5)
        ]

        results = exporter.export_batch(jobs, batch_size=2)

        # Should create 3 files (2 + 2 + 1)
        assert len(results) == 3


# ============================================
# N8N WEBHOOK EXPORTER TESTS
# ============================================

class TestN8nWebhookExporter:
    """Test n8n webhook JSON export functionality."""

    @pytest.fixture
    def exporter(self, tmp_path):
        """Create exporter with temporary output directory."""
        return N8nWebhookExporter(output_dir=str(tmp_path))

    @pytest.fixture
    def sample_jobs(self):
        """Create sample enriched jobs for testing."""
        return [
            {
                'Job Title/Position': 'Analyst',
                'Location': 'DC',
                '_mapping': {
                    'program_name': 'Test Program',
                    'match_confidence': 0.75,
                },
                '_scoring': {
                    'BD Priority Score': 65,
                    'Priority Tier': 'Warm',
                },
            }
        ]

    def test_export_creates_json_file(self, exporter, sample_jobs):
        """Test export creates JSON file."""
        result = exporter.export_jobs(sample_jobs, filename='test.json')

        assert result.success is True
        assert Path(result.file_path).exists()

    def test_export_valid_json(self, exporter, sample_jobs):
        """Test export produces valid JSON."""
        result = exporter.export_jobs(sample_jobs, filename='test.json')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        assert 'jobs' in data
        assert 'metadata' in data

    def test_export_includes_mapping(self, exporter, sample_jobs):
        """Test export includes _mapping data."""
        result = exporter.export_jobs(sample_jobs, filename='test.json')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        job = data['jobs'][0]
        assert '_mapping' in job
        assert job['_mapping']['program_name'] == 'Test Program'

    def test_export_includes_scoring(self, exporter, sample_jobs):
        """Test export includes _scoring data."""
        result = exporter.export_jobs(sample_jobs, filename='test.json')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        job = data['jobs'][0]
        assert '_scoring' in job
        assert job['_scoring']['BD Priority Score'] == 65

    def test_export_adds_webhook_metadata(self, exporter, sample_jobs):
        """Test export adds webhook metadata."""
        result = exporter.export_jobs(sample_jobs, filename='test.json')

        with open(result.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        job = data['jobs'][0]
        assert '_webhook_metadata' in job
        assert 'exported_at' in job['_webhook_metadata']

    def test_export_single_job(self, exporter):
        """Test exporting single job payload."""
        job = {'title': 'Test Job'}
        payload = exporter.export_single(job)

        assert '_mapping' in payload
        assert '_scoring' in payload
        assert '_webhook_metadata' in payload


# ============================================
# BATCH EXPORT CONVENIENCE FUNCTION TESTS
# ============================================

class TestExportBatch:
    """Test export_batch convenience function."""

    def test_export_both_formats(self, tmp_path):
        """Test exporting to both Notion and n8n formats."""
        jobs = [{'Job Title/Position': 'Test'}]

        results = export_batch(
            jobs,
            output_dir=str(tmp_path),
            formats=['notion', 'n8n']
        )

        assert 'notion' in results
        assert 'n8n' in results
        assert results['notion'].success
        assert results['n8n'].success

    def test_export_notion_only(self, tmp_path):
        """Test exporting to Notion only."""
        jobs = [{'Job Title/Position': 'Test'}]

        results = export_batch(
            jobs,
            output_dir=str(tmp_path),
            formats=['notion']
        )

        assert 'notion' in results
        assert 'n8n' not in results

    def test_export_n8n_only(self, tmp_path):
        """Test exporting to n8n only."""
        jobs = [{'Job Title/Position': 'Test'}]

        results = export_batch(
            jobs,
            output_dir=str(tmp_path),
            formats=['n8n']
        )

        assert 'n8n' in results
        assert 'notion' not in results


# ============================================
# EXPORT REPORT TESTS
# ============================================

class TestExportReport:
    """Test export report generation."""

    def test_report_counts_success(self, tmp_path):
        """Test report counts successful exports."""
        jobs = [{'Job Title/Position': 'Test'}]
        results = export_batch(jobs, output_dir=str(tmp_path))

        report = generate_export_report(results)

        assert report['successful_exports'] >= 1
        assert report['total_formats'] == len(results)

    def test_report_includes_timestamp(self, tmp_path):
        """Test report includes timestamp."""
        jobs = [{'Job Title/Position': 'Test'}]
        results = export_batch(jobs, output_dir=str(tmp_path))

        report = generate_export_report(results)

        assert 'timestamp' in report

    def test_report_includes_record_count(self, tmp_path):
        """Test report includes total record count."""
        jobs = [{'Job Title/Position': 'Test'}]
        results = export_batch(jobs, output_dir=str(tmp_path))

        report = generate_export_report(results)

        assert report['total_records'] >= 1


# ============================================
# EXPORT RESULT DATACLASS TESTS
# ============================================

class TestExportResult:
    """Test ExportResult dataclass."""

    def test_export_result_fields(self):
        """Test ExportResult has all required fields."""
        result = ExportResult(
            success=True,
            file_path='/path/to/file.csv',
            record_count=10,
            errors=[],
            metadata={'format': 'csv'}
        )

        assert result.success is True
        assert result.file_path == '/path/to/file.csv'
        assert result.record_count == 10
        assert result.errors == []
        assert result.metadata == {'format': 'csv'}

    def test_export_result_default_errors(self):
        """Test ExportResult has empty errors by default."""
        result = ExportResult(
            success=True,
            file_path='/path/to/file.csv',
            record_count=5
        )

        assert result.errors == []
        assert result.metadata == {}
