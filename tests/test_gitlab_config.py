#!/usr/bin/env python3
"""
Tests for GitLab Integration Configuration
==========================================

Unit tests for apps/backend/integrations/gitlab/config.py
"""

import json
import os
import tempfile
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Import the module under test
from integrations.gitlab.config import (
    GitLabConfig,
    GitLabProjectState,
    STATUS_OPENED,
    STATUS_CLOSED,
    STATUS_MERGED,
    WEIGHT_HIGH,
    WEIGHT_MEDIUM,
    WEIGHT_LOW,
    SUBTASK_TO_GITLAB_STATE,
    LABELS,
    GITLAB_PROJECT_MARKER,
    get_creator_label,
    get_gitlab_state,
    get_weight_for_phase,
    get_labels_for_subtask,
    format_issue_description,
    format_session_note,
    format_stuck_note,
)


class TestStatusConstants:
    """Test status constants are defined correctly."""

    def test_status_constants_exist(self):
        """Verify all status constants are defined."""
        assert STATUS_OPENED == "opened"
        assert STATUS_CLOSED == "closed"
        assert STATUS_MERGED == "merged"

    def test_weight_constants(self):
        """Verify weight constants are correct."""
        assert WEIGHT_HIGH == 9
        assert WEIGHT_MEDIUM == 5
        assert WEIGHT_LOW == 1

    def test_subtask_status_mapping(self):
        """Verify subtask to GitLab state mapping."""
        assert SUBTASK_TO_GITLAB_STATE["pending"] == STATUS_OPENED
        assert SUBTASK_TO_GITLAB_STATE["in_progress"] == STATUS_OPENED
        assert SUBTASK_TO_GITLAB_STATE["completed"] == STATUS_CLOSED

    def test_label_constants(self):
        """Verify label constants."""
        assert LABELS["phase"] == "phase"
        assert LABELS["service"] == "service"
        assert LABELS["stuck"] == "stuck"
        assert LABELS["blocked"] == "blocked"


class TestGetCreatorLabel:
    """Test get_creator_label function."""

    def test_with_username(self):
        """Test label generation from username."""
        label = get_creator_label(username="john_doe")
        assert label == "created-by-john-doe"

    def test_with_email(self):
        """Test label generation from email."""
        label = get_creator_label(email="jane.smith@company.com")
        assert label == "created-by-jane-smith"

    def test_username_preferred_over_email(self):
        """Test username is preferred over email."""
        label = get_creator_label(email="email@test.com", username="preferred")
        assert label == "created-by-preferred"

    def test_env_fallback(self):
        """Test fallback to environment variable."""
        with patch.dict(os.environ, {"GITLAB_EMAIL": "env@test.com"}, clear=True):
            label = get_creator_label()
            assert label == "created-by-env"

    def test_user_email_env_fallback(self):
        """Test fallback to GITLAB_USER_EMAIL."""
        with patch.dict(os.environ, {"GITLAB_USER_EMAIL": "user@test.com"}, clear=True):
            label = get_creator_label()
            assert label == "created-by-user"

    def test_empty_without_credentials(self):
        """Test returns empty when no credentials available."""
        with patch.dict(os.environ, {}, clear=True):
            label = get_creator_label()
            assert label == ""


class TestGitLabConfig:
    """Test GitLabConfig dataclass."""

    def test_from_env(self):
        """Test creating config from environment variables."""
        env = {
            "GITLAB_URL": "https://gitlab.company.com",
            "GITLAB_CLIENT_ID": "client123",
            "GITLAB_CLIENT_SECRET": "secret456",
            "GITLAB_TOKEN": "pat-token",
            "GITLAB_PROJECT_ID": "group/project",
            "GITLAB_DEFAULT_BRANCH": "develop",
            "GITLAB_ENABLED": "true",
            "GITLAB_USE_OAUTH": "false",
        }
        with patch.dict(os.environ, env, clear=True):
            config = GitLabConfig.from_env()
            assert config.url == "https://gitlab.company.com"
            assert config.client_id == "client123"
            assert config.personal_token == "pat-token"
            assert config.project_id == "group/project"
            assert config.default_branch == "develop"
            assert config.enabled is True
            assert config.use_oauth is False

    def test_from_env_defaults(self):
        """Test default values from environment."""
        with patch.dict(os.environ, {}, clear=True):
            config = GitLabConfig.from_env()
            assert config.url == ""
            assert config.default_branch == "main"
            assert config.enabled is True
            assert config.use_oauth is True

    def test_from_file_not_found(self):
        """Test loading from non-existent file."""
        config = GitLabConfig.from_file("/nonexistent/path.json")
        assert config is None

    def test_from_file_success(self, tmp_path):
        """Test loading from file."""
        config_file = tmp_path / "gitlab.json"
        config_data = {
            "url": "https://gitlab.test.com",
            "client_id": "test-client",
            "project_id": "test/project",
        }
        config_file.write_text(json.dumps(config_data))

        config = GitLabConfig.from_file(str(config_file))
        assert config is not None
        assert config.url == "https://gitlab.test.com"
        assert config.client_id == "test-client"

    def test_from_file_invalid_json(self, tmp_path):
        """Test loading from invalid JSON file."""
        config_file = tmp_path / "gitlab.json"
        config_file.write_text("not valid json")

        config = GitLabConfig.from_file(str(config_file))
        assert config is None

    def test_save(self, tmp_path):
        """Test saving config to file."""
        config = GitLabConfig(
            url="https://gitlab.example.com",
            client_id="my-client",
            project_id="my/project",
        )
        config_path = tmp_path / "gitlab.json"
        config.save(str(config_path))

        assert config_path.exists()
        saved = json.loads(config_path.read_text())
        assert saved["url"] == "https://gitlab.example.com"
        assert saved["client_id"] == "my-client"
        # Secrets should not be saved
        assert "client_secret" not in saved
        assert "personal_token" not in saved

    def test_is_valid_with_oauth(self):
        """Test validation with OAuth."""
        config = GitLabConfig(url="https://gitlab.com", client_id="id123")
        assert config.is_valid() is True

    def test_is_valid_with_pat(self):
        """Test validation with personal token."""
        config = GitLabConfig(url="https://gitlab.com", personal_token="token")
        assert config.is_valid() is True

    def test_is_valid_without_url(self):
        """Test validation fails without URL."""
        config = GitLabConfig(client_id="id123")
        assert config.is_valid() is False

    def test_is_valid_without_auth(self):
        """Test validation fails without auth."""
        config = GitLabConfig(url="https://gitlab.com")
        assert config.is_valid() is False

    def test_api_url(self):
        """Test API URL generation."""
        config = GitLabConfig(url="https://gitlab.company.com/")
        assert config.api_url == "https://gitlab.company.com/api/v4"


class TestGitLabProjectState:
    """Test GitLabProjectState dataclass."""

    def test_to_dict(self):
        """Test serialization to dict."""
        state = GitLabProjectState(
            initialized=True,
            project_id="123",
            project_path="group/project",
            project_name="Test Project",
            meta_issue_iid=1,
            issue_mapping={"task-1": 2},
            mr_mapping={"task-1": 3},
        )
        data = state.to_dict()
        assert data["initialized"] is True
        assert data["project_id"] == "123"
        assert data["project_path"] == "group/project"
        assert data["issue_mapping"] == {"task-1": 2}
        assert data["mr_mapping"] == {"task-1": 3}

    def test_from_dict(self):
        """Test deserialization from dict."""
        data = {
            "initialized": True,
            "project_id": "456",
            "project_path": "team/repo",
            "issue_mapping": {"a": 1},
        }
        state = GitLabProjectState.from_dict(data)
        assert state.initialized is True
        assert state.project_id == "456"
        assert state.issue_mapping == {"a": 1}

    def test_from_dict_defaults(self):
        """Test deserialization with missing fields."""
        state = GitLabProjectState.from_dict({})
        assert state.initialized is False
        assert state.default_branch == "main"
        assert state.issue_mapping == {}
        assert state.mr_mapping == {}

    def test_save_and_load(self, tmp_path):
        """Test save and load roundtrip."""
        state = GitLabProjectState(
            initialized=True,
            project_id="789",
            project_path="org/app",
            issue_mapping={"task-1": 10},
        )
        state.save(tmp_path)

        loaded = GitLabProjectState.load(tmp_path)
        assert loaded is not None
        assert loaded.project_id == "789"
        assert loaded.issue_mapping == {"task-1": 10}

    def test_load_not_found(self, tmp_path):
        """Test load returns None when file doesn't exist."""
        result = GitLabProjectState.load(tmp_path)
        assert result is None


class TestGetGitlabState:
    """Test get_gitlab_state function."""

    def test_known_statuses(self):
        """Test mapping of known statuses."""
        assert get_gitlab_state("pending") == STATUS_OPENED
        assert get_gitlab_state("completed") == STATUS_CLOSED

    def test_unknown_status(self):
        """Test unknown status defaults to opened."""
        assert get_gitlab_state("unknown") == STATUS_OPENED


class TestGetWeightForPhase:
    """Test get_weight_for_phase function."""

    def test_single_phase(self):
        """Test weight for single phase project."""
        assert get_weight_for_phase(1, 1) == WEIGHT_HIGH

    def test_first_quarter(self):
        """Test first quarter of phases gets high weight."""
        assert get_weight_for_phase(1, 8) == WEIGHT_HIGH

    def test_third_quarter(self):
        """Test third quarter gets medium weight."""
        assert get_weight_for_phase(5, 8) == WEIGHT_MEDIUM

    def test_fourth_quarter(self):
        """Test fourth quarter gets low weight."""
        assert get_weight_for_phase(7, 8) == WEIGHT_LOW


class TestGetLabelsForSubtask:
    """Test get_labels_for_subtask function."""

    def test_basic_labels(self):
        """Test basic label generation."""
        subtask = {
            "service": "backend",
            "phase_num": 1,
        }
        labels = get_labels_for_subtask(subtask, username="developer")
        assert "created-by-developer" in labels
        assert "service::backend" in labels
        assert "phase::1" in labels

    def test_in_progress_label(self):
        """Test in_progress status adds label."""
        subtask = {"status": "in_progress"}
        labels = get_labels_for_subtask(subtask)
        assert LABELS["in_progress"] in labels

    def test_blocked_labels(self):
        """Test blocked status adds labels."""
        subtask = {"status": "stuck"}
        labels = get_labels_for_subtask(subtask)
        assert LABELS["blocked"] in labels
        assert LABELS["stuck"] in labels


class TestFormatIssueDescription:
    """Test format_issue_description function."""

    def test_basic_description(self):
        """Test formatting basic issue description."""
        subtask = {
            "description": "Implement feature",
            "service": "frontend",
        }
        result = format_issue_description(subtask)
        assert "## Description" in result
        assert "Implement feature" in result
        assert "**Service:** `frontend`" in result

    def test_with_files(self):
        """Test formatting with files."""
        subtask = {
            "description": "Update",
            "files_to_modify": ["src/app.ts"],
            "files_to_create": ["src/new.ts"],
        }
        result = format_issue_description(subtask)
        assert "## Files to Modify" in result
        assert "`src/app.ts`" in result
        assert "## Files to Create" in result
        assert "`src/new.ts`" in result

    def test_with_verification(self):
        """Test formatting with verification."""
        subtask = {
            "description": "Add tests",
            "verification": {"type": "test", "run": "npm test"},
        }
        result = format_issue_description(subtask)
        assert "## Verification" in result
        assert "**Type:** test" in result
        assert "**Command:** `npm test`" in result

    def test_with_username_attribution(self):
        """Test formatting with username attribution."""
        subtask = {"description": "Task"}
        result = format_issue_description(subtask, creator_username="dev123")
        assert "_Created by @dev123_" in result


class TestFormatSessionNote:
    """Test format_session_note function."""

    def test_success_note(self):
        """Test formatting successful session note."""
        result = format_session_note(
            session_num=1,
            subtask_id="task-1",
            success=True,
            approach="Used TDD",
            git_commit="abc12345",
        )
        assert "## Session #1" in result
        assert ":white_check_mark:" in result
        assert "**Status:** Completed" in result
        assert "**Commit:** `abc12345`" in result

    def test_failure_note(self):
        """Test formatting failed session note."""
        result = format_session_note(
            session_num=2,
            subtask_id="task-2",
            success=False,
            error="Build failed",
        )
        assert ":x:" in result
        assert "**Status:** In Progress" in result
        assert "**Error:**" in result
        assert "Build failed" in result


class TestFormatStuckNote:
    """Test format_stuck_note function."""

    def test_stuck_note(self):
        """Test formatting stuck note."""
        attempts = [
            {"success": False, "approach": "First try", "error": "Error 1"},
        ]
        result = format_stuck_note(
            subtask_id="task-1",
            attempt_count=1,
            attempts=attempts,
            reason="Circular dependency",
        )
        assert ":warning: Subtask Marked as STUCK" in result
        assert "`task-1`" in result
        assert "**Reason:** Circular dependency" in result
        assert "### Attempt History" in result
        assert "### Recommended Actions" in result
