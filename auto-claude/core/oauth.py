"""
OAuth 2.0 + PKCE authentication flow for Auto Claude.

Implements OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure
authentication with Anthropic's Claude console. Uses Anthropic's pre-whitelisted
redirect URI and supports extended scopes for full API access.
"""

import secrets
import webbrowser
from dataclasses import dataclass
from typing import TypedDict
from urllib.parse import urlencode

from authlib.integrations.httpx_client import OAuth2Client
from authlib.oauth2.rfc7636 import create_s256_code_challenge

from core.auth import KeychainError, save_token_to_keychain
from core.oauth_server import OAuthCallbackServer, OAuthServerError


# OAuth 2.0 configuration for Anthropic Claude
OAUTH_CLIENT_ID = "claude-code"  # Pre-registered public client
OAUTH_AUTHORIZATION_ENDPOINT = "https://console.anthropic.com/oauth/authorize"
OAUTH_TOKEN_ENDPOINT = "https://console.anthropic.com/oauth/token"
OAUTH_REDIRECT_URI = "http://127.0.0.1:8487/oauth/callback"
OAUTH_SCOPES = "org:createapikey user:profile user:inference"

# PKCE configuration
PKCE_VERIFIER_LENGTH = 48  # bytes before base64 encoding


def generate_pkce_pair() -> tuple[str, str]:
    """
    Generate a PKCE code verifier and code challenge pair.

    Uses cryptographically secure random bytes for the verifier and
    S256 hashing for the challenge as per RFC 7636.

    Returns:
        Tuple of (code_verifier, code_challenge)
        - code_verifier: Base64 URL-safe random string (for token exchange)
        - code_challenge: S256 hash of verifier (sent with authorization request)
    """
    # Generate cryptographically secure verifier
    code_verifier = secrets.token_urlsafe(PKCE_VERIFIER_LENGTH)

    # Create S256 challenge from verifier
    code_challenge = create_s256_code_challenge(code_verifier)

    return code_verifier, code_challenge


def create_authorization_url() -> tuple[str, str, str]:
    """
    Create an OAuth 2.0 authorization URL with PKCE parameters.

    Generates a complete authorization URL for the Anthropic OAuth flow,
    including PKCE code challenge and all required scopes for full API access.

    Returns:
        Tuple of (authorization_url, state, code_verifier)
        - authorization_url: Complete URL to redirect user for authorization
        - state: Random state parameter for CSRF protection
        - code_verifier: PKCE verifier to use when exchanging code for token
    """
    # Generate PKCE pair
    code_verifier, code_challenge = generate_pkce_pair()

    # Generate state for CSRF protection
    state = secrets.token_urlsafe(32)

    # Build authorization URL parameters
    params = {
        "response_type": "code",
        "client_id": OAUTH_CLIENT_ID,
        "redirect_uri": OAUTH_REDIRECT_URI,
        "scope": OAUTH_SCOPES,
        "state": state,
        "code_challenge": code_challenge,
        "code_challenge_method": "S256",
    }

    # Construct full authorization URL
    # Use safe=":" to prevent encoding colons in scope values (e.g., user:profile)
    authorization_url = f"{OAUTH_AUTHORIZATION_ENDPOINT}?{urlencode(params, safe=':')}"

    return authorization_url, state, code_verifier


class OAuthTokenResponse(TypedDict, total=False):
    """OAuth token response structure."""

    access_token: str
    token_type: str
    expires_in: int
    refresh_token: str
    scope: str


class OAuthTokenError(Exception):
    """Exception raised for OAuth token exchange errors."""

    def __init__(self, error: str, description: str | None = None) -> None:
        """
        Initialize OAuth token error.

        Args:
            error: OAuth error code (e.g., 'invalid_grant', 'invalid_request')
            description: Human-readable error description
        """
        self.error = error
        self.description = description or error
        super().__init__(f"{error}: {self.description}")


def exchange_code_for_token(
    code: str,
    code_verifier: str,
    redirect_uri: str | None = None,
) -> OAuthTokenResponse:
    """
    Exchange an authorization code for an access token using PKCE.

    Performs the OAuth 2.0 token exchange by sending the authorization code
    along with the PKCE code verifier to the token endpoint. This completes
    the authorization code flow with PKCE.

    Args:
        code: The authorization code received from the OAuth callback
        code_verifier: The PKCE code verifier that was used to generate
                       the code challenge in the authorization request
        redirect_uri: Optional redirect URI (defaults to OAUTH_REDIRECT_URI)

    Returns:
        OAuthTokenResponse containing the access token and related fields

    Raises:
        OAuthTokenError: If the token exchange fails (invalid code, expired, etc.)
    """
    # Use provided redirect_uri or fall back to default
    actual_redirect_uri = redirect_uri or OAUTH_REDIRECT_URI

    # Create OAuth 2.0 client (public client - no secret)
    # token_endpoint_auth_method='none' indicates PKCE replaces client secret
    client = OAuth2Client(
        client_id=OAUTH_CLIENT_ID,
        token_endpoint_auth_method="none",
    )

    try:
        # Exchange authorization code for token
        # code_verifier is sent as part of the token request body
        token = client.fetch_token(
            url=OAUTH_TOKEN_ENDPOINT,
            grant_type="authorization_code",
            code=code,
            code_verifier=code_verifier,
            redirect_uri=actual_redirect_uri,
        )
    except Exception as e:
        # Handle OAuth errors from authlib
        error_str = str(e)
        # Extract error details if available
        if hasattr(e, "error"):
            raise OAuthTokenError(
                error=getattr(e, "error", "token_exchange_failed"),
                description=getattr(e, "description", error_str),
            ) from e
        raise OAuthTokenError(
            error="token_exchange_failed",
            description=error_str,
        ) from e

    # Validate token response
    access_token = token.get("access_token")
    if not access_token:
        raise OAuthTokenError(
            error="invalid_token_response",
            description="Token response did not contain an access token",
        )

    # Validate token format (Claude OAuth tokens start with sk-ant-oat01-)
    if not access_token.startswith("sk-ant-oat01-"):
        raise OAuthTokenError(
            error="invalid_token_format",
            description="Access token does not have expected Claude OAuth format",
        )

    return OAuthTokenResponse(
        access_token=access_token,
        token_type=token.get("token_type", "bearer"),
        expires_in=token.get("expires_in", 0),
        refresh_token=token.get("refresh_token", ""),
        scope=token.get("scope", ""),
    )


@dataclass
class OAuthFlowResult:
    """Result of an OAuth flow operation."""

    success: bool
    """Whether the OAuth flow completed successfully."""

    token: str | None = None
    """The access token (if successful)."""

    error: str | None = None
    """Error code (if failed)."""

    error_description: str | None = None
    """Human-readable error description (if failed)."""

    def __repr__(self) -> str:
        if self.success:
            return f"OAuthFlowResult(success=True, token='{self.token[:15]}...')"
        return f"OAuthFlowResult(success=False, error='{self.error}')"


class OAuthFlowError(Exception):
    """Exception raised for OAuth flow errors."""

    def __init__(self, error: str, description: str | None = None) -> None:
        """
        Initialize OAuth flow error.

        Args:
            error: Error code (e.g., 'server_start_failed', 'browser_open_failed')
            description: Human-readable error description
        """
        self.error = error
        self.description = description or error
        super().__init__(f"{error}: {self.description}")


def run_oauth_flow(
    timeout: float = 300.0,
    open_browser: bool = True,
    save_to_keychain: bool = True,
) -> OAuthFlowResult:
    """
    Run the complete OAuth 2.0 + PKCE authentication flow.

    This function orchestrates the entire OAuth flow:
    1. Starts a local callback server on port 8487
    2. Opens the browser with the authorization URL (if enabled)
    3. Waits for the OAuth callback with authorization code
    4. Exchanges the authorization code for an access token
    5. Saves the token to macOS Keychain (if enabled)

    Args:
        timeout: Maximum time in seconds to wait for callback (default 5 minutes)
        open_browser: Whether to automatically open the browser (default True)
        save_to_keychain: Whether to save the token to Keychain (default True)

    Returns:
        OAuthFlowResult with success status and token or error information

    Raises:
        OAuthFlowError: For critical errors that prevent flow completion
    """
    server = None

    try:
        # Step 1: Start the callback server
        server = OAuthCallbackServer()
        try:
            server.start(timeout=timeout)
        except OAuthServerError as e:
            return OAuthFlowResult(
                success=False,
                error="server_start_failed",
                error_description=str(e),
            )

        # Step 2: Generate authorization URL with PKCE
        authorization_url, expected_state, code_verifier = create_authorization_url()

        # Step 3: Open browser (if enabled)
        if open_browser:
            try:
                webbrowser.open(authorization_url)
            except Exception as e:
                # Browser open failure is non-fatal; user can manually navigate
                # Continue with the flow, but note the error
                pass

        # Step 4: Wait for OAuth callback
        callback_result = server.wait_for_callback(timeout=timeout)

        if not callback_result.success:
            return OAuthFlowResult(
                success=False,
                error=callback_result.error or "callback_failed",
                error_description=callback_result.error_description,
            )

        # Step 5: Validate state parameter (CSRF protection)
        if callback_result.state != expected_state:
            return OAuthFlowResult(
                success=False,
                error="state_mismatch",
                error_description="OAuth state parameter does not match. "
                "This may indicate a CSRF attack.",
            )

        # Step 6: Exchange authorization code for token
        if not callback_result.code:
            return OAuthFlowResult(
                success=False,
                error="missing_code",
                error_description="No authorization code received from callback",
            )

        try:
            token_response = exchange_code_for_token(
                code=callback_result.code,
                code_verifier=code_verifier,
            )
        except OAuthTokenError as e:
            return OAuthFlowResult(
                success=False,
                error=e.error,
                error_description=e.description,
            )

        access_token = token_response["access_token"]

        # Step 7: Save token to Keychain (if enabled and on macOS)
        if save_to_keychain:
            try:
                save_token_to_keychain(access_token)
            except (ValueError, KeychainError) as e:
                # Keychain save failure is non-fatal; token is still valid
                # Return success with a note about Keychain save failure
                return OAuthFlowResult(
                    success=True,
                    token=access_token,
                    error="keychain_save_failed",
                    error_description=f"Token obtained but Keychain save failed: {e}",
                )

        return OAuthFlowResult(
            success=True,
            token=access_token,
        )

    finally:
        # Step 8: Always shut down the server
        if server is not None:
            server.shutdown()
