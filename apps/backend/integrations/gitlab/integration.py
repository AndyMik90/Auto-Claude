"""
GitLab Integration Manager
===========================

Manages synchronization between Auto-Claude subtasks and GitLab issues.
Supports self-hosted GitLab with multi-user OAuth authentication.

Key Features:
- Multi-user OAuth with token storage
- Issue and Merge Request management
- Branch workflow automation
- Session tracking via issue notes
- Stuck subtask escalation
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from .client import GitLabClient
from .config import (
    LABELS,
    GitLabConfig,
    GitLabProjectState,
    format_issue_description,
    format_session_note,
    format_stuck_note,
    get_creator_label,
    get_labels_for_subtask,
    get_weight_for_phase,
)
from .oauth import GitLabOAuth, OAuthToken


class GitLabManager:
    """
    Manages GitLab integration for an Auto-Claude spec.

    Supports multi-user OAuth for team environments where each
    developer authenticates with their own GitLab account.
    """

    def __init__(
        self,
        spec_dir: Path,
        project_dir: Path,
        user_id: str = None,
    ):
        """
        Initialize GitLab manager.

        Args:
            spec_dir: Spec directory (contains implementation_plan.json)
            project_dir: Project root directory
            user_id: User identifier for OAuth (email or username)
        """
        self.spec_dir = spec_dir
        self.project_dir = project_dir
        self.user_id = user_id or os.environ.get("GITLAB_USER", "default")
        self.config = GitLabConfig.from_file() or GitLabConfig.from_env()
        self.state: GitLabProjectState | None = None
        self._client: GitLabClient | None = None
        self._oauth: GitLabOAuth | None = None

        # Load existing state if available
        self.state = GitLabProjectState.load(spec_dir)

        # Initialize OAuth if configured
        if self.config.use_oauth and self.config.client_id:
            self._oauth = GitLabOAuth(
                gitlab_url=self.config.url,
                client_id=self.config.client_id,
                client_secret=self.config.client_secret,
                redirect_uri=self.config.redirect_uri,
            )

    async def connect(self) -> None:
        """Connect to GitLab API."""
        if self._client is not None:
            return

        self._client = GitLabClient(
            config=self.config,
            user_id=self.user_id,
            oauth=self._oauth,
        )
        await self._client.connect()

    async def disconnect(self) -> None:
        """Disconnect from GitLab API."""
        if self._client:
            await self._client.disconnect()
            self._client = None

    @property
    def is_enabled(self) -> bool:
        """Check if GitLab integration is enabled and configured."""
        return self.config.is_valid() and self.config.enabled

    @property
    def is_initialized(self) -> bool:
        """Check if GitLab project has been initialized for this spec."""
        return self.state is not None and self.state.initialized

    @property
    def is_authenticated(self) -> bool:
        """Check if current user is authenticated."""
        if self._oauth:
            return self._oauth.is_authenticated(self.user_id)
        return bool(self.config.personal_token)

    def get_authorization_url(self) -> tuple[str, str]:
        """
        Get OAuth authorization URL for user login.

        Returns:
            Tuple of (authorization_url, state)
        """
        if not self._oauth:
            raise ValueError("OAuth not configured")
        return self._oauth.get_authorization_url(self.user_id)

    async def complete_oauth(self, code: str, state: str) -> OAuthToken | None:
        """
        Complete OAuth flow after user authorization.

        Args:
            code: Authorization code from callback
            state: State parameter for verification

        Returns:
            OAuth token if successful
        """
        if not self._oauth:
            raise ValueError("OAuth not configured")
        return await self._oauth.exchange_code(code, state)

    def logout(self) -> bool:
        """Logout current user (remove stored token)."""
        if self._oauth:
            return self._oauth.logout(self.user_id)
        return False

    def get_issue_iid(self, subtask_id: str) -> int | None:
        """Get the GitLab issue IID for a subtask."""
        if not self.state:
            return None
        return self.state.issue_mapping.get(subtask_id)

    def set_issue_iid(self, subtask_id: str, issue_iid: int) -> None:
        """Store the mapping between a subtask and its GitLab issue."""
        if not self.state:
            self.state = GitLabProjectState()

        self.state.issue_mapping[subtask_id] = issue_iid
        self.state.save(self.spec_dir)

    def get_mr_iid(self, subtask_id: str) -> int | None:
        """Get the GitLab MR IID for a subtask."""
        if not self.state:
            return None
        return self.state.mr_mapping.get(subtask_id)

    def set_mr_iid(self, subtask_id: str, mr_iid: int) -> None:
        """Store the mapping between a subtask and its MR."""
        if not self.state:
            self.state = GitLabProjectState()

        self.state.mr_mapping[subtask_id] = mr_iid
        self.state.save(self.spec_dir)

    # ==================== Issue Operations ====================

    async def list_project_issues(
        self,
        state: str = "opened",
        labels: list[str] = None,
    ) -> list[dict[str, Any]]:
        """List issues for the configured project."""
        await self.connect()
        return await self._client.list_issues(state=state, labels=labels)

    async def get_issue(self, issue_iid: int) -> dict[str, Any]:
        """Get an issue by IID."""
        await self.connect()
        return await self._client.get_issue(issue_iid)

    async def create_issue(
        self,
        title: str,
        description: str = "",
        labels: list[str] = None,
        weight: int = None,
    ) -> dict[str, Any]:
        """Create a new issue."""
        await self.connect()
        return await self._client.create_issue(
            title=title,
            description=description,
            labels=labels,
            weight=weight,
        )

    async def update_issue(
        self,
        issue_iid: int,
        title: str = None,
        description: str = None,
        labels: list[str] = None,
        state_event: str = None,
    ) -> dict[str, Any]:
        """Update an issue."""
        await self.connect()
        return await self._client.update_issue(
            issue_iid=issue_iid,
            title=title,
            description=description,
            labels=labels,
            state_event=state_event,
        )

    async def close_issue(self, issue_iid: int) -> dict[str, Any]:
        """Close an issue."""
        await self.connect()
        return await self._client.close_issue(issue_iid)

    async def add_issue_note(self, issue_iid: int, body: str) -> dict[str, Any]:
        """Add a note to an issue."""
        await self.connect()
        return await self._client.add_issue_note(issue_iid, body)

    # ==================== Merge Request Operations ====================

    async def create_merge_request(
        self,
        source_branch: str,
        title: str,
        description: str = "",
        labels: list[str] = None,
    ) -> dict[str, Any]:
        """Create a new merge request."""
        await self.connect()
        return await self._client.create_merge_request(
            source_branch=source_branch,
            title=title,
            description=description,
            labels=labels,
        )

    async def get_merge_request(self, mr_iid: int) -> dict[str, Any]:
        """Get a merge request by IID."""
        await self.connect()
        return await self._client.get_merge_request(mr_iid)

    async def add_mr_note(self, mr_iid: int, body: str) -> dict[str, Any]:
        """Add a note to a merge request."""
        await self.connect()
        return await self._client.add_mr_note(mr_iid, body)

    # ==================== Branch Operations ====================

    async def create_branch(self, branch_name: str, ref: str = None) -> dict[str, Any]:
        """Create a new branch."""
        await self.connect()
        return await self._client.create_branch(branch_name, ref)

    async def get_branch(self, branch_name: str) -> dict[str, Any]:
        """Get branch info."""
        await self.connect()
        return await self._client.get_branch(branch_name)

    # ==================== Project Management ====================

    async def initialize_project(
        self,
        project_id: str = None,
        project_name: str = None,
    ) -> bool:
        """
        Initialize GitLab tracking for this spec.

        Args:
            project_id: GitLab project ID or path
            project_name: Display name

        Returns:
            True if successful
        """
        if not self.is_enabled:
            print("GitLab integration not enabled")
            return False

        await self.connect()

        # Verify project access
        pid = project_id or self.config.project_id
        project = await self._client.get_project(pid)

        self.state = GitLabProjectState(
            initialized=True,
            project_id=str(project.get("id")),
            project_path=project.get("path_with_namespace", ""),
            project_name=project_name or project.get("name", ""),
            default_branch=project.get("default_branch", "main"),
            created_at=datetime.now().isoformat(),
        )

        self.state.save(self.spec_dir)
        return True

    def update_meta_issue_iid(self, meta_issue_iid: int) -> None:
        """Update the META issue IID after creation."""
        if self.state:
            self.state.meta_issue_iid = meta_issue_iid
            self.state.save(self.spec_dir)

    def load_implementation_plan(self) -> dict | None:
        """Load the implementation plan from spec directory."""
        plan_file = self.spec_dir / "implementation_plan.json"
        if not plan_file.exists():
            return None

        try:
            with open(plan_file, encoding="utf-8") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            return None

    def get_subtasks_for_sync(self) -> list[dict]:
        """Get all subtasks that need GitLab issues."""
        plan = self.load_implementation_plan()
        if not plan:
            return []

        subtasks = []
        phases = plan.get("phases", [])
        total_phases = len(phases)

        for phase in phases:
            phase_num = phase.get("phase", 1)
            phase_name = phase.get("name", f"Phase {phase_num}")

            for subtask in phase.get("subtasks", []):
                subtasks.append(
                    {
                        **subtask,
                        "phase_num": phase_num,
                        "phase_name": phase_name,
                        "total_phases": total_phases,
                    }
                )

        return subtasks

    def generate_issue_data(self, subtask: dict) -> dict:
        """Generate GitLab issue data from a subtask."""
        phase = {
            "name": subtask.get("phase_name"),
            "id": subtask.get("phase_num"),
        }

        weight = get_weight_for_phase(
            subtask.get("phase_num", 1), subtask.get("total_phases", 1)
        )

        # Get creator info from config or environment
        email = os.environ.get("GITLAB_EMAIL", "") or os.environ.get(
            "GITLAB_USER_EMAIL", ""
        )
        username = os.environ.get("GITLAB_USER", "") or os.environ.get(
            "GITLAB_USERNAME", ""
        )

        labels = get_labels_for_subtask(subtask, email=email, username=username)

        return {
            "title": f"[{subtask.get('id', 'subtask')}] {subtask.get('description', 'Implement subtask')[:100]}",
            "description": format_issue_description(
                subtask, phase, creator_email=email, creator_username=username
            ),
            "weight": weight,
            "labels": labels,
        }

    def record_session_result(
        self,
        subtask_id: str,
        session_num: int,
        success: bool,
        approach: str = "",
        error: str = "",
        git_commit: str = "",
    ) -> str:
        """Record a session result for adding to GitLab."""
        return format_session_note(
            session_num=session_num,
            subtask_id=subtask_id,
            success=success,
            approach=approach,
            error=error,
            git_commit=git_commit,
        )

    def prepare_stuck_escalation(
        self,
        subtask_id: str,
        attempt_count: int,
        attempts: list[dict],
        reason: str = "",
    ) -> dict:
        """Prepare data for escalating a stuck subtask."""
        issue_iid = self.get_issue_iid(subtask_id)
        note = format_stuck_note(
            subtask_id=subtask_id,
            attempt_count=attempt_count,
            attempts=attempts,
            reason=reason,
        )

        return {
            "issue_iid": issue_iid,
            "subtask_id": subtask_id,
            "labels": [LABELS["stuck"], LABELS["blocked"]],
            "note": note,
        }

    def get_progress_summary(self) -> dict:
        """Get a summary of GitLab integration progress."""
        plan = self.load_implementation_plan()
        if not plan:
            return {
                "enabled": self.is_enabled,
                "initialized": False,
                "authenticated": self.is_authenticated,
                "total_subtasks": 0,
                "mapped_subtasks": 0,
            }

        subtasks = self.get_subtasks_for_sync()
        mapped = sum(1 for s in subtasks if self.get_issue_iid(s.get("id", "")))

        return {
            "enabled": self.is_enabled,
            "initialized": self.is_initialized,
            "authenticated": self.is_authenticated,
            "project_path": self.state.project_path if self.state else None,
            "project_name": self.state.project_name if self.state else None,
            "meta_issue_iid": self.state.meta_issue_iid if self.state else None,
            "total_subtasks": len(subtasks),
            "mapped_subtasks": mapped,
        }

    def get_gitlab_context_for_prompt(self) -> str:
        """Generate GitLab context section for agent prompts."""
        if not self.is_enabled:
            return ""

        summary = self.get_progress_summary()

        if not summary["authenticated"]:
            return f"""
## GitLab Integration

GitLab integration is enabled but you need to authenticate.
Run the OAuth flow to connect your GitLab account.

GitLab URL: {self.config.url}
"""

        if not summary["initialized"]:
            return f"""
## GitLab Integration

GitLab is configured but not initialized for this spec.
During the planner session, initialize the project and create issues.

GitLab URL: {self.config.url}
Project: {self.config.project_id}
"""

        lines = [
            "## GitLab Integration",
            "",
            f"**Project:** [{summary['project_path']}]({self.config.url}/{summary['project_path']})",
            f"**Issues:** {summary['mapped_subtasks']}/{summary['total_subtasks']} subtasks mapped",
            "",
            "When working on a subtask:",
            "1. Create a feature branch from the default branch",
            "2. Add in-progress label to the linked issue",
            "3. Commit changes and push to branch",
            "4. Create MR when subtask is complete",
            "5. Close the issue when MR is merged",
        ]

        return "\n".join(lines)

    def save_state(self) -> None:
        """Save the current state to disk."""
        if self.state:
            self.state.save(self.spec_dir)


# Utility functions


async def get_gitlab_manager(
    spec_dir: Path,
    project_dir: Path,
    user_id: str = None,
) -> GitLabManager:
    """
    Get a GitLabManager instance for the given spec.

    Args:
        spec_dir: Spec directory
        project_dir: Project root directory
        user_id: User identifier for OAuth

    Returns:
        GitLabManager instance
    """
    return GitLabManager(spec_dir, project_dir, user_id)


def is_gitlab_enabled() -> bool:
    """Quick check if GitLab integration is available."""
    config = GitLabConfig.from_file() or GitLabConfig.from_env()
    return config.is_valid()


def prepare_planner_gitlab_instructions(spec_dir: Path) -> str:
    """Generate GitLab setup instructions for the planner agent."""
    if not is_gitlab_enabled():
        return ""

    config = GitLabConfig.from_file() or GitLabConfig.from_env()

    # Get creator label from email/username
    email = os.environ.get("GITLAB_EMAIL", "") or os.environ.get(
        "GITLAB_USER_EMAIL", ""
    )
    username = os.environ.get("GITLAB_USER", "") or os.environ.get(
        "GITLAB_USERNAME", ""
    )
    creator_label = get_creator_label(email, username) or "created-by-user"

    return f"""
## GitLab Integration Setup

GitLab integration is ENABLED.
URL: {config.url}
Project: {config.project_id}

### Step 1: Ensure Labels Exist
Create these labels if they don't exist:
- `{creator_label}` (blue) - Issues created by you
- `phase::1`, `phase::2`, etc. - Phase tracking
- `blocked` (red) - Blocked issues
- `in-progress` (yellow) - Work in progress

### Step 2: Create Issues for Each Subtask
For each subtask in implementation_plan.json:
```
Create issue with:
- Title: "[subtask-id] Description"
- Description: Formatted subtask details
- Labels: ["{creator_label}", "phase::N", "service::NAME"]
- Weight: Based on phase (9 for early phases, 1 for polish)
```
Save the subtask_id -> issue_iid mapping to .gitlab_project.json

### Step 3: Create META Issue
```
Create issue with:
- Title: "[META] Build Progress Tracker"
- Description: "Session summaries and overall progress tracking"
```
This issue receives session summary notes.

### Workflow
When working on a subtask:
1. Create branch: `git checkout -b feature/subtask-id`
2. Add `in-progress` label to issue
3. Work on subtask, commit changes
4. Create MR: "Implement [subtask-id]"
5. After merge, close the issue
"""


def prepare_coder_gitlab_instructions(spec_dir: Path, subtask_id: str) -> str:
    """Generate GitLab instructions for the coding agent."""
    if not is_gitlab_enabled():
        return ""

    manager = GitLabManager(spec_dir, spec_dir.parent.parent)

    if not manager.is_initialized:
        return ""

    issue_iid = manager.get_issue_iid(subtask_id)
    if not issue_iid:
        return ""

    config = manager.config
    project_url = f"{config.url}/{manager.state.project_path}"

    # Get creator label
    email = os.environ.get("GITLAB_EMAIL", "") or os.environ.get(
        "GITLAB_USER_EMAIL", ""
    )
    username = os.environ.get("GITLAB_USER", "") or os.environ.get(
        "GITLAB_USERNAME", ""
    )
    creator_label = get_creator_label(email, username)
    label_text = f"Labels: {creator_label}" if creator_label else ""

    return f"""
## GitLab Updates

This subtask is linked to GitLab issue: #{issue_iid}
View: {project_url}/-/issues/{issue_iid}

### At Session Start
1. Create feature branch:
   ```
   git checkout -b feature/{subtask_id}
   ```
2. Add `in-progress` label to issue

### During Work
Add notes for significant progress or blockers:
```
Add note to issue #{issue_iid}
```

### On Completion
1. Commit all changes
2. Push branch: `git push -u origin feature/{subtask_id}`
3. Create MR:
   - Title: "Implement [{subtask_id}]"
   - Description: What was implemented
   {label_text}
4. Close issue after MR is merged
"""
