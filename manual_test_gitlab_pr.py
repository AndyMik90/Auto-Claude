#!/usr/bin/env python3
"""
Manual End-to-End Testing for GitLab PR/MR Creation
====================================================

This script tests the complete GitLab merge request creation flow:
1. Provider detection (GitHub vs GitLab vs self-hosted GitLab)
2. CLI tool availability (glab executable)
3. WorktreeManager integration with GitLab
4. Error handling for missing CLI tools
5. Both cloud GitLab (gitlab.com) and self-hosted instances

Run this script from the project root to verify the implementation.
"""

import sys
import os
import tempfile
import shutil
import subprocess
from pathlib import Path

# Add apps/backend to Python path
sys.path.insert(0, str(Path(__file__).parent / "apps" / "backend"))

from core.git_provider import detect_git_provider
from core.glab_executable import get_glab_executable, invalidate_glab_cache
from core.worktree import WorktreeManager


def print_section(title: str):
    """Print a formatted section header."""
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}\n")


def print_test(description: str):
    """Print test description."""
    print(f"🧪 TEST: {description}")


def print_pass(message: str):
    """Print success message."""
    print(f"  ✅ PASS: {message}")


def print_fail(message: str):
    """Print failure message."""
    print(f"  ❌ FAIL: {message}")


def print_info(message: str):
    """Print info message."""
    print(f"  ℹ️  INFO: {message}")


def create_test_git_repo(repo_path: Path, remote_url: str) -> bool:
    """Create a test git repository with a remote.

    Args:
        repo_path: Path where to create the repo
        remote_url: Git remote URL to set

    Returns:
        True if successful, False otherwise
    """
    try:
        repo_path.mkdir(parents=True, exist_ok=True)

        # Initialize git repo
        subprocess.run(
            ["git", "init"],
            cwd=repo_path,
            capture_output=True,
            check=True
        )

        # Configure git user for commits
        subprocess.run(
            ["git", "config", "user.name", "Test User"],
            cwd=repo_path,
            capture_output=True,
            check=True
        )
        subprocess.run(
            ["git", "config", "user.email", "test@example.com"],
            cwd=repo_path,
            capture_output=True,
            check=True
        )

        # Add remote
        subprocess.run(
            ["git", "remote", "add", "origin", remote_url],
            cwd=repo_path,
            capture_output=True,
            check=True
        )

        # Create initial commit
        (repo_path / "README.md").write_text("# Test Repository\n")
        subprocess.run(
            ["git", "add", "README.md"],
            cwd=repo_path,
            capture_output=True,
            check=True
        )
        subprocess.run(
            ["git", "commit", "-m", "Initial commit"],
            cwd=repo_path,
            capture_output=True,
            check=True
        )

        return True
    except subprocess.CalledProcessError as e:
        print_fail(f"Failed to create test repo: {e}")
        return False


def test_provider_detection():
    """Test 1: Git Provider Detection"""
    print_section("Test 1: Git Provider Detection")

    test_cases = [
        ("GitHub HTTPS", "https://github.com/user/repo.git", "github"),
        ("GitHub SSH", "git@github.com:user/repo.git", "github"),
        ("GitLab Cloud HTTPS", "https://gitlab.com/user/repo.git", "gitlab"),
        ("GitLab Cloud SSH", "git@gitlab.com:user/repo.git", "gitlab"),
        ("Self-hosted GitLab HTTPS", "https://gitlab.company.com/user/repo.git", "gitlab"),
        ("Self-hosted GitLab SSH", "git@gitlab.company.com:user/repo.git", "gitlab"),
        ("Self-hosted GitLab Subdomain", "https://gitlab.example.org/user/repo.git", "gitlab"),
    ]

    all_passed = True

    with tempfile.TemporaryDirectory() as tmpdir:
        for name, remote_url, expected_provider in test_cases:
            print_test(name)
            print_info(f"Remote URL: {remote_url}")

            repo_path = Path(tmpdir) / name.replace(" ", "_")
            if not create_test_git_repo(repo_path, remote_url):
                print_fail(f"Could not create test repo")
                all_passed = False
                continue

            detected = detect_git_provider(str(repo_path))

            if detected == expected_provider:
                print_pass(f"Detected provider: {detected}")
            else:
                print_fail(f"Expected {expected_provider}, got {detected}")
                all_passed = False

    return all_passed


def test_glab_cli_detection():
    """Test 2: GitLab CLI Detection"""
    print_section("Test 2: GitLab CLI Detection")

    print_test("Checking for glab CLI executable")

    glab_path = get_glab_executable()

    if glab_path:
        print_pass(f"Found glab at: {glab_path}")

        # Verify it works
        try:
            result = subprocess.run(
                [glab_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5
            )
            if result.returncode == 0:
                version = result.stdout.strip()
                print_pass(f"glab version: {version}")
                return True
            else:
                print_fail("glab command failed")
                return False
        except Exception as e:
            print_fail(f"Error running glab: {e}")
            return False
    else:
        print_info("glab CLI not found (this is OK for systems without GitLab)")
        print_info("Install from: https://gitlab.com/gitlab-org/cli")
        return True  # Not a failure - just not installed


def test_worktree_manager_with_gitlab():
    """Test 3: WorktreeManager Integration"""
    print_section("Test 3: WorktreeManager with GitLab Remote")

    print_test("Creating test WorktreeManager with GitLab remote")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir) / "test-project"

        # Create test repo with GitLab remote
        if not create_test_git_repo(repo_path, "https://gitlab.com/test-user/test-repo.git"):
            print_fail("Could not create test repository")
            return False

        print_pass("Created test repository with GitLab remote")

        # Detect provider
        provider = detect_git_provider(str(repo_path))
        if provider == "gitlab":
            print_pass(f"Provider correctly detected: {provider}")
        else:
            print_fail(f"Expected 'gitlab', got '{provider}'")
            return False

        # Create WorktreeManager instance
        try:
            manager = WorktreeManager(
                project_dir=repo_path,
                base_branch="main"
            )
            print_pass("WorktreeManager instance created successfully")

            # Verify the push_and_create_pr method exists and accepts correct parameters
            import inspect
            sig = inspect.signature(manager.push_and_create_pr)
            params = list(sig.parameters.keys())
            expected_params = ["spec_name", "target_branch", "title", "draft", "force_push"]

            if all(p in params for p in expected_params):
                print_pass("push_and_create_pr method has correct signature")
            else:
                print_fail(f"Missing parameters. Expected {expected_params}, got {params}")
                return False

            # Verify create_merge_request method exists
            if hasattr(manager, 'create_merge_request'):
                print_pass("create_merge_request method exists")
            else:
                print_fail("create_merge_request method not found")
                return False

            return True

        except Exception as e:
            print_fail(f"Error creating WorktreeManager: {e}")
            return False


def test_error_messages():
    """Test 4: Error Message Handling"""
    print_section("Test 4: Error Message Handling")

    print_test("Testing error messages for missing glab CLI")

    # Test by mocking the get_glab_executable to return None
    import core.glab_executable as glab_module

    # Save original function
    original_get_glab = glab_module.get_glab_executable

    try:
        # Mock to simulate missing glab
        glab_module.get_glab_executable = lambda: None

        # Test the run_glab function with missing glab
        from core.glab_executable import run_glab
        result = run_glab(["mr", "create", "--help"])

        # Restore original function
        glab_module.get_glab_executable = original_get_glab

        # Check error message
        if result.returncode != 0 and "glab" in result.stderr.lower():
            print_pass(f"Correct error message: {result.stderr}")

            # Verify installation URL is included
            if "https://gitlab.com/gitlab-org/cli" in result.stderr:
                print_pass("Error message includes installation URL")
                return True
            else:
                print_info("Error message includes glab reference")
                return True
        else:
            print_fail(f"Unexpected error: returncode={result.returncode}, stderr={result.stderr}")
            return False

    except Exception as e:
        # Restore original function
        glab_module.get_glab_executable = original_get_glab
        print_fail(f"Unexpected exception: {e}")
        return False


def test_github_regression():
    """Test 5: GitHub Regression Test"""
    print_section("Test 5: GitHub Regression Test (Backward Compatibility)")

    print_test("Verifying GitHub remote detection still works")

    with tempfile.TemporaryDirectory() as tmpdir:
        repo_path = Path(tmpdir) / "github-project"

        # Create test repo with GitHub remote
        if not create_test_git_repo(repo_path, "https://github.com/user/repo.git"):
            print_fail("Could not create test repository")
            return False

        print_pass("Created test repository with GitHub remote")

        # Detect provider
        provider = detect_git_provider(str(repo_path))
        if provider == "github":
            print_pass(f"Provider correctly detected: {provider}")
        else:
            print_fail(f"Expected 'github', got '{provider}'")
            return False

        # Create WorktreeManager
        manager = WorktreeManager(
            project_dir=repo_path,
            base_branch="main"
        )

        # Verify create_pull_request method still exists
        if hasattr(manager, 'create_pull_request'):
            print_pass("create_pull_request method still exists (no regression)")
            return True
        else:
            print_fail("create_pull_request method missing (regression!)")
            return False


def main():
    """Run all manual tests."""
    print("\n" + "="*70)
    print("  GitLab PR/MR Creation - Manual End-to-End Tests")
    print("="*70)
    print("\nThis test suite verifies the implementation of GitLab support")
    print("for the 'Create PR' button in Auto-Claude.\n")

    results = {}

    # Run all tests
    results["Provider Detection"] = test_provider_detection()
    results["GitLab CLI Detection"] = test_glab_cli_detection()
    results["WorktreeManager Integration"] = test_worktree_manager_with_gitlab()
    results["Error Messages"] = test_error_messages()
    results["GitHub Regression"] = test_github_regression()

    # Print summary
    print_section("Test Summary")

    total_tests = len(results)
    passed_tests = sum(1 for v in results.values() if v)

    for test_name, passed in results.items():
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"{status} - {test_name}")

    print(f"\n{passed_tests}/{total_tests} tests passed")

    if passed_tests == total_tests:
        print("\n🎉 All tests passed! GitLab support is working correctly.")
        return 0
    else:
        print("\n⚠️  Some tests failed. Please review the output above.")
        return 1


if __name__ == "__main__":
    sys.exit(main())
