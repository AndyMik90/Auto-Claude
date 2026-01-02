"""
File Utilities with Retry Logic and Cross-Platform Locking

FIX #491: Provides retry logic for transient file system errors
FIX #488: Provides file locking to prevent concurrent write race conditions

This module provides safe file I/O operations for critical files like
implementation_plan.json that may be accessed concurrently by multiple
processes (UI, agents, watchers).

Usage:
    from utils.file_utils import safe_read_json, safe_write_json

    # Read with retry and locking
    data = safe_read_json(path)

    # Write with retry and locking
    safe_write_json(path, data)
"""

import contextlib
import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Callable, TypeVar

from tenacity import (
    RetryError,
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

logger = logging.getLogger(__name__)

# Type variable for generic functions
T = TypeVar("T")

# =============================================================================
# Exceptions
# =============================================================================


class FileOperationError(Exception):
    """Raised when a file operation fails after all retries."""

    pass


class FileLockError(Exception):
    """Raised when unable to acquire file lock within timeout."""

    pass


# =============================================================================
# Cross-Platform File Locking
# =============================================================================


@contextlib.contextmanager
def with_file_lock(file_path: Path, mode: str = "r", timeout: float = 10.0):
    """
    Context manager for cross-platform file locking.

    Provides exclusive access to a file to prevent concurrent write conflicts.
    Works on both Windows (msvcrt) and Unix (fcntl) systems.

    FIX #488: Prevents race conditions when multiple processes access the same file.

    Args:
        file_path: Path to the file to lock
        mode: File mode ('r', 'w', 'r+', etc.)
        timeout: Maximum seconds to wait for lock (default: 10s)

    Yields:
        Opened file handle with exclusive lock

    Raises:
        FileLockError: If unable to acquire lock within timeout
        FileNotFoundError: If file doesn't exist and mode doesn't create it

    Usage:
        with with_file_lock(Path("data.json"), "w") as f:
            json.dump(data, f)
    """
    # Ensure parent directory exists for write modes
    if "w" in mode or "a" in mode:
        file_path.parent.mkdir(parents=True, exist_ok=True)

    file_handle = None
    lock_acquired = False
    start_time = time.monotonic()

    try:
        # Open file
        file_handle = open(file_path, mode, encoding="utf-8")

        # Platform-specific locking
        if sys.platform == "win32":
            import msvcrt

            # Windows: Lock first byte of file
            while True:
                try:
                    msvcrt.locking(file_handle.fileno(), msvcrt.LK_NBLCK, 1)
                    lock_acquired = True
                    break
                except (IOError, OSError):
                    if time.monotonic() - start_time > timeout:
                        raise FileLockError(
                            f"Timeout acquiring lock for {file_path} after {timeout}s"
                        )
                    time.sleep(0.1)
        else:
            import fcntl

            # Unix: Use flock for exclusive lock
            while True:
                try:
                    fcntl.flock(file_handle.fileno(), fcntl.LOCK_EX | fcntl.LOCK_NB)
                    lock_acquired = True
                    break
                except (IOError, OSError):
                    if time.monotonic() - start_time > timeout:
                        raise FileLockError(
                            f"Timeout acquiring lock for {file_path} after {timeout}s"
                        )
                    time.sleep(0.1)

        yield file_handle

    finally:
        if file_handle:
            # Release lock before closing
            if lock_acquired:
                try:
                    if sys.platform == "win32":
                        import msvcrt

                        # Seek to beginning before unlocking
                        file_handle.seek(0)
                        msvcrt.locking(file_handle.fileno(), msvcrt.LK_UNLCK, 1)
                    else:
                        import fcntl

                        fcntl.flock(file_handle.fileno(), fcntl.LOCK_UN)
                except (IOError, OSError) as e:
                    logger.warning(f"Error releasing file lock: {e}")
            file_handle.close()


# =============================================================================
# Retry Decorators
# =============================================================================

# Standard retry configuration for file operations
# FIX #491: 3 attempts with exponential backoff (1s, 2s, 4s)
FILE_RETRY_CONFIG = {
    "stop": stop_after_attempt(3),
    "wait": wait_exponential(multiplier=1, min=1, max=10),
    "retry": retry_if_exception_type(
        (
            IOError,
            OSError,
            PermissionError,
            BlockingIOError,
            FileLockError,
        )
    ),
    "reraise": True,
}


def retry_file_operation(func: Callable[..., T]) -> Callable[..., T]:
    """
    Decorator for file operations with retry logic.

    FIX #491: Retries up to 3 times with exponential backoff on
    transient file system errors (IOError, OSError, PermissionError, etc.).

    Usage:
        @retry_file_operation
        def read_config(path: Path) -> dict:
            with open(path) as f:
                return json.load(f)
    """
    return retry(**FILE_RETRY_CONFIG)(func)


# =============================================================================
# Safe File I/O Functions
# =============================================================================


@retry(**FILE_RETRY_CONFIG)
def safe_read_json(path: Path, default: Any = None) -> Any:
    """
    Read JSON file with retry logic and file locking.

    FIX #491: Retries on transient errors (IOError, OSError, etc.)
    FIX #488: Uses file locking to prevent concurrent access issues

    Args:
        path: Path to the JSON file
        default: Value to return if file doesn't exist (default: None)

    Returns:
        Parsed JSON data, or default if file doesn't exist

    Raises:
        FileOperationError: If read fails after all retries
        json.JSONDecodeError: If file contains invalid JSON
    """
    if not path.exists():
        logger.debug(f"File not found, returning default: {path}")
        return default

    try:
        with with_file_lock(path, "r") as f:
            return json.load(f)
    except FileLockError:
        # Re-raise to trigger retry
        raise
    except json.JSONDecodeError as e:
        # Don't retry on invalid JSON - it's a data error, not transient
        logger.error(f"Invalid JSON in {path}: {e}")
        raise
    except (IOError, OSError, PermissionError) as e:
        logger.warning(f"File read error (will retry): {path} - {e}")
        raise


@retry(**FILE_RETRY_CONFIG)
def safe_write_json(
    path: Path,
    data: Any,
    indent: int = 2,
    ensure_ascii: bool = False,
) -> None:
    """
    Write JSON file with retry logic, file locking, and atomic write.

    FIX #491: Retries on transient errors (IOError, OSError, etc.)
    FIX #488: Uses file locking and atomic write to prevent corruption

    The write is atomic: data is written to a temp file first, then
    renamed to the target path. This prevents partial writes from
    corrupting the file.

    Args:
        path: Path to the JSON file
        data: Data to serialize as JSON
        indent: JSON indentation (default: 2)
        ensure_ascii: Whether to escape non-ASCII chars (default: False)

    Raises:
        FileOperationError: If write fails after all retries
        TypeError: If data is not JSON-serializable
    """
    # Ensure parent directory exists
    path.parent.mkdir(parents=True, exist_ok=True)

    # Use temp file for atomic write
    temp_path = path.with_suffix(f".tmp.{os.getpid()}")

    try:
        # Write to temp file first
        with with_file_lock(temp_path, "w") as f:
            json.dump(data, f, indent=indent, ensure_ascii=ensure_ascii)

        # Atomic rename (may fail on Windows if target exists)
        try:
            temp_path.replace(path)
        except OSError:
            # Windows fallback: remove target first
            if path.exists():
                path.unlink()
            temp_path.rename(path)

        logger.debug(f"Successfully wrote JSON to {path}")

    except FileLockError:
        # Re-raise to trigger retry
        raise
    except TypeError as e:
        # Don't retry on serialization errors
        logger.error(f"JSON serialization error: {e}")
        raise
    except (IOError, OSError, PermissionError) as e:
        logger.warning(f"File write error (will retry): {path} - {e}")
        raise
    finally:
        # Clean up temp file if it still exists
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass


@retry(**FILE_RETRY_CONFIG)
def safe_read_text(path: Path, default: str = "") -> str:
    """
    Read text file with retry logic and file locking.

    Args:
        path: Path to the text file
        default: Value to return if file doesn't exist (default: "")

    Returns:
        File contents as string, or default if file doesn't exist
    """
    if not path.exists():
        return default

    try:
        with with_file_lock(path, "r") as f:
            return f.read()
    except FileLockError:
        raise
    except (IOError, OSError, PermissionError) as e:
        logger.warning(f"File read error (will retry): {path} - {e}")
        raise


@retry(**FILE_RETRY_CONFIG)
def safe_write_text(path: Path, content: str) -> None:
    """
    Write text file with retry logic and atomic write.

    Args:
        path: Path to the text file
        content: Text content to write
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    temp_path = path.with_suffix(f".tmp.{os.getpid()}")

    try:
        with with_file_lock(temp_path, "w") as f:
            f.write(content)

        try:
            temp_path.replace(path)
        except OSError:
            if path.exists():
                path.unlink()
            temp_path.rename(path)

    finally:
        if temp_path.exists():
            try:
                temp_path.unlink()
            except OSError:
                pass
