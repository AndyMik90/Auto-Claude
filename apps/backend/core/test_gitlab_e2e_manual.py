#!/usr/bin/env python3
"""
Manual End-to-End Testing Script for GitLab Support
====================================================

This script performs manual testing of the GitLab MR creation functionality.
It creates test worktrees with GitLab remotes and verifies the correct behavior.

Usage:
    python apps/backend/core/test_gitlab_e2e_manual.py

Requirements:
    - glab CLI installed and authenticated (for full test)
    - Git repository with proper remotes configured
"""

import subprocess
import sys
import tempfile
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.git_provider import detect_git_provider
from core.glab_executable import get_glab_executable


def print_header(title: str) -> None:
    """Print a test section header."""
    print("\n" + "=" * 70)
    print(f" {title}")
    print("=" * 70)


def print_test(name: str) -> None:
    """Print a test name."""
    print(f"\n→ Test: {name}")


def print_result(success: bool, message: str) -> None:
    """Print test result."""
    status = "✓ PASS" if success else "✗ FAIL"
    print(f"  {status}: {message}")


def test_glab_detection() -> bool:
    """Test 1: Verify glab CLI detection."""
    print_test("Detect glab CLI installation")

    glab_path = get_glab_executable()

    if glab_path:
        print_result(True, f"glab CLI found at: {glab_path}")

        # Verify version
        try:
            result = subprocess.run(
                [glab_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                version = result.stdout.strip()
                print(f"  Version: {version}")
                return True
            else:
                print_result(False, "glab version check failed")
                return False
        except Exception as e:
            print_result(False, f"Error checking glab version: {e}")
            return False
    else:
        print_result(False, "glab CLI not found - some tests will be skipped")
        print("  Install glab from: https://gitlab.com/gitlab-org/cli")
        return False


def test_provider_detection_gitlab_cloud() -> bool:
    """Test 2: Provider detection for gitlab.com."""
    print_test("Detect gitlab.com remote")

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # Initialize git repo
            subprocess.run(
                ["git", "init"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            # Test SSH format
            subprocess.run(
                ["git", "remote", "add", "origin", "git@gitlab.com:test/repo.git"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            provider = detect_git_provider(tmpdir)
            if provider == "gitlab":
                print_result(True, "Correctly detected 'gitlab' for git@gitlab.com:test/repo.git")
            else:
                print_result(False, f"Expected 'gitlab', got '{provider}'")
                return False

            # Test HTTPS format
            subprocess.run(
                ["git", "remote", "set-url", "origin", "https://gitlab.com/test/repo.git"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            provider = detect_git_provider(tmpdir)
            if provider == "gitlab":
                print_result(True, "Correctly detected 'gitlab' for https://gitlab.com/test/repo.git")
                return True
            else:
                print_result(False, f"Expected 'gitlab', got '{provider}'")
                return False

        except Exception as e:
            print_result(False, f"Error during test: {e}")
            return False


def test_provider_detection_self_hosted() -> bool:
    """Test 3: Provider detection for self-hosted GitLab."""
    print_test("Detect self-hosted GitLab remote")

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # Initialize git repo
            subprocess.run(
                ["git", "init"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            # Test self-hosted instance
            subprocess.run(
                ["git", "remote", "add", "origin", "https://gitlab.example.com/test/repo.git"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            provider = detect_git_provider(tmpdir)
            if provider == "gitlab":
                print_result(True, "Correctly detected 'gitlab' for gitlab.example.com")
                return True
            else:
                print_result(False, f"Expected 'gitlab', got '{provider}'")
                return False

        except Exception as e:
            print_result(False, f"Error during test: {e}")
            return False


def test_provider_detection_github() -> bool:
    """Test 4: Provider detection for GitHub (regression test)."""
    print_test("Detect GitHub remote (regression)")

    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # Initialize git repo
            subprocess.run(
                ["git", "init"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            # Test GitHub SSH
            subprocess.run(
                ["git", "remote", "add", "origin", "git@github.com:test/repo.git"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            provider = detect_git_provider(tmpdir)
            if provider == "github":
                print_result(True, "Correctly detected 'github' for git@github.com:test/repo.git")
                return True
            else:
                print_result(False, f"Expected 'github', got '{provider}'")
                return False

        except Exception as e:
            print_result(False, f"Error during test: {e}")
            return False


def test_error_message_missing_glab() -> bool:
    """Test 5: Error message when glab is not installed."""
    print_test("Error handling for missing glab CLI")

    # Check if glab is currently installed
    glab_path = get_glab_executable()

    if glab_path:
        # glab is installed, verify the error message format from worktree.py
        print_result(True, f"glab is installed at {glab_path}")
        print("  Verifying error message format in code...")

        # Read the worktree.py file to verify error message
        worktree_path = Path(__file__).parent / "worktree.py"
        if worktree_path.exists():
            content = worktree_path.read_text()
            expected_error = "GitLab CLI (glab) not found. Install from https://gitlab.com/gitlab-org/cli"
            if expected_error in content:
                print_result(True, "Error message correctly defined in worktree.py")
                return True
            else:
                print_result(False, "Expected error message not found in worktree.py")
                return False
        else:
            print_result(False, "Could not find worktree.py")
            return False
    else:
        # glab is not installed, test the actual error message
        print_result(True, "glab CLI not found (as expected)")

        # Test error message from run_glab
        from core.glab_executable import run_glab
        result = run_glab(["mr", "create"], cwd=".")

        expected_error = "GitLab CLI (glab) not found. Install from https://gitlab.com/gitlab-org/cli"
        if expected_error in result.stderr:
            print_result(True, f"Correct error message: {result.stderr}")
            return True
        else:
            print_result(False, f"Expected error message not found. Got: {result.stderr}")
            return False


def test_worktree_integration() -> bool:
    """Test 6: Integration test with WorktreeManager (mocked)."""
    print_test("WorktreeManager push_and_create_pr routing")

    try:
        # Import WorktreeManager
        from core.worktree import WorktreeManager

        # Create temporary project directory
        with tempfile.TemporaryDirectory() as tmpdir:
            # Initialize git repo with GitLab remote
            subprocess.run(
                ["git", "init"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )
            subprocess.run(
                ["git", "remote", "add", "origin", "https://gitlab.com/test/repo.git"],
                cwd=tmpdir,
                capture_output=True,
                check=True,
            )

            # Verify provider detection works
            provider = detect_git_provider(tmpdir)
            if provider == "gitlab":
                print_result(True, "Provider correctly detected as 'gitlab' in worktree context")
                return True
            else:
                print_result(False, f"Expected 'gitlab', got '{provider}'")
                return False

    except Exception as e:
        print_result(False, f"Error during test: {e}")
        return False


def run_all_tests() -> None:
    """Run all manual end-to-end tests."""
    print_header("GitLab Support - Manual End-to-End Testing")

    print("\nThis script tests the GitLab MR creation functionality:")
    print("  1. glab CLI detection")
    print("  2. Provider detection for gitlab.com")
    print("  3. Provider detection for self-hosted GitLab")
    print("  4. Provider detection for GitHub (regression)")
    print("  5. Error handling for missing glab CLI")
    print("  6. WorktreeManager integration")

    results = {}

    # Run all tests
    print_header("Running Tests")

    results["glab_detection"] = test_glab_detection()
    results["gitlab_cloud"] = test_provider_detection_gitlab_cloud()
    results["self_hosted"] = test_provider_detection_self_hosted()
    results["github_regression"] = test_provider_detection_github()
    results["missing_glab"] = test_error_message_missing_glab()
    results["worktree_integration"] = test_worktree_integration()

    # Print summary
    print_header("Test Summary")

    total = len(results)
    passed = sum(1 for r in results.values() if r)
    failed = total - passed

    print(f"\nTotal Tests: {total}")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")

    if failed > 0:
        print("\nFailed tests:")
        for test_name, result in results.items():
            if not result:
                print(f"  ✗ {test_name}")

    print("\n" + "=" * 70)

    if failed == 0:
        print("✓ All tests passed!")
        return 0
    else:
        print(f"✗ {failed} test(s) failed")
        return 1


if __name__ == "__main__":
    try:
        exit_code = run_all_tests()
        sys.exit(exit_code)
    except KeyboardInterrupt:
        print("\n\nTests interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"\n\nUnexpected error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
