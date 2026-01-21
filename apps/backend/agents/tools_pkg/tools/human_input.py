"""
Human Input Tools
=================

Tools for requesting human input during agent execution.
"""

import json
from pathlib import Path
from typing import Any

try:
    from claude_agent_sdk import tool

    SDK_TOOLS_AVAILABLE = True
except ImportError:
    SDK_TOOLS_AVAILABLE = False
    tool = None


def create_human_input_tools(spec_dir: Path, project_dir: Path) -> list:
    """
    Create human input tools.

    Args:
        spec_dir: Path to the spec directory
        project_dir: Path to the project root

    Returns:
        List of human input tool functions
    """
    if not SDK_TOOLS_AVAILABLE:
        return []

    # Import here to avoid circular imports
    from core.human_input import HumanInputManager

    human_input = HumanInputManager(spec_dir)
    tools = []

    # -------------------------------------------------------------------------
    # Tool: request_human_choice
    # -------------------------------------------------------------------------
    @tool(
        "request_human_choice",
        "Request the user to choose one option from a list. Use this when you need a decision on architecture, approach, or implementation strategy. The tool will pause execution until the user responds or times out.",
        {
            "title": {
                "type": "string",
                "description": "Short question title (e.g., 'Authentication Method', 'Database Choice')",
            },
            "description": {
                "type": "string",
                "description": "Detailed description of what you're asking and why",
            },
            "options": {
                "type": "array",
                "items": {
                    "type": "object",
                    "properties": {
                        "id": {
                            "type": "string",
                            "description": "Unique identifier for this option",
                        },
                        "label": {
                            "type": "string",
                            "description": "Display label for the option",
                        },
                        "description": {
                            "type": "string",
                            "description": "Explanation of what this option means",
                        },
                        "recommended": {
                            "type": "boolean",
                            "description": "Whether this is the recommended option",
                        },
                    },
                    "required": ["id", "label"],
                },
                "description": "List of options to choose from (2-5 options)",
            },
            "context": {
                "type": "string",
                "description": "Additional context about why you're asking this question",
            },
        },
    )
    async def request_human_choice(args: dict[str, Any]) -> dict[str, Any]:
        """Request user to choose from options."""
        title = args.get("title", "Question")
        description = args.get("description", "")
        options = args.get("options", [])
        context = args.get("context")

        if len(options) < 2:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: At least 2 options are required for a choice question.",
                    }
                ]
            }

        if len(options) > 5:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: Maximum 5 options allowed for a choice question.",
                    }
                ]
            }

        # Get current phase and subtask from implementation plan
        phase, subtask_id = _get_current_context(spec_dir)

        answer = human_input.request_choice(
            title=title,
            description=description,
            options=options,
            context=context,
            timeout=300,  # 5 minutes
            phase=phase,
            subtask_id=subtask_id,
        )

        if answer is None:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "The question timed out or was skipped by the user. Proceed with your best judgment or the recommended option.",
                    }
                ]
            }

        # Find the selected option details
        selected_option = next(
            (opt for opt in options if opt.get("id") == answer), None
        )
        if selected_option:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"User selected: {selected_option.get('label')} (id: {answer})\n\nProceed with this choice.",
                    }
                ]
            }

        return {
            "content": [{"type": "text", "text": f"User selected option: {answer}"}]
        }

    tools.append(request_human_choice)

    # -------------------------------------------------------------------------
    # Tool: request_human_text
    # -------------------------------------------------------------------------
    @tool(
        "request_human_text",
        "Request free text input from the user. Use this when you need specific information that can't be expressed as a choice, such as API keys, custom configurations, or detailed explanations.",
        {
            "title": {
                "type": "string",
                "description": "Short question title",
            },
            "description": {
                "type": "string",
                "description": "Detailed description of what information you need",
            },
            "placeholder": {
                "type": "string",
                "description": "Placeholder text to show in the input field",
            },
            "context": {
                "type": "string",
                "description": "Additional context about why you need this information",
            },
        },
    )
    async def request_human_text(args: dict[str, Any]) -> dict[str, Any]:
        """Request free text input from user."""
        title = args.get("title", "Question")
        description = args.get("description", "")
        placeholder = args.get("placeholder")
        context = args.get("context")

        phase, subtask_id = _get_current_context(spec_dir)

        answer = human_input.request_text(
            title=title,
            description=description,
            placeholder=placeholder,
            context=context,
            timeout=300,
            phase=phase,
            subtask_id=subtask_id,
        )

        if answer is None:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "The question timed out or was skipped by the user. Proceed with a sensible default or skip this step if possible.",
                    }
                ]
            }

        return {
            "content": [
                {"type": "text", "text": f"User provided: {answer}\n\nProceed with this information."}
            ]
        }

    tools.append(request_human_text)

    # -------------------------------------------------------------------------
    # Tool: request_human_confirm
    # -------------------------------------------------------------------------
    @tool(
        "request_human_confirm",
        "Request a yes/no confirmation from the user. Use this for decisions that have significant consequences, like deleting data, making breaking changes, or proceeding with a risky operation.",
        {
            "title": {
                "type": "string",
                "description": "Short question title",
            },
            "description": {
                "type": "string",
                "description": "Detailed description of what you're asking to confirm",
            },
            "context": {
                "type": "string",
                "description": "Additional context about the implications of this decision",
            },
        },
    )
    async def request_human_confirm(args: dict[str, Any]) -> dict[str, Any]:
        """Request yes/no confirmation from user."""
        title = args.get("title", "Confirmation")
        description = args.get("description", "")
        context = args.get("context")

        phase, subtask_id = _get_current_context(spec_dir)

        answer = human_input.request_confirm(
            title=title,
            description=description,
            context=context,
            timeout=300,
            phase=phase,
            subtask_id=subtask_id,
        )

        if answer is None:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "The confirmation timed out or was skipped. Do NOT proceed with the risky operation. Choose a safer alternative.",
                    }
                ]
            }

        if answer:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "User confirmed: YES. You may proceed with the operation.",
                    }
                ]
            }
        else:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "User confirmed: NO. Do not proceed with this operation. Find an alternative approach.",
                    }
                ]
            }

    tools.append(request_human_confirm)

    return tools


def _get_current_context(spec_dir: Path) -> tuple[str | None, str | None]:
    """
    Get current phase and subtask from implementation plan.

    Returns:
        Tuple of (phase, subtask_id) or (None, None) if not found
    """
    plan_file = spec_dir / "implementation_plan.json"
    if not plan_file.exists():
        return None, None

    try:
        with open(plan_file) as f:
            plan = json.load(f)

        for phase in plan.get("phases", []):
            phase_id = phase.get("id") or phase.get("phase")
            for subtask in phase.get("subtasks", []):
                if subtask.get("status") == "in_progress":
                    return phase_id, subtask.get("id")

        return None, None
    except (json.JSONDecodeError, IOError):
        return None, None
