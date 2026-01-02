"""
Utility modules for Auto Claude backend.

This package provides common utilities for:
- File I/O with retry logic and locking (file_utils)
"""

from .file_utils import (
    FileLockError,
    FileOperationError,
    safe_read_json,
    safe_write_json,
    with_file_lock,
)

__all__ = [
    "FileLockError",
    "FileOperationError",
    "safe_read_json",
    "safe_write_json",
    "with_file_lock",
]
