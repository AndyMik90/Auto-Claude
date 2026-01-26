"""
Shared MCP Server Configuration Builder
========================================

Centralized helper functions for building MCP server configurations.
Used by both client.py (for agent sessions) and insights_runner.py (for insights chat).

These functions read from environment variables that are set by the frontend
via integrations-env-builder.ts when launching Python processes.

NPM Packages Used:
- JIRA: @aashari/mcp-server-atlassian-jira (community, API token auth)
- GitLab: @modelcontextprotocol/server-gitlab (official MCP)
- Vault: @modelcontextprotocol/server-filesystem (official MCP)
"""

import os
from pathlib import Path


def build_jira_mcp_config() -> dict | None:
    """
    Build JIRA MCP server configuration from env vars.

    Required env vars (set via integrations-env-builder.ts):
    - JIRA_HOST or JIRA_URL: JIRA instance URL (e.g., https://company.atlassian.net)
    - JIRA_EMAIL: User email for authentication
    - JIRA_API_TOKEN or JIRA_TOKEN: API token

    Optional env vars:
    - JIRA_DEFAULT_PROJECT: Default project key (e.g., CAP)
    - JIRA_PROJECT_KEY: Per-project override (takes precedence over JIRA_DEFAULT_PROJECT)

    Returns:
        MCP server config dict for @aashari/mcp-server-atlassian-jira, or None if not configured
    """
    host = os.environ.get("JIRA_HOST") or os.environ.get("JIRA_URL")
    email = os.environ.get("JIRA_EMAIL")
    token = os.environ.get("JIRA_API_TOKEN") or os.environ.get("JIRA_TOKEN")

    if not (host and email and token):
        return None

    env = {
        "JIRA_HOST": host,
        "JIRA_EMAIL": email,
        "JIRA_API_TOKEN": token,
    }

    # Per-project override takes precedence over global default
    project_key = os.environ.get("JIRA_PROJECT_KEY") or os.environ.get("JIRA_DEFAULT_PROJECT")
    if project_key:
        env["JIRA_DEFAULT_PROJECT"] = project_key

    return {
        "command": "npx",
        "args": ["-y", "@aashari/mcp-server-atlassian-jira"],
        "env": env,
    }


def build_gitlab_mcp_config() -> dict | None:
    """
    Build GitLab MCP server configuration from env vars.

    Required env vars (set via integrations-env-builder.ts):
    - GITLAB_HOST or GITLAB_URL: GitLab instance URL (e.g., https://gitlab.com)
    - GITLAB_TOKEN or GITLAB_PRIVATE_TOKEN: Personal Access Token with 'api' scope

    Returns:
        MCP server config dict for @modelcontextprotocol/server-gitlab, or None if not configured
    """
    host = os.environ.get("GITLAB_HOST") or os.environ.get("GITLAB_URL")
    token = os.environ.get("GITLAB_TOKEN") or os.environ.get("GITLAB_PRIVATE_TOKEN")

    if not (host and token):
        return None

    # Ensure we have the API URL format
    api_url = host.rstrip("/")
    if not api_url.endswith("/api/v4"):
        api_url = f"{api_url}/api/v4"

    return {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-gitlab"],
        "env": {
            "GITLAB_PERSONAL_ACCESS_TOKEN": token,
            "GITLAB_API_URL": api_url,
        },
    }


def build_obsidian_mcp_config() -> dict | None:
    """
    Build Obsidian/Vault MCP server configuration from env vars.

    Required env vars (set via integrations-env-builder.ts):
    - VAULT_PATH or OBSIDIAN_VAULT_PATH: Path to the vault directory

    Returns:
        MCP server config dict for @modelcontextprotocol/server-filesystem, or None if not configured
    """
    vault_path = os.environ.get("VAULT_PATH") or os.environ.get("OBSIDIAN_VAULT_PATH")

    if not vault_path:
        return None

    # Expand ~ and resolve to absolute path
    expanded = str(Path(vault_path).expanduser().resolve())

    return {
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", expanded],
    }
