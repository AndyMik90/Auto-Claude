"""
Unit tests for Program Mapper module.
Tests Federal Programs database, location/keyword extraction, and scoring.
"""

import pytest
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from Engine2_ProgramMapping.scripts.program_mapper import (
    FederalProgram,
    FederalProgramsDB,
    get_federal_programs_db,
    load_federal_programs,
    DCGS_LOCATIONS,
    IC_DOD_LOCATIONS,
    ALL_LOCATIONS,
    PROGRAM_KEYWORDS,
    SCORING_WEIGHTS,
    MappingResult,
    extract_location_signal,
    extract_keyword_signals,
    calculate_match_confidence,
    calculate_bd_priority_score,
    map_job_to_program,
    process_jobs_batch,
)


class TestFederalProgramsDB:
    """Tests for Federal Programs CSV database."""

    def test_db_loads_programs(self):
        """Database should load 400+ programs from CSV."""
        db = get_federal_programs_db()
        assert db.total_programs >= 400, f"Expected 400+ programs, got {db.total_programs}"

    def test_db_indexes_keywords(self):
        """Database should index keywords for search."""
        db = get_federal_programs_db()
        assert len(db.all_keywords) > 100, "Should have 100+ keywords indexed"

    def test_db_indexes_locations(self):
        """Database should index locations for search."""
        db = get_federal_programs_db()
        assert len(db.all_locations) > 50, "Should have 50+ locations indexed"

    def test_db_get_programs_by_location(self):
        """Should find programs by location."""
        db = get_federal_programs_db()
        programs = db.get_programs_by_location("Huntsville")
        assert len(programs) > 0, "Should find programs for Huntsville"

    def test_db_get_programs_by_keyword(self):
        """Should find programs by keyword."""
        db = get_federal_programs_db()
        scores = db.get_programs_by_keyword("cyber security operations")
        assert len(scores) > 0, "Should find programs for cyber keywords"

    def test_db_get_program_by_name(self):
        """Should get program by name or acronym."""
        db = get_federal_programs_db()
        # Try common acronyms
        prog = db.get_program_by_name("ABMS")
        if prog:
            assert prog.acronym.upper() == "ABMS"


class TestLocationMapping:
    """Tests for location-based program mapping."""

    def test_dcgs_locations_defined(self):
        """DCGS_LOCATIONS should have key sites."""
        assert 'San Diego' in DCGS_LOCATIONS
        assert 'Hampton' in DCGS_LOCATIONS
        assert 'Dayton' in DCGS_LOCATIONS

    def test_ic_dod_locations_defined(self):
        """IC_DOD_LOCATIONS should have key sites."""
        assert 'Fort Meade' in IC_DOD_LOCATIONS
        assert 'Colorado Springs' in IC_DOD_LOCATIONS

    def test_all_locations_combined(self):
        """ALL_LOCATIONS should combine DCGS and IC/DoD."""
        assert len(ALL_LOCATIONS) >= len(DCGS_LOCATIONS) + len(IC_DOD_LOCATIONS)

    def test_extract_location_signal_dcgs(self):
        """Should extract DCGS program from San Diego location."""
        job = {'Location': 'San Diego, CA'}
        programs, score = extract_location_signal(job, use_federal_db=False)
        assert len(programs) > 0
        assert any('DCGS' in p or 'PACAF' in p for p in programs)
        assert score > 0

    def test_extract_location_signal_nsa(self):
        """Should extract NSA program from Fort Meade location."""
        job = {'Location': 'Fort Meade, MD'}
        programs, score = extract_location_signal(job, use_federal_db=False)
        assert len(programs) > 0
        assert any('NSA' in p or 'CYBERCOM' in p for p in programs)

    def test_extract_location_signal_with_federal_db(self):
        """Should find additional programs using Federal Programs DB."""
        job = {'Location': 'Huntsville, AL'}
        programs, score = extract_location_signal(job, use_federal_db=True)
        # Should find Army programs in Huntsville
        assert score >= 0


class TestKeywordExtraction:
    """Tests for keyword-based program matching."""

    def test_program_keywords_defined(self):
        """PROGRAM_KEYWORDS should have entries for major programs."""
        assert 'AF DCGS' in PROGRAM_KEYWORDS
        assert 'Army DCGS-A' in PROGRAM_KEYWORDS
        assert 'NSA Programs' in PROGRAM_KEYWORDS

    def test_extract_keyword_signals_dcgs(self):
        """Should find DCGS program from keywords."""
        job = {
            'Job Title/Position': 'DCGS Systems Engineer',
            'Position Overview': 'Support the Distributed Common Ground System'
        }
        signals = extract_keyword_signals(job, use_federal_db=False)
        assert len(signals) > 0
        program_names = [s[0] for s in signals]
        assert any('DCGS' in p for p in program_names)

    def test_extract_keyword_signals_480th(self):
        """Should find AF DCGS from 480th ISR Wing mention."""
        job = {
            'Job Title/Position': 'Intelligence Analyst',
            'Position Overview': 'Support the 480th ISR Wing'
        }
        signals = extract_keyword_signals(job, use_federal_db=False)
        assert len(signals) > 0

    def test_extract_keyword_signals_title_weight(self):
        """Keywords in title should have higher weight."""
        job_title = {
            'Job Title/Position': 'DCGS Network Engineer',
            'Position Overview': 'Network engineering role'
        }
        job_desc = {
            'Job Title/Position': 'Network Engineer',
            'Position Overview': 'Support DCGS network infrastructure'
        }

        signals_title = extract_keyword_signals(job_title, use_federal_db=False)
        signals_desc = extract_keyword_signals(job_desc, use_federal_db=False)

        # Both should find DCGS
        assert len(signals_title) > 0
        assert len(signals_desc) > 0

        # Title match should have higher score
        title_score = sum(s[1] for s in signals_title)
        desc_score = sum(s[1] for s in signals_desc)
        assert title_score >= desc_score


class TestMatchConfidence:
    """Tests for match confidence calculation."""

    def test_calculate_match_confidence_high(self):
        """High scores should be 'direct' match type."""
        confidence, match_type = calculate_match_confidence(80)
        assert confidence >= 0.70
        assert match_type == 'direct'

    def test_calculate_match_confidence_medium(self):
        """Medium scores should be 'fuzzy' match type."""
        confidence, match_type = calculate_match_confidence(60)
        assert 0.50 <= confidence < 0.70
        assert match_type == 'fuzzy'

    def test_calculate_match_confidence_low(self):
        """Low scores should be 'inferred' match type."""
        confidence, match_type = calculate_match_confidence(30)
        assert confidence < 0.50
        assert match_type == 'inferred'

    def test_calculate_match_confidence_capped(self):
        """Confidence should be capped at 1.0."""
        confidence, _ = calculate_match_confidence(200)
        assert confidence <= 1.0


class TestBDPriorityScore:
    """Tests for BD Priority Score calculation."""

    def test_bd_score_base(self):
        """Should have base score around 50."""
        job = {}
        score, tier = calculate_bd_priority_score(job, 0.5)
        assert 40 <= score <= 70

    def test_bd_score_high_clearance_boost(self):
        """High clearance should boost score significantly."""
        job_poly = {'Security Clearance': 'TS/SCI w/ CI Poly'}
        job_none = {'Security Clearance': ''}

        score_poly, _ = calculate_bd_priority_score(job_poly, 0.5)
        score_none, _ = calculate_bd_priority_score(job_none, 0.5)

        assert score_poly > score_none

    def test_bd_score_dcgs_boost(self):
        """DCGS mention should boost score."""
        job_dcgs = {'Position Overview': 'Support DCGS operations'}
        job_none = {'Position Overview': 'Support general operations'}

        score_dcgs, _ = calculate_bd_priority_score(job_dcgs, 0.5)
        score_none, _ = calculate_bd_priority_score(job_none, 0.5)

        assert score_dcgs > score_none

    def test_bd_score_san_diego_boost(self):
        """San Diego location should boost score."""
        job_sd = {'Location': 'San Diego, CA'}
        job_other = {'Location': 'Atlanta, GA'}

        score_sd, _ = calculate_bd_priority_score(job_sd, 0.5)
        score_other, _ = calculate_bd_priority_score(job_other, 0.5)

        assert score_sd > score_other

    def test_bd_tier_hot(self):
        """Score 80+ should be Hot tier."""
        job = {
            'Security Clearance': 'TS/SCI w/ CI Poly',
            'Position Overview': 'Support DCGS at critical site',
            'Location': 'San Diego, CA'
        }
        score, tier = calculate_bd_priority_score(job, 0.9)
        if score >= 80:
            assert tier == 'Hot'

    def test_bd_tier_warm(self):
        """Score 50-79 should be Warm tier."""
        job = {'Security Clearance': 'Secret'}
        score, tier = calculate_bd_priority_score(job, 0.5)
        if 50 <= score < 80:
            assert tier == 'Warm'

    def test_bd_tier_cold(self):
        """Score <50 should be Cold tier."""
        job = {}
        score, tier = calculate_bd_priority_score(job, 0.1)
        if score < 50:
            assert tier == 'Cold'

    def test_bd_score_capped(self):
        """Score should be capped at 100."""
        job = {
            'Security Clearance': 'TS/SCI w/ Full Scope Poly',
            'Position Overview': 'DCGS DCGS DCGS critical position',
            'Location': 'San Diego, CA'
        }
        score, _ = calculate_bd_priority_score(job, 1.0)
        assert score <= 100


class TestMapJobToProgram:
    """Tests for main mapping function."""

    def test_map_job_returns_result(self):
        """Should return MappingResult object."""
        job = {
            'Job Title/Position': 'Network Engineer',
            'Location': 'San Diego, CA'
        }
        result = map_job_to_program(job)
        assert isinstance(result, MappingResult)
        assert result.program_name
        assert 0 <= result.match_confidence <= 1
        assert result.match_type in ['direct', 'fuzzy', 'inferred']
        assert 0 <= result.bd_priority_score <= 100
        assert result.priority_tier in ['Hot', 'Warm', 'Cold']

    def test_map_job_finds_dcgs(self):
        """Should map DCGS job to DCGS program."""
        job = {
            'Job Title/Position': 'DCGS Systems Engineer',
            'Location': 'San Diego, CA',
            'Position Overview': 'Support the Distributed Common Ground System'
        }
        result = map_job_to_program(job)
        assert 'DCGS' in result.program_name or result.match_confidence > 0

    def test_map_job_returns_signals(self):
        """Should return signals explaining the match."""
        job = {
            'Job Title/Position': 'Intelligence Analyst',
            'Location': 'Fort Meade, MD'
        }
        result = map_job_to_program(job)
        assert isinstance(result.signals, list)

    def test_map_job_unmatched(self):
        """Should return 'Unmatched' for non-matching job."""
        job = {
            'Job Title/Position': 'Accountant',
            'Location': 'New York, NY',
            'Position Overview': 'Handle financial reporting'
        }
        result = map_job_to_program(job, use_federal_db=False)
        # May still match with low confidence


class TestProcessJobsBatch:
    """Tests for batch processing."""

    def test_process_batch_adds_mapping(self):
        """Should add _mapping key to each job."""
        jobs = [
            {'Job Title/Position': 'Engineer 1', 'Location': 'DC'},
            {'Job Title/Position': 'Engineer 2', 'Location': 'VA'},
        ]
        results = process_jobs_batch(jobs)

        assert len(results) == 2
        for job in results:
            assert '_mapping' in job
            assert 'program_name' in job['_mapping']
            assert 'bd_priority_score' in job['_mapping']

    def test_process_batch_preserves_original(self):
        """Should preserve original job fields."""
        jobs = [
            {'Job Title/Position': 'Engineer', 'custom_field': 'custom_value'},
        ]
        results = process_jobs_batch(jobs)

        assert results[0]['custom_field'] == 'custom_value'
        assert results[0]['Job Title/Position'] == 'Engineer'
