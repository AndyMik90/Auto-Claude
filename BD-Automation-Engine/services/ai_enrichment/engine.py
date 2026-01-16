"""
AI Enrichment Engine - Core logic for enriching Notion records with AI
"""
import os
import json
import re
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from anthropic import Anthropic
from dotenv import load_dotenv

load_dotenv()


class EnrichmentEngine:
    """Core AI enrichment logic for BD pipeline"""

    # Location to Program mapping (DCGS focus areas)
    LOCATION_PROGRAM_MAP = {
        # Langley / Hampton Roads
        'langley': ['DCGS-A', 'DCGS-AF', 'Distributed Ground System'],
        'hampton': ['DCGS-A', 'DCGS-AF'],
        'norfolk': ['DCGS-N', 'Navy DCGS'],
        'virginia beach': ['DCGS-N', 'Navy DCGS'],

        # Maryland / DC Area
        'fort meade': ['DCGS-A', 'NSA Programs', 'Signals Intelligence'],
        'bethesda': ['DIA Programs', 'Intelligence Community'],
        'columbia': ['DCGS-A', 'NSA Programs'],
        'annapolis junction': ['NSA Programs', 'Signals Intelligence'],

        # Colorado
        'aurora': ['DCGS-AF', 'Space Force', 'NRO Programs'],
        'colorado springs': ['DCGS-AF', 'Space Force', 'NORAD'],
        'peterson': ['DCGS-AF', 'Space Command'],
        'schriever': ['Space Force', 'GPS Programs'],

        # Arizona
        'sierra vista': ['DCGS-A', 'Army Intelligence'],
        'fort huachuca': ['DCGS-A', 'Army Intelligence', 'NETCOM'],

        # Georgia
        'fort gordon': ['DCGS-A', 'Army Cyber', 'Signals Intelligence'],
        'augusta': ['DCGS-A', 'Army Cyber'],

        # Texas
        'san antonio': ['DCGS-AF', 'Air Force Cyber', '25th AF'],
        'fort sam houston': ['DCGS-A', 'Army Medical'],
        'lackland': ['DCGS-AF', 'Air Force ISR'],

        # California
        'beale': ['DCGS-AF', 'U-2 Programs', 'Global Hawk'],
        'los angeles': ['Space Force', 'NRO Programs'],
        'el segundo': ['Space Systems Command', 'Space Force'],

        # Florida
        'macdill': ['CENTCOM', 'SOCOM', 'Special Operations'],
        'tampa': ['CENTCOM', 'SOCOM'],
        'eglin': ['DCGS-AF', 'Air Force Test'],
        'hurlburt': ['AFSOC', 'Special Operations'],

        # Hawaii
        'honolulu': ['INDOPACOM', 'Pacific Intelligence'],
        'pearl harbor': ['DCGS-N', 'Pacific Fleet'],
        'hickam': ['DCGS-AF', 'Pacific Air Forces'],

        # Remote/Multiple
        'remote': ['Multiple Programs', 'Distributed Operations'],
    }

    # Contact Tier Classification by Title
    TIER_PATTERNS = {
        1: [  # C-Suite / Flag Officers
            r'\b(ceo|cto|cio|cfo|coo|president|chairman|vice president|vp)\b',
            r'\b(general|admiral|lieutenant general|major general|rear admiral)\b',
            r'\b(chief .* officer|executive director|managing director)\b',
        ],
        2: [  # Directors / Senior Leaders
            r'\b(director|senior director|associate director)\b',
            r'\b(colonel|captain|commander)\b',
            r'\b(program manager|portfolio manager|division chief)\b',
        ],
        3: [  # Managers / Mid-Level
            r'\b(manager|senior manager|deputy director)\b',
            r'\b(lieutenant colonel|major|lieutenant commander)\b',
            r'\b(team lead|branch chief|section chief)\b',
        ],
        4: [  # Senior Individual Contributors
            r'\b(senior engineer|senior analyst|principal|lead)\b',
            r'\b(architect|specialist|senior consultant)\b',
            r'\b(subject matter expert|sme)\b',
        ],
        5: [  # Individual Contributors
            r'\b(engineer|analyst|developer|consultant)\b',
            r'\b(contractor|specialist|coordinator)\b',
        ],
        6: [  # Support / Entry Level
            r'\b(assistant|associate|intern|trainee)\b',
            r'\b(support|administrative|clerk)\b',
        ],
    }

    # BD Priority Keywords
    PRIORITY_KEYWORDS = {
        'critical': ['dcgs', 'urgent', 'immediate', 'priority', 'critical path'],
        'high': ['recompete', 'sole source', 'incumbent', 'bridge', 'option year'],
        'medium': ['new requirement', 'rfi', 'sources sought', 'market research'],
    }

    def __init__(self, anthropic_key: Optional[str] = None):
        self.anthropic_key = anthropic_key or os.getenv('ANTHROPIC_API_KEY')
        if self.anthropic_key:
            self.client = Anthropic(api_key=self.anthropic_key)
        else:
            self.client = None
            print("Warning: ANTHROPIC_API_KEY not found. AI features disabled.")

    def enrich_job(self, job: Dict) -> Dict:
        """
        Enrich a job posting with program mapping, scoring, and analysis.

        Input: Notion page properties
        Output: Enriched properties to update
        """
        props = job.get('properties', {})
        enriched = {}

        # Extract existing values
        from .notion_client import NotionClient
        title = NotionClient.extract_title(props.get('Job Title', props.get('Name', props.get('title', {}))))
        company = NotionClient.extract_rich_text(props.get('Company', {}))
        location = NotionClient.extract_rich_text(props.get('Location', {}))
        description = NotionClient.extract_rich_text(props.get('Job Description', props.get('Description', {})))
        clearance = NotionClient.extract_select(props.get('Clearance Level', props.get('Clearance', {})))

        # 1. Map location to programs
        mapped_programs = self._map_location_to_programs(location)
        if mapped_programs:
            enriched['Mapped Programs'] = NotionClient.build_rich_text(', '.join(mapped_programs))

        # 2. Calculate BD Score (0-100)
        bd_score = self._calculate_bd_score(
            location=location,
            clearance=clearance,
            description=description,
            company=company
        )
        enriched['BD Score'] = NotionClient.build_number(bd_score)

        # 3. Determine BD Priority
        priority = self._determine_priority(bd_score, description)
        enriched['BD Priority'] = NotionClient.build_select(priority)

        # 4. AI-powered analysis (if available)
        if self.client and description:
            ai_analysis = self._ai_analyze_job(title, company, location, description, clearance)
            if ai_analysis:
                if ai_analysis.get('key_skills'):
                    enriched['Key Skills'] = NotionClient.build_multi_select(ai_analysis['key_skills'][:10])
                if ai_analysis.get('program_alignment'):
                    enriched['Program Alignment'] = NotionClient.build_rich_text(ai_analysis['program_alignment'])
                if ai_analysis.get('win_themes'):
                    enriched['Win Themes'] = NotionClient.build_rich_text(ai_analysis['win_themes'])
                if ai_analysis.get('confidence_score'):
                    enriched['AI Confidence Score'] = NotionClient.build_number(ai_analysis['confidence_score'])

        # 5. Update status
        enriched['Status'] = NotionClient.build_select('enriched')

        return enriched

    def enrich_contact(self, contact: Dict) -> Dict:
        """
        Enrich a contact with tier classification and BD value.

        Input: Notion page properties
        Output: Enriched properties to update
        """
        props = contact.get('properties', {})
        enriched = {}

        from .notion_client import NotionClient

        # Extract existing values
        name = NotionClient.extract_title(props.get('Name', props.get('Contact Name', {})))
        title = NotionClient.extract_rich_text(props.get('Title', props.get('Job Title', {})))
        company = NotionClient.extract_rich_text(props.get('Company', props.get('Organization', {})))
        email = props.get('Email', {}).get('email', '')

        # 1. Classify tier based on title
        tier = self._classify_contact_tier(title)
        enriched['Tier'] = NotionClient.build_select(f'Tier {tier}')

        # 2. Calculate contact value
        contact_value = self._calculate_contact_value(tier, company)
        enriched['Contact Value'] = NotionClient.build_number(contact_value)

        # 3. AI-powered enrichment (if available)
        if self.client and (title or company):
            ai_enrichment = self._ai_analyze_contact(name, title, company)
            if ai_enrichment:
                if ai_enrichment.get('outreach_approach'):
                    approach = ai_enrichment['outreach_approach']
                    if isinstance(approach, list):
                        approach = '\n'.join(approach)
                    enriched['Outreach Approach'] = NotionClient.build_rich_text(str(approach))
                if ai_enrichment.get('talking_points'):
                    points = ai_enrichment['talking_points']
                    if isinstance(points, list):
                        points = '\n'.join(f"• {p}" for p in points)
                    enriched['Talking Points'] = NotionClient.build_rich_text(str(points))

        return enriched

    def enrich_opportunity(self, opportunity: Dict) -> Dict:
        """
        Enrich a BD opportunity with scoring and analysis.

        Input: Notion page properties
        Output: Enriched properties to update
        """
        props = opportunity.get('properties', {})
        enriched = {}

        from .notion_client import NotionClient

        # Extract existing values
        title = NotionClient.extract_title(props.get('Opportunity Name', props.get('Name', {})))
        agency = NotionClient.extract_select(props.get('Agency', {}))
        value = NotionClient.extract_number(props.get('Estimated Value', props.get('Contract Value', {})))
        description = NotionClient.extract_rich_text(props.get('Description', {}))

        # 1. Calculate win probability
        win_prob = self._calculate_win_probability(agency, value, description)
        enriched['Win Probability'] = NotionClient.build_number(win_prob)

        # 2. Calculate revenue potential
        if value and win_prob:
            revenue_potential = value * (win_prob / 100)
            enriched['Revenue Potential'] = NotionClient.build_number(round(revenue_potential, 2))

        # 3. AI-powered analysis (if available)
        if self.client and description:
            ai_analysis = self._ai_analyze_opportunity(title, agency, description)
            if ai_analysis:
                if ai_analysis.get('competitive_landscape'):
                    enriched['Competitive Landscape'] = NotionClient.build_rich_text(ai_analysis['competitive_landscape'])
                if ai_analysis.get('win_strategy'):
                    enriched['Win Strategy'] = NotionClient.build_rich_text(ai_analysis['win_strategy'])

        return enriched

    def generate_playbook(self, job: Dict, contacts: List[Dict]) -> str:
        """
        Generate a BD playbook for a job opportunity.

        Returns: Markdown-formatted playbook
        """
        from .notion_client import NotionClient

        props = job.get('properties', {})
        title = NotionClient.extract_title(props.get('Job Title', props.get('Name', {})))
        company = NotionClient.extract_rich_text(props.get('Company', {}))
        location = NotionClient.extract_rich_text(props.get('Location', {}))
        description = NotionClient.extract_rich_text(props.get('Job Description', {}))

        if not self.client:
            return self._generate_basic_playbook(title, company, location, contacts)

        # Use AI to generate comprehensive playbook
        contact_info = []
        for c in contacts[:5]:  # Top 5 contacts
            c_props = c.get('properties', {})
            contact_info.append({
                'name': NotionClient.extract_title(c_props.get('Name', {})),
                'title': NotionClient.extract_rich_text(c_props.get('Title', {})),
                'company': NotionClient.extract_rich_text(c_props.get('Company', {})),
            })

        prompt = f"""Generate a BD (Business Development) playbook for pursuing this opportunity:

**Job/Opportunity:**
- Title: {title}
- Company: {company}
- Location: {location}
- Description: {description[:1500] if description else 'Not provided'}

**Available Contacts:**
{json.dumps(contact_info, indent=2)}

Create a comprehensive playbook with:
1. **Executive Summary** - Quick overview of the opportunity
2. **Target Analysis** - Key insights about the hiring company
3. **Competitive Positioning** - How to differentiate
4. **Contact Strategy** - Who to reach out to and how
5. **Key Talking Points** - What to emphasize
6. **Next Steps** - Specific actions with timeline
7. **Win Themes** - Core messages to reinforce

Format as clean Markdown."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=2000,
                messages=[{"role": "user", "content": prompt}]
            )
            return response.content[0].text
        except Exception as e:
            print(f"AI playbook generation error: {e}")
            return self._generate_basic_playbook(title, company, location, contacts)

    # === Private Methods ===

    def _map_location_to_programs(self, location: str) -> List[str]:
        """Map a location string to relevant programs"""
        if not location:
            return []

        location_lower = location.lower()
        programs = set()

        for loc_key, loc_programs in self.LOCATION_PROGRAM_MAP.items():
            if loc_key in location_lower:
                programs.update(loc_programs)

        return list(programs)

    def _calculate_bd_score(
        self,
        location: str,
        clearance: Optional[str],
        description: str,
        company: str
    ) -> int:
        """
        Calculate BD Score (0-100) based on multiple factors:
        - Location alignment: +40 max
        - Clearance level: +25 max
        - DCGS keywords: +20 max
        - Prime contractor status: +15 max
        """
        score = 0

        # Location score (0-40)
        if location:
            location_lower = location.lower()
            dcgs_locations = ['langley', 'hampton', 'fort meade', 'aurora', 'beale', 'sierra vista']
            for loc in dcgs_locations:
                if loc in location_lower:
                    score += 40
                    break
            else:
                # Partial credit for other gov locations
                gov_locations = ['washington', 'dc', 'virginia', 'maryland', 'colorado']
                for loc in gov_locations:
                    if loc in location_lower:
                        score += 20
                        break

        # Clearance score (0-25)
        if clearance:
            clearance_scores = {
                'TS/SCI w/ Poly': 25,
                'TS/SCI': 23,
                'TS': 20,
                'Secret': 15,
                'Public Trust': 10,
                'None': 0
            }
            score += clearance_scores.get(clearance, 10)

        # DCGS keyword score (0-20)
        if description:
            desc_lower = description.lower()
            dcgs_keywords = ['dcgs', 'distributed common ground', 'isr', 'sigint',
                            'geoint', 'intelligence', 'surveillance', 'reconnaissance']
            keyword_hits = sum(1 for kw in dcgs_keywords if kw in desc_lower)
            score += min(keyword_hits * 5, 20)

        # Prime contractor score (0-15)
        if company:
            company_lower = company.lower()
            prime_contractors = ['gdit', 'general dynamics', 'northrop', 'lockheed',
                                'raytheon', 'bae', 'leidos', 'booz allen']
            for prime in prime_contractors:
                if prime in company_lower:
                    score += 15
                    break

        return min(score, 100)

    def _determine_priority(self, bd_score: int, description: str) -> str:
        """Determine BD Priority based on score and keywords"""
        # Check for critical keywords first
        if description:
            desc_lower = description.lower()
            for keyword in self.PRIORITY_KEYWORDS['critical']:
                if keyword in desc_lower:
                    return 'Critical'

        # Score-based priority
        if bd_score >= 80:
            return 'Critical'
        elif bd_score >= 60:
            return 'High'
        elif bd_score >= 40:
            return 'Medium'
        else:
            return 'Standard'

    def _classify_contact_tier(self, title: str) -> int:
        """Classify contact into tier 1-6 based on title"""
        if not title:
            return 5  # Default to individual contributor

        title_lower = title.lower()

        for tier, patterns in self.TIER_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, title_lower, re.IGNORECASE):
                    return tier

        return 5  # Default

    def _calculate_contact_value(self, tier: int, company: str) -> int:
        """Calculate contact value score based on tier and company"""
        base_values = {1: 100, 2: 80, 3: 60, 4: 40, 5: 20, 6: 10}
        value = base_values.get(tier, 20)

        # Bonus for prime contractors
        if company:
            company_lower = company.lower()
            primes = ['gdit', 'northrop', 'lockheed', 'raytheon', 'leidos', 'booz allen']
            for prime in primes:
                if prime in company_lower:
                    value += 20
                    break

        return min(value, 100)

    def _calculate_win_probability(
        self,
        agency: Optional[str],
        value: Optional[float],
        description: str
    ) -> int:
        """Calculate win probability percentage"""
        prob = 50  # Base probability

        # Agency familiarity bonus
        familiar_agencies = ['DoD', 'Army', 'Air Force', 'Navy', 'DIA', 'NGA']
        if agency in familiar_agencies:
            prob += 10

        # Size adjustment (smaller contracts = higher probability)
        if value:
            if value < 1_000_000:
                prob += 15
            elif value < 10_000_000:
                prob += 5
            elif value > 100_000_000:
                prob -= 10

        # Keyword indicators
        if description:
            desc_lower = description.lower()
            positive_indicators = ['small business', 'set-aside', 'sole source']
            negative_indicators = ['full and open', 'large business', 'competitive']

            for pos in positive_indicators:
                if pos in desc_lower:
                    prob += 10
                    break

            for neg in negative_indicators:
                if neg in desc_lower:
                    prob -= 10
                    break

        return max(min(prob, 95), 5)  # Clamp between 5-95%

    def _ai_analyze_job(
        self,
        title: str,
        company: str,
        location: str,
        description: str,
        clearance: Optional[str]
    ) -> Optional[Dict]:
        """Use AI to analyze a job posting"""
        if not self.client:
            return None

        prompt = f"""Analyze this job posting for BD intelligence:

Title: {title}
Company: {company}
Location: {location}
Clearance: {clearance or 'Not specified'}
Description: {description[:2000]}

Provide a JSON response with:
{{
    "key_skills": ["skill1", "skill2", ...],  // Top 5-10 technical skills required
    "program_alignment": "Brief description of which federal programs this aligns with",
    "win_themes": "Key differentiators we should emphasize",
    "confidence_score": 0.0-1.0  // How confident you are in this analysis
}}

Only return valid JSON, no other text."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=1000,
                messages=[{"role": "user", "content": prompt}]
            )
            result_text = response.content[0].text
            # Extract JSON from response
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                return json.loads(json_match.group())
        except Exception as e:
            print(f"AI job analysis error: {e}")

        return None

    def _ai_analyze_contact(
        self,
        name: str,
        title: str,
        company: str
    ) -> Optional[Dict]:
        """Use AI to analyze a contact"""
        if not self.client:
            return None

        prompt = f"""Analyze this contact for BD outreach strategy:

Name: {name}
Title: {title}
Company: {company}

Provide a JSON response with:
{{
    "outreach_approach": "Recommended approach for initial contact (2-3 sentences)",
    "talking_points": "Key topics to discuss based on their role (2-3 bullet points)"
}}

Only return valid JSON, no other text."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=500,
                messages=[{"role": "user", "content": prompt}]
            )
            result_text = response.content[0].text
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                return json.loads(json_match.group())
        except Exception as e:
            print(f"AI contact analysis error: {e}")

        return None

    def _ai_analyze_opportunity(
        self,
        title: str,
        agency: Optional[str],
        description: str
    ) -> Optional[Dict]:
        """Use AI to analyze an opportunity"""
        if not self.client:
            return None

        prompt = f"""Analyze this BD opportunity:

Title: {title}
Agency: {agency or 'Not specified'}
Description: {description[:2000]}

Provide a JSON response with:
{{
    "competitive_landscape": "Who are likely competitors and their strengths",
    "win_strategy": "Recommended approach to win this opportunity"
}}

Only return valid JSON, no other text."""

        try:
            response = self.client.messages.create(
                model="claude-sonnet-4-20250514",
                max_tokens=800,
                messages=[{"role": "user", "content": prompt}]
            )
            result_text = response.content[0].text
            json_match = re.search(r'\{[\s\S]*\}', result_text)
            if json_match:
                return json.loads(json_match.group())
        except Exception as e:
            print(f"AI opportunity analysis error: {e}")

        return None

    def _generate_basic_playbook(
        self,
        title: str,
        company: str,
        location: str,
        contacts: List[Dict]
    ) -> str:
        """Generate a basic playbook without AI"""
        from .notion_client import NotionClient

        contact_list = ""
        for c in contacts[:5]:
            c_props = c.get('properties', {})
            name = NotionClient.extract_title(c_props.get('Name', {}))
            c_title = NotionClient.extract_rich_text(c_props.get('Title', {}))
            contact_list += f"- {name} ({c_title})\n"

        return f"""# BD Playbook: {title}

## Target
- **Company:** {company}
- **Location:** {location}

## Key Contacts
{contact_list or "No contacts identified yet."}

## Next Steps
1. Research company background and recent wins
2. Identify decision makers and influencers
3. Prepare initial outreach messaging
4. Schedule introductory calls
5. Follow up with capability briefing

## Notes
_Add your notes here as you progress._
"""
