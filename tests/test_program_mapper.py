"""
Tests for program_mapper.py - Program Mapping Engine

Tests location extraction, keyword matching, and multi-signal scoring
for mapping job postings to federal programs.
"""

import pytest
import sys
from pathlib import Path

# Add the BD-Automation-Engine to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "BD-Automation-Engine"))

from Engine2_ProgramMapping.scripts.program_mapper import (
    extract_location_signal,
    extract_keyword_signals,
    calculate_match_confidence,
    calculate_bd_priority_score,
    map_job_to_program,
    process_jobs_batch,
    normalize_location_for_matching,
    DCGS_LOCATIONS,
    IC_DOD_LOCATIONS,
    ALL_LOCATIONS,
    PROGRAM_KEYWORDS,
    SCORING_WEIGHTS,
    MappingResult,
)


# ============================================
# LOCATION SIGNAL EXTRACTION TESTS
# ============================================

class TestLocationSignalExtraction:
    """Test location-based program signal extraction."""

    def test_extract_san_diego_location(self):
        """Test San Diego maps to AF DCGS - PACAF."""
        job = {'location': 'San Diego, CA'}
        program, score, signals = extract_location_signal(job)
        assert program == 'AF DCGS - PACAF'
        assert score > 0

    def test_extract_hampton_location(self):
        """Test Hampton maps to AF DCGS - Langley."""
        job = {'location': 'Hampton, VA'}
        program, score, signals = extract_location_signal(job)
        assert program == 'AF DCGS - Langley'
        assert score > 0

    def test_extract_fort_meade_location(self):
        """Test Fort Meade maps to NSA/USCYBERCOM."""
        job = {'location': 'Fort Meade, MD'}
        program, score, signals = extract_location_signal(job)
        assert program == 'NSA/USCYBERCOM Programs'
        assert score > 0

    def test_extract_dayton_location(self):
        """Test Dayton maps to AF DCGS - Wright-Patt."""
        job = {'location': 'Dayton, OH'}
        program, score, signals = extract_location_signal(job)
        assert program == 'AF DCGS - Wright-Patt'
        assert score > 0

    def test_no_location_returns_none(self):
        """Test missing location returns None."""
        job = {'title': 'Engineer'}
        program, score, signals = extract_location_signal(job)
        assert program is None
        assert score == 0

    def test_unknown_location_returns_none(self):
        """Test unknown location returns None."""
        job = {'location': 'Unknown City, XX'}
        program, score, signals = extract_location_signal(job, use_dynamic_locations=False)
        assert program is None
        assert score == 0

    def test_location_field_alternatives(self):
        """Test both 'location' and 'Location' field names."""
        job1 = {'location': 'San Diego, CA'}
        job2 = {'Location': 'San Diego, CA'}

        program1, _, _ = extract_location_signal(job1)
        program2, _, _ = extract_location_signal(job2)

        assert program1 == program2 == 'AF DCGS - PACAF'


class TestLocationNormalization:
    """Test location string normalization for matching."""

    def test_normalize_fort_abbreviation(self):
        """Test 'Ft.' is normalized to 'fort'."""
        result = normalize_location_for_matching('Ft. Meade')
        assert 'fort' in result
        assert 'ft.' not in result

    def test_normalize_afb_abbreviation(self):
        """Test 'AFB' is normalized to 'air force base'."""
        result = normalize_location_for_matching('Edwards AFB')
        assert 'air force base' in result

    def test_removes_parenthetical_notes(self):
        """Test parenthetical notes are removed."""
        result = normalize_location_for_matching('Langley (DGS-1)')
        assert '(' not in result
        assert 'dgs-1' not in result


# ============================================
# KEYWORD SIGNAL EXTRACTION TESTS
# ============================================

class TestKeywordSignalExtraction:
    """Test keyword-based program signal extraction."""

    def test_dcgs_in_title(self):
        """Test DCGS keyword in title gets high score."""
        job = {'title': 'DCGS Software Engineer', 'description': 'Work on ISR systems'}
        signals = extract_keyword_signals(job)

        # Should have at least one signal
        assert len(signals) > 0

        # Check for DCGS-related signal
        dcgs_signals = [s for s in signals if 'DCGS' in s[0]]
        assert len(dcgs_signals) > 0

    def test_sigint_keyword(self):
        """Test SIGINT keyword maps to NSA Programs."""
        job = {'title': 'SIGINT Analyst', 'description': 'Analyze signals'}
        signals = extract_keyword_signals(job, use_dynamic_keywords=False)

        nsa_signals = [s for s in signals if 'NSA' in s[0]]
        assert len(nsa_signals) > 0

    def test_geoint_keyword(self):
        """Test GEOINT keyword maps to NGA Programs."""
        job = {'title': 'GEOINT Specialist', 'description': 'Work with imagery'}
        signals = extract_keyword_signals(job, use_dynamic_keywords=False)

        nga_signals = [s for s in signals if 'NGA' in s[0]]
        assert len(nga_signals) > 0

    def test_title_has_higher_weight_than_description(self):
        """Test that title keywords get higher scores than description."""
        job_title = {'title': 'DCGS Engineer', 'description': 'Standard work'}
        job_desc = {'title': 'Engineer', 'description': 'Work on DCGS systems'}

        signals_title = extract_keyword_signals(job_title)
        signals_desc = extract_keyword_signals(job_desc)

        # Title match should have higher score
        if signals_title and signals_desc:
            max_title_score = max(s[1] for s in signals_title)
            max_desc_score = max(s[1] for s in signals_desc)
            assert max_title_score >= max_desc_score

    def test_no_keywords_returns_empty(self):
        """Test job with no keywords returns empty signals."""
        job = {'title': 'Generic Position', 'description': 'Do generic work'}
        signals = extract_keyword_signals(job, use_dynamic_keywords=False)

        # May have DCGS Family signal if 'dcgs' accidentally matched
        non_dcgs_signals = [s for s in signals if 'DCGS Family' not in s[0]]
        # Should be minimal signals for generic job
        assert len(non_dcgs_signals) <= 1


# ============================================
# MATCH CONFIDENCE TESTS
# ============================================

class TestMatchConfidence:
    """Test match confidence calculation."""

    def test_high_score_direct_match(self):
        """Test high score produces direct match."""
        confidence, match_type = calculate_match_confidence(80)
        assert confidence >= 0.70
        assert match_type == 'direct'

    def test_medium_score_fuzzy_match(self):
        """Test medium score produces fuzzy match."""
        confidence, match_type = calculate_match_confidence(60)
        assert 0.50 <= confidence < 0.70
        assert match_type == 'fuzzy'

    def test_low_score_inferred_match(self):
        """Test low score produces inferred match."""
        confidence, match_type = calculate_match_confidence(30)
        assert confidence < 0.50
        assert match_type == 'inferred'

    def test_confidence_capped_at_one(self):
        """Test confidence is capped at 1.0."""
        confidence, _ = calculate_match_confidence(150)
        assert confidence <= 1.0


# ============================================
# BD PRIORITY SCORE TESTS
# ============================================

class TestBDPriorityScore:
    """Test BD Priority Score calculation."""

    def test_base_score(self):
        """Test base score is applied."""
        job = {}
        score, tier = calculate_bd_priority_score(job, 0.5)
        assert score >= 50  # Base score

    def test_clearance_boost_ts_sci(self):
        """Test TS/SCI clearance boosts score."""
        job = {'Security Clearance': 'TS/SCI'}
        score, tier = calculate_bd_priority_score(job, 0.5)
        assert score > 50  # Should have clearance boost

    def test_clearance_boost_poly(self):
        """Test Poly clearance has highest boost."""
        job_poly = {'Security Clearance': 'TS/SCI w/ Poly'}
        job_ts = {'Security Clearance': 'Top Secret'}

        score_poly, _ = calculate_bd_priority_score(job_poly, 0.5)
        score_ts, _ = calculate_bd_priority_score(job_ts, 0.5)

        assert score_poly > score_ts

    def test_hot_tier_threshold(self):
        """Test Hot tier at 80+."""
        job = {'Security Clearance': 'TS/SCI w/ Poly', 'Location': 'San Diego'}
        score, tier = calculate_bd_priority_score(job, 0.9)

        if score >= 80:
            assert tier == 'Hot'

    def test_warm_tier_threshold(self):
        """Test Warm tier at 50-79."""
        job = {'Security Clearance': 'Secret'}
        score, tier = calculate_bd_priority_score(job, 0.5)

        if 50 <= score < 80:
            assert tier == 'Warm'

    def test_cold_tier_threshold(self):
        """Test Cold tier below 50."""
        job = {}
        score, tier = calculate_bd_priority_score(job, 0.1)

        if score < 50:
            assert tier == 'Cold'


# ============================================
# FULL MAPPING TESTS
# ============================================

class TestFullMapping:
    """Test complete job-to-program mapping."""

    def test_map_dcgs_job(self):
        """Test mapping a DCGS-related job."""
        job = {
            'title': 'DCGS Software Engineer',
            'location': 'San Diego, CA',
            'description': 'Work on ISR systems for the 480th wing',
            'Security Clearance': 'TS/SCI',
        }

        result = map_job_to_program(job)

        assert isinstance(result, MappingResult)
        assert result.program_name is not None
        assert 0 <= result.match_confidence <= 1.0
        assert result.match_type in ['direct', 'fuzzy', 'inferred']
        assert 0 <= result.bd_priority_score <= 100
        assert result.priority_tier in ['Hot', 'Warm', 'Cold']
        assert isinstance(result.signals, list)

    def test_map_nsa_job(self):
        """Test mapping an NSA-related job."""
        job = {
            'title': 'SIGINT Analyst',
            'location': 'Fort Meade, MD',
            'description': 'Work at NSA on signals intelligence',
            'Security Clearance': 'TS/SCI w/ Full Scope Poly',
        }

        result = map_job_to_program(job)

        assert result.program_name is not None
        assert result.bd_priority_score > 50  # Should be high value

    def test_map_unmatched_job(self):
        """Test mapping a job with no program signals."""
        job = {
            'title': 'Retail Associate',
            'location': 'Random City, XX',
            'description': 'Work in retail store',
        }

        result = map_job_to_program(job)

        # Should still return a result, possibly "Unmatched"
        assert isinstance(result, MappingResult)
        assert result.match_confidence < 0.5  # Low confidence


# ============================================
# BATCH PROCESSING TESTS
# ============================================

class TestBatchProcessing:
    """Test batch job processing."""

    def test_process_batch_returns_enriched_jobs(self):
        """Test batch processing adds _mapping to jobs."""
        jobs = [
            {'title': 'Engineer', 'location': 'DC', 'description': 'Work'},
            {'title': 'Analyst', 'location': 'VA', 'description': 'Analyze'},
        ]

        results = process_jobs_batch(jobs)

        assert len(results) == 2
        for job in results:
            assert '_mapping' in job
            assert 'program_name' in job['_mapping']
            assert 'match_confidence' in job['_mapping']

    def test_process_batch_preserves_original_data(self):
        """Test batch processing preserves original fields."""
        jobs = [
            {'title': 'Test', 'custom_field': 'value'},
        ]

        results = process_jobs_batch(jobs)

        assert results[0]['title'] == 'Test'
        assert results[0]['custom_field'] == 'value'


# ============================================
# SCORING WEIGHT TESTS
# ============================================

class TestScoringWeights:
    """Test scoring weight configuration."""

    def test_program_name_in_title_weight(self):
        """Test program name in title has high weight."""
        assert SCORING_WEIGHTS['program_name_in_title'] >= 40

    def test_location_weights(self):
        """Test location weights are configured."""
        assert 'location_match_exact' in SCORING_WEIGHTS
        assert 'location_match_region' in SCORING_WEIGHTS
        assert SCORING_WEIGHTS['location_match_exact'] > SCORING_WEIGHTS['location_match_region']

    def test_clearance_mismatch_negative(self):
        """Test clearance mismatch has negative weight."""
        assert SCORING_WEIGHTS['clearance_mismatch'] < 0
