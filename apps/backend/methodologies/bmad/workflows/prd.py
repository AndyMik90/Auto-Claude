"""BMAD PRD (Product Requirements Document) workflow.

This module implements the PRD creation phase for the BMAD methodology.
It generates a comprehensive Product Requirements Document based on
project analysis and user requirements.

Story Reference: Story 6.3 - Implement BMAD PRD Workflow Integration
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
class Requirement:
    """A single requirement in the PRD.

    Attributes:
        id: Unique identifier for the requirement (e.g., FR-001, NFR-001)
        title: Short title for the requirement
        description: Detailed description of the requirement
        priority: Priority level (must, should, could, won't)
        category: Category of requirement (functional, non-functional, constraint)
        acceptance_criteria: List of criteria for verification
    """

    id: str = ""
    title: str = ""
    description: str = ""
    priority: str = "should"  # must, should, could, won't
    category: str = "functional"  # functional, non-functional, constraint
    acceptance_criteria: list[str] = field(default_factory=list)


@dataclass
class PRDMetadata:
    """Metadata about the PRD document.

    Attributes:
        version: PRD document version
        status: Current status (draft, review, approved)
        created_at: Timestamp when PRD was created
        updated_at: Timestamp when PRD was last updated
        author: Author of the PRD
    """

    version: str = "1.0.0"
    status: str = "draft"  # draft, review, approved
    created_at: str = ""
    updated_at: str = ""
    author: str = "auto-claude"


@dataclass
class PRDDocument:
    """Complete Product Requirements Document.

    This is the main output of the create_prd function and is
    serialized to prd.md artifact.

    Attributes:
        project_name: Name of the project
        project_description: High-level project description
        problem_statement: Description of the problem being solved
        goals: List of project goals
        non_goals: List of explicit non-goals
        functional_requirements: List of functional requirements
        non_functional_requirements: List of non-functional requirements
        constraints: List of project constraints
        assumptions: List of assumptions made
        dependencies: List of external dependencies
        metadata: PRD metadata
    """

    project_name: str = ""
    project_description: str = ""
    problem_statement: str = ""
    goals: list[str] = field(default_factory=list)
    non_goals: list[str] = field(default_factory=list)
    functional_requirements: list[Requirement] = field(default_factory=list)
    non_functional_requirements: list[Requirement] = field(default_factory=list)
    constraints: list[str] = field(default_factory=list)
    assumptions: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    metadata: PRDMetadata = field(default_factory=PRDMetadata)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    def to_markdown(self) -> str:
        """Convert PRD to Markdown format.

        Returns:
            Markdown-formatted PRD document
        """
        lines: list[str] = []

        # Header
        lines.append(f"# Product Requirements Document: {self.project_name}")
        lines.append("")
        lines.append(f"**Version:** {self.metadata.version}")
        lines.append(f"**Status:** {self.metadata.status}")
        lines.append(f"**Created:** {self.metadata.created_at}")
        lines.append(f"**Updated:** {self.metadata.updated_at}")
        lines.append(f"**Author:** {self.metadata.author}")
        lines.append("")

        # Table of Contents
        lines.append("## Table of Contents")
        lines.append("")
        lines.append("1. [Overview](#overview)")
        lines.append("2. [Problem Statement](#problem-statement)")
        lines.append("3. [Goals & Non-Goals](#goals--non-goals)")
        lines.append("4. [Functional Requirements](#functional-requirements)")
        lines.append("5. [Non-Functional Requirements](#non-functional-requirements)")
        lines.append("6. [Constraints](#constraints)")
        lines.append("7. [Assumptions](#assumptions)")
        lines.append("8. [Dependencies](#dependencies)")
        lines.append("")

        # Overview
        lines.append("## Overview")
        lines.append("")
        lines.append(self.project_description or "_No description provided_")
        lines.append("")

        # Problem Statement
        lines.append("## Problem Statement")
        lines.append("")
        lines.append(self.problem_statement or "_No problem statement defined_")
        lines.append("")

        # Goals & Non-Goals
        lines.append("## Goals & Non-Goals")
        lines.append("")
        lines.append("### Goals")
        lines.append("")
        if self.goals:
            for goal in self.goals:
                lines.append(f"- {goal}")
        else:
            lines.append("_No goals defined_")
        lines.append("")

        lines.append("### Non-Goals")
        lines.append("")
        if self.non_goals:
            for non_goal in self.non_goals:
                lines.append(f"- {non_goal}")
        else:
            lines.append("_No non-goals defined_")
        lines.append("")

        # Functional Requirements
        lines.append("## Functional Requirements")
        lines.append("")
        if self.functional_requirements:
            for req in self.functional_requirements:
                lines.append(f"### {req.id}: {req.title}")
                lines.append("")
                lines.append(f"**Priority:** {req.priority}")
                lines.append("")
                lines.append(req.description)
                lines.append("")
                if req.acceptance_criteria:
                    lines.append("**Acceptance Criteria:**")
                    lines.append("")
                    for criteria in req.acceptance_criteria:
                        lines.append(f"- [ ] {criteria}")
                    lines.append("")
        else:
            lines.append("_No functional requirements defined_")
            lines.append("")

        # Non-Functional Requirements
        lines.append("## Non-Functional Requirements")
        lines.append("")
        if self.non_functional_requirements:
            for req in self.non_functional_requirements:
                lines.append(f"### {req.id}: {req.title}")
                lines.append("")
                lines.append(f"**Priority:** {req.priority}")
                lines.append("")
                lines.append(req.description)
                lines.append("")
                if req.acceptance_criteria:
                    lines.append("**Acceptance Criteria:**")
                    lines.append("")
                    for criteria in req.acceptance_criteria:
                        lines.append(f"- [ ] {criteria}")
                    lines.append("")
        else:
            lines.append("_No non-functional requirements defined_")
            lines.append("")

        # Constraints
        lines.append("## Constraints")
        lines.append("")
        if self.constraints:
            for constraint in self.constraints:
                lines.append(f"- {constraint}")
        else:
            lines.append("_No constraints defined_")
        lines.append("")

        # Assumptions
        lines.append("## Assumptions")
        lines.append("")
        if self.assumptions:
            for assumption in self.assumptions:
                lines.append(f"- {assumption}")
        else:
            lines.append("_No assumptions defined_")
        lines.append("")

        # Dependencies
        lines.append("## Dependencies")
        lines.append("")
        if self.dependencies:
            for dep in self.dependencies:
                lines.append(f"- {dep}")
        else:
            lines.append("_No dependencies defined_")
        lines.append("")

        return "\n".join(lines)


def _load_project_analysis(output_dir: Path) -> dict[str, Any] | None:
    """Load project analysis from output directory.

    Args:
        output_dir: Directory containing analysis.json

    Returns:
        Dictionary of analysis data, or None if not found
    """
    analysis_file = output_dir / "analysis.json"
    if not analysis_file.exists():
        logger.warning(f"No analysis.json found at {analysis_file}")
        return None

    try:
        with open(analysis_file) as f:
            return json.load(f)
    except Exception as e:
        logger.error(f"Failed to load analysis.json: {e}")
        return None


def _load_requirements_from_spec(spec_dir: Path) -> dict[str, Any] | None:
    """Load requirements from spec directory.

    Looks for requirements.json or spec.md in the spec directory.

    Args:
        spec_dir: Path to the spec directory

    Returns:
        Dictionary of requirements data, or None if not found
    """
    # Try requirements.json first
    requirements_file = spec_dir / "requirements.json"
    if requirements_file.exists():
        try:
            with open(requirements_file) as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Failed to load requirements.json: {e}")

    return None


def _generate_prd_from_analysis(
    project_name: str,
    analysis: dict[str, Any] | None,
    requirements: dict[str, Any] | None,
    task_description: str = "",
) -> PRDDocument:
    """Generate PRD document from project analysis and requirements.

    This function creates a PRD based on available information from
    project analysis and explicit requirements.

    Args:
        project_name: Name of the project
        analysis: Project analysis data (from analyze_project)
        requirements: Requirements data (from spec directory)
        task_description: Optional task description

    Returns:
        PRDDocument with generated content
    """
    now = datetime.now().isoformat()

    # Initialize metadata
    metadata = PRDMetadata(
        version="1.0.0",
        status="draft",
        created_at=now,
        updated_at=now,
        author="auto-claude",
    )

    prd = PRDDocument(
        project_name=project_name,
        metadata=metadata,
    )

    # Extract tech stack info for context
    tech_stack = analysis.get("tech_stack", {}) if analysis else {}
    structure = analysis.get("structure", {}) if analysis else {}

    # Generate project description from analysis
    languages = tech_stack.get("languages", [])
    frameworks = tech_stack.get("frameworks", [])

    description_parts = [f"A {project_name} project"]
    if languages:
        description_parts.append(f"written in {', '.join(languages)}")
    if frameworks:
        description_parts.append(f"using {', '.join(frameworks)}")

    prd.project_description = " ".join(description_parts) + "."

    # Add problem statement from task description or requirements
    if requirements and "problem_statement" in requirements:
        prd.problem_statement = requirements["problem_statement"]
    elif task_description:
        prd.problem_statement = task_description
    else:
        prd.problem_statement = f"Define and implement requirements for {project_name}."

    # Extract goals from requirements if available
    if requirements:
        prd.goals = requirements.get("goals", [])
        prd.non_goals = requirements.get("non_goals", [])
        prd.constraints = requirements.get("constraints", [])
        prd.assumptions = requirements.get("assumptions", [])

        # Extract functional requirements
        for fr_data in requirements.get("functional_requirements", []):
            if isinstance(fr_data, dict):
                req = Requirement(
                    id=fr_data.get("id", ""),
                    title=fr_data.get("title", ""),
                    description=fr_data.get("description", ""),
                    priority=fr_data.get("priority", "should"),
                    category="functional",
                    acceptance_criteria=fr_data.get("acceptance_criteria", []),
                )
                prd.functional_requirements.append(req)

        # Extract non-functional requirements
        for nfr_data in requirements.get("non_functional_requirements", []):
            if isinstance(nfr_data, dict):
                req = Requirement(
                    id=nfr_data.get("id", ""),
                    title=nfr_data.get("title", ""),
                    description=nfr_data.get("description", ""),
                    priority=nfr_data.get("priority", "should"),
                    category="non-functional",
                    acceptance_criteria=nfr_data.get("acceptance_criteria", []),
                )
                prd.non_functional_requirements.append(req)

    # Add detected dependencies from analysis
    if analysis:
        package_managers = tech_stack.get("package_managers", [])
        testing_frameworks = tech_stack.get("testing_frameworks", [])

        for pm in package_managers:
            prd.dependencies.append(f"Package manager: {pm}")
        for tf in testing_frameworks:
            prd.dependencies.append(f"Testing framework: {tf}")

        # Add structure-based constraints
        if structure.get("is_monorepo"):
            prd.constraints.append("Project follows monorepo architecture")
            services = structure.get("services", [])
            if services:
                prd.constraints.append(
                    f"Monorepo services: {', '.join(services[:5])}"
                    + ("..." if len(services) > 5 else "")
                )

    return prd


def create_prd(
    output_dir: Path,
    spec_dir: Path | None = None,
    task_description: str = "",
    progress_callback: callable | None = None,
) -> PRDDocument:
    """Create a Product Requirements Document.

    This is the main entry point for the BMAD PRD phase.
    It loads project analysis, generates a PRD, and writes it to prd.md.

    Args:
        output_dir: Directory to write prd.md (BMAD output directory)
        spec_dir: Path to spec directory containing requirements.json
        task_description: Optional task description for context
        progress_callback: Optional callback for progress reporting

    Returns:
        PRDDocument containing the generated PRD

    Example:
        >>> prd = create_prd(Path(".auto-claude/specs/001/bmad"))
        >>> print(prd.project_name)
        'my-project'

    Story Reference: Story 6.3 - Implement BMAD PRD Workflow Integration
    """
    if progress_callback:
        progress_callback("Starting PRD creation...", 0.0)

    # Load project analysis
    if progress_callback:
        progress_callback("Loading project analysis...", 10.0)

    analysis = _load_project_analysis(output_dir)
    if analysis is None:
        logger.warning("No project analysis found - PRD will have limited context")

    # Get project name from analysis
    project_name = "Project"
    if analysis:
        project_name = analysis.get("project_name", "Project")

    # Load requirements from spec directory
    if progress_callback:
        progress_callback("Loading requirements...", 25.0)

    requirements = None
    if spec_dir and spec_dir.exists():
        requirements = _load_requirements_from_spec(spec_dir)

    # Generate PRD
    if progress_callback:
        progress_callback("Generating PRD document...", 50.0)

    prd = _generate_prd_from_analysis(
        project_name=project_name,
        analysis=analysis,
        requirements=requirements,
        task_description=task_description,
    )

    # Write PRD to markdown file
    if progress_callback:
        progress_callback("Writing PRD artifact...", 80.0)

    output_dir.mkdir(parents=True, exist_ok=True)
    prd_file = output_dir / "prd.md"
    prd_json_file = output_dir / "prd.json"

    try:
        # Write markdown version
        with open(prd_file, "w") as f:
            f.write(prd.to_markdown())
        logger.info(f"PRD written to {prd_file}")

        # Write JSON version for programmatic access
        with open(prd_json_file, "w") as f:
            json.dump(prd.to_dict(), f, indent=2)
        logger.info(f"PRD JSON written to {prd_json_file}")

    except Exception as e:
        logger.error(f"Failed to write PRD files: {e}")
        raise

    if progress_callback:
        progress_callback("PRD creation complete", 100.0)

    return prd


def load_prd(output_dir: Path) -> PRDDocument | None:
    """Load existing PRD from output directory.

    Args:
        output_dir: Directory containing prd.json

    Returns:
        PRDDocument if file exists, None otherwise
    """
    prd_file = output_dir / "prd.json"
    if not prd_file.exists():
        return None

    try:
        with open(prd_file) as f:
            data = json.load(f)

        # Reconstruct dataclasses from dict
        metadata = PRDMetadata(**data.get("metadata", {}))

        # Reconstruct requirements
        functional_reqs = []
        for req_data in data.get("functional_requirements", []):
            functional_reqs.append(Requirement(**req_data))

        non_functional_reqs = []
        for req_data in data.get("non_functional_requirements", []):
            non_functional_reqs.append(Requirement(**req_data))

        return PRDDocument(
            project_name=data.get("project_name", ""),
            project_description=data.get("project_description", ""),
            problem_statement=data.get("problem_statement", ""),
            goals=data.get("goals", []),
            non_goals=data.get("non_goals", []),
            functional_requirements=functional_reqs,
            non_functional_requirements=non_functional_reqs,
            constraints=data.get("constraints", []),
            assumptions=data.get("assumptions", []),
            dependencies=data.get("dependencies", []),
            metadata=metadata,
        )
    except Exception as e:
        logger.error(f"Failed to load PRD: {e}")
        return None
