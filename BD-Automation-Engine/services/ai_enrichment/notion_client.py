"""
Notion API Client with rate limiting and batch operations
"""
import os
import time
import json
import requests
from typing import Dict, List, Optional, Any
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()


class NotionClient:
    """Handles all Notion API operations with rate limiting"""

    BASE_URL = "https://api.notion.com/v1"
    NOTION_VERSION = "2022-06-28"

    # Database IDs
    DATABASES = {
        'PROGRAM_MAPPING_HUB': '0a0d7e46-3d88-40b6-853a-3c9680347644',
        'FEDERAL_PROGRAMS': '9db40fce-0781-42b9-902c-d4b0263b1e23',
        'CONTRACTORS': 'ca67175b-df3d-442d-a2e7-cc24e9a1bf78',
        'CONTRACT_VEHICLES': 'e1166305-1b1f-4812-b665-bcfa6a87a2ab',
        'DCGS_CONTACTS': '2ccdef65-baa5-80d0-9b66-c67d66e7a54d',
        'GDIT_CONTACTS': 'c1b1d358-9d82-4f03-b77c-db43d9795c6f',
        'GDIT_PTS_CONTACTS': 'ff111f82-fdbd-4353-ad59-ea4de70a058b',
        'BD_OPPORTUNITIES': '2bcdef65-baa5-8015-bf09-c01813f24b0a',
        'BD_EVENTS': '782080b1-d182-4410-bef5-8a952dc8ca85',
        'ENRICHMENT_LOG': '9b9328d2-f969-40e3-9d33-a4168620fb1b',
        'GDIT_JOBS': '2ccdef65-baa5-8066-9cb6-ee688ede23f4',
        'INSIGHT_GLOBAL_JOBS': '1ccb65ff-7d9f-4358-9d02-407cb32121ac',
    }

    def __init__(self, token: Optional[str] = None):
        self.token = token or os.getenv('NOTION_TOKEN')
        if not self.token:
            raise ValueError("NOTION_TOKEN not found in environment")

        self.headers = {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json",
            "Notion-Version": self.NOTION_VERSION
        }
        self.request_count = 0
        self.last_request_time = 0
        self.min_request_interval = 0.35  # ~3 requests per second (under 3/sec limit)

    def _rate_limit(self):
        """Ensure we don't exceed Notion's rate limits"""
        elapsed = time.time() - self.last_request_time
        if elapsed < self.min_request_interval:
            time.sleep(self.min_request_interval - elapsed)
        self.last_request_time = time.time()
        self.request_count += 1

    def _request(self, method: str, endpoint: str, data: Optional[Dict] = None) -> Dict:
        """Make a rate-limited request to Notion API"""
        self._rate_limit()

        url = f"{self.BASE_URL}/{endpoint}"

        try:
            if method == "GET":
                response = requests.get(url, headers=self.headers)
            elif method == "POST":
                response = requests.post(url, headers=self.headers, json=data)
            elif method == "PATCH":
                response = requests.patch(url, headers=self.headers, json=data)
            elif method == "DELETE":
                response = requests.delete(url, headers=self.headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response.raise_for_status()
            return response.json()

        except requests.exceptions.HTTPError as e:
            try:
                error_body = e.response.json() if e.response.content else {}
                message = error_body.get("message", str(e))
            except:
                message = str(e)
            return {"error": True, "status": e.response.status_code, "message": message}
        except requests.exceptions.Timeout:
            return {"error": True, "message": "Request timed out"}
        except Exception as e:
            return {"error": True, "message": str(e)}

    def get_database(self, database_id: str) -> Dict:
        """Get database schema"""
        return self._request("GET", f"databases/{database_id}")

    def query_database(
        self,
        database_id: str,
        filter: Optional[Dict] = None,
        sorts: Optional[List[Dict]] = None,
        page_size: int = 100,
        start_cursor: Optional[str] = None
    ) -> Dict:
        """Query a database with optional filters and sorting"""
        data = {"page_size": page_size}
        if filter:
            data["filter"] = filter
        if sorts:
            data["sorts"] = sorts
        if start_cursor:
            data["start_cursor"] = start_cursor

        return self._request("POST", f"databases/{database_id}/query", data)

    def query_all_pages(
        self,
        database_id: str,
        filter: Optional[Dict] = None,
        sorts: Optional[List[Dict]] = None
    ) -> List[Dict]:
        """Query all pages from a database (handles pagination)"""
        all_pages = []
        start_cursor = None

        while True:
            result = self.query_database(
                database_id,
                filter=filter,
                sorts=sorts,
                start_cursor=start_cursor
            )

            if result.get("error"):
                print(f"Error querying database: {result.get('message')}")
                break

            all_pages.extend(result.get("results", []))

            if not result.get("has_more"):
                break

            start_cursor = result.get("next_cursor")

        return all_pages

    def get_page(self, page_id: str) -> Dict:
        """Get a single page"""
        return self._request("GET", f"pages/{page_id}")

    def update_page(self, page_id: str, properties: Dict) -> Dict:
        """Update page properties"""
        return self._request("PATCH", f"pages/{page_id}", {"properties": properties})

    def create_page(self, database_id: str, properties: Dict) -> Dict:
        """Create a new page in a database"""
        data = {
            "parent": {"database_id": database_id},
            "properties": properties
        }
        return self._request("POST", "pages", data)

    def get_pages_modified_since(
        self,
        database_id: str,
        since: datetime,
        status_filter: Optional[str] = None
    ) -> List[Dict]:
        """Get pages modified since a given datetime"""
        filter_conditions = [
            {
                "timestamp": "last_edited_time",
                "last_edited_time": {
                    "after": since.isoformat()
                }
            }
        ]

        if status_filter:
            filter_conditions.append({
                "property": "Status",
                "select": {"equals": status_filter}
            })

        filter = {"and": filter_conditions} if len(filter_conditions) > 1 else filter_conditions[0]

        return self.query_all_pages(database_id, filter=filter)

    def get_pages_by_status(self, database_id: str, status: str) -> List[Dict]:
        """Get pages with a specific status"""
        filter = {
            "property": "Status",
            "select": {"equals": status}
        }
        return self.query_all_pages(database_id, filter=filter)

    # Property value builders
    @staticmethod
    def build_title(text: str) -> Dict:
        return {"title": [{"text": {"content": text}}]}

    @staticmethod
    def build_rich_text(text: str) -> Dict:
        # Notion has a 2000 character limit per rich_text block
        if len(text) > 2000:
            blocks = []
            for i in range(0, len(text), 2000):
                blocks.append({"text": {"content": text[i:i+2000]}})
            return {"rich_text": blocks}
        return {"rich_text": [{"text": {"content": text}}]}

    @staticmethod
    def build_number(value: float) -> Dict:
        return {"number": value}

    @staticmethod
    def build_select(name: str) -> Dict:
        return {"select": {"name": name}}

    @staticmethod
    def build_multi_select(names: List[str]) -> Dict:
        return {"multi_select": [{"name": n} for n in names]}

    @staticmethod
    def build_checkbox(checked: bool) -> Dict:
        return {"checkbox": checked}

    @staticmethod
    def build_url(url: str) -> Dict:
        return {"url": url}

    @staticmethod
    def build_date(start: str, end: Optional[str] = None) -> Dict:
        date_obj = {"start": start}
        if end:
            date_obj["end"] = end
        return {"date": date_obj}

    @staticmethod
    def build_relation(page_ids: List[str]) -> Dict:
        return {"relation": [{"id": pid} for pid in page_ids]}

    # Property value extractors
    @staticmethod
    def extract_title(prop: Dict) -> str:
        title_array = prop.get("title", [])
        return "".join([t.get("plain_text", "") for t in title_array])

    @staticmethod
    def extract_rich_text(prop: Dict) -> str:
        text_array = prop.get("rich_text", [])
        return "".join([t.get("plain_text", "") for t in text_array])

    @staticmethod
    def extract_number(prop: Dict) -> Optional[float]:
        return prop.get("number")

    @staticmethod
    def extract_select(prop: Dict) -> Optional[str]:
        select = prop.get("select")
        return select.get("name") if select else None

    @staticmethod
    def extract_multi_select(prop: Dict) -> List[str]:
        return [item.get("name", "") for item in prop.get("multi_select", [])]

    @staticmethod
    def extract_checkbox(prop: Dict) -> bool:
        return prop.get("checkbox", False)

    @staticmethod
    def extract_url(prop: Dict) -> Optional[str]:
        return prop.get("url")

    @staticmethod
    def extract_date(prop: Dict) -> Optional[Dict]:
        return prop.get("date")

    @staticmethod
    def extract_relation(prop: Dict) -> List[str]:
        return [r.get("id", "") for r in prop.get("relation", [])]
