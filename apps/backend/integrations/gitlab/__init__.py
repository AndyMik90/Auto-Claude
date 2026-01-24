"""
GitLab Integration
==================

Provides GitLab integration for Auto-Claude with support for:
- Self-hosted GitLab instances
- Multi-user OAuth authentication
- Issue and Merge Request management
- Webhook event handling

Usage:
    from integrations.gitlab import GitLabManager, get_gitlab_manager

    manager = await get_gitlab_manager(spec_dir, project_dir)
    if manager.is_enabled:
        issues = await manager.get_project_issues()
"""

from .integration import (
    GitLabManager,
    get_gitlab_manager,
    is_gitlab_enabled,
    prepare_coder_gitlab_instructions,
    prepare_planner_gitlab_instructions,
)
from .config import GitLabConfig, GitLabProjectState
from .client import GitLabClient
from .oauth import GitLabOAuth, OAuthToken, UserTokenStore

__all__ = [
    "GitLabManager",
    "get_gitlab_manager",
    "is_gitlab_enabled",
    "prepare_coder_gitlab_instructions",
    "prepare_planner_gitlab_instructions",
    "GitLabConfig",
    "GitLabProjectState",
    "GitLabClient",
    "GitLabOAuth",
    "OAuthToken",
    "UserTokenStore",
]
