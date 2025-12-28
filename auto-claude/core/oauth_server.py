"""
OAuth Callback Server for Auto Claude.

Provides a threaded HTTP server that handles OAuth 2.0 callback redirects
on port 8487. The server accepts a single callback request, extracts the
authorization code, and shuts down gracefully.
"""

import socket
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from typing import Optional
from urllib.parse import parse_qs, urlparse

# OAuth callback configuration (Anthropic's pre-whitelisted redirect)
OAUTH_CALLBACK_HOST = "127.0.0.1"
OAUTH_CALLBACK_PORT = 8487
OAUTH_CALLBACK_PATH = "/oauth/callback"


class OAuthCallbackHandler(BaseHTTPRequestHandler):
    """HTTP request handler for OAuth callback."""

    # Store the received authorization code and state
    authorization_code: Optional[str] = None
    received_state: Optional[str] = None
    error: Optional[str] = None
    error_description: Optional[str] = None

    def log_message(self, format: str, *args) -> None:
        """Suppress HTTP server logging to avoid noise."""
        pass

    def do_GET(self) -> None:
        """Handle GET request for OAuth callback."""
        parsed_url = urlparse(self.path)

        # Only handle the OAuth callback path
        if parsed_url.path != OAUTH_CALLBACK_PATH:
            self.send_error(404, "Not Found")
            return

        # Parse query parameters
        query_params = parse_qs(parsed_url.query)

        # Check for error response from OAuth provider
        if "error" in query_params:
            OAuthCallbackHandler.error = query_params["error"][0]
            OAuthCallbackHandler.error_description = query_params.get(
                "error_description", ["Unknown error"]
            )[0]
            self._send_error_response()
            return

        # Extract authorization code
        if "code" not in query_params:
            OAuthCallbackHandler.error = "missing_code"
            OAuthCallbackHandler.error_description = (
                "No authorization code received in callback"
            )
            self._send_error_response()
            return

        OAuthCallbackHandler.authorization_code = query_params["code"][0]
        OAuthCallbackHandler.received_state = query_params.get("state", [None])[0]

        self._send_success_response()

    def _send_success_response(self) -> None:
        """Send success HTML response to browser."""
        html = """<!DOCTYPE html>
<html>
<head>
    <title>Authentication Successful</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }
        .container {
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 { color: #22c55e; margin-bottom: 10px; }
        p { color: #666; }
    </style>
</head>
<body>
    <div class="container">
        <h1>Authentication Successful</h1>
        <p>You can close this window and return to the terminal.</p>
    </div>
</body>
</html>"""
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))

    def _send_error_response(self) -> None:
        """Send error HTML response to browser."""
        error = OAuthCallbackHandler.error or "unknown_error"
        description = OAuthCallbackHandler.error_description or "An error occurred"

        html = f"""<!DOCTYPE html>
<html>
<head>
    <title>Authentication Failed</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background-color: #f5f5f5;
        }}
        .container {{
            text-align: center;
            padding: 40px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }}
        h1 {{ color: #ef4444; margin-bottom: 10px; }}
        p {{ color: #666; }}
        .error-code {{ font-family: monospace; color: #999; font-size: 12px; }}
    </style>
</head>
<body>
    <div class="container">
        <h1>Authentication Failed</h1>
        <p>{description}</p>
        <p class="error-code">Error: {error}</p>
    </div>
</body>
</html>"""
        self.send_response(400)
        self.send_header("Content-Type", "text/html")
        self.send_header("Content-Length", str(len(html)))
        self.end_headers()
        self.wfile.write(html.encode("utf-8"))


class OAuthCallbackServer:
    """
    Threaded HTTP server for handling OAuth 2.0 callbacks.

    Starts a local server on port 8487 to receive the OAuth redirect,
    extracts the authorization code, and shuts down after receiving
    a single callback request.
    """

    def __init__(self) -> None:
        """Initialize the callback server."""
        self._server: Optional[HTTPServer] = None
        self._thread: Optional[threading.Thread] = None
        self._shutdown_event = threading.Event()

        # Reset handler state
        OAuthCallbackHandler.authorization_code = None
        OAuthCallbackHandler.received_state = None
        OAuthCallbackHandler.error = None
        OAuthCallbackHandler.error_description = None

    def start(self, timeout: float = 300.0) -> None:
        """
        Start the callback server in a background thread.

        Args:
            timeout: Maximum time in seconds to wait for callback (default 5 minutes)

        Raises:
            OAuthServerError: If port 8487 is already in use
        """
        # Check if port is available before starting
        if not self._is_port_available():
            raise OAuthServerError(
                f"Port {OAUTH_CALLBACK_PORT} is already in use. "
                "Please close any application using this port and try again."
            )

        try:
            self._server = HTTPServer(
                (OAUTH_CALLBACK_HOST, OAUTH_CALLBACK_PORT),
                OAuthCallbackHandler,
            )
            # Set timeout so server can check for shutdown
            self._server.timeout = 1.0
        except OSError as e:
            raise OAuthServerError(
                f"Failed to start OAuth callback server on port {OAUTH_CALLBACK_PORT}: {e}"
            ) from e

        def serve() -> None:
            """Server loop that handles requests until shutdown."""
            while not self._shutdown_event.is_set():
                self._server.handle_request()
                # Stop after receiving authorization code or error
                if (
                    OAuthCallbackHandler.authorization_code is not None
                    or OAuthCallbackHandler.error is not None
                ):
                    break

        self._thread = threading.Thread(target=serve, daemon=True)
        self._thread.start()

    def wait_for_callback(self, timeout: float = 300.0) -> "OAuthCallbackResult":
        """
        Wait for the OAuth callback to be received.

        Args:
            timeout: Maximum time in seconds to wait (default 5 minutes)

        Returns:
            OAuthCallbackResult containing the code, state, or error information
        """
        if self._thread is None:
            raise OAuthServerError("Server not started. Call start() first.")

        self._thread.join(timeout=timeout)

        if self._thread.is_alive():
            # Timeout occurred
            self.shutdown()
            return OAuthCallbackResult(
                success=False,
                error="timeout",
                error_description="OAuth callback was not received within the timeout period",
            )

        if OAuthCallbackHandler.error:
            return OAuthCallbackResult(
                success=False,
                error=OAuthCallbackHandler.error,
                error_description=OAuthCallbackHandler.error_description,
            )

        if OAuthCallbackHandler.authorization_code:
            return OAuthCallbackResult(
                success=True,
                code=OAuthCallbackHandler.authorization_code,
                state=OAuthCallbackHandler.received_state,
            )

        return OAuthCallbackResult(
            success=False,
            error="unknown",
            error_description="No authorization code or error received",
        )

    def shutdown(self) -> None:
        """Shut down the callback server gracefully."""
        self._shutdown_event.set()

        if self._server:
            self._server.shutdown()
            self._server.server_close()
            self._server = None

        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=2.0)
            self._thread = None

    def _is_port_available(self) -> bool:
        """Check if the OAuth callback port is available."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(1.0)
                result = sock.connect_ex((OAUTH_CALLBACK_HOST, OAUTH_CALLBACK_PORT))
                # If connection succeeds (result == 0), port is in use
                return result != 0
        except socket.error:
            # Socket error likely means port is available
            return True

    @property
    def callback_url(self) -> str:
        """Get the full callback URL."""
        return f"http://{OAUTH_CALLBACK_HOST}:{OAUTH_CALLBACK_PORT}{OAUTH_CALLBACK_PATH}"


class OAuthCallbackResult:
    """Result of an OAuth callback operation."""

    def __init__(
        self,
        success: bool,
        code: Optional[str] = None,
        state: Optional[str] = None,
        error: Optional[str] = None,
        error_description: Optional[str] = None,
    ) -> None:
        """
        Initialize callback result.

        Args:
            success: Whether the callback was successful
            code: Authorization code (if successful)
            state: OAuth state parameter (if provided)
            error: Error code (if failed)
            error_description: Human-readable error description (if failed)
        """
        self.success = success
        self.code = code
        self.state = state
        self.error = error
        self.error_description = error_description

    def __repr__(self) -> str:
        if self.success:
            return f"OAuthCallbackResult(success=True, code='{self.code[:10]}...')"
        return f"OAuthCallbackResult(success=False, error='{self.error}')"


class OAuthServerError(Exception):
    """Exception raised for OAuth server errors."""

    pass
