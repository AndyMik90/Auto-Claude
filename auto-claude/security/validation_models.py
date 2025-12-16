"""
Validation Models and Types
============================

Common types and constants used across validators.
"""

from typing import Callable

# Type alias for validator functions
ValidatorFunction = Callable[[str], tuple[bool, str]]

# Validation result tuple: (is_valid: bool, error_message: str)
ValidationResult = tuple[bool, str]
