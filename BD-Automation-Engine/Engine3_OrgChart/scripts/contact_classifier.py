"""
Contact Classification Engine
Classifies contacts into 6-tier hierarchy with BD priority assignment.

Based on: contact-classification-skill.md
"""

import re
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass


# ============================================
# HIERARCHY TIER DEFINITIONS
# ============================================

TIER_DEFINITIONS = {
    1: {
        "name": "Executive",
        "patterns": [
            r"\b(CEO|CTO|COO|CFO|CIO|CISO)\b",
            r"\bChief\s+\w+\s+Officer\b",
            r"\bPresident\b",
            r"\bGeneral\s+Manager\b",
            r"\bExecutive\s+(VP|Vice\s+President)\b",
            r"\bSVP\b",
            r"\bSenior\s+Vice\s+President\b",
        ],
        "bd_priority": "Critical",
        "bd_emoji": "red_circle",
        "outreach_sequence": "D - Strategic Engagement"
    },
    2: {
        "name": "Director",
        "patterns": [
            r"\bDirector\b(?!\s+of\s+(?:Engineering|IT|Operations))",
            r"\bVP\b",
            r"\bVice\s+President\b",
            r"\bDivision\s+(?:Head|Chief|Lead)\b",
            r"\bAssociate\s+Director\b",
        ],
        "bd_priority": "Critical",
        "bd_emoji": "red_circle",
        "outreach_sequence": "D - Strategic Engagement"
    },
    3: {
        "name": "Program Leadership",
        "patterns": [
            r"\bProgram\s+Manager\b",
            r"\bProject\s+Manager\b",
            r"\bSite\s+Lead\b",
            r"\bTask\s+Order\s+Manager\b",
            r"\bDeputy\s+Program\s+Manager\b",
            r"\bPrincipal\s+(?:Engineer|Scientist|Analyst)\b",
            r"\bChief\s+(?:Engineer|Architect|Scientist)\b",
        ],
        "bd_priority": "High",
        "bd_emoji": "orange_circle",
        "outreach_sequence": "C - Program Engagement"
    },
    4: {
        "name": "Management",
        "patterns": [
            r"\bManager\b",
            r"\bTeam\s+Lead\b",
            r"\bTechnical\s+Lead\b",
            r"\bSupervisor\b",
            r"\bSection\s+(?:Chief|Lead)\b",
            r"\bBranch\s+(?:Chief|Manager)\b",
            r"\bGroup\s+Lead\b",
        ],
        "bd_priority": "High",
        "bd_emoji": "orange_circle",
        "outreach_sequence": "B - Validation Approach"
    },
    5: {
        "name": "Senior IC",
        "patterns": [
            r"\bSenior\s+(?:Engineer|Developer|Analyst|Specialist|Consultant)\b",
            r"\bSr\.?\s+(?:Engineer|Developer|Analyst|Specialist)\b",
            r"\bLead\s+(?:Engineer|Developer|Analyst)\b",
            r"\bStaff\s+(?:Engineer|Scientist)\b",
            r"\bArchitect\b",
            r"\bSME\b",
            r"\bSubject\s+Matter\s+Expert\b",
        ],
        "bd_priority": "Medium",
        "bd_emoji": "yellow_circle",
        "outreach_sequence": "A - Discovery Approach"
    },
    6: {
        "name": "Individual Contributor",
        "patterns": [
            r"\bEngineer\b",
            r"\bDeveloper\b",
            r"\bAnalyst\b",
            r"\bSpecialist\b",
            r"\bTechnician\b",
            r"\bAdministrator\b",
            r"\bConsultant\b",
        ],
        "bd_priority": "Standard",
        "bd_emoji": "white_circle",
        "outreach_sequence": "A - Discovery Approach"
    }
}


# ============================================
# LOCATION TO PROGRAM MAPPING
# ============================================

LOCATION_PROGRAM_MAP = {
    # San Diego Metro
    "San Diego": {"program": "AF DCGS - PACAF", "hub": "San Diego Metro"},
    "La Mesa": {"program": "AF DCGS - PACAF", "hub": "San Diego Metro"},
    "La Jolla": {"program": "Corporate/R&D", "hub": "San Diego Metro"},

    # Hampton Roads
    "Hampton": {"program": "AF DCGS - Langley", "hub": "Hampton Roads"},
    "Newport News": {"program": "AF DCGS - Langley", "hub": "Hampton Roads"},
    "Langley": {"program": "AF DCGS - Langley", "hub": "Hampton Roads"},
    "Norfolk": {"program": "Navy DCGS-N", "hub": "Hampton Roads"},
    "Suffolk": {"program": "Navy DCGS-N", "hub": "Hampton Roads"},

    # Dayton/Wright-Patt
    "Dayton": {"program": "AF DCGS - Wright-Patt", "hub": "Dayton/Wright-Patt"},
    "Beavercreek": {"program": "AF DCGS - Wright-Patt", "hub": "Dayton/Wright-Patt"},
    "Fairborn": {"program": "AF DCGS - Wright-Patt", "hub": "Dayton/Wright-Patt"},

    # DC Metro
    "Herndon": {"program": "Corporate HQ", "hub": "DC Metro"},
    "Falls Church": {"program": "Corporate HQ", "hub": "DC Metro"},
    "Reston": {"program": "Corporate HQ", "hub": "DC Metro"},
    "Fort Belvoir": {"program": "Army DCGS-A", "hub": "DC Metro"},
    "Fort Meade": {"program": "NSA/CYBERCOM", "hub": "DC Metro"},
    "Springfield": {"program": "NGA Programs", "hub": "DC Metro"},
    "McLean": {"program": "IC Corporate", "hub": "DC Metro"},
    "Chantilly": {"program": "NRO/IC", "hub": "DC Metro"},

    # Other
    "Fort Detrick": {"program": "Army DCGS-A", "hub": "Other CONUS"},
    "Aberdeen": {"program": "Army DCGS-A", "hub": "Other CONUS"},
    "Tracy": {"program": "Navy DCGS-N", "hub": "Other CONUS"},
    "Colorado Springs": {"program": "Space Force", "hub": "Other CONUS"},
    "Tampa": {"program": "SOCOM", "hub": "Other CONUS"},
}


# ============================================
# CLASSIFICATION FUNCTIONS
# ============================================

@dataclass
class ClassificationResult:
    """Result of classifying a contact."""
    tier: int
    tier_name: str
    bd_priority: str
    bd_emoji: str
    program: Optional[str]
    location_hub: str
    outreach_sequence: str
    confidence: float


def classify_by_title(title: str) -> Tuple[int, float]:
    """
    Classify contact tier based on job title.

    Args:
        title: Job title string

    Returns:
        Tuple of (tier_number, confidence)
    """
    if not title:
        return 6, 0.3  # Default to IC with low confidence

    title_clean = title.strip()

    # Check each tier's patterns in order (highest tier first)
    for tier in range(1, 7):
        tier_def = TIER_DEFINITIONS[tier]
        for pattern in tier_def["patterns"]:
            if re.search(pattern, title_clean, re.IGNORECASE):
                # Higher confidence for more specific matches
                confidence = 0.9 if tier <= 3 else 0.8
                return tier, confidence

    # Default to Tier 6 if no match
    return 6, 0.5


def infer_program_from_location(location: str) -> Tuple[Optional[str], str]:
    """
    Infer program assignment from contact location.

    Args:
        location: Location string

    Returns:
        Tuple of (program_name, location_hub)
    """
    if not location:
        return None, "Unknown"

    for loc_key, mapping in LOCATION_PROGRAM_MAP.items():
        if loc_key.lower() in location.lower():
            return mapping["program"], mapping["hub"]

    return None, "Unknown"


def classify_contact(contact: Dict) -> ClassificationResult:
    """
    Main function to classify a contact.

    Args:
        contact: Contact dictionary with fields like:
                 - name, title, company, location, email

    Returns:
        ClassificationResult with tier, priority, program assignment
    """
    # Get title classification
    title = contact.get('title', '') or contact.get('Job Title', '')
    tier, confidence = classify_by_title(title)
    tier_def = TIER_DEFINITIONS[tier]

    # Get location-based program inference
    location = contact.get('location', '') or contact.get('Location', '')
    program, location_hub = infer_program_from_location(location)

    # Override program if explicitly provided
    if contact.get('program') or contact.get('Program'):
        program = contact.get('program') or contact.get('Program')

    return ClassificationResult(
        tier=tier,
        tier_name=tier_def["name"],
        bd_priority=tier_def["bd_priority"],
        bd_emoji=tier_def["bd_emoji"],
        program=program,
        location_hub=location_hub,
        outreach_sequence=tier_def["outreach_sequence"],
        confidence=confidence
    )


def classify_contacts_batch(contacts: List[Dict]) -> List[Dict]:
    """
    Classify a batch of contacts.

    Args:
        contacts: List of contact dictionaries

    Returns:
        List of contacts with classification fields added
    """
    results = []

    for contact in contacts:
        classification = classify_contact(contact)

        enriched = contact.copy()
        enriched['_classification'] = {
            'Hierarchy Tier': f"Tier {classification.tier} - {classification.tier_name}",
            'BD Priority': f"{classification.bd_emoji} {classification.bd_priority}",
            'Program': classification.program,
            'Location Hub': classification.location_hub,
            'Outreach Sequence': classification.outreach_sequence,
            'Classification Confidence': classification.confidence,
        }

        results.append(enriched)

    return results


# ============================================
# NOTION PROPERTY FORMATTING
# ============================================

def format_for_notion(classification: ClassificationResult) -> Dict:
    """
    Format classification for Notion database update.

    Args:
        classification: ClassificationResult object

    Returns:
        Dictionary matching Notion property schema
    """
    # Map emoji names to actual emojis for Notion
    emoji_map = {
        "red_circle": "\U0001F534",     # red
        "orange_circle": "\U0001F7E0",  # orange
        "yellow_circle": "\U0001F7E1",  # yellow
        "white_circle": "\u26AA",       # white
    }

    priority_with_emoji = f"{emoji_map.get(classification.bd_emoji, '')} {classification.bd_priority}"

    return {
        "Hierarchy Tier": f"Tier {classification.tier} - {classification.tier_name}",
        "BD Priority": priority_with_emoji,
        "Program": classification.program,
        "Location Hub": classification.location_hub,
    }


# ============================================
# CLI INTERFACE
# ============================================

if __name__ == '__main__':
    import json
    import argparse

    parser = argparse.ArgumentParser(description='Classify contacts into hierarchy tiers')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file with contacts')
    parser.add_argument('--output', '-o', required=True, help='Output JSON file')
    parser.add_argument('--format', choices=['full', 'notion'], default='full',
                        help='Output format (full or notion-ready)')

    args = parser.parse_args()

    # Load contacts
    with open(args.input, 'r') as f:
        contacts = json.load(f)

    # Process
    results = classify_contacts_batch(contacts)

    # Format for Notion if requested
    if args.format == 'notion':
        for r in results:
            classification = ClassificationResult(
                tier=int(r['_classification']['Hierarchy Tier'].split()[1]),
                tier_name=r['_classification']['Hierarchy Tier'].split(' - ')[1],
                bd_priority=r['_classification']['BD Priority'].split()[-1],
                bd_emoji=r['_classification']['BD Priority'].split()[0],
                program=r['_classification']['Program'],
                location_hub=r['_classification']['Location Hub'],
                outreach_sequence=r['_classification']['Outreach Sequence'],
                confidence=r['_classification']['Classification Confidence']
            )
            r['notion_properties'] = format_for_notion(classification)

    # Save results
    with open(args.output, 'w') as f:
        json.dump(results, f, indent=2)

    # Summary
    tier_counts = {}
    for r in results:
        tier = r['_classification']['Hierarchy Tier']
        tier_counts[tier] = tier_counts.get(tier, 0) + 1

    print(f"\nClassified {len(results)} contacts:")
    for tier, count in sorted(tier_counts.items()):
        print(f"  {tier}: {count}")
