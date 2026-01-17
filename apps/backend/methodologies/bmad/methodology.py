"""BMAD (Business Model Agile Development) methodology runner.

This module implements the MethodologyRunner Protocol for the BMAD methodology.
BMAD is a structured approach to software development that emphasizes
PRD creation, architecture design, epic/story planning, and iterative development.

Architecture Source: architecture.md#BMAD-Plugin-Structure
Story Reference: Story 6.1 - Create BMAD Methodology Plugin Structure
"""

import logging
from pathlib import Path
from typing import TYPE_CHECKING

from apps.backend.methodologies.protocols import (
    Artifact,
    Checkpoint,
    CheckpointStatus,
    ComplexityLevel,
    Phase,
    PhaseResult,
    PhaseStatus,
    ProgressCallback,
    RunContext,
    TaskConfig,
)

# Type hints for optional dependencies
if TYPE_CHECKING:
    pass

logger = logging.getLogger(__name__)


class BMADRunner:
    """MethodologyRunner implementation for BMAD methodology.

    This class implements the MethodologyRunner Protocol, providing the interface
    for the plugin framework to execute the BMAD methodology.

    The BMAD methodology follows a 7-phase pipeline:
    1. Analyze - Project analysis and context gathering
    2. PRD - Product Requirements Document creation
    3. Architecture - Architecture design and documentation
    4. Epics - Epic and story creation
    5. Stories - Story preparation and refinement
    6. Dev - Development/implementation
    7. Review - Code review

    Artifact Storage (Story 6.9):
        All artifacts are stored in task-scoped directories:
        `.auto-claude/specs/{task-id}/bmad/`

        This enables parallel execution of multiple BMAD tasks without
        artifact collisions.

    Story Reference: Story 6.1 - Create BMAD Methodology Plugin Structure
    Story Reference: Story 6.9 - Task-Scoped Output Directories
    """

    # BMAD output subdirectory name within spec_dir
    BMAD_OUTPUT_SUBDIR = "bmad"

    def __init__(self) -> None:
        """Initialize BMADRunner instance."""
        self._context: RunContext | None = None
        self._phases: list[Phase] = []
        self._checkpoints: list[Checkpoint] = []
        self._artifacts: list[Artifact] = []
        self._initialized: bool = False
        # Context attributes for phase execution
        self._project_dir: str = ""
        self._spec_dir: Path | None = None
        self._task_config: TaskConfig | None = None
        self._complexity: ComplexityLevel | None = None
        # Progress callback for current execution
        self._current_progress_callback: ProgressCallback | None = None
        # Task-scoped output directory (Story 6.9)
        self._output_dir: Path | None = None

    def initialize(self, context: RunContext) -> None:
        """Initialize the runner with framework context.

        Sets up the runner with access to framework services and
        initializes phase, checkpoint, and artifact definitions.

        Args:
            context: RunContext with access to all framework services

        Raises:
            RuntimeError: If runner is already initialized
        """
        if self._initialized:
            raise RuntimeError("BMADRunner already initialized")

        self._context = context
        self._project_dir = context.workspace.get_project_root()
        self._task_config = context.task_config
        self._complexity = context.task_config.complexity

        # Get spec_dir from task_config metadata if available
        spec_dir_str = context.task_config.metadata.get("spec_dir")
        if spec_dir_str:
            self._spec_dir = Path(spec_dir_str)

        # Story 6.9: Initialize task-scoped output directory
        self._init_output_dir()

        self._init_phases()
        self._init_checkpoints()
        self._init_artifacts()
        self._initialized = True

    def get_phases(self) -> list[Phase]:
        """Return all phase definitions for the BMAD methodology.

        Returns:
            List of Phase objects defining the 7-phase pipeline:
            analyze, prd, architecture, epics, stories, dev, review

        Raises:
            RuntimeError: If runner has not been initialized
        """
        self._ensure_initialized()
        return self._phases.copy()

    def execute_phase(
        self,
        phase_id: str,
        progress_callback: ProgressCallback | None = None,
    ) -> PhaseResult:
        """Execute a specific phase of the BMAD methodology.

        Delegates to the BMAD workflow integration for each phase.
        Emits ProgressEvents at phase start and end for frontend updates.

        Args:
            phase_id: ID of the phase to execute (analyze, prd, architecture,
                     epics, stories, dev, review)
            progress_callback: Optional callback invoked during execution for
                     incremental progress reporting

        Returns:
            PhaseResult indicating success/failure and any artifacts produced

        Raises:
            RuntimeError: If runner has not been initialized
        """
        self._ensure_initialized()

        # Store callback for use during phase execution
        self._current_progress_callback = progress_callback

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

    def _execute_phase_impl(self, phase_id: str) -> PhaseResult:
        """Dispatch to the appropriate phase implementation.

        Args:
            phase_id: ID of the phase to execute

        Returns:
            PhaseResult from the phase execution
        """
        dispatch = {
            "analyze": self._execute_analyze,
            "prd": self._execute_prd,
            "architecture": self._execute_architecture,
            "epics": self._execute_epics,
            "stories": self._execute_stories,
            "dev": self._execute_dev,
            "review": self._execute_review,
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
    # Phase Implementation Stubs
    # =========================================================================

    def _execute_analyze(self) -> PhaseResult:
        """Execute the project analysis phase.

        Analyzes the project structure and gathers context for subsequent phases.
        Produces analysis.json artifact in the task-scoped output directory.

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.2 - Implement BMAD Project Analysis Phase
        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        # Import here to avoid circular imports
        from apps.backend.methodologies.bmad.workflows.analysis import (
            analyze_project,
            load_analysis,
        )

        project_dir = Path(self._project_dir)

        # Check if output directory is configured
        if self._output_dir is None:
            return PhaseResult(
                success=False,
                phase_id="analyze",
                error="No output directory configured. Set spec_dir in task_config.metadata.",
            )

        # Check if analysis already exists
        self._invoke_progress_callback("Checking for existing analysis...", 5.0)
        existing = load_analysis(self._output_dir)
        if existing:
            analysis_file = self._output_dir / "analysis.json"
            self._invoke_progress_callback("Found existing analysis", 100.0)
            return PhaseResult(
                success=True,
                phase_id="analyze",
                message="Analysis already exists",
                artifacts=[str(analysis_file)],
                metadata={"project_name": existing.project_name},
            )

        # Run project analysis
        self._invoke_progress_callback("Starting project analysis...", 10.0)
        try:
            analysis = analyze_project(
                project_dir=project_dir,
                output_dir=self._output_dir,
                progress_callback=self._invoke_progress_callback,
            )

            analysis_file = self._output_dir / "analysis.json"
            if analysis_file.exists():
                return PhaseResult(
                    success=True,
                    phase_id="analyze",
                    message=f"Project analysis complete for '{analysis.project_name}'",
                    artifacts=[str(analysis_file)],
                    metadata={
                        "project_name": analysis.project_name,
                        "languages": analysis.tech_stack.languages,
                        "frameworks": analysis.tech_stack.frameworks,
                        "is_monorepo": analysis.structure.is_monorepo,
                        "bmad_config_exists": analysis.bmad_config.exists,
                    },
                )
            else:
                return PhaseResult(
                    success=False,
                    phase_id="analyze",
                    error="Analysis completed but artifact file was not created",
                )

        except Exception as e:
            logger.error(f"Project analysis failed: {e}")
            return PhaseResult(
                success=False,
                phase_id="analyze",
                error=f"Project analysis failed: {str(e)}",
            )

    def _execute_prd(self) -> PhaseResult:
        """Execute the PRD creation phase.

        Integrates with BMAD PRD workflow to create product requirements document.
        Produces prd.md artifact.

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.3 - Implement BMAD PRD Workflow Integration
        """
        # Import here to avoid circular imports
        from apps.backend.methodologies.bmad.workflows.prd import (
            create_prd,
            load_prd,
        )

        # Check if output directory is configured
        if self._output_dir is None:
            return PhaseResult(
                success=False,
                phase_id="prd",
                error="No output directory configured. Set spec_dir in task_config.metadata.",
            )

        # Check if PRD already exists
        self._invoke_progress_callback("Checking for existing PRD...", 5.0)
        existing = load_prd(self._output_dir)
        if existing:
            prd_file = self._output_dir / "prd.md"
            self._invoke_progress_callback("Found existing PRD", 100.0)
            return PhaseResult(
                success=True,
                phase_id="prd",
                message="PRD already exists",
                artifacts=[str(prd_file)],
                metadata={"project_name": existing.project_name},
            )

        # Get task description from task config if available
        task_description = ""
        if self._task_config:
            task_description = self._task_config.metadata.get("task_description", "")

        # Create PRD
        self._invoke_progress_callback("Creating PRD...", 10.0)
        try:
            prd = create_prd(
                output_dir=self._output_dir,
                spec_dir=self._spec_dir,
                task_description=task_description,
                progress_callback=self._invoke_progress_callback,
            )

            prd_file = self._output_dir / "prd.md"
            prd_json_file = self._output_dir / "prd.json"

            if prd_file.exists():
                return PhaseResult(
                    success=True,
                    phase_id="prd",
                    message=f"PRD created for '{prd.project_name}'",
                    artifacts=[str(prd_file), str(prd_json_file)],
                    metadata={
                        "project_name": prd.project_name,
                        "num_functional_requirements": len(prd.functional_requirements),
                        "num_non_functional_requirements": len(
                            prd.non_functional_requirements
                        ),
                        "prd_status": prd.metadata.status,
                    },
                )
            else:
                return PhaseResult(
                    success=False,
                    phase_id="prd",
                    error="PRD creation completed but artifact file was not created",
                )

        except Exception as e:
            logger.error(f"PRD creation failed: {e}")
            return PhaseResult(
                success=False,
                phase_id="prd",
                error=f"PRD creation failed: {str(e)}",
            )

    def _execute_architecture(self) -> PhaseResult:
        """Execute the architecture phase.

        Integrates with BMAD architecture workflow to create architecture document.
        Produces architecture.md artifact.

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.4 - Implement BMAD Architecture Workflow Integration
        """
        # TODO: Implement in Story 6.4
        return PhaseResult(
            success=False,
            phase_id="architecture",
            error="Architecture phase not yet implemented (Story 6.4)",
        )

    def _execute_epics(self) -> PhaseResult:
        """Execute the epic and story creation phase.

        Integrates with BMAD epics workflow to create epics and initial stories.
        Produces epics.md artifact.

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.5 - Implement BMAD Epic and Story Creation
        """
        # TODO: Implement in Story 6.5
        return PhaseResult(
            success=False,
            phase_id="epics",
            error="Epics phase not yet implemented (Story 6.5)",
        )

    def _execute_stories(self) -> PhaseResult:
        """Execute the story preparation phase.

        Prepares and refines stories for development.
        Produces stories/*.md artifacts.

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.5 - Implement BMAD Epic and Story Creation
        """
        # TODO: Implement in Story 6.5
        return PhaseResult(
            success=False,
            phase_id="stories",
            error="Stories phase not yet implemented (Story 6.5)",
        )

    def _execute_dev(self) -> PhaseResult:
        """Execute the development phase.

        Integrates with BMAD dev-story workflow for implementation.
        Produces implemented_code artifact.

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.6 - Implement BMAD Dev-Story Workflow Integration
        """
        # TODO: Implement in Story 6.6
        return PhaseResult(
            success=False,
            phase_id="dev",
            error="Dev phase not yet implemented (Story 6.6)",
        )

    def _execute_review(self) -> PhaseResult:
        """Execute the code review phase.

        Integrates with BMAD code-review workflow for code review.
        Produces review_report.md artifact.

        Returns:
            PhaseResult with success status and artifacts

        Story Reference: Story 6.7 - Implement BMAD Code Review Workflow Integration
        """
        # TODO: Implement in Story 6.7
        return PhaseResult(
            success=False,
            phase_id="review",
            error="Review phase not yet implemented (Story 6.7)",
        )

    # =========================================================================
    # Protocol Implementation
    # =========================================================================

    def get_checkpoints(self) -> list[Checkpoint]:
        """Return checkpoint definitions for Semi-Auto mode.

        Returns:
            List of Checkpoint objects defining pause points for user review

        Raises:
            RuntimeError: If runner has not been initialized
        """
        self._ensure_initialized()
        return self._checkpoints.copy()

    def get_artifacts(self) -> list[Artifact]:
        """Return artifact definitions produced by the BMAD methodology.

        Returns:
            List of Artifact objects defining methodology outputs

        Raises:
            RuntimeError: If runner has not been initialized
        """
        self._ensure_initialized()
        return self._artifacts.copy()

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
    # Story 6.9: Task-Scoped Output Directory Methods
    # =========================================================================

    def _init_output_dir(self) -> None:
        """Initialize the task-scoped output directory.

        Creates the BMAD output directory within the spec directory:
        `.auto-claude/specs/{task-id}/bmad/`

        This ensures artifacts from multiple parallel BMAD tasks don't conflict.

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._spec_dir is None:
            logger.warning(
                "No spec_dir configured. BMAD artifacts will not be task-scoped."
            )
            return

        self._output_dir = self._spec_dir / self.BMAD_OUTPUT_SUBDIR
        self._ensure_output_dir()

    def _ensure_output_dir(self) -> None:
        """Ensure the output directory exists.

        Creates the output directory and any necessary parent directories
        if they don't exist.

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._output_dir is not None:
            self._output_dir.mkdir(parents=True, exist_ok=True)
            logger.debug(f"BMAD output directory ready: {self._output_dir}")

    @property
    def output_dir(self) -> Path | None:
        """Get the task-scoped output directory for BMAD artifacts.

        Returns:
            Path to the output directory (`.auto-claude/specs/{task-id}/bmad/`),
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
            Path('.auto-claude/specs/139-task-name/bmad/prd.md')

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._output_dir is None:
            return None
        return self._output_dir / artifact_name

    def get_stories_dir(self) -> Path | None:
        """Get the stories subdirectory within the output directory.

        Creates the stories subdirectory if it doesn't exist.

        Returns:
            Path to the stories directory (`.auto-claude/specs/{task-id}/bmad/stories/`),
            or None if output directory is not configured.

        Story Reference: Story 6.9 - Task-Scoped Output Directories
        """
        if self._output_dir is None:
            return None

        stories_dir = self._output_dir / "stories"
        stories_dir.mkdir(parents=True, exist_ok=True)
        return stories_dir

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
        """Initialize phase definitions for the BMAD methodology."""
        self._phases = [
            Phase(
                id="analyze",
                name="Project Analysis",
                description="Analyze project structure and gather context",
                order=1,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="prd",
                name="PRD Creation",
                description="Create Product Requirements Document",
                order=2,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="architecture",
                name="Architecture",
                description="Design and document system architecture",
                order=3,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="epics",
                name="Epic & Story Creation",
                description="Create epics and break down into stories",
                order=4,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="stories",
                name="Story Preparation",
                description="Prepare and refine stories for development",
                order=5,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="dev",
                name="Development",
                description="Implement stories via dev-story workflow",
                order=6,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="review",
                name="Code Review",
                description="Review implementation via code-review workflow",
                order=7,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
        ]

    def _init_checkpoints(self) -> None:
        """Initialize checkpoint definitions for Semi-Auto mode."""
        self._checkpoints = [
            Checkpoint(
                id="after_prd",
                name="PRD Review",
                description="Review Product Requirements Document before architecture",
                phase_id="prd",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            Checkpoint(
                id="after_architecture",
                name="Architecture Review",
                description="Review architecture design before epic creation",
                phase_id="architecture",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            Checkpoint(
                id="after_epics",
                name="Epic Review",
                description="Review epics and stories before development",
                phase_id="epics",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            Checkpoint(
                id="after_story",
                name="Story Review",
                description="Review story implementation before continuing",
                phase_id="dev",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            Checkpoint(
                id="after_review",
                name="Final Review",
                description="Review code review results before completion",
                phase_id="review",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
        ]

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
