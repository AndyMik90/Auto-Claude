"""
GitLab API Client
==================

Async HTTP client for GitLab API v4.
Supports both OAuth tokens and Personal Access Tokens.

Usage:
    client = GitLabClient(config, user_id="user@example.com")
    await client.connect()

    issues = await client.list_issues()
    mr = await client.create_merge_request(source_branch="feature", title="New feature")
"""

import httpx
from typing import Any, Dict, List, Optional
from dataclasses import dataclass
import logging
import urllib.parse

from .config import GitLabConfig
from .oauth import GitLabOAuth, PersonalAccessTokenAuth, OAuthToken

logger = logging.getLogger(__name__)


class GitLabAPIError(Exception):
    """Error from GitLab API."""

    def __init__(self, status_code: int, message: str, response: Dict = None):
        self.status_code = status_code
        self.message = message
        self.response = response or {}
        super().__init__(f"GitLab API Error {status_code}: {message}")


class GitLabClient:
    """
    Async GitLab API client.

    Handles authentication via OAuth or PAT, automatic token refresh,
    and provides typed methods for common GitLab operations.
    """

    def __init__(
        self,
        config: GitLabConfig,
        user_id: str = None,
        oauth: GitLabOAuth = None,
    ):
        """
        Initialize GitLab client.

        Args:
            config: GitLab configuration
            user_id: User identifier (for OAuth token lookup)
            oauth: OAuth handler (optional, created from config if not provided)
        """
        self.config = config
        self.user_id = user_id or "default"
        self._oauth = oauth
        self._token: Optional[OAuthToken] = None
        self._http: Optional[httpx.AsyncClient] = None

    async def connect(self) -> None:
        """Initialize HTTP client and verify authentication."""
        if self._http is not None:
            return

        # Get authentication token
        if self.config.use_oauth and self.config.client_id:
            if self._oauth is None:
                self._oauth = GitLabOAuth(
                    gitlab_url=self.config.url,
                    client_id=self.config.client_id,
                    client_secret=self.config.client_secret,
                    redirect_uri=self.config.redirect_uri,
                )
            self._token = await self._oauth.get_valid_token(self.user_id)
        elif self.config.personal_token:
            pat_auth = PersonalAccessTokenAuth(
                gitlab_url=self.config.url,
                token=self.config.personal_token,
                user_id=self.user_id,
            )
            self._token = pat_auth.get_token()

        if not self._token:
            raise GitLabAPIError(401, "No valid authentication token")

        # Create HTTP client
        self._http = httpx.AsyncClient(
            base_url=self.config.api_url,
            headers={
                "Authorization": f"Bearer {self._token.access_token}",
                "Content-Type": "application/json",
            },
            timeout=30.0,
        )

        # Verify connection
        try:
            user = await self.get_current_user()
            logger.info(f"Connected to GitLab as {user.get('username', 'unknown')}")
        except Exception as e:
            await self.disconnect()
            raise GitLabAPIError(401, f"Authentication failed: {e}")

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
        json: Dict = None,
    ) -> Any:
        """Make an API request."""
        if not self._http:
            await self.connect()

        try:
            response = await self._http.request(
                method=method,
                url=path,
                params=params,
                json=json,
            )

            if response.status_code == 401:
                # Try to refresh token
                if self._oauth and self._token:
                    new_token = await self._oauth.refresh_token(self.user_id)
                    if new_token:
                        self._token = new_token
                        self._http.headers["Authorization"] = f"Bearer {new_token.access_token}"
                        response = await self._http.request(
                            method=method,
                            url=path,
                            params=params,
                            json=json,
                        )

            if response.status_code >= 400:
                error_body = response.json() if response.content else {}
                raise GitLabAPIError(
                    response.status_code,
                    error_body.get("message", response.text),
                    error_body,
                )

            if response.status_code == 204:
                return None

            return response.json()

        except httpx.HTTPError as e:
            raise GitLabAPIError(-1, str(e))

    def _encode_project_id(self, project_id: str = None) -> str:
        """URL-encode project ID for API paths."""
        pid = project_id or self.config.project_id
        return urllib.parse.quote(pid, safe="")

    # ==================== User ====================

    async def get_current_user(self) -> Dict[str, Any]:
        """Get current authenticated user."""
        return await self._request("GET", "/user")

    # ==================== Projects ====================

    async def get_project(self, project_id: str = None) -> Dict[str, Any]:
        """Get project details."""
        pid = self._encode_project_id(project_id)
        return await self._request("GET", f"/projects/{pid}")

    async def list_project_members(
        self,
        project_id: str = None,
        query: str = None,
    ) -> List[Dict[str, Any]]:
        """List project members."""
        pid = self._encode_project_id(project_id)
        params = {}
        if query:
            params["query"] = query
        return await self._request("GET", f"/projects/{pid}/members", params=params)

    # ==================== Issues ====================

    async def list_issues(
        self,
        project_id: str = None,
        state: str = "opened",
        labels: List[str] = None,
        search: str = None,
        per_page: int = 20,
        page: int = 1,
    ) -> List[Dict[str, Any]]:
        """
        List project issues.

        Args:
            project_id: Project ID or path
            state: opened, closed, or all
            labels: Filter by labels
            search: Search in title and description
            per_page: Results per page
            page: Page number
        """
        pid = self._encode_project_id(project_id)
        params = {
            "state": state,
            "per_page": per_page,
            "page": page,
        }
        if labels:
            params["labels"] = ",".join(labels)
        if search:
            params["search"] = search

        return await self._request("GET", f"/projects/{pid}/issues", params=params)

    async def get_issue(
        self,
        issue_iid: int,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Get a single issue by IID."""
        pid = self._encode_project_id(project_id)
        return await self._request("GET", f"/projects/{pid}/issues/{issue_iid}")

    async def create_issue(
        self,
        title: str,
        description: str = "",
        labels: List[str] = None,
        weight: int = None,
        assignee_ids: List[int] = None,
        milestone_id: int = None,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """
        Create a new issue.

        Returns:
            Created issue with iid field
        """
        pid = self._encode_project_id(project_id)

        data = {
            "title": title,
            "description": description,
        }
        if labels:
            data["labels"] = ",".join(labels)
        if weight is not None:
            data["weight"] = weight
        if assignee_ids:
            data["assignee_ids"] = assignee_ids
        if milestone_id:
            data["milestone_id"] = milestone_id

        return await self._request("POST", f"/projects/{pid}/issues", json=data)

    async def update_issue(
        self,
        issue_iid: int,
        title: str = None,
        description: str = None,
        labels: List[str] = None,
        state_event: str = None,  # "close" or "reopen"
        weight: int = None,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Update an existing issue."""
        pid = self._encode_project_id(project_id)

        data = {}
        if title:
            data["title"] = title
        if description:
            data["description"] = description
        if labels is not None:
            data["labels"] = ",".join(labels)
        if state_event:
            data["state_event"] = state_event
        if weight is not None:
            data["weight"] = weight

        return await self._request("PUT", f"/projects/{pid}/issues/{issue_iid}", json=data)

    async def close_issue(
        self,
        issue_iid: int,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Close an issue."""
        return await self.update_issue(issue_iid, state_event="close", project_id=project_id)

    async def reopen_issue(
        self,
        issue_iid: int,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Reopen an issue."""
        return await self.update_issue(issue_iid, state_event="reopen", project_id=project_id)

    async def add_issue_note(
        self,
        issue_iid: int,
        body: str,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Add a note (comment) to an issue."""
        pid = self._encode_project_id(project_id)
        return await self._request(
            "POST",
            f"/projects/{pid}/issues/{issue_iid}/notes",
            json={"body": body}
        )

    async def add_issue_labels(
        self,
        issue_iid: int,
        labels: List[str],
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Add labels to an issue."""
        pid = self._encode_project_id(project_id)
        issue = await self.get_issue(issue_iid, project_id)
        existing_labels = issue.get("labels", [])
        all_labels = list(set(existing_labels + labels))
        return await self.update_issue(issue_iid, labels=all_labels, project_id=project_id)

    # ==================== Merge Requests ====================

    async def list_merge_requests(
        self,
        project_id: str = None,
        state: str = "opened",
        source_branch: str = None,
        target_branch: str = None,
        per_page: int = 20,
    ) -> List[Dict[str, Any]]:
        """List merge requests."""
        pid = self._encode_project_id(project_id)
        params = {
            "state": state,
            "per_page": per_page,
        }
        if source_branch:
            params["source_branch"] = source_branch
        if target_branch:
            params["target_branch"] = target_branch

        return await self._request("GET", f"/projects/{pid}/merge_requests", params=params)

    async def get_merge_request(
        self,
        mr_iid: int,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Get a single merge request."""
        pid = self._encode_project_id(project_id)
        return await self._request("GET", f"/projects/{pid}/merge_requests/{mr_iid}")

    async def create_merge_request(
        self,
        source_branch: str,
        title: str,
        target_branch: str = None,
        description: str = "",
        labels: List[str] = None,
        remove_source_branch: bool = True,
        squash: bool = False,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """
        Create a new merge request.

        Args:
            source_branch: Source branch name
            title: MR title
            target_branch: Target branch (defaults to config default_branch)
            description: MR description
            labels: Labels to add
            remove_source_branch: Delete source after merge
            squash: Squash commits on merge
        """
        pid = self._encode_project_id(project_id)

        data = {
            "source_branch": source_branch,
            "target_branch": target_branch or self.config.default_branch,
            "title": title,
            "description": description,
            "remove_source_branch": remove_source_branch,
            "squash": squash,
        }
        if labels:
            data["labels"] = ",".join(labels)

        return await self._request("POST", f"/projects/{pid}/merge_requests", json=data)

    async def update_merge_request(
        self,
        mr_iid: int,
        title: str = None,
        description: str = None,
        labels: List[str] = None,
        state_event: str = None,  # "close" or "reopen"
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Update a merge request."""
        pid = self._encode_project_id(project_id)

        data = {}
        if title:
            data["title"] = title
        if description:
            data["description"] = description
        if labels is not None:
            data["labels"] = ",".join(labels)
        if state_event:
            data["state_event"] = state_event

        return await self._request("PUT", f"/projects/{pid}/merge_requests/{mr_iid}", json=data)

    async def merge_merge_request(
        self,
        mr_iid: int,
        merge_commit_message: str = None,
        squash: bool = False,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Merge a merge request."""
        pid = self._encode_project_id(project_id)

        data = {"squash": squash}
        if merge_commit_message:
            data["merge_commit_message"] = merge_commit_message

        return await self._request("PUT", f"/projects/{pid}/merge_requests/{mr_iid}/merge", json=data)

    async def add_mr_note(
        self,
        mr_iid: int,
        body: str,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Add a note (comment) to a merge request."""
        pid = self._encode_project_id(project_id)
        return await self._request(
            "POST",
            f"/projects/{pid}/merge_requests/{mr_iid}/notes",
            json={"body": body}
        )

    # ==================== Branches ====================

    async def list_branches(
        self,
        project_id: str = None,
        search: str = None,
    ) -> List[Dict[str, Any]]:
        """List repository branches."""
        pid = self._encode_project_id(project_id)
        params = {}
        if search:
            params["search"] = search
        return await self._request("GET", f"/projects/{pid}/repository/branches", params=params)

    async def get_branch(
        self,
        branch_name: str,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Get a branch."""
        pid = self._encode_project_id(project_id)
        branch = urllib.parse.quote(branch_name, safe="")
        return await self._request("GET", f"/projects/{pid}/repository/branches/{branch}")

    async def create_branch(
        self,
        branch_name: str,
        ref: str = None,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Create a new branch."""
        pid = self._encode_project_id(project_id)
        return await self._request(
            "POST",
            f"/projects/{pid}/repository/branches",
            json={
                "branch": branch_name,
                "ref": ref or self.config.default_branch,
            }
        )

    async def delete_branch(
        self,
        branch_name: str,
        project_id: str = None,
    ) -> None:
        """Delete a branch."""
        pid = self._encode_project_id(project_id)
        branch = urllib.parse.quote(branch_name, safe="")
        await self._request("DELETE", f"/projects/{pid}/repository/branches/{branch}")

    # ==================== Labels ====================

    async def list_labels(
        self,
        project_id: str = None,
    ) -> List[Dict[str, Any]]:
        """List project labels."""
        pid = self._encode_project_id(project_id)
        return await self._request("GET", f"/projects/{pid}/labels")

    async def create_label(
        self,
        name: str,
        color: str = "#428BCA",
        description: str = "",
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Create a project label."""
        pid = self._encode_project_id(project_id)
        return await self._request(
            "POST",
            f"/projects/{pid}/labels",
            json={
                "name": name,
                "color": color,
                "description": description,
            }
        )

    # ==================== Pipelines ====================

    async def list_pipelines(
        self,
        project_id: str = None,
        ref: str = None,
        status: str = None,
        per_page: int = 20,
    ) -> List[Dict[str, Any]]:
        """List project pipelines."""
        pid = self._encode_project_id(project_id)
        params = {"per_page": per_page}
        if ref:
            params["ref"] = ref
        if status:
            params["status"] = status
        return await self._request("GET", f"/projects/{pid}/pipelines", params=params)

    async def get_pipeline(
        self,
        pipeline_id: int,
        project_id: str = None,
    ) -> Dict[str, Any]:
        """Get pipeline details."""
        pid = self._encode_project_id(project_id)
        return await self._request("GET", f"/projects/{pid}/pipelines/{pipeline_id}")

    # ==================== Context Manager ====================

    async def __aenter__(self) -> "GitLabClient":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.disconnect()
