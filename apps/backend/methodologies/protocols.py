"""Protocol interfaces and supporting dataclasses for the methodology plugin framework.

This module defines the core contracts that methodology plugins must implement.
All Protocol interfaces use structural subtyping (duck typing) via typing.Protocol.

Architecture Source: architecture.md#Core-Architectural-Decisions
"""

from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Literal, Protocol, runtime_checkable

# Type alias for progress callback functions
# Story Reference: Story 2.4 Task 5 - Add progress callbacks to existing agents
ProgressCallback = Callable[[str, float], None]
"""Type alias for progress callback functions.

Progress callbacks are invoked during phase execution to report
incremental progress.

Args:
    message: Human-readable progress message
    percentage: Progress within the phase (0.0 to 100.0)

Example:
    def my_callback(message: str, percentage: float) -> None:
        print(f"{percentage:.0f}%: {message}")

    runner.execute_phase("spec", progress_callback=my_callback)
"""

# =============================================================================
# Service Protocol Stubs (for type hints in RunContext)
# =============================================================================
# These are placeholder protocols for services injected into RunContext.
# Full implementations will be defined in respective service modules.


@runtime_checkable
class WorkspaceService(Protocol):
    """Protocol for workspace/file operations service."""

    def get_project_root(self) -> str:
        """Get the project root directory path."""
        ...


@runtime_checkable
class MemoryService(Protocol):
    """Protocol for Graphiti knowledge graph memory service."""

    def get_context(self, query: str) -> str:
        """Get relevant context for a query."""
        ...


@runtime_checkable
class ProgressService(Protocol):
    """Protocol for UI progress reporting service.

    Story Reference: Story 2.4 - Implement Progress Reporting for Native Runner

    Provides two methods for reporting progress:
    - update(): Simple progress update with percentage and message
    - emit(): Full ProgressEvent with task_id, artifacts, etc.
    """

    def update(self, phase_id: str, progress: float, message: str) -> None:
        """Update progress for a phase (simple interface).

        Args:
            phase_id: ID of the phase being executed
            progress: Progress percentage (0.0 to 1.0)
            message: Human-readable progress message
        """
        ...

    def emit(self, event: "ProgressEvent") -> None:
        """Emit a detailed progress event.

        Args:
            event: ProgressEvent with full progress details
        """
        ...


@runtime_checkable
class CheckpointService(Protocol):
    """Protocol for Semi-Auto pause points service.

    The CheckpointService manages pause points in Semi-Auto execution mode.
    It handles checkpoint detection, state persistence, pause/resume, and
    event notification to the frontend.

    Story Reference: Story 5.1 - Implement Checkpoint Service
    Architecture Source: architecture.md#Checkpoint-Service

    Required Methods:
        create_checkpoint: Create a checkpoint for user review
        check_and_pause: Check if phase has checkpoint and pause if so
        resume: Resume execution from a checkpoint
        is_paused: Check if currently paused at a checkpoint
        load_state: Load persisted checkpoint state
        clear_state: Remove checkpoint state file
    """

    def create_checkpoint(self, checkpoint_id: str, data: dict[str, Any]) -> Any:
        """Create a checkpoint for user review.

        Args:
            checkpoint_id: Unique identifier for the checkpoint
            data: Data to be reviewed at the checkpoint

        Returns:
            The created checkpoint state
        """
        ...

    async def check_and_pause(
        self,
        phase_id: str,
        artifacts: list[str] | None = None,
        context: dict[str, Any] | None = None,
    ) -> Any | None:
        """Check if a checkpoint exists for the phase and pause if so.

        Args:
            phase_id: ID of the phase that just completed
            artifacts: List of artifact paths produced so far
            context: Additional execution context to persist

        Returns:
            CheckpointResult if a checkpoint was reached and resumed,
            None if no checkpoint for this phase
        """
        ...

    def resume(self, decision: str, feedback: str | None = None) -> None:
        """Resume execution from a checkpoint.

        Args:
            decision: User's decision (approve, reject, revise)
            feedback: Optional feedback or comments from user
        """
        ...

    def is_paused(self) -> bool:
        """Check if execution is currently paused at a checkpoint.

        Returns:
            True if paused at a checkpoint, False otherwise
        """
        ...

    def load_state(self) -> Any | None:
        """Load checkpoint state from persistent storage.

        Returns:
            CheckpointState if file exists, None otherwise
        """
        ...

    def clear_state(self) -> None:
        """Remove checkpoint state file.

        Called after successful task completion to clean up.
        """
        ...


@runtime_checkable
class LLMService(Protocol):
    """Protocol for LLM provider service."""

    def generate(self, prompt: str) -> str:
        """Generate a response from the LLM."""
        ...


# =============================================================================
# Enums for Status and Configuration
# =============================================================================


class ExecutionMode(Enum):
    """Execution modes for methodology tasks."""

    FULL_AUTO = "full_auto"
    SEMI_AUTO = "semi_auto"


class ComplexityLevel(Enum):
    """Complexity levels for task configuration."""

    QUICK = "quick"
    STANDARD = "standard"
    COMPLEX = "complex"


class PhaseStatus(Enum):
    """Status of a phase during execution."""

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"
    SKIPPED = "skipped"


class CheckpointStatus(Enum):
    """Status of a checkpoint during Semi-Auto execution."""

    PENDING = "pending"
    WAITING = "waiting"
    APPROVED = "approved"
    REJECTED = "rejected"


class ProgressStatus(Enum):
    """Status values for progress events during phase execution.

    Story Reference: Story 2.4 - Implement Progress Reporting for Native Runner

    Attributes:
        STARTED: Phase has started execution
        IN_PROGRESS: Phase is actively executing
        COMPLETED: Phase completed successfully
        FAILED: Phase failed during execution
    """

    STARTED = "started"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


class TaskStatus(Enum):
    """Task status values for frontend kanban board.

    This is the STATUS CONTRACT that ALL methodologies must use to communicate
    task state to the frontend. Methodologies write these values to
    implementation_plan.json for the frontend to read.

    The frontend uses these values to place tasks in the correct column:
    - backlog: Task is waiting to start
    - in_progress: Task is actively being worked on
    - ai_review: All work complete, waiting for AI/QA validation
    - human_review: AI approved, waiting for human review
    - done: Task is complete and approved
    """

    BACKLOG = "backlog"
    IN_PROGRESS = "in_progress"
    AI_REVIEW = "ai_review"
    HUMAN_REVIEW = "human_review"
    DONE = "done"


class PlanStatus(Enum):
    """Plan status values for tracking methodology progress.

    Complements TaskStatus with more granular progress information.
    """

    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    REVIEW = "review"
    COMPLETED = "completed"


# =============================================================================
# Supporting Dataclasses
# =============================================================================


@dataclass
class TaskConfig:
    """Configuration for a methodology task.

    Contains settings that affect how the methodology executes,
    including complexity level and execution mode.
    """

    complexity: ComplexityLevel = ComplexityLevel.STANDARD
    execution_mode: ExecutionMode = ExecutionMode.FULL_AUTO
    task_id: str = ""
    task_name: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class ProgressEvent:
    """Event representing progress during methodology phase execution.

    ProgressEvents are emitted during phase execution to report progress
    to the frontend via IPC. They include phase identification, status,
    percentage completion, and any artifacts produced.

    Story Reference: Story 2.4 - Implement Progress Reporting for Native Runner
    Architecture Source: architecture.md#Progress-Reporting

    Attributes:
        task_id: Unique identifier for the task
        phase_id: ID of the phase being executed
        status: Current progress status (started, in_progress, completed, failed)
        message: Human-readable progress message
        percentage: Completion percentage (0.0 to 100.0)
        artifacts: List of artifact file paths produced so far
        timestamp: When this event was generated

    Example:
        event = ProgressEvent(
            task_id="task-123",
            phase_id="spec",
            status="in_progress",
            message="Generating specification document...",
            percentage=45.0,
            artifacts=[],
            timestamp=datetime.now(),
        )
    """

    task_id: str
    phase_id: str
    status: Literal["started", "in_progress", "completed", "failed"]
    message: str
    percentage: float  # 0.0 to 100.0
    artifacts: list[str]
    timestamp: datetime

    def to_ipc_dict(self) -> dict[str, Any]:
        """Convert the ProgressEvent to IPC-compatible dictionary format.

        Converts field names from snake_case to camelCase per IPC conventions.
        Serializes datetime to ISO format string.

        Returns:
            Dictionary with camelCase keys suitable for IPC transmission

        Story Reference: Story 2.4 Task 4 - IPC Event Emission
        """
        return {
            "taskId": self.task_id,
            "phaseId": self.phase_id,
            "status": self.status,
            "message": self.message,
            "percentage": self.percentage,
            "artifacts": self.artifacts,
            "timestamp": self.timestamp.isoformat(),
        }


@dataclass
class RunContext:
    """Context injected into methodology runners.

    Provides access to all framework services needed for execution.
    This is the primary way methodologies interact with the framework.

    Architecture Source: architecture.md#Plugin-Context-Injection

    Attributes:
        workspace: Service for git worktree and file operations
        memory: Service for Graphiti knowledge graph access
        progress: Service for UI progress reporting
        checkpoint: Service for Semi-Auto pause points
        llm: Service for LLM provider access
        task_config: Configuration for the current task
    """

    workspace: WorkspaceService
    memory: MemoryService
    progress: ProgressService
    checkpoint: CheckpointService
    llm: LLMService
    task_config: TaskConfig


@dataclass
class Phase:
    """Definition of a methodology phase.

    Phases represent distinct stages in the methodology pipeline.
    The frontend uses this information for progress visualization.

    Attributes:
        id: Unique identifier for the phase
        name: Human-readable name for display
        description: Optional detailed description
        order: Execution order (lower = earlier)
        status: Current execution status
        is_optional: Whether this phase can be skipped
    """

    id: str
    name: str
    description: str = ""
    order: int = 0
    status: PhaseStatus = PhaseStatus.PENDING
    is_optional: bool = False


@dataclass
class PhaseResult:
    """Result of executing a methodology phase.

    Returned by execute_phase() to indicate success/failure
    and provide details about the execution.

    Attributes:
        success: Whether the phase completed successfully
        phase_id: ID of the phase that was executed
        message: Human-readable result message
        artifacts: List of artifact IDs produced by this phase
        error: Error message if success is False
        metadata: Additional data from phase execution
    """

    success: bool
    phase_id: str
    message: str = ""
    artifacts: list[str] = field(default_factory=list)
    error: str = ""
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class Checkpoint:
    """Definition of a Semi-Auto checkpoint (pause point).

    Checkpoints define where the methodology pauses for user review
    in Semi-Auto execution mode.

    Attributes:
        id: Unique identifier for the checkpoint
        name: Human-readable name for display
        description: What the user should review
        phase_id: ID of the phase this checkpoint belongs to
        status: Current checkpoint status
        requires_approval: Whether user must approve to continue
    """

    id: str
    name: str
    description: str = ""
    phase_id: str = ""
    status: CheckpointStatus = CheckpointStatus.PENDING
    requires_approval: bool = True


@dataclass
class Artifact:
    """Definition of a methodology artifact (output).

    Artifacts are outputs produced by the methodology that can be
    displayed in the frontend or used by subsequent phases.

    Attributes:
        id: Unique identifier for the artifact
        artifact_type: Type of artifact (spec, plan, code, report, etc.)
        name: Human-readable name
        file_path: Path to the artifact file (relative to spec dir)
        phase_id: ID of the phase that produced this artifact
        content_type: MIME type of the content
        metadata: Additional artifact metadata
    """

    id: str
    artifact_type: str
    name: str = ""
    file_path: str = ""
    phase_id: str = ""
    content_type: str = "text/plain"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass
class MethodologyInfo:
    """Information about an installed methodology plugin.

    Used by MethodologyRegistry to provide metadata about
    available methodologies without loading the full plugin.

    Attributes:
        name: Unique identifier for the methodology (kebab-case)
        version: Semver version string
        description: Human-readable description
        author: Author name or organization
        complexity_levels: Supported complexity levels
        execution_modes: Supported execution modes
        is_verified: Whether this is a verified (bundled) plugin
        install_path: Path to the methodology directory
    """

    name: str
    version: str
    description: str = ""
    author: str = ""
    complexity_levels: list[str] = field(default_factory=list)
    execution_modes: list[str] = field(default_factory=list)
    is_verified: bool = False
    install_path: str = ""


# =============================================================================
# Task Status Contract (Required for Frontend Integration)
# =============================================================================


@dataclass
class TaskStatusContract:
    """Status contract that ALL methodologies must write to implementation_plan.json.

    This is the UNIFIED STATUS INTERFACE for the frontend. Every methodology
    (native, BMAD, and future plugins) MUST write these fields to
    implementation_plan.json for proper frontend kanban integration.

    The frontend reads ONLY these fields for status transitions - it does NOT
    care about methodology-specific fields like subtasks, phases, artifacts, etc.

    Attributes:
        status: Task status for kanban column (backlog, in_progress, ai_review, human_review, done)
        plan_status: Granular progress status (pending, in_progress, review, completed)
        methodology: Name of the methodology running this task
        updated_at: ISO timestamp of last update
        feature: Task name/description (used as fallback title)
        qa_signoff: Optional QA approval info (required for human_review transition)

    Usage:
        All methodologies should call write_task_status() at key transitions:
        - When starting: status=in_progress
        - When work complete, awaiting validation: status=ai_review
        - When AI/QA approved: status=human_review, qa_signoff={status: approved}
        - When human approved: status=done

    Example:
        from methodologies.status_writer import write_task_status

        # In your methodology when work completes:
        write_task_status(
            spec_dir=self.spec_dir,
            status=TaskStatus.HUMAN_REVIEW,
            plan_status=PlanStatus.REVIEW,
            methodology="bmad",
            feature="My Feature",
            qa_signoff={"status": "approved", "methodology": "bmad"}
        )
    """

    status: TaskStatus
    plan_status: PlanStatus
    methodology: str
    updated_at: str  # ISO format timestamp
    feature: str = ""  # Task name/description
    qa_signoff: dict[str, Any] | None = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        result = {
            "status": self.status.value,
            "planStatus": self.plan_status.value,
            "methodology": self.methodology,
            "updated_at": self.updated_at,
        }
        if self.feature:
            result["feature"] = self.feature
        if self.qa_signoff:
            result["qa_signoff"] = self.qa_signoff
        return result


# =============================================================================
# Core Protocol Interface
# =============================================================================


@runtime_checkable
class MethodologyRunner(Protocol):
    """Protocol for methodology plugin runners.

    This is the core interface that all methodology plugins must implement.
    The framework uses structural subtyping, so any class that implements
    these methods is considered a valid MethodologyRunner.

    Architecture Source: architecture.md#Core-Architectural-Decisions

    Example:
        class MyMethodologyRunner:
            def initialize(self, context: RunContext) -> None:
                self.context = context

            def get_phases(self) -> list[Phase]:
                return [Phase(id="discovery", name="Discovery")]

            def execute_phase(self, phase_id: str) -> PhaseResult:
                # Execute the phase logic
                return PhaseResult(success=True, phase_id=phase_id)

            def get_checkpoints(self) -> list[Checkpoint]:
                return [Checkpoint(id="review", name="Review")]

            def get_artifacts(self) -> list[Artifact]:
                return [Artifact(id="spec", artifact_type="spec")]
    """

    def initialize(self, context: RunContext) -> None:
        """Initialize the runner with framework context.

        Called once before any phase execution. Use this to store
        the context and perform any setup required.

        Args:
            context: RunContext with access to all framework services
        """
        ...

    def get_phases(self) -> list[Phase]:
        """Return all phase definitions for this methodology.

        Called by the framework to understand the methodology structure
        and display progress in the UI.

        Returns:
            List of Phase objects defining the methodology pipeline
        """
        ...

    def execute_phase(self, phase_id: str) -> PhaseResult:
        """Execute a specific phase of the methodology.

        The framework calls this method for each phase in order.
        The implementation should execute the phase logic and return
        a result indicating success or failure.

        Args:
            phase_id: ID of the phase to execute

        Returns:
            PhaseResult indicating success/failure and any artifacts
        """
        ...

    def get_checkpoints(self) -> list[Checkpoint]:
        """Return checkpoint definitions for Semi-Auto mode.

        Called by the framework to understand where to pause
        for user review in Semi-Auto execution mode.

        Returns:
            List of Checkpoint objects defining pause points
        """
        ...

    def get_artifacts(self) -> list[Artifact]:
        """Return artifact definitions produced by this methodology.

        Called by the framework to understand what outputs
        the methodology produces for display in the frontend.

        Returns:
            List of Artifact objects defining methodology outputs
        """
        ...


# =============================================================================
# Additional Protocol Interfaces
# =============================================================================


@runtime_checkable
class MethodologyRegistry(Protocol):
    """Protocol for the methodology registry service.

    The registry manages installed methodology plugins,
    handles discovery, installation, and lookup.

    Architecture Source: architecture.md#Core-Architectural-Decisions
    """

    def list_installed(self) -> list[MethodologyInfo]:
        """List all installed methodology plugins.

        Returns:
            List of MethodologyInfo objects for installed methodologies
        """
        ...

    def get_methodology(self, name: str) -> MethodologyRunner:
        """Get a methodology runner by name.

        Args:
            name: Name of the methodology to retrieve

        Returns:
            MethodologyRunner instance for the methodology

        Raises:
            PluginLoadError: If methodology is not installed or fails to load
        """
        ...

    def install(self, path: str) -> None:
        """Install a methodology plugin from a path.

        Args:
            path: Path to the methodology plugin directory

        Raises:
            ManifestValidationError: If manifest.yaml is invalid
            PluginLoadError: If plugin cannot be loaded
        """
        ...

    def uninstall(self, name: str) -> None:
        """Uninstall a methodology plugin.

        Args:
            name: Name of the methodology to uninstall

        Raises:
            PluginError: If methodology cannot be uninstalled
        """
        ...


@runtime_checkable
class TaskStateManager(Protocol):
    """Protocol for task state persistence service.

    Manages saving and loading task state for pause/resume
    functionality in Semi-Auto mode.

    Architecture Source: architecture.md#Core-Architectural-Decisions
    """

    async def save_state(self, task_id: str, state: dict[str, Any]) -> None:
        """Save task state to persistent storage.

        Args:
            task_id: Unique identifier for the task
            state: State dictionary to persist
        """
        ...

    async def load_state(self, task_id: str) -> dict[str, Any] | None:
        """Load task state from persistent storage.

        Args:
            task_id: Unique identifier for the task

        Returns:
            State dictionary if found, None otherwise
        """
        ...

    async def list_tasks(self) -> list[str]:
        """List all task IDs with saved state.

        Returns:
            List of task IDs
        """
        ...

    async def get_paused_tasks(self) -> list[dict[str, Any]]:
        """Get all paused tasks awaiting user input.

        Returns:
            List of task state dictionaries for paused tasks
        """
        ...


@runtime_checkable
class NotificationService(Protocol):
    """Protocol for notification service.

    Handles sending notifications to the frontend for
    checkpoints, progress updates, and completions.

    Architecture Source: architecture.md#Core-Architectural-Decisions
    """

    async def notify_checkpoint(
        self, checkpoint_id: str, checkpoint_data: dict[str, Any]
    ) -> None:
        """Notify that a checkpoint has been reached.

        Used in Semi-Auto mode to alert the user that
        review is required.

        Args:
            checkpoint_id: ID of the reached checkpoint
            checkpoint_data: Data to display for review
        """
        ...

    async def notify_progress(
        self, phase_id: str, progress: float, message: str
    ) -> None:
        """Notify progress update for a phase.

        Args:
            phase_id: ID of the phase
            progress: Progress percentage (0.0 to 1.0)
            message: Human-readable progress message
        """
        ...

    async def notify_completion(
        self, task_id: str, success: bool, summary: dict[str, Any]
    ) -> None:
        """Notify that a task has completed.

        Args:
            task_id: ID of the completed task
            success: Whether the task succeeded
            summary: Summary data about the completion
        """
        ...
