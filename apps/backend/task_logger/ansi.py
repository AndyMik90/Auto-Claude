"""
ANSI escape code utilities for task logging.

This module contains functions for stripping ANSI escape codes from strings.
It has no dependencies on other task_logger modules to avoid cyclic imports.
"""

import re

# ANSI escape code patterns
# ANSI CSI (Control Sequence Introducer) escape sequence pattern.
# Matches: \x1b[ followed by optional private mode chars (?<>=), parameters,
# and ending with a command byte
# Examples: \x1b[31m (red), \x1b[?25l (hide cursor), \x1b[=1h (application keypad)
ANSI_CSI_PATTERN = re.compile(r"\x1b\[[?><=0-9;]*[A-Za-z]")

# OSC (Operating System Command) escape sequences with BEL (bell) terminator
# Matches: \x1b] ... \x07
ANSI_OSC_BEL_PATTERN = re.compile(r"\x1b\][^\x07]*\x07")

# OSC (Operating System Command) escape sequences with ST (string terminator)
# Matches: \x1b] ... \x1b\
ANSI_OSC_ST_PATTERN = re.compile(r"\x1b\][^\x1b]*\x1b\\")


def strip_ansi_codes(text: str | None) -> str:
    """
    Removes ANSI escape codes from a string.

    These sequences are used for terminal coloring/formatting but appear
    as raw text in logs and UI components.

    Args:
        text: The string potentially containing ANSI escape codes, or None

    Returns:
        The string with all ANSI escape sequences removed, or empty string if input is None

    Example:
        >>> strip_ansi_codes('\\x1b[90m[21:40:22.196]\\x1b[0m \\x1b[36m[DEBUG]\\x1b[0m')
        '[21:40:22.196] [DEBUG]'
    """
    if not text:
        return ""

    # Remove all ANSI escape sequences
    result = ANSI_CSI_PATTERN.sub("", text)
    result = ANSI_OSC_BEL_PATTERN.sub("", result)
    result = ANSI_OSC_ST_PATTERN.sub("", result)

    return result
