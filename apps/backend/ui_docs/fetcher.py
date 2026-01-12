"""
UI Framework Documentation Fetcher
===================================

Automatically fetches UI framework documentation using Firecrawl and caches it locally.
Enables autonomous agents to learn about UI components without asking users.
"""

import json
import os
from pathlib import Path
from typing import Optional

import requests


# UI Framework documentation URLs
FRAMEWORK_DOCS = {
    "Untitled UI": {
        "url": "https://www.untitledui.com/components",
        "name": "untitled-ui",
        "description": "Premium design system with Figma components",
    },
    "shadcn/ui": {
        "url": "https://ui.shadcn.com/docs/components",
        "name": "shadcn-ui",
        "description": "Re-usable components built with Radix UI and Tailwind CSS",
    },
    "Material UI": {
        "url": "https://mui.com/material-ui/getting-started/",
        "name": "material-ui",
        "description": "React components for faster and easier web development",
    },
    "Chakra UI": {
        "url": "https://chakra-ui.com/docs/components",
        "name": "chakra-ui",
        "description": "Simple, modular and accessible component library",
    },
    "Ant Design": {
        "url": "https://ant.design/components/overview/",
        "name": "ant-design",
        "description": "Enterprise-class UI design language and React components",
    },
}


def get_cached_docs_path(framework_name: str, project_dir: Path) -> Optional[Path]:
    """
    Get path to cached UI framework documentation.

    Args:
        framework_name: Name of the UI framework (e.g., "Untitled UI", "shadcn/ui")
        project_dir: Project root directory

    Returns:
        Path to cached docs if they exist, None otherwise
    """
    if framework_name not in FRAMEWORK_DOCS:
        return None

    framework_slug = FRAMEWORK_DOCS[framework_name]["name"]
    docs_dir = project_dir / ".auto-claude" / "ui-framework-docs" / framework_slug
    docs_file = docs_dir / "components.md"

    if docs_file.exists():
        return docs_file

    return None


def fetch_ui_framework_docs(
    framework_name: str, project_dir: Path, firecrawl_api_key: Optional[str] = None
) -> tuple[bool, str]:
    """
    Fetch UI framework documentation using Firecrawl and cache it locally.

    Args:
        framework_name: Name of the UI framework (e.g., "Untitled UI")
        project_dir: Project root directory
        firecrawl_api_key: Firecrawl API key (optional, reads from env if not provided)

    Returns:
        Tuple of (success: bool, message: str)
    """
    # Check if framework is supported
    if framework_name not in FRAMEWORK_DOCS:
        return False, f"Framework '{framework_name}' is not supported for auto-fetch"

    framework_info = FRAMEWORK_DOCS[framework_name]
    framework_slug = framework_info["name"]

    # Check if docs already cached
    cached_path = get_cached_docs_path(framework_name, project_dir)
    if cached_path:
        return True, f"Documentation already cached at {cached_path}"

    # Get Firecrawl API key
    api_key = firecrawl_api_key or os.environ.get("FIRECRAWL_API_KEY")
    if not api_key:
        return (
            False,
            "FIRECRAWL_API_KEY not set. Set it in .env or pass as parameter.",
        )

    # Create docs directory
    docs_dir = project_dir / ".auto-claude" / "ui-framework-docs" / framework_slug
    docs_dir.mkdir(parents=True, exist_ok=True)

    # Fetch documentation using Firecrawl
    try:
        print(
            f"Fetching {framework_name} documentation from {framework_info['url']}..."
        )

        # Use Firecrawl scrape endpoint for single page
        response = requests.post(
            "https://api.firecrawl.dev/v1/scrape",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "url": framework_info["url"],
                "formats": ["markdown"],
                "onlyMainContent": True,
            },
            timeout=30,
        )

        if response.status_code != 200:
            return (
                False,
                f"Firecrawl API error: {response.status_code} - {response.text}",
            )

        data = response.json()

        if not data.get("success"):
            return False, f"Firecrawl failed: {data.get('error', 'Unknown error')}"

        markdown_content = data.get("data", {}).get("markdown", "")

        if not markdown_content:
            return False, "No markdown content returned from Firecrawl"

        # Save to file
        docs_file = docs_dir / "components.md"
        docs_file.write_text(markdown_content, encoding="utf-8")

        # Save metadata
        metadata = {
            "framework": framework_name,
            "url": framework_info["url"],
            "description": framework_info["description"],
            "fetched_at": __import__("datetime").datetime.now().isoformat(),
        }
        metadata_file = docs_dir / "metadata.json"
        metadata_file.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

        print(
            f"✓ Successfully fetched {framework_name} documentation ({len(markdown_content)} chars)"
        )
        return True, f"Documentation cached at {docs_file}"

    except requests.exceptions.RequestException as e:
        return False, f"Network error fetching documentation: {e}"
    except Exception as e:
        return False, f"Error fetching documentation: {e}"


def ensure_ui_docs_available(
    framework_name: str, project_dir: Path
) -> tuple[bool, Optional[Path], str]:
    """
    Ensure UI framework documentation is available, fetching if necessary.

    This is the main entry point for agents - call this before planning/coding
    to ensure docs are ready.

    Args:
        framework_name: Name of the UI framework
        project_dir: Project root directory

    Returns:
        Tuple of (success: bool, docs_path: Optional[Path], message: str)
    """
    # Check if already cached
    cached_path = get_cached_docs_path(framework_name, project_dir)
    if cached_path:
        return True, cached_path, f"Using cached documentation at {cached_path}"

    # Try to fetch
    success, message = fetch_ui_framework_docs(framework_name, project_dir)
    if success:
        docs_path = get_cached_docs_path(framework_name, project_dir)
        return True, docs_path, message

    return False, None, message
