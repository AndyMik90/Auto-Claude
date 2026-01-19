"""
Gitea REST API Client
=====================

Async HTTP client for Gitea REST API with:
- Configurable timeouts (default 30s, 60s for large operations)
- Exponential backoff retry (3 attempts: 1s, 2s, 4s)
- Token-based authentication
- Rate limiting handling for 429 responses
- Connection pooling via httpx.AsyncClient

This enables Auto Claude to work with self-hosted Gitea instances.
"""

from __future__ import annotations

import asyncio
import logging
import os
from dataclasses import dataclass
from typing import Any

logger = logging.getLogger(__name__)


class GiteaTimeoutError(Exception):
    """Raised when Gitea API request times out after all retry attempts."""

    pass


class GiteaAPIError(Exception):
    """Raised when Gitea API returns an error response."""

    def __init__(self, message: str, status_code: int = 0, response_body: str = ""):
        super().__init__(message)
        self.status_code = status_code
        self.response_body = response_body


class GiteaRateLimitError(Exception):
    """Raised when Gitea API rate limit is exceeded."""

    pass


class GiteaAuthenticationError(Exception):
    """Raised when Gitea API authentication fails."""

    pass


@dataclass
class GiteaRequestResult:
    """Result of a Gitea API request."""

    data: Any
    status_code: int
    headers: dict[str, str]
    attempts: int
    total_time: float


class GiteaClient:
    """
    Async client for Gitea REST API with timeout and retry protection.

    Usage:
        client = GiteaClient(
            base_url="https://gitea.example.com",
            token="your-personal-access-token",
        )

        # Get a PR
        pr_data = await client.get_pr("owner", "repo", 123)

        # Get PR diff
        diff = await client.get_pr_diff("owner", "repo", 123)

        # List issues
        issues = await client.list_issues("owner", "repo", state="open")

    Environment Variables:
        GITEA_URL: Base URL of the Gitea instance
        GITEA_TOKEN: Personal access token for authentication
    """

    def __init__(
        self,
        base_url: str | None = None,
        token: str | None = None,
        default_timeout: float = 30.0,
        max_retries: int = 3,
        enable_rate_limiting: bool = True,
    ):
        """
        Initialize Gitea API client.

        Args:
            base_url: Base URL of Gitea instance (e.g., https://gitea.example.com).
                      Falls back to GITEA_URL environment variable.
            token: Personal access token for authentication.
                   Falls back to GITEA_TOKEN environment variable.
            default_timeout: Default timeout in seconds for requests (default: 30.0)
            max_retries: Maximum number of retry attempts (default: 3)
            enable_rate_limiting: Whether to handle rate limiting (default: True)
        """
        self._base_url = self._normalize_url(base_url or os.getenv("GITEA_URL", ""))
        self._token = token or os.getenv("GITEA_TOKEN", "")
        self.default_timeout = default_timeout
        self.max_retries = max_retries
        self.enable_rate_limiting = enable_rate_limiting

        # httpx client will be created lazily for connection pooling
        self._client = None

        # Validate configuration
        if not self._base_url:
            logger.warning(
                "Gitea base URL not configured. Set GITEA_URL environment variable."
            )
        if not self._token:
            logger.warning(
                "Gitea token not configured. Set GITEA_TOKEN environment variable."
            )

    def _normalize_url(self, url: str) -> str:
        """
        Normalize the base URL for consistent API calls.

        Handles:
        - Trailing slashes
        - /api/v1 suffix
        - Protocol validation

        Args:
            url: The URL to normalize

        Returns:
            Normalized base URL without trailing slash or /api/v1 suffix
        """
        if not url:
            return ""

        # Strip trailing slashes
        url = url.rstrip("/")

        # Remove /api/v1 suffix if present (we'll add it in _build_url)
        if url.endswith("/api/v1"):
            url = url[:-7]

        return url

    def _build_url(self, endpoint: str) -> str:
        """
        Build full API URL from endpoint.

        Args:
            endpoint: API endpoint (e.g., "/repos/owner/repo/pulls/1")

        Returns:
            Full URL with base URL and /api/v1 prefix
        """
        # Ensure endpoint starts with /
        if not endpoint.startswith("/"):
            endpoint = f"/{endpoint}"

        return f"{self._base_url}/api/v1{endpoint}"

    def _get_headers(self) -> dict[str, str]:
        """
        Get request headers with authentication.

        Returns:
            Headers dict with Authorization and Content-Type
        """
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
        }

        if self._token:
            # Gitea uses "token" instead of "Bearer" for personal access tokens
            headers["Authorization"] = f"token {self._token}"

        return headers

    async def _get_client(self):
        """
        Get or create the httpx async client.

        Returns:
            httpx.AsyncClient instance with connection pooling
        """
        if self._client is None:
            import httpx

            self._client = httpx.AsyncClient(
                headers=self._get_headers(),
                timeout=httpx.Timeout(self.default_timeout),
                follow_redirects=True,
            )
        return self._client

    async def close(self) -> None:
        """Close the HTTP client connection pool."""
        if self._client is not None:
            await self._client.aclose()
            self._client = None

    async def _request(
        self,
        method: str,
        endpoint: str,
        params: dict[str, Any] | None = None,
        json_data: dict[str, Any] | None = None,
        timeout: float | None = None,
        raw_response: bool = False,
    ) -> GiteaRequestResult:
        """
        Make an HTTP request to the Gitea API with retry logic.

        Args:
            method: HTTP method (GET, POST, PUT, PATCH, DELETE)
            endpoint: API endpoint
            params: Query parameters
            json_data: JSON body for POST/PUT/PATCH requests
            timeout: Request timeout (uses default if None)
            raw_response: If True, return raw response text instead of JSON

        Returns:
            GiteaRequestResult with response data and metadata

        Raises:
            GiteaTimeoutError: If request times out after all retries
            GiteaAPIError: If API returns an error response
            GiteaRateLimitError: If rate limit is exceeded
            GiteaAuthenticationError: If authentication fails
        """
        import httpx

        timeout = timeout or self.default_timeout
        url = self._build_url(endpoint)
        start_time = asyncio.get_event_loop().time()

        client = await self._get_client()

        for attempt in range(1, self.max_retries + 1):
            try:
                logger.debug(
                    f"Gitea API request (attempt {attempt}/{self.max_retries}): "
                    f"{method} {url}"
                )

                try:
                    response = await asyncio.wait_for(
                        client.request(
                            method=method,
                            url=url,
                            params=params,
                            json=json_data,
                            timeout=timeout,
                        ),
                        timeout=timeout + 5,  # Extra buffer for wait_for
                    )
                except asyncio.TimeoutError:
                    # Request timed out
                    backoff_delay = 2 ** (attempt - 1)
                    logger.warning(
                        f"Gitea API {method} {endpoint} timed out after {timeout}s "
                        f"(attempt {attempt}/{self.max_retries})"
                    )

                    if attempt < self.max_retries:
                        logger.info(f"Retrying in {backoff_delay}s...")
                        await asyncio.sleep(backoff_delay)
                        continue
                    else:
                        total_time = asyncio.get_event_loop().time() - start_time
                        raise GiteaTimeoutError(
                            f"Gitea API {method} {endpoint} timed out after "
                            f"{self.max_retries} attempts ({timeout}s each, "
                            f"{total_time:.1f}s total)"
                        )

                total_time = asyncio.get_event_loop().time() - start_time

                # Handle response based on status code
                if response.status_code == 401:
                    raise GiteaAuthenticationError(
                        f"Authentication failed. Check your GITEA_TOKEN. "
                        f"Response: {response.text}"
                    )

                if response.status_code == 403:
                    raise GiteaAuthenticationError(
                        f"Access forbidden. Token may lack required permissions. "
                        f"Response: {response.text}"
                    )

                if response.status_code == 429:
                    # Rate limited
                    if self.enable_rate_limiting:
                        retry_after = int(response.headers.get("Retry-After", "60"))
                        logger.warning(
                            f"Rate limited by Gitea. Retry after {retry_after}s"
                        )

                        if attempt < self.max_retries:
                            # Wait for rate limit to reset (capped at 60s)
                            wait_time = min(retry_after, 60)
                            logger.info(f"Waiting {wait_time}s for rate limit...")
                            await asyncio.sleep(wait_time)
                            continue

                    raise GiteaRateLimitError(
                        f"Gitea API rate limit exceeded. "
                        f"Retry-After: {response.headers.get('Retry-After', 'unknown')}"
                    )

                if response.status_code >= 400:
                    # Other error responses
                    error_body = response.text
                    raise GiteaAPIError(
                        f"Gitea API error: {response.status_code} - {error_body}",
                        status_code=response.status_code,
                        response_body=error_body,
                    )

                # Success
                logger.debug(
                    f"Gitea API {method} {endpoint} completed "
                    f"(attempt {attempt}, {total_time:.2f}s)"
                )

                # Parse response
                if raw_response:
                    data = response.text
                elif response.status_code == 204:  # No content
                    data = None
                else:
                    try:
                        data = response.json()
                    except Exception:
                        data = response.text

                return GiteaRequestResult(
                    data=data,
                    status_code=response.status_code,
                    headers=dict(response.headers),
                    attempts=attempt,
                    total_time=total_time,
                )

            except (
                GiteaTimeoutError,
                GiteaAPIError,
                GiteaRateLimitError,
                GiteaAuthenticationError,
            ):
                # Re-raise our custom exceptions
                raise
            except httpx.ConnectError as e:
                # Connection error - retry
                backoff_delay = 2 ** (attempt - 1)
                logger.warning(
                    f"Connection error to Gitea: {e} "
                    f"(attempt {attempt}/{self.max_retries})"
                )

                if attempt < self.max_retries:
                    logger.info(f"Retrying in {backoff_delay}s...")
                    await asyncio.sleep(backoff_delay)
                    continue
                else:
                    raise GiteaAPIError(
                        f"Failed to connect to Gitea after {self.max_retries} attempts: {e}"
                    )
            except Exception as e:
                # Unexpected error
                logger.error(f"Unexpected error in Gitea API request: {e}")
                if attempt == self.max_retries:
                    raise GiteaAPIError(f"Gitea API request failed: {str(e)}")
                else:
                    backoff_delay = 2 ** (attempt - 1)
                    logger.info(f"Retrying in {backoff_delay}s after error...")
                    await asyncio.sleep(backoff_delay)
                    continue

        # Should never reach here
        raise GiteaAPIError(f"Gitea API request failed after {self.max_retries} attempts")

    # =========================================================================
    # HTTP Method Helpers
    # =========================================================================

    async def get(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
        timeout: float | None = None,
        raw_response: bool = False,
    ) -> Any:
        """
        Make a GET request to the Gitea API.

        Args:
            endpoint: API endpoint
            params: Query parameters
            timeout: Request timeout
            raw_response: Return raw text instead of JSON

        Returns:
            API response data
        """
        result = await self._request(
            method="GET",
            endpoint=endpoint,
            params=params,
            timeout=timeout,
            raw_response=raw_response,
        )
        return result.data

    async def post(
        self,
        endpoint: str,
        data: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make a POST request to the Gitea API.

        Args:
            endpoint: API endpoint
            data: JSON body
            timeout: Request timeout

        Returns:
            API response data
        """
        result = await self._request(
            method="POST",
            endpoint=endpoint,
            json_data=data,
            timeout=timeout,
        )
        return result.data

    async def put(
        self,
        endpoint: str,
        data: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make a PUT request to the Gitea API.

        Args:
            endpoint: API endpoint
            data: JSON body
            timeout: Request timeout

        Returns:
            API response data
        """
        result = await self._request(
            method="PUT",
            endpoint=endpoint,
            json_data=data,
            timeout=timeout,
        )
        return result.data

    async def patch(
        self,
        endpoint: str,
        data: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make a PATCH request to the Gitea API.

        Args:
            endpoint: API endpoint
            data: JSON body
            timeout: Request timeout

        Returns:
            API response data
        """
        result = await self._request(
            method="PATCH",
            endpoint=endpoint,
            json_data=data,
            timeout=timeout,
        )
        return result.data

    async def delete(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
        timeout: float | None = None,
    ) -> Any:
        """
        Make a DELETE request to the Gitea API.

        Args:
            endpoint: API endpoint
            params: Query parameters
            timeout: Request timeout

        Returns:
            API response data (usually None for DELETE)
        """
        result = await self._request(
            method="DELETE",
            endpoint=endpoint,
            params=params,
            timeout=timeout,
        )
        return result.data

    # =========================================================================
    # Connection Management
    # =========================================================================

    @property
    def base_url(self) -> str:
        """Get the configured base URL."""
        return self._base_url

    @property
    def is_configured(self) -> bool:
        """Check if the client is properly configured."""
        return bool(self._base_url and self._token)

    async def verify_connection(self) -> bool:
        """
        Verify the connection and authentication to Gitea.

        Returns:
            True if connection is successful and authenticated

        Raises:
            GiteaAuthenticationError: If authentication fails
            GiteaAPIError: If connection fails
        """
        if not self.is_configured:
            raise GiteaAPIError(
                "Gitea client not configured. "
                "Set GITEA_URL and GITEA_TOKEN environment variables."
            )

        try:
            # Try to get the authenticated user
            await self.get("/user")
            return True
        except GiteaAuthenticationError:
            raise
        except Exception as e:
            raise GiteaAPIError(f"Failed to verify Gitea connection: {e}")

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit - close the client."""
        await self.close()

    # =========================================================================
    # Pull Request Operations
    # =========================================================================

    async def get_pr(
        self,
        owner: str,
        repo: str,
        index: int,
    ) -> dict[str, Any]:
        """
        Get a pull request by index.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index (Gitea uses index, not number)

        Returns:
            PR data dictionary
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}"
        return await self.get(endpoint)

    async def list_prs(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        sort: str = "recentupdate",
        labels: list[str] | None = None,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        List pull requests.

        Args:
            owner: Repository owner
            repo: Repository name
            state: PR state (open, closed, all)
            sort: Sort by (oldest, recentupdate, leastupdate, mostcomment, leastcomment, priority)
            labels: Filter by labels
            page: Page number (1-indexed)
            limit: Number of items per page

        Returns:
            List of PR data dictionaries
        """
        endpoint = f"/repos/{owner}/{repo}/pulls"
        params: dict[str, Any] = {
            "state": state,
            "sort": sort,
            "page": page,
            "limit": limit,
        }

        if labels:
            params["labels"] = ",".join(labels)

        return await self.get(endpoint, params=params)

    async def get_pr_diff(
        self,
        owner: str,
        repo: str,
        index: int,
    ) -> str:
        """
        Get PR diff in unified format.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index

        Returns:
            Unified diff string
        """
        # Gitea returns diff when .diff is appended to the PR URL
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}.diff"
        return await self.get(endpoint, raw_response=True, timeout=60.0)

    async def get_pr_files(
        self,
        owner: str,
        repo: str,
        index: int,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Get files changed in a PR.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index
            page: Page number
            limit: Items per page

        Returns:
            List of file change objects with filename, status, additions, deletions, etc.
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}/files"
        params = {"page": page, "limit": limit}
        return await self.get(endpoint, params=params)

    async def create_review(
        self,
        owner: str,
        repo: str,
        index: int,
        body: str,
        event: str = "COMMENT",
        comments: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        """
        Create a review on a pull request.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index
            body: Review body text
            event: Review event (APPROVE, REQUEST_CHANGES, COMMENT)
            comments: Optional inline comments list

        Returns:
            Created review data
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}/reviews"
        data: dict[str, Any] = {
            "body": body,
            "event": event.upper(),
        }

        if comments:
            data["comments"] = comments

        return await self.post(endpoint, data=data)

    async def merge_pr(
        self,
        owner: str,
        repo: str,
        index: int,
        merge_style: str = "merge",
        title: str | None = None,
        message: str | None = None,
        delete_branch: bool = False,
    ) -> dict[str, Any]:
        """
        Merge a pull request.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index
            merge_style: Merge style (merge, rebase, rebase-merge, squash, fast-forward-only)
            title: Optional commit title (for squash)
            message: Optional commit message
            delete_branch: Whether to delete the source branch after merge

        Returns:
            Merge result data
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}/merge"
        data: dict[str, Any] = {
            "Do": merge_style,
            "delete_branch_after_merge": delete_branch,
        }

        if title:
            data["MergeTitleField"] = title
        if message:
            data["MergeMessageField"] = message

        return await self.post(endpoint, data=data)

    async def close_pr(
        self,
        owner: str,
        repo: str,
        index: int,
    ) -> dict[str, Any]:
        """
        Close a pull request without merging.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index

        Returns:
            Updated PR data
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}"
        data = {"state": "closed"}
        return await self.patch(endpoint, data=data)

    async def get_pr_commits(
        self,
        owner: str,
        repo: str,
        index: int,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        Get commits in a pull request.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index
            page: Page number
            limit: Items per page

        Returns:
            List of commit objects
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}/commits"
        params = {"page": page, "limit": limit}
        return await self.get(endpoint, params=params)

    # =========================================================================
    # Issue Operations
    # =========================================================================

    async def get_issue(
        self,
        owner: str,
        repo: str,
        index: int,
    ) -> dict[str, Any]:
        """
        Get an issue by index.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue index

        Returns:
            Issue data dictionary
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}"
        return await self.get(endpoint)

    async def list_issues(
        self,
        owner: str,
        repo: str,
        state: str = "open",
        labels: list[str] | None = None,
        milestone: str | None = None,
        assignee: str | None = None,
        mentioned: str | None = None,
        page: int = 1,
        limit: int = 100,
        include_prs: bool = False,
    ) -> list[dict[str, Any]]:
        """
        List issues.

        Args:
            owner: Repository owner
            repo: Repository name
            state: Issue state (open, closed, all)
            labels: Filter by labels
            milestone: Filter by milestone name
            assignee: Filter by assignee username
            mentioned: Filter by mentioned username
            page: Page number
            limit: Items per page
            include_prs: Whether to include pull requests (Gitea treats PRs as issues)

        Returns:
            List of issue data dictionaries
        """
        endpoint = f"/repos/{owner}/{repo}/issues"
        params: dict[str, Any] = {
            "state": state,
            "page": page,
            "limit": limit,
            "type": "issues" if not include_prs else "all",
        }

        if labels:
            params["labels"] = ",".join(labels)
        if milestone:
            params["milestone"] = milestone
        if assignee:
            params["assignee"] = assignee
        if mentioned:
            params["mentioned"] = mentioned

        return await self.get(endpoint, params=params)

    async def create_issue(
        self,
        owner: str,
        repo: str,
        title: str,
        body: str = "",
        labels: list[int] | None = None,
        assignees: list[str] | None = None,
        milestone: int | None = None,
    ) -> dict[str, Any]:
        """
        Create a new issue.

        Args:
            owner: Repository owner
            repo: Repository name
            title: Issue title
            body: Issue body
            labels: List of label IDs to apply
            assignees: List of usernames to assign
            milestone: Milestone ID

        Returns:
            Created issue data
        """
        endpoint = f"/repos/{owner}/{repo}/issues"
        data: dict[str, Any] = {
            "title": title,
            "body": body,
        }

        if labels:
            data["labels"] = labels
        if assignees:
            data["assignees"] = assignees
        if milestone is not None:
            data["milestone"] = milestone

        return await self.post(endpoint, data=data)

    async def close_issue(
        self,
        owner: str,
        repo: str,
        index: int,
    ) -> dict[str, Any]:
        """
        Close an issue.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue index

        Returns:
            Updated issue data
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}"
        data = {"state": "closed"}
        return await self.patch(endpoint, data=data)

    async def add_comment(
        self,
        owner: str,
        repo: str,
        index: int,
        body: str,
    ) -> dict[str, Any]:
        """
        Add a comment to an issue or PR.

        Note: In Gitea, PRs and issues share the same comment API.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue/PR index
            body: Comment body

        Returns:
            Created comment data
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}/comments"
        data = {"body": body}
        return await self.post(endpoint, data=data)

    async def list_comments(
        self,
        owner: str,
        repo: str,
        index: int,
        since: str | None = None,
        before: str | None = None,
    ) -> list[dict[str, Any]]:
        """
        List comments on an issue or PR.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue/PR index
            since: Only comments after this time (ISO 8601 format)
            before: Only comments before this time (ISO 8601 format)

        Returns:
            List of comment data
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}/comments"
        params: dict[str, Any] = {}

        if since:
            params["since"] = since
        if before:
            params["before"] = before

        return await self.get(endpoint, params=params if params else None)

    # =========================================================================
    # Label Operations
    # =========================================================================

    async def get_labels(
        self,
        owner: str,
        repo: str,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        List all labels in a repository.

        Args:
            owner: Repository owner
            repo: Repository name
            page: Page number
            limit: Items per page

        Returns:
            List of label data
        """
        endpoint = f"/repos/{owner}/{repo}/labels"
        params = {"page": page, "limit": limit}
        return await self.get(endpoint, params=params)

    async def get_issue_labels(
        self,
        owner: str,
        repo: str,
        index: int,
    ) -> list[dict[str, Any]]:
        """
        Get labels on an issue or PR.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue/PR index

        Returns:
            List of label data
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}/labels"
        return await self.get(endpoint)

    async def add_labels(
        self,
        owner: str,
        repo: str,
        index: int,
        labels: list[int],
    ) -> list[dict[str, Any]]:
        """
        Add labels to an issue or PR.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue/PR index
            labels: List of label IDs to add

        Returns:
            Updated list of labels on the issue
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}/labels"
        data = {"labels": labels}
        return await self.post(endpoint, data=data)

    async def replace_labels(
        self,
        owner: str,
        repo: str,
        index: int,
        labels: list[int],
    ) -> list[dict[str, Any]]:
        """
        Replace all labels on an issue or PR.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue/PR index
            labels: List of label IDs to set

        Returns:
            Updated list of labels
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}/labels"
        data = {"labels": labels}
        return await self.put(endpoint, data=data)

    async def remove_label(
        self,
        owner: str,
        repo: str,
        index: int,
        label_id: int,
    ) -> None:
        """
        Remove a label from an issue or PR.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue/PR index
            label_id: Label ID to remove
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}/labels/{label_id}"
        await self.delete(endpoint)

    async def clear_labels(
        self,
        owner: str,
        repo: str,
        index: int,
    ) -> None:
        """
        Clear all labels from an issue or PR.

        Args:
            owner: Repository owner
            repo: Repository name
            index: Issue/PR index
        """
        endpoint = f"/repos/{owner}/{repo}/issues/{index}/labels"
        await self.delete(endpoint)

    async def create_label(
        self,
        owner: str,
        repo: str,
        name: str,
        color: str,
        description: str = "",
        exclusive: bool = False,
    ) -> dict[str, Any]:
        """
        Create a new label in a repository.

        Args:
            owner: Repository owner
            repo: Repository name
            name: Label name
            color: Color hex code (without #)
            description: Label description
            exclusive: Whether this label is exclusive (can only be applied once per issue)

        Returns:
            Created label data
        """
        endpoint = f"/repos/{owner}/{repo}/labels"
        data: dict[str, Any] = {
            "name": name,
            "color": color.lstrip("#"),  # Gitea expects color without #
            "description": description,
            "exclusive": exclusive,
        }
        return await self.post(endpoint, data=data)

    async def get_label(
        self,
        owner: str,
        repo: str,
        label_id: int,
    ) -> dict[str, Any]:
        """
        Get a label by ID.

        Args:
            owner: Repository owner
            repo: Repository name
            label_id: Label ID

        Returns:
            Label data
        """
        endpoint = f"/repos/{owner}/{repo}/labels/{label_id}"
        return await self.get(endpoint)

    async def delete_label(
        self,
        owner: str,
        repo: str,
        label_id: int,
    ) -> None:
        """
        Delete a label from a repository.

        Args:
            owner: Repository owner
            repo: Repository name
            label_id: Label ID to delete
        """
        endpoint = f"/repos/{owner}/{repo}/labels/{label_id}"
        await self.delete(endpoint)

    # =========================================================================
    # Repository Operations
    # =========================================================================

    async def get_repo(
        self,
        owner: str,
        repo: str,
    ) -> dict[str, Any]:
        """
        Get repository information.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Repository data including default_branch, permissions, etc.
        """
        endpoint = f"/repos/{owner}/{repo}"
        return await self.get(endpoint)

    async def get_default_branch(
        self,
        owner: str,
        repo: str,
    ) -> str:
        """
        Get the default branch of a repository.

        Args:
            owner: Repository owner
            repo: Repository name

        Returns:
            Default branch name (e.g., "main", "master")
        """
        repo_data = await self.get_repo(owner, repo)
        return repo_data.get("default_branch", "main")

    async def check_permissions(
        self,
        owner: str,
        repo: str,
        username: str,
    ) -> str:
        """
        Check a user's permission level on the repository.

        Args:
            owner: Repository owner
            repo: Repository name
            username: Username to check

        Returns:
            Permission level (admin, write, read, none)
        """
        endpoint = f"/repos/{owner}/{repo}/collaborators/{username}/permission"
        try:
            result = await self.get(endpoint)
            # Gitea returns permission in format: {"permission": "admin|write|read"}
            return result.get("permission", "none")
        except GiteaAPIError as e:
            if e.status_code == 404:
                return "none"
            raise

    async def list_collaborators(
        self,
        owner: str,
        repo: str,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        List repository collaborators.

        Args:
            owner: Repository owner
            repo: Repository name
            page: Page number
            limit: Items per page

        Returns:
            List of collaborator data with permissions
        """
        endpoint = f"/repos/{owner}/{repo}/collaborators"
        params = {"page": page, "limit": limit}
        return await self.get(endpoint, params=params)

    async def get_branch(
        self,
        owner: str,
        repo: str,
        branch: str,
    ) -> dict[str, Any]:
        """
        Get branch information.

        Args:
            owner: Repository owner
            repo: Repository name
            branch: Branch name

        Returns:
            Branch data including latest commit
        """
        endpoint = f"/repos/{owner}/{repo}/branches/{branch}"
        return await self.get(endpoint)

    async def list_branches(
        self,
        owner: str,
        repo: str,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        List repository branches.

        Args:
            owner: Repository owner
            repo: Repository name
            page: Page number
            limit: Items per page

        Returns:
            List of branch data
        """
        endpoint = f"/repos/{owner}/{repo}/branches"
        params = {"page": page, "limit": limit}
        return await self.get(endpoint, params=params)

    # =========================================================================
    # User Operations
    # =========================================================================

    async def get_current_user(self) -> dict[str, Any]:
        """
        Get the currently authenticated user.

        Returns:
            User data for the authenticated user
        """
        return await self.get("/user")

    async def get_user(self, username: str) -> dict[str, Any]:
        """
        Get a user by username.

        Args:
            username: The username to look up

        Returns:
            User data
        """
        endpoint = f"/users/{username}"
        return await self.get(endpoint)

    # =========================================================================
    # Review Operations (additional)
    # =========================================================================

    async def list_pr_reviews(
        self,
        owner: str,
        repo: str,
        index: int,
        page: int = 1,
        limit: int = 100,
    ) -> list[dict[str, Any]]:
        """
        List reviews on a pull request.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index
            page: Page number
            limit: Items per page

        Returns:
            List of review data
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}/reviews"
        params = {"page": page, "limit": limit}
        return await self.get(endpoint, params=params)

    async def get_pr_review(
        self,
        owner: str,
        repo: str,
        index: int,
        review_id: int,
    ) -> dict[str, Any]:
        """
        Get a specific review on a pull request.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index
            review_id: Review ID

        Returns:
            Review data
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}/reviews/{review_id}"
        return await self.get(endpoint)

    async def submit_pr_review(
        self,
        owner: str,
        repo: str,
        index: int,
        review_id: int,
        body: str,
        event: str = "COMMENT",
    ) -> dict[str, Any]:
        """
        Submit a pending review.

        Args:
            owner: Repository owner
            repo: Repository name
            index: PR index
            review_id: Review ID
            body: Review body
            event: Review event (APPROVE, REQUEST_CHANGES, COMMENT)

        Returns:
            Submitted review data
        """
        endpoint = f"/repos/{owner}/{repo}/pulls/{index}/reviews/{review_id}"
        data = {"body": body, "event": event.upper()}
        return await self.post(endpoint, data=data)
