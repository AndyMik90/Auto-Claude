"""
Gitea Provider Implementation
=============================

Implements the GitProvider protocol for self-hosted Gitea instances.
Uses the GiteaClient for REST API communication.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any

from .gitea_client import GiteaClient
from .protocol import (
    IssueData,
    IssueFilters,
    LabelData,
    PRData,
    PRFilters,
    ProviderType,
    ReviewData,
)


@dataclass
class GiteaProvider:
    """
    Gitea implementation of the GitProvider protocol.

    Uses the GiteaClient REST API for all operations.

    Usage:
        provider = GiteaProvider(repo="owner/repo")
        pr = await provider.fetch_pr(123)
        await provider.post_review(123, review)
    """

    _repo: str
    _gitea_client: GiteaClient | None = None
    _project_dir: str | None = None
    enable_rate_limiting: bool = True

    def __post_init__(self):
        if self._gitea_client is None:
            self._gitea_client = GiteaClient(
                enable_rate_limiting=self.enable_rate_limiting,
            )

    @property
    def provider_type(self) -> ProviderType:
        return ProviderType.GITEA

    @property
    def repo(self) -> str:
        return self._repo

    @property
    def gitea_client(self) -> GiteaClient:
        """Get the underlying GiteaClient."""
        return self._gitea_client

    def _parse_owner_repo(self) -> tuple[str, str]:
        """Parse owner and repo from the _repo string (owner/repo format)."""
        parts = self._repo.split("/", 1)
        if len(parts) != 2:
            raise ValueError(f"Invalid repo format: {self._repo}. Expected 'owner/repo'")
        return parts[0], parts[1]

    # -------------------------------------------------------------------------
    # Pull Request Operations
    # -------------------------------------------------------------------------

    async def fetch_pr(self, number: int) -> PRData:
        """Fetch a pull request by number."""
        owner, repo = self._parse_owner_repo()

        # Gitea uses 'index' but we use 'number' for protocol compatibility
        pr_data = await self._gitea_client.get_pr(owner, repo, number)

        # Get diff separately (longer timeout)
        diff = await self._gitea_client.get_pr_diff(owner, repo, number)

        # Get files for changed files count and details
        try:
            files = await self._gitea_client.get_pr_files(owner, repo, number)
        except Exception:
            files = []

        return self._parse_pr_data(pr_data, diff, files)

    async def fetch_prs(self, filters: PRFilters | None = None) -> list[PRData]:
        """Fetch pull requests with optional filters."""
        owner, repo = self._parse_owner_repo()
        filters = filters or PRFilters()

        # Map filter state to Gitea format
        state_map = {"open": "open", "closed": "closed", "all": "all"}
        state = state_map.get(filters.state, "open")

        prs = await self._gitea_client.list_prs(
            owner=owner,
            repo=repo,
            state=state,
            labels=filters.labels if filters.labels else None,
            limit=filters.limit,
        )

        result = []
        for pr_data in prs:
            # Apply additional filters not supported by Gitea API directly
            if filters.author:
                pr_author = pr_data.get("user", {}).get("login", "")
                if pr_author != filters.author:
                    continue

            if filters.base_branch:
                base_ref = pr_data.get("base", {}).get("ref", "")
                if base_ref != filters.base_branch:
                    continue

            if filters.head_branch:
                head_ref = pr_data.get("head", {}).get("ref", "")
                if head_ref != filters.head_branch:
                    continue

            # Parse to PRData (lightweight, no diff)
            result.append(self._parse_pr_data(pr_data, "", []))

        return result

    async def fetch_pr_diff(self, number: int) -> str:
        """Fetch the diff for a pull request."""
        owner, repo = self._parse_owner_repo()
        return await self._gitea_client.get_pr_diff(owner, repo, number)

    async def post_review(self, pr_number: int, review: ReviewData) -> int:
        """Post a review to a pull request."""
        owner, repo = self._parse_owner_repo()

        # Map event to Gitea format (APPROVE, REQUEST_CHANGES, COMMENT)
        event_map = {
            "approve": "APPROVE",
            "request_changes": "REQUEST_CHANGES",
            "comment": "COMMENT",
        }
        event = event_map.get(review.event.lower(), "COMMENT")

        # Convert inline comments to Gitea format
        comments = []
        for inline in review.inline_comments:
            comments.append({
                "path": inline.get("path"),
                "body": inline.get("body"),
                "new_position": inline.get("line"),
            })

        result = await self._gitea_client.create_review(
            owner=owner,
            repo=repo,
            index=pr_number,
            body=review.body,
            event=event,
            comments=comments if comments else None,
        )

        # Return review ID
        return result.get("id", 0)

    async def merge_pr(
        self,
        pr_number: int,
        merge_method: str = "merge",
        commit_title: str | None = None,
    ) -> bool:
        """Merge a pull request."""
        owner, repo = self._parse_owner_repo()

        # Map merge method to Gitea format
        merge_style_map = {
            "merge": "merge",
            "squash": "squash",
            "rebase": "rebase",
        }
        merge_style = merge_style_map.get(merge_method, "merge")

        try:
            await self._gitea_client.merge_pr(
                owner=owner,
                repo=repo,
                index=pr_number,
                merge_style=merge_style,
                title=commit_title,
            )
            return True
        except Exception:
            return False

    async def close_pr(
        self,
        pr_number: int,
        comment: str | None = None,
    ) -> bool:
        """Close a pull request without merging."""
        owner, repo = self._parse_owner_repo()

        try:
            if comment:
                await self.add_comment(pr_number, comment)
            await self._gitea_client.close_pr(owner, repo, pr_number)
            return True
        except Exception:
            return False

    # -------------------------------------------------------------------------
    # Issue Operations
    # -------------------------------------------------------------------------

    async def fetch_issue(self, number: int) -> IssueData:
        """Fetch an issue by number."""
        owner, repo = self._parse_owner_repo()
        issue_data = await self._gitea_client.get_issue(owner, repo, number)
        return self._parse_issue_data(issue_data)

    async def fetch_issues(
        self, filters: IssueFilters | None = None
    ) -> list[IssueData]:
        """Fetch issues with optional filters."""
        owner, repo = self._parse_owner_repo()
        filters = filters or IssueFilters()

        issues = await self._gitea_client.list_issues(
            owner=owner,
            repo=repo,
            state=filters.state,
            labels=filters.labels if filters.labels else None,
            assignee=filters.assignee,
            limit=filters.limit,
            include_prs=filters.include_prs,
        )

        result = []
        for issue_data in issues:
            # Apply additional filters
            if filters.author:
                issue_author = issue_data.get("user", {}).get("login", "")
                if issue_author != filters.author:
                    continue

            result.append(self._parse_issue_data(issue_data))

        return result

    async def create_issue(
        self,
        title: str,
        body: str,
        labels: list[str] | None = None,
        assignees: list[str] | None = None,
    ) -> IssueData:
        """Create a new issue."""
        owner, repo = self._parse_owner_repo()

        # For Gitea, we need label IDs not names
        # First, get all labels and find matching IDs
        label_ids = []
        if labels:
            all_labels = await self._gitea_client.get_labels(owner, repo)
            label_name_to_id = {label["name"]: label["id"] for label in all_labels}
            label_ids = [label_name_to_id[name] for name in labels if name in label_name_to_id]

        issue_data = await self._gitea_client.create_issue(
            owner=owner,
            repo=repo,
            title=title,
            body=body,
            labels=label_ids if label_ids else None,
            assignees=assignees,
        )

        return self._parse_issue_data(issue_data)

    async def close_issue(
        self,
        number: int,
        comment: str | None = None,
    ) -> bool:
        """Close an issue."""
        owner, repo = self._parse_owner_repo()

        try:
            if comment:
                await self.add_comment(number, comment)
            await self._gitea_client.close_issue(owner, repo, number)
            return True
        except Exception:
            return False

    async def add_comment(
        self,
        issue_or_pr_number: int,
        body: str,
    ) -> int:
        """Add a comment to an issue or PR."""
        owner, repo = self._parse_owner_repo()

        result = await self._gitea_client.add_comment(
            owner=owner,
            repo=repo,
            index=issue_or_pr_number,
            body=body,
        )

        return result.get("id", 0)

    # -------------------------------------------------------------------------
    # Label Operations
    # -------------------------------------------------------------------------

    async def apply_labels(
        self,
        issue_or_pr_number: int,
        labels: list[str],
    ) -> None:
        """Apply labels to an issue or PR."""
        owner, repo = self._parse_owner_repo()

        # Get all labels and find matching IDs
        all_labels = await self._gitea_client.get_labels(owner, repo)
        label_name_to_id = {label["name"]: label["id"] for label in all_labels}

        label_ids = [label_name_to_id[name] for name in labels if name in label_name_to_id]

        if label_ids:
            await self._gitea_client.add_labels(owner, repo, issue_or_pr_number, label_ids)

    async def remove_labels(
        self,
        issue_or_pr_number: int,
        labels: list[str],
    ) -> None:
        """Remove labels from an issue or PR."""
        owner, repo = self._parse_owner_repo()

        # Get current labels on the issue
        current_labels = await self._gitea_client.get_issue_labels(
            owner, repo, issue_or_pr_number
        )

        # Find label IDs to remove
        for label in current_labels:
            if label.get("name") in labels:
                await self._gitea_client.remove_label(
                    owner, repo, issue_or_pr_number, label["id"]
                )

    async def create_label(self, label: LabelData) -> None:
        """Create a label in the repository."""
        owner, repo = self._parse_owner_repo()

        await self._gitea_client.create_label(
            owner=owner,
            repo=repo,
            name=label.name,
            color=label.color,
            description=label.description,
        )

    async def list_labels(self) -> list[LabelData]:
        """List all labels in the repository."""
        owner, repo = self._parse_owner_repo()

        labels_data = await self._gitea_client.get_labels(owner, repo)

        return [
            LabelData(
                name=label.get("name", ""),
                color=label.get("color", ""),
                description=label.get("description", ""),
            )
            for label in labels_data
        ]

    # -------------------------------------------------------------------------
    # Repository Operations
    # -------------------------------------------------------------------------

    async def get_repository_info(self) -> dict[str, Any]:
        """Get repository information."""
        owner, repo = self._parse_owner_repo()
        return await self._gitea_client.get_repo(owner, repo)

    async def get_default_branch(self) -> str:
        """Get the default branch name."""
        owner, repo = self._parse_owner_repo()
        return await self._gitea_client.get_default_branch(owner, repo)

    async def check_permissions(self, username: str) -> str:
        """Check a user's permission level on the repository."""
        owner, repo = self._parse_owner_repo()
        return await self._gitea_client.check_permissions(owner, repo, username)

    # -------------------------------------------------------------------------
    # API Operations
    # -------------------------------------------------------------------------

    async def api_get(
        self,
        endpoint: str,
        params: dict[str, Any] | None = None,
    ) -> Any:
        """Make a GET request to the Gitea API."""
        return await self._gitea_client.get(endpoint, params)

    async def api_post(
        self,
        endpoint: str,
        data: dict[str, Any] | None = None,
    ) -> Any:
        """Make a POST request to the Gitea API."""
        return await self._gitea_client.post(endpoint, data)

    # -------------------------------------------------------------------------
    # Helper Methods
    # -------------------------------------------------------------------------

    def _parse_pr_data(
        self,
        data: dict[str, Any],
        diff: str,
        files: list[dict[str, Any]] | None = None,
    ) -> PRData:
        """Parse Gitea PR data into PRData."""
        files = files or []

        # Get author from user object
        author_obj = data.get("user", {})
        if isinstance(author_obj, dict):
            author_login = author_obj.get("login", "unknown")
        else:
            author_login = str(author_obj) if author_obj else "unknown"

        # Parse labels
        labels = []
        for label in data.get("labels", []) or []:
            if isinstance(label, dict):
                labels.append(label.get("name", ""))
            else:
                labels.append(str(label))

        # Get branch refs from head/base objects
        head_obj = data.get("head", {})
        base_obj = data.get("base", {})
        source_branch = head_obj.get("ref", "") if isinstance(head_obj, dict) else ""
        target_branch = base_obj.get("ref", "") if isinstance(base_obj, dict) else ""

        # Map state - Gitea uses "open", "closed"
        # Check if merged for merged state
        state = data.get("state", "open")
        if data.get("merged"):
            state = "merged"

        # Determine mergeable status
        # Gitea returns mergeable as a boolean or None if not computed
        mergeable_raw = data.get("mergeable")
        if mergeable_raw is None:
            mergeable = True  # Assume mergeable if not computed
        else:
            mergeable = bool(mergeable_raw)

        # Parse additions/deletions from diff stats or data
        additions = data.get("additions", 0) or 0
        deletions = data.get("deletions", 0) or 0
        changed_files = data.get("changed_files", len(files)) or len(files)

        # Build URL - Gitea uses html_url
        url = data.get("html_url", "") or data.get("url", "")

        return PRData(
            number=data.get("number", 0) or data.get("index", 0),
            title=data.get("title", ""),
            body=data.get("body", "") or "",
            author=author_login,
            state=state,
            source_branch=source_branch,
            target_branch=target_branch,
            additions=additions,
            deletions=deletions,
            changed_files=changed_files,
            files=files,
            diff=diff,
            url=url,
            created_at=self._parse_datetime(data.get("created_at")),
            updated_at=self._parse_datetime(data.get("updated_at")),
            labels=labels,
            reviewers=self._parse_reviewers(data.get("requested_reviewers", [])),
            is_draft=data.get("draft", False) or data.get("is_draft", False),
            mergeable=mergeable,
            provider=ProviderType.GITEA,
            raw_data=data,
        )

    def _parse_issue_data(self, data: dict[str, Any]) -> IssueData:
        """Parse Gitea issue data into IssueData."""
        # Get author from user object
        author_obj = data.get("user", {})
        if isinstance(author_obj, dict):
            author_login = author_obj.get("login", "unknown")
        else:
            author_login = str(author_obj) if author_obj else "unknown"

        # Parse labels
        labels = []
        for label in data.get("labels", []) or []:
            if isinstance(label, dict):
                labels.append(label.get("name", ""))
            else:
                labels.append(str(label))

        # Parse assignees
        assignees = []
        for assignee in data.get("assignees", []) or []:
            if isinstance(assignee, dict):
                assignees.append(assignee.get("login", ""))
            else:
                assignees.append(str(assignee))

        # Parse milestone
        milestone = data.get("milestone")
        if isinstance(milestone, dict):
            milestone = milestone.get("title")

        # Build URL
        url = data.get("html_url", "") or data.get("url", "")

        return IssueData(
            number=data.get("number", 0) or data.get("index", 0),
            title=data.get("title", ""),
            body=data.get("body", "") or "",
            author=author_login,
            state=data.get("state", "open"),
            labels=labels,
            created_at=self._parse_datetime(data.get("created_at")),
            updated_at=self._parse_datetime(data.get("updated_at")),
            url=url,
            assignees=assignees,
            milestone=milestone,
            provider=ProviderType.GITEA,
            raw_data=data,
        )

    def _parse_datetime(self, dt_str: str | None) -> datetime:
        """Parse ISO datetime string."""
        if not dt_str:
            return datetime.now(timezone.utc)
        try:
            # Handle both Z suffix and +00:00 format
            return datetime.fromisoformat(dt_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return datetime.now(timezone.utc)

    def _parse_reviewers(self, review_requests: list | None) -> list[str]:
        """Parse review requests into list of usernames."""
        if not review_requests:
            return []
        reviewers = []
        for req in review_requests:
            if isinstance(req, dict):
                # Gitea returns reviewer directly in the list
                login = req.get("login", "")
                if login:
                    reviewers.append(login)
        return reviewers
