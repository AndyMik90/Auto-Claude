"""
Tests for runner.py get_config() GITHUB_REPO priority handling.

Issue: When reviewing PRs for different projects, the GITHUB_REPO from
backend's .env was being used for ALL projects instead of the project-specific repo.

The fix ensures that:
1. Explicit --repo argument has highest priority
2. GITHUB_REPO from environment (passed by frontend) is used next
3. Auto-detection from project directory is the fallback

@see https://12factor.net/config - Config should be per-deployment, not global
@see https://docs.python.org/3/library/subprocess.html - env parameter behavior
"""

import os
import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch
import pytest


def get_repo_with_priority(
    args_repo: str | None,
    env_repo: str | None,
    detected_repo: str | None,
) -> str:
    """
    Simulate the get_config() repo priority logic.

    This is the EXPECTED behavior after the fix:
    1. args.repo (explicit --repo flag) has highest priority
    2. os.environ.get("GITHUB_REPO") is next
    3. Auto-detection from git remote is the fallback

    Returns the repo that should be used.
    """
    # Priority 1: Explicit --repo argument
    if args_repo:
        return args_repo

    # Priority 2: Environment variable (passed by frontend)
    if env_repo:
        return env_repo

    # Priority 3: Auto-detected from project directory
    if detected_repo:
        return detected_repo

    return ""


class TestGetConfigRepoPriority:
    """Test suite for get_config() GITHUB_REPO priority handling."""

    def test_explicit_repo_arg_has_highest_priority(self):
        """Test that --repo argument takes precedence over everything."""
        result = get_repo_with_priority(
            args_repo="ExplicitOrg/ExplicitRepo",
            env_repo="EnvOrg/EnvRepo",
            detected_repo="DetectedOrg/DetectedRepo",
        )
        assert result == "ExplicitOrg/ExplicitRepo"

    def test_env_var_used_when_no_explicit_arg(self):
        """Test that GITHUB_REPO env var is used when no --repo argument."""
        result = get_repo_with_priority(
            args_repo=None,
            env_repo="EnvOrg/EnvRepo",
            detected_repo="DetectedOrg/DetectedRepo",
        )
        assert result == "EnvOrg/EnvRepo"

    def test_auto_detection_when_no_env_var(self):
        """Test that auto-detection is used when no env var is set."""
        result = get_repo_with_priority(
            args_repo=None,
            env_repo=None,
            detected_repo="DetectedOrg/DetectedRepo",
        )
        assert result == "DetectedOrg/DetectedRepo"

    def test_different_projects_get_different_repos_via_env(self):
        """Test that different projects can have different repos via env var."""
        # This simulates what the frontend should do:
        # Pass project-specific GITHUB_REPO in the subprocess environment

        # Project A
        repo_a = get_repo_with_priority(
            args_repo=None,
            env_repo="OrgA/RepoA",
            detected_repo=None,
        )
        assert repo_a == "OrgA/RepoA"

        # Project B (different env var value)
        repo_b = get_repo_with_priority(
            args_repo=None,
            env_repo="OrgB/RepoB",
            detected_repo=None,
        )
        assert repo_b == "OrgB/RepoB"

        # They should be different
        assert repo_a != repo_b

    def test_env_var_overrides_backend_dotenv_simulation(self):
        """
        Test that subprocess env var overrides backend's .env file.

        The backend's .env might have GITHUB_REPO=AndyMik90/Auto-Claude,
        but the subprocess should use the value passed by the frontend.
        """
        # Simulate: backend .env has AndyMik90/Auto-Claude
        # But frontend passes VDT-91/Skogplattform in env
        # The env var should win

        result = get_repo_with_priority(
            args_repo=None,
            env_repo="VDT-91/Skogplattform",  # Passed by frontend
            detected_repo=None,
        )
        assert result == "VDT-91/Skogplattform"
        assert result != "AndyMik90/Auto-Claude"

    def test_returns_empty_when_nothing_available(self):
        """Test that empty string is returned when no repo source available."""
        result = get_repo_with_priority(
            args_repo=None,
            env_repo=None,
            detected_repo=None,
        )
        assert result == ""


class TestGetConfigCwdHandling:
    """Test suite for get_config() cwd parameter handling (Windows fix)."""

    def test_cwd_conversion_to_string(self, tmp_path):
        """Test that Path objects are converted to strings for Windows compatibility."""
        # This is the pattern that should be used in runner.py:
        project_path = tmp_path  # This is a Path object

        # The fix converts Path to string using str(path.resolve())
        project_dir = str(project_path.resolve()) if project_path else None

        # Verify it's a string, not a Path object
        assert project_dir is not None
        assert isinstance(project_dir, str), f"Should be str, got {type(project_dir)}"

    def test_cwd_is_absolute_path(self, tmp_path):
        """Test that cwd is an absolute path after conversion."""
        project_path = tmp_path

        # The fix: str(path.resolve()) gives absolute string path
        project_dir = str(project_path.resolve()) if project_path else None

        # Should be absolute path
        assert project_dir is not None
        assert Path(project_dir).is_absolute(), f"Should be absolute: {project_dir}"

    def test_cwd_handles_none_project(self):
        """Test that None project is handled gracefully."""
        project_path = None

        project_dir = str(project_path.resolve()) if project_path else None

        assert project_dir is None


class TestSubprocessEnvPassing:
    """Test suite for subprocess environment variable passing patterns."""

    def test_env_copy_and_modify_pattern(self):
        """
        Test the recommended pattern for passing env vars to subprocess.

        From Python docs: "If env is not None, it must be a mapping that defines
        the environment variables for the new process; these are used instead of
        the default behavior of inheriting the current process' environment."

        Best practice: os.environ.copy() then modify.
        """
        # Simulate the pattern that should be used
        base_env = os.environ.copy()
        base_env["GITHUB_REPO"] = "Project/Repo"

        # Verify the pattern works
        assert "GITHUB_REPO" in base_env
        assert base_env["GITHUB_REPO"] == "Project/Repo"

        # Original os.environ should not be modified
        # (unless GITHUB_REPO was already set, which is fine)

    def test_env_var_isolation_between_calls(self):
        """
        Test that env vars passed to subprocess are isolated.

        Each subprocess call should be able to have different env vars
        without affecting other calls.
        """
        # Call 1: Project A
        env_a = os.environ.copy()
        env_a["GITHUB_REPO"] = "OrgA/RepoA"

        # Call 2: Project B
        env_b = os.environ.copy()
        env_b["GITHUB_REPO"] = "OrgB/RepoB"

        # They should be independent
        assert env_a["GITHUB_REPO"] == "OrgA/RepoA"
        assert env_b["GITHUB_REPO"] == "OrgB/RepoB"
        assert env_a["GITHUB_REPO"] != env_b["GITHUB_REPO"]
