"""
BMAD Phase Executor

Implements the BMAD track-based phase execution:
- Quick Flow: tech_spec → quick_dev → code_review (Barry agent)
- BMad Method: [document_project] → prd → architecture → epics → stories → dev → review
- Enterprise: Full BMad Method + security + devops documentation

Each phase invokes its agent file directly with a workflow command:
    @{agent}.md
    {workflow}

Documentation Architecture:
- Project-level docs (from document-project): stored at root project, synced to worktrees
- Task-level docs (PRD, architecture, epics): stored in spec folder (_bmad-output/)

This separation allows 100 tasks to run in parallel without conflicts.
"""

import logging
import shutil
import subprocess
from dataclasses import dataclass
from enum import Enum
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)

# Project-level documentation paths (stored at root, synced to worktrees)
PROJECT_LEVEL_DOC_PATHS = [
    "_bmad-output/project_knowledge",  # From document-project workflow
    "_bmad-output/project-scan-report.json",
    "_bmad-output/product-brief.md",  # From product-brief workflow
    "_bmad-output/research",  # Market/domain research
]


def get_root_project_dir(project_dir: Path) -> Path:
    """Get the root project directory, even if running in a worktree.

    When running in a Git worktree, the project_dir might be the worktree path.
    This function returns the original project root where project-level docs
    should be stored.

    Uses `git rev-parse --git-dir` to check if we're in a worktree (path contains
    `/worktrees/`), then finds the main project root.

    Args:
        project_dir: Current project directory (may be worktree or root)

    Returns:
        Root project directory path

    Example:
        >>> get_root_project_dir(Path("/project/.auto-claude/worktrees/tasks/001-glow"))
        Path("/project")
    """
    try:
        # Get the git directory for this repo
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode != 0:
            # Not a git repo, return as-is
            return project_dir

        git_dir = result.stdout.strip()
        git_dir_path = Path(git_dir)
        if not git_dir_path.is_absolute():
            git_dir_path = (project_dir / git_dir_path).resolve()

        # Check if this is a worktree by looking for /worktrees/ in the git-dir path
        # Worktrees have git dirs like: /project/.git/worktrees/my-worktree
        git_dir_str = str(git_dir_path)
        if "/worktrees/" in git_dir_str or "\\worktrees\\" in git_dir_str:
            # This is a worktree - find the main project root
            # The main .git is the parent of the "worktrees" directory
            # Path: /project/.git/worktrees/my-worktree -> /project/.git -> /project
            worktrees_idx = git_dir_str.rfind("/worktrees/")
            if worktrees_idx == -1:
                worktrees_idx = git_dir_str.rfind("\\worktrees\\")
            main_git_dir = git_dir_str[:worktrees_idx]
            root_project = Path(main_git_dir).parent
            return root_project

        # Not a worktree - we're in the main project or a subdirectory
        # Get the toplevel directory
        result = subprocess.run(
            ["git", "rev-parse", "--show-toplevel"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode == 0:
            return Path(result.stdout.strip())

        return project_dir

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        logger.debug(f"Could not determine root project directory: {e}")
        return project_dir


def is_worktree(project_dir: Path) -> bool:
    """Check if the project directory is a Git worktree.

    A worktree is detected by checking if the git-dir path contains "/worktrees/".
    This distinguishes actual worktrees from just being in a subdirectory of
    the main project.

    Args:
        project_dir: Directory to check

    Returns:
        True if this is a worktree, False if it's the main project or subdirectory
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--git-dir"],
            cwd=project_dir,
            capture_output=True,
            text=True,
            timeout=5,
        )

        if result.returncode != 0:
            return False

        git_dir = result.stdout.strip()
        git_dir_path = Path(git_dir)
        if not git_dir_path.is_absolute():
            git_dir_path = (project_dir / git_dir_path).resolve()

        # Check if this is a worktree by looking for /worktrees/ in the path
        # Worktrees have git dirs like: /project/.git/worktrees/my-worktree
        git_dir_str = str(git_dir_path)
        return "/worktrees/" in git_dir_str or "\\worktrees\\" in git_dir_str

    except (subprocess.TimeoutExpired, FileNotFoundError, OSError):
        return False


def sync_project_docs_to_worktree(
    root_project_dir: Path,
    worktree_dir: Path,
    force: bool = False,
) -> list[str]:
    """Sync project-level documentation from root project to a worktree.

    Project-level docs (from document-project, product-brief, research) are
    stored at the root project level and synced to each worktree so that
    task-specific agents can access them.

    Args:
        root_project_dir: Root project directory containing source docs
        worktree_dir: Worktree directory to sync docs to
        force: If True, overwrite existing docs in worktree

    Returns:
        List of paths that were synced

    Example:
        Syncs:
        - root/_bmad-output/project_knowledge/ → worktree/_bmad-output/project_knowledge/
        - root/_bmad-output/product-brief.md → worktree/_bmad-output/product-brief.md
    """
    if root_project_dir == worktree_dir:
        # Not a worktree, nothing to sync
        return []

    synced = []

    for rel_path in PROJECT_LEVEL_DOC_PATHS:
        source = root_project_dir / rel_path
        target = worktree_dir / rel_path

        if not source.exists():
            continue

        # Skip if target exists and force is False
        if target.exists() and not force:
            continue

        try:
            # Create parent directories
            target.parent.mkdir(parents=True, exist_ok=True)

            if source.is_dir():
                # Copy entire directory
                if target.exists():
                    shutil.rmtree(target)
                shutil.copytree(source, target)
                synced.append(rel_path)
                logger.debug(f"Synced directory {rel_path} to worktree")
            else:
                # Copy single file
                shutil.copy2(source, target)
                synced.append(rel_path)
                logger.debug(f"Synced file {rel_path} to worktree")

        except (OSError, shutil.Error) as e:
            logger.warning(f"Could not sync {rel_path} to worktree: {e}")

    if synced:
        logger.info(f"Synced {len(synced)} project doc(s) to worktree")

    return synced


class BMADTrack(Enum):
    """BMAD methodology tracks based on project complexity."""

    QUICK_FLOW = "quick_flow"  # Level 0-1: Bug fixes, simple features (1-15 stories)
    BMAD_METHOD = (
        "bmad_method"  # Level 2-3: Products, complex features (10-50+ stories)
    )
    ENTERPRISE = "enterprise"  # Level 4: Compliance, multi-tenant (30+ stories)


@dataclass
class PhaseConfig:
    """Configuration for a BMAD phase."""

    name: str
    agent: str  # e.g., "pm", "architect", "dev", "quick-flow-solo-dev"
    workflow: str  # e.g., "create-prd", "create-architecture"
    description: str  # Human-readable description


# Phase-to-agent mapping for all BMAD phases
PHASE_CONFIGS: dict[str, PhaseConfig] = {
    # Quick Flow phases (Barry - quick-flow-solo-dev agent)
    "tech_spec": PhaseConfig(
        name="tech_spec",
        agent="quick-flow-solo-dev",
        workflow="create-tech-spec",
        description="Technical specification with implementation-ready stories",
    ),
    "quick_dev": PhaseConfig(
        name="quick_dev",
        agent="quick-flow-solo-dev",
        workflow="quick-dev",
        description="Implement the tech spec end-to-end",
    ),
    # BMad Method phases
    "analyze": PhaseConfig(
        name="analyze",
        agent="analyst",
        workflow="document-project",
        description="Project documentation and analysis",
    ),
    "prd": PhaseConfig(
        name="prd",
        agent="pm",
        workflow="create-prd",
        description="Product Requirements Document creation",
    ),
    "architecture": PhaseConfig(
        name="architecture",
        agent="architect",
        workflow="create-architecture",
        description="System architecture design",
    ),
    "epics": PhaseConfig(
        name="epics",
        agent="pm",
        workflow="create-epics-and-stories",
        description="Epic and user story creation",
    ),
    "stories": PhaseConfig(
        name="stories",
        agent="sm",
        workflow="create-story",
        description="Individual story creation",
    ),
    "dev": PhaseConfig(
        name="dev",
        agent="dev",
        workflow="dev-story",
        description="Story implementation",
    ),
    "review": PhaseConfig(
        name="review",
        agent="dev",
        workflow="code-review",
        description="Code review",
    ),
    # Enterprise phases (additional security/devops)
    "security": PhaseConfig(
        name="security",
        agent="architect",
        workflow="security-review",
        description="Security documentation and review",
    ),
    "devops": PhaseConfig(
        name="devops",
        agent="architect",
        workflow="devops-setup",
        description="DevOps and deployment documentation",
    ),
}

# Track-based phase lists
# These define which phases run for each BMAD track
TRACK_PHASES: dict[BMADTrack, list[str]] = {
    # Quick Flow: Tech-spec only, no PRD/Architecture
    BMADTrack.QUICK_FLOW: [
        "tech_spec",
        "quick_dev",
        "review",
    ],
    # BMad Method: Full planning with PRD + Architecture
    # Note: "analyze" is prepended conditionally if project is undocumented
    BMADTrack.BMAD_METHOD: [
        "prd",
        "architecture",
        "epics",
        "stories",
        "dev",
        "review",
    ],
    # Enterprise: Full BMad Method + Security + DevOps
    BMADTrack.ENTERPRISE: [
        "prd",
        "architecture",
        "security",
        "devops",
        "epics",
        "stories",
        "dev",
        "review",
    ],
}

# Agent metadata for logging
AGENT_INFO: dict[str, tuple[str, str]] = {
    "analyst": ("📊", "Mary (Analyst)"),
    "pm": ("📋", "John (Product Manager)"),
    "architect": ("🏗️", "Winston (Architect)"),
    "dev": ("💻", "Amelia (Developer)"),
    "sm": ("📊", "Scrum Master"),
    "ux-designer": ("🎨", "UX Designer"),
    "tea": ("🧪", "Test Engineer"),
    "quick-flow-solo-dev": ("🚀", "Barry (Quick Flow)"),
}


def load_agent_file(agent_name: str, project_dir: Path) -> str:
    """Load the BMAD agent markdown file.

    Args:
        agent_name: Name of the agent (e.g., "pm", "architect")
        project_dir: Project directory containing _bmad folder

    Returns:
        Content of the agent file

    Raises:
        FileNotFoundError: If agent file doesn't exist
    """
    agent_path = project_dir / "_bmad" / "bmm" / "agents" / f"{agent_name}.md"
    if agent_path.exists():
        return agent_path.read_text(encoding="utf-8")
    raise FileNotFoundError(f"BMAD agent not found: {agent_path}")


def load_bmad_config(project_dir: Path) -> dict[str, Any]:
    """Load BMAD config.yaml.

    Args:
        project_dir: Project directory containing _bmad folder

    Returns:
        Config dictionary with user_name, output_folder, etc.
    """
    config_path = project_dir / "_bmad" / "bmm" / "config.yaml"
    if config_path.exists():
        content = config_path.read_text(encoding="utf-8")
        return yaml.safe_load(content) or {}
    return {}


def load_workflow_file(workflow_name: str, project_dir: Path) -> str | None:
    """Load the workflow markdown/yaml file if it exists.

    Searches in common locations for BMAD workflows.

    Args:
        workflow_name: Name of the workflow (e.g., "create-prd")
        project_dir: Project directory

    Returns:
        Content of workflow file, or None if not found
    """
    # Map workflow names to paths
    workflow_paths = {
        # Quick Flow workflows
        "create-tech-spec": "_bmad/bmm/workflows/bmad-quick-flow/create-tech-spec/workflow.md",
        "quick-dev": "_bmad/bmm/workflows/bmad-quick-flow/quick-dev/workflow.yaml",
        # BMad Method workflows
        "document-project": "_bmad/bmm/workflows/document-project/instructions.md",
        "create-prd": "_bmad/bmm/workflows/2-plan-workflows/prd/workflow.md",
        "create-architecture": "_bmad/bmm/workflows/3-solutioning/create-architecture/workflow.md",
        "create-epics-and-stories": "_bmad/bmm/workflows/3-solutioning/create-epics-and-stories/workflow.md",
        "create-story": "_bmad/bmm/workflows/4-implementation/create-story/workflow.md",
        "dev-story": "_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml",
        "code-review": "_bmad/bmm/workflows/4-implementation/code-review/instructions.md",
        # Enterprise workflows (security/devops - may need to be created)
        "security-review": "_bmad/bmm/workflows/enterprise/security-review/workflow.md",
        "devops-setup": "_bmad/bmm/workflows/enterprise/devops-setup/workflow.md",
    }

    rel_path = workflow_paths.get(workflow_name)
    if rel_path:
        workflow_path = project_dir / rel_path
        if workflow_path.exists():
            return workflow_path.read_text(encoding="utf-8")

    return None


def has_project_documentation(
    project_dir: Path,
    check_root: bool = True,
) -> bool:
    """Check if project already has BMAD documentation.

    Checks for existing documentation that would make the analyze phase
    (document-project workflow) unnecessary.

    IMPORTANT: This checks the ROOT project directory, not the worktree.
    Project-level documentation (from document-project workflow) is stored
    at the root project level and synced to worktrees.

    Args:
        project_dir: Current project directory (may be worktree or root)
        check_root: If True (default), check the root project directory.
                   Set to False to check the given directory directly.

    Returns:
        True if project documentation exists, False otherwise
    """
    # Get the root project directory for checking project-level docs
    if check_root:
        root_dir = get_root_project_dir(project_dir)
        logger.debug(
            f"Checking project docs at root: {root_dir} "
            f"(project_dir: {project_dir}, is_worktree: {project_dir != root_dir})"
        )
    else:
        root_dir = project_dir

    # Check for BMAD output documentation at ROOT project level
    bmad_output = root_dir / "_bmad-output"
    docs_dir = root_dir / "docs"

    # Look for key documentation files that indicate project has been documented
    # These are PROJECT-LEVEL docs (from document-project workflow)
    doc_indicators = [
        bmad_output / "project_knowledge" / "index.md",
        bmad_output / "project-scan-report.json",
        bmad_output / "product-brief.md",
        bmad_output / "index.md",
        docs_dir / "index.md",
        docs_dir / "project-scan-report.json",
    ]

    for indicator in doc_indicators:
        if indicator.exists():
            logger.debug(f"Found project documentation: {indicator}")
            return True

    logger.debug(f"No project documentation found at root: {root_dir}")
    return False


def get_phases_for_track(
    track: BMADTrack,
    project_dir: Path | None = None,
    force_analyze: bool = False,
    sync_docs: bool = True,
) -> list[str]:
    """Get the list of phases to execute for a BMAD track.

    For BMad Method and Enterprise tracks, prepends the analyze phase
    if the project doesn't have existing documentation.

    IMPORTANT: This checks the ROOT project directory for documentation,
    not the worktree. If running in a worktree and project docs exist
    at root, they will be synced to the worktree.

    Args:
        track: The BMAD track (QUICK_FLOW, BMAD_METHOD, ENTERPRISE)
        project_dir: Project directory (may be worktree or root)
        force_analyze: Force inclusion of analyze phase
        sync_docs: If True and running in worktree, sync project docs from root

    Returns:
        List of phase IDs to execute
    """
    phases = TRACK_PHASES[track].copy()

    # Quick Flow doesn't use analyze phase
    if track == BMADTrack.QUICK_FLOW:
        return phases

    # For BMad Method and Enterprise, check if analyze phase is needed
    # IMPORTANT: Check the ROOT project, not the worktree
    if project_dir:
        # Check documentation at ROOT project level
        root_dir = get_root_project_dir(project_dir)
        has_docs = has_project_documentation(project_dir, check_root=True)

        # If we're in a worktree and project docs exist, sync them
        if sync_docs and project_dir != root_dir and has_docs:
            synced = sync_project_docs_to_worktree(root_dir, project_dir)
            if synced:
                logger.info(f"Synced project docs from root to worktree: {synced}")

        needs_analyze = force_analyze or not has_docs
        if needs_analyze:
            phases.insert(0, "analyze")
            logger.debug(
                f"Adding analyze phase (force={force_analyze}, has_docs={has_docs})"
            )
        else:
            logger.debug(f"Skipping analyze phase - project docs exist at {root_dir}")

    return phases


def map_complexity_to_track(complexity: str) -> BMADTrack:
    """Map a complexity level string to a BMAD track.

    Args:
        complexity: Complexity string (quick, standard, complex, or track names)

    Returns:
        Corresponding BMADTrack enum value
    """
    complexity_lower = complexity.lower().strip()

    # Direct track names
    if complexity_lower in ("quick_flow", "quick-flow", "quickflow"):
        return BMADTrack.QUICK_FLOW
    if complexity_lower in ("bmad_method", "bmad-method", "bmadmethod", "method"):
        return BMADTrack.BMAD_METHOD
    if complexity_lower == "enterprise":
        return BMADTrack.ENTERPRISE

    # Map from our complexity levels
    mapping = {
        "quick": BMADTrack.QUICK_FLOW,
        "simple": BMADTrack.QUICK_FLOW,
        "standard": BMADTrack.BMAD_METHOD,
        "complex": BMADTrack.ENTERPRISE,
    }

    return mapping.get(complexity_lower, BMADTrack.BMAD_METHOD)


def get_phase_config(phase: str) -> PhaseConfig:
    """Get configuration for a phase.

    Args:
        phase: Phase name (e.g., "prd", "architecture")

    Returns:
        PhaseConfig for the phase

    Raises:
        ValueError: If phase is unknown
    """
    config = PHASE_CONFIGS.get(phase)
    if not config:
        valid_phases = ", ".join(PHASE_CONFIGS.keys())
        raise ValueError(f"Unknown phase: {phase}. Valid phases: {valid_phases}")
    return config


def create_phase_prompt(
    phase: str,
    task_description: str,
    project_dir: Path,
    include_workflow_content: bool = True,
    spec_dir: Path | None = None,
) -> str:
    """Create the prompt for executing a BMAD phase.

    Pattern: @{agent}.md + {workflow}

    Args:
        phase: Phase to execute (e.g., "prd", "architecture")
        task_description: The task to accomplish
        project_dir: Project directory
        include_workflow_content: Whether to include workflow file content
        spec_dir: Optional spec directory for task-scoped output paths.
                  If provided, output paths will be absolute paths to the spec
                  folder's _bmad-output/ directory instead of relative paths.

    Returns:
        Complete prompt for the phase execution
    """
    config = get_phase_config(phase)

    # Load agent persona
    agent_content = load_agent_file(config.agent, project_dir)

    # Load BMAD config for user_name etc.
    bmad_config = load_bmad_config(project_dir)
    user_name = bmad_config.get("user_name", "User")

    # Determine output paths - use spec_dir if provided for task-scoped output
    if spec_dir is not None:
        # Task-scoped: use absolute paths to spec folder's _bmad-output
        output_dir = spec_dir / "_bmad-output"
        output_folder = str(output_dir)
        planning_artifacts = str(output_dir / "planning-artifacts")
        implementation_artifacts = str(output_dir / "implementation-artifacts")
        logger.debug(f"Using task-scoped output paths: {output_folder}")
    else:
        # Default: use relative paths from BMAD config
        output_folder = bmad_config.get("output_folder", "_bmad-output")
        planning_artifacts = bmad_config.get(
            "planning_artifacts", f"{output_folder}/planning-artifacts"
        )
        implementation_artifacts = bmad_config.get(
            "implementation_artifacts", f"{output_folder}/implementation-artifacts"
        )

    # Build prompt
    prompt_parts = [
        "# BMAD Phase Execution",
        "",
        "## Agent Invocation",
        f"@{config.agent}.md",
        "",
        "## Workflow",
        f"{config.workflow}",
        "",
        "## Task Description",
        task_description,
        "",
        "## Configuration",
        f"- User: {user_name}",
        f"- Output Folder: {output_folder}",
        f"- Planning Artifacts: {planning_artifacts}",
        f"- Implementation Artifacts: {implementation_artifacts}",
    ]

    # Add explicit output path instructions if task-scoped
    if spec_dir is not None:
        prompt_parts.extend(
            [
                "",
                "**IMPORTANT OUTPUT PATH INSTRUCTIONS:**",
                "All artifacts for this task MUST be written to the task-scoped directory:",
                f"- `{output_folder}` - for general artifacts",
                f"- `{planning_artifacts}` - for PRD, architecture, epics",
                f"- `{implementation_artifacts}` - for stories, sprint-status",
                "",
                "Do NOT write to the project root _bmad-output/ folder.",
                "Use the ABSOLUTE paths shown above.",
            ]
        )

    prompt_parts.extend(
        [
            "",
            "## Agent Persona",
            "Follow the activation sequence and persona defined below:",
            "",
            agent_content,
        ]
    )

    # Optionally include workflow content
    if include_workflow_content:
        workflow_content = load_workflow_file(config.workflow, project_dir)
        if workflow_content:
            prompt_parts.extend(
                [
                    "",
                    "## Workflow Instructions",
                    f"Execute the {config.workflow} workflow:",
                    "",
                    workflow_content,
                ]
            )

    prompt_parts.extend(
        [
            "",
            "## Execution Instructions",
            "1. Follow the agent's activation sequence (load config, greet user if interactive)",
            f"2. Execute the {config.workflow} workflow step by step",
            f"3. Save outputs to the task-scoped output folder: {output_folder}",
            "4. Report completion status when done",
        ]
    )

    return "\n".join(prompt_parts)


def log_bmad_phase(phase: str, agent: str, workflow: str) -> None:
    """Log BMAD phase execution with clear agent identification.

    Args:
        phase: Phase name
        agent: Agent name
        workflow: Workflow name
    """
    icon, name = AGENT_INFO.get(agent, ("🤖", agent))

    # Calculate padding for alignment
    phase_display = phase.upper()
    agent_display = f"{icon} {name}"
    workflow_display = workflow
    pattern_display = f"@{agent}.md + {workflow}"

    print(f"""
┌────────────────────────────────────────────────────────────┐
│ BMAD Phase: {phase_display:<47}│
├────────────────────────────────────────────────────────────┤
│ Agent: {agent_display:<52}│
│ Workflow: {workflow_display:<49}│
│ Pattern: {pattern_display:<50}│
└────────────────────────────────────────────────────────────┘
""")
