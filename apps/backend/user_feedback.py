"""
User feedback management module stub.

This module provides functions for managing user feedback on tasks.
Currently a stub implementation - returns empty results.
"""

from typing import Any


def get_unread_feedback(spec_dir: str) -> list[tuple[int, dict[str, Any]]]:
    """
    Get unread user feedback for a spec.

    Args:
        spec_dir: Path to the spec directory

    Returns:
        List of tuples (index, feedback_dict) for unread feedback.
        Currently returns empty list as stub implementation.
    """
    return []
