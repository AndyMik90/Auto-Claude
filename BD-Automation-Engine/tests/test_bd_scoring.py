"""
Unit tests for BD Scoring Engine.
Tests score calculation, tier classification, and recommendation generation.
"""

import pytest
import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from Engine5_Scoring.scripts.bd_scoring import (
    BD_SCORE_CONFIG,
    TIER_THRESHOLDS,
    ScoringResult,
    calculate_clearance_boost,
    calculate_program_boost,
    calculate_location_boost,
    calculate_confidence_boost,
    calculate_tier_multiplier,
    calculate_recency_boost,
    determine_tier,
    generate_recommendations,
    calculate_bd_score,
    score_batch,
    generate_scoring_report,
)


class TestClearanceBoost:
    """Tests for clearance score boost calculation."""

    def test_ts_sci_poly_highest_boost(self):
        """TS/SCI with Poly should get 35 points."""
        assert calculate_clearance_boost("TS/SCI w/ Poly") == 35
        assert calculate_clearance_boost("TS/SCI w/ Full Scope Poly") == 35

    def test_ts_sci_ci_poly(self):
        """TS/SCI with CI Poly should get 30 points."""
        assert calculate_clearance_boost("TS/SCI w/ CI Poly") == 30

    def test_ts_sci_boost(self):
        """TS/SCI should get 25 points."""
        assert calculate_clearance_boost("TS/SCI") == 25

    def test_top_secret_boost(self):
        """Top Secret should get 15 points."""
        assert calculate_clearance_boost("Top Secret") == 15

    def test_secret_boost(self):
        """Secret should get 5 points."""
        assert calculate_clearance_boost("Secret") == 5

    def test_no_clearance_zero(self):
        """No clearance should return 0."""
        assert calculate_clearance_boost("") == 0
        assert calculate_clearance_boost(None) == 0

    def test_case_insensitive(self):
        """Should match clearance levels case-insensitively."""
        assert calculate_clearance_boost("ts/sci") == 25
        assert calculate_clearance_boost("TOP SECRET") == 15
        assert calculate_clearance_boost("SECRET") == 5


class TestProgramBoost:
    """Tests for program score boost calculation."""

    def test_pacaf_highest_priority(self):
        """AF DCGS - PACAF should get 15 points."""
        assert calculate_program_boost("AF DCGS - PACAF") == 15

    def test_langley_boost(self):
        """AF DCGS - Langley should get 10 points."""
        assert calculate_program_boost("AF DCGS - Langley") == 10

    def test_wright_patt_boost(self):
        """AF DCGS - Wright-Patt should get 10 points."""
        assert calculate_program_boost("AF DCGS - Wright-Patt") == 10

    def test_navy_dcgs_boost(self):
        """Navy DCGS-N should get 8 points."""
        assert calculate_program_boost("Navy DCGS-N") == 8

    def test_army_dcgs_boost(self):
        """Army DCGS-A should get 8 points."""
        assert calculate_program_boost("Army DCGS-A") == 8

    def test_unknown_program_zero(self):
        """Unknown programs should get 0 points."""
        assert calculate_program_boost("Unknown Program") == 0
        assert calculate_program_boost("") == 0
        assert calculate_program_boost(None) == 0


class TestLocationBoost:
    """Tests for location score boost calculation."""

    def test_san_diego_highest(self):
        """San Diego should get 10 points."""
        assert calculate_location_boost("San Diego") == 10
        assert calculate_location_boost("San Diego, CA") == 10

    def test_hampton_boost(self):
        """Hampton should get 5 points."""
        assert calculate_location_boost("Hampton") == 5
        assert calculate_location_boost("Hampton, VA") == 5

    def test_dayton_boost(self):
        """Dayton should get 5 points."""
        assert calculate_location_boost("Dayton") == 5
        assert calculate_location_boost("Dayton, OH") == 5

    def test_case_insensitive(self):
        """Location matching should be case-insensitive."""
        assert calculate_location_boost("SAN DIEGO") == 10
        assert calculate_location_boost("san diego") == 10

    def test_unknown_location_zero(self):
        """Unknown locations should get 0 points."""
        assert calculate_location_boost("Washington, DC") == 0
        assert calculate_location_boost("") == 0
        assert calculate_location_boost(None) == 0


class TestConfidenceBoost:
    """Tests for confidence score boost calculation."""

    def test_full_confidence_max_boost(self):
        """Full confidence (1.0) should give max 20 points."""
        assert calculate_confidence_boost(1.0) == 20

    def test_zero_confidence_zero_boost(self):
        """Zero confidence should give 0 points."""
        assert calculate_confidence_boost(0.0) == 0

    def test_half_confidence(self):
        """50% confidence should give 10 points."""
        assert calculate_confidence_boost(0.5) == 10

    def test_high_confidence(self):
        """85% confidence should give 17 points."""
        assert calculate_confidence_boost(0.85) == 17


class TestTierMultiplier:
    """Tests for contact tier multiplier."""

    def test_tier_1_executive_highest(self):
        """Tier 1 (Executive) should get 1.3x multiplier."""
        assert calculate_tier_multiplier(1) == 1.3

    def test_tier_2_director(self):
        """Tier 2 (Director) should get 1.25x multiplier."""
        assert calculate_tier_multiplier(2) == 1.25

    def test_tier_3_program_lead(self):
        """Tier 3 (Program Leadership) should get 1.2x multiplier."""
        assert calculate_tier_multiplier(3) == 1.2

    def test_tier_4_management(self):
        """Tier 4 (Management) should get 1.1x multiplier."""
        assert calculate_tier_multiplier(4) == 1.1

    def test_tier_5_senior_ic(self):
        """Tier 5 (Senior IC) should get 1.0x multiplier."""
        assert calculate_tier_multiplier(5) == 1.0

    def test_tier_6_ic_lowest(self):
        """Tier 6 (IC) should get 0.9x multiplier."""
        assert calculate_tier_multiplier(6) == 0.9

    def test_unknown_tier_default(self):
        """Unknown tier should default to 1.0x."""
        assert calculate_tier_multiplier(7) == 1.0
        assert calculate_tier_multiplier(0) == 1.0


class TestRecencyBoost:
    """Tests for recency score boost calculation."""

    def test_recent_job_highest(self):
        """Jobs within last 7 days should get 10 points."""
        from datetime import datetime, timedelta
        recent_date = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
        assert calculate_recency_boost(recent_date) == 10

    def test_month_old_job(self):
        """Jobs within last 30 days should get 5 points."""
        from datetime import datetime, timedelta
        month_date = (datetime.now() - timedelta(days=20)).strftime('%Y-%m-%d')
        assert calculate_recency_boost(month_date) == 5

    def test_quarter_old_job(self):
        """Jobs within last 90 days should get 2 points."""
        from datetime import datetime, timedelta
        quarter_date = (datetime.now() - timedelta(days=60)).strftime('%Y-%m-%d')
        assert calculate_recency_boost(quarter_date) == 2

    def test_old_job_zero(self):
        """Jobs older than 90 days should get 0 points."""
        from datetime import datetime, timedelta
        old_date = (datetime.now() - timedelta(days=120)).strftime('%Y-%m-%d')
        assert calculate_recency_boost(old_date) == 0

    def test_invalid_date_zero(self):
        """Invalid dates should return 0."""
        assert calculate_recency_boost("not-a-date") == 0
        assert calculate_recency_boost("") == 0
        assert calculate_recency_boost(None) == 0


class TestDetermineTier:
    """Tests for priority tier determination."""

    def test_hot_tier_threshold(self):
        """Scores >= 80 should be Hot tier."""
        tier, emoji = determine_tier(80)
        assert tier == "Hot"
        assert emoji == TIER_THRESHOLDS["hot"]["emoji"]

        tier, emoji = determine_tier(100)
        assert tier == "Hot"

    def test_warm_tier_threshold(self):
        """Scores 50-79 should be Warm tier."""
        tier, emoji = determine_tier(50)
        assert tier == "Warm"
        assert emoji == TIER_THRESHOLDS["warm"]["emoji"]

        tier, emoji = determine_tier(79)
        assert tier == "Warm"

    def test_cold_tier_threshold(self):
        """Scores < 50 should be Cold tier."""
        tier, emoji = determine_tier(49)
        assert tier == "Cold"
        assert emoji == TIER_THRESHOLDS["cold"]["emoji"]

        tier, emoji = determine_tier(0)
        assert tier == "Cold"


class TestGenerateRecommendations:
    """Tests for recommendation generation."""

    def test_hot_recommendations(self):
        """Hot scores (80+) should recommend immediate outreach."""
        recs = generate_recommendations(85, {"clearance_boost": 25})
        assert any("Immediate outreach" in r for r in recs)
        assert any("Escalate" in r for r in recs)

    def test_warm_recommendations(self):
        """Warm scores (50-79) should recommend weekly follow-up."""
        recs = generate_recommendations(65, {})
        assert any("weekly follow-up" in r for r in recs)

    def test_cold_recommendations(self):
        """Cold scores (<50) should recommend monitoring."""
        recs = generate_recommendations(30, {})
        assert any("Monitor" in r for r in recs)

    def test_high_clearance_recommendation(self):
        """High clearance boost should add specific recommendation."""
        recs = generate_recommendations(70, {"clearance_boost": 30})
        assert any("cleared position" in r for r in recs)

    def test_dcgs_program_recommendation(self):
        """High program boost should add DCGS recommendation."""
        recs = generate_recommendations(70, {"program_boost": 12})
        assert any("DCGS" in r for r in recs)

    def test_san_diego_location_recommendation(self):
        """San Diego location should add specific recommendation."""
        recs = generate_recommendations(70, {"location_boost": 10})
        assert any("San Diego" in r or "PACAF" in r for r in recs)


class TestCalculateBDScore:
    """Tests for full BD score calculation."""

    def test_returns_scoring_result(self):
        """Should return ScoringResult dataclass."""
        item = {"clearance": "Secret", "location": "DC"}
        result = calculate_bd_score(item)
        assert isinstance(result, ScoringResult)

    def test_score_in_valid_range(self):
        """Scores should be 0-100."""
        item = {"clearance": "TS/SCI w/ Poly", "location": "San Diego", "match_confidence": 1.0}
        result = calculate_bd_score(item)
        assert 0 <= result.bd_score <= 100

    def test_score_capped_at_100(self):
        """Score should not exceed 100."""
        # Maximum possible inputs
        item = {
            "clearance": "TS/SCI w/ Poly",
            "location": "San Diego",
            "program": "AF DCGS - PACAF",
            "match_confidence": 1.0,
            "tier": 1,  # Executive
            "pain_points_count": 10,
        }
        from datetime import datetime
        item["date_posted"] = datetime.now().strftime('%Y-%m-%d')

        result = calculate_bd_score(item)
        assert result.bd_score == 100

    def test_base_score_minimum(self):
        """Empty item should get base score."""
        result = calculate_bd_score({})
        assert result.bd_score >= 45  # Base 50 * 0.9 (default tier)

    def test_breakdown_included(self):
        """Result should include score breakdown."""
        result = calculate_bd_score({"clearance": "TS/SCI"})
        breakdown = result.score_breakdown
        assert "base_score" in breakdown
        assert "clearance_boost" in breakdown
        assert "final_score" in breakdown

    def test_recommendations_included(self):
        """Result should include recommendations."""
        result = calculate_bd_score({"clearance": "TS/SCI"})
        assert isinstance(result.recommendations, list)
        assert len(result.recommendations) > 0

    def test_handles_alternative_field_names(self):
        """Should handle both field name formats."""
        # Standard format
        result1 = calculate_bd_score({"clearance": "TS/SCI"})
        # Alternative format
        result2 = calculate_bd_score({"Security Clearance": "TS/SCI"})
        assert result1.score_breakdown["clearance_boost"] == result2.score_breakdown["clearance_boost"]

    def test_handles_string_tier(self):
        """Should parse tier from string format."""
        item = {"tier": "Tier 2 - Director"}
        result = calculate_bd_score(item)
        assert result.score_breakdown["tier_multiplier"] == 1.25


class TestScoreBatch:
    """Tests for batch scoring function."""

    def test_scores_all_items(self):
        """Should score all items in batch."""
        items = [
            {"clearance": "Secret"},
            {"clearance": "TS/SCI"},
            {"clearance": "Top Secret"},
        ]
        results = score_batch(items)
        assert len(results) == 3

    def test_adds_scoring_data(self):
        """Each item should have _scoring added."""
        items = [{"clearance": "Secret"}]
        results = score_batch(items)

        assert "_scoring" in results[0]
        assert "BD Priority Score" in results[0]["_scoring"]
        assert "Priority Tier" in results[0]["_scoring"]
        assert "Score Breakdown" in results[0]["_scoring"]
        assert "Recommendations" in results[0]["_scoring"]

    def test_preserves_original_data(self):
        """Original item data should be preserved."""
        items = [{"clearance": "Secret", "custom_field": "value"}]
        results = score_batch(items)

        assert results[0]["custom_field"] == "value"
        assert results[0]["clearance"] == "Secret"


class TestGenerateScoringReport:
    """Tests for scoring report generation."""

    def test_report_structure(self):
        """Report should have required keys."""
        scored_items = [
            {"_scoring": {"BD Priority Score": 85, "Priority Tier": "Hot"}},
            {"_scoring": {"BD Priority Score": 65, "Priority Tier": "Warm"}},
            {"_scoring": {"BD Priority Score": 30, "Priority Tier": "Cold"}},
        ]
        report = generate_scoring_report(scored_items)

        assert "total_items" in report
        assert "by_tier" in report
        assert "average_score" in report
        assert "score_distribution" in report
        assert "top_opportunities" in report

    def test_tier_counts(self):
        """Report should count items by tier correctly."""
        scored_items = [
            {"_scoring": {"BD Priority Score": 85, "Priority Tier": "Hot"}},
            {"_scoring": {"BD Priority Score": 82, "Priority Tier": "Hot"}},
            {"_scoring": {"BD Priority Score": 65, "Priority Tier": "Warm"}},
            {"_scoring": {"BD Priority Score": 30, "Priority Tier": "Cold"}},
        ]
        report = generate_scoring_report(scored_items)

        assert report["by_tier"]["Hot"] == 2
        assert report["by_tier"]["Warm"] == 1
        assert report["by_tier"]["Cold"] == 1

    def test_average_score(self):
        """Report should calculate average correctly."""
        scored_items = [
            {"_scoring": {"BD Priority Score": 80, "Priority Tier": "Hot"}},
            {"_scoring": {"BD Priority Score": 60, "Priority Tier": "Warm"}},
            {"_scoring": {"BD Priority Score": 40, "Priority Tier": "Cold"}},
        ]
        report = generate_scoring_report(scored_items)

        assert report["average_score"] == 60.0

    def test_score_distribution(self):
        """Report should show score distribution."""
        scored_items = [
            {"_scoring": {"BD Priority Score": 95, "Priority Tier": "Hot"}},
            {"_scoring": {"BD Priority Score": 55, "Priority Tier": "Warm"}},
            {"_scoring": {"BD Priority Score": 25, "Priority Tier": "Cold"}},
        ]
        report = generate_scoring_report(scored_items)

        assert report["score_distribution"]["80-100"] == 1
        assert report["score_distribution"]["50-79"] == 1
        assert report["score_distribution"]["0-49"] == 1

    def test_top_opportunities(self):
        """Report should list top 10 opportunities."""
        scored_items = [{"_scoring": {"BD Priority Score": i * 10, "Priority Tier": "Warm"}} for i in range(15)]
        report = generate_scoring_report(scored_items)

        assert len(report["top_opportunities"]) == 10
        # Top should be highest score
        assert report["top_opportunities"][0]["_scoring"]["BD Priority Score"] == 140

    def test_empty_batch(self):
        """Should handle empty batch."""
        report = generate_scoring_report([])
        assert report["total_items"] == 0
        assert report["average_score"] == 0


class TestScoringIntegration:
    """Integration tests for scoring pipeline."""

    def test_full_scoring_workflow(self):
        """Test complete scoring workflow from input to report."""
        from datetime import datetime

        # Simulate jobs from program mapping stage
        jobs = [
            {
                "Job Title/Position": "Senior Network Engineer",
                "Security Clearance": "TS/SCI w/ Poly",
                "Location": "San Diego, CA",
                "match_confidence": 0.85,
                "program": "AF DCGS - PACAF",
                "date_posted": datetime.now().strftime('%Y-%m-%d'),
            },
            {
                "Job Title/Position": "Software Developer",
                "Security Clearance": "Secret",
                "Location": "Washington, DC",
                "match_confidence": 0.50,
                "program": "Unknown",
            },
            {
                "Job Title/Position": "Systems Analyst",
                "Security Clearance": "Top Secret",
                "Location": "Hampton, VA",
                "match_confidence": 0.70,
                "program": "AF DCGS - Langley",
            },
        ]

        # Score batch
        scored = score_batch(jobs)

        # Generate report
        report = generate_scoring_report(scored)

        # Validate results
        assert report["total_items"] == 3
        assert report["by_tier"]["Hot"] >= 1  # High clearance + San Diego + PACAF
        assert report["average_score"] > 50  # Should be above cold threshold
        assert len(report["top_opportunities"]) <= 3

        # Verify Hot opportunity was correctly identified
        hot_items = [s for s in scored if "Hot" in s["_scoring"]["Priority Tier"]]
        assert len(hot_items) >= 1
        assert hot_items[0]["_scoring"]["BD Priority Score"] >= 80


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
