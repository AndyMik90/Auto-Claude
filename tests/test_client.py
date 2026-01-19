#!/usr/bin/env python3
"""
Tests for Client Creation and Token Validation
===============================================

Tests the client.py and simple_client.py module functionality including:
- Token validation before SDK initialization
- Encrypted token rejection
- Client creation with valid tokens
"""

from unittest.mock import MagicMock, patch

import pytest


class TestClientTokenValidation:
    """Tests for client token validation."""

    def test_create_client_rejects_encrypted_tokens(self, tmp_path, monkeypatch):
        """Verify create_client() rejects encrypted tokens."""
        from core.client import create_client

        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "enc:test123456789012")
        # Mock keychain to ensure encrypted token is the only source
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        with pytest.raises(ValueError, match="encrypted format"):
            create_client(tmp_path, tmp_path, "claude-sonnet-4", "coder")

    def test_create_simple_client_rejects_encrypted_tokens(self, monkeypatch):
        """Verify create_simple_client() rejects encrypted tokens."""
        from core.simple_client import create_simple_client

        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "enc:test123456789012")
        # Mock keychain to ensure encrypted token is the only source
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

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
        with patch(
            "core.simple_client.ClaudeSDKClient", return_value=mock_sdk_client
        ):
            from core.simple_client import create_simple_client

            client = create_simple_client(agent_type="merge_resolver")

            # Verify SDK client was created
            assert client is mock_sdk_client

    def test_create_client_validates_token_before_sdk_init(
        self, tmp_path, monkeypatch
    ):
        """Verify create_client() validates token format before SDK initialization."""
        valid_token = "sk-ant-oat01-valid-token"
        monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", valid_token)
        monkeypatch.setattr("core.auth.get_token_from_keychain", lambda: None)

        # Mock validate_token_not_encrypted to verify it's called
        with patch(
            "core.client.validate_token_not_encrypted"
        ) as mock_validate, patch("core.client.ClaudeSDKClient"):
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
        with patch(
            "core.simple_client.validate_token_not_encrypted"
        ) as mock_validate, patch("core.simple_client.ClaudeSDKClient"):
            from core.simple_client import create_simple_client

            create_simple_client(agent_type="merge_resolver")

            # Verify validation was called with the token
            mock_validate.assert_called_once_with(valid_token)
