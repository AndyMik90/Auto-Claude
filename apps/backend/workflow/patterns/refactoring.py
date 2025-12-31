"""
Refactoring Workflow Pattern
=============================

Workflow for code refactoring and optimization.
"""

from typing import Any, Dict, List
from workflow.base import WorkflowPattern, WorkflowStep, register_pattern


@register_pattern
class RefactoringWorkflow(WorkflowPattern):
    """
    Workflow for refactoring and code optimization.

    Triggers: refactor, restructure, clean up, optimize, improve

    Sequence:
    1. Planner agent creates refactoring plan
    2. Maker agent implements refactoring
    3. QA reviewer verifies no regressions
    """

    @property
    def name(self) -> str:
        return "refactoring"

    @property
    def description(self) -> str:
        return "Refactors code through planning, implementation, and regression testing"

    @property
    def triggers(self) -> List[str]:
        return [
            "refactor",
            "restructure",
            "clean up",
            "optimize",
            "improve",
            "simplify",
            "reorganize",
            "rework",
        ]

    def estimate_complexity(self, task: str) -> str:
        """
        Estimate complexity based on refactoring scope.

        Simple refactors: Single file, local changes, style updates
        Complex refactors: Multi-file, architectural changes, performance optimization
        """
        task_lower = task.lower()

        # Simple refactoring indicators
        simple_keywords = [
            "formatting",
            "style",
            "naming",
            "unused code",
            "imports",
            "indentation",
            "spacing",
        ]

        # If any simple keyword is present, mark as simple
        if any(kw in task_lower for kw in simple_keywords):
            return "simple"

        return "complex"

    def get_steps(self, task_context: Dict[str, Any]) -> List[WorkflowStep]:
        """
        Get workflow steps for refactoring.

        Args:
            task_context: Contains 'task', 'complexity', and other context

        Returns:
            List of workflow steps
        """
        return [
            # Step 1: Plan the refactoring
            WorkflowStep(
                agent_type="planner",
                prompt_key="plan_refactor",
                output_file="artifacts/refactoring_plan.md",
                depends_on=[],
            ),
            # Step 2: Implement the refactoring
            WorkflowStep(
                agent_type="coder",
                prompt_key="implement_refactor",
                output_file=None,  # No specific output - modifies code directly
                depends_on=["plan_refactor"],
            ),
            # Step 3: Verify no regressions
            WorkflowStep(
                agent_type="qa_reviewer",
                prompt_key="verify_refactor",
                output_file="artifacts/regression_check.md",
                depends_on=["implement_refactor"],
                optional=True,  # Can skip if testing environment not available
            ),
        ]
