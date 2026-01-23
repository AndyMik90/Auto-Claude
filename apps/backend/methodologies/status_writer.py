"""Task status writer utility for methodology plugins.

This module provides the unified interface for all methodologies to write
task status to implementation_plan.json. This ensures consistent frontend
integration across native, BMAD, and all future methodology plugins.

Architecture: All methodologies MUST use this module to update task status.
The frontend reads implementation_plan.json for kanban column placement.
"""

import json
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from apps.backend.core.debug import debug, debug_error, debug_success

from .protocols import PlanStatus, TaskStatus, TaskStatusContract

# Standard filename for implementation plan (matches native system)
IMPLEMENTATION_PLAN_FILE = "implementation_plan.json"


def write_task_status(
    spec_dir: Path | str,
    status: TaskStatus,
    plan_status: PlanStatus,
    methodology: str,
    feature: str = "",
    qa_signoff: dict[str, Any] | None = None,
    extra_fields: dict[str, Any] | None = None,
) -> bool:
    """Write task status to implementation_plan.json.

    This is the REQUIRED method for all methodologies to update task status.
    It ensures the frontend can properly track task state across all
    methodology types.

    Args:
        spec_dir: Path to the spec directory for this task
        status: Task status (backlog, in_progress, ai_review, human_review, done)
        plan_status: Plan status (pending, in_progress, review, completed)
        methodology: Name of the methodology (e.g., "native", "bmad")
        feature: Task name/description (optional but recommended)
        qa_signoff: QA approval info (required for human_review transition)
        extra_fields: Additional methodology-specific fields to merge

    Returns:
        True if write was successful, False otherwise

    Example:
        # When BMAD completes and is ready for human review:
        write_task_status(
            spec_dir="/path/to/spec",
            status=TaskStatus.HUMAN_REVIEW,
            plan_status=PlanStatus.REVIEW,
            methodology="bmad",
            feature="Add user authentication",
            qa_signoff={"status": "approved", "methodology": "bmad"}
        )
    """
    spec_dir = Path(spec_dir)
    plan_path = spec_dir / IMPLEMENTATION_PLAN_FILE
    now = datetime.now(timezone.utc).isoformat()

    try:
        # Load existing plan or create new one
        if plan_path.exists():
            with open(plan_path, encoding="utf-8") as f:
                plan_data = json.load(f)
            debug(
                "status_writer",
                f"Loaded existing plan from {plan_path}",
                current_status=plan_data.get("status"),
            )
        else:
            plan_data = {
                "created_at": now,
            }
            debug("status_writer", f"Creating new plan at {plan_path}")

        # Update with status contract fields
        contract = TaskStatusContract(
            status=status,
            plan_status=plan_status,
            methodology=methodology,
            updated_at=now,
            feature=feature,
            qa_signoff=qa_signoff,
        )

        # Merge contract fields into plan data
        plan_data.update(contract.to_dict())

        # Merge any extra methodology-specific fields
        if extra_fields:
            plan_data.update(extra_fields)

        # Always update timestamp
        plan_data["updated_at"] = now

        # Write atomically to prevent corruption
        temp_path = plan_path.with_suffix(".tmp")
        with open(temp_path, "w", encoding="utf-8") as f:
            json.dump(plan_data, f, indent=2, ensure_ascii=False)
        temp_path.rename(plan_path)

        debug_success(
            "status_writer",
            f"Updated task status: {status.value} / {plan_status.value}",
            methodology=methodology,
            path=str(plan_path),
        )
        return True

    except Exception as e:
        debug_error("status_writer", f"Failed to write task status: {e}")
        return False


def read_task_status(spec_dir: Path | str) -> dict[str, Any] | None:
    """Read task status from implementation_plan.json.

    Useful for checking current status before updates.

    Args:
        spec_dir: Path to the spec directory

    Returns:
        Dictionary with status fields, or None if file doesn't exist
    """
    spec_dir = Path(spec_dir)
    plan_path = spec_dir / IMPLEMENTATION_PLAN_FILE

    if not plan_path.exists():
        return None

    try:
        with open(plan_path, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        debug_error("status_writer", f"Failed to read task status: {e}")
        return None


def get_task_status(spec_dir: Path | str) -> TaskStatus | None:
    """Get just the task status enum value.

    Args:
        spec_dir: Path to the spec directory

    Returns:
        TaskStatus enum value, or None if not found
    """
    data = read_task_status(spec_dir)
    if not data or "status" not in data:
        return None

    try:
        return TaskStatus(data["status"])
    except ValueError:
        return None
