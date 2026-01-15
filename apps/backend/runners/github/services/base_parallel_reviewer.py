"""
Base Parallel Reviewer
======================

Abstract base class for parallel PR reviewers using Claude Agent SDK subagents.

This class provides shared functionality for:
- SDK client initialization
- Progress reporting
- Prompt loading
- Worktree management
- Finding deduplication

Subclasses:
- ParallelOrchestratorReviewer: Initial PR review
- ParallelFollowupReviewer: Follow-up PR review
"""

from __future__ import annotations

import logging
import os
from abc import ABC, abstractmethod
from pathlib import Path
from typing import TYPE_CHECKING, Any

from claude_agent_sdk import AgentDefinition

if TYPE_CHECKING:
    from ..models import GitHubRunnerConfig, PRReviewFinding, PRReviewResult

try:
    # Relative imports for package-style imports (e.g., from runners.github.services...)
    # These may fail depending on how Python resolves the package hierarchy
    from ...core.client import create_client
    from ...phase_config import get_thinking_budget
    from ..context_gatherer import _validate_git_ref
    from ..models import (
        GitHubRunnerConfig,
        PRReviewFinding,
    )
    from .callbacks import ProgressCallback
    from .pr_worktree_manager import PRWorktreeManager
except (ImportError, ValueError, SystemError):
    # Fallback imports for running from runners/github directory
    # Requires PYTHONPATH to include both apps/backend and apps/backend/runners/github
    from context_gatherer import _validate_git_ref
    from core.client import create_client
    from models import (
        GitHubRunnerConfig,
        PRReviewFinding,
    )
    from phase_config import get_thinking_budget
    from services.callbacks import ProgressCallback
    from services.pr_worktree_manager import PRWorktreeManager


logger = logging.getLogger(__name__)

# Check if debug mode is enabled
DEBUG_MODE = os.environ.get("DEBUG", "").lower() in ("true", "1", "yes")

# Directory for PR review worktrees (shared across all parallel reviewers)
PR_WORKTREE_DIR = ".auto-claude/github/pr/worktrees"


class BaseParallelReviewer(ABC):
    """
    Abstract base class for PR reviewers using SDK subagents for parallel specialist analysis.

    Provides shared functionality:
    - Initialization with project_dir, github_dir, config, and progress_callback
    - Progress reporting via callback
    - Prompt loading from prompts/github directory
    - Worktree creation/cleanup for isolated PR review
    - Finding deduplication

    Subclasses must implement:
    - _define_specialist_agents(): Define subagents for this reviewer type
    - review(): Main review entry point
    """

    def __init__(
        self,
        project_dir: Path,
        github_dir: Path,
        config: GitHubRunnerConfig,
        progress_callback=None,
    ):
        """Initialize the parallel reviewer.

        Args:
            project_dir: Root directory of the project being reviewed
            github_dir: Directory for GitHub runner data
            config: GitHub runner configuration (model, thinking level, etc.)
            progress_callback: Optional callback for progress updates
        """
        self.project_dir = Path(project_dir)
        self.github_dir = Path(github_dir)
        self.config = config
        self.progress_callback = progress_callback
        self.worktree_manager = PRWorktreeManager(project_dir, PR_WORKTREE_DIR)

    def _report_progress(self, phase: str, progress: int, message: str, **kwargs):
        """Report progress if callback is set.

        Args:
            phase: Current phase name
            progress: Progress percentage (0-100)
            message: Human-readable progress message
            **kwargs: Additional data to include in callback
        """
        if self.progress_callback:
            self.progress_callback(
                ProgressCallback(
                    phase=phase, progress=progress, message=message, **kwargs
                )
            )

    def _load_prompt(self, filename: str) -> str:
        """Load a prompt file from the prompts/github directory.

        Args:
            filename: Name of the prompt file to load

        Returns:
            Contents of the prompt file, or empty string if not found
        """
        prompt_file = (
            Path(__file__).parent.parent.parent.parent / "prompts" / "github" / filename
        )
        if prompt_file.exists():
            return prompt_file.read_text(encoding="utf-8")
        logger.warning(f"Prompt file not found: {prompt_file}")
        return ""

    def _create_pr_worktree(self, head_sha: str, pr_number: int) -> Path:
        """Create a temporary worktree at the PR head commit.

        Args:
            head_sha: The commit SHA of the PR head (validated before use)
            pr_number: The PR number for naming

        Returns:
            Path to the created worktree

        Raises:
            RuntimeError: If worktree creation fails
            ValueError: If head_sha fails validation (command injection prevention)
        """
        # SECURITY: Validate git ref before use in subprocess calls
        if not _validate_git_ref(head_sha):
            raise ValueError(
                f"Invalid git ref: '{head_sha}'. "
                "Must contain only alphanumeric characters, dots, slashes, underscores, and hyphens."
            )

        return self.worktree_manager.create_worktree(head_sha, pr_number)

    def _cleanup_pr_worktree(self, worktree_path: Path) -> None:
        """Remove a temporary PR review worktree with fallback chain.

        Args:
            worktree_path: Path to the worktree to remove
        """
        self.worktree_manager.remove_worktree(worktree_path)

    def _cleanup_stale_pr_worktrees(self) -> None:
        """Clean up orphaned, expired, and excess PR review worktrees on startup."""
        stats = self.worktree_manager.cleanup_worktrees()
        if stats["total"] > 0:
            logger.info(
                f"[PRReview] Cleanup: removed {stats['total']} worktrees "
                f"(orphaned={stats['orphaned']}, expired={stats['expired']}, excess={stats['excess']})"
            )

    def _deduplicate_findings(
        self, findings: list[PRReviewFinding]
    ) -> list[PRReviewFinding]:
        """Remove duplicate findings based on file, line, and title.

        Args:
            findings: List of findings to deduplicate

        Returns:
            List of unique findings
        """
        seen = set()
        unique = []

        for f in findings:
            key = (f.file, f.line, f.title.lower().strip())
            if key not in seen:
                seen.add(key)
                unique.append(f)

        return unique

    def _get_model_and_thinking_budget(self) -> tuple[str, int | None]:
        """Get model and thinking budget from config.

        Returns:
            Tuple of (model_name, thinking_budget)
        """
        model = self.config.model or "claude-sonnet-4-5-20250929"
        thinking_level = self.config.thinking_level or "medium"
        thinking_budget = get_thinking_budget(thinking_level)
        return model, thinking_budget

    def _resolve_project_root(self) -> Path:
        """Resolve the project root directory.

        Handles the case where project_dir might be apps/backend.

        Returns:
            Path to the actual project root
        """
        if self.project_dir.name == "backend":
            return self.project_dir.parent.parent
        return self.project_dir

    def _create_sdk_client(
        self,
        project_root: Path,
        model: str,
        thinking_budget: int | None,
        agent_type: str,
        output_schema: dict[str, Any],
    ):
        """Create SDK client with subagents and configuration.

        Args:
            project_root: Root directory of the project
            model: Model to use for orchestrator
            thinking_budget: Max thinking tokens budget
            agent_type: Type of agent (e.g., "pr_orchestrator_parallel")
            output_schema: JSON schema for structured output

        Returns:
            Configured SDK client instance
        """
        return create_client(
            project_dir=project_root,
            spec_dir=self.github_dir,
            model=model,
            agent_type=agent_type,
            max_thinking_tokens=thinking_budget,
            agents=self._define_specialist_agents(),
            output_format={
                "type": "json_schema",
                "schema": output_schema,
            },
        )

    @abstractmethod
    def _define_specialist_agents(self) -> dict[str, AgentDefinition]:
        """Define specialist agents for the SDK.

        Each agent should have:
        - description: When the orchestrator should invoke this agent
        - prompt: System prompt for the agent
        - tools: Tools the agent can use (read-only for PR review)
        - model: "inherit" = use same model as orchestrator (user's choice)

        Returns:
            Dictionary mapping agent names to AgentDefinition instances
        """

    @abstractmethod
    async def review(self, context: Any) -> PRReviewResult:
        """Main review entry point.

        Args:
            context: PR context (PRContext or FollowupReviewContext)

        Returns:
            PRReviewResult with findings and verdict
        """
