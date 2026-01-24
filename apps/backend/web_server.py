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
import fcntl
import json
import logging
import os
import pty
import select
import signal
import struct
import termios
from typing import Any, Awaitable, Callable, Dict, Optional, Set, Tuple

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

# Track PTY sessions: websocket -> (master_fd, pid, read_task)
pty_sessions: Dict[WebSocketServerProtocol, Tuple[int, int, Optional[asyncio.Task]]] = {}

# In-memory task storage for web UI
# TODO: Replace with persistent storage or integrate with backend task manager
tasks_storage: Dict[str, Dict[str, Any]] = {}

# Type alias for channel handler functions
ChannelHandler = Callable[[WebSocketServerProtocol, Any], Awaitable[Optional[Dict[str, Any]]]]


# ============================================================================
# PTY Session Management
# ============================================================================

def create_pty_session(rows: int = 24, cols: int = 80) -> Tuple[int, int]:
    """
    Create a new PTY session with a shell.

    Args:
        rows: Terminal rows
        cols: Terminal columns

    Returns:
        Tuple of (master_fd, pid)
    """
    # Fork a new process with a PTY
    pid, master_fd = pty.fork()

    if pid == 0:
        # Child process - execute shell
        shell = os.environ.get("SHELL", "/bin/bash")
        os.execvp(shell, [shell])
    else:
        # Parent process - configure PTY
        # Set terminal size
        winsize = struct.pack("HHHH", rows, cols, 0, 0)
        fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)

        # Set non-blocking mode
        flags = fcntl.fcntl(master_fd, fcntl.F_GETFL)
        fcntl.fcntl(master_fd, fcntl.F_SETFL, flags | os.O_NONBLOCK)

        logger.info("Created PTY session: pid=%d, fd=%d, size=%dx%d",
                   pid, master_fd, rows, cols)
        return master_fd, pid


async def read_pty_output(websocket: WebSocketServerProtocol, master_fd: int) -> None:
    """
    Read output from PTY and send to WebSocket.
    Runs in background until WebSocket closes or PTY ends.

    Args:
        websocket: WebSocket connection to send data to
        master_fd: PTY master file descriptor
    """
    loop = asyncio.get_event_loop()

    try:
        while True:
            # Wait for data to be available
            readable, _, _ = await loop.run_in_executor(
                None, select.select, [master_fd], [], [], 0.1
            )

            if master_fd in readable:
                try:
                    # Read from PTY
                    data = os.read(master_fd, 4096)
                    if not data:
                        # PTY closed
                        logger.info("PTY master_fd=%d closed (EOF)", master_fd)
                        break

                    # Send to WebSocket as terminal channel message
                    message = {
                        "channel": "terminal",
                        "data": {
                            "type": "output",
                            "data": data.decode("utf-8", errors="replace")
                        }
                    }
                    await websocket.send(json.dumps(message))

                except OSError as e:
                    # PTY closed or error
                    logger.warning("Error reading from PTY fd=%d: %s", master_fd, e)
                    break

            # Check if WebSocket is still open
            if websocket.closed:
                logger.info("WebSocket closed, stopping PTY reader for fd=%d", master_fd)
                break

    except Exception as e:
        logger.error("Error in PTY reader for fd=%d: %s", master_fd, e, exc_info=True)


def cleanup_pty_session(websocket: WebSocketServerProtocol) -> None:
    """
    Clean up a PTY session associated with a WebSocket.

    Args:
        websocket: WebSocket connection
    """
    if websocket not in pty_sessions:
        return

    master_fd, pid, read_task = pty_sessions[websocket]

    logger.info("Cleaning up PTY session: pid=%d, fd=%d", pid, master_fd)

    # Cancel read task if running
    if read_task and not read_task.done():
        read_task.cancel()

    # Close PTY master
    try:
        os.close(master_fd)
        logger.debug("Closed PTY master fd=%d", master_fd)
    except OSError as e:
        logger.warning("Error closing PTY fd=%d: %s", master_fd, e)

    # Terminate child process
    try:
        os.kill(pid, signal.SIGTERM)
        # Wait for process to exit (non-blocking)
        try:
            os.waitpid(pid, os.WNOHANG)
            logger.debug("Terminated PTY process pid=%d", pid)
        except ChildProcessError:
            pass  # Process already exited
    except ProcessLookupError:
        logger.debug("PTY process pid=%d already terminated", pid)
    except Exception as e:
        logger.warning("Error terminating PTY process pid=%d: %s", pid, e)

    # Remove from tracking
    del pty_sessions[websocket]
    logger.info("PTY session cleaned up: %d active sessions remaining",
               len(pty_sessions))


def resize_pty(master_fd: int, rows: int, cols: int) -> None:
    """
    Resize a PTY terminal.

    Args:
        master_fd: PTY master file descriptor
        rows: New number of rows
        cols: New number of columns
    """
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(master_fd, termios.TIOCSWINSZ, winsize)
    logger.debug("Resized PTY fd=%d to %dx%d", master_fd, rows, cols)


# ============================================================================
# Channel Handlers
# ============================================================================

async def handle_echo_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Echo channel handler for testing and debugging.

    Args:
        websocket: WebSocket connection
        data: Message data to echo back

    Returns:
        Response data dictionary
    """
    logger.info("Echo channel: %s", data)
    return {
        "status": "received",
        "echo": data
    }


async def handle_ping_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Ping/pong channel handler for connection health checks.

    Args:
        websocket: WebSocket connection
        data: Ping data (typically timestamp)

    Returns:
        Pong response with original data
    """
    return {
        "status": "pong",
        "timestamp": data.get("timestamp") if isinstance(data, dict) else None
    }


async def handle_terminal_channel(websocket: WebSocketServerProtocol, data: Any) -> Optional[Dict[str, Any]]:
    """
    Terminal channel handler for PTY session management.

    Message types:
    - {"type": "start", "rows": 24, "cols": 80} - Create new PTY session
    - {"type": "input", "data": "..."} - Send input to PTY
    - {"type": "resize", "rows": 30, "cols": 100} - Resize PTY

    Args:
        websocket: WebSocket connection
        data: Message data

    Returns:
        Response data dictionary or None (output sent separately)
    """
    if not isinstance(data, dict):
        return {
            "status": "error",
            "error": "Invalid data",
            "message": "Terminal channel expects object with 'type' field"
        }

    msg_type = data.get("type")

    if msg_type == "start":
        # Create new PTY session
        if websocket in pty_sessions:
            return {
                "status": "error",
                "error": "Session exists",
                "message": "PTY session already exists for this connection"
            }

        try:
            rows = data.get("rows", 24)
            cols = data.get("cols", 80)

            # Create PTY
            master_fd, pid = create_pty_session(rows, cols)

            # Start background task to read PTY output
            read_task = asyncio.create_task(read_pty_output(websocket, master_fd))

            # Track session
            pty_sessions[websocket] = (master_fd, pid, read_task)

            return {
                "status": "started",
                "pid": pid,
                "rows": rows,
                "cols": cols
            }

        except Exception as e:
            logger.error("Failed to create PTY session: %s", e, exc_info=True)
            return {
                "status": "error",
                "error": "PTY creation failed",
                "message": str(e)
            }

    elif msg_type == "input":
        # Send input to PTY
        if websocket not in pty_sessions:
            return {
                "status": "error",
                "error": "No session",
                "message": "No PTY session exists for this connection"
            }

        master_fd, pid, _ = pty_sessions[websocket]
        input_data = data.get("data", "")

        try:
            # Write to PTY
            os.write(master_fd, input_data.encode("utf-8"))
            # No response needed - output will come via read task
            return None

        except OSError as e:
            logger.error("Failed to write to PTY fd=%d: %s", master_fd, e)
            return {
                "status": "error",
                "error": "Write failed",
                "message": str(e)
            }

    elif msg_type == "resize":
        # Resize PTY
        if websocket not in pty_sessions:
            return {
                "status": "error",
                "error": "No session",
                "message": "No PTY session exists for this connection"
            }

        master_fd, _, _ = pty_sessions[websocket]
        rows = data.get("rows", 24)
        cols = data.get("cols", 80)

        try:
            resize_pty(master_fd, rows, cols)
            return {
                "status": "resized",
                "rows": rows,
                "cols": cols
            }

        except Exception as e:
            logger.error("Failed to resize PTY fd=%d: %s", master_fd, e)
            return {
                "status": "error",
                "error": "Resize failed",
                "message": str(e)
            }

    else:
        return {
            "status": "error",
            "error": "Unknown type",
            "message": f"Unknown terminal message type: {msg_type}"
        }


async def handle_task_list_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Handle task:list - Get all tasks.

    Args:
        websocket: WebSocket connection
        data: Message data (contains projectId)

    Returns:
        Response with all tasks
    """
    tasks = list(tasks_storage.values())
    logger.info("Listing %d tasks", len(tasks))

    # Send tasks-loaded event
    await websocket.send(json.dumps({
        "channel": "tasks-loaded",
        "data": tasks
    }))

    return {
        "success": True,
        "tasks": tasks
    }


async def handle_task_create_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Handle task:create - Create new task.

    Args:
        websocket: WebSocket connection
        data: Message data containing task details

    Returns:
        Response with created task
    """
    if not isinstance(data, dict):
        return {
            "success": False,
            "error": "Invalid data format"
        }

    # Extract task data
    title = data.get("title", "")
    description = data.get("description", "")
    status = data.get("status", "backlog")

    if not title:
        return {
            "success": False,
            "error": "Title is required"
        }

    # Create task
    import uuid
    from datetime import datetime

    task_id = str(uuid.uuid4())
    task = {
        "id": task_id,
        "title": title,
        "description": description,
        "status": status,
        "metadata": {
            "createdAt": datetime.now().isoformat(),
            "updatedAt": datetime.now().isoformat(),
            "priority": data.get("priority", "medium")
        }
    }

    # Store task
    tasks_storage[task_id] = task
    logger.info("Created task: %s - %s", task_id, title)

    # Broadcast to all connected clients
    await broadcast_message({
        "channel": "task-created",
        "data": task
    })

    return {
        "success": True,
        "task": task
    }


async def handle_task_update_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Handle task:update - Update task details.

    Args:
        websocket: WebSocket connection
        data: Message data containing taskId and updates

    Returns:
        Response with updated task
    """
    if not isinstance(data, dict):
        return {
            "success": False,
            "error": "Invalid data format"
        }

    task_id = data.get("taskId")
    updates = data.get("updates", {})

    if not task_id:
        return {
            "success": False,
            "error": "taskId is required"
        }

    if task_id not in tasks_storage:
        return {
            "success": False,
            "error": f"Task {task_id} not found"
        }

    # Update task
    from datetime import datetime
    task = tasks_storage[task_id]
    task.update(updates)
    task["metadata"]["updatedAt"] = datetime.now().isoformat()

    logger.info("Updated task: %s", task_id)

    # Broadcast to all connected clients
    await broadcast_message({
        "channel": "task-updated",
        "data": {"taskId": task_id, "updates": updates}
    })

    return {
        "success": True,
        "task": task
    }


async def handle_task_delete_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Handle task:delete - Delete task.

    Args:
        websocket: WebSocket connection
        data: Message data containing taskId

    Returns:
        Response confirming deletion
    """
    if not isinstance(data, dict):
        return {
            "success": False,
            "error": "Invalid data format"
        }

    task_id = data.get("taskId")

    if not task_id:
        return {
            "success": False,
            "error": "taskId is required"
        }

    if task_id not in tasks_storage:
        return {
            "success": False,
            "error": f"Task {task_id} not found"
        }

    # Delete task
    del tasks_storage[task_id]
    logger.info("Deleted task: %s", task_id)

    # Broadcast to all connected clients
    await broadcast_message({
        "channel": "task-deleted",
        "data": {"taskId": task_id}
    })

    return {
        "success": True,
        "taskId": task_id
    }


async def handle_task_move_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Handle task:move - Move task to different status/column.

    Args:
        websocket: WebSocket connection
        data: Message data containing taskId and status

    Returns:
        Response with updated task
    """
    if not isinstance(data, dict):
        return {
            "success": False,
            "error": "Invalid data format"
        }

    task_id = data.get("taskId")
    status = data.get("status")

    if not task_id or not status:
        return {
            "success": False,
            "error": "taskId and status are required"
        }

    if task_id not in tasks_storage:
        return {
            "success": False,
            "error": f"Task {task_id} not found"
        }

    # Update task status
    from datetime import datetime
    task = tasks_storage[task_id]
    task["status"] = status
    task["metadata"]["updatedAt"] = datetime.now().isoformat()

    logger.info("Moved task %s to %s", task_id, status)

    # Broadcast to all connected clients
    await broadcast_message({
        "channel": "task-status-changed",
        "data": {"taskId": task_id, "status": status}
    })

    return {
        "success": True,
        "task": task
    }


async def handle_unknown_channel(websocket: WebSocketServerProtocol, data: Any) -> Dict[str, Any]:
    """
    Default handler for unknown channels.

    Args:
        websocket: WebSocket connection
        data: Message data

    Returns:
        Error response
    """
    return {
        "status": "error",
        "error": "Unknown channel",
        "message": "The requested channel is not supported"
    }


# Channel routing table
CHANNEL_HANDLERS: Dict[str, ChannelHandler] = {
    "echo": handle_echo_channel,
    "ping": handle_ping_channel,
    "terminal": handle_terminal_channel,
    "task:list": handle_task_list_channel,
    "task:create": handle_task_create_channel,
    "task:update": handle_task_update_channel,
    "task:delete": handle_task_delete_channel,
    "task:move": handle_task_move_channel,
}


async def broadcast_message(message: Dict[str, Any]) -> None:
    """
    Broadcast a message to all connected WebSocket clients.

    Args:
        message: Message dictionary to broadcast
    """
    if not active_connections:
        return

    # Convert message to JSON
    message_json = json.dumps(message)

    # Send to all active connections
    disconnected = set()
    for websocket in active_connections:
        try:
            await websocket.send(message_json)
        except Exception as e:
            logger.warning("Failed to broadcast to client %s: %s", id(websocket), e)
            disconnected.add(websocket)

    # Clean up disconnected clients
    for websocket in disconnected:
        active_connections.discard(websocket)


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
            await websocket.send(json.dumps({
                "channel": "error",
                "data": {
                    "status": "error",
                    "error": "Missing channel field"
                }
            }))
            return

        logger.debug("Received message on channel '%s': %s", channel, data)

        # Route to appropriate channel handler
        handler = CHANNEL_HANDLERS.get(channel, handle_unknown_channel)

        try:
            # Execute handler and get response data
            response_data = await handler(websocket, data)

            # Send response if handler returned data
            if response_data is not None:
                response = {
                    "channel": channel,
                    "data": response_data
                }
                await websocket.send(json.dumps(response))

        except Exception as handler_error:
            logger.error("Error in handler for channel '%s': %s",
                        channel, handler_error, exc_info=True)
            # Send error response to client
            error_response = {
                "channel": channel,
                "data": {
                    "status": "error",
                    "error": "Handler error",
                    "message": str(handler_error)
                }
            }
            await websocket.send(json.dumps(error_response))

    except json.JSONDecodeError as e:
        logger.error("Invalid JSON message: %s - Error: %s", message, e)
        try:
            await websocket.send(json.dumps({
                "channel": "error",
                "data": {
                    "status": "error",
                    "error": "Invalid JSON",
                    "message": str(e)
                }
            }))
        except Exception:
            pass  # Connection may be closed
    except Exception as e:
        logger.error("Error handling message: %s", e, exc_info=True)


async def handle_client(websocket: WebSocketServerProtocol) -> None:
    """
    Handle WebSocket client connection lifecycle.

    Args:
        websocket: WebSocket connection
    """
    # Register connection
    active_connections.add(websocket)
    client_id = id(websocket)
    logger.info("Client %s connected from %s",
                client_id, websocket.remote_address)

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
        # Clean up PTY session if exists
        cleanup_pty_session(websocket)

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
