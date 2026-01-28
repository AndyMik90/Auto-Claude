"""
Feature Flags and Environment Configuration
============================================

Centralized configuration for feature flags read from environment variables.
This module has no dependencies on other core modules to avoid circular imports.
"""

import os


def should_use_claude_md() -> bool:
    """
    Check if CLAUDE.md instructions should be included in system prompt.

    Returns:
        True if USE_CLAUDE_MD environment variable is set to "true"
    """
    return os.environ.get("USE_CLAUDE_MD", "").lower() == "true"


def should_use_claude_rules() -> bool:
    """
    Check if .claude/rules/ should be loaded based on environment settings.

    When USE_CLAUDE_MD is enabled, rules are also enabled by default.
    Can be explicitly disabled with USE_CLAUDE_RULES=false.

    Returns:
        True if rules should be loaded
    """
    explicit_setting = os.environ.get("USE_CLAUDE_RULES", "").lower()
    if explicit_setting == "false":
        return False
    if explicit_setting == "true":
        return True
    # Default: enabled if USE_CLAUDE_MD is enabled
    return should_use_claude_md()
