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
