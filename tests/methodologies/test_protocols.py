"""Tests for methodology protocol interfaces and supporting types.

Tests Protocol type checking, dataclass instantiation, and exception hierarchy.
"""
import pytest
from dataclasses import fields, is_dataclass
from typing import Protocol, runtime_checkable, get_type_hints


class TestPackageStructure:
    """Test that the methodologies package exists and exports correctly."""

    def test_methodologies_package_importable(self):
        """Test that methodologies package can be imported."""
        import apps.backend.methodologies
        assert apps.backend.methodologies is not None

    def test_protocols_module_importable(self):
        """Test that protocols module can be imported."""
        from apps.backend.methodologies import protocols
        assert protocols is not None

    def test_exceptions_module_importable(self):
        """Test that exceptions module can be imported."""
        from apps.backend.methodologies import exceptions
        assert exceptions is not None

    def test_package_exports_all_types(self):
        """Test that __all__ exports the expected types."""
        from apps.backend.methodologies import (
            # Core Protocol
            MethodologyRunner,
            # Supporting dataclasses
            RunContext,
            Phase,
            PhaseResult,
            Checkpoint,
            Artifact,
            # Additional Protocols
            MethodologyRegistry,
            TaskStateManager,
            NotificationService,
            # Exceptions
            PluginError,
            ManifestValidationError,
            PluginLoadError,
            ProtocolViolationError,
        )
        # All imports should succeed
        assert MethodologyRunner is not None
        assert RunContext is not None


class TestMethodologyRunnerProtocol:
    """Test the MethodologyRunner Protocol interface."""

    def test_methodology_runner_is_protocol(self):
        """Test that MethodologyRunner is a Protocol."""
        from apps.backend.methodologies.protocols import MethodologyRunner
        # Check if it's a Protocol subclass
        assert hasattr(MethodologyRunner, '__protocol_attrs__') or issubclass(MethodologyRunner, Protocol)

    def test_methodology_runner_is_runtime_checkable(self):
        """Test that MethodologyRunner can be used with isinstance() at runtime."""
        from apps.backend.methodologies.protocols import MethodologyRunner
        # Runtime checkable protocols have __subclasshook__
        assert hasattr(MethodologyRunner, '__subclasshook__') or hasattr(MethodologyRunner, '_is_runtime_protocol')

    def test_methodology_runner_required_methods(self):
        """Test that MethodologyRunner defines all required methods."""
        from apps.backend.methodologies.protocols import MethodologyRunner
        required_methods = [
            'initialize',
            'get_phases',
            'execute_phase',
            'get_checkpoints',
            'get_artifacts',
        ]
        for method in required_methods:
            assert hasattr(MethodologyRunner, method), f"Missing method: {method}"

    def test_methodology_runner_type_hints_complete(self):
        """Test that MethodologyRunner has complete type hints."""
        from apps.backend.methodologies.protocols import MethodologyRunner
        hints = get_type_hints(MethodologyRunner)
        # Should have hints for all methods
        assert hints is not None


class TestRunContextDataclass:
    """Test the RunContext dataclass."""

    def test_run_context_is_dataclass(self):
        """Test that RunContext is a dataclass."""
        from apps.backend.methodologies.protocols import RunContext
        assert is_dataclass(RunContext)

    def test_run_context_required_fields(self):
        """Test that RunContext has all required fields."""
        from apps.backend.methodologies.protocols import RunContext
        field_names = {f.name for f in fields(RunContext)}
        required_fields = {
            'workspace',
            'memory',
            'progress',
            'checkpoint',
            'llm',
            'task_config',
        }
        assert required_fields.issubset(field_names), f"Missing fields: {required_fields - field_names}"

    def test_run_context_type_hints(self):
        """Test that RunContext has type hints on all fields."""
        from apps.backend.methodologies.protocols import RunContext
        hints = get_type_hints(RunContext)
        assert 'workspace' in hints
        assert 'memory' in hints


class TestPhaseDataclass:
    """Test the Phase dataclass."""

    def test_phase_is_dataclass(self):
        """Test that Phase is a dataclass."""
        from apps.backend.methodologies.protocols import Phase
        assert is_dataclass(Phase)

    def test_phase_required_fields(self):
        """Test that Phase has required fields for progress UI."""
        from apps.backend.methodologies.protocols import Phase
        field_names = {f.name for f in fields(Phase)}
        # Phase should have id and name at minimum
        assert 'id' in field_names
        assert 'name' in field_names


class TestPhaseResultDataclass:
    """Test the PhaseResult dataclass."""

    def test_phase_result_is_dataclass(self):
        """Test that PhaseResult is a dataclass."""
        from apps.backend.methodologies.protocols import PhaseResult
        assert is_dataclass(PhaseResult)

    def test_phase_result_has_success_field(self):
        """Test that PhaseResult indicates success/failure."""
        from apps.backend.methodologies.protocols import PhaseResult
        field_names = {f.name for f in fields(PhaseResult)}
        assert 'success' in field_names


class TestCheckpointDataclass:
    """Test the Checkpoint dataclass."""

    def test_checkpoint_is_dataclass(self):
        """Test that Checkpoint is a dataclass."""
        from apps.backend.methodologies.protocols import Checkpoint
        assert is_dataclass(Checkpoint)

    def test_checkpoint_required_fields(self):
        """Test that Checkpoint has required fields for Semi-Auto."""
        from apps.backend.methodologies.protocols import Checkpoint
        field_names = {f.name for f in fields(Checkpoint)}
        # Checkpoint should identify the pause point
        assert 'id' in field_names
        assert 'name' in field_names


class TestArtifactDataclass:
    """Test the Artifact dataclass."""

    def test_artifact_is_dataclass(self):
        """Test that Artifact is a dataclass."""
        from apps.backend.methodologies.protocols import Artifact
        assert is_dataclass(Artifact)

    def test_artifact_required_fields(self):
        """Test that Artifact has required fields."""
        from apps.backend.methodologies.protocols import Artifact
        field_names = {f.name for f in fields(Artifact)}
        # Artifact should have id and type at minimum
        assert 'id' in field_names
        assert 'artifact_type' in field_names


class TestAdditionalProtocols:
    """Test additional Protocol interfaces."""

    def test_methodology_registry_is_protocol(self):
        """Test that MethodologyRegistry is a Protocol."""
        from apps.backend.methodologies.protocols import MethodologyRegistry
        assert hasattr(MethodologyRegistry, '__protocol_attrs__') or issubclass(MethodologyRegistry, Protocol)

    def test_methodology_registry_required_methods(self):
        """Test MethodologyRegistry has required methods."""
        from apps.backend.methodologies.protocols import MethodologyRegistry
        required_methods = [
            'list_installed',
            'get_methodology',
            'install',
            'uninstall',
        ]
        for method in required_methods:
            assert hasattr(MethodologyRegistry, method), f"Missing method: {method}"

    def test_methodology_info_is_dataclass(self):
        """Test that MethodologyInfo is a dataclass."""
        from apps.backend.methodologies.protocols import MethodologyInfo
        assert is_dataclass(MethodologyInfo)

    def test_methodology_info_required_fields(self):
        """Test that MethodologyInfo has required fields."""
        from apps.backend.methodologies.protocols import MethodologyInfo
        field_names = {f.name for f in fields(MethodologyInfo)}
        required_fields = {'name', 'version'}
        assert required_fields.issubset(field_names), f"Missing fields: {required_fields - field_names}"

    def test_task_state_manager_is_protocol(self):
        """Test that TaskStateManager is a Protocol."""
        from apps.backend.methodologies.protocols import TaskStateManager
        assert hasattr(TaskStateManager, '__protocol_attrs__') or issubclass(TaskStateManager, Protocol)

    def test_task_state_manager_required_methods(self):
        """Test TaskStateManager has required methods."""
        from apps.backend.methodologies.protocols import TaskStateManager
        required_methods = [
            'save_state',
            'load_state',
            'list_tasks',
            'get_paused_tasks',
        ]
        for method in required_methods:
            assert hasattr(TaskStateManager, method), f"Missing method: {method}"

    def test_notification_service_is_protocol(self):
        """Test that NotificationService is a Protocol."""
        from apps.backend.methodologies.protocols import NotificationService
        assert hasattr(NotificationService, '__protocol_attrs__') or issubclass(NotificationService, Protocol)

    def test_notification_service_required_methods(self):
        """Test NotificationService has required methods."""
        from apps.backend.methodologies.protocols import NotificationService
        required_methods = [
            'notify_checkpoint',
            'notify_progress',
            'notify_completion',
        ]
        for method in required_methods:
            assert hasattr(NotificationService, method), f"Missing method: {method}"


class TestExceptionHierarchy:
    """Test the exception hierarchy."""

    def test_plugin_error_exists(self):
        """Test that PluginError exception exists."""
        from apps.backend.methodologies.exceptions import PluginError
        assert issubclass(PluginError, Exception)

    def test_plugin_error_is_auto_claude_error(self):
        """Test that PluginError inherits from AutoClaudeError."""
        from apps.backend.methodologies.exceptions import PluginError, AutoClaudeError
        assert issubclass(PluginError, AutoClaudeError)

    def test_manifest_validation_error_inherits_plugin_error(self):
        """Test ManifestValidationError inherits from PluginError."""
        from apps.backend.methodologies.exceptions import ManifestValidationError, PluginError
        assert issubclass(ManifestValidationError, PluginError)

    def test_plugin_load_error_inherits_plugin_error(self):
        """Test PluginLoadError inherits from PluginError."""
        from apps.backend.methodologies.exceptions import PluginLoadError, PluginError
        assert issubclass(PluginLoadError, PluginError)

    def test_protocol_violation_error_inherits_plugin_error(self):
        """Test ProtocolViolationError inherits from PluginError."""
        from apps.backend.methodologies.exceptions import ProtocolViolationError, PluginError
        assert issubclass(ProtocolViolationError, PluginError)

    def test_exceptions_are_instantiable_with_message(self):
        """Test that all exceptions can be instantiated with a message."""
        from pathlib import Path
        from apps.backend.methodologies.exceptions import (
            PluginError,
            ManifestValidationError,
            PluginLoadError,
            ProtocolViolationError,
        )

        msg = "test error message"

        e1 = PluginError(msg)
        assert str(e1) == msg

        # ManifestValidationError now requires path and errors list
        test_path = Path("/test/manifest.yaml")
        e2 = ManifestValidationError(test_path, [msg])
        assert msg in str(e2)
        assert str(test_path) in str(e2)
        assert e2.path == test_path
        assert e2.errors == [msg]

        e3 = PluginLoadError(msg)
        assert str(e3) == msg

        e4 = ProtocolViolationError(msg)
        assert str(e4) == msg


class TestProtocolStructuralTyping:
    """Test that Protocol enables structural typing (duck typing)."""

    def test_methodology_runner_structural_typing(self):
        """Test that any class implementing the methods satisfies the Protocol."""
        from apps.backend.methodologies.protocols import (
            MethodologyRunner,
            RunContext,
            Phase,
            PhaseResult,
            Checkpoint,
            Artifact,
        )

        # Create a mock implementation
        class MockRunner:
            def initialize(self, context: RunContext) -> None:
                pass

            def get_phases(self) -> list[Phase]:
                return []

            def execute_phase(self, phase_id: str) -> PhaseResult:
                return PhaseResult(success=True, phase_id=phase_id)

            def get_checkpoints(self) -> list[Checkpoint]:
                return []

            def get_artifacts(self) -> list[Artifact]:
                return []

        runner = MockRunner()
        # Should be able to check against protocol at runtime
        assert isinstance(runner, MethodologyRunner)


class TestDataclassInstantiation:
    """Test that dataclasses can be instantiated properly."""

    def test_phase_instantiation(self):
        """Test Phase can be instantiated."""
        from apps.backend.methodologies.protocols import Phase
        phase = Phase(id="test", name="Test Phase")
        assert phase.id == "test"
        assert phase.name == "Test Phase"

    def test_phase_result_instantiation(self):
        """Test PhaseResult can be instantiated."""
        from apps.backend.methodologies.protocols import PhaseResult
        result = PhaseResult(success=True, phase_id="test")
        assert result.success is True
        assert result.phase_id == "test"

    def test_checkpoint_instantiation(self):
        """Test Checkpoint can be instantiated."""
        from apps.backend.methodologies.protocols import Checkpoint
        checkpoint = Checkpoint(id="cp1", name="Review Point")
        assert checkpoint.id == "cp1"
        assert checkpoint.name == "Review Point"

    def test_artifact_instantiation(self):
        """Test Artifact can be instantiated."""
        from apps.backend.methodologies.protocols import Artifact
        artifact = Artifact(id="art1", artifact_type="spec")
        assert artifact.id == "art1"
        assert artifact.artifact_type == "spec"

    def test_methodology_info_instantiation(self):
        """Test MethodologyInfo can be instantiated."""
        from apps.backend.methodologies.protocols import MethodologyInfo
        info = MethodologyInfo(name="native", version="1.0.0")
        assert info.name == "native"
        assert info.version == "1.0.0"
        assert info.description == ""
        assert info.is_verified is False


class TestEnums:
    """Test enum definitions and values."""

    def test_execution_mode_values(self):
        """Test ExecutionMode enum has correct values per architecture."""
        from apps.backend.methodologies.protocols import ExecutionMode
        assert ExecutionMode.FULL_AUTO.value == "full_auto"
        assert ExecutionMode.SEMI_AUTO.value == "semi_auto"
        # Ensure only expected members exist
        assert len(ExecutionMode) == 2

    def test_complexity_level_values(self):
        """Test ComplexityLevel enum has correct values per architecture."""
        from apps.backend.methodologies.protocols import ComplexityLevel
        assert ComplexityLevel.QUICK.value == "quick"
        assert ComplexityLevel.STANDARD.value == "standard"
        assert ComplexityLevel.COMPLEX.value == "complex"
        assert len(ComplexityLevel) == 3

    def test_phase_status_values(self):
        """Test PhaseStatus enum has all required states."""
        from apps.backend.methodologies.protocols import PhaseStatus
        assert PhaseStatus.PENDING.value == "pending"
        assert PhaseStatus.IN_PROGRESS.value == "in_progress"
        assert PhaseStatus.COMPLETED.value == "completed"
        assert PhaseStatus.FAILED.value == "failed"
        assert PhaseStatus.SKIPPED.value == "skipped"
        assert len(PhaseStatus) == 5

    def test_checkpoint_status_values(self):
        """Test CheckpointStatus enum has all required states."""
        from apps.backend.methodologies.protocols import CheckpointStatus
        assert CheckpointStatus.PENDING.value == "pending"
        assert CheckpointStatus.WAITING.value == "waiting"
        assert CheckpointStatus.APPROVED.value == "approved"
        assert CheckpointStatus.REJECTED.value == "rejected"
        assert len(CheckpointStatus) == 4

    def test_enums_are_proper_enum_types(self):
        """Test that all enums are proper Enum subclasses."""
        from enum import Enum
        from apps.backend.methodologies.protocols import (
            ExecutionMode,
            ComplexityLevel,
            PhaseStatus,
            CheckpointStatus,
        )
        assert issubclass(ExecutionMode, Enum)
        assert issubclass(ComplexityLevel, Enum)
        assert issubclass(PhaseStatus, Enum)
        assert issubclass(CheckpointStatus, Enum)


class TestTaskConfig:
    """Test TaskConfig dataclass."""

    def test_task_config_is_dataclass(self):
        """Test that TaskConfig is a dataclass."""
        from apps.backend.methodologies.protocols import TaskConfig
        assert is_dataclass(TaskConfig)

    def test_task_config_default_values(self):
        """Test TaskConfig has correct default values."""
        from apps.backend.methodologies.protocols import (
            TaskConfig,
            ComplexityLevel,
            ExecutionMode,
        )
        config = TaskConfig()
        assert config.complexity == ComplexityLevel.STANDARD
        assert config.execution_mode == ExecutionMode.FULL_AUTO
        assert config.task_id == ""
        assert config.task_name == ""
        assert config.metadata == {}

    def test_task_config_custom_values(self):
        """Test TaskConfig can be instantiated with custom values."""
        from apps.backend.methodologies.protocols import (
            TaskConfig,
            ComplexityLevel,
            ExecutionMode,
        )
        config = TaskConfig(
            complexity=ComplexityLevel.COMPLEX,
            execution_mode=ExecutionMode.SEMI_AUTO,
            task_id="task-123",
            task_name="My Task",
            metadata={"key": "value"},
        )
        assert config.complexity == ComplexityLevel.COMPLEX
        assert config.execution_mode == ExecutionMode.SEMI_AUTO
        assert config.task_id == "task-123"
        assert config.task_name == "My Task"
        assert config.metadata == {"key": "value"}


class TestServiceProtocolsRuntimeCheckable:
    """Test that service protocol stubs are runtime checkable."""

    def test_workspace_service_is_runtime_checkable(self):
        """Test WorkspaceService can be used with isinstance()."""
        from apps.backend.methodologies.protocols import WorkspaceService

        class MockWorkspace:
            def get_project_root(self) -> str:
                return "/project"

        assert isinstance(MockWorkspace(), WorkspaceService)

    def test_memory_service_is_runtime_checkable(self):
        """Test MemoryService can be used with isinstance()."""
        from apps.backend.methodologies.protocols import MemoryService

        class MockMemory:
            def get_context(self, query: str) -> str:
                return "context"

        assert isinstance(MockMemory(), MemoryService)

    def test_progress_service_is_runtime_checkable(self):
        """Test ProgressService can be used with isinstance()."""
        from apps.backend.methodologies.protocols import ProgressService, ProgressEvent

        class MockProgress:
            def update(self, phase_id: str, progress: float, message: str) -> None:
                pass

            def emit(self, event: ProgressEvent) -> None:
                pass

        assert isinstance(MockProgress(), ProgressService)

    def test_checkpoint_service_is_runtime_checkable(self):
        """Test CheckpointService can be used with isinstance()."""
        from apps.backend.methodologies.protocols import CheckpointService
        from typing import Any

        class MockCheckpoint:
            def create_checkpoint(self, checkpoint_id: str, data: dict[str, Any]) -> Any:
                return None

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

        assert isinstance(MockCheckpoint(), CheckpointService)

    def test_llm_service_is_runtime_checkable(self):
        """Test LLMService can be used with isinstance()."""
        from apps.backend.methodologies.protocols import LLMService

        class MockLLM:
            def generate(self, prompt: str) -> str:
                return "response"

        assert isinstance(MockLLM(), LLMService)


class TestNegativeAndEdgeCases:
    """Test negative scenarios and edge cases."""

    def test_exception_with_no_message(self):
        """Test exceptions can be instantiated without a message (except ManifestValidationError)."""
        from pathlib import Path
        from apps.backend.methodologies.exceptions import (
            PluginError,
            ManifestValidationError,
            PluginLoadError,
            ProtocolViolationError,
        )

        e1 = PluginError()
        assert str(e1) == ""

        # ManifestValidationError requires path and errors - test with empty errors
        test_path = Path("/test/manifest.yaml")
        e2 = ManifestValidationError(test_path, [])
        assert str(test_path) in str(e2)

        e3 = PluginLoadError()
        assert str(e3) == ""

        e4 = ProtocolViolationError("")
        assert str(e4) == ""

        # Test ProtocolViolationError with full arguments
        e5 = ProtocolViolationError(
            message="Missing methods",
            methodology_name="test-plugin",
            missing_methods=["get_phases", "execute_phase"],
        )
        assert e5.methodology_name == "test-plugin"
        assert "get_phases" in e5.missing_methods
        assert "execute_phase" in e5.missing_methods

    def test_exception_with_multiple_args(self):
        """Test exceptions handle multiple arguments."""
        from apps.backend.methodologies.exceptions import PluginError

        e = PluginError("error", "additional", "info")
        assert "error" in str(e)

    def test_exception_can_be_raised_and_caught(self):
        """Test exceptions can be raised and caught properly."""
        from pathlib import Path
        from apps.backend.methodologies.exceptions import (
            AutoClaudeError,
            PluginError,
            ManifestValidationError,
        )

        test_path = Path("/test/manifest.yaml")

        # Catch specific exception
        with pytest.raises(ManifestValidationError) as exc_info:
            raise ManifestValidationError(test_path, ["Invalid manifest"])
        assert "Invalid manifest" in str(exc_info.value)

        # Catch parent exception
        with pytest.raises(PluginError):
            raise ManifestValidationError(test_path, ["Caught as PluginError"])

        # Catch grandparent exception
        with pytest.raises(AutoClaudeError):
            raise ManifestValidationError(test_path, ["Caught as AutoClaudeError"])

    def test_phase_result_with_failure(self):
        """Test PhaseResult can represent failure state."""
        from apps.backend.methodologies.protocols import PhaseResult

        result = PhaseResult(
            success=False,
            phase_id="failed-phase",
            error="Something went wrong",
        )
        assert result.success is False
        assert result.phase_id == "failed-phase"
        assert result.error == "Something went wrong"

    def test_phase_with_optional_status(self):
        """Test Phase can be marked as optional with skipped status."""
        from apps.backend.methodologies.protocols import Phase, PhaseStatus

        phase = Phase(
            id="optional-phase",
            name="Optional Phase",
            is_optional=True,
            status=PhaseStatus.SKIPPED,
        )
        assert phase.is_optional is True
        assert phase.status == PhaseStatus.SKIPPED

    def test_checkpoint_rejected_status(self):
        """Test Checkpoint can have rejected status."""
        from apps.backend.methodologies.protocols import Checkpoint, CheckpointStatus

        checkpoint = Checkpoint(
            id="review",
            name="Review Point",
            status=CheckpointStatus.REJECTED,
        )
        assert checkpoint.status == CheckpointStatus.REJECTED

    def test_dataclass_with_empty_strings(self):
        """Test dataclasses handle empty string values."""
        from apps.backend.methodologies.protocols import Phase, Artifact

        phase = Phase(id="", name="")
        assert phase.id == ""
        assert phase.name == ""

        artifact = Artifact(id="", artifact_type="")
        assert artifact.id == ""
        assert artifact.artifact_type == ""

    def test_dataclass_with_empty_metadata(self):
        """Test dataclasses handle empty metadata dictionaries."""
        from apps.backend.methodologies.protocols import PhaseResult, Artifact

        result = PhaseResult(success=True, phase_id="test", metadata={})
        assert result.metadata == {}

        artifact = Artifact(id="test", artifact_type="spec", metadata={})
        assert artifact.metadata == {}

    def test_non_implementing_class_fails_isinstance(self):
        """Test that classes not implementing Protocol fail isinstance check."""
        from apps.backend.methodologies.protocols import MethodologyRunner

        class IncompleteRunner:
            def initialize(self, context) -> None:
                pass
            # Missing other required methods

        runner = IncompleteRunner()
        # Should fail isinstance check due to missing methods
        assert not isinstance(runner, MethodologyRunner)

    def test_methodology_info_with_all_fields(self):
        """Test MethodologyInfo with all optional fields populated."""
        from apps.backend.methodologies.protocols import MethodologyInfo

        info = MethodologyInfo(
            name="bmad",
            version="2.0.0",
            description="BMAD Methodology",
            author="BMAD Team",
            complexity_levels=["quick", "standard", "complex"],
            execution_modes=["full_auto", "semi_auto"],
            is_verified=True,
            install_path="/path/to/bmad",
        )
        assert info.name == "bmad"
        assert info.version == "2.0.0"
        assert info.description == "BMAD Methodology"
        assert info.author == "BMAD Team"
        assert info.complexity_levels == ["quick", "standard", "complex"]
        assert info.execution_modes == ["full_auto", "semi_auto"]
        assert info.is_verified is True
        assert info.install_path == "/path/to/bmad"
