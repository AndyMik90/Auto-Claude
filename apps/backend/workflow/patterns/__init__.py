"""
Workflow Patterns
==================

Predefined workflow patterns for common development scenarios.
"""

# Import all patterns so they register themselves
from workflow.patterns.bug_resolution import BugResolutionWorkflow
from workflow.patterns.code_review import CodeReviewWorkflow
from workflow.patterns.feature_development import FeatureDevelopmentWorkflow
from workflow.patterns.investigation import InvestigationWorkflow
from workflow.patterns.refactoring import RefactoringWorkflow

__all__ = [
    "BugResolutionWorkflow",
    "CodeReviewWorkflow",
    "FeatureDevelopmentWorkflow",
    "InvestigationWorkflow",
    "RefactoringWorkflow",
]
