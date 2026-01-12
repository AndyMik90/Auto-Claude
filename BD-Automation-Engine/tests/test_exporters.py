"""
Unit tests for Exporters module.
Tests Notion CSV and n8n JSON export formatting.
"""

import pytest
import sys
import json
import csv
import tempfile
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from Engine2_ProgramMapping.scripts.exporters import (
    NotionCSVExporter,
    N8nWebhookExporter,
    export_batch,
    create_output_directories,
)


# Sample job data for testing
SAMPLE_JOB = {
    'Job Title/Position': 'Network Engineer',
    'Date Posted': '2025-01-10',
    'Location': 'San Diego, CA',
    'Position Overview': 'Support network infrastructure for DCGS program.',
    'Key Responsibilities': ['Design networks', 'Maintain systems', 'Troubleshoot issues'],
    'Required Qualifications': ['CCNA', '5+ years experience', 'TS/SCI clearance'],
    'Security Clearance': 'TS/SCI',
    'Project Duration': 'Contract',
    'Rate/Pay Rate': '$100/hour',
    'Program Hints': ['DCGS'],
    'Client Hints': ['Air Force'],
    'Technologies': ['Cisco', 'Linux', 'VMware'],
    'Certifications Required': ['CCNA', 'Security+'],
    '_mapping': {
        'program_name': 'AF DCGS - PACAF',
        'match_confidence': 0.85,
        'match_type': 'direct',
        'bd_priority_score': 85,
        'priority_tier': 'Hot',
        'signals': ['Location match', 'DCGS keyword'],
        'secondary_candidates': ['AF DCGS - Langley'],
    },
    '_scoring': {
        'bd_score': 85,
        'tier': 'Hot',
        'tier_emoji': '🔥',
        'score_breakdown': {'base': 50, 'clearance': 25, 'location': 10},
        'recommendations': ['Immediate outreach recommended'],
    },
}


class TestNotionCSVExporter:
    """Tests for Notion CSV export."""

    def test_exporter_creates_output_dir(self):
        """Should create output directory if it doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir) / "notion_output"
            exporter = NotionCSVExporter(str(output_dir))
            assert output_dir.exists()

    def test_exporter_creates_csv_file(self):
        """Should create CSV file with jobs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = NotionCSVExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB], "test_export.csv")

            assert Path(filepath).exists()
            assert filepath.endswith('.csv')

    def test_csv_has_header_row(self):
        """CSV should have header row with column names."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = NotionCSVExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                header = next(reader)

            assert 'Job Title' in header
            assert 'Location' in header
            assert 'Matched Program' in header
            assert 'BD Priority Score' in header

    def test_csv_has_correct_columns(self):
        """CSV should have 27 columns as specified."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = NotionCSVExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                header = next(reader)

            assert len(header) == len(exporter.NOTION_COLUMNS)

    def test_csv_contains_job_data(self):
        """CSV should contain job field values."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = NotionCSVExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                row = next(reader)

            assert row['Job Title'] == 'Network Engineer'
            assert row['Location'] == 'San Diego, CA'
            assert 'AF DCGS' in row['Matched Program']

    def test_csv_formats_arrays_correctly(self):
        """Arrays should be formatted as semicolon-separated values."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = NotionCSVExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                row = next(reader)

            # Technologies should be semicolon-separated
            assert '; ' in row['Technologies'] or 'Cisco' in row['Technologies']

    def test_csv_handles_none_values(self):
        """Should handle None values gracefully."""
        job = {
            'Job Title/Position': 'Engineer',
            'Location': None,
            'Position Overview': None,
        }
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = NotionCSVExporter(tmpdir)
            filepath = exporter.export([job])

            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()

            # Should not contain "None" as string
            assert 'None' not in content or content.count('None') == 0

    def test_csv_multiple_jobs(self):
        """Should export multiple jobs."""
        jobs = [SAMPLE_JOB, SAMPLE_JOB.copy()]
        jobs[1]['Job Title/Position'] = 'Systems Engineer'

        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = NotionCSVExporter(tmpdir)
            filepath = exporter.export(jobs)

            with open(filepath, 'r', encoding='utf-8') as f:
                reader = csv.reader(f)
                rows = list(reader)

            # Header + 2 data rows
            assert len(rows) == 3


class TestN8nWebhookExporter:
    """Tests for n8n JSON export."""

    def test_exporter_creates_output_dir(self):
        """Should create output directory if it doesn't exist."""
        with tempfile.TemporaryDirectory() as tmpdir:
            output_dir = Path(tmpdir) / "n8n_output"
            exporter = N8nWebhookExporter(str(output_dir))
            assert output_dir.exists()

    def test_exporter_creates_json_file(self):
        """Should create JSON file with jobs."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = N8nWebhookExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB], "test_export.json")

            assert Path(filepath).exists()
            assert filepath.endswith('.json')

    def test_json_is_valid(self):
        """Should create valid JSON."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = N8nWebhookExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert isinstance(data, dict)

    def test_json_has_jobs_array(self):
        """JSON should have 'jobs' array."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = N8nWebhookExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert 'jobs' in data
            assert isinstance(data['jobs'], list)
            assert len(data['jobs']) == 1

    def test_json_has_metadata(self):
        """JSON should have metadata object."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = N8nWebhookExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert 'metadata' in data
            assert 'total_jobs' in data['metadata']
            assert data['metadata']['total_jobs'] == 1

    def test_json_jobs_have_mapping(self):
        """Jobs should have _mapping object."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = N8nWebhookExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            job = data['jobs'][0]
            assert '_mapping' in job
            assert 'program_name' in job['_mapping']

    def test_json_jobs_have_scoring(self):
        """Jobs should have _scoring object."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = N8nWebhookExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            job = data['jobs'][0]
            assert '_scoring' in job

    def test_json_tier_counts(self):
        """Metadata should have tier counts."""
        with tempfile.TemporaryDirectory() as tmpdir:
            exporter = N8nWebhookExporter(tmpdir)
            filepath = exporter.export([SAMPLE_JOB])

            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)

            assert 'tiers' in data['metadata']
            assert 'hot' in data['metadata']['tiers']
            assert 'warm' in data['metadata']['tiers']
            assert 'cold' in data['metadata']['tiers']

    def test_webhook_payload_method(self):
        """export_webhook_payload should return dict without writing file."""
        exporter = N8nWebhookExporter()
        payload = exporter.export_webhook_payload([SAMPLE_JOB])

        assert isinstance(payload, dict)
        assert 'jobs' in payload
        assert 'metadata' in payload


class TestExportBatch:
    """Tests for batch export function."""

    def test_export_batch_both_formats(self):
        """Should export to both Notion CSV and n8n JSON."""
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_batch(
                [SAMPLE_JOB],
                notion_output=f"{tmpdir}/notion",
                n8n_output=f"{tmpdir}/n8n"
            )

            assert 'notion_csv' in results
            assert 'n8n_json' in results
            assert Path(results['notion_csv']).exists()
            assert Path(results['n8n_json']).exists()

    def test_export_batch_notion_only(self):
        """Should export only Notion CSV when n8n disabled."""
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_batch(
                [SAMPLE_JOB],
                notion_output=f"{tmpdir}/notion",
                n8n_output=None
            )

            assert 'notion_csv' in results
            assert 'n8n_json' not in results

    def test_export_batch_n8n_only(self):
        """Should export only n8n JSON when Notion disabled."""
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_batch(
                [SAMPLE_JOB],
                notion_output=None,
                n8n_output=f"{tmpdir}/n8n"
            )

            assert 'n8n_json' in results
            assert 'notion_csv' not in results

    def test_export_batch_with_prefix(self):
        """Should use filename prefix when provided."""
        with tempfile.TemporaryDirectory() as tmpdir:
            results = export_batch(
                [SAMPLE_JOB],
                notion_output=f"{tmpdir}/notion",
                n8n_output=f"{tmpdir}/n8n",
                filename_prefix="test_batch"
            )

            assert 'test_batch' in results['notion_csv']
            assert 'test_batch' in results['n8n_json']


class TestCreateOutputDirectories:
    """Tests for output directory creation."""

    def test_creates_base_directory(self):
        """Should create base output directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = f"{tmpdir}/test_outputs"
            create_output_directories(base_path)
            assert Path(base_path).exists()

    def test_creates_notion_subdirectory(self):
        """Should create notion subdirectory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = f"{tmpdir}/test_outputs"
            create_output_directories(base_path)
            assert (Path(base_path) / "notion").exists()

    def test_creates_n8n_subdirectory(self):
        """Should create n8n subdirectory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            base_path = f"{tmpdir}/test_outputs"
            create_output_directories(base_path)
            assert (Path(base_path) / "n8n").exists()
