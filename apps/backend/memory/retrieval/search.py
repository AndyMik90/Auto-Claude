"""
Memory Search Interface
=======================

High-level search interface for querying session insights.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from .index import IndexEntry, MemoryIndex

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """A search result with relevance score."""

    insight_id: str
    session_id: str
    insight_type: str
    title: str
    content: str
    score: float
    confidence: float = 0.5
    tags: list[str] = field(default_factory=list)
    related_files: list[str] = field(default_factory=list)
    timestamp: str = ""

    @classmethod
    def from_entry(cls, entry: IndexEntry, score: float) -> SearchResult:
        return cls(
            insight_id=entry.insight_id,
            session_id=entry.session_id,
            insight_type=entry.insight_type,
            title=entry.title,
            content=entry.content,
            score=score,
            confidence=entry.confidence,
            tags=entry.tags,
            related_files=entry.related_files,
            timestamp=entry.timestamp,
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "insight_id": self.insight_id,
            "session_id": self.session_id,
            "insight_type": self.insight_type,
            "title": self.title,
            "content": self.content,
            "score": self.score,
            "confidence": self.confidence,
            "tags": self.tags,
            "related_files": self.related_files,
            "timestamp": self.timestamp,
        }


class MemorySearch:
    """
    High-level interface for searching session memories.

    Provides natural language search, filtering, and pattern discovery.
    """

    def __init__(self, index_path: Path | None = None):
        self.index = MemoryIndex(index_path=index_path)

    def search(
        self,
        query: str,
        limit: int = 10,
        insight_types: list[str] | None = None,
        session_ids: list[str] | None = None,
        tags: list[str] | None = None,
        min_score: float = 0.0,
    ) -> list[SearchResult]:
        """
        Search for insights matching a natural language query.

        Args:
            query: Natural language search query
            limit: Maximum results to return
            insight_types: Filter by types (gotcha, pattern, discovery, etc.)
            session_ids: Filter by specific sessions
            tags: Filter by tags (any match)
            min_score: Minimum similarity score threshold

        Returns:
            List of SearchResult objects sorted by relevance
        """
        results = self.index.search(
            query=query,
            limit=limit,
            insight_types=insight_types,
            session_ids=session_ids,
            tags=tags,
            min_score=min_score,
        )

        return [SearchResult.from_entry(entry, score) for entry, score in results]

    def find_gotchas(self, query: str | None = None, limit: int = 10) -> list[SearchResult]:
        """Find gotchas and pitfalls relevant to a query."""
        if query:
            return self.search(
                query=query,
                limit=limit,
                insight_types=["gotcha", "failure", "workaround"],
            )
        else:
            # Return all gotchas sorted by confidence
            results = self.index.search(
                query="error issue problem bug",
                limit=limit,
                insight_types=["gotcha", "failure", "workaround"],
            )
            return [SearchResult.from_entry(entry, score) for entry, score in results]

    def find_patterns(self, query: str | None = None, limit: int = 10) -> list[SearchResult]:
        """Find patterns and best practices relevant to a query."""
        if query:
            return self.search(
                query=query,
                limit=limit,
                insight_types=["pattern", "recommendation", "success"],
            )
        else:
            results = self.index.search(
                query="pattern approach solution",
                limit=limit,
                insight_types=["pattern", "recommendation", "success"],
            )
            return [SearchResult.from_entry(entry, score) for entry, score in results]

    def find_similar_insights(
        self,
        insight_id: str,
        limit: int = 5,
        cross_session: bool = True,
    ) -> list[SearchResult]:
        """
        Find insights similar to a given insight.

        Args:
            insight_id: The insight to find similar insights for
            limit: Maximum results
            cross_session: If True, only return insights from other sessions

        Returns:
            List of similar insights
        """
        results = self.index.get_similar_insights(
            insight_id=insight_id,
            limit=limit,
            exclude_same_session=cross_session,
        )
        return [SearchResult.from_entry(entry, score) for entry, score in results]

    def discover_patterns(
        self,
        min_similarity: float = 0.7,
        min_occurrences: int = 2,
    ) -> list[dict[str, Any]]:
        """
        Discover recurring patterns across sessions.

        Returns clusters of similar insights that appear in multiple sessions.
        """
        return self.index.get_patterns_across_sessions(
            min_similarity=min_similarity,
            min_occurrences=min_occurrences,
        )

    def get_context_for_task(
        self,
        task_description: str,
        limit: int = 5,
    ) -> dict[str, list[SearchResult]]:
        """
        Get relevant context for a new task.

        Searches for:
        - Similar past work
        - Related gotchas to avoid
        - Relevant patterns to follow

        Returns:
            Dict with 'relevant', 'gotchas', and 'patterns' keys
        """
        relevant = self.search(query=task_description, limit=limit)

        gotchas = self.find_gotchas(query=task_description, limit=3)

        patterns = self.find_patterns(query=task_description, limit=3)

        return {
            "relevant": relevant,
            "gotchas": gotchas,
            "patterns": patterns,
        }

    def rebuild_index(self, insights_dir: Path | None = None) -> int:
        """
        Rebuild the search index from insight files.

        Returns the number of insights indexed.
        """
        return self.index.rebuild_from_insights(insights_dir)

    def get_stats(self) -> dict[str, Any]:
        """Get search index statistics."""
        return self.index.get_stats()


# Convenience functions for quick searches

def search_memories(
    query: str,
    limit: int = 10,
    insight_types: list[str] | None = None,
) -> list[SearchResult]:
    """
    Quickly search session memories.

    Example:
        results = search_memories("authentication errors")
        for r in results:
            print(f"{r.title} (score: {r.score:.2f})")
    """
    search = MemorySearch()
    return search.search(query=query, limit=limit, insight_types=insight_types)


def get_relevant_context(task: str) -> dict[str, list[SearchResult]]:
    """
    Get relevant context from past sessions for a new task.

    Example:
        context = get_relevant_context("Implement user authentication")
        for gotcha in context['gotchas']:
            print(f"Watch out: {gotcha.title}")
    """
    search = MemorySearch()
    return search.get_context_for_task(task)


def discover_cross_session_patterns() -> list[dict[str, Any]]:
    """
    Discover patterns that appear across multiple sessions.

    Useful for finding common issues or approaches.
    """
    search = MemorySearch()
    return search.discover_patterns()
