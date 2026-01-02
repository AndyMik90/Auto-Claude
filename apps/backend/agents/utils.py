"""
Utility Functions for Agent System
===================================

Helper functions for git operations, plan management, and file syncing.
"""

import json
import logging
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

try:
    from filelock import FileLock
    FILELOCK_AVAILABLE = True
except ImportError:
    FILELOCK_AVAILABLE = False
    FileLock = None  # type: ignore

logger = logging.getLogger(__name__)


def get_latest_commit(project_dir: Path) -> str | None:
    """Get the hash of the latest git commit."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError:
        return None


def get_commit_count(project_dir: Path) -> int:
    """Get the total number of commits."""
    try:
        result = subprocess.run(
            ["git", "rev-list", "--count", "HEAD"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            check=True,
        )
        return int(result.stdout.strip())
    except (subprocess.CalledProcessError, ValueError):
        return 0


def load_implementation_plan(spec_dir: Path) -> dict | None:
    """Load the implementation plan JSON."""
    plan_file = spec_dir / "implementation_plan.json"
    if not plan_file.exists():
        return None
    try:
        with open(plan_file) as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError):
        return None


def find_subtask_in_plan(plan: dict, subtask_id: str) -> dict | None:
    """Find a subtask by ID in the plan."""
    for phase in plan.get("phases", []):
        for subtask in phase.get("subtasks", []):
            if subtask.get("id") == subtask_id:
                return subtask
    return None


def find_phase_for_subtask(plan: dict, subtask_id: str) -> dict | None:
    """Find the phase containing a subtask."""
    for phase in plan.get("phases", []):
        for subtask in phase.get("subtasks", []):
            if subtask.get("id") == subtask_id:
                return phase
    return None


def sync_plan_to_source(spec_dir: Path, source_spec_dir: Path | None) -> bool:
    """
    Sync implementation_plan.json from worktree back to source spec directory.

    When running in isolated mode (worktrees), the agent updates the implementation
    plan inside the worktree. This function syncs those changes back to the main
    project's spec directory so the frontend/UI can see the progress.

    Args:
        spec_dir: Current spec directory (may be inside worktree)
        source_spec_dir: Original spec directory in main project (outside worktree)

    Returns:
        True if sync was performed, False if not needed or failed
    """
    # Skip if no source specified or same path (not in worktree mode)
    if not source_spec_dir:
        return False

    # Resolve paths and check if they're different
    spec_dir_resolved = spec_dir.resolve()
    source_spec_dir_resolved = source_spec_dir.resolve()

    if spec_dir_resolved == source_spec_dir_resolved:
        return False  # Same directory, no sync needed

    # Sync the implementation plan
    plan_file = spec_dir / "implementation_plan.json"
    if not plan_file.exists():
        return False

    source_plan_file = source_spec_dir / "implementation_plan.json"

    try:
        shutil.copy2(plan_file, source_plan_file)
        logger.debug(f"Synced implementation plan to source: {source_plan_file}")
        return True
    except Exception as e:
        logger.warning(f"Failed to sync implementation plan to source: {e}")
        return False


# ============================================================================
# Safe Concurrent File Access (Issue #488 - Race Condition Fix)
# ============================================================================


def safe_read_json(file_path: Path, default: dict | None = None) -> dict | None:
    """
    Safely read a JSON file with file locking to prevent race conditions.

    Args:
        file_path: Path to the JSON file
        default: Default value to return if file doesn't exist or is invalid

    Returns:
        Parsed JSON data, or default if file doesn't exist or is invalid
    """
    if not file_path.exists():
        return default

    # Use file locking if available
    if FILELOCK_AVAILABLE:
        lock_file = file_path.with_suffix(file_path.suffix + ".lock")
        with FileLock(str(lock_file), timeout=30):
            try:
                with open(file_path, "r") as f:
                    return json.load(f)
            except (OSError, json.JSONDecodeError) as e:
                logger.warning(f"Failed to read {file_path}: {e}")
                return default
    else:
        # Fallback: no locking (not ideal, but works for single-threaded use)
        try:
            with open(file_path, "r") as f:
                return json.load(f)
        except (OSError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to read {file_path}: {e}")
            return default


def safe_write_json(file_path: Path, data: dict) -> bool:
    """
    Safely write a JSON file with file locking to prevent race conditions.

    Args:
        file_path: Path to the JSON file
        data: Data to write

    Returns:
        True if successful, False otherwise
    """
    # Ensure parent directory exists
    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Use file locking if available
    if FILELOCK_AVAILABLE:
        lock_file = file_path.with_suffix(file_path.suffix + ".lock")
        with FileLock(str(lock_file), timeout=30):
            try:
                with open(file_path, "w") as f:
                    json.dump(data, f, indent=2)
                return True
            except OSError as e:
                logger.error(f"Failed to write {file_path}: {e}")
                return False
    else:
        # Fallback: no locking (not ideal, but works for single-threaded use)
        try:
            with open(file_path, "w") as f:
                json.dump(data, f, indent=2)
            return True
        except OSError as e:
            logger.error(f"Failed to write {file_path}: {e}")
            return False


def safe_update_json(
    file_path: Path,
    update_fn: Callable[[dict], dict],
    default: dict | None = None,
) -> tuple[bool, dict | None]:
    """
    Safely update a JSON file using atomic read-modify-write with file locking.

    This prevents race conditions when multiple processes/threads modify the same file.

    Args:
        file_path: Path to the JSON file
        update_fn: Function that takes current data and returns updated data
        default: Default data structure if file doesn't exist

    Returns:
        Tuple of (success, updated_data)

    Example:
        ```python
        def update_subtask(plan: dict) -> dict:
            for phase in plan.get("phases", []):
                for subtask in phase.get("subtasks", []):
                    if subtask["id"] == "task-001":
                        subtask["status"] = "completed"
            plan["last_updated"] = datetime.now(timezone.utc).isoformat()
            return plan

        success, updated_plan = safe_update_json(
            spec_dir / "implementation_plan.json",
            update_subtask
        )
        ```
    """
    # Ensure parent directory exists
    file_path.parent.mkdir(parents=True, exist_ok=True)

    # Use file locking if available
    if FILELOCK_AVAILABLE:
        lock_file = file_path.with_suffix(file_path.suffix + ".lock")
        with FileLock(str(lock_file), timeout=30):
            try:
                # Read current data
                if file_path.exists():
                    with open(file_path, "r") as f:
                        data = json.load(f)
                else:
                    data = default if default is not None else {}

                # Apply update
                updated_data = update_fn(data)

                # Write back
                with open(file_path, "w") as f:
                    json.dump(updated_data, f, indent=2)

                return True, updated_data

            except Exception as e:
                logger.error(f"Failed to update {file_path}: {e}")
                return False, None
    else:
        # Fallback: no locking (not ideal, but works for single-threaded use)
        try:
            # Read current data
            if file_path.exists():
                with open(file_path, "r") as f:
                    data = json.load(f)
            else:
                data = default if default is not None else {}

            # Apply update
            updated_data = update_fn(data)

            # Write back
            with open(file_path, "w") as f:
                json.dump(updated_data, f, indent=2)

            return True, updated_data

        except Exception as e:
            logger.error(f"Failed to update {file_path}: {e}")
            return False, None
