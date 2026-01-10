"""Tests for AWS Bedrock authentication support."""

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).parents[1] / "apps" / "backend"))

from core import auth as auth_module


def test_require_claude_auth_bedrock_requires_region(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that Bedrock mode requires AWS_REGION to be set."""
    monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", "1")
    monkeypatch.delenv("AWS_REGION", raising=False)

    with pytest.raises(ValueError, match="AWS_REGION"):
        auth_module.require_claude_auth()


def test_require_claude_auth_bedrock_returns_none(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that Bedrock mode returns None (uses AWS credentials instead of OAuth)."""
    monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", "1")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.delenv("AWS_PROFILE", raising=False)
    monkeypatch.delenv("AWS_ACCESS_KEY_ID", raising=False)
    monkeypatch.delenv("AWS_SECRET_ACCESS_KEY", raising=False)
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)

    assert auth_module.require_claude_auth() is None


def test_require_claude_auth_oauth_missing_raises(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that OAuth mode raises ValueError when no token is available."""
    monkeypatch.delenv("CLAUDE_CODE_USE_BEDROCK", raising=False)
    monkeypatch.delenv("CLAUDE_CODE_OAUTH_TOKEN", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setattr(auth_module, "get_token_from_keychain", lambda: None)

    with pytest.raises(ValueError, match="No OAuth token found"):
        auth_module.require_claude_auth()


def test_require_claude_auth_oauth_returns_token(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that OAuth mode returns the token when available."""
    monkeypatch.delenv("CLAUDE_CODE_USE_BEDROCK", raising=False)
    monkeypatch.setenv("CLAUDE_CODE_OAUTH_TOKEN", "test-token")
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    monkeypatch.setattr(auth_module, "get_token_from_keychain", lambda: None)

    assert auth_module.require_claude_auth() == "test-token"


def test_bedrock_partial_credentials_access_key_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that partial credentials (access key without secret) raises error."""
    monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", "1")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "AKIA...")
    monkeypatch.delenv("AWS_SECRET_ACCESS_KEY", raising=False)
    monkeypatch.delenv("AWS_PROFILE", raising=False)
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)

    with pytest.raises(ValueError, match="AWS_SECRET_ACCESS_KEY is missing"):
        auth_module.require_claude_auth()


def test_bedrock_partial_credentials_secret_key_only(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that partial credentials (secret key without access key) raises error."""
    monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", "1")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.delenv("AWS_ACCESS_KEY_ID", raising=False)
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "secret...")
    monkeypatch.delenv("AWS_PROFILE", raising=False)
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)

    with pytest.raises(ValueError, match="AWS_ACCESS_KEY_ID is missing"):
        auth_module.require_claude_auth()


def test_bedrock_complete_access_keys_succeeds(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that complete access key credentials allow Bedrock authentication."""
    monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", "1")
    monkeypatch.setenv("AWS_REGION", "us-east-1")
    monkeypatch.setenv("AWS_ACCESS_KEY_ID", "AKIA...")
    monkeypatch.setenv("AWS_SECRET_ACCESS_KEY", "secret...")
    monkeypatch.delenv("AWS_PROFILE", raising=False)
    monkeypatch.delenv("AWS_BEARER_TOKEN_BEDROCK", raising=False)

    assert auth_module.require_claude_auth() is None


def test_sdk_env_vars_no_duplicates() -> None:
    """Test that SDK_ENV_VARS list has no duplicate entries."""
    seen = set()
    duplicates = []
    for var in auth_module.SDK_ENV_VARS:
        if var in seen:
            duplicates.append(var)
        seen.add(var)
    
    assert not duplicates, f"Duplicate SDK_ENV_VARS found: {duplicates}"


def test_sdk_env_vars_contains_bedrock_vars() -> None:
    """Test that all required Bedrock env vars are included in SDK_ENV_VARS."""
    bedrock_vars = [
        "CLAUDE_CODE_USE_BEDROCK",
        "AWS_REGION",
        "AWS_PROFILE",
        "AWS_ACCESS_KEY_ID",
        "AWS_SECRET_ACCESS_KEY",
        "AWS_SESSION_TOKEN",
        "AWS_BEARER_TOKEN_BEDROCK",
    ]
    
    for var in bedrock_vars:
        assert var in auth_module.SDK_ENV_VARS, f"{var} should be in SDK_ENV_VARS"


@pytest.mark.parametrize("value", ["1", "true", "True", "TRUE", "yes", "Yes", "YES", "on", "ON"])
def test_is_bedrock_enabled_truthy_values(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    """Test that is_bedrock_enabled accepts common truthy values."""
    monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", value)
    assert auth_module.is_bedrock_enabled() is True


@pytest.mark.parametrize("value", ["0", "false", "False", "no", "off", "", "random"])
def test_is_bedrock_enabled_falsy_values(monkeypatch: pytest.MonkeyPatch, value: str) -> None:
    """Test that is_bedrock_enabled rejects non-truthy values."""
    monkeypatch.setenv("CLAUDE_CODE_USE_BEDROCK", value)
    assert auth_module.is_bedrock_enabled() is False


def test_is_bedrock_enabled_unset(monkeypatch: pytest.MonkeyPatch) -> None:
    """Test that is_bedrock_enabled returns False when env var is unset."""
    monkeypatch.delenv("CLAUDE_CODE_USE_BEDROCK", raising=False)
    assert auth_module.is_bedrock_enabled() is False
