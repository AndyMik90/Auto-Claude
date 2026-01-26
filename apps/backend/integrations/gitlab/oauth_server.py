"""
GitLab OAuth Callback Server
=============================

Simple HTTP server for handling GitLab OAuth callbacks.
Runs temporarily during the authentication flow to capture the
authorization code from GitLab's redirect.

Usage:
    from integrations.gitlab.oauth_server import run_oauth_flow

    # This opens browser, waits for callback, and returns token
    token = await run_oauth_flow(oauth, user_id="user@example.com")
"""

import asyncio
import logging
import webbrowser

from aiohttp import web

from .oauth import GitLabOAuth, OAuthToken

logger = logging.getLogger(__name__)

DEFAULT_PORT = 8765


class OAuthCallbackServer:
    """
    Temporary HTTP server for OAuth callback handling.

    Starts a server, opens the authorization URL in browser,
    waits for the callback, exchanges code for token, then shuts down.
    """

    def __init__(
        self,
        oauth: GitLabOAuth,
        user_id: str,
        port: int = DEFAULT_PORT,
    ):
        self.oauth = oauth
        self.user_id = user_id
        self.port = port
        self._token: OAuthToken | None = None
        self._error: str | None = None
        self._event = asyncio.Event()

    async def _handle_callback(self, request: web.Request) -> web.Response:
        """Handle OAuth callback from GitLab."""
        code = request.query.get("code")
        state = request.query.get("state")
        error = request.query.get("error")
        error_description = request.query.get("error_description", "")

        if error:
            self._error = f"{error}: {error_description}"
            self._event.set()
            # Escape user-provided values to prevent XSS
            import html

            safe_error = html.escape(error)
            safe_desc = html.escape(error_description)
            return web.Response(
                text=f"""
                <html>
                <head><title>Authentication Failed</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                    <h1 style="color: #dc3545;">Authentication Failed</h1>
                    <p>{safe_error}: {safe_desc}</p>
                    <p>You can close this window.</p>
                </body>
                </html>
                """,
                content_type="text/html",
            )

        if not code or not state:
            self._error = "Missing code or state parameter"
            self._event.set()
            return web.Response(
                text="""
                <html>
                <head><title>Authentication Error</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                    <h1 style="color: #dc3545;">Authentication Error</h1>
                    <p>Missing required parameters.</p>
                    <p>You can close this window.</p>
                </body>
                </html>
                """,
                content_type="text/html",
            )

        try:
            self._token = await self.oauth.exchange_code(code, state)

            if self._token:
                username = "Unknown"
                if self._token.gitlab_user:
                    username = self._token.gitlab_user.get("username", "Unknown")

                return web.Response(
                    text=f"""
                    <html>
                    <head><title>Authentication Successful</title></head>
                    <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                        <h1 style="color: #28a745;">✓ Authentication Successful</h1>
                        <p>Logged in as: <strong>{username}</strong></p>
                        <p>You can close this window and return to the terminal.</p>
                        <script>setTimeout(function() {{ window.close(); }}, 3000);</script>
                    </body>
                    </html>
                    """,
                    content_type="text/html",
                )
            else:
                self._error = "Failed to exchange code for token"
                return web.Response(
                    text="""
                    <html>
                    <head><title>Authentication Failed</title></head>
                    <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                        <h1 style="color: #dc3545;">Authentication Failed</h1>
                        <p>Could not complete authentication.</p>
                        <p>You can close this window.</p>
                    </body>
                    </html>
                    """,
                    content_type="text/html",
                )
        except Exception as e:
            # Log the actual error for debugging but don't expose to user
            logger.error(f"OAuth callback error: {e}")
            self._error = str(e)
            return web.Response(
                text="""
                <html>
                <head><title>Authentication Error</title></head>
                <body style="font-family: sans-serif; padding: 40px; text-align: center;">
                    <h1 style="color: #dc3545;">Authentication Error</h1>
                    <p>An unexpected error occurred during authentication.</p>
                    <p>You can close this window.</p>
                </body>
                </html>
                """,
                content_type="text/html",
            )
        finally:
            self._event.set()

    async def run(self, timeout: float = 300.0) -> OAuthToken | None:
        """
        Start OAuth flow and wait for completion.

        Args:
            timeout: Maximum time to wait for callback (seconds)

        Returns:
            OAuth token if successful, None otherwise
        """
        # Create web app
        app = web.Application()
        app.router.add_get("/oauth/callback", self._handle_callback)

        # Start server
        runner = web.AppRunner(app)
        await runner.setup()
        site = web.TCPSite(runner, "localhost", self.port)
        await site.start()

        logger.info(f"OAuth callback server started on port {self.port}")

        try:
            # Get authorization URL and open browser
            auth_url, state = self.oauth.get_authorization_url(self.user_id)
            print("\nOpening browser for GitLab authentication...")
            print(f"If browser doesn't open, visit: {auth_url}\n")
            webbrowser.open(auth_url)

            # Wait for callback or timeout
            try:
                await asyncio.wait_for(self._event.wait(), timeout=timeout)
            except asyncio.TimeoutError:
                self._error = "Authentication timed out"

            if self._error:
                logger.error(f"OAuth error: {self._error}")
                print(f"\n❌ Authentication failed: {self._error}")
                return None

            if self._token:
                username = "Unknown"
                if self._token.gitlab_user:
                    username = self._token.gitlab_user.get("username", "Unknown")
                print(f"\n✓ Successfully authenticated as: {username}")

            return self._token

        finally:
            await runner.cleanup()
            logger.info("OAuth callback server stopped")


async def run_oauth_flow(
    oauth: GitLabOAuth,
    user_id: str,
    port: int = DEFAULT_PORT,
    timeout: float = 300.0,
) -> OAuthToken | None:
    """
    Run the complete OAuth flow.

    Opens browser for authentication, waits for callback,
    exchanges code for token, and returns the token.

    Args:
        oauth: GitLabOAuth instance
        user_id: User identifier
        port: Callback server port
        timeout: Maximum wait time

    Returns:
        OAuth token if successful
    """
    server = OAuthCallbackServer(oauth, user_id, port)
    return await server.run(timeout)


def run_oauth_flow_sync(
    oauth: GitLabOAuth,
    user_id: str,
    port: int = DEFAULT_PORT,
    timeout: float = 300.0,
) -> OAuthToken | None:
    """
    Synchronous wrapper for run_oauth_flow.

    For use in non-async contexts.
    """
    return asyncio.run(run_oauth_flow(oauth, user_id, port, timeout))
