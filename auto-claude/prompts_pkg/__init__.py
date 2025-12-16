"""
Prompts Module
==============

Prompt generation and templates for AI interactions.
"""

# Import all functions from prompt_generator
from .prompt_generator import (
    format_context_for_prompt,
    generate_environment_context,
    generate_planner_prompt,
    generate_subtask_prompt,
    get_relative_spec_path,
    load_subtask_context,
)

# Import all functions from prompts
from .prompts import (
    get_coding_prompt,
    get_followup_planner_prompt,
    get_planner_prompt,
    is_first_run,
)

__all__ = [
    # prompt_generator functions
    "get_relative_spec_path",
    "generate_environment_context",
    "generate_subtask_prompt",
    "generate_planner_prompt",
    "load_subtask_context",
    "format_context_for_prompt",
    # prompts functions
    "get_planner_prompt",
    "get_coding_prompt",
    "get_followup_planner_prompt",
    "is_first_run",
]
