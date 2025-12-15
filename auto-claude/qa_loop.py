"""
QA Validation Loop (Facade)
============================

This module provides backward compatibility by re-exporting the QA
validation system that has been refactored into the qa/ package.

For new code, prefer importing directly from the qa package:
    from qa import run_qa_validation_loop, should_run_qa, is_qa_approved

Module structure:
    - qa/loop.py: Main QA orchestration loop
    - qa/reviewer.py: QA reviewer agent session
    - qa/fixer.py: QA fixer agent session
    - qa/report.py: Issue tracking, reporting, escalation
    - qa/criteria.py: Acceptance criteria and status management

Enhanced features:
- Iteration tracking with detailed history
- Recurring issue detection (3+ occurrences → human escalation)
- No-test project handling
- Integration with validation strategy and risk classification
"""

# Re-export everything from the qa package for backward compatibility
from qa import (
    # Configuration
    MAX_QA_ITERATIONS,
    RECURRING_ISSUE_THRESHOLD,
    ISSUE_SIMILARITY_THRESHOLD,

    # Main loop
    run_qa_validation_loop,

    # Criteria & status
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

    # Report & tracking
    get_iteration_history,
    record_iteration,
    has_recurring_issues,
    get_recurring_issue_summary,
    escalate_to_human,
    create_manual_test_plan,
    check_test_discovery,
    is_no_test_project,
    _normalize_issue_key,
    _issue_similarity,

    # Agent sessions
    load_qa_reviewer_prompt,
    run_qa_agent_session,
    load_qa_fixer_prompt,
    run_qa_fixer_session,
)

# Maintain original __all__ for explicit exports
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
