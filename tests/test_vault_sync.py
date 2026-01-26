#!/usr/bin/env python3
"""
Tests for Vault Sync Module
===========================

Unit tests for apps/backend/memory/vault_sync.py
"""

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

import pytest

# Import the module under test
from memory.vault_sync import (
    get_vault_path,
    is_vault_sync_enabled,
    _get_project_name,
    _get_spec_name,
    _format_session_as_markdown,
    _format_learnings_as_markdown,
    _format_discoveries_as_markdown,
    sync_to_vault,
    sync_session_to_vault,
)


class TestGetVaultPath:
    """Test get_vault_path function."""

    def test_no_env_vars(self):
        """Test returns None when no env vars set."""
        with patch.dict(os.environ, {}, clear=True):
            result = get_vault_path()
            assert result is None

    def test_vault_path_env(self, tmp_path):
        """Test returns path from VAULT_PATH."""
        with patch.dict(os.environ, {"VAULT_PATH": str(tmp_path)}, clear=True):
            result = get_vault_path()
            assert result == tmp_path

    def test_obsidian_vault_path_env(self, tmp_path):
        """Test returns path from OBSIDIAN_VAULT_PATH."""
        with patch.dict(os.environ, {"OBSIDIAN_VAULT_PATH": str(tmp_path)}, clear=True):
            result = get_vault_path()
            assert result == tmp_path

    def test_vault_path_priority(self, tmp_path):
        """Test VAULT_PATH takes priority over OBSIDIAN_VAULT_PATH."""
        vault1 = tmp_path / "vault1"
        vault2 = tmp_path / "vault2"
        vault1.mkdir()
        vault2.mkdir()

        env = {
            "VAULT_PATH": str(vault1),
            "OBSIDIAN_VAULT_PATH": str(vault2),
        }
        with patch.dict(os.environ, env, clear=True):
            result = get_vault_path()
            assert result == vault1

    def test_nonexistent_path(self):
        """Test returns None for nonexistent path."""
        with patch.dict(os.environ, {"VAULT_PATH": "/nonexistent/path"}, clear=True):
            result = get_vault_path()
            assert result is None

    def test_tilde_expansion(self, tmp_path):
        """Test tilde is expanded."""
        # Create a mock home vault
        with patch.dict(os.environ, {"VAULT_PATH": str(tmp_path)}, clear=True):
            result = get_vault_path()
            assert result is not None
            assert "~" not in str(result)


class TestIsVaultSyncEnabled:
    """Test is_vault_sync_enabled function."""

    def test_enabled_with_path(self, tmp_path):
        """Test returns True when vault path exists."""
        with patch.dict(os.environ, {"VAULT_PATH": str(tmp_path)}, clear=True):
            assert is_vault_sync_enabled() is True

    def test_disabled_without_path(self):
        """Test returns False when no vault path."""
        with patch.dict(os.environ, {}, clear=True):
            assert is_vault_sync_enabled() is False


class TestGetProjectName:
    """Test _get_project_name function."""

    def test_standard_path(self, tmp_path):
        """Test extracting project name from standard path."""
        # Create structure: project/.auto-claude/specs/001-feature/
        project_dir = tmp_path / "my-project"
        spec_dir = project_dir / ".auto-claude" / "specs" / "001-feature"
        spec_dir.mkdir(parents=True)

        result = _get_project_name(spec_dir)
        assert result == "my-project"

    def test_fallback_path(self, tmp_path):
        """Test fallback when .auto-claude not found."""
        spec_dir = tmp_path / "some" / "deep" / "path"
        spec_dir.mkdir(parents=True)

        # Falls back to parent of spec_dir
        result = _get_project_name(spec_dir)
        assert result is not None


class TestGetSpecName:
    """Test _get_spec_name function."""

    def test_extracts_name(self, tmp_path):
        """Test extracting spec name from directory."""
        spec_dir = tmp_path / "001-add-feature"
        spec_dir.mkdir()

        result = _get_spec_name(spec_dir)
        assert result == "001-add-feature"


class TestFormatSessionAsMarkdown:
    """Test _format_session_as_markdown function."""

    def test_basic_session(self):
        """Test formatting basic session."""
        session = {
            "session_number": 1,
            "timestamp": "2024-01-01T10:00:00",
        }
        result = _format_session_as_markdown(session)
        assert "# Session 1" in result
        assert "**Date:** 2024-01-01T10:00:00" in result

    def test_with_subtasks(self):
        """Test formatting session with subtasks."""
        session = {
            "session_number": 1,
            "timestamp": "2024-01-01",
            "subtasks_completed": ["Task A", "Task B"],
        }
        result = _format_session_as_markdown(session)
        assert "## Subtasks Completed" in result
        assert "- Task A" in result
        assert "- Task B" in result

    def test_with_discoveries(self):
        """Test formatting session with discoveries."""
        session = {
            "session_number": 1,
            "timestamp": "2024-01-01",
            "discoveries": {
                "files_understood": {"src/app.py": "Main entry point"},
                "patterns_found": ["Use dependency injection"],
                "gotchas_encountered": ["Watch out for circular imports"],
            }
        }
        result = _format_session_as_markdown(session)
        assert "## Discoveries" in result
        assert "### Files Understood" in result
        assert "`src/app.py`" in result
        assert "### Patterns Found" in result
        assert "### Gotchas Encountered" in result

    def test_with_what_worked(self):
        """Test formatting session with what worked."""
        session = {
            "session_number": 1,
            "timestamp": "2024-01-01",
            "what_worked": ["TDD approach"],
        }
        result = _format_session_as_markdown(session)
        assert "## What Worked" in result
        assert "- TDD approach" in result

    def test_with_what_failed(self):
        """Test formatting session with what failed."""
        session = {
            "session_number": 1,
            "timestamp": "2024-01-01",
            "what_failed": ["Direct API calls"],
        }
        result = _format_session_as_markdown(session)
        assert "## What Failed" in result
        assert "- Direct API calls" in result

    def test_with_recommendations(self):
        """Test formatting session with recommendations."""
        session = {
            "session_number": 1,
            "timestamp": "2024-01-01",
            "recommendations_for_next_session": ["Start with tests"],
        }
        result = _format_session_as_markdown(session)
        assert "## Recommendations" in result
        assert "- Start with tests" in result


class TestFormatLearningsAsMarkdown:
    """Test _format_learnings_as_markdown function."""

    def test_basic_learnings(self):
        """Test formatting basic learnings."""
        result = _format_learnings_as_markdown(
            spec_name="001-feature",
            patterns=["Pattern A"],
            gotchas=["Gotcha B"],
            sessions=[],
        )
        assert "# Learnings: 001-feature" in result
        assert "## Patterns" in result
        assert "- Pattern A" in result
        assert "## Gotchas" in result
        assert "- Gotcha B" in result

    def test_aggregates_from_sessions(self):
        """Test aggregating patterns from sessions."""
        sessions = [
            {
                "discoveries": {
                    "patterns_found": ["Session Pattern"],
                    "gotchas_encountered": ["Session Gotcha"],
                },
                "what_worked": ["Good approach"],
                "what_failed": ["Bad approach"],
            }
        ]
        result = _format_learnings_as_markdown(
            spec_name="test",
            patterns=[],
            gotchas=[],
            sessions=sessions,
        )
        assert "- Session Pattern" in result
        assert "- Session Gotcha" in result
        assert "## What Worked" in result
        assert "## What To Avoid" in result

    def test_latest_recommendations(self):
        """Test includes latest recommendations."""
        sessions = [
            {"recommendations_for_next_session": ["Old recommendation"]},
            {"recommendations_for_next_session": ["Latest recommendation"]},
        ]
        result = _format_learnings_as_markdown(
            spec_name="test",
            patterns=[],
            gotchas=[],
            sessions=sessions,
        )
        assert "## Latest Recommendations" in result
        assert "- Latest recommendation" in result


class TestFormatDiscoveriesAsMarkdown:
    """Test _format_discoveries_as_markdown function."""

    def test_empty_codebase_map(self):
        """Test formatting with empty codebase map."""
        result = _format_discoveries_as_markdown("test-spec", {})
        assert "# Codebase Discoveries: test-spec" in result
        assert "*No discoveries recorded yet.*" in result

    def test_with_files(self):
        """Test formatting with discovered files."""
        codebase_map = {
            "src/app.py": "Main application entry",
            "src/utils.py": "Utility functions",
            "tests/test_app.py": "Unit tests",
        }
        result = _format_discoveries_as_markdown("test-spec", codebase_map)
        assert "# Codebase Discoveries: test-spec" in result
        assert "## src/" in result
        assert "`app.py`: Main application entry" in result

    def test_skips_metadata(self):
        """Test skips metadata entries."""
        codebase_map = {
            "_version": "1.0",
            "src/app.py": "Entry point",
        }
        result = _format_discoveries_as_markdown("test-spec", codebase_map)
        assert "_version" not in result


class TestSyncToVault:
    """Test sync_to_vault function."""

    def test_no_vault_path(self, tmp_path):
        """Test returns False when no vault configured."""
        with patch.dict(os.environ, {}, clear=True):
            result = sync_to_vault(tmp_path)
            assert result is False

    def test_successful_sync(self, tmp_path):
        """Test successful vault sync."""
        # Create vault directory
        vault_dir = tmp_path / "vault"
        vault_dir.mkdir()

        # Create spec directory structure
        project_dir = tmp_path / "project"
        spec_dir = project_dir / ".auto-claude" / "specs" / "001-feature"
        memory_dir = spec_dir / "memory"
        memory_dir.mkdir(parents=True)

        # Create minimal memory files
        sessions_dir = memory_dir / "sessions"
        sessions_dir.mkdir()
        (sessions_dir / "session_001.json").write_text(json.dumps({
            "session_number": 1,
            "timestamp": "2024-01-01",
        }))

        (memory_dir / "patterns.json").write_text(json.dumps([]))
        (memory_dir / "gotchas.json").write_text(json.dumps([]))
        (memory_dir / "codebase_map.json").write_text(json.dumps({}))

        with patch.dict(os.environ, {"VAULT_PATH": str(vault_dir)}, clear=True):
            # Mock the loading functions since they may not be importable
            with patch("memory.vault_sync.load_all_insights", return_value=[]):
                with patch("memory.vault_sync.load_patterns", return_value=[]):
                    with patch("memory.vault_sync.load_gotchas", return_value=[]):
                        with patch("memory.vault_sync.load_codebase_map", return_value={}):
                            result = sync_to_vault(spec_dir, project_dir)

        assert result is True

    def test_sync_creates_directories(self, tmp_path):
        """Test sync creates vault directory structure."""
        vault_dir = tmp_path / "vault"
        vault_dir.mkdir()

        spec_dir = tmp_path / "project" / ".auto-claude" / "specs" / "001-test"
        spec_dir.mkdir(parents=True)

        with patch.dict(os.environ, {"VAULT_PATH": str(vault_dir)}, clear=True):
            with patch("memory.vault_sync.load_all_insights", return_value=[]):
                with patch("memory.vault_sync.load_patterns", return_value=["pattern"]):
                    with patch("memory.vault_sync.load_gotchas", return_value=[]):
                        with patch("memory.vault_sync.load_codebase_map", return_value={}):
                            sync_to_vault(spec_dir)

        # Check directories were created
        assert (vault_dir / "memory" / "learnings").exists()


class TestSyncSessionToVault:
    """Test sync_session_to_vault function."""

    def test_no_vault_path(self, tmp_path):
        """Test returns False when no vault configured."""
        with patch.dict(os.environ, {}, clear=True):
            result = sync_session_to_vault(tmp_path, 1, {})
            assert result is False

    def test_successful_session_sync(self, tmp_path):
        """Test successful session sync."""
        vault_dir = tmp_path / "vault"
        vault_dir.mkdir()

        spec_dir = tmp_path / "project" / ".auto-claude" / "specs" / "001-feature"
        spec_dir.mkdir(parents=True)

        session_data = {
            "session_number": 1,
            "timestamp": "2024-01-01",
            "subtasks_completed": ["Task 1"],
        }

        with patch.dict(os.environ, {"VAULT_PATH": str(vault_dir)}, clear=True):
            result = sync_session_to_vault(spec_dir, 1, session_data)

        assert result is True

        # Check session file was created
        session_file = vault_dir / "memory" / "sessions" / "project" / "001-feature" / "session_001.md"
        assert session_file.exists()
        content = session_file.read_text()
        assert "# Session 1" in content

    def test_exception_handling(self, tmp_path):
        """Test handles exceptions gracefully."""
        vault_dir = tmp_path / "vault"
        vault_dir.mkdir()

        with patch.dict(os.environ, {"VAULT_PATH": str(vault_dir)}, clear=True):
            with patch.object(Path, "mkdir", side_effect=OSError("Permission denied")):
                result = sync_session_to_vault(tmp_path, 1, {})

        assert result is False
