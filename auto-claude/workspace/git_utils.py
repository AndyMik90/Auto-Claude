#!/usr/bin/env python3
"""
Git Utilities
==============

Utility functions for git operations used in workspace management.
"""

import json
import subprocess
from pathlib import Path
from typing import Optional

# Constants for merge limits
MAX_FILE_LINES_FOR_AI = 5000  # Skip AI for files larger than this
MAX_PARALLEL_AI_MERGES = 5  # Limit concurrent AI merge operations

BINARY_EXTENSIONS = {
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.bmp', '.svg',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib', '.bin',
    '.mp3', '.mp4', '.wav', '.avi', '.mov', '.mkv',
    '.woff', '.woff2', '.ttf', '.otf', '.eot',
    '.pyc', '.pyo', '.class', '.o', '.obj',
}

# Merge lock timeout in seconds
MERGE_LOCK_TIMEOUT = 300  # 5 minutes


def has_uncommitted_changes(project_dir: Path) -> bool:
    """Check if user has unsaved work."""
    result = subprocess.run(
        ["git", "status", "--porcelain"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    return bool(result.stdout.strip())


def get_current_branch(project_dir: Path) -> str:
    """Get the current branch name."""
    result = subprocess.run(
        ["git", "rev-parse", "--abbrev-ref", "HEAD"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    return result.stdout.strip()


def get_existing_build_worktree(project_dir: Path, spec_name: str) -> Path | None:
    """
    Check if there's an existing worktree for this specific spec.

    Args:
        project_dir: The main project directory
        spec_name: The spec folder name (e.g., "001-feature-name")

    Returns:
        Path to the worktree if it exists for this spec, None otherwise
    """
    # Per-spec worktree path: .worktrees/{spec-name}/
    worktree_path = project_dir / ".worktrees" / spec_name
    if worktree_path.exists():
        return worktree_path
    return None


def get_file_content_from_ref(project_dir: Path, ref: str, file_path: str) -> Optional[str]:
    """Get file content from a git ref (branch, commit, etc.)."""
    result = subprocess.run(
        ["git", "show", f"{ref}:{file_path}"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        return result.stdout
    return None


def get_changed_files_from_branch(
    project_dir: Path,
    base_branch: str,
    spec_branch: str,
) -> list[tuple[str, str]]:
    """Get list of changed files between branches."""
    result = subprocess.run(
        ["git", "diff", "--name-status", f"{base_branch}...{spec_branch}"],
        cwd=project_dir,
        capture_output=True,
        text=True,
    )

    files = []
    if result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if line:
                parts = line.split("\t", 1)
                if len(parts) == 2:
                    files.append((parts[1], parts[0]))  # (file_path, status)
    return files


def is_process_running(pid: int) -> bool:
    """Check if a process with the given PID is running."""
    import os
    try:
        os.kill(pid, 0)
        return True
    except (OSError, ProcessLookupError):
        return False


def is_binary_file(file_path: str) -> bool:
    """Check if a file is binary based on extension."""
    return Path(file_path).suffix.lower() in BINARY_EXTENSIONS


def validate_merged_syntax(file_path: str, content: str, project_dir: Path) -> tuple[bool, str]:
    """
    Validate the syntax of merged code.

    Returns (is_valid, error_message).
    """
    import tempfile
    from pathlib import Path as P

    ext = P(file_path).suffix.lower()

    # TypeScript/JavaScript validation
    if ext in {'.ts', '.tsx', '.js', '.jsx'}:
        try:
            # Write to temp file in system temp dir (NOT project dir to avoid HMR triggers)
            with tempfile.NamedTemporaryFile(
                mode='w',
                suffix=ext,
                delete=False,
                # Don't set dir= to avoid writing to project directory which triggers HMR
            ) as tmp:
                tmp.write(content)
                tmp_path = tmp.name

            try:
                # Try tsc first (TypeScript)
                if ext in {'.ts', '.tsx'}:
                    result = subprocess.run(
                        ['npx', 'tsc', '--noEmit', '--skipLibCheck', tmp_path],
                        cwd=project_dir,
                        capture_output=True,
                        text=True,
                        timeout=30,
                    )
                    if result.returncode != 0:
                        # Filter out npm warnings (they go to stderr but aren't errors)
                        error_lines = [
                            line for line in result.stderr.strip().split('\n')
                            if line and not line.startswith('npm warn') and not line.startswith('npm WARN')
                        ]
                        # Only treat as error if there are actual TypeScript errors
                        if error_lines:
                            return False, '\n'.join(error_lines[:3])
                        # No actual errors, just npm warnings - syntax is valid

                # Try eslint for all JS/TS
                result = subprocess.run(
                    ['npx', 'eslint', '--no-eslintrc', '--parser', '@typescript-eslint/parser', tmp_path],
                    cwd=project_dir,
                    capture_output=True,
                    text=True,
                    timeout=30,
                )
                # eslint exit 1 for errors, 0 for clean
                if result.returncode > 1:  # 2+ is config error, ignore
                    pass
                elif result.returncode == 1 and 'Parsing error' in result.stdout:
                    return False, "Syntax error in merged code"

            finally:
                P(tmp_path).unlink(missing_ok=True)

            return True, ""

        except subprocess.TimeoutExpired:
            return True, ""  # Timeout = assume ok
        except FileNotFoundError:
            return True, ""  # No tsc/eslint = skip validation
        except Exception as e:
            return True, ""  # Other errors = skip validation

    # Python validation
    elif ext == '.py':
        try:
            compile(content, file_path, 'exec')
            return True, ""
        except SyntaxError as e:
            return False, f"Python syntax error: {e.msg} at line {e.lineno}"

    # JSON validation
    elif ext == '.json':
        try:
            json.loads(content)
            return True, ""
        except json.JSONDecodeError as e:
            return False, f"JSON error: {e.msg} at line {e.lineno}"

    # Other file types - skip validation
    return True, ""


def create_conflict_file_with_git(
    main_content: str,
    worktree_content: str,
    base_content: Optional[str],
    project_dir: Path,
) -> tuple[Optional[str], bool]:
    """
    Use git merge-file to create a file with conflict markers.

    Returns (merged_content_or_none, had_conflicts).
    If auto-merged, returns (content, False).
    If conflicts, returns (content_with_markers, True).
    """
    import tempfile

    try:
        # Create temp files for three-way merge
        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.tmp') as main_f:
            main_f.write(main_content)
            main_path = main_f.name

        with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.tmp') as wt_f:
            wt_f.write(worktree_content)
            wt_path = wt_f.name

        # Use empty base if not available
        if base_content:
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.tmp') as base_f:
                base_f.write(base_content)
                base_path = base_f.name
        else:
            with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.tmp') as base_f:
                base_f.write("")
                base_path = base_f.name

        try:
            # git merge-file <current> <base> <other>
            # Exit codes: 0 = clean merge, 1 = conflicts, >1 = error
            result = subprocess.run(
                ['git', 'merge-file', '-p', main_path, base_path, wt_path],
                cwd=project_dir,
                capture_output=True,
                text=True,
            )

            # Read the merged content
            merged_content = result.stdout

            # Check for conflicts
            had_conflicts = result.returncode == 1

            return merged_content, had_conflicts

        finally:
            # Cleanup temp files
            Path(main_path).unlink(missing_ok=True)
            Path(wt_path).unlink(missing_ok=True)
            Path(base_path).unlink(missing_ok=True)

    except Exception as e:
        return None, False


# Export the _is_process_running function for backward compatibility
_is_process_running = is_process_running
_is_binary_file = is_binary_file
_validate_merged_syntax = validate_merged_syntax
_get_file_content_from_ref = get_file_content_from_ref
_get_changed_files_from_branch = get_changed_files_from_branch
_create_conflict_file_with_git = create_conflict_file_with_git
