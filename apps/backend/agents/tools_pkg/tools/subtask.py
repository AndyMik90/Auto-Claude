"""
Subtask Management Tools
========================

Tools for managing subtask status in implementation_plan.json.
Uses safe atomic file operations to prevent race conditions (Issue #488).
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

try:
    from claude_agent_sdk import tool

    SDK_TOOLS_AVAILABLE = True
except ImportError:
    SDK_TOOLS_AVAILABLE = False
    tool = None

# Import safe file I/O utilities to prevent race conditions
from ...utils import safe_update_json


def create_subtask_tools(spec_dir: Path, project_dir: Path) -> list:
    """
    Create subtask management tools.

    Args:
        spec_dir: Path to the spec directory
        project_dir: Path to the project root

    Returns:
        List of subtask tool functions
    """
    if not SDK_TOOLS_AVAILABLE:
        return []

    tools = []

    # -------------------------------------------------------------------------
    # Tool: update_subtask_status
    # -------------------------------------------------------------------------
    @tool(
        "update_subtask_status",
        "Update the status of a subtask in implementation_plan.json. Use this when completing or starting a subtask.",
        {"subtask_id": str, "status": str, "notes": str},
    )
    async def update_subtask_status(args: dict[str, Any]) -> dict[str, Any]:
        """Update subtask status in the implementation plan using safe atomic file operations."""
        subtask_id = args["subtask_id"]
        status = args["status"]
        notes = args.get("notes", "")

        valid_statuses = ["pending", "in_progress", "completed", "failed"]
        if status not in valid_statuses:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: Invalid status '{status}'. Must be one of: {valid_statuses}",
                    }
                ]
            }

        plan_file = spec_dir / "implementation_plan.json"
        if not plan_file.exists():
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: implementation_plan.json not found",
                    }
                ]
            }

        # Use safe atomic update to prevent race conditions
        subtask_found = False

        def update_plan(plan: dict) -> dict:
            """Update function for atomic file operation."""
            nonlocal subtask_found

            # Find and update the subtask
            for phase in plan.get("phases", []):
                for subtask in phase.get("subtasks", []):
                    if subtask.get("id") == subtask_id:
                        subtask["status"] = status
                        if notes:
                            subtask["notes"] = notes
                        subtask["updated_at"] = datetime.now(timezone.utc).isoformat()
                        subtask_found = True
                        break
                if subtask_found:
                    break

            # Update plan metadata
            plan["last_updated"] = datetime.now(timezone.utc).isoformat()
            return plan

        try:
            success, updated_plan = safe_update_json(plan_file, update_plan)

            if not success:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Error: Failed to update implementation plan (file lock timeout or I/O error)",
                        }
                    ]
                }

            if not subtask_found:
                return {
                    "content": [
                        {
                            "type": "text",
                            "text": f"Error: Subtask '{subtask_id}' not found in implementation plan",
                        }
                    ]
                }

            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Successfully updated subtask '{subtask_id}' to status '{status}'",
                    }
                ]
            }

        except Exception as e:
            return {
                "content": [
                    {"type": "text", "text": f"Error updating subtask status: {e}"}
                ]
            }

    tools.append(update_subtask_status)

    return tools
