"""BMAD Dev-Story workflow integration.

This module implements the development phase for the BMAD methodology.
It handles story implementation, status tracking, and progress reporting
for iterative development of features based on prepared stories.

Story Reference: Story 6.6 - Implement BMAD Dev-Story Workflow Integration
Architecture Source: architecture.md#BMAD-Plugin-Structure
"""

import json
import logging
from dataclasses import asdict, dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from apps.backend.methodologies.bmad.workflows.epics import (
    AcceptanceCriterion,
    Story,
    load_epics,
)

logger = logging.getLogger(__name__)


# Type alias for progress callback
ProgressCallback = Callable[[str, float], None]


@dataclass
class ImplementationTask:
    """A single implementation task within a story.

    Attributes:
        id: Unique identifier for the task
        description: Description of what to implement
        status: Current status (pending, in_progress, completed, blocked)
        file_path: Path to file being modified/created (if applicable)
        notes: Implementation notes or blockers
        completed_at: Timestamp when task was completed
    """

    id: str = ""
    description: str = ""
    status: str = "pending"  # pending, in_progress, completed, blocked
    file_path: str = ""
    notes: str = ""
    completed_at: str = ""


@dataclass
class ImplementationResult:
    """Result of implementing a story.

    Attributes:
        story_id: ID of the implemented story
        success: Whether implementation was successful
        status: Final story status (in_progress, done, blocked)
        tasks_completed: Number of tasks completed
        tasks_total: Total number of tasks
        files_modified: List of files modified during implementation
        files_created: List of files created during implementation
        error: Error message if implementation failed
        started_at: Timestamp when implementation started
        completed_at: Timestamp when implementation completed
        acceptance_criteria_met: Number of acceptance criteria verified
    """

    story_id: str = ""
    success: bool = False
    status: str = "in_progress"  # in_progress, done, blocked
    tasks_completed: int = 0
    tasks_total: int = 0
    files_modified: list[str] = field(default_factory=list)
    files_created: list[str] = field(default_factory=list)
    error: str = ""
    started_at: str = ""
    completed_at: str = ""
    acceptance_criteria_met: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


@dataclass
class SprintStatus:
    """Status of the current development sprint.

    Attributes:
        sprint_id: Sprint identifier (e.g., "Sprint-1")
        status: Current sprint status (active, completed, blocked)
        started_at: Timestamp when sprint started
        completed_at: Timestamp when sprint completed
        stories_total: Total number of stories in sprint
        stories_completed: Number of completed stories
        stories_in_progress: Number of stories in progress
        stories_blocked: Number of blocked stories
        story_statuses: Map of story ID to status
    """

    sprint_id: str = "Sprint-1"
    status: str = "active"  # active, completed, blocked
    started_at: str = ""
    completed_at: str = ""
    stories_total: int = 0
    stories_completed: int = 0
    stories_in_progress: int = 0
    stories_blocked: int = 0
    story_statuses: dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)


def _load_sprint_status(output_dir: Path) -> SprintStatus | None:
    """Load existing sprint status from output directory.

    Args:
        output_dir: Directory containing sprint-status.json

    Returns:
        SprintStatus if file exists, None otherwise
    """
    status_file = output_dir / "sprint-status.json"
    if not status_file.exists():
        return None

    try:
        with open(status_file) as f:
            data = json.load(f)
        return SprintStatus(**data)
    except Exception as e:
        logger.error(f"Failed to load sprint status: {e}")
        return None


def _save_sprint_status(sprint_status: SprintStatus, output_dir: Path) -> None:
    """Save sprint status to output directory.

    Args:
        sprint_status: SprintStatus to save
        output_dir: Directory to write sprint-status.json
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    status_file = output_dir / "sprint-status.json"

    try:
        with open(status_file, "w") as f:
            json.dump(sprint_status.to_dict(), f, indent=2)
        logger.debug(f"Sprint status saved to {status_file}")
    except Exception as e:
        logger.error(f"Failed to save sprint status: {e}")
        raise


def _generate_tasks_from_story(story: Story) -> list[ImplementationTask]:
    """Generate implementation tasks from a story's acceptance criteria.

    Args:
        story: Story to generate tasks from

    Returns:
        List of ImplementationTask objects
    """
    tasks: list[ImplementationTask] = []

    # Create a task for each acceptance criterion
    for i, ac in enumerate(story.acceptance_criteria, 1):
        task = ImplementationTask(
            id=f"{story.id}-T{i:02d}",
            description=f"Implement: {ac.description}",
            status="pending",
            file_path="",
            notes="",
            completed_at="",
        )
        tasks.append(task)

    # If no acceptance criteria, create a general implementation task
    if not tasks:
        tasks.append(
            ImplementationTask(
                id=f"{story.id}-T01",
                description=f"Implement {story.title}",
                status="pending",
                file_path="",
                notes="",
                completed_at="",
            )
        )

    return tasks


def _update_story_file(
    story: Story,
    output_dir: Path,
    status: str = "in_progress",
) -> None:
    """Update the individual story file with new status.

    Args:
        story: Story to update
        output_dir: BMAD output directory
        status: New status for the story
    """
    stories_dir = output_dir / "stories"
    story_file = stories_dir / f"{story.id.lower()}.md"

    if story_file.exists():
        # Update the status in the story object and rewrite
        story.status = status
        try:
            with open(story_file, "w") as f:
                f.write(story.to_markdown())
            logger.debug(f"Story file updated: {story_file}")
        except Exception as e:
            logger.warning(f"Failed to update story file {story_file}: {e}")


def _write_implementation_log(
    result: ImplementationResult,
    output_dir: Path,
) -> None:
    """Write implementation result to log file.

    Args:
        result: ImplementationResult to log
        output_dir: BMAD output directory
    """
    log_dir = output_dir / "dev-logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    log_file = log_dir / f"{result.story_id.lower()}-implementation.json"

    try:
        with open(log_file, "w") as f:
            json.dump(result.to_dict(), f, indent=2)
        logger.debug(f"Implementation log written to {log_file}")
    except Exception as e:
        logger.warning(f"Failed to write implementation log: {e}")


def implement_story(
    story_id: str,
    output_dir: Path,
    progress_callback: ProgressCallback | None = None,
) -> ImplementationResult:
    """Implement a single story from the backlog.

    This is the main entry point for implementing a story in the BMAD
    dev-story workflow. It loads the story from epics, generates
    implementation tasks, and tracks progress.

    Note: Actual code implementation is handled by the Claude Agent SDK
    through the BMADRunner. This function provides the orchestration
    and status tracking.

    Args:
        story_id: ID of the story to implement (e.g., "S-001")
        output_dir: BMAD output directory containing epics.json
        progress_callback: Optional callback for progress reporting

    Returns:
        ImplementationResult with status and artifacts

    Example:
        >>> result = implement_story("S-001", Path(".auto-claude/specs/001/bmad"))
        >>> print(result.success)
        True

    Story Reference: Story 6.6 - Implement BMAD Dev-Story Workflow Integration
    """
    now = datetime.now().isoformat()

    result = ImplementationResult(
        story_id=story_id,
        started_at=now,
    )

    if progress_callback:
        progress_callback(f"Starting implementation of {story_id}...", 0.0)

    # Load epics to find the story
    if progress_callback:
        progress_callback("Loading epics and stories...", 10.0)

    epics_doc = load_epics(output_dir)
    if epics_doc is None:
        result.error = "No epics found. Run epics phase first."
        result.success = False
        logger.error(result.error)
        return result

    # Find the requested story
    story = None
    for epic in epics_doc.epics:
        for s in epic.stories:
            if s.id == story_id:
                story = s
                break
        if story:
            break

    if story is None:
        result.error = f"Story {story_id} not found in epics"
        result.success = False
        logger.error(result.error)
        return result

    if progress_callback:
        progress_callback(f"Found story: {story.title}", 20.0)

    # Generate implementation tasks
    if progress_callback:
        progress_callback("Generating implementation tasks...", 30.0)

    tasks = _generate_tasks_from_story(story)
    result.tasks_total = len(tasks)

    # Update story status to in_progress
    story.status = "in_progress"
    _update_story_file(story, output_dir, "in_progress")

    # Update sprint status
    if progress_callback:
        progress_callback("Updating sprint status...", 40.0)

    sprint_status = _load_sprint_status(output_dir)
    if sprint_status is None:
        sprint_status = SprintStatus(
            sprint_id="Sprint-1",
            status="active",
            started_at=now,
        )

    sprint_status.story_statuses[story_id] = "in_progress"
    sprint_status.stories_in_progress = sum(
        1 for s in sprint_status.story_statuses.values() if s == "in_progress"
    )

    # Note: In the actual BMAD workflow, implementation would be delegated
    # to the Claude Agent SDK coder agent. This function provides the
    # orchestration framework. For now, we mark tasks as ready for
    # implementation.

    if progress_callback:
        progress_callback("Story prepared for implementation", 70.0)

    # Mark implementation as ready (actual implementation happens via agent)
    result.status = "in_progress"
    result.success = True

    # Save sprint status
    _save_sprint_status(sprint_status, output_dir)

    # Write implementation log
    if progress_callback:
        progress_callback("Writing implementation log...", 90.0)

    _write_implementation_log(result, output_dir)

    if progress_callback:
        progress_callback(
            f"Story {story_id} ready for implementation", 100.0
        )

    return result


def complete_story(
    story_id: str,
    output_dir: Path,
    files_modified: list[str] | None = None,
    files_created: list[str] | None = None,
    progress_callback: ProgressCallback | None = None,
) -> ImplementationResult:
    """Mark a story as completed after implementation.

    This function is called after the Claude Agent SDK has finished
    implementing the story. It updates status and records artifacts.

    Args:
        story_id: ID of the completed story
        output_dir: BMAD output directory
        files_modified: List of files modified during implementation
        files_created: List of files created during implementation
        progress_callback: Optional callback for progress reporting

    Returns:
        ImplementationResult with final status

    Story Reference: Story 6.6 - Implement BMAD Dev-Story Workflow Integration
    """
    now = datetime.now().isoformat()

    result = ImplementationResult(
        story_id=story_id,
        success=True,
        status="done",
        files_modified=files_modified or [],
        files_created=files_created or [],
        completed_at=now,
    )

    if progress_callback:
        progress_callback(f"Completing story {story_id}...", 20.0)

    # Load epics to update story status
    epics_doc = load_epics(output_dir)
    if epics_doc is None:
        result.error = "No epics found"
        result.success = False
        return result

    # Find and update the story
    for epic in epics_doc.epics:
        for story in epic.stories:
            if story.id == story_id:
                story.status = "done"
                # Mark all acceptance criteria as verified
                for ac in story.acceptance_criteria:
                    ac.verified = True
                result.acceptance_criteria_met = len(story.acceptance_criteria)
                _update_story_file(story, output_dir, "done")
                break

    if progress_callback:
        progress_callback("Updating sprint status...", 60.0)

    # Update sprint status
    sprint_status = _load_sprint_status(output_dir)
    if sprint_status:
        sprint_status.story_statuses[story_id] = "done"
        sprint_status.stories_completed = sum(
            1 for s in sprint_status.story_statuses.values() if s == "done"
        )
        sprint_status.stories_in_progress = sum(
            1 for s in sprint_status.story_statuses.values() if s == "in_progress"
        )
        _save_sprint_status(sprint_status, output_dir)

    if progress_callback:
        progress_callback("Writing completion log...", 80.0)

    # Write implementation log
    _write_implementation_log(result, output_dir)

    if progress_callback:
        progress_callback(f"Story {story_id} completed", 100.0)

    return result


def get_next_story(output_dir: Path) -> Story | None:
    """Get the next story to implement based on priority and dependencies.

    This function finds the highest priority story that is ready for
    development (backlog or ready status) and has no unmet dependencies.

    Args:
        output_dir: BMAD output directory containing epics.json

    Returns:
        Next Story to implement, or None if no stories are ready

    Story Reference: Story 6.6 - Implement BMAD Dev-Story Workflow Integration
    """
    epics_doc = load_epics(output_dir)
    if epics_doc is None:
        return None

    # Get all stories that are ready for implementation
    ready_stories: list[Story] = []
    completed_story_ids: set[str] = set()

    for epic in epics_doc.epics:
        for story in epic.stories:
            if story.status == "done":
                completed_story_ids.add(story.id)
            elif story.status in ("backlog", "ready"):
                ready_stories.append(story)

    # Filter by dependencies (all dependencies must be completed)
    available_stories = [
        s for s in ready_stories
        if all(dep in completed_story_ids for dep in s.dependencies)
    ]

    if not available_stories:
        return None

    # Sort by priority (critical > high > medium > low)
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    available_stories.sort(key=lambda s: priority_order.get(s.priority, 2))

    return available_stories[0]


def get_implementation_status(output_dir: Path) -> dict[str, Any]:
    """Get overall implementation status for the dev phase.

    Args:
        output_dir: BMAD output directory

    Returns:
        Dictionary with implementation statistics and status

    Story Reference: Story 6.6 - Implement BMAD Dev-Story Workflow Integration
    """
    epics_doc = load_epics(output_dir)
    sprint_status = _load_sprint_status(output_dir)

    status = {
        "has_epics": epics_doc is not None,
        "has_sprint": sprint_status is not None,
        "stories": {
            "total": 0,
            "backlog": 0,
            "ready": 0,
            "in_progress": 0,
            "done": 0,
            "blocked": 0,
        },
        "epics": {
            "total": 0,
            "in_progress": 0,
            "done": 0,
        },
        "next_story": None,
        "sprint_id": sprint_status.sprint_id if sprint_status else None,
    }

    if epics_doc:
        status["epics"]["total"] = len(epics_doc.epics)

        for epic in epics_doc.epics:
            epic_stories_done = True
            for story in epic.stories:
                status["stories"]["total"] += 1
                story_status = story.status.lower()
                if story_status in status["stories"]:
                    status["stories"][story_status] += 1
                if story.status != "done":
                    epic_stories_done = False

            if epic_stories_done and epic.stories:
                status["epics"]["done"] += 1
            elif any(s.status == "in_progress" for s in epic.stories):
                status["epics"]["in_progress"] += 1

        next_story = get_next_story(output_dir)
        if next_story:
            status["next_story"] = {
                "id": next_story.id,
                "title": next_story.title,
                "priority": next_story.priority,
                "story_points": next_story.story_points,
            }

    return status


def load_implementation_result(
    story_id: str,
    output_dir: Path,
) -> ImplementationResult | None:
    """Load a previous implementation result from log files.

    Args:
        story_id: Story ID to load result for
        output_dir: BMAD output directory

    Returns:
        ImplementationResult if found, None otherwise
    """
    log_file = output_dir / "dev-logs" / f"{story_id.lower()}-implementation.json"

    if not log_file.exists():
        return None

    try:
        with open(log_file) as f:
            data = json.load(f)
        return ImplementationResult(**data)
    except Exception as e:
        logger.error(f"Failed to load implementation result: {e}")
        return None
