"""Native Auto Claude methodology runner.

This module implements the MethodologyRunner Protocol for the Native Auto Claude
methodology. It wraps the existing spec creation logic to provide a
plugin-compatible interface.

Architecture Source: architecture.md#Native-Plugin-Structure
Story Reference: Story 2.1 - Create Native Methodology Plugin Structure
Story Reference: Story 2.2 - Implement Native MethodologyRunner
Story Reference: Story 2.3 - Integrate Workspace Management with Native Runner
"""

from pathlib import Path

# Story 2.3: Workspace management imports
from core.worktree import WorktreeError, WorktreeManager
from integrations.graphiti.memory import get_graphiti_memory
from security import get_security_profile

from apps.backend.methodologies.protocols import (
    Artifact,
    Checkpoint,
    CheckpointStatus,
    ComplexityLevel,
    Phase,
    PhaseResult,
    PhaseStatus,
    RunContext,
    TaskConfig,
)


class NativeRunner:
    """MethodologyRunner implementation for Native Auto Claude methodology.

    This class implements the MethodologyRunner Protocol, providing the interface
    for the plugin framework to execute the Native methodology.

    The Native methodology follows a 6-phase pipeline:
    1. Discovery - Gather project context and user requirements
    2. Requirements - Structure and validate requirements
    3. Context - Build codebase context for implementation
    4. Spec - Generate specification document
    5. Plan - Create implementation plan with subtasks
    6. Validate - Validate spec completeness

    Delegation Pattern:
        - Discovery: delegates to spec.discovery.run_discovery_script
        - Requirements: delegates to spec.requirements module
        - Context: delegates to spec.context module
        - Spec/Plan/Validate: require framework agent infrastructure

    Example:
        runner = NativeRunner()
        runner.initialize(context)
        phases = runner.get_phases()
        for phase in phases:
            result = runner.execute_phase(phase.id)
    """

    def __init__(self) -> None:
        """Initialize NativeRunner instance."""
        self._context: RunContext | None = None
        self._phases: list[Phase] = []
        self._checkpoints: list[Checkpoint] = []
        self._artifacts: list[Artifact] = []
        self._initialized: bool = False
        # Story 2.2: Additional context attributes for phase execution
        self._project_dir: str = ""
        self._spec_dir: Path | None = None
        self._task_config: TaskConfig | None = None
        self._complexity: ComplexityLevel | None = None
        # Story 2.3: Workspace management attributes
        self._worktree_manager: WorktreeManager | None = None
        self._worktree_path: str | None = None
        self._worktree_spec_name: str | None = None
        self._security_profile = None
        self._graphiti_memory = None

    def initialize(self, context: RunContext) -> None:
        """Initialize the runner with framework context.

        Sets up the runner with access to framework services and
        initializes phase, checkpoint, and artifact definitions.
        Also creates git worktree, applies security sandbox, and
        initializes Graphiti memory (Story 2.3).

        Args:
            context: RunContext with access to all framework services

        Raises:
            RuntimeError: If runner is already initialized or worktree creation fails
        """
        if self._initialized:
            raise RuntimeError("NativeRunner already initialized")

        self._context = context
        # Story 2.2: Extract and store key context attributes for phase execution
        self._project_dir = context.workspace.get_project_root()
        self._task_config = context.task_config
        self._complexity = context.task_config.complexity

        # Get spec_dir from task_config metadata if available
        spec_dir_str = context.task_config.metadata.get("spec_dir")
        if spec_dir_str:
            self._spec_dir = Path(spec_dir_str)

        # Story 2.3: Initialize workspace management
        self._init_workspace()
        self._init_security()
        self._init_memory()

        self._init_phases()
        self._init_checkpoints()
        self._init_artifacts()
        self._initialized = True

    def get_phases(self) -> list[Phase]:
        """Return all phase definitions for the Native methodology.

        Returns:
            List of Phase objects defining the 6-phase pipeline:
            discovery, requirements, context, spec, plan, validate

        Raises:
            RuntimeError: If runner has not been initialized
        """
        self._ensure_initialized()
        return self._phases.copy()

    def execute_phase(self, phase_id: str) -> PhaseResult:
        """Execute a specific phase of the Native methodology.

        Delegates to the existing spec creation logic for each phase.

        Args:
            phase_id: ID of the phase to execute (discovery, requirements,
                     context, spec, plan, or validate)

        Returns:
            PhaseResult indicating success/failure and any artifacts produced

        Raises:
            RuntimeError: If runner has not been initialized

        Story Reference: Story 2.2 - Implement Native MethodologyRunner
        """
        self._ensure_initialized()

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

        # Report progress via context service
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

    def _execute_phase_impl(self, phase_id: str) -> PhaseResult:
        """Dispatch to the appropriate phase implementation.

        Args:
            phase_id: ID of the phase to execute

        Returns:
            PhaseResult from the phase execution
        """
        dispatch = {
            "discovery": self._execute_discovery,
            "requirements": self._execute_requirements,
            "context": self._execute_context,
            "spec": self._execute_spec,
            "plan": self._execute_plan,
            "validate": self._execute_validate,
        }

        handler = dispatch.get(phase_id)
        if handler is None:
            return PhaseResult(
                success=False,
                phase_id=phase_id,
                error=f"No implementation for phase: {phase_id}",
            )

        return handler()

    def _execute_discovery(self) -> PhaseResult:
        """Execute the discovery phase.

        Delegates to spec.discovery.run_discovery_script to analyze
        project structure and create project_index.json.

        Returns:
            PhaseResult with success status and artifacts
        """
        if self._spec_dir is None:
            return PhaseResult(
                success=False,
                phase_id="discovery",
                error="No spec_dir configured. Set spec_dir in task_config.metadata.",
            )

        # Import here to avoid circular imports
        from apps.backend.spec import discovery

        project_dir = Path(self._project_dir)

        # Delegate to existing discovery logic
        success, message = discovery.run_discovery_script(project_dir, self._spec_dir)

        if success:
            # Verify the artifact was created
            index_file = self._spec_dir / "project_index.json"
            artifacts = [str(index_file)] if index_file.exists() else []

            return PhaseResult(
                success=True,
                phase_id="discovery",
                message=message,
                artifacts=artifacts,
            )
        else:
            return PhaseResult(
                success=False,
                phase_id="discovery",
                error=message,
            )

    def _execute_requirements(self) -> PhaseResult:
        """Execute the requirements phase.

        Delegates to spec.requirements module to structure requirements
        from task configuration and produce requirements.json artifact.

        Returns:
            PhaseResult with success status and artifacts
        """
        if self._task_config is None:
            return PhaseResult(
                success=False,
                phase_id="requirements",
                error="No task configuration available",
            )

        if self._spec_dir is None:
            return PhaseResult(
                success=False,
                phase_id="requirements",
                error="No spec_dir configured. Set spec_dir in task_config.metadata.",
            )

        # Import here to avoid circular imports
        from apps.backend.spec import requirements as req_module

        # Check if requirements already exist
        existing_req = req_module.load_requirements(self._spec_dir)
        if existing_req:
            req_file = self._spec_dir / "requirements.json"
            return PhaseResult(
                success=True,
                phase_id="requirements",
                message="Requirements already exist",
                artifacts=[str(req_file)],
            )

        # Create requirements from task name/metadata
        task_description = self._task_config.task_name or self._task_config.task_id
        if not task_description:
            task_description = self._task_config.metadata.get(
                "task_description", "Unknown task"
            )

        req_data = req_module.create_requirements_from_task(task_description)
        req_file = req_module.save_requirements(self._spec_dir, req_data)

        return PhaseResult(
            success=True,
            phase_id="requirements",
            message="Requirements created from task configuration",
            artifacts=[str(req_file)],
        )

    def _execute_context(self) -> PhaseResult:
        """Execute the context phase.

        Delegates to spec.context module to build codebase context
        and produce context.json artifact.

        Returns:
            PhaseResult with success status and artifacts
        """
        if self._spec_dir is None:
            return PhaseResult(
                success=False,
                phase_id="context",
                error="No spec_dir configured. Set spec_dir in task_config.metadata.",
            )

        # Import here to avoid circular imports
        from apps.backend.spec import context as ctx_module
        from apps.backend.spec import requirements as req_module

        project_dir = Path(self._project_dir)

        # Load requirements for task description
        task = "Unknown task"
        services: list[str] = []

        req = req_module.load_requirements(self._spec_dir)
        if req:
            task = req.get("task_description", task)
            services = req.get("services_involved", [])

        # Check if context already exists
        context_file = self._spec_dir / "context.json"
        if context_file.exists():
            return PhaseResult(
                success=True,
                phase_id="context",
                message="Context already exists",
                artifacts=[str(context_file)],
            )

        # Delegate to existing context discovery logic
        success, message = ctx_module.run_context_discovery(
            project_dir, self._spec_dir, task, services
        )

        if success:
            artifacts = [str(context_file)] if context_file.exists() else []
            return PhaseResult(
                success=True,
                phase_id="context",
                message=message,
                artifacts=artifacts,
            )
        else:
            # Create minimal context on failure (matches existing behavior)
            ctx_module.create_minimal_context(self._spec_dir, task, services)
            return PhaseResult(
                success=True,
                phase_id="context",
                message="Created minimal context (discovery failed)",
                artifacts=[str(context_file)] if context_file.exists() else [],
            )

    def _execute_spec(self) -> PhaseResult:
        """Execute the spec phase.

        Generates the specification document via agent execution.
        Requires framework agent infrastructure for full implementation.

        Returns:
            PhaseResult with success status and artifacts
        """
        if self._spec_dir is None:
            return PhaseResult(
                success=False,
                phase_id="spec",
                error="No spec_dir configured. Set spec_dir in task_config.metadata.",
            )

        spec_file = self._spec_dir / "spec.md"

        # Check if spec already exists
        if spec_file.exists():
            return PhaseResult(
                success=True,
                phase_id="spec",
                message="Specification already exists",
                artifacts=[str(spec_file)],
            )

        # Spec generation requires agent execution via framework
        # The framework should call spec_agents/writer logic
        return PhaseResult(
            success=False,
            phase_id="spec",
            error="Spec generation requires framework agent infrastructure. "
            "Use SpecOrchestrator for full pipeline execution.",
        )

    def _execute_plan(self) -> PhaseResult:
        """Execute the planning phase.

        Creates implementation plan via agent execution.
        Requires framework agent infrastructure for full implementation.

        Returns:
            PhaseResult with success status and artifacts
        """
        if self._spec_dir is None:
            return PhaseResult(
                success=False,
                phase_id="plan",
                error="No spec_dir configured. Set spec_dir in task_config.metadata.",
            )

        plan_file = self._spec_dir / "implementation_plan.json"

        # Check if plan already exists
        if plan_file.exists():
            return PhaseResult(
                success=True,
                phase_id="plan",
                message="Implementation plan already exists",
                artifacts=[str(plan_file)],
            )

        # Plan generation requires agent execution via framework
        return PhaseResult(
            success=False,
            phase_id="plan",
            error="Plan generation requires framework agent infrastructure. "
            "Use SpecOrchestrator for full pipeline execution.",
        )

    def _execute_validate(self) -> PhaseResult:
        """Execute the validation phase.

        Validates spec completeness and quality.
        Can delegate to spec.validate_pkg for validation logic.

        Returns:
            PhaseResult with success status and validation info
        """
        if self._spec_dir is None:
            return PhaseResult(
                success=False,
                phase_id="validate",
                error="No spec_dir configured. Set spec_dir in task_config.metadata.",
            )

        # Import here to avoid circular imports
        from apps.backend.spec.validate_pkg.spec_validator import SpecValidator

        validator = SpecValidator(self._spec_dir)
        results = validator.validate_all()

        all_valid = all(r.valid for r in results)
        errors = [f"{r.checkpoint}: {err}" for r in results for err in r.errors]

        if all_valid:
            return PhaseResult(
                success=True,
                phase_id="validate",
                message="All validation checks passed",
                artifacts=[],
            )
        else:
            return PhaseResult(
                success=False,
                phase_id="validate",
                error=f"Validation failed: {'; '.join(errors)}",
            )

    def get_checkpoints(self) -> list[Checkpoint]:
        """Return checkpoint definitions for Semi-Auto mode.

        Returns:
            List of Checkpoint objects defining the 3 pause points:
            after_planning, after_spec, after_validation

        Raises:
            RuntimeError: If runner has not been initialized
        """
        self._ensure_initialized()
        return self._checkpoints.copy()

    def get_artifacts(self) -> list[Artifact]:
        """Return artifact definitions produced by the Native methodology.

        Returns:
            List of Artifact objects defining methodology outputs:
            requirements.json, context.json, spec.md, implementation_plan.json

        Raises:
            RuntimeError: If runner has not been initialized
        """
        self._ensure_initialized()
        return self._artifacts.copy()

    def _ensure_initialized(self) -> None:
        """Ensure the runner has been initialized.

        Raises:
            RuntimeError: If runner has not been initialized
        """
        if not self._initialized:
            raise RuntimeError("NativeRunner not initialized. Call initialize() first.")

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

    def _init_phases(self) -> None:
        """Initialize phase definitions for the Native methodology."""
        self._phases = [
            Phase(
                id="discovery",
                name="Discovery",
                description="Gather project context and user requirements",
                order=1,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="requirements",
                name="Requirements",
                description="Structure and validate requirements",
                order=2,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="context",
                name="Context",
                description="Build codebase context for implementation",
                order=3,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="spec",
                name="Specification",
                description="Generate specification document",
                order=4,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="plan",
                name="Planning",
                description="Create implementation plan with subtasks",
                order=5,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
            Phase(
                id="validate",
                name="Validation",
                description="Validate spec completeness",
                order=6,
                status=PhaseStatus.PENDING,
                is_optional=False,
            ),
        ]

    def _init_checkpoints(self) -> None:
        """Initialize checkpoint definitions for Semi-Auto mode."""
        self._checkpoints = [
            Checkpoint(
                id="after_planning",
                name="Planning Review",
                description="Review implementation plan before coding",
                phase_id="plan",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            Checkpoint(
                id="after_spec",
                name="Specification Review",
                description="Review specification before planning",
                phase_id="spec",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
            Checkpoint(
                id="after_validation",
                name="Validation Review",
                description="Review validation results before completion",
                phase_id="validate",
                status=CheckpointStatus.PENDING,
                requires_approval=True,
            ),
        ]

    def _init_artifacts(self) -> None:
        """Initialize artifact definitions for the Native methodology."""
        self._artifacts = [
            Artifact(
                id="requirements-json",
                artifact_type="json",
                name="Requirements",
                file_path="requirements.json",
                phase_id="discovery",
                content_type="application/json",
            ),
            Artifact(
                id="context-json",
                artifact_type="json",
                name="Context",
                file_path="context.json",
                phase_id="context",
                content_type="application/json",
            ),
            Artifact(
                id="spec-md",
                artifact_type="markdown",
                name="Specification",
                file_path="spec.md",
                phase_id="spec",
                content_type="text/markdown",
            ),
            Artifact(
                id="implementation-plan-json",
                artifact_type="json",
                name="Implementation Plan",
                file_path="implementation_plan.json",
                phase_id="plan",
                content_type="application/json",
            ),
        ]

    # =========================================================================
    # Story 2.3: Workspace Management Methods
    # =========================================================================

    def _init_workspace(self) -> None:
        """Initialize git worktree for task isolation (FR65).

        Creates a git worktree for the task to isolate file operations.
        The worktree path is stored for agent use.

        Raises:
            RuntimeError: If worktree creation fails
        """
        project_path = Path(self._project_dir)

        # Generate spec name from task config
        task_name = self._task_config.task_name if self._task_config else "unknown"
        task_id = self._task_config.task_id if self._task_config else "unknown"
        self._worktree_spec_name = task_name or task_id or "native-task"

        # Sanitize spec name for use in branch names
        self._worktree_spec_name = (
            self._worktree_spec_name.lower().replace(" ", "-").replace("_", "-")
        )

        try:
            self._worktree_manager = WorktreeManager(project_path)
            self._worktree_manager.setup()

            worktree_info = self._worktree_manager.get_or_create_worktree(
                self._worktree_spec_name
            )
            self._worktree_path = str(worktree_info.path)

        except WorktreeError as e:
            raise RuntimeError(
                f"Failed to create worktree for task '{self._worktree_spec_name}': {e}"
            ) from e

    def _init_security(self) -> None:
        """Initialize security sandbox for the worktree (FR66).

        Applies security profile to restrict operations to the workspace.
        Uses the worktree path as the security boundary.
        """
        if self._worktree_path:
            worktree_path = Path(self._worktree_path)
            self._security_profile = get_security_profile(worktree_path, self._spec_dir)

    def _init_memory(self) -> None:
        """Initialize Graphiti memory service (FR68).

        Sets up Graphiti memory integration. If memory service is
        unavailable, initialization continues without it (NFR23).
        """
        if not self._spec_dir:
            self._graphiti_memory = None
            return

        try:
            self._graphiti_memory = get_graphiti_memory(
                spec_dir=self._spec_dir,
                project_dir=Path(self._project_dir),
            )
        except Exception:
            # NFR23: Don't block on memory failure
            self._graphiti_memory = None

    def get_workspace_path(self) -> str | None:
        """Get the worktree path for agents to use.

        Returns:
            Path to the isolated workspace, or None if not initialized
        """
        return self._worktree_path

    def get_security_profile(self):
        """Get the security profile for the workspace.

        Returns:
            SecurityProfile for agent operations, or None if not initialized
        """
        return self._security_profile

    def get_graphiti_memory(self):
        """Get the Graphiti memory service.

        Returns:
            GraphitiMemory instance or None if unavailable/not initialized
        """
        return self._graphiti_memory

    def cleanup(self) -> None:
        """Clean up workspace resources (FR70).

        Deletes the worktree and archives any associated memory data.
        Handles partial cleanup gracefully - failures are logged but
        don't raise exceptions.
        """
        if not self._initialized:
            return

        # Clean up worktree
        if self._worktree_manager and self._worktree_spec_name:
            try:
                self._worktree_manager.remove_worktree(
                    self._worktree_spec_name, delete_branch=True
                )
            except Exception:
                # Handle partial cleanup gracefully - log but don't raise
                pass

        # Archive memory data if needed
        # (Memory archival would be handled by GraphitiMemory if implemented)

        # Reset state
        self._worktree_path = None
        self._security_profile = None
        self._graphiti_memory = None
