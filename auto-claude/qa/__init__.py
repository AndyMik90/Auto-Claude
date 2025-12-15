"""
QA Validation Package
=====================

Modular QA validation system with:
- Acceptance criteria validation
- Issue tracking and reporting
- Recurring issue detection
- QA reviewer and fixer agents
- Main orchestration loop

Usage:
    from qa import run_qa_validation_loop, should_run_qa, is_qa_approved

Module structure:
    - loop.py: Main QA orchestration loop
    - reviewer.py: QA reviewer agent session
    - fixer.py: QA fixer agent session
    - report.py: Issue tracking, reporting, escalation
    - criteria.py: Acceptance criteria and status management
"""

# Configuration constants
from .loop import MAX_QA_ITERATIONS
from .report import RECURRING_ISSUE_THRESHOLD, ISSUE_SIMILARITY_THRESHOLD

# Main loop
from .loop import run_qa_validation_loop

# Criteria & status
from .criteria import (
    load_implementation_plan,
    save_implementation_plan,
    get_qa_signoff_status,
    is_qa_approved,
    is_qa_rejected,
    is_fixes_applied,
    get_qa_iteration_count,
    should_run_qa,
    should_run_fixes,
    print_qa_status,
)

# Report & tracking
from .report import (
    get_iteration_history,
    record_iteration,
    has_recurring_issues,
    get_recurring_issue_summary,
    escalate_to_human,
    create_manual_test_plan,
    check_test_discovery,
    is_no_test_project,
    # Private functions exposed for testing
    _normalize_issue_key,
    _issue_similarity,
)

# Agent sessions
from .reviewer import (
    load_qa_reviewer_prompt,
    run_qa_agent_session,
)
from .fixer import (
    load_qa_fixer_prompt,
    run_qa_fixer_session,
)

# Public API
__all__ = [
    # Configuration
    "MAX_QA_ITERATIONS",
    "RECURRING_ISSUE_THRESHOLD",
    "ISSUE_SIMILARITY_THRESHOLD",

    # Main loop
    "run_qa_validation_loop",

    # Criteria & status
    "load_implementation_plan",
    "save_implementation_plan",
    "get_qa_signoff_status",
    "is_qa_approved",
    "is_qa_rejected",
    "is_fixes_applied",
    "get_qa_iteration_count",
    "should_run_qa",
    "should_run_fixes",
    "print_qa_status",

    # Report & tracking
    "get_iteration_history",
    "record_iteration",
    "has_recurring_issues",
    "get_recurring_issue_summary",
    "escalate_to_human",
    "create_manual_test_plan",
    "check_test_discovery",
    "is_no_test_project",
    "_normalize_issue_key",
    "_issue_similarity",

    # Agent sessions
    "load_qa_reviewer_prompt",
    "run_qa_agent_session",
    "load_qa_fixer_prompt",
    "run_qa_fixer_session",
]
