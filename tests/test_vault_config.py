#!/usr/bin/env python3
"""
Tests for Vault Integration Configuration
=========================================

Unit tests for apps/backend/integrations/vault/config.py
"""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

# Import the module under test
from integrations.vault.config import (
    VaultConfig,
    WRITE_ALLOWED_PATHS,
    get_vault_config,
    get_vault_config_from_settings,
)


class TestWriteAllowedPaths:
    """Test write allowed paths constant."""

    def test_paths_defined(self):
        """Verify allowed paths are defined."""
        assert "memory/learnings/" in WRITE_ALLOWED_PATHS
        assert "memory/auto-claude/" in WRITE_ALLOWED_PATHS
        assert "sessions/" in WRITE_ALLOWED_PATHS


class TestVaultConfig:
    """Test VaultConfig dataclass."""

    def test_init_expands_tilde(self, tmp_path):
        """Test tilde expansion in path."""
        with patch.object(Path, "expanduser", return_value=tmp_path):
            config = VaultConfig(vault_path="~/vault")
            assert "~" not in config.vault_path

    def test_expanded_path(self, tmp_path):
        """Test expanded_path property."""
        config = VaultConfig(vault_path=str(tmp_path))
        assert config.expanded_path == tmp_path

    def test_claude_md_path(self, tmp_path):
        """Test claude_md_path property."""
        config = VaultConfig(vault_path=str(tmp_path))
        expected = tmp_path / ".claude" / "CLAUDE.md"
        assert config.claude_md_path == expected

    def test_preferences_path(self, tmp_path):
        """Test preferences_path property."""
        config = VaultConfig(vault_path=str(tmp_path))
        expected = tmp_path / "memory" / "context" / "preferences.md"
        assert config.preferences_path == expected

    def test_learnings_dir(self, tmp_path):
        """Test learnings_dir property."""
        config = VaultConfig(vault_path=str(tmp_path))
        expected = tmp_path / "memory" / "learnings"
        assert config.learnings_dir == expected

    def test_agents_dir(self, tmp_path):
        """Test agents_dir property."""
        config = VaultConfig(vault_path=str(tmp_path))
        expected = tmp_path / "agents"
        assert config.agents_dir == expected

    def test_sessions_dir(self, tmp_path):
        """Test sessions_dir property."""
        config = VaultConfig(vault_path=str(tmp_path))
        expected = tmp_path / "sessions"
        assert config.sessions_dir == expected

    def test_is_write_allowed_enabled(self, tmp_path):
        """Test is_write_allowed with write enabled."""
        config = VaultConfig(vault_path=str(tmp_path), write_enabled=True)
        assert config.is_write_allowed("memory/learnings/test.md") is True
        assert config.is_write_allowed("memory/auto-claude/file.json") is True
        assert config.is_write_allowed("sessions/session1.md") is True

    def test_is_write_allowed_disabled(self, tmp_path):
        """Test is_write_allowed with write disabled."""
        config = VaultConfig(vault_path=str(tmp_path), write_enabled=False)
        assert config.is_write_allowed("memory/learnings/test.md") is False

    def test_is_write_allowed_invalid_path(self, tmp_path):
        """Test is_write_allowed with invalid path."""
        config = VaultConfig(vault_path=str(tmp_path), write_enabled=True)
        assert config.is_write_allowed("unauthorized/path.md") is False
        assert config.is_write_allowed("agents/agent.md") is False

    def test_validate_success(self, tmp_path):
        """Test validation with valid config."""
        config = VaultConfig(vault_path=str(tmp_path))
        valid, error = config.validate()
        assert valid is True
        assert error is None

    def test_validate_missing_path(self):
        """Test validation with empty path."""
        config = VaultConfig(vault_path="")
        valid, error = config.validate()
        assert valid is False
        assert "required" in error

    def test_validate_nonexistent_path(self):
        """Test validation with nonexistent path."""
        config = VaultConfig(vault_path="/nonexistent/path/to/vault")
        valid, error = config.validate()
        assert valid is False
        assert "does not exist" in error

    def test_validate_not_directory(self, tmp_path):
        """Test validation with file instead of directory."""
        file_path = tmp_path / "file.txt"
        file_path.write_text("content")

        config = VaultConfig(vault_path=str(file_path))
        valid, error = config.validate()
        assert valid is False
        assert "not a directory" in error

    def test_default_values(self, tmp_path):
        """Test default configuration values."""
        config = VaultConfig(vault_path=str(tmp_path))
        assert config.enabled is True
        assert config.auto_load is True
        assert config.sync_learnings is False
        assert config.write_enabled is False
        assert config.write_allowed_paths == WRITE_ALLOWED_PATHS


class TestGetVaultConfig:
    """Test get_vault_config function."""

    def test_no_vault_path(self):
        """Test returns None when no vault path set."""
        with patch.dict(os.environ, {}, clear=True):
            config = get_vault_config()
            assert config is None

    def test_with_vault_path(self, tmp_path):
        """Test returns config when vault path set."""
        env = {"VAULT_PATH": str(tmp_path)}
        with patch.dict(os.environ, env, clear=True):
            config = get_vault_config()
            assert config is not None
            assert config.vault_path == str(tmp_path)

    def test_all_env_vars(self, tmp_path):
        """Test all environment variables."""
        env = {
            "VAULT_PATH": str(tmp_path),
            "VAULT_ENABLED": "false",
            "VAULT_AUTO_LOAD": "false",
            "VAULT_SYNC_LEARNINGS": "true",
            "VAULT_WRITE_ENABLED": "true",
        }
        with patch.dict(os.environ, env, clear=True):
            config = get_vault_config()
            assert config.enabled is False
            assert config.auto_load is False
            assert config.sync_learnings is True
            assert config.write_enabled is True

    def test_boolean_variations(self, tmp_path):
        """Test different boolean value formats."""
        for true_val in ["true", "1", "yes"]:
            env = {
                "VAULT_PATH": str(tmp_path),
                "VAULT_SYNC_LEARNINGS": true_val,
            }
            with patch.dict(os.environ, env, clear=True):
                config = get_vault_config()
                assert config.sync_learnings is True, f"Failed for value: {true_val}"


class TestGetVaultConfigFromSettings:
    """Test get_vault_config_from_settings function."""

    def test_no_vault_path(self):
        """Test returns None when no vault path in settings."""
        settings = {}
        config = get_vault_config_from_settings(settings)
        assert config is None

    def test_with_vault_path(self, tmp_path):
        """Test returns config from settings."""
        settings = {"globalVaultPath": str(tmp_path)}
        config = get_vault_config_from_settings(settings)
        assert config is not None
        assert config.vault_path == str(tmp_path)

    def test_all_settings(self, tmp_path):
        """Test all settings values."""
        settings = {
            "globalVaultPath": str(tmp_path),
            "vaultEnabled": False,
            "vaultAutoLoad": False,
            "vaultSyncLearnings": True,
            "vaultWriteEnabled": True,
        }
        config = get_vault_config_from_settings(settings)
        assert config.enabled is False
        assert config.auto_load is False
        assert config.sync_learnings is True
        assert config.write_enabled is True

    def test_default_settings(self, tmp_path):
        """Test default values from settings."""
        settings = {"globalVaultPath": str(tmp_path)}
        config = get_vault_config_from_settings(settings)
        assert config.enabled is True
        assert config.auto_load is True
        assert config.sync_learnings is False
        assert config.write_enabled is False
