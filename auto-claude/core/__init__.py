"""
Core Framework Module
=====================

Core components for the Auto Claude autonomous coding framework.

Enterprise-grade features:
- Caching: LRU caching, JSON file caching with TTL and invalidation
- Logging: Structured logging with context propagation
- Exceptions: Typed exception hierarchy for better error handling
- Retry: Exponential backoff with configurable strategies
"""

# Note: We use lazy imports here because the full agent module has many dependencies
# that may not be needed for basic operations like workspace management.

__all__ = [
    # Agent
    "run_autonomous_agent",
    "run_followup_planner",
    # Workspace
    "WorkspaceManager",
    "WorktreeManager",
    # Progress
    "ProgressTracker",
    # Cache (enterprise feature)
    "LRUCache",
    "JSONFileCache",
    "cached_json_load",
    "get_cache_stats",
    "clear_all_caches",
    # Logging (enterprise feature)
    "get_logger",
    "configure_logging",
    "set_correlation_id",
    "log_context",
    "Timer",
    "timed",
    # Exceptions (enterprise feature)
    "AutoClaudeError",
    "ConfigurationError",
    "ValidationError",
    "SecurityError",
    "ExecutionError",
    "is_retryable",
    # Retry (enterprise feature)
    "retry",
    "RetryConfig",
    "RetryResult",
]


def __getattr__(name):
    """Lazy imports to avoid circular dependencies and heavy imports."""
    # Agent functions
    if name in ("run_autonomous_agent", "run_followup_planner"):
        from .agent import run_autonomous_agent, run_followup_planner

        return locals()[name]
    # Workspace
    elif name == "WorkspaceManager":
        from .workspace import WorkspaceManager

        return WorkspaceManager
    elif name == "WorktreeManager":
        from .worktree import WorktreeManager

        return WorktreeManager
    # Progress
    elif name == "ProgressTracker":
        from .progress import ProgressTracker

        return ProgressTracker
    # Client
    elif name in ("create_claude_client", "ClaudeClient"):
        from . import client as _client

        return getattr(_client, name)
    # Cache
    elif name in (
        "LRUCache",
        "JSONFileCache",
        "cached_json_load",
        "get_cache_stats",
        "clear_all_caches",
    ):
        from . import cache as _cache

        return getattr(_cache, name)
    # Logging
    elif name in (
        "get_logger",
        "configure_logging",
        "set_correlation_id",
        "log_context",
        "Timer",
        "timed",
    ):
        from . import logging as _logging

        return getattr(_logging, name)
    # Exceptions
    elif name in (
        "AutoClaudeError",
        "ConfigurationError",
        "ValidationError",
        "SecurityError",
        "ExecutionError",
        "is_retryable",
    ):
        from . import exceptions as _exceptions

        return getattr(_exceptions, name)
    # Retry
    elif name in ("retry", "RetryConfig", "RetryResult"):
        from . import retry as _retry

        return getattr(_retry, name)

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
