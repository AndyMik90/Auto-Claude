"""
Agents Module
=============

Modular agent system for autonomous coding.

This module provides:
- run_autonomous_agent: Main coder agent loop
- run_followup_planner: Follow-up planner for completed specs
- Memory management (Graphiti + file-based fallback)
- Session management and post-processing
- Utility functions for git and plan management
"""

# Main agent functions (public API)
from .coder import run_autonomous_agent
from .planner import run_followup_planner

# Memory functions
from .memory import (
    debug_memory_system_status,
    get_graphiti_context,
    save_session_memory,
    save_session_to_graphiti,  # Backwards compatibility
)

# Session management
from .session import (
    run_agent_session,
    post_session_processing,
)

# Utility functions
from .utils import (
    get_latest_commit,
    get_commit_count,
    load_implementation_plan,
    find_subtask_in_plan,
    find_phase_for_subtask,
    sync_plan_to_source,
)

# Constants
from .base import (
    AUTO_CONTINUE_DELAY_SECONDS,
    HUMAN_INTERVENTION_FILE,
)

__all__ = [
    # Main API
    "run_autonomous_agent",
    "run_followup_planner",
    # Memory
    "debug_memory_system_status",
    "get_graphiti_context",
    "save_session_memory",
    "save_session_to_graphiti",
    # Session
    "run_agent_session",
    "post_session_processing",
    # Utils
    "get_latest_commit",
    "get_commit_count",
    "load_implementation_plan",
    "find_subtask_in_plan",
    "find_phase_for_subtask",
    "sync_plan_to_source",
    # Constants
    "AUTO_CONTINUE_DELAY_SECONDS",
    "HUMAN_INTERVENTION_FILE",
]
