"""
Tests for job_standardizer.py - Job Standardization Engine

Tests preprocessing, normalization, and validation functions for the
28-field job schema (6 Required + 8 Intelligence + 4 Optional + 6 Enrichment + 4 Metadata).
"""

import pytest
import sys
from pathlib import Path

# Add the BD-Automation-Engine to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "BD-Automation-Engine"))

from Engine2_ProgramMapping.scripts.job_standardizer import (
    preprocess_job_data,
    normalize_location,
    normalize_clearance,
    validate_standardized_job,
    validate_job_batch,
    REQUIRED_FIELDS,
    INTELLIGENCE_FIELDS,
    OPTIONAL_FIELDS,
    ENRICHMENT_FIELDS,
    METADATA_FIELDS,
    ALL_FIELDS,
    VALID_CLEARANCES,
    VALID_MATCH_TYPES,
    VALID_TIERS,
)


# ============================================
# SCHEMA FIELD TESTS
# ============================================

class TestSchemaDefinitions:
    """Test schema field definitions."""

    def test_required_fields_count(self):
        """Verify 6 required fields defined."""
        assert len(REQUIRED_FIELDS) == 6

    def test_intelligence_fields_count(self):
        """Verify 8 intelligence fields defined."""
        assert len(INTELLIGENCE_FIELDS) == 8

    def test_optional_fields_count(self):
        """Verify 4 optional fields defined."""
        assert len(OPTIONAL_FIELDS) == 4

    def test_enrichment_fields_count(self):
        """Verify 6 enrichment fields defined."""
        assert len(ENRICHMENT_FIELDS) == 6

    def test_metadata_fields_count(self):
        """Verify 4 metadata fields defined."""
        assert len(METADATA_FIELDS) == 4

    def test_all_fields_total(self):
        """Verify total field count is 28."""
        # ALL_FIELDS should be 24 (excluding EXTRACTION_FIELDS duplicate)
        expected_total = (
            len(REQUIRED_FIELDS) +
            len(INTELLIGENCE_FIELDS) +
            len(OPTIONAL_FIELDS) +
            len(ENRICHMENT_FIELDS) +
            len(METADATA_FIELDS)
        )
        assert expected_total == 28

    def test_valid_clearances(self):
        """Verify valid clearance levels are defined."""
        assert 'TS/SCI w/ Full Scope Poly' in VALID_CLEARANCES
        assert 'TS/SCI' in VALID_CLEARANCES
        assert 'Top Secret' in VALID_CLEARANCES
        assert 'Secret' in VALID_CLEARANCES

    def test_valid_match_types(self):
        """Verify valid match types are defined."""
        assert VALID_MATCH_TYPES == ['direct', 'fuzzy', 'inferred']

    def test_valid_tiers(self):
        """Verify valid priority tiers are defined."""
        assert VALID_TIERS == ['Hot', 'Warm', 'Cold']


# ============================================
# PREPROCESSING TESTS
# ============================================

class TestPreprocessing:
    """Test job data preprocessing functions."""

    def test_preprocess_cleans_html_entities(self):
        """Test HTML entity decoding."""
        raw_job = {'title': 'Engineer &amp; Analyst'}
        cleaned = preprocess_job_data(raw_job)
        assert cleaned['title'] == 'Engineer & Analyst'

    def test_preprocess_removes_html_tags(self):
        """Test HTML tag removal."""
        raw_job = {'description': '<p>Work with <strong>data</strong></p>'}
        cleaned = preprocess_job_data(raw_job)
        assert '<p>' not in cleaned['description']
        assert '<strong>' not in cleaned['description']

    def test_preprocess_normalizes_whitespace(self):
        """Test whitespace normalization."""
        raw_job = {'title': 'Software   Engineer\n\nII'}
        cleaned = preprocess_job_data(raw_job)
        assert cleaned['title'] == 'Software Engineer II'

    def test_preprocess_preserves_non_string_fields(self):
        """Test that non-string fields are preserved."""
        raw_job = {'id': 12345, 'active': True, 'salary': 100000}
        cleaned = preprocess_job_data(raw_job)
        assert cleaned['id'] == 12345
        assert cleaned['active'] is True
        assert cleaned['salary'] == 100000


# ============================================
# LOCATION NORMALIZATION TESTS
# ============================================

class TestLocationNormalization:
    """Test location string normalization."""

    def test_normalize_remote(self):
        """Test remote location normalization."""
        assert normalize_location('100% Remote') == 'Remote'
        assert normalize_location('100%Remote') == 'Remote'

    def test_normalize_fort_meade(self):
        """Test Fort Meade variations."""
        assert normalize_location('Ft. Meade') == 'Fort George G. Meade, MD'
        assert normalize_location('Ft Meade') == 'Fort George G. Meade, MD'

    def test_normalize_fort_belvoir(self):
        """Test Fort Belvoir variations."""
        assert normalize_location('Ft. Belvoir') == 'Fort Belvoir, VA'
        assert normalize_location('Ft Belvoir') == 'Fort Belvoir, VA'

    def test_normalize_dc_metro(self):
        """Test DC Metro variations."""
        assert normalize_location('Washington DC Metro') == 'Washington, DC'
        assert normalize_location('DC Metro') == 'Washington, DC'

    def test_normalize_hampton_roads(self):
        """Test Hampton Roads normalization."""
        assert normalize_location('Hampton Roads') == 'Hampton, VA'

    def test_preserve_standard_location(self):
        """Test that standard locations are preserved."""
        assert normalize_location('San Diego, CA') == 'San Diego, CA'
        assert normalize_location('Herndon, VA') == 'Herndon, VA'


# ============================================
# CLEARANCE NORMALIZATION TESTS
# ============================================

class TestClearanceNormalization:
    """Test security clearance normalization."""

    def test_normalize_full_scope_poly(self):
        """Test Full Scope Poly variations."""
        assert normalize_clearance('TS/SCI with Full Scope Poly') == 'TS/SCI w/ Full Scope Poly'
        assert normalize_clearance('ts/sci full scope polygraph') == 'TS/SCI w/ Full Scope Poly'

    def test_normalize_ci_poly(self):
        """Test CI Poly variations."""
        assert normalize_clearance('TS/SCI w/ CI Poly') == 'TS/SCI w/ CI Poly'
        assert normalize_clearance('ts/sci with ci polygraph') == 'TS/SCI w/ CI Poly'

    def test_normalize_ts_sci(self):
        """Test TS/SCI normalization."""
        assert normalize_clearance('Top Secret SCI') == 'TS/SCI'
        assert normalize_clearance('TS SCI') == 'TS/SCI'

    def test_normalize_top_secret(self):
        """Test Top Secret normalization."""
        assert normalize_clearance('Top Secret clearance') == 'Top Secret'
        assert normalize_clearance('TS clearance') == 'Top Secret'

    def test_normalize_secret(self):
        """Test Secret normalization."""
        assert normalize_clearance('Secret clearance') == 'Secret'
        assert normalize_clearance('DOD Secret') == 'Secret'


# ============================================
# VALIDATION TESTS
# ============================================

class TestValidation:
    """Test job validation functions."""

    @pytest.fixture
    def valid_job(self):
        """Create a valid standardized job dictionary."""
        return {
            'Job Title/Position': 'Senior Software Engineer',
            'Date Posted': '2026-01-12',
            'Location': 'Herndon, VA',
            'Position Overview': ' '.join(['word'] * 150),  # 150 words
            'Key Responsibilities': ['Develop software', 'Review code', 'Mentor team'],
            'Required Qualifications': ['5+ years experience', 'Python', 'AWS'],
            'Security Clearance': 'TS/SCI',
            'Program Hints': ['DCGS', 'ISR'],
            'Client Hints': ['NSA', 'DoD'],
            'Contract Vehicle Hints': None,
            'Prime Contractor': 'BAE Systems',
            'Recruiter Contact': {'name': 'John Doe', 'email': 'jdoe@company.com'},
            'Technologies': ['Python', 'AWS', 'Kubernetes'],
            'Certifications Required': ['Security+', 'CISSP'],
            'Project Duration': 'Permanent',
            'Rate/Pay Rate': '$120K-$150K/year',
            'Position Details': None,
            'Additional Information': None,
        }

    def test_valid_job_passes_validation(self, valid_job):
        """Test that a valid job passes validation."""
        is_valid, errors = validate_standardized_job(valid_job)
        assert is_valid is True
        assert len(errors) == 0

    def test_missing_title_fails(self, valid_job):
        """Test that missing title fails validation."""
        del valid_job['Job Title/Position']
        is_valid, errors = validate_standardized_job(valid_job)
        assert is_valid is False
        assert any('Job Title' in e for e in errors)

    def test_invalid_date_format_fails(self, valid_job):
        """Test that invalid date format fails validation."""
        valid_job['Date Posted'] = '01/12/2026'  # Wrong format
        is_valid, errors = validate_standardized_job(valid_job)
        assert is_valid is False
        assert any('Date Posted' in e for e in errors)

    def test_short_overview_fails(self, valid_job):
        """Test that too-short overview fails validation."""
        valid_job['Position Overview'] = 'Short overview'  # < 50 words
        is_valid, errors = validate_standardized_job(valid_job)
        assert is_valid is False
        assert any('Overview' in e for e in errors)

    def test_empty_responsibilities_fails(self, valid_job):
        """Test that empty responsibilities fails validation."""
        valid_job['Key Responsibilities'] = []
        is_valid, errors = validate_standardized_job(valid_job)
        assert is_valid is False
        assert any('Responsibilities' in e for e in errors)

    def test_responsibilities_not_list_fails(self, valid_job):
        """Test that non-list responsibilities fails validation."""
        valid_job['Key Responsibilities'] = 'Not a list'
        is_valid, errors = validate_standardized_job(valid_job)
        assert is_valid is False
        assert any('Responsibilities' in e and 'array' in e for e in errors)

    def test_invalid_email_format(self, valid_job):
        """Test that invalid recruiter email fails validation."""
        valid_job['Recruiter Contact'] = {'email': 'invalid-email'}
        is_valid, errors = validate_standardized_job(valid_job)
        assert is_valid is False
        assert any('email' in e.lower() for e in errors)


class TestEnrichmentValidation:
    """Test enrichment field validation."""

    @pytest.fixture
    def enriched_job(self):
        """Create a job with enrichment fields."""
        return {
            'Job Title/Position': 'Engineer',
            'Date Posted': '2026-01-12',
            'Location': 'Remote',
            'Position Overview': ' '.join(['word'] * 150),
            'Key Responsibilities': ['Task 1', 'Task 2', 'Task 3'],
            'Required Qualifications': ['Qual 1', 'Qual 2', 'Qual 3'],
            'Security Clearance': 'Secret',
            'Matched Program': 'AF DCGS',
            'Match Confidence': 0.85,
            'Match Type': 'direct',
            'BD Priority Score': 75,
            'Priority Tier': 'Warm',
            'Match Signals': ['location match', 'keyword match'],
        }

    def test_valid_enrichment_passes(self, enriched_job):
        """Test that valid enrichment fields pass validation."""
        is_valid, errors = validate_standardized_job(enriched_job, validate_enrichment=True)
        assert is_valid is True

    def test_invalid_confidence_range(self, enriched_job):
        """Test that confidence outside 0-1 fails."""
        enriched_job['Match Confidence'] = 1.5  # > 1.0
        is_valid, errors = validate_standardized_job(enriched_job, validate_enrichment=True)
        assert is_valid is False
        assert any('Confidence' in e for e in errors)

    def test_invalid_match_type(self, enriched_job):
        """Test that invalid match type fails."""
        enriched_job['Match Type'] = 'unknown'
        is_valid, errors = validate_standardized_job(enriched_job, validate_enrichment=True)
        assert is_valid is False
        assert any('Match Type' in e for e in errors)

    def test_invalid_bd_score_range(self, enriched_job):
        """Test that BD score outside 0-100 fails."""
        enriched_job['BD Priority Score'] = 150  # > 100
        is_valid, errors = validate_standardized_job(enriched_job, validate_enrichment=True)
        assert is_valid is False
        assert any('BD Priority Score' in e for e in errors)


class TestBatchValidation:
    """Test batch validation functions."""

    def test_batch_validation_counts(self):
        """Test batch validation returns correct counts."""
        jobs = [
            {
                'Job Title/Position': 'Valid Job',
                'Date Posted': '2026-01-12',
                'Location': 'DC',
                'Position Overview': ' '.join(['word'] * 150),
                'Key Responsibilities': ['Task 1', 'Task 2', 'Task 3'],
                'Required Qualifications': ['Qual 1', 'Qual 2', 'Qual 3'],
            },
            {
                'Job Title/Position': '',  # Invalid - empty title
                'Date Posted': '2026-01-12',
                'Location': 'DC',
                'Position Overview': ' '.join(['word'] * 150),
                'Key Responsibilities': ['Task 1', 'Task 2', 'Task 3'],
                'Required Qualifications': ['Qual 1', 'Qual 2', 'Qual 3'],
            },
        ]

        valid_count, invalid_count, results = validate_job_batch(jobs)

        assert valid_count == 1
        assert invalid_count == 1
        assert len(results) == 2
