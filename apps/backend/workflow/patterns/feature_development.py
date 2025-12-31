"""
Feature Development Workflow Pattern
=====================================

Workflow for implementing new features and functionality.
"""

from typing import Any, Dict, List
from workflow.base import WorkflowPattern, WorkflowStep, register_pattern


@register_pattern
class FeatureDevelopmentWorkflow(WorkflowPattern):
    """
    Workflow for developing new features.

    Triggers: feature, add, implement, create, new, build, develop

    Sequence:
    1. Planner agent creates implementation plan
    2. Maker agent implements the feature
    3. QA reviewer validates acceptance criteria
    """

    @property
    def name(self) -> str:
        return "feature-development"

    @property
    def description(self) -> str:
        return "Implements new features through planning, development, and validation"

    @property
    def triggers(self) -> List[str]:
        return [
            "feature",
            "add",
            "implement",
            "create",
            "new",
            "build",
            "develop",
            "extend",
            "enhance",
            "integrate",
        ]

    def estimate_complexity(self, task: str) -> str:
        """
        Estimate complexity based on feature type.

        Simple features: UI components, config changes, minor additions
        Complex features: Business logic, data models, integrations
        """
        task_lower = task.lower()

        # Simple feature indicators
        simple_keywords = [
            "button",
            "color",
            "text",
            "label",
            "message",
            "placeholder",
            "css",
            "style",
            "spacing",
            "alignment",
            "padding",
            "margin",
            "icon",
            "tooltip",
            "loading indicator",
            "progress bar",
        ]

        # If any simple keyword is present, mark as simple
        if any(kw in task_lower for kw in simple_keywords):
            return "simple"

        return "complex"

    def get_steps(self, task_context: Dict[str, Any]) -> List[WorkflowStep]:
        """
        Get workflow steps for feature development.

        Args:
            task_context: Contains 'task', 'complexity', and other context

        Returns:
            List of workflow steps
        """
        return [
            # Step 1: Plan the feature implementation
            WorkflowStep(
                agent_type="planner",
                prompt_key="plan_feature",
                output_file="artifacts/implementation_plan.md",
                depends_on=[],
            ),
            # Step 2: Implement the feature
            WorkflowStep(
                agent_type="coder",
                prompt_key="implement_feature",
                output_file=None,  # No specific output - modifies code directly
                depends_on=["plan_feature"],
            ),
            # Step 3: Verify the implementation
            WorkflowStep(
                agent_type="qa_reviewer",
                prompt_key="verify_feature",
                output_file="artifacts/validation_report.md",
                depends_on=["implement_feature"],
                optional=True,  # Can skip if testing environment not available
            ),
        ]
