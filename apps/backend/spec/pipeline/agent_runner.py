"""
Agent Runner
============

Handles the execution of AI agents for the spec creation pipeline.
"""

from pathlib import Path

# Configure safe encoding before any output (fixes Windows encoding errors)
from ui.capabilities import configure_safe_encoding

configure_safe_encoding()

from core.agent_backend import create_agent_backend
from debug import debug, debug_detailed, debug_error, debug_section, debug_success
from task_logger import LogPhase, TaskLogger


class AgentRunner:
    """Manages agent execution with logging and error handling."""

    def __init__(
        self,
        project_dir: Path,
        spec_dir: Path,
        model: str | None,
        task_logger: TaskLogger | None = None,
    ):
        """Initialize the agent runner.

        Args:
            project_dir: The project root directory
            spec_dir: The spec directory
            model: The model to use for agent execution
            task_logger: Optional task logger for tracking progress
        """
        self.project_dir = project_dir
        self.spec_dir = spec_dir
        self.model = model
        self.task_logger = task_logger

    async def run_agent(
        self,
        prompt_file: str,
        additional_context: str = "",
        interactive: bool = False,
        thinking_budget: int | None = None,
        prior_phase_summaries: str | None = None,
    ) -> tuple[bool, str]:
        """Run an agent with the given prompt.

        Args:
            prompt_file: The prompt file to use (relative to prompts directory)
            additional_context: Additional context to add to the prompt
            interactive: Whether to run in interactive mode
            thinking_budget: Token budget for extended thinking (None = disabled)
            prior_phase_summaries: Summaries from previous phases for context

        Returns:
            Tuple of (success, response_text)
        """
        debug_section("agent_runner", f"Spec Agent - {prompt_file}")
        debug(
            "agent_runner",
            "Running spec creation agent",
            prompt_file=prompt_file,
            spec_dir=str(self.spec_dir),
            model=self.model,
            interactive=interactive,
        )

        prompt_path = Path(__file__).parent.parent.parent / "prompts" / prompt_file

        if not prompt_path.exists():
            debug_error("agent_runner", f"Prompt file not found: {prompt_path}")
            return False, f"Prompt not found: {prompt_path}"

        # Load prompt
        prompt = prompt_path.read_text()
        debug_detailed(
            "agent_runner",
            "Loaded prompt file",
            prompt_length=len(prompt),
        )

        # Add context
        prompt += f"\n\n---\n\n**Spec Directory**: {self.spec_dir}\n"
        prompt += f"**Project Directory**: {self.project_dir}\n"

        # Add summaries from previous phases (compaction)
        if prior_phase_summaries:
            prompt += f"\n{prior_phase_summaries}\n"
            debug_detailed(
                "agent_runner",
                "Added prior phase summaries",
                summaries_length=len(prior_phase_summaries),
            )

        if additional_context:
            prompt += f"\n{additional_context}\n"
            debug_detailed(
                "agent_runner",
                "Added additional context",
                context_length=len(additional_context),
            )

        # Create backend with thinking budget
        debug(
            "agent_runner",
            "Creating agent backend...",
            thinking_budget=thinking_budget,
        )
        agent_type = self._resolve_agent_type(prompt_file)
        response_text = ""
        for attempt in range(2):
            backend = create_agent_backend(
                self.project_dir,
                self.spec_dir,
                self.model,
                agent_type=agent_type,
                max_thinking_tokens=thinking_budget,
            )

            try:
                async with backend:
                    debug("agent_runner", "Running agent backend session...")
                    status, response_text = await backend.run(
                        prompt,
                        self.spec_dir,
                        interactive,
                        LogPhase.PLANNING.value,
                    )

                    debug_success(
                        "agent_runner",
                        "Agent session completed successfully",
                        status=status,
                        response_length=len(response_text),
                    )
                    if status == "provider_budget_exhausted":
                        if self.task_logger:
                            self.task_logger.log_info(
                                "Provider budget exhausted; retrying with fallback provider",
                                LogPhase.PLANNING,
                            )
                        continue
                    if status == "blocked_by_budget":
                        if self.task_logger:
                            self.task_logger.log_error(
                                "Agent session blocked by budget",
                                LogPhase.PLANNING,
                            )
                        return False, response_text
                    return status != "error", response_text

            except Exception as e:
                debug_error(
                    "agent_runner",
                    f"Agent session error: {e}",
                    exception_type=type(e).__name__,
                )
                if self.task_logger:
                    self.task_logger.log_error(f"Agent error: {e}", LogPhase.PLANNING)
                return False, str(e)

        return False, response_text

    @staticmethod
    def _resolve_agent_type(prompt_file: str) -> str:
        stem = Path(prompt_file).stem
        try:
            from agents.tools_pkg.models import AGENT_CONFIGS

            if stem in AGENT_CONFIGS:
                return stem
        except Exception:
            pass
        return "planner" if "planner" in stem else "coder"

    # Tool detail helpers were previously used by the Claude SDK streaming path.
