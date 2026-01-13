"""
Notion Sync Service - Synchronize BD automation data with Notion databases.
Manages job postings, review queues, and dashboard updates.
"""

import os
import json
import logging
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('BD-NotionSync')

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
    """Manages synchronization between BD Automation and Notion."""

    def __init__(self, config: NotionConfig = None):
        self.config = config or NotionConfig()
        self._client = None

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

    def create_job_page(self, job: Dict) -> Optional[str]:
        """Create a new job page in Notion."""
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

        try:
            response = self.client.pages.create(
                parent={"database_id": self.config.db_jobs},
                properties=properties
            )
            page_id = response.get('id')
            logger.info(f"Created Notion page: {page_id}")
            return page_id
        except Exception as e:
            logger.error(f"Failed to create Notion page: {e}")
            return None

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
        """Get jobs that need human review from Notion."""
        if not self.config.db_jobs:
            return []

        try:
            response = self.client.databases.query(
                database_id=self.config.db_jobs,
                filter={
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
        """Get statistics for BD dashboard."""
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
            # Get total count by status
            for status in ['Raw Import', 'Enriched', 'Needs Review', 'Approved', 'Rejected']:
                response = self.client.databases.query(
                    database_id=self.config.db_jobs,
                    filter={
                        "property": "Status",
                        "select": {"equals": status}
                    },
                    page_size=1
                )
                # Note: Notion API doesn't return total count, need to paginate for accurate count

            # Get hot leads (BD Score >= 80)
            response = self.client.databases.query(
                database_id=self.config.db_jobs,
                filter={
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
        """Create a BD opportunity from a hot lead."""
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

        try:
            response = self.client.pages.create(
                parent={"database_id": self.config.db_opportunities},
                properties=properties
            )
            page_id = response.get('id')
            logger.info(f"Created opportunity: {page_id}")
            return page_id
        except Exception as e:
            logger.error(f"Failed to create opportunity: {e}")
            return None

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
