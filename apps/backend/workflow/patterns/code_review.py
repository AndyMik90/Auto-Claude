"""
Code Review Workflow Pattern
=============================

Workflow for reviewing code quality and generating feedback.
"""

from typing import Any, Dict, List
from workflow.base import WorkflowPattern, WorkflowStep, register_pattern


@register_pattern
class CodeReviewWorkflow(WorkflowPattern):
    """
    Workflow for code review and analysis.

    Triggers: review, audit, check, analyze code

    Sequence:
    1. Review agent analyzes code
    2. Optional: Document agent generates review documentation
    """

    @property
    def name(self) -> str:
        return "code-review"

    @property
    def description(self) -> str:
        return "Reviews code quality and generates feedback"

    @property
    def triggers(self) -> List[str]:
        return [
            "review",
            "audit",
            "check code",
            "analyze code",
            "code quality",
            "inspect",
            "examine",
        ]

    def estimate_complexity(self, task: str) -> str:
        """
        Estimate complexity based on review scope.

        Simple reviews: Single file, small changes
        Complex reviews: Multi-file, architectural review, security audit
        """
        task_lower = task.lower()

        # Simple review indicators
        simple_keywords = [
            "review this file",
            "check function",
            "review pr",
            "review changes",
        ]

        # If any simple keyword is present, mark as simple
        if any(kw in task_lower for kw in simple_keywords):
            return "simple"

        return "complex"

    def get_steps(self, task_context: Dict[str, Any]) -> List[WorkflowStep]:
        """
        Get workflow steps for code review.

        Args:
            task_context: Contains 'task', 'complexity', and other context

        Returns:
            List of workflow steps
        """
        return [
            # Step 1: Review the code
            WorkflowStep(
                agent_type="qa_reviewer",
                prompt_key="review_code",
                output_file="artifacts/review_report.md",
                depends_on=[],
            ),
            # Step 2: Generate documentation (optional, future)
            WorkflowStep(
                agent_type="coder",
                prompt_key="document_review",
                output_file="artifacts/review_summary.md",
                depends_on=["review_code"],
                optional=True,
            ),
        ]
