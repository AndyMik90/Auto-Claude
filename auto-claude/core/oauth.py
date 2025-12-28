"""
OAuth 2.0 + PKCE authentication flow for Auto Claude.

Implements OAuth 2.0 with PKCE (Proof Key for Code Exchange) for secure
authentication with Anthropic's Claude console. Uses Anthropic's pre-whitelisted
redirect URI and supports extended scopes for full API access.
"""

import secrets
from urllib.parse import urlencode

from authlib.oauth2.rfc7636 import create_s256_code_challenge


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
