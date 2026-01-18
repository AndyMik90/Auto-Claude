"""BMAD workflow integration code.

This package contains workflow integration code for the BMAD methodology phases.
Each workflow phase (prd, architecture, epics, etc.) will have its integration
module here.

Story Reference: Story 6.1 - Create BMAD Methodology Plugin Structure

Workflow Modules:
    - analysis: Project analysis phase (Story 6.2)
    - prd: PRD creation phase (Story 6.3)
    - architecture: Architecture design phase (Story 6.4)
    - epics: Epic and story creation phase (Story 6.5)
    - dev: Development phase (Story 6.6)
    - review: Code review phase (Story 6.7)
"""

from apps.backend.methodologies.bmad.workflows.analysis import (
    ProjectAnalysis,
    analyze_project,
    load_analysis,
)
from apps.backend.methodologies.bmad.workflows.architecture import (
    ArchitectureDocument,
    create_architecture,
    load_architecture,
)
from apps.backend.methodologies.bmad.workflows.dev import (
    ImplementationResult,
    SprintStatus,
    complete_story,
    get_implementation_status,
    get_next_story,
    implement_story,
    load_implementation_result,
)
from apps.backend.methodologies.bmad.workflows.epics import (
    Epic,
    EpicsDocument,
    Story,
    create_epics,
    load_epics,
    prepare_stories,
)
from apps.backend.methodologies.bmad.workflows.prd import (
    PRDDocument,
    Requirement,
    create_prd,
    load_prd,
)

__all__ = [
    # Analysis
    "analyze_project",
    "load_analysis",
    "ProjectAnalysis",
    # PRD
    "create_prd",
    "load_prd",
    "PRDDocument",
    "Requirement",
    # Architecture
    "create_architecture",
    "load_architecture",
    "ArchitectureDocument",
    # Epics
    "create_epics",
    "load_epics",
    "prepare_stories",
    "EpicsDocument",
    "Epic",
    "Story",
    # Dev
    "implement_story",
    "complete_story",
    "get_next_story",
    "get_implementation_status",
    "load_implementation_result",
    "ImplementationResult",
    "SprintStatus",
]
