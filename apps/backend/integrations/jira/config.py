"""
JIRA Integration Configuration
==============================

Constants, status mappings, and configuration helpers for JIRA integration.
Follows the same patterns as Linear integration for consistency.
"""

import json
import os
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Dict, List

# JIRA Status Constants (common workflow states)
STATUS_TODO = "To Do"
STATUS_IN_PROGRESS = "In Progress"
STATUS_IN_REVIEW = "In Review"
STATUS_DONE = "Done"
STATUS_BLOCKED = "Blocked"

# JIRA Priority mapping (name -> internal order for sorting)
PRIORITY_ORDER = {
    "Highest": 1,
    "High": 2,
    "Medium": 3,
    "Low": 4,
    "Lowest": 5,
}

# Subtask status to JIRA status mapping
SUBTASK_TO_JIRA_STATUS = {
    "pending": STATUS_TODO,
    "in_progress": STATUS_IN_PROGRESS,
    "review": STATUS_IN_REVIEW,
    "completed": STATUS_DONE,
    "blocked": STATUS_BLOCKED,
    "failed": STATUS_BLOCKED,
    "stuck": STATUS_BLOCKED,
}

# Label constants
LABELS = {
    "phase": "phase",
    "service": "service",
    "stuck": "stuck",
    "needs_review": "needs-review",
}


def get_creator_label(email: str = None) -> str:
    """
    Get a label identifying the creator based on JIRA email.

    Uses the username part of the email (before @) as the label.
    Falls back to no creator label if email not provided.

    Args:
        email: JIRA email address from settings

    Returns:
        Creator label string (e.g., "created-by-john.doe")
    """
    if not email:
        email = os.environ.get("JIRA_EMAIL", "")

    if email and "@" in email:
        username = email.split("@")[0]
        # Sanitize for JIRA label (lowercase, replace dots/underscores with hyphens)
        username = username.lower().replace(".", "-").replace("_", "-")
        return f"created-by-{username}"

    return ""

# JIRA project marker file
JIRA_PROJECT_MARKER = ".jira_project.json"

# Meta issue title for tracking
META_ISSUE_TITLE = "[META] Build Progress Tracker"


@dataclass
class JiraConfig:
    """Configuration for JIRA integration via MCP."""

    mcp_server_name: str = "hc-jira"
    mcp_start_script: str = ""
    host: str = ""
    email: str = ""
    api_token: str = ""
    default_project: str = ""
    enabled: bool = True

    @classmethod
    def from_env(cls) -> "JiraConfig":
        """Create config from environment variables."""
        return cls(
            mcp_server_name=os.environ.get("JIRA_MCP_SERVER", "hc-jira"),
            mcp_start_script=os.environ.get(
                "JIRA_MCP_START_SCRIPT",
                os.path.expanduser("~/vaults/hc/mcp-servers/hc-jira/start.sh")
            ),
            host=os.environ.get("JIRA_HOST", ""),
            email=os.environ.get("JIRA_EMAIL", ""),
            api_token=os.environ.get("JIRA_API_TOKEN", ""),
            default_project=os.environ.get("JIRA_DEFAULT_PROJECT", ""),
            enabled=bool(os.environ.get("JIRA_ENABLED", "true").lower() == "true"),
        )

    @classmethod
    def from_mcp_settings(cls, server_name: str = "hc-jira") -> Optional["JiraConfig"]:
        """
        Load config from Claude Code MCP settings.

        Extracts JIRA configuration from ~/.claude/settings.json
        """
        settings_path = os.path.expanduser("~/.claude/settings.json")

        try:
            with open(settings_path, encoding="utf-8") as f:
                settings = json.load(f)

            servers = settings.get("mcpServers", {})
            server = servers.get(server_name)

            if not server:
                return None

            env = server.get("env", {})

            return cls(
                mcp_server_name=server_name,
                mcp_start_script=server.get("command", ""),
                host=env.get("JIRA_HOST", ""),
                email=env.get("JIRA_EMAIL", ""),
                api_token=env.get("JIRA_API_TOKEN", ""),
                default_project=env.get("JIRA_DEFAULT_PROJECT", ""),
                enabled=True,
            )
        except (OSError, json.JSONDecodeError):
            return None

    def is_valid(self) -> bool:
        """Check if config has minimum required values."""
        # Either MCP script or direct credentials
        has_mcp = bool(self.mcp_start_script and os.path.exists(
            os.path.expanduser(self.mcp_start_script)
        ))
        has_direct = bool(self.host and self.email and self.api_token)
        return has_mcp or has_direct


@dataclass
class JiraProjectState:
    """State of JIRA integration for an auto-claude spec."""

    initialized: bool = False
    project_key: str = ""
    project_name: str = ""
    meta_issue_key: str = ""
    total_issues: int = 0
    created_at: str = ""
    issue_mapping: Dict[str, str] = field(default_factory=dict)  # subtask_id -> issue_key

    def to_dict(self) -> dict:
        return {
            "initialized": self.initialized,
            "project_key": self.project_key,
            "project_name": self.project_name,
            "meta_issue_key": self.meta_issue_key,
            "total_issues": self.total_issues,
            "created_at": self.created_at,
            "issue_mapping": self.issue_mapping,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "JiraProjectState":
        return cls(
            initialized=data.get("initialized", False),
            project_key=data.get("project_key", ""),
            project_name=data.get("project_name", ""),
            meta_issue_key=data.get("meta_issue_key", ""),
            total_issues=data.get("total_issues", 0),
            created_at=data.get("created_at", ""),
            issue_mapping=data.get("issue_mapping", {}),
        )

    def save(self, spec_dir: Path) -> None:
        """Save state to the spec directory."""
        marker_file = spec_dir / JIRA_PROJECT_MARKER
        with open(marker_file, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2)

    @classmethod
    def load(cls, spec_dir: Path) -> Optional["JiraProjectState"]:
        """Load state from the spec directory."""
        marker_file = spec_dir / JIRA_PROJECT_MARKER
        if not marker_file.exists():
            return None

        try:
            with open(marker_file, encoding="utf-8") as f:
                return cls.from_dict(json.load(f))
        except (OSError, json.JSONDecodeError):
            return None


def get_jira_status(subtask_status: str) -> str:
    """
    Map subtask status to JIRA status.

    Args:
        subtask_status: Status from implementation_plan.json

    Returns:
        Corresponding JIRA status string
    """
    return SUBTASK_TO_JIRA_STATUS.get(subtask_status, STATUS_TODO)


def get_priority_for_phase(phase_num: int, total_phases: int) -> str:
    """
    Determine JIRA priority based on phase number.

    Args:
        phase_num: Phase number (1-indexed)
        total_phases: Total number of phases

    Returns:
        JIRA priority name
    """
    if total_phases <= 1:
        return "High"

    position = phase_num / total_phases

    if position <= 0.25:
        return "Highest"
    elif position <= 0.5:
        return "High"
    elif position <= 0.75:
        return "Medium"
    else:
        return "Low"


def format_subtask_description(subtask: dict, phase: dict = None, creator_email: str = None) -> str:
    """
    Format a subtask as a JIRA issue description.

    Uses Atlassian Document Format (ADF) compatible markdown.

    Args:
        subtask: Subtask data from implementation plan
        phase: Phase info dict (optional)
        creator_email: Email of the creator for attribution (optional)
    """
    lines = []

    # Description
    if subtask.get("description"):
        lines.append(f"h2. Description\n{subtask['description']}\n")

    # Service
    if subtask.get("service"):
        lines.append(f"*Service:* {subtask['service']}")
    elif subtask.get("all_services"):
        lines.append("*Scope:* All services (integration)")

    # Phase info
    if phase:
        lines.append(f"*Phase:* {phase.get('name', phase.get('id', 'Unknown'))}")

    # Files to modify
    if subtask.get("files_to_modify"):
        lines.append("\nh2. Files to Modify")
        for f in subtask["files_to_modify"]:
            lines.append(f"* {{code}}{f}{{code}}")

    # Files to create
    if subtask.get("files_to_create"):
        lines.append("\nh2. Files to Create")
        for f in subtask["files_to_create"]:
            lines.append(f"* {{code}}{f}{{code}}")

    # Patterns to follow
    if subtask.get("patterns_from"):
        lines.append("\nh2. Reference Patterns")
        for f in subtask["patterns_from"]:
            lines.append(f"* {{code}}{f}{{code}}")

    # Verification
    if subtask.get("verification"):
        v = subtask["verification"]
        lines.append("\nh2. Verification")
        lines.append(f"*Type:* {v.get('type', 'none')}")
        if v.get("run"):
            lines.append(f"*Command:* {{code}}{v['run']}{{code}}")
        if v.get("url"):
            lines.append(f"*URL:* {v['url']}")

    # Attribution - use email/username if provided
    lines.append("\n----")
    if creator_email:
        # Extract username from email for display
        display_name = creator_email.split("@")[0] if "@" in creator_email else creator_email
        lines.append(f"_Created by {display_name}_")
    else:
        # Fallback to checking env
        email = os.environ.get("JIRA_EMAIL", "")
        if email and "@" in email:
            display_name = email.split("@")[0]
            lines.append(f"_Created by {display_name}_")

    return "\n".join(lines)


def format_session_comment(
    session_num: int,
    subtask_id: str,
    success: bool,
    approach: str = "",
    error: str = "",
    git_commit: str = "",
) -> str:
    """Format a session result as a JIRA comment."""
    status_emoji = "(/) " if success else "(x) "
    lines = [
        f"h3. Session #{session_num} {status_emoji}",
        f"*Subtask:* {{code}}{subtask_id}{{code}}",
        f"*Status:* {'Completed' if success else 'In Progress'}",
        f"*Time:* {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    ]

    if approach:
        lines.append(f"\n*Approach:* {approach}")

    if git_commit:
        lines.append(f"\n*Commit:* {{code}}{git_commit[:8]}{{code}}")

    if error:
        lines.append(f"\n*Error:*\n{{code}}\n{error[:500]}\n{{code}}")

    return "\n".join(lines)


def format_stuck_subtask_comment(
    subtask_id: str,
    attempt_count: int,
    attempts: List[dict],
    reason: str = "",
) -> str:
    """Format a detailed comment for stuck subtasks."""
    lines = [
        "h3. (!) Subtask Marked as STUCK",
        f"*Subtask:* {{code}}{subtask_id}{{code}}",
        f"*Attempts:* {attempt_count}",
        f"*Time:* {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
    ]

    if reason:
        lines.append(f"\n*Reason:* {reason}")

    if attempts:
        lines.append("\nh4. Attempt History")
        for i, attempt in enumerate(attempts[-5:], 1):
            status = "(/) " if attempt.get("success") else "(x) "
            lines.append(f"\n*Attempt {i}:* {status}")
            if attempt.get("approach"):
                lines.append(f"- Approach: {attempt['approach'][:200]}")
            if attempt.get("error"):
                lines.append(f"- Error: {attempt['error'][:200]}")

    lines.append("\nh4. Recommended Actions")
    lines.append("# Review the approach and error patterns above")
    lines.append("# Check for missing dependencies or configuration")
    lines.append("# Consider manual intervention or different approach")
    lines.append("# Update HUMAN_INPUT.md with guidance for the agent")

    return "\n".join(lines)
