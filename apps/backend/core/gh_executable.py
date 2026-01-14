#!/usr/bin/env python3
"""
GitHub CLI Executable Finder
============================

Utility to find the gh (GitHub CLI) executable, with platform-specific fallbacks.
"""

import os
import shutil
import subprocess

_cached_gh_path: str | None = None


def get_gh_executable() -> str | None:
    """Find the gh executable, with platform-specific fallbacks.

    Returns the path to gh executable, or None if not found.

    Priority order:
    1. GITHUB_CLI_PATH env var (user-configured path from frontend)
    2. shutil.which (if gh is in PATH)
    3. Homebrew paths on macOS
    4. Windows Program Files paths
    5. Windows 'where' command

    Caches the result after first successful find.
    """
    global _cached_gh_path

    # Return cached result if available
    if _cached_gh_path is not None:
        return _cached_gh_path

    gh_path = _find_gh_executable()
    if gh_path:
        _cached_gh_path = gh_path
    return gh_path


def _find_gh_executable() -> str | None:
    """Internal function to find gh executable."""
    # 1. Check GITHUB_CLI_PATH env var (set by Electron frontend)
    env_path = os.environ.get("GITHUB_CLI_PATH")
    if env_path:
        try:
            if os.path.isfile(env_path):
                # Verify it's actually gh by checking version
                result = subprocess.run(
                    [env_path, "--version"],
                    capture_output=True,
                    text=True,
                    timeout=5,
                )
                if result.returncode == 0:
                    return env_path
        except (subprocess.TimeoutExpired, OSError):
            pass  # Invalid path or execution failed - try next method

    # 2. Try shutil.which (works if gh is in PATH)
    gh_path = shutil.which("gh")
    if gh_path:
        # Verify it works by checking version
        try:
            result = subprocess.run(
                [gh_path, "--version"],
                capture_output=True,
                text=True,
                timeout=5,
            )
            if result.returncode == 0:
                return gh_path
        except (subprocess.TimeoutExpired, OSError):
            pass  # Execution failed - try next method

    # 3. macOS-specific: check Homebrew paths
    if os.name != "nt":  # Unix-like systems (macOS, Linux)
        homebrew_paths = [
            "/opt/homebrew/bin/gh",  # Apple Silicon
            "/usr/local/bin/gh",  # Intel Mac
            "/home/linuxbrew/.linuxbrew/bin/gh",  # Linux Homebrew
        ]
        for path in homebrew_paths:
            try:
                if os.path.isfile(path):
                    # Verify it's actually gh
                    result = subprocess.run(
                        [path, "--version"],
                        capture_output=True,
                        text=True,
                        timeout=5,
                    )
                    if result.returncode == 0:
                        return path
            except (subprocess.TimeoutExpired, OSError):
                continue

    # 4. Windows-specific: check Program Files paths
    if os.name == "nt":
        windows_paths = [
            os.path.expandvars(r"%PROGRAMFILES%\GitHub CLI\gh.exe"),
            os.path.expandvars(r"%PROGRAMFILES(X86)%\GitHub CLI\gh.exe"),
            os.path.expandvars(r"%LOCALAPPDATA%\Programs\GitHub CLI\gh.exe"),
            r"C:\Program Files\GitHub CLI\gh.exe",
            r"C:\Program Files (x86)\GitHub CLI\gh.exe",
        ]
        for path in windows_paths:
            try:
                if os.path.isfile(path):
                    # Verify it's actually gh
                    result = subprocess.run(
                        [path, "--version"],
                        capture_output=True,
                        text=True,
                        timeout=5,
                    )
                    if result.returncode == 0:
                        return path
            except (subprocess.TimeoutExpired, OSError):
                continue

        # 5. Try 'where' command with shell=True (more reliable on Windows)
        try:
            result = subprocess.run(
                "where gh",
                capture_output=True,
                text=True,
                timeout=5,
                shell=True,
            )
            if result.returncode == 0 and result.stdout.strip():
                found_path = result.stdout.strip().split("\n")[0].strip()
                if found_path and os.path.isfile(found_path):
                    return found_path
        except (subprocess.TimeoutExpired, OSError):
            pass  # 'where' command failed

    return None
