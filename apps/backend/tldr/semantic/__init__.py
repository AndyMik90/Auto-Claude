"""
TLDR Semantic Index
===================

Semantic search over TLDR code summaries using embeddings.

Features:
- Natural language queries ("find authentication functions")
- Multiple embedding backends (OpenAI, Ollama, local)
- File-hash based cache invalidation
- Persistent index storage
"""

from .index import SemanticIndex
from .embedder import EmbedderConfig, get_embedder
from .search import SemanticSearchResult, search_codebase

__all__ = [
    "SemanticIndex",
    "EmbedderConfig",
    "get_embedder",
    "SemanticSearchResult",
    "search_codebase",
]
