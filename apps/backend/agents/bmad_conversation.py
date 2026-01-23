"""
BMAD Two-Agent Conversation Loop

This module implements the conversation pattern between:
- BMAD Agent: Runs the BMAD methodology workflows
- Human Replacement Agent: Responds to BMAD's questions as a knowledgeable collaborator

The conversation loop detects when BMAD is asking for input and routes to the
Human Replacement agent to generate responses, creating an autonomous feedback loop.
"""

import re
from collections.abc import Callable
from pathlib import Path
from typing import Any

from apps.backend.core.client import create_client
from apps.backend.core.debug import (
    debug,
    debug_error,
    debug_section,
    debug_success,
    debug_warning,
)
from apps.backend.task_logger import LogPhase, get_task_logger


def _get_tool_detail(tool_name: str, tool_input: dict[str, Any]) -> str:
    """Extract meaningful detail from tool input for user-friendly logging.

    Instead of "Using tool: Read", show "Reading sdk_utils.py"
    Instead of "Using tool: Grep", show "Searching for 'pattern'"
    """
    if tool_name == "Read":
        file_path = tool_input.get("file_path", "")
        if file_path:
            filename = file_path.split("/")[-1] if "/" in file_path else file_path
            return f"📖 Reading {filename}"
        return "📖 Reading file"

    if tool_name == "Grep":
        pattern = tool_input.get("pattern", "")
        if pattern:
            pattern_preview = pattern[:40] + "..." if len(pattern) > 40 else pattern
            return f"🔍 Searching for '{pattern_preview}'"
        return "🔍 Searching codebase"

    if tool_name == "Glob":
        pattern = tool_input.get("pattern", "")
        if pattern:
            return f"📁 Finding files matching '{pattern}'"
        return "📁 Finding files"

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if command:
            cmd_preview = command[:50] + "..." if len(command) > 50 else command
            return f"⚡ Running: {cmd_preview}"
        return "⚡ Running command"

    if tool_name == "Edit":
        file_path = tool_input.get("file_path", "")
        if file_path:
            filename = file_path.split("/")[-1] if "/" in file_path else file_path
            return f"✏️ Editing {filename}"
        return "✏️ Editing file"

    if tool_name == "Write":
        file_path = tool_input.get("file_path", "")
        if file_path:
            filename = file_path.split("/")[-1] if "/" in file_path else file_path
            return f"📝 Writing {filename}"
        return "📝 Writing file"

    if tool_name == "Task":
        agent_type = tool_input.get("subagent_type", "unknown")
        return f"🤖 Spawning agent: {agent_type}"

    if tool_name == "WebSearch":
        query = tool_input.get("query", "")
        if query:
            query_preview = query[:40] + "..." if len(query) > 40 else query
            return f"🌐 Web search: '{query_preview}'"
        return "🌐 Web search"

    if tool_name == "WebFetch":
        url = tool_input.get("url", "")
        if url:
            url_preview = url[:50] + "..." if len(url) > 50 else url
            return f"🌐 Fetching: {url_preview}"
        return "🌐 Fetching URL"

    # MCP tools
    if tool_name.startswith("mcp__"):
        # Extract readable name from mcp__server__tool format
        parts = tool_name.split("__")
        if len(parts) >= 3:
            server = parts[1]
            tool = parts[2]
            return f"🔌 MCP {server}: {tool}"
        return f"🔌 MCP: {tool_name}"

    # Default fallback
    return f"🔧 Using tool: {tool_name}"


def _get_tool_input_display(tool_name: str, tool_input: dict[str, Any]) -> str | None:
    """Extract a brief tool input description for task_logger display.

    Returns a concise string suitable for the frontend log display.
    """
    if not tool_input:
        return None

    if tool_name == "Read":
        file_path = tool_input.get("file_path", "")
        if file_path:
            # Show just filename or last part of path
            if len(file_path) > 50:
                return "..." + file_path[-47:]
            return file_path
        return None

    if tool_name in ("Grep", "Glob"):
        pattern = tool_input.get("pattern", "")
        if pattern:
            if len(pattern) > 50:
                return f"pattern: {pattern[:47]}..."
            return f"pattern: {pattern}"
        return None

    if tool_name == "Bash":
        command = tool_input.get("command", "")
        if command:
            if len(command) > 50:
                return command[:47] + "..."
            return command
        return None

    if tool_name in ("Edit", "Write"):
        file_path = tool_input.get("file_path", "")
        if file_path:
            if len(file_path) > 50:
                return "..." + file_path[-47:]
            return file_path
        return None

    if tool_name == "Task":
        agent_type = tool_input.get("subagent_type", "")
        description = tool_input.get("description", "")
        if agent_type:
            return (
                f"{agent_type}: {description[:30]}..."
                if len(description) > 30
                else f"{agent_type}: {description}"
            )
        return None

    # For MCP and other tools, show first available string value
    for key in ["url", "query", "path", "file_path", "pattern", "command"]:
        if key in tool_input:
            val = str(tool_input[key])
            if len(val) > 50:
                return f"{key}: {val[:47]}..."
            return f"{key}: {val}"

    return None


# Patterns that indicate BMAD is waiting for input
INPUT_PATTERNS = [
    # Menu patterns
    r"\[C\]\s*Continue",
    r"\[1\].*\[2\].*\[3\]",
    r"Your choice\s*\[",
    r"Select.*option",
    # Question patterns
    r"\?\s*$",  # Ends with question mark
    r"\(y/n\)",
    r"\(yes/no\)",
    r"What do you think",
    r"Should we",
    r"Would you like",
    r"Do you want",
    r"How should we",
    r"What.*prefer",
    # Confirmation patterns
    r"proceed\?",
    r"continue\?",
    r"agree\?",
    r"approve",
]

# Patterns that indicate the phase is complete
COMPLETION_PATTERNS = [
    r"workflow complete",
    r"phase complete",
    r"documentation.*complete",
    r"successfully.*created",
    r"finished.*step\s*11",  # PRD final step
    r"all.*steps.*complete",
]


def is_waiting_for_input(text: str) -> bool:
    """Check if the BMAD agent output indicates it's waiting for input.

    Args:
        text: The BMAD agent's output text

    Returns:
        True if the agent appears to be waiting for human input
    """
    text_lower = text.lower()

    for pattern in INPUT_PATTERNS:
        if re.search(pattern, text, re.IGNORECASE | re.MULTILINE):
            return True

    return False


def is_phase_complete(text: str) -> bool:
    """Check if the BMAD workflow indicates phase completion.

    Args:
        text: The BMAD agent's output text

    Returns:
        True if the phase appears to be complete
    """
    text_lower = text.lower()

    for pattern in COMPLETION_PATTERNS:
        if re.search(pattern, text_lower, re.MULTILINE):
            return True

    return False


def extract_question_context(text: str, max_chars: int = 2000) -> str:
    """Extract the relevant question/decision context from BMAD output.

    Takes the last portion of the output that contains the question or menu,
    providing enough context for the Human Replacement agent to respond.

    Args:
        text: Full BMAD agent output
        max_chars: Maximum characters to include

    Returns:
        The relevant context for the Human Replacement agent
    """
    # Get the last max_chars, but try to start at a paragraph boundary
    if len(text) <= max_chars:
        return text

    truncated = text[-max_chars:]

    # Try to find a good starting point (paragraph break)
    paragraph_break = truncated.find("\n\n")
    if paragraph_break > 0 and paragraph_break < max_chars // 2:
        truncated = truncated[paragraph_break + 2 :]

    return truncated


def load_human_replacement_prompt(
    phase: str,
    task_description: str,
    project_context: str,
    bmad_message: str,
) -> str:
    """Load and populate the Human Replacement agent prompt for a phase.

    Args:
        phase: BMAD phase (analyze, prd, architecture, epics, dev, review)
        task_description: The original task description
        project_context: Context about the project
        bmad_message: The BMAD agent's message requiring response

    Returns:
        The populated prompt for the Human Replacement agent
    """
    # Map phase to prompt file
    phase_prompt_map = {
        "analyze": "bmad_human_analyze.md",
        "prd": "bmad_human_prd.md",
        "architecture": "bmad_human_architecture.md",
        "epics": "bmad_human_epics.md",
        "stories": "bmad_human_epics.md",  # Same as epics
        "dev": "bmad_human_dev.md",
        "review": "bmad_human_review.md",
    }

    prompt_file = phase_prompt_map.get(phase, "bmad_human_base.md")

    # Load the prompt template
    prompts_dir = Path(__file__).parent.parent / "prompts"
    prompt_path = prompts_dir / prompt_file

    # Fall back to base prompt if phase-specific doesn't exist
    if not prompt_path.exists():
        prompt_path = prompts_dir / "bmad_human_base.md"

    prompt_template = prompt_path.read_text(encoding="utf-8")

    # Substitute placeholders
    prompt = prompt_template.replace(
        "{task_description}", task_description or "No task description provided"
    )
    prompt = prompt.replace(
        "{project_context}", project_context or "No additional project context"
    )
    prompt = prompt.replace("{bmad_message}", bmad_message)

    return prompt


async def run_human_replacement_response(
    project_dir: Path,
    spec_dir: Path,
    phase: str,
    task_description: str,
    project_context: str,
    bmad_message: str,
    model: str = "claude-sonnet-4-5-20250929",
) -> str:
    """Run the Human Replacement agent to generate a response to BMAD.

    The Human Replacement agent gives SHORT, DECISIVE responses - typically
    just "C" for continue, "y" for yes, or brief one-line answers.

    Args:
        project_dir: Project directory path
        spec_dir: Spec directory path
        phase: Current BMAD phase
        task_description: Original task description
        project_context: Project context information
        bmad_message: The BMAD agent's message requiring response
        model: Model to use for the Human Replacement agent (ignored, uses Haiku)

    Returns:
        The Human Replacement agent's response
    """
    debug_section("bmad.human_replacement", f"GENERATING RESPONSE FOR {phase.upper()}")

    # Load the appropriate prompt
    prompt = load_human_replacement_prompt(
        phase=phase,
        task_description=task_description,
        project_context=project_context,
        bmad_message=bmad_message,
    )

    debug(
        "bmad.human_replacement",
        "Prompt prepared",
        phase=phase,
        prompt_length=len(prompt),
        bmad_message_preview=bmad_message[:200] + "..."
        if len(bmad_message) > 200
        else bmad_message,
    )

    # Create a lightweight client for the Human Replacement agent
    # Use Haiku for speed - we just need short, decisive responses
    # No thinking tokens needed - responses should be immediate and brief
    client = create_client(
        project_dir,
        spec_dir,
        model="claude-haiku-4-5-20251001",  # Fast model for short responses
        agent_type="planner",  # Read-only permissions - no file writes
        max_thinking_tokens=None,  # No extended thinking - just respond
    )

    try:
        async with client:
            # Send the prompt and get response
            await client.query(prompt)

            response_text = ""
            msg_count = 0

            debug("bmad.human", "🤖 Human Replacement agent processing...")

            async for msg in client.receive_response():
                msg_type = type(msg).__name__
                msg_count += 1

                # Log thinking (Haiku rarely uses extended thinking, but just in case)
                if msg_type == "ThinkingBlock" or (
                    hasattr(msg, "type") and msg.type == "thinking"
                ):
                    thinking_text = getattr(msg, "thinking", "") or getattr(
                        msg, "text", ""
                    )
                    if thinking_text:
                        debug("bmad.human", f"🧠 Thinking ({len(thinking_text)} chars)")

                # Collect text
                if hasattr(msg, "content"):
                    for block in msg.content:
                        if hasattr(block, "text"):
                            response_text += block.text

            # Clean up response - remove any meta-commentary
            response_text = response_text.strip()

            debug_success(
                "bmad.human",
                "Response generated",
                messages=msg_count,
                response=response_text[:100] + "..."
                if len(response_text) > 100
                else response_text,
            )

            return response_text

    except Exception as e:
        debug_error("bmad.human", f"Failed to generate response: {e}")
        # Return a safe default response
        return "Continue"


async def run_bmad_conversation_loop(
    project_dir: Path,
    spec_dir: Path,
    phase: str,
    workflow_prompt: str,
    task_description: str,
    project_context: str = "",
    model: str = "claude-sonnet-4-5-20250929",
    max_turns: int = 20,
    progress_callback: Callable[[str, float], None] | None = None,
) -> tuple[str, str]:
    """Run the BMAD workflow with Human Replacement agent responses.

    This implements the two-agent conversation loop:
    1. BMAD agent runs and may ask questions
    2. Human Replacement agent responds to questions
    3. Loop continues until phase complete or max turns reached

    Args:
        project_dir: Project directory path
        spec_dir: Spec directory path
        phase: Current BMAD phase
        workflow_prompt: The BMAD workflow instructions
        task_description: Original task description
        project_context: Project context information
        model: Model to use for agents
        max_turns: Maximum conversation turns before stopping
        progress_callback: Optional callback for progress updates

    Returns:
        Tuple of (status, full_conversation_text)
    """
    debug_section("bmad.conversation", f"STARTING CONVERSATION LOOP - {phase.upper()}")

    # Get task logger for structured frontend logging
    task_logger = get_task_logger(spec_dir)

    # Map BMAD phase to LogPhase
    log_phase_map = {
        "analyze": LogPhase.PLANNING,
        "prd": LogPhase.PLANNING,
        "architecture": LogPhase.PLANNING,
        "epics": LogPhase.PLANNING,
        "stories": LogPhase.PLANNING,
        "dev": LogPhase.CODING,
        "review": LogPhase.VALIDATION,
    }
    log_phase = log_phase_map.get(phase, LogPhase.CODING)

    conversation_history = []
    full_response = ""
    turn_count = 0

    # Start with the workflow prompt
    current_prompt = workflow_prompt

    while turn_count < max_turns:
        turn_count += 1

        debug(
            "bmad.conversation",
            f"Turn {turn_count}/{max_turns}",
            phase=phase,
            prompt_length=len(current_prompt),
        )

        if progress_callback:
            progress = 30 + (turn_count / max_turns) * 60  # Progress from 30% to 90%
            progress_callback(f"BMAD conversation turn {turn_count}", progress)

        # Create BMAD client
        bmad_client = create_client(
            project_dir,
            spec_dir,
            model=model,
            agent_type="coder",
            max_thinking_tokens=None,
        )

        try:
            # Run BMAD agent
            async with bmad_client:
                await bmad_client.query(current_prompt)

                bmad_response = ""
                msg_count = 0
                tool_calls = 0
                subagent_tool_ids: dict[str, str] = {}  # tool_id -> agent_name
                pending_tools: dict[
                    str, str
                ] = {}  # tool_id -> tool_name for tool_end matching

                debug("bmad.agent", "Agent session started, processing stream...")

                async for msg in bmad_client.receive_response():
                    msg_type = type(msg).__name__
                    msg_count += 1

                    # Log thinking blocks
                    if msg_type == "ThinkingBlock" or (
                        hasattr(msg, "type") and msg.type == "thinking"
                    ):
                        thinking_text = getattr(msg, "thinking", "") or getattr(
                            msg, "text", ""
                        )
                        if thinking_text:
                            debug(
                                "bmad.agent",
                                f"🧠 AI thinking ({len(thinking_text)} chars)",
                                preview=thinking_text[:150].replace("\n", " ") + "...",
                            )

                    # Log tool use blocks
                    if msg_type == "ToolUseBlock" or (
                        hasattr(msg, "type") and msg.type == "tool_use"
                    ):
                        tool_name = getattr(msg, "name", "")
                        tool_id = getattr(msg, "id", "unknown")
                        tool_input = getattr(msg, "input", {})
                        tool_calls += 1

                        # Track tool for result matching
                        pending_tools[tool_id] = tool_name

                        # Track subagent invocations
                        if tool_name == "Task":
                            agent_name = tool_input.get("subagent_type", "unknown")
                            subagent_tool_ids[tool_id] = agent_name

                        # Get human-readable tool input for display
                        tool_input_display = _get_tool_input_display(
                            tool_name, tool_input
                        )

                        # Log via task_logger for frontend display
                        task_logger.tool_start(
                            tool_name,
                            tool_input_display,
                            log_phase,
                            print_to_console=True,
                        )

                        # Also debug log
                        tool_detail = _get_tool_detail(tool_name, tool_input)
                        debug("bmad.agent", tool_detail)

                    # Log tool results
                    if msg_type == "ToolResultBlock" or (
                        hasattr(msg, "type") and msg.type == "tool_result"
                    ):
                        tool_id = getattr(msg, "tool_use_id", "unknown")
                        is_error = getattr(msg, "is_error", False)
                        result_content = getattr(msg, "content", "")

                        # Handle list of content blocks
                        if isinstance(result_content, list):
                            result_content = " ".join(
                                str(getattr(c, "text", c)) for c in result_content
                            )

                        # Get tool name from pending tools
                        tool_name = pending_tools.pop(tool_id, "unknown")
                        result_preview = (
                            str(result_content)[:200].replace("\n", " ").strip()
                        )

                        # Log via task_logger for frontend display
                        task_logger.tool_end(
                            tool_name,
                            success=not is_error,
                            result=result_preview if result_preview else None,
                            detail=str(result_content)
                            if len(str(result_content)) > 200
                            else None,
                            phase=log_phase,
                            print_to_console=False,
                        )

                        if tool_id in subagent_tool_ids:
                            agent_name = subagent_tool_ids[tool_id]
                            status = "❌ ERROR" if is_error else "✅ Complete"
                            debug(
                                "bmad.agent",
                                f"Agent {agent_name} {status}",
                                result=result_preview
                                + ("..." if len(str(result_content)) > 200 else ""),
                            )
                        elif is_error:
                            debug_warning("bmad.agent", f"Tool error: {result_preview}")

                    # Collect text output from AssistantMessage
                    if msg_type == "AssistantMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__

                            # Check for tool use blocks within content
                            if (
                                block_type == "ToolUseBlock"
                                or getattr(block, "type", "") == "tool_use"
                            ):
                                tool_name = getattr(block, "name", "")
                                tool_id = getattr(block, "id", "unknown")
                                tool_input = getattr(block, "input", {})
                                tool_calls += 1

                                # Track tool for result matching
                                if tool_id not in pending_tools:
                                    pending_tools[tool_id] = tool_name

                                if tool_name == "Task":
                                    agent_name = tool_input.get(
                                        "subagent_type", "unknown"
                                    )
                                    if tool_id not in subagent_tool_ids:
                                        subagent_tool_ids[tool_id] = agent_name

                                # Get human-readable tool input for display
                                tool_input_display = _get_tool_input_display(
                                    tool_name, tool_input
                                )

                                # Log via task_logger for frontend display
                                task_logger.tool_start(
                                    tool_name,
                                    tool_input_display,
                                    log_phase,
                                    print_to_console=True,
                                )

                                tool_detail = _get_tool_detail(tool_name, tool_input)
                                debug("bmad.agent", tool_detail)

                            # Collect text
                            if block_type == "TextBlock" and hasattr(block, "text"):
                                bmad_response += block.text
                                print(block.text, end="", flush=True)
                                # Log text to task logger
                                if block.text.strip():
                                    task_logger.log(
                                        block.text,
                                        phase=log_phase,
                                        print_to_console=False,
                                    )

                    # Handle UserMessage with tool results (subagent results)
                    if msg_type == "UserMessage" and hasattr(msg, "content"):
                        for block in msg.content:
                            block_type = type(block).__name__
                            if (
                                block_type == "ToolResultBlock"
                                or getattr(block, "type", "") == "tool_result"
                            ):
                                tool_id = getattr(block, "tool_use_id", "unknown")
                                is_error = getattr(block, "is_error", False)
                                result_content = getattr(block, "content", "")

                                if isinstance(result_content, list):
                                    result_content = " ".join(
                                        str(getattr(c, "text", c))
                                        for c in result_content
                                    )

                                # Get tool name from pending tools
                                tool_name = pending_tools.pop(tool_id, "unknown")
                                result_preview = (
                                    str(result_content)[:200].replace("\n", " ").strip()
                                )

                                # Log via task_logger for frontend display
                                task_logger.tool_end(
                                    tool_name,
                                    success=not is_error,
                                    result=result_preview if result_preview else None,
                                    phase=log_phase,
                                    print_to_console=False,
                                )

                                if tool_id in subagent_tool_ids:
                                    agent_name = subagent_tool_ids[tool_id]
                                    status = "❌ ERROR" if is_error else "✅ Complete"
                                    debug(
                                        "bmad.agent",
                                        f"Agent {agent_name} {status}",
                                        result=result_preview
                                        + (
                                            "..."
                                            if len(str(result_content)) > 200
                                            else ""
                                        ),
                                    )

                full_response += bmad_response + "\n"
                conversation_history.append({"role": "bmad", "content": bmad_response})

                debug_success(
                    "bmad.agent",
                    f"Turn {turn_count} complete",
                    messages=msg_count,
                    tool_calls=tool_calls,
                    response_length=len(bmad_response),
                )

                # Check if phase is complete
                if is_phase_complete(bmad_response):
                    debug_success("bmad.conversation", "Phase complete detected")
                    return "complete", full_response

                # Check if BMAD is waiting for input
                if is_waiting_for_input(bmad_response):
                    debug(
                        "bmad.conversation",
                        "Input request detected, invoking Human Replacement",
                    )

                    # Extract the relevant context for the Human Replacement
                    question_context = extract_question_context(bmad_response)

                    # Log that Human Replacement is being invoked
                    if task_logger:
                        # Use log_with_detail for expandable full content
                        question_preview = (
                            question_context[:150] + "..."
                            if len(question_context) > 150
                            else question_context
                        )
                        task_logger.log_with_detail(
                            content=f"[BMAD Agent] Asking: {question_preview}",
                            detail=question_context,
                            phase=log_phase,
                            subphase="BMAD CONVERSATION",
                            collapsed=True,
                        )
                        task_logger.log(
                            "[Human Replacement Agent] Processing response...",
                            phase=log_phase,
                        )

                    # Get Human Replacement response
                    human_response = await run_human_replacement_response(
                        project_dir=project_dir,
                        spec_dir=spec_dir,
                        phase=phase,
                        task_description=task_description,
                        project_context=project_context,
                        bmad_message=question_context,
                        model=model,
                    )

                    conversation_history.append(
                        {"role": "human", "content": human_response}
                    )
                    full_response += f"\n[Human Response]: {human_response}\n\n"

                    # Log to task_logger for frontend display with expandable detail
                    if task_logger:
                        # Format the human response for clean frontend display
                        response_preview = (
                            human_response[:200] + "..."
                            if len(human_response) > 200
                            else human_response
                        )
                        task_logger.log_with_detail(
                            content=f"[Human Replacement Agent] Response: {response_preview}",
                            detail=human_response,
                            phase=log_phase,
                            subphase="BMAD CONVERSATION",
                            collapsed=True,
                        )

                    print(f"\n[Human Response]: {human_response}\n")

                    # Build context for next turn
                    # Include the BMAD question and human response
                    current_prompt = f"""
Continue the workflow. The previous exchange was:

BMAD Agent: {question_context}

Human Response: {human_response}

Please continue with the next step of the workflow based on this response.
"""
                else:
                    # BMAD completed without asking for input
                    debug_success(
                        "bmad.conversation", "BMAD completed turn without input request"
                    )
                    return "complete", full_response

        except Exception as e:
            debug_error("bmad.conversation", f"Error in conversation turn: {e}")
            return "error", full_response

    debug("bmad.conversation", f"Max turns ({max_turns}) reached")
    return "max_turns", full_response
