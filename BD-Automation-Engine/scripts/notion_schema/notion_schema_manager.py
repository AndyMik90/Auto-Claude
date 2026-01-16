"""
Notion Schema Manager for BD Intelligence Dashboard
=====================================================
This script handles:
1. Adding missing fields to existing databases
2. Creating new databases (Locations Hub, Customers, PTS Bench)
3. Database cleanup and property optimization

Uses direct Notion API calls since MCP server has limitations.

Updated for Notion API version 2025-09-03 with multi-source database support.
Key changes:
- Database retrieval now returns data_sources array
- Schema updates (properties) go to /v1/data_sources/:id endpoint
- Database creation uses initial_data_source[properties] structure
"""

import os
import json
import requests
from typing import Dict, List, Any, Optional
from dataclasses import dataclass
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration
NOTION_TOKEN = os.getenv("NOTION_TOKEN")
NOTION_VERSION = "2025-09-03"  # Updated from 2022-06-28 for data source support

# Database IDs from .env
DATABASE_IDS = {
    "jobs": "0a0d7e46-3d88-40b6-853a-3c9680347644",  # Program Mapping Intelligence Hub
    "programs": "9db40fce-0781-42b9-902c-d4b0263b1e23",  # Federal Programs
    "contractors": "ca67175b-df3d-442d-a2e7-cc24e9a1bf78",  # Contractors Database
    "contract_vehicles": "e1166305-1b1f-4812-b665-bcfa6a87a2ab",  # Contract Vehicles Master
    "dcgs_contacts": "2ccdef65-baa5-80d0-9b66-c67d66e7a54d",  # DCGS Contacts Full
    "gdit_contacts": "c1b1d358-9d82-4f03-b77c-db43d9795c6f",  # GDIT Other Contacts
}

# Headers for Notion API
HEADERS = {
    "Authorization": f"Bearer {NOTION_TOKEN}",
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json"
}


@dataclass
class PropertyDefinition:
    """Definition for a database property"""
    name: str
    type: str
    config: Dict[str, Any] = None

    def to_notion_property(self) -> Dict[str, Any]:
        """Convert to Notion API property format"""
        prop = {self.type: self.config or {}}
        return prop


class NotionSchemaManager:
    """Manager for Notion database schema operations.

    Updated for Notion API 2025-09-03 with multi-source database support.
    Key changes:
    - get_database() now returns data_sources array
    - update_data_source() updates properties via /v1/data_sources/:id
    - create_database() uses initial_data_source[properties] structure
    """

    def __init__(self):
        self.base_url = "https://api.notion.com/v1"
        self._data_source_cache: Dict[str, str] = {}  # database_id -> data_source_id

    def _make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """Make API request to Notion"""
        url = f"{self.base_url}/{endpoint}"

        try:
            if method == "GET":
                response = requests.get(url, headers=HEADERS)
            elif method == "PATCH":
                response = requests.patch(url, headers=HEADERS, json=data)
            elif method == "POST":
                response = requests.post(url, headers=HEADERS, json=data)
            else:
                raise ValueError(f"Unsupported method: {method}")

            response.raise_for_status()
            return response.json()
        except requests.exceptions.RequestException as e:
            print(f"Error making request to {endpoint}: {e}")
            if hasattr(e, 'response') and e.response is not None:
                print(f"Response: {e.response.text}")
            return None

    # ============================================
    # DATA SOURCE DISCOVERY (API 2025-09-03)
    # ============================================

    def get_data_source_id(self, database_id: str) -> Optional[str]:
        """Get the primary data_source_id for a database.

        In API 2025-09-03, databases can have multiple data sources.
        Returns the first (primary) data source ID.
        """
        if database_id in self._data_source_cache:
            return self._data_source_cache[database_id]

        db = self.get_database(database_id)
        if not db:
            return None

        data_sources = db.get('data_sources', [])
        if not data_sources:
            print(f"  [WARN] No data sources found for database {database_id}")
            return None

        data_source_id = data_sources[0]['id']
        self._data_source_cache[database_id] = data_source_id
        return data_source_id

    def get_data_source(self, data_source_id: str) -> Dict:
        """Get data source info including properties (schema).

        In API 2025-09-03, use /v1/data_sources/:id to get schema details.
        """
        return self._make_request("GET", f"data_sources/{data_source_id}")

    # ============================================
    # DATABASE OPERATIONS
    # ============================================

    def get_database(self, database_id: str) -> Dict:
        """Get database info including data_sources list.

        In API 2025-09-03, this returns data_sources array but not properties.
        Use get_data_source() to get the schema (properties).
        """
        return self._make_request("GET", f"databases/{database_id}")

    def update_database(self, database_id: str, properties: Dict[str, Any]) -> Dict:
        """Update database schema (properties) via data source endpoint.

        In API 2025-09-03, schema updates go to /v1/data_sources/:id
        not /v1/databases/:id.

        This is a convenience method that resolves the data_source_id
        and calls update_data_source().
        """
        data_source_id = self.get_data_source_id(database_id)
        if not data_source_id:
            print(f"  [ERROR] Could not get data_source_id for database {database_id}")
            return None

        return self.update_data_source(data_source_id, properties)

    def update_data_source(self, data_source_id: str, properties: Dict[str, Any]) -> Dict:
        """Update data source properties (schema).

        In API 2025-09-03, this is the endpoint for schema modifications.
        """
        data = {"properties": properties}
        return self._make_request("PATCH", f"data_sources/{data_source_id}", data)

    def create_database(self, parent_page_id: str, title: str, properties: Dict[str, Any], icon: str = None) -> Dict:
        """Create a new database with initial data source.

        In API 2025-09-03, properties go under initial_data_source[properties]
        instead of at the top level.
        """
        data = {
            "parent": {"page_id": parent_page_id},
            "title": [{"type": "text", "text": {"content": title}}],
            "initial_data_source": {
                "properties": properties
            }
        }
        if icon:
            data["icon"] = {"type": "emoji", "emoji": icon}
        return self._make_request("POST", "databases", data)

    def get_existing_properties(self, database_id: str) -> List[str]:
        """Get list of existing property names from the data source.

        In API 2025-09-03, we need to get properties from the data source,
        not from the database directly.
        """
        data_source_id = self.get_data_source_id(database_id)
        if not data_source_id:
            return []

        ds = self.get_data_source(data_source_id)
        if ds:
            return list(ds.get("properties", {}).keys())
        return []


# =============================================================================
# PHASE 1: Schema Updates - Add Missing Fields
# =============================================================================

def get_jobs_new_properties() -> Dict[str, Any]:
    """Properties to add to Jobs (Program Mapping Intelligence Hub)"""
    return {
        "Duration": {"rich_text": {}},
        "BD Formula Message": {"rich_text": {}},
        "PTS Available Contractors": {"number": {"format": "number"}},
        "Employment Type": {
            "select": {
                "options": [
                    {"name": "Full-Time", "color": "blue"},
                    {"name": "Contract", "color": "green"},
                    {"name": "Contract-to-Hire", "color": "yellow"},
                    {"name": "Part-Time", "color": "gray"},
                ]
            }
        },
        "Outreach Status": {
            "select": {
                "options": [
                    {"name": "Not Started", "color": "gray"},
                    {"name": "Researching", "color": "blue"},
                    {"name": "Ready to Contact", "color": "yellow"},
                    {"name": "Contacted", "color": "orange"},
                    {"name": "In Progress", "color": "purple"},
                    {"name": "Closed Won", "color": "green"},
                    {"name": "Closed Lost", "color": "red"},
                ]
            }
        },
    }


def get_programs_new_properties() -> Dict[str, Any]:
    """Properties to add to Federal Programs"""
    return {
        "BD Priority": {
            "select": {
                "options": [
                    {"name": "🔴 Critical", "color": "red"},
                    {"name": "🟠 High", "color": "orange"},
                    {"name": "🟡 Medium", "color": "yellow"},
                    {"name": "⚪ Low", "color": "gray"},
                ]
            }
        },
        "Hiring Velocity": {
            "select": {
                "options": [
                    {"name": "High", "color": "red"},
                    {"name": "Medium", "color": "yellow"},
                    {"name": "Low", "color": "green"},
                    {"name": "None", "color": "gray"},
                ]
            }
        },
        "BD Approach Notes": {"rich_text": {}},
        "Next Actions": {"rich_text": {}},
        "Mission Area": {"rich_text": {}},
    }


def get_contacts_new_properties() -> Dict[str, Any]:
    """Properties to add to Contact databases"""
    return {
        "Last Contact Date": {"date": {}},
        "Outreach History": {"rich_text": {}},
        "BD Formula Message": {"rich_text": {}},
        "Next Outreach Date": {"date": {}},
        "Relationship Strength": {
            "select": {
                "options": [
                    {"name": "Strong", "color": "green"},
                    {"name": "Developing", "color": "yellow"},
                    {"name": "New", "color": "blue"},
                    {"name": "Cold", "color": "gray"},
                ]
            }
        },
    }


def get_contractors_new_properties() -> Dict[str, Any]:
    """Properties to add to Contractors Database"""
    return {
        "Relationship Status": {
            "select": {
                "options": [
                    {"name": "Active Partner", "color": "green"},
                    {"name": "Prospect", "color": "yellow"},
                    {"name": "Target", "color": "orange"},
                    {"name": "Watch", "color": "blue"},
                    {"name": "Inactive", "color": "gray"},
                ]
            }
        },
        "PTS Placements Made": {"number": {"format": "number"}},
        "Active Placements": {"number": {"format": "number"}},
        "Portfolio Value": {"number": {"format": "dollar"}},
        "Last Engagement Date": {"date": {}},
    }


# =============================================================================
# PHASE 2: Create New Databases
# =============================================================================

def get_locations_hub_schema() -> Dict[str, Any]:
    """Schema for new Locations Hub database"""
    return {
        "Location Name": {"title": {}},
        "City": {"rich_text": {}},
        "State": {
            "select": {
                "options": [
                    {"name": "CA", "color": "blue"},
                    {"name": "VA", "color": "green"},
                    {"name": "MD", "color": "purple"},
                    {"name": "TX", "color": "orange"},
                    {"name": "CO", "color": "yellow"},
                    {"name": "FL", "color": "pink"},
                    {"name": "DC", "color": "red"},
                    {"name": "GA", "color": "brown"},
                    {"name": "HI", "color": "blue"},
                    {"name": "Other", "color": "gray"},
                ]
            }
        },
        "Geographic Region": {
            "select": {
                "options": [
                    {"name": "Southwest", "color": "orange"},
                    {"name": "Pacific", "color": "blue"},
                    {"name": "NCR (DC/MD/VA)", "color": "green"},
                    {"name": "Southeast", "color": "yellow"},
                    {"name": "Mountain", "color": "brown"},
                    {"name": "Midwest", "color": "purple"},
                    {"name": "Northeast", "color": "pink"},
                    {"name": "OCONUS", "color": "gray"},
                ]
            }
        },
        "Active Job Count": {"number": {"format": "number"}},
        "Total Headcount Estimate": {"number": {"format": "number"}},
        "Primary Mission": {
            "multi_select": {
                "options": [
                    {"name": "ISR", "color": "blue"},
                    {"name": "Cyber", "color": "red"},
                    {"name": "C4ISR", "color": "purple"},
                    {"name": "Network", "color": "green"},
                    {"name": "Space", "color": "pink"},
                    {"name": "Intel", "color": "orange"},
                    {"name": "Sustainment", "color": "yellow"},
                    {"name": "R&D", "color": "brown"},
                ]
            }
        },
        "Key Programs": {"rich_text": {}},
        "BD Priority": {
            "select": {
                "options": [
                    {"name": "🔴 Critical", "color": "red"},
                    {"name": "🟠 High", "color": "orange"},
                    {"name": "🟡 Medium", "color": "yellow"},
                    {"name": "⚪ Low", "color": "gray"},
                ]
            }
        },
        "Site Notes": {"rich_text": {}},
    }


def get_customers_schema() -> Dict[str, Any]:
    """Schema for new Customers (Agencies) database"""
    return {
        "Agency Name": {"title": {}},
        "Acronym": {"rich_text": {}},
        "Agency Type": {
            "select": {
                "options": [
                    {"name": "Service Branch", "color": "blue"},
                    {"name": "Intelligence Community", "color": "red"},
                    {"name": "Defense Agency", "color": "purple"},
                    {"name": "Civilian Agency", "color": "green"},
                    {"name": "Combatant Command", "color": "orange"},
                ]
            }
        },
        "Parent Agency": {"rich_text": {}},
        "Primary Missions": {
            "multi_select": {
                "options": [
                    {"name": "ISR", "color": "blue"},
                    {"name": "Cyber", "color": "red"},
                    {"name": "Network", "color": "green"},
                    {"name": "Space", "color": "pink"},
                    {"name": "Intel", "color": "orange"},
                    {"name": "C4ISR", "color": "purple"},
                    {"name": "Logistics", "color": "brown"},
                    {"name": "Health IT", "color": "yellow"},
                ]
            }
        },
        "Key Commands/Units": {"rich_text": {}},
        "PTS Past Performance": {"rich_text": {}},
        "PTS Relationship Status": {
            "select": {
                "options": [
                    {"name": "Active", "color": "green"},
                    {"name": "Past", "color": "blue"},
                    {"name": "Target", "color": "orange"},
                    {"name": "None", "color": "gray"},
                ]
            }
        },
        "Key Locations": {"rich_text": {}},
        "Budget Tier": {
            "select": {
                "options": [
                    {"name": "Tier 1 (>$10B)", "color": "red"},
                    {"name": "Tier 2 ($1-10B)", "color": "orange"},
                    {"name": "Tier 3 ($100M-1B)", "color": "yellow"},
                    {"name": "Tier 4 (<$100M)", "color": "gray"},
                ]
            }
        },
        "BD Priority": {
            "select": {
                "options": [
                    {"name": "🔴 Critical", "color": "red"},
                    {"name": "🟠 High", "color": "orange"},
                    {"name": "🟡 Medium", "color": "yellow"},
                    {"name": "⚪ Low", "color": "gray"},
                ]
            }
        },
        "Notes": {"rich_text": {}},
    }


def get_pts_bench_schema() -> Dict[str, Any]:
    """Schema for new PTS Bench database"""
    return {
        "Contractor Name": {"title": {}},
        "Clearance Level": {
            "select": {
                "options": [
                    {"name": "TS/SCI w/ Poly", "color": "red"},
                    {"name": "TS/SCI", "color": "orange"},
                    {"name": "Top Secret", "color": "yellow"},
                    {"name": "Secret", "color": "blue"},
                    {"name": "Public Trust", "color": "green"},
                    {"name": "None", "color": "gray"},
                ]
            }
        },
        "Availability Date": {"date": {}},
        "Availability Status": {
            "select": {
                "options": [
                    {"name": "Available Now", "color": "green"},
                    {"name": "Available Soon (30 days)", "color": "yellow"},
                    {"name": "Engaged", "color": "blue"},
                    {"name": "On Assignment", "color": "purple"},
                    {"name": "Not Available", "color": "gray"},
                ]
            }
        },
        "Primary Skills": {
            "multi_select": {
                "options": [
                    {"name": "Network Engineering", "color": "blue"},
                    {"name": "Cyber Security", "color": "red"},
                    {"name": "Systems Admin", "color": "green"},
                    {"name": "Software Development", "color": "purple"},
                    {"name": "Cloud/DevSecOps", "color": "orange"},
                    {"name": "ISR/Intelligence", "color": "yellow"},
                    {"name": "Program Management", "color": "pink"},
                    {"name": "Field Service", "color": "brown"},
                ]
            }
        },
        "Years of Experience": {"number": {"format": "number"}},
        "Target Hourly Rate": {"number": {"format": "dollar"}},
        "Location Preference": {"rich_text": {}},
        "Willing to Relocate": {"checkbox": {}},
        "Target Programs": {"rich_text": {}},
        "Placement History": {"rich_text": {}},
        "Resume Link": {"url": {}},
        "LinkedIn URL": {"url": {}},
        "Notes": {"rich_text": {}},
        "BD Priority": {
            "select": {
                "options": [
                    {"name": "🔴 Hot Candidate", "color": "red"},
                    {"name": "🟠 Strong Fit", "color": "orange"},
                    {"name": "🟡 Good Prospect", "color": "yellow"},
                    {"name": "⚪ General Pool", "color": "gray"},
                ]
            }
        },
    }


# =============================================================================
# PHASE 1.5: Database Cleanup
# =============================================================================

def get_cleanup_recommendations(manager: NotionSchemaManager) -> Dict[str, List[str]]:
    """Analyze databases and return cleanup recommendations.

    Updated for API 2025-09-03: Gets properties from data source, not database.
    """
    recommendations = {}

    for db_name, db_id in DATABASE_IDS.items():
        # Get data source ID first
        data_source_id = manager.get_data_source_id(db_id)
        if not data_source_id:
            continue

        # Get properties from data source (API 2025-09-03)
        ds = manager.get_data_source(data_source_id)
        if not ds:
            continue

        props = ds.get("properties", {})
        issues = []

        # Check for duplicate/similar property names
        prop_names_lower = [p.lower() for p in props.keys()]
        for i, name in enumerate(prop_names_lower):
            for j, other_name in enumerate(prop_names_lower):
                if i < j and (name in other_name or other_name in name):
                    issues.append(f"Potential duplicate: '{list(props.keys())[i]}' and '{list(props.keys())[j]}'")

        # Check for unused formula properties that might need cleanup
        for prop_name, prop_config in props.items():
            prop_type = prop_config.get("type", "")

            # Flag overly complex formulas
            if prop_type == "formula":
                formula_expr = prop_config.get("formula", {}).get("expression", "")
                if len(formula_expr) > 500:
                    issues.append(f"Complex formula in '{prop_name}' - consider simplifying")

            # Flag empty select options
            if prop_type == "select":
                options = prop_config.get("select", {}).get("options", [])
                if len(options) == 0:
                    issues.append(f"Empty select options in '{prop_name}'")

            # Flag empty multi_select options
            if prop_type == "multi_select":
                options = prop_config.get("multi_select", {}).get("options", [])
                if len(options) == 0:
                    issues.append(f"Empty multi-select options in '{prop_name}'")

        if issues:
            recommendations[db_name] = issues

    return recommendations


def cleanup_database_properties(manager: NotionSchemaManager, database_id: str,
                                 properties_to_remove: List[str] = None,
                                 properties_to_rename: Dict[str, str] = None) -> bool:
    """
    Clean up database properties
    Note: Notion API doesn't support removing properties, only setting them to null
    For renaming, we'd need to create new property and migrate data
    """
    updates = {}

    # To "remove" a property in Notion, set it to None/null
    if properties_to_remove:
        for prop_name in properties_to_remove:
            updates[prop_name] = None

    # Renaming requires creating new property with new name
    # (migration of data would need separate step)
    if properties_to_rename:
        for old_name, new_name in properties_to_rename.items():
            print(f"  Note: To rename '{old_name}' to '{new_name}', manual migration needed")

    if updates:
        result = manager.update_database(database_id, updates)
        return result is not None

    return True


# =============================================================================
# Main Execution
# =============================================================================

def run_phase_1(manager: NotionSchemaManager):
    """Phase 1: Add missing fields to existing databases"""
    print("\n" + "="*60)
    print("PHASE 1: Adding Missing Fields to Existing Databases")
    print("="*60)

    # 1A: Jobs Database
    print("\n[1A] Updating Jobs (Program Mapping Intelligence Hub)...")
    existing = manager.get_existing_properties(DATABASE_IDS["jobs"])
    new_props = get_jobs_new_properties()
    props_to_add = {k: v for k, v in new_props.items() if k not in existing}

    if props_to_add:
        result = manager.update_database(DATABASE_IDS["jobs"], props_to_add)
        if result:
            print(f"  [OK] Added {len(props_to_add)} properties: {list(props_to_add.keys())}")
        else:
            print(f"  [FAIL] Failed to add properties")
    else:
        print(f"  [INFO] All properties already exist")

    # 1B: Programs Database
    print("\n[1B] Updating Federal Programs...")
    existing = manager.get_existing_properties(DATABASE_IDS["programs"])
    new_props = get_programs_new_properties()
    props_to_add = {k: v for k, v in new_props.items() if k not in existing}

    if props_to_add:
        result = manager.update_database(DATABASE_IDS["programs"], props_to_add)
        if result:
            print(f"  [OK] Added {len(props_to_add)} properties: {list(props_to_add.keys())}")
        else:
            print(f"  [FAIL] Failed to add properties")
    else:
        print(f"  [INFO] All properties already exist")

    # 1C: Contacts Databases
    print("\n[1C] Updating Contact Databases...")
    for db_key in ["dcgs_contacts", "gdit_contacts"]:
        if db_key not in DATABASE_IDS:
            print(f"  [WARN] Database ID not found for {db_key}")
            continue

        existing = manager.get_existing_properties(DATABASE_IDS[db_key])
        new_props = get_contacts_new_properties()
        props_to_add = {k: v for k, v in new_props.items() if k not in existing}

        if props_to_add:
            result = manager.update_database(DATABASE_IDS[db_key], props_to_add)
            if result:
                print(f"  [OK] [{db_key}] Added {len(props_to_add)} properties")
            else:
                print(f"  [FAIL] [{db_key}] Failed to add properties")
        else:
            print(f"  [INFO] [{db_key}] All properties already exist")

    # 1D: Contractors Database
    print("\n[1D] Updating Contractors Database...")
    existing = manager.get_existing_properties(DATABASE_IDS["contractors"])
    new_props = get_contractors_new_properties()
    props_to_add = {k: v for k, v in new_props.items() if k not in existing}

    if props_to_add:
        result = manager.update_database(DATABASE_IDS["contractors"], props_to_add)
        if result:
            print(f"  [OK] Added {len(props_to_add)} properties: {list(props_to_add.keys())}")
        else:
            print(f"  [FAIL] Failed to add properties")
    else:
        print(f"  [INFO] All properties already exist")


def run_phase_1_5(manager: NotionSchemaManager):
    """Phase 1.5: Database Cleanup & Optimization"""
    print("\n" + "="*60)
    print("PHASE 1.5: Database Cleanup & Property Optimization")
    print("="*60)

    recommendations = get_cleanup_recommendations(manager)

    if not recommendations:
        print("\n[OK] No cleanup issues found!")
        return

    print("\n[REPORT] Cleanup Recommendations:")
    for db_name, issues in recommendations.items():
        print(f"\n  {db_name}:")
        for issue in issues:
            print(f"    - {issue}")

    print("\n[WARN] Manual review recommended for the above issues.")
    print("   Run with --apply-cleanup flag to attempt automatic fixes.")


def run_phase_2_3_4(manager: NotionSchemaManager, parent_page_id: str):
    """Phases 2-4: Create new databases"""
    print("\n" + "="*60)
    print("PHASES 2-4: Creating New Databases")
    print("="*60)

    # Phase 2: Locations Hub
    print("\n[Phase 2] Creating Locations Hub database...")
    result = manager.create_database(
        parent_page_id=parent_page_id,
        title="Locations Hub",
        properties=get_locations_hub_schema(),
        icon=None  # Skip emoji icons for Windows compatibility
    )
    if result:
        print(f"  [OK] Created Locations Hub: {result.get('id')}")
    else:
        print(f"  [FAIL] Failed to create Locations Hub")

    # Phase 3: Customers (Agencies)
    print("\n[Phase 3] Creating Customers (Agencies) database...")
    result = manager.create_database(
        parent_page_id=parent_page_id,
        title="Customers (Agencies)",
        properties=get_customers_schema(),
        icon=None
    )
    if result:
        print(f"  [OK] Created Customers: {result.get('id')}")
    else:
        print(f"  [FAIL] Failed to create Customers")

    # Phase 4: PTS Bench
    print("\n[Phase 4] Creating PTS Bench database...")
    result = manager.create_database(
        parent_page_id=parent_page_id,
        title="PTS Bench",
        properties=get_pts_bench_schema(),
        icon=None
    )
    if result:
        print(f"  [OK] Created PTS Bench: {result.get('id')}")
    else:
        print(f"  [FAIL] Failed to create PTS Bench")


def main():
    """Main execution"""
    import argparse

    parser = argparse.ArgumentParser(description="Notion Schema Manager for BD Dashboard")
    parser.add_argument("--phase", type=str, choices=["1", "1.5", "2-4", "all"],
                        default="all", help="Which phase to run")
    parser.add_argument("--parent-page", type=str,
                        help="Parent page ID for new databases (required for phase 2-4)")
    parser.add_argument("--apply-cleanup", action="store_true",
                        help="Apply automatic cleanup fixes")
    parser.add_argument("--dry-run", action="store_true",
                        help="Show what would be done without making changes")

    args = parser.parse_args()

    if not NOTION_TOKEN:
        print("[ERROR] NOTION_TOKEN not found in environment")
        return

    print("="*60)
    print("BD Intelligence Dashboard - Notion Schema Manager")
    print("="*60)

    manager = NotionSchemaManager()

    if args.dry_run:
        print("\n[WARN] DRY RUN MODE - No changes will be made\n")

    if args.phase in ["1", "all"]:
        run_phase_1(manager)

    if args.phase in ["1.5", "all"]:
        run_phase_1_5(manager)

    if args.phase in ["2-4", "all"]:
        if not args.parent_page:
            print("\n[WARN] Skipping Phase 2-4: --parent-page required for creating new databases")
            print("   Use: python notion_schema_manager.py --phase 2-4 --parent-page <page-id>")
        else:
            run_phase_2_3_4(manager, args.parent_page)

    print("\n" + "="*60)
    print("Schema management complete!")
    print("="*60)


if __name__ == "__main__":
    main()
