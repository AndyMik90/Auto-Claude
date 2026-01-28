"""
Shared pytest fixtures for WorktreeManager and GitLab/GitHub integration tests.

This file provides common fixtures used by:
- test_gitlab_worktree.py - GitLab MR creation tests
- test_github_pr_regression.py - GitHub PR regression tests

Fixtures provided:
- temp_project_dir: Creates a temporary git repository with initial commit
- worktree_manager: Creates a WorktreeManager instance for testing

Note: This file MUST be named 'conftest.py' - pytest automatically discovers
and loads fixtures from files with this exact name.
"""

import subprocess
import sys
from pathlib import Path

import pytest

# Add apps/backend directory to path for imports
_backend_dir = Path(__file__).parent.parent / "apps" / "backend"
if str(_backend_dir) not in sys.path:
    sys.path.insert(0, str(_backend_dir))

from core.worktree import WorktreeManager


@pytest.fixture
def temp_project_dir(tmp_path):
    """Create a temporary project directory with proper git setup."""
    project_dir = tmp_path / "test-project"
    project_dir.mkdir()

    # Initialize git repo
    subprocess.run(
        ["git", "init"],
        cwd=project_dir,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["git", "config", "user.name", "Test User"],
        cwd=project_dir,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["git", "config", "user.email", "test@example.com"],
        cwd=project_dir,
        capture_output=True,
        check=True,
    )

    # Disable GPG signing to prevent hangs in CI
    subprocess.run(
        ["git", "config", "commit.gpgsign", "false"],
        cwd=project_dir,
        capture_output=True,
        check=True,
    )

    # Create initial commit
    readme = project_dir / "README.md"
    readme.write_text("# Test Project\n")
    subprocess.run(
        ["git", "add", "README.md"],
        cwd=project_dir,
        capture_output=True,
        check=True,
    )
    subprocess.run(
        ["git", "commit", "-m", "Initial commit"],
        cwd=project_dir,
        capture_output=True,
        check=True,
    )

    return project_dir


@pytest.fixture
def worktree_manager(temp_project_dir):
    """Create a WorktreeManager instance."""
    # Create .auto-claude directories
    auto_claude_dir = temp_project_dir / ".auto-claude"
    auto_claude_dir.mkdir(exist_ok=True)
    (auto_claude_dir / "specs").mkdir(exist_ok=True)
    (auto_claude_dir / "worktrees" / "tasks").mkdir(parents=True, exist_ok=True)

    return WorktreeManager(
        project_dir=temp_project_dir,
        base_branch="main",
    )
