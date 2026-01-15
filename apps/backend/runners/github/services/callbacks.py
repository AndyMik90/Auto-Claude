"""
Callback Types
==============

Shared callback types used across GitHub runner services.

This module provides centralized callback definitions to avoid
circular import issues and duplicated definitions across modules.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProgressCallback:
    """Callback for progress updates during GitHub operations.

    Attributes:
        phase: Current phase name (e.g., "review", "triage", "autofix")
        progress: Progress percentage (0-100)
        message: Human-readable progress message
        issue_number: Optional issue number being processed
        pr_number: Optional PR number being processed
    """

    phase: str
    progress: int  # 0-100
    message: str
    issue_number: int | None = None
    pr_number: int | None = None
