"""Full Auto Executor for autonomous methodology execution.

Story Reference: Story 4.1 - Implement Full Auto Task Executor
Story Reference: Story 4.2 - Implement Planning Phase Execution
Story Reference: Story 4.3 - Implement Coding Phase Execution

This module provides the FullAutoExecutor class that executes all methodology
phases without user intervention. In Full Auto mode, the system executes
planning, coding, and validation phases in sequence, reporting progress
continuously.

Architecture Source: architecture.md#Task-Execution
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from enum import StrEnum
from pathlib import Path
from typing import TYPE_CHECKING, Any, Literal

# fcntl is POSIX only - use for file locking on Unix/macOS
try:
    import fcntl

    HAS_FCNTL = True
except ImportError:
    HAS_FCNTL = False

from apps.backend.methodologies.protocols import (
    MethodologyRunner,
    Phase,
    PhaseResult,
    PhaseStatus,
    ProgressEvent,
    ProgressStatus,
    RunContext,
    TaskConfig,
)

if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class TaskState(StrEnum):
    """State values for task execution lifecycle.

    Story Reference: Story 4.2 Task 3 - Update task state management

    These states track the progress of a task through the execution pipeline.
    States are persisted to a JSON file in the task directory to support
    recovery on restart.

    Attributes:
        CREATED: Task has been created but not started
        PLANNING: Planning phase is in progress
        PLANNING_COMPLETE: Planning phase completed successfully
        CODING: Coding phase is in progress
        CODING_COMPLETE: Coding phase completed successfully
        VALIDATION: Validation phase is in progress
        COMPLETED: All phases completed successfully
        FAILED: Task execution failed
        ESCALATED: Task requires human intervention (Story 4.5)
    """

    CREATED = "created"
    PLANNING = "planning"
    PLANNING_COMPLETE = "planning_complete"
    CODING = "coding"
    CODING_COMPLETE = "coding_complete"
    VALIDATION = "validation"
    VALIDATION_COMPLETE = "validation_complete"
    COMPLETED = "completed"
    FAILED = "failed"
    ESCALATED = "escalated"


# Planning artifact requirements per methodology.
#
# This dictionary maps methodology names to their required planning phase artifacts.
# When a planning phase completes, these artifacts must exist and be non-empty for
# the phase to be considered successful.
#
# To add a new methodology:
#   1. Add a new key (methodology name in lowercase)
#   2. List all required artifact filenames as values
#   3. Update verify_planning_artifacts() if special validation is needed
#
# Story Reference: Story 4.2 Task 1 - Define planning phase interface
_PLANNING_ARTIFACTS: dict[str, list[str]] = {
    "native": ["spec.md", "implementation_plan.json"],
    "bmad": ["prd.md", "architecture.md", "epics.md"],
}


@dataclass
class TaskResult:
    """Result of executing a methodology task.

    Story Reference: Story 4.1 Task 1 - TaskResult structure

    Attributes:
        status: Outcome of the task execution. Values:
            - "completed": All phases executed successfully
            - "failed": A phase failed during execution
            - "escalated": Task requires human intervention (Story 4.5 - future scope)
        phase: ID of the phase that failed (if status is "failed")
        error: Error message if execution failed
        artifacts: List of artifact file paths produced
        duration_seconds: Total execution time in seconds

    Note: The "escalated" status is pre-defined for Story 4.5 (Implement Task
    Escalation Handling). Currently only "completed" and "failed" are returned
    by FullAutoExecutor.
    """

    status: Literal["completed", "failed", "escalated"]
    phase: str | None = None
    error: str | None = None
    artifacts: list[str] = field(default_factory=list)
    duration_seconds: float = 0


class FullAutoExecutor:
    """Executor for Full Auto mode that runs all phases without pausing.

    In Full Auto mode, the executor:
    - Loops through all methodology phases in sequence
    - Executes each phase without user prompts
    - Reports progress continuously via ProgressService
    - Continues until completion or failure
    - Logs phase start/complete with timestamps

    Story Reference: Story 4.1 - Implement Full Auto Task Executor
    Architecture Source: architecture.md#Task-Execution

    Example:
        runner = get_methodology_runner("native")
        context = create_run_context(task_config)
        executor = FullAutoExecutor(
            runner=runner,
            context=context,
            task_config=task_config,
        )
        result = await executor.execute()
        if result.status == "completed":
            print("Task completed successfully!")
    """

    def __init__(
        self,
        runner: MethodologyRunner,
        context: RunContext,
        task_config: TaskConfig,
        log_dir: str | Path | None = None,
        task_dir: str | Path | None = None,
    ) -> None:
        """Initialize the Full Auto executor.

        Story Reference: Story 4.1 Task 1 - Accept task configuration and methodology runner
        Story Reference: Story 4.2 Task 3 - Add task_dir for state persistence

        Args:
            runner: The methodology runner that provides phases and execution logic
            context: RunContext with access to all framework services
            task_config: Configuration for the task being executed
            log_dir: Optional directory for storing execution logs
            task_dir: Optional directory for task state persistence (Story 4.2)
        """
        self.runner = runner
        self.context = context
        self.task_config = task_config
        self._log_dir = Path(log_dir) if log_dir else None
        self._task_dir = Path(task_dir) if task_dir else None
        self._start_time: float = 0
        self._collected_artifacts: list[str] = []
        self._phases: list[Phase] = []
        self._current_state: TaskState | None = None

        # Story 4.3: Initialize spec_dir and worktree_path for coding phase
        # These can be set from task_config.metadata or explicitly via properties
        spec_dir_str = (
            task_config.metadata.get("spec_dir") if task_config.metadata else None
        )
        self._spec_dir: Path | None = Path(spec_dir_str) if spec_dir_str else None
        worktree_str = (
            task_config.metadata.get("worktree_path") if task_config.metadata else None
        )
        self._worktree_path: Path | None = Path(worktree_str) if worktree_str else None

        # Task-specific logger for filtering logs by task ID.
        # Logger name format: "apps.backend.core.executors.full_auto.{task_id}"
        # This allows log filtering with: logging.getLogger("...full_auto.task-123")
        self._logger = logging.getLogger(f"{__name__}.{task_config.task_id}")

        # Story 4.2: Load existing state for recovery
        self._load_existing_state()

    async def execute(self) -> TaskResult:
        """Execute all phases without user intervention.

        Story Reference: Story 4.1 Task 2 - Implement execute method

        This method:
        1. Initializes the methodology runner with context
        2. Gets all phases from the runner
        3. Executes each phase in sequence
        4. Reports progress continuously
        5. Collects artifacts from each phase
        6. Returns a TaskResult with final status

        Returns:
            TaskResult indicating success/failure and execution details

        Raises:
            No exceptions are raised; errors are captured in TaskResult
        """
        self._start_time = time.time()

        # Initialize the methodology runner
        self._log_info("Initializing methodology runner")
        self.runner.initialize(self.context)

        # Get all phases from the methodology
        self._phases = self.runner.get_phases()
        total_phases = len(self._phases)

        if total_phases == 0:
            self._log_warning("No phases defined in methodology")
            return TaskResult(
                status="failed",
                error="No phases defined in methodology",
                duration_seconds=self._get_elapsed_time(),
            )

        self._log_info(f"Starting execution with {total_phases} phases")
        self._emit_progress_event(
            phase_id="init",
            status=ProgressStatus.STARTED,
            message=f"Starting Full Auto execution with {total_phases} phases",
            percentage=0.0,
        )

        # Execute each phase in sequence
        for index, phase in enumerate(self._phases):
            # Story 4.2: Update state before phase execution
            phase_state = self._get_state_for_phase(phase.id)
            if phase_state:
                self.update_task_state(phase_state)

            phase_result = self._execute_phase(phase, index, total_phases)

            if not phase_result.success:
                self._log_error(
                    f"Phase {phase.name} failed: {phase_result.error}",
                    phase_id=phase.id,
                )
                self._emit_progress_event(
                    phase_id=phase.id,
                    status=ProgressStatus.FAILED,
                    message=f"Phase {phase.name} failed: {phase_result.error}",
                    percentage=self._calculate_percentage(index, total_phases),
                )
                # Story 4.2 Task 5: Update state to failed on phase failure
                self.update_task_state(TaskState.FAILED)
                return TaskResult(
                    status="failed",
                    phase=phase.id,
                    error=phase_result.error,
                    artifacts=self._collected_artifacts,
                    duration_seconds=self._get_elapsed_time(),
                )

            # Story 4.2 AC#1: Verify planning artifacts after planning phase
            if phase.id == "planning":
                spec_dir_str = self.task_config.metadata.get("spec_dir")
                methodology = self.task_config.metadata.get("methodology", "native")
                if spec_dir_str:
                    spec_dir = Path(spec_dir_str)
                    if not self.verify_planning_artifacts(spec_dir, methodology):
                        error_msg = "Planning artifacts verification failed"
                        self._log_error(error_msg, phase_id=phase.id)
                        self._emit_progress_event(
                            phase_id=phase.id,
                            status=ProgressStatus.FAILED,
                            message=error_msg,
                            percentage=self._calculate_percentage(index, total_phases),
                        )
                        self.update_task_state(TaskState.FAILED)
                        return TaskResult(
                            status="failed",
                            phase=phase.id,
                            error=error_msg,
                            artifacts=self._collected_artifacts,
                            duration_seconds=self._get_elapsed_time(),
                        )

            # Story 4.2: Update state after successful phase completion
            complete_state = self._get_complete_state_for_phase(phase.id)
            if complete_state:
                self.update_task_state(complete_state)

            # Collect artifacts from this phase
            if phase_result.artifacts:
                self._collected_artifacts.extend(phase_result.artifacts)

        # All phases completed successfully
        duration = self._get_elapsed_time()
        self._log_info(f"All phases completed successfully in {duration:.2f}s")
        self._emit_progress_event(
            phase_id="complete",
            status=ProgressStatus.COMPLETED,
            message=f"Task completed successfully in {duration:.2f}s",
            percentage=100.0,
        )

        # Story 4.2: Update final state to completed
        self.update_task_state(TaskState.COMPLETED)

        return TaskResult(
            status="completed",
            artifacts=self._collected_artifacts,
            duration_seconds=duration,
        )

    def _execute_phase(
        self, phase: Phase, index: int, total_phases: int
    ) -> PhaseResult:
        """Execute a single phase and report progress.

        Story Reference: Story 4.1 Task 4 - Implement phase sequencing

        Note: This method is synchronous because MethodologyRunner.execute_phase()
        is defined as synchronous in the Protocol (protocols.py). The outer
        execute() method is async to allow for async context setup and future
        async runner support.

        Args:
            phase: The phase to execute
            index: Current phase index (0-based)
            total_phases: Total number of phases

        Returns:
            PhaseResult from the methodology runner
        """
        percentage = self._calculate_percentage(index, total_phases)

        # Log and emit phase start
        self._log_info(f"Starting phase: {phase.name}", phase_id=phase.id)
        self._emit_progress_event(
            phase_id=phase.id,
            status=ProgressStatus.STARTED,
            message=f"Starting phase: {phase.name}",
            percentage=percentage,
        )

        # Update phase status to in-progress
        phase.status = PhaseStatus.IN_PROGRESS

        try:
            # Execute the phase
            result = self.runner.execute_phase(phase.id)

            if result.success:
                phase.status = PhaseStatus.COMPLETED
                self._log_info(
                    f"Completed phase: {phase.name}",
                    phase_id=phase.id,
                )
                self._emit_progress_event(
                    phase_id=phase.id,
                    status=ProgressStatus.COMPLETED,
                    message=f"Completed phase: {phase.name}",
                    percentage=self._calculate_percentage(index + 1, total_phases),
                )
            else:
                phase.status = PhaseStatus.FAILED

            return result

        except Exception as e:
            # Catch and handle execution errors
            phase.status = PhaseStatus.FAILED
            error_msg = f"Exception during phase execution: {e}"
            self._log_error(error_msg, phase_id=phase.id)
            return PhaseResult(
                success=False,
                phase_id=phase.id,
                error=error_msg,
            )

    def _calculate_percentage(self, completed_phases: int, total_phases: int) -> float:
        """Calculate overall progress percentage based on phase count.

        Story Reference: Story 4.1 Task 3 - Report overall task percentage

        NOTE: This method calculates coarse-grained progress based on phase count.
        For granular within-phase progress, use phase-specific methods:
        - calculate_subtask_percentage(): Coding phase (35-75% range)
        - _calculate_validation_percentage(): Validation phase (75-100% range)

        The overall progress breakdown is:
        - Planning: 0-35% (calculated by this method when phases=1)
        - Coding: 35-75% (detailed tracking via calculate_subtask_percentage)
        - Validation: 75-100% (detailed tracking via _calculate_validation_percentage)

        Args:
            completed_phases: Number of phases completed
            total_phases: Total number of phases

        Returns:
            Percentage as float (0.0 to 100.0)
        """
        if total_phases == 0:
            return 0.0
        return (completed_phases / total_phases) * 100.0

    def _emit_progress_event(
        self,
        phase_id: str,
        status: ProgressStatus,
        message: str,
        percentage: float,
    ) -> None:
        """Emit a progress event through the context's progress service.

        Story Reference: Story 4.1 Task 3 - Emit progress events during execution

        Args:
            phase_id: ID of the current phase
            status: Progress status enum value
            message: Human-readable progress message
            percentage: Current overall percentage (0.0 to 100.0)
        """
        event = ProgressEvent(
            task_id=self.task_config.task_id,
            phase_id=phase_id,
            status=status.value,
            message=message,
            percentage=percentage,
            artifacts=list(self._collected_artifacts),
            timestamp=datetime.now(),
        )

        try:
            self.context.progress.emit(event)
        except Exception as e:
            self._logger.warning(f"Failed to emit progress event: {e}")

    def _get_elapsed_time(self) -> float:
        """Get elapsed time since execution started.

        Returns:
            Elapsed time in seconds
        """
        return time.time() - self._start_time

    def _log_info(self, message: str, phase_id: str | None = None) -> None:
        """Log an info message with timestamp and optional phase ID.

        Story Reference: Story 4.1 Task 5 - Log phase start with timestamp

        Args:
            message: Message to log
            phase_id: Optional phase identifier
        """
        timestamp = datetime.now().isoformat()
        prefix = f"[{phase_id}] " if phase_id else ""
        log_message = f"{prefix}{message}"
        self._logger.info(log_message)

        # Also store to log file if log_dir is configured
        self._write_to_log_file("INFO", timestamp, log_message)

    def _log_warning(self, message: str, phase_id: str | None = None) -> None:
        """Log a warning message.

        Story Reference: Story 4.1 Task 5 - Log any errors or warnings

        Args:
            message: Warning message
            phase_id: Optional phase identifier
        """
        timestamp = datetime.now().isoformat()
        prefix = f"[{phase_id}] " if phase_id else ""
        log_message = f"{prefix}{message}"
        self._logger.warning(log_message)
        self._write_to_log_file("WARNING", timestamp, log_message)

    def _log_error(self, message: str, phase_id: str | None = None) -> None:
        """Log an error message.

        Story Reference: Story 4.1 Task 5 - Log phase result (success/failure)

        Args:
            message: Error message
            phase_id: Optional phase identifier
        """
        timestamp = datetime.now().isoformat()
        prefix = f"[{phase_id}] " if phase_id else ""
        log_message = f"{prefix}{message}"
        self._logger.error(log_message)
        self._write_to_log_file("ERROR", timestamp, log_message)

    def _write_to_log_file(self, level: str, timestamp: str, message: str) -> None:
        """Write a log entry to the task's log file.

        Story Reference: Story 4.1 Task 5 - Store logs in task directory

        Uses file locking (fcntl.flock) on POSIX systems to prevent
        interleaved log entries when multiple executors write concurrently.

        Args:
            level: Log level (INFO, WARNING, ERROR)
            timestamp: ISO format timestamp
            message: Log message
        """
        if not self._log_dir:
            return

        try:
            self._log_dir.mkdir(parents=True, exist_ok=True)
            log_file = self._log_dir / f"execution_{self.task_config.task_id}.log"

            with open(log_file, "a") as f:
                # Acquire exclusive lock on POSIX systems to prevent race conditions
                if HAS_FCNTL:
                    fcntl.flock(f.fileno(), fcntl.LOCK_EX)
                try:
                    f.write(f"[{timestamp}] [{level}] {message}\n")
                finally:
                    if HAS_FCNTL:
                        fcntl.flock(f.fileno(), fcntl.LOCK_UN)
        except Exception as e:
            self._logger.warning(f"Failed to write to log file: {e}")

    # =========================================================================
    # Story 4.2: Planning Phase Execution Methods
    # =========================================================================

    def get_planning_artifacts(self, methodology: str) -> list[str]:
        """Get required planning artifacts for a methodology.

        Story Reference: Story 4.2 Task 1 - Define planning phase interface

        Different methodologies produce different planning artifacts:
        - Native: spec.md, implementation_plan.json
        - BMAD: prd.md, architecture.md, epics.md
        - Unknown: Delegates to runner.get_artifacts_for_phase if available

        Args:
            methodology: The methodology name (native, bmad, etc.)

        Returns:
            List of required artifact filenames for the planning phase
        """
        methodology_lower = methodology.lower()

        if methodology_lower in _PLANNING_ARTIFACTS:
            return _PLANNING_ARTIFACTS[methodology_lower]

        # For unknown methodologies, try to get from runner
        if hasattr(self.runner, "get_artifacts_for_phase"):
            try:
                return self.runner.get_artifacts_for_phase("planning")
            except Exception:
                pass

        # Default fallback
        return []

    def verify_planning_artifacts(self, spec_dir: Path, methodology: str) -> bool:
        """Verify that planning artifacts were produced and are valid.

        Story Reference: Story 4.2 Task 2 - Implement artifact verification

        Checks:
        1. All required artifacts exist
        2. Artifacts are non-empty
        3. Implementation plan has subtasks (for native methodology)

        Args:
            spec_dir: Directory where artifacts should be located
            methodology: The methodology name

        Returns:
            True if all artifacts are valid, False otherwise
        """
        required_artifacts = self.get_planning_artifacts(methodology)

        for artifact in required_artifacts:
            artifact_path = spec_dir / artifact
            if not artifact_path.exists():
                self._log_warning(
                    f"Artifact verification failed: {artifact} not found",
                    phase_id="planning",
                )
                return False

            # Check non-empty
            if artifact_path.stat().st_size == 0:
                self._log_warning(
                    f"Artifact verification failed: {artifact} is empty",
                    phase_id="planning",
                )
                return False

        # Additional validation for implementation plan
        if methodology.lower() == "native":
            plan_path = spec_dir / "implementation_plan.json"
            if plan_path.exists():
                try:
                    plan_data = json.loads(plan_path.read_text())
                    subtasks = plan_data.get("subtasks", [])
                    if not subtasks:
                        self._log_warning(
                            "Artifact verification failed: implementation_plan.json "
                            "has no subtasks",
                            phase_id="planning",
                        )
                        return False
                except json.JSONDecodeError as e:
                    self._log_warning(
                        f"Artifact verification failed: implementation_plan.json "
                        f"is invalid JSON ({e})",
                        phase_id="planning",
                    )
                    return False

        return True

    def _load_existing_state(self) -> None:
        """Load existing task state from file for recovery.

        Story Reference: Story 4.2 Task 3 - Allow state recovery on restart

        If the task directory contains a state.json file, load the
        previous state to support resuming interrupted tasks.
        """
        if not self._task_dir:
            return

        state_file = self._task_dir / "state.json"
        if state_file.exists():
            try:
                state_data = json.loads(state_file.read_text())
                state_str = state_data.get("state")
                if state_str:
                    self._current_state = TaskState(state_str)
                    self._log_info(f"Recovered task state: {state_str}")
            except (json.JSONDecodeError, ValueError) as e:
                self._log_warning(f"Failed to load task state: {e}")

    def update_task_state(self, state: str | TaskState) -> None:
        """Update and persist the task state.

        Story Reference: Story 4.2 Task 3 - Persist state to task JSON file

        Args:
            state: The new state value (TaskState enum or its string value)
        """
        if isinstance(state, TaskState):
            self._current_state = state
        else:
            self._current_state = TaskState(state)

        if not self._task_dir:
            return

        try:
            self._task_dir.mkdir(parents=True, exist_ok=True)
            state_file = self._task_dir / "state.json"

            # Read existing state data or create new
            state_data: dict[str, str] = {}
            if state_file.exists():
                try:
                    state_data = json.loads(state_file.read_text())
                except json.JSONDecodeError:
                    pass

            # Update state
            state_data["state"] = state
            state_data["updated_at"] = datetime.now().isoformat()

            state_file.write_text(json.dumps(state_data, indent=2))
            self._log_info(f"Task state updated: {state}")
        except Exception as e:
            self._log_warning(f"Failed to persist task state: {e}")

    def get_task_state(self) -> str | None:
        """Get the current task state.

        Story Reference: Story 4.2 Task 3 - State recovery

        Returns:
            Current state string or None if not set
        """
        if self._current_state:
            return self._current_state.value
        return None

    def _get_state_for_phase(self, phase_id: str) -> TaskState | None:
        """Map phase ID to task state for phase start.

        Story Reference: Story 4.2 Task 4 - Automatic phase transition

        Args:
            phase_id: The phase ID

        Returns:
            TaskState value for this phase start, or None if not mapped
        """
        phase_state_map: dict[str, TaskState] = {
            "planning": TaskState.PLANNING,
            "coding": TaskState.CODING,
            "validation": TaskState.VALIDATION,
            "qa_validation": TaskState.VALIDATION,
        }
        return phase_state_map.get(phase_id)

    def _get_complete_state_for_phase(self, phase_id: str) -> TaskState | None:
        """Map phase ID to task state for phase completion.

        Story Reference: Story 4.2 Task 4 - Automatic phase transition

        Args:
            phase_id: The phase ID

        Returns:
            TaskState value for this phase completion, or None if not mapped
        """
        complete_state_map: dict[str, TaskState] = {
            "planning": TaskState.PLANNING_COMPLETE,
            "coding": TaskState.CODING_COMPLETE,
            "validation": TaskState.VALIDATION_COMPLETE,
            "qa_validation": TaskState.VALIDATION_COMPLETE,
        }
        return complete_state_map.get(phase_id)

    # =========================================================================
    # Story 4.3: Coding Phase Execution Methods
    # =========================================================================

    def load_implementation_plan(self, spec_dir: Path) -> list[dict]:
        """Load subtasks from implementation_plan.json.

        Story Reference: Story 4.3 Task 1 - Load implementation plan

        Args:
            spec_dir: Directory containing implementation_plan.json

        Returns:
            List of subtask dictionaries

        Raises:
            FileNotFoundError: If implementation_plan.json doesn't exist
            json.JSONDecodeError: If the file contains invalid JSON
        """
        plan_path = spec_dir / "implementation_plan.json"
        if not plan_path.exists():
            raise FileNotFoundError(f"Implementation plan not found: {plan_path}")

        plan_data = json.loads(plan_path.read_text())
        return plan_data.get("subtasks", [])

    def get_pending_subtasks(self, spec_dir: Path) -> list[dict]:
        """Get subtasks that haven't been completed yet.

        Story Reference: Story 4.3 Task 1 - Determine execution order

        Args:
            spec_dir: Directory containing implementation_plan.json

        Returns:
            List of subtasks with status "pending"
        """
        all_subtasks = self.load_implementation_plan(spec_dir)
        return [s for s in all_subtasks if s.get("status") == "pending"]

    async def execute_subtask(self, subtask: dict) -> dict:
        """Execute a single subtask.

        Story Reference: Story 4.3 Task 2 - Implement subtask loop

        This method:
        1. Marks subtask as in_progress
        2. Delegates to methodology runner
        3. Updates subtask status on completion/failure

        Args:
            subtask: The subtask dictionary to execute

        Returns:
            Result dictionary with "success" key and optional error
        """
        subtask_id = subtask.get("id", "unknown")
        self._log_info(f"Executing subtask: {subtask_id}", phase_id="coding")

        # Mark as in_progress in the plan file
        self._update_subtask_status(subtask_id, "in_progress")

        try:
            # Execute via methodology runner
            result = await self._execute_subtask_impl(subtask)

            if result.get("success"):
                self._update_subtask_status(subtask_id, "completed")
            else:
                self._update_subtask_status(subtask_id, "failed")

            return result

        except Exception as e:
            self._update_subtask_status(subtask_id, "failed")
            return {"success": False, "error": str(e)}

    async def _execute_subtask_impl(
        self,
        subtask: dict,
        attempt: int = 1,
        recovery_context: str | None = None,
    ) -> dict:
        """Internal implementation of subtask execution.

        Story Reference: Story 4.3 Task 2 - Execute via methodology runner

        This method is the core execution logic that can be mocked for testing.

        Args:
            subtask: The subtask to execute
            attempt: Current attempt number (1-based)
            recovery_context: Optional context from previous failed attempts

        Returns:
            Result dictionary with "success" and optional "error" keys
        """
        # Default implementation - delegates to runner.execute_phase
        # In real usage, this would invoke the coder agent
        try:
            if hasattr(self.runner, "execute_subtask"):
                result = self.runner.execute_subtask(subtask, attempt, recovery_context)
                return {"success": result.success, "error": result.error}
            return {"success": True}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _update_subtask_status(self, subtask_id: str, status: str) -> None:
        """Update a subtask's status in the implementation plan.

        Story Reference: Story 4.3 Task 2 - Update status

        Args:
            subtask_id: ID of the subtask to update
            status: New status value ("in_progress", "completed", "failed")
        """
        if not self._spec_dir:
            return

        plan_path = self._spec_dir / "implementation_plan.json"
        if not plan_path.exists():
            return

        try:
            plan_data = json.loads(plan_path.read_text())
            subtasks = plan_data.get("subtasks", [])

            for subtask in subtasks:
                if subtask.get("id") == subtask_id:
                    subtask["status"] = status
                    break

            plan_path.write_text(json.dumps(plan_data, indent=2))
        except Exception as e:
            self._log_warning(f"Failed to update subtask status: {e}")

    async def execute_coding_phase(self) -> dict[str, Any]:
        """Execute the full coding phase by running all subtasks.

        Story Reference: Story 4.3 Task 2 - Iterate through subtasks

        Returns:
            Result dictionary with keys:
            - status: "coding_complete", "failed", "escalated", or "completed"
            - subtasks_executed: Number of successfully executed subtasks
            - subtask: ID of failed subtask (if failed/escalated)
            - error: Error message (if failed/escalated)
        """
        if not self._spec_dir:
            self._log_warning("No spec_dir set for coding phase")
            return {"status": "failed", "error": "No spec_dir configured"}

        try:
            pending_subtasks = self.get_pending_subtasks(self._spec_dir)
        except FileNotFoundError:
            self._log_warning("No implementation plan found")
            return {"status": "completed", "subtasks_executed": 0}

        total_subtasks = len(pending_subtasks)
        if total_subtasks == 0:
            self._log_info("No pending subtasks - coding phase complete")
            self.update_task_state(TaskState.CODING_COMPLETE)
            return {"status": "coding_complete", "subtasks_executed": 0}

        self._log_info(f"Starting coding phase with {total_subtasks} subtasks")
        self.update_task_state(TaskState.CODING)

        executed = 0
        for index, subtask in enumerate(pending_subtasks):
            subtask_id = subtask.get("id", "unknown")

            # Emit progress on start
            self.emit_subtask_progress(index, total_subtasks, subtask, "started")

            # Execute with retry logic
            result = await self.execute_subtask_with_retry(subtask)

            if result.get("success"):
                executed += 1
                # Update subtask status to completed in plan file
                self._update_subtask_status(subtask_id, "completed")
                # Emit progress on complete
                self.emit_subtask_progress(index, total_subtasks, subtask, "completed")
                # Commit changes after successful subtask
                self.commit_subtask_changes(self.format_commit_message(subtask))
            elif result.get("escalated"):
                # Escalation - preserve partial progress before stopping
                self._update_subtask_status(subtask_id, "failed")
                self.emit_subtask_progress(index, total_subtasks, subtask, "failed")
                self.update_task_state(TaskState.ESCALATED)
                self._log_error(
                    f"Subtask {subtask_id} escalated after max retries",
                    phase_id="coding",
                )
                return {
                    "status": "escalated",
                    "subtask": subtask_id,
                    "subtasks_executed": executed,
                    "error": result.get("error"),
                }
            else:
                # Non-escalated failure (unexpected) - stop execution and mark failed
                self._update_subtask_status(subtask_id, "failed")
                self.emit_subtask_progress(index, total_subtasks, subtask, "failed")
                self.update_task_state(TaskState.FAILED)
                error_msg = result.get("error", "Unknown failure")
                self._log_error(
                    f"Subtask {subtask_id} failed: {error_msg}",
                    phase_id="coding",
                )
                return {
                    "status": "failed",
                    "subtask": subtask_id,
                    "subtasks_executed": executed,
                    "error": error_msg,
                }

        self._log_info(f"Coding phase complete: {executed}/{total_subtasks} subtasks")
        self.update_task_state(TaskState.CODING_COMPLETE)
        return {"status": "coding_complete", "subtasks_executed": executed}

    def emit_subtask_progress(
        self,
        index: int,
        total: int,
        subtask: dict,
        status: str,
    ) -> None:
        """Emit progress event for a subtask.

        Story Reference: Story 4.3 Task 3 - Per-subtask progress reporting

        Args:
            index: Current subtask index (0-based)
            total: Total number of subtasks
            subtask: The subtask dictionary
            status: Status string ("started", "completed", "failed")
        """
        percentage = self.calculate_subtask_percentage(index, total)
        subtask_id = subtask.get("id", "unknown")
        subtask_title = subtask.get("title", subtask.get("description", "subtask"))

        message = f"Subtask {status}: {subtask_title}"

        progress_status = (
            ProgressStatus.STARTED
            if status == "started"
            else (
                ProgressStatus.COMPLETED
                if status == "completed"
                else ProgressStatus.FAILED
            )
        )

        self._emit_progress_event(
            phase_id="coding",
            status=progress_status,
            message=message,
            percentage=percentage,
        )

    def calculate_subtask_percentage(self, completed: int, total: int) -> float:
        """Calculate progress percentage for subtask execution.

        Story Reference: Story 4.3 Task 3 - Calculate percentage

        The coding phase spans 35-75% of overall progress (40% range).
        This method calculates where within that range we are.

        Args:
            completed: Number of completed subtasks
            total: Total number of subtasks

        Returns:
            Percentage as float (35.0 to 75.0)
        """
        if total == 0:
            return 35.0  # Start of coding phase

        # Coding phase is 35-75% (40% range)
        base_percentage = 35.0
        range_percentage = 40.0
        return base_percentage + (completed / total) * range_percentage

    def commit_subtask_changes(self, message: str) -> bool:
        """Commit changes after subtask completion.

        Story Reference: Story 4.3 Task 4 - Git commit integration

        Args:
            message: Commit message

        Returns:
            True if commit succeeded, False otherwise
        """
        import subprocess

        if not self._worktree_path:
            self._log_warning("No worktree path configured for commits")
            return False

        try:
            # Stage all changes including deletions (git add -A as per Dev Notes)
            result = subprocess.run(
                ["git", "add", "-A"],
                cwd=self._worktree_path,
                capture_output=True,
                text=True,
            )

            if result.returncode != 0:
                self._log_warning(f"Git add failed: {result.stderr}")
                return False

            # Commit
            result = subprocess.run(
                ["git", "commit", "-m", message],
                cwd=self._worktree_path,
                capture_output=True,
                text=True,
            )

            if result.returncode != 0:
                if (
                    "nothing to commit" in result.stdout
                    or "nothing to commit" in result.stderr
                ):
                    return True  # No changes to commit
                self._log_warning(f"Git commit failed: {result.stderr}")
                return False

            self._log_info(f"Committed changes: {message}")
            return True

        except Exception as e:
            self._log_warning(f"Git operation failed: {e}")
            return False

    def format_commit_message(self, subtask: dict) -> str:
        """Format a commit message for a subtask.

        Story Reference: Story 4.3 Task 4 - Meaningful commit messages

        Args:
            subtask: The completed subtask

        Returns:
            Formatted commit message string
        """
        subtask_id = subtask.get("id", "unknown")
        title = subtask.get("title", subtask.get("description", "subtask"))
        return f"Implement: {title} (#{subtask_id})"

    async def execute_subtask_with_retry(
        self,
        subtask: dict,
        max_retries: int = 3,
    ) -> dict:
        """Execute a subtask with retry logic.

        Story Reference: Story 4.3 Task 5 - Retry logic

        Implements exponential backoff with recovery context passed
        on retry attempts.

        Args:
            subtask: The subtask to execute
            max_retries: Maximum number of attempts (default 3)

        Returns:
            Result dictionary with "success", "error", and potentially "escalated"
        """

        last_error = None
        recovery_context = None

        for attempt in range(1, max_retries + 1):
            self._log_info(
                f"Executing subtask {subtask.get('id')} (attempt {attempt}/{max_retries})",
                phase_id="coding",
            )

            result = await self._execute_subtask_impl(
                subtask,
                attempt=attempt,
                recovery_context=recovery_context,
            )

            if result.get("success"):
                return result

            last_error = result.get("error", "Unknown error")
            recovery_context = f"Previous attempt {attempt} failed: {last_error}"

            # Exponential backoff (1s, 2s, 4s)
            if attempt < max_retries:
                backoff = 2 ** (attempt - 1)
                self._log_info(
                    f"Retry in {backoff}s due to: {last_error}",
                    phase_id="coding",
                )
                await asyncio.sleep(backoff)

        # All retries exhausted - escalate
        self._log_error(
            f"Subtask {subtask.get('id')} failed after {max_retries} attempts: {last_error}",
            phase_id="coding",
        )
        self.update_task_state(TaskState.ESCALATED)

        return {
            "success": False,
            "error": f"Escalated after {max_retries} failed attempts: {last_error}",
            "escalated": True,
        }

    # =========================================================================
    # Story 4.4: Validation Phase Execution Methods
    # =========================================================================

    async def execute_validation_phase(self, max_iterations: int = 5) -> dict[str, Any]:
        """Execute the validation phase with QA reviewer/fixer loop.

        Story Reference: Story 4.4 - Implement Validation Phase Execution

        This method implements the validation loop that:
        1. Runs QA reviewer to validate against acceptance criteria
        2. Runs tests if present in the project
        3. If issues found and fixable, invokes QA fixer
        4. Re-runs validation after fixes
        5. Loops until validation passes or max iterations reached
        6. Updates task state to COMPLETED on success

        Args:
            max_iterations: Maximum number of fix loop iterations (default 5)

        Returns:
            Result dictionary with keys:
            - status: "completed", "failed", or "escalated"
            - iterations: Number of iterations performed
            - qa_report_path: Path to generated QA report
            - test_results: Summary of test execution
            - error: Error message if failed
        """
        if not self._spec_dir:
            self._log_warning("No spec_dir set for validation phase")
            return {"status": "failed", "error": "No spec_dir configured"}

        self._log_info("Starting validation phase", phase_id="validation")
        self.update_task_state(TaskState.VALIDATION)

        # Initialize validation phase
        self._emit_progress_event(
            phase_id="validation",
            status=ProgressStatus.STARTED,
            message="Starting validation phase",
            percentage=self._calculate_validation_percentage(0, max_iterations),
        )

        qa_report_path: str | None = None
        test_results: dict[str, Any] = {}

        for iteration in range(1, max_iterations + 1):
            self._log_info(
                f"Validation iteration {iteration}/{max_iterations}",
                phase_id="validation",
            )

            self._emit_progress_event(
                phase_id="validation",
                status=ProgressStatus.IN_PROGRESS,
                message=f"Validation iteration {iteration}/{max_iterations}",
                percentage=self._calculate_validation_percentage(
                    iteration - 1, max_iterations
                ),
            )

            # Run QA reviewer
            qa_result = await self._run_qa_reviewer(iteration, max_iterations)

            # Run tests if present
            test_result = await self._run_tests()
            test_results = test_result

            # Generate QA report
            qa_report_path = self._generate_qa_report(qa_result, test_result, iteration)

            # Check if both QA and tests passed
            if qa_result.get("passed") and test_result.get("passed"):
                self._log_info("Validation passed!", phase_id="validation")

                self.update_task_state(TaskState.COMPLETED)

                self._emit_progress_event(
                    phase_id="validation",
                    status=ProgressStatus.COMPLETED,
                    message="Validation passed - all acceptance criteria verified",
                    percentage=100.0,
                )

                # Notify user of success
                self._notify_validation_success(iteration)

                return {
                    "status": "completed",
                    "iterations": iteration,
                    "qa_report_path": qa_report_path,
                    "test_results": test_results,
                }

            # Check if issues are fixable
            if not qa_result.get("fixable", True):
                self._log_error(
                    "Issues are not auto-fixable, escalating to human",
                    phase_id="validation",
                )

                self.update_task_state(TaskState.ESCALATED)

                self._emit_progress_event(
                    phase_id="validation",
                    status=ProgressStatus.FAILED,
                    message="Unfixable issues found - escalating to human review",
                    percentage=self._calculate_validation_percentage(
                        iteration, max_iterations
                    ),
                )

                return {
                    "status": "escalated",
                    "iterations": iteration,
                    "qa_report_path": qa_report_path,
                    "test_results": test_results,
                    "error": "Unfixable issues found - requires human intervention",
                }

            # Last iteration - no more retries
            if iteration >= max_iterations:
                self._log_error(
                    f"Validation failed after {max_iterations} iterations",
                    phase_id="validation",
                )
                break

            # Attempt fix
            issues = qa_result.get("issues", [])
            self._log_info(
                f"Attempting fix for {len(issues)} issues",
                phase_id="validation",
            )

            self._emit_progress_event(
                phase_id="validation",
                status=ProgressStatus.IN_PROGRESS,
                message=f"Fixing {len(issues)} issues (iteration {iteration})",
                percentage=self._calculate_validation_percentage(
                    iteration, max_iterations
                ),
            )

            await self._run_qa_fixer(issues, iteration)

        # Max iterations reached without passing
        self._log_error(
            f"Validation failed after {max_iterations} iterations",
            phase_id="validation",
        )

        self.update_task_state(TaskState.FAILED)

        self._emit_progress_event(
            phase_id="validation",
            status=ProgressStatus.FAILED,
            message=f"Validation failed after {max_iterations} iterations",
            percentage=self._calculate_validation_percentage(
                max_iterations, max_iterations
            ),
        )

        return {
            "status": "failed",
            "iterations": max_iterations,
            "qa_report_path": qa_report_path,
            "test_results": test_results,
            "error": f"Validation failed after {max_iterations} iterations",
        }

    def _get_qa_config(self) -> tuple[Path, str, int]:
        """Get common QA configuration for reviewer and fixer.

        Returns:
            Tuple of (project_dir, qa_model, thinking_budget)
        """
        from apps.backend.phase_config import get_phase_model, get_phase_thinking_budget

        project_dir = (
            Path(self._worktree_path)
            if self._worktree_path
            else Path(self._spec_dir).parent.parent.parent
        )

        # Get model from task_config or use default
        model = "claude-sonnet-4-5-20250929"
        if self.task_config and self.task_config.metadata:
            model = self.task_config.metadata.get("model", model)

        # Get phase-specific model and thinking budget
        qa_model = get_phase_model(self._spec_dir, "qa", model)
        thinking_budget = get_phase_thinking_budget(self._spec_dir, "qa")

        return project_dir, qa_model, thinking_budget

    async def _run_qa_reviewer(
        self,
        iteration: int,
        max_iterations: int,
    ) -> dict[str, Any]:
        """Run the QA reviewer agent to validate against acceptance criteria.

        Story Reference: Story 4.4 Task 2 - Run QA reviewer

        Args:
            iteration: Current iteration number
            max_iterations: Maximum number of iterations

        Returns:
            Dictionary with keys:
            - passed: Whether validation passed
            - status: "approved" or "rejected"
            - issues: List of issues found (if rejected)
            - fixable: Whether issues are auto-fixable
            - summary: Human-readable summary
        """
        self._log_info(
            f"Running QA reviewer (iteration {iteration})",
            phase_id="validation",
        )

        try:
            # Import here to avoid circular imports
            from apps.backend.core.client import create_client
            from apps.backend.qa.criteria import get_qa_signoff_status
            from apps.backend.qa.reviewer import run_qa_agent_session

            # Get common QA configuration
            project_dir, qa_model, qa_thinking_budget = self._get_qa_config()

            client = create_client(
                project_dir,
                self._spec_dir,
                qa_model,
                agent_type="qa_reviewer",
                max_thinking_tokens=qa_thinking_budget,
            )

            async with client:
                status, response = await run_qa_agent_session(
                    client,
                    project_dir,
                    self._spec_dir,
                    iteration,
                    max_iterations,
                    verbose=False,
                )

            # Parse the result
            if status == "approved":
                return {
                    "passed": True,
                    "status": "approved",
                    "issues": [],
                    "fixable": True,
                    "summary": "All acceptance criteria validated successfully",
                }
            elif status == "rejected":
                # Get issues from implementation plan
                qa_status = get_qa_signoff_status(self._spec_dir)
                issues = qa_status.get("issues_found", []) if qa_status else []

                return {
                    "passed": False,
                    "status": "rejected",
                    "issues": issues,
                    "fixable": True,  # Assume fixable unless escalated
                    "summary": f"QA found {len(issues)} issues",
                }
            else:
                # Error state
                return {
                    "passed": False,
                    "status": "error",
                    "issues": [{"title": "QA Error", "description": response}],
                    "fixable": False,
                    "summary": f"QA reviewer error: {response}",
                }

        except Exception as e:
            self._log_error(f"QA reviewer failed: {e}", phase_id="validation")
            return {
                "passed": False,
                "status": "error",
                "issues": [{"title": "QA Exception", "description": str(e)}],
                "fixable": False,
                "summary": f"QA reviewer exception: {e}",
            }

    async def _run_tests(self) -> dict[str, Any]:
        """Detect and run tests for the project.

        Story Reference: Story 4.4 Task 3 - Run tests if present

        Returns:
            Dictionary with keys:
            - passed: Whether tests passed (True if no tests found)
            - skipped: Whether tests were skipped (no test framework)
            - framework: Detected test framework
            - output: Test output
            - errors: Any error output
            - summary: Human-readable summary
        """
        import subprocess

        self._log_info("Detecting and running tests", phase_id="validation")

        project_path = (
            Path(self._worktree_path)
            if self._worktree_path
            else Path(self._spec_dir).parent.parent.parent
        )

        test_cmd: list[str] | None = None
        framework: str | None = None

        # Detect test framework
        if (project_path / "pytest.ini").exists() or (
            project_path / "pyproject.toml"
        ).exists():
            # Check for pytest in pyproject.toml
            pyproject_path = project_path / "pyproject.toml"
            if pyproject_path.exists():
                content = pyproject_path.read_text()
                if "pytest" in content or "[tool.pytest" in content:
                    test_cmd = ["pytest", "-v", "--tb=short"]
                    framework = "pytest"
            if not test_cmd and (project_path / "pytest.ini").exists():
                test_cmd = ["pytest", "-v", "--tb=short"]
                framework = "pytest"

        # Check for vitest BEFORE npm test (vitest projects also have package.json)
        if not test_cmd:
            vitest_configs = [
                "vitest.config.ts",
                "vitest.config.js",
                "vitest.config.mts",
                "vitest.config.mjs",
            ]
            for vitest_config in vitest_configs:
                if (project_path / vitest_config).exists():
                    test_cmd = ["npx", "vitest", "run"]
                    framework = "vitest"
                    break

        # Fall back to npm test for other JS/TS projects
        if not test_cmd and (project_path / "package.json").exists():
            import json

            try:
                pkg = json.loads((project_path / "package.json").read_text())
                scripts = pkg.get("scripts", {})
                if "test" in scripts:
                    test_cmd = ["npm", "test"]
                    framework = "npm test"
            except json.JSONDecodeError:
                pass

        if not test_cmd:
            self._log_info(
                "No test framework detected, skipping tests", phase_id="validation"
            )
            return {
                "passed": True,
                "skipped": True,
                "framework": None,
                "output": "",
                "errors": "",
                "summary": "No test framework detected - tests skipped",
            }

        self._log_info(f"Running tests with {framework}", phase_id="validation")

        try:
            result = subprocess.run(
                test_cmd,
                cwd=project_path,
                capture_output=True,
                text=True,
                timeout=300,  # 5 minute timeout for tests
            )

            passed = result.returncode == 0
            output = result.stdout
            errors = result.stderr

            if passed:
                summary = f"Tests passed ({framework})"
            else:
                summary = f"Tests failed ({framework})"

            return {
                "passed": passed,
                "skipped": False,
                "framework": framework,
                "output": output,
                "errors": errors,
                "summary": summary,
            }

        except subprocess.TimeoutExpired:
            return {
                "passed": False,
                "skipped": False,
                "framework": framework,
                "output": "",
                "errors": "Test execution timed out (5 min limit)",
                "summary": "Tests timed out",
            }
        except Exception as e:
            return {
                "passed": False,
                "skipped": False,
                "framework": framework,
                "output": "",
                "errors": str(e),
                "summary": f"Test execution failed: {e}",
            }

    def _generate_qa_report(
        self,
        qa_result: dict[str, Any],
        test_result: dict[str, Any],
        iteration: int,
    ) -> str:
        """Generate qa_report.md artifact.

        Story Reference: Story 4.4 Task 4 - Generate QA report

        Args:
            qa_result: Result from QA reviewer
            test_result: Result from test execution
            iteration: Current iteration number

        Returns:
            Path to the generated qa_report.md file
        """
        self._log_info("Generating QA report", phase_id="validation")

        report_path = self._spec_dir / "qa_report.md"

        qa_status = "PASSED" if qa_result.get("passed") else "FAILED"
        test_status = (
            "PASSED"
            if test_result.get("passed")
            else ("SKIPPED" if test_result.get("skipped") else "FAILED")
        )

        # Format issues - handle both 'fix_required' and 'description' keys
        issues_text = ""
        issues = qa_result.get("issues", [])
        if issues:
            formatted_issues = []
            for issue in issues:
                issue_type = issue.get("type", "unknown")
                title = issue.get("title", "No title")
                location = issue.get("location", "unknown")
                # Try fix_required first, then description, then N/A
                fix_info = (
                    issue.get("fix_required") or issue.get("description") or "N/A"
                )
                formatted_issues.append(
                    f"- **{issue_type}**: {title}\n  - Location: {location}\n  - Fix: {fix_info}"
                )
            issues_text = "\n".join(formatted_issues)
        else:
            issues_text = "No issues found"

        # Format test output
        test_output = test_result.get("output", "No tests run")
        if len(test_output) > 2000:
            test_output = test_output[:2000] + "\n... (truncated)"

        report = f"""# QA Report

## Summary
- **Iteration:** {iteration}
- **QA Status:** {qa_status}
- **Test Status:** {test_status}
- **Test Framework:** {test_result.get("framework", "N/A")}

## Validation Results
{qa_result.get("summary", "No summary available")}

## Issues Found
{issues_text}

## Test Results
```
{test_output if not test_result.get("skipped") else "No tests configured"}
```

## Recommendations
{self._get_recommendations(qa_result, test_result)}

---
Generated by FullAutoExecutor (Story 4.4)
"""
        report_path.write_text(report)

        self._log_info(f"QA report generated: {report_path}", phase_id="validation")
        return str(report_path)

    def _get_recommendations(
        self,
        qa_result: dict[str, Any],
        test_result: dict[str, Any],
    ) -> str:
        """Generate recommendations based on QA and test results.

        Args:
            qa_result: Result from QA reviewer
            test_result: Result from test execution

        Returns:
            Human-readable recommendations string
        """
        recommendations = []

        if not qa_result.get("passed"):
            issues = qa_result.get("issues", [])
            if issues:
                recommendations.append(
                    f"- Address {len(issues)} QA issue(s) before release"
                )
                # Prioritize by type
                critical = [i for i in issues if i.get("type") == "critical"]
                if critical:
                    recommendations.append(
                        f"  - {len(critical)} critical issue(s) require immediate attention"
                    )

        if not test_result.get("passed") and not test_result.get("skipped"):
            recommendations.append("- Fix failing tests before proceeding")
            if test_result.get("errors"):
                recommendations.append("- Review test error output for details")

        if test_result.get("skipped"):
            recommendations.append(
                "- Consider adding automated tests for the implementation"
            )

        if qa_result.get("passed") and test_result.get("passed"):
            recommendations.append("- All validations passed - ready for human review")
            recommendations.append(
                "- Consider running code-review workflow with a different LLM"
            )

        return (
            "\n".join(recommendations)
            if recommendations
            else "No specific recommendations"
        )

    async def _run_qa_fixer(
        self,
        issues: list[dict[str, Any]],
        iteration: int,
    ) -> dict[str, Any]:
        """Run the QA fixer agent to resolve issues.

        Story Reference: Story 4.4 Task 5 - Implement fix loop

        Args:
            issues: List of issues to fix
            iteration: Current iteration number

        Returns:
            Dictionary with keys:
            - fixed: Whether fixes were applied
            - error: Error message if failed
        """
        self._log_info(
            f"Running QA fixer for {len(issues)} issues (iteration {iteration})",
            phase_id="validation",
        )

        try:
            from apps.backend.core.client import create_client
            from apps.backend.qa.fixer import run_qa_fixer_session

            # Get common QA configuration
            project_dir, qa_model, fixer_thinking_budget = self._get_qa_config()

            client = create_client(
                project_dir,
                self._spec_dir,
                qa_model,
                agent_type="qa_fixer",
                max_thinking_tokens=fixer_thinking_budget,
            )

            async with client:
                status, response = await run_qa_fixer_session(
                    client,
                    self._spec_dir,
                    iteration,
                    verbose=False,
                    project_dir=project_dir,
                )

            if status == "fixed":
                self._log_info(
                    "QA fixer applied fixes successfully", phase_id="validation"
                )
                return {"fixed": True}
            else:
                self._log_warning(
                    f"QA fixer returned status: {status}", phase_id="validation"
                )
                return {"fixed": False, "error": response}

        except Exception as e:
            self._log_error(f"QA fixer failed: {e}", phase_id="validation")
            return {"fixed": False, "error": str(e)}

    def _calculate_validation_percentage(
        self, iteration: int, max_iterations: int
    ) -> float:
        """Calculate progress percentage for validation phase.

        Story Reference: Story 4.4 - Progress reporting

        The validation phase spans 75-100% of overall progress (25% range).

        Args:
            iteration: Current iteration number
            max_iterations: Maximum number of iterations

        Returns:
            Percentage as float (75.0 to 100.0)
        """
        if max_iterations == 0:
            return 75.0  # Start of validation phase

        # Validation phase is 75-100% (25% range)
        base_percentage = 75.0
        range_percentage = 25.0
        return base_percentage + (iteration / max_iterations) * range_percentage

    def _notify_validation_success(self, iterations: int) -> None:
        """Notify user of successful validation.

        Story Reference: Story 4.4 Task 7 - Notify user of success

        Args:
            iterations: Number of iterations it took to pass validation
        """
        self._log_info(
            f"Validation completed successfully in {iterations} iteration(s)",
            phase_id="validation",
        )

        # Log completion time
        elapsed = self._get_elapsed_time()
        self._log_info(
            f"Total task execution time: {elapsed:.2f}s",
            phase_id="validation",
        )
