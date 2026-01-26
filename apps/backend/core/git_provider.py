#!/usr/bin/env python3
"""
Git Provider Detection
======================

Utility to detect git hosting provider (GitHub, GitLab, or unknown) from git remote URLs.
Supports both SSH and HTTPS remote formats, and self-hosted GitLab instances.
"""

import re
from pathlib import Path

from .git_executable import run_git


def detect_git_provider(project_dir: str | Path) -> str:
    """Detect the git hosting provider from the git remote URL.

    Args:
        project_dir: Path to the git repository

    Returns:
        'github' if GitHub remote detected
        'gitlab' if GitLab remote detected (cloud or self-hosted)
        'unknown' if no remote or unsupported provider

    Examples:
        >>> detect_git_provider('/path/to/repo')
        'github'  # for git@github.com:user/repo.git
        'gitlab'  # for git@gitlab.com:user/repo.git
        'gitlab'  # for https://gitlab.company.com/user/repo.git
        'unknown' # for no remote or other providers
    """
    try:
        # Get the origin remote URL
        result = run_git(
            ["remote", "get-url", "origin"],
            cwd=project_dir,
            timeout=5,
        )

        # If command failed or no output, return unknown
        if result.returncode != 0 or not result.stdout.strip():
            return "unknown"

        remote_url = result.stdout.strip()

        # Parse SSH format: git@host:path
        ssh_match = re.match(r"^git@([^:]+):", remote_url)
        if ssh_match:
            hostname = ssh_match.group(1)
            return _classify_hostname(hostname)

        # Parse HTTPS format: https://host/path or http://host/path
        https_match = re.match(r"^https?://([^/]+)/", remote_url)
        if https_match:
            hostname = https_match.group(1)
            return _classify_hostname(hostname)

        # Unrecognized URL format
        return "unknown"

    except Exception:
        # Any error (subprocess issues, etc.) -> unknown
        return "unknown"


def _classify_hostname(hostname: str) -> str:
    """Classify a hostname as github, gitlab, or unknown.

    Args:
        hostname: The git remote hostname (e.g., 'github.com', 'gitlab.example.com')

    Returns:
        'github', 'gitlab', or 'unknown'
    """
    hostname_lower = hostname.lower()

    # Check for GitHub
    if "github.com" in hostname_lower:
        return "github"

    # Check for GitLab (cloud and self-hosted)
    # Match gitlab.com or any domain containing 'gitlab'
    if "gitlab.com" in hostname_lower or "gitlab" in hostname_lower:
        return "gitlab"

    # Unknown provider
    return "unknown"
