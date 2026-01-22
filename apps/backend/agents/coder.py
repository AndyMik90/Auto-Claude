"""
Coder Agent Module
==================

Main autonomous agent loop that runs the coder agent to implement subtasks.
"""

import asyncio
import logging
import os
from pathlib import Path

from claude_agent_sdk import AgentDefinition
from core.client import create_client
from linear_updater import (
    LinearTaskState,
    is_linear_enabled,
    linear_build_complete,
    linear_task_started,
    linear_task_stuck,
)
from phase_config import get_phase_model, get_phase_thinking_budget, is_claude_model
from phase_event import ExecutionPhase, emit_phase
from progress import (
    count_subtasks,
    count_subtasks_detailed,
    get_current_phase,
    get_next_subtask,
    is_build_complete,
    print_build_complete_banner,
    print_progress_summary,
    print_session_header,
)
from prompt_generator import (
    format_context_for_prompt,
    generate_planner_prompt,
    generate_subtask_prompt,
    load_subtask_context,
)
from prompts import is_first_run
from recovery import RecoveryManager
from security.constants import PROJECT_DIR_ENV_VAR
from task_logger import (
    LogPhase,
    get_task_logger,
)
from ui import (
    BuildState,
    Icons,
    StatusManager,
    bold,
    box,
    highlight,
    icon,
    muted,
    print_key_value,
    print_status,
)

from .base import AUTO_CONTINUE_DELAY_SECONDS, HUMAN_INTERVENTION_FILE
from .memory_manager import debug_memory_system_status, get_graphiti_context
from .session import post_session_processing, run_agent_session
from .utils import (
    find_phase_for_subtask,
    get_commit_count,
    get_latest_commit,
    load_implementation_plan,
    sync_spec_to_source,
)

logger = logging.getLogger(__name__)


# =============================================================================
# Specialist Agent Definitions for Parallel Execution
# =============================================================================


def _load_coding_prompt(filename: str) -> str:
    """Load a specialist coding prompt file.

    Args:
        filename: Name of the prompt file in prompts/coding/

    Returns:
        Prompt file contents or empty string if not found
    """
    # Get the prompts directory relative to this file
    prompts_dir = Path(__file__).parent.parent / "prompts" / "coding"
    prompt_file = prompts_dir / filename

    if prompt_file.exists():
        return prompt_file.read_text(encoding="utf-8")

    logger.warning(f"Coding specialist prompt not found: {prompt_file}")
    return ""


def _define_specialist_agents() -> dict[str, AgentDefinition]:
    """
    Define specialist coding agents for SDK parallel execution.

    Each agent has:
    - description: When the coder should invoke this agent
    - prompt: System prompt for the agent
    - tools: Tools the agent can use
    - model: "inherit" = use same model as the coder agent

    Returns:
        Dictionary of agent name -> AgentDefinition

    These agents enable parallel work on different aspects of a subtask.
    More granular specialists = more parallelization = faster builds.
    """
    # Load specialist agent prompts
    frontend_prompt = _load_coding_prompt("frontend_specialist.md")
    backend_prompt = _load_coding_prompt("backend_specialist.md")
    test_prompt = _load_coding_prompt("test_specialist.md")
    research_prompt = _load_coding_prompt("research_specialist.md")

    return {
        # === CORE DOMAIN SPECIALISTS ===
        "frontend-specialist": AgentDefinition(
            description=(
                "Frontend development specialist for React/TypeScript components. "
                "Invoke for: components, hooks, state management, props, UI implementation. "
                "Use for: component structure, TypeScript typing, React patterns."
            ),
            prompt=frontend_prompt
            or "You are a frontend development specialist. Implement React/TypeScript components.",
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        "backend-specialist": AgentDefinition(
            description=(
                "Backend development specialist for Python/FastAPI code. "
                "Invoke for: API endpoints, business logic, services, utilities. "
                "Use for: function implementation, class design, async operations."
            ),
            prompt=backend_prompt
            or "You are a backend development specialist. Implement Python/FastAPI code.",
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        "database-specialist": AgentDefinition(
            description=(
                "Database specialist for schema, models, and migrations. "
                "Invoke for: SQLAlchemy models, Pydantic schemas, database operations, "
                "SQL queries, migrations, relationships. Use for: data layer design."
            ),
            prompt=(
                "You are a database specialist. Implement database schemas, models, "
                "migrations, and SQL operations using SQLAlchemy and proper relationships."
            ),
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        "api-specialist": AgentDefinition(
            description=(
                "API specialist for endpoints, routes, and HTTP interfaces. "
                "Invoke for: FastAPI routes, endpoints, request/response models, "
                "error handling, status codes. Use for: API layer implementation."
            ),
            prompt=(
                "You are an API specialist. Implement FastAPI endpoints with proper "
                "routing, request/response models, error handling, and HTTP semantics."
            ),
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        # === FRONTEND SUB-SPECIALISTS ===
        "ui-component-specialist": AgentDefinition(
            description=(
                "UI component specialist for React component structure and logic. "
                "Invoke for: component implementation, hooks, state, props, event handlers. "
                "Focus on: component code, not styling."
            ),
            prompt=(
                "You are a UI component specialist. Implement React component structure, "
                "hooks, state management, props, and event handlers. Focus on code logic."
            ),
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        "styling-specialist": AgentDefinition(
            description=(
                "Styling specialist for CSS, Tailwind, and visual design. "
                "Invoke for: styles, responsive design, layouts, themes, CSS modules. "
                "Focus on: visual appearance, not component logic."
            ),
            prompt=(
                "You are a styling specialist. Implement CSS, Tailwind classes, "
                "responsive layouts, and visual design. Focus on appearance."
            ),
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        "i18n-specialist": AgentDefinition(
            description=(
                "Internationalization specialist for translations and locale support. "
                "Invoke for: translation keys, locale files, i18n integration, "
                "formatting, date/time localization. Use for: multi-language support."
            ),
            prompt=(
                "You are an i18n specialist. Implement translation keys, locale files, "
                "and internationalization. Use proper i18n patterns and key namespacing."
            ),
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        # === QUALITY ASSURANCE ===
        "test-specialist": AgentDefinition(
            description=(
                "Testing specialist for writing comprehensive tests. "
                "Invoke for: unit tests, integration tests, test coverage, "
                "pytest, test fixtures, assertions. Use for: ALL testing work."
            ),
            prompt=test_prompt
            or "You are a testing specialist. Write comprehensive tests with pytest.",
            tools=["Read", "Glob", "Grep", "Write", "Edit", "Bash"],
            model="inherit",
        ),
        # === RESEARCH ===
        "research-specialist": AgentDefinition(
            description=(
                "Codebase research specialist for exploration and documentation. "
                "Invoke for: finding files, understanding architecture, pattern discovery, "
                "documentation, code archaeology. Use for: learning how things work."
            ),
            prompt=research_prompt
            or "You are a codebase research specialist. Explore and document code architecture.",
            tools=["Read", "Glob", "Grep"],
            model="inherit",
        ),
    }


async def run_autonomous_agent(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    max_iterations: int | None = None,
    verbose: bool = False,
    source_spec_dir: Path | None = None,
) -> None:
    """
    Run the autonomous agent loop with automatic memory management.

    During the coding phase, the agent has access to specialist agents (via SDK agents parameter)
    for parallel execution across different domains:

    Core Domain Specialists:
    - frontend-specialist: React/TypeScript components
    - backend-specialist: Python/FastAPI code, business logic
    - database-specialist: SQLAlchemy models, schemas, migrations
    - api-specialist: FastAPI endpoints, routes, HTTP interfaces

    Frontend Sub-Specialists:
    - ui-component-specialist: Component structure, hooks, state
    - styling-specialist: CSS, Tailwind, responsive design
    - i18n-specialist: Translation keys, locale files

    Quality Assurance:
    - test-specialist: Unit tests, integration tests, coverage

    Research:
    - research-specialist: Codebase exploration, architecture, patterns

    The agent can delegate work to these specialists for parallel execution on complex subtasks.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the spec (auto-claude/specs/001-name/)
        model: Claude model to use
        max_iterations: Maximum number of iterations (None for unlimited)
        verbose: Whether to show detailed output
        source_spec_dir: Original spec directory in main project (for syncing from worktree)
    """
    # Set environment variable for security hooks to find the correct project directory
    # This is needed because os.getcwd() may return the wrong directory in worktree mode
    os.environ[PROJECT_DIR_ENV_VAR] = str(project_dir.resolve())

    # Initialize recovery manager (handles memory persistence)
    recovery_manager = RecoveryManager(spec_dir, project_dir)

    # Initialize status manager for ccstatusline
    status_manager = StatusManager(project_dir)
    status_manager.set_active(spec_dir.name, BuildState.BUILDING)

    # Initialize task logger for persistent logging
    task_logger = get_task_logger(spec_dir)

    # Debug: Print memory system status at startup
    debug_memory_system_status()

    # Update initial subtask counts
    subtasks = count_subtasks_detailed(spec_dir)
    status_manager.update_subtasks(
        completed=subtasks["completed"],
        total=subtasks["total"],
        in_progress=subtasks["in_progress"],
    )

    # Check Linear integration status
    linear_task = None
    if is_linear_enabled():
        linear_task = LinearTaskState.load(spec_dir)
        if linear_task and linear_task.task_id:
            print_status("Linear integration: ENABLED", "success")
            print_key_value("Task", linear_task.task_id)
            print_key_value("Status", linear_task.status)
            print()
        else:
            print_status("Linear enabled but no task created for this spec", "warning")
            print()

    # Check if this is a fresh start or continuation
    first_run = is_first_run(spec_dir)

    # Track which phase we're in for logging
    current_log_phase = LogPhase.CODING
    is_planning_phase = False
    planning_retry_context: str | None = None
    planning_validation_failures = 0
    max_planning_validation_retries = 3

    def _validate_and_fix_implementation_plan() -> tuple[bool, list[str]]:
        from spec.validate_pkg import SpecValidator, auto_fix_plan

        spec_validator = SpecValidator(spec_dir)
        result = spec_validator.validate_implementation_plan()
        if result.valid:
            return True, []

        fixed = auto_fix_plan(spec_dir)
        if fixed:
            result = spec_validator.validate_implementation_plan()
            if result.valid:
                return True, []

        return False, result.errors

    if first_run:
        print_status(
            "Fresh start - will use Planner Agent to create implementation plan", "info"
        )
        content = [
            bold(f"{icon(Icons.GEAR)} PLANNER SESSION"),
            "",
            f"Spec: {highlight(spec_dir.name)}",
            muted("The agent will analyze your spec and create a subtask-based plan."),
        ]
        print()
        print(box(content, width=70, style="heavy"))
        print()

        # Update status for planning phase
        status_manager.update(state=BuildState.PLANNING)
        emit_phase(ExecutionPhase.PLANNING, "Creating implementation plan")
        is_planning_phase = True
        current_log_phase = LogPhase.PLANNING

        # Start planning phase in task logger
        if task_logger:
            task_logger.start_phase(
                LogPhase.PLANNING, "Starting implementation planning..."
            )

        # Update Linear to "In Progress" when build starts
        if linear_task and linear_task.task_id:
            print_status("Updating Linear task to In Progress...", "progress")
            await linear_task_started(spec_dir)
    else:
        print(f"Continuing build: {highlight(spec_dir.name)}")
        print_progress_summary(spec_dir)

        # Check if already complete
        if is_build_complete(spec_dir):
            print_build_complete_banner(spec_dir)
            status_manager.update(state=BuildState.COMPLETE)
            return

        # Start/continue coding phase in task logger
        if task_logger:
            task_logger.start_phase(LogPhase.CODING, "Continuing implementation...")

        # Emit phase event when continuing build
        emit_phase(ExecutionPhase.CODING, "Continuing implementation")

    # Show human intervention hint
    content = [
        bold("INTERACTIVE CONTROLS"),
        "",
        f"Press {highlight('Ctrl+C')} once  {icon(Icons.ARROW_RIGHT)} Pause and optionally add instructions",
        f"Press {highlight('Ctrl+C')} twice {icon(Icons.ARROW_RIGHT)} Exit immediately",
    ]
    print(box(content, width=70, style="light"))
    print()

    # Main loop
    iteration = 0

    while True:
        iteration += 1

        # Check for human intervention (PAUSE file)
        pause_file = spec_dir / HUMAN_INTERVENTION_FILE
        if pause_file.exists():
            print("\n" + "=" * 70)
            print("  PAUSED BY HUMAN")
            print("=" * 70)

            pause_content = pause_file.read_text(encoding="utf-8").strip()
            if pause_content:
                print(f"\nMessage: {pause_content}")

            print("\nTo resume, delete the PAUSE file:")
            print(f"  rm {pause_file}")
            print("\nThen run again:")
            print(f"  python auto-claude/run.py --spec {spec_dir.name}")
            return

        # Check max iterations
        if max_iterations and iteration > max_iterations:
            print(f"\nReached max iterations ({max_iterations})")
            print("To continue, run the script again without --max-iterations")
            break

        # Get the next subtask to work on (planner sessions shouldn't bind to a subtask)
        next_subtask = None if first_run else get_next_subtask(spec_dir)
        subtask_id = next_subtask.get("id") if next_subtask else None
        phase_name = next_subtask.get("phase_name") if next_subtask else None

        # Update status for this session
        status_manager.update_session(iteration)
        if phase_name:
            current_phase = get_current_phase(spec_dir)
            if current_phase:
                status_manager.update_phase(
                    current_phase.get("name", ""),
                    current_phase.get("phase", 0),
                    current_phase.get("total", 0),
                )
        status_manager.update_subtasks(in_progress=1)

        # Print session header
        print_session_header(
            session_num=iteration,
            is_planner=first_run,
            subtask_id=subtask_id,
            subtask_desc=next_subtask.get("description") if next_subtask else None,
            phase_name=phase_name,
            attempt=recovery_manager.get_attempt_count(subtask_id) + 1
            if subtask_id
            else 1,
        )

        # Capture state before session for post-processing
        commit_before = get_latest_commit(project_dir)
        commit_count_before = get_commit_count(project_dir)

        # Get the phase-specific model and thinking level (respects task_metadata.json configuration)
        # first_run means we're in planning phase, otherwise coding phase
        current_phase = "planning" if first_run else "coding"
        phase_model = get_phase_model(spec_dir, current_phase, model)
        phase_thinking_budget = get_phase_thinking_budget(spec_dir, current_phase)

        # Create client (fresh context) with phase-specific model and thinking
        # Use appropriate agent_type for correct tool permissions and thinking budget
        # For coding phase with Claude models, include specialist agents for parallel execution
        # For non-Claude models (glm4.7, etc.), SDK agents are not supported - use Task tool instead
        use_specialist_agents = (
            not first_run  # Only in coding phase
            and is_claude_model(phase_model)  # Only for Claude models
        )
        client = create_client(
            project_dir,
            spec_dir,
            phase_model,
            agent_type="planner" if first_run else "coder",
            max_thinking_tokens=phase_thinking_budget,
            agents=_define_specialist_agents() if use_specialist_agents else None,
        )

        # Generate appropriate prompt
        if first_run:
            prompt = generate_planner_prompt(spec_dir, project_dir)
            if planning_retry_context:
                prompt += "\n\n" + planning_retry_context

            # Retrieve Graphiti memory context for planning phase
            # This gives the planner knowledge of previous patterns, gotchas, and insights
            planner_context = await get_graphiti_context(
                spec_dir,
                project_dir,
                {
                    "description": "Planning implementation for new feature",
                    "id": "planner",
                },
            )
            if planner_context:
                prompt += "\n\n" + planner_context
                print_status("Graphiti memory context loaded for planner", "success")

            first_run = False
            current_log_phase = LogPhase.PLANNING

            # Set session info in logger
            if task_logger:
                task_logger.set_session(iteration)
        else:
            # Switch to coding phase after planning
            just_transitioned_from_planning = False
            if is_planning_phase:
                just_transitioned_from_planning = True
                is_planning_phase = False
                current_log_phase = LogPhase.CODING
                emit_phase(ExecutionPhase.CODING, "Starting implementation")
                if task_logger:
                    task_logger.end_phase(
                        LogPhase.PLANNING,
                        success=True,
                        message="Implementation plan created",
                    )
                    task_logger.start_phase(
                        LogPhase.CODING, "Starting implementation..."
                    )
                # In worktree mode, the UI prefers planning logs from the main spec dir.
                # Ensure the planning->coding transition is immediately reflected there.
                if sync_spec_to_source(spec_dir, source_spec_dir):
                    print_status("Phase transition synced to main project", "success")

            if not next_subtask:
                # FIX for Issue #495: Race condition after planning phase
                # The implementation_plan.json may not be fully flushed to disk yet,
                # or there may be a brief delay before subtasks become available.
                # Retry with exponential backoff before giving up.
                if just_transitioned_from_planning:
                    print_status(
                        "Waiting for implementation plan to be ready...", "progress"
                    )
                    for retry_attempt in range(3):
                        delay = (retry_attempt + 1) * 2  # 2s, 4s, 6s
                        await asyncio.sleep(delay)
                        next_subtask = get_next_subtask(spec_dir)
                        if next_subtask:
                            # Update subtask_id and phase_name after successful retry
                            subtask_id = next_subtask.get("id")
                            phase_name = next_subtask.get("phase_name")
                            print_status(
                                f"Found subtask {subtask_id} after {delay}s delay",
                                "success",
                            )
                            break
                        print_status(
                            f"Retry {retry_attempt + 1}/3: No subtask found yet...",
                            "warning",
                        )

                if not next_subtask:
                    print("No pending subtasks found - build may be complete!")
                    break

            # Get attempt count for recovery context
            attempt_count = recovery_manager.get_attempt_count(subtask_id)
            recovery_hints = (
                recovery_manager.get_recovery_hints(subtask_id)
                if attempt_count > 0
                else None
            )

            # Find the phase for this subtask
            plan = load_implementation_plan(spec_dir)
            phase = find_phase_for_subtask(plan, subtask_id) if plan else {}

            # Generate focused, minimal prompt for this subtask
            prompt = generate_subtask_prompt(
                spec_dir=spec_dir,
                project_dir=project_dir,
                subtask=next_subtask,
                phase=phase or {},
                attempt_count=attempt_count,
                recovery_hints=recovery_hints,
            )

            # Load and append relevant file context
            context = load_subtask_context(spec_dir, project_dir, next_subtask)
            if context.get("patterns") or context.get("files_to_modify"):
                prompt += "\n\n" + format_context_for_prompt(context)

            # Retrieve and append Graphiti memory context (if enabled)
            graphiti_context = await get_graphiti_context(
                spec_dir, project_dir, next_subtask
            )
            if graphiti_context:
                prompt += "\n\n" + graphiti_context
                print_status("Graphiti memory context loaded", "success")

            # Show what we're working on
            print(f"Working on: {highlight(subtask_id)}")
            print(f"Description: {next_subtask.get('description', 'No description')}")
            if attempt_count > 0:
                print_status(f"Previous attempts: {attempt_count}", "warning")
            print()

        # Set subtask info in logger
        if task_logger and subtask_id:
            task_logger.set_subtask(subtask_id)
            task_logger.set_session(iteration)

        # Run session with async context manager
        async with client:
            status, response = await run_agent_session(
                client, prompt, spec_dir, verbose, phase=current_log_phase
            )

        plan_validated = False
        if is_planning_phase and status != "error":
            valid, errors = _validate_and_fix_implementation_plan()
            if valid:
                plan_validated = True
                planning_retry_context = None
            else:
                planning_validation_failures += 1
                if planning_validation_failures >= max_planning_validation_retries:
                    print_status(
                        "implementation_plan.json validation failed too many times",
                        "error",
                    )
                    for err in errors:
                        print(f"  - {err}")
                    status_manager.update(state=BuildState.ERROR)
                    return

                print_status(
                    "implementation_plan.json invalid - retrying planner", "warning"
                )
                for err in errors:
                    print(f"  - {err}")

                planning_retry_context = (
                    "## IMPLEMENTATION PLAN VALIDATION ERRORS\n\n"
                    "The previous `implementation_plan.json` is INVALID.\n"
                    "You MUST rewrite it to match the required schema:\n"
                    "- Top-level: `feature`, `workflow_type`, `phases`\n"
                    "- Each phase: `id` (or `phase`) and `name`, and `subtasks`\n"
                    "- Each subtask: `id`, `description`, `status` (use `pending` for not started)\n\n"
                    "Validation errors:\n" + "\n".join(f"- {e}" for e in errors)
                )
                # Stay in planning mode for the next iteration
                first_run = True
                status = "continue"

        # === POST-SESSION PROCESSING (100% reliable) ===
        # Only run post-session processing for coding sessions.
        if subtask_id and current_log_phase == LogPhase.CODING:
            linear_is_enabled = (
                linear_task is not None and linear_task.task_id is not None
            )
            success = await post_session_processing(
                spec_dir=spec_dir,
                project_dir=project_dir,
                subtask_id=subtask_id,
                session_num=iteration,
                commit_before=commit_before,
                commit_count_before=commit_count_before,
                recovery_manager=recovery_manager,
                linear_enabled=linear_is_enabled,
                status_manager=status_manager,
                source_spec_dir=source_spec_dir,
            )

            # Check for stuck subtasks
            attempt_count = recovery_manager.get_attempt_count(subtask_id)
            if not success and attempt_count >= 3:
                recovery_manager.mark_subtask_stuck(
                    subtask_id, f"Failed after {attempt_count} attempts"
                )
                print()
                print_status(
                    f"Subtask {subtask_id} marked as STUCK after {attempt_count} attempts",
                    "error",
                )
                print(muted("Consider: manual intervention or skipping this subtask"))

                # Record stuck subtask in Linear (if enabled)
                if linear_is_enabled:
                    await linear_task_stuck(
                        spec_dir=spec_dir,
                        subtask_id=subtask_id,
                        attempt_count=attempt_count,
                    )
                    print_status("Linear notified of stuck subtask", "info")
        elif plan_validated and source_spec_dir:
            # After planning phase, sync the newly created implementation plan back to source
            if sync_spec_to_source(spec_dir, source_spec_dir):
                print_status("Implementation plan synced to main project", "success")

        # Handle session status
        if status == "complete":
            # Don't emit COMPLETE here - subtasks are done but QA hasn't run yet
            # QA loop will emit COMPLETE after actual approval
            print_build_complete_banner(spec_dir)
            status_manager.update(state=BuildState.COMPLETE)

            if task_logger:
                task_logger.end_phase(
                    LogPhase.CODING,
                    success=True,
                    message="All subtasks completed successfully",
                )

            if linear_task and linear_task.task_id:
                await linear_build_complete(spec_dir)
                print_status("Linear notified: build complete, ready for QA", "success")

            break

        elif status == "continue":
            print(
                muted(
                    f"\nAgent will auto-continue in {AUTO_CONTINUE_DELAY_SECONDS}s..."
                )
            )
            print_progress_summary(spec_dir)

            # Update state back to building
            status_manager.update(
                state=BuildState.PLANNING if is_planning_phase else BuildState.BUILDING
            )

            # Show next subtask info
            next_subtask = get_next_subtask(spec_dir)
            if next_subtask:
                subtask_id = next_subtask.get("id")
                print(
                    f"\nNext: {highlight(subtask_id)} - {next_subtask.get('description')}"
                )

                attempt_count = recovery_manager.get_attempt_count(subtask_id)
                if attempt_count > 0:
                    print_status(
                        f"WARNING: {attempt_count} previous attempt(s)", "warning"
                    )

            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        elif status == "error":
            emit_phase(ExecutionPhase.FAILED, "Session encountered an error")
            print_status("Session encountered an error", "error")
            print(muted("Will retry with a fresh session..."))
            status_manager.update(state=BuildState.ERROR)
            await asyncio.sleep(AUTO_CONTINUE_DELAY_SECONDS)

        # Small delay between sessions
        if max_iterations is None or iteration < max_iterations:
            print("\nPreparing next session...\n")
            await asyncio.sleep(1)

    # Final summary
    content = [
        bold(f"{icon(Icons.SESSION)} SESSION SUMMARY"),
        "",
        f"Project: {project_dir}",
        f"Spec: {highlight(spec_dir.name)}",
        f"Sessions completed: {iteration}",
    ]
    print()
    print(box(content, width=70, style="heavy"))
    print_progress_summary(spec_dir)

    # Show stuck subtasks if any
    stuck_subtasks = recovery_manager.get_stuck_subtasks()
    if stuck_subtasks:
        print()
        print_status("STUCK SUBTASKS (need manual intervention):", "error")
        for stuck in stuck_subtasks:
            print(f"  {icon(Icons.ERROR)} {stuck['subtask_id']}: {stuck['reason']}")

    # Instructions
    completed, total = count_subtasks(spec_dir)
    if completed < total:
        content = [
            bold(f"{icon(Icons.PLAY)} NEXT STEPS"),
            "",
            f"{total - completed} subtasks remaining.",
            f"Run again: {highlight(f'python auto-claude/run.py --spec {spec_dir.name}')}",
        ]
    else:
        content = [
            bold(f"{icon(Icons.SUCCESS)} NEXT STEPS"),
            "",
            "All subtasks completed!",
            "  1. Review the auto-claude/* branch",
            "  2. Run manual tests",
            "  3. Merge to main",
        ]

    print()
    print(box(content, width=70, style="light"))
    print()

    # Set final status
    if completed == total:
        status_manager.update(state=BuildState.COMPLETE)
    else:
        status_manager.update(state=BuildState.PAUSED)
