"""
Playwright SDK Integration
===========================

Provides Playwright tools for Claude Agent SDK with execution handlers.
"""

import asyncio
import logging

from .executor import execute_playwright_tool
from .tools import get_playwright_tools

logger = logging.getLogger(__name__)


def _create_handler(tool_name: str):
    """
    Create handler function for a specific Playwright tool.
    Uses factory pattern to avoid closure issues.

    Args:
        tool_name: Name of the Playwright tool

    Returns:
        Async handler function
    """

    async def handler(tool_input: dict):
        """Execute Playwright tool."""
        return await execute_playwright_tool(tool_name, tool_input)

    handler.__name__ = f"{tool_name}_handler"
    return handler


def get_playwright_custom_tools():
    """
    Get Playwright tools as Claude Agent SDK custom tools.

    Returns list of dicts with:
    - tool schema (name, description, input_schema)
    - async handler function

    Returns:
        List of custom tool definitions for ClaudeAgentOptions
    """
    schemas = get_playwright_tools()

    # Create custom tools with handlers using factory pattern
    custom_tools = []
    for schema in schemas:
        tool_name = schema["name"]
        custom_tools.append({
            "schema": schema,
            "handler": _create_handler(tool_name),
        })

    return custom_tools


# Alternative: Create handlers dict for manual routing
PLAYWRIGHT_HANDLERS = {
    "playwright_navigate": lambda input: execute_playwright_tool(
        "playwright_navigate", input
    ),
    "playwright_screenshot": lambda input: execute_playwright_tool(
        "playwright_screenshot", input
    ),
    "playwright_click": lambda input: execute_playwright_tool("playwright_click", input),
    "playwright_fill": lambda input: execute_playwright_tool("playwright_fill", input),
    "playwright_assert": lambda input: execute_playwright_tool(
        "playwright_assert", input
    ),
    "playwright_get_console": lambda input: execute_playwright_tool(
        "playwright_get_console", input
    ),
    "playwright_create_test": lambda input: execute_playwright_tool(
        "playwright_create_test", input
    ),
}
