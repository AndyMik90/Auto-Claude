"""
BD Data Correlation Engine
===========================
Core engine for correlating data across Notion databases to generate
BD intelligence exports for the Dashboard.

Usage:
    python -m scripts.data_correlation.correlation_engine --run-all
    python -m scripts.data_correlation.correlation_engine --export-jobs
    python -m scripts.data_correlation.correlation_engine --export-contacts
"""

import os
import json
import logging
import re
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, field, asdict
from collections import defaultdict
from pathlib import Path
import requests

from dotenv import load_dotenv

load_dotenv()

# Configure logging with ASCII-safe output for Windows
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger('BD-CorrelationEngine')


# =============================================================================
# CONFIGURATION
# =============================================================================

@dataclass
class NotionConfig:
    """Configuration for Notion API access."""
    token: str = field(default_factory=lambda: os.getenv('NOTION_TOKEN', ''))

    # Database IDs (discovered from schema analysis)
    db_jobs: str = "0a0d7e46-3d88-40b6-853a-3c9680347644"  # Program Mapping Intelligence Hub
    db_programs: str = "9db40fce-0781-42b9-902c-d4b0263b1e23"  # Federal Programs
    db_contractors: str = "ca67175b-df3d-442d-a2e7-cc24e9a1bf78"  # Contractors Database
    db_contract_vehicles: str = "e1166305-1b1f-4812-b665-bcfa6a87a2ab"  # Contract Vehicles
    db_dcgs_contacts: str = "2ccdef65-baa5-80d0-9b66-c67d66e7a54d"  # DCGS Contacts
    db_gdit_contacts: str = "c1b1d358-9d82-4f03-b77c-db43d9795c6f"  # GDIT Other Contacts

    api_base: str = "https://api.notion.com/v1"
    api_version: str = "2022-06-28"


@dataclass
class CorrelationConfig:
    """Configuration for correlation parameters."""
    # Matching thresholds
    location_match_threshold: float = 0.8
    company_match_threshold: float = 0.9

    # BD Score weights
    score_weights: Dict[str, float] = field(default_factory=lambda: {
        'job_count': 0.20,         # More jobs = higher priority
        'contact_quality': 0.25,   # Better contacts = higher priority
        'recency': 0.15,           # Recent activity = higher priority
        'contract_value': 0.20,    # Higher value = higher priority
        'clearance_match': 0.10,   # Clearance alignment
        'pain_points': 0.10        # Known pain points
    })

    # Priority thresholds
    priority_thresholds: Dict[str, int] = field(default_factory=lambda: {
        'critical': 80,   # Red - immediate action
        'high': 60,       # Orange - this week
        'medium': 40,     # Yellow - this month
        'low': 0          # Gray - monitor
    })


# =============================================================================
# DATA MODELS
# =============================================================================

@dataclass
class Job:
    """Represents a job/opportunity from the Jobs database."""
    id: str
    title: str
    company: str = ""
    location: str = ""
    clearance: str = ""
    status: str = ""
    source: str = ""
    source_url: str = ""
    program_name: str = ""
    contract_naics: str = ""
    bd_priority: str = ""
    bd_score: float = 0.0
    posted_date: Optional[str] = None
    # Correlation fields
    matched_program_id: Optional[str] = None
    matched_contacts: List[str] = field(default_factory=list)
    matched_contractor_id: Optional[str] = None


@dataclass
class Program:
    """Represents a federal program from Programs database."""
    id: str
    name: str
    prime_contractor: str = ""
    contract_value: str = ""
    contract_vehicle: str = ""
    period_of_performance: str = ""
    status: str = ""
    location: str = ""
    bd_priority: str = ""
    mission_area: str = ""
    hiring_velocity: str = ""
    notes: str = ""
    # Correlation fields
    job_count: int = 0
    contact_count: int = 0
    active_positions: List[str] = field(default_factory=list)


@dataclass
class Contact:
    """Represents a contact from Contacts databases."""
    id: str
    name: str
    first_name: str = ""
    last_name: str = ""
    title: str = ""
    company: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    program: str = ""
    tier: int = 6  # Default to lowest tier
    bd_priority: str = ""
    relationship_status: str = ""
    last_contact_date: Optional[str] = None
    next_outreach_date: Optional[str] = None
    notes: str = ""
    source_db: str = ""  # 'dcgs' or 'gdit'
    # Correlation fields
    matched_program_id: Optional[str] = None
    matched_jobs: List[str] = field(default_factory=list)


@dataclass
class Contractor:
    """Represents a contractor company from Contractors database."""
    id: str
    name: str
    relationship_status: str = ""
    programs_supported: List[str] = field(default_factory=list)
    placements_made: int = 0
    active_placements: int = 0
    portfolio_value: str = ""
    last_engagement: Optional[str] = None
    # Correlation fields
    job_count: int = 0
    contact_count: int = 0


# =============================================================================
# NEW MIND MAP ENTITY MODELS
# =============================================================================

@dataclass
class Location:
    """Represents a physical location entity for the mind map."""
    id: str
    name: str
    location_hub: str = ""  # Hampton Roads, San Diego Metro, DC Metro, etc.
    city: str = ""
    state: str = ""
    facility_type: str = ""  # AFB, Navy Base, Army Post, Corporate Office, etc.
    # Aggregations
    programs_at_location: List[str] = field(default_factory=list)
    jobs_at_location: List[str] = field(default_factory=list)
    contacts_at_location: List[str] = field(default_factory=list)
    primes_with_presence: List[str] = field(default_factory=list)
    # Stats
    job_count: int = 0
    contact_count: int = 0
    program_count: int = 0


@dataclass
class TaskOrder:
    """Represents a task order under a program (inferred from clusters)."""
    id: str
    name: str
    program_id: str = ""
    program_name: str = ""
    location_id: str = ""
    location_name: str = ""
    prime_id: str = ""
    # Inferred fields
    task_order_leader: Optional[str] = None
    team_ids: List[str] = field(default_factory=list)
    job_ids: List[str] = field(default_factory=list)
    contact_ids: List[str] = field(default_factory=list)
    # Stats
    job_count: int = 0
    contact_count: int = 0


@dataclass
class Team:
    """Represents a team within a task order (inferred from contact clusters)."""
    id: str
    name: str
    task_order_id: str = ""
    program_id: str = ""
    location_id: str = ""
    # Team composition
    team_lead_id: Optional[str] = None
    member_ids: List[str] = field(default_factory=list)
    # Stats
    member_count: int = 0


@dataclass
class Customer:
    """Represents a government customer/agency entity."""
    id: str
    name: str
    mission_area: str = ""
    abbreviation: str = ""
    # Relationships
    program_ids: List[str] = field(default_factory=list)
    # Stats
    program_count: int = 0
    total_contract_value: str = ""


# =============================================================================
# NOTION DATA LOADER
# =============================================================================

class NotionDataLoader:
    """Loads data from all BD-related Notion databases."""

    def __init__(self, config: NotionConfig = None):
        self.config = config or NotionConfig()
        self._validate_config()

    def _validate_config(self):
        """Validate configuration."""
        if not self.config.token:
            # Try to get from environment
            token = os.getenv('NOTION_TOKEN')
            if not token:
                raise ValueError(
                    "NOTION_TOKEN not configured. Set NOTION_TOKEN environment variable."
                )
            self.config.token = token

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for Notion API requests."""
        return {
            "Authorization": f"Bearer {self.config.token}",
            "Notion-Version": self.config.api_version,
            "Content-Type": "application/json"
        }

    def _query_database(self, database_id: str, page_size: int = 100) -> List[Dict]:
        """Query a Notion database with pagination."""
        all_results = []
        has_more = True
        start_cursor = None

        while has_more:
            payload = {"page_size": page_size}
            if start_cursor:
                payload["start_cursor"] = start_cursor

            response = requests.post(
                f"{self.config.api_base}/databases/{database_id}/query",
                headers=self._get_headers(),
                json=payload,
                timeout=30
            )

            if response.status_code != 200:
                logger.error(f"Query failed: {response.status_code} - {response.text}")
                break

            data = response.json()
            all_results.extend(data.get('results', []))

            has_more = data.get('has_more', False)
            start_cursor = data.get('next_cursor')

        return all_results

    def _extract_property(self, props: Dict, key: str, prop_type: str = 'text') -> Any:
        """Extract a property value from Notion page properties."""
        prop = props.get(key, {})

        if prop_type == 'title':
            title_list = prop.get('title', [])
            return title_list[0].get('text', {}).get('content', '') if title_list else ''

        elif prop_type == 'text' or prop_type == 'rich_text':
            text_list = prop.get('rich_text', [])
            return text_list[0].get('text', {}).get('content', '') if text_list else ''

        elif prop_type == 'select':
            select = prop.get('select')
            return select.get('name', '') if select else ''

        elif prop_type == 'multi_select':
            return [item.get('name', '') for item in prop.get('multi_select', [])]

        elif prop_type == 'number':
            return prop.get('number')

        elif prop_type == 'url':
            return prop.get('url', '')

        elif prop_type == 'email':
            return prop.get('email', '')

        elif prop_type == 'phone':
            return prop.get('phone_number', '')

        elif prop_type == 'date':
            date_obj = prop.get('date')
            return date_obj.get('start', '') if date_obj else ''

        elif prop_type == 'relation':
            return [rel.get('id', '') for rel in prop.get('relation', [])]

        elif prop_type == 'formula':
            formula = prop.get('formula', {})
            f_type = formula.get('type', '')
            return formula.get(f_type, '')

        return ''

    def load_jobs(self) -> List[Job]:
        """Load all jobs from the Program Mapping Intelligence Hub."""
        logger.info("Loading jobs from Notion...")

        results = self._query_database(self.config.db_jobs)
        jobs = []

        for page in results:
            props = page.get('properties', {})

            job = Job(
                id=page['id'],
                title=self._extract_property(props, 'Job Title', 'title'),  # Actual property name
                company=self._extract_property(props, 'Company', 'text'),
                location=self._extract_property(props, 'Location', 'text'),
                clearance=self._extract_property(props, 'Clearance Level', 'select'),  # Actual property name
                status=self._extract_property(props, 'Status', 'select'),
                source=self._extract_property(props, 'Source Program', 'select'),  # Actual property name
                source_url=self._extract_property(props, 'Source URL', 'url'),
                program_name=self._extract_property(props, 'Program Name', 'text'),
                contract_naics=self._extract_property(props, 'Contract NAICS', 'text'),
                bd_priority=self._extract_property(props, 'BD Priority Index', 'formula'),  # Use formula for score
            )

            # Try to extract BD score from formula
            bd_score = self._extract_property(props, 'BD Priority Index', 'formula')
            if bd_score and isinstance(bd_score, (int, float)):
                job.bd_score = float(bd_score)

            jobs.append(job)

        logger.info(f"Loaded {len(jobs)} jobs")
        return jobs

    def load_programs(self) -> List[Program]:
        """Load all programs from Federal Programs database."""
        logger.info("Loading programs from Notion...")

        results = self._query_database(self.config.db_programs)
        programs = []

        for page in results:
            props = page.get('properties', {})

            program = Program(
                id=page['id'],
                name=self._extract_property(props, 'Program Name', 'title'),
                prime_contractor=self._extract_property(props, 'Prime Contractor 1', 'text'),  # Text version
                contract_value=self._extract_property(props, 'Contract Value', 'text'),
                contract_vehicle=self._extract_property(props, 'Contract Vehicle/Type', 'text'),
                period_of_performance=self._extract_property(props, 'Period of Performance', 'date'),
                status=self._extract_property(props, 'Priority Level', 'select'),  # Actual property name
                location=self._extract_property(props, 'Key Locations', 'text'),  # Actual property name
                bd_priority=self._extract_property(props, 'BD Priority', 'select'),
                mission_area=self._extract_property(props, 'Mission Area', 'text'),
                hiring_velocity=self._extract_property(props, 'Hiring Velocity', 'select'),
                notes=self._extract_property(props, 'Notes', 'text'),
            )

            programs.append(program)

        logger.info(f"Loaded {len(programs)} programs")
        return programs

    def load_contacts(self, source: str = 'all') -> List[Contact]:
        """Load contacts from contact databases."""
        contacts = []

        if source in ('all', 'dcgs'):
            logger.info("Loading DCGS contacts...")
            dcgs_results = self._query_database(self.config.db_dcgs_contacts)

            for page in dcgs_results:
                props = page.get('properties', {})

                contact = Contact(
                    id=page['id'],
                    name=self._extract_property(props, 'Name', 'title'),
                    first_name=self._extract_property(props, 'First Name', 'text'),
                    last_name='',  # DCGS may not have this field
                    title=self._extract_property(props, 'Job Title', 'text'),  # Actual property name
                    company=self._extract_property(props, 'Company', 'text'),  # May not exist in DCGS
                    email=self._extract_property(props, 'Email Address', 'email'),  # Actual property name
                    phone=self._extract_property(props, 'Phone Number', 'phone'),
                    linkedin=self._extract_property(props, 'LinkedIn Contact Profile URL', 'url'),  # Actual property name
                    program=self._extract_property(props, 'Program', 'select'),  # It's a select
                    bd_priority=self._extract_property(props, 'BD Priority', 'select'),
                    relationship_status=self._extract_property(props, 'Relationship Strength', 'select'),  # Actual property name
                    last_contact_date=self._extract_property(props, 'Last Contact Date', 'date'),
                    next_outreach_date=self._extract_property(props, 'Next Outreach Date', 'date'),
                    notes=self._extract_property(props, 'Outreach History', 'text'),  # Actual property name
                    source_db='dcgs'
                )

                # Try to extract tier from Hierarchy Tier select
                tier = self._extract_property(props, 'Hierarchy Tier', 'select')  # Actual property name
                if tier:
                    # Parse tier number from string like "Tier 3 - Program Leadership"
                    match = re.search(r'Tier\s*(\d+)', str(tier))
                    if match:
                        contact.tier = int(match.group(1))

                contacts.append(contact)

            logger.info(f"Loaded {len(dcgs_results)} DCGS contacts")

        if source in ('all', 'gdit'):
            logger.info("Loading GDIT contacts...")
            gdit_results = self._query_database(self.config.db_gdit_contacts)

            for page in gdit_results:
                props = page.get('properties', {})

                contact = Contact(
                    id=page['id'],
                    name=self._extract_property(props, 'Name', 'title'),
                    first_name=self._extract_property(props, 'First Name', 'text'),
                    last_name='',  # May not exist
                    title=self._extract_property(props, 'Job Title', 'text'),  # Actual property name
                    company='GDIT',  # Default for this database
                    email=self._extract_property(props, 'Email Address', 'email'),  # Actual property name
                    phone=self._extract_property(props, 'Phone Number', 'phone'),
                    linkedin=self._extract_property(props, 'LinkedIn Contact Profile URL', 'url'),  # Actual property name
                    program=self._extract_property(props, 'Program', 'select'),  # It's a select
                    bd_priority=self._extract_property(props, 'BD Priority', 'select'),
                    relationship_status=self._extract_property(props, 'Relationship Strength', 'select'),  # Actual property name
                    last_contact_date=self._extract_property(props, 'Last Contact Date', 'date'),
                    next_outreach_date=self._extract_property(props, 'Next Outreach Date', 'date'),
                    notes=self._extract_property(props, 'Outreach History', 'text'),  # Actual property name
                    source_db='gdit'
                )

                # Try to extract tier from Hierarchy Tier select
                tier = self._extract_property(props, 'Hierarchy Tier', 'select')  # Actual property name
                if tier:
                    match = re.search(r'Tier\s*(\d+)', str(tier))
                    if match:
                        contact.tier = int(match.group(1))

                contacts.append(contact)

            logger.info(f"Loaded {len(gdit_results)} GDIT contacts")

        logger.info(f"Total contacts loaded: {len(contacts)}")
        return contacts

    def load_contractors(self) -> List[Contractor]:
        """Load contractors from Contractors Database."""
        logger.info("Loading contractors from Notion...")

        results = self._query_database(self.config.db_contractors)
        contractors = []

        for page in results:
            props = page.get('properties', {})

            contractor = Contractor(
                id=page['id'],
                name=self._extract_property(props, 'Name', 'title'),
                relationship_status=self._extract_property(props, 'Relationship Status', 'select'),
                placements_made=self._extract_property(props, 'PTS Placements Made', 'number') or 0,
                active_placements=self._extract_property(props, 'Active Placements', 'number') or 0,
                portfolio_value=self._extract_property(props, 'Portfolio Value', 'text'),
                last_engagement=self._extract_property(props, 'Last Engagement Date', 'date'),
            )

            contractors.append(contractor)

        logger.info(f"Loaded {len(contractors)} contractors")
        return contractors


# =============================================================================
# DATA CORRELATOR
# =============================================================================

class DataCorrelator:
    """Correlates data across different databases."""

    def __init__(self, config: CorrelationConfig = None):
        self.config = config or CorrelationConfig()

    def _normalize_text(self, text: str) -> str:
        """Normalize text for matching."""
        if not text:
            return ""
        return re.sub(r'[^a-z0-9\s]', '', text.lower()).strip()

    def _location_similarity(self, loc1: str, loc2: str) -> float:
        """Calculate similarity between two locations."""
        norm1 = self._normalize_text(loc1)
        norm2 = self._normalize_text(loc2)

        if not norm1 or not norm2:
            return 0.0

        if norm1 == norm2:
            return 1.0

        # Check for city match
        cities1 = set(norm1.split())
        cities2 = set(norm2.split())

        common = cities1.intersection(cities2)
        if common:
            return len(common) / max(len(cities1), len(cities2))

        return 0.0

    def _company_similarity(self, comp1: str, comp2: str) -> float:
        """Calculate similarity between two company names."""
        norm1 = self._normalize_text(comp1)
        norm2 = self._normalize_text(comp2)

        if not norm1 or not norm2:
            return 0.0

        if norm1 == norm2:
            return 1.0

        # Check for common abbreviations
        abbreviations = {
            'gdit': 'general dynamics',
            'bae': 'bae systems',
            'leidos': 'leidos',
            'booz': 'booz allen',
        }

        for abbr, full in abbreviations.items():
            if abbr in norm1 and full in norm2:
                return 0.9
            if full in norm1 and abbr in norm2:
                return 0.9

        # Word overlap
        words1 = set(norm1.split())
        words2 = set(norm2.split())
        common = words1.intersection(words2)

        if common:
            return len(common) / max(len(words1), len(words2))

        return 0.0

    def correlate_jobs_to_programs(
        self,
        jobs: List[Job],
        programs: List[Program]
    ) -> Tuple[List[Job], List[Program]]:
        """Match jobs to programs based on location, company, and keywords."""
        logger.info("Correlating jobs to programs...")

        # Build program lookup by location and company
        program_lookup = {}
        for program in programs:
            # Index by normalized location
            loc_key = self._normalize_text(program.location)
            if loc_key:
                if loc_key not in program_lookup:
                    program_lookup[loc_key] = []
                program_lookup[loc_key].append(program)

            # Index by prime contractor
            comp_key = self._normalize_text(program.prime_contractor)
            if comp_key:
                if comp_key not in program_lookup:
                    program_lookup[comp_key] = []
                program_lookup[comp_key].append(program)

        # Initialize program job counts
        program_job_counts = defaultdict(int)
        program_active_positions = defaultdict(list)

        # Match jobs to programs
        for job in jobs:
            best_match = None
            best_score = 0.0

            # Try location matching first
            job_loc = self._normalize_text(job.location)
            for loc_key, progs in program_lookup.items():
                for prog in progs:
                    loc_score = self._location_similarity(job.location, prog.location)
                    comp_score = self._company_similarity(job.company, prog.prime_contractor)

                    # Combined score
                    score = (loc_score * 0.6) + (comp_score * 0.4)

                    if score > best_score and score >= self.config.location_match_threshold:
                        best_score = score
                        best_match = prog

            if best_match:
                job.matched_program_id = best_match.id
                program_job_counts[best_match.id] += 1
                if job.title and job.title not in program_active_positions[best_match.id]:
                    program_active_positions[best_match.id].append(job.title)

        # Update program statistics
        for program in programs:
            program.job_count = program_job_counts.get(program.id, 0)
            program.active_positions = program_active_positions.get(program.id, [])

        matched_count = sum(1 for j in jobs if j.matched_program_id)
        logger.info(f"Matched {matched_count}/{len(jobs)} jobs to programs")

        return jobs, programs

    def correlate_contacts_to_programs(
        self,
        contacts: List[Contact],
        programs: List[Program]
    ) -> Tuple[List[Contact], List[Program]]:
        """Match contacts to programs based on program field and company."""
        logger.info("Correlating contacts to programs...")

        # Build program name lookup
        program_by_name = {}
        for program in programs:
            name_key = self._normalize_text(program.name)
            if name_key:
                program_by_name[name_key] = program

        program_contact_counts = defaultdict(int)

        for contact in contacts:
            # Try to match by program field
            contact_program = self._normalize_text(contact.program)

            best_match = None

            # Direct program name match
            if contact_program in program_by_name:
                best_match = program_by_name[contact_program]
            else:
                # Partial match
                for prog_name, prog in program_by_name.items():
                    if contact_program and (
                        contact_program in prog_name or
                        prog_name in contact_program
                    ):
                        best_match = prog
                        break

            # Fallback to company match
            if not best_match:
                contact_company = self._normalize_text(contact.company)
                for program in programs:
                    if self._company_similarity(contact.company, program.prime_contractor) >= 0.8:
                        best_match = program
                        break

            if best_match:
                contact.matched_program_id = best_match.id
                program_contact_counts[best_match.id] += 1

        # Update program contact counts
        for program in programs:
            program.contact_count = program_contact_counts.get(program.id, 0)

        matched_count = sum(1 for c in contacts if c.matched_program_id)
        logger.info(f"Matched {matched_count}/{len(contacts)} contacts to programs")

        return contacts, programs

    def correlate_jobs_to_contacts(
        self,
        jobs: List[Job],
        contacts: List[Contact]
    ) -> Tuple[List[Job], List[Contact]]:
        """Match jobs to relevant contacts for outreach."""
        logger.info("Correlating jobs to contacts...")

        # Build contact lookup by program
        contacts_by_program = defaultdict(list)
        for contact in contacts:
            if contact.matched_program_id:
                contacts_by_program[contact.matched_program_id].append(contact)

        # Match jobs to contacts via program
        for job in jobs:
            if job.matched_program_id and job.matched_program_id in contacts_by_program:
                relevant_contacts = contacts_by_program[job.matched_program_id]
                # Sort by tier (lower is better) and take top 5
                sorted_contacts = sorted(relevant_contacts, key=lambda c: c.tier)[:5]
                job.matched_contacts = [c.id for c in sorted_contacts]

                # Update contact with matched job
                for contact in sorted_contacts:
                    if job.id not in contact.matched_jobs:
                        contact.matched_jobs.append(job.id)

        jobs_with_contacts = sum(1 for j in jobs if j.matched_contacts)
        logger.info(f"{jobs_with_contacts}/{len(jobs)} jobs have matched contacts")

        return jobs, contacts

    def correlate_contractors_to_jobs(
        self,
        contractors: List[Contractor],
        jobs: List[Job]
    ) -> List[Contractor]:
        """Count jobs per contractor company."""
        logger.info("Correlating contractors to jobs...")

        contractor_job_counts = defaultdict(int)

        for job in jobs:
            job_company = self._normalize_text(job.company)

            for contractor in contractors:
                contractor_name = self._normalize_text(contractor.name)
                if self._company_similarity(job.company, contractor.name) >= 0.8:
                    contractor_job_counts[contractor.id] += 1
                    job.matched_contractor_id = contractor.id
                    break

        for contractor in contractors:
            contractor.job_count = contractor_job_counts.get(contractor.id, 0)

        return contractors


# =============================================================================
# LOCATION ENTITY EXTRACTOR
# =============================================================================

class LocationExtractor:
    """Extracts and normalizes Location entities from various data sources."""

    # Location hub mapping for known areas
    LOCATION_HUBS = {
        'hampton roads': 'Hampton Roads',
        'norfolk': 'Hampton Roads',
        'virginia beach': 'Hampton Roads',
        'portsmouth': 'Hampton Roads',
        'chesapeake': 'Hampton Roads',
        'langley': 'Hampton Roads',
        'san diego': 'San Diego Metro',
        'coronado': 'San Diego Metro',
        'point loma': 'San Diego Metro',
        'dc': 'DC Metro',
        'washington': 'DC Metro',
        'arlington': 'DC Metro',
        'alexandria': 'DC Metro',
        'fairfax': 'DC Metro',
        'mclean': 'DC Metro',
        'reston': 'DC Metro',
        'tysons': 'DC Metro',
        'fort belvoir': 'DC Metro',
        'fort meade': 'DC Metro',
        'aberdeen': 'DC Metro',
        'dayton': 'Dayton/Wright-Patt',
        'wright-patterson': 'Dayton/Wright-Patt',
        'wright patterson': 'Dayton/Wright-Patt',
        'wpafb': 'Dayton/Wright-Patt',
    }

    # Facility type detection patterns
    FACILITY_PATTERNS = {
        'AFB': ['afb', 'air force base', 'air base'],
        'Navy Base': ['navy', 'naval', 'nas ', 'navsta'],
        'Army Post': ['army', 'fort ', 'camp '],
        'Data Center': ['data center', 'datacenter'],
        'Corporate Office': ['office', 'hq', 'headquarters'],
    }

    def __init__(self):
        self.locations: Dict[str, Location] = {}
        self._location_counter = 0

    def _normalize_location_key(self, loc_str: str) -> str:
        """Create a normalized key for deduplication."""
        if not loc_str:
            return ""
        # Normalize: lowercase, remove special chars, collapse whitespace
        return re.sub(r'[^a-z0-9\s]', '', loc_str.lower()).strip()

    def _parse_location_string(self, loc_str: str) -> Tuple[str, str, str]:
        """Parse location string to extract city, state, and name."""
        if not loc_str:
            return "", "", ""

        # Common patterns: "City, ST", "City, State", "Base Name, City, ST"
        parts = [p.strip() for p in loc_str.split(',')]

        city = ""
        state = ""
        name = loc_str

        if len(parts) >= 2:
            # Check if last part is a state abbreviation or state name
            last_part = parts[-1].strip().upper()
            state_abbrevs = ['VA', 'MD', 'CA', 'TX', 'FL', 'NC', 'OH', 'CO', 'AZ', 'GA', 'PA', 'NY', 'DC']
            if last_part in state_abbrevs or len(last_part) == 2:
                state = last_part
                city = parts[-2].strip() if len(parts) >= 2 else ""
                name = ', '.join(parts[:-1]) if len(parts) > 2 else city

        return city, state, name

    def _detect_facility_type(self, loc_str: str) -> str:
        """Detect the type of facility from location string."""
        loc_lower = loc_str.lower()
        for facility_type, patterns in self.FACILITY_PATTERNS.items():
            for pattern in patterns:
                if pattern in loc_lower:
                    return facility_type
        return "Other"

    def _detect_location_hub(self, loc_str: str) -> str:
        """Detect which location hub this belongs to."""
        loc_lower = loc_str.lower()
        for keyword, hub in self.LOCATION_HUBS.items():
            if keyword in loc_lower:
                return hub
        return "Other CONUS"

    def _generate_location_id(self, key: str) -> str:
        """Generate a unique location ID."""
        self._location_counter += 1
        # Create a hash-based ID for consistency
        import hashlib
        hash_part = hashlib.md5(key.encode()).hexdigest()[:8]
        return f"loc-{hash_part}"

    def extract_location(self, loc_str: str) -> Optional[Location]:
        """Extract or retrieve a Location entity from a location string."""
        if not loc_str:
            return None

        key = self._normalize_location_key(loc_str)
        if not key:
            return None

        # Check if already extracted
        if key in self.locations:
            return self.locations[key]

        # Parse and create new location
        city, state, name = self._parse_location_string(loc_str)
        location_hub = self._detect_location_hub(loc_str)
        facility_type = self._detect_facility_type(loc_str)

        location = Location(
            id=self._generate_location_id(key),
            name=name if name else loc_str,
            location_hub=location_hub,
            city=city,
            state=state,
            facility_type=facility_type
        )

        self.locations[key] = location
        return location

    def extract_from_jobs(self, jobs: List[Job]) -> Dict[str, Location]:
        """Extract locations from all jobs."""
        for job in jobs:
            if job.location:
                location = self.extract_location(job.location)
                if location:
                    if job.id not in location.jobs_at_location:
                        location.jobs_at_location.append(job.id)
                    location.job_count = len(location.jobs_at_location)
        return self.locations

    def extract_from_contacts(self, contacts: List[Contact]) -> Dict[str, Location]:
        """Extract locations from contacts (using their company/program location context)."""
        # Contacts may have location info in notes or inferred from program
        # For now, we'll link contacts to locations based on matched program
        return self.locations

    def extract_from_programs(self, programs: List[Program]) -> Dict[str, Location]:
        """Extract locations from programs."""
        for program in programs:
            if program.location:
                # Programs may have multiple locations (comma-separated)
                loc_parts = [l.strip() for l in program.location.split(';')]
                for loc_str in loc_parts:
                    if loc_str:
                        location = self.extract_location(loc_str)
                        if location:
                            if program.id not in location.programs_at_location:
                                location.programs_at_location.append(program.id)
                            location.program_count = len(location.programs_at_location)
                            # Track prime presence
                            if program.prime_contractor and program.prime_contractor not in location.primes_with_presence:
                                location.primes_with_presence.append(program.prime_contractor)
        return self.locations

    def link_contacts_to_locations(
        self,
        contacts: List[Contact],
        programs: List[Program]
    ) -> Dict[str, Location]:
        """Link contacts to locations via their matched programs."""
        # Build program->location map
        program_locations = {}
        for program in programs:
            if program.location:
                key = self._normalize_location_key(program.location.split(';')[0])
                if key in self.locations:
                    program_locations[program.id] = self.locations[key]

        # Link contacts via program
        for contact in contacts:
            if contact.matched_program_id and contact.matched_program_id in program_locations:
                location = program_locations[contact.matched_program_id]
                if contact.id not in location.contacts_at_location:
                    location.contacts_at_location.append(contact.id)
                location.contact_count = len(location.contacts_at_location)

        return self.locations

    def get_all_locations(self) -> List[Location]:
        """Return all extracted locations as a list."""
        return list(self.locations.values())


# =============================================================================
# TASK ORDER INFERENCER
# =============================================================================

class TaskOrderInferencer:
    """Infers Task Order entities from program/location clusters."""

    def __init__(self):
        self.task_orders: Dict[str, TaskOrder] = {}
        self._counter = 0

    def _generate_task_order_id(self, program_id: str, location_id: str) -> str:
        """Generate a unique task order ID."""
        import hashlib
        key = f"{program_id}:{location_id}"
        hash_part = hashlib.md5(key.encode()).hexdigest()[:8]
        return f"to-{hash_part}"

    def _create_task_order_name(self, program_name: str, location_name: str) -> str:
        """Create a descriptive task order name."""
        if location_name and program_name:
            return f"{program_name} / {location_name}"
        return program_name or location_name or "Unknown Task Order"

    def infer_task_orders(
        self,
        programs: List[Program],
        locations: List[Location],
        jobs: List[Job],
        contacts: List[Contact]
    ) -> List[TaskOrder]:
        """Infer task orders from program/location combinations."""
        logger.info("Inferring task orders from program/location clusters...")

        # Build lookup maps
        location_by_id = {loc.id: loc for loc in locations}
        program_by_id = {prog.id: prog for prog in programs}

        # Group jobs by (program, location)
        job_clusters = defaultdict(list)
        for job in jobs:
            if job.matched_program_id:
                # Find location for this job
                loc_key = self._normalize_location_key(job.location) if job.location else ""
                job_clusters[(job.matched_program_id, loc_key)].append(job)

        # Group contacts by (program, location)
        contact_clusters = defaultdict(list)
        for contact in contacts:
            if contact.matched_program_id:
                contact_clusters[contact.matched_program_id].append(contact)

        # Create task orders for significant clusters
        for (program_id, loc_key), cluster_jobs in job_clusters.items():
            if len(cluster_jobs) >= 1:  # Create task order if there's at least 1 job
                program = program_by_id.get(program_id)
                if not program:
                    continue

                # Find matching location
                location = None
                location_id = ""
                location_name = ""
                for loc in locations:
                    if self._normalize_location_key(loc.name) == loc_key:
                        location = loc
                        location_id = loc.id
                        location_name = loc.name
                        break

                # Create task order
                to_id = self._generate_task_order_id(program_id, location_id or "no-loc")

                if to_id not in self.task_orders:
                    task_order = TaskOrder(
                        id=to_id,
                        name=self._create_task_order_name(program.name, location_name),
                        program_id=program_id,
                        program_name=program.name,
                        location_id=location_id,
                        location_name=location_name,
                        prime_id=program.prime_contractor
                    )

                    # Add jobs
                    task_order.job_ids = [j.id for j in cluster_jobs]
                    task_order.job_count = len(cluster_jobs)

                    # Add contacts from the same program
                    program_contacts = contact_clusters.get(program_id, [])
                    task_order.contact_ids = [c.id for c in program_contacts]
                    task_order.contact_count = len(program_contacts)

                    # Infer task order leader (highest tier contact)
                    if program_contacts:
                        sorted_contacts = sorted(program_contacts, key=lambda c: c.tier)
                        task_order.task_order_leader = sorted_contacts[0].id

                    self.task_orders[to_id] = task_order

        logger.info(f"Inferred {len(self.task_orders)} task orders")
        return list(self.task_orders.values())

    def _normalize_location_key(self, loc_str: str) -> str:
        """Normalize location string for matching."""
        if not loc_str:
            return ""
        return re.sub(r'[^a-z0-9\s]', '', loc_str.lower()).strip()


# =============================================================================
# TEAM BUILDER
# =============================================================================

class TeamBuilder:
    """Creates Team entities from contact clusters."""

    def __init__(self):
        self.teams: Dict[str, Team] = {}

    def _generate_team_id(self, program_id: str, location_id: str) -> str:
        """Generate a unique team ID."""
        import hashlib
        key = f"team:{program_id}:{location_id}"
        hash_part = hashlib.md5(key.encode()).hexdigest()[:8]
        return f"team-{hash_part}"

    def _create_team_name(self, program_name: str, location_name: str) -> str:
        """Create a descriptive team name."""
        if location_name:
            return f"{program_name} - {location_name} Team"
        return f"{program_name} Team"

    def build_teams(
        self,
        contacts: List[Contact],
        task_orders: List[TaskOrder],
        programs: List[Program],
        locations: List[Location]
    ) -> List[Team]:
        """Build teams from contact clusters sharing same program + location."""
        logger.info("Building teams from contact clusters...")

        # Build lookups
        program_by_id = {p.id: p for p in programs}
        task_order_by_program = {to.program_id: to for to in task_orders}

        # Group contacts by (program_id)
        contact_clusters = defaultdict(list)
        for contact in contacts:
            if contact.matched_program_id:
                contact_clusters[contact.matched_program_id].append(contact)

        # Create teams for each cluster
        for program_id, cluster_contacts in contact_clusters.items():
            if len(cluster_contacts) >= 2:  # Need at least 2 contacts for a team
                program = program_by_id.get(program_id)
                if not program:
                    continue

                task_order = task_order_by_program.get(program_id)
                location_id = task_order.location_id if task_order else ""
                location_name = task_order.location_name if task_order else ""

                team_id = self._generate_team_id(program_id, location_id)

                if team_id not in self.teams:
                    team = Team(
                        id=team_id,
                        name=self._create_team_name(program.name, location_name),
                        task_order_id=task_order.id if task_order else "",
                        program_id=program_id,
                        location_id=location_id
                    )

                    # Sort contacts by tier to find team lead
                    sorted_contacts = sorted(cluster_contacts, key=lambda c: c.tier)
                    team.team_lead_id = sorted_contacts[0].id
                    team.member_ids = [c.id for c in cluster_contacts]
                    team.member_count = len(cluster_contacts)

                    self.teams[team_id] = team

                    # Update task order with team reference
                    if task_order and team_id not in task_order.team_ids:
                        task_order.team_ids.append(team_id)

        logger.info(f"Built {len(self.teams)} teams")
        return list(self.teams.values())


# =============================================================================
# CUSTOMER/AGENCY EXTRACTOR
# =============================================================================

class CustomerExtractor:
    """Extracts Customer/Agency entities from program data."""

    # Known customer/agency patterns
    KNOWN_CUSTOMERS = {
        'air force': {'name': 'U.S. Air Force', 'abbrev': 'USAF', 'mission': 'Air & Space Operations'},
        'usaf': {'name': 'U.S. Air Force', 'abbrev': 'USAF', 'mission': 'Air & Space Operations'},
        'army': {'name': 'U.S. Army', 'abbrev': 'USA', 'mission': 'Land Operations'},
        'navy': {'name': 'U.S. Navy', 'abbrev': 'USN', 'mission': 'Naval Operations'},
        'marine': {'name': 'U.S. Marine Corps', 'abbrev': 'USMC', 'mission': 'Expeditionary Operations'},
        'dod': {'name': 'Department of Defense', 'abbrev': 'DoD', 'mission': 'Defense'},
        'inscom': {'name': 'INSCOM', 'abbrev': 'INSCOM', 'mission': 'Army Intelligence'},
        'peo iews': {'name': 'PEO IEW&S', 'abbrev': 'PEO IEW&S', 'mission': 'Intelligence Systems'},
        'nasic': {'name': 'NASIC', 'abbrev': 'NASIC', 'mission': 'Air & Space Intelligence'},
        'dia': {'name': 'Defense Intelligence Agency', 'abbrev': 'DIA', 'mission': 'Defense Intelligence'},
        'nsa': {'name': 'National Security Agency', 'abbrev': 'NSA', 'mission': 'Signals Intelligence'},
        'nga': {'name': 'National Geospatial-Intelligence Agency', 'abbrev': 'NGA', 'mission': 'Geospatial Intel'},
        'nro': {'name': 'National Reconnaissance Office', 'abbrev': 'NRO', 'mission': 'Reconnaissance'},
        'dcgs': {'name': 'DCGS Program Office', 'abbrev': 'DCGS', 'mission': 'C4ISR'},
    }

    def __init__(self):
        self.customers: Dict[str, Customer] = {}

    def _generate_customer_id(self, key: str) -> str:
        """Generate a unique customer ID."""
        import hashlib
        hash_part = hashlib.md5(key.encode()).hexdigest()[:8]
        return f"cust-{hash_part}"

    def _detect_customer(self, text: str) -> Optional[Dict]:
        """Detect customer from text."""
        text_lower = text.lower()
        for keyword, customer_info in self.KNOWN_CUSTOMERS.items():
            if keyword in text_lower:
                return customer_info
        return None

    def extract_from_programs(self, programs: List[Program]) -> List[Customer]:
        """Extract customer entities from program data."""
        logger.info("Extracting customer/agency entities from programs...")

        for program in programs:
            # Try to detect customer from program name or mission area
            customer_info = None

            # Check program name
            if program.name:
                customer_info = self._detect_customer(program.name)

            # Check mission area
            if not customer_info and program.mission_area:
                customer_info = self._detect_customer(program.mission_area)

            # Check notes if available
            if not customer_info and program.notes:
                customer_info = self._detect_customer(program.notes)

            if customer_info:
                key = customer_info['abbrev'].lower()
                if key not in self.customers:
                    self.customers[key] = Customer(
                        id=self._generate_customer_id(key),
                        name=customer_info['name'],
                        abbreviation=customer_info['abbrev'],
                        mission_area=customer_info['mission']
                    )

                # Link program to customer
                customer = self.customers[key]
                if program.id not in customer.program_ids:
                    customer.program_ids.append(program.id)
                customer.program_count = len(customer.program_ids)

        logger.info(f"Extracted {len(self.customers)} customer/agency entities")
        return list(self.customers.values())


# =============================================================================
# RELATIONSHIP INFERENCE ENGINE
# =============================================================================

@dataclass
class Edge:
    """Represents a relationship edge between two nodes."""
    id: str
    source_id: str
    source_type: str
    target_id: str
    target_type: str
    relationship: str
    weight: float = 1.0
    metadata: Dict[str, Any] = field(default_factory=dict)


class RelationshipInferenceEngine:
    """Builds relationship edges between all entity types for the mind map."""

    def __init__(self):
        self.edges: List[Edge] = []
        self._edge_counter = 0

    def _generate_edge_id(self) -> str:
        """Generate a unique edge ID."""
        self._edge_counter += 1
        return f"edge-{self._edge_counter:05d}"

    def _add_edge(
        self,
        source_id: str,
        source_type: str,
        target_id: str,
        target_type: str,
        relationship: str,
        weight: float = 1.0,
        metadata: Dict[str, Any] = None
    ):
        """Add an edge to the graph."""
        edge = Edge(
            id=self._generate_edge_id(),
            source_id=source_id,
            source_type=source_type,
            target_id=target_id,
            target_type=target_type,
            relationship=relationship,
            weight=weight,
            metadata=metadata or {}
        )
        self.edges.append(edge)

    def infer_job_program_edges(self, jobs: List[Job]) -> None:
        """Create Job→Program edges."""
        for job in jobs:
            if job.matched_program_id:
                self._add_edge(
                    source_id=job.id,
                    source_type="JOB",
                    target_id=job.matched_program_id,
                    target_type="PROGRAM",
                    relationship="mapped_to",
                    weight=0.9
                )

    def infer_job_contact_edges(self, jobs: List[Job]) -> None:
        """Create Job→Contact (hiring_manager) edges."""
        for job in jobs:
            for i, contact_id in enumerate(job.matched_contacts):
                # First contact is likely hiring manager
                rel = "hiring_manager" if i == 0 else "team_contact"
                weight = 1.0 if i == 0 else 0.7
                self._add_edge(
                    source_id=job.id,
                    source_type="JOB",
                    target_id=contact_id,
                    target_type="CONTACT",
                    relationship=rel,
                    weight=weight
                )

    def infer_job_location_edges(
        self,
        jobs: List[Job],
        locations: List[Location]
    ) -> None:
        """Create Job→Location edges."""
        # Build location lookup
        location_lookup = {}
        for loc in locations:
            key = self._normalize_key(loc.name)
            location_lookup[key] = loc

        for job in jobs:
            if job.location:
                key = self._normalize_key(job.location)
                if key in location_lookup:
                    self._add_edge(
                        source_id=job.id,
                        source_type="JOB",
                        target_id=location_lookup[key].id,
                        target_type="LOCATION",
                        relationship="located_at",
                        weight=1.0
                    )

    def infer_contact_team_edges(
        self,
        contacts: List[Contact],
        teams: List[Team]
    ) -> None:
        """Create Contact→Team edges."""
        # Build contact->team mapping
        contact_to_team = {}
        for team in teams:
            for member_id in team.member_ids:
                contact_to_team[member_id] = team

        for contact in contacts:
            if contact.id in contact_to_team:
                team = contact_to_team[contact.id]
                rel = "leads" if team.team_lead_id == contact.id else "member_of"
                weight = 1.0 if team.team_lead_id == contact.id else 0.8
                self._add_edge(
                    source_id=contact.id,
                    source_type="CONTACT",
                    target_id=team.id,
                    target_type="TEAM",
                    relationship=rel,
                    weight=weight
                )

    def infer_contact_program_edges(self, contacts: List[Contact]) -> None:
        """Create Contact→Program edges."""
        for contact in contacts:
            if contact.matched_program_id:
                self._add_edge(
                    source_id=contact.id,
                    source_type="CONTACT",
                    target_id=contact.matched_program_id,
                    target_type="PROGRAM",
                    relationship="works_on",
                    weight=0.9
                )

    def infer_program_prime_edges(self, programs: List[Program]) -> None:
        """Create Program→Prime edges."""
        for program in programs:
            if program.prime_contractor:
                self._add_edge(
                    source_id=program.id,
                    source_type="PROGRAM",
                    target_id=program.prime_contractor,
                    target_type="PRIME",
                    relationship="run_by",
                    weight=1.0
                )

    def infer_program_location_edges(
        self,
        programs: List[Program],
        locations: List[Location]
    ) -> None:
        """Create Program→Location edges."""
        location_lookup = {}
        for loc in locations:
            key = self._normalize_key(loc.name)
            location_lookup[key] = loc

        for program in programs:
            if program.location:
                # Handle multiple locations
                loc_parts = [l.strip() for l in program.location.split(';')]
                for loc_str in loc_parts:
                    key = self._normalize_key(loc_str)
                    if key in location_lookup:
                        self._add_edge(
                            source_id=program.id,
                            source_type="PROGRAM",
                            target_id=location_lookup[key].id,
                            target_type="LOCATION",
                            relationship="operates_at",
                            weight=1.0
                        )

    def infer_program_customer_edges(
        self,
        programs: List[Program],
        customers: List[Customer]
    ) -> None:
        """Create Program→Customer edges."""
        # Build customer lookup by program
        program_to_customer = {}
        for customer in customers:
            for program_id in customer.program_ids:
                program_to_customer[program_id] = customer

        for program in programs:
            if program.id in program_to_customer:
                customer = program_to_customer[program.id]
                self._add_edge(
                    source_id=program.id,
                    source_type="PROGRAM",
                    target_id=customer.id,
                    target_type="CUSTOMER",
                    relationship="owned_by",
                    weight=1.0
                )

    def infer_task_order_edges(self, task_orders: List[TaskOrder]) -> None:
        """Create TaskOrder→Program, TaskOrder→Location edges."""
        for to in task_orders:
            # Task Order → Program
            if to.program_id:
                self._add_edge(
                    source_id=to.id,
                    source_type="TASK_ORDER",
                    target_id=to.program_id,
                    target_type="PROGRAM",
                    relationship="under",
                    weight=1.0
                )

            # Task Order → Location
            if to.location_id:
                self._add_edge(
                    source_id=to.id,
                    source_type="TASK_ORDER",
                    target_id=to.location_id,
                    target_type="LOCATION",
                    relationship="executes_at",
                    weight=1.0
                )

    def infer_team_task_order_edges(self, teams: List[Team]) -> None:
        """Create Team→TaskOrder edges."""
        for team in teams:
            if team.task_order_id:
                self._add_edge(
                    source_id=team.id,
                    source_type="TEAM",
                    target_id=team.task_order_id,
                    target_type="TASK_ORDER",
                    relationship="part_of",
                    weight=1.0
                )

    def infer_location_aggregation_edges(self, locations: List[Location]) -> None:
        """Create Location aggregation edges (programs, contacts, jobs at location)."""
        for location in locations:
            # Location → Programs
            for program_id in location.programs_at_location:
                self._add_edge(
                    source_id=location.id,
                    source_type="LOCATION",
                    target_id=program_id,
                    target_type="PROGRAM",
                    relationship="hosts",
                    weight=0.8
                )

            # Location → Contacts
            for contact_id in location.contacts_at_location:
                self._add_edge(
                    source_id=location.id,
                    source_type="LOCATION",
                    target_id=contact_id,
                    target_type="CONTACT",
                    relationship="has_contact",
                    weight=0.7
                )

            # Location → Jobs
            for job_id in location.jobs_at_location:
                self._add_edge(
                    source_id=location.id,
                    source_type="LOCATION",
                    target_id=job_id,
                    target_type="JOB",
                    relationship="has_job",
                    weight=0.7
                )

    def build_all_relationships(
        self,
        jobs: List[Job],
        programs: List[Program],
        contacts: List[Contact],
        locations: List[Location],
        task_orders: List[TaskOrder],
        teams: List[Team],
        customers: List[Customer]
    ) -> List[Edge]:
        """Build all relationship edges."""
        logger.info("Building relationship edges...")

        # Job relationships
        self.infer_job_program_edges(jobs)
        self.infer_job_contact_edges(jobs)
        self.infer_job_location_edges(jobs, locations)

        # Contact relationships
        self.infer_contact_team_edges(contacts, teams)
        self.infer_contact_program_edges(contacts)

        # Program relationships
        self.infer_program_prime_edges(programs)
        self.infer_program_location_edges(programs, locations)
        self.infer_program_customer_edges(programs, customers)

        # Task Order relationships
        self.infer_task_order_edges(task_orders)

        # Team relationships
        self.infer_team_task_order_edges(teams)

        # Location aggregations
        self.infer_location_aggregation_edges(locations)

        logger.info(f"Built {len(self.edges)} relationship edges")
        return self.edges

    def _normalize_key(self, text: str) -> str:
        """Normalize text for lookup keys."""
        if not text:
            return ""
        return re.sub(r'[^a-z0-9\s]', '', text.lower()).strip()


# =============================================================================
# BD SCORE CALCULATOR
# =============================================================================

class BDScoreCalculator:
    """Calculates BD priority scores for jobs, programs, and contacts."""

    def __init__(self, config: CorrelationConfig = None):
        self.config = config or CorrelationConfig()

    def _parse_contract_value(self, value_str: str) -> float:
        """Parse contract value string to number (in millions)."""
        if not value_str:
            return 0.0

        # Remove currency symbols and spaces
        cleaned = re.sub(r'[$,\s]', '', value_str.upper())

        # Handle millions/billions
        multiplier = 1.0
        if 'B' in cleaned:
            multiplier = 1000.0
            cleaned = cleaned.replace('B', '')
        elif 'M' in cleaned:
            multiplier = 1.0
            cleaned = cleaned.replace('M', '')
        elif 'K' in cleaned:
            multiplier = 0.001
            cleaned = cleaned.replace('K', '')

        try:
            return float(cleaned) * multiplier
        except ValueError:
            return 0.0

    def calculate_program_score(self, program: Program) -> float:
        """Calculate BD priority score for a program."""
        score = 0.0
        weights = self.config.score_weights

        # Job count score (0-100)
        job_score = min(program.job_count * 5, 100)  # 20 jobs = 100
        score += job_score * weights['job_count']

        # Contact quality score (0-100)
        contact_score = min(program.contact_count * 3, 100)  # ~33 contacts = 100
        score += contact_score * weights['contact_quality']

        # Contract value score (0-100)
        value_millions = self._parse_contract_value(program.contract_value)
        value_score = min(value_millions / 5, 100)  # $500M = 100
        score += value_score * weights['contract_value']

        # Hiring velocity score (0-100)
        velocity_scores = {
            'High': 100,
            'Medium': 60,
            'Low': 30,
            '': 0
        }
        velocity_score = velocity_scores.get(program.hiring_velocity, 0)
        score += velocity_score * weights['recency']

        return min(score, 100)

    def calculate_contact_score(self, contact: Contact) -> float:
        """Calculate BD priority score for a contact."""
        score = 0.0

        # Tier score (inverted - lower tier = higher score)
        tier_scores = {
            1: 100,  # Executive
            2: 90,   # Senior Management
            3: 75,   # Program Manager
            4: 60,   # Technical Lead
            5: 40,   # Team Member
            6: 20    # General Contact
        }
        score += tier_scores.get(contact.tier, 20) * 0.4

        # Relationship status score
        status_scores = {
            'Active': 100,
            'Warm': 80,
            'Cold': 40,
            'New': 60,
            '': 30
        }
        score += status_scores.get(contact.relationship_status, 30) * 0.3

        # Recency score (based on last contact)
        if contact.last_contact_date:
            try:
                last_date = datetime.fromisoformat(contact.last_contact_date.replace('Z', '+00:00'))
                days_since = (datetime.now(last_date.tzinfo) - last_date).days
                if days_since <= 7:
                    recency_score = 100
                elif days_since <= 30:
                    recency_score = 80
                elif days_since <= 90:
                    recency_score = 50
                else:
                    recency_score = 20
                score += recency_score * 0.2
            except (ValueError, TypeError):
                score += 30 * 0.2
        else:
            score += 30 * 0.2

        # Has matched jobs score
        job_score = min(len(contact.matched_jobs) * 20, 100)
        score += job_score * 0.1

        return min(score, 100)

    def calculate_job_score(self, job: Job) -> float:
        """Calculate BD priority score for a job."""
        score = 0.0

        # Has program match
        if job.matched_program_id:
            score += 30

        # Has contacts
        score += min(len(job.matched_contacts) * 10, 30)

        # Clearance level
        clearance_scores = {
            'TS/SCI': 100,
            'TS/SCI w/ Poly': 100,
            'Top Secret': 80,
            'TS': 80,
            'Secret': 50,
            'Public Trust': 30,
            '': 10
        }
        score += clearance_scores.get(job.clearance, 10) * 0.2

        # Has BD Priority already set
        # Handle bd_priority which can be a number (from formula) or string
        bd_priority_str = str(job.bd_priority) if job.bd_priority else ''

        # If it's a numeric score, use it directly
        if isinstance(job.bd_priority, (int, float)) and job.bd_priority > 0:
            score += min(job.bd_priority, 100) * 0.2
        else:
            # Extract priority level from emoji string
            priority_scores = {
                'Critical': 100,
                'High': 80,
                'Medium': 50,
                'Low': 20,
            }
            for key in priority_scores:
                if key.lower() in bd_priority_str.lower():
                    score += priority_scores[key] * 0.2
                    break
            else:
                score += 40 * 0.2  # Default score

        return min(score, 100)

    def get_priority_label(self, score: float) -> str:
        """Get priority label from score."""
        thresholds = self.config.priority_thresholds

        if score >= thresholds['critical']:
            return "Critical"
        elif score >= thresholds['high']:
            return "High"
        elif score >= thresholds['medium']:
            return "Medium"
        else:
            return "Low"


# =============================================================================
# EXPORT GENERATOR
# =============================================================================

class ExportGenerator:
    """Generates JSON exports for the BD Dashboard."""

    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or os.path.join(
            os.path.dirname(__file__), '..', '..', 'outputs', 'bd_dashboard'
        )
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

    def _serialize_dataclass(self, obj: Any) -> Dict:
        """Convert dataclass to dict, handling nested objects."""
        if hasattr(obj, '__dataclass_fields__'):
            return asdict(obj)
        return obj

    def export_jobs(self, jobs: List[Job], filename: str = "jobs_enriched.json"):
        """Export enriched jobs data."""
        output_path = os.path.join(self.output_dir, filename)

        data = {
            "generated_at": datetime.now().isoformat(),
            "total_count": len(jobs),
            "jobs": [self._serialize_dataclass(j) for j in jobs]
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(jobs)} jobs to {output_path}")
        return output_path

    def export_programs(self, programs: List[Program], filename: str = "programs_enriched.json"):
        """Export enriched programs data."""
        output_path = os.path.join(self.output_dir, filename)

        data = {
            "generated_at": datetime.now().isoformat(),
            "total_count": len(programs),
            "programs": [self._serialize_dataclass(p) for p in programs]
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(programs)} programs to {output_path}")
        return output_path

    def export_contacts(self, contacts: List[Contact], filename: str = "contacts_classified.json"):
        """Export classified contacts data."""
        output_path = os.path.join(self.output_dir, filename)

        # Group by tier for dashboard
        by_tier = defaultdict(list)
        for contact in contacts:
            by_tier[contact.tier].append(self._serialize_dataclass(contact))

        data = {
            "generated_at": datetime.now().isoformat(),
            "total_count": len(contacts),
            "by_tier": dict(by_tier),
            "contacts": [self._serialize_dataclass(c) for c in contacts]
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(contacts)} contacts to {output_path}")
        return output_path

    def export_contractors(self, contractors: List[Contractor], filename: str = "contractors_enriched.json"):
        """Export enriched contractors data."""
        output_path = os.path.join(self.output_dir, filename)

        data = {
            "generated_at": datetime.now().isoformat(),
            "total_count": len(contractors),
            "contractors": [self._serialize_dataclass(c) for c in contractors]
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(contractors)} contractors to {output_path}")
        return output_path

    def export_correlation_summary(
        self,
        jobs: List[Job],
        programs: List[Program],
        contacts: List[Contact],
        contractors: List[Contractor],
        filename: str = "correlation_summary.json"
    ):
        """Export summary of all correlations."""
        output_path = os.path.join(self.output_dir, filename)

        # Calculate statistics
        jobs_with_programs = sum(1 for j in jobs if j.matched_program_id)
        jobs_with_contacts = sum(1 for j in jobs if j.matched_contacts)
        contacts_with_programs = sum(1 for c in contacts if c.matched_program_id)
        contacts_with_jobs = sum(1 for c in contacts if c.matched_jobs)

        # Top programs by job count
        top_programs = sorted(programs, key=lambda p: p.job_count, reverse=True)[:10]

        # Priority distribution - handle numeric or string bd_priority
        priority_dist = defaultdict(int)
        for job in jobs:
            # Use bd_score for classification if bd_priority is numeric
            if isinstance(job.bd_priority, (int, float)):
                score = job.bd_priority
                if score >= 80:
                    priority_dist['critical'] += 1
                elif score >= 60:
                    priority_dist['high'] += 1
                elif score >= 40:
                    priority_dist['medium'] += 1
                else:
                    priority_dist['low'] += 1
            else:
                bd_str = str(job.bd_priority) if job.bd_priority else ''
                if 'Critical' in bd_str:
                    priority_dist['critical'] += 1
                elif 'High' in bd_str:
                    priority_dist['high'] += 1
                elif 'Medium' in bd_str:
                    priority_dist['medium'] += 1
                else:
                    priority_dist['low'] += 1

        data = {
            "generated_at": datetime.now().isoformat(),
            "statistics": {
                "total_jobs": len(jobs),
                "total_programs": len(programs),
                "total_contacts": len(contacts),
                "total_contractors": len(contractors),
                "jobs_matched_to_programs": jobs_with_programs,
                "jobs_matched_to_contacts": jobs_with_contacts,
                "contacts_matched_to_programs": contacts_with_programs,
                "contacts_with_relevant_jobs": contacts_with_jobs,
                "match_rates": {
                    "jobs_to_programs": round(jobs_with_programs / len(jobs) * 100, 1) if jobs else 0,
                    "jobs_to_contacts": round(jobs_with_contacts / len(jobs) * 100, 1) if jobs else 0,
                    "contacts_to_programs": round(contacts_with_programs / len(contacts) * 100, 1) if contacts else 0
                }
            },
            "priority_distribution": dict(priority_dist),
            "top_programs_by_jobs": [
                {"name": p.name, "job_count": p.job_count, "contact_count": p.contact_count}
                for p in top_programs
            ],
            "contacts_by_tier": {
                tier: sum(1 for c in contacts if c.tier == tier)
                for tier in range(1, 7)
            }
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported correlation summary to {output_path}")
        return output_path


# =============================================================================
# MIND MAP EXPORTER
# =============================================================================

class MindMapExporter:
    """Exports entity nodes and relationship edges for the mind map visualization."""

    # Node type icons for display
    NODE_ICONS = {
        "JOB": "target",
        "PROGRAM": "file-text",
        "PRIME": "building",
        "CONTACT": "user",
        "LOCATION": "map-pin",
        "TASK_ORDER": "package",
        "TEAM": "users",
        "CUSTOMER": "landmark",
    }

    # Node colors by type
    NODE_COLORS = {
        "JOB": "#e53e3e",
        "PROGRAM": "#3182ce",
        "PRIME": "#38a169",
        "CONTACT": "#d53f8c",
        "LOCATION": "#805ad5",
        "TASK_ORDER": "#dd6b20",
        "TEAM": "#d69e2e",
        "CUSTOMER": "#319795",
    }

    def __init__(self, output_dir: str = None):
        self.output_dir = output_dir or os.path.join(
            os.path.dirname(__file__), '..', '..', 'outputs', 'bd_dashboard'
        )
        Path(self.output_dir).mkdir(parents=True, exist_ok=True)

    def _serialize_dataclass(self, obj: Any) -> Dict:
        """Convert dataclass to dict."""
        if hasattr(obj, '__dataclass_fields__'):
            return asdict(obj)
        return obj

    def _create_node(
        self,
        entity: Any,
        node_type: str,
        label_field: str = "name",
        subtitle_field: str = None
    ) -> Dict:
        """Create a standardized node from an entity."""
        data = self._serialize_dataclass(entity)

        # Get label
        label = data.get(label_field, data.get("title", data.get("id", "Unknown")))
        if isinstance(label, str) and len(label) > 50:
            label = label[:47] + "..."

        # Get subtitle
        subtitle = ""
        if subtitle_field and subtitle_field in data:
            subtitle = str(data[subtitle_field])

        return {
            "id": data.get("id", ""),
            "type": node_type,
            "label": label,
            "subtitle": subtitle,
            "icon": self.NODE_ICONS.get(node_type, "circle"),
            "color": self.NODE_COLORS.get(node_type, "#718096"),
            "data": data
        }

    def export_nodes(
        self,
        jobs: List[Job],
        programs: List[Program],
        contacts: List[Contact],
        locations: List[Location],
        task_orders: List[TaskOrder],
        teams: List[Team],
        customers: List[Customer],
        contractors: List[Contractor] = None,
        filename: str = "mindmap_nodes.json"
    ) -> str:
        """Export all entity nodes to JSON."""
        output_path = os.path.join(self.output_dir, filename)

        nodes = []

        # Jobs
        for job in jobs:
            node = self._create_node(job, "JOB", "title", "company")
            # Add BD priority color override
            if job.bd_score >= 80:
                node["priority_color"] = "#e53e3e"  # Critical - red
            elif job.bd_score >= 60:
                node["priority_color"] = "#dd6b20"  # High - orange
            elif job.bd_score >= 40:
                node["priority_color"] = "#d69e2e"  # Medium - yellow
            else:
                node["priority_color"] = "#718096"  # Low - gray
            nodes.append(node)

        # Programs
        for program in programs:
            node = self._create_node(program, "PROGRAM", "name", "prime_contractor")
            node["data"]["active_job_count"] = program.job_count
            node["data"]["contact_count"] = program.contact_count
            nodes.append(node)

        # Contacts
        for contact in contacts:
            node = self._create_node(contact, "CONTACT", "name", "title")
            # Add tier indicator
            node["tier"] = contact.tier
            nodes.append(node)

        # Locations
        for location in locations:
            node = self._create_node(location, "LOCATION", "name", "location_hub")
            node["data"]["job_count"] = location.job_count
            node["data"]["contact_count"] = location.contact_count
            node["data"]["program_count"] = location.program_count
            nodes.append(node)

        # Task Orders
        for task_order in task_orders:
            node = self._create_node(task_order, "TASK_ORDER", "name", "program_name")
            nodes.append(node)

        # Teams
        for team in teams:
            node = self._create_node(team, "TEAM", "name")
            node["data"]["member_count"] = team.member_count
            nodes.append(node)

        # Customers
        for customer in customers:
            node = self._create_node(customer, "CUSTOMER", "name", "mission_area")
            nodes.append(node)

        # Primes (extracted from programs)
        primes_seen = set()
        for program in programs:
            if program.prime_contractor and program.prime_contractor not in primes_seen:
                prime_node = {
                    "id": program.prime_contractor,
                    "type": "PRIME",
                    "label": program.prime_contractor,
                    "subtitle": "",
                    "icon": self.NODE_ICONS.get("PRIME", "building"),
                    "color": self.NODE_COLORS.get("PRIME", "#38a169"),
                    "data": {
                        "id": program.prime_contractor,
                        "name": program.prime_contractor
                    }
                }
                nodes.append(prime_node)
                primes_seen.add(program.prime_contractor)

        # Summary by type
        node_counts = defaultdict(int)
        for node in nodes:
            node_counts[node["type"]] += 1

        data = {
            "generated_at": datetime.now().isoformat(),
            "total_count": len(nodes),
            "counts_by_type": dict(node_counts),
            "nodes": nodes
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(nodes)} mind map nodes to {output_path}")
        return output_path

    def export_edges(
        self,
        edges: List[Edge],
        filename: str = "mindmap_edges.json"
    ) -> str:
        """Export all relationship edges to JSON."""
        output_path = os.path.join(self.output_dir, filename)

        # Convert edges to serializable format
        edge_list = []
        for edge in edges:
            edge_data = self._serialize_dataclass(edge)
            edge_list.append(edge_data)

        # Count edges by relationship type
        edge_counts = defaultdict(int)
        for edge in edges:
            edge_counts[edge.relationship] += 1

        # Count edges by source/target type
        type_pairs = defaultdict(int)
        for edge in edges:
            pair_key = f"{edge.source_type}->{edge.target_type}"
            type_pairs[pair_key] += 1

        data = {
            "generated_at": datetime.now().isoformat(),
            "total_count": len(edges),
            "counts_by_relationship": dict(edge_counts),
            "counts_by_type_pair": dict(type_pairs),
            "edges": edge_list
        }

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        logger.info(f"Exported {len(edges)} mind map edges to {output_path}")
        return output_path


# =============================================================================
# MAIN ORCHESTRATION
# =============================================================================

def run_full_correlation(output_dir: str = None) -> Dict[str, str]:
    """
    Run the full data correlation pipeline.

    Returns:
        Dict mapping export names to file paths
    """
    logger.info("=" * 60)
    logger.info("BD Data Correlation Engine - Starting Full Run")
    logger.info("=" * 60)

    # Initialize components
    loader = NotionDataLoader()
    correlator = DataCorrelator()
    scorer = BDScoreCalculator()
    exporter = ExportGenerator(output_dir)
    mindmap_exporter = MindMapExporter(output_dir)

    # Entity extractors
    location_extractor = LocationExtractor()
    task_order_inferencer = TaskOrderInferencer()
    team_builder = TeamBuilder()
    customer_extractor = CustomerExtractor()
    relationship_engine = RelationshipInferenceEngine()

    # Load all data
    logger.info("\n[PHASE 1] Loading data from Notion...")
    jobs = loader.load_jobs()
    programs = loader.load_programs()
    contacts = loader.load_contacts()
    contractors = loader.load_contractors()

    # Run correlations
    logger.info("\n[PHASE 2] Running correlations...")
    jobs, programs = correlator.correlate_jobs_to_programs(jobs, programs)
    contacts, programs = correlator.correlate_contacts_to_programs(contacts, programs)
    jobs, contacts = correlator.correlate_jobs_to_contacts(jobs, contacts)
    contractors = correlator.correlate_contractors_to_jobs(contractors, jobs)

    # Calculate scores
    logger.info("\n[PHASE 3] Calculating BD scores...")
    for job in jobs:
        job.bd_score = scorer.calculate_job_score(job)

    for contact in contacts:
        # Store calculated score (could be used to update Notion)
        contact.bd_priority = scorer.get_priority_label(scorer.calculate_contact_score(contact))

    # Extract new entity types
    logger.info("\n[PHASE 4] Extracting entity types for mind map...")

    # Extract locations from all sources
    location_extractor.extract_from_jobs(jobs)
    location_extractor.extract_from_programs(programs)
    location_extractor.link_contacts_to_locations(contacts, programs)
    locations = location_extractor.get_all_locations()
    logger.info(f"Extracted {len(locations)} unique locations")

    # Extract customer/agency entities
    customers = customer_extractor.extract_from_programs(programs)
    logger.info(f"Extracted {len(customers)} customer/agency entities")

    # Infer task orders from program/location clusters
    task_orders = task_order_inferencer.infer_task_orders(programs, locations, jobs, contacts)
    logger.info(f"Inferred {len(task_orders)} task orders")

    # Build teams from contact clusters
    teams = team_builder.build_teams(contacts, task_orders, programs, locations)
    logger.info(f"Built {len(teams)} teams")

    # Build relationship edges
    logger.info("\n[PHASE 5] Building relationship graph...")
    edges = relationship_engine.build_all_relationships(
        jobs=jobs,
        programs=programs,
        contacts=contacts,
        locations=locations,
        task_orders=task_orders,
        teams=teams,
        customers=customers
    )
    logger.info(f"Built {len(edges)} relationship edges")

    # Generate exports
    logger.info("\n[PHASE 6] Generating exports...")
    exports = {}
    exports['jobs'] = exporter.export_jobs(jobs)
    exports['programs'] = exporter.export_programs(programs)
    exports['contacts'] = exporter.export_contacts(contacts)
    exports['contractors'] = exporter.export_contractors(contractors)
    exports['summary'] = exporter.export_correlation_summary(jobs, programs, contacts, contractors)

    # Export mind map data
    logger.info("\n[PHASE 7] Exporting mind map data...")
    exports['mindmap_nodes'] = mindmap_exporter.export_nodes(
        jobs=jobs,
        programs=programs,
        contacts=contacts,
        locations=locations,
        task_orders=task_orders,
        teams=teams,
        customers=customers,
        contractors=contractors
    )
    exports['mindmap_edges'] = mindmap_exporter.export_edges(edges)

    logger.info("\n" + "=" * 60)
    logger.info("Correlation Complete!")
    logger.info("=" * 60)

    # Print summary stats
    logger.info("\nMind Map Summary:")
    logger.info(f"  - Jobs: {len(jobs)}")
    logger.info(f"  - Programs: {len(programs)}")
    logger.info(f"  - Contacts: {len(contacts)}")
    logger.info(f"  - Locations: {len(locations)}")
    logger.info(f"  - Task Orders: {len(task_orders)}")
    logger.info(f"  - Teams: {len(teams)}")
    logger.info(f"  - Customers: {len(customers)}")
    logger.info(f"  - Relationship Edges: {len(edges)}")

    return exports


# =============================================================================
# CLI INTERFACE
# =============================================================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='BD Data Correlation Engine')
    parser.add_argument('--run-all', action='store_true', help='Run full correlation pipeline')
    parser.add_argument('--export-jobs', action='store_true', help='Export jobs only')
    parser.add_argument('--export-contacts', action='store_true', help='Export contacts only')
    parser.add_argument('--export-programs', action='store_true', help='Export programs only')
    parser.add_argument('--export-mindmap', action='store_true', help='Export mind map nodes and edges')
    parser.add_argument('--output-dir', type=str, help='Output directory for exports')
    parser.add_argument('--test', action='store_true', help='Test Notion connection')

    args = parser.parse_args()

    if args.test:
        logger.info("Testing Notion connection...")
        try:
            loader = NotionDataLoader()
            jobs = loader.load_jobs()
            logger.info(f"[OK] Connection successful! Loaded {len(jobs)} jobs.")
        except Exception as e:
            logger.error(f"[FAIL] Connection failed: {e}")
        return

    if args.run_all:
        exports = run_full_correlation(args.output_dir)
        print("\nExports generated:")
        for name, path in exports.items():
            print(f"  - {name}: {path}")
        return

    # Individual exports
    loader = NotionDataLoader()
    exporter = ExportGenerator(args.output_dir)

    if args.export_jobs:
        jobs = loader.load_jobs()
        path = exporter.export_jobs(jobs)
        print(f"Exported to: {path}")

    if args.export_contacts:
        contacts = loader.load_contacts()
        path = exporter.export_contacts(contacts)
        print(f"Exported to: {path}")

    if args.export_programs:
        programs = loader.load_programs()
        path = exporter.export_programs(programs)
        print(f"Exported to: {path}")

    if args.export_mindmap:
        # Run full correlation to get all entities
        logger.info("Running correlation to generate mind map data...")
        exports = run_full_correlation(args.output_dir)
        print("\nMind map files generated:")
        print(f"  - mindmap_nodes: {exports.get('mindmap_nodes')}")
        print(f"  - mindmap_edges: {exports.get('mindmap_edges')}")

    if not any([args.run_all, args.export_jobs, args.export_contacts, args.export_programs, args.export_mindmap, args.test]):
        parser.print_help()


if __name__ == '__main__':
    main()
