"""BMAD Architecture workflow.

This module implements the architecture design phase for the BMAD methodology.
It generates a comprehensive Architecture Document based on project analysis
and PRD requirements.

Story Reference: Story 6.4 - Implement BMAD Architecture Workflow Integration
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
class ArchitectureComponent:
    """A component in the architecture.

    Attributes:
        id: Unique identifier for the component
        name: Display name of the component
        description: Description of the component's purpose
        type: Type of component (service, module, database, api, ui, etc.)
        technologies: List of technologies used by this component
        dependencies: List of component IDs this component depends on
        interfaces: List of interfaces provided by this component
    """

    id: str = ""
    name: str = ""
    description: str = ""
    type: str = ""  # service, module, database, api, ui, external
    technologies: list[str] = field(default_factory=list)
    dependencies: list[str] = field(default_factory=list)
    interfaces: list[str] = field(default_factory=list)


@dataclass
class ArchitectureLayer:
    """A layer in the architecture.

    Attributes:
        id: Unique identifier for the layer
        name: Display name of the layer
        description: Description of the layer's purpose
        components: List of component IDs in this layer
        order: Order of the layer (lower = closer to user)
    """

    id: str = ""
    name: str = ""
    description: str = ""
    components: list[str] = field(default_factory=list)
    order: int = 0


@dataclass
class ArchitectureDecision:
    """An architecture decision record (ADR).

    Attributes:
        id: Decision identifier (e.g., ADR-001)
        title: Short title of the decision
        status: Status of the decision (proposed, accepted, deprecated, superseded)
        context: Context and problem statement
        decision: The decision made
        consequences: Consequences of the decision
        alternatives: Alternatives considered
    """

    id: str = ""
    title: str = ""
    status: str = "accepted"  # proposed, accepted, deprecated, superseded
    context: str = ""
    decision: str = ""
    consequences: list[str] = field(default_factory=list)
    alternatives: list[str] = field(default_factory=list)


@dataclass
class DataModel:
    """A data model entity.

    Attributes:
        name: Name of the entity
        description: Description of the entity
        fields: Dictionary of field name to field type/description
        relationships: List of relationships to other entities
    """

    name: str = ""
    description: str = ""
    fields: dict[str, str] = field(default_factory=dict)
    relationships: list[str] = field(default_factory=list)


@dataclass
class ArchitectureMetadata:
    """Metadata about the Architecture document.

    Attributes:
        version: Architecture document version
        status: Current status (draft, review, approved)
        created_at: Timestamp when document was created
        updated_at: Timestamp when document was last updated
        author: Author of the document
    """

    version: str = "1.0.0"
    status: str = "draft"  # draft, review, approved
    created_at: str = ""
    updated_at: str = ""
    author: str = "auto-claude"


@dataclass
class ArchitectureDocument:
    """Complete Architecture Document.

    This is the main output of the create_architecture function and is
    serialized to architecture.md artifact.

    Attributes:
        project_name: Name of the project
        overview: High-level architecture overview
        principles: Guiding architecture principles
        layers: Architecture layers
        components: Architecture components
        data_models: Data model entities
        decisions: Architecture decision records
        security_considerations: Security-related considerations
        scalability_considerations: Scalability-related considerations
        deployment_strategy: Deployment approach
        metadata: Document metadata
    """

    project_name: str = ""
    overview: str = ""
    principles: list[str] = field(default_factory=list)
    layers: list[ArchitectureLayer] = field(default_factory=list)
    components: list[ArchitectureComponent] = field(default_factory=list)
    data_models: list[DataModel] = field(default_factory=list)
    decisions: list[ArchitectureDecision] = field(default_factory=list)
    security_considerations: list[str] = field(default_factory=list)
    scalability_considerations: list[str] = field(default_factory=list)
    deployment_strategy: str = ""
    metadata: ArchitectureMetadata = field(default_factory=ArchitectureMetadata)

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)

    def to_markdown(self) -> str:
        """Convert Architecture to Markdown format.

        Returns:
            Markdown-formatted Architecture document
        """
        lines: list[str] = []

        # Header
        lines.append(f"# Architecture Document: {self.project_name}")
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
        lines.append("2. [Architecture Principles](#architecture-principles)")
        lines.append("3. [System Layers](#system-layers)")
        lines.append("4. [Components](#components)")
        lines.append("5. [Data Models](#data-models)")
        lines.append("6. [Architecture Decisions](#architecture-decisions)")
        lines.append("7. [Security Considerations](#security-considerations)")
        lines.append("8. [Scalability Considerations](#scalability-considerations)")
        lines.append("9. [Deployment Strategy](#deployment-strategy)")
        lines.append("")

        # Overview
        lines.append("## Overview")
        lines.append("")
        lines.append(self.overview or "_No overview provided_")
        lines.append("")

        # Architecture Principles
        lines.append("## Architecture Principles")
        lines.append("")
        if self.principles:
            for i, principle in enumerate(self.principles, 1):
                lines.append(f"{i}. {principle}")
        else:
            lines.append("_No architecture principles defined_")
        lines.append("")

        # System Layers
        lines.append("## System Layers")
        lines.append("")
        if self.layers:
            # Sort by order
            sorted_layers = sorted(self.layers, key=lambda x: x.order)
            for layer in sorted_layers:
                lines.append(f"### {layer.name}")
                lines.append("")
                lines.append(layer.description or "_No description_")
                lines.append("")
                if layer.components:
                    lines.append("**Components:**")
                    for comp_id in layer.components:
                        lines.append(f"- {comp_id}")
                    lines.append("")
        else:
            lines.append("_No layers defined_")
            lines.append("")

        # Components
        lines.append("## Components")
        lines.append("")
        if self.components:
            for comp in self.components:
                lines.append(f"### {comp.id}: {comp.name}")
                lines.append("")
                lines.append(f"**Type:** {comp.type}")
                lines.append("")
                lines.append(comp.description or "_No description_")
                lines.append("")
                if comp.technologies:
                    lines.append(f"**Technologies:** {', '.join(comp.technologies)}")
                    lines.append("")
                if comp.dependencies:
                    lines.append("**Dependencies:**")
                    for dep in comp.dependencies:
                        lines.append(f"- {dep}")
                    lines.append("")
                if comp.interfaces:
                    lines.append("**Interfaces:**")
                    for iface in comp.interfaces:
                        lines.append(f"- {iface}")
                    lines.append("")
        else:
            lines.append("_No components defined_")
            lines.append("")

        # Data Models
        lines.append("## Data Models")
        lines.append("")
        if self.data_models:
            for model in self.data_models:
                lines.append(f"### {model.name}")
                lines.append("")
                lines.append(model.description or "_No description_")
                lines.append("")
                if model.fields:
                    lines.append("**Fields:**")
                    lines.append("")
                    lines.append("| Field | Type/Description |")
                    lines.append("|-------|------------------|")
                    for field_name, field_desc in model.fields.items():
                        lines.append(f"| {field_name} | {field_desc} |")
                    lines.append("")
                if model.relationships:
                    lines.append("**Relationships:**")
                    for rel in model.relationships:
                        lines.append(f"- {rel}")
                    lines.append("")
        else:
            lines.append("_No data models defined_")
            lines.append("")

        # Architecture Decisions
        lines.append("## Architecture Decisions")
        lines.append("")
        if self.decisions:
            for decision in self.decisions:
                lines.append(f"### {decision.id}: {decision.title}")
                lines.append("")
                lines.append(f"**Status:** {decision.status}")
                lines.append("")
                lines.append("**Context:**")
                lines.append("")
                lines.append(decision.context or "_No context_")
                lines.append("")
                lines.append("**Decision:**")
                lines.append("")
                lines.append(decision.decision or "_No decision_")
                lines.append("")
                if decision.consequences:
                    lines.append("**Consequences:**")
                    for consequence in decision.consequences:
                        lines.append(f"- {consequence}")
                    lines.append("")
                if decision.alternatives:
                    lines.append("**Alternatives Considered:**")
                    for alt in decision.alternatives:
                        lines.append(f"- {alt}")
                    lines.append("")
        else:
            lines.append("_No architecture decisions recorded_")
            lines.append("")

        # Security Considerations
        lines.append("## Security Considerations")
        lines.append("")
        if self.security_considerations:
            for consideration in self.security_considerations:
                lines.append(f"- {consideration}")
        else:
            lines.append("_No security considerations defined_")
        lines.append("")

        # Scalability Considerations
        lines.append("## Scalability Considerations")
        lines.append("")
        if self.scalability_considerations:
            for consideration in self.scalability_considerations:
                lines.append(f"- {consideration}")
        else:
            lines.append("_No scalability considerations defined_")
        lines.append("")

        # Deployment Strategy
        lines.append("## Deployment Strategy")
        lines.append("")
        lines.append(self.deployment_strategy or "_No deployment strategy defined_")
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


def _generate_architecture_from_inputs(
    project_name: str,
    analysis: dict[str, Any] | None,
    prd: dict[str, Any] | None,
) -> ArchitectureDocument:
    """Generate Architecture document from project analysis and PRD.

    This function creates an Architecture document based on available
    information from project analysis and PRD requirements.

    Args:
        project_name: Name of the project
        analysis: Project analysis data (from analyze_project)
        prd: PRD data (from create_prd)

    Returns:
        ArchitectureDocument with generated content
    """
    now = datetime.now().isoformat()

    # Initialize metadata
    metadata = ArchitectureMetadata(
        version="1.0.0",
        status="draft",
        created_at=now,
        updated_at=now,
        author="auto-claude",
    )

    arch = ArchitectureDocument(
        project_name=project_name,
        metadata=metadata,
    )

    # Extract tech stack info from analysis
    tech_stack = analysis.get("tech_stack", {}) if analysis else {}
    structure = analysis.get("structure", {}) if analysis else {}

    # Generate overview from analysis and PRD
    languages = tech_stack.get("languages", [])
    frameworks = tech_stack.get("frameworks", [])
    is_monorepo = structure.get("is_monorepo", False)

    overview_parts = [f"This document describes the architecture for {project_name}."]

    if languages:
        overview_parts.append(
            f"The system is primarily built using {', '.join(languages)}."
        )
    if frameworks:
        overview_parts.append(f"Key frameworks include {', '.join(frameworks)}.")
    if is_monorepo:
        services = structure.get("services", [])
        overview_parts.append(
            f"The project follows a monorepo structure with {len(services)} services."
        )

    arch.overview = " ".join(overview_parts)

    # Generate architecture principles based on detected patterns
    principles = [
        "Separation of concerns - each component has a single, well-defined responsibility",
        "Loose coupling - components interact through well-defined interfaces",
        "High cohesion - related functionality is grouped together",
    ]

    if "typescript" in languages or "javascript" in languages:
        principles.append("Type safety - use TypeScript for compile-time type checking")
    if "react" in frameworks or "vue" in frameworks or "angular" in frameworks:
        principles.append(
            "Component-based UI - build user interfaces from reusable components"
        )
    if any(f in frameworks for f in ["fastapi", "express", "django", "flask"]):
        principles.append("API-first design - backend exposes well-documented APIs")

    arch.principles = principles

    # Generate layers based on project structure
    layers: list[ArchitectureLayer] = []
    components: list[ArchitectureComponent] = []

    # Detect frontend
    has_frontend = any(f in frameworks for f in ["react", "vue", "angular", "nextjs"])
    if has_frontend:
        layers.append(
            ArchitectureLayer(
                id="presentation",
                name="Presentation Layer",
                description="User interface components and client-side logic",
                components=["ui-app"],
                order=1,
            )
        )
        frontend_tech = [
            f for f in frameworks if f in ["react", "vue", "angular", "nextjs"]
        ]
        components.append(
            ArchitectureComponent(
                id="ui-app",
                name="UI Application",
                description="Client-side application handling user interactions",
                type="ui",
                technologies=frontend_tech
                + [l for l in languages if l in ["typescript", "javascript"]],
                dependencies=["api-gateway"],
                interfaces=["Web Interface"],
            )
        )

    # Detect API layer
    has_api = any(f in frameworks for f in ["fastapi", "express", "django", "flask"])
    if has_api:
        layers.append(
            ArchitectureLayer(
                id="api",
                name="API Layer",
                description="REST/GraphQL API endpoints and request handling",
                components=["api-gateway"],
                order=2,
            )
        )
        api_tech = [
            f for f in frameworks if f in ["fastapi", "express", "django", "flask"]
        ]
        components.append(
            ArchitectureComponent(
                id="api-gateway",
                name="API Gateway",
                description="Central API endpoint handling authentication and routing",
                type="api",
                technologies=api_tech
                + [l for l in languages if l in ["python", "javascript", "typescript"]],
                dependencies=["business-logic"],
                interfaces=["REST API", "WebSocket (if applicable)"],
            )
        )

    # Add business logic layer
    layers.append(
        ArchitectureLayer(
            id="business",
            name="Business Logic Layer",
            description="Core business logic and domain models",
            components=["business-logic"],
            order=3,
        )
    )
    components.append(
        ArchitectureComponent(
            id="business-logic",
            name="Business Logic",
            description="Core domain logic implementing business rules",
            type="module",
            technologies=languages[:2] if languages else ["python"],
            dependencies=["data-access"],
            interfaces=["Service API"],
        )
    )

    # Add data layer
    layers.append(
        ArchitectureLayer(
            id="data",
            name="Data Layer",
            description="Data persistence and external service integrations",
            components=["data-access"],
            order=4,
        )
    )
    components.append(
        ArchitectureComponent(
            id="data-access",
            name="Data Access",
            description="Data persistence layer handling database operations",
            type="database",
            technologies=["PostgreSQL", "Redis"],  # Default assumptions
            dependencies=[],
            interfaces=["Repository Pattern"],
        )
    )

    # Add monorepo services if detected
    if is_monorepo:
        services = structure.get("services", [])
        for service in services[:5]:  # Limit to 5 services
            service_id = service.replace("/", "-")
            components.append(
                ArchitectureComponent(
                    id=service_id,
                    name=service.split("/")[-1].title(),
                    description=f"Service: {service}",
                    type="service",
                    technologies=languages[:1] if languages else [],
                    dependencies=[],
                    interfaces=[],
                )
            )

    arch.layers = layers
    arch.components = components

    # Generate architecture decisions based on detected tech
    decisions: list[ArchitectureDecision] = []

    if languages:
        decisions.append(
            ArchitectureDecision(
                id="ADR-001",
                title=f"Use {languages[0].title()} as Primary Language",
                status="accepted",
                context=f"The project requires a primary programming language for implementation.",
                decision=f"We will use {languages[0].title()} as the primary language based on project requirements and team expertise.",
                consequences=[
                    f"Development will primarily use {languages[0].title()} ecosystem",
                    f"Team must be proficient in {languages[0].title()}",
                ],
                alternatives=[
                    lang.title() for lang in languages[1:3]
                ]
                if len(languages) > 1
                else ["Other languages considered but not selected"],
            )
        )

    if frameworks:
        decisions.append(
            ArchitectureDecision(
                id="ADR-002",
                title=f"Use {frameworks[0].title()} Framework",
                status="accepted",
                context="A framework is needed to accelerate development and provide structure.",
                decision=f"We will use {frameworks[0].title()} based on project requirements and ecosystem support.",
                consequences=[
                    f"Architecture follows {frameworks[0].title()} conventions",
                    f"Dependencies tied to {frameworks[0].title()} ecosystem",
                ],
                alternatives=[
                    fw.title() for fw in frameworks[1:3]
                ]
                if len(frameworks) > 1
                else ["Other frameworks considered"],
            )
        )

    arch.decisions = decisions

    # Generate security considerations
    security = [
        "Authentication and authorization for all protected endpoints",
        "Input validation and sanitization to prevent injection attacks",
        "Secure storage of sensitive data (encryption at rest)",
        "HTTPS for all network communications",
    ]
    if has_api:
        security.append("Rate limiting on API endpoints")
        security.append("API key or token-based authentication")
    arch.security_considerations = security

    # Generate scalability considerations
    scalability = [
        "Horizontal scaling capability for stateless components",
        "Database connection pooling",
        "Caching strategy for frequently accessed data",
    ]
    if is_monorepo:
        scalability.append("Independent deployment of monorepo services")
    arch.scalability_considerations = scalability

    # Generate deployment strategy
    deployment_parts = [
        f"The {project_name} application will be deployed using modern DevOps practices."
    ]
    deployment_parts.append(
        "Deployment environments include development, staging, and production."
    )
    deployment_parts.append(
        "CI/CD pipeline handles automated testing and deployment."
    )
    arch.deployment_strategy = " ".join(deployment_parts)

    # Add data models from PRD if available
    if prd:
        # Extract potential entities from functional requirements
        functional_reqs = prd.get("functional_requirements", [])
        if functional_reqs:
            # Create a generic data model based on project type
            arch.data_models.append(
                DataModel(
                    name="Entity",
                    description="Core domain entity (to be refined based on requirements)",
                    fields={
                        "id": "UUID - Primary identifier",
                        "created_at": "Timestamp - Creation time",
                        "updated_at": "Timestamp - Last update time",
                    },
                    relationships=[],
                )
            )

    return arch


def create_architecture(
    output_dir: Path,
    progress_callback: callable | None = None,
) -> ArchitectureDocument:
    """Create an Architecture Document.

    This is the main entry point for the BMAD Architecture phase.
    It loads project analysis and PRD, generates an architecture document,
    and writes it to architecture.md.

    Args:
        output_dir: Directory to write architecture.md (BMAD output directory)
        progress_callback: Optional callback for progress reporting

    Returns:
        ArchitectureDocument containing the generated architecture

    Example:
        >>> arch = create_architecture(Path(".auto-claude/specs/001/bmad"))
        >>> print(arch.project_name)
        'my-project'

    Story Reference: Story 6.4 - Implement BMAD Architecture Workflow Integration
    """
    if progress_callback:
        progress_callback("Starting architecture design...", 0.0)

    # Load project analysis
    if progress_callback:
        progress_callback("Loading project analysis...", 10.0)

    analysis = _load_project_analysis(output_dir)
    if analysis is None:
        logger.warning(
            "No project analysis found - Architecture will have limited context"
        )

    # Load PRD
    if progress_callback:
        progress_callback("Loading PRD...", 25.0)

    prd = _load_prd(output_dir)
    if prd is None:
        logger.warning("No PRD found - Architecture will have limited context")

    # Get project name from analysis or PRD
    project_name = "Project"
    if analysis:
        project_name = analysis.get("project_name", "Project")
    elif prd:
        project_name = prd.get("project_name", "Project")

    # Generate Architecture
    if progress_callback:
        progress_callback("Generating architecture document...", 50.0)

    arch = _generate_architecture_from_inputs(
        project_name=project_name,
        analysis=analysis,
        prd=prd,
    )

    # Write Architecture to files
    if progress_callback:
        progress_callback("Writing architecture artifact...", 80.0)

    output_dir.mkdir(parents=True, exist_ok=True)
    arch_file = output_dir / "architecture.md"
    arch_json_file = output_dir / "architecture.json"

    try:
        # Write markdown version
        with open(arch_file, "w") as f:
            f.write(arch.to_markdown())
        logger.info(f"Architecture written to {arch_file}")

        # Write JSON version for programmatic access
        with open(arch_json_file, "w") as f:
            json.dump(arch.to_dict(), f, indent=2)
        logger.info(f"Architecture JSON written to {arch_json_file}")

    except Exception as e:
        logger.error(f"Failed to write architecture files: {e}")
        raise

    if progress_callback:
        progress_callback("Architecture design complete", 100.0)

    return arch


def load_architecture(output_dir: Path) -> ArchitectureDocument | None:
    """Load existing Architecture from output directory.

    Args:
        output_dir: Directory containing architecture.json

    Returns:
        ArchitectureDocument if file exists, None otherwise
    """
    arch_file = output_dir / "architecture.json"
    if not arch_file.exists():
        return None

    try:
        with open(arch_file) as f:
            data = json.load(f)

        # Reconstruct dataclasses from dict
        metadata = ArchitectureMetadata(**data.get("metadata", {}))

        # Reconstruct layers
        layers = []
        for layer_data in data.get("layers", []):
            layers.append(ArchitectureLayer(**layer_data))

        # Reconstruct components
        components = []
        for comp_data in data.get("components", []):
            components.append(ArchitectureComponent(**comp_data))

        # Reconstruct data models
        data_models = []
        for model_data in data.get("data_models", []):
            data_models.append(DataModel(**model_data))

        # Reconstruct decisions
        decisions = []
        for decision_data in data.get("decisions", []):
            decisions.append(ArchitectureDecision(**decision_data))

        return ArchitectureDocument(
            project_name=data.get("project_name", ""),
            overview=data.get("overview", ""),
            principles=data.get("principles", []),
            layers=layers,
            components=components,
            data_models=data_models,
            decisions=decisions,
            security_considerations=data.get("security_considerations", []),
            scalability_considerations=data.get("scalability_considerations", []),
            deployment_strategy=data.get("deployment_strategy", ""),
            metadata=metadata,
        )
    except Exception as e:
        logger.error(f"Failed to load architecture: {e}")
        return None
