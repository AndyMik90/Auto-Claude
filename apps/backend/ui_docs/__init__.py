"""
UI Framework Documentation Module
==================================

Automatically fetches and caches UI framework documentation for autonomous agents.
Uses Firecrawl to scrape documentation sites and stores them locally.
"""

from .fetcher import fetch_ui_framework_docs, get_cached_docs_path

__all__ = ["fetch_ui_framework_docs", "get_cached_docs_path"]
