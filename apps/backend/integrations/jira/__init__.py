"""
JIRA Integration via MCP Bridge
================================

Provides JIRA integration for Auto-Claude by bridging to existing
MCP servers (like jira-mcp) via stdio JSON-RPC.

This enables using your organization's existing JIRA MCP configuration
rather than duplicating authentication and API code.

Usage:
    from integrations.jira import JiraManager, get_jira_manager

    manager = await get_jira_manager(spec_dir, project_dir)
    if manager.is_enabled:
        issues = await manager.search_issues('project = CAP')
"""

from .config import JiraConfig, JiraProjectState
from .integration import (
    JiraManager,
    get_jira_manager,
    is_jira_enabled,
    prepare_coder_jira_instructions,
    prepare_planner_jira_instructions,
)
from .mcp_client import MCPClient, MCPServerConfig

__all__ = [
    "JiraManager",
    "get_jira_manager",
    "is_jira_enabled",
    "prepare_coder_jira_instructions",
    "prepare_planner_jira_instructions",
    "JiraConfig",
    "JiraProjectState",
    "MCPClient",
    "MCPServerConfig",
]
