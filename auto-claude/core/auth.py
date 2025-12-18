"""
Authentication helpers for Auto Claude.

Provides centralized authentication token resolution with fallback support
for multiple environment variables, and SDK environment variable passthrough
for custom API endpoints.
"""

import os

# Priority order for auth token resolution
AUTH_TOKEN_ENV_VARS = [
    "CLAUDE_CODE_OAUTH_TOKEN",  # Original (highest priority)
    "ANTHROPIC_AUTH_TOKEN",  # CCR/proxy token
    "ANTHROPIC_API_KEY",  # Direct API key (lowest priority)
]

# Environment variables to pass through to SDK subprocess
SDK_ENV_VARS = [
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "ANTHROPIC_API_KEY",
    "NO_PROXY",
    "DISABLE_TELEMETRY",
    "DISABLE_COST_WARNINGS",
    "API_TIMEOUT_MS",
]


def get_auth_token() -> str | None:
    """
    Get authentication token from environment variables.

    Checks multiple env vars in priority order:
    1. CLAUDE_CODE_OAUTH_TOKEN (original)
    2. ANTHROPIC_AUTH_TOKEN (ccr/proxy)
    3. ANTHROPIC_API_KEY (direct API key)

    Returns:
        Token string if found, None otherwise
    """
    for var in AUTH_TOKEN_ENV_VARS:
        token = os.environ.get(var)
        if token:
            return token
    return None


def get_auth_token_source() -> str | None:
    """Get the name of the env var that provided the auth token."""
    for var in AUTH_TOKEN_ENV_VARS:
        if os.environ.get(var):
            return var
    return None


def require_auth_token() -> str:
    """
    Get authentication token or raise ValueError.

    Raises:
        ValueError: If no auth token is found in any supported env var
    """
    token = get_auth_token()
    if not token:
        raise ValueError(
            "No authentication token found.\n"
            f"Set one of: {', '.join(AUTH_TOKEN_ENV_VARS)}\n"
            "For Claude Code CLI: run 'claude setup-token'"
        )
    return token


def get_sdk_env_vars() -> dict[str, str]:
    """
    Get environment variables to pass to SDK.

    Collects relevant env vars (ANTHROPIC_BASE_URL, etc.) that should
    be passed through to the claude-agent-sdk subprocess.

    Returns:
        Dict of env var name -> value for non-empty vars
    """
    env = {}
    for var in SDK_ENV_VARS:
        value = os.environ.get(var)
        if value:
            env[var] = value
    return env


def ensure_claude_code_oauth_token() -> None:
    """
    Ensure CLAUDE_CODE_OAUTH_TOKEN is set (for SDK compatibility).

    If not set but other auth tokens are available, copies the value
    to CLAUDE_CODE_OAUTH_TOKEN so the underlying SDK can use it.
    """
    if os.environ.get("CLAUDE_CODE_OAUTH_TOKEN"):
        return

    token = get_auth_token()
    if token:
        os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = token
