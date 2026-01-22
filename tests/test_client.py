#!/usr/bin/env python3
"""
Tests for Client Creation and Token Validation
===============================================

Tests the client.py and simple_client.py module functionality including:
- Token validation before SDK initialization
- Encrypted token rejection
- Client creation with valid tokens
"""

import os
from unittest.mock import MagicMock, patch

import pytest

# Auth token env vars that need to be cleared between tests
AUTH_TOKEN_ENV_VARS = [
    "CLAUDE_CODE_OAUTH_TOKEN",
    "ANTHROPIC_AUTH_TOKEN",
]


class TestClientTokenValidation:
    """Tests for client token validation."""

    @pytest.fixture(autouse=True)
    def clear_env(self):
        """Clear auth environment variables before and after each test."""
        for var in AUTH_TOKEN_ENV_VARS:
            os.environ.pop(var, None)
        yield
        for var in AUTH_TOKEN_ENV_VARS:
            os.environ.pop(var, None)

    def test_create_client_rejects_encrypted_tokens(self, tmp_path, monkeypatch):
        """Verify create_client() rejects encrypted tokens."""
        from core.client import create_client

        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "enc:test123456789012")
        # Mock keychain to ensure encrypted token is the only source
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)
        # Mock decrypt_token to raise ValueError (simulates decryption failure)
        # This ensures the encrypted token flows through to validate_token_not_encrypted
        monkeypatch.setattr(
            "core.auth.decrypt_token",
            lambda t: (_ for _ in ()).throw(ValueError("Decryption not supported")),
        )

        with pytest.raises(ValueError, match="encrypted format"):
            create_client(tmp_path, tmp_path, "claude-sonnet-4", "coder")

    def test_create_simple_client_rejects_encrypted_tokens(self, monkeypatch):
        """Verify create_simple_client() rejects encrypted tokens."""
        from core.simple_client import create_simple_client

        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "enc:test123456789012")
        # Mock keychain to ensure encrypted token is the only source
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)
        # Mock decrypt_token to raise ValueError (simulates decryption failure)
        monkeypatch.setattr(
            "core.auth.decrypt_token",
            lambda t: (_ for _ in ()).throw(ValueError("Decryption not supported")),
        )

        with pytest.raises(ValueError, match="encrypted format"):
            create_simple_client(agent_type="merge_resolver")

    def test_create_client_accepts_valid_plaintext_token(self, tmp_path, monkeypatch):
        """Verify create_client() accepts valid plaintext tokens and creates SDK client."""
        valid_token = "sk-ant-oat01-valid-plaintext-token"
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", valid_token)
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        # Mock the SDK client to avoid actual initialization
        mock_sdk_client = MagicMock()
        with patch("core.client.ClaudeSDKClient", return_value=mock_sdk_client):
            from core.client import create_client

            client = create_client(tmp_path, tmp_path, "claude-sonnet-4", "coder")

            # Verify SDK client was created
            assert client is mock_sdk_client

    def test_create_simple_client_accepts_valid_plaintext_token(self, monkeypatch):
        """Verify create_simple_client() accepts valid plaintext tokens and creates SDK client."""
        valid_token = "sk-ant-oat01-valid-plaintext-token"
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", valid_token)
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        # Mock the SDK client to avoid actual initialization
        mock_sdk_client = MagicMock()
        with patch("core.simple_client.ClaudeSDKClient", return_value=mock_sdk_client):
            from core.simple_client import create_simple_client

            client = create_simple_client(agent_type="merge_resolver")

            # Verify SDK client was created
            assert client is mock_sdk_client

    def test_create_client_validates_token_before_sdk_init(self, tmp_path, monkeypatch):
        """Verify create_client() validates token format before SDK initialization."""
        valid_token = "sk-ant-oat01-valid-token"
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", valid_token)
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        # Mock validate_token_not_encrypted to verify it's called
        with (
            patch("core.client.validate_token_not_encrypted") as mock_validate,
            patch("core.client.ClaudeSDKClient"),
        ):
            from core.client import create_client

            create_client(tmp_path, tmp_path, "claude-sonnet-4", "coder")

            # Verify validation was called with the token
            mock_validate.assert_called_once_with(valid_token)

    def test_create_simple_client_validates_token_before_sdk_init(self, monkeypatch):
        """Verify create_simple_client() validates token format before SDK initialization."""
        valid_token = "sk-ant-oat01-valid-token"
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", valid_token)
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        # Mock validate_token_not_encrypted to verify it's called
        with (
            patch("core.simple_client.validate_token_not_encrypted") as mock_validate,
            patch("core.simple_client.ClaudeSDKClient"),
        ):
            from core.simple_client import create_simple_client

            create_simple_client(agent_type="merge_resolver")

            # Verify validation was called with the token
            mock_validate.assert_called_once_with(valid_token)


class TestSystemPromptPreparation:
    """Tests for _prepare_system_prompt function."""

    @pytest.fixture(autouse=True)
    def reset_temp_files_list(self):
        """Reset global temp files list between tests for isolation."""
        from core import client

        client._system_prompt_temp_files.clear()
        yield
        # Clean up any actual temp files created during test
        for temp_file in list(client._system_prompt_temp_files):
            try:
                if os.path.exists(temp_file):
                    os.unlink(temp_file)
            except OSError:
                # Ignore errors during cleanup - file may have been deleted already
                # or there may be permission issues; we don't want test teardown to fail
                pass
        client._system_prompt_temp_files.clear()

    def test_cleanup_temp_files_removes_files(self, tmp_path):
        """Verify cleanup function removes tracked temp files."""
        from core import client
        from core.client import _cleanup_temp_files, _system_prompt_temp_files

        # Create a test temp file
        test_file = tmp_path / "test_temp.txt"
        test_file.write_text("test content")

        # Track it for cleanup
        with client._TEMP_FILES_LOCK:
            _system_prompt_temp_files.append(str(test_file))

        # Run cleanup
        _cleanup_temp_files()

        # Verify file was removed
        assert not test_file.exists()

    def test_cleanup_handles_missing_files(self):
        """Verify cleanup function handles missing files gracefully."""
        from core import client
        from core.client import _cleanup_temp_files, _system_prompt_temp_files

        # Add a non-existent file path
        with client._TEMP_FILES_LOCK:
            _system_prompt_temp_files.append("/nonexistent/file.txt")

        # Should not raise exception
        _cleanup_temp_files()

    def test_small_prompt_returns_direct_string(self, tmp_path, monkeypatch):
        """Verify small system prompts are returned as direct strings."""
        from core.client import _prepare_system_prompt

        # Disable CLAUDE.md to keep prompt small
        monkeypatch.setenv("USE_CLAUDE_MD", "false")

        prompt_value, temp_file = _prepare_system_prompt(tmp_path)

        # Small prompts should be returned directly with content, not empty
        assert prompt_value  # Non-empty string
        assert "expert full-stack developer" in prompt_value
        assert temp_file is None

    def test_large_prompt_returns_temp_file_reference(self, tmp_path, monkeypatch):
        """Verify large system prompts use temp file with CLAUDE_SYSTEM_PROMPT_FILE."""
        from core.client import _prepare_system_prompt

        # Create a large CLAUDE.md file (>90KB threshold)
        # Need ~95KB+ to exceed the 90KB threshold (base prompt is ~300 bytes)
        large_content = "# Project Instructions\n\n" + ("This is a test line. " * 5000)
        large_md_file = tmp_path / "CLAUDE.md"
        large_md_file.write_text(large_content, encoding="utf-8")

        # Enable CLAUDE.md
        monkeypatch.setenv("USE_CLAUDE_MD", "true")

        prompt_value, temp_file = _prepare_system_prompt(tmp_path)

        # Large prompts should use temp file (return empty string for prompt_value)
        # The file path is passed via CLAUDE_SYSTEM_PROMPT_FILE environment variable
        assert prompt_value == ""
        assert temp_file is not None

        # Verify temp file exists and contains the prompt
        assert os.path.exists(temp_file)
        with open(temp_file, encoding="utf-8") as f:
            content = f.read()
            assert "expert full-stack developer" in content
            assert "Project Instructions" in content

        # Verify temp file is tracked for cleanup
        from core.client import _system_prompt_temp_files

        assert temp_file in _system_prompt_temp_files

        # Temp file cleanup is handled by the reset_temp_files_list fixture

    def test_medium_prompt_uses_direct_string(self, tmp_path, monkeypatch):
        """Verify medium-sized prompts (under 90KB) don't use temp file."""
        from core.client import _prepare_system_prompt

        # Create a medium CLAUDE.md file (<90KB threshold)
        medium_content = "# Project Instructions\n\n" + ("This is a test line. " * 100)
        medium_md_file = tmp_path / "CLAUDE.md"
        medium_md_file.write_text(medium_content, encoding="utf-8")

        # Enable CLAUDE.md
        monkeypatch.setenv("USE_CLAUDE_MD", "true")

        prompt_value, temp_file = _prepare_system_prompt(tmp_path)

        # Medium prompts should be returned directly with content
        assert prompt_value  # Non-empty string
        assert temp_file is None
        assert "Project Instructions" in prompt_value

    def test_prompt_with_claude_md_disabled(self, tmp_path, monkeypatch):
        """Verify prompt respects USE_CLAUDE_MD=false setting."""
        from core.client import _prepare_system_prompt

        # Create CLAUDE.md but disable its inclusion
        md_file = tmp_path / "CLAUDE.md"
        md_file.write_text(
            "# Custom Instructions\n\nDo not include this.", encoding="utf-8"
        )
        monkeypatch.setenv("USE_CLAUDE_MD", "false")

        prompt_value, temp_file = _prepare_system_prompt(tmp_path)

        # Prompt should not include CLAUDE.md content
        assert "Custom Instructions" not in prompt_value
        assert "Do not include this" not in prompt_value
        assert temp_file is None

    def test_prompt_without_claude_md_file(self, tmp_path, monkeypatch):
        """Verify prompt works when CLAUDE.md file doesn't exist."""
        from core.client import _prepare_system_prompt

        # Enable CLAUDE.md but don't create the file
        monkeypatch.setenv("USE_CLAUDE_MD", "true")

        prompt_value, temp_file = _prepare_system_prompt(tmp_path)

        # Prompt should have base content but no CLAUDE.md
        assert "expert full-stack developer" in prompt_value
        assert temp_file is None
