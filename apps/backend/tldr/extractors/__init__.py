"""
TLDR Extractors
===============

Language-specific AST extractors for TLDR analysis.
"""

from .base import BaseExtractor
from .python_extractor import PythonExtractor
from .typescript_extractor import TypeScriptExtractor

__all__ = [
    "BaseExtractor",
    "PythonExtractor",
    "TypeScriptExtractor",
]
