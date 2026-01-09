"""
Edge Case Tests for PR Review Lifecycle
========================================

Tests for edge cases during PR review including:
- PR closed during review
- PR merged during review
- Force push during review
- Concurrent operations (multiple PRs)
- State recovery after interruptions
- Iteration boundary conditions
- Cancellation during various states

Run with: pytest tests/test_pr_review_edge_cases.py -v
"""

import asyncio
import os
import sys
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

# Add the backend directory to the path for imports
backend_path = Path(__file__).parent.parent / "apps" / "backend"
sys.path.insert(0, str(backend_path))

import pytest

from runners.github.services.auto_pr_review_orchestrator import (
    AutoPRReviewOrchestrator,
    OrchestratorCancelledError,
    OrchestratorResult,
    OrchestratorRunResult,
    reset_auto_pr_review_orchestrator,
)
from runners.github.services.pr_check_waiter import (
    ForcePushError,
    PRClosedError,
    PRCheckWaiter,
    WaitForChecksResult,
    WaitResult,
    reset_pr_check_waiter,
)
from runners.github.models_pkg.pr_review_state import (
    CheckStatus,
    CICheckResult,
    ExternalBotStatus,
    PRReviewOrchestratorState,
    PRReviewStatus,
)


class TestPRClosedDuringReview:
    """Tests for PR closed during review process."""

    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            github_dir = Path(tmpdir) / ".auto-claude" / "github"
            project_dir = Path(tmpdir)
            spec_dir = Path(tmpdir) / ".auto-claude" / "specs" / "001"
            github_dir.mkdir(parents=True)
            spec_dir.mkdir(parents=True)
            yield {"github": github_dir, "project": project_dir, "spec": spec_dir}

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()
        yield
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()

    @pytest.fixture
    def authorized_orchestrator(self, temp_dirs: dict) -> AutoPRReviewOrchestrator:
        """Create an orchestrator with authorized user."""
        with patch.dict(os.environ, {"GITHUB_AUTO_PR_REVIEW_ALLOWED_USERS": "*"}):
            return AutoPRReviewOrchestrator(
                github_dir=temp_dirs["github"],
                project_dir=temp_dirs["project"],
                spec_dir=temp_dirs["spec"],
                log_enabled=False,
            )

    # =========================================================================
    # PR Closed Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_pr_closed_during_wait_for_checks(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test handling when PR is closed during CI check waiting."""
        # Mock wait_for_checks to return PR_CLOSED
        mock_result = WaitForChecksResult(
            result=WaitResult.PR_CLOSED,
            all_passed=False,
            pr_state="closed",
            error_message="PR was closed during wait",
        )

        with patch.object(
            authorized_orchestrator, "_wait_for_checks", return_value=mock_result
        ):
            with patch.object(
                authorized_orchestrator, "_get_pr_head_sha", return_value="sha123"
            ):
                with patch.object(authorized_orchestrator, "_get_pr_files", return_value=[]):
                    result = await authorized_orchestrator.run(
                        pr_number=123,
                        repo="owner/repo",
                        pr_url="https://github.com/owner/repo/pull/123",
                        branch_name="feature",
                        triggered_by="testuser",
                    )

        assert result.result == OrchestratorResult.PR_CLOSED
        assert result.pr_number == 123

    @pytest.mark.asyncio
    async def test_pr_closed_state_persisted(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test that PR closed state is properly persisted."""
        mock_result = WaitForChecksResult(
            result=WaitResult.PR_CLOSED,
            all_passed=False,
            pr_state="closed",
        )

        with patch.object(
            authorized_orchestrator, "_wait_for_checks", return_value=mock_result
        ):
            with patch.object(
                authorized_orchestrator, "_get_pr_head_sha", return_value="sha123"
            ):
                with patch.object(authorized_orchestrator, "_get_pr_files", return_value=[]):
                    result = await authorized_orchestrator.run(
                        pr_number=456,
                        repo="owner/repo",
                        pr_url="https://github.com/owner/repo/pull/456",
                        branch_name="feature",
                        triggered_by="testuser",
                    )

        # Verify state was saved
        state = authorized_orchestrator._load_state(456)
        assert state is not None
        assert state.status == PRReviewStatus.CANCELLED

    def test_pr_closed_exception_handling(self) -> None:
        """Test PRClosedError exception properties."""
        error = PRClosedError("closed")
        assert error.pr_state == "closed"
        assert "closed" in str(error)

        error_merged = PRClosedError("merged")
        assert error_merged.pr_state == "merged"


class TestPRMergedDuringReview:
    """Tests for PR merged during review process."""

    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            github_dir = Path(tmpdir) / ".auto-claude" / "github"
            project_dir = Path(tmpdir)
            spec_dir = Path(tmpdir) / ".auto-claude" / "specs" / "001"
            github_dir.mkdir(parents=True)
            spec_dir.mkdir(parents=True)
            yield {"github": github_dir, "project": project_dir, "spec": spec_dir}

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()
        yield
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()

    @pytest.fixture
    def authorized_orchestrator(self, temp_dirs: dict) -> AutoPRReviewOrchestrator:
        """Create an orchestrator with authorized user."""
        with patch.dict(os.environ, {"GITHUB_AUTO_PR_REVIEW_ALLOWED_USERS": "*"}):
            return AutoPRReviewOrchestrator(
                github_dir=temp_dirs["github"],
                project_dir=temp_dirs["project"],
                spec_dir=temp_dirs["spec"],
                log_enabled=False,
            )

    # =========================================================================
    # PR Merged Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_pr_merged_during_wait_for_checks(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test handling when PR is merged externally during CI check waiting."""
        mock_result = WaitForChecksResult(
            result=WaitResult.PR_MERGED,
            all_passed=True,
            pr_state="merged",
        )

        with patch.object(
            authorized_orchestrator, "_wait_for_checks", return_value=mock_result
        ):
            with patch.object(
                authorized_orchestrator, "_get_pr_head_sha", return_value="sha123"
            ):
                with patch.object(authorized_orchestrator, "_get_pr_files", return_value=[]):
                    result = await authorized_orchestrator.run(
                        pr_number=789,
                        repo="owner/repo",
                        pr_url="https://github.com/owner/repo/pull/789",
                        branch_name="feature",
                        triggered_by="testuser",
                    )

        assert result.result == OrchestratorResult.PR_MERGED
        assert result.ci_all_passed is True

    @pytest.mark.asyncio
    async def test_pr_merged_state_is_completed(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test that merged PR state is set to COMPLETED."""
        mock_result = WaitForChecksResult(
            result=WaitResult.PR_MERGED,
            all_passed=True,
            pr_state="merged",
        )

        with patch.object(
            authorized_orchestrator, "_wait_for_checks", return_value=mock_result
        ):
            with patch.object(
                authorized_orchestrator, "_get_pr_head_sha", return_value="sha123"
            ):
                with patch.object(authorized_orchestrator, "_get_pr_files", return_value=[]):
                    await authorized_orchestrator.run(
                        pr_number=101,
                        repo="owner/repo",
                        pr_url="https://github.com/owner/repo/pull/101",
                        branch_name="feature",
                        triggered_by="testuser",
                    )

        state = authorized_orchestrator._load_state(101)
        assert state is not None
        assert state.status == PRReviewStatus.COMPLETED


class TestForcePushDuringReview:
    """Tests for force push during review process."""

    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            github_dir = Path(tmpdir) / ".auto-claude" / "github"
            project_dir = Path(tmpdir)
            spec_dir = Path(tmpdir) / ".auto-claude" / "specs" / "001"
            github_dir.mkdir(parents=True)
            spec_dir.mkdir(parents=True)
            yield {"github": github_dir, "project": project_dir, "spec": spec_dir}

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()
        yield
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()

    @pytest.fixture
    def authorized_orchestrator(self, temp_dirs: dict) -> AutoPRReviewOrchestrator:
        """Create an orchestrator with authorized user."""
        with patch.dict(os.environ, {"GITHUB_AUTO_PR_REVIEW_ALLOWED_USERS": "*"}):
            return AutoPRReviewOrchestrator(
                github_dir=temp_dirs["github"],
                project_dir=temp_dirs["project"],
                spec_dir=temp_dirs["spec"],
                max_iterations=3,
                log_enabled=False,
            )

    # =========================================================================
    # Force Push Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_force_push_detected_restarts_iteration(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test that force push detection restarts the current iteration."""
        call_count = 0

        async def mock_wait_for_checks(state, on_progress=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                # First call - simulate force push
                return WaitForChecksResult(
                    result=WaitResult.FORCE_PUSH,
                    all_passed=False,
                    final_head_sha="new_sha_456",
                    error_message="Force push detected: old_sha -> new_sha_456",
                )
            else:
                # Second call - all checks pass
                return WaitForChecksResult(
                    result=WaitResult.SUCCESS,
                    all_passed=True,
                    ci_checks=[
                        CICheckResult(name="build", status=CheckStatus.PASSED)
                    ],
                )

        with patch.object(
            authorized_orchestrator, "_wait_for_checks", mock_wait_for_checks
        ):
            with patch.object(
                authorized_orchestrator, "_get_pr_head_sha", return_value="sha123"
            ):
                with patch.object(authorized_orchestrator, "_get_pr_files", return_value=[]):
                    result = await authorized_orchestrator.run(
                        pr_number=202,
                        repo="owner/repo",
                        pr_url="https://github.com/owner/repo/pull/202",
                        branch_name="feature",
                        triggered_by="testuser",
                    )

        # Should succeed after force push restart
        assert result.result == OrchestratorResult.READY_TO_MERGE
        # Force push shouldn't count as an iteration
        assert result.iterations_completed == 1

    def test_force_push_exception_properties(self) -> None:
        """Test ForcePushError exception properties."""
        error = ForcePushError("abc123", "def456")
        assert error.old_sha == "abc123"
        assert error.new_sha == "def456"
        assert "abc123" in str(error)
        assert "def456" in str(error)

    @pytest.mark.asyncio
    async def test_force_push_updates_head_sha(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test that force push updates the tracked HEAD SHA."""
        call_count = 0

        async def mock_wait_for_checks(state, on_progress=None):
            nonlocal call_count
            call_count += 1
            if call_count == 1:
                return WaitForChecksResult(
                    result=WaitResult.FORCE_PUSH,
                    all_passed=False,
                    final_head_sha="new_sha_789",
                )
            else:
                return WaitForChecksResult(
                    result=WaitResult.SUCCESS,
                    all_passed=True,
                )

        with patch.object(
            authorized_orchestrator, "_wait_for_checks", mock_wait_for_checks
        ):
            with patch.object(
                authorized_orchestrator, "_get_pr_head_sha", return_value="old_sha"
            ):
                with patch.object(authorized_orchestrator, "_get_pr_files", return_value=[]):
                    await authorized_orchestrator.run(
                        pr_number=303,
                        repo="owner/repo",
                        pr_url="https://github.com/owner/repo/pull/303",
                        branch_name="feature",
                        triggered_by="testuser",
                    )

        state = authorized_orchestrator._load_state(303)
        assert state is not None
        assert state.last_known_head_sha == "new_sha_789"


class TestConcurrentOperations:
    """Tests for concurrent PR review operations."""

    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            github_dir = Path(tmpdir) / ".auto-claude" / "github"
            project_dir = Path(tmpdir)
            spec_dir = Path(tmpdir) / ".auto-claude" / "specs" / "001"
            github_dir.mkdir(parents=True)
            spec_dir.mkdir(parents=True)
            yield {"github": github_dir, "project": project_dir, "spec": spec_dir}

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()
        yield
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()

    # =========================================================================
    # Concurrent Operations Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrent_reviews(self, temp_dirs: dict) -> None:
        """Test that semaphore limits the number of concurrent reviews."""
        with patch.dict(os.environ, {"GITHUB_AUTO_PR_REVIEW_ALLOWED_USERS": "*"}):
            orchestrator = AutoPRReviewOrchestrator(
                github_dir=temp_dirs["github"],
                project_dir=temp_dirs["project"],
                spec_dir=temp_dirs["spec"],
                max_concurrent_reviews=2,
                log_enabled=False,
            )

        # Verify semaphore is initialized correctly
        assert orchestrator._semaphore._value == 2

    @pytest.mark.asyncio
    async def test_active_reviews_tracking(self, temp_dirs: dict) -> None:
        """Test that active reviews are properly tracked."""
        with patch.dict(os.environ, {"GITHUB_AUTO_PR_REVIEW_ALLOWED_USERS": "*"}):
            orchestrator = AutoPRReviewOrchestrator(
                github_dir=temp_dirs["github"],
                project_dir=temp_dirs["project"],
                spec_dir=temp_dirs["spec"],
                log_enabled=False,
            )

        # Initially no active reviews
        assert len(orchestrator.get_active_reviews()) == 0
        assert orchestrator.get_queue_size() == 0

    @pytest.mark.asyncio
    async def test_cancellation_events_tracked_per_pr(self, temp_dirs: dict) -> None:
        """Test that cancellation events are tracked per PR number."""
        with patch.dict(os.environ, {"GITHUB_AUTO_PR_REVIEW_ALLOWED_USERS": "*"}):
            orchestrator = AutoPRReviewOrchestrator(
                github_dir=temp_dirs["github"],
                project_dir=temp_dirs["project"],
                spec_dir=temp_dirs["spec"],
                log_enabled=False,
            )

        # Manually add cancel events for testing
        orchestrator._cancel_events[100] = asyncio.Event()
        orchestrator._cancel_events[200] = asyncio.Event()

        # Cancel only PR 100
        result = orchestrator.cancel(100)
        assert result is True
        assert orchestrator._cancel_events[100].is_set()
        assert not orchestrator._cancel_events[200].is_set()

        # Cancel non-existent PR
        result = orchestrator.cancel(999)
        assert result is False


class TestCancellationDuringReview:
    """Tests for cancellation during various review states."""

    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            github_dir = Path(tmpdir) / ".auto-claude" / "github"
            project_dir = Path(tmpdir)
            spec_dir = Path(tmpdir) / ".auto-claude" / "specs" / "001"
            github_dir.mkdir(parents=True)
            spec_dir.mkdir(parents=True)
            yield {"github": github_dir, "project": project_dir, "spec": spec_dir}

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()
        yield
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()

    @pytest.fixture
    def authorized_orchestrator(self, temp_dirs: dict) -> AutoPRReviewOrchestrator:
        """Create an orchestrator with authorized user."""
        with patch.dict(os.environ, {"GITHUB_AUTO_PR_REVIEW_ALLOWED_USERS": "*"}):
            return AutoPRReviewOrchestrator(
                github_dir=temp_dirs["github"],
                project_dir=temp_dirs["project"],
                spec_dir=temp_dirs["spec"],
                log_enabled=False,
            )

    # =========================================================================
    # Cancellation Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_cancellation_during_wait_for_checks(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test cancellation during wait for checks phase."""
        mock_result = WaitForChecksResult(
            result=WaitResult.CANCELLED,
            all_passed=False,
        )

        with patch.object(
            authorized_orchestrator, "_wait_for_checks", return_value=mock_result
        ):
            with patch.object(
                authorized_orchestrator, "_get_pr_head_sha", return_value="sha123"
            ):
                with patch.object(authorized_orchestrator, "_get_pr_files", return_value=[]):
                    result = await authorized_orchestrator.run(
                        pr_number=404,
                        repo="owner/repo",
                        pr_url="https://github.com/owner/repo/pull/404",
                        branch_name="feature",
                        triggered_by="testuser",
                    )

        assert result.result == OrchestratorResult.CANCELLED

    def test_check_cancelled_raises_when_set(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test _check_cancelled raises OrchestratorCancelledError when cancelled."""
        authorized_orchestrator._cancel_events[123] = asyncio.Event()
        authorized_orchestrator._cancel_events[123].set()

        with pytest.raises(OrchestratorCancelledError) as exc_info:
            authorized_orchestrator._check_cancelled(123)
        assert "123" in str(exc_info.value)

    def test_check_cancelled_does_not_raise_when_not_set(
        self, temp_dirs: dict, authorized_orchestrator: AutoPRReviewOrchestrator
    ) -> None:
        """Test _check_cancelled does not raise when not cancelled."""
        authorized_orchestrator._cancel_events[123] = asyncio.Event()
        # Event is not set
        authorized_orchestrator._check_cancelled(123)  # Should not raise

    def test_state_cancellation_request(self) -> None:
        """Test state cancellation request tracking."""
        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
        )

        assert state.cancellation_requested is False
        assert state.should_continue() is True

        state.request_cancellation("testuser")

        assert state.cancellation_requested is True
        assert state.cancelled_by == "testuser"
        assert state.cancelled_at is not None
        assert state.should_continue() is False


class TestIterationBoundaryConditions:
    """Tests for iteration boundary conditions."""

    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            github_dir = Path(tmpdir) / ".auto-claude" / "github"
            project_dir = Path(tmpdir)
            spec_dir = Path(tmpdir) / ".auto-claude" / "specs" / "001"
            github_dir.mkdir(parents=True)
            spec_dir.mkdir(parents=True)
            yield {"github": github_dir, "project": project_dir, "spec": spec_dir}

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()
        yield
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()

    # =========================================================================
    # Iteration Boundary Tests
    # =========================================================================

    def test_max_iterations_at_boundary(self) -> None:
        """Test behavior at exact max iterations boundary."""
        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
            max_iterations=3,
        )

        # Iterate to max
        for i in range(3):
            assert state.should_continue() is True
            state.start_iteration()

        # At max - should not continue
        assert state.current_iteration == 3
        assert state.should_continue() is False

    def test_max_iterations_with_single_allowed(self) -> None:
        """Test with max_iterations=1."""
        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
            max_iterations=1,
        )

        assert state.should_continue() is True
        state.start_iteration()
        assert state.current_iteration == 1
        assert state.should_continue() is False

    def test_iteration_history_tracking(self) -> None:
        """Test that iteration history is properly tracked."""
        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
        )

        # First iteration
        state.start_iteration()
        state.complete_iteration(
            findings_count=5,
            fixes_applied=3,
            ci_status="passed",
        )

        # Second iteration
        state.start_iteration()
        state.complete_iteration(
            findings_count=2,
            fixes_applied=2,
            ci_status="passed",
        )

        assert len(state.iteration_history) == 2
        assert state.iteration_history[0].findings_count == 5
        assert state.iteration_history[0].fixes_applied == 3
        assert state.iteration_history[1].findings_count == 2
        assert state.iteration_history[1].fixes_applied == 2


class TestStateRecovery:
    """Tests for state recovery after interruptions."""

    @pytest.fixture
    def temp_dirs(self):
        """Create temporary directories for testing."""
        with tempfile.TemporaryDirectory() as tmpdir:
            github_dir = Path(tmpdir) / ".auto-claude" / "github"
            project_dir = Path(tmpdir)
            spec_dir = Path(tmpdir) / ".auto-claude" / "specs" / "001"
            github_dir.mkdir(parents=True)
            spec_dir.mkdir(parents=True)
            yield {"github": github_dir, "project": project_dir, "spec": spec_dir}

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()
        yield
        reset_auto_pr_review_orchestrator()
        reset_pr_check_waiter()

    # =========================================================================
    # State Recovery Tests
    # =========================================================================

    def test_state_save_and_load(self, temp_dirs: dict) -> None:
        """Test saving and loading state for recovery."""
        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
            status=PRReviewStatus.AWAITING_CHECKS,
            current_iteration=2,
            max_iterations=5,
            last_known_head_sha="sha456",
        )

        # Save state
        state.save_sync(temp_dirs["github"])

        # Load state
        loaded = PRReviewOrchestratorState.load(temp_dirs["github"], 123)

        assert loaded is not None
        assert loaded.pr_number == 123
        assert loaded.repo == "owner/repo"
        assert loaded.status == PRReviewStatus.AWAITING_CHECKS
        assert loaded.current_iteration == 2
        assert loaded.last_known_head_sha == "sha456"

    def test_load_nonexistent_state(self, temp_dirs: dict) -> None:
        """Test loading state that doesn't exist."""
        loaded = PRReviewOrchestratorState.load(temp_dirs["github"], 999)
        assert loaded is None

    def test_active_state_detection(self, temp_dirs: dict) -> None:
        """Test detection of active (non-terminal) states."""
        # Create active state
        active_state = PRReviewOrchestratorState(
            pr_number=100,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/100",
            branch_name="feature",
            status=PRReviewStatus.AWAITING_CHECKS,
        )
        active_state.save_sync(temp_dirs["github"])

        # Create terminal state
        terminal_state = PRReviewOrchestratorState(
            pr_number=200,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/200",
            branch_name="feature",
            status=PRReviewStatus.COMPLETED,
        )
        terminal_state.save_sync(temp_dirs["github"])

        # Load all active
        active_states = PRReviewOrchestratorState.load_all_active(temp_dirs["github"])

        assert len(active_states) == 1
        assert active_states[0].pr_number == 100

    def test_state_with_applied_fixes_recovery(self, temp_dirs: dict) -> None:
        """Test recovery of state with applied fixes history."""
        from runners.github.models_pkg.pr_review_state import AppliedFix

        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
        )

        # Add applied fixes
        fix = AppliedFix(
            fix_id="fix-001",
            finding_id="finding-001",
            file_path="src/main.py",
            description="Fixed type error",
            commit_sha="abc123",
            success=True,
        )
        state.add_applied_fix(fix)

        # Save and reload
        state.save_sync(temp_dirs["github"])
        loaded = PRReviewOrchestratorState.load(temp_dirs["github"], 123)

        assert loaded is not None
        assert len(loaded.applied_fixes) == 1
        assert loaded.applied_fixes[0].fix_id == "fix-001"
        assert loaded.applied_fixes[0].file_path == "src/main.py"


class TestErrorTracking:
    """Tests for error tracking during review."""

    # =========================================================================
    # Error Tracking Tests
    # =========================================================================

    def test_error_recording(self) -> None:
        """Test error recording increments counters."""
        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
        )

        assert state.error_count == 0
        assert state.consecutive_failures == 0

        state.record_error("First error")
        assert state.error_count == 1
        assert state.consecutive_failures == 1
        assert state.last_error == "First error"

        state.record_error("Second error")
        assert state.error_count == 2
        assert state.consecutive_failures == 2
        assert state.last_error == "Second error"

    def test_consecutive_failures_cleared_on_success(self) -> None:
        """Test consecutive failures cleared but total preserved."""
        state = PRReviewOrchestratorState(
            pr_number=123,
            repo="owner/repo",
            pr_url="https://github.com/owner/repo/pull/123",
            branch_name="feature",
        )

        state.record_error("Error 1")
        state.record_error("Error 2")
        assert state.consecutive_failures == 2
        assert state.error_count == 2

        state.clear_consecutive_failures()
        assert state.consecutive_failures == 0
        assert state.error_count == 2  # Total preserved


class TestPRCheckWaiterEdgeCases:
    """Tests for PRCheckWaiter edge cases."""

    @pytest.fixture(autouse=True)
    def reset_singletons(self):
        """Reset module singletons before each test."""
        reset_pr_check_waiter()
        yield
        reset_pr_check_waiter()

    # =========================================================================
    # PRCheckWaiter Edge Case Tests
    # =========================================================================

    @pytest.mark.asyncio
    async def test_pr_closed_during_poll(self) -> None:
        """Test PRCheckWaiter handles PR closed during polling."""
        waiter = PRCheckWaiter(log_enabled=False)

        async def mock_fetch_ci_checks(pr_number, repo):
            return (
                [CICheckResult(name="build", status=CheckStatus.PASSED)],
                "sha123",
                "closed",  # PR was closed
            )

        with patch.object(waiter, "_fetch_ci_checks", mock_fetch_ci_checks):
            result = await waiter.wait_for_all_checks(
                pr_number=123,
                repo="owner/repo",
                expected_bots=[],
            )

        assert result.result == WaitResult.PR_CLOSED
        assert result.pr_state == "closed"

    @pytest.mark.asyncio
    async def test_pr_merged_during_poll(self) -> None:
        """Test PRCheckWaiter handles PR merged during polling."""
        waiter = PRCheckWaiter(log_enabled=False)

        async def mock_fetch_ci_checks(pr_number, repo):
            return (
                [CICheckResult(name="build", status=CheckStatus.PASSED)],
                "sha123",
                "merged",  # PR was merged
            )

        with patch.object(waiter, "_fetch_ci_checks", mock_fetch_ci_checks):
            result = await waiter.wait_for_all_checks(
                pr_number=123,
                repo="owner/repo",
                expected_bots=[],
            )

        assert result.result == WaitResult.PR_MERGED

    @pytest.mark.asyncio
    async def test_force_push_during_poll(self) -> None:
        """Test PRCheckWaiter detects force push during polling."""
        waiter = PRCheckWaiter(log_enabled=False)

        async def mock_fetch_ci_checks(pr_number, repo):
            return (
                [CICheckResult(name="build", status=CheckStatus.PASSED)],
                "new_sha",  # Different from initial
                "open",
            )

        with patch.object(waiter, "_fetch_ci_checks", mock_fetch_ci_checks):
            result = await waiter.wait_for_all_checks(
                pr_number=123,
                repo="owner/repo",
                expected_bots=[],
                head_sha="old_sha",  # Initial SHA differs
            )

        assert result.result == WaitResult.FORCE_PUSH
        assert result.final_head_sha == "new_sha"
        assert "old_sha" in result.error_message
        assert "new_sha" in result.error_message

    @pytest.mark.asyncio
    async def test_cancellation_during_poll_loop(self) -> None:
        """Test cancellation during poll loop."""
        waiter = PRCheckWaiter(
            ci_timeout=10.0,
            poll_interval=0.1,
            log_enabled=False,
        )

        async def cancel_soon():
            await asyncio.sleep(0.05)
            waiter.cancel()

        async def mock_fetch_ci_checks(pr_number, repo):
            return (
                [CICheckResult(name="build", status=CheckStatus.PENDING)],
                "sha123",
                "open",
            )

        with patch.object(waiter, "_fetch_ci_checks", mock_fetch_ci_checks):
            cancel_task = asyncio.create_task(cancel_soon())
            result = await waiter.wait_for_all_checks(
                pr_number=123,
                repo="owner/repo",
                expected_bots=[],
            )
            await cancel_task

        assert result.result == WaitResult.CANCELLED

    def test_waiter_reset_clears_state(self) -> None:
        """Test waiter reset clears all state."""
        waiter = PRCheckWaiter(log_enabled=False)

        # Set some state
        waiter._cancelled = True
        waiter._poll_count = 10
        waiter._error_count = 5
        waiter._consecutive_failures = 3

        # Reset
        waiter.reset()

        assert waiter._cancelled is False
        assert waiter._poll_count == 0
        assert waiter._error_count == 0
        assert waiter._consecutive_failures == 0


class TestStatusTransitions:
    """Tests for status transition edge cases."""

    # =========================================================================
    # Status Transition Tests
    # =========================================================================

    def test_all_terminal_states_identified(self) -> None:
        """Test all terminal states are correctly identified."""
        terminal_states = PRReviewStatus.terminal_states()

        assert PRReviewStatus.READY_TO_MERGE in terminal_states
        assert PRReviewStatus.COMPLETED in terminal_states
        assert PRReviewStatus.CANCELLED in terminal_states
        assert PRReviewStatus.FAILED in terminal_states
        assert PRReviewStatus.MAX_ITERATIONS_REACHED in terminal_states

        # Active states should not be in terminal
        assert PRReviewStatus.PENDING not in terminal_states
        assert PRReviewStatus.AWAITING_CHECKS not in terminal_states
        assert PRReviewStatus.REVIEWING not in terminal_states
        assert PRReviewStatus.FIXING not in terminal_states

    def test_all_active_states_identified(self) -> None:
        """Test all active states are correctly identified."""
        active_states = PRReviewStatus.active_states()

        assert PRReviewStatus.PENDING in active_states
        assert PRReviewStatus.AWAITING_CHECKS in active_states
        assert PRReviewStatus.REVIEWING in active_states
        assert PRReviewStatus.FIXING in active_states

        # Terminal states should not be active
        assert PRReviewStatus.READY_TO_MERGE not in active_states
        assert PRReviewStatus.COMPLETED not in active_states

    def test_should_continue_stops_on_terminal(self) -> None:
        """Test should_continue returns False for all terminal states."""
        for status in PRReviewStatus.terminal_states():
            state = PRReviewOrchestratorState(
                pr_number=123,
                repo="owner/repo",
                pr_url="https://github.com/owner/repo/pull/123",
                branch_name="feature",
                status=status,
            )
            assert state.should_continue() is False, f"Expected False for {status}"

    def test_should_continue_allows_active(self) -> None:
        """Test should_continue returns True for active states (when under max iterations)."""
        for status in PRReviewStatus.active_states():
            state = PRReviewOrchestratorState(
                pr_number=123,
                repo="owner/repo",
                pr_url="https://github.com/owner/repo/pull/123",
                branch_name="feature",
                status=status,
                max_iterations=5,
            )
            assert state.should_continue() is True, f"Expected True for {status}"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
