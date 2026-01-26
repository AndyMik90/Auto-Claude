"""
JIRA Integration Manager
========================

Manages synchronization between Auto-Claude subtasks and JIRA issues.
Communicates with JIRA via MCP bridge to reuse existing jira-mcp server.

The integration is OPTIONAL - if JIRA MCP is not configured, all operations
gracefully no-op and the build continues with local tracking only.

Key Features:
- Subtask -> Issue mapping (sync implementation_plan.json to JIRA)
- Session attempt recording (comments on issues)
- Stuck subtask escalation (transition to Blocked, add detailed comments)
- Progress tracking via META issue
"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any

from .config import (
    LABELS,
    STATUS_BLOCKED,
    JiraConfig,
    JiraProjectState,
    format_session_comment,
    format_stuck_subtask_comment,
    format_subtask_description,
    get_creator_label,
    get_jira_status,
    get_priority_for_phase,
)
from .mcp_client import MCPClient, MCPServerConfig


class JiraManager:
    """
    Manages JIRA integration for an Auto-Claude spec.

    Communicates with JIRA via MCP bridge, reusing existing
    jira-mcp server configuration and authentication.
    """

    def __init__(self, spec_dir: Path, project_dir: Path):
        """
        Initialize JIRA manager.

        Args:
            spec_dir: Spec directory (contains implementation_plan.json)
            project_dir: Project root directory
        """
        self.spec_dir = spec_dir
        self.project_dir = project_dir
        self.config = JiraConfig.from_mcp_settings() or JiraConfig.from_env()
        self.state: JiraProjectState | None = None
        self._mcp_client: MCPClient | None = None
        self._mcp_available = False

        # Load existing state if available
        self.state = JiraProjectState.load(spec_dir)

        # Check MCP availability
        self._check_mcp_availability()

    def _check_mcp_availability(self) -> None:
        """Check if JIRA MCP server is available."""
        self._mcp_available = self.config.is_valid()

    async def _get_mcp_client(self) -> MCPClient:
        """Get or create MCP client connection."""
        if self._mcp_client is None or not self._mcp_client.is_connected:
            mcp_config = MCPServerConfig(
                command=self.config.mcp_start_script,
                env={
                    "JIRA_HOST": self.config.host,
                    "JIRA_EMAIL": self.config.email,
                    "JIRA_API_TOKEN": self.config.api_token,
                    "JIRA_DEFAULT_PROJECT": self.config.default_project,
                } if self.config.host else {}
            )
            self._mcp_client = MCPClient(mcp_config)
            await self._mcp_client.connect()

        return self._mcp_client

    async def disconnect(self) -> None:
        """Disconnect from MCP server."""
        if self._mcp_client:
            await self._mcp_client.disconnect()
            self._mcp_client = None

    @property
    def is_enabled(self) -> bool:
        """Check if JIRA integration is enabled and available."""
        return self.config.is_valid() and self._mcp_available

    @property
    def is_initialized(self) -> bool:
        """Check if JIRA project has been initialized for this spec."""
        return self.state is not None and self.state.initialized

    def get_issue_key(self, subtask_id: str) -> str | None:
        """Get the JIRA issue key for a subtask."""
        if not self.state:
            return None
        return self.state.issue_mapping.get(subtask_id)

    def set_issue_key(self, subtask_id: str, issue_key: str) -> None:
        """Store the mapping between a subtask and its JIRA issue."""
        if not self.state:
            self.state = JiraProjectState()

        self.state.issue_mapping[subtask_id] = issue_key
        self.state.save(self.spec_dir)

    async def search_issues(
        self,
        jql: str,
        max_results: int = 50
    ) -> list[dict[str, Any]]:
        """
        Search for JIRA issues using JQL.

        Args:
            jql: JQL query string
            max_results: Maximum number of results

        Returns:
            List of issue dictionaries
        """
        if not self.is_enabled:
            return []

        client = await self._get_mcp_client()
        result = await client.call_tool("jira_search_issues", {
            "jql": jql,
            "maxResults": max_results
        })

        return result.get("issues", [])

    async def get_issue(self, issue_key: str) -> dict[str, Any] | None:
        """Get a single JIRA issue by key."""
        if not self.is_enabled:
            return None

        client = await self._get_mcp_client()
        return await client.call_tool("jira_get_issue", {
            "issueKey": issue_key
        })

    async def create_issue(
        self,
        summary: str,
        description: str = "",
        issue_type: str = "Task",
        project: str = None,
        labels: list[str] = None,
        priority: str = None,
    ) -> dict[str, Any] | None:
        """Create a new JIRA issue."""
        if not self.is_enabled:
            return None

        client = await self._get_mcp_client()

        params = {
            "summary": summary,
            "issueType": issue_type,
        }

        if project:
            params["project"] = project
        if description:
            params["description"] = description
        if labels:
            params["labels"] = labels
        if priority:
            params["priority"] = priority

        return await client.call_tool("jira_create_issue", params)

    async def update_issue(
        self,
        issue_key: str,
        summary: str = None,
        description: str = None,
        labels: list[str] = None,
        priority: str = None,
    ) -> dict[str, Any] | None:
        """Update an existing JIRA issue."""
        if not self.is_enabled:
            return None

        client = await self._get_mcp_client()

        params = {"issueKey": issue_key}
        if summary:
            params["summary"] = summary
        if description:
            params["description"] = description
        if labels:
            params["labels"] = labels
        if priority:
            params["priority"] = priority

        return await client.call_tool("jira_update_issue", params)

    async def transition_issue(
        self,
        issue_key: str,
        status: str
    ) -> dict[str, Any] | None:
        """Transition an issue to a new status."""
        if not self.is_enabled:
            return None

        client = await self._get_mcp_client()
        return await client.call_tool("jira_transition_issue", {
            "issueKey": issue_key,
            "transition": status
        })

    async def add_comment(
        self,
        issue_key: str,
        comment: str
    ) -> dict[str, Any] | None:
        """Add a comment to an issue."""
        if not self.is_enabled:
            return None

        client = await self._get_mcp_client()
        return await client.call_tool("jira_add_comment", {
            "issueKey": issue_key,
            "comment": comment
        })

    def initialize_project(self, project_key: str, project_name: str) -> bool:
        """
        Initialize JIRA tracking for this spec.

        Args:
            project_key: JIRA project key
            project_name: Display name for the project

        Returns:
            True if successful
        """
        if not self.is_enabled:
            print("JIRA integration not enabled")
            return False

        self.state = JiraProjectState(
            initialized=True,
            project_key=project_key,
            project_name=project_name,
            created_at=datetime.now().isoformat(),
        )

        self.state.save(self.spec_dir)
        return True

    def update_meta_issue_key(self, meta_issue_key: str) -> None:
        """Update the META issue key after creation."""
        if self.state:
            self.state.meta_issue_key = meta_issue_key
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
        """Get all subtasks that need JIRA issues."""
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
                subtasks.append({
                    **subtask,
                    "phase_num": phase_num,
                    "phase_name": phase_name,
                    "total_phases": total_phases,
                    "phase_depends_on": phase.get("depends_on", []),
                })

        return subtasks

    def generate_issue_data(self, subtask: dict) -> dict:
        """Generate JIRA issue data from a subtask."""
        phase = {
            "name": subtask.get("phase_name"),
            "id": subtask.get("phase_num"),
        }

        priority = get_priority_for_phase(
            subtask.get("phase_num", 1),
            subtask.get("total_phases", 1)
        )

        # Build labels - use creator email instead of "auto-claude"
        labels = []
        creator_label = get_creator_label(self.config.email)
        if creator_label:
            labels.append(creator_label)
        if subtask.get("service"):
            labels.append(f"{LABELS['service']}-{subtask['service']}")
        if subtask.get("phase_num"):
            labels.append(f"{LABELS['phase']}-{subtask['phase_num']}")

        return {
            "summary": f"[{subtask.get('id', 'subtask')}] {subtask.get('description', 'Implement subtask')[:100]}",
            "description": format_subtask_description(subtask, phase, self.config.email),
            "priority": priority,
            "labels": labels,
            "issueType": "Task",
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
        """Record a session result as a JIRA comment."""
        return format_session_comment(
            session_num=session_num,
            subtask_id=subtask_id,
            success=success,
            approach=approach,
            error=error,
            git_commit=git_commit,
        )

    def prepare_status_update(self, subtask_id: str, new_status: str) -> dict:
        """Prepare data for a JIRA issue status update."""
        issue_key = self.get_issue_key(subtask_id)
        jira_status = get_jira_status(new_status)

        return {
            "issue_key": issue_key,
            "status": jira_status,
            "subtask_id": subtask_id,
        }

    def prepare_stuck_escalation(
        self,
        subtask_id: str,
        attempt_count: int,
        attempts: list[dict],
        reason: str = "",
    ) -> dict:
        """Prepare data for escalating a stuck subtask."""
        issue_key = self.get_issue_key(subtask_id)
        comment = format_stuck_subtask_comment(
            subtask_id=subtask_id,
            attempt_count=attempt_count,
            attempts=attempts,
            reason=reason,
        )

        return {
            "issue_key": issue_key,
            "subtask_id": subtask_id,
            "status": STATUS_BLOCKED,
            "comment": comment,
            "labels": [LABELS["stuck"], LABELS["needs_review"]],
        }

    def get_progress_summary(self) -> dict:
        """Get a summary of JIRA integration progress."""
        plan = self.load_implementation_plan()
        if not plan:
            return {
                "enabled": self.is_enabled,
                "initialized": False,
                "total_subtasks": 0,
                "mapped_subtasks": 0,
            }

        subtasks = self.get_subtasks_for_sync()
        mapped = sum(1 for s in subtasks if self.get_issue_key(s.get("id", "")))

        return {
            "enabled": self.is_enabled,
            "initialized": self.is_initialized,
            "project_key": self.state.project_key if self.state else None,
            "project_name": self.state.project_name if self.state else None,
            "meta_issue_key": self.state.meta_issue_key if self.state else None,
            "total_subtasks": len(subtasks),
            "mapped_subtasks": mapped,
        }

    def get_jira_context_for_prompt(self) -> str:
        """Generate JIRA context section for agent prompts."""
        if not self.is_enabled:
            return ""

        summary = self.get_progress_summary()

        if not summary["initialized"]:
            return """
## JIRA Integration

JIRA integration is enabled but not yet initialized.
During the planner session, configure JIRA project and sync issues.

Available JIRA MCP tools (via jira-mcp):
- `mcp__jira-mcp__jira_search_issues` - Search issues with JQL
- `mcp__jira-mcp__jira_create_issue` - Create issues for subtasks
- `mcp__jira-mcp__jira_update_issue` - Update issue fields
- `mcp__jira-mcp__jira_transition_issue` - Change issue status
- `mcp__jira-mcp__jira_add_comment` - Add session comments
"""

        lines = [
            "## JIRA Integration",
            "",
            f"**Project:** {summary['project_key']} - {summary['project_name']}",
            f"**Issues:** {summary['mapped_subtasks']}/{summary['total_subtasks']} subtasks mapped",
            "",
            "When working on a subtask:",
            "1. Transition issue to 'In Progress' at start",
            "2. Add comments with progress/blockers",
            "3. Transition to 'Done' when subtask completes",
            "4. If stuck, issue will be set to 'Blocked' automatically",
        ]

        return "\n".join(lines)

    def save_state(self) -> None:
        """Save the current state to disk."""
        if self.state:
            self.state.save(self.spec_dir)


# Utility functions


async def get_jira_manager(spec_dir: Path, project_dir: Path) -> JiraManager:
    """
    Get a JiraManager instance for the given spec.

    Args:
        spec_dir: Spec directory
        project_dir: Project root directory

    Returns:
        JiraManager instance
    """
    return JiraManager(spec_dir, project_dir)


def is_jira_enabled() -> bool:
    """Quick check if JIRA integration is available."""
    config = JiraConfig.from_mcp_settings() or JiraConfig.from_env()
    return config.is_valid()


def prepare_planner_jira_instructions(spec_dir: Path) -> str:
    """Generate JIRA setup instructions for the planner agent."""
    if not is_jira_enabled():
        return ""

    config = JiraConfig.from_mcp_settings() or JiraConfig.from_env()
    default_project = config.default_project or "YOUR_PROJECT"

    # Get creator label from email
    email = config.email if config else os.environ.get("JIRA_EMAIL", "")
    creator_label = get_creator_label(email) if email else "created-by-user"

    return f"""
## JIRA Integration Setup

JIRA integration is ENABLED via jira-mcp MCP server.
Default project: {default_project}

### Step 1: Create Issues for Each Subtask
For each subtask in implementation_plan.json:
```
Use mcp__jira-mcp__jira_create_issue with:
- project: "{default_project}"
- summary: "[subtask-id] Description"
- description: Formatted subtask details
- issueType: "Task"
- priority: Based on phase (Highest for early phases, Low for polish)
- labels: ["{creator_label}", "phase-N", "service-NAME"]
```
Save the subtask_id -> issue_key mapping to .jira_project.json

### Step 2: Create META Issue
```
Use mcp__jira-mcp__jira_create_issue with:
- summary: "[META] Build Progress Tracker"
- description: "Session summaries and overall progress tracking"
```
This issue receives session summary comments.

### Important Notes
- Update .jira_project.json after each JIRA operation
- The JSON structure should include:
  - initialized: true
  - project_key: "{default_project}"
  - meta_issue_key: "{default_project}-XXX"
  - issue_mapping: {{ "subtask-1-1": "{default_project}-123", ... }}
"""


def prepare_coder_jira_instructions(spec_dir: Path, subtask_id: str) -> str:
    """Generate JIRA instructions for the coding agent."""
    if not is_jira_enabled():
        return ""

    manager = JiraManager(spec_dir, spec_dir.parent.parent)

    if not manager.is_initialized:
        return ""

    issue_key = manager.get_issue_key(subtask_id)
    if not issue_key:
        return ""

    return f"""
## JIRA Updates

This subtask is linked to JIRA issue: `{issue_key}`

### At Session Start
Transition to "In Progress":
```
mcp__jira-mcp__jira_transition_issue(issueKey="{issue_key}", transition="In Progress")
```

### During Work
Add comments for significant progress or blockers:
```
mcp__jira-mcp__jira_add_comment(issueKey="{issue_key}", comment="...")
```

### On Completion
Transition to "Done":
```
mcp__jira-mcp__jira_transition_issue(issueKey="{issue_key}", transition="Done")
```

### Session Summary
At session end, add a comment to the META issue with:
- What was accomplished
- Any blockers or issues found
- Recommendations for next session
"""
