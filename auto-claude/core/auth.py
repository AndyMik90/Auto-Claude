"""
Authentication helpers for Auto Claude.

Provides centralized authentication token resolution with fallback support
for multiple environment variables, and SDK environment variable passthrough
for custom API endpoints.
"""

import json
import os
import platform
import subprocess

# Priority order for auth token resolution
# NOTE: We intentionally do NOT fall back to ANTHROPIC_API_KEY.
# Auto Claude is designed to use Claude Code OAuth tokens only.
# This prevents silent billing to user's API credits when OAuth fails.
AUTH_TOKEN_ENV_VARS = [
    "CLAUDE_CODE_OAUTH_TOKEN",  # OAuth token from Claude Code CLI
    "ANTHROPIC_AUTH_TOKEN",  # CCR/proxy token (for enterprise setups)
]

# Environment variables to pass through to SDK subprocess
# NOTE: ANTHROPIC_API_KEY is intentionally excluded to prevent silent API billing
SDK_ENV_VARS = [
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    "NO_PROXY",
    "DISABLE_TELEMETRY",
    "DISABLE_COST_WARNINGS",
    "API_TIMEOUT_MS",
]


def get_token_from_keychain() -> str | None:
    """
    Get authentication token from macOS Keychain.

    Reads Claude Code credentials from macOS Keychain and extracts the OAuth token.
    Only works on macOS (Darwin platform).

    Returns:
        Token string if found in Keychain, None otherwise
    """
    # Only attempt on macOS
    if platform.system() != "Darwin":
        return None

    try:
        # Query macOS Keychain for Claude Code credentials
        result = subprocess.run(
            [
                "/usr/bin/security",
                "find-generic-password",
                "-s",
                "Claude Code-credentials",
                "-w",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode != 0:
            return None

        # Parse JSON response
        credentials_json = result.stdout.strip()
        if not credentials_json:
            return None

        data = json.loads(credentials_json)

        # Extract OAuth token from nested structure
        token = data.get("claudeAiOauth", {}).get("accessToken")

        if not token:
            return None

        # Validate token format (Claude OAuth tokens start with sk-ant-oat01-)
        if not token.startswith("sk-ant-oat01-"):
            return None

        return token

    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, Exception):
        # Silently fail - this is a fallback mechanism
        return None


def get_auth_token() -> str | None:
    """
    Get authentication token from environment variables or macOS Keychain.

    Checks multiple sources in priority order:
    1. CLAUDE_CODE_OAUTH_TOKEN (env var)
    2. ANTHROPIC_AUTH_TOKEN (CCR/proxy env var for enterprise setups)
    3. macOS Keychain (if on Darwin platform)

    NOTE: ANTHROPIC_API_KEY is intentionally NOT supported to prevent
    silent billing to user's API credits when OAuth is misconfigured.

    Returns:
        Token string if found, None otherwise
    """
    # First check environment variables
    for var in AUTH_TOKEN_ENV_VARS:
        token = os.environ.get(var)
        if token:
            return token

    # Fallback to macOS Keychain
    return get_token_from_keychain()


def get_auth_token_source() -> str | None:
    """Get the name of the source that provided the auth token."""
    # Check environment variables first
    for var in AUTH_TOKEN_ENV_VARS:
        if os.environ.get(var):
            return var

    # Check if token came from macOS Keychain
    if get_token_from_keychain():
        return "macOS Keychain"

    return None


def require_auth_token() -> str:
    """
    Get authentication token or raise ValueError.

    Raises:
        ValueError: If no auth token is found in any supported source
    """
    token = get_auth_token()
    if not token:
        error_msg = (
            "No OAuth token found.\n\n"
            "Auto Claude requires Claude Code OAuth authentication.\n"
            "Direct API keys (ANTHROPIC_API_KEY) are not supported.\n\n"
        )
        # Provide platform-specific guidance
        if platform.system() == "Darwin":
            error_msg += (
                "To authenticate:\n"
                "  1. Run: claude setup-token\n"
                "  2. The token will be saved to macOS Keychain automatically\n\n"
                "Or set CLAUDE_CODE_OAUTH_TOKEN in your .env file."
            )
        else:
            error_msg += (
                "To authenticate:\n"
                "  1. Run: claude setup-token\n"
                "  2. Set CLAUDE_CODE_OAUTH_TOKEN in your .env file"
            )
        raise ValueError(error_msg)
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


class KeychainError(Exception):
    """Exception raised for Keychain operations."""

    def __init__(self, operation: str, message: str) -> None:
        """
        Initialize Keychain error.

        Args:
            operation: The Keychain operation that failed (e.g., 'save', 'delete')
            message: Human-readable error message
        """
        self.operation = operation
        self.message = message
        super().__init__(f"Keychain {operation} failed: {message}")


def save_token_to_keychain(token: str) -> bool:
    """
    Save an OAuth token to the macOS Keychain.

    Stores the token in the same format used by Claude Code CLI,
    allowing seamless integration with existing authentication flow.
    Only works on macOS (Darwin platform).

    Args:
        token: The OAuth access token to store (must start with 'sk-ant-oat01-')

    Returns:
        True if token was saved successfully, False if not on macOS

    Raises:
        ValueError: If token is empty or has invalid format
        KeychainError: If Keychain operation fails
    """
    # Only works on macOS
    if platform.system() != "Darwin":
        return False

    # Validate token
    if not token:
        raise ValueError("Token cannot be empty")

    if not token.startswith("sk-ant-oat01-"):
        raise ValueError("Token must start with 'sk-ant-oat01-' prefix")

    # Build the JSON structure expected by Claude Code
    credentials_data = {
        "claudeAiOauth": {
            "accessToken": token,
        }
    }
    credentials_json = json.dumps(credentials_data)

    # First, try to delete any existing credential to avoid duplicates
    # The 'delete' command fails silently if the credential doesn't exist
    try:
        subprocess.run(
            [
                "/usr/bin/security",
                "delete-generic-password",
                "-s",
                "Claude Code-credentials",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
    except subprocess.TimeoutExpired:
        pass  # Continue even if delete times out

    # Add the new credential to Keychain
    try:
        result = subprocess.run(
            [
                "/usr/bin/security",
                "add-generic-password",
                "-s",
                "Claude Code-credentials",
                "-a",
                "",  # Empty account name (matches Claude Code behavior)
                "-w",
                credentials_json,
                "-U",  # Update if exists (shouldn't after delete, but safe)
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip() if result.stderr else "Unknown error"
            raise KeychainError("save", error_msg)

        return True

    except subprocess.TimeoutExpired as e:
        raise KeychainError("save", "Operation timed out") from e
    except KeychainError:
        raise
    except Exception as e:
        raise KeychainError("save", str(e)) from e
