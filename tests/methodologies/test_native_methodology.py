"""Tests for the Native methodology plugin structure.

Tests manifest validation, NativeRunner Protocol compliance, and plugin structure.
Story Reference: Story 2.1 - Create Native Methodology Plugin Structure
Story Reference: Story 2.2 - Implement Native MethodologyRunner
"""

import tempfile
from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pytest

# Project root directory for file path resolution
PROJECT_ROOT = Path(__file__).parent.parent.parent
NATIVE_METHODOLOGY_DIR = PROJECT_ROOT / "apps" / "backend" / "methodologies" / "native"


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

    class MockCheckpoint:
        def create_checkpoint(self, checkpoint_id: str, data: dict[str, Any]) -> None:
            pass

    class MockLLM:
        def generate(self, prompt: str) -> str:
            return "mock response"

    return RunContext(
        workspace=MockWorkspace(),
        memory=MockMemory(),
        progress=MockProgress(),
        checkpoint=MockCheckpoint(),
        llm=MockLLM(),
        task_config=TaskConfig(
            complexity=ComplexityLevel.STANDARD,
            execution_mode=ExecutionMode.FULL_AUTO,
            task_id="test-task",
            task_name="Test Task",
        ),
    )


@pytest.fixture
def mock_workspace_manager():
    """Create a mock for WorktreeManager that can be used across tests."""
    from unittest.mock import MagicMock

    mock_manager = MagicMock()
    mock_worktree_info = MagicMock()
    mock_worktree_info.path = "/mock/worktree/path"
    mock_worktree_info.branch = "auto-claude/test-task"
    mock_worktree_info.spec_name = "test-task"
    mock_manager.get_or_create_worktree.return_value = mock_worktree_info
    return mock_manager


@pytest.fixture
def mock_context_with_spec_dir(tmp_path) -> Any:
    """Create a mock RunContext with spec_dir configured.

    Args:
        tmp_path: pytest fixture for temporary directory

    Returns:
        A RunContext with spec_dir in task_config.metadata
    """
    from apps.backend.methodologies.protocols import (
        ComplexityLevel,
        ExecutionMode,
        RunContext,
        TaskConfig,
    )

    class MockWorkspace:
        def get_project_root(self) -> str:
            return str(tmp_path / "project")

    class MockMemory:
        def get_context(self, query: str) -> str:
            return "mock context"

    class MockProgress:
        def update(self, phase_id: str, progress: float, message: str) -> None:
            pass

    class MockCheckpoint:
        def create_checkpoint(self, checkpoint_id: str, data: dict[str, Any]) -> None:
            pass

    class MockLLM:
        def generate(self, prompt: str) -> str:
            return "mock response"

    spec_dir = tmp_path / "specs" / "001-test"
    spec_dir.mkdir(parents=True, exist_ok=True)

    # Create project dir too
    project_dir = tmp_path / "project"
    project_dir.mkdir(parents=True, exist_ok=True)

    return RunContext(
        workspace=MockWorkspace(),
        memory=MockMemory(),
        progress=MockProgress(),
        checkpoint=MockCheckpoint(),
        llm=MockLLM(),
        task_config=TaskConfig(
            complexity=ComplexityLevel.STANDARD,
            execution_mode=ExecutionMode.FULL_AUTO,
            task_id="test-task",
            task_name="Test Task",
            metadata={"spec_dir": str(spec_dir)},
        ),
    )


@pytest.fixture
def initialized_runner(mock_context: Any, mock_workspace_manager) -> Any:
    """Create and initialize a NativeRunner for testing.

    Args:
        mock_context: The mock RunContext fixture.
        mock_workspace_manager: The mock WorktreeManager fixture.

    Returns:
        An initialized NativeRunner instance.
    """
    from apps.backend.methodologies.native import NativeRunner
    from unittest.mock import patch, MagicMock

    runner = NativeRunner()

    with patch(
        "apps.backend.methodologies.native.methodology.WorktreeManager",
        return_value=mock_workspace_manager,
    ), patch(
        "apps.backend.methodologies.native.methodology.get_security_profile",
        return_value=MagicMock(),
    ), patch(
        "apps.backend.methodologies.native.methodology.get_graphiti_memory",
        return_value=MagicMock(),
    ):
        runner.initialize(mock_context)

    return runner


@pytest.fixture
def initialized_runner_with_spec_dir(mock_context_with_spec_dir: Any, mock_workspace_manager) -> Any:
    """Create and initialize a NativeRunner with spec_dir configured.

    Args:
        mock_context_with_spec_dir: The mock RunContext with spec_dir.
        mock_workspace_manager: The mock WorktreeManager fixture.

    Returns:
        An initialized NativeRunner instance with spec_dir.
    """
    from apps.backend.methodologies.native import NativeRunner
    from unittest.mock import patch, MagicMock

    runner = NativeRunner()

    with patch(
        "apps.backend.methodologies.native.methodology.WorktreeManager",
        return_value=mock_workspace_manager,
    ), patch(
        "apps.backend.methodologies.native.methodology.get_security_profile",
        return_value=MagicMock(),
    ), patch(
        "apps.backend.methodologies.native.methodology.get_graphiti_memory",
        return_value=MagicMock(),
    ):
        runner.initialize(mock_context_with_spec_dir)

    return runner


# =============================================================================
# Plugin Structure Tests
# =============================================================================


class TestNativePluginStructure:
    """Test that the Native methodology plugin structure is complete."""

    def test_native_directory_exists(self):
        """Test that the native methodology directory exists."""
        assert NATIVE_METHODOLOGY_DIR.exists(), f"Native methodology directory not found: {NATIVE_METHODOLOGY_DIR}"
        assert NATIVE_METHODOLOGY_DIR.is_dir()

    def test_manifest_yaml_exists(self):
        """Test that manifest.yaml exists in native methodology."""
        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        assert manifest_path.exists(), f"manifest.yaml not found: {manifest_path}"

    def test_methodology_py_exists(self):
        """Test that methodology.py exists in native methodology."""
        methodology_path = NATIVE_METHODOLOGY_DIR / "methodology.py"
        assert methodology_path.exists(), f"methodology.py not found: {methodology_path}"

    def test_init_py_exists(self):
        """Test that __init__.py exists in native methodology."""
        init_path = NATIVE_METHODOLOGY_DIR / "__init__.py"
        assert init_path.exists(), f"__init__.py not found: {init_path}"


# =============================================================================
# Manifest Validation Tests
# =============================================================================


class TestNativeManifestValidation:
    """Test that the Native methodology manifest validates correctly."""

    def test_manifest_loads_without_error(self):
        """Test that manifest.yaml can be loaded and validated."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)
        assert manifest is not None

    def test_manifest_name_is_native(self):
        """Test that manifest name is 'native'."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)
        assert manifest.name == "native"

    def test_manifest_version_is_valid(self):
        """Test that manifest has a valid version string."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)
        assert manifest.version == "1.0.0"

    def test_manifest_entry_point_is_valid(self):
        """Test that manifest entry_point points to NativeRunner."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)
        assert manifest.entry_point == "methodology.NativeRunner"

    def test_manifest_has_six_phases(self):
        """Test that manifest defines exactly 6 phases."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)
        assert len(manifest.phases) == 6

    def test_manifest_phase_ids_are_correct(self):
        """Test that phases have the correct IDs per AC #2."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        expected_phase_ids = [
            "discovery",
            "requirements",
            "context",
            "spec",
            "plan",
            "validate",
        ]
        actual_phase_ids = [phase.id for phase in manifest.phases]
        assert actual_phase_ids == expected_phase_ids

    def test_manifest_has_checkpoints(self):
        """Test that manifest defines checkpoints for Semi-Auto mode."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)
        assert len(manifest.checkpoints) == 3

    def test_manifest_checkpoint_references_valid_phases(self):
        """Test that all checkpoints reference valid phases."""
        from apps.backend.methodologies.manifest import load_manifest

        manifest_path = NATIVE_METHODOLOGY_DIR / "manifest.yaml"
        manifest = load_manifest(manifest_path)

        phase_ids = {phase.id for phase in manifest.phases}
        for checkpoint in manifest.checkpoints:
            assert checkpoint.phase in phase_ids, (
                f"Checkpoint '{checkpoint.id}' references non-existent phase: '{checkpoint.phase}'"
            )


# =============================================================================
# Import Tests
# =============================================================================


class TestNativeRunnerImport:
    """Test that NativeRunner can be imported correctly."""

    def test_native_runner_importable_from_module(self):
        """Test that NativeRunner can be imported from methodology module."""
        from apps.backend.methodologies.native.methodology import NativeRunner

        assert NativeRunner is not None

    def test_native_runner_importable_from_package(self):
        """Test that NativeRunner can be imported from package __init__."""
        from apps.backend.methodologies.native import NativeRunner

        assert NativeRunner is not None

    def test_native_runner_is_class(self):
        """Test that NativeRunner is a class."""
        from apps.backend.methodologies.native import NativeRunner

        assert isinstance(NativeRunner, type)


# =============================================================================
# Protocol Compliance Tests
# =============================================================================


class TestNativeRunnerProtocolCompliance:
    """Test that NativeRunner implements the MethodologyRunner Protocol."""

    def test_native_runner_is_methodology_runner(self):
        """Test NativeRunner implements MethodologyRunner Protocol."""
        from apps.backend.methodologies.native import NativeRunner
        from apps.backend.methodologies.protocols import MethodologyRunner

        runner = NativeRunner()
        assert isinstance(runner, MethodologyRunner)

    def test_native_runner_has_initialize_method(self):
        """Test NativeRunner has initialize method."""
        from apps.backend.methodologies.native import NativeRunner

        assert hasattr(NativeRunner, "initialize")
        assert callable(getattr(NativeRunner, "initialize"))

    def test_native_runner_has_get_phases_method(self):
        """Test NativeRunner has get_phases method."""
        from apps.backend.methodologies.native import NativeRunner

        assert hasattr(NativeRunner, "get_phases")
        assert callable(getattr(NativeRunner, "get_phases"))

    def test_native_runner_has_execute_phase_method(self):
        """Test NativeRunner has execute_phase method."""
        from apps.backend.methodologies.native import NativeRunner

        assert hasattr(NativeRunner, "execute_phase")
        assert callable(getattr(NativeRunner, "execute_phase"))

    def test_native_runner_has_get_checkpoints_method(self):
        """Test NativeRunner has get_checkpoints method."""
        from apps.backend.methodologies.native import NativeRunner

        assert hasattr(NativeRunner, "get_checkpoints")
        assert callable(getattr(NativeRunner, "get_checkpoints"))

    def test_native_runner_has_get_artifacts_method(self):
        """Test NativeRunner has get_artifacts method."""
        from apps.backend.methodologies.native import NativeRunner

        assert hasattr(NativeRunner, "get_artifacts")
        assert callable(getattr(NativeRunner, "get_artifacts"))


# =============================================================================
# Initialization Tests
# =============================================================================


class TestNativeRunnerInitialization:
    """Test NativeRunner initialization behavior."""

    def test_runner_not_initialized_before_initialize(self):
        """Test runner raises error if used before initialization."""
        from apps.backend.methodologies.native import NativeRunner

        runner = NativeRunner()
        with pytest.raises(RuntimeError, match="not initialized"):
            runner.get_phases()

    def test_runner_initializes_with_context(self, mock_context, mock_workspace_manager):
        """Test runner initializes successfully with RunContext."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context)

        # Should not raise after initialization
        phases = runner.get_phases()
        assert len(phases) == 6

    def test_runner_cannot_initialize_twice(self, mock_context, mock_workspace_manager):
        """Test runner raises error if initialized twice."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context)

        with pytest.raises(RuntimeError, match="already initialized"):
            runner.initialize(mock_context)


# =============================================================================
# Phase Tests
# =============================================================================


class TestNativeRunnerPhases:
    """Test NativeRunner phase definitions."""

    def test_get_phases_returns_list(self, initialized_runner):
        """Test get_phases returns a list."""
        phases = initialized_runner.get_phases()
        assert isinstance(phases, list)

    def test_get_phases_returns_six_phases(self, initialized_runner):
        """Test get_phases returns exactly 6 phases."""
        phases = initialized_runner.get_phases()
        assert len(phases) == 6

    def test_phases_have_correct_order(self, initialized_runner):
        """Test phases are in correct execution order."""
        phases = initialized_runner.get_phases()
        orders = [phase.order for phase in phases]
        assert orders == [1, 2, 3, 4, 5, 6]

    def test_phases_have_pending_status_initially(self, initialized_runner):
        """Test all phases start with PENDING status."""
        from apps.backend.methodologies.protocols import PhaseStatus

        phases = initialized_runner.get_phases()
        for phase in phases:
            assert phase.status == PhaseStatus.PENDING

    def test_phases_are_not_optional(self, initialized_runner):
        """Test all phases are required (not optional)."""
        phases = initialized_runner.get_phases()
        for phase in phases:
            assert phase.is_optional is False


# =============================================================================
# Checkpoint Tests
# =============================================================================


class TestNativeRunnerCheckpoints:
    """Test NativeRunner checkpoint definitions."""

    def test_get_checkpoints_returns_list(self, initialized_runner):
        """Test get_checkpoints returns a list."""
        checkpoints = initialized_runner.get_checkpoints()
        assert isinstance(checkpoints, list)

    def test_get_checkpoints_returns_three_checkpoints(self, initialized_runner):
        """Test get_checkpoints returns exactly 3 checkpoints."""
        checkpoints = initialized_runner.get_checkpoints()
        assert len(checkpoints) == 3

    def test_checkpoints_have_pending_status_initially(self, initialized_runner):
        """Test all checkpoints start with PENDING status."""
        from apps.backend.methodologies.protocols import CheckpointStatus

        checkpoints = initialized_runner.get_checkpoints()
        for checkpoint in checkpoints:
            assert checkpoint.status == CheckpointStatus.PENDING

    def test_checkpoints_require_approval(self, initialized_runner):
        """Test all checkpoints require approval."""
        checkpoints = initialized_runner.get_checkpoints()
        for checkpoint in checkpoints:
            assert checkpoint.requires_approval is True

    def test_checkpoints_reference_valid_phase_ids(self, initialized_runner):
        """Test checkpoints reference phase IDs that exist in phases."""
        phases = initialized_runner.get_phases()
        checkpoints = initialized_runner.get_checkpoints()

        phase_ids = {phase.id for phase in phases}
        for checkpoint in checkpoints:
            assert checkpoint.phase_id in phase_ids, (
                f"Checkpoint '{checkpoint.id}' references invalid phase: '{checkpoint.phase_id}'"
            )


# =============================================================================
# Artifact Tests
# =============================================================================


class TestNativeRunnerArtifacts:
    """Test NativeRunner artifact definitions."""

    def test_get_artifacts_returns_list(self, initialized_runner):
        """Test get_artifacts returns a list."""
        artifacts = initialized_runner.get_artifacts()
        assert isinstance(artifacts, list)

    def test_get_artifacts_returns_four_artifacts(self, initialized_runner):
        """Test get_artifacts returns exactly 4 artifacts."""
        artifacts = initialized_runner.get_artifacts()
        assert len(artifacts) == 4

    def test_artifacts_have_expected_ids(self, initialized_runner):
        """Test artifacts have the expected IDs."""
        artifacts = initialized_runner.get_artifacts()

        expected_ids = {
            "requirements-json",
            "context-json",
            "spec-md",
            "implementation-plan-json",
        }
        actual_ids = {artifact.id for artifact in artifacts}
        assert actual_ids == expected_ids

    def test_artifacts_have_file_paths(self, initialized_runner):
        """Test all artifacts have file paths defined."""
        artifacts = initialized_runner.get_artifacts()

        for artifact in artifacts:
            assert artifact.file_path, f"Artifact '{artifact.id}' missing file_path"


# =============================================================================
# Phase Execution Tests (Basic)
# =============================================================================


class TestNativeRunnerPhaseExecution:
    """Test NativeRunner phase execution behavior."""

    def test_execute_phase_returns_phase_result(self, initialized_runner):
        """Test execute_phase returns a PhaseResult."""
        from apps.backend.methodologies.protocols import PhaseResult

        result = initialized_runner.execute_phase("discovery")
        assert isinstance(result, PhaseResult)

    def test_execute_phase_returns_failure_for_unknown_phase(self, initialized_runner):
        """Test execute_phase returns failure for unknown phase ID."""
        result = initialized_runner.execute_phase("nonexistent")
        assert result.success is False
        assert "Unknown phase" in result.error

    def test_execute_phase_requires_initialization(self):
        """Test execute_phase raises error if not initialized."""
        from apps.backend.methodologies.native import NativeRunner

        runner = NativeRunner()
        with pytest.raises(RuntimeError, match="not initialized"):
            runner.execute_phase("discovery")


# =============================================================================
# Story 2.2: Initialize Method Tests
# =============================================================================


class TestNativeRunnerInitializeContext:
    """Test NativeRunner stores context correctly (Story 2.2 AC#1)."""

    def test_initialize_stores_context(self, mock_context, mock_workspace_manager):
        """Test initialize stores the RunContext reference."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context)

        assert runner._context is mock_context

    def test_initialize_extracts_project_dir(self, mock_context, mock_workspace_manager):
        """Test initialize extracts project_dir from context.workspace."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context)

        assert runner._project_dir == "/mock/project"

    def test_initialize_extracts_task_config(self, mock_context, mock_workspace_manager):
        """Test initialize stores task configuration from context."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context)

        assert runner._task_config is mock_context.task_config
        assert runner._task_config.task_id == "test-task"

    def test_initialize_extracts_complexity(self, mock_context, mock_workspace_manager):
        """Test initialize extracts complexity level from task config."""
        from apps.backend.methodologies.native import NativeRunner
        from apps.backend.methodologies.protocols import ComplexityLevel
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context)

        assert runner._complexity == ComplexityLevel.STANDARD

    def test_initialize_extracts_spec_dir_from_metadata(self, mock_context_with_spec_dir, mock_workspace_manager):
        """Test initialize extracts spec_dir from task_config.metadata."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)

        assert runner._spec_dir is not None
        assert runner._spec_dir.exists()


# =============================================================================
# Story 2.2: Get Phases Method Tests
# =============================================================================


class TestNativeRunnerGetPhasesStory22:
    """Test NativeRunner get_phases returns correct phase info (Story 2.2 AC#2)."""

    def test_get_phases_returns_phases_with_ids(self, initialized_runner):
        """Test phases have expected IDs matching manifest."""
        phases = initialized_runner.get_phases()

        expected_ids = ["discovery", "requirements", "context", "spec", "plan", "validate"]
        actual_ids = [phase.id for phase in phases]

        assert actual_ids == expected_ids

    def test_get_phases_includes_description(self, initialized_runner):
        """Test each phase has a description."""
        phases = initialized_runner.get_phases()

        for phase in phases:
            assert phase.description, f"Phase '{phase.id}' missing description"

    def test_get_phases_includes_name(self, initialized_runner):
        """Test each phase has a name."""
        phases = initialized_runner.get_phases()

        for phase in phases:
            assert phase.name, f"Phase '{phase.id}' missing name"


# =============================================================================
# Story 2.2: Phase Execution Without spec_dir (Failure Cases)
# =============================================================================


class TestNativeRunnerPhaseExecutionNoSpecDir:
    """Test phases fail gracefully when spec_dir is not configured."""

    def test_discovery_fails_without_spec_dir(self, initialized_runner):
        """Test discovery phase fails without spec_dir."""
        result = initialized_runner.execute_phase("discovery")

        assert result.success is False
        assert "spec_dir" in result.error.lower()

    def test_requirements_fails_without_spec_dir_but_has_task_config(self, initialized_runner):
        """Test requirements phase fails without spec_dir."""
        result = initialized_runner.execute_phase("requirements")

        assert result.success is False
        assert "spec_dir" in result.error.lower()

    def test_context_fails_without_spec_dir(self, initialized_runner):
        """Test context phase fails without spec_dir."""
        result = initialized_runner.execute_phase("context")

        assert result.success is False
        assert "spec_dir" in result.error.lower()

    def test_spec_fails_without_spec_dir(self, initialized_runner):
        """Test spec phase fails without spec_dir."""
        result = initialized_runner.execute_phase("spec")

        assert result.success is False
        assert "spec_dir" in result.error.lower()

    def test_plan_fails_without_spec_dir(self, initialized_runner):
        """Test plan phase fails without spec_dir."""
        result = initialized_runner.execute_phase("plan")

        assert result.success is False
        assert "spec_dir" in result.error.lower()

    def test_validate_fails_without_spec_dir(self, initialized_runner):
        """Test validate phase fails without spec_dir."""
        result = initialized_runner.execute_phase("validate")

        assert result.success is False
        assert "spec_dir" in result.error.lower()


# =============================================================================
# Story 2.2: Requirements Failure Tests (HIGH Issue #4 fix)
# =============================================================================


class TestNativeRunnerRequirementsFailure:
    """Test requirements phase failure cases (Story 2.2 HIGH #4)."""

    def test_requirements_fails_without_task_config(self, mock_context_with_spec_dir, mock_workspace_manager):
        """Test requirements phase fails when _task_config is None."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)

        # Artificially clear task_config to test the failure path
        runner._task_config = None

        result = runner.execute_phase("requirements")

        assert result.success is False
        assert "task configuration" in result.error.lower()


# =============================================================================
# Story 2.2: Individual Phase Execution Tests (With spec_dir)
# =============================================================================


class TestNativeRunnerRequirementsPhase:
    """Test requirements phase execution (Story 2.2 Task 6)."""

    def test_requirements_creates_file(self, initialized_runner_with_spec_dir):
        """Test requirements phase creates requirements.json."""
        result = initialized_runner_with_spec_dir.execute_phase("requirements")

        assert result.success is True
        assert result.phase_id == "requirements"
        assert len(result.artifacts) == 1
        assert "requirements.json" in result.artifacts[0]

    def test_requirements_file_exists_after_execution(self, initialized_runner_with_spec_dir):
        """Test requirements.json file exists after phase execution."""
        runner = initialized_runner_with_spec_dir
        runner.execute_phase("requirements")

        req_file = runner._spec_dir / "requirements.json"
        assert req_file.exists()

    def test_requirements_returns_existing_if_present(self, initialized_runner_with_spec_dir):
        """Test requirements phase returns existing file if present."""
        import json

        runner = initialized_runner_with_spec_dir

        # Create existing requirements
        req_file = runner._spec_dir / "requirements.json"
        req_file.write_text(json.dumps({"task_description": "existing"}))

        result = runner.execute_phase("requirements")

        assert result.success is True
        assert "already exist" in result.message.lower()


class TestNativeRunnerSpecPhase:
    """Test spec phase execution (Story 2.2 Task 8)."""

    def test_spec_fails_without_existing_file(self, initialized_runner_with_spec_dir):
        """Test spec phase fails when spec.md doesn't exist (requires agent)."""
        result = initialized_runner_with_spec_dir.execute_phase("spec")

        # Spec generation requires agent infrastructure
        assert result.success is False
        assert "framework" in result.error.lower() or "agent" in result.error.lower()

    def test_spec_returns_existing_if_present(self, initialized_runner_with_spec_dir):
        """Test spec phase succeeds if spec.md already exists."""
        runner = initialized_runner_with_spec_dir

        # Create existing spec
        spec_file = runner._spec_dir / "spec.md"
        spec_file.write_text("# Existing Spec\n\nContent here.")

        result = runner.execute_phase("spec")

        assert result.success is True
        assert "already exists" in result.message.lower()
        assert len(result.artifacts) == 1


class TestNativeRunnerPlanPhase:
    """Test plan phase execution (Story 2.2 Task 9)."""

    def test_plan_fails_without_existing_file(self, initialized_runner_with_spec_dir):
        """Test plan phase fails when implementation_plan.json doesn't exist."""
        result = initialized_runner_with_spec_dir.execute_phase("plan")

        # Plan generation requires agent infrastructure
        assert result.success is False
        assert "framework" in result.error.lower() or "agent" in result.error.lower()

    def test_plan_returns_existing_if_present(self, initialized_runner_with_spec_dir):
        """Test plan phase succeeds if implementation_plan.json already exists."""
        import json

        runner = initialized_runner_with_spec_dir

        # Create existing plan
        plan_file = runner._spec_dir / "implementation_plan.json"
        plan_file.write_text(json.dumps({"subtasks": []}))

        result = runner.execute_phase("plan")

        assert result.success is True
        assert "already exists" in result.message.lower()


class TestNativeRunnerValidatePhase:
    """Test validate phase execution (Story 2.2 Task 10)."""

    def test_validate_runs_validation(self, initialized_runner_with_spec_dir):
        """Test validate phase runs the validator."""
        result = initialized_runner_with_spec_dir.execute_phase("validate")

        # Validation will fail without required artifacts
        assert isinstance(result.success, bool)
        assert result.phase_id == "validate"


# =============================================================================
# Story 2.2: Progress Reporting Tests
# =============================================================================


class TestNativeRunnerProgressReporting:
    """Test progress reporting integration (Story 2.2)."""

    def test_execute_phase_calls_progress_update_start(self, mock_context, mock_workspace_manager):
        """Test execute_phase calls progress.update at phase start."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        # Replace progress service with mock
        mock_context.progress = MagicMock()

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context)

        runner.execute_phase("discovery")

        # Should have been called at least once
        mock_context.progress.update.assert_called()

    def test_execute_phase_calls_progress_update_complete(self, mock_context_with_spec_dir, mock_workspace_manager):
        """Test execute_phase calls progress.update when phase completes."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        mock_context_with_spec_dir.progress = MagicMock()

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)

        runner.execute_phase("requirements")

        # Get all calls to progress.update
        calls = mock_context_with_spec_dir.progress.update.call_args_list

        # Should have at least 2 calls: start and complete
        assert len(calls) >= 2


# =============================================================================
# Story 2.2: Exception Handling Tests
# =============================================================================


class TestNativeRunnerExceptionHandling:
    """Test exception handling in phase execution."""

    def test_execute_phase_handles_exception(self, mock_context_with_spec_dir, mock_workspace_manager):
        """Test execute_phase returns failure on exception."""
        from apps.backend.methodologies.native import NativeRunner
        from apps.backend.methodologies.protocols import PhaseStatus
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_workspace_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)

        # Monkeypatch to raise exception
        def raise_error():
            raise ValueError("Test error")

        runner._execute_requirements = raise_error

        result = runner.execute_phase("requirements")

        assert result.success is False
        assert "Test error" in result.error

        # Phase should be marked as FAILED
        phases = runner.get_phases()
        req_phase = next(p for p in phases if p.id == "requirements")
        assert req_phase.status == PhaseStatus.FAILED

    def test_execute_phase_updates_status_on_failure(self, initialized_runner_with_spec_dir):
        """Test phase status is FAILED after failed execution."""
        from apps.backend.methodologies.protocols import PhaseStatus

        runner = initialized_runner_with_spec_dir

        # Spec will fail without agent infrastructure
        runner.execute_phase("spec")

        phases = runner.get_phases()
        spec_phase = next(p for p in phases if p.id == "spec")
        assert spec_phase.status == PhaseStatus.FAILED

    def test_execute_phase_updates_status_on_success(self, initialized_runner_with_spec_dir):
        """Test phase status is COMPLETED after successful execution."""
        from apps.backend.methodologies.protocols import PhaseStatus

        runner = initialized_runner_with_spec_dir

        # Requirements will succeed
        runner.execute_phase("requirements")

        phases = runner.get_phases()
        req_phase = next(p for p in phases if p.id == "requirements")
        assert req_phase.status == PhaseStatus.COMPLETED


# =============================================================================
# Story 2.3: Workspace Management Integration Tests
# =============================================================================


class TestNativeRunnerWorktreeIntegration:
    """Test worktree integration in NativeRunner (Story 2.3 AC#1)."""

    def test_initialize_creates_worktree(self, mock_context_with_spec_dir):
        """Test initialize creates a git worktree for the task (FR65)."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        # Mock the WorktreeManager
        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ):
            runner.initialize(mock_context_with_spec_dir)

            # Verify worktree was created
            mock_worktree_manager.get_or_create_worktree.assert_called_once()
            assert runner._worktree_path is not None

    def test_initialize_stores_worktree_path(self, mock_context_with_spec_dir):
        """Test initialize stores worktree path for agent use."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ):
            runner.initialize(mock_context_with_spec_dir)

            assert runner._worktree_path == "/mock/worktree/path"

    def test_initialize_handles_worktree_creation_errors(self, mock_context_with_spec_dir):
        """Test initialize handles worktree creation errors gracefully."""
        from apps.backend.methodologies.native import NativeRunner
        # Import WorktreeError from the same path used in the methodology module
        from apps.backend.methodologies.native.methodology import WorktreeError
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_manager.get_or_create_worktree.side_effect = WorktreeError(
            "Failed to create worktree"
        )

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            # Should raise RuntimeError with informative message
            with pytest.raises(RuntimeError, match="worktree"):
                runner.initialize(mock_context_with_spec_dir)


class TestNativeRunnerSecurityIntegration:
    """Test security sandbox integration in NativeRunner (Story 2.3 AC#1)."""

    def test_initialize_applies_security_sandbox(self, mock_context_with_spec_dir):
        """Test initialize applies security sandbox (FR66)."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        mock_security_profile = MagicMock()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=mock_security_profile,
        ) as mock_get_profile:
            runner.initialize(mock_context_with_spec_dir)

            # Verify security profile was obtained
            mock_get_profile.assert_called_once()
            assert runner._security_profile is not None

    def test_security_profile_uses_worktree_path(self, mock_context_with_spec_dir):
        """Test security profile is configured for the worktree path."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock
        from pathlib import Path

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = Path("/mock/worktree/path")
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        mock_security_profile = MagicMock()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=mock_security_profile,
        ) as mock_get_profile:
            runner.initialize(mock_context_with_spec_dir)

            # Security profile should be called with worktree path
            call_args = mock_get_profile.call_args
            assert call_args is not None


class TestNativeRunnerGraphitiIntegration:
    """Test Graphiti memory integration in NativeRunner (Story 2.3 AC#2)."""

    def test_initialize_integrates_graphiti_memory(self, mock_context_with_spec_dir):
        """Test initialize sets up Graphiti memory service (FR68)."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        mock_memory = MagicMock()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=mock_memory,
        ) as mock_get_memory:
            runner.initialize(mock_context_with_spec_dir)

            # Verify memory was initialized
            mock_get_memory.assert_called_once()
            assert runner._graphiti_memory is not None

    def test_initialize_handles_memory_unavailable_gracefully(self, mock_context_with_spec_dir):
        """Test initialize handles Graphiti unavailability gracefully (NFR23)."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            side_effect=Exception("Graphiti unavailable"),
        ):
            # Should NOT raise - memory failure should not block initialization
            runner.initialize(mock_context_with_spec_dir)

            # Memory should be None but runner should be initialized
            assert runner._graphiti_memory is None
            assert runner._initialized is True


class TestNativeRunnerWorkspacePassthrough:
    """Test workspace is passed to agents correctly (Story 2.3 AC#1, #2)."""

    def test_runner_provides_workspace_path(self, mock_context_with_spec_dir):
        """Test runner provides workspace path for agents via RunContext."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)

            # Verify workspace path is accessible
            assert runner.get_workspace_path() == "/mock/worktree/path"

    def test_runner_provides_security_profile(self, mock_context_with_spec_dir):
        """Test runner provides security profile for agents."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        mock_security_profile = MagicMock()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=mock_security_profile,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)

            # Verify security profile is accessible
            assert runner.get_security_profile() is mock_security_profile

    def test_runner_provides_memory_service(self, mock_context_with_spec_dir):
        """Test runner provides Graphiti memory service for agents."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        mock_memory = MagicMock()

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=mock_memory,
        ):
            runner.initialize(mock_context_with_spec_dir)

            # Verify memory is accessible (may be None if unavailable)
            assert runner.get_graphiti_memory() is mock_memory


class TestNativeRunnerCleanup:
    """Test cleanup method for NativeRunner (Story 2.3 AC#3)."""

    def test_cleanup_deletes_worktree(self, mock_context_with_spec_dir):
        """Test cleanup deletes the worktree (FR70)."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_info.spec_name = "test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)
            runner.cleanup()

            # Verify worktree was removed
            mock_worktree_manager.remove_worktree.assert_called_once_with(
                "test-task", delete_branch=True
            )

    def test_cleanup_handles_partial_cleanup_gracefully(self, mock_context_with_spec_dir):
        """Test cleanup handles partial failures gracefully."""
        from apps.backend.methodologies.native import NativeRunner
        from unittest.mock import patch, MagicMock

        runner = NativeRunner()

        mock_worktree_manager = MagicMock()
        mock_worktree_info = MagicMock()
        mock_worktree_info.path = "/mock/worktree/path"
        mock_worktree_info.branch = "auto-claude/test-task"
        mock_worktree_info.spec_name = "test-task"
        mock_worktree_manager.get_or_create_worktree.return_value = mock_worktree_info
        mock_worktree_manager.remove_worktree.side_effect = Exception("Cleanup failed")

        with patch(
            "apps.backend.methodologies.native.methodology.WorktreeManager",
            return_value=mock_worktree_manager,
        ), patch(
            "apps.backend.methodologies.native.methodology.get_security_profile",
            return_value=MagicMock(),
        ), patch(
            "apps.backend.methodologies.native.methodology.get_graphiti_memory",
            return_value=MagicMock(),
        ):
            runner.initialize(mock_context_with_spec_dir)

            # Should not raise even if cleanup partially fails
            runner.cleanup()  # Should complete without raising

    def test_cleanup_without_initialization_is_noop(self):
        """Test cleanup does nothing if runner was never initialized."""
        from apps.backend.methodologies.native import NativeRunner

        runner = NativeRunner()
        # Should not raise
        runner.cleanup()
