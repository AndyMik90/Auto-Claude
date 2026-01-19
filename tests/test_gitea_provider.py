"""
Tests for Gitea Provider Implementation
=======================================

Tests the GiteaProvider and GiteaClient for self-hosted Gitea instance support.
"""

import sys
from datetime import datetime, timezone
from pathlib import Path
from types import ModuleType
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

# Add the providers directory to path and set up the package structure
_backend_dir = Path(__file__).parent.parent / "apps" / "backend"
_providers_dir = _backend_dir / "runners" / "github" / "providers"

# Create a fake package structure for relative imports
if "runners" not in sys.modules:
    runners_pkg = ModuleType("runners")
    runners_pkg.__path__ = [str(_backend_dir / "runners")]
    sys.modules["runners"] = runners_pkg

if "runners.github" not in sys.modules:
    github_pkg = ModuleType("runners.github")
    github_pkg.__path__ = [str(_backend_dir / "runners" / "github")]
    sys.modules["runners.github"] = github_pkg

if "runners.github.providers" not in sys.modules:
    providers_pkg = ModuleType("runners.github.providers")
    providers_pkg.__path__ = [str(_providers_dir)]
    sys.modules["runners.github.providers"] = providers_pkg

# Add providers directory to sys.path
if str(_providers_dir) not in sys.path:
    sys.path.insert(0, str(_providers_dir))

# Import protocol first (no relative imports)
import protocol as _protocol
sys.modules["runners.github.providers.protocol"] = _protocol

# Import gitea_client (no relative imports)
import gitea_client as _gitea_client
sys.modules["runners.github.providers.gitea_client"] = _gitea_client

# Now import gitea_provider with importlib (handles relative imports)
import importlib.util
spec = importlib.util.spec_from_file_location(
    "runners.github.providers.gitea_provider",
    _providers_dir / "gitea_provider.py",
    submodule_search_locations=[str(_providers_dir)]
)
_gitea_provider = importlib.util.module_from_spec(spec)
sys.modules["runners.github.providers.gitea_provider"] = _gitea_provider
spec.loader.exec_module(_gitea_provider)

# Create convenient aliases
GiteaClient = _gitea_client.GiteaClient
GiteaAPIError = _gitea_client.GiteaAPIError
GiteaAuthenticationError = _gitea_client.GiteaAuthenticationError
GiteaRateLimitError = _gitea_client.GiteaRateLimitError
GiteaTimeoutError = _gitea_client.GiteaTimeoutError

GiteaProvider = _gitea_provider.GiteaProvider

GitProvider = _protocol.GitProvider
ProviderType = _protocol.ProviderType
PRData = _protocol.PRData
IssueData = _protocol.IssueData
LabelData = _protocol.LabelData
ReviewData = _protocol.ReviewData
PRFilters = _protocol.PRFilters
IssueFilters = _protocol.IssueFilters


# ============================================================================
# Fixtures
# ============================================================================


@pytest.fixture
def gitea_client():
    """Create a GiteaClient with test configuration."""
    return GiteaClient(
        base_url="https://gitea.example.com",
        token="test-token-123",
        default_timeout=30.0,
        max_retries=3,
        enable_rate_limiting=True,
    )


@pytest.fixture
def gitea_provider():
    """Create a GiteaProvider with test configuration."""
    mock_client = MagicMock(spec=GiteaClient)
    provider = GiteaProvider(
        _repo="owner/repo",
        _gitea_client=mock_client,
    )
    return provider


@pytest.fixture
def sample_pr_data():
    """Sample PR data from Gitea API."""
    return {
        "number": 123,
        "index": 123,
        "title": "Add new feature",
        "body": "This PR adds a new feature",
        "state": "open",
        "user": {"login": "alice"},
        "head": {"ref": "feature-branch"},
        "base": {"ref": "main"},
        "labels": [{"name": "enhancement"}, {"name": "needs-review"}],
        "requested_reviewers": [{"login": "bob"}, {"login": "charlie"}],
        "draft": False,
        "mergeable": True,
        "additions": 50,
        "deletions": 10,
        "changed_files": 5,
        "html_url": "https://gitea.example.com/owner/repo/pulls/123",
        "created_at": "2025-01-15T10:00:00Z",
        "updated_at": "2025-01-16T14:30:00Z",
    }


@pytest.fixture
def sample_issue_data():
    """Sample issue data from Gitea API."""
    return {
        "number": 456,
        "index": 456,
        "title": "Bug report",
        "body": "There is a bug in the system",
        "state": "open",
        "user": {"login": "dave"},
        "labels": [{"name": "bug"}, {"name": "priority-high"}],
        "assignees": [{"login": "eve"}, {"login": "frank"}],
        "milestone": {"title": "v1.0"},
        "html_url": "https://gitea.example.com/owner/repo/issues/456",
        "created_at": "2025-01-10T08:00:00Z",
        "updated_at": "2025-01-11T16:45:00Z",
    }


@pytest.fixture
def sample_labels_data():
    """Sample labels data from Gitea API."""
    return [
        {"id": 1, "name": "bug", "color": "d73a4a", "description": "Something isn't working"},
        {"id": 2, "name": "enhancement", "color": "a2eeef", "description": "New feature"},
        {"id": 3, "name": "documentation", "color": "0075ca", "description": "Docs"},
    ]


# ============================================================================
# GiteaClient URL Normalization Tests
# ============================================================================


class TestGiteaClientURLNormalization:
    """Test URL normalization in GiteaClient."""

    def test_url_strips_trailing_slash(self):
        """Test that trailing slashes are stripped."""
        client = GiteaClient(base_url="https://gitea.example.com/", token="token")
        assert client.base_url == "https://gitea.example.com"

    def test_url_strips_api_v1_suffix(self):
        """Test that /api/v1 suffix is stripped."""
        client = GiteaClient(base_url="https://gitea.example.com/api/v1", token="token")
        assert client.base_url == "https://gitea.example.com"

    def test_url_strips_api_v1_with_trailing_slash(self):
        """Test that /api/v1/ suffix is stripped."""
        client = GiteaClient(base_url="https://gitea.example.com/api/v1/", token="token")
        assert client.base_url == "https://gitea.example.com"

    def test_url_preserves_path(self):
        """Test that subpath is preserved."""
        client = GiteaClient(base_url="https://example.com/gitea", token="token")
        assert client.base_url == "https://example.com/gitea"

    def test_empty_url_handled(self):
        """Test that empty URL is handled gracefully."""
        client = GiteaClient(base_url="", token="token")
        assert client.base_url == ""

    def test_build_url_adds_api_v1(self, gitea_client):
        """Test that _build_url adds /api/v1 prefix."""
        url = gitea_client._build_url("/repos/owner/repo")
        assert url == "https://gitea.example.com/api/v1/repos/owner/repo"

    def test_build_url_handles_missing_leading_slash(self, gitea_client):
        """Test that _build_url handles endpoint without leading slash."""
        url = gitea_client._build_url("repos/owner/repo")
        assert url == "https://gitea.example.com/api/v1/repos/owner/repo"


# ============================================================================
# GiteaClient Authentication Tests
# ============================================================================


class TestGiteaClientAuthentication:
    """Test authentication in GiteaClient."""

    def test_headers_include_token(self, gitea_client):
        """Test that headers include authorization token."""
        headers = gitea_client._get_headers()
        assert "Authorization" in headers
        assert headers["Authorization"] == "token test-token-123"

    def test_headers_without_token(self):
        """Test headers when no token is provided."""
        client = GiteaClient(base_url="https://gitea.example.com")
        headers = client._get_headers()
        assert "Authorization" not in headers

    def test_is_configured_with_both(self, gitea_client):
        """Test is_configured returns True with URL and token."""
        assert gitea_client.is_configured is True

    def test_is_configured_without_url(self):
        """Test is_configured returns False without URL."""
        client = GiteaClient(base_url="", token="token")
        assert client.is_configured is False

    def test_is_configured_without_token(self):
        """Test is_configured returns False without token."""
        client = GiteaClient(base_url="https://gitea.example.com", token="")
        assert client.is_configured is False


# ============================================================================
# GiteaClient Error Handling Tests
# ============================================================================


class TestGiteaClientErrorHandling:
    """Test error handling in GiteaClient."""

    @pytest.mark.asyncio
    async def test_authentication_error_401(self, gitea_client):
        """Test that 401 raises GiteaAuthenticationError."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.text = "Unauthorized"

        with patch.object(gitea_client, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with pytest.raises(GiteaAuthenticationError) as exc_info:
                await gitea_client.get("/user")

            assert "Authentication failed" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_authentication_error_403(self, gitea_client):
        """Test that 403 raises GiteaAuthenticationError."""
        mock_response = MagicMock()
        mock_response.status_code = 403
        mock_response.text = "Forbidden"

        with patch.object(gitea_client, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with pytest.raises(GiteaAuthenticationError) as exc_info:
                await gitea_client.get("/user")

            assert "Access forbidden" in str(exc_info.value)

    @pytest.mark.asyncio
    async def test_rate_limit_error_429(self, gitea_client):
        """Test that 429 raises GiteaRateLimitError after retries."""
        mock_response = MagicMock()
        mock_response.status_code = 429
        mock_response.headers = {"Retry-After": "60"}

        # Disable rate limit waiting in client for faster test
        gitea_client.max_retries = 1

        with patch.object(gitea_client, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with pytest.raises(GiteaRateLimitError) as exc_info:
                await gitea_client.get("/repos/owner/repo")

            assert "rate limit" in str(exc_info.value).lower()

    @pytest.mark.asyncio
    async def test_api_error_4xx(self, gitea_client):
        """Test that 4xx errors raise GiteaAPIError."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_response.text = "Not Found"

        with patch.object(gitea_client, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with pytest.raises(GiteaAPIError) as exc_info:
                await gitea_client.get("/repos/owner/missing")

            assert exc_info.value.status_code == 404

    @pytest.mark.asyncio
    async def test_api_error_5xx(self, gitea_client):
        """Test that 5xx errors raise GiteaAPIError."""
        mock_response = MagicMock()
        mock_response.status_code = 500
        mock_response.text = "Internal Server Error"

        with patch.object(gitea_client, "_get_client") as mock_get_client:
            mock_client = AsyncMock()
            mock_client.request = AsyncMock(return_value=mock_response)
            mock_get_client.return_value = mock_client

            with pytest.raises(GiteaAPIError) as exc_info:
                await gitea_client.get("/repos/owner/repo")

            assert exc_info.value.status_code == 500


# ============================================================================
# GiteaClient Context Manager Tests
# ============================================================================


class TestGiteaClientContextManager:
    """Test context manager functionality in GiteaClient."""

    @pytest.mark.asyncio
    async def test_context_manager_closes_client(self, gitea_client):
        """Test that context manager properly closes the client."""
        # Create a mock internal client
        mock_internal_client = AsyncMock()
        gitea_client._client = mock_internal_client

        async with gitea_client:
            pass

        mock_internal_client.aclose.assert_called_once()
        assert gitea_client._client is None

    @pytest.mark.asyncio
    async def test_close_idempotent(self, gitea_client):
        """Test that close can be called multiple times."""
        # Should not raise even without client
        await gitea_client.close()
        await gitea_client.close()  # Second call should be safe


# ============================================================================
# GiteaProvider Initialization Tests
# ============================================================================


class TestGiteaProviderInit:
    """Test GiteaProvider initialization."""

    def test_provider_type(self, gitea_provider):
        """Test provider_type property returns GITEA."""
        assert gitea_provider.provider_type == ProviderType.GITEA

    def test_repo_property(self, gitea_provider):
        """Test repo property returns correct value."""
        assert gitea_provider.repo == "owner/repo"

    def test_creates_default_client(self):
        """Test that provider creates default client if none provided."""
        provider = GiteaProvider(_repo="owner/repo")
        assert provider._gitea_client is not None
        # Use class name check to avoid module namespace issues
        assert provider._gitea_client.__class__.__name__ == "GiteaClient"

    def test_uses_provided_client(self):
        """Test that provider uses provided client."""
        custom_client = GiteaClient(
            base_url="https://custom.gitea.com",
            token="custom-token",
        )
        provider = GiteaProvider(_repo="owner/repo", _gitea_client=custom_client)
        assert provider._gitea_client is custom_client

    def test_parse_owner_repo(self, gitea_provider):
        """Test _parse_owner_repo correctly splits owner/repo."""
        owner, repo = gitea_provider._parse_owner_repo()
        assert owner == "owner"
        assert repo == "repo"

    def test_parse_owner_repo_invalid(self):
        """Test _parse_owner_repo raises on invalid format."""
        provider = GiteaProvider(_repo="invalid-no-slash")
        with pytest.raises(ValueError) as exc_info:
            provider._parse_owner_repo()
        assert "Invalid repo format" in str(exc_info.value)


# ============================================================================
# GiteaProvider Protocol Compliance Tests
# ============================================================================


class TestGiteaProviderProtocolCompliance:
    """Test that GiteaProvider implements GitProvider protocol."""

    def test_is_git_provider(self, gitea_provider):
        """Test that GiteaProvider passes isinstance check for GitProvider."""
        # Using runtime_checkable protocol
        assert isinstance(gitea_provider, GitProvider)

    def test_has_fetch_pr(self, gitea_provider):
        """Test that fetch_pr method exists."""
        assert hasattr(gitea_provider, "fetch_pr")
        assert callable(gitea_provider.fetch_pr)

    def test_has_fetch_prs(self, gitea_provider):
        """Test that fetch_prs method exists."""
        assert hasattr(gitea_provider, "fetch_prs")
        assert callable(gitea_provider.fetch_prs)

    def test_has_fetch_pr_diff(self, gitea_provider):
        """Test that fetch_pr_diff method exists."""
        assert hasattr(gitea_provider, "fetch_pr_diff")
        assert callable(gitea_provider.fetch_pr_diff)

    def test_has_post_review(self, gitea_provider):
        """Test that post_review method exists."""
        assert hasattr(gitea_provider, "post_review")
        assert callable(gitea_provider.post_review)

    def test_has_merge_pr(self, gitea_provider):
        """Test that merge_pr method exists."""
        assert hasattr(gitea_provider, "merge_pr")
        assert callable(gitea_provider.merge_pr)

    def test_has_close_pr(self, gitea_provider):
        """Test that close_pr method exists."""
        assert hasattr(gitea_provider, "close_pr")
        assert callable(gitea_provider.close_pr)

    def test_has_fetch_issue(self, gitea_provider):
        """Test that fetch_issue method exists."""
        assert hasattr(gitea_provider, "fetch_issue")
        assert callable(gitea_provider.fetch_issue)

    def test_has_fetch_issues(self, gitea_provider):
        """Test that fetch_issues method exists."""
        assert hasattr(gitea_provider, "fetch_issues")
        assert callable(gitea_provider.fetch_issues)

    def test_has_create_issue(self, gitea_provider):
        """Test that create_issue method exists."""
        assert hasattr(gitea_provider, "create_issue")
        assert callable(gitea_provider.create_issue)

    def test_has_close_issue(self, gitea_provider):
        """Test that close_issue method exists."""
        assert hasattr(gitea_provider, "close_issue")
        assert callable(gitea_provider.close_issue)

    def test_has_add_comment(self, gitea_provider):
        """Test that add_comment method exists."""
        assert hasattr(gitea_provider, "add_comment")
        assert callable(gitea_provider.add_comment)

    def test_has_apply_labels(self, gitea_provider):
        """Test that apply_labels method exists."""
        assert hasattr(gitea_provider, "apply_labels")
        assert callable(gitea_provider.apply_labels)

    def test_has_remove_labels(self, gitea_provider):
        """Test that remove_labels method exists."""
        assert hasattr(gitea_provider, "remove_labels")
        assert callable(gitea_provider.remove_labels)

    def test_has_create_label(self, gitea_provider):
        """Test that create_label method exists."""
        assert hasattr(gitea_provider, "create_label")
        assert callable(gitea_provider.create_label)

    def test_has_list_labels(self, gitea_provider):
        """Test that list_labels method exists."""
        assert hasattr(gitea_provider, "list_labels")
        assert callable(gitea_provider.list_labels)

    def test_has_get_repository_info(self, gitea_provider):
        """Test that get_repository_info method exists."""
        assert hasattr(gitea_provider, "get_repository_info")
        assert callable(gitea_provider.get_repository_info)

    def test_has_get_default_branch(self, gitea_provider):
        """Test that get_default_branch method exists."""
        assert hasattr(gitea_provider, "get_default_branch")
        assert callable(gitea_provider.get_default_branch)

    def test_has_check_permissions(self, gitea_provider):
        """Test that check_permissions method exists."""
        assert hasattr(gitea_provider, "check_permissions")
        assert callable(gitea_provider.check_permissions)

    def test_has_api_get(self, gitea_provider):
        """Test that api_get method exists."""
        assert hasattr(gitea_provider, "api_get")
        assert callable(gitea_provider.api_get)

    def test_has_api_post(self, gitea_provider):
        """Test that api_post method exists."""
        assert hasattr(gitea_provider, "api_post")
        assert callable(gitea_provider.api_post)


# ============================================================================
# GiteaProvider Data Parsing Tests
# ============================================================================


class TestGiteaProviderDataParsing:
    """Test data parsing in GiteaProvider."""

    def test_parse_pr_data(self, gitea_provider, sample_pr_data):
        """Test _parse_pr_data correctly parses Gitea PR data."""
        pr = gitea_provider._parse_pr_data(sample_pr_data, "diff content", [])

        # Use class name check to avoid module namespace issues
        assert pr.__class__.__name__ == "PRData"
        assert pr.number == 123
        assert pr.title == "Add new feature"
        assert pr.body == "This PR adds a new feature"
        assert pr.author == "alice"
        assert pr.state == "open"
        assert pr.source_branch == "feature-branch"
        assert pr.target_branch == "main"
        assert pr.additions == 50
        assert pr.deletions == 10
        assert pr.changed_files == 5
        assert pr.diff == "diff content"
        assert pr.url == "https://gitea.example.com/owner/repo/pulls/123"
        assert pr.is_draft is False
        assert pr.mergeable is True
        assert pr.provider == ProviderType.GITEA
        assert "enhancement" in pr.labels
        assert "needs-review" in pr.labels
        assert "bob" in pr.reviewers
        assert "charlie" in pr.reviewers

    def test_parse_pr_data_uses_index_fallback(self, gitea_provider):
        """Test _parse_pr_data falls back to index field."""
        data = {"index": 456, "user": {}}
        pr = gitea_provider._parse_pr_data(data, "", [])
        assert pr.number == 456

    def test_parse_pr_data_merged_state(self, gitea_provider):
        """Test _parse_pr_data correctly handles merged PRs."""
        data = {
            "number": 123,
            "state": "closed",
            "merged": True,
            "user": {"login": "alice"},
        }
        pr = gitea_provider._parse_pr_data(data, "", [])
        assert pr.state == "merged"

    def test_parse_pr_data_null_fields(self, gitea_provider):
        """Test _parse_pr_data handles null/missing fields."""
        data = {
            "number": 123,
            "title": "Test",
            "body": None,
            "user": None,
            "labels": None,
            "head": None,
            "base": None,
            "requested_reviewers": None,
        }
        pr = gitea_provider._parse_pr_data(data, "", [])

        assert pr.number == 123
        assert pr.body == ""
        assert pr.author == "unknown"
        assert pr.labels == []
        assert pr.source_branch == ""
        assert pr.target_branch == ""
        assert pr.reviewers == []

    def test_parse_issue_data(self, gitea_provider, sample_issue_data):
        """Test _parse_issue_data correctly parses Gitea issue data."""
        issue = gitea_provider._parse_issue_data(sample_issue_data)

        # Use class name check to avoid module namespace issues
        assert issue.__class__.__name__ == "IssueData"
        assert issue.number == 456
        assert issue.title == "Bug report"
        assert issue.body == "There is a bug in the system"
        assert issue.author == "dave"
        assert issue.state == "open"
        assert issue.url == "https://gitea.example.com/owner/repo/issues/456"
        assert issue.milestone == "v1.0"
        assert issue.provider == ProviderType.GITEA
        assert "bug" in issue.labels
        assert "priority-high" in issue.labels
        assert "eve" in issue.assignees
        assert "frank" in issue.assignees

    def test_parse_issue_data_null_fields(self, gitea_provider):
        """Test _parse_issue_data handles null/missing fields."""
        data = {
            "number": 789,
            "title": "Test Issue",
            "body": None,
            "user": None,
            "labels": None,
            "assignees": None,
            "milestone": None,
        }
        issue = gitea_provider._parse_issue_data(data)

        assert issue.number == 789
        assert issue.body == ""
        assert issue.author == "unknown"
        assert issue.labels == []
        assert issue.assignees == []
        assert issue.milestone is None

    def test_parse_datetime_iso_z(self, gitea_provider):
        """Test _parse_datetime handles ISO format with Z suffix."""
        dt = gitea_provider._parse_datetime("2025-01-15T10:30:00Z")
        assert dt.year == 2025
        assert dt.month == 1
        assert dt.day == 15
        assert dt.hour == 10
        assert dt.minute == 30

    def test_parse_datetime_iso_offset(self, gitea_provider):
        """Test _parse_datetime handles ISO format with offset."""
        dt = gitea_provider._parse_datetime("2025-01-15T10:30:00+00:00")
        assert dt.year == 2025
        assert dt.month == 1
        assert dt.day == 15

    def test_parse_datetime_none(self, gitea_provider):
        """Test _parse_datetime handles None input."""
        dt = gitea_provider._parse_datetime(None)
        # Should return current time (approximately)
        assert dt.year == datetime.now(timezone.utc).year

    def test_parse_datetime_invalid(self, gitea_provider):
        """Test _parse_datetime handles invalid input."""
        dt = gitea_provider._parse_datetime("not-a-date")
        # Should return current time on error
        assert dt.year == datetime.now(timezone.utc).year

    def test_parse_reviewers(self, gitea_provider):
        """Test _parse_reviewers correctly extracts usernames."""
        reviewers = gitea_provider._parse_reviewers([
            {"login": "alice"},
            {"login": "bob"},
        ])
        assert reviewers == ["alice", "bob"]

    def test_parse_reviewers_empty(self, gitea_provider):
        """Test _parse_reviewers handles empty list."""
        assert gitea_provider._parse_reviewers([]) == []
        assert gitea_provider._parse_reviewers(None) == []

    def test_parse_reviewers_missing_login(self, gitea_provider):
        """Test _parse_reviewers skips entries without login."""
        reviewers = gitea_provider._parse_reviewers([
            {"login": "alice"},
            {"name": "Bob"},  # No login field
            {"login": ""},  # Empty login
        ])
        assert reviewers == ["alice"]


# ============================================================================
# GiteaProvider PR Operations Tests
# ============================================================================


class TestGiteaProviderPROperations:
    """Test PR operations in GiteaProvider."""

    @pytest.mark.asyncio
    async def test_fetch_pr(self, gitea_provider, sample_pr_data):
        """Test fetch_pr retrieves and parses PR data."""
        gitea_provider._gitea_client.get_pr = AsyncMock(return_value=sample_pr_data)
        gitea_provider._gitea_client.get_pr_diff = AsyncMock(return_value="diff content")
        gitea_provider._gitea_client.get_pr_files = AsyncMock(return_value=[])

        pr = await gitea_provider.fetch_pr(123)

        # Use class name check to avoid module namespace issues
        assert pr.__class__.__name__ == "PRData"
        assert pr.number == 123
        gitea_provider._gitea_client.get_pr.assert_called_once_with("owner", "repo", 123)
        gitea_provider._gitea_client.get_pr_diff.assert_called_once_with("owner", "repo", 123)

    @pytest.mark.asyncio
    async def test_fetch_pr_handles_files_error(self, gitea_provider, sample_pr_data):
        """Test fetch_pr handles error when fetching files."""
        gitea_provider._gitea_client.get_pr = AsyncMock(return_value=sample_pr_data)
        gitea_provider._gitea_client.get_pr_diff = AsyncMock(return_value="diff")
        gitea_provider._gitea_client.get_pr_files = AsyncMock(side_effect=Exception("API error"))

        pr = await gitea_provider.fetch_pr(123)

        # Use class name check to avoid module namespace issues
        assert pr.__class__.__name__ == "PRData"
        assert pr.files == []

    @pytest.mark.asyncio
    async def test_fetch_prs_with_filters(self, gitea_provider, sample_pr_data):
        """Test fetch_prs with filters."""
        gitea_provider._gitea_client.list_prs = AsyncMock(return_value=[sample_pr_data])

        filters = PRFilters(state="open", labels=["bug"], author="alice")
        prs = await gitea_provider.fetch_prs(filters)

        assert len(prs) == 1
        gitea_provider._gitea_client.list_prs.assert_called_once()

    @pytest.mark.asyncio
    async def test_fetch_pr_diff(self, gitea_provider):
        """Test fetch_pr_diff retrieves diff."""
        gitea_provider._gitea_client.get_pr_diff = AsyncMock(return_value="diff content")

        diff = await gitea_provider.fetch_pr_diff(123)

        assert diff == "diff content"
        gitea_provider._gitea_client.get_pr_diff.assert_called_once_with("owner", "repo", 123)

    @pytest.mark.asyncio
    async def test_post_review(self, gitea_provider):
        """Test post_review posts a review."""
        gitea_provider._gitea_client.create_review = AsyncMock(return_value={"id": 456})

        review = ReviewData(
            pr_number=123,
            event="approve",
            body="LGTM!",
            inline_comments=[],
        )
        review_id = await gitea_provider.post_review(123, review)

        assert review_id == 456
        gitea_provider._gitea_client.create_review.assert_called_once()

    @pytest.mark.asyncio
    async def test_post_review_maps_events(self, gitea_provider):
        """Test post_review correctly maps event types."""
        gitea_provider._gitea_client.create_review = AsyncMock(return_value={"id": 1})

        # Test approve
        review = ReviewData(pr_number=123, event="approve", body="Good")
        await gitea_provider.post_review(123, review)

        call_args = gitea_provider._gitea_client.create_review.call_args
        assert call_args.kwargs["event"] == "APPROVE"

    @pytest.mark.asyncio
    async def test_merge_pr(self, gitea_provider):
        """Test merge_pr merges successfully."""
        gitea_provider._gitea_client.merge_pr = AsyncMock(return_value={})

        result = await gitea_provider.merge_pr(123, merge_method="squash", commit_title="feat: add feature")

        assert result is True
        gitea_provider._gitea_client.merge_pr.assert_called_once()

    @pytest.mark.asyncio
    async def test_merge_pr_failure(self, gitea_provider):
        """Test merge_pr returns False on failure."""
        gitea_provider._gitea_client.merge_pr = AsyncMock(side_effect=Exception("Merge conflict"))

        result = await gitea_provider.merge_pr(123)

        assert result is False

    @pytest.mark.asyncio
    async def test_close_pr(self, gitea_provider):
        """Test close_pr closes without comment."""
        gitea_provider._gitea_client.close_pr = AsyncMock(return_value={})

        result = await gitea_provider.close_pr(123)

        assert result is True
        gitea_provider._gitea_client.close_pr.assert_called_once_with("owner", "repo", 123)

    @pytest.mark.asyncio
    async def test_close_pr_with_comment(self, gitea_provider):
        """Test close_pr with comment."""
        gitea_provider._gitea_client.add_comment = AsyncMock(return_value={"id": 1})
        gitea_provider._gitea_client.close_pr = AsyncMock(return_value={})

        result = await gitea_provider.close_pr(123, comment="Closing this PR")

        assert result is True
        gitea_provider._gitea_client.add_comment.assert_called_once()


# ============================================================================
# GiteaProvider Issue Operations Tests
# ============================================================================


class TestGiteaProviderIssueOperations:
    """Test issue operations in GiteaProvider."""

    @pytest.mark.asyncio
    async def test_fetch_issue(self, gitea_provider, sample_issue_data):
        """Test fetch_issue retrieves and parses issue data."""
        gitea_provider._gitea_client.get_issue = AsyncMock(return_value=sample_issue_data)

        issue = await gitea_provider.fetch_issue(456)

        # Use class name check to avoid module namespace issues
        assert issue.__class__.__name__ == "IssueData"
        assert issue.number == 456
        gitea_provider._gitea_client.get_issue.assert_called_once_with("owner", "repo", 456)

    @pytest.mark.asyncio
    async def test_fetch_issues_with_filters(self, gitea_provider, sample_issue_data):
        """Test fetch_issues with filters."""
        gitea_provider._gitea_client.list_issues = AsyncMock(return_value=[sample_issue_data])

        filters = IssueFilters(state="open", labels=["bug"])
        issues = await gitea_provider.fetch_issues(filters)

        assert len(issues) == 1
        gitea_provider._gitea_client.list_issues.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_issue(self, gitea_provider, sample_issue_data, sample_labels_data):
        """Test create_issue creates a new issue."""
        gitea_provider._gitea_client.get_labels = AsyncMock(return_value=sample_labels_data)
        gitea_provider._gitea_client.create_issue = AsyncMock(return_value=sample_issue_data)

        issue = await gitea_provider.create_issue(
            title="New Bug",
            body="Description here",
            labels=["bug"],
            assignees=["alice"],
        )

        # Use class name check to avoid module namespace issues
        assert issue.__class__.__name__ == "IssueData"
        gitea_provider._gitea_client.create_issue.assert_called_once()

    @pytest.mark.asyncio
    async def test_close_issue(self, gitea_provider):
        """Test close_issue closes successfully."""
        gitea_provider._gitea_client.close_issue = AsyncMock(return_value={})

        result = await gitea_provider.close_issue(456)

        assert result is True

    @pytest.mark.asyncio
    async def test_add_comment(self, gitea_provider):
        """Test add_comment adds a comment."""
        gitea_provider._gitea_client.add_comment = AsyncMock(return_value={"id": 789})

        comment_id = await gitea_provider.add_comment(123, "Great work!")

        assert comment_id == 789
        gitea_provider._gitea_client.add_comment.assert_called_once_with(
            owner="owner",
            repo="repo",
            index=123,
            body="Great work!",
        )


# ============================================================================
# GiteaProvider Label Operations Tests
# ============================================================================


class TestGiteaProviderLabelOperations:
    """Test label operations in GiteaProvider."""

    @pytest.mark.asyncio
    async def test_list_labels(self, gitea_provider, sample_labels_data):
        """Test list_labels retrieves all labels."""
        gitea_provider._gitea_client.get_labels = AsyncMock(return_value=sample_labels_data)

        labels = await gitea_provider.list_labels()

        assert len(labels) == 3
        # Use class name check to avoid module namespace issues
        assert all(label.__class__.__name__ == "LabelData" for label in labels)
        assert labels[0].name == "bug"
        assert labels[0].color == "d73a4a"

    @pytest.mark.asyncio
    async def test_apply_labels(self, gitea_provider, sample_labels_data):
        """Test apply_labels applies labels by name."""
        gitea_provider._gitea_client.get_labels = AsyncMock(return_value=sample_labels_data)
        gitea_provider._gitea_client.add_labels = AsyncMock(return_value=[])

        await gitea_provider.apply_labels(123, ["bug", "enhancement"])

        gitea_provider._gitea_client.add_labels.assert_called_once()
        call_args = gitea_provider._gitea_client.add_labels.call_args
        # Should have label IDs 1 and 2
        assert 1 in call_args.args[3]
        assert 2 in call_args.args[3]

    @pytest.mark.asyncio
    async def test_remove_labels(self, gitea_provider, sample_labels_data):
        """Test remove_labels removes labels by name."""
        gitea_provider._gitea_client.get_issue_labels = AsyncMock(return_value=sample_labels_data)
        gitea_provider._gitea_client.remove_label = AsyncMock(return_value=None)

        await gitea_provider.remove_labels(123, ["bug"])

        gitea_provider._gitea_client.remove_label.assert_called_once()

    @pytest.mark.asyncio
    async def test_create_label(self, gitea_provider):
        """Test create_label creates a new label."""
        gitea_provider._gitea_client.create_label = AsyncMock(return_value={})

        label = LabelData(name="new-label", color="ff0000", description="New label")
        await gitea_provider.create_label(label)

        gitea_provider._gitea_client.create_label.assert_called_once_with(
            owner="owner",
            repo="repo",
            name="new-label",
            color="ff0000",
            description="New label",
        )


# ============================================================================
# GiteaProvider Repository Operations Tests
# ============================================================================


class TestGiteaProviderRepositoryOperations:
    """Test repository operations in GiteaProvider."""

    @pytest.mark.asyncio
    async def test_get_repository_info(self, gitea_provider):
        """Test get_repository_info retrieves repo data."""
        repo_data = {"name": "repo", "full_name": "owner/repo", "default_branch": "main"}
        gitea_provider._gitea_client.get_repo = AsyncMock(return_value=repo_data)

        info = await gitea_provider.get_repository_info()

        assert info["name"] == "repo"
        gitea_provider._gitea_client.get_repo.assert_called_once_with("owner", "repo")

    @pytest.mark.asyncio
    async def test_get_default_branch(self, gitea_provider):
        """Test get_default_branch retrieves default branch."""
        gitea_provider._gitea_client.get_default_branch = AsyncMock(return_value="develop")

        branch = await gitea_provider.get_default_branch()

        assert branch == "develop"

    @pytest.mark.asyncio
    async def test_check_permissions(self, gitea_provider):
        """Test check_permissions retrieves user permissions."""
        gitea_provider._gitea_client.check_permissions = AsyncMock(return_value="admin")

        permission = await gitea_provider.check_permissions("alice")

        assert permission == "admin"


# ============================================================================
# Factory Integration Tests (with mocked factory)
# ============================================================================


class TestFactoryIntegration:
    """Test provider factory integration with GiteaProvider.

    Note: We test factory behavior by verifying that:
    1. GiteaProvider can be instantiated correctly
    2. Provider type detection works
    3. Provider availability can be checked via ProviderType enum

    The actual factory module is not imported due to transitive dependencies,
    but we verify the behavior that factory.py relies on.
    """

    def test_gitea_provider_type_is_gitea(self):
        """Test that GiteaProvider has correct provider_type."""
        provider = GiteaProvider(_repo="owner/repo")
        assert provider.provider_type == ProviderType.GITEA
        assert provider.provider_type.value == "gitea"

    def test_gitea_provider_instantiation_with_repo(self):
        """Test GiteaProvider can be instantiated with repo string."""
        provider = GiteaProvider(_repo="owner/repo")

        assert provider.repo == "owner/repo"
        assert provider.provider_type == ProviderType.GITEA
        assert provider._gitea_client is not None

    def test_gitea_provider_instantiation_with_kwargs(self):
        """Test GiteaProvider accepts kwargs like enable_rate_limiting."""
        provider = GiteaProvider(
            _repo="owner/repo",
            enable_rate_limiting=False,
        )

        assert provider.enable_rate_limiting is False

    def test_provider_type_enum_has_gitea(self):
        """Test that ProviderType enum includes GITEA."""
        assert hasattr(ProviderType, "GITEA")
        assert ProviderType.GITEA.value == "gitea"

    def test_provider_type_enum_conversion(self):
        """Test that string 'gitea' converts to ProviderType.GITEA."""
        provider_type = ProviderType("gitea")
        assert provider_type == ProviderType.GITEA


# ============================================================================
# Edge Cases and Error Handling Tests
# ============================================================================


class TestEdgeCases:
    """Test edge cases and error handling."""

    def test_pr_data_with_string_labels(self, gitea_provider):
        """Test _parse_pr_data handles string labels (legacy format)."""
        data = {
            "number": 123,
            "labels": ["bug", "enhancement"],  # String labels, not objects
            "user": {"login": "alice"},
        }
        pr = gitea_provider._parse_pr_data(data, "", [])

        assert "bug" in pr.labels
        assert "enhancement" in pr.labels

    def test_pr_data_with_user_string(self, gitea_provider):
        """Test _parse_pr_data handles user as string (edge case)."""
        data = {
            "number": 123,
            "user": "alice",  # String instead of object
        }
        pr = gitea_provider._parse_pr_data(data, "", [])

        assert pr.author == "alice"

    def test_issue_data_with_milestone_dict(self, gitea_provider):
        """Test _parse_issue_data handles milestone as dict."""
        data = {
            "number": 456,
            "milestone": {"title": "v1.0", "id": 1},
            "user": {"login": "bob"},
        }
        issue = gitea_provider._parse_issue_data(data)

        assert issue.milestone == "v1.0"

    def test_issue_data_with_milestone_string(self, gitea_provider):
        """Test _parse_issue_data handles milestone as string."""
        data = {
            "number": 456,
            "milestone": "v2.0",  # String instead of dict
            "user": {"login": "bob"},
        }
        issue = gitea_provider._parse_issue_data(data)

        assert issue.milestone == "v2.0"

    def test_pr_mergeable_null(self, gitea_provider):
        """Test _parse_pr_data handles null mergeable field."""
        data = {
            "number": 123,
            "mergeable": None,  # Not yet computed
            "user": {"login": "alice"},
        }
        pr = gitea_provider._parse_pr_data(data, "", [])

        # Should default to True when null
        assert pr.mergeable is True

    def test_pr_uses_html_url_fallback(self, gitea_provider):
        """Test _parse_pr_data falls back to url when html_url missing."""
        data = {
            "number": 123,
            "url": "https://gitea.example.com/api/v1/repos/owner/repo/pulls/123",
            "user": {"login": "alice"},
        }
        pr = gitea_provider._parse_pr_data(data, "", [])

        assert pr.url == "https://gitea.example.com/api/v1/repos/owner/repo/pulls/123"


if __name__ == "__main__":
    import sys
    sys.exit(pytest.main([__file__, "-v"]))
