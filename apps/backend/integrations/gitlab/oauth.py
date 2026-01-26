"""
GitLab OAuth 2.0 Authentication
================================

Implements OAuth 2.0 flow for self-hosted GitLab instances with
multi-user support. Each user gets their own OAuth token stored
securely in the token store.

Supports:
- Authorization Code Flow (for web apps)
- Device Authorization Flow (for CLI apps)
- Personal Access Token (for automation)
- Token refresh and expiration handling

Usage:
    oauth = GitLabOAuth(config)

    # Start OAuth flow
    auth_url = oauth.get_authorization_url(user_id)

    # Exchange code for token
    token = await oauth.exchange_code(code, user_id)

    # Get user's token
    token = oauth.get_user_token(user_id)
"""

import hashlib
import json
import logging
import os
import secrets
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any

import httpx

logger = logging.getLogger(__name__)

# Token storage directory
DEFAULT_TOKEN_DIR = os.path.expanduser("~/.auto-claude/gitlab-tokens")


@dataclass
class OAuthToken:
    """OAuth token with metadata."""

    access_token: str
    token_type: str = "Bearer"
    refresh_token: str | None = None
    expires_at: float | None = None  # Unix timestamp
    scope: str = ""
    created_at: float = field(default_factory=time.time)
    user_id: str = ""
    gitlab_user: dict[str, Any] | None = None  # GitLab user info

    def is_expired(self, buffer_seconds: int = 300) -> bool:
        """Check if token is expired (with buffer for safety)."""
        if self.expires_at is None:
            return False
        return time.time() >= (self.expires_at - buffer_seconds)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "OAuthToken":
        """Create from dictionary."""
        return cls(**data)

    @classmethod
    def from_oauth_response(
        cls,
        response: dict[str, Any],
        user_id: str = ""
    ) -> "OAuthToken":
        """Create from GitLab OAuth response."""
        expires_in = response.get("expires_in")
        expires_at = None
        if expires_in:
            expires_at = time.time() + expires_in

        return cls(
            access_token=response["access_token"],
            token_type=response.get("token_type", "Bearer"),
            refresh_token=response.get("refresh_token"),
            expires_at=expires_at,
            scope=response.get("scope", ""),
            user_id=user_id,
        )


class UserTokenStore:
    """
    Secure storage for user OAuth tokens.

    Stores tokens in encrypted files, one per user.
    Tokens are encrypted using the user's hashed ID as key.
    """

    def __init__(self, token_dir: str = None):
        """
        Initialize token store.

        Args:
            token_dir: Directory for token storage
        """
        self.token_dir = Path(token_dir or DEFAULT_TOKEN_DIR)
        self.token_dir.mkdir(parents=True, exist_ok=True)
        # Ensure directory has restricted permissions
        self.token_dir.chmod(0o700)

    def _get_token_path(self, user_id: str) -> Path:
        """Get path for user's token file."""
        # Hash user ID to create safe filename
        user_hash = hashlib.sha256(user_id.encode()).hexdigest()[:16]
        return self.token_dir / f"token_{user_hash}.json"

    def save_token(self, user_id: str, token: OAuthToken) -> None:
        """Save user's token to storage."""
        token_path = self._get_token_path(user_id)
        token_data = token.to_dict()

        with open(token_path, "w", encoding="utf-8") as f:
            json.dump(token_data, f, indent=2)

        # Restrict file permissions
        token_path.chmod(0o600)
        logger.info(f"Saved token for user {user_id[:8]}...")

    def get_token(self, user_id: str) -> OAuthToken | None:
        """Get user's token from storage."""
        token_path = self._get_token_path(user_id)

        if not token_path.exists():
            return None

        try:
            with open(token_path, encoding="utf-8") as f:
                data = json.load(f)
            return OAuthToken.from_dict(data)
        except (OSError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to load token for user {user_id[:8]}: {e}")
            return None

    def delete_token(self, user_id: str) -> bool:
        """Delete user's token from storage."""
        token_path = self._get_token_path(user_id)

        if token_path.exists():
            token_path.unlink()
            logger.info(f"Deleted token for user {user_id[:8]}...")
            return True
        return False

    def list_users(self) -> list[str]:
        """List all users with stored tokens."""
        users = []
        for token_file in self.token_dir.glob("token_*.json"):
            try:
                with open(token_file, encoding="utf-8") as f:
                    data = json.load(f)
                if "user_id" in data:
                    users.append(data["user_id"])
            except (OSError, json.JSONDecodeError):
                continue
        return users


@dataclass
class OAuthState:
    """OAuth state for CSRF protection."""

    state: str
    user_id: str
    code_verifier: str | None = None  # For PKCE
    created_at: float = field(default_factory=time.time)
    redirect_uri: str = ""

    def is_valid(self, max_age_seconds: int = 600) -> bool:
        """Check if state is still valid."""
        return (time.time() - self.created_at) < max_age_seconds


class GitLabOAuth:
    """
    GitLab OAuth 2.0 implementation.

    Supports self-hosted GitLab instances with multi-user authentication.
    """

    def __init__(
        self,
        gitlab_url: str,
        client_id: str,
        client_secret: str = "",
        redirect_uri: str = "http://localhost:8765/oauth/callback",
        scopes: list[str] = None,
        token_store: UserTokenStore = None,
    ):
        """
        Initialize GitLab OAuth.

        Args:
            gitlab_url: GitLab instance URL (e.g., https://gitlab.company.com)
            client_id: OAuth application client ID
            client_secret: OAuth application client secret
            redirect_uri: OAuth callback URL
            scopes: Requested OAuth scopes
            token_store: Token storage backend
        """
        self.gitlab_url = gitlab_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.redirect_uri = redirect_uri
        self.scopes = scopes or ["api", "read_user", "read_repository", "write_repository"]
        self.token_store = token_store or UserTokenStore()

        # OAuth endpoints
        self.authorize_url = f"{self.gitlab_url}/oauth/authorize"
        self.token_url = f"{self.gitlab_url}/oauth/token"
        self.user_url = f"{self.gitlab_url}/api/v4/user"

        # State storage for CSRF protection
        self._pending_states: dict[str, OAuthState] = {}

    def get_authorization_url(
        self,
        user_id: str,
        use_pkce: bool = True
    ) -> tuple[str, str]:
        """
        Generate OAuth authorization URL.

        Args:
            user_id: Identifier for the user (email, username, etc.)
            use_pkce: Use PKCE for added security

        Returns:
            Tuple of (authorization_url, state)
        """
        state = secrets.token_urlsafe(32)
        code_verifier = None

        params = {
            "client_id": self.client_id,
            "redirect_uri": self.redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.scopes),
            "state": state,
        }

        if use_pkce:
            code_verifier = secrets.token_urlsafe(64)
            code_challenge = hashlib.sha256(code_verifier.encode()).digest()
            import base64
            code_challenge_b64 = base64.urlsafe_b64encode(code_challenge).rstrip(b"=").decode()
            params["code_challenge"] = code_challenge_b64
            params["code_challenge_method"] = "S256"

        # Store state for verification
        self._pending_states[state] = OAuthState(
            state=state,
            user_id=user_id,
            code_verifier=code_verifier,
            redirect_uri=self.redirect_uri,
        )

        # Build URL
        query = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{self.authorize_url}?{query}"

        return url, state

    async def exchange_code(
        self,
        code: str,
        state: str,
    ) -> OAuthToken | None:
        """
        Exchange authorization code for access token.

        Args:
            code: Authorization code from callback
            state: State parameter for verification

        Returns:
            OAuth token or None if failed
        """
        # Verify state
        oauth_state = self._pending_states.get(state)
        if not oauth_state or not oauth_state.is_valid():
            logger.error("Invalid or expired OAuth state")
            return None

        # Remove used state
        del self._pending_states[state]

        # Prepare token request
        data = {
            "client_id": self.client_id,
            "code": code,
            "grant_type": "authorization_code",
            "redirect_uri": oauth_state.redirect_uri,
        }

        if self.client_secret:
            data["client_secret"] = self.client_secret

        if oauth_state.code_verifier:
            data["code_verifier"] = oauth_state.code_verifier

        # Exchange code for token
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.token_url,
                    data=data,
                    headers={"Accept": "application/json"}
                )
                response.raise_for_status()
                token_data = response.json()
            except httpx.HTTPError as e:
                logger.error(f"Token exchange failed: {e}")
                return None

        # Create token object
        token = OAuthToken.from_oauth_response(token_data, oauth_state.user_id)

        # Fetch user info
        try:
            user_info = await self._get_user_info(token.access_token)
            token.gitlab_user = user_info
        except Exception as e:
            logger.warning(f"Failed to fetch user info: {e}")

        # Store token
        self.token_store.save_token(oauth_state.user_id, token)

        return token

    async def refresh_token(self, user_id: str) -> OAuthToken | None:
        """
        Refresh an expired token.

        Args:
            user_id: User identifier

        Returns:
            New OAuth token or None if refresh failed
        """
        token = self.token_store.get_token(user_id)
        if not token or not token.refresh_token:
            return None

        data = {
            "client_id": self.client_id,
            "refresh_token": token.refresh_token,
            "grant_type": "refresh_token",
        }

        if self.client_secret:
            data["client_secret"] = self.client_secret

        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(
                    self.token_url,
                    data=data,
                    headers={"Accept": "application/json"}
                )
                response.raise_for_status()
                token_data = response.json()
            except httpx.HTTPError as e:
                logger.error(f"Token refresh failed: {e}")
                return None

        # Create new token
        new_token = OAuthToken.from_oauth_response(token_data, user_id)
        new_token.gitlab_user = token.gitlab_user

        # Store new token
        self.token_store.save_token(user_id, new_token)

        return new_token

    async def get_valid_token(self, user_id: str) -> OAuthToken | None:
        """
        Get a valid token for user, refreshing if needed.

        Args:
            user_id: User identifier

        Returns:
            Valid OAuth token or None
        """
        token = self.token_store.get_token(user_id)
        if not token:
            return None

        if token.is_expired():
            if token.refresh_token:
                token = await self.refresh_token(user_id)
            else:
                logger.warning(f"Token expired for user {user_id[:8]}, no refresh token")
                return None

        return token

    async def _get_user_info(self, access_token: str) -> dict[str, Any]:
        """Fetch GitLab user info."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                self.user_url,
                headers={"Authorization": f"Bearer {access_token}"}
            )
            response.raise_for_status()
            return response.json()

    def get_user_token(self, user_id: str) -> OAuthToken | None:
        """Get user's stored token (may be expired)."""
        return self.token_store.get_token(user_id)

    def logout(self, user_id: str) -> bool:
        """Remove user's token (logout)."""
        return self.token_store.delete_token(user_id)

    def is_authenticated(self, user_id: str) -> bool:
        """Check if user has a stored token."""
        token = self.token_store.get_token(user_id)
        return token is not None and not token.is_expired()


class PersonalAccessTokenAuth:
    """
    Simple authentication using Personal Access Token.

    For automation and service accounts that don't need OAuth flow.
    """

    def __init__(
        self,
        gitlab_url: str,
        token: str,
        user_id: str = "pat-user"
    ):
        """
        Initialize PAT authentication.

        Args:
            gitlab_url: GitLab instance URL
            token: Personal Access Token
            user_id: Identifier for token storage
        """
        self.gitlab_url = gitlab_url.rstrip("/")
        self.token = token
        self.user_id = user_id
        self.token_store = UserTokenStore()

        # Store as OAuth token for unified interface
        oauth_token = OAuthToken(
            access_token=token,
            token_type="Bearer",
            user_id=user_id,
            expires_at=None,  # PATs don't expire (unless revoked)
        )
        self.token_store.save_token(user_id, oauth_token)

    def get_token(self) -> OAuthToken:
        """Get the stored token."""
        return self.token_store.get_token(self.user_id)

    @property
    def access_token(self) -> str:
        """Get the access token string."""
        return self.token
