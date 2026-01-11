"""
BD Scoring Engine
Calculate BD Priority Scores and tier classifications for opportunities.

Based on: program-mapping-skill.md and contact-classification-skill.md
"""

import json
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from datetime import datetime


# ============================================
# SCORING CONFIGURATION
# ============================================

BD_SCORE_CONFIG = {
    "base_score": 50,

    "clearance_boosts": {
        "TS/SCI w/ Poly": 35,
        "TS/SCI w/ Full Scope Poly": 35,
        "TS/SCI w/ CI Poly": 30,
        "TS/SCI": 25,
        "Top Secret": 15,
        "Secret": 5,
    },

    "program_boosts": {
        "AF DCGS - PACAF": 15,   # Critical priority
        "AF DCGS - Langley": 10,
        "AF DCGS - Wright-Patt": 10,
        "Navy DCGS-N": 8,
        "Army DCGS-A": 8,
    },

    "location_boosts": {
        "San Diego": 10,  # Critical understaffed site
        "Hampton": 5,
        "Dayton": 5,
    },

    "tier_multipliers": {
        1: 1.3,  # Executive
        2: 1.25, # Director
        3: 1.2,  # Program Leadership
        4: 1.1,  # Management
        5: 1.0,  # Senior IC
        6: 0.9,  # IC
    },

    "match_confidence_weight": 20,  # Max points from confidence

    "pain_point_boost": 5,  # Per validated pain point

    "recency_boosts": {
        "last_7_days": 10,
        "last_30_days": 5,
        "last_90_days": 2,
    }
}

TIER_THRESHOLDS = {
    "hot": {"min": 80, "emoji": "\U0001F525", "color": "red"},     # Fire emoji
    "warm": {"min": 50, "emoji": "\U0001F7E1", "color": "yellow"}, # Yellow circle
    "cold": {"min": 0, "emoji": "\u2744\uFE0F", "color": "blue"},  # Snowflake
}


# ============================================
# DATA CLASSES
# ============================================

@dataclass
class ScoringResult:
    """Result of BD scoring calculation."""
    bd_score: int
    tier: str
    tier_emoji: str
    score_breakdown: Dict[str, int]
    recommendations: List[str]


# ============================================
# SCORING FUNCTIONS
# ============================================

def calculate_clearance_boost(clearance: str) -> int:
    """Calculate score boost from clearance level."""
    if not clearance:
        return 0

    clearance_upper = clearance.upper()

    for level, boost in BD_SCORE_CONFIG["clearance_boosts"].items():
        if level.upper() in clearance_upper:
            return boost

    return 0


def calculate_program_boost(program: str) -> int:
    """Calculate score boost from program assignment."""
    if not program:
        return 0

    return BD_SCORE_CONFIG["program_boosts"].get(program, 0)


def calculate_location_boost(location: str) -> int:
    """Calculate score boost from location."""
    if not location:
        return 0

    for loc_key, boost in BD_SCORE_CONFIG["location_boosts"].items():
        if loc_key.lower() in location.lower():
            return boost

    return 0


def calculate_confidence_boost(confidence: float) -> int:
    """Calculate score boost from match confidence."""
    max_boost = BD_SCORE_CONFIG["match_confidence_weight"]
    return int(confidence * max_boost)


def calculate_tier_multiplier(tier: int) -> float:
    """Get multiplier based on contact tier."""
    return BD_SCORE_CONFIG["tier_multipliers"].get(tier, 1.0)


def calculate_recency_boost(date_str: str) -> int:
    """Calculate boost based on how recent the opportunity is."""
    if not date_str:
        return 0

    try:
        posted_date = datetime.strptime(date_str, '%Y-%m-%d')
        days_ago = (datetime.now() - posted_date).days

        if days_ago <= 7:
            return BD_SCORE_CONFIG["recency_boosts"]["last_7_days"]
        elif days_ago <= 30:
            return BD_SCORE_CONFIG["recency_boosts"]["last_30_days"]
        elif days_ago <= 90:
            return BD_SCORE_CONFIG["recency_boosts"]["last_90_days"]
    except ValueError:
        pass

    return 0


def determine_tier(score: int) -> Tuple[str, str]:
    """Determine priority tier from score."""
    for tier_name, config in TIER_THRESHOLDS.items():
        if score >= config["min"]:
            return tier_name.capitalize(), config["emoji"]
    return "Cold", TIER_THRESHOLDS["cold"]["emoji"]


def generate_recommendations(score: int, breakdown: Dict) -> List[str]:
    """Generate actionable recommendations based on score."""
    recommendations = []

    if score >= 80:
        recommendations.append("Immediate outreach recommended - Hot opportunity")
        recommendations.append("Escalate to BD leadership for review")
    elif score >= 50:
        recommendations.append("Add to weekly follow-up queue")
        recommendations.append("Gather additional intelligence before outreach")
    else:
        recommendations.append("Monitor for changes in priority signals")
        recommendations.append("Add to long-term pipeline tracking")

    # Specific recommendations based on breakdown
    if breakdown.get("clearance_boost", 0) >= 25:
        recommendations.append("High-value cleared position - prioritize")

    if breakdown.get("program_boost", 0) >= 10:
        recommendations.append("DCGS program alignment - leverage existing relationships")

    if breakdown.get("location_boost", 0) >= 10:
        recommendations.append("San Diego/PACAF - critical understaffed site")

    return recommendations


def calculate_bd_score(item: Dict) -> ScoringResult:
    """
    Calculate comprehensive BD Priority Score.

    Args:
        item: Dictionary with opportunity/contact data including:
              - clearance/Security Clearance
              - program/Program
              - location/Location
              - match_confidence
              - tier (1-6)
              - date_posted/Date Posted
              - pain_points_count

    Returns:
        ScoringResult with score, tier, breakdown, and recommendations
    """
    breakdown = {}

    # Start with base score
    score = BD_SCORE_CONFIG["base_score"]
    breakdown["base_score"] = BD_SCORE_CONFIG["base_score"]

    # Clearance boost
    clearance = item.get('clearance') or item.get('Security Clearance', '')
    clearance_boost = calculate_clearance_boost(clearance)
    score += clearance_boost
    breakdown["clearance_boost"] = clearance_boost

    # Program boost
    program = item.get('program') or item.get('Program', '')
    program_boost = calculate_program_boost(program)
    score += program_boost
    breakdown["program_boost"] = program_boost

    # Location boost
    location = item.get('location') or item.get('Location', '')
    location_boost = calculate_location_boost(location)
    score += location_boost
    breakdown["location_boost"] = location_boost

    # Confidence boost (from mapping)
    confidence = item.get('match_confidence', 0.5)
    if isinstance(confidence, str):
        confidence = float(confidence)
    confidence_boost = calculate_confidence_boost(confidence)
    score += confidence_boost
    breakdown["confidence_boost"] = confidence_boost

    # Recency boost
    date_posted = item.get('date_posted') or item.get('Date Posted', '')
    recency_boost = calculate_recency_boost(date_posted)
    score += recency_boost
    breakdown["recency_boost"] = recency_boost

    # Pain points boost
    pain_points = item.get('pain_points_count', 0)
    pain_boost = pain_points * BD_SCORE_CONFIG["pain_point_boost"]
    score += pain_boost
    breakdown["pain_point_boost"] = pain_boost

    # Apply tier multiplier if contact-based scoring
    tier = item.get('tier', 5)
    if isinstance(tier, str):
        # Extract number from "Tier X - Name"
        tier = int(tier.split()[1]) if 'Tier' in tier else 5
    multiplier = calculate_tier_multiplier(tier)
    score = int(score * multiplier)
    breakdown["tier_multiplier"] = multiplier

    # Cap at 100
    score = min(score, 100)
    breakdown["final_score"] = score

    # Determine tier
    tier_name, tier_emoji = determine_tier(score)

    # Generate recommendations
    recommendations = generate_recommendations(score, breakdown)

    return ScoringResult(
        bd_score=score,
        tier=tier_name,
        tier_emoji=tier_emoji,
        score_breakdown=breakdown,
        recommendations=recommendations
    )


def score_batch(items: List[Dict]) -> List[Dict]:
    """
    Score a batch of items (jobs or contacts).

    Args:
        items: List of dictionaries to score

    Returns:
        List of items with scoring data added
    """
    results = []

    for item in items:
        scoring = calculate_bd_score(item)

        enriched = item.copy()
        enriched['_scoring'] = {
            'BD Priority Score': scoring.bd_score,
            'Priority Tier': f"{scoring.tier_emoji} {scoring.tier}",
            'Score Breakdown': scoring.score_breakdown,
            'Recommendations': scoring.recommendations,
        }

        results.append(enriched)

    return results


# ============================================
# REPORTING
# ============================================

def generate_scoring_report(scored_items: List[Dict]) -> Dict:
    """
    Generate summary report of scored items.

    Args:
        scored_items: List of items with _scoring data

    Returns:
        Report dictionary with statistics
    """
    report = {
        "total_items": len(scored_items),
        "by_tier": {"Hot": 0, "Warm": 0, "Cold": 0},
        "average_score": 0,
        "top_opportunities": [],
        "score_distribution": {"80-100": 0, "50-79": 0, "0-49": 0}
    }

    total_score = 0

    for item in scored_items:
        scoring = item.get('_scoring', {})
        score = scoring.get('BD Priority Score', 0)
        tier = scoring.get('Priority Tier', 'Cold').split()[-1]

        total_score += score

        # Count by tier
        if tier in report["by_tier"]:
            report["by_tier"][tier] += 1

        # Score distribution
        if score >= 80:
            report["score_distribution"]["80-100"] += 1
        elif score >= 50:
            report["score_distribution"]["50-79"] += 1
        else:
            report["score_distribution"]["0-49"] += 1

    # Calculate average
    if scored_items:
        report["average_score"] = round(total_score / len(scored_items), 1)

    # Top opportunities
    sorted_items = sorted(
        scored_items,
        key=lambda x: x.get('_scoring', {}).get('BD Priority Score', 0),
        reverse=True
    )
    report["top_opportunities"] = sorted_items[:10]

    return report


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import argparse

    parser = argparse.ArgumentParser(description='Calculate BD Priority Scores')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file')
    parser.add_argument('--output', '-o', required=True, help='Output JSON file')
    parser.add_argument('--report', '-r', help='Optional report file')

    args = parser.parse_args()

    # Load items
    with open(args.input, 'r') as f:
        items = json.load(f)

    # Score
    scored = score_batch(items)

    # Save results
    with open(args.output, 'w') as f:
        json.dump(scored, f, indent=2)

    # Generate and save report if requested
    if args.report:
        report = generate_scoring_report(scored)
        with open(args.report, 'w') as f:
            json.dump(report, f, indent=2)
        print(f"Report saved to {args.report}")

    # Summary
    report = generate_scoring_report(scored)
    print(f"\nScored {report['total_items']} items:")
    print(f"  Average Score: {report['average_score']}")
    print(f"  By Tier: Hot={report['by_tier']['Hot']}, Warm={report['by_tier']['Warm']}, Cold={report['by_tier']['Cold']}")
