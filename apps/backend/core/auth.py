"""
Authentication helpers for Auto Claude.

Provides centralized authentication token resolution with fallback support
for multiple environment variables, and SDK environment variable passthrough
for custom API endpoints.

Includes automatic OAuth token refresh when tokens expire.
"""

import json
import logging
import os
import platform
import subprocess
import time

import requests

logger = logging.getLogger(__name__)

# OAuth configuration for token refresh
# See: https://github.com/anthropics/claude-code/issues/12447
# Endpoint verified via: https://github.com/RavenStorm-bit/claude-token-refresh
OAUTH_TOKEN_URL = os.environ.get(
    "CLAUDE_OAUTH_TOKEN_URL",
    "https://console.anthropic.com/v1/oauth/token",
)
OAUTH_CLIENT_ID = os.environ.get(
    "CLAUDE_OAUTH_CLIENT_ID",
    "9d1c250a-e61b-44d9-88ed-5944d1962f5e",  # Claude Code CLI default
)
TOKEN_REFRESH_BUFFER_SECONDS = int(
    os.environ.get("CLAUDE_TOKEN_REFRESH_BUFFER_SECONDS", "300")
)  # Refresh 5 min before expiry

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
    # API endpoint configuration
    "ANTHROPIC_BASE_URL",
    "ANTHROPIC_AUTH_TOKEN",
    # Model overrides (from API Profile custom model mappings)
    "ANTHROPIC_MODEL",
    "ANTHROPIC_DEFAULT_HAIKU_MODEL",
    "ANTHROPIC_DEFAULT_SONNET_MODEL",
    "ANTHROPIC_DEFAULT_OPUS_MODEL",
    # SDK behavior configuration
    "NO_PROXY",
    "DISABLE_TELEMETRY",
    "DISABLE_COST_WARNINGS",
    "API_TIMEOUT_MS",
]


def get_token_from_keychain() -> str | None:
    """
    Get authentication token from system credential store.

    Reads Claude Code credentials from:
    - macOS: Keychain
    - Windows: Credential Manager
    - Linux: Not yet supported (use env var)

    Returns:
        Token string if found, None otherwise
    """
    system = platform.system()

    if system == "Darwin":
        return _get_token_from_macos_keychain()
    elif system == "Windows":
        return _get_token_from_windows_credential_files()
    else:
        # Linux: secret-service not yet implemented
        return None


def _get_token_from_macos_keychain() -> str | None:
    """Get token from macOS Keychain."""
    try:
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

        credentials_json = result.stdout.strip()
        if not credentials_json:
            return None

        data = json.loads(credentials_json)
        token = data.get("claudeAiOauth", {}).get("accessToken")

        if not token:
            return None

        # Validate token format (Claude OAuth tokens start with sk-ant-oat01-)
        if not token.startswith("sk-ant-oat01-"):
            return None

        return token

    except (subprocess.TimeoutExpired, json.JSONDecodeError, KeyError, Exception):
        return None


def _get_token_from_windows_credential_files() -> str | None:
    """Get token from Windows credential files.

    Claude Code on Windows stores credentials in ~/.claude/.credentials.json
    """
    try:
        # Claude Code stores credentials in ~/.claude/.credentials.json
        cred_paths = [
            os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json"),
            os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json"),
            os.path.expandvars(r"%LOCALAPPDATA%\Claude\credentials.json"),
            os.path.expandvars(r"%APPDATA%\Claude\credentials.json"),
        ]

        for cred_path in cred_paths:
            if os.path.exists(cred_path):
                with open(cred_path, encoding="utf-8") as f:
                    data = json.load(f)
                    token = data.get("claudeAiOauth", {}).get("accessToken")
                    if token and token.startswith("sk-ant-oat01-"):
                        return token

        return None

    except (json.JSONDecodeError, KeyError, FileNotFoundError, Exception):
        return None


# =============================================================================
# Full Credentials (with refresh token and expiry)
# =============================================================================


def get_full_credentials() -> dict | None:
    """
    Get full OAuth credentials including refresh token and expiry.

    Returns dict with accessToken, refreshToken, expiresAt or None.
    """
    # Try environment variable first (no expiry info available)
    for var in AUTH_TOKEN_ENV_VARS:
        token = os.environ.get(var)
        if token:
            return {"accessToken": token, "refreshToken": None, "expiresAt": None}

    # Try system credential store
    return _get_full_credentials_from_store()


def _get_full_credentials_from_store() -> dict | None:
    """Get full credentials from platform-specific store."""
    system = platform.system()

    if system == "Darwin":
        return _get_full_credentials_macos()
    elif system == "Windows":
        return _get_full_credentials_windows()
    else:  # Linux
        return _get_full_credentials_linux()


def _get_full_credentials_linux() -> dict | None:
    """Get full credentials from Linux file store."""
    cred_paths = [
        os.path.expanduser("~/.claude/credentials.json"),
        os.path.expanduser("~/.claude/.credentials.json"),
    ]

    for cred_path in cred_paths:
        if os.path.exists(cred_path):
            try:
                with open(cred_path, encoding="utf-8") as f:
                    data = json.load(f)
                    oauth = data.get("claudeAiOauth", {})
                    access_token = oauth.get("accessToken")
                    if access_token and access_token.startswith("sk-ant-oat01-"):
                        return {
                            "accessToken": access_token,
                            "refreshToken": oauth.get("refreshToken"),
                            "expiresAt": oauth.get("expiresAt"),
                        }
            except (json.JSONDecodeError, KeyError):
                continue
    return None


def _get_full_credentials_macos() -> dict | None:
    """Get full credentials from macOS Keychain."""
    try:
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

        data = json.loads(result.stdout.strip())
        oauth = data.get("claudeAiOauth", {})
        access_token = oauth.get("accessToken")
        if access_token and access_token.startswith("sk-ant-oat01-"):
            return {
                "accessToken": access_token,
                "refreshToken": oauth.get("refreshToken"),
                "expiresAt": oauth.get("expiresAt"),
            }
        return None
    except Exception:
        return None


def _get_full_credentials_windows() -> dict | None:
    """Get full credentials from Windows credential files."""
    cred_paths = [
        os.path.expandvars(r"%USERPROFILE%\.claude\.credentials.json"),
        os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json"),
        os.path.expandvars(r"%LOCALAPPDATA%\Claude\credentials.json"),
        os.path.expandvars(r"%APPDATA%\Claude\credentials.json"),
    ]

    for cred_path in cred_paths:
        if os.path.exists(cred_path):
            try:
                with open(cred_path, encoding="utf-8") as f:
                    data = json.load(f)
                    oauth = data.get("claudeAiOauth", {})
                    access_token = oauth.get("accessToken")
                    if access_token and access_token.startswith("sk-ant-oat01-"):
                        return {
                            "accessToken": access_token,
                            "refreshToken": oauth.get("refreshToken"),
                            "expiresAt": oauth.get("expiresAt"),
                        }
            except (json.JSONDecodeError, KeyError):
                continue
    return None


# =============================================================================
# Token Expiration and Refresh
# =============================================================================


def is_token_expired(credentials: dict) -> bool:
    """
    Check if token is expired or will expire within buffer period.

    Args:
        credentials: Dict with expiresAt field (milliseconds timestamp)

    Returns:
        True if token is expired or expiring soon
    """
    expires_at = credentials.get("expiresAt")
    if not expires_at:
        return False  # Can't determine, assume valid

    # expiresAt is in milliseconds
    expires_at_sec = expires_at / 1000 if expires_at > 1e12 else expires_at
    return time.time() > (expires_at_sec - TOKEN_REFRESH_BUFFER_SECONDS)


def refresh_oauth_token(refresh_token: str) -> dict | None:
    """
    Refresh OAuth token using Anthropic's token endpoint.

    Args:
        refresh_token: The refresh token (sk-ant-ort01-...)

    Returns:
        Dict with new accessToken, refreshToken, expiresAt or None on failure
    """
    if not refresh_token:
        return None

    try:
        response = requests.post(
            OAUTH_TOKEN_URL,
            json={
                "grant_type": "refresh_token",
                "refresh_token": refresh_token,
                "client_id": OAUTH_CLIENT_ID,
            },
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if response.status_code == 200:
            data = response.json()
            expires_in = data.get("expires_in", 28800)  # Default 8 hours
            return {
                "accessToken": data.get("access_token"),
                "refreshToken": data.get("refresh_token"),
                "expiresAt": int((time.time() + expires_in) * 1000),
            }
        else:
            logger.warning(f"Token refresh failed: {response.status_code}")
            return None
    except Exception as e:
        logger.warning(f"Token refresh error: {e}")
        return None


# =============================================================================
# Credential Saving
# =============================================================================


def save_credentials(credentials: dict) -> bool:
    """
    Save refreshed credentials back to credential store.

    Args:
        credentials: Dict with accessToken, refreshToken, expiresAt

    Returns:
        True if saved successfully
    """
    system = platform.system()

    if system == "Darwin":
        return _save_credentials_macos(credentials)
    elif system == "Windows":
        return _save_credentials_windows(credentials)
    else:  # Linux
        return _save_credentials_linux(credentials)


def _save_credentials_linux(credentials: dict) -> bool:
    """Save credentials to Linux file store."""
    cred_path = os.path.expanduser("~/.claude/credentials.json")

    try:
        # Read existing file
        existing = {}
        if os.path.exists(cred_path):
            with open(cred_path, encoding="utf-8") as f:
                existing = json.load(f)

        # Update OAuth section
        existing["claudeAiOauth"] = {
            "accessToken": credentials["accessToken"],
            "refreshToken": credentials["refreshToken"],
            "expiresAt": credentials["expiresAt"],
        }

        # Write back
        os.makedirs(os.path.dirname(cred_path), exist_ok=True)
        with open(cred_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)
        os.chmod(cred_path, 0o600)

        return True
    except Exception as e:
        logger.warning(f"Failed to save credentials: {e}")
        return False


def _save_credentials_windows(credentials: dict) -> bool:
    """Save credentials to Windows file store."""
    cred_path = os.path.expandvars(r"%USERPROFILE%\.claude\credentials.json")

    try:
        existing = {}
        if os.path.exists(cred_path):
            with open(cred_path, encoding="utf-8") as f:
                existing = json.load(f)

        existing["claudeAiOauth"] = {
            "accessToken": credentials["accessToken"],
            "refreshToken": credentials["refreshToken"],
            "expiresAt": credentials["expiresAt"],
        }

        os.makedirs(os.path.dirname(cred_path), exist_ok=True)
        with open(cred_path, "w", encoding="utf-8") as f:
            json.dump(existing, f, indent=2)

        return True
    except Exception as e:
        logger.warning(f"Failed to save credentials: {e}")
        return False


def _save_credentials_macos(credentials: dict) -> bool:
    """Save credentials to macOS Keychain."""
    try:
        # Read existing keychain data
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

        existing = {}
        if result.returncode == 0:
            existing = json.loads(result.stdout.strip())

        # Update OAuth section
        existing["claudeAiOauth"] = {
            "accessToken": credentials["accessToken"],
            "refreshToken": credentials["refreshToken"],
            "expiresAt": credentials["expiresAt"],
        }

        # Delete old entry
        subprocess.run(
            [
                "/usr/bin/security",
                "delete-generic-password",
                "-s",
                "Claude Code-credentials",
            ],
            capture_output=True,
            timeout=5,
        )

        # Add new entry
        new_json = json.dumps(existing)
        subprocess.run(
            [
                "/usr/bin/security",
                "add-generic-password",
                "-s",
                "Claude Code-credentials",
                "-w",
                new_json,
                "-U",
            ],
            capture_output=True,
            timeout=5,
        )

        return True
    except Exception as e:
        logger.warning(f"Failed to save to Keychain: {e}")
        return False


# =============================================================================
# Main Token Retrieval (with automatic refresh)
# =============================================================================


def get_auth_token() -> str | None:
    """
    Get valid authentication token, refreshing if necessary.

    Checks multiple sources in priority order:
    1. CLAUDE_CODE_OAUTH_TOKEN (env var)
    2. ANTHROPIC_AUTH_TOKEN (CCR/proxy env var for enterprise setups)
    3. System credential store (macOS Keychain, Windows Credential Manager)

    If the token from credential store is expired, attempts to refresh it
    automatically using the refresh token.

    NOTE: ANTHROPIC_API_KEY is intentionally NOT supported to prevent
    silent billing to user's API credits when OAuth is misconfigured.

    Returns:
        Valid token string if found, None otherwise
    """
    # First check environment variables (no refresh needed for these)
    for var in AUTH_TOKEN_ENV_VARS:
        token = os.environ.get(var)
        if token:
            return token

    # Get full credentials from system store
    creds = get_full_credentials()
    if not creds or not creds.get("accessToken"):
        return None

    # Check if token is expired or expiring soon
    if is_token_expired(creds):
        refresh_token = creds.get("refreshToken")
        if refresh_token:
            logger.info("Access token expired, attempting refresh...")
            new_creds = refresh_oauth_token(refresh_token)
            if new_creds and new_creds.get("accessToken"):
                if save_credentials(new_creds):
                    logger.info("Token refreshed successfully")
                else:
                    logger.warning("Token refreshed but failed to save to credential store")
                return new_creds["accessToken"]

        logger.warning("Token expired and refresh failed or no refresh token available")
        return None

    return creds["accessToken"]


def get_auth_token_source() -> str | None:
    """Get the name of the source that provided the auth token."""
    # Check environment variables first
    for var in AUTH_TOKEN_ENV_VARS:
        if os.environ.get(var):
            return var

    # Check if token came from system credential store
    if get_token_from_keychain():
        system = platform.system()
        if system == "Darwin":
            return "macOS Keychain"
        elif system == "Windows":
            return "Windows Credential Files"
        else:
            return "System Credential Store"

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
        system = platform.system()
        if system == "Darwin":
            error_msg += (
                "To authenticate:\n"
                "  1. Run: claude setup-token\n"
                "  2. The token will be saved to macOS Keychain automatically\n\n"
                "Or set CLAUDE_CODE_OAUTH_TOKEN in your .env file."
            )
        elif system == "Windows":
            error_msg += (
                "To authenticate:\n"
                "  1. Run: claude setup-token\n"
                "  2. The token should be saved to Windows Credential Manager\n\n"
                "If auto-detection fails, set CLAUDE_CODE_OAUTH_TOKEN in your .env file.\n"
                "Check: %LOCALAPPDATA%\\Claude\\credentials.json"
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
