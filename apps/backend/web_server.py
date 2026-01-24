#!/usr/bin/env python3
"""
WebSocket Server for Web UI
============================

Provides WebSocket communication layer for the web-based UI.
Handles channel-based message routing and PTY session management for terminals.

This server replaces Electron IPC for the browser-based version of Auto-Claude.

Usage:
    python apps/backend/web_server.py

Environment Variables:
    WEB_SERVER_PORT - Server port (default: 8765)
    WEB_SERVER_HOST - Bind address (default: 0.0.0.0)
    CORS_ORIGINS - Allowed CORS origins (default: http://localhost:5173)
"""

import asyncio
import json
import logging
import os
from typing import Any, Dict, Set

try:
    import websockets
    from websockets.server import WebSocketServerProtocol
except ImportError:
    raise ImportError(
        "websockets library not installed. "
        "Please install it: pip install websockets>=11.0"
    )

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Server configuration
DEFAULT_PORT = 8765
DEFAULT_HOST = "0.0.0.0"
DEFAULT_CORS_ORIGINS = "http://localhost:5173"

# Track active connections
active_connections: Set[WebSocketServerProtocol] = set()


async def handle_message(websocket: WebSocketServerProtocol, message: str) -> None:
    """
    Handle incoming WebSocket message with channel-based routing.

    Message format: {"channel": "channel-name", "data": {...}}

    Args:
        websocket: WebSocket connection
        message: Raw message string
    """
    try:
        # Parse message
        parsed = json.loads(message)
        channel = parsed.get("channel")
        data = parsed.get("data")

        if not channel:
            logger.warning("Message missing 'channel' field: %s", message)
            return

        logger.debug("Received message on channel '%s': %s", channel, data)

        # TODO: Route to appropriate channel handlers
        # For now, echo back for basic testing
        response = {
            "channel": channel,
            "data": {
                "status": "received",
                "echo": data
            }
        }

        await websocket.send(json.dumps(response))

    except json.JSONDecodeError as e:
        logger.error("Invalid JSON message: %s - Error: %s", message, e)
    except Exception as e:
        logger.error("Error handling message: %s", e, exc_info=True)


async def handle_client(websocket: WebSocketServerProtocol, path: str) -> None:
    """
    Handle WebSocket client connection lifecycle.

    Args:
        websocket: WebSocket connection
        path: Connection path
    """
    # Register connection
    active_connections.add(websocket)
    client_id = id(websocket)
    logger.info("Client %s connected from %s (path: %s)",
                client_id, websocket.remote_address, path)

    try:
        # Handle messages
        async for message in websocket:
            await handle_message(websocket, message)

    except websockets.exceptions.ConnectionClosedOK:
        logger.info("Client %s disconnected normally", client_id)
    except websockets.exceptions.ConnectionClosedError as e:
        logger.warning("Client %s connection closed with error: %s", client_id, e)
    except Exception as e:
        logger.error("Error handling client %s: %s", client_id, e, exc_info=True)
    finally:
        # Unregister connection
        active_connections.discard(websocket)
        logger.info("Client %s cleaned up (%d active connections)",
                    client_id, len(active_connections))


async def start_server(host: str = DEFAULT_HOST, port: int = DEFAULT_PORT) -> None:
    """
    Start the WebSocket server.

    Args:
        host: Host address to bind to
        port: Port to listen on
    """
    logger.info("Starting WebSocket server on %s:%s", host, port)

    async with websockets.serve(handle_client, host, port):
        logger.info("WebSocket server running on ws://%s:%s", host, port)
        logger.info("Press Ctrl+C to stop the server")

        # Run until interrupted
        await asyncio.Future()  # Run forever


def main() -> None:
    """
    Main entry point for the WebSocket server.
    """
    # Load configuration from environment
    host = os.getenv("WEB_SERVER_HOST", DEFAULT_HOST)
    port = int(os.getenv("WEB_SERVER_PORT", str(DEFAULT_PORT)))
    cors_origins = os.getenv("CORS_ORIGINS", DEFAULT_CORS_ORIGINS)

    logger.info("Configuration:")
    logger.info("  Host: %s", host)
    logger.info("  Port: %s", port)
    logger.info("  CORS Origins: %s", cors_origins)

    try:
        # Start server
        asyncio.run(start_server(host, port))
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error("Server error: %s", e, exc_info=True)
        raise


if __name__ == "__main__":
    main()
