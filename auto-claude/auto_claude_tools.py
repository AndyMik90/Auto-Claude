"""
Custom MCP Tools for Auto-Claude Agents
========================================

DEPRECATED: This module is now a compatibility shim.
Please import from the auto_claude_tools package instead:

    from auto_claude_tools import create_auto_claude_mcp_server, get_allowed_tools

This file remains for backward compatibility with existing imports.
All functionality has been moved to the auto_claude_tools package for better
organization and maintainability.
"""

# Import everything from the package to maintain backward compatibility
from auto_claude_tools import (
    ELECTRON_TOOLS,
    TOOL_GET_BUILD_PROGRESS,
    TOOL_GET_SESSION_CONTEXT,
    TOOL_RECORD_DISCOVERY,
    TOOL_RECORD_GOTCHA,
    TOOL_UPDATE_QA_STATUS,
    TOOL_UPDATE_SUBTASK_STATUS,
    create_auto_claude_mcp_server,
    get_allowed_tools,
    is_electron_mcp_enabled,
    is_tools_available,
)

__all__ = [
    # Main API
    "create_auto_claude_mcp_server",
    "get_allowed_tools",
    "is_tools_available",
    # Tool name constants
    "TOOL_UPDATE_SUBTASK_STATUS",
    "TOOL_GET_BUILD_PROGRESS",
    "TOOL_RECORD_DISCOVERY",
    "TOOL_RECORD_GOTCHA",
    "TOOL_GET_SESSION_CONTEXT",
    "TOOL_UPDATE_QA_STATUS",
    # Electron MCP
    "ELECTRON_TOOLS",
    "is_electron_mcp_enabled",
]
