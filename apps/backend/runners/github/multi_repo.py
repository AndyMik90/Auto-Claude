"""
Multi-Repository Support
========================

Enables GitHub automation across multiple repositories with:
- Per-repo configuration and state isolation
- Path scoping for monorepos
- Fork/upstream relationship detection
- Cross-repo duplicate detection

Usage:
    # Configure multiple repos
    config = MultiRepoConfig([
        RepoConfig(repo="owner/frontend", path_scope="packages/frontend/*"),
        RepoConfig(repo="owner/backend", path_scope="packages/backend/*"),
        RepoConfig(repo="owner/shared"),  # Full repo
    ])

    # Get isolated state for a repo
    repo_state = config.get_repo_state("owner/frontend")
"""

from __future__ import annotations

import fnmatch
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any


class RepoRelationship(str, Enum):
    """Relationship between repositories."""

    STANDALONE = "standalone"
    FORK = "fork"
    UPSTREAM = "upstream"
    MONOREPO_PACKAGE = "monorepo_package"


@dataclass
class RepoConfig:
    """
    Configuration for a single repository.

    Attributes:
        repo: Repository in owner/repo format
        path_scope: Glob pattern to scope automation (for monorepos)
        enabled: Whether automation is enabled for this repo
        relationship: Relationship to other repos
        upstream_repo: Upstream repo if this is a fork
        labels: Label configuration overrides
        trust_level: Trust level for this repo
    """

    repo: str  # owner/repo format
    path_scope: str | None = None  # e.g., "packages/frontend/*"
    enabled: bool = True
    relationship: RepoRelationship = RepoRelationship.STANDALONE
    upstream_repo: str | None = None
    labels: dict[str, list[str]] = field(
        default_factory=dict
    )  # e.g., {"auto_fix": ["fix-me"]}
    trust_level: int = 0  # 0-4 trust level
    display_name: str | None = None  # Human-readable name

    # Feature toggles per repo
    auto_fix_enabled: bool = True
    pr_review_enabled: bool = True
    triage_enabled: bool = True

    def __post_init__(self):
        if not self.display_name:
            if self.path_scope:
                # Use path scope for monorepo packages
                self.display_name = f"{self.repo} ({self.path_scope})"
            else:
                self.display_name = self.repo

    @property
    def owner(self) -> str:
        """Get repository owner."""
        return self.repo.split("/")[0]

    @property
    def name(self) -> str:
        """Get repository name."""
        return self.repo.split("/")[1]

    @property
    def state_key(self) -> str:
        """
        Get unique key for state isolation.

        For monorepos with path scopes, includes a hash of the scope.
        """
        if self.path_scope:
            # Create a safe directory name from the scope
            scope_safe = re.sub(r"[^\w-]", "_", self.path_scope)
            return f"{self.repo.replace('/', '_')}_{scope_safe}"
        return self.repo.replace("/", "_")

    def matches_path(self, file_path: str) -> bool:
        """
        Check if a file path matches this repo's scope.

        Args:
            file_path: File path to check

        Returns:
            True if path matches scope (or no scope defined)
        """
        if not self.path_scope:
            return True
        return fnmatch.fnmatch(file_path, self.path_scope)

    def to_dict(self) -> dict[str, Any]:
        return {
            "repo": self.repo,
            "path_scope": self.path_scope,
            "enabled": self.enabled,
            "relationship": self.relationship.value,
            "upstream_repo": self.upstream_repo,
            "labels": self.labels,
            "trust_level": self.trust_level,
            "display_name": self.display_name,
            "auto_fix_enabled": self.auto_fix_enabled,
            "pr_review_enabled": self.pr_review_enabled,
            "triage_enabled": self.triage_enabled,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> RepoConfig:
        return cls(
            repo=data["repo"],
            path_scope=data.get("path_scope"),
            enabled=data.get("enabled", True),
            relationship=RepoRelationship(data.get("relationship", "standalone")),
            upstream_repo=data.get("upstream_repo"),
            labels=data.get("labels", {}),
            trust_level=data.get("trust_level", 0),
            display_name=data.get("display_name"),
            auto_fix_enabled=data.get("auto_fix_enabled", True),
            pr_review_enabled=data.get("pr_review_enabled", True),
            triage_enabled=data.get("triage_enabled", True),
        )


@dataclass
class RepoState:
    """
    Isolated state for a repository.

    Each repo has its own state directory to prevent conflicts.
    """

    config: RepoConfig
    state_dir: Path
    last_sync: str | None = None

    @property
    def pr_dir(self) -> Path:
        """Directory for PR review state."""
        d = self.state_dir / "pr"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def issues_dir(self) -> Path:
        """Directory for issue state."""
        d = self.state_dir / "issues"
        d.mkdir(parents=True, exist_ok=True)
        return d

    @property
    def audit_dir(self) -> Path:
        """Directory for audit logs."""
        d = self.state_dir / "audit"
        d.mkdir(parents=True, exist_ok=True)
        return d


class MultiRepoConfig:
    """
    Configuration manager for multiple repositories.

    Handles:
    - Multiple repo configurations
    - State isolation per repo
    - Fork/upstream relationship detection
    - Cross-repo operations
    """

    def __init__(
        self,
        repos: list[RepoConfig] | None = None,
        base_dir: Path | None = None,
    ):
        """
        Initialize multi-repo configuration.

        Args:
            repos: List of repository configurations
            base_dir: Base directory for all repo state
        """
        self.repos: dict[str, RepoConfig] = {}
        self.base_dir = base_dir or Path(".auto-claude/github/repos")
        self.base_dir.mkdir(parents=True, exist_ok=True)

        if repos:
            for repo in repos:
                self.add_repo(repo)

    def add_repo(self, config: RepoConfig) -> None:
        """Add a repository configuration."""
        self.repos[config.state_key] = config

    def remove_repo(self, repo: str) -> bool:
        """Remove a repository configuration."""
        key = repo.replace("/", "_")
        if key in self.repos:
            del self.repos[key]
            return True
        return False

    def get_repo(self, repo: str) -> RepoConfig | None:
        """
        Get configuration for a repository.

        Args:
            repo: Repository in owner/repo format

        Returns:
            RepoConfig if found, None otherwise
        """
        key = repo.replace("/", "_")
        return self.repos.get(key)

    def get_repo_for_path(self, repo: str, file_path: str) -> RepoConfig | None:
        """
        Get the most specific repo config for a file path.

        Useful for monorepos where different packages have different configs.

        Args:
            repo: Repository in owner/repo format
            file_path: File path within the repo

        Returns:
            Most specific matching RepoConfig
        """
        matches = []
        for config in self.repos.values():
            if config.repo != repo:
                continue
            if config.matches_path(file_path):
                matches.append(config)

        if not matches:
            return None

        # Return most specific (longest path scope)
        return max(matches, key=lambda c: len(c.path_scope or ""))

    def get_repo_state(self, repo: str) -> RepoState | None:
        """
        Get isolated state for a repository.

        Args:
            repo: Repository in owner/repo format

        Returns:
            RepoState with isolated directories
        """
        config = self.get_repo(repo)
        if not config:
            return None

        state_dir = self.base_dir / config.state_key
        state_dir.mkdir(parents=True, exist_ok=True)

        return RepoState(
            config=config,
            state_dir=state_dir,
        )

    def list_repos(self, enabled_only: bool = True) -> list[RepoConfig]:
        """
        List all configured repositories.

        Args:
            enabled_only: Only return enabled repos

        Returns:
            List of RepoConfig objects
        """
        repos = list(self.repos.values())
        if enabled_only:
            repos = [r for r in repos if r.enabled]
        return repos

    def get_forks(self) -> dict[str, str]:
        """
        Get fork relationships.

        Returns:
            Dict mapping fork repo to upstream repo
        """
        return {
            c.repo: c.upstream_repo
            for c in self.repos.values()
            if c.relationship == RepoRelationship.FORK and c.upstream_repo
        }

    def get_monorepo_packages(self, repo: str) -> list[RepoConfig]:
        """
        Get all packages in a monorepo.

        Args:
            repo: Base repository name

        Returns:
            List of RepoConfig for each package
        """
        return [
            c
            for c in self.repos.values()
            if c.repo == repo
            and c.relationship == RepoRelationship.MONOREPO_PACKAGE
            and c.path_scope
        ]

    def save(self, config_file: Path | None = None) -> None:
        """Save configuration to file."""
        file_path = config_file or (self.base_dir / "multi_repo_config.json")
        data = {
            "repos": [c.to_dict() for c in self.repos.values()],
            "last_updated": datetime.now(timezone.utc).isoformat(),
        }
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def load(cls, config_file: Path) -> MultiRepoConfig:
        """Load configuration from file."""
        if not config_file.exists():
            return cls()

        with open(config_file, encoding="utf-8") as f:
            data = json.load(f)

        repos = [RepoConfig.from_dict(r) for r in data.get("repos", [])]
        return cls(repos=repos, base_dir=config_file.parent)


class CrossRepoDetector:
    """
    Detects relationships and duplicates across repositories.
    """

    def __init__(self, config: MultiRepoConfig):
        self.config = config

    async def detect_fork_relationship(
        self,
        repo: str,
        gh_client,
    ) -> tuple[RepoRelationship, str | None]:
        """
        Detect if a repo is a fork and find its upstream.

        Args:
            repo: Repository to check
            gh_client: GitHub client for API calls

        Returns:
            Tuple of (relationship, upstream_repo or None)
        """
        try:
            repo_data = await gh_client.api_get(f"/repos/{repo}")

            if repo_data.get("fork"):
                parent = repo_data.get("parent", {})
                upstream = parent.get("full_name")
                if upstream:
                    return RepoRelationship.FORK, upstream

            return RepoRelationship.STANDALONE, None

        except Exception:
            return RepoRelationship.STANDALONE, None

    async def find_cross_repo_duplicates(
        self,
        issue_title: str,
        issue_body: str,
        source_repo: str,
        gh_client,
    ) -> list[dict[str, Any]]:
        """
        Find potential duplicate issues across configured repos.

        Args:
            issue_title: Issue title to search for
            issue_body: Issue body
            source_repo: Source repository
            gh_client: GitHub client

        Returns:
            List of potential duplicate issues from other repos
        """
        duplicates = []

        # Get related repos (same owner, forks, etc.)
        related_repos = self._get_related_repos(source_repo)

        for repo in related_repos:
            try:
                # Search for similar issues
                query = f"repo:{repo} is:issue {issue_title}"
                results = await gh_client.api_get(
                    "/search/issues",
                    params={"q": query, "per_page": 5},
                )

                for item in results.get("items", []):
                    if item.get("repository_url", "").endswith(source_repo):
                        continue  # Skip same repo

                    duplicates.append(
                        {
                            "repo": repo,
                            "number": item["number"],
                            "title": item["title"],
                            "url": item["html_url"],
                            "state": item["state"],
                        }
                    )

            except Exception:
                continue

        return duplicates

    def _get_related_repos(self, source_repo: str) -> list[str]:
        """Get repos related to the source (same owner, forks, etc.)."""
        related = []
        source_owner = source_repo.split("/")[0]

        for config in self.config.repos.values():
            if config.repo == source_repo:
                continue

            # Same owner
            if config.owner == source_owner:
                related.append(config.repo)
                continue

            # Fork relationship
            if config.upstream_repo == source_repo:
                related.append(config.repo)
            elif (
                config.repo == self.config.get_repo(source_repo).upstream_repo
                if self.config.get_repo(source_repo)
                else None
            ):
                related.append(config.repo)

        return related


# Convenience functions


def create_monorepo_config(
    repo: str,
    packages: list[dict[str, str]],
) -> list[RepoConfig]:
    """
    Create configs for a monorepo with multiple packages.

    Args:
        repo: Base repository name
        packages: List of package definitions with name and path_scope

    Returns:
        List of RepoConfig for each package

    Example:
        configs = create_monorepo_config(
            repo="owner/monorepo",
            packages=[
                {"name": "frontend", "path_scope": "packages/frontend/**"},
                {"name": "backend", "path_scope": "packages/backend/**"},
                {"name": "shared", "path_scope": "packages/shared/**"},
            ],
        )
    """
    configs = []
    for pkg in packages:
        configs.append(
            RepoConfig(
                repo=repo,
                path_scope=pkg.get("path_scope"),
                display_name=pkg.get("name", pkg.get("path_scope")),
                relationship=RepoRelationship.MONOREPO_PACKAGE,
            )
        )
    return configs


# ============================================
# Frontend Compatibility Functions
# ============================================


def load_frontend_github_config(project_dir: Path) -> MultiRepoConfig | None:
    """
    Load GitHub configuration from the frontend's github.json file.

    The frontend stores multi-repo configuration in:
    {project_dir}/.auto-claude/github.json

    This function reads and converts it to the backend's MultiRepoConfig format.

    Args:
        project_dir: Path to the project directory

    Returns:
        MultiRepoConfig if file exists and is valid, None otherwise
    """
    github_json_path = project_dir / ".auto-claude" / "github.json"

    if not github_json_path.exists():
        return None

    try:
        with open(github_json_path, encoding="utf-8") as f:
            data = json.load(f)

        repos = []
        for repo_data in data.get("repos", []):
            repos.append(_frontend_repo_to_backend(repo_data))

        config = MultiRepoConfig(
            repos=repos,
            base_dir=project_dir / ".auto-claude" / "github" / "repos",
        )

        return config

    except (json.JSONDecodeError, FileNotFoundError, KeyError) as e:
        # Log error but return None to fall back to legacy config
        import logging

        logging.warning(f"Failed to load github.json: {e}")
        return None


def _frontend_repo_to_backend(repo_data: dict[str, Any]) -> RepoConfig:
    """
    Convert a frontend GitHubRepoConfig to backend RepoConfig.

    Frontend format:
        {
            repo: string,
            enabled?: boolean,
            issuesSyncEnabled?: boolean,
            prReviewEnabled?: boolean,
            autoFixEnabled?: boolean,
            pathScope?: string,
            relationship?: 'standalone' | 'fork' | 'upstream' | 'monorepo_package'
        }

    Backend format:
        RepoConfig with snake_case field names and additional fields
    """
    relationship_str = repo_data.get("relationship", "standalone")
    relationship = RepoRelationship(relationship_str)

    return RepoConfig(
        repo=repo_data["repo"],
        path_scope=repo_data.get("pathScope"),
        enabled=repo_data.get("enabled", True),
        relationship=relationship,
        # Frontend uses issuesSyncEnabled for triage
        triage_enabled=repo_data.get("issuesSyncEnabled", True),
        pr_review_enabled=repo_data.get("prReviewEnabled", True),
        auto_fix_enabled=repo_data.get("autoFixEnabled", False),
    )


def get_enabled_repos(project_dir: Path) -> list[RepoConfig]:
    """
    Get all enabled repositories for a project.

    Tries to load from frontend's github.json first,
    falls back to legacy .env GITHUB_REPO if not found.

    Args:
        project_dir: Path to the project directory

    Returns:
        List of enabled RepoConfig objects
    """
    # Try frontend config first
    config = load_frontend_github_config(project_dir)
    if config:
        return config.list_repos(enabled_only=True)

    # Fall back to legacy .env config
    legacy_repo = _get_legacy_repo(project_dir)
    if legacy_repo:
        return [
            RepoConfig(
                repo=legacy_repo,
                enabled=True,
                triage_enabled=True,
                pr_review_enabled=True,
                auto_fix_enabled=True,
            )
        ]

    return []


def get_default_repo(project_dir: Path) -> str | None:
    """
    Get the default repository for a project.

    Args:
        project_dir: Path to the project directory

    Returns:
        Repository name in owner/repo format, or None if not configured
    """
    github_json_path = project_dir / ".auto-claude" / "github.json"

    if github_json_path.exists():
        try:
            with open(github_json_path, encoding="utf-8") as f:
                data = json.load(f)

            # Use explicit default if set
            if data.get("defaultRepo"):
                return data["defaultRepo"]

            # Fall back to first enabled repo
            repos = data.get("repos", [])
            for repo in repos:
                if repo.get("enabled", True):
                    return repo["repo"]

        except (json.JSONDecodeError, FileNotFoundError):
            pass

    # Fall back to legacy config
    return _get_legacy_repo(project_dir)


def _get_legacy_repo(project_dir: Path) -> str | None:
    """
    Get repository from legacy .env GITHUB_REPO.

    Args:
        project_dir: Path to the project directory

    Returns:
        Repository name or None
    """
    env_path = project_dir / ".auto-claude" / ".env"
    if not env_path.exists():
        return None

    try:
        with open(env_path, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line.startswith("GITHUB_REPO="):
                    return line.split("=", 1)[1].strip().strip('"').strip("'")
    except FileNotFoundError:
        pass

    return None


def get_repo_config(project_dir: Path, repo: str) -> RepoConfig | None:
    """
    Get configuration for a specific repository.

    Args:
        project_dir: Path to the project directory
        repo: Repository in owner/repo format

    Returns:
        RepoConfig if found, None otherwise
    """
    config = load_frontend_github_config(project_dir)
    if config:
        return config.get_repo(repo)

    # Check if it's the legacy repo
    legacy_repo = _get_legacy_repo(project_dir)
    if legacy_repo and legacy_repo == repo:
        return RepoConfig(
            repo=legacy_repo,
            enabled=True,
            triage_enabled=True,
            pr_review_enabled=True,
            auto_fix_enabled=True,
        )

    return None
