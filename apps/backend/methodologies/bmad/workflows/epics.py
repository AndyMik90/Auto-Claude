"""BMAD Epic and Story creation workflow.

This module implements the epic and story creation phase for the BMAD methodology.
It generates Epics and Stories based on the PRD and Architecture documents,
breaking down requirements into actionable development tasks.

Story Reference: Story 6.5 - Implement BMAD Epic and Story Creation
Architecture Source: architecture.md#BMAD-Plugin-Structure
"""

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


@dataclass
class AcceptanceCriterion:
    """A single acceptance criterion for a story.

    Attributes:
        id: Unique identifier for the criterion (e.g., AC-001)
        description: Description of what must be true for acceptance
        verified: Whether this criterion has been verified
    """

    id: str = ""
    description: str = ""
    verified: bool = False


@dataclass
class Story:
    """A user story within an epic.

    Attributes:
        id: Unique identifier for the story (e.g., S-001)
        title: Short title for the story
        description: Detailed description using user story format
        epic_id: ID of the parent epic
        story_points: Estimated effort (1, 2, 3, 5, 8, 13)
        priority: Priority level (critical, high, medium, low)
        status: Current status (backlog, ready, in_progress, done)
        acceptance_criteria: List of acceptance criteria
        dependencies: List of story IDs this story depends on
        technical_notes: Technical implementation notes
        assigned_to: Assignee (if applicable)
    """

    id: str = ""
    title: str = ""
    description: str = ""
    epic_id: str = ""
    story_points: int = 3
    priority: str = "medium"  # critical, high, medium, low
    status: str = "backlog"  # backlog, ready, in_progress, done
    acceptance_criteria: list[AcceptanceCriterion] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    technical_notes: str = ""
    assigned_to: str = ""

    def to_markdown(self) -> str:
        """Convert Story to Markdown format for individual story file.

        Returns:
            Markdown-formatted story document
        """
        lines: list[str] = []

        lines.append(f"# Story: {self.id} - {self.title}")
        lines.append("")
        lines.append(f"**Epic:** {self.epic_id}")
        lines.append(f"**Story Points:** {self.story_points}")
        lines.append(f"**Priority:** {self.priority}")
        lines.append(f"**Status:** {self.status}")
        if self.assigned_to:
            lines.append(f"**Assigned To:** {self.assigned_to}")
        lines.append("")

        lines.append("## Description")
        lines.append("")
        lines.append(self.description or "_No description provided_")
        lines.append("")

        lines.append("## Acceptance Criteria")
        lines.append("")
        if self.acceptance_criteria:
            for ac in self.acceptance_criteria:
                checkbox = "[x]" if ac.verified else "[ ]"
                lines.append(f"- {checkbox} **{ac.id}**: {ac.description}")
        else:
            lines.append("_No acceptance criteria defined_")
        lines.append("")

        if self.dependencies:
            lines.append("## Dependencies")
            lines.append("")
            for dep in self.dependencies:
                lines.append(f"- {dep}")
            lines.append("")

        if self.technical_notes:
            lines.append("## Technical Notes")
            lines.append("")
            lines.append(self.technical_notes)
            lines.append("")

        return "\n".join(lines)


@dataclass
class Epic:
    """An epic containing multiple related stories.

    Attributes:
        id: Unique identifier for the epic (e.g., E-001)
        title: Short title for the epic
        description: Description of the epic's goal
        priority: Priority level (critical, high, medium, low)
        status: Current status (draft, ready, in_progress, done)
        stories: List of stories in this epic
        requirements: List of requirement IDs addressed by this epic
        tags: List of tags/labels for categorization
    """

    id: str = ""
    title: str = ""
    description: str = ""
    priority: str = "medium"  # critical, high, medium, low
    status: str = "draft"  # draft, ready, in_progress, done
    stories: list[Story] = field(default_factory=list)
    requirements: list[str] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


@dataclass
class EpicsMetadata:
    """Metadata about the Epics document.

    Attributes:
        version: Epics document version
        status: Current status (draft, review, approved)
        created_at: Timestamp when document was created
        updated_at: Timestamp when document was last updated
        author: Author of the document
        sprint_length: Default sprint length in days
    """

    version: str = "1.0.0"
    status: str = "draft"  # draft, review, approved
    created_at: str = ""
    updated_at: str = ""
    author: str = "auto-claude"
    sprint_length: int = 14


@dataclass
class EpicsDocument:
    """Complete Epics and Stories Document.

    This is the main output of the create_epics function and is
    serialized to epics.md and stories/*.md artifacts.

    Attributes:
        project_name: Name of the project
        overview: High-level overview of the epic breakdown
        epics: List of epics with their stories
        metadata: Document metadata
    """

    project_name: str = ""
    overview: str = ""
    epics: list[Epic] = field(default_factory=list)
    metadata: EpicsMetadata = field(default_factory=EpicsMetadata)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    def to_markdown(self) -> str:
        """Convert Epics to Markdown format.

        Returns:
            Markdown-formatted Epics document
        """
        lines: list[str] = []

        # Header
        lines.append(f"# Epics & Stories: {self.project_name}")
        lines.append("")
        lines.append(f"**Version:** {self.metadata.version}")
        lines.append(f"**Status:** {self.metadata.status}")
        lines.append(f"**Created:** {self.metadata.created_at}")
        lines.append(f"**Updated:** {self.metadata.updated_at}")
        lines.append(f"**Author:** {self.metadata.author}")
        lines.append(f"**Sprint Length:** {self.metadata.sprint_length} days")
        lines.append("")

        # Summary statistics
        total_stories = sum(len(e.stories) for e in self.epics)
        total_points = sum(
            sum(s.story_points for s in e.stories) for e in self.epics
        )
        lines.append("## Summary")
        lines.append("")
        lines.append(f"- **Total Epics:** {len(self.epics)}")
        lines.append(f"- **Total Stories:** {total_stories}")
        lines.append(f"- **Total Story Points:** {total_points}")
        lines.append("")

        # Table of Contents
        lines.append("## Table of Contents")
        lines.append("")
        for epic in self.epics:
            lines.append(f"- [{epic.id}: {epic.title}](#{epic.id.lower()}-{self._slugify(epic.title)})")
            for story in epic.stories:
                lines.append(f"  - [{story.id}: {story.title}](#{story.id.lower()}-{self._slugify(story.title)})")
        lines.append("")

        # Overview
        lines.append("## Overview")
        lines.append("")
        lines.append(self.overview or "_No overview provided_")
        lines.append("")

        # Epics and Stories
        for epic in self.epics:
            lines.append(f"## {epic.id}: {epic.title}")
            lines.append("")
            lines.append(f"**Priority:** {epic.priority}")
            lines.append(f"**Status:** {epic.status}")
            if epic.tags:
                lines.append(f"**Tags:** {', '.join(epic.tags)}")
            lines.append("")
            lines.append(epic.description or "_No description_")
            lines.append("")

            if epic.requirements:
                lines.append("**Related Requirements:**")
                for req in epic.requirements:
                    lines.append(f"- {req}")
                lines.append("")

            # Stories within epic
            if epic.stories:
                lines.append("### Stories")
                lines.append("")
                lines.append("| ID | Title | Points | Priority | Status |")
                lines.append("|----|-------|--------|----------|--------|")
                for story in epic.stories:
                    lines.append(
                        f"| {story.id} | {story.title} | {story.story_points} | "
                        f"{story.priority} | {story.status} |"
                    )
                lines.append("")

                # Detailed story breakdowns
                for story in epic.stories:
                    lines.append(f"#### {story.id}: {story.title}")
                    lines.append("")
                    lines.append(f"**Points:** {story.story_points} | "
                               f"**Priority:** {story.priority} | "
                               f"**Status:** {story.status}")
                    lines.append("")
                    lines.append(story.description or "_No description_")
                    lines.append("")

                    if story.acceptance_criteria:
                        lines.append("**Acceptance Criteria:**")
                        for ac in story.acceptance_criteria:
                            checkbox = "[x]" if ac.verified else "[ ]"
                            lines.append(f"- {checkbox} {ac.description}")
                        lines.append("")

                    if story.dependencies:
                        lines.append(f"**Dependencies:** {', '.join(story.dependencies)}")
                        lines.append("")

                    if story.technical_notes:
                        lines.append("**Technical Notes:**")
                        lines.append(story.technical_notes)
                        lines.append("")

            else:
                lines.append("_No stories defined for this epic_")
                lines.append("")

        return "\n".join(lines)

    @staticmethod
    def _slugify(text: str) -> str:
        """Convert text to URL-friendly slug."""
        return text.lower().replace(" ", "-").replace("_", "-")

    def get_all_stories(self) -> list[Story]:
        """Get all stories across all epics.

        Returns:
            Flat list of all stories
        """
        stories = []
        for epic in self.epics:
            stories.extend(epic.stories)
        return stories


def _load_prd(output_dir: Path) -> dict[str, Any] | None:
    """Load PRD from output directory.

    Args:
        output_dir: Directory containing prd.json

    Returns:
        Dictionary of PRD data, or None if not found
    """
    prd_file = output_dir / "prd.json"
    if not prd_file.exists():
        logger.warning(f"No prd.json found at {prd_file}")
        return None

    try:
        with open(prd_file) as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load prd.json: {e}")
        return None


def _load_architecture(output_dir: Path) -> dict[str, Any] | None:
    """Load Architecture from output directory.

    Args:
        output_dir: Directory containing architecture.json

    Returns:
        Dictionary of Architecture data, or None if not found
    """
    arch_file = output_dir / "architecture.json"
    if not arch_file.exists():
        logger.warning(f"No architecture.json found at {arch_file}")
        return None

    try:
        with open(arch_file) as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load architecture.json: {e}")
        return None


def _generate_stories_from_requirement(
    req: dict[str, Any],
    epic_id: str,
    story_counter: int,
) -> list[Story]:
    """Generate stories from a functional requirement.

    Args:
        req: Requirement dictionary from PRD
        epic_id: Parent epic ID
        story_counter: Starting story counter

    Returns:
        List of generated stories
    """
    stories = []

    # Map requirement priority to story priority
    priority_map = {
        "must": "critical",
        "should": "high",
        "could": "medium",
        "won't": "low",
    }
    priority = priority_map.get(req.get("priority", "should"), "medium")

    # Create main implementation story
    story_id = f"S-{story_counter:03d}"
    acceptance_criteria = []

    for i, ac in enumerate(req.get("acceptance_criteria", []), 1):
        acceptance_criteria.append(
            AcceptanceCriterion(
                id=f"AC-{story_counter:03d}-{i:02d}",
                description=ac,
                verified=False,
            )
        )

    story = Story(
        id=story_id,
        title=f"Implement {req.get('title', 'requirement')}",
        description=f"As a developer, I need to implement {req.get('title', 'the requirement')} "
                   f"so that {req.get('description', 'the feature is available')}.",
        epic_id=epic_id,
        story_points=_estimate_story_points(req),
        priority=priority,
        status="backlog",
        acceptance_criteria=acceptance_criteria,
        dependencies=[],
        technical_notes="",
    )
    stories.append(story)

    return stories


def _estimate_story_points(req: dict[str, Any]) -> int:
    """Estimate story points for a requirement.

    Uses simple heuristics based on acceptance criteria count
    and priority.

    Args:
        req: Requirement dictionary

    Returns:
        Estimated story points (1, 2, 3, 5, 8, or 13)
    """
    ac_count = len(req.get("acceptance_criteria", []))

    if ac_count <= 1:
        return 2
    elif ac_count <= 3:
        return 3
    elif ac_count <= 5:
        return 5
    elif ac_count <= 8:
        return 8
    else:
        return 13


def _generate_epics_from_inputs(
    project_name: str,
    prd: dict[str, Any] | None,
    architecture: dict[str, Any] | None,
) -> EpicsDocument:
    """Generate Epics document from PRD and Architecture.

    This function creates epics and stories based on available
    information from PRD requirements and architecture components.

    Args:
        project_name: Name of the project
        prd: PRD data (from create_prd)
        architecture: Architecture data (from create_architecture)

    Returns:
        EpicsDocument with generated content
    """
    now = datetime.now().isoformat()

    # Initialize metadata
    metadata = EpicsMetadata(
        version="1.0.0",
        status="draft",
        created_at=now,
        updated_at=now,
        author="auto-claude",
        sprint_length=14,
    )

    doc = EpicsDocument(
        project_name=project_name,
        metadata=metadata,
    )

    # Generate overview
    overview_parts = [
        f"This document outlines the epics and stories for {project_name}."
    ]

    functional_reqs = prd.get("functional_requirements", []) if prd else []
    if functional_reqs:
        overview_parts.append(
            f"The breakdown is based on {len(functional_reqs)} functional requirements "
            "from the PRD."
        )

    doc.overview = " ".join(overview_parts)

    # Generate epics from PRD requirements
    epics: list[Epic] = []
    story_counter = 1

    if prd and functional_reqs:
        # Group requirements by category or create epic per major requirement
        # For simplicity, create one epic for "Core Features" containing all stories

        # Create core features epic
        core_stories: list[Story] = []

        for req in functional_reqs:
            stories = _generate_stories_from_requirement(
                req=req,
                epic_id="E-001",
                story_counter=story_counter,
            )
            core_stories.extend(stories)
            story_counter += len(stories)

        if core_stories:
            core_epic = Epic(
                id="E-001",
                title="Core Features Implementation",
                description="Implementation of core functional requirements from the PRD. "
                           "These stories cover the primary feature set.",
                priority="high",
                status="draft",
                stories=core_stories,
                requirements=[req.get("id", "") for req in functional_reqs if req.get("id")],
                tags=["core", "mvp"],
            )
            epics.append(core_epic)

    # Generate architecture-based epic if architecture data available
    if architecture:
        components = architecture.get("components", [])
        if components:
            arch_stories: list[Story] = []

            for comp in components[:5]:  # Limit to 5 components
                story_id = f"S-{story_counter:03d}"
                comp_name = comp.get("name", "Component")

                story = Story(
                    id=story_id,
                    title=f"Set up {comp_name}",
                    description=f"As a developer, I need to set up the {comp_name} component "
                               f"({comp.get('type', 'module')}) so that it can be integrated "
                               "into the system architecture.",
                    epic_id="E-002",
                    story_points=3,
                    priority="high",
                    status="backlog",
                    acceptance_criteria=[
                        AcceptanceCriterion(
                            id=f"AC-{story_counter:03d}-01",
                            description=f"{comp_name} module is created and configured",
                            verified=False,
                        ),
                        AcceptanceCriterion(
                            id=f"AC-{story_counter:03d}-02",
                            description="Unit tests are written for the component",
                            verified=False,
                        ),
                    ],
                    dependencies=[],
                    technical_notes=comp.get("description", ""),
                )
                arch_stories.append(story)
                story_counter += 1

            if arch_stories:
                arch_epic = Epic(
                    id="E-002",
                    title="Architecture Setup",
                    description="Setup and configuration of architectural components. "
                               "These stories establish the foundational structure.",
                    priority="critical",
                    status="draft",
                    stories=arch_stories,
                    requirements=[],
                    tags=["architecture", "infrastructure"],
                )
                epics.append(arch_epic)

    # If no requirements or architecture, create placeholder epic
    if not epics:
        placeholder_story = Story(
            id="S-001",
            title="Initial Project Setup",
            description="As a developer, I need to set up the initial project structure "
                       "so that development can begin.",
            epic_id="E-001",
            story_points=3,
            priority="high",
            status="backlog",
            acceptance_criteria=[
                AcceptanceCriterion(
                    id="AC-001-01",
                    description="Project structure is created",
                    verified=False,
                ),
                AcceptanceCriterion(
                    id="AC-001-02",
                    description="Development environment is configured",
                    verified=False,
                ),
            ],
            dependencies=[],
            technical_notes="",
        )

        placeholder_epic = Epic(
            id="E-001",
            title="Project Initialization",
            description="Initial project setup and configuration.",
            priority="high",
            status="draft",
            stories=[placeholder_story],
            requirements=[],
            tags=["setup"],
        )
        epics.append(placeholder_epic)

    doc.epics = epics
    return doc


def _write_individual_stories(
    epics_doc: EpicsDocument,
    stories_dir: Path,
) -> list[str]:
    """Write individual story files to stories directory.

    Args:
        epics_doc: EpicsDocument containing all stories
        stories_dir: Directory to write story files

    Returns:
        List of created story file paths
    """
    stories_dir.mkdir(parents=True, exist_ok=True)
    created_files: list[str] = []

    for epic in epics_doc.epics:
        for story in epic.stories:
            story_file = stories_dir / f"{story.id.lower()}.md"
            try:
                with open(story_file, "w") as f:
                    f.write(story.to_markdown())
                created_files.append(str(story_file))
                logger.debug(f"Story written to {story_file}")
            except Exception as e:
                logger.error(f"Failed to write story {story.id}: {e}")

    return created_files


def create_epics(
    output_dir: Path,
    progress_callback: callable | None = None,
) -> EpicsDocument:
    """Create an Epics and Stories Document.

    This is the main entry point for the BMAD Epics phase.
    It loads PRD and Architecture, generates epics and stories,
    and writes them to epics.md and stories/*.md.

    Args:
        output_dir: Directory to write epics.md (BMAD output directory)
        progress_callback: Optional callback for progress reporting

    Returns:
        EpicsDocument containing the generated epics and stories

    Example:
        >>> epics = create_epics(Path(".auto-claude/specs/001/bmad"))
        >>> print(len(epics.epics))
        2

    Story Reference: Story 6.5 - Implement BMAD Epic and Story Creation
    """
    if progress_callback:
        progress_callback("Starting epic and story creation...", 0.0)

    # Load PRD
    if progress_callback:
        progress_callback("Loading PRD...", 10.0)

    prd = _load_prd(output_dir)
    if prd is None:
        logger.warning("No PRD found - Epics will have limited context")

    # Load Architecture
    if progress_callback:
        progress_callback("Loading architecture...", 25.0)

    architecture = _load_architecture(output_dir)
    if architecture is None:
        logger.warning("No architecture found - Epics will have limited context")

    # Get project name from PRD or architecture
    project_name = "Project"
    if prd:
        project_name = prd.get("project_name", "Project")
    elif architecture:
        project_name = architecture.get("project_name", "Project")

    # Generate Epics
    if progress_callback:
        progress_callback("Generating epics and stories...", 50.0)

    epics_doc = _generate_epics_from_inputs(
        project_name=project_name,
        prd=prd,
        architecture=architecture,
    )

    # Write Epics to files
    if progress_callback:
        progress_callback("Writing epics artifact...", 70.0)

    output_dir.mkdir(parents=True, exist_ok=True)
    epics_file = output_dir / "epics.md"
    epics_json_file = output_dir / "epics.json"

    try:
        # Write markdown version
        with open(epics_file, "w") as f:
            f.write(epics_doc.to_markdown())
        logger.info(f"Epics written to {epics_file}")

        # Write JSON version for programmatic access
        with open(epics_json_file, "w") as f:
            json.dump(epics_doc.to_dict(), f, indent=2)
        logger.info(f"Epics JSON written to {epics_json_file}")

    except Exception as e:
        logger.error(f"Failed to write epics files: {e}")
        raise

    # Write individual story files
    if progress_callback:
        progress_callback("Writing individual story files...", 85.0)

    stories_dir = output_dir / "stories"
    story_files = _write_individual_stories(epics_doc, stories_dir)
    logger.info(f"Created {len(story_files)} story files in {stories_dir}")

    if progress_callback:
        progress_callback("Epic and story creation complete", 100.0)

    return epics_doc


def load_epics(output_dir: Path) -> EpicsDocument | None:
    """Load existing Epics from output directory.

    Args:
        output_dir: Directory containing epics.json

    Returns:
        EpicsDocument if file exists, None otherwise
    """
    epics_file = output_dir / "epics.json"
    if not epics_file.exists():
        return None

    try:
        with open(epics_file) as f:
            data = json.load(f)

        # Reconstruct dataclasses from dict
        metadata = EpicsMetadata(**data.get("metadata", {}))

        # Reconstruct epics with stories
        epics = []
        for epic_data in data.get("epics", []):
            stories = []
            for story_data in epic_data.get("stories", []):
                # Reconstruct acceptance criteria
                acceptance_criteria = []
                for ac_data in story_data.get("acceptance_criteria", []):
                    acceptance_criteria.append(AcceptanceCriterion(**ac_data))

                story = Story(
                    id=story_data.get("id", ""),
                    title=story_data.get("title", ""),
                    description=story_data.get("description", ""),
                    epic_id=story_data.get("epic_id", ""),
                    story_points=story_data.get("story_points", 3),
                    priority=story_data.get("priority", "medium"),
                    status=story_data.get("status", "backlog"),
                    acceptance_criteria=acceptance_criteria,
                    dependencies=story_data.get("dependencies", []),
                    technical_notes=story_data.get("technical_notes", ""),
                    assigned_to=story_data.get("assigned_to", ""),
                )
                stories.append(story)

            epic = Epic(
                id=epic_data.get("id", ""),
                title=epic_data.get("title", ""),
                description=epic_data.get("description", ""),
                priority=epic_data.get("priority", "medium"),
                status=epic_data.get("status", "draft"),
                stories=stories,
                requirements=epic_data.get("requirements", []),
                tags=epic_data.get("tags", []),
            )
            epics.append(epic)

        return EpicsDocument(
            project_name=data.get("project_name", ""),
            overview=data.get("overview", ""),
            epics=epics,
            metadata=metadata,
        )
    except Exception as e:
        logger.error(f"Failed to load epics: {e}")
        return None


def prepare_stories(
    output_dir: Path,
    progress_callback: callable | None = None,
) -> list[Story]:
    """Prepare stories for development by loading and validating them.

    This function loads existing epics and prepares stories for
    the development phase.

    Args:
        output_dir: Directory containing epics.json
        progress_callback: Optional callback for progress reporting

    Returns:
        List of stories ready for development

    Story Reference: Story 6.5 - Implement BMAD Epic and Story Creation
    """
    if progress_callback:
        progress_callback("Loading epics for story preparation...", 10.0)

    epics_doc = load_epics(output_dir)
    if epics_doc is None:
        logger.warning("No epics found - cannot prepare stories")
        return []

    if progress_callback:
        progress_callback("Collecting stories from epics...", 50.0)

    all_stories = epics_doc.get_all_stories()

    # Filter to backlog/ready stories
    ready_stories = [
        s for s in all_stories
        if s.status in ("backlog", "ready")
    ]

    if progress_callback:
        progress_callback(
            f"Found {len(ready_stories)} stories ready for development",
            100.0
        )

    return ready_stories
