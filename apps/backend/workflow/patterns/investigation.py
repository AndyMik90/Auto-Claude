"""
Investigation Workflow Pattern
===============================

Workflow for code investigation and research.
"""

from typing import Any, Dict, List
from workflow.base import WorkflowPattern, WorkflowStep, register_pattern


@register_pattern
class InvestigationWorkflow(WorkflowPattern):
    """
    Workflow for investigating and understanding code.

    Triggers: investigate, explore, research, understand, explain

    Sequence:
    1. Research agent investigates the code/topic
    2. Optional: Document findings
    """

    @property
    def name(self) -> str:
        return "investigation"

    @property
    def description(self) -> str:
        return "Investigates code and generates documentation/reports"

    @property
    def triggers(self) -> List[str]:
        return [
            "investigate",
            "explore",
            "research",
            "understand",
            "explain",
            "analyze code",
            "how does",
            "how to",
            "figure out",
        ]

    def estimate_complexity(self, task: str) -> str:
        """
        Estimate complexity based on investigation scope.

        Simple investigations: Single file/module, straightforward questions
        Complex investigations: Multi-system, architecture, performance analysis
        """
        task_lower = task.lower()

        # Simple investigation indicators
        simple_keywords = [
            "how do i",
            "where is",
            "what does",
            "explain this",
            "how to use",
        ]

        # If any simple keyword is present, mark as simple
        if any(kw in task_lower for kw in simple_keywords):
            return "simple"

        return "complex"

    def get_steps(self, task_context: Dict[str, Any]) -> List[WorkflowStep]:
        """
        Get workflow steps for investigation.

        Args:
            task_context: Contains 'task', 'complexity', and other context

        Returns:
            List of workflow steps
        """
        return [
            # Step 1: Investigate the code/topic
            WorkflowStep(
                agent_type="spec_researcher",
                prompt_key="investigate",
                output_file="artifacts/investigation_report.md",
                depends_on=[],
            ),
            # Step 2: Document findings (optional)
            WorkflowStep(
                agent_type="coder",
                prompt_key="document_findings",
                output_file="artifacts/findings_documentation.md",
                depends_on=["investigate"],
                optional=True,
            ),
        ]
