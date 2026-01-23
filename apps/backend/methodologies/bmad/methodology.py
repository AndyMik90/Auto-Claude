"""BMAD (Business Model Agile Development) methodology runner.

This module implements the MethodologyRunner Protocol for the BMAD methodology.
BMAD is a structured approach to software development that emphasizes
PRD creation, architecture design, epic/story planning, and iterative development.

Architecture Source: architecture.md#BMAD-Plugin-Structure
Story Reference: Story 6.1 - Create BMAD Methodology Plugin Structure
"""

import asyncio
import logging
import os
import shutil
import subprocess
import sys
from collections.abc import Coroutine
from pathlib import Path
from typing import TYPE_CHECKING, Any, TypeVar

from apps.backend.core.debug import (
    debug,
    debug_error,
    debug_section,
    debug_success,
    debug_warning,
)
from apps.backend.core.phase_event import ExecutionPhase, emit_phase
from apps.backend.methodologies.protocols import (
    Artifact,
    Checkpoint,
    CheckpointStatus,
    ComplexityLevel,
    Phase,
    PhaseResult,
    PhaseStatus,
    PlanStatus,
    ProgressCallback,
    RunContext,
    TaskConfig,
    TaskStatus,
)
from apps.backend.methodologies.status_writer import write_task_status
from apps.backend.ui.status import BuildState, StatusManager

# Type hints for optional dependencies
if TYPE_CHECKING:
    pass

# Import conversation loop for two-agent pattern
from apps.backend.agents.bmad_conversation import run_bmad_conversation_loop

# Import phase executor for agent invocation pattern
from apps.backend.methodologies.bmad.phase_executor import (
    BMADTrack,
    create_phase_prompt,
    get_phase_config,
    get_phases_for_track,
    get_root_project_dir,
    has_project_documentation,
    is_worktree,
    log_bmad_phase,
    sync_project_docs_to_worktree,
)

logger = logging.getLogger(__name__)

# Type variable for async return types
T = TypeVar("T")


class BMADRunner:
    """MethodologyRunner implementation for BMAD methodology.

    This class implements the MethodologyRunner Protocol, providing the interface
    for the plugin framework to execute the BMAD methodology.

    BMAD Tracks (based on BMAD Method documentation):

    1. Quick Flow (QUICK complexity):
       - Best for: Bug fixes, simple features, clear scope (1-15 stories)
       - Documents: Tech-spec only (no PRD, no Architecture)
       - Agent: Barry (quick-flow-solo-dev)
       - Phases: tech_spec → quick_dev → code_review

    2. BMad Method (STANDARD complexity):
       - Best for: Products, platforms, complex features (10-50+ stories)
       - Documents: PRD + Architecture + UX (optional)
       - Agents: Analyst → PM → Architect → SM → Dev
       - Phases: [analyze] → prd → architecture → epics → stories → dev → review
       - Note: analyze phase only runs if project is undocumented

    3. Enterprise (COMPLEX complexity):
       - Best for: Compliance, multi-tenant systems (30+ stories)
       - Documents: PRD + Architecture + Security + DevOps
       - Phases: [analyze] → prd → architecture → security → devops → epics → stories → dev → review

    Artifact Storage (Story 6.9):
        All artifacts are stored in task-scoped directories:
        `.auto-claude/specs/{task-id}/bmad/`

    Story Reference: Story 6.1 - Create BMAD Methodology Plugin Structure
    Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
    Story Reference: Story 6.9 - Task-Scoped Output Directories
    """

    # BMAD output subdirectory name within spec_dir
    # Uses native BMAD folder name for workflow compatibility
    BMAD_OUTPUT_SUBDIR = "_bmad-output"

    # Default model for BMAD agent sessions
    _DEFAULT_AGENT_MODEL = "claude-sonnet-4-20250514"

    # Default thinking level budget (None = no extended thinking)
    _DEFAULT_THINKING_BUDGET: int | None = None

    # Model ID mapping (shorthand to full model ID)
    MODEL_ID_MAP: dict[str, str] = {
        "opus": "claude-opus-4-5-20251101",
        "sonnet": "claude-sonnet-4-5-20250929",
        "haiku": "claude-haiku-4-5-20251001",
    }

    # Thinking level to budget mapping
    THINKING_BUDGET_MAP: dict[str, int | None] = {
        "none": None,
        "low": 1024,
        "medium": 4096,
        "high": 16384,
        "ultrathink": 63999,
    }

    # Complexity to BMAD Track mapping
    # Uses get_phases_for_track() for dynamic phase list based on project state
    COMPLEXITY_TO_TRACK: dict[ComplexityLevel, BMADTrack] = {
        ComplexityLevel.QUICK: BMADTrack.QUICK_FLOW,
        ComplexityLevel.STANDARD: BMADTrack.BMAD_METHOD,
        ComplexityLevel.COMPLEX: BMADTrack.ENTERPRISE,
    }

    # Checkpoints per track (track-based, not complexity-based)
    TRACK_CHECKPOINTS: dict[BMADTrack, list[str]] = {
        BMADTrack.QUICK_FLOW: [
            "after_tech_spec",
            "after_review",
        ],
        BMADTrack.BMAD_METHOD: [
            "after_prd",
            "after_architecture",
            "after_epics",
            "after_story",
            "after_review",
        ],
        BMADTrack.ENTERPRISE: [
            "after_prd",
            "after_architecture",
            "after_security",
            "after_devops",
            "after_epics",
            "after_story",
            "after_review",
        ],
    }

    # Legacy compatibility: COMPLEXITY_PHASES (deprecated, use TRACK_PHASES)
    # Kept for backwards compatibility, but phases are now dynamic
    COMPLEXITY_PHASES: dict[ComplexityLevel, list[str]] = {
        ComplexityLevel.QUICK: ["tech_spec", "quick_dev", "review"],
        ComplexityLevel.STANDARD: [
            "prd",
            "architecture",
            "epics",
            "stories",
            "dev",
            "review",
        ],
        ComplexityLevel.COMPLEX: [
            "prd",
            "architecture",
            "security",
            "devops",
            "epics",
            "stories",
            "dev",
            "review",
        ],
    }

    # Legacy compatibility: COMPLEXITY_CHECKPOINTS
    COMPLEXITY_CHECKPOINTS: dict[ComplexityLevel, list[str]] = {
        ComplexityLevel.QUICK: ["after_tech_spec", "after_review"],
        ComplexityLevel.STANDARD: [
            "after_prd",
            "after_architecture",
            "after_epics",
            "after_story",
            "after_review",
        ],
        ComplexityLevel.COMPLEX: [
            "after_prd",
            "after_architecture",
            "after_epics",
            "after_story",
            "after_review",
        ],
    }

    # BMAD phase to ExecutionPhase mapping (for frontend synchronization)
    # Maps BMAD phases to the execution phases the frontend understands
    PHASE_TO_EXECUTION_PHASE: dict[str, ExecutionPhase] = {
        # Planning phases (PRD, Architecture, etc.)
        "analyze": ExecutionPhase.PLANNING,
        "prd": ExecutionPhase.PLANNING,
        "architecture": ExecutionPhase.PLANNING,
        "security": ExecutionPhase.PLANNING,
        "devops": ExecutionPhase.PLANNING,
        "epics": ExecutionPhase.PLANNING,
        "stories": ExecutionPhase.PLANNING,
        "tech_spec": ExecutionPhase.PLANNING,
        # Coding phases
        "dev": ExecutionPhase.CODING,
        "quick_dev": ExecutionPhase.CODING,
        # Review phases
        "review": ExecutionPhase.QA_REVIEW,
    }

    # BMAD phase to BuildState mapping (for status file)
    PHASE_TO_BUILD_STATE: dict[str, BuildState] = {
        # Planning phases
        "analyze": BuildState.PLANNING,
        "prd": BuildState.PLANNING,
        "architecture": BuildState.PLANNING,
        "security": BuildState.PLANNING,
        "devops": BuildState.PLANNING,
        "epics": BuildState.PLANNING,
        "stories": BuildState.PLANNING,
        "tech_spec": BuildState.PLANNING,
        # Coding phases
        "dev": BuildState.BUILDING,
        "quick_dev": BuildState.BUILDING,
        # Review phases
        "review": BuildState.QA,
    }

    def __init__(self) -> None:
        """Initialize BMADRunner instance."""
        self._context: RunContext | None = None
        self._phases: list[Phase] = []
        self._checkpoints: list[Checkpoint] = []
        self._artifacts: list[Artifact] = []
        self._initialized: bool = False
        # Context attributes for phase execution
        self._project_dir: str = ""
        self._root_project_dir: Path | None = (
            None  # Root project (for worktree support)
        )
        self._spec_dir: Path | None = None
        self._task_config: TaskConfig | None = None
        self._complexity: ComplexityLevel | None = None
        # BMAD track (determined from complexity)
        self._track: BMADTrack | None = None
        # Progress callback for current execution
        self._current_progress_callback: ProgressCallback | None = None
        # Task-scoped output directory (Story 6.9)
        self._output_dir: Path | None = None
        # Whether we're running in a worktree
        self._is_worktree: bool = False
        # Status manager for frontend synchronization
        self._status_manager: StatusManager | None = None
        # Current phase index for progress tracking
        self._current_phase_index: int = 0
        self._total_phases: int = 0

    def _reset_state(self) -> None:
        """Reset runner state for re-initialization.

        Called when initialize() is invoked on an already-initialized runner
        to support runner reuse across multiple tasks.
        """
        # Mark build as inactive before reset
        if self._status_manager:
            self._status_manager.set_inactive()

        self._context = None
        self._phases = []
        self._checkpoints = []
        self._artifacts = []
        self._initialized = False
        self._project_dir = ""
        self._root_project_dir = None
        self._spec_dir = None
        self._task_config = None
        self._complexity = None
        self._track = None
        self._current_progress_callback = None
        self._output_dir = None
        self._is_worktree = False
        self._status_manager = None
        self._current_phase_index = 0
        self._total_phases = 0

    def _get_track_for_complexity(self, complexity: ComplexityLevel) -> BMADTrack:
        """Get the BMAD track for a complexity level.

        Args:
            complexity: The complexity level

        Returns:
            Corresponding BMAD track
        """
        return self.COMPLEXITY_TO_TRACK.get(complexity, BMADTrack.BMAD_METHOD)

    def _get_phases_for_track(self) -> list[str]:
        """Get the list of phases to execute for the current track.

        Dynamically determines phases based on:
        - The BMAD track (Quick Flow, BMad Method, Enterprise)
        - Whether the project has existing documentation (checked at ROOT project)

        For worktrees, project-level docs are synced from root automatically.

        Returns:
            List of phase IDs to execute
        """
        if self._track is None:
            return []

        project_dir = Path(self._project_dir) if self._project_dir else None
        # Note: get_phases_for_track() handles worktree detection internally
        # and checks docs at root project level, syncing if needed
        return get_phases_for_track(
            self._track,
            project_dir,
            sync_docs=True,  # Sync project docs from root to worktree
        )

    @property
    def root_project_dir(self) -> Path | None:
        """Get the root project directory.

        For worktrees, this returns the original project directory.
        For non-worktrees, this is the same as project_dir.

        Returns:
            Path to root project directory, or None if not initialized
        """
        return self._root_project_dir

    def _get_phase_config(self, phase_id: str) -> tuple[str, int | None]:
        """Get model and thinking budget for a specific phase.

        Reads phase-specific configuration from task metadata's bmadPhaseModels
        and bmadPhaseThinking, falling back to defaults if not specified.

        Args:
            phase_id: The phase identifier (analyze, prd, architecture, etc.)

        Returns:
            Tuple of (model_id, thinking_budget) where:
            - model_id: Full Claude model ID string
            - thinking_budget: Extended thinking token budget or None
        """
        # Default values
        model = self._DEFAULT_AGENT_MODEL
        thinking_budget = self._DEFAULT_THINKING_BUDGET

        if not self._task_config:
            return model, thinking_budget

        metadata = self._task_config.metadata

        # Check for BMAD-specific phase configuration
        bmad_phase_models = metadata.get("bmadPhaseModels")
        bmad_phase_thinking = metadata.get("bmadPhaseThinking")

        if bmad_phase_models and phase_id in bmad_phase_models:
            model_shorthand = bmad_phase_models[phase_id]
            model = self.MODEL_ID_MAP.get(model_shorthand, self._DEFAULT_AGENT_MODEL)
            debug(
                "bmad.methodology",
                f"Phase {phase_id} using configured model",
                model=model,
            )

        if bmad_phase_thinking and phase_id in bmad_phase_thinking:
            thinking_level = bmad_phase_thinking[phase_id]
            thinking_budget = self.THINKING_BUDGET_MAP.get(thinking_level)
            debug(
                "bmad.methodology",
                f"Phase {phase_id} using configured thinking",
                thinking_level=thinking_level,
                thinking_budget=thinking_budget,
            )

        # Fall back to single model/thinking if no phase-specific config
        if not bmad_phase_models:
            model_shorthand = metadata.get("model")
            if model_shorthand:
                model = self.MODEL_ID_MAP.get(
                    model_shorthand, self._DEFAULT_AGENT_MODEL
                )

        if not bmad_phase_thinking:
            thinking_level = metadata.get("thinkingLevel")
            if thinking_level:
                thinking_budget = self.THINKING_BUDGET_MAP.get(thinking_level)

        return model, thinking_budget

    def _run_async(self, coro: Coroutine[Any, Any, T]) -> T:
        """Run an async coroutine from sync context.

        Handles the case where we might already be in an async context
        (e.g., when called from FullAutoExecutor).

        Args:
            coro: The coroutine to run

        Returns:
            The result of the coroutine

        Note:
            Uses asyncio.run() which creates a new event loop. This is
            preferred over get_event_loop() which is deprecated in Python 3.10+.
        """
        try:
            # Check if we're already in an async context
            asyncio.get_running_loop()
            # We're in an async context, run in thread
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                return executor.submit(asyncio.run, coro).result()
        except RuntimeError:
            # No running loop, safe to use asyncio.run
            return asyncio.run(coro)

    def initialize(self, context: RunContext) -> None:
        """Initialize the runner with framework context.

        Sets up the runner with access to framework services and
        initializes phase, checkpoint, and artifact definitions.

        This method can be called multiple times to reinitialize the runner
        for a new task context. Previous state is reset.

        Args:
            context: RunContext with access to all framework services
        """
        debug_section("bmad.methodology", "INITIALIZING BMAD METHODOLOGY")

        # Reset state if already initialized (support runner reuse)
        if self._initialized:
            debug("bmad.methodology", "Resetting state for re-initialization")
            self._reset_state()

        self._context = context
        self._project_dir = context.workspace.get_project_root()
        self._task_config = context.task_config
        self._complexity = context.task_config.complexity

        # Determine BMAD track from complexity
        self._track = self._get_track_for_complexity(
            self._complexity or ComplexityLevel.STANDARD
        )

        # Get spec_dir from task_config metadata if available
        spec_dir_str = context.task_config.metadata.get("spec_dir")
        if spec_dir_str:
            self._spec_dir = Path(spec_dir_str)

        # Detect worktree status and root project directory
        project_path = Path(self._project_dir)
        self._is_worktree = is_worktree(project_path)
        self._root_project_dir = get_root_project_dir(project_path)

        # Check if project has existing documentation at ROOT level (affects phase list)
        # This is important for worktrees - we check the original project, not the worktree
        has_docs = has_project_documentation(project_path, check_root=True)

        # If running in a worktree and project docs exist at root, sync them
        if self._is_worktree and has_docs:
            synced = sync_project_docs_to_worktree(self._root_project_dir, project_path)
            if synced:
                debug(
                    "bmad.methodology",
                    f"Synced {len(synced)} project doc(s) from root to worktree",
                    root_project=str(self._root_project_dir),
                    worktree=str(project_path),
                )

        debug(
            "bmad.methodology",
            "Configuration loaded",
            project_dir=self._project_dir,
            root_project_dir=str(self._root_project_dir)
            if self._root_project_dir
            else "(same)",
            is_worktree=self._is_worktree,
            spec_dir=str(self._spec_dir) if self._spec_dir else "(none)",
            complexity=self._complexity.value if self._complexity else "(default)",
            track=self._track.value if self._track else "(default)",
            has_existing_docs=has_docs,
            task_description=context.task_config.metadata.get(
                "task_description", "(none)"
            )[:100],
        )

        # Story 6.9: Initialize task-scoped output directory
        self._init_output_dir()

        # Initialize BMAD skills in target project
        self._init_skills()

        self._init_phases()
        self._init_checkpoints()
        self._init_artifacts()

        # Initialize status manager for frontend synchronization
        self._status_manager = StatusManager(project_path)
        self._total_phases = len(self.get_enabled_phases())

        # Mark build as active
        spec_name = self._spec_dir.name if self._spec_dir else "bmad-task"
        self._status_manager.set_active(spec_name, BuildState.PLANNING)

        # Emit initial phase event
        emit_phase(
            ExecutionPhase.PLANNING,
            f"BMAD {self._track.value if self._track else 'method'} initialized",
            progress=0,
        )

        # Write initial status to implementation_plan.json for frontend sync
        if self._spec_dir:
            task_name = context.task_config.metadata.get(
                "task_description", "BMAD Task"
            )
            write_task_status(
                spec_dir=self._spec_dir,
                status=TaskStatus.IN_PROGRESS,
                plan_status=PlanStatus.IN_PROGRESS,
                methodology="bmad",
                feature=task_name[:200] if task_name else "BMAD Task",
            )

        self._initialized = True

        debug_success(
            "bmad.methodology",
            "BMAD methodology initialized",
            enabled_phases=self.get_enabled_phases(),
            total_phases=self._total_phases,
            spec_dir=str(self._spec_dir)
            if self._spec_dir
            else "NOT SET - will not write status!",
        )

    def get_phases(self) -> list[Phase]:
        """Return phase definitions for the BMAD methodology.

        Returns phases based on the current complexity level:
        - QUICK: analyze, epics, stories, dev, review (5 phases)
        - STANDARD: analyze, prd, architecture, epics, stories, dev, review (7 phases)
        - COMPLEX: Same as STANDARD with deeper analysis in each phase

        Returns:
            List of Phase objects enabled for the current complexity level

        Raises:
            RuntimeError: If runner has not been initialized

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        self._ensure_initialized()

        # Filter phases based on complexity level (Story 6.8)
        enabled_phase_ids = self.get_enabled_phases()
        filtered_phases = [p for p in self._phases if p.id in enabled_phase_ids]

        # Recompute order for filtered phases
        for i, phase in enumerate(filtered_phases, start=1):
            phase.order = i

        return filtered_phases

    def execute_phase(
        self,
        phase_id: str,
        progress_callback: ProgressCallback | None = None,
    ) -> PhaseResult:
        """Execute a specific phase of the BMAD methodology.

        Delegates to the BMAD workflow integration for each phase.
        Emits ProgressEvents at phase start and end for frontend updates.

        Phases not enabled for the current complexity level are automatically
        skipped with SKIPPED status.

        Args:
            phase_id: ID of the phase to execute (analyze, prd, architecture,
                     epics, stories, dev, review)
            progress_callback: Optional callback invoked during execution for
                     incremental progress reporting

        Returns:
            PhaseResult indicating success/failure and any artifacts produced

        Raises:
            RuntimeError: If runner has not been initialized

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        self._ensure_initialized()

        # Store callback for use during phase execution
        self._current_progress_callback = progress_callback

        # Story 6.8: Check if phase is enabled for current complexity level
        if not self.is_phase_enabled(phase_id):
            complexity = self.get_complexity_level()
            logger.info(
                f"Skipping phase '{phase_id}' - not enabled for {complexity.value} complexity"
            )
            # Mark the phase as skipped in the internal list
            phase = self._find_phase(phase_id)
            if phase:
                phase.status = PhaseStatus.SKIPPED

            return PhaseResult(
                success=True,
                phase_id=phase_id,
                message=f"Phase skipped for {complexity.value} complexity level",
                metadata={
                    "skipped": True,
                    "complexity": complexity.value,
                },
            )

        # Find the phase
        phase = self._find_phase(phase_id)
        if phase is None:
            return PhaseResult(
                success=False,
                phase_id=phase_id,
                error=f"Unknown phase: {phase_id}",
            )

        # Update phase status to IN_PROGRESS
        phase.status = PhaseStatus.IN_PROGRESS

        # Emit start progress event
        if self._context:
            self._context.progress.update(phase_id, 0.0, f"Starting {phase.name}")

        # Execute the phase using the dispatch table
        try:
            result = self._execute_phase_impl(phase_id)

            # Update phase status based on result
            if result.success:
                phase.status = PhaseStatus.COMPLETED
                if self._context:
                    self._context.progress.update(
                        phase_id, 1.0, f"{phase.name} completed"
                    )
            else:
                phase.status = PhaseStatus.FAILED
                if self._context:
                    self._context.progress.update(
                        phase_id, 0.0, f"{phase.name} failed: {result.error}"
                    )

            return result

        except Exception as e:
            phase.status = PhaseStatus.FAILED
            return PhaseResult(
                success=False,
                phase_id=phase_id,
                error=str(e),
            )
        finally:
            # Clear the progress callback after execution
            self._current_progress_callback = None

    def finalize(self, success: bool = True) -> None:
        """Finalize the methodology run and clean up resources.

        Called after all phases complete to properly update status and flush
        any pending status updates.

        Args:
            success: Whether the overall run was successful
        """
        if self._status_manager:
            if success:
                emit_phase(
                    ExecutionPhase.COMPLETE, "BMAD methodology complete", progress=100
                )
                self._status_manager.write(BuildState.COMPLETE)
            else:
                emit_phase(ExecutionPhase.FAILED, "BMAD methodology failed")
                self._status_manager.write(BuildState.ERROR)

            # Flush any pending writes
            self._status_manager.flush()
            self._status_manager.set_inactive()

        debug_success("bmad.methodology", "BMAD methodology finalized", success=success)

    def _execute_phase_impl(self, phase_id: str) -> PhaseResult:
        """Dispatch to the appropriate phase implementation.

        Args:
            phase_id: ID of the phase to execute

        Returns:
            PhaseResult from the phase execution
        """
        dispatch = {
            # Quick Flow phases (Barry agent)
            "tech_spec": self._execute_tech_spec,
            "quick_dev": self._execute_quick_dev,
            # BMad Method phases
            "analyze": self._execute_analyze,
            "prd": self._execute_prd,
            "architecture": self._execute_architecture,
            "epics": self._execute_epics,
            "stories": self._execute_stories,
            "dev": self._execute_dev,
            "review": self._execute_review,
            # Enterprise phases
            "security": self._execute_security,
            "devops": self._execute_devops,
        }

        handler = dispatch.get(phase_id)
        if handler is None:
            return PhaseResult(
                success=False,
                phase_id=phase_id,
                error=f"No implementation for phase: {phase_id}",
            )

        return handler()

    # =========================================================================
    # Unified Phase Execution using Agent Invocation Pattern
    # =========================================================================

    def _execute_phase_unified(
        self,
        phase_id: str,
        max_turns: int = 20,
        agent_type: str = "coder",
    ) -> PhaseResult:
        """Execute a BMAD phase using the agent invocation pattern.

        Pattern: @{agent}.md + {workflow}

        This unified method loads the BMAD agent persona and executes the
        corresponding workflow. Each phase invokes its agent file directly
        with a workflow command, following the native BMAD pattern.

        Args:
            phase_id: Phase to execute (analyze, prd, architecture, etc.)
            max_turns: Maximum conversation turns for the phase
            agent_type: SDK agent type for tool permissions (coder, qa_reviewer)

        Returns:
            PhaseResult with success status and artifacts
        """
        from apps.backend.core.client import create_client

        # Get phase configuration from phase_executor
        try:
            phase_config = get_phase_config(phase_id)
        except ValueError as e:
            return PhaseResult(
                success=False,
                phase_id=phase_id,
                error=str(e),
            )

        # Log BMAD phase with agent identification
        log_bmad_phase(phase_id, phase_config.agent, phase_config.workflow)

        # Update phase index for progress tracking
        self._current_phase_index += 1
        progress_percent = int(
            (self._current_phase_index / max(self._total_phases, 1)) * 100
        )

        # Get execution phase and build state for this BMAD phase
        exec_phase = self.PHASE_TO_EXECUTION_PHASE.get(
            phase_id, ExecutionPhase.PLANNING
        )
        build_state = self.PHASE_TO_BUILD_STATE.get(phase_id, BuildState.PLANNING)

        # Emit phase event for frontend synchronization
        emit_phase(
            exec_phase,
            f"Starting {phase_config.workflow} with @{phase_config.agent}.md",
            progress=progress_percent,
        )

        # Update status manager
        if self._status_manager:
            self._status_manager.update_phase(
                current=phase_id,
                phase_id=self._current_phase_index,
                total=self._total_phases,
            )
            self._status_manager.write(build_state)

        debug_section(
            "bmad.methodology",
            f"{phase_id.upper()} PHASE - @{phase_config.agent}.md + {phase_config.workflow}",
        )

        if self._spec_dir is None:
            debug_error("bmad.methodology", "No spec_dir configured")
            return PhaseResult(
                success=False,
                phase_id=phase_id,
                error="No spec_dir configured. Set spec_dir in task_config.metadata.",
            )

        project_dir = Path(self._project_dir)

        debug(
            "bmad.methodology",
            "Phase configuration",
            project_dir=str(project_dir),
            spec_dir=str(self._spec_dir),
            agent=phase_config.agent,
            workflow=phase_config.workflow,
        )

        # Report progress
        self._invoke_progress_callback(
            f"Starting BMAD {phase_config.workflow} workflow with @{phase_config.agent}.md...",
            10.0,
        )

        try:
            # Get phase-specific model and thinking configuration
            model, thinking_budget = self._get_phase_config(phase_id)

            # Create client for BMAD agent
            self._invoke_progress_callback("Creating BMAD agent client...", 20.0)
            debug(
                "bmad.methodology",
                "Creating Claude Agent SDK client",
                model=model,
                agent_type=agent_type,
                thinking_budget=thinking_budget,
            )
            client = create_client(
                project_dir,
                self._spec_dir,
                model=model,
                agent_type=agent_type,
                max_thinking_tokens=thinking_budget,
            )
            debug_success("bmad.methodology", "Client created successfully")

            # Get task description
            task_description = ""
            if self._task_config:
                task_description = self._task_config.metadata.get(
                    "task_description", ""
                )

            # Create phase prompt using agent invocation pattern
            self._invoke_progress_callback(
                f"Loading @{phase_config.agent}.md agent persona...",
                25.0,
            )

            try:
                prompt = create_phase_prompt(
                    phase=phase_id,
                    task_description=task_description,
                    project_dir=project_dir,
                    include_workflow_content=True,
                    spec_dir=self._spec_dir,  # Pass spec_dir for task-scoped output paths
                )
            except FileNotFoundError as e:
                debug_error("bmad.methodology", f"Agent/workflow not found: {e}")
                return PhaseResult(
                    success=False,
                    phase_id=phase_id,
                    error=f"BMAD agent or workflow not found: {e}",
                )

            debug(
                "bmad.methodology",
                "Created phase prompt with agent persona",
                prompt_length=len(prompt),
                agent=phase_config.agent,
                workflow=phase_config.workflow,
            )

            # Run two-agent conversation loop
            self._invoke_progress_callback(
                f"Running {phase_config.workflow} workflow...",
                30.0,
            )

            async def _run_phase():
                debug(
                    "bmad.methodology",
                    f"Starting conversation loop for @{phase_config.agent}.md + {phase_config.workflow}...",
                )
                status, response = await run_bmad_conversation_loop(
                    project_dir=project_dir,
                    spec_dir=self._spec_dir,
                    phase=phase_id,
                    workflow_prompt=prompt,
                    task_description=task_description,
                    project_context="",
                    model=model,
                    max_turns=max_turns,
                    progress_callback=self._invoke_progress_callback,
                )
                debug(
                    "bmad.methodology",
                    "Conversation loop completed",
                    status=status,
                    response_length=len(response) if response else 0,
                )
                return status, response

            status, response = self._run_async(_run_phase())

            self._invoke_progress_callback(
                f"{phase_config.workflow} workflow completed",
                100.0,
            )

            debug_success(
                "bmad.methodology",
                f"{phase_id.upper()} phase completed",
                agent=phase_config.agent,
                workflow=phase_config.workflow,
                status=status,
            )

            # Emit phase completion event
            emit_phase(
                exec_phase,
                f"{phase_config.workflow} completed",
                progress=progress_percent,
            )

            # Check if this is the last phase (review)
            if phase_id == "review":
                debug_success(
                    "bmad.methodology",
                    "REVIEW PHASE COMPLETE - Preparing to write human_review status",
                    spec_dir=str(self._spec_dir) if self._spec_dir else "NONE",
                )
                emit_phase(
                    ExecutionPhase.COMPLETE, "BMAD workflow complete", progress=100
                )
                if self._status_manager:
                    self._status_manager.write(BuildState.COMPLETE)

                # Write human_review status for frontend kanban transition
                if self._spec_dir:
                    task_name = ""
                    if self._task_config:
                        task_name = self._task_config.metadata.get(
                            "task_description", ""
                        )
                    debug(
                        "bmad.methodology",
                        "Writing HUMAN_REVIEW status to implementation_plan.json",
                        spec_dir=str(self._spec_dir),
                        task_name=task_name[:50] if task_name else "BMAD Task",
                    )
                    write_task_status(
                        spec_dir=self._spec_dir,
                        status=TaskStatus.HUMAN_REVIEW,
                        plan_status=PlanStatus.REVIEW,
                        methodology="bmad",
                        feature=task_name[:200] if task_name else "BMAD Task",
                        qa_signoff={
                            "status": "approved",
                            "methodology": "bmad",
                            "phase": "review",
                        },
                    )
                    debug_success(
                        "bmad.methodology",
                        "HUMAN_REVIEW status written successfully",
                        spec_dir=str(self._spec_dir),
                    )
                else:
                    debug_warning(
                        "bmad.methodology",
                        "Cannot write HUMAN_REVIEW status - spec_dir is not set!",
                        has_task_config=bool(self._task_config),
                    )

            return PhaseResult(
                success=True,
                phase_id=phase_id,
                message=f"{phase_config.description} completed via @{phase_config.agent}.md + {phase_config.workflow}",
                metadata={
                    "agent_status": status,
                    "agent": phase_config.agent,
                    "workflow": phase_config.workflow,
                },
            )

        except Exception as e:
            debug_error("bmad.methodology", f"{phase_id} phase failed: {e}")
            logger.error(f"{phase_id} phase failed: {e}")

            # Emit failure event
            emit_phase(
                ExecutionPhase.FAILED,
                f"{phase_config.description} failed: {str(e)}",
                progress=progress_percent,
            )
            if self._status_manager:
                self._status_manager.write(BuildState.ERROR)

            return PhaseResult(
                success=False,
                phase_id=phase_id,
                error=f"{phase_config.description} failed: {str(e)}",
            )

    # =========================================================================
    # Phase Implementations using Claude Agent SDK
    # =========================================================================

    def _execute_analyze(self) -> PhaseResult:
        """Execute the project analysis phase via BMAD document-project workflow.

        Uses the agent invocation pattern: @analyst.md + document-project

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.2 - Implement BMAD Project Analysis Phase
        """
        return self._execute_phase_unified(
            phase_id="analyze",
            max_turns=20,
            agent_type="coder",
        )

    def _execute_prd(self) -> PhaseResult:
        """Execute the PRD creation phase via BMAD create-prd workflow.

        Uses the agent invocation pattern: @pm.md + create-prd

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.3 - Implement BMAD PRD Workflow Integration
        """
        return self._execute_phase_unified(
            phase_id="prd",
            max_turns=30,  # PRD has more steps
            agent_type="coder",
        )

    def _execute_architecture(self) -> PhaseResult:
        """Execute the architecture phase via BMAD create-architecture workflow.

        Uses the agent invocation pattern: @architect.md + create-architecture

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.4 - Implement BMAD Architecture Workflow Integration
        """
        return self._execute_phase_unified(
            phase_id="architecture",
            max_turns=25,
            agent_type="coder",
        )

    def _execute_epics(self) -> PhaseResult:
        """Execute the epic and story creation phase via BMAD workflow.

        Uses the agent invocation pattern: @pm.md + create-epics-and-stories

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.5 - Implement BMAD Epic and Story Creation
        """
        return self._execute_phase_unified(
            phase_id="epics",
            max_turns=25,
            agent_type="coder",
        )

    def _execute_stories(self) -> PhaseResult:
        """Execute the story preparation phase via BMAD create-story workflow.

        Uses the agent invocation pattern: @sm.md + create-story

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.5 - Implement BMAD Epic and Story Creation
        """
        return self._execute_phase_unified(
            phase_id="stories",
            max_turns=20,
            agent_type="coder",
        )

    def _execute_dev(self) -> PhaseResult:
        """Execute the development phase via BMAD dev-story workflow.

        Uses the agent invocation pattern: @dev.md + dev-story

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.6 - Implement BMAD Dev-Story Workflow Integration
        """
        return self._execute_phase_unified(
            phase_id="dev",
            max_turns=30,  # Dev phase may need more turns
            agent_type="coder",
        )

    def _execute_review(self) -> PhaseResult:
        """Execute the code review phase via BMAD code-review workflow.

        Uses the agent invocation pattern: @dev.md + code-review

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.7 - Implement BMAD Code Review Workflow Integration
        """
        return self._execute_phase_unified(
            phase_id="review",
            max_turns=20,
            agent_type="qa_reviewer",  # Use QA reviewer permissions for code review
        )

    # =========================================================================
    # Quick Flow Phase Implementations (Barry agent)
    # =========================================================================

    def _execute_tech_spec(self) -> PhaseResult:
        """Execute the tech spec phase via BMAD create-tech-spec workflow.

        Uses the agent invocation pattern: @quick-flow-solo-dev.md + create-tech-spec

        This is the first phase of Quick Flow track, creating a technical
        specification with implementation-ready stories.

        Returns:
            PhaseResult with success status and artifacts
        """
        return self._execute_phase_unified(
            phase_id="tech_spec",
            max_turns=25,
            agent_type="coder",
        )

    def _execute_quick_dev(self) -> PhaseResult:
        """Execute the quick dev phase via BMAD quick-dev workflow.

        Uses the agent invocation pattern: @quick-flow-solo-dev.md + quick-dev

        This is the main implementation phase of Quick Flow track,
        implementing the tech spec end-to-end.

        Returns:
            PhaseResult with success status and artifacts
        """
        return self._execute_phase_unified(
            phase_id="quick_dev",
            max_turns=40,  # Quick dev may need more turns for full implementation
            agent_type="coder",
        )

    # =========================================================================
    # Enterprise Phase Implementations
    # =========================================================================

    def _execute_security(self) -> PhaseResult:
        """Execute the security phase via BMAD security-review workflow.

        Uses the agent invocation pattern: @architect.md + security-review

        This is an Enterprise track phase for security documentation
        and review.

        Returns:
            PhaseResult with success status and artifacts
        """
        return self._execute_phase_unified(
            phase_id="security",
            max_turns=25,
            agent_type="coder",
        )

    def _execute_devops(self) -> PhaseResult:
        """Execute the devops phase via BMAD devops-setup workflow.

        Uses the agent invocation pattern: @architect.md + devops-setup

        This is an Enterprise track phase for DevOps and deployment
        documentation.

        Returns:
            PhaseResult with success status and artifacts
        """
        return self._execute_phase_unified(
            phase_id="devops",
            max_turns=25,
            agent_type="coder",
        )

    # =========================================================================
    # Protocol Implementation
    # =========================================================================

    def get_checkpoints(self) -> list[Checkpoint]:
        """Return checkpoint definitions for Semi-Auto mode.

        Returns checkpoints based on the current complexity level:
        - QUICK: after_epics, after_review (minimal checkpoints for speed)
        - STANDARD/COMPLEX: All checkpoints (after_prd, after_architecture,
          after_epics, after_story, after_review)

        Returns:
            List of Checkpoint objects enabled for the current complexity level

        Raises:
            RuntimeError: If runner has not been initialized

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        self._ensure_initialized()

        # Filter checkpoints based on complexity level (Story 6.8)
        enabled_checkpoint_ids = self.get_enabled_checkpoints()
        filtered_checkpoints = [
            c for c in self._checkpoints if c.id in enabled_checkpoint_ids
        ]

        return filtered_checkpoints

    def get_artifacts(self) -> list[Artifact]:
        """Return artifact definitions produced by the BMAD methodology.

        Returns artifacts based on the current complexity level:
        - QUICK: Excludes PRD and Architecture artifacts
        - STANDARD/COMPLEX: All artifacts included

        Returns:
            List of Artifact objects for enabled phases

        Raises:
            RuntimeError: If runner has not been initialized

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        self._ensure_initialized()

        # Filter artifacts based on complexity level (Story 6.8)
        # Only include artifacts for phases that are enabled
        enabled_phases = self.get_enabled_phases()
        filtered_artifacts = [
            a for a in self._artifacts if a.phase_id in enabled_phases
        ]

        return filtered_artifacts

    # =========================================================================
    # Helper Methods
    # =========================================================================

    def _ensure_initialized(self) -> None:
        """Ensure the runner has been initialized.

        Raises:
            RuntimeError: If runner has not been initialized
        """
        if not self._initialized:
            raise RuntimeError("BMADRunner not initialized. Call initialize() first.")

    # =========================================================================
    # Story 6.8: Complexity Level Support Methods
    # =========================================================================

    def get_complexity_level(self) -> ComplexityLevel:
        """Get the current complexity level.

        Returns the complexity level set during initialization. Defaults to
        STANDARD if not explicitly set.

        Returns:
            ComplexityLevel enum value (QUICK, STANDARD, or COMPLEX)

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        return self._complexity or ComplexityLevel.STANDARD

    def is_phase_enabled(self, phase_id: str) -> bool:
        """Check if a phase is enabled for the current track.

        Uses the track-based phase list which properly handles:
        - Quick Flow (tech_spec, quick_dev, review)
        - BMad Method (prd, architecture, epics, stories, dev, review)
        - Enterprise (adds security, devops)
        - Conditional analyze phase based on project documentation

        Args:
            phase_id: ID of the phase to check (e.g., 'prd', 'architecture')

        Returns:
            True if the phase should be executed, False if it should be skipped

        Example:
            >>> runner.is_phase_enabled('prd')
            True  # Standard/Complex
            False # Quick

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        enabled_phases = self._get_phases_for_track()
        return phase_id in enabled_phases

    def get_enabled_phases(self) -> list[str]:
        """Get the list of phase IDs enabled for the current track.

        Uses the track-based phase list which properly handles:
        - Quick Flow (tech_spec, quick_dev, review)
        - BMad Method (prd, architecture, epics, stories, dev, review)
        - Enterprise (adds security, devops)
        - Conditional analyze phase based on project documentation

        Returns:
            List of phase IDs that should be executed

        Example:
            >>> runner.get_enabled_phases()
            ['tech_spec', 'quick_dev', 'review']  # Quick Flow
            ['prd', 'architecture', 'epics', 'stories', 'dev', 'review']  # BMad Method
            ['analyze', 'prd', ...]  # BMad Method with undocumented project

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        return self._get_phases_for_track()

    def get_enabled_checkpoints(self) -> list[str]:
        """Get the list of checkpoint IDs enabled for the current complexity level.

        Quick complexity has fewer checkpoints for faster iteration.
        Standard and Complex have all checkpoints enabled.

        Returns:
            List of checkpoint IDs that should be active

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        complexity = self.get_complexity_level()
        return self.COMPLEXITY_CHECKPOINTS.get(
            complexity, self.COMPLEXITY_CHECKPOINTS[ComplexityLevel.STANDARD]
        ).copy()

    def get_skipped_phases(self) -> list[str]:
        """Get the list of phase IDs that are skipped for the current complexity level.

        Useful for logging and reporting which phases are being skipped.

        Returns:
            List of phase IDs that will be skipped

        Example:
            >>> runner.get_skipped_phases()
            ['prd', 'architecture']  # Quick
            []  # Standard/Complex

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        all_phases = self.COMPLEXITY_PHASES[ComplexityLevel.STANDARD]
        enabled_phases = self.get_enabled_phases()
        return [p for p in all_phases if p not in enabled_phases]

    @property
    def is_quick_mode(self) -> bool:
        """Check if running in Quick complexity mode.

        Returns:
            True if complexity level is QUICK

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        return self.get_complexity_level() == ComplexityLevel.QUICK

    @property
    def is_complex_mode(self) -> bool:
        """Check if running in Complex complexity mode.

        Complex mode enables deeper analysis and validation in each phase.

        Returns:
            True if complexity level is COMPLEX

        Story Reference: Story 6.8 - Implement BMAD Complexity Level Support
        """
        return self.get_complexity_level() == ComplexityLevel.COMPLEX

    # =========================================================================
    # Story 6.9: Task-Scoped Output Directory Methods
    # =========================================================================

    def _init_output_dir(self) -> None:
        """Initialize the task-scoped output directory with native BMAD structure.

        Creates the BMAD output directory within the spec directory:
        `.auto-claude/specs/{task-id}/_bmad-output/`

        Also creates the native BMAD subdirectories:
        - `planning-artifacts/` - PRD, architecture, epics (task-specific)
        - `implementation-artifacts/` - story files, sprint status (task-specific)

        Creates symlinks to project-level documentation from root:
        - `project_knowledge/` -> root/_bmad-output/project_knowledge/ (read-only access)
        - Other project docs as symlinks for agent access

        This hybrid approach allows:
        - Agents to READ project-level docs via symlinks
        - Agents to WRITE task-specific artifacts to spec folder
        - Multiple parallel tasks without conflicts

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._spec_dir is None:
            logger.warning(
                "No spec_dir configured. BMAD artifacts will not be task-scoped."
            )
            return

        self._output_dir = self._spec_dir / self.BMAD_OUTPUT_SUBDIR
        self._ensure_output_dir()

        # Create symlinks to project-level docs for agent access
        self._symlink_project_docs()

    def _ensure_output_dir(self) -> None:
        """Ensure the output directory and native BMAD subdirectories exist.

        Creates the output directory structure matching native BMAD expectations:
        - _bmad-output/
        - _bmad-output/planning-artifacts/
        - _bmad-output/implementation-artifacts/

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._output_dir is not None:
            self._output_dir.mkdir(parents=True, exist_ok=True)
            # Create native BMAD subdirectories for workflow compatibility
            (self._output_dir / "planning-artifacts").mkdir(exist_ok=True)
            (self._output_dir / "implementation-artifacts").mkdir(exist_ok=True)
            logger.debug(f"BMAD output directory ready: {self._output_dir}")

    def _symlink_project_docs(self) -> None:
        """Create symlinks from spec _bmad-output to root project-level docs.

        This implements the hybrid symlink strategy:
        - Project-level docs (from document-project workflow) stay at root
        - Spec folder gets symlinks to these docs for READ access
        - Task-specific artifacts (PRD, stories, etc.) are written to spec folder

        Symlinked paths (from root to spec):
        - project_knowledge/ - Main project documentation index
        - project-overview.md - Project overview
        - architecture.md - Project architecture (if project-level, not task-specific)
        - development-guide.md - Development guidelines
        - index.md - Documentation index
        - project-scan-report.json - Project scan results

        Cross-platform handling:
        - macOS/Linux: Uses relative symlinks for portability
        - Windows: Uses directory junctions for directories, hard links for files
        """
        if self._output_dir is None or self._root_project_dir is None:
            return

        project_dir = Path(self._project_dir)
        root_bmad_output = self._root_project_dir / self.BMAD_OUTPUT_SUBDIR

        # If root _bmad-output doesn't exist, nothing to symlink
        if not root_bmad_output.exists():
            debug(
                "bmad.methodology",
                "No root _bmad-output to symlink from",
                root_bmad_output=str(root_bmad_output),
            )
            return

        # Project-level docs to symlink (relative to _bmad-output/)
        # These are READ-ONLY for task agents
        project_level_docs = [
            "project_knowledge",  # Directory with project docs
            "project-overview.md",
            "architecture.md",  # Project-level architecture (not task PRD)
            "development-guide.md",
            "index.md",
            "project-scan-report.json",
            "source-tree-analysis.md",
            "state-management-patterns.md",
            "asset-inventory.md",
            "product-brief.md",
            "research",  # Directory with research docs
        ]

        symlinked = []
        for doc_name in project_level_docs:
            source = root_bmad_output / doc_name
            target = self._output_dir / doc_name

            # Skip if source doesn't exist
            if not source.exists():
                continue

            # Skip if target already exists (don't overwrite)
            if target.exists() or target.is_symlink():
                debug(
                    "bmad.methodology",
                    f"Skipping symlink - target exists: {doc_name}",
                )
                continue

            try:
                if sys.platform == "win32":
                    # On Windows, use directory junctions or file copy
                    if source.is_dir():
                        result = subprocess.run(
                            [
                                "cmd",
                                "/c",
                                "mklink",
                                "/J",
                                str(target),
                                str(source.resolve()),
                            ],
                            capture_output=True,
                            text=True,
                        )
                        if result.returncode != 0:
                            raise OSError(result.stderr or "mklink /J failed")
                    else:
                        # For files on Windows, copy instead of symlink
                        # (symlinks require admin on older Windows)
                        shutil.copy2(source, target)
                else:
                    # On macOS/Linux, use relative symlinks
                    relative_source = os.path.relpath(source.resolve(), target.parent)
                    os.symlink(relative_source, target)

                symlinked.append(doc_name)
                debug(
                    "bmad.methodology",
                    f"Symlinked project doc: {doc_name}",
                    source=str(source),
                    target=str(target),
                )

            except OSError as e:
                debug_warning(
                    "bmad.methodology",
                    f"Could not symlink {doc_name}: {e}",
                )

        if symlinked:
            debug_success(
                "bmad.methodology",
                f"Symlinked {len(symlinked)} project doc(s) to spec _bmad-output",
                docs=symlinked,
            )

    @property
    def output_dir(self) -> Path | None:
        """Get the task-scoped output directory for BMAD artifacts.

        Returns:
            Path to the output directory (`.auto-claude/specs/{task-id}/_bmad-output/`),
            or None if spec_dir is not configured.

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        return self._output_dir

    def get_artifact_path(self, artifact_name: str) -> Path | None:
        """Get the full path for a BMAD artifact.

        Constructs the path within the task-scoped output directory.
        If output_dir is not configured, returns None.

        Args:
            artifact_name: Name of the artifact file (e.g., 'analysis.json', 'prd.md')

        Returns:
            Full path to the artifact within the output directory,
            or None if output directory is not configured.

        Example:
            >>> runner.get_artifact_path('prd.md')
            Path('.auto-claude/specs/139-task-name/_bmad-output/prd.md')

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._output_dir is None:
            return None
        return self._output_dir / artifact_name

    def get_stories_dir(self) -> Path | None:
        """Get the stories subdirectory within the output directory.

        Creates the stories subdirectory if it doesn't exist.
        Note: Stories are placed in implementation-artifacts/ per native BMAD structure.

        Returns:
            Path to the stories directory (`.auto-claude/specs/{task-id}/_bmad-output/implementation-artifacts/`),
            or None if output directory is not configured.

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._output_dir is None:
            return None

        # Stories go in implementation-artifacts per native BMAD structure
        stories_dir = self._output_dir / "implementation-artifacts"
        stories_dir.mkdir(parents=True, exist_ok=True)
        return stories_dir

    # =========================================================================
    # BMAD Skills Initialization
    # =========================================================================

    def _init_skills(self) -> None:
        """Initialize BMAD skills in the target project via symlink.

        Creates a symlink from the target project's `_bmad/` directory to the
        BMAD skills in the Auto Claude installation. This allows agents running
        in the target project to access BMAD workflows via slash commands.

        The source `_bmad/` folder is located relative to this methodology file:
        autonomous-coding/_bmad/

        The symlink is created at:
        {project_dir}/_bmad/ -> {auto_claude_root}/_bmad/

        Cross-platform handling:
        - macOS/Linux: Uses relative symlinks for portability
        - Windows: Uses directory junctions (no admin rights required)

        If symlink creation fails, logs a warning but does not fail the
        initialization - the methodology will continue but BMAD slash commands
        may not work.
        """
        debug("bmad.methodology", "Initializing BMAD skills symlink...")

        if not self._project_dir:
            debug_warning(
                "bmad.methodology",
                "No project_dir configured. BMAD skills will not be linked.",
            )
            logger.warning("No project_dir configured. BMAD skills will not be linked.")
            return

        project_dir = Path(self._project_dir)

        # Determine the Auto Claude root directory
        # This file is at: autonomous-coding/apps/backend/methodologies/bmad/methodology.py
        # So Auto Claude root is 5 levels up
        auto_claude_root = Path(__file__).parent.parent.parent.parent.parent

        # Source: _bmad/ folder in Auto Claude
        source_bmad = auto_claude_root / "_bmad"

        # Target: _bmad/ symlink in target project
        target_bmad = project_dir / "_bmad"

        debug(
            "bmad.methodology",
            "BMAD skills paths",
            source=str(source_bmad),
            target=str(target_bmad),
            source_exists=source_bmad.exists(),
        )

        # Verify source exists
        if not source_bmad.exists():
            debug_warning(
                "bmad.methodology",
                f"BMAD skills source not found at {source_bmad}",
            )
            logger.warning(
                f"BMAD skills source not found at {source_bmad}. "
                "BMAD slash commands may not work."
            )
            return

        # Skip if target already exists (don't overwrite)
        if target_bmad.exists():
            debug("bmad.methodology", f"BMAD skills already present at {target_bmad}")
            logger.debug(f"BMAD skills already present at {target_bmad}")
            return

        # Also skip if target is a symlink (even if broken)
        if target_bmad.is_symlink():
            debug(
                "bmad.methodology",
                f"BMAD skills symlink already exists at {target_bmad} (possibly broken)",
            )
            logger.debug(
                f"BMAD skills symlink already exists at {target_bmad} (possibly broken)"
            )
            return

        try:
            if sys.platform == "win32":
                # On Windows, use directory junctions (no admin rights required)
                # Junctions require absolute paths
                debug(
                    "bmad.methodology", "Creating Windows junction for BMAD skills..."
                )
                result = subprocess.run(
                    [
                        "cmd",
                        "/c",
                        "mklink",
                        "/J",
                        str(target_bmad),
                        str(source_bmad.resolve()),
                    ],
                    capture_output=True,
                    text=True,
                )
                if result.returncode != 0:
                    raise OSError(result.stderr or "mklink /J failed")
                debug_success(
                    "bmad.methodology",
                    f"Created BMAD skills junction: {target_bmad} -> {source_bmad}",
                )
                logger.info(
                    f"Created BMAD skills junction: {target_bmad} -> {source_bmad}"
                )
            else:
                # On macOS/Linux, use relative symlinks for portability
                relative_source = os.path.relpath(
                    source_bmad.resolve(), target_bmad.parent
                )
                debug(
                    "bmad.methodology",
                    f"Creating symlink: {target_bmad} -> {relative_source}",
                )
                os.symlink(relative_source, target_bmad)
                debug_success(
                    "bmad.methodology",
                    f"Created BMAD skills symlink: {target_bmad} -> {relative_source}",
                )
                logger.info(
                    f"Created BMAD skills symlink: {target_bmad} -> {relative_source}"
                )

        except OSError as e:
            # Symlink/junction creation can fail on some systems
            # Log warning but don't fail - methodology is still usable
            debug_error(
                "bmad.methodology",
                f"Could not create BMAD skills symlink: {e}",
            )
            logger.warning(
                f"Could not create BMAD skills symlink at {target_bmad}: {e}. "
                "BMAD slash commands may not work in the target project."
            )

    def _cleanup_skills_symlink(self) -> None:
        """Remove the BMAD skills symlink from the target project.

        Called during cleanup to remove the symlink created by _init_skills().
        This is optional - symlinks can be left in place if desired.
        """
        if not self._project_dir:
            return

        target_bmad = Path(self._project_dir) / "_bmad"

        # Only remove if it's a symlink (don't delete actual _bmad folders)
        if target_bmad.is_symlink():
            try:
                target_bmad.unlink()
                logger.debug(f"Removed BMAD skills symlink: {target_bmad}")
            except OSError as e:
                logger.warning(f"Could not remove BMAD skills symlink: {e}")

    def _load_workflow_prompt(
        self,
        workflow_path: str,
        task_description: str | None = None,
    ) -> str:
        """Load BMAD workflow instructions and return the full prompt.

        Resolves a workflow path to the actual instructions.md file, loads it,
        and optionally substitutes config variables.

        Supports two formats:
        1. Colon-separated: 'bmm:workflows:document-project' or 'bmm:workflows:2-plan-workflows:prd'
        2. Slash-separated: 'bmm/workflows/document-project'

        Args:
            workflow_path: Path to workflow (colon or slash separated from _bmad root)
            task_description: Optional task description to include in the prompt

        Returns:
            Full prompt text with workflow instructions

        Raises:
            FileNotFoundError: If workflow instructions not found
        """
        import re

        debug(
            "bmad.methodology",
            "Loading workflow prompt",
            workflow_path=workflow_path,
        )

        # Resolve paths relative to project's _bmad directory
        project_dir = Path(self._project_dir)
        bmad_root = project_dir / "_bmad"

        if not bmad_root.exists():
            raise FileNotFoundError(
                f"BMAD skills directory not found at {bmad_root}. "
                "Ensure _init_skills() was called successfully."
            )

        # Normalize path: convert colons to slashes for path resolution
        normalized_path = workflow_path.replace(":", "/")

        # Build workflow directory path
        workflow_dir = bmad_root / normalized_path

        if not workflow_dir.exists():
            raise FileNotFoundError(
                f"Workflow not found at {workflow_dir}. "
                f"Check that the workflow '{workflow_path}' is installed."
            )

        # Load instructions (check for instructions.md, workflow.md, or instructions.xml)
        # BMAD workflows use various file formats - support all of them
        instructions_path = None
        for filename in ["instructions.md", "workflow.md", "instructions.xml"]:
            candidate = workflow_dir / filename
            if candidate.exists():
                instructions_path = candidate
                break

        if instructions_path is None:
            raise FileNotFoundError(
                f"Workflow instructions not found at {workflow_dir}. "
                "Each workflow must have instructions.md, workflow.md, or instructions.xml file."
            )

        instructions = instructions_path.read_text(encoding="utf-8")

        debug(
            "bmad.methodology",
            "Loaded workflow instructions",
            path=str(instructions_path),
            length=len(instructions),
        )

        # Load workflow.yaml for config variable substitution
        workflow_yaml_path = workflow_dir / "workflow.yaml"
        workflow_config = {}
        if workflow_yaml_path.exists():
            try:
                import yaml

                workflow_config = (
                    yaml.safe_load(workflow_yaml_path.read_text(encoding="utf-8")) or {}
                )
                debug(
                    "bmad.methodology",
                    "Loaded workflow config",
                    keys=list(workflow_config.keys()),
                )
            except Exception as e:
                logger.warning(f"Could not load workflow.yaml: {e}")

        # Extract module name from path for config loading (first component)
        path_parts = normalized_path.split("/")
        module = path_parts[0] if path_parts else "bmm"

        # Load module config.yaml for additional variables
        module_config_path = bmad_root / module / "config.yaml"
        module_config = {}
        if module_config_path.exists():
            try:
                import yaml

                module_config = (
                    yaml.safe_load(module_config_path.read_text(encoding="utf-8")) or {}
                )
                debug(
                    "bmad.methodology",
                    "Loaded module config",
                    path=str(module_config_path),
                    keys=list(module_config.keys()),
                )
            except Exception as e:
                logger.warning(f"Could not load module config.yaml: {e}")

        # Build substitution variables
        # Start with module and workflow configs, then override with task-scoped paths
        variables = {
            **module_config,
            **workflow_config,
            "project-root": str(project_dir),
            "project_root": str(project_dir),
            "installed_path": str(workflow_dir),
            "spec_dir": str(self._spec_dir) if self._spec_dir else "",
            "bmad_output": str(self._output_dir) if self._output_dir else "",
        }

        # Override BMAD output paths with task-scoped versions for multi-task isolation
        # This redirects native BMAD paths to the spec directory while maintaining structure
        if self._output_dir:
            variables["output_folder"] = str(self._output_dir)
            variables["planning_artifacts"] = str(
                self._output_dir / "planning-artifacts"
            )
            variables["implementation_artifacts"] = str(
                self._output_dir / "implementation-artifacts"
            )
            variables["project_knowledge"] = str(self._output_dir)

        # Add task description if provided
        if task_description:
            variables["task_description"] = task_description

        # Substitute {variable} patterns in instructions
        def replace_var(match):
            var_name = match.group(1)
            # Handle nested config references like {config_source}:key
            if ":" in var_name:
                # Skip complex config references for now
                return match.group(0)
            return str(variables.get(var_name, match.group(0)))

        instructions = re.sub(r"\{([^}]+)\}", replace_var, instructions)

        # Build final prompt with context
        prompt_parts = []

        # Add task context if provided
        if task_description:
            prompt_parts.append(f"## Task Description\n\n{task_description}\n\n")

        # Add output directory context with native BMAD structure
        if self._output_dir:
            planning_dir = self._output_dir / "planning-artifacts"
            impl_dir = self._output_dir / "implementation-artifacts"
            prompt_parts.append(
                f"## Output Directory\n\n"
                f"Use the following BMAD output structure:\n"
                f"- **Planning artifacts** (PRD, architecture, epics): `{planning_dir}`\n"
                f"- **Implementation artifacts** (stories, sprint-status): `{impl_dir}`\n"
                f"- **Other artifacts** (project-context, docs): `{self._output_dir}`\n\n"
            )

        # Add the workflow instructions
        prompt_parts.append("## Workflow Instructions\n\n")
        prompt_parts.append(instructions)

        full_prompt = "".join(prompt_parts)

        debug_success(
            "bmad.methodology",
            "Workflow prompt loaded",
            prompt_length=len(full_prompt),
            preview=full_prompt[:200] + "..."
            if len(full_prompt) > 200
            else full_prompt,
        )

        return full_prompt

    def _find_phase(self, phase_id: str) -> Phase | None:
        """Find a phase by its ID.

        Args:
            phase_id: ID of the phase to find

        Returns:
            Phase object if found, None otherwise
        """
        for phase in self._phases:
            if phase.id == phase_id:
                return phase
        return None

    def _invoke_progress_callback(self, message: str, percentage: float) -> None:
        """Invoke the current progress callback if set.

        Args:
            message: Human-readable progress message
            percentage: Progress within the current phase (0.0 to 100.0)
        """
        if self._current_progress_callback is not None:
            try:
                self._current_progress_callback(message, percentage)
            except Exception as e:
                logger.warning(f"Progress callback failed: {e}")

    # =========================================================================
    # Initialization Methods
    # =========================================================================

    def _init_phases(self) -> None:
        """Initialize phase definitions for the BMAD methodology.

        Creates phases based on the current track (Quick Flow, BMad Method, Enterprise).
        The analyze phase is conditionally included based on whether the project
        already has documentation.
        """
        # Get the phases for the current track
        active_phases = self._get_phases_for_track()

        # All possible phases with their definitions
        all_phase_definitions = {
            # Quick Flow phases
            "tech_spec": Phase(
                id="tech_spec",
                name="Tech Spec",
                description="Create technical specification with implementation-ready stories (Barry)",
                order=1,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            "quick_dev": Phase(
                id="quick_dev",
                name="Quick Dev",
                description="Implement the tech spec end-to-end (Barry)",
                order=2,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            # BMad Method phases
            "analyze": Phase(
                id="analyze",
                name="Project Analysis",
                description="Analyze project structure and gather context (Mary)",
                order=1,
                status=PhaseStatus.PENDING,
                is_optional=True,  # Only runs if project is undocumented
            ),
            "prd": Phase(
                id="prd",
                name="PRD Creation",
                description="Create Product Requirements Document (John)",
                order=2,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            "architecture": Phase(
                id="architecture",
                name="Architecture",
                description="Design and document system architecture (Winston)",
                order=3,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            "epics": Phase(
                id="epics",
                name="Epic & Story Creation",
                description="Create epics and break down into stories (John)",
                order=4,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            "stories": Phase(
                id="stories",
                name="Story Preparation",
                description="Prepare and refine stories for development",
                order=5,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            "dev": Phase(
                id="dev",
                name="Development",
                description="Implement stories via dev-story workflow (Amelia)",
                order=6,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            "review": Phase(
                id="review",
                name="Code Review",
                description="Review implementation via code-review workflow",
                order=7,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            # Enterprise phases
            "security": Phase(
                id="security",
                name="Security Review",
                description="Security documentation and review",
                order=4,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            "devops": Phase(
                id="devops",
                name="DevOps Setup",
                description="DevOps and deployment documentation",
                order=5,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
        }

        # Build the phase list based on active phases for the current track
        self._phases = []
        for order, phase_id in enumerate(active_phases, start=1):
            if phase_id in all_phase_definitions:
                phase = all_phase_definitions[phase_id]
                # Update order to match position in active list
                phase.order = order
                self._phases.append(phase)

        debug(
            "bmad.methodology",
            "Phases initialized",
            track=self._track.value if self._track else "(none)",
            phase_ids=[p.id for p in self._phases],
        )

    def _init_checkpoints(self) -> None:
        """Initialize checkpoint definitions for Semi-Auto mode.

        Creates checkpoints based on the current track (Quick Flow, BMad Method, Enterprise).
        """
        # All possible checkpoint definitions
        all_checkpoint_definitions = {
            # Quick Flow checkpoints
            "after_tech_spec": Checkpoint(
                id="after_tech_spec",
                name="Tech Spec Review",
                description="Review technical specification before implementation",
                phase_id="tech_spec",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            # BMad Method checkpoints
            "after_prd": Checkpoint(
                id="after_prd",
                name="PRD Review",
                description="Review Product Requirements Document before architecture",
                phase_id="prd",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            "after_architecture": Checkpoint(
                id="after_architecture",
                name="Architecture Review",
                description="Review architecture design before epic creation",
                phase_id="architecture",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            "after_epics": Checkpoint(
                id="after_epics",
                name="Epic Review",
                description="Review epics and stories before development",
                phase_id="epics",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            "after_story": Checkpoint(
                id="after_story",
                name="Story Review",
                description="Review story implementation before continuing",
                phase_id="dev",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            "after_review": Checkpoint(
                id="after_review",
                name="Final Review",
                description="Review code review results before completion",
                phase_id="review",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            # Enterprise checkpoints
            "after_security": Checkpoint(
                id="after_security",
                name="Security Review",
                description="Review security documentation before DevOps",
                phase_id="security",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            "after_devops": Checkpoint(
                id="after_devops",
                name="DevOps Review",
                description="Review DevOps setup before epic creation",
                phase_id="devops",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
        }

        # Get checkpoints for the current track
        if self._track:
            active_checkpoint_ids = self.TRACK_CHECKPOINTS.get(self._track, [])
        else:
            active_checkpoint_ids = self.TRACK_CHECKPOINTS.get(
                BMADTrack.BMAD_METHOD, []
            )

        # Build the checkpoint list based on active checkpoints for the current track
        self._checkpoints = []
        for checkpoint_id in active_checkpoint_ids:
            if checkpoint_id in all_checkpoint_definitions:
                self._checkpoints.append(all_checkpoint_definitions[checkpoint_id])

    def _init_artifacts(self) -> None:
        """Initialize artifact definitions for the BMAD methodology.

        Artifact paths are relative to the spec_dir and use the bmad/
        subdirectory for task-scoped storage.

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        # Use task-scoped paths within bmad/ subdirectory
        bmad_subdir = self.BMAD_OUTPUT_SUBDIR

        self._artifacts = [
            Artifact(
                id="analysis-json",
                artifact_type="json",
                name="Project Analysis",
                file_path=f"{bmad_subdir}/analysis.json",
                phase_id="analyze",
                content_type="application/json",
            ),
            Artifact(
                id="prd-md",
                artifact_type="markdown",
                name="Product Requirements Document",
                file_path=f"{bmad_subdir}/prd.md",
                phase_id="prd",
                content_type="text/markdown",
            ),
            Artifact(
                id="architecture-md",
                artifact_type="markdown",
                name="Architecture Document",
                file_path=f"{bmad_subdir}/architecture.md",
                phase_id="architecture",
                content_type="text/markdown",
            ),
            Artifact(
                id="epics-md",
                artifact_type="markdown",
                name="Epics Document",
                file_path=f"{bmad_subdir}/epics.md",
                phase_id="epics",
                content_type="text/markdown",
            ),
            Artifact(
                id="stories-md",
                artifact_type="markdown",
                name="Story Files",
                file_path=f"{bmad_subdir}/stories/*.md",
                phase_id="stories",
                content_type="text/markdown",
            ),
            Artifact(
                id="review-report-md",
                artifact_type="markdown",
                name="Review Report",
                file_path=f"{bmad_subdir}/review_report.md",
                phase_id="review",
                content_type="text/markdown",
            ),
        ]
