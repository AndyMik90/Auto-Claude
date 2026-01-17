"""
Web API Routers
===============

FastAPI routers for different API endpoints.

- projects: Project management endpoints
- tasks: Task/spec management endpoints
- settings: Application settings endpoints
- profiles: Claude profile management endpoints
- worktrees: Git worktree management endpoints
- insights: AI chat insights endpoints
- claude_cli: Claude Code CLI detection and management
- terminals: WebSocket-based terminal (PTY) support
- context: Project context (index and memory) endpoints
- git: Git operations (branches, status, etc.)
- source_env: Source environment configuration
- ollama: Ollama model management
"""

from .projects import router as projects_router
from .settings import router as settings_router
from .tasks import router as tasks_router
from .profiles import router as profiles_router
from .worktrees import router as worktrees_router
from .insights import router as insights_router
from .claude_cli import router as claude_cli_router
from .terminals import router as terminals_router
from .context import router as context_router
from .git import router as git_router
from .source_env import router as source_env_router
from .ollama import router as ollama_router
from .roadmap import router as roadmap_router

__all__ = [
    "projects_router",
    "tasks_router",
    "settings_router",
    "profiles_router",
    "worktrees_router",
    "insights_router",
    "claude_cli_router",
    "terminals_router",
    "context_router",
    "git_router",
    "source_env_router",
    "ollama_router",
    "roadmap_router",
]
