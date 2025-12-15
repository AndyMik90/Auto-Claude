"""
Human Review Checkpoint System
==============================

Provides a mandatory human review checkpoint between spec creation (spec_runner.py)
and build execution (run.py). Users can review the spec.md and implementation_plan.json,
provide feedback, request changes, or explicitly approve before any code is written.

Public API:
    - ReviewState: State management class
    - run_review_checkpoint: Main interactive review function
    - get_review_status_summary: Get review status summary
    - display_spec_summary: Display spec overview
    - display_plan_summary: Display implementation plan
    - display_review_status: Display current review status
    - open_file_in_editor: Open file in user's editor
    - ReviewChoice: Enum of review actions

Usage:
    from review import ReviewState, run_review_checkpoint

    state = ReviewState.load(spec_dir)
    if not state.is_approved():
        state = run_review_checkpoint(spec_dir)
"""

# Core state management
from .state import (
    ReviewState,
    get_review_status_summary,
    REVIEW_STATE_FILE,
)

# Display formatters
from .formatters import (
    display_spec_summary,
    display_plan_summary,
    display_review_status,
)

# Review orchestration
from .reviewer import (
    ReviewChoice,
    run_review_checkpoint,
    open_file_in_editor,
    get_review_menu_options,
    prompt_feedback,
)

# Diff analysis utilities (internal, but available if needed)
from .diff_analyzer import (
    extract_section,
    extract_table_rows,
    truncate_text,
    extract_title,
    extract_checkboxes,
)

__all__ = [
    # State
    "ReviewState",
    "get_review_status_summary",
    "REVIEW_STATE_FILE",
    # Formatters
    "display_spec_summary",
    "display_plan_summary",
    "display_review_status",
    # Reviewer
    "ReviewChoice",
    "run_review_checkpoint",
    "open_file_in_editor",
    "get_review_menu_options",
    "prompt_feedback",
    # Diff analyzer (utility)
    "extract_section",
    "extract_table_rows",
    "truncate_text",
    "extract_title",
    "extract_checkboxes",
]
