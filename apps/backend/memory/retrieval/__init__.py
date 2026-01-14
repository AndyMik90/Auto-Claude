"""
Memory Retrieval System
=======================

Semantic search and retrieval over extracted session insights.

Features:
- Semantic similarity search using embeddings
- Multi-field filtering (type, session, tags)
- Cross-session pattern discovery
- Relevance-ranked results
"""

from .index import MemoryIndex
from .search import MemorySearch, SearchResult

__all__ = [
    "MemoryIndex",
    "MemorySearch",
    "SearchResult",
]
