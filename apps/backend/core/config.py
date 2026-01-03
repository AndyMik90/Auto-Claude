"""
Core configuration for Auto Claude.

This module provides centralized configuration management for Auto Claude,
including worktree path resolution and validation. It ensures consistent
configuration access across the entire backend codebase.

Constants:
    WORKTREE_BASE_PATH_VAR (str): Environment variable name for custom worktree base path.
    DEFAULT_WORKTREE_PATH (str): Default worktree directory name relative to project root.

Example:
    >>> from core.config import get_worktree_base_path
    >>> from pathlib import Path
    >>>
    >>> # Get worktree path with validation
    >>> project_dir = Path("/path/to/project")
    >>> worktree_path = get_worktree_base_path(project_dir)
    >>> full_path = project_dir / worktree_path
"""

import os
from pathlib import Path

# Environment variable names
WORKTREE_BASE_PATH_VAR = "WORKTREE_BASE_PATH"
"""str: Environment variable name for configuring custom worktree base path.

Users can set this environment variable in their project's .env file to specify
a custom location for worktree directories, supporting both relative and absolute paths.
"""

# Default values
DEFAULT_WORKTREE_PATH = ".worktrees"
"""str: Default worktree directory name.

This is the fallback value used when WORKTREE_BASE_PATH is not set or when
validation fails (e.g., path points to .auto-claude/ or .git/ directories).
"""


def get_worktree_base_path(project_dir: Path | None = None) -> str:
    """
    Determine the validated worktree base path from the WORKTREE_BASE_PATH environment variable or the default.
    
    Parameters:
        project_dir (Path | None): Optional project root used to resolve relative paths and perform stricter validation. If omitted, only basic pattern checks are applied.
    
    Returns:
        str: The configured worktree base path string, or DEFAULT_WORKTREE_PATH ('.worktrees') if the configured value is invalid or points inside the project's `.auto-claude` or `.git` directories.
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