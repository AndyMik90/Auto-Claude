#!/usr/bin/env python3
"""
End-to-End Verification: Validation Failure Recovery Workflow
===========================================================

This test performs comprehensive end-to-end verification of the validation failure recovery workflow
to ensure that when QA validation fails, the system automatically re-engages the coder agent with
validation feedback.

Test Scenarios:
1. Validation failure scenario trigger
2. Automatic coder agent re-engagement verification
3. Feedback loop integration verification
4. Retry limit enforcement verification
"""

import json
import sys
import tempfile
import shutil
import subprocess
from pathlib import Path
from datetime import datetime
from unittest.mock import MagicMock, patch, AsyncMock
import pytest
import asyncio

# Add auto-claude directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "auto-claude"))

# Mock external SDK modules before importing auto-claude modules
def setup_mocks():
    """Setup comprehensive mocks for external dependencies."""
    # Mock claude_code_sdk
    mock_code_sdk = MagicMock()
    mock_code_sdk.ClaudeSDKClient = MagicMock()
    mock_code_sdk.ClaudeCodeOptions = MagicMock()
    mock_code_types = MagicMock()
    mock_code_types.HookMatcher = MagicMock()
    sys.modules['claude_code_sdk'] = mock_code_sdk
    sys.modules['claude_code_sdk.types'] = mock_code_types

    # Mock claude_agent_sdk
    mock_agent_sdk = MagicMock()
    mock_agent_sdk.ClaudeSDKClient = MagicMock()
    mock_agent_sdk.ClaudeCodeOptions = MagicMock()
    mock_agent_types = MagicMock()
    mock_agent_types.HookMatcher = MagicMock()
    sys.modules['claude_agent_sdk'] = mock_agent_sdk
    sys.modules['claude_agent_sdk.types'] = mock_agent_types

setup_mocks()

# Import auto-claude modules after mocking
from cli.build_commands import handle_validation_failure_recovery, _check_validation_recovery_needed
from agents.coder import handle_validation_recovery as coder_handle_validation_recovery
from services.recovery import ValidationRecoveryManager, RetryConfig
from qa.loop import get_recovery_feedback
from agents.session import process_validation_feedback


class TestValidationFailureRecoveryE2E:
    """End-to-end test class for validation failure recovery workflow."""

    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace with project and spec directories."""
        temp_dir = Path(tempfile.mkdtemp())
        project_dir = temp_dir / "project"
        spec_dir = temp_dir / "spec"

        project_dir.mkdir(parents=True)
        spec_dir.mkdir(parents=True)

        # Initialize git repo in project directory
        subprocess.run(["git", "init"], cwd=project_dir, capture_output=True, check=True)
        subprocess.run(["git", "config", "user.email", "test@example.com"], cwd=project_dir, capture_output=True)
        subprocess.run(["git", "config", "user.name", "Test User"], cwd=project_dir, capture_output=True)

        # Create initial commit
        (project_dir / "README.md").write_text("# Test Project\n")
        subprocess.run(["git", "add", "."], cwd=project_dir, capture_output=True)
        subprocess.run(["git", "commit", "-m", "Initial commit"], cwd=project_dir, capture_output=True)

        yield temp_dir, project_dir, spec_dir

        shutil.rmtree(temp_dir, ignore_errors=True)

    @pytest.fixture
    def sample_implementation_plan(self):
        """Create a sample implementation plan for testing."""
        return {
            "feature": "Test Feature",
            "workflow_type": "feature",
            "phases": [
                {
                    "id": "phase-1",
                    "name": "Test Phase",
                    "type": "implementation",
                    "depends_on": [],
                    "subtasks": [
                        {
                            "id": "subtask-1-1",
                            "description": "Test subtask",
                            "service": "auto-claude",
                            "status": "pending",
                            "files_to_modify": ["test_file.py"],
                            "files_to_create": [],
                            "patterns_from": ["test_file.py"],
                            "verification": {
                                "type": "command",
                                "command": "echo 'test'",
                                "expected": "test"
                            }
                        }
                    ]
                }
            ],
            "status": "in_progress",
            "qa_signoff": None,
            "created_at": datetime.now().isoformat(),
            "updated_at": datetime.now().isoformat()
        }

    @pytest.fixture
    def setup_validation_failure_files(self, temp_workspace):
        """Setup files that simulate a validation failure scenario."""
        temp_dir, project_dir, spec_dir = temp_workspace

        # Create implementation_plan.json
        plan = {
            "feature": "Test Feature for Validation Recovery",
            "status": "in_progress",
            "phases": [
                {
                    "id": "phase-1",
                    "subtasks": [
                        {
                            "id": "subtask-1-1",
                            "description": "Test subtask that failed validation",
                            "status": "in_progress"
                        }
                    ]
                }
            ]
        }
        (spec_dir / "implementation_plan.json").write_text(json.dumps(plan, indent=2))

        # Create qa_report.md indicating validation failure
        qa_report = """# QA Validation Report

## Status: REJECTED

### Issues Found
1. Test failure: Unit tests are failing
2. Build error: Compilation failed
3. Missing functionality: Feature not implemented correctly

### Iteration History
- Attempt 1: Failed with test failures
- Attempt 2: Failed with build errors

### Recommendation
Re-engage coder agent to address these issues.
"""
        (spec_dir / "qa_report.md").write_text(qa_report)

        # Create QA_FIX_REQUEST.md with specific fix requests
        fix_request = """# QA Fix Request

## Critical Issues to Fix
1. Fix unit test failures in test_file.py
2. Resolve compilation errors in main.py
3. Complete implementation of missing feature

## Files to Modify
- test_file.py: Fix failing tests
- main.py: Fix compilation errors
- feature.py: Complete implementation

## Guidance
Focus on the test failures first, then address build issues.
"""
        (spec_dir / "QA_FIX_REQUEST.md").write_text(fix_request)

        # Create HUMAN_INPUT.md with additional guidance
        human_input = """# Human Guidance

## Priority Order
1. Fix critical test failures
2. Resolve build errors
3. Complete missing functionality

## Additional Notes
- Ensure all tests pass before build
- Follow existing code patterns
- Add proper error handling
"""
        (spec_dir / "HUMAN_INPUT.md").write_text(human_input)

        return spec_dir

    def test_validation_failure_recovery_detection(self, setup_validation_failure_files):
        """Test 1: Validation failure scenario trigger detection."""
        spec_dir = setup_validation_failure_files

        # Verify that recovery is detected as needed
        recovery_needed = _check_validation_recovery_needed(spec_dir)
        assert recovery_needed, "Validation failure recovery should be detected"

        # Test without failure files
        (spec_dir / "qa_report.md").unlink()
        recovery_not_needed = _check_validation_recovery_needed(spec_dir)
        assert not recovery_not_needed, "Recovery should not be needed when qa_report.md is missing"

        print("✅ Test 1 PASSED: Validation failure detection works correctly")

    @patch('cli.build_commands.run_agent_session')
    @patch('cli.build_commands.post_session_processing')
    def test_automatic_coder_agent_re_engagement(self, mock_post_session, mock_agent_session, setup_validation_failure_files):
        """Test 2: Verify automatic coder agent re-engagement."""
        spec_dir = setup_validation_failure_files

        # Mock successful agent session and post-session processing
        mock_agent_session.return_value = (True, "Recovery fixes applied successfully")
        mock_post_session.return_value = True

        # Call the validation failure recovery handler
        result = handle_validation_failure_recovery(
            spec_dir=spec_dir,
            max_attempts=2
        )

        # Verify that agent session was called (indicating re-engagement)
        assert mock_agent_session.called, "Coder agent should be re-engaged for recovery"

        # Verify the recovery prompt contains feedback from QA files
        call_args = mock_agent_session.call_args
        assert call_args is not None, "Agent session should be called with arguments"

        prompt_file = call_args[0][1]  # Second argument is prompt file
        prompt_content = Path(prompt_file).read_text()

        # Check that prompt contains validation feedback
        assert "Test failure" in prompt_content, "Recovery prompt should contain QA feedback"
        assert "Fix unit test failures" in prompt_content, "Recovery prompt should contain fix requests"
        assert "Priority Order" in prompt_content, "Recovery prompt should contain human guidance"

        print("✅ Test 2 PASSED: Automatic coder agent re-engagement works correctly")

    def test_feedback_loop_integration(self, setup_validation_failure_files):
        """Test 3: Verify feedback loop integration."""
        spec_dir = setup_validation_failure_files

        # Test QA recovery feedback collection
        feedback = get_recovery_feedback(spec_dir)

        assert feedback is not None, "Recovery feedback should be collected"
        assert feedback['validation_status'] == 'rejected', "Feedback should show rejected status"
        assert len(feedback['issues']) > 0, "Feedback should contain issues"
        assert feedback['escalation_needed'] is not None, "Feedback should indicate escalation status"

        # Test session validation feedback processing
        session_feedback = process_validation_feedback(spec_dir)

        assert session_feedback is not None, "Session feedback should be processed"
        assert session_feedback['validation_status'] == 'issues_found', "Session feedback should show issues"
        assert len(session_feedback['recovery_suggestions']) > 0, "Session feedback should contain recovery suggestions"

        # Verify feedback contains recurring issue detection
        assert 'recurring_issues' in session_feedback, "Feedback should detect recurring issues"

        print("✅ Test 3 PASSED: Feedback loop integration works correctly")

    def test_retry_limit_enforcement(self, setup_validation_failure_files):
        """Test 4: Verify retry limit enforcement."""
        spec_dir = setup_validation_failure_files

        # Create validation recovery manager with custom retry config
        retry_config = RetryConfig(max_attempts=2, backoff_factor=1.0, initial_delay=0.1)
        recovery_manager = ValidationRecoveryManager(retry_config)

        subtask_id = "subtask-1-1"

        # Test that retries are allowed within limit
        assert recovery_manager.can_retry(subtask_id), "First retry should be allowed"
        recovery_manager.record_validation_attempt(subtask_id, success=False)

        assert recovery_manager.can_retry(subtask_id), "Second retry should be allowed"
        recovery_manager.record_validation_attempt(subtask_id, success=False)

        # Test that retries are blocked after limit reached
        assert not recovery_manager.can_retry(subtask_id), "Third retry should be blocked (max_attempts=2)"

        # Test retry count tracking
        retry_count = recovery_manager.get_retry_count(subtask_id)
        assert retry_count == 2, f"Retry count should be 2, got {retry_count}"

        # Test escalation detection
        recovery_context = recovery_manager.get_recovery_context(subtask_id)
        assert recovery_context['attempts'] == 2, "Recovery context should track attempts"
        assert recovery_context['can_retry'] == False, "Recovery context should show no more retries"
        assert recovery_context['escalation_recommended'] == True, "Recovery context should recommend escalation"

        print("✅ Test 4 PASSED: Retry limit enforcement works correctly")

    @patch('cli.build_commands.run_agent_session')
    @patch('cli.build_commands.post_session_processing')
    def test_successful_recovery_workflow(self, mock_post_session, mock_agent_session, temp_workspace, sample_implementation_plan):
        """Test 5: Complete successful recovery workflow end-to-end."""
        temp_dir, project_dir, spec_dir = temp_workspace

        # Setup initial state
        (spec_dir / "implementation_plan.json").write_text(json.dumps(sample_implementation_plan, indent=2))

        # Create validation failure scenario
        (spec_dir / "qa_report.md").write_text("# QA Report\nStatus: REJECTED\nIssues: Test failures")
        (spec_dir / "QA_FIX_REQUEST.md").write_text("# Fix Request\nFix: Unit tests")

        # Mock successful recovery
        mock_agent_session.return_value = (True, "Recovery successful")
        mock_post_session.return_value = True

        # Run recovery workflow
        result = handle_validation_failure_recovery(
            spec_dir=spec_dir,
            max_attempts=1
        )

        # Verify successful recovery
        assert result is True, "Recovery workflow should succeed"
        assert mock_agent_session.called, "Agent should be engaged for recovery"

        # Verify cleanup after successful recovery
        assert not (spec_dir / "qa_report.md").exists(), "qa_report.md should be cleaned up after successful recovery"
        assert not (spec_dir / "QA_FIX_REQUEST.md").exists(), "QA_FIX_REQUEST.md should be cleaned up"

        print("✅ Test 5 PASSED: Complete successful recovery workflow works correctly")

    @patch('cli.build_commands.run_agent_session')
    def test_max_attempts_exceeded_escalation(self, mock_agent_session, setup_validation_failure_files):
        """Test 6: Verify escalation when max attempts are exceeded."""
        spec_dir = setup_validation_failure_files

        # Mock failed recovery attempts
        mock_agent_session.return_value = (False, "Recovery failed")

        # Run recovery with max_attempts=1 to trigger escalation quickly
        result = handle_validation_failure_recovery(
            spec_dir=spec_dir,
            max_attempts=1
        )

        # Verify escalation file is created
        escalation_file = spec_dir / "VALIDATION_ESCALATION.md"
        assert escalation_file.exists(), "Escalation file should be created when max attempts exceeded"

        escalation_content = escalation_file.read_text()
        assert "VALIDATION ESCALATION" in escalation_content, "Escalation file should contain proper header"
        assert "recovery attempts have been exhausted" in escalation_content, "Escalation file should explain reason"

        print("✅ Test 6 PASSED: Max attempts exceeded escalation works correctly")


# Test runner function
def run_validation_recovery_e2e_tests():
    """Run all validation recovery end-to-end tests."""
    print("🚀 Starting Validation Failure Recovery E2E Tests\n")

    test_instance = TestValidationFailureRecoveryE2E()

    tests = [
        ("Validation Failure Detection", test_instance.test_validation_failure_recovery_detection),
        ("Automatic Coder Agent Re-engagement", test_instance.test_automatic_coder_agent_re_engagement),
        ("Feedback Loop Integration", test_instance.test_feedback_loop_integration),
        ("Retry Limit Enforcement", test_instance.test_retry_limit_enforcement),
        ("Successful Recovery Workflow", test_instance.test_successful_recovery_workflow),
        ("Max Attempts Exceeded Escalation", test_instance.test_max_attempts_exceeded_escalation),
    ]

    passed = 0
    failed = 0

    for test_name, test_func in tests:
        try:
            print(f"🧪 Running: {test_name}")
            # Setup fixtures manually since we're not using pytest runner
            temp_workspace = test_instance.temp_workspace()
            setup_validation_failure_files = test_instance.setup_validation_failure_files(temp_workspace)

            if test_name == "Automatic Coder Agent Re-engagement":
                with patch('cli.build_commands.run_agent_session') as mock_agent_session, \
                     patch('cli.build_commands.post_session_processing') as mock_post_session:
                    mock_agent_session.return_value = (True, "Recovery successful")
                    mock_post_session.return_value = True
                    test_func(setup_validation_failure_files)
            elif test_name == "Successful Recovery Workflow":
                with patch('cli.build_commands.run_agent_session') as mock_agent_session, \
                     patch('cli.build_commands.post_session_processing') as mock_post_session:
                    mock_agent_session.return_value = (True, "Recovery successful")
                    mock_post_session.return_value = True
                    sample_plan = test_instance.sample_implementation_plan()
                    test_func(temp_workspace, sample_plan)
            elif test_name == "Max Attempts Exceeded Escalation":
                with patch('cli.build_commands.run_agent_session') as mock_agent_session:
                    mock_agent_session.return_value = (False, "Recovery failed")
                    test_func(setup_validation_failure_files)
            else:
                test_func(setup_validation_failure_files)

            passed += 1
            print(f"✅ {test_name} - PASSED\n")

        except Exception as e:
            failed += 1
            print(f"❌ {test_name} - FAILED: {e}\n")

    print(f"📊 Test Results: {passed} passed, {failed} failed")

    if failed == 0:
        print("🎉 All validation failure recovery E2E tests PASSED!")
        return True
    else:
        print("💥 Some validation failure recovery E2E tests FAILED!")
        return False


if __name__ == "__main__":
    success = run_validation_recovery_e2e_tests()
    sys.exit(0 if success else 1)