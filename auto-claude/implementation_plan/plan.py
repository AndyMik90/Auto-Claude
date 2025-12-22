#!/usr/bin/env python3
"""
Implementation Plan Models
==========================

Defines the complete implementation plan for a feature/task with progress
tracking, status management, and follow-up capabilities.
"""

import json
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from .enums import PhaseType, SubtaskStatus, WorkflowType
from .phase import Phase
from .subtask import Subtask


@dataclass
class ImplementationPlan:
    """Complete implementation plan for a feature/task."""

    feature: str
    workflow_type: WorkflowType = WorkflowType.FEATURE
    services_involved: list[str] = field(default_factory=list)
    phases: list[Phase] = field(default_factory=list)
    final_acceptance: list[str] = field(default_factory=list)

    # Metadata
    created_at: str | None = None
    updated_at: str | None = None
    spec_file: str | None = None

    # Task status (synced with UI)
    # status: backlog, in_progress, ai_review, human_review, done
    # planStatus: pending, in_progress, review, completed
    status: str | None = None
    planStatus: str | None = None
    recoveryNote: str | None = None
    qa_signoff: dict | None = None

    def to_dict(self) -> dict:
        """Convert to dictionary representation."""
        result = {
            "feature": self.feature,
            "workflow_type": self.workflow_type.value,
            "services_involved": self.services_involved,
            "phases": [p.to_dict() for p in self.phases],
            "final_acceptance": self.final_acceptance,
            "created_at": self.created_at,
            "updated_at": self.updated_at,
            "spec_file": self.spec_file,
        }
        # Include status fields if set (synced with UI)
        if self.status:
            result["status"] = self.status
        if self.planStatus:
            result["planStatus"] = self.planStatus
        if self.recoveryNote:
            result["recoveryNote"] = self.recoveryNote
        if self.qa_signoff:
            result["qa_signoff"] = self.qa_signoff
        return result

    @classmethod
    def from_dict(cls, data: dict) -> "ImplementationPlan":
        """Create ImplementationPlan from dictionary."""
        # Parse workflow_type with fallback for unknown types
        workflow_type_str = data.get("workflow_type", "feature")
        try:
            workflow_type = WorkflowType(workflow_type_str)
        except ValueError:
            # Unknown workflow type - default to FEATURE
            print(
                f"Warning: Unknown workflow_type '{workflow_type_str}', defaulting to 'feature'"
            )
            workflow_type = WorkflowType.FEATURE

        # Support both 'feature' and 'title' fields for task name
        feature_name = data.get("feature") or data.get("title") or "Unnamed Feature"

        return cls(
            feature=feature_name,
            workflow_type=workflow_type,
            services_involved=data.get("services_involved", []),
            phases=[
                Phase.from_dict(p, idx + 1)
                for idx, p in enumerate(data.get("phases", []))
            ],
            final_acceptance=data.get("final_acceptance", []),
            created_at=data.get("created_at"),
            updated_at=data.get("updated_at"),
            spec_file=data.get("spec_file"),
            status=data.get("status"),
            planStatus=data.get("planStatus"),
            recoveryNote=data.get("recoveryNote"),
            qa_signoff=data.get("qa_signoff"),
        )

    def save(self, path: Path):
        """Save plan to JSON file."""
        self.updated_at = datetime.now().isoformat()
        if not self.created_at:
            self.created_at = self.updated_at

        # Auto-update status based on subtask completion
        self.update_status_from_subtasks()

        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(self.to_dict(), f, indent=2, ensure_ascii=False)

    def update_status_from_subtasks(self):
        """Update overall status and planStatus based on subtask completion state.

        This syncs the task status with the UI's expected values:
        - status: backlog, in_progress, ai_review, human_review, done
        - planStatus: pending, in_progress, review, completed

        Note: Preserves human_review/review status when it represents plan approval stage
        (all subtasks pending but user needs to approve the plan before coding starts).
        """
        all_subtasks = [s for p in self.phases for s in p.subtasks]

        if not all_subtasks:
            # No subtasks yet - stay in backlog/pending
            if not self.status:
                self.status = "backlog"
            if not self.planStatus:
                self.planStatus = "pending"
            return

        completed_count = sum(
            1 for s in all_subtasks if s.status == SubtaskStatus.COMPLETED
        )
        failed_count = sum(1 for s in all_subtasks if s.status == SubtaskStatus.FAILED)
        in_progress_count = sum(
            1 for s in all_subtasks if s.status == SubtaskStatus.IN_PROGRESS
        )
        total_count = len(all_subtasks)

        # Determine status based on subtask states
        if completed_count == total_count:
            # All subtasks completed - check if QA approved
            if self.qa_signoff and self.qa_signoff.get("status") == "approved":
                self.status = "human_review"
                self.planStatus = "review"
            else:
                # All subtasks done, waiting for QA
                self.status = "ai_review"
                self.planStatus = "review"
        elif failed_count > 0:
            # Some subtasks failed - still in progress (needs retry or fix)
            self.status = "in_progress"
            self.planStatus = "in_progress"
        elif in_progress_count > 0 or completed_count > 0:
            # Some subtasks in progress or completed
            self.status = "in_progress"
            self.planStatus = "in_progress"
        else:
            # All subtasks pending
            # Preserve human_review/review status if it's for plan approval stage
            # (spec is complete, waiting for user to approve before coding starts)
            if self.status == "human_review" and self.planStatus == "review":
                # Keep the plan approval status - don't reset to backlog
                pass
            else:
                self.status = "backlog"
                self.planStatus = "pending"

    @classmethod
    def load(cls, path: Path) -> "ImplementationPlan":
        """Load plan from JSON file."""
        with open(path, encoding="utf-8") as f:
            return cls.from_dict(json.load(f))

    def get_available_phases(self) -> list[Phase]:
        """Get phases whose dependencies are satisfied."""
        completed_phases = {p.phase for p in self.phases if p.is_complete()}
        available = []

        for phase in self.phases:
            if phase.is_complete():
                continue
            deps_met = all(d in completed_phases for d in phase.depends_on)
            if deps_met:
                available.append(phase)

        return available

    def get_next_subtask(self) -> tuple[Phase, Subtask] | None:
        """Get the next subtask to work on, respecting dependencies."""
        for phase in self.get_available_phases():
            pending = phase.get_pending_subtasks()
            if pending:
                return phase, pending[0]
        return None

    def get_progress(self) -> dict:
        """Get overall progress statistics."""
        total_subtasks = sum(len(p.subtasks) for p in self.phases)
        done_subtasks = sum(
            1
            for p in self.phases
            for s in p.subtasks
            if s.status == SubtaskStatus.COMPLETED
        )
        failed_subtasks = sum(
            1
            for p in self.phases
            for s in p.subtasks
            if s.status == SubtaskStatus.FAILED
        )

        completed_phases = sum(1 for p in self.phases if p.is_complete())

        return {
            "total_phases": len(self.phases),
            "completed_phases": completed_phases,
            "total_subtasks": total_subtasks,
            "completed_subtasks": done_subtasks,
            "failed_subtasks": failed_subtasks,
            "percent_complete": round(100 * done_subtasks / total_subtasks, 1)
            if total_subtasks > 0
            else 0,
            "is_complete": done_subtasks == total_subtasks and failed_subtasks == 0,
        }

    def get_status_summary(self) -> str:
        """Get a human-readable status summary."""
        progress = self.get_progress()
        lines = [
            f"Feature: {self.feature}",
            f"Workflow: {self.workflow_type.value}",
            f"Progress: {progress['completed_subtasks']}/{progress['total_subtasks']} subtasks ({progress['percent_complete']}%)",
            f"Phases: {progress['completed_phases']}/{progress['total_phases']} complete",
        ]

        if progress["failed_subtasks"] > 0:
            lines.append(
                f"Failed: {progress['failed_subtasks']} subtasks need attention"
            )

        if progress["is_complete"]:
            lines.append("Status: COMPLETE - Ready for final acceptance testing")
        else:
            next_work = self.get_next_subtask()
            if next_work:
                phase, subtask = next_work
                lines.append(
                    f"Next: Phase {phase.phase} ({phase.name}) - {subtask.description}"
                )
            else:
                lines.append("Status: BLOCKED - No available subtasks")

        return "\n".join(lines)

    def add_followup_phase(
        self,
        name: str,
        subtasks: list[Subtask],
        phase_type: PhaseType = PhaseType.IMPLEMENTATION,
        parallel_safe: bool = False,
    ) -> Phase:
        """
        Add a new follow-up phase to an existing (typically completed) plan.

        This allows users to extend completed builds with additional work.
        The new phase depends on all existing phases to ensure proper sequencing.

        Args:
            name: Name of the follow-up phase (e.g., "Follow-Up: Add validation")
            subtasks: List of Subtask objects to include in the phase
            phase_type: Type of the phase (default: implementation)
            parallel_safe: Whether subtasks in this phase can run in parallel

        Returns:
            The newly created Phase object

        Example:
            >>> plan = ImplementationPlan.load(plan_path)
            >>> new_subtasks = [Subtask(id="followup-1", description="Add error handling")]
            >>> plan.add_followup_phase("Follow-Up: Error Handling", new_subtasks)
            >>> plan.save(plan_path)
        """
        # Calculate the next phase number
        if self.phases:
            next_phase_num = max(p.phase for p in self.phases) + 1
            # New phase depends on all existing phases
            depends_on = [p.phase for p in self.phases]
        else:
            next_phase_num = 1
            depends_on = []

        # Create the new phase
        new_phase = Phase(
            phase=next_phase_num,
            name=name,
            type=phase_type,
            subtasks=subtasks,
            depends_on=depends_on,
            parallel_safe=parallel_safe,
        )

        # Append to phases list
        self.phases.append(new_phase)

        # Update status to in_progress since we now have pending work
        self.status = "in_progress"
        self.planStatus = "in_progress"

        # Clear QA signoff since the plan has changed
        self.qa_signoff = None

        return new_phase

    def reset_for_followup(self) -> bool:
        """
        Reset plan status from completed/done back to in_progress for follow-up work.

        This method is called when a user wants to add follow-up tasks to a
        completed build. It transitions the plan status back to in_progress
        so the build pipeline can continue processing new subtasks.

        The method:
        - Sets status to "in_progress" (from "done", "ai_review", "human_review")
        - Sets planStatus to "in_progress" (from "completed", "review")
        - Clears QA signoff since new work invalidates previous approval
        - Clears recovery notes from previous run

        Returns:
            bool: True if reset was successful, False if plan wasn't in a
                  completed/reviewable state

        Example:
            >>> plan = ImplementationPlan.load(plan_path)
            >>> if plan.reset_for_followup():
            ...     plan.add_followup_phase("New Work", subtasks)
            ...     plan.save(plan_path)
        """
        # States that indicate the plan is "complete" or in review
        completed_statuses = {"done", "ai_review", "human_review"}
        completed_plan_statuses = {"completed", "review"}

        # Check if plan is actually in a completed/reviewable state
        is_completed = (
            self.status in completed_statuses
            or self.planStatus in completed_plan_statuses
        )

        # Also check if all subtasks are actually completed
        all_subtasks = [s for p in self.phases for s in p.subtasks]
        all_subtasks_done = all_subtasks and all(
            s.status == SubtaskStatus.COMPLETED for s in all_subtasks
        )

        if not (is_completed or all_subtasks_done):
            # Plan is not in a state that needs resetting
            return False

        # Transition back to in_progress
        self.status = "in_progress"
        self.planStatus = "in_progress"

        # Clear QA signoff since we're adding new work
        self.qa_signoff = None

        # Clear any recovery notes from previous run
        self.recoveryNote = None

        return True


@dataclass
class ChangeRequestState:
    """State information for a change request."""

    request_id: str
    status: str  # "pending", "planning", "processing", "completed", "failed"
    created_at: str
    updated_at: str
    description: str
    phase_id: str | None = None
    subtask_count: int = 0
    completed_subtasks: int = 0
    error_message: str | None = None
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ChangeRequestConfig:
    """Configuration for change request processing."""

    max_active_requests: int = 5
    auto_process: bool = True
    retry_failed: bool = True
    max_retries: int = 3
    cleanup_completed: bool = True
    cleanup_after_days: int = 7


class ChangeRequestManager:
    """
    Manages state and lifecycle of change requests (follow-up tasks).

    This class provides centralized state management for change request processing,
    tracking requests from initial submission through planning and execution phases.
    It integrates with the implementation plan to ensure proper state transitions
    and maintains history for debugging and analytics.

    Responsibilities:
    - Track change request lifecycle states
    - Manage request queue and processing order
    - Handle state transitions between phases
    - Maintain request history and metadata
    - Provide change request context for agents
    - Handle cleanup of old/completed requests
    """

    def __init__(self, spec_dir: Path, config: ChangeRequestConfig | None = None):
        """
        Initialize change request manager.

        Args:
            spec_dir: Spec directory containing change request state files
            config: Configuration for change request behavior (defaults to sensible values)
        """
        self.spec_dir = spec_dir
        self.memory_dir = spec_dir / "memory"
        self.change_requests_file = self.memory_dir / "change_requests.json"

        # Use provided config or create default
        self.config = config or ChangeRequestConfig()

        # Ensure memory directory exists
        self.memory_dir.mkdir(parents=True, exist_ok=True)

        # Initialize state file if it doesn't exist
        if not self.change_requests_file.exists():
            self._init_change_requests_state()

    def _init_change_requests_state(self) -> None:
        """Initialize the change requests state file."""
        initial_data = {
            "active_requests": {},
            "completed_requests": {},
            "failed_requests": {},
            "request_history": [],
            "metadata": {
                "created_at": datetime.now().isoformat(),
                "last_updated": datetime.now().isoformat(),
                "total_requests": 0,
            },
            "config": {
                "max_active_requests": self.config.max_active_requests,
                "auto_process": self.config.auto_process,
                "retry_failed": self.config.retry_failed,
                "max_retries": self.config.max_retries,
                "cleanup_completed": self.config.cleanup_completed,
                "cleanup_after_days": self.config.cleanup_after_days,
            },
        }
        with open(self.change_requests_file, "w") as f:
            json.dump(initial_data, f, indent=2)

    def _load_change_requests_state(self) -> dict:
        """Load change requests state from JSON file."""
        try:
            with open(self.change_requests_file) as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError):
            self._init_change_requests_state()
            with open(self.change_requests_file) as f:
                return json.load(f)

    def _save_change_requests_state(self, data: dict) -> None:
        """Save change requests state to JSON file."""
        data["metadata"]["last_updated"] = datetime.now().isoformat()
        data["config"] = {
            "max_active_requests": self.config.max_active_requests,
            "auto_process": self.config.auto_process,
            "retry_failed": self.config.retry_failed,
            "max_retries": self.config.max_retries,
            "cleanup_completed": self.config.cleanup_completed,
            "cleanup_after_days": self.config.cleanup_after_days,
        }
        with open(self.change_requests_file, "w") as f:
            json.dump(data, f, indent=2)

    def create_change_request(self, description: str, metadata: dict[str, Any] | None = None) -> str:
        """
        Create a new change request.

        Args:
            description: Description of the change request
            metadata: Additional metadata for the request

        Returns:
            Request ID for tracking
        """
        state = self._load_change_requests_state()

        # Generate unique request ID
        request_id = f"cr-{datetime.now().strftime('%Y%m%d-%H%M%S')}"

        # Create request state
        request_state = ChangeRequestState(
            request_id=request_id,
            status="pending",
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            description=description,
            metadata=metadata or {},
        )

        # Add to active requests
        state["active_requests"][request_id] = {
            "request_id": request_state.request_id,
            "status": request_state.status,
            "created_at": request_state.created_at,
            "updated_at": request_state.updated_at,
            "description": request_state.description,
            "phase_id": request_state.phase_id,
            "subtask_count": request_state.subtask_count,
            "completed_subtasks": request_state.completed_subtasks,
            "error_message": request_state.error_message,
            "metadata": request_state.metadata,
        }

        # Update metadata
        state["metadata"]["total_requests"] += 1

        # Add to history
        state["request_history"].append({
            "request_id": request_id,
            "action": "created",
            "timestamp": request_state.created_at,
            "description": description,
        })

        self._save_change_requests_state(state)
        return request_id

    def update_request_status(
        self,
        request_id: str,
        status: str,
        phase_id: str | None = None,
        subtask_count: int | None = None,
        completed_subtasks: int | None = None,
        error_message: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> bool:
        """
        Update the status of a change request.

        Args:
            request_id: ID of the request to update
            status: New status
            phase_id: Phase ID if request is being processed
            subtask_count: Number of subtasks created
            completed_subtasks: Number of completed subtasks
            error_message: Error message if status is failed
            metadata: Additional metadata to update

        Returns:
            True if update was successful, False if request not found
        """
        state = self._load_change_requests_state()

        # Check active requests first
        request_data = state["active_requests"].get(request_id)
        source = "active"

        if not request_data:
            # Check failed requests for retry scenarios
            request_data = state["failed_requests"].get(request_id)
            source = "failed"

        if not request_data:
            return False

        # Update request data
        old_status = request_data["status"]
        request_data["status"] = status
        request_data["updated_at"] = datetime.now().isoformat()

        if phase_id is not None:
            request_data["phase_id"] = phase_id
        if subtask_count is not None:
            request_data["subtask_count"] = subtask_count
        if completed_subtasks is not None:
            request_data["completed_subtasks"] = completed_subtasks
        if error_message is not None:
            request_data["error_message"] = error_message
        if metadata:
            request_data["metadata"].update(metadata)

        # Move between state collections based on status transition
        if status == "completed":
            # Move from active/failed to completed
            if source == "active":
                del state["active_requests"][request_id]
            elif source == "failed":
                del state["failed_requests"][request_id]

            state["completed_requests"][request_id] = request_data

        elif status == "failed":
            # Move from active to failed
            if source == "active":
                del state["active_requests"][request_id]
            state["failed_requests"][request_id] = request_data

        elif status == "processing" and source == "failed":
            # Move from failed back to active for retry
            del state["failed_requests"][request_id]
            state["active_requests"][request_id] = request_data

        # Add to history
        state["request_history"].append({
            "request_id": request_id,
            "action": "status_changed",
            "timestamp": request_data["updated_at"],
            "old_status": old_status,
            "new_status": status,
        })

        self._save_change_requests_state(state)
        return True

    def get_request(self, request_id: str) -> ChangeRequestState | None:
        """
        Get a change request by ID.

        Args:
            request_id: ID of the request

        Returns:
            ChangeRequestState or None if not found
        """
        state = self._load_change_requests_state()

        # Check all request collections
        for collection in [state["active_requests"], state["completed_requests"], state["failed_requests"]]:
            if request_id in collection:
                data = collection[request_id]
                return ChangeRequestState(
                    request_id=data["request_id"],
                    status=data["status"],
                    created_at=data["created_at"],
                    updated_at=data["updated_at"],
                    description=data["description"],
                    phase_id=data.get("phase_id"),
                    subtask_count=data.get("subtask_count", 0),
                    completed_subtasks=data.get("completed_subtasks", 0),
                    error_message=data.get("error_message"),
                    metadata=data.get("metadata", {}),
                )

        return None

    def get_active_requests(self) -> list[ChangeRequestState]:
        """
        Get all active change requests.

        Returns:
            List of active ChangeRequestState objects
        """
        state = self._load_change_requests_state()

        active_requests = []
        for request_data in state["active_requests"].values():
            active_requests.append(ChangeRequestState(
                request_id=request_data["request_id"],
                status=request_data["status"],
                created_at=request_data["created_at"],
                updated_at=request_data["updated_at"],
                description=request_data["description"],
                phase_id=request_data.get("phase_id"),
                subtask_count=request_data.get("subtask_count", 0),
                completed_subtasks=request_data.get("completed_subtasks", 0),
                error_message=request_data.get("error_message"),
                metadata=request_data.get("metadata", {}),
            ))

        return sorted(active_requests, key=lambda r: r.created_at)

    def can_process_new_request(self) -> bool:
        """
        Check if a new change request can be processed.

        Returns:
            True if processing is allowed, False otherwise
        """
        if not self.config.auto_process:
            return False

        state = self._load_change_requests_state()
        active_count = len(state["active_requests"])

        return active_count < self.config.max_active_requests

    def get_next_pending_request(self) -> ChangeRequestState | None:
        """
        Get the next pending change request for processing.

        Returns:
            Next pending ChangeRequestState or None if no pending requests
        """
        active_requests = self.get_active_requests()

        # Find the oldest pending request
        for request in active_requests:
            if request.status == "pending":
                return request

        return None

    def mark_request_planning(self, request_id: str, phase_id: str) -> bool:
        """
        Mark a change request as in the planning phase.

        Args:
            request_id: ID of the request
            phase_id: ID of the phase being planned

        Returns:
            True if update was successful
        """
        return self.update_request_status(
            request_id=request_id,
            status="planning",
            phase_id=phase_id,
        )

    def mark_request_processing(
        self,
        request_id: str,
        phase_id: str,
        subtask_count: int,
    ) -> bool:
        """
        Mark a change request as being processed.

        Args:
            request_id: ID of the request
            phase_id: ID of the phase containing the subtasks
            subtask_count: Number of subtasks created for this request

        Returns:
            True if update was successful
        """
        return self.update_request_status(
            request_id=request_id,
            status="processing",
            phase_id=phase_id,
            subtask_count=subtask_count,
        )

    def update_request_progress(self, request_id: str, completed_subtasks: int) -> bool:
        """
        Update the progress of a change request.

        Args:
            request_id: ID of the request
            completed_subtasks: Number of completed subtasks

        Returns:
            True if update was successful
        """
        return self.update_request_status(
            request_id=request_id,
            status="processing",
            completed_subtasks=completed_subtasks,
        )

    def complete_request(self, request_id: str) -> bool:
        """
        Mark a change request as completed.

        Args:
            request_id: ID of the request

        Returns:
            True if update was successful
        """
        request = self.get_request(request_id)
        if not request:
            return False

        # Mark all subtasks as completed
        completed_subtasks = max(request.subtask_count, request.completed_subtasks)

        return self.update_request_status(
            request_id=request_id,
            status="completed",
            completed_subtasks=completed_subtasks,
        )

    def fail_request(self, request_id: str, error_message: str) -> bool:
        """
        Mark a change request as failed.

        Args:
            request_id: ID of the request
            error_message: Error message describing the failure

        Returns:
            True if update was successful
        """
        return self.update_request_status(
            request_id=request_id,
            status="failed",
            error_message=error_message,
        )

    def retry_failed_request(self, request_id: str) -> bool:
        """
        Retry a failed change request.

        Args:
            request_id: ID of the failed request

        Returns:
            True if retry was initiated, False if request not found or not retryable
        """
        if not self.config.retry_failed:
            return False

        request = self.get_request(request_id)
        if not request or request.status != "failed":
            return False

        # Check retry limit
        retry_count = request.metadata.get("retry_count", 0)
        if retry_count >= self.config.max_retries:
            return False

        # Update retry count and reset to pending
        metadata = request.metadata.copy()
        metadata["retry_count"] = retry_count + 1
        metadata["last_retry"] = datetime.now().isoformat()

        return self.update_request_status(
            request_id=request_id,
            status="pending",
            metadata=metadata,
        )

    def cleanup_old_requests(self) -> int:
        """
        Clean up old completed requests.

        Returns:
            Number of requests cleaned up
        """
        if not self.config.cleanup_completed:
            return 0

        state = self._load_change_requests_state()

        # Convert cleanup_after_days to date threshold
        import datetime as dt
        from datetime import timedelta
        cutoff_datetime = dt.datetime.now() - timedelta(days=self.config.cleanup_after_days)
        cutoff_date = cutoff_datetime.isoformat()

        # Find old completed requests
        to_remove = []
        for request_id, request_data in state["completed_requests"].items():
            if request_data["updated_at"] < cutoff_date:
                to_remove.append(request_id)

        # Remove old requests
        for request_id in to_remove:
            del state["completed_requests"][request_id]

            # Add to history
            state["request_history"].append({
                "request_id": request_id,
                "action": "cleanup",
                "timestamp": datetime.now().isoformat(),
                "reason": f"Older than {self.config.cleanup_after_days} days",
            })

        if to_remove:
            self._save_change_requests_state(state)

        return len(to_remove)

    def get_request_summary(self) -> dict:
        """
        Get a summary of change request statistics.

        Returns:
            Dictionary with request statistics
        """
        state = self._load_change_requests_state()

        return {
            "total_requests": state["metadata"]["total_requests"],
            "active_requests": len(state["active_requests"]),
            "completed_requests": len(state["completed_requests"]),
            "failed_requests": len(state["failed_requests"]),
            "pending_requests": len([
                r for r in state["active_requests"].values()
                if r["status"] == "pending"
            ]),
            "processing_requests": len([
                r for r in state["active_requests"].values()
                if r["status"] in ["planning", "processing"]
            ]),
            "can_process_new": self.can_process_new_request(),
            "last_updated": state["metadata"]["last_updated"],
        }

    def sync_with_implementation_plan(self, plan: "ImplementationPlan") -> None:
        """
        Synchronize change request state with implementation plan.

        Args:
            plan: Implementation plan to sync with
        """
        state = self._load_change_requests_state()
        updated = False

        # Update active requests based on plan phases
        for request_id, request_data in state["active_requests"].items():
            if request_data.get("phase_id"):
                # Find the phase in the plan
                phase = next((p for p in plan.phases if str(p.phase) == request_data["phase_id"]), None)
                if phase:
                    # Update subtask count
                    subtask_count = len(phase.subtasks)
                    completed_count = sum(
                        1 for s in phase.subtasks
                        if s.status == SubtaskStatus.COMPLETED
                    )

                    if (request_data.get("subtask_count", 0) != subtask_count or
                        request_data.get("completed_subtasks", 0) != completed_count):

                        # Update request progress
                        if completed_count == subtask_count and subtask_count > 0:
                            # All subtasks completed - mark request as completed
                            self.complete_request(request_id)
                        else:
                            # Update progress
                            self.update_request_progress(request_id, completed_count)

                        updated = True

        # Save if any updates were made
        if updated:
            self._save_change_requests_state(state)
