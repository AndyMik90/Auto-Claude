"""
GitLab integration module facade.

Provides GitLab project management with multi-user OAuth support.
Re-exports from integrations.gitlab.integration for clean imports.
"""

from integrations.gitlab.integration import (
    GitLabManager,
    get_gitlab_manager,
    is_gitlab_enabled,
    prepare_coder_gitlab_instructions,
    prepare_planner_gitlab_instructions,
)

__all__ = [
    "GitLabManager",
    "get_gitlab_manager",
    "is_gitlab_enabled",
    "prepare_coder_gitlab_instructions",
    "prepare_planner_gitlab_instructions",
]
