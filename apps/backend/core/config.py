"""
Core configuration for Auto Claude.

Centralized configuration management including worktree paths and validation.
"""

import os
from pathlib import Path

# Environment variable names
WORKTREE_BASE_PATH_VAR = "WORKTREE_BASE_PATH"

# Default values
DEFAULT_WORKTREE_PATH = ".worktrees"


def get_worktree_base_path(project_dir: Path | None = None) -> str:
    """
    Gets the worktree base path from environment variables with validation.

    Supports:
    - Relative paths (e.g., 'worktrees', '.cache/worktrees')
    - Absolute paths (e.g., '/tmp/worktrees', 'C:\\worktrees')

    Prevents:
    - Paths inside .auto-claude/ or .git/
    - Malicious relative paths escaping to system directories

    Args:
        project_dir: Project root directory for validation. If None, only basic validation is performed.

    Returns:
        The validated worktree base path string, or DEFAULT_WORKTREE_PATH if invalid.
    """
    worktree_base_path = os.getenv(WORKTREE_BASE_PATH_VAR, DEFAULT_WORKTREE_PATH)

    # If no project_dir provided, return as-is (basic validation only)
    if not project_dir:
        # Check for obviously dangerous patterns
        normalized = Path(worktree_base_path).as_posix()
        if ".auto-claude" in normalized or ".git" in normalized:
            return DEFAULT_WORKTREE_PATH
        return worktree_base_path

    # Resolve the absolute path
    if Path(worktree_base_path).is_absolute():
        resolved = Path(worktree_base_path).resolve()
    else:
        resolved = (project_dir / worktree_base_path).resolve()

    # Prevent paths inside .auto-claude/ or .git/
    auto_claude_dir = (project_dir / ".auto-claude").resolve()
    git_dir = (project_dir / ".git").resolve()

    resolved_str = str(resolved)
    if resolved_str.startswith(str(auto_claude_dir)) or resolved_str.startswith(
        str(git_dir)
    ):
        return DEFAULT_WORKTREE_PATH

    return worktree_base_path
