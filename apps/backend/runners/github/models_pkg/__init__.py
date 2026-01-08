"""
GitHub Automation Data Models (Extended Package)
================================================

Extended data structures for GitHub automation features, organized by domain.

This package provides additional domain-specific models for the autonomous
PR review system. It does NOT conflict with the sibling models.py file.

Modules:
    pr_review_state - Durable state for PR review orchestrator crash recovery

Usage:
    from runners.github.models_pkg import PRReviewOrchestratorState
    # OR
    from runners.github.models_pkg.pr_review_state import PRReviewOrchestratorState
"""

from .pr_review_state import (
    AppliedFix,
    CheckStatus,
    CICheckResult,
    ExternalBotStatus,
    IterationRecord,
    PRReviewOrchestratorState,
    PRReviewStatus,
)

__all__ = [
    # PR Review Orchestrator State
    "PRReviewOrchestratorState",
    "PRReviewStatus",
    "CheckStatus",
    "CICheckResult",
    "ExternalBotStatus",
    "AppliedFix",
    "IterationRecord",
]
