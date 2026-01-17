"""
Utility functions for task logging.
"""

import re
from pathlib import Path
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from .logger import TaskLogger


# ANSI escape code patterns
# ANSI CSI (Control Sequence Introducer) escape sequence pattern.
# Matches: \x1b[ followed by parameters and ending with a command byte
ANSI_CSI_PATTERN = re.compile(r'\x1b\[[0-9;]*[A-Za-z]')

# OSC (Operating System Command) escape sequences with BEL (bell) terminator
# Matches: \x1b] ... \x07
ANSI_OSC_BEL_PATTERN = re.compile(r'\x1b\][^\x07]*\x07')

# OSC (Operating System Command) escape sequences with ST (string terminator)
# Matches: \x1b] ... \x1b\
ANSI_OSC_ST_PATTERN = re.compile(r'\x1b\][^\x1b]*\x1b\\')


def strip_ansi_codes(text: str) -> str:
    """
    Removes ANSI escape codes from a string.

    These sequences are used for terminal coloring/formatting but appear
    as raw text in logs and UI components.

    Args:
        text: The string potentially containing ANSI escape codes

    Returns:
        The string with all ANSI escape sequences removed

    Example:
        >>> strip_ansi_codes('\\x1b[90m[21:40:22.196]\\x1b[0m \\x1b[36m[DEBUG]\\x1b[0m')
        '[21:40:22.196] [DEBUG]'
    """
    if not text:
        return ''

    # Remove all ANSI escape sequences
    result = ANSI_CSI_PATTERN.sub('', text)
    result = ANSI_OSC_BEL_PATTERN.sub('', result)
    result = ANSI_OSC_ST_PATTERN.sub('', result)

    return result


# Global logger instance for easy access
_current_logger: "TaskLogger | None" = None


def get_task_logger(
    spec_dir: Path | None = None, emit_markers: bool = True
) -> "TaskLogger | None":
    """
    Get or create a task logger for the given spec directory.

    Args:
        spec_dir: Path to the spec directory (creates new logger if different from current)
        emit_markers: Whether to emit streaming markers

    Returns:
        TaskLogger instance or None if no spec_dir
    """
    global _current_logger

    if spec_dir is None:
        return _current_logger

    if _current_logger is None or _current_logger.spec_dir != spec_dir:
        _current_logger = TaskLogger(spec_dir, emit_markers)

    return _current_logger


def clear_task_logger() -> None:
    """Clear the global task logger."""
    global _current_logger
    _current_logger = None


def update_task_logger_path(new_spec_dir: Path) -> None:
    """
    Update the global task logger's spec directory after a rename.

    This should be called after renaming a spec directory to ensure
    the logger continues writing to the correct location.

    Args:
        new_spec_dir: The new path to the spec directory
    """
    global _current_logger

    if _current_logger is None:
        return

    # Update the logger's internal paths
    _current_logger.spec_dir = Path(new_spec_dir)
    _current_logger.log_file = _current_logger.spec_dir / TaskLogger.LOG_FILE

    # Update spec_id in the storage
    _current_logger.storage.update_spec_id(new_spec_dir.name)

    # Save to the new location
    _current_logger.storage.save()
