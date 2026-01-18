"""Tests for the BMAD methodology plugin structure.

Tests manifest validation, BMADRunner Protocol compliance, and plugin structure.
Story Reference: Story 6.1 - Create BMAD Methodology Plugin Structure
"""

from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

# Project root directory for file path resolution
PROJECT_ROOT = Path(__file__).parent.parent.parent
BMAD_METHODOLOGY_DIR = PROJECT_ROOT / "apps" / "backend" / "methodologies" / "bmad"


# =============================================================================
# Shared Fixtures
# =============================================================================


@pytest.fixture
def mock_context() -> Any:
    """Create a mock RunContext for testing.

    Returns:
        A fully configured mock RunContext with all required services.
    """
    from apps.backend.methodologies.protocols import (
        ComplexityLevel,
        ExecutionMode,
        RunContext,
        TaskConfig,
    )

    class MockWorkspace:
        def get_project_root(self) -> str:
            return "/mock/project"

    class MockMemory:
        def get_context(self, query: str) -> str:
            return "mock context"

    class MockProgress:
        def update(self, phase_id: str, progress: float, message: str) -> None:
            pass

        def emit(self, event) -> None:
            pass

    class MockCheckpoint:
        def create_checkpoint(self, checkpoint_id: str, data: dict[str, Any]) -> None:
            pass

        async def check_and_pause(
            self,
            phase_id: str,
            artifacts: list[str] | None = None,
            context: dict[str, Any] | None = None,
        ) -> Any | None:
            return None

        def resume(self, decision: str, feedback: str | None = None) -> None:
            pass

        def is_paused(self) -> bool:
            return False

        def load_state(self) -> Any | None:
            return None

        def clear_state(self) -> None:
            pass

    class MockLLM:
        def generate(self, prompt: str) -> str:
            return "mock response"

    task_config = TaskConfig(
        complexity=ComplexityLevel.STANDARD,
        execution_mode=ExecutionMode.FULL_AUTO,
        task_id="test-task-123",
        task_name="Test BMAD Task",
        metadata={},
    )

    return RunContext(
        workspace=MockWorkspace(),
        memory=MockMemory(),
        progress=MockProgress(),
        checkpoint=MockCheckpoint(),
        llm=MockLLM(),
        task_config=task_config,
    )


# =============================================================================
# Plugin Directory Structure Tests (AC#1)
# =============================================================================


class TestBMADPluginStructure:
    """Tests for BMAD plugin directory structure.

    Verifies AC#1: Plugin directory structure exists with correct files.
    """

    def test_bmad_directory_exists(self) -> None:
        """Test that the BMAD methodology directory exists."""
        assert BMAD_METHODOLOGY_DIR.exists(), f"BMAD directory not found: {BMAD_METHODOLOGY_DIR}"
        assert BMAD_METHODOLOGY_DIR.is_dir()

    def test_manifest_yaml_exists(self) -> None:
        """Test that manifest.yaml exists in BMAD directory."""
        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        assert manifest_path.exists(), f"manifest.yaml not found: {manifest_path}"
        assert manifest_path.is_file()

    def test_methodology_py_exists(self) -> None:
        """Test that methodology.py exists in BMAD directory."""
        methodology_path = BMAD_METHODOLOGY_DIR / "methodology.py"
        assert methodology_path.exists(), f"methodology.py not found: {methodology_path}"
        assert methodology_path.is_file()

    def test_init_py_exists(self) -> None:
        """Test that __init__.py exists in BMAD directory."""
        init_path = BMAD_METHODOLOGY_DIR / "__init__.py"
        assert init_path.exists(), f"__init__.py not found: {init_path}"
        assert init_path.is_file()

    def test_workflows_directory_exists(self) -> None:
        """Test that workflows/ subdirectory exists."""
        workflows_path = BMAD_METHODOLOGY_DIR / "workflows"
        assert workflows_path.exists(), f"workflows/ directory not found: {workflows_path}"
        assert workflows_path.is_dir()

    def test_workflows_init_py_exists(self) -> None:
        """Test that workflows/__init__.py exists."""
        init_path = BMAD_METHODOLOGY_DIR / "workflows" / "__init__.py"
        assert init_path.exists(), f"workflows/__init__.py not found: {init_path}"


# =============================================================================
# Manifest Validation Tests (AC#2)
# =============================================================================


class TestBMADManifestValidation:
    """Tests for BMAD manifest validation.

    Verifies AC#2: Manifest passes schema validation.
    """

    def test_manifest_loads_successfully(self) -> None:
        """Test that the BMAD manifest can be loaded."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        assert manifest is not None
        assert manifest.name == "bmad"

    def test_manifest_has_required_fields(self) -> None:
        """Test that manifest has all required fields."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        assert manifest.name == "bmad"
        assert manifest.version == "1.0.0"
        assert manifest.entry_point == "methodology.BMADRunner"
        assert len(manifest.phases) > 0

    def test_manifest_has_seven_phases(self) -> None:
        """Test that manifest defines exactly 7 phases."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        assert len(manifest.phases) == 7

    def test_manifest_phases_correct_ids(self) -> None:
        """Test that manifest has correct phase IDs: analyze, prd, architecture, epics, stories, dev, review."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        expected_phase_ids = [
            "analyze",
            "prd",
            "architecture",
            "epics",
            "stories",
            "dev",
            "review",
        ]
        actual_phase_ids = [phase.id for phase in manifest.phases]

        assert actual_phase_ids == expected_phase_ids

    def test_manifest_phases_have_names(self) -> None:
        """Test that all phases have human-readable names."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        for phase in manifest.phases:
            assert phase.name, f"Phase {phase.id} missing name"
            assert len(phase.name) > 0

    def test_manifest_has_checkpoints(self) -> None:
        """Test that manifest defines checkpoints for Semi-Auto mode."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        assert len(manifest.checkpoints) > 0

    def test_manifest_checkpoints_reference_valid_phases(self) -> None:
        """Test that checkpoint phase references are valid."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        phase_ids = {phase.id for phase in manifest.phases}

        for checkpoint in manifest.checkpoints:
            assert checkpoint.phase in phase_ids, (
                f"Checkpoint {checkpoint.id} references invalid phase: {checkpoint.phase}"
            )

    def test_manifest_has_artifacts(self) -> None:
        """Test that manifest defines artifacts."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        assert len(manifest.artifacts) > 0

    def test_manifest_complexity_levels(self) -> None:
        """Test that manifest defines complexity levels."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        expected_levels = ["quick", "standard", "complex"]
        assert manifest.complexity_levels == expected_levels

    def test_manifest_execution_modes(self) -> None:
        """Test that manifest defines execution modes."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = BMAD_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        expected_modes = ["full_auto", "semi_auto"]
        assert manifest.execution_modes == expected_modes


# =============================================================================
# BMADRunner Protocol Compliance Tests
# =============================================================================


class TestBMADRunnerProtocolCompliance:
    """Tests for BMADRunner implementing MethodologyRunner Protocol."""

    def test_bmad_runner_can_be_imported(self) -> None:
        """Test that BMADRunner can be imported from the module."""
        from apps.backend.methodologies.bmad import BMADRunner

        assert BMADRunner is not None

    def test_bmad_runner_has_initialize_method(self) -> None:
        """Test that BMADRunner has initialize() method."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        assert hasattr(runner, "initialize")
        assert callable(runner.initialize)

    def test_bmad_runner_has_get_phases_method(self) -> None:
        """Test that BMADRunner has get_phases() method."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        assert hasattr(runner, "get_phases")
        assert callable(runner.get_phases)

    def test_bmad_runner_has_execute_phase_method(self) -> None:
        """Test that BMADRunner has execute_phase() method."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        assert hasattr(runner, "execute_phase")
        assert callable(runner.execute_phase)

    def test_bmad_runner_has_get_checkpoints_method(self) -> None:
        """Test that BMADRunner has get_checkpoints() method."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        assert hasattr(runner, "get_checkpoints")
        assert callable(runner.get_checkpoints)

    def test_bmad_runner_has_get_artifacts_method(self) -> None:
        """Test that BMADRunner has get_artifacts() method."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        assert hasattr(runner, "get_artifacts")
        assert callable(runner.get_artifacts)

    def test_bmad_runner_implements_protocol(self) -> None:
        """Test that BMADRunner conforms to MethodologyRunner Protocol."""
        from apps.backend.methodologies.bmad import BMADRunner
        from apps.backend.methodologies.protocols import MethodologyRunner

        runner = BMADRunner()
        assert isinstance(runner, MethodologyRunner)


# =============================================================================
# BMADRunner Initialization Tests
# =============================================================================


class TestBMADRunnerInitialization:
    """Tests for BMADRunner initialization."""

    def test_initialize_sets_context(self, mock_context: Any) -> None:
        """Test that initialize() stores the context."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        # Runner should be initialized
        assert runner._initialized is True
        assert runner._context is mock_context

    def test_initialize_raises_if_already_initialized(self, mock_context: Any) -> None:
        """Test that initializing twice raises RuntimeError."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        with pytest.raises(RuntimeError, match="already initialized"):
            runner.initialize(mock_context)

    def test_get_phases_raises_before_initialization(self) -> None:
        """Test that get_phases() raises if not initialized."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()

        with pytest.raises(RuntimeError, match="not initialized"):
            runner.get_phases()

    def test_get_checkpoints_raises_before_initialization(self) -> None:
        """Test that get_checkpoints() raises if not initialized."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()

        with pytest.raises(RuntimeError, match="not initialized"):
            runner.get_checkpoints()

    def test_get_artifacts_raises_before_initialization(self) -> None:
        """Test that get_artifacts() raises if not initialized."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()

        with pytest.raises(RuntimeError, match="not initialized"):
            runner.get_artifacts()


# =============================================================================
# BMADRunner get_phases() Tests
# =============================================================================


class TestBMADRunnerGetPhases:
    """Tests for BMADRunner.get_phases() method."""

    def test_get_phases_returns_list(self, mock_context: Any) -> None:
        """Test that get_phases() returns a list."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        phases = runner.get_phases()
        assert isinstance(phases, list)

    def test_get_phases_returns_seven_phases(self, mock_context: Any) -> None:
        """Test that get_phases() returns exactly 7 phases."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        phases = runner.get_phases()
        assert len(phases) == 7

    def test_get_phases_returns_phase_objects(self, mock_context: Any) -> None:
        """Test that get_phases() returns Phase objects."""
        from apps.backend.methodologies.bmad import BMADRunner
        from apps.backend.methodologies.protocols import Phase

        runner = BMADRunner()
        runner.initialize(mock_context)

        phases = runner.get_phases()
        for phase in phases:
            assert isinstance(phase, Phase)

    def test_get_phases_correct_order(self, mock_context: Any) -> None:
        """Test that phases are in correct execution order."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        phases = runner.get_phases()
        expected_ids = [
            "analyze",
            "prd",
            "architecture",
            "epics",
            "stories",
            "dev",
            "review",
        ]
        actual_ids = [phase.id for phase in phases]

        assert actual_ids == expected_ids

    def test_get_phases_returns_copy(self, mock_context: Any) -> None:
        """Test that get_phases() returns a copy, not the internal list."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        phases1 = runner.get_phases()
        phases2 = runner.get_phases()

        assert phases1 is not phases2
        assert phases1 == phases2


# =============================================================================
# BMADRunner get_checkpoints() Tests
# =============================================================================


class TestBMADRunnerGetCheckpoints:
    """Tests for BMADRunner.get_checkpoints() method."""

    def test_get_checkpoints_returns_list(self, mock_context: Any) -> None:
        """Test that get_checkpoints() returns a list."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        checkpoints = runner.get_checkpoints()
        assert isinstance(checkpoints, list)

    def test_get_checkpoints_has_entries(self, mock_context: Any) -> None:
        """Test that get_checkpoints() returns checkpoint entries."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        checkpoints = runner.get_checkpoints()
        assert len(checkpoints) > 0

    def test_get_checkpoints_returns_checkpoint_objects(self, mock_context: Any) -> None:
        """Test that get_checkpoints() returns Checkpoint objects."""
        from apps.backend.methodologies.bmad import BMADRunner
        from apps.backend.methodologies.protocols import Checkpoint

        runner = BMADRunner()
        runner.initialize(mock_context)

        checkpoints = runner.get_checkpoints()
        for checkpoint in checkpoints:
            assert isinstance(checkpoint, Checkpoint)

    def test_get_checkpoints_returns_copy(self, mock_context: Any) -> None:
        """Test that get_checkpoints() returns a copy, not the internal list."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        checkpoints1 = runner.get_checkpoints()
        checkpoints2 = runner.get_checkpoints()

        assert checkpoints1 is not checkpoints2


# =============================================================================
# BMADRunner get_artifacts() Tests
# =============================================================================


class TestBMADRunnerGetArtifacts:
    """Tests for BMADRunner.get_artifacts() method."""

    def test_get_artifacts_returns_list(self, mock_context: Any) -> None:
        """Test that get_artifacts() returns a list."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        artifacts = runner.get_artifacts()
        assert isinstance(artifacts, list)

    def test_get_artifacts_has_entries(self, mock_context: Any) -> None:
        """Test that get_artifacts() returns artifact entries."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        artifacts = runner.get_artifacts()
        assert len(artifacts) > 0

    def test_get_artifacts_returns_artifact_objects(self, mock_context: Any) -> None:
        """Test that get_artifacts() returns Artifact objects."""
        from apps.backend.methodologies.bmad import BMADRunner
        from apps.backend.methodologies.protocols import Artifact

        runner = BMADRunner()
        runner.initialize(mock_context)

        artifacts = runner.get_artifacts()
        for artifact in artifacts:
            assert isinstance(artifact, Artifact)

    def test_get_artifacts_includes_expected_artifacts(self, mock_context: Any) -> None:
        """Test that artifacts include expected outputs."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        artifacts = runner.get_artifacts()
        artifact_ids = {artifact.id for artifact in artifacts}

        # Expected artifacts based on the story specification
        expected_ids = {
            "analysis-json",
            "prd-md",
            "architecture-md",
            "epics-md",
            "stories-md",
            "review-report-md",
        }

        assert expected_ids.issubset(artifact_ids)


# =============================================================================
# BMADRunner execute_phase() Tests (Stub validation)
# =============================================================================


class TestBMADRunnerExecutePhase:
    """Tests for BMADRunner.execute_phase() method stubs."""

    def test_execute_phase_raises_before_initialization(self) -> None:
        """Test that execute_phase() raises if not initialized."""
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()

        with pytest.raises(RuntimeError, match="not initialized"):
            runner.execute_phase("analyze")

    def test_execute_phase_unknown_phase_returns_skipped(self, mock_context: Any) -> None:
        """Test that execute_phase() returns skipped for unknown phase.

        The BMAD methodology treats unknown phases as skipped based on
        complexity level filtering, returning success=True with skipped metadata.
        """
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        result = runner.execute_phase("unknown_phase")

        # Unknown phases are treated as skipped with success=True
        assert result.success is True
        assert result.metadata.get("skipped") is True

    def test_execute_phase_analyze_requires_spec_dir(self, mock_context: Any) -> None:
        """Test that analyze phase requires spec_dir to be configured.

        The BMAD methodology requires spec_dir in task_config.metadata
        for artifact storage.
        """
        from apps.backend.methodologies.bmad import BMADRunner

        runner = BMADRunner()
        runner.initialize(mock_context)

        result = runner.execute_phase("analyze")

        # Without spec_dir, the phase fails with configuration error
        assert result.success is False
        assert "output directory" in result.error.lower() or "spec_dir" in result.error.lower()

    def test_execute_phase_returns_phase_result(self, mock_context: Any) -> None:
        """Test that execute_phase() returns PhaseResult."""
        from apps.backend.methodologies.bmad import BMADRunner
        from apps.backend.methodologies.protocols import PhaseResult

        runner = BMADRunner()
        runner.initialize(mock_context)

        result = runner.execute_phase("analyze")

        assert isinstance(result, PhaseResult)
        assert result.phase_id == "analyze"

    def test_execute_phase_all_phases_return_result(self, mock_context: Any) -> None:
        """Test that all 7 phases return PhaseResult.

        Without spec_dir configured, phases requiring output will fail,
        but all should return proper PhaseResult objects.
        """
        from apps.backend.methodologies.bmad import BMADRunner
        from apps.backend.methodologies.protocols import PhaseResult

        runner = BMADRunner()
        runner.initialize(mock_context)

        phase_ids = ["analyze", "prd", "architecture", "epics", "stories", "dev", "review"]

        for phase_id in phase_ids:
            result = runner.execute_phase(phase_id)
            # All phases should return PhaseResult with correct phase_id
            assert isinstance(result, PhaseResult), f"Phase {phase_id} should return PhaseResult"
            assert result.phase_id == phase_id


# =============================================================================
# Module Import Tests
# =============================================================================


class TestBMADModuleImports:
    """Tests for BMAD module imports."""

    def test_import_from_init(self) -> None:
        """Test that BMADRunner can be imported from __init__.py."""
        from apps.backend.methodologies.bmad import BMADRunner

        assert BMADRunner is not None

    def test_import_from_methodology(self) -> None:
        """Test that BMADRunner can be imported from methodology.py."""
        from apps.backend.methodologies.bmad.methodology import BMADRunner

        assert BMADRunner is not None

    def test_all_exports(self) -> None:
        """Test that __all__ exports BMADRunner."""
        import apps.backend.methodologies.bmad as bmad_module

        assert "BMADRunner" in bmad_module.__all__
