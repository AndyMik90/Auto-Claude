"""
Hiring Leader Lookup - Matches jobs to potential hiring leaders from Contacts databases.

Matching signals:
1. Location (state match)
2. Program (prime contractor or program name match)
3. Title seniority (Manager, Director, VP, Lead roles prioritized)
"""

import os
import re
import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, Tuple
import requests
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger('BD-HiringLeader')


# ===========================================
# DATA CLASSES
# ===========================================

@dataclass
class Contact:
    """Normalized contact data."""
    id: str
    name: str
    first_name: str
    job_title: str
    program: str
    city: str
    state: str
    tier: str
    email: str
    phone: str
    linkedin_url: str
    source_db: str  # Which database this came from

    @property
    def full_location(self) -> str:
        if self.city and self.state:
            return f"{self.city}, {self.state}"
        return self.state or self.city or ""

    @property
    def is_leadership(self) -> bool:
        """Check if title indicates leadership role."""
        if not self.job_title:
            return False
        title_lower = self.job_title.lower()
        leadership_keywords = [
            'director', 'manager', 'lead', 'chief', 'head', 'vp',
            'vice president', 'president', 'executive', 'senior'
        ]
        return any(kw in title_lower for kw in leadership_keywords)

    @property
    def seniority_score(self) -> int:
        """Score title seniority (higher = more senior)."""
        if not self.job_title:
            return 0
        title_lower = self.job_title.lower()

        # Score based on title keywords
        if any(x in title_lower for x in ['chief', 'ceo', 'cto', 'cio', 'president']):
            return 100
        if any(x in title_lower for x in ['vp', 'vice president']):
            return 90
        if 'director' in title_lower:
            return 80
        if 'senior manager' in title_lower:
            return 70
        if 'manager' in title_lower:
            return 60
        if any(x in title_lower for x in ['lead', 'principal', 'senior']):
            return 50
        return 30


# ===========================================
# CONTACT LOADER
# ===========================================

class NotionContactLoader:
    """Loads contacts from Notion databases."""

    def __init__(self):
        self.token = os.getenv('NOTION_TOKEN')
        self.headers = {
            'Authorization': f'Bearer {self.token}',
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
        }

        # Database configurations
        self.databases = {
            'DCGS': {
                'id': os.getenv('NOTION_DB_DCGS_CONTACTS'),
                'name_field': 'Name',
                'title_field': 'Job Title',
                'first_name_field': 'First Name',
            },
            'GDIT_Other': {
                'id': os.getenv('NOTION_DB_GDIT_OTHER_CONTACTS'),
                'name_field': 'Name',
                'title_field': 'Job Title',
                'first_name_field': 'First Name',
            },
            'GDIT_PTS': {
                'id': os.getenv('NOTION_DB_GDIT_PTS_CONTACTS'),
                'name_field': 'Contact Name',
                'title_field': 'Role/Title',
                'first_name_field': None,  # PTS doesn't have first name
            }
        }

    def _extract_text(self, prop: Dict, prop_type: str = 'rich_text') -> str:
        """Extract text from Notion property."""
        if not prop:
            return ''

        if prop_type == 'title':
            items = prop.get('title', [])
        elif prop_type == 'rich_text':
            items = prop.get('rich_text', [])
        else:
            return ''

        if items:
            return items[0].get('plain_text', '')
        return ''

    def _extract_select(self, prop: Dict) -> str:
        """Extract select value from Notion property."""
        if not prop:
            return ''
        select = prop.get('select')
        if select:
            return select.get('name', '')
        return ''

    def _parse_contact(self, page: Dict, db_config: Dict, source_db: str) -> Contact:
        """Parse a Notion page into a Contact."""
        props = page.get('properties', {})

        # Extract name
        name_field = db_config['name_field']
        name = self._extract_text(props.get(name_field), 'title')

        # Extract first name
        first_name = ''
        if db_config.get('first_name_field'):
            first_name = self._extract_text(props.get(db_config['first_name_field']))

        # Extract job title
        title_field = db_config['title_field']
        job_title = self._extract_text(props.get(title_field))

        # Common fields
        program = self._extract_select(props.get('Program'))
        city = self._extract_text(props.get('Person City'))
        state = self._extract_text(props.get('Person State'))

        # For PTS database, location is different
        if source_db == 'GDIT_PTS':
            location_site = self._extract_text(props.get('Location/Site'))
            if location_site and not city:
                city = location_site

        tier = self._extract_select(props.get('Hierarchy Tier')) or self._extract_select(props.get('Tier'))

        # Email and phone
        email_prop = props.get('Email Address', {})
        email = email_prop.get('email', '') or ''

        phone_prop = props.get('Phone Number', {})
        phone = phone_prop.get('phone_number', '') or ''

        # LinkedIn
        linkedin_prop = props.get('LinkedIn Contact Profile URL', {})
        linkedin_url = linkedin_prop.get('url', '') or ''

        return Contact(
            id=page.get('id', ''),
            name=name,
            first_name=first_name,
            job_title=job_title,
            program=program,
            city=city,
            state=state,
            tier=tier,
            email=email,
            phone=phone,
            linkedin_url=linkedin_url,
            source_db=source_db
        )

    def load_all_contacts(self) -> List[Contact]:
        """Load all contacts from all configured databases."""
        all_contacts = []

        for db_name, config in self.databases.items():
            db_id = config.get('id')
            if not db_id:
                logger.warning(f"Database {db_name} not configured, skipping")
                continue

            logger.info(f"Loading contacts from {db_name}...")
            contacts = self._load_database(db_id, config, db_name)
            logger.info(f"  Loaded {len(contacts)} contacts")
            all_contacts.extend(contacts)

        logger.info(f"Total contacts loaded: {len(all_contacts)}")
        return all_contacts

    def _load_database(self, db_id: str, config: Dict, source_db: str) -> List[Contact]:
        """Load all contacts from a single database."""
        contacts = []
        has_more = True
        start_cursor = None

        while has_more:
            url = f'https://api.notion.com/v1/databases/{db_id}/query'
            body = {'page_size': 100}
            if start_cursor:
                body['start_cursor'] = start_cursor

            response = requests.post(url, headers=self.headers, json=body)

            if response.status_code != 200:
                logger.error(f"Failed to query {source_db}: {response.status_code}")
                break

            data = response.json()
            results = data.get('results', [])

            for page in results:
                try:
                    contact = self._parse_contact(page, config, source_db)
                    if contact.name:  # Only include contacts with names
                        contacts.append(contact)
                except Exception as e:
                    logger.warning(f"Failed to parse contact: {e}")

            has_more = data.get('has_more', False)
            start_cursor = data.get('next_cursor')

        return contacts


# ===========================================
# HIRING LEADER MATCHER
# ===========================================

class HiringLeaderMatcher:
    """Matches jobs to potential hiring leaders."""

    # State abbreviations for normalization
    STATE_ABBREVS = {
        'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR',
        'california': 'CA', 'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE',
        'florida': 'FL', 'georgia': 'GA', 'hawaii': 'HI', 'idaho': 'ID',
        'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA', 'kansas': 'KS',
        'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
        'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS',
        'missouri': 'MO', 'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV',
        'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
        'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH', 'oklahoma': 'OK',
        'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
        'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT',
        'vermont': 'VT', 'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV',
        'wisconsin': 'WI', 'wyoming': 'WY', 'district of columbia': 'DC'
    }

    def __init__(self, contacts: List[Contact]):
        self.contacts = contacts
        self._build_indexes()

    def _build_indexes(self):
        """Build indexes for fast lookup."""
        self.by_state = {}
        self.by_program = {}
        self.leadership = []

        for contact in self.contacts:
            # Index by state
            state = self._normalize_state(contact.state)
            if state:
                if state not in self.by_state:
                    self.by_state[state] = []
                self.by_state[state].append(contact)

            # Index by program
            if contact.program:
                prog_key = contact.program.lower().strip()
                if prog_key not in self.by_program:
                    self.by_program[prog_key] = []
                self.by_program[prog_key].append(contact)

            # Track leadership contacts
            if contact.is_leadership:
                self.leadership.append(contact)

        logger.info(f"Indexed: {len(self.by_state)} states, {len(self.by_program)} programs, {len(self.leadership)} leaders")

    def _normalize_state(self, state: str) -> Optional[str]:
        """Normalize state to 2-letter abbreviation."""
        if not state:
            return None

        state = state.strip()

        # Already abbreviated
        if len(state) == 2 and state.upper() in self.STATE_ABBREVS.values():
            return state.upper()

        # Full name
        state_lower = state.lower()
        if state_lower in self.STATE_ABBREVS:
            return self.STATE_ABBREVS[state_lower]

        return None

    def _extract_state_from_location(self, location: str) -> Optional[str]:
        """Extract state abbreviation from location string."""
        if not location:
            return None

        # Pattern: "City, ST" or "City, ST ZIP"
        match = re.search(r',\s*([A-Z]{2})(?:\s|\d|$)', location)
        if match:
            return match.group(1)

        # Try full state names
        location_lower = location.lower()
        for name, abbrev in self.STATE_ABBREVS.items():
            if name in location_lower:
                return abbrev

        return None

    def find_hiring_leaders(self, job: Dict, top_n: int = 3) -> List[Tuple[Contact, float]]:
        """Find potential hiring leaders for a job.

        Returns list of (contact, score) tuples, sorted by score descending.
        """
        candidates = []
        seen_ids = set()

        job_state = self._extract_state_from_location(job.get('location', ''))
        job_prime = (job.get('prime', '') or '').lower()
        job_program = (job.get('task_order', '') or '').lower()

        # Score all contacts
        for contact in self.contacts:
            if contact.id in seen_ids:
                continue
            seen_ids.add(contact.id)

            score = self._score_contact(contact, job_state, job_prime, job_program)
            if score > 0:
                candidates.append((contact, score))

        # Sort by score descending
        candidates.sort(key=lambda x: (-x[1], -x[0].seniority_score))

        return candidates[:top_n]

    def _score_contact(self, contact: Contact, job_state: str, job_prime: str, job_program: str) -> float:
        """Score a contact's relevance to a job."""
        score = 0.0

        # Base score for leadership
        if contact.is_leadership:
            score += 20

        # Seniority bonus
        score += contact.seniority_score * 0.1

        # State match (strong signal)
        contact_state = self._normalize_state(contact.state)
        if job_state and contact_state:
            if contact_state == job_state:
                score += 30

        # Program match (strong signal)
        if contact.program:
            contact_prog = contact.program.lower()

            # Direct program match
            if job_program and job_program in contact_prog:
                score += 40
            elif job_program and contact_prog in job_program:
                score += 35

            # Prime contractor match
            if job_prime and job_prime in contact_prog:
                score += 25

            # Keyword overlap
            if job_program:
                job_words = set(job_program.split())
                prog_words = set(contact_prog.split())
                overlap = job_words & prog_words
                if overlap:
                    score += len(overlap) * 5

        # Tier bonus
        if contact.tier:
            tier_lower = contact.tier.lower()
            if 'executive' in tier_lower or 'tier 1' in tier_lower:
                score += 15
            elif 'tier 2' in tier_lower:
                score += 10

        return score


# ===========================================
# MAIN FUNCTION
# ===========================================

def find_hiring_leaders_for_jobs(jobs: List[Dict], contacts: List[Contact] = None) -> List[Dict]:
    """Find hiring leaders for a list of jobs.

    Args:
        jobs: List of job dictionaries
        contacts: Optional pre-loaded contacts (will load from Notion if not provided)

    Returns:
        Jobs with hiring_leader field populated
    """
    # Load contacts if not provided
    if contacts is None:
        loader = NotionContactLoader()
        contacts = loader.load_all_contacts()

    # Build matcher
    matcher = HiringLeaderMatcher(contacts)

    # Find leaders for each job
    for i, job in enumerate(jobs):
        matches = matcher.find_hiring_leaders(job, top_n=3)

        if matches:
            # Format as "Name (Title)" for top match
            top_match = matches[0][0]
            job['hiring_leader'] = f"{top_match.name}"
            if top_match.job_title:
                job['hiring_leader'] += f" ({top_match.job_title})"

            # Store all matches with scores for reference
            job['hiring_leader_matches'] = [
                {
                    'name': c.name,
                    'title': c.job_title,
                    'program': c.program,
                    'location': c.full_location,
                    'score': round(score, 1),
                    'email': c.email,
                    'linkedin': c.linkedin_url
                }
                for c, score in matches
            ]

        if (i + 1) % 50 == 0:
            logger.info(f"Processed {i + 1}/{len(jobs)} jobs")

    return jobs


if __name__ == '__main__':
    import json

    # Test with enriched jobs
    with open('outputs/all_jobs_fully_enriched.json', 'r') as f:
        jobs = json.load(f)

    print(f"Finding hiring leaders for {len(jobs)} jobs...")

    # Load contacts
    loader = NotionContactLoader()
    contacts = loader.load_all_contacts()

    # Find leaders
    jobs = find_hiring_leaders_for_jobs(jobs[:10], contacts)  # Test with first 10

    # Show results
    for job in jobs[:5]:
        print(f"\nJob: {job['title']}")
        print(f"  Location: {job.get('location')}")
        print(f"  Prime: {job.get('prime')}")
        print(f"  Program: {job.get('task_order')}")
        print(f"  Hiring Leader: {job.get('hiring_leader', 'None found')}")
        if job.get('hiring_leader_matches'):
            print("  All matches:")
            for m in job['hiring_leader_matches']:
                print(f"    - {m['name']} ({m['title']}) - Score: {m['score']}")
