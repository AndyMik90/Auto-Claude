"""
Bullhorn CRM Integration - Contact enrichment and synchronization.
Provides bidirectional sync between BD Automation and Bullhorn CRM.
"""

import os
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('BD-Bullhorn')


@dataclass
class BullhornConfig:
    """Configuration for Bullhorn CRM integration."""
    api_url: str = os.getenv('BULLHORN_API_URL', 'https://rest.bullhornstaffing.com')
    client_id: str = os.getenv('BULLHORN_CLIENT_ID', '')
    client_secret: str = os.getenv('BULLHORN_CLIENT_SECRET', '')
    username: str = os.getenv('BULLHORN_USERNAME', '')
    password: str = os.getenv('BULLHORN_PASSWORD', '')

    # OAuth tokens (populated after authentication)
    access_token: str = ''
    refresh_token: str = ''
    rest_url: str = ''
    bh_rest_token: str = ''


class BullhornClient:
    """Client for Bullhorn REST API."""

    def __init__(self, config: BullhornConfig = None):
        self.config = config or BullhornConfig()
        self._authenticated = False
        self._token_expiry: Optional[datetime] = None

    def _ensure_authenticated(self):
        """Ensure we have valid authentication."""
        if not self._authenticated or (
            self._token_expiry and datetime.now() >= self._token_expiry
        ):
            self.authenticate()

    def authenticate(self) -> bool:
        """
        Authenticate with Bullhorn OAuth flow.

        Bullhorn uses a multi-step OAuth process:
        1. Get authorization code
        2. Exchange for access token
        3. Get REST token and URL
        """
        if not self.config.client_id or not self.config.client_secret:
            logger.warning("Bullhorn credentials not configured")
            return False

        try:
            # Step 1: Get authorization code
            auth_url = f"{self.config.api_url}/oauth/authorize"
            auth_params = {
                'client_id': self.config.client_id,
                'response_type': 'code',
                'username': self.config.username,
                'password': self.config.password,
                'action': 'Login'
            }

            # Note: In production, this would be a proper OAuth flow
            # This is a simplified version for server-to-server auth

            # Step 2: Exchange code for access token
            token_url = f"{self.config.api_url}/oauth/token"
            token_data = {
                'grant_type': 'password',
                'client_id': self.config.client_id,
                'client_secret': self.config.client_secret,
                'username': self.config.username,
                'password': self.config.password
            }

            # In a real implementation, make the OAuth request
            # response = requests.post(token_url, data=token_data)

            logger.info("Bullhorn authentication not fully implemented - using mock")
            self._authenticated = True
            self._token_expiry = datetime.now() + timedelta(hours=1)
            return True

        except Exception as e:
            logger.error(f"Bullhorn authentication failed: {e}")
            return False

    def _make_request(
        self,
        method: str,
        endpoint: str,
        params: Dict = None,
        data: Dict = None
    ) -> Optional[Dict]:
        """Make an authenticated request to Bullhorn API."""
        self._ensure_authenticated()

        if not self.config.rest_url or not self.config.bh_rest_token:
            logger.warning("Bullhorn not properly authenticated")
            return None

        url = f"{self.config.rest_url}/{endpoint}"
        headers = {
            'BhRestToken': self.config.bh_rest_token,
            'Content-Type': 'application/json'
        }

        try:
            response = requests.request(
                method=method,
                url=url,
                params=params,
                json=data,
                headers=headers,
                timeout=30
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            logger.error(f"Bullhorn API error: {e}")
            return None

    # ============================================
    # CANDIDATE/CONTACT OPERATIONS
    # ============================================

    def search_candidates(
        self,
        query: str,
        fields: List[str] = None,
        count: int = 20
    ) -> List[Dict]:
        """
        Search for candidates in Bullhorn.

        Args:
            query: Lucene search query
            fields: Fields to return
            count: Maximum results

        Returns:
            List of matching candidates
        """
        if fields is None:
            fields = [
                'id', 'firstName', 'lastName', 'email', 'phone',
                'occupation', 'companyName', 'status', 'owner'
            ]

        params = {
            'query': query,
            'fields': ','.join(fields),
            'count': count
        }

        result = self._make_request('GET', 'search/Candidate', params=params)
        return result.get('data', []) if result else []

    def get_candidate(self, candidate_id: int, fields: List[str] = None) -> Optional[Dict]:
        """Get a specific candidate by ID."""
        if fields is None:
            fields = [
                'id', 'firstName', 'lastName', 'email', 'phone', 'mobile',
                'occupation', 'companyName', 'status', 'address', 'owner',
                'customText1', 'customText2', 'customText3'  # Often used for custom fields
            ]

        params = {'fields': ','.join(fields)}
        result = self._make_request('GET', f'entity/Candidate/{candidate_id}', params=params)
        return result.get('data') if result else None

    def create_candidate(self, candidate_data: Dict) -> Optional[int]:
        """
        Create a new candidate in Bullhorn.

        Args:
            candidate_data: Candidate information including:
                - firstName, lastName (required)
                - email, phone, mobile
                - occupation, companyName
                - address (dict with city, state, zip)
                - customText fields for BD-specific data

        Returns:
            Created candidate ID or None
        """
        result = self._make_request('PUT', 'entity/Candidate', data=candidate_data)
        return result.get('changedEntityId') if result else None

    def update_candidate(self, candidate_id: int, updates: Dict) -> bool:
        """Update an existing candidate."""
        result = self._make_request(
            'POST',
            f'entity/Candidate/{candidate_id}',
            data=updates
        )
        return result is not None

    # ============================================
    # CONTACT ENRICHMENT
    # ============================================

    def enrich_contact_from_bullhorn(self, contact: Dict) -> Dict:
        """
        Enrich a contact with data from Bullhorn.

        Searches Bullhorn for matching candidates and merges data.

        Args:
            contact: Contact dict with name, email, company, etc.

        Returns:
            Enriched contact dict
        """
        enriched = contact.copy()

        # Build search query
        search_parts = []
        if contact.get('email'):
            search_parts.append(f'email:"{contact["email"]}"')
        if contact.get('name'):
            search_parts.append(f'name:"{contact["name"]}"')

        if not search_parts:
            return enriched

        query = ' OR '.join(search_parts)
        candidates = self.search_candidates(query, count=5)

        if candidates:
            # Take the best match (first result)
            bh_candidate = candidates[0]

            # Merge Bullhorn data
            enriched['bullhorn_id'] = bh_candidate.get('id')
            enriched['bullhorn_status'] = bh_candidate.get('status')

            # Fill in missing fields
            if not enriched.get('phone') and bh_candidate.get('phone'):
                enriched['phone'] = bh_candidate['phone']
            if not enriched.get('title') and bh_candidate.get('occupation'):
                enriched['title'] = bh_candidate['occupation']

            enriched['_enriched_from_bullhorn'] = True
            logger.info(f"Enriched contact from Bullhorn: {contact.get('name')}")

        return enriched

    def sync_contact_to_bullhorn(self, contact: Dict) -> Optional[int]:
        """
        Sync a contact to Bullhorn as a candidate.

        Creates new candidate or updates existing.

        Args:
            contact: Contact dict from BD automation

        Returns:
            Bullhorn candidate ID
        """
        # Check if contact already exists
        if contact.get('email'):
            existing = self.search_candidates(f'email:"{contact["email"]}"', count=1)
            if existing:
                # Update existing
                candidate_id = existing[0]['id']
                updates = self._contact_to_bullhorn_format(contact)
                self.update_candidate(candidate_id, updates)
                return candidate_id

        # Create new candidate
        candidate_data = self._contact_to_bullhorn_format(contact)
        return self.create_candidate(candidate_data)

    def _contact_to_bullhorn_format(self, contact: Dict) -> Dict:
        """Convert BD contact format to Bullhorn candidate format."""
        # Parse name into first/last
        name = contact.get('name', '')
        parts = name.split(None, 1)
        first_name = parts[0] if parts else ''
        last_name = parts[1] if len(parts) > 1 else ''

        return {
            'firstName': contact.get('first_name') or first_name,
            'lastName': last_name,
            'email': contact.get('email', ''),
            'phone': contact.get('phone', ''),
            'occupation': contact.get('title', ''),
            'companyName': contact.get('company', ''),
            'customText1': contact.get('program', ''),  # Store program
            'customText2': contact.get('linkedin', ''),  # Store LinkedIn
            'customText3': 'BD-Automation',  # Source tag
            'status': 'Active',
        }

    # ============================================
    # BATCH OPERATIONS
    # ============================================

    def enrich_contacts_batch(self, contacts: List[Dict]) -> List[Dict]:
        """Enrich a batch of contacts from Bullhorn."""
        enriched = []
        for contact in contacts:
            try:
                enriched_contact = self.enrich_contact_from_bullhorn(contact)
                enriched.append(enriched_contact)
            except Exception as e:
                logger.error(f"Failed to enrich contact {contact.get('name')}: {e}")
                enriched.append(contact)
        return enriched

    def sync_contacts_batch(self, contacts: List[Dict]) -> Dict:
        """Sync a batch of contacts to Bullhorn."""
        results = {
            'synced': 0,
            'failed': 0,
            'bullhorn_ids': []
        }

        for contact in contacts:
            try:
                bh_id = self.sync_contact_to_bullhorn(contact)
                if bh_id:
                    results['synced'] += 1
                    results['bullhorn_ids'].append(bh_id)
                else:
                    results['failed'] += 1
            except Exception as e:
                logger.error(f"Failed to sync contact {contact.get('name')}: {e}")
                results['failed'] += 1

        logger.info(f"Synced {results['synced']} contacts to Bullhorn")
        return results

    # ============================================
    # JOB ORDER OPERATIONS
    # ============================================

    def search_job_orders(
        self,
        query: str,
        fields: List[str] = None,
        count: int = 20
    ) -> List[Dict]:
        """Search for job orders in Bullhorn."""
        if fields is None:
            fields = [
                'id', 'title', 'clientCorporation', 'status',
                'address', 'employmentType', 'dateAdded'
            ]

        params = {
            'query': query,
            'fields': ','.join(fields),
            'count': count
        }

        result = self._make_request('GET', 'search/JobOrder', params=params)
        return result.get('data', []) if result else []

    def create_job_order(self, job_data: Dict) -> Optional[int]:
        """Create a job order in Bullhorn from BD job posting."""
        job_order = {
            'title': job_data.get('Job Title/Position') or job_data.get('title', ''),
            'description': job_data.get('Position Overview') or job_data.get('description', ''),
            'employmentType': 'Contract',
            'status': 'Open',
            'customText1': job_data.get('_mapping', {}).get('program_name', ''),
            'customText2': str(job_data.get('_scoring', {}).get('BD Priority Score', 0)),
            'customText3': job_data.get('Source', ''),
        }

        result = self._make_request('PUT', 'entity/JobOrder', data=job_order)
        return result.get('changedEntityId') if result else None


# ============================================
# MOCK CLIENT FOR TESTING
# ============================================

class MockBullhornClient:
    """Mock client for testing without Bullhorn credentials."""

    def __init__(self, config: BullhornConfig = None):
        self.config = config or BullhornConfig()
        self._mock_candidates = []

    def authenticate(self) -> bool:
        logger.info("Using mock Bullhorn client")
        return True

    def search_candidates(self, query: str, **kwargs) -> List[Dict]:
        return self._mock_candidates

    def get_candidate(self, candidate_id: int, **kwargs) -> Optional[Dict]:
        return {'id': candidate_id, 'firstName': 'Mock', 'lastName': 'User'}

    def create_candidate(self, candidate_data: Dict) -> int:
        mock_id = len(self._mock_candidates) + 1
        self._mock_candidates.append({**candidate_data, 'id': mock_id})
        return mock_id

    def enrich_contact_from_bullhorn(self, contact: Dict) -> Dict:
        enriched = contact.copy()
        enriched['_mock_enrichment'] = True
        return enriched

    def sync_contact_to_bullhorn(self, contact: Dict) -> int:
        return self.create_candidate(contact)


# ============================================
# FACTORY FUNCTION
# ============================================

def get_bullhorn_client(use_mock: bool = False) -> BullhornClient:
    """Get Bullhorn client (real or mock)."""
    config = BullhornConfig()

    if use_mock or not config.client_id:
        logger.info("Using mock Bullhorn client (credentials not configured)")
        return MockBullhornClient(config)

    return BullhornClient(config)


# ============================================
# CLI INTERFACE
# ============================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Bullhorn CRM Integration')
    parser.add_argument('--search', help='Search for candidates')
    parser.add_argument('--enrich', help='Enrich contacts from JSON file')
    parser.add_argument('--sync', help='Sync contacts to Bullhorn from JSON file')
    parser.add_argument('--mock', action='store_true', help='Use mock client')

    args = parser.parse_args()

    client = get_bullhorn_client(use_mock=args.mock)

    if args.search:
        candidates = client.search_candidates(args.search)
        print(f"\nFound {len(candidates)} candidates:")
        for c in candidates[:10]:
            print(f"  - {c.get('firstName', '')} {c.get('lastName', '')} | {c.get('email', '')}")
        return

    if args.enrich:
        with open(args.enrich, 'r') as f:
            contacts = json.load(f)
        enriched = client.enrich_contacts_batch(contacts)
        print(f"Enriched {len(enriched)} contacts")
        return

    if args.sync:
        with open(args.sync, 'r') as f:
            contacts = json.load(f)
        results = client.sync_contacts_batch(contacts)
        print(f"Synced: {results['synced']}, Failed: {results['failed']}")
        return

    parser.print_help()


if __name__ == '__main__':
    main()
