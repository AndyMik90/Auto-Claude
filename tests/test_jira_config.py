#!/usr/bin/env python3
"""
Tests for JIRA Integration Configuration
========================================

Unit tests for apps/backend/integrations/jira/config.py
"""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Import the module under test
from integrations.jira.config import (
    JiraConfig,
    JiraProjectState,
    STATUS_TODO,
    STATUS_IN_PROGRESS,
    STATUS_IN_REVIEW,
    STATUS_DONE,
    STATUS_BLOCKED,
    PRIORITY_ORDER,
    SUBTASK_TO_JIRA_STATUS,
    JIRA_PROJECT_MARKER,
    get_creator_label,
    get_jira_status,
    get_priority_for_phase,
    format_subtask_description,
    format_session_comment,
    format_stuck_subtask_comment,
)


class TestStatusConstants:
    """Test status constants are defined correctly."""

    def test_status_constants_exist(self):
        """Verify all status constants are defined."""
        assert STATUS_TODO == "To Do"
        assert STATUS_IN_PROGRESS == "In Progress"
        assert STATUS_IN_REVIEW == "In Review"
        assert STATUS_DONE == "Done"
        assert STATUS_BLOCKED == "Blocked"

    def test_priority_order(self):
        """Verify priority order is correct."""
        assert PRIORITY_ORDER["Highest"] == 1
        assert PRIORITY_ORDER["High"] == 2
        assert PRIORITY_ORDER["Medium"] == 3
        assert PRIORITY_ORDER["Low"] == 4
        assert PRIORITY_ORDER["Lowest"] == 5

    def test_subtask_status_mapping(self):
        """Verify subtask to JIRA status mapping."""
        assert SUBTASK_TO_JIRA_STATUS["pending"] == STATUS_TODO
        assert SUBTASK_TO_JIRA_STATUS["in_progress"] == STATUS_IN_PROGRESS
        assert SUBTASK_TO_JIRA_STATUS["review"] == STATUS_IN_REVIEW
        assert SUBTASK_TO_JIRA_STATUS["completed"] == STATUS_DONE
        assert SUBTASK_TO_JIRA_STATUS["blocked"] == STATUS_BLOCKED
        assert SUBTASK_TO_JIRA_STATUS["failed"] == STATUS_BLOCKED
        assert SUBTASK_TO_JIRA_STATUS["stuck"] == STATUS_BLOCKED


class TestGetCreatorLabel:
    """Test get_creator_label function."""

    def test_with_email(self):
        """Test label generation from email."""
        label = get_creator_label("john.doe@company.com")
        assert label == "created-by-john-doe"

    def test_with_underscore_email(self):
        """Test label generation with underscores in email."""
        label = get_creator_label("john_doe@company.com")
        assert label == "created-by-john-doe"

    def test_with_env_fallback(self):
        """Test fallback to environment variable."""
        with patch.dict(os.environ, {"JIRA_EMAIL": "env.user@test.com"}):
            label = get_creator_label()
            assert label == "created-by-env-user"

    def test_empty_without_email(self):
        """Test returns empty when no email available."""
        with patch.dict(os.environ, {}, clear=True):
            label = get_creator_label()
            assert label == ""

    def test_empty_with_invalid_email(self):
        """Test returns empty with invalid email format."""
        label = get_creator_label("not-an-email")
        assert label == ""


class TestJiraConfig:
    """Test JiraConfig dataclass."""

    def test_from_env(self):
        """Test creating config from environment variables."""
        env = {
            "JIRA_MCP_SERVER": "test-jira",
            "JIRA_MCP_START_SCRIPT": "/path/to/script.sh",
            "JIRA_HOST": "https://test.atlassian.net",
            "JIRA_EMAIL": "test@example.com",
            "JIRA_API_TOKEN": "secret-token",
            "JIRA_DEFAULT_PROJECT": "TEST",
            "JIRA_ENABLED": "true",
        }
        with patch.dict(os.environ, env, clear=True):
            config = JiraConfig.from_env()
            assert config.mcp_server_name == "test-jira"
            assert config.host == "https://test.atlassian.net"
            assert config.email == "test@example.com"
            assert config.api_token == "secret-token"
            assert config.default_project == "TEST"
            assert config.enabled is True

    def test_from_env_disabled(self):
        """Test config with disabled integration."""
        env = {"JIRA_ENABLED": "false"}
        with patch.dict(os.environ, env, clear=True):
            config = JiraConfig.from_env()
            assert config.enabled is False

    def test_from_mcp_settings_not_found(self):
        """Test loading from MCP settings when file doesn't exist."""
        with patch("builtins.open", side_effect=OSError("File not found")):
            config = JiraConfig.from_mcp_settings()
            assert config is None

    def test_from_mcp_settings_no_server(self):
        """Test loading from MCP settings when server not configured."""
        settings = {"mcpServers": {}}
        with patch("builtins.open", MagicMock()), \
             patch("json.load", return_value=settings):
            config = JiraConfig.from_mcp_settings("jira-mcp")
            assert config is None

    def test_from_mcp_settings_success(self):
        """Test successful loading from MCP settings."""
        settings = {
            "mcpServers": {
                "jira-mcp": {
                    "command": "/path/to/jira-mcp",
                    "env": {
                        "JIRA_HOST": "https://company.atlassian.net",
                        "JIRA_EMAIL": "user@company.com",
                        "JIRA_API_TOKEN": "token123",
                        "JIRA_DEFAULT_PROJECT": "PROJ",
                    }
                }
            }
        }

        mock_open = MagicMock()
        mock_open.return_value.__enter__ = lambda s: s
        mock_open.return_value.__exit__ = MagicMock(return_value=False)
        mock_open.return_value.read = MagicMock(return_value=json.dumps(settings))

        with patch("builtins.open", mock_open), \
             patch("json.load", return_value=settings):
            config = JiraConfig.from_mcp_settings("jira-mcp")
            assert config is not None
            assert config.host == "https://company.atlassian.net"
            assert config.email == "user@company.com"
            assert config.default_project == "PROJ"

    def test_is_valid_with_mcp(self):
        """Test validation with MCP script."""
        with tempfile.NamedTemporaryFile(mode="w", delete=False, suffix=".sh") as f:
            f.write("#!/bin/bash\n")
            script_path = f.name

        try:
            config = JiraConfig(mcp_start_script=script_path)
            assert config.is_valid() is True
        finally:
            os.unlink(script_path)

    def test_is_valid_with_direct_credentials(self):
        """Test validation with direct credentials."""
        config = JiraConfig(
            host="https://test.atlassian.net",
            email="test@example.com",
            api_token="token",
        )
        assert config.is_valid() is True

    def test_is_valid_without_credentials(self):
        """Test validation fails without credentials."""
        config = JiraConfig()
        assert config.is_valid() is False


class TestJiraProjectState:
    """Test JiraProjectState dataclass."""

    def test_to_dict(self):
        """Test serialization to dict."""
        state = JiraProjectState(
            initialized=True,
            project_key="TEST",
            project_name="Test Project",
            meta_issue_key="TEST-1",
            total_issues=5,
            created_at="2024-01-01T00:00:00",
            issue_mapping={"task-1": "TEST-2"},
        )
        data = state.to_dict()
        assert data["initialized"] is True
        assert data["project_key"] == "TEST"
        assert data["issue_mapping"] == {"task-1": "TEST-2"}

    def test_from_dict(self):
        """Test deserialization from dict."""
        data = {
            "initialized": True,
            "project_key": "PROJ",
            "project_name": "Project",
            "meta_issue_key": "PROJ-1",
            "total_issues": 3,
            "created_at": "2024-01-01",
            "issue_mapping": {"a": "b"},
        }
        state = JiraProjectState.from_dict(data)
        assert state.initialized is True
        assert state.project_key == "PROJ"
        assert state.issue_mapping == {"a": "b"}

    def test_from_dict_defaults(self):
        """Test deserialization with missing fields."""
        state = JiraProjectState.from_dict({})
        assert state.initialized is False
        assert state.project_key == ""
        assert state.issue_mapping == {}

    def test_save_and_load(self, tmp_path):
        """Test save and load roundtrip."""
        state = JiraProjectState(
            initialized=True,
            project_key="TEST",
            project_name="Test",
            issue_mapping={"task-1": "TEST-1"},
        )
        state.save(tmp_path)

        loaded = JiraProjectState.load(tmp_path)
        assert loaded is not None
        assert loaded.initialized is True
        assert loaded.project_key == "TEST"
        assert loaded.issue_mapping == {"task-1": "TEST-1"}

    def test_load_not_found(self, tmp_path):
        """Test load returns None when file doesn't exist."""
        result = JiraProjectState.load(tmp_path)
        assert result is None

    def test_load_invalid_json(self, tmp_path):
        """Test load handles invalid JSON."""
        marker_file = tmp_path / JIRA_PROJECT_MARKER
        marker_file.write_text("not valid json")

        result = JiraProjectState.load(tmp_path)
        assert result is None


class TestGetJiraStatus:
    """Test get_jira_status function."""

    def test_known_statuses(self):
        """Test mapping of known statuses."""
        assert get_jira_status("pending") == STATUS_TODO
        assert get_jira_status("in_progress") == STATUS_IN_PROGRESS
        assert get_jira_status("completed") == STATUS_DONE

    def test_unknown_status(self):
        """Test unknown status defaults to TODO."""
        assert get_jira_status("unknown") == STATUS_TODO


class TestGetPriorityForPhase:
    """Test get_priority_for_phase function."""

    def test_single_phase(self):
        """Test priority for single phase project."""
        assert get_priority_for_phase(1, 1) == "High"

    def test_first_quarter(self):
        """Test first quarter of phases gets Highest."""
        assert get_priority_for_phase(1, 8) == "Highest"

    def test_second_quarter(self):
        """Test second quarter gets High."""
        assert get_priority_for_phase(3, 8) == "High"

    def test_third_quarter(self):
        """Test third quarter gets Medium."""
        assert get_priority_for_phase(5, 8) == "Medium"

    def test_fourth_quarter(self):
        """Test fourth quarter gets Low."""
        assert get_priority_for_phase(7, 8) == "Low"


class TestFormatSubtaskDescription:
    """Test format_subtask_description function."""

    def test_basic_subtask(self):
        """Test formatting basic subtask."""
        subtask = {
            "description": "Implement feature X",
            "service": "backend",
        }
        result = format_subtask_description(subtask)
        assert "h2. Description" in result
        assert "Implement feature X" in result
        assert "*Service:* backend" in result

    def test_with_files(self):
        """Test formatting with files to modify."""
        subtask = {
            "description": "Update API",
            "files_to_modify": ["api/routes.py"],
            "files_to_create": ["api/new_handler.py"],
        }
        result = format_subtask_description(subtask)
        assert "h2. Files to Modify" in result
        assert "{code}api/routes.py{code}" in result
        assert "h2. Files to Create" in result
        assert "{code}api/new_handler.py{code}" in result

    def test_with_verification(self):
        """Test formatting with verification info."""
        subtask = {
            "description": "Add tests",
            "verification": {
                "type": "test",
                "run": "pytest tests/",
            }
        }
        result = format_subtask_description(subtask)
        assert "h2. Verification" in result
        assert "*Type:* test" in result
        assert "{code}pytest tests/{code}" in result

    def test_with_phase_info(self):
        """Test formatting with phase info."""
        subtask = {"description": "Task"}
        phase = {"name": "Phase 1"}
        result = format_subtask_description(subtask, phase=phase)
        assert "*Phase:* Phase 1" in result

    def test_with_creator_email(self):
        """Test formatting with creator email."""
        subtask = {"description": "Task"}
        result = format_subtask_description(subtask, creator_email="dev@company.com")
        assert "_Created by dev_" in result

    def test_all_services_scope(self):
        """Test formatting for all_services subtask."""
        subtask = {
            "description": "Integration task",
            "all_services": True,
        }
        result = format_subtask_description(subtask)
        assert "*Scope:* All services (integration)" in result


class TestFormatSessionComment:
    """Test format_session_comment function."""

    def test_success_comment(self):
        """Test formatting successful session comment."""
        result = format_session_comment(
            session_num=1,
            subtask_id="task-1",
            success=True,
            approach="Used TDD",
            git_commit="abc12345",
        )
        assert "Session #1" in result
        assert "(/) " in result  # Success emoji
        assert "*Status:* Completed" in result
        assert "*Approach:* Used TDD" in result
        assert "{code}abc12345{code}" in result

    def test_failure_comment(self):
        """Test formatting failed session comment."""
        result = format_session_comment(
            session_num=2,
            subtask_id="task-2",
            success=False,
            error="Import error occurred",
        )
        assert "Session #2" in result
        assert "(x) " in result  # Failure emoji
        assert "*Status:* In Progress" in result
        assert "*Error:*" in result
        assert "Import error occurred" in result


class TestFormatStuckSubtaskComment:
    """Test format_stuck_subtask_comment function."""

    def test_stuck_comment(self):
        """Test formatting stuck subtask comment."""
        attempts = [
            {"success": False, "approach": "Tried approach A", "error": "Failed"},
            {"success": False, "approach": "Tried approach B", "error": "Also failed"},
        ]
        result = format_stuck_subtask_comment(
            subtask_id="task-1",
            attempt_count=2,
            attempts=attempts,
            reason="Dependencies missing",
        )
        assert "(!) Subtask Marked as STUCK" in result
        assert "{code}task-1{code}" in result
        assert "*Attempts:* 2" in result
        assert "*Reason:* Dependencies missing" in result
        assert "h4. Attempt History" in result
        assert "Recommended Actions" in result

    def test_stuck_without_attempts(self):
        """Test formatting stuck subtask without attempt history."""
        result = format_stuck_subtask_comment(
            subtask_id="task-1",
            attempt_count=0,
            attempts=[],
        )
        assert "(!) Subtask Marked as STUCK" in result
        assert "h4. Recommended Actions" in result
