"""
Backward-Compatibility Re-Exports
================================

Die Implementierung wurde nach `apps/backend/file_lock.py` verschoben, um
Code-Duplikation zu vermeiden. Dieser Modulpfad bleibt bestehen, damit bestehende
Imports im GitHub Runner nicht brechen.
"""

from __future__ import annotations

from ...file_lock import (  # noqa: F401
    FileLock,
    FileLockError,
    FileLockTimeout,
    atomic_write,
    locked_json_read,
    locked_json_update,
    locked_json_write,
    locked_read,
    locked_write,
)

__all__ = [
    "FileLock",
    "FileLockError",
    "FileLockTimeout",
    "atomic_write",
    "locked_write",
    "locked_read",
    "locked_json_write",
    "locked_json_read",
    "locked_json_update",
]
