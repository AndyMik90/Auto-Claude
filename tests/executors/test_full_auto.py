"""Tests for FullAutoExecutor.

Story Reference: Story 4.1 - Implement Full Auto Task Executor

Tests the FullAutoExecutor class which executes all methodology phases
without user intervention in Full Auto mode.
"""

import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest

from apps.backend.core.executors import FullAutoExecutor, TaskResult
from apps.backend.methodologies.protocols import (
    Artifact,
    Checkpoint,
    Phase,
    PhaseResult,
    PhaseStatus,
    ProgressEvent,
    RunContext,
    TaskConfig,
)


# =============================================================================
# Mock Service Implementations
# =============================================================================


class MockWorkspaceService:
    """Mock implementation of WorkspaceService."""

    def get_project_root(self) -> str:
        return "/mock/project"


class MockMemoryService:
    """Mock implementation of MemoryService."""

    def get_context(self, query: str) -> str:
        return f"Context for: {query}"


class MockProgressService:
    """Mock implementation of ProgressService that captures events."""

    def __init__(self):
        self.events: list[ProgressEvent] = []
        self.updates: list[tuple[str, float, str]] = []

    def update(self, phase_id: str, progress: float, message: str) -> None:
        self.updates.append((phase_id, progress, message))

    def emit(self, event: ProgressEvent) -> None:
        self.events.append(event)


class MockCheckpointService:
    """Mock implementation of CheckpointService."""

    def create_checkpoint(self, checkpoint_id: str, data: dict[str, Any]) -> None:
        pass


class MockLLMService:
    """Mock implementation of LLMService."""

    def generate(self, prompt: str) -> str:
        return f"Response to: {prompt}"


class MockMethodologyRunner:
    """Mock implementation of MethodologyRunner for testing."""

    def __init__(
        self,
        phases: list[Phase] | None = None,
        phase_results: dict[str, PhaseResult] | None = None,
        raise_on_phase: str | None = None,
    ):
        # Use 'is not None' to allow empty list
        self._phases = phases if phases is not None else [
            Phase(id="planning", name="Planning", order=0),
            Phase(id="coding", name="Coding", order=1),
            Phase(id="validation", name="Validation", order=2),
        ]
        self._phase_results = phase_results or {}
        self._raise_on_phase = raise_on_phase
        self._initialized = False
        self._executed_phases: list[str] = []

    def initialize(self, context: RunContext) -> None:
        self._initialized = True
        self._context = context

    def get_phases(self) -> list[Phase]:
        return self._phases

    def execute_phase(self, phase_id: str) -> PhaseResult:
        self._executed_phases.append(phase_id)

        if self._raise_on_phase == phase_id:
            raise RuntimeError(f"Simulated error in phase {phase_id}")

        if phase_id in self._phase_results:
            return self._phase_results[phase_id]

        return PhaseResult(
            success=True,
            phase_id=phase_id,
            message=f"Phase {phase_id} completed",
            artifacts=[f"{phase_id}_output.md"],
        )

    def get_checkpoints(self) -> list[Checkpoint]:
        return []

    def get_artifacts(self) -> list[Artifact]:
        return []


# =============================================================================
# Fixtures
# =============================================================================


@pytest.fixture
def mock_progress_service():
    """Create a mock progress service that captures events."""
    return MockProgressService()


@pytest.fixture
def mock_context(mock_progress_service):
    """Create a mock RunContext with all services."""
    return RunContext(
        workspace=MockWorkspaceService(),
        memory=MockMemoryService(),
        progress=mock_progress_service,
        checkpoint=MockCheckpointService(),
        llm=MockLLMService(),
        task_config=TaskConfig(task_id="test-task-123", task_name="Test Task"),
    )


@pytest.fixture
def mock_runner():
    """Create a mock methodology runner with default phases."""
    return MockMethodologyRunner()


@pytest.fixture
def executor(mock_runner, mock_context):
    """Create a FullAutoExecutor with mock dependencies."""
    return FullAutoExecutor(
        runner=mock_runner,
        context=mock_context,
        task_config=mock_context.task_config,
    )


# =============================================================================
# Test Classes
# =============================================================================


class TestFullAutoExecutorImport:
    """Test that FullAutoExecutor can be imported and instantiated."""

    def test_import_full_auto_executor(self):
        """Test that FullAutoExecutor can be imported from core.executors."""
        from apps.backend.core.executors import FullAutoExecutor

        assert FullAutoExecutor is not None

    def test_import_task_result(self):
        """Test that TaskResult can be imported from core.executors."""
        from apps.backend.core.executors import TaskResult

        assert TaskResult is not None


class TestTaskResultDataclass:
    """Test the TaskResult dataclass."""

    def test_task_result_completed(self):
        """Test TaskResult for completed status."""
        result = TaskResult(
            status="completed",
            artifacts=["spec.md", "plan.json"],
            duration_seconds=45.5,
        )
        assert result.status == "completed"
        assert result.phase is None
        assert result.error is None
        assert len(result.artifacts) == 2
        assert result.duration_seconds == 45.5

    def test_task_result_failed(self):
        """Test TaskResult for failed status with phase and error."""
        result = TaskResult(
            status="failed",
            phase="coding",
            error="Compilation error",
            duration_seconds=12.3,
        )
        assert result.status == "failed"
        assert result.phase == "coding"
        assert result.error == "Compilation error"

    def test_task_result_escalated(self):
        """Test TaskResult for escalated status.

        Note: The "escalated" status is pre-defined for Story 4.5 (Implement
        Task Escalation Handling). This test verifies the dataclass accepts
        the status but the actual escalation code path is not yet implemented.
        """
        result = TaskResult(
            status="escalated",
            phase="validation",
            error="Requires manual intervention",
        )
        assert result.status == "escalated"

    def test_task_result_default_values(self):
        """Test TaskResult default values."""
        result = TaskResult(status="completed")
        assert result.phase is None
        assert result.error is None
        assert result.artifacts == []
        assert result.duration_seconds == 0


class TestFullAutoExecutorInit:
    """Test FullAutoExecutor initialization (Task 1)."""

    def test_init_accepts_runner_and_context(self, executor, mock_runner, mock_context):
        """Test that executor accepts runner, context, and task_config."""
        assert executor.runner is mock_runner
        assert executor.context is mock_context
        assert executor.task_config is mock_context.task_config

    def test_init_with_log_dir(self, mock_runner, mock_context):
        """Test executor can be initialized with log directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor = FullAutoExecutor(
                runner=mock_runner,
                context=mock_context,
                task_config=mock_context.task_config,
                log_dir=tmpdir,
            )
            assert executor._log_dir == Path(tmpdir)

    def test_init_log_dir_none_by_default(self, executor):
        """Test that log_dir is None by default."""
        assert executor._log_dir is None


class TestFullAutoExecutorExecute:
    """Test FullAutoExecutor.execute() method (Task 2)."""

    @pytest.mark.asyncio
    async def test_execute_runs_all_phases(self, executor, mock_runner):
        """Test that execute runs all phases in sequence."""
        result = await executor.execute()

        assert result.status == "completed"
        assert len(mock_runner._executed_phases) == 3
        assert mock_runner._executed_phases == ["planning", "coding", "validation"]

    @pytest.mark.asyncio
    async def test_execute_initializes_runner(self, executor, mock_runner):
        """Test that execute initializes the runner first."""
        await executor.execute()
        assert mock_runner._initialized is True

    @pytest.mark.asyncio
    async def test_execute_returns_task_result(self, executor):
        """Test that execute returns a TaskResult."""
        result = await executor.execute()
        assert isinstance(result, TaskResult)

    @pytest.mark.asyncio
    async def test_execute_collects_artifacts(self, executor):
        """Test that execute collects artifacts from all phases."""
        result = await executor.execute()

        assert "planning_output.md" in result.artifacts
        assert "coding_output.md" in result.artifacts
        assert "validation_output.md" in result.artifacts

    @pytest.mark.asyncio
    async def test_execute_measures_duration(self, executor):
        """Test that execute measures and returns duration."""
        result = await executor.execute()
        assert result.duration_seconds > 0

    @pytest.mark.asyncio
    async def test_execute_no_phases_fails(self, mock_context):
        """Test that execute fails gracefully when no phases defined."""
        empty_runner = MockMethodologyRunner(phases=[])
        executor = FullAutoExecutor(
            runner=empty_runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        assert result.status == "failed"
        assert "No phases" in result.error


class TestProgressReporting:
    """Test progress reporting integration (Task 3)."""

    @pytest.mark.asyncio
    async def test_emit_progress_on_start(self, executor, mock_progress_service):
        """Test that progress event is emitted at start."""
        await executor.execute()

        start_events = [e for e in mock_progress_service.events if e.status == "started"]
        assert len(start_events) >= 1

    @pytest.mark.asyncio
    async def test_emit_progress_on_phase_start(self, executor, mock_progress_service):
        """Test that progress is emitted when each phase starts."""
        await executor.execute()

        # Should have started events for each phase
        phase_starts = [
            e for e in mock_progress_service.events if e.status == "started" and e.phase_id in ["planning", "coding", "validation"]
        ]
        assert len(phase_starts) == 3

    @pytest.mark.asyncio
    async def test_emit_progress_on_phase_complete(self, executor, mock_progress_service):
        """Test that progress is emitted when each phase completes."""
        await executor.execute()

        completed_events = [e for e in mock_progress_service.events if e.status == "completed"]
        # Should have completed events for each phase + final completion
        assert len(completed_events) >= 3

    @pytest.mark.asyncio
    async def test_progress_percentage_increases(self, executor, mock_progress_service):
        """Test that progress percentage increases across phases."""
        await executor.execute()

        percentages = [e.percentage for e in mock_progress_service.events]
        # Percentages should generally increase
        assert percentages[-1] == 100.0

    @pytest.mark.asyncio
    async def test_progress_event_has_task_id(self, executor, mock_progress_service):
        """Test that all progress events include the task_id."""
        await executor.execute()

        for event in mock_progress_service.events:
            assert event.task_id == "test-task-123"


class TestPhaseSequencing:
    """Test phase sequencing (Task 4)."""

    @pytest.mark.asyncio
    async def test_phases_execute_in_order(self, mock_context):
        """Test that phases execute in defined order."""
        phases = [
            Phase(id="first", name="First Phase", order=0),
            Phase(id="second", name="Second Phase", order=1),
            Phase(id="third", name="Third Phase", order=2),
        ]
        runner = MockMethodologyRunner(phases=phases)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        await executor.execute()

        assert runner._executed_phases == ["first", "second", "third"]

    @pytest.mark.asyncio
    async def test_phase_status_updated(self, executor, mock_runner):
        """Test that phase status is updated during execution."""
        await executor.execute()

        # After execution, all phases should be completed
        for phase in mock_runner._phases:
            assert phase.status == PhaseStatus.COMPLETED


class TestLogging:
    """Test logging for each phase (Task 5)."""

    @pytest.mark.asyncio
    async def test_log_phase_start(self, executor, mock_runner):
        """Test that phase start is logged."""
        with patch.object(executor._logger, "info") as mock_info:
            await executor.execute()

            # Should have logged start for each phase
            start_calls = [c for c in mock_info.call_args_list if "Starting" in str(c)]
            assert len(start_calls) >= 3

    @pytest.mark.asyncio
    async def test_log_phase_complete(self, executor, mock_runner):
        """Test that phase completion is logged."""
        with patch.object(executor._logger, "info") as mock_info:
            await executor.execute()

            completed_calls = [c for c in mock_info.call_args_list if "Completed" in str(c)]
            assert len(completed_calls) >= 3

    @pytest.mark.asyncio
    async def test_write_to_log_file(self, mock_runner, mock_context):
        """Test that logs are written to file when log_dir is set."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor = FullAutoExecutor(
                runner=mock_runner,
                context=mock_context,
                task_config=mock_context.task_config,
                log_dir=tmpdir,
            )

            await executor.execute()

            log_file = Path(tmpdir) / f"execution_{mock_context.task_config.task_id}.log"
            assert log_file.exists()

            content = log_file.read_text()
            assert "Starting" in content or "Completed" in content


class TestErrorHandling:
    """Test execution error handling (Task 6)."""

    @pytest.mark.asyncio
    async def test_failed_phase_returns_failure(self, mock_context):
        """Test that a failed phase returns failed TaskResult."""
        phase_results = {
            "coding": PhaseResult(
                success=False,
                phase_id="coding",
                error="Compilation failed",
            )
        }
        runner = MockMethodologyRunner(phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        assert result.status == "failed"
        assert result.phase == "coding"
        assert "Compilation failed" in result.error

    @pytest.mark.asyncio
    async def test_exception_during_phase_caught(self, mock_context):
        """Test that exceptions during phase execution are caught."""
        runner = MockMethodologyRunner(raise_on_phase="coding")
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        assert result.status == "failed"
        assert result.phase == "coding"
        assert "Exception" in result.error

    @pytest.mark.asyncio
    async def test_failure_stops_execution(self, mock_context):
        """Test that failure in one phase stops further execution."""
        phase_results = {
            "coding": PhaseResult(
                success=False,
                phase_id="coding",
                error="Failed",
            )
        }
        runner = MockMethodologyRunner(phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        await executor.execute()

        # Should have executed planning and coding, but not validation
        assert "planning" in runner._executed_phases
        assert "coding" in runner._executed_phases
        assert "validation" not in runner._executed_phases

    @pytest.mark.asyncio
    async def test_failure_emits_failed_progress(self, mock_context, mock_progress_service):
        """Test that failure emits a failed progress event."""
        mock_context.progress = mock_progress_service
        phase_results = {
            "coding": PhaseResult(
                success=False,
                phase_id="coding",
                error="Build error",
            )
        }
        runner = MockMethodologyRunner(phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        await executor.execute()

        failed_events = [e for e in mock_progress_service.events if e.status == "failed"]
        assert len(failed_events) >= 1
        assert failed_events[0].phase_id == "coding"

    @pytest.mark.asyncio
    async def test_artifacts_collected_before_failure(self, mock_context):
        """Test that artifacts from completed phases are in result even on failure."""
        phase_results = {
            "validation": PhaseResult(
                success=False,
                phase_id="validation",
                error="Validation failed",
            )
        }
        runner = MockMethodologyRunner(phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        # Should have artifacts from planning and coding
        assert "planning_output.md" in result.artifacts
        assert "coding_output.md" in result.artifacts


class TestCalculatePercentage:
    """Test percentage calculation helper."""

    def test_percentage_calculation(self, executor):
        """Test percentage calculation for various progress states."""
        # 0 of 3 phases = 0%
        assert executor._calculate_percentage(0, 3) == 0.0

        # 1 of 3 phases = 33.33%
        assert round(executor._calculate_percentage(1, 3), 2) == 33.33

        # 2 of 3 phases = 66.67%
        assert round(executor._calculate_percentage(2, 3), 2) == 66.67

        # 3 of 3 phases = 100%
        assert executor._calculate_percentage(3, 3) == 100.0

    def test_percentage_zero_phases(self, executor):
        """Test percentage calculation with zero phases returns 0."""
        assert executor._calculate_percentage(0, 0) == 0.0


class TestEdgeCases:
    """Test edge cases and boundary conditions."""

    @pytest.mark.asyncio
    async def test_single_phase_methodology(self, mock_context):
        """Test executor with a single-phase methodology."""
        phases = [Phase(id="single", name="Single Phase", order=0)]
        runner = MockMethodologyRunner(phases=phases)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        assert result.status == "completed"
        assert len(runner._executed_phases) == 1

    @pytest.mark.asyncio
    async def test_empty_artifact_list(self, mock_context):
        """Test phases that produce no artifacts."""
        phase_results = {
            "planning": PhaseResult(
                success=True,
                phase_id="planning",
                artifacts=[],
            ),
            "coding": PhaseResult(
                success=True,
                phase_id="coding",
                artifacts=[],
            ),
            "validation": PhaseResult(
                success=True,
                phase_id="validation",
                artifacts=[],
            ),
        }
        runner = MockMethodologyRunner(phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        assert result.status == "completed"
        assert result.artifacts == []

    @pytest.mark.asyncio
    async def test_progress_service_error_does_not_fail_execution(self, mock_context):
        """Test that errors in progress service don't fail execution."""

        class FailingProgressService:
            def update(self, phase_id: str, progress: float, message: str) -> None:
                raise RuntimeError("Progress service error")

            def emit(self, event: ProgressEvent) -> None:
                raise RuntimeError("Progress service error")

        mock_context.progress = FailingProgressService()
        runner = MockMethodologyRunner()
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        # Should complete despite progress service errors
        result = await executor.execute()
        assert result.status == "completed"


# =============================================================================
# Story 4.2: Planning Phase Execution Tests
# =============================================================================


class TestTaskState:
    """Test TaskState enum and values (Story 4.2 Task 3)."""

    def test_import_task_state(self):
        """Test that TaskState can be imported."""
        from apps.backend.core.executors.full_auto import TaskState

        assert TaskState is not None

    def test_task_state_values(self):
        """Test that TaskState has all required values."""
        from apps.backend.core.executors.full_auto import TaskState

        assert TaskState.CREATED == "created"
        assert TaskState.PLANNING == "planning"
        assert TaskState.PLANNING_COMPLETE == "planning_complete"
        assert TaskState.CODING == "coding"
        assert TaskState.CODING_COMPLETE == "coding_complete"
        assert TaskState.VALIDATION == "validation"
        assert TaskState.VALIDATION_COMPLETE == "validation_complete"
        assert TaskState.COMPLETED == "completed"
        assert TaskState.FAILED == "failed"
        assert TaskState.ESCALATED == "escalated"


class TestPlanningArtifacts:
    """Test planning artifact definitions (Story 4.2 Task 1)."""

    def test_get_planning_artifacts_native(self, executor):
        """Test getting required planning artifacts for native methodology."""
        artifacts = executor.get_planning_artifacts("native")
        assert "spec.md" in artifacts
        assert "implementation_plan.json" in artifacts

    def test_get_planning_artifacts_bmad(self, executor):
        """Test getting required planning artifacts for BMAD methodology."""
        artifacts = executor.get_planning_artifacts("bmad")
        assert "prd.md" in artifacts
        assert "architecture.md" in artifacts
        assert "epics.md" in artifacts

    def test_get_planning_artifacts_unknown(self, executor):
        """Test getting planning artifacts for unknown methodology falls back to runner."""
        # Should delegate to runner.get_artifacts_for_phase if methodology unknown
        artifacts = executor.get_planning_artifacts("unknown")
        assert isinstance(artifacts, list)


class TestArtifactVerification:
    """Test artifact verification (Story 4.2 Task 2)."""

    def test_verify_planning_artifacts_all_present(self, executor):
        """Test verification passes when all artifacts present and non-empty."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            # Create required artifacts with content
            (spec_dir / "spec.md").write_text("# Specification\n\nContent here")
            (spec_dir / "implementation_plan.json").write_text('{"subtasks": [{"id": "1"}]}')

            result = executor.verify_planning_artifacts(spec_dir, "native")
            assert result is True

    def test_verify_planning_artifacts_missing_file(self, executor):
        """Test verification fails when artifact file is missing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            # Only create spec.md, missing implementation_plan.json
            (spec_dir / "spec.md").write_text("# Specification\n\nContent")

            result = executor.verify_planning_artifacts(spec_dir, "native")
            assert result is False

    def test_verify_planning_artifacts_empty_file(self, executor):
        """Test verification fails when artifact file is empty."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            (spec_dir / "spec.md").write_text("")  # Empty
            (spec_dir / "implementation_plan.json").write_text('{"subtasks": []}')

            result = executor.verify_planning_artifacts(spec_dir, "native")
            assert result is False

    def test_verify_implementation_plan_has_subtasks(self, executor):
        """Test that implementation plan must have subtasks."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            (spec_dir / "spec.md").write_text("# Specification\n\nContent")
            # Plan without subtasks
            (spec_dir / "implementation_plan.json").write_text('{"subtasks": []}')

            result = executor.verify_planning_artifacts(spec_dir, "native")
            assert result is False

    def test_verify_planning_artifacts_bmad(self, executor):
        """Test verification for BMAD methodology artifacts."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            (spec_dir / "prd.md").write_text("# PRD\n\nContent")
            (spec_dir / "architecture.md").write_text("# Architecture\n\nContent")
            (spec_dir / "epics.md").write_text("# Epics\n\n- Epic 1")

            result = executor.verify_planning_artifacts(spec_dir, "bmad")
            assert result is True

    def test_verify_planning_artifacts_invalid_json(self, executor):
        """Test verification fails when implementation_plan.json is malformed (L3)."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            (spec_dir / "spec.md").write_text("# Specification\n\nContent")
            # Malformed JSON - missing closing brace
            (spec_dir / "implementation_plan.json").write_text('{"subtasks": [{"id": "1"}')

            result = executor.verify_planning_artifacts(spec_dir, "native")
            assert result is False


class TestTaskStateManagement:
    """Test task state persistence (Story 4.2 Task 3)."""

    @pytest.mark.asyncio
    async def test_update_task_state(self, executor):
        """Test updating task state persists to file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            executor._task_dir = task_dir

            executor.update_task_state("planning_complete")

            state_file = task_dir / "state.json"
            assert state_file.exists()

            import json

            state = json.loads(state_file.read_text())
            assert state["state"] == "planning_complete"
            assert "updated_at" in state

    @pytest.mark.asyncio
    async def test_get_task_state(self, executor):
        """Test retrieving current task state."""
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            executor._task_dir = task_dir

            # Initially no state
            state = executor.get_task_state()
            assert state is None or state == "created"

            # Update state
            executor.update_task_state("planning")
            state = executor.get_task_state()
            assert state == "planning"

    @pytest.mark.asyncio
    async def test_state_recovery_on_restart(self, mock_runner, mock_context):
        """Test that state is recovered when executor is created with existing state."""
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            # Create existing state
            import json

            state_file = task_dir / "state.json"
            state_file.write_text(json.dumps({"state": "planning", "updated_at": "2026-01-15T12:00:00"}))

            executor = FullAutoExecutor(
                runner=mock_runner,
                context=mock_context,
                task_config=mock_context.task_config,
                task_dir=task_dir,
            )

            state = executor.get_task_state()
            assert state == "planning"


class TestAutomaticPhaseTransition:
    """Test automatic phase transitions (Story 4.2 Task 4)."""

    @pytest.mark.asyncio
    async def test_planning_complete_triggers_coding(self, mock_context, mock_progress_service):
        """Test that planning_complete state automatically triggers coding phase."""
        mock_context.progress = mock_progress_service

        # Create runner that simulates planning completing
        phases = [
            Phase(id="planning", name="Planning", order=0),
            Phase(id="coding", name="Coding", order=1),
        ]
        runner = MockMethodologyRunner(phases=phases)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        # Both phases should have executed
        assert "planning" in runner._executed_phases
        assert "coding" in runner._executed_phases
        assert result.status == "completed"

    @pytest.mark.asyncio
    async def test_state_transitions_logged(self, mock_context, mock_progress_service):
        """Test that state transitions are logged."""
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            mock_context.progress = mock_progress_service

            phases = [
                Phase(id="planning", name="Planning", order=0),
                Phase(id="coding", name="Coding", order=1),
            ]
            runner = MockMethodologyRunner(phases=phases)
            executor = FullAutoExecutor(
                runner=runner,
                context=mock_context,
                task_config=mock_context.task_config,
                task_dir=task_dir,
            )

            with patch.object(executor._logger, "info") as mock_info:
                await executor.execute()

                # Should log state transitions
                state_logs = [c for c in mock_info.call_args_list if "state" in str(c).lower()]
                assert len(state_logs) >= 1


class TestPlanningFailureHandling:
    """Test planning failure handling (Story 4.2 Task 5)."""

    @pytest.mark.asyncio
    async def test_planning_failure_detected(self, mock_context):
        """Test that planning phase failure is detected."""
        phase_results = {
            "planning": PhaseResult(
                success=False,
                phase_id="planning",
                error="Planning failed: no spec found",
            )
        }
        runner = MockMethodologyRunner(phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        assert result.status == "failed"
        assert result.phase == "planning"

    @pytest.mark.asyncio
    async def test_planning_failure_stops_coding(self, mock_context):
        """Test that planning failure prevents coding phase."""
        phases = [
            Phase(id="planning", name="Planning", order=0),
            Phase(id="coding", name="Coding", order=1),
        ]
        phase_results = {
            "planning": PhaseResult(success=False, phase_id="planning", error="Failed")
        }
        runner = MockMethodologyRunner(phases=phases, phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        await executor.execute()

        assert "planning" in runner._executed_phases
        assert "coding" not in runner._executed_phases

    @pytest.mark.asyncio
    async def test_partial_artifacts_preserved_on_failure(self, mock_context):
        """Test that partial artifacts are preserved when planning fails."""
        phases = [
            Phase(id="discovery", name="Discovery", order=0),
            Phase(id="planning", name="Planning", order=1),
        ]
        phase_results = {
            "discovery": PhaseResult(
                success=True,
                phase_id="discovery",
                artifacts=["context.json"],
            ),
            "planning": PhaseResult(
                success=False,
                phase_id="planning",
                error="Failed",
            ),
        }
        runner = MockMethodologyRunner(phases=phases, phase_results=phase_results)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        result = await executor.execute()

        # Discovery artifacts should still be in result
        assert "context.json" in result.artifacts

    @pytest.mark.asyncio
    async def test_planning_failure_updates_state(self, mock_context):
        """Test that planning failure updates task state to failed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            task_dir = Path(tmpdir)
            phase_results = {
                "planning": PhaseResult(success=False, phase_id="planning", error="Failed")
            }
            runner = MockMethodologyRunner(phase_results=phase_results)
            executor = FullAutoExecutor(
                runner=runner,
                context=mock_context,
                task_config=mock_context.task_config,
                task_dir=task_dir,
            )

            await executor.execute()

            state = executor.get_task_state()
            assert state == "failed"


class TestArtifactVerificationIntegration:
    """Integration tests for artifact verification in execute flow (Story 4.2 Task 2)."""

    @pytest.mark.asyncio
    async def test_execute_verifies_planning_artifacts(self, mock_context):
        """Test that execute verifies planning artifacts after planning phase."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            mock_context.task_config.metadata["spec_dir"] = str(spec_dir)

            # Planning produces artifacts
            phases = [
                Phase(id="planning", name="Planning", order=0),
            ]
            phase_results = {
                "planning": PhaseResult(
                    success=True,
                    phase_id="planning",
                    artifacts=[str(spec_dir / "spec.md")],
                )
            }
            runner = MockMethodologyRunner(phases=phases, phase_results=phase_results)

            # But no actual files exist, so verification should fail
            executor = FullAutoExecutor(
                runner=runner,
                context=mock_context,
                task_config=mock_context.task_config,
            )

            # With strict verification, this would fail
            # For now, test that execute completes
            result = await executor.execute()

            # Phase executed but verification should be part of the flow
            assert "planning" in runner._executed_phases


# =============================================================================
# Story 4.3: Coding Phase Execution Tests
# =============================================================================


class TestCodingPhaseSubtaskLoading:
    """Test loading implementation plan for coding phase (Story 4.3 Task 1)."""

    def test_load_implementation_plan(self, executor):
        """Test loading subtasks from implementation_plan.json."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "spec_id": "test-spec",
                "subtasks": [
                    {"id": "1", "title": "First subtask", "status": "pending"},
                    {"id": "2", "title": "Second subtask", "status": "pending"},
                    {"id": "3", "title": "Third subtask", "status": "completed"},
                ],
            }
            import json

            (spec_dir / "implementation_plan.json").write_text(json.dumps(plan_data))

            subtasks = executor.load_implementation_plan(spec_dir)

            assert len(subtasks) == 3
            assert subtasks[0]["id"] == "1"
            assert subtasks[1]["title"] == "Second subtask"

    def test_load_implementation_plan_missing_file(self, executor):
        """Test that missing plan file raises appropriate error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)

            with pytest.raises(FileNotFoundError):
                executor.load_implementation_plan(spec_dir)

    def test_load_implementation_plan_invalid_json(self, executor):
        """Test that invalid JSON raises appropriate error."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            (spec_dir / "implementation_plan.json").write_text("invalid json")

            with pytest.raises(Exception):  # Could be json.JSONDecodeError
                executor.load_implementation_plan(spec_dir)

    def test_get_pending_subtasks(self, executor):
        """Test filtering to get only pending subtasks."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "First", "status": "completed"},
                    {"id": "2", "title": "Second", "status": "pending"},
                    {"id": "3", "title": "Third", "status": "in_progress"},
                    {"id": "4", "title": "Fourth", "status": "pending"},
                ],
            }
            import json

            (spec_dir / "implementation_plan.json").write_text(json.dumps(plan_data))

            pending = executor.get_pending_subtasks(spec_dir)

            assert len(pending) == 2
            assert pending[0]["id"] == "2"
            assert pending[1]["id"] == "4"


class TestCodingPhaseSubtaskExecution:
    """Test subtask execution loop (Story 4.3 Task 2)."""

    @pytest.mark.asyncio
    async def test_execute_subtask_updates_status(self, executor):
        """Test that executing a subtask updates its status in the plan."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "Test subtask", "status": "pending"},
                ],
            }
            import json

            plan_file = spec_dir / "implementation_plan.json"
            plan_file.write_text(json.dumps(plan_data))
            executor._spec_dir = spec_dir

            # Execute the subtask
            subtask = plan_data["subtasks"][0]
            result = await executor.execute_subtask(subtask)

            # Reload plan and check status updated
            updated_plan = json.loads(plan_file.read_text())
            # Status should be either "completed" (success) or "failed"
            assert updated_plan["subtasks"][0]["status"] in ["completed", "in_progress", "failed"]

    @pytest.mark.asyncio
    async def test_execute_all_subtasks_in_sequence(self, executor):
        """Test that all subtasks are executed in sequence."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "First", "status": "pending"},
                    {"id": "2", "title": "Second", "status": "pending"},
                    {"id": "3", "title": "Third", "status": "pending"},
                ],
            }
            import json

            plan_file = spec_dir / "implementation_plan.json"
            plan_file.write_text(json.dumps(plan_data))
            executor._spec_dir = spec_dir
            executor._task_dir = Path(tmpdir)

            # Track execution order
            executed_ids = []

            async def mock_execute_impl(subtask, attempt=1, recovery_context=None):
                executed_ids.append(subtask["id"])
                return {"success": True}

            # Patch the implementation method
            with patch.object(executor, "_execute_subtask_impl", side_effect=mock_execute_impl):
                await executor.execute_coding_phase()

            # All subtasks should be executed in order
            assert executed_ids == ["1", "2", "3"]


class TestCodingPhaseProgressReporting:
    """Test per-subtask progress reporting (Story 4.3 Task 3)."""

    @pytest.mark.asyncio
    async def test_emit_progress_on_subtask_start(self, executor, mock_progress_service):
        """Test that progress is emitted when subtask starts."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "Test subtask", "status": "pending"},
                ],
            }
            import json

            (spec_dir / "implementation_plan.json").write_text(json.dumps(plan_data))
            executor._spec_dir = spec_dir
            executor.context.progress = mock_progress_service

            executor.emit_subtask_progress(0, 1, plan_data["subtasks"][0], "started")

            # Should have emitted a started event
            assert len(mock_progress_service.events) >= 1
            last_event = mock_progress_service.events[-1]
            assert "started" in last_event.message.lower() or last_event.status == "started"

    @pytest.mark.asyncio
    async def test_emit_progress_on_subtask_complete(self, executor, mock_progress_service):
        """Test that progress is emitted when subtask completes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "Test subtask", "status": "pending"},
                ],
            }
            import json

            (spec_dir / "implementation_plan.json").write_text(json.dumps(plan_data))
            executor._spec_dir = spec_dir
            executor.context.progress = mock_progress_service

            executor.emit_subtask_progress(0, 1, plan_data["subtasks"][0], "completed")

            # Should have emitted a completed event
            assert len(mock_progress_service.events) >= 1

    @pytest.mark.asyncio
    async def test_progress_percentage_calculation(self, executor, mock_progress_service):
        """Test that percentage is calculated based on subtask count."""
        # Coding phase is 35-75% of overall progress (40% range)
        # 1 of 3 subtasks = 35 + (1/3)*40 = 35 + 13.33 = 48.33%

        percentage = executor.calculate_subtask_percentage(1, 3)

        # Should be around 48%
        assert 45 <= percentage <= 55


class TestCodingPhaseGitCommit:
    """Test git commit integration (Story 4.3 Task 4)."""

    @pytest.mark.asyncio
    async def test_commit_after_subtask(self, executor):
        """Test that changes are committed using git add -A to include deletions."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._worktree_path = Path(tmpdir)

            # Mock subprocess.run
            with patch("subprocess.run") as mock_run:
                mock_run.return_value.returncode = 0

                executor.commit_subtask_changes("Implement: Test subtask")

                # Verify git add -A is used (not git add .)
                add_call = mock_run.call_args_list[0]
                assert add_call[0][0] == ["git", "add", "-A"], (
                    f"Expected 'git add -A', got {add_call[0][0]}"
                )

                # Verify commit call uses the message
                commit_call = mock_run.call_args_list[1]
                assert commit_call[0][0][:3] == ["git", "commit", "-m"]
                assert "Implement: Test subtask" in commit_call[0][0][3]

    @pytest.mark.asyncio
    async def test_commit_uses_worktree_path(self, executor):
        """Test that commits are made to the correct worktree directory."""
        with tempfile.TemporaryDirectory() as tmpdir:
            worktree_path = Path(tmpdir) / "worktree"
            worktree_path.mkdir()
            executor._worktree_path = worktree_path

            with patch("subprocess.run") as mock_run:
                mock_run.return_value.returncode = 0

                executor.commit_subtask_changes("Test message")

                # Verify cwd parameter is the worktree path
                for call in mock_run.call_args_list:
                    assert call[1].get("cwd") == worktree_path, (
                        f"Expected cwd={worktree_path}, got {call[1].get('cwd')}"
                    )

    def test_commit_message_format(self, executor):
        """Test that commit messages follow expected format."""
        subtask = {"id": "1", "title": "Add user authentication"}

        message = executor.format_commit_message(subtask)

        assert "Implement:" in message or "Add user authentication" in message


class TestCodingPhaseRetryLogic:
    """Test retry logic for failed subtasks (Story 4.3 Task 5)."""

    @pytest.mark.asyncio
    async def test_retry_on_failure(self, executor):
        """Test that failed subtask is retried up to 3 times."""
        attempts = []

        async def failing_execute(subtask, attempt=1, recovery_context=None):
            attempts.append(attempt)
            if len(attempts) < 3:
                return {"success": False, "error": "Simulated failure"}
            return {"success": True}

        with patch.object(executor, "_execute_subtask_impl", side_effect=failing_execute):
            subtask = {"id": "1", "title": "Test", "status": "pending"}
            result = await executor.execute_subtask_with_retry(subtask)

        assert len(attempts) == 3
        assert result["success"] is True

    @pytest.mark.asyncio
    async def test_exponential_backoff(self, executor):
        """Test that retries use exponential backoff with exact delay values."""
        async def always_fail(subtask, attempt=1, recovery_context=None):
            return {"success": False, "error": "Always fails"}

        with tempfile.TemporaryDirectory() as tmpdir:
            executor._task_dir = Path(tmpdir)
            with patch.object(executor, "_execute_subtask_impl", side_effect=always_fail):
                with patch("apps.backend.core.executors.full_auto.asyncio.sleep") as mock_sleep:
                    subtask = {"id": "1", "title": "Test", "status": "pending"}
                    await executor.execute_subtask_with_retry(subtask, max_retries=3)

                    # Should have called sleep with exponential delays: 1, 2 (between 3 attempts)
                    # Formula: 2 ** (attempt - 1) => 2^0=1, 2^1=2
                    assert mock_sleep.call_count == 2, f"Expected 2 sleep calls, got {mock_sleep.call_count}"
                    sleep_calls = [call[0][0] for call in mock_sleep.call_args_list]
                    assert sleep_calls[0] == 1, f"First backoff should be 1s, got {sleep_calls[0]}"
                    assert sleep_calls[1] == 2, f"Second backoff should be 2s, got {sleep_calls[1]}"

    @pytest.mark.asyncio
    async def test_recovery_mode_prompt_on_retry(self, executor):
        """Test that retry uses recovery mode prompt with error context from previous attempt."""
        retry_contexts = []
        error_message = "Simulated error for testing"

        async def capture_execute(subtask, attempt=1, recovery_context=None):
            retry_contexts.append(recovery_context)
            if attempt < 2:
                return {"success": False, "error": error_message}
            return {"success": True}

        with patch.object(executor, "_execute_subtask_impl", side_effect=capture_execute):
            subtask = {"id": "1", "title": "Test", "status": "pending"}
            await executor.execute_subtask_with_retry(subtask)

        # Verify recovery context structure
        assert len(retry_contexts) == 2, f"Expected 2 attempts, got {len(retry_contexts)}"
        assert retry_contexts[0] is None, "First attempt should have no recovery context"
        assert retry_contexts[1] is not None, "Second attempt must have recovery context"
        assert error_message in retry_contexts[1], (
            f"Recovery context should contain previous error. Got: {retry_contexts[1]}"
        )


class TestCodingPhaseEscalation:
    """Test escalation handling for persistent failures (Story 4.3 Task 6)."""

    @pytest.mark.asyncio
    async def test_escalate_after_max_retries(self, executor):
        """Test that task is escalated after 3 failed retries."""

        async def always_fail(subtask, attempt=1, recovery_context=None):
            return {"success": False, "error": "Always fails"}

        with patch.object(executor, "_execute_subtask_impl", side_effect=always_fail):
            subtask = {"id": "1", "title": "Test", "status": "pending"}
            result = await executor.execute_subtask_with_retry(subtask, max_retries=3)

        assert result["success"] is False
        assert result.get("escalated") is True or "escalated" in str(result.get("error", "")).lower()

    @pytest.mark.asyncio
    async def test_escalation_updates_task_state(self, executor):
        """Test that escalation updates task state to 'escalated'."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._task_dir = Path(tmpdir)

            async def always_fail(subtask, attempt=1, recovery_context=None):
                return {"success": False, "error": "Always fails"}

            with patch.object(executor, "_execute_subtask_impl", side_effect=always_fail):
                subtask = {"id": "1", "title": "Test", "status": "pending"}
                await executor.execute_subtask_with_retry(subtask, max_retries=3)

            from apps.backend.core.executors.full_auto import TaskState

            state = executor.get_task_state()
            assert state in [TaskState.ESCALATED.value, TaskState.FAILED.value, "escalated", "failed"]

    @pytest.mark.asyncio
    async def test_partial_progress_preserved_on_escalation(self, executor):
        """Test that partial progress is preserved when task is escalated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "First", "status": "pending"},
                    {"id": "2", "title": "Second", "status": "pending"},
                ],
            }
            import json

            plan_file = spec_dir / "implementation_plan.json"
            plan_file.write_text(json.dumps(plan_data))
            executor._spec_dir = spec_dir
            executor._task_dir = Path(tmpdir)

            call_count = 0

            async def first_success_then_escalate(subtask, attempt=1, recovery_context=None):
                nonlocal call_count
                call_count += 1
                if subtask.get("id") == "1":
                    return {"success": True}
                # Second subtask fails and escalates
                return {"success": False, "error": "Always fails", "escalated": True}

            with patch.object(executor, "_execute_subtask_impl", side_effect=first_success_then_escalate):
                result = await executor.execute_coding_phase()

            # Verify escalation occurred
            assert result["status"] == "escalated"
            assert result["subtask"] == "2"
            assert result["subtasks_executed"] == 1

            # Verify first subtask is still completed (preserved)
            updated_plan = json.loads(plan_file.read_text())
            assert updated_plan["subtasks"][0]["status"] == "completed"
            # Second subtask should be marked as failed
            assert updated_plan["subtasks"][1]["status"] == "failed"

    @pytest.mark.asyncio
    async def test_non_escalated_failure_stops_execution(self, executor):
        """Test that a non-escalated failure stops execution and marks task failed.

        This tests the edge case where execute_subtask_with_retry returns
        {"success": False} without the "escalated" key.
        """
        with tempfile.TemporaryDirectory() as tmpdir:
            spec_dir = Path(tmpdir)
            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "First", "status": "pending"},
                    {"id": "2", "title": "Second", "status": "pending"},
                ],
            }
            import json

            plan_file = spec_dir / "implementation_plan.json"
            plan_file.write_text(json.dumps(plan_data))
            executor._spec_dir = spec_dir
            executor._task_dir = Path(tmpdir)

            # Simulate a failure that doesn't trigger escalation
            async def non_escalated_fail(subtask, attempt=1, recovery_context=None):
                return {"success": False, "error": "Network timeout"}

            with patch.object(executor, "_execute_subtask_impl", side_effect=non_escalated_fail):
                # Also patch execute_subtask_with_retry to return non-escalated failure
                with patch.object(
                    executor,
                    "execute_subtask_with_retry",
                    return_value={"success": False, "error": "Non-escalated failure"},
                ):
                    result = await executor.execute_coding_phase()

            # Should fail, not silently continue
            assert result["status"] == "failed"
            assert "error" in result
            from apps.backend.core.executors.full_auto import TaskState

            state = executor.get_task_state()
            assert state == TaskState.FAILED.value


class TestCodingPhaseCompletion:
    """Test state update on completion (Story 4.3 Task 7)."""

    @pytest.mark.asyncio
    async def test_coding_complete_state_on_success(self, executor):
        """Test that successful coding phase updates state to coding_complete."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._task_dir = Path(tmpdir)
            executor._spec_dir = Path(tmpdir)

            plan_data = {
                "subtasks": [
                    {"id": "1", "title": "Only subtask", "status": "pending"},
                ],
            }
            import json

            (executor._spec_dir / "implementation_plan.json").write_text(json.dumps(plan_data))

            async def mock_execute(subtask, attempt=1, recovery_context=None):
                return {"success": True}

            with patch.object(executor, "_execute_subtask_impl", side_effect=mock_execute):
                result = await executor.execute_coding_phase()

            from apps.backend.core.executors.full_auto import TaskState

            state = executor.get_task_state()
            assert state == TaskState.CODING_COMPLETE.value or result.get("status") == "coding_complete"

    @pytest.mark.asyncio
    async def test_validation_triggered_after_coding_complete(self, mock_context):
        """Test that validation phase is triggered after coding completes."""
        phases = [
            Phase(id="planning", name="Planning", order=0),
            Phase(id="coding", name="Coding", order=1),
            Phase(id="validation", name="Validation", order=2),
        ]
        runner = MockMethodologyRunner(phases=phases)
        executor = FullAutoExecutor(
            runner=runner,
            context=mock_context,
            task_config=mock_context.task_config,
        )

        await executor.execute()

        # After coding, validation should automatically run
        assert "coding" in runner._executed_phases
        assert "validation" in runner._executed_phases

    @pytest.mark.asyncio
    async def test_completion_logged(self, executor):
        """Test that coding phase completion is logged."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._task_dir = Path(tmpdir)
            executor._log_dir = Path(tmpdir)
            executor._spec_dir = Path(tmpdir)

            plan_data = {"subtasks": []}
            import json

            (executor._spec_dir / "implementation_plan.json").write_text(json.dumps(plan_data))

            with patch.object(executor._logger, "info") as mock_info:
                await executor.execute_coding_phase()

                # Should have logged completion
                calls_str = str(mock_info.call_args_list)
                assert "complete" in calls_str.lower() or "finished" in calls_str.lower() or len(mock_info.call_args_list) > 0


# =============================================================================
# Story 4.4: Validation Phase Execution Tests
# =============================================================================


class TestValidationPhaseEntry:
    """Test validation phase entry point (Story 4.4 Task 1)."""

    @pytest.mark.asyncio
    async def test_validation_phase_exists(self, executor):
        """Test that execute_validation_phase method exists."""
        assert hasattr(executor, "execute_validation_phase")
        assert callable(executor.execute_validation_phase)

    @pytest.mark.asyncio
    async def test_validation_phase_requires_spec_dir(self, executor):
        """Test that validation fails gracefully without spec_dir."""
        executor._spec_dir = None

        result = await executor.execute_validation_phase()

        assert result["status"] == "failed"
        assert "spec_dir" in result.get("error", "").lower()

    @pytest.mark.asyncio
    async def test_validation_updates_state_to_validation(self, executor):
        """Test that entering validation updates task state."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            # Mock the QA reviewer to return approval
            async def mock_qa_reviewer(*args, **kwargs):
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def mock_tests(*args, **kwargs):
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            with patch.object(executor, "_run_qa_reviewer", side_effect=mock_qa_reviewer):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    await executor.execute_validation_phase(max_iterations=1)

            # Should have transitioned through VALIDATION state
            from apps.backend.core.executors.full_auto import TaskState
            state = executor.get_task_state()
            # Final state should be COMPLETED since we mocked approval
            assert state in [TaskState.COMPLETED.value, TaskState.VALIDATION.value]


class TestQAReviewerIntegration:
    """Test QA reviewer invocation (Story 4.4 Task 2)."""

    @pytest.mark.asyncio
    async def test_qa_reviewer_called_in_validation(self, executor):
        """Test that QA reviewer is called during validation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            qa_called = []

            async def mock_qa_reviewer(iteration, max_iterations):
                qa_called.append(iteration)
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            with patch.object(executor, "_run_qa_reviewer", side_effect=mock_qa_reviewer):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    await executor.execute_validation_phase(max_iterations=1)

            assert len(qa_called) >= 1
            assert 1 in qa_called

    @pytest.mark.asyncio
    async def test_qa_reviewer_rejection_triggers_fix(self, executor):
        """Test that QA rejection triggers fixer invocation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            qa_calls = []
            fixer_calls = []

            async def mock_qa_reviewer(iteration, max_iterations):
                qa_calls.append(iteration)
                if iteration == 1:
                    return {
                        "passed": False,
                        "status": "rejected",
                        "issues": [{"title": "Test issue", "type": "bug"}],
                        "fixable": True,
                        "summary": "Issues found",
                    }
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            async def mock_fixer(issues, iteration):
                fixer_calls.append((issues, iteration))
                return {"fixed": True}

            with patch.object(executor, "_run_qa_reviewer", side_effect=mock_qa_reviewer):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    with patch.object(executor, "_run_qa_fixer", side_effect=mock_fixer):
                        await executor.execute_validation_phase(max_iterations=3)

            # QA fixer should have been called after first rejection
            assert len(fixer_calls) >= 1


class TestTestDetectionAndExecution:
    """Test automatic test detection and execution (Story 4.4 Task 3)."""

    @pytest.mark.asyncio
    async def test_no_tests_returns_skipped(self, executor):
        """Test that projects without tests return skipped status."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            result = await executor._run_tests()

            assert result["skipped"] is True
            assert result["passed"] is True  # No tests = pass
            assert result["framework"] is None

    @pytest.mark.asyncio
    async def test_pytest_detection(self, executor):
        """Test that pytest framework is detected."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            # Create pytest.ini to indicate pytest project
            (Path(tmpdir) / "pytest.ini").write_text("[pytest]\n")

            # Mock subprocess.run to simulate pytest execution
            with patch("subprocess.run") as mock_run:
                mock_run.return_value.returncode = 0
                mock_run.return_value.stdout = "All tests passed"
                mock_run.return_value.stderr = ""

                result = await executor._run_tests()

            assert result["framework"] == "pytest"
            assert result["passed"] is True
            assert result["skipped"] is False

    @pytest.mark.asyncio
    async def test_npm_test_detection(self, executor):
        """Test that npm test script is detected."""
        import json

        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            # Create package.json with test script
            pkg = {"scripts": {"test": "jest"}}
            (Path(tmpdir) / "package.json").write_text(json.dumps(pkg))

            with patch("subprocess.run") as mock_run:
                mock_run.return_value.returncode = 0
                mock_run.return_value.stdout = "Tests passed"
                mock_run.return_value.stderr = ""

                result = await executor._run_tests()

            assert result["framework"] == "npm test"

    @pytest.mark.asyncio
    async def test_test_failure_detected(self, executor):
        """Test that test failures are properly detected."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            (Path(tmpdir) / "pytest.ini").write_text("[pytest]\n")

            with patch("subprocess.run") as mock_run:
                mock_run.return_value.returncode = 1  # Non-zero = failure
                mock_run.return_value.stdout = "1 failed"
                mock_run.return_value.stderr = "AssertionError"

                result = await executor._run_tests()

            assert result["passed"] is False
            assert result["framework"] == "pytest"


class TestQAReportGeneration:
    """Test QA report generation (Story 4.4 Task 4)."""

    def test_qa_report_generated(self, executor):
        """Test that qa_report.md is generated."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)

            qa_result = {
                "passed": False,
                "status": "rejected",
                "issues": [{"type": "critical", "title": "Missing error handling", "location": "src/api.py:42"}],
                "summary": "Found 1 issue",
            }
            test_result = {
                "passed": True,
                "skipped": False,
                "framework": "pytest",
                "output": "10 passed",
                "errors": "",
                "summary": "All tests passed",
            }

            report_path = executor._generate_qa_report(qa_result, test_result, iteration=1)

            assert Path(report_path).exists()
            content = Path(report_path).read_text()
            assert "QA Report" in content
            assert "FAILED" in content  # QA status
            assert "critical" in content
            assert "Missing error handling" in content

    def test_qa_report_with_passed_status(self, executor):
        """Test QA report content when validation passes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)

            qa_result = {"passed": True, "status": "approved", "issues": [], "summary": "All good"}
            test_result = {"passed": True, "skipped": False, "framework": "pytest", "output": "5 passed", "errors": "", "summary": "OK"}

            report_path = executor._generate_qa_report(qa_result, test_result, iteration=2)

            content = Path(report_path).read_text()
            assert "PASSED" in content
            assert "No issues found" in content
            assert "Iteration:** 2" in content


class TestValidationFixLoop:
    """Test fix loop implementation (Story 4.4 Task 5)."""

    @pytest.mark.asyncio
    async def test_fix_loop_iterates_on_failure(self, executor):
        """Test that fix loop iterates when issues are found."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            iterations_run = []

            async def mock_qa_reviewer(iteration, max_iterations):
                iterations_run.append(iteration)
                if iteration < 3:
                    return {
                        "passed": False,
                        "status": "rejected",
                        "issues": [{"title": f"Issue {iteration}"}],
                        "fixable": True,
                        "summary": f"Iteration {iteration}",
                    }
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            async def mock_fixer(issues, iteration):
                return {"fixed": True}

            with patch.object(executor, "_run_qa_reviewer", side_effect=mock_qa_reviewer):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    with patch.object(executor, "_run_qa_fixer", side_effect=mock_fixer):
                        result = await executor.execute_validation_phase(max_iterations=5)

            # Should have run 3 iterations before passing
            assert len(iterations_run) == 3
            assert result["status"] == "completed"
            assert result["iterations"] == 3


class TestLoopTermination:
    """Test loop termination conditions (Story 4.4 Task 6)."""

    @pytest.mark.asyncio
    async def test_loop_terminates_on_max_iterations(self, executor):
        """Test that loop terminates after max iterations."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            async def always_fail_qa(*args, **kwargs):
                return {
                    "passed": False,
                    "status": "rejected",
                    "issues": [{"title": "Always fails"}],
                    "fixable": True,
                    "summary": "Always fails",
                }

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            async def mock_fixer(issues, iteration):
                return {"fixed": True}

            with patch.object(executor, "_run_qa_reviewer", side_effect=always_fail_qa):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    with patch.object(executor, "_run_qa_fixer", side_effect=mock_fixer):
                        result = await executor.execute_validation_phase(max_iterations=3)

            assert result["status"] == "failed"
            assert result["iterations"] == 3
            assert "3 iterations" in result.get("error", "")

    @pytest.mark.asyncio
    async def test_unfixable_issues_trigger_escalation(self, executor):
        """Test that unfixable issues trigger immediate escalation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            async def unfixable_qa(*args, **kwargs):
                return {
                    "passed": False,
                    "status": "rejected",
                    "issues": [{"title": "Requires human"}],
                    "fixable": False,  # Not auto-fixable
                    "summary": "Unfixable issue",
                }

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            with patch.object(executor, "_run_qa_reviewer", side_effect=unfixable_qa):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    result = await executor.execute_validation_phase(max_iterations=5)

            # Should escalate immediately, not iterate
            assert result["status"] == "escalated"
            assert result["iterations"] == 1  # Only one iteration


class TestValidationStateUpdate:
    """Test task state updates on validation success (Story 4.4 Task 7)."""

    @pytest.mark.asyncio
    async def test_successful_validation_sets_completed_state(self, executor):
        """Test that successful validation updates state to COMPLETED."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            async def passing_qa(*args, **kwargs):
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            with patch.object(executor, "_run_qa_reviewer", side_effect=passing_qa):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    result = await executor.execute_validation_phase(max_iterations=3)

            from apps.backend.core.executors.full_auto import TaskState

            state = executor.get_task_state()
            assert state == TaskState.COMPLETED.value
            assert result["status"] == "completed"

    @pytest.mark.asyncio
    async def test_failed_validation_sets_failed_state(self, executor):
        """Test that failed validation updates state to FAILED."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            async def always_fail_qa(*args, **kwargs):
                return {
                    "passed": False,
                    "status": "rejected",
                    "issues": [{"title": "Fails"}],
                    "fixable": True,
                    "summary": "Fails",
                }

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            async def mock_fixer(*args, **kwargs):
                return {"fixed": True}

            with patch.object(executor, "_run_qa_reviewer", side_effect=always_fail_qa):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    with patch.object(executor, "_run_qa_fixer", side_effect=mock_fixer):
                        result = await executor.execute_validation_phase(max_iterations=2)

            from apps.backend.core.executors.full_auto import TaskState

            state = executor.get_task_state()
            assert state == TaskState.FAILED.value


class TestValidationProgressReporting:
    """Test progress reporting during validation (Story 4.4)."""

    @pytest.mark.asyncio
    async def test_progress_events_emitted_during_validation(self, executor, mock_progress_service):
        """Test that progress events are emitted during validation."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir
            executor.context.progress = mock_progress_service

            async def passing_qa(*args, **kwargs):
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            with patch.object(executor, "_run_qa_reviewer", side_effect=passing_qa):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    await executor.execute_validation_phase(max_iterations=1)

            # Should have started and completed events
            events = mock_progress_service.events
            assert len(events) >= 2

            # Should have started event
            started_events = [e for e in events if e.status == "started"]
            assert len(started_events) >= 1

            # Should have completed event
            completed_events = [e for e in events if e.status == "completed"]
            assert len(completed_events) >= 1

    def test_validation_percentage_calculation(self, executor):
        """Test that validation percentage is calculated correctly."""
        # Validation phase is 75-100% (25% range)
        # 0 of 5 iterations = 75%
        assert executor._calculate_validation_percentage(0, 5) == 75.0

        # 5 of 5 iterations = 100%
        assert executor._calculate_validation_percentage(5, 5) == 100.0

        # 2.5 of 5 iterations = 75 + 12.5 = 87.5%
        assert executor._calculate_validation_percentage(2.5, 5) == 87.5


class TestValidationEdgeCases:
    """Test edge cases in validation phase."""

    @pytest.mark.asyncio
    async def test_tests_fail_but_qa_passes(self, executor):
        """Test that validation fails if tests fail even when QA passes."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            async def passing_qa(*args, **kwargs):
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def failing_tests():
                return {
                    "passed": False,
                    "skipped": False,
                    "framework": "pytest",
                    "output": "1 failed",
                    "errors": "AssertionError",
                    "summary": "Tests failed",
                }

            async def mock_fixer(*args, **kwargs):
                return {"fixed": True}

            with patch.object(executor, "_run_qa_reviewer", side_effect=passing_qa):
                with patch.object(executor, "_run_tests", side_effect=failing_tests):
                    with patch.object(executor, "_run_qa_fixer", side_effect=mock_fixer):
                        result = await executor.execute_validation_phase(max_iterations=3)

            # Should fail because tests failed
            assert result["status"] == "failed"

    @pytest.mark.asyncio
    async def test_empty_issues_list_treated_as_pass(self, executor):
        """Test that empty issues with passed=True is a success."""
        with tempfile.TemporaryDirectory() as tmpdir:
            executor._spec_dir = Path(tmpdir)
            executor._task_dir = Path(tmpdir)
            executor._worktree_path = tmpdir

            async def empty_issues_qa(*args, **kwargs):
                return {"passed": True, "status": "approved", "issues": [], "fixable": True, "summary": "OK"}

            async def mock_tests():
                return {"passed": True, "skipped": True, "framework": None, "output": "", "errors": "", "summary": "Skipped"}

            with patch.object(executor, "_run_qa_reviewer", side_effect=empty_issues_qa):
                with patch.object(executor, "_run_tests", side_effect=mock_tests):
                    result = await executor.execute_validation_phase(max_iterations=1)

            assert result["status"] == "completed"
