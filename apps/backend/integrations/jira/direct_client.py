"""
Direct JIRA REST API Client
============================

Provides direct access to JIRA REST API without going through MCP.
Reads credentials from MCP settings for convenience.

Use this when:
- MCP bridge has protocol issues
- You want simpler, direct API access
- Running in environments without MCP server
"""

import httpx
import base64
import json
import os
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import logging

logger = logging.getLogger(__name__)


@dataclass
class JiraCredentials:
    """JIRA API credentials."""
    host: str
    email: str
    api_token: str
    default_project: str = ""

    @classmethod
    def from_mcp_settings(cls, server_name: str = "jira-mcp") -> Optional["JiraCredentials"]:
        """Load credentials from Claude Code MCP settings."""
        settings_path = os.path.expanduser("~/.claude/settings.json")

        try:
            with open(settings_path, encoding="utf-8") as f:
                settings = json.load(f)

            servers = settings.get("mcpServers", {})
            server = servers.get(server_name)

            if not server:
                return None

            env = server.get("env", {})

            host = env.get("JIRA_HOST", "")
            email = env.get("JIRA_EMAIL", "")
            token = env.get("JIRA_API_TOKEN", "")
            project = env.get("JIRA_DEFAULT_PROJECT", "")

            if not host or not email or not token:
                return None

            return cls(
                host=host.rstrip("/"),
                email=email,
                api_token=token,
                default_project=project,
            )
        except (OSError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to load MCP settings: {e}")
            return None

    @classmethod
    def from_env(cls) -> Optional["JiraCredentials"]:
        """Load credentials from environment variables."""
        host = os.environ.get("JIRA_HOST", "")
        email = os.environ.get("JIRA_EMAIL", "")
        token = os.environ.get("JIRA_API_TOKEN", "")
        project = os.environ.get("JIRA_DEFAULT_PROJECT", "")

        if not host or not email or not token:
            return None

        return cls(
            host=host.rstrip("/"),
            email=email,
            api_token=token,
            default_project=project,
        )

    @property
    def auth_header(self) -> str:
        """Get Basic auth header value."""
        credentials = f"{self.email}:{self.api_token}"
        encoded = base64.b64encode(credentials.encode()).decode()
        return f"Basic {encoded}"


class DirectJiraClient:
    """
    Direct JIRA REST API client.

    Bypasses MCP and calls JIRA API directly.
    """

    def __init__(self, credentials: JiraCredentials = None):
        """
        Initialize client.

        Args:
            credentials: JIRA credentials (auto-loaded from MCP settings if not provided)
        """
        self.credentials = credentials or JiraCredentials.from_mcp_settings() or JiraCredentials.from_env()

        if not self.credentials:
            raise ValueError("No JIRA credentials found. Check MCP settings or environment variables.")

        self._http: Optional[httpx.AsyncClient] = None

    async def connect(self) -> None:
        """Initialize HTTP client."""
        if self._http is not None:
            return

        self._http = httpx.AsyncClient(
            base_url=f"{self.credentials.host}/rest/api/3",
            headers={
                "Authorization": self.credentials.auth_header,
                "Content-Type": "application/json",
                "Accept": "application/json",
            },
            timeout=30.0,
        )

        # Verify connection
        try:
            await self.get_current_user()
            logger.info(f"Connected to JIRA at {self.credentials.host}")
        except Exception as e:
            await self.disconnect()
            raise ValueError(f"Failed to connect to JIRA: {e}")

    async def disconnect(self) -> None:
        """Close HTTP client."""
        if self._http:
            await self._http.aclose()
            self._http = None

    async def _request(
        self,
        method: str,
        path: str,
        params: Dict = None,
        json_data: Dict = None,
    ) -> Any:
        """Make an API request."""
        if not self._http:
            await self.connect()

        response = await self._http.request(
            method=method,
            url=path,
            params=params,
            json=json_data,
        )

        if response.status_code >= 400:
            error_text = response.text
            raise Exception(f"JIRA API error {response.status_code}: {error_text[:200]}")

        if response.status_code == 204:
            return None

        return response.json()

    # ==================== User ====================

    async def get_current_user(self) -> Dict[str, Any]:
        """Get current authenticated user."""
        return await self._request("GET", "/myself")

    # ==================== Issues ====================

    async def search_issues(
        self,
        jql: str,
        max_results: int = 50,
        fields: List[str] = None,
    ) -> Dict[str, Any]:
        """
        Search for issues using JQL.

        Returns:
            Dict with 'issues' list and pagination info
        """
        # Use new /search/jql endpoint (old /search deprecated as of 2024)
        params = {
            "jql": jql,
            "maxResults": max_results,
        }
        if fields:
            params["fields"] = ",".join(fields)

        return await self._request("GET", "/search/jql", params=params)

    async def get_issue(self, issue_key: str) -> Dict[str, Any]:
        """Get a single issue by key."""
        return await self._request("GET", f"/issue/{issue_key}")

    async def create_issue(
        self,
        summary: str,
        project: str = None,
        issue_type: str = "Task",
        description: str = None,
        labels: List[str] = None,
        priority: str = None,
    ) -> Dict[str, Any]:
        """Create a new issue."""
        project_key = project or self.credentials.default_project

        fields = {
            "project": {"key": project_key},
            "summary": summary,
            "issuetype": {"name": issue_type},
        }

        if description:
            # Use Atlassian Document Format
            fields["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": description}]
                    }
                ]
            }

        if labels:
            fields["labels"] = labels

        if priority:
            fields["priority"] = {"name": priority}

        return await self._request("POST", "/issue", json_data={"fields": fields})

    async def update_issue(
        self,
        issue_key: str,
        summary: str = None,
        description: str = None,
        labels: List[str] = None,
        priority: str = None,
    ) -> Dict[str, Any]:
        """Update an existing issue."""
        fields = {}

        if summary:
            fields["summary"] = summary
        if description:
            fields["description"] = {
                "type": "doc",
                "version": 1,
                "content": [
                    {
                        "type": "paragraph",
                        "content": [{"type": "text", "text": description}]
                    }
                ]
            }
        if labels is not None:
            fields["labels"] = labels
        if priority:
            fields["priority"] = {"name": priority}

        return await self._request("PUT", f"/issue/{issue_key}", json_data={"fields": fields})

    async def get_transitions(self, issue_key: str) -> List[Dict[str, Any]]:
        """Get available transitions for an issue."""
        result = await self._request("GET", f"/issue/{issue_key}/transitions")
        return result.get("transitions", [])

    async def transition_issue(self, issue_key: str, transition_name: str) -> None:
        """Transition an issue to a new status."""
        # First get available transitions
        transitions = await self.get_transitions(issue_key)

        # Find matching transition
        transition_id = None
        for t in transitions:
            if t.get("name", "").lower() == transition_name.lower():
                transition_id = t.get("id")
                break

        if not transition_id:
            available = [t.get("name") for t in transitions]
            raise ValueError(f"Transition '{transition_name}' not found. Available: {available}")

        await self._request(
            "POST",
            f"/issue/{issue_key}/transitions",
            json_data={"transition": {"id": transition_id}}
        )

    async def add_comment(self, issue_key: str, body: str) -> Dict[str, Any]:
        """Add a comment to an issue."""
        return await self._request(
            "POST",
            f"/issue/{issue_key}/comment",
            json_data={
                "body": {
                    "type": "doc",
                    "version": 1,
                    "content": [
                        {
                            "type": "paragraph",
                            "content": [{"type": "text", "text": body}]
                        }
                    ]
                }
            }
        )

    # ==================== Context Manager ====================

    async def __aenter__(self) -> "DirectJiraClient":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.disconnect()


# Convenience function
async def get_jira_client() -> DirectJiraClient:
    """Get a connected JIRA client."""
    client = DirectJiraClient()
    await client.connect()
    return client
