"""
Auto Claude Web API - Main Application
=======================================

FastAPI application with CORS, routers, and WebSocket support.
"""

import asyncio
import logging
import sys
import time
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Any

# Load .env BEFORE any other imports (critical for phase_config, etc.)
_BACKEND_DIR = Path(__file__).parent.parent
_ENV_FILE = _BACKEND_DIR / ".env"
if _ENV_FILE.exists():
    try:
        from dotenv import load_dotenv
        load_dotenv(_ENV_FILE)
        print(f"[Web API] Loaded .env from {_ENV_FILE}")
    except ImportError:
        # Fallback: manually load .env
        import os
        with open(_ENV_FILE) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    key, _, value = line.partition('=')
                    os.environ.setdefault(key.strip(), value.strip())
        print(f"[Web API] Loaded .env (manual) from {_ENV_FILE}")

from fastapi import FastAPI, Request, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(message)s",
    datefmt="%H:%M:%S"
)
logger = logging.getLogger("auto-claude-api")

# Ensure parent directory is in path for imports
if str(_BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(_BACKEND_DIR))

from .routers import projects_router, settings_router, tasks_router, profiles_router, worktrees_router, insights_router, claude_cli_router, terminals_router, context_router, git_router, source_env_router, ollama_router, roadmap_router


class ConnectionManager:
    """Manage WebSocket connections for real-time updates."""

    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict[str, Any]):
        """Broadcast message to all connected clients."""
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass


manager = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events for startup/shutdown."""
    # Startup
    logger.info("🚀 Auto Claude Web API starting...")
    logger.info("📡 API available at http://localhost:8000")
    logger.info("📖 API docs at http://localhost:8000/docs")
    
    # Log environment info for debugging
    from .utils.logging_utils import log_environment_info
    try:
        log_environment_info()
    except Exception as e:
        logger.warning(f"Could not log environment info: {e}")
    
    app.state.connection_manager = manager

    yield

    # Shutdown
    logger.info("👋 Auto Claude Web API shutting down...")
    for connection in manager.active_connections:
        try:
            await connection.close()
        except Exception:
            pass


app = FastAPI(
    title="Auto Claude API",
    description="Web API for Auto Claude autonomous coding framework",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware - allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    """Log all incoming HTTP requests."""
    start_time = time.time()
    
    # Log incoming request
    client_host = request.client.host if request.client else "unknown"
    logger.info(f"➡️  {request.method} {request.url.path} from {client_host}")
    
    # Process request
    response = await call_next(request)
    
    # Log response
    duration_ms = (time.time() - start_time) * 1000
    status_emoji = "✅" if response.status_code < 400 else "❌"
    logger.info(f"{status_emoji} {request.method} {request.url.path} → {response.status_code} ({duration_ms:.1f}ms)")
    
    return response


# Include routers
app.include_router(projects_router, prefix="/api/projects", tags=["projects"])
app.include_router(tasks_router, prefix="/api", tags=["tasks"])
app.include_router(settings_router, prefix="/api/settings", tags=["settings"])
app.include_router(profiles_router, prefix="/api/profiles", tags=["profiles"])
app.include_router(worktrees_router, prefix="/api", tags=["worktrees"])
app.include_router(insights_router, prefix="/api", tags=["insights"])
app.include_router(claude_cli_router, prefix="/api", tags=["claude-cli"])
app.include_router(terminals_router, prefix="/api", tags=["terminals"])
app.include_router(context_router, prefix="/api", tags=["context"])
app.include_router(git_router, prefix="/api", tags=["git"])
app.include_router(source_env_router, prefix="/api", tags=["source-env"])
app.include_router(ollama_router, prefix="/api", tags=["ollama"])
app.include_router(roadmap_router, prefix="/api", tags=["roadmap"])


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    """Health check endpoint."""
    return {"status": "healthy", "service": "auto-claude-api"}


@app.post("/api/test-connection")
async def test_api_connection(request: dict) -> dict:
    """Test connection to an external API endpoint."""
    import httpx

    base_url = request.get("baseUrl", "")
    api_key = request.get("apiKey", "")

    if not base_url or not api_key:
        return {"success": False, "error": "Missing baseUrl or apiKey"}

    # Validate URL format
    if not base_url.startswith(("http://", "https://")):
        return {"success": False, "error": "Base URL must start with http:// or https://"}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # Try multiple endpoint patterns for different API providers
            base = base_url.rstrip('/')
            endpoints_to_try = [
                ("/v1/models", {"x-api-key": api_key}),  # Anthropic-style
                ("/v1/models", {"Authorization": f"Bearer {api_key}"}),  # OpenAI-style
                ("/models", {"Authorization": f"Bearer {api_key}"}),  # Generic
            ]

            last_error = None
            for endpoint, headers in endpoints_to_try:
                try:
                    response = await client.get(f"{base}{endpoint}", headers=headers)
                    if response.status_code == 200:
                        return {"success": True, "data": {"success": True, "message": "Connection successful"}}
                    elif response.status_code == 401:
                        return {"success": False, "error": "Authentication failed - check your API key"}
                    elif response.status_code == 403:
                        return {"success": False, "error": "Access forbidden - check API key permissions"}
                    last_error = f"API returned status {response.status_code}"
                except httpx.RequestError as e:
                    last_error = str(e)
                    continue

            return {"success": False, "error": last_error or "Failed to connect to API"}
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/browse-folders")
async def browse_folders(path: str = "") -> dict:
    """Browse folders on the server for project selection."""
    import os

    # Default to home directory
    if not path:
        path = str(Path.home())

    try:
        base_path = Path(path).resolve()
        if not base_path.exists():
            return {"success": False, "error": "Path does not exist"}

        entries = []
        for entry in sorted(base_path.iterdir()):
            if entry.is_dir() and not entry.name.startswith('.'):
                entries.append({
                    "name": entry.name,
                    "path": str(entry),
                    "isDirectory": True
                })

        return {
            "success": True,
            "data": {
                "currentPath": str(base_path),
                "parentPath": str(base_path.parent) if base_path.parent != base_path else None,
                "entries": entries
            }
        }
    except PermissionError:
        return {"success": False, "error": "Permission denied"}
    except Exception as e:
        return {"success": False, "error": str(e)}


# Tab state storage (in-memory for now, could be persisted)
_tab_state: dict = {}


@app.get("/api/tabs")
async def get_tab_state() -> dict:
    """Get the current tab state."""
    logger.info("📋 Tab state requested")
    return {"success": True, "data": _tab_state}


@app.put("/api/tabs")
async def save_tab_state(tab_state: dict) -> dict:
    """Save the tab state."""
    global _tab_state
    _tab_state = tab_state
    logger.info("💾 Tab state saved")
    return {"success": True}


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time updates.

    Clients can subscribe to events like:
    - task_status: Task status changes
    - task_logs: Real-time log streaming
    - project_updates: Project changes
    """
    client_host = websocket.client.host if websocket.client else "unknown"
    logger.info(f"🔌 WebSocket connection from {client_host}")
    
    await manager.connect(websocket)
    logger.info(f"📊 Active WebSocket connections: {len(manager.active_connections)}")
    
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type", "ping")
            logger.info(f"📨 WebSocket message: {event_type} from {client_host}")

            if event_type == "ping":
                await websocket.send_json({"type": "pong"})
            elif event_type == "subscribe":
                channel = data.get("channel")
                logger.info(f"📢 Client {client_host} subscribed to: {channel}")
                await websocket.send_json(
                    {"type": "subscribed", "channel": channel}
                )
            else:
                await websocket.send_json(
                    {"type": "error", "message": f"Unknown event type: {event_type}"}
                )
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info(f"🔌 WebSocket disconnected: {client_host}")
    except Exception as e:
        manager.disconnect(websocket)
        logger.error(f"❌ WebSocket error from {client_host}: {e}")


async def broadcast_event(event_type: str, payload: dict[str, Any]):
    """Helper function to broadcast events to all connected clients."""
    await manager.broadcast({"type": event_type, **payload})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
