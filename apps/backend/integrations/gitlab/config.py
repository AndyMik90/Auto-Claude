"""
GitLab Integration Configuration
=================================

Configuration and state management for GitLab integration.
Supports self-hosted GitLab instances with OAuth authentication.
"""

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional

# GitLab Status Constants (matching GitLab issue states)
STATUS_OPENED = "opened"
STATUS_CLOSED = "closed"
STATUS_MERGED = "merged"  # For MRs
STATUS_LOCKED = "locked"

# Priority/Weight mapping
WEIGHT_HIGH = 9
WEIGHT_MEDIUM = 5
WEIGHT_LOW = 1

# Subtask status to GitLab state mapping
SUBTASK_TO_GITLAB_STATE = {
    "pending": STATUS_OPENED,
    "in_progress": STATUS_OPENED,
    "review": STATUS_OPENED,
    "completed": STATUS_CLOSED,
    "blocked": STATUS_OPENED,  # GitLab doesn't have blocked, use label
    "failed": STATUS_OPENED,
    "stuck": STATUS_OPENED,
}

# Label constants
LABELS = {
    "phase": "phase",
    "service": "service",
    "stuck": "stuck",
    "blocked": "blocked",
    "needs_review": "needs-review",
    "in_progress": "in-progress",
}


def get_creator_label(email: str = None, username: str = None) -> str:
    """
    Get a label identifying the creator based on GitLab email or username.

    Uses the username if provided, otherwise extracts from email.
    Falls back to checking environment variables.

    Args:
        email: GitLab email address
        username: GitLab username (preferred)

    Returns:
        Creator label string (e.g., "created-by-john-doe")
    """
    # Prefer username if available
    if username:
        name = username.lower().replace(".", "-").replace("_", "-")
        return f"created-by-{name}"

    # Fall back to email
    if not email:
        email = os.environ.get("GITLAB_EMAIL", "") or os.environ.get("GITLAB_USER_EMAIL", "")

    if email and "@" in email:
        name = email.split("@")[0]
        name = name.lower().replace(".", "-").replace("_", "-")
        return f"created-by-{name}"

    return ""

# Project marker file
GITLAB_PROJECT_MARKER = ".gitlab_project.json"


@dataclass
class GitLabConfig:
    """Configuration for GitLab integration."""

    # GitLab instance settings
    url: str = ""  # e.g., https://gitlab.company.com
    api_version: str = "v4"

    # OAuth settings (for multi-user)
    client_id: str = ""
    client_secret: str = ""
    redirect_uri: str = "http://localhost:8765/oauth/callback"

    # Or Personal Access Token (for single user/automation)
    personal_token: str = ""

    # Project settings
    project_id: str = ""  # Can be numeric ID or path like "group/project"
    default_branch: str = "main"

    # Feature flags
    enabled: bool = True
    use_oauth: bool = True  # False to use PAT instead

    @classmethod
    def from_env(cls) -> "GitLabConfig":
        """Create config from environment variables."""
        return cls(
            url=os.environ.get("GITLAB_URL", ""),
            client_id=os.environ.get("GITLAB_CLIENT_ID", ""),
            client_secret=os.environ.get("GITLAB_CLIENT_SECRET", ""),
            redirect_uri=os.environ.get(
                "GITLAB_REDIRECT_URI",
                "http://localhost:8765/oauth/callback"
            ),
            personal_token=os.environ.get("GITLAB_TOKEN", ""),
            project_id=os.environ.get("GITLAB_PROJECT_ID", ""),
            default_branch=os.environ.get("GITLAB_DEFAULT_BRANCH", "main"),
            enabled=os.environ.get("GITLAB_ENABLED", "true").lower() == "true",
            use_oauth=os.environ.get("GITLAB_USE_OAUTH", "true").lower() == "true",
        )

    @classmethod
    def from_file(cls, config_path: str = None) -> Optional["GitLabConfig"]:
        """
        Load config from a JSON file.

        Args:
            config_path: Path to config file (defaults to ~/.auto-claude/gitlab.json)
        """
        if config_path is None:
            config_path = os.path.expanduser("~/.auto-claude/gitlab.json")

        if not os.path.exists(config_path):
            return None

        try:
            with open(config_path, encoding="utf-8") as f:
                data = json.load(f)
            return cls(**data)
        except (OSError, json.JSONDecodeError) as e:
            return None

    def save(self, config_path: str = None) -> None:
        """Save config to file."""
        if config_path is None:
            config_path = os.path.expanduser("~/.auto-claude/gitlab.json")

        os.makedirs(os.path.dirname(config_path), exist_ok=True)

        # Don't save sensitive values
        data = {
            "url": self.url,
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "project_id": self.project_id,
            "default_branch": self.default_branch,
            "enabled": self.enabled,
            "use_oauth": self.use_oauth,
        }

        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def is_valid(self) -> bool:
        """Check if config has minimum required values."""
        if not self.url:
            return False

        # Need either OAuth or PAT
        has_oauth = bool(self.client_id)
        has_pat = bool(self.personal_token)

        return has_oauth or has_pat

    @property
    def api_url(self) -> str:
        """Get the API base URL."""
        return f"{self.url.rstrip('/')}/api/{self.api_version}"


@dataclass
class GitLabProjectState:
    """State of GitLab integration for an auto-claude spec."""

    initialized: bool = False
    project_id: str = ""
    project_path: str = ""  # group/project format
    project_name: str = ""
    default_branch: str = "main"
    meta_issue_iid: int = 0  # GitLab uses iid (internal ID) within project
    total_issues: int = 0
    created_at: str = ""
    issue_mapping: dict[str, int] = field(default_factory=dict)  # subtask_id -> issue_iid
    mr_mapping: dict[str, int] = field(default_factory=dict)  # subtask_id -> MR iid

    def to_dict(self) -> dict:
        return {
            "initialized": self.initialized,
            "project_id": self.project_id,
            "project_path": self.project_path,
            "project_name": self.project_name,
            "default_branch": self.default_branch,
            "meta_issue_iid": self.meta_issue_iid,
            "total_issues": self.total_issues,
            "created_at": self.created_at,
            "issue_mapping": self.issue_mapping,
            "mr_mapping": self.mr_mapping,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "GitLabProjectState":
        return cls(
            initialized=data.get("initialized", False),
            project_id=data.get("project_id", ""),
            project_path=data.get("project_path", ""),
            project_name=data.get("project_name", ""),
            default_branch=data.get("default_branch", "main"),
            meta_issue_iid=data.get("meta_issue_iid", 0),
            total_issues=data.get("total_issues", 0),
            created_at=data.get("created_at", ""),
            issue_mapping=data.get("issue_mapping", {}),
            mr_mapping=data.get("mr_mapping", {}),
        )

    def save(self, spec_dir: Path) -> None:
        """Save state to the spec directory."""
        marker_file = spec_dir / GITLAB_PROJECT_MARKER
        with open(marker_file, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, spec_dir: Path) -> Optional["GitLabProjectState"]:
        """Load state from the spec directory."""
        marker_file = spec_dir / GITLAB_PROJECT_MARKER
        if not marker_file.exists():
            return None

        try:
            with open(marker_file, encoding="utf-8") as f:
                return cls.from_dict(json.load(f))
        except (OSError, json.JSONDecodeError):
            return None


def get_gitlab_state(subtask_status: str) -> str:
    """Map subtask status to GitLab issue state."""
    return SUBTASK_TO_GITLAB_STATE.get(subtask_status, STATUS_OPENED)


def get_weight_for_phase(phase_num: int, total_phases: int) -> int:
    """
    Determine GitLab issue weight based on phase.

    Earlier phases get higher weight (more important).
    """
    if total_phases <= 1:
        return WEIGHT_HIGH

    position = phase_num / total_phases

    if position <= 0.25:
        return WEIGHT_HIGH
    elif position <= 0.5:
        return WEIGHT_HIGH - 2
    elif position <= 0.75:
        return WEIGHT_MEDIUM
    else:
        return WEIGHT_LOW


def get_labels_for_subtask(subtask: dict, email: str = None, username: str = None) -> list[str]:
    """
    Generate GitLab labels for a subtask.

    Args:
        subtask: Subtask data from implementation plan
        email: Creator email for attribution label
        username: Creator username for attribution label (preferred over email)
    """
    labels = []

    # Add creator label instead of "auto-claude"
    creator_label = get_creator_label(email, username)
    if creator_label:
        labels.append(creator_label)

    if subtask.get("service"):
        labels.append(f"{LABELS['service']}::{subtask['service']}")

    if subtask.get("phase_num"):
        labels.append(f"{LABELS['phase']}::{subtask['phase_num']}")

    status = subtask.get("status", "pending")
    if status == "in_progress":
        labels.append(LABELS["in_progress"])
    elif status in ("blocked", "stuck", "failed"):
        labels.append(LABELS["blocked"])
        if status == "stuck":
            labels.append(LABELS["stuck"])

    return labels


def format_issue_description(
    subtask: dict,
    phase: dict = None,
    creator_email: str = None,
    creator_username: str = None
) -> str:
    """
    Format a subtask as a GitLab issue description.

    Uses GitLab Flavored Markdown (GFM).

    Args:
        subtask: Subtask data from implementation plan
        phase: Phase info dict (optional)
        creator_email: Email of the creator for attribution (optional)
        creator_username: Username of the creator for attribution (optional)
    """
    lines = []

    # Description
    if subtask.get("description"):
        lines.append(f"## Description\n\n{subtask['description']}\n")

    # Service
    if subtask.get("service"):
        lines.append(f"**Service:** `{subtask['service']}`")
    elif subtask.get("all_services"):
        lines.append("**Scope:** All services (integration)")

    # Phase info
    if phase:
        lines.append(f"**Phase:** {phase.get('name', phase.get('id', 'Unknown'))}")

    # Files to modify
    if subtask.get("files_to_modify"):
        lines.append("\n## Files to Modify\n")
        for f in subtask["files_to_modify"]:
            lines.append(f"- `{f}`")

    # Files to create
    if subtask.get("files_to_create"):
        lines.append("\n## Files to Create\n")
        for f in subtask["files_to_create"]:
            lines.append(f"- `{f}`")

    # Patterns to follow
    if subtask.get("patterns_from"):
        lines.append("\n## Reference Patterns\n")
        for f in subtask["patterns_from"]:
            lines.append(f"- `{f}`")

    # Verification
    if subtask.get("verification"):
        v = subtask["verification"]
        lines.append("\n## Verification\n")
        lines.append(f"**Type:** {v.get('type', 'none')}")
        if v.get("run"):
            lines.append(f"**Command:** `{v['run']}`")
        if v.get("url"):
            lines.append(f"**URL:** {v['url']}")

    # Attribution - use username/email if provided
    lines.append("\n---")
    if creator_username:
        lines.append(f"_Created by @{creator_username}_")
    elif creator_email:
        display_name = creator_email.split("@")[0] if "@" in creator_email else creator_email
        lines.append(f"_Created by {display_name}_")
    else:
        # Fallback to checking env
        email = os.environ.get("GITLAB_EMAIL", "") or os.environ.get("GITLAB_USER_EMAIL", "")
        if email and "@" in email:
            display_name = email.split("@")[0]
            lines.append(f"_Created by {display_name}_")

    return "\n".join(lines)


def format_session_note(
    session_num: int,
    subtask_id: str,
    success: bool,
    approach: str = "",
    error: str = "",
    git_commit: str = "",
) -> str:
    """Format a session result as a GitLab issue note (comment)."""
    status_emoji = ":white_check_mark:" if success else ":x:"

    lines = [
        f"## Session #{session_num} {status_emoji}",
        "",
        f"**Subtask:** `{subtask_id}`",
        f"**Status:** {'Completed' if success else 'In Progress'}",
        f"**Time:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    ]

    if approach:
        lines.append(f"\n**Approach:** {approach}")

    if git_commit:
        lines.append(f"\n**Commit:** `{git_commit[:8]}`")

    if error:
        lines.append(f"\n**Error:**\n```\n{error[:500]}\n```")

    return "\n".join(lines)


def format_stuck_note(
    subtask_id: str,
    attempt_count: int,
    attempts: list[dict],
    reason: str = "",
) -> str:
    """Format a detailed note for stuck subtasks."""
    lines = [
        "## :warning: Subtask Marked as STUCK",
        "",
        f"**Subtask:** `{subtask_id}`",
        f"**Attempts:** {attempt_count}",
        f"**Time:** {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    ]

    if reason:
        lines.append(f"\n**Reason:** {reason}")

    if attempts:
        lines.append("\n### Attempt History\n")
        for i, attempt in enumerate(attempts[-5:], 1):
            status = ":white_check_mark:" if attempt.get("success") else ":x:"
            lines.append(f"**Attempt {i}:** {status}")
            if attempt.get("approach"):
                lines.append(f"- Approach: {attempt['approach'][:200]}")
            if attempt.get("error"):
                lines.append(f"- Error: {attempt['error'][:200]}")
            lines.append("")

    lines.append("### Recommended Actions\n")
    lines.append("1. Review the approach and error patterns above")
    lines.append("2. Check for missing dependencies or configuration")
    lines.append("3. Consider manual intervention or different approach")
    lines.append("4. Update HUMAN_INPUT.md with guidance for the agent")

    return "\n".join(lines)
