"""
Terminal Capability Detection
==============================

Detects terminal capabilities for:
- Unicode support
- ANSI color support
- Interactive input support
"""

import os
import sys


def _is_fancy_ui_enabled() -> bool:
    """Check if fancy UI is enabled via environment variable."""
    value = os.environ.get("ENABLE_FANCY_UI", "true").lower()
    return value in ("true", "1", "yes", "on")


def supports_unicode() -> bool:
    """Check if terminal supports Unicode."""
    if not _is_fancy_ui_enabled():
        return False
    encoding = getattr(sys.stdout, "encoding", "") or ""
    return encoding.lower() in ("utf-8", "utf8")


def supports_color() -> bool:
    """Check if terminal supports ANSI colors."""
    if not _is_fancy_ui_enabled():
        return False
    # Check for explicit disable
    if os.environ.get("NO_COLOR"):
        return False
    if os.environ.get("FORCE_COLOR"):
        return True
    # Check if stdout is a TTY
    if not hasattr(sys.stdout, "isatty") or not sys.stdout.isatty():
        return False
    # Check TERM
    term = os.environ.get("TERM", "")
    if term == "dumb":
        return False
    return True


def supports_interactive() -> bool:
    """Check if terminal supports interactive input."""
    if not _is_fancy_ui_enabled():
        return False
    return hasattr(sys.stdin, "isatty") and sys.stdin.isatty()


# Cache capability checks
FANCY_UI = _is_fancy_ui_enabled()
UNICODE = supports_unicode()
COLOR = supports_color()
INTERACTIVE = supports_interactive()
