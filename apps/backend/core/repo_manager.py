"""
Repository Manager - Abstraction for Standalone and Workspace Repositories
===========================================================================

RepoManager provides a unified interface for managing Git repositories, whether they are:
1. Standalone projects (traditional single-repo projects)
2. Workspace repositories (repos within a multi-repo workspace)

This abstraction allows Auto-Claude to work with complex project structures where
the project root may contain multiple Git repositories without itself being a Git repo.

Key concepts:
- project_dir: The actual Git repository path (where .git exists)
- workspace_dir: The workspace root (may be same as project_dir for standalone)
- auto_claude_dir: Always at workspace level (.auto-claude/)

Usage:
    # Standalone project (project_dir == workspace_dir)
    repo = RepoManager(project_dir=Path("/my/project"))

    # Workspace repository
    repo = RepoManager(
        project_dir=Path("/workspace/frontend"),
        workspace_dir=Path("/workspace"),
        repo_id="frontend-repo"
    )

    # Get WorktreeManager for this repo
    worktree_mgr = repo.get_worktree_manager()
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .worktree import WorktreeManager


class RepoManager:
    """
    Manages a Git repository within a standalone project or workspace context.

    Provides a unified interface for accessing:
    - The .auto-claude directory (always at workspace level)
    - Specs directory
    - WorktreeManager with proper isolation
    """

    def __init__(
        self,
        project_dir: Path,
        workspace_dir: Path | None = None,
        repo_id: str | None = None,
        base_branch: str | None = None,
    ):
        """
        Initialize the RepoManager.

        Args:
            project_dir: Path to the actual Git repository (must contain .git)
            workspace_dir: Path to the workspace root (defaults to project_dir for standalone)
            repo_id: Unique identifier for this repo within the workspace (required if workspace_dir != project_dir)
            base_branch: Base branch for worktrees (default: auto-detected)
        """
        self.project_dir = Path(project_dir).resolve()
        self.workspace_dir = Path(workspace_dir).resolve() if workspace_dir else self.project_dir
        self.repo_id = repo_id
        self.base_branch = base_branch
        self._worktree_manager: WorktreeManager | None = None

        # Validate: if workspace differs from project, repo_id is required
        if self.workspace_dir != self.project_dir and not repo_id:
            raise ValueError("repo_id is required when workspace_dir differs from project_dir")

    @property
    def is_workspace_repo(self) -> bool:
        """Check if this repo is part of a workspace (vs standalone)."""
        return self.workspace_dir != self.project_dir

    @property
    def auto_claude_dir(self) -> Path:
        """Get the .auto-claude directory path (always at workspace level)."""
        return self.workspace_dir / ".auto-claude"

    @property
    def specs_dir(self) -> Path:
        """Get the specs directory path."""
        return self.auto_claude_dir / "specs"

    @property
    def ideation_dir(self) -> Path:
        """Get the ideation directory path."""
        return self.auto_claude_dir / "ideation"

    @property
    def insights_dir(self) -> Path:
        """Get the insights directory path."""
        return self.auto_claude_dir / "insights"

    @property
    def roadmap_dir(self) -> Path:
        """Get the roadmap directory path."""
        return self.auto_claude_dir / "roadmap"

    @property
    def worktrees_base_dir(self) -> Path:
        """
        Get the base directory for worktrees.

        For standalone projects: .auto-claude/worktrees/tasks/
        For workspace repos: .auto-claude/worktrees/repos/{repo_id}/
        """
        if self.is_workspace_repo and self.repo_id:
            return self.auto_claude_dir / "worktrees" / "repos" / self.repo_id
        return self.auto_claude_dir / "worktrees" / "tasks"

    def get_worktree_manager(self) -> WorktreeManager:
        """
        Get a WorktreeManager for this repository.

        The WorktreeManager is configured with the appropriate worktrees directory
        based on whether this is a standalone project or workspace repository.

        Returns:
            WorktreeManager instance for this repo
        """
        if self._worktree_manager is None:
            from .worktree import WorktreeManager

            self._worktree_manager = WorktreeManager(
                project_dir=self.project_dir,
                base_branch=self.base_branch,
                worktrees_dir=self.worktrees_base_dir if self.is_workspace_repo else None,
            )
        return self._worktree_manager

    def get_spec_dir(self, spec_name: str) -> Path:
        """Get the directory for a specific spec."""
        return self.specs_dir / spec_name

    def ensure_directories(self) -> None:
        """Ensure all required directories exist."""
        for dir_path in [
            self.auto_claude_dir,
            self.specs_dir,
            self.ideation_dir,
            self.insights_dir,
            self.roadmap_dir,
        ]:
            dir_path.mkdir(parents=True, exist_ok=True)

        # Also ensure worktrees base dir for workspace repos
        if self.is_workspace_repo:
            self.worktrees_base_dir.mkdir(parents=True, exist_ok=True)

    @classmethod
    def from_workspace_config(
        cls,
        workspace_dir: Path,
        repo_id: str,
        base_branch: str | None = None,
    ) -> RepoManager:
        """
        Create a RepoManager from workspace configuration.

        Args:
            workspace_dir: Path to the workspace root
            repo_id: ID of the repository to load
            base_branch: Optional base branch override

        Returns:
            RepoManager instance for the specified repo

        Raises:
            FileNotFoundError: If workspace.json doesn't exist
            KeyError: If repo_id not found in workspace config
        """
        workspace_config_path = workspace_dir / ".auto-claude" / "workspace.json"

        if not workspace_config_path.exists():
            raise FileNotFoundError(f"Workspace config not found: {workspace_config_path}")

        with open(workspace_config_path, encoding="utf-8") as f:
            config = json.load(f)

        # Find the repo in the config
        repo_config = None
        for repo in config.get("repos", []):
            if repo.get("id") == repo_id:
                repo_config = repo
                break

        if repo_config is None:
            raise KeyError(f"Repository '{repo_id}' not found in workspace config")

        project_dir = workspace_dir / repo_config["relativePath"]

        return cls(
            project_dir=project_dir,
            workspace_dir=workspace_dir,
            repo_id=repo_id,
            base_branch=base_branch or repo_config.get("mainBranch"),
        )

    @classmethod
    def from_project_dir(
        cls,
        project_dir: Path,
        base_branch: str | None = None,
    ) -> RepoManager:
        """
        Create a RepoManager by auto-detecting the project type.

        Checks if the project is part of a workspace (has workspace.json in a parent)
        or is a standalone project.

        Args:
            project_dir: Path to the project or repository
            base_branch: Optional base branch override

        Returns:
            RepoManager instance
        """
        project_dir = Path(project_dir).resolve()

        # Check if this is within a workspace by looking for workspace.json in parent directories
        current = project_dir
        while current != current.parent:
            workspace_config = current / ".auto-claude" / "workspace.json"
            if workspace_config.exists():
                # Found a workspace - find which repo this is
                with open(workspace_config, encoding="utf-8") as f:
                    config = json.load(f)

                for repo in config.get("repos", []):
                    repo_path = (current / repo["relativePath"]).resolve()
                    if repo_path == project_dir:
                        return cls(
                            project_dir=project_dir,
                            workspace_dir=current,
                            repo_id=repo["id"],
                            base_branch=base_branch or repo.get("mainBranch"),
                        )

                # Project dir is within workspace but not a registered repo
                # Treat as standalone
                break

            current = current.parent

        # Standalone project
        return cls(project_dir=project_dir, base_branch=base_branch)

    def __repr__(self) -> str:
        if self.is_workspace_repo:
            return f"RepoManager(workspace={self.workspace_dir}, repo_id={self.repo_id!r})"
        return f"RepoManager(project={self.project_dir})"
