"""
JIRA integration module facade.

Provides JIRA project management integration via MCP bridge.
Re-exports from integrations.jira.integration for clean imports.
"""

from integrations.jira.integration import (
    JiraManager,
    get_jira_manager,
    is_jira_enabled,
    prepare_coder_jira_instructions,
    prepare_planner_jira_instructions,
)

__all__ = [
    "JiraManager",
    "get_jira_manager",
    "is_jira_enabled",
    "prepare_coder_jira_instructions",
    "prepare_planner_jira_instructions",
]
