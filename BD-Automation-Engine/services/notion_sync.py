"""
Notion Sync Service - Synchronize BD automation data with Notion databases.
Manages job postings, review queues, and dashboard updates.

Updated for Notion API version 2025-09-03 with multi-source database support.
"""

import os
import json
import logging
import requests
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('BD-NotionSync')

# API Version - Updated from 2022-06-28 to 2025-09-03 for data source support
NOTION_API_VERSION = '2025-09-03'

# Try to import Notion client
try:
    from notion_client import Client
    HAS_NOTION = True
except ImportError:
    HAS_NOTION = False
    Client = None  # Type stub for when not installed
    logger.warning("notion-client not installed. Notion sync disabled.")


@dataclass
class NotionConfig:
    """Configuration for Notion integration."""
    token: str = os.getenv('NOTION_TOKEN', '')

    # Database IDs
    db_jobs: str = os.getenv('NOTION_DB_GDIT_JOBS', '')
    db_dcgs_contacts: str = os.getenv('NOTION_DB_DCGS_CONTACTS', '')
    db_other_contacts: str = os.getenv('NOTION_DB_GDIT_OTHER_CONTACTS', '')
    db_opportunities: str = os.getenv('NOTION_DB_BD_OPPORTUNITIES', '')
    db_programs: str = os.getenv('NOTION_DB_FEDERAL_PROGRAMS', '')
    db_mapping_hub: str = os.getenv('NOTION_DB_PROGRAM_MAPPING_HUB', '')


class NotionSyncService:
    """Manages synchronization between BD Automation and Notion.

    Updated for Notion API 2025-09-03 with multi-source database support.
    Key changes:
    - Page creation uses data_source_id parent instead of database_id
    - Database queries route through data_sources endpoint
    - Data source IDs are cached to minimize API calls
    """

    def __init__(self, config: NotionConfig = None):
        self.config = config or NotionConfig()
        self._client = None
        self._data_source_cache: Dict[str, str] = {}  # database_id -> data_source_id

    @property
    def client(self):
        """Get Notion client (lazy initialization)."""
        if not HAS_NOTION:
            raise RuntimeError("notion-client not installed. Run: pip install notion-client")

        if self._client is None:
            if not self.config.token:
                raise ValueError("NOTION_TOKEN not configured")
            self._client = Client(auth=self.config.token)

        return self._client

    # ============================================
    # DATA SOURCE DISCOVERY (API 2025-09-03)
    # ============================================

    def _get_headers(self) -> Dict[str, str]:
        """Get headers for direct API calls."""
        return {
            "Authorization": f"Bearer {self.config.token}",
            "Notion-Version": NOTION_API_VERSION,
            "Content-Type": "application/json"
        }

    def get_data_source_id(self, database_id: str) -> str:
        """Get the primary data_source_id for a database.

        In API 2025-09-03, databases can have multiple data sources.
        We fetch the database info and return the first data source ID.
        Results are cached to avoid repeated API calls.
        """
        # Check cache first
        if database_id in self._data_source_cache:
            return self._data_source_cache[database_id]

        # Fetch database info to get data sources
        url = f"https://api.notion.com/v1/databases/{database_id}"
        response = requests.get(url, headers=self._get_headers())
        response.raise_for_status()
        db_info = response.json()

        data_sources = db_info.get('data_sources', [])
        if not data_sources:
            raise ValueError(f"No data sources found for database {database_id}")

        # Use the first (primary) data source
        data_source_id = data_sources[0]['id']

        # Cache it
        self._data_source_cache[database_id] = data_source_id
        logger.debug(f"Cached data_source_id {data_source_id} for database {database_id}")

        return data_source_id

    def clear_data_source_cache(self):
        """Clear the data source cache."""
        self._data_source_cache.clear()

    def get_all_data_sources(self, database_id: str) -> List[Dict]:
        """Get all data sources for a database."""
        url = f"https://api.notion.com/v1/databases/{database_id}"
        response = requests.get(url, headers=self._get_headers())
        response.raise_for_status()
        db_info = response.json()
        return db_info.get('data_sources', [])

    # ============================================
    # QUERY OPERATIONS (Updated for 2025-09-03)
    # ============================================

    def query_data_source(self, data_source_id: str, filter_obj: Dict = None,
                          sorts: List[Dict] = None, page_size: int = 100,
                          start_cursor: str = None) -> Dict:
        """Query a data source directly.

        In API 2025-09-03, queries go to /v1/data_sources/:id/query
        instead of /v1/databases/:id/query.
        """
        url = f"https://api.notion.com/v1/data_sources/{data_source_id}/query"
        body = {"page_size": page_size}

        if filter_obj:
            body["filter"] = filter_obj
        if sorts:
            body["sorts"] = sorts
        if start_cursor:
            body["start_cursor"] = start_cursor

        response = requests.post(url, headers=self._get_headers(), json=body)
        response.raise_for_status()
        return response.json()

    def query_database(self, database_id: str, filter_obj: Dict = None,
                       sorts: List[Dict] = None, page_size: int = 100) -> Dict:
        """Query a database by its database ID (convenience wrapper).

        Automatically resolves the data_source_id and queries it.
        """
        data_source_id = self.get_data_source_id(database_id)
        return self.query_data_source(data_source_id, filter_obj, sorts, page_size)

    def _format_rich_text(self, text: str) -> List[Dict]:
        """Format text as Notion rich text."""
        if not text:
            return []
        return [{"type": "text", "text": {"content": str(text)[:2000]}}]

    def _format_title(self, text: str) -> List[Dict]:
        """Format text as Notion title."""
        return self._format_rich_text(text)

    def _format_select(self, value: str) -> Dict:
        """Format value as Notion select."""
        return {"name": str(value)} if value else None

    def _format_number(self, value: Any) -> Optional[float]:
        """Format value as Notion number."""
        try:
            return float(value) if value is not None else None
        except (ValueError, TypeError):
            return None

    def _format_url(self, url: str) -> Optional[str]:
        """Format value as Notion URL."""
        return str(url) if url and url.startswith('http') else None

    def _format_date(self, date_str: str) -> Optional[Dict]:
        """Format date string as Notion date."""
        if not date_str:
            return None
        try:
            if isinstance(date_str, datetime):
                return {"start": date_str.isoformat()}
            return {"start": date_str}
        except Exception:
            return None

    # ============================================
    # JOB OPERATIONS
    # ============================================

    def _create_page_with_data_source(self, database_id: str, properties: Dict) -> Optional[str]:
        """Create a page using data_source_id parent (API 2025-09-03).

        In the new API, pages are created with data_source_id parent instead of database_id.
        """
        try:
            data_source_id = self.get_data_source_id(database_id)

            url = "https://api.notion.com/v1/pages"
            body = {
                "parent": {"data_source_id": data_source_id},
                "properties": properties
            }

            response = requests.post(url, headers=self._get_headers(), json=body)
            response.raise_for_status()
            result = response.json()

            page_id = result.get('id')
            logger.info(f"Created Notion page: {page_id}")
            return page_id
        except Exception as e:
            logger.error(f"Failed to create Notion page: {e}")
            return None

    def create_job_page(self, job: Dict) -> Optional[str]:
        """Create a new job page in Notion.

        Updated for API 2025-09-03: Uses data_source_id parent instead of database_id.
        """
        if not self.config.db_jobs:
            logger.warning("Jobs database ID not configured")
            return None

        mapping = job.get('_mapping', {})
        scoring = job.get('_scoring', {})

        properties = {
            "Name": {"title": self._format_title(
                job.get('Job Title/Position') or job.get('title', 'Unknown')
            )},
            "Company": {"rich_text": self._format_rich_text(
                job.get('Prime Contractor') or job.get('company', '')
            )},
            "Location": {"rich_text": self._format_rich_text(
                job.get('Location') or job.get('location', '')
            )},
            "Clearance": {"select": self._format_select(
                job.get('Security Clearance') or job.get('clearance', '')
            )},
            "Source": {"select": self._format_select(job.get('Source', 'Unknown'))},
            "Source URL": {"url": self._format_url(
                job.get('Source URL') or job.get('url', '')
            )},
        }

        # Add mapping fields if available
        if mapping:
            properties["Program"] = {"select": self._format_select(mapping.get('program_name'))}
            properties["Match Confidence"] = {"number": self._format_number(mapping.get('match_confidence'))}
            properties["Match Type"] = {"select": self._format_select(mapping.get('match_type'))}

        # Add scoring fields if available
        if scoring:
            properties["BD Score"] = {"number": self._format_number(scoring.get('BD Priority Score'))}
            properties["Priority Tier"] = {"select": self._format_select(
                str(scoring.get('Priority Tier', '')).split()[-1]  # Extract "Hot", "Warm", "Cold"
            )}

        # Add status
        confidence = mapping.get('match_confidence', 0.5)
        if confidence >= 0.7:
            status = "Enriched"
        elif confidence >= 0.5:
            status = "Needs Review"
        else:
            status = "Raw Import"
        properties["Status"] = {"select": self._format_select(status)}

        # Use data_source_id parent (API 2025-09-03)
        return self._create_page_with_data_source(self.config.db_jobs, properties)

    def update_job_page(self, page_id: str, updates: Dict) -> bool:
        """Update an existing job page in Notion."""
        properties = {}

        if 'program_name' in updates:
            properties["Program"] = {"select": self._format_select(updates['program_name'])}
        if 'match_confidence' in updates:
            properties["Match Confidence"] = {"number": self._format_number(updates['match_confidence'])}
        if 'bd_score' in updates:
            properties["BD Score"] = {"number": self._format_number(updates['bd_score'])}
        if 'status' in updates:
            properties["Status"] = {"select": self._format_select(updates['status'])}

        if not properties:
            return True

        try:
            self.client.pages.update(
                page_id=page_id,
                properties=properties
            )
            logger.info(f"Updated Notion page: {page_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to update Notion page: {e}")
            return False

    def sync_jobs_batch(self, jobs: List[Dict]) -> Dict:
        """Sync a batch of jobs to Notion."""
        results = {
            'created': 0,
            'failed': 0,
            'page_ids': []
        }

        for job in jobs:
            page_id = self.create_job_page(job)
            if page_id:
                results['created'] += 1
                results['page_ids'].append(page_id)
            else:
                results['failed'] += 1

        logger.info(f"Synced {results['created']} jobs to Notion, {results['failed']} failed")
        return results

    # ============================================
    # REVIEW QUEUE OPERATIONS
    # ============================================

    def get_jobs_needing_review(self, limit: int = 50) -> List[Dict]:
        """Get jobs that need human review from Notion.

        Updated for API 2025-09-03: Uses data source query endpoint.
        """
        if not self.config.db_jobs:
            return []

        try:
            # Use the new query_database method which routes through data_sources
            response = self.query_database(
                database_id=self.config.db_jobs,
                filter_obj={
                    "property": "Status",
                    "select": {"equals": "Needs Review"}
                },
                sorts=[
                    {"property": "BD Score", "direction": "descending"}
                ],
                page_size=limit
            )

            jobs = []
            for page in response.get('results', []):
                props = page.get('properties', {})
                jobs.append({
                    'page_id': page['id'],
                    'title': self._extract_title(props.get('Name', {})),
                    'company': self._extract_text(props.get('Company', {})),
                    'location': self._extract_text(props.get('Location', {})),
                    'program': self._extract_select(props.get('Program', {})),
                    'bd_score': self._extract_number(props.get('BD Score', {})),
                    'match_confidence': self._extract_number(props.get('Match Confidence', {})),
                })

            return jobs

        except Exception as e:
            logger.error(f"Failed to query Notion: {e}")
            return []

    def mark_reviewed(self, page_id: str, approved: bool, feedback: str = None) -> bool:
        """Mark a job as reviewed in Notion."""
        properties = {
            "Status": {"select": self._format_select("Approved" if approved else "Rejected")},
            "Reviewed At": {"date": {"start": datetime.now().isoformat()}},
        }

        if feedback:
            properties["Review Notes"] = {"rich_text": self._format_rich_text(feedback)}

        return self.update_job_page(page_id, properties)

    # ============================================
    # DASHBOARD DATA
    # ============================================

    def get_dashboard_stats(self) -> Dict:
        """Get statistics for BD dashboard.

        Updated for API 2025-09-03: Uses data source query endpoint.
        """
        if not self.config.db_jobs:
            return {}

        stats = {
            'total_jobs': 0,
            'by_status': {},
            'by_tier': {},
            'by_program': {},
            'hot_leads': [],
        }

        try:
            # Get total count by status using new query method
            for status in ['Raw Import', 'Enriched', 'Needs Review', 'Approved', 'Rejected']:
                response = self.query_database(
                    database_id=self.config.db_jobs,
                    filter_obj={
                        "property": "Status",
                        "select": {"equals": status}
                    },
                    page_size=1
                )
                # Note: Notion API doesn't return total count, need to paginate for accurate count

            # Get hot leads (BD Score >= 80)
            response = self.query_database(
                database_id=self.config.db_jobs,
                filter_obj={
                    "property": "BD Score",
                    "number": {"greater_than_or_equal_to": 80}
                },
                sorts=[
                    {"property": "BD Score", "direction": "descending"}
                ],
                page_size=10
            )

            for page in response.get('results', []):
                props = page.get('properties', {})
                stats['hot_leads'].append({
                    'title': self._extract_title(props.get('Name', {})),
                    'program': self._extract_select(props.get('Program', {})),
                    'bd_score': self._extract_number(props.get('BD Score', {})),
                })

            return stats

        except Exception as e:
            logger.error(f"Failed to get dashboard stats: {e}")
            return stats

    # ============================================
    # HELPER METHODS
    # ============================================

    def _extract_title(self, prop: Dict) -> str:
        """Extract title from Notion property."""
        title_list = prop.get('title', [])
        return title_list[0].get('text', {}).get('content', '') if title_list else ''

    def _extract_text(self, prop: Dict) -> str:
        """Extract rich text from Notion property."""
        text_list = prop.get('rich_text', [])
        return text_list[0].get('text', {}).get('content', '') if text_list else ''

    def _extract_select(self, prop: Dict) -> str:
        """Extract select value from Notion property."""
        select = prop.get('select')
        return select.get('name', '') if select else ''

    def _extract_number(self, prop: Dict) -> Optional[float]:
        """Extract number from Notion property."""
        return prop.get('number')

    # ============================================
    # OPPORTUNITY CREATION
    # ============================================

    def create_opportunity(self, job: Dict) -> Optional[str]:
        """Create a BD opportunity from a hot lead.

        Updated for API 2025-09-03: Uses data_source_id parent instead of database_id.
        """
        if not self.config.db_opportunities:
            logger.warning("Opportunities database ID not configured")
            return None

        mapping = job.get('_mapping', {})
        scoring = job.get('_scoring', {})

        properties = {
            "Name": {"title": self._format_title(
                f"{mapping.get('program_name', 'Unknown')} - {job.get('Job Title/Position', 'Position')}"
            )},
            "Program": {"select": self._format_select(mapping.get('program_name'))},
            "Company": {"rich_text": self._format_rich_text(
                job.get('Prime Contractor') or job.get('company', '')
            )},
            "Location": {"rich_text": self._format_rich_text(
                job.get('Location') or job.get('location', '')
            )},
            "BD Score": {"number": self._format_number(scoring.get('BD Priority Score'))},
            "Status": {"select": self._format_select("New")},
            "Source": {"select": self._format_select("BD Automation")},
            "Created Date": {"date": {"start": datetime.now().isoformat()}},
        }

        # Use data_source_id parent (API 2025-09-03)
        return self._create_page_with_data_source(self.config.db_opportunities, properties)

    def promote_hot_leads_to_opportunities(self, jobs: List[Dict]) -> Dict:
        """Promote hot leads to BD opportunities."""
        hot_leads = [j for j in jobs if j.get('_scoring', {}).get('BD Priority Score', 0) >= 80]

        results = {
            'promoted': 0,
            'failed': 0,
            'opportunity_ids': []
        }

        for job in hot_leads:
            opp_id = self.create_opportunity(job)
            if opp_id:
                results['promoted'] += 1
                results['opportunity_ids'].append(opp_id)
            else:
                results['failed'] += 1

        logger.info(f"Promoted {results['promoted']} hot leads to opportunities")
        return results


# ============================================
# CLI INTERFACE
# ============================================

def main():
    import argparse

    parser = argparse.ArgumentParser(description='Notion Sync Service')
    parser.add_argument('--sync-jobs', help='Sync jobs from JSON file to Notion')
    parser.add_argument('--get-reviews', action='store_true', help='Get jobs needing review')
    parser.add_argument('--dashboard', action='store_true', help='Get dashboard stats')
    parser.add_argument('--test', action='store_true', help='Test Notion connection')

    args = parser.parse_args()

    sync = NotionSyncService()

    if args.test:
        try:
            # Test connection by listing databases
            user = sync.client.users.me()
            print(f"Connected to Notion as: {user.get('name', 'Unknown')}")
            print("Connection successful!")
        except Exception as e:
            print(f"Connection failed: {e}")
        return

    if args.sync_jobs:
        with open(args.sync_jobs, 'r') as f:
            jobs = json.load(f)
        results = sync.sync_jobs_batch(jobs)
        print(f"Synced: {results['created']} created, {results['failed']} failed")
        return

    if args.get_reviews:
        reviews = sync.get_jobs_needing_review()
        print(f"\nJobs Needing Review ({len(reviews)}):")
        for r in reviews[:10]:
            print(f"  - {r['title']} | {r['program']} | Score: {r['bd_score']}")
        return

    if args.dashboard:
        stats = sync.get_dashboard_stats()
        print("\nDashboard Stats:")
        print(f"Hot Leads: {len(stats.get('hot_leads', []))}")
        for lead in stats.get('hot_leads', [])[:5]:
            print(f"  - {lead['title']} | Score: {lead['bd_score']}")
        return

    parser.print_help()


if __name__ == '__main__':
    main()
