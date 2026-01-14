"""
Memory Index
=============

Semantic index for session insights with embedding-based retrieval.
"""

from __future__ import annotations

import json
import logging
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)


@dataclass
class IndexEntry:
    """A single entry in the memory index."""

    insight_id: str
    session_id: str
    insight_type: str
    title: str
    content: str
    embedding: np.ndarray | None = None
    confidence: float = 0.5
    tags: list[str] = field(default_factory=list)
    related_files: list[str] = field(default_factory=list)
    timestamp: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "insight_id": self.insight_id,
            "session_id": self.session_id,
            "insight_type": self.insight_type,
            "title": self.title,
            "content": self.content,
            "embedding": self.embedding.tolist() if self.embedding is not None else None,
            "confidence": self.confidence,
            "tags": self.tags,
            "related_files": self.related_files,
            "timestamp": self.timestamp,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> IndexEntry:
        embedding = None
        if data.get("embedding"):
            embedding = np.array(data["embedding"], dtype=np.float32)
        return cls(
            insight_id=data["insight_id"],
            session_id=data["session_id"],
            insight_type=data["insight_type"],
            title=data["title"],
            content=data["content"],
            embedding=embedding,
            confidence=data.get("confidence", 0.5),
            tags=data.get("tags", []),
            related_files=data.get("related_files", []),
            timestamp=data.get("timestamp", ""),
        )


class MemoryIndex:
    """
    Semantic index for session insights.

    Stores embeddings and metadata for fast similarity search.
    Uses TF-IDF fallback when API embedders are not available.
    """

    def __init__(
        self,
        index_path: Path | None = None,
        dimension: int = 256,
    ):
        self.index_path = index_path or Path.home() / ".auto-claude" / "memory_index.json"
        self.dimension = dimension

        self.entries: list[IndexEntry] = []
        self._embedder: Any = None
        self._id_to_idx: dict[str, int] = {}

        # Load existing index
        self._load()

    def _get_embedder(self) -> Any:
        """Get embedder with lazy initialization."""
        if self._embedder is None:
            try:
                from tldr.semantic.embedder import EmbedderConfig, get_embedder

                config = EmbedderConfig.from_env()
                self._embedder = get_embedder(config)
            except ImportError:
                # Fall back to simple TF-IDF
                from tldr.semantic.embedder import TFIDFEmbedder

                self._embedder = TFIDFEmbedder(dimension=self.dimension)
        return self._embedder

    def _compute_embedding(self, text: str) -> np.ndarray:
        """Compute embedding for text."""
        embedder = self._get_embedder()
        return embedder.embed(text)

    def add_insight(
        self,
        insight_id: str,
        session_id: str,
        insight_type: str,
        title: str,
        content: str,
        confidence: float = 0.5,
        tags: list[str] | None = None,
        related_files: list[str] | None = None,
        timestamp: str = "",
    ) -> None:
        """Add an insight to the index."""
        # Skip if already indexed
        if insight_id in self._id_to_idx:
            return

        # Combine title and content for embedding
        text = f"{title}. {content}"
        embedding = self._compute_embedding(text)

        entry = IndexEntry(
            insight_id=insight_id,
            session_id=session_id,
            insight_type=insight_type,
            title=title,
            content=content,
            embedding=embedding,
            confidence=confidence,
            tags=tags or [],
            related_files=related_files or [],
            timestamp=timestamp,
        )

        self._id_to_idx[insight_id] = len(self.entries)
        self.entries.append(entry)

    def search(
        self,
        query: str,
        limit: int = 10,
        insight_types: list[str] | None = None,
        session_ids: list[str] | None = None,
        tags: list[str] | None = None,
        min_confidence: float = 0.0,
        min_score: float = 0.0,
    ) -> list[tuple[IndexEntry, float]]:
        """
        Search for insights similar to query.

        Args:
            query: Natural language search query
            limit: Maximum results to return
            insight_types: Filter by insight types
            session_ids: Filter by session IDs
            tags: Filter by tags (any match)
            min_confidence: Minimum insight confidence
            min_score: Minimum similarity score

        Returns:
            List of (entry, score) tuples sorted by relevance
        """
        if not self.entries:
            return []

        # Compute query embedding
        query_embedding = self._compute_embedding(query)

        # Compute similarities
        results = []
        for entry in self.entries:
            # Apply filters
            if insight_types and entry.insight_type not in insight_types:
                continue
            if session_ids and entry.session_id not in session_ids:
                continue
            if tags and not any(t in entry.tags for t in tags):
                continue
            if entry.confidence < min_confidence:
                continue

            # Compute similarity
            if entry.embedding is None:
                continue

            score = self._cosine_similarity(query_embedding, entry.embedding)
            if score >= min_score:
                results.append((entry, float(score)))

        # Sort by score
        results.sort(key=lambda x: x[1], reverse=True)

        return results[:limit]

    def get_similar_insights(
        self,
        insight_id: str,
        limit: int = 5,
        exclude_same_session: bool = False,
    ) -> list[tuple[IndexEntry, float]]:
        """
        Find insights similar to a given insight.

        Useful for discovering patterns across sessions.
        """
        if insight_id not in self._id_to_idx:
            return []

        idx = self._id_to_idx[insight_id]
        source = self.entries[idx]

        if source.embedding is None:
            return []

        results = []
        for i, entry in enumerate(self.entries):
            if i == idx:
                continue
            if exclude_same_session and entry.session_id == source.session_id:
                continue
            if entry.embedding is None:
                continue

            score = self._cosine_similarity(source.embedding, entry.embedding)
            results.append((entry, float(score)))

        results.sort(key=lambda x: x[1], reverse=True)
        return results[:limit]

    def get_patterns_across_sessions(
        self,
        min_similarity: float = 0.7,
        min_occurrences: int = 2,
    ) -> list[dict[str, Any]]:
        """
        Find recurring patterns across different sessions.

        Returns clusters of similar insights that appear in multiple sessions.
        """
        # Build clusters based on similarity
        clusters: list[list[IndexEntry]] = []
        assigned = set()

        for i, entry in enumerate(self.entries):
            if entry.insight_id in assigned:
                continue
            if entry.embedding is None:
                continue

            cluster = [entry]
            assigned.add(entry.insight_id)

            for j, other in enumerate(self.entries):
                if i == j or other.insight_id in assigned:
                    continue
                if other.embedding is None:
                    continue

                score = self._cosine_similarity(entry.embedding, other.embedding)
                if score >= min_similarity:
                    cluster.append(other)
                    assigned.add(other.insight_id)

            if len(cluster) >= min_occurrences:
                clusters.append(cluster)

        # Convert to pattern results
        patterns = []
        for cluster in clusters:
            sessions = list(set(e.session_id for e in cluster))
            if len(sessions) >= min_occurrences:
                patterns.append({
                    "representative_title": cluster[0].title,
                    "representative_content": cluster[0].content,
                    "insight_type": cluster[0].insight_type,
                    "occurrences": len(cluster),
                    "sessions": sessions,
                    "insights": [e.insight_id for e in cluster],
                })

        return patterns

    def _cosine_similarity(self, a: np.ndarray, b: np.ndarray) -> float:
        """Compute cosine similarity between two vectors."""
        norm_a = np.linalg.norm(a)
        norm_b = np.linalg.norm(b)
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(np.dot(a, b) / (norm_a * norm_b))

    def save(self) -> None:
        """Save index to disk."""
        self.index_path.parent.mkdir(parents=True, exist_ok=True)
        data = {
            "dimension": self.dimension,
            "entries": [e.to_dict() for e in self.entries],
        }
        with open(self.index_path, "w") as f:
            json.dump(data, f)
        logger.info(f"Saved memory index with {len(self.entries)} entries to {self.index_path}")

    def _load(self) -> None:
        """Load index from disk."""
        if not self.index_path.exists():
            return

        try:
            with open(self.index_path) as f:
                data = json.load(f)

            self.dimension = data.get("dimension", self.dimension)
            self.entries = [IndexEntry.from_dict(e) for e in data.get("entries", [])]
            self._id_to_idx = {e.insight_id: i for i, e in enumerate(self.entries)}
            logger.info(f"Loaded memory index with {len(self.entries)} entries")
        except (json.JSONDecodeError, OSError) as e:
            logger.warning(f"Failed to load memory index: {e}")

    def rebuild_from_insights(self, insights_dir: Path | None = None) -> int:
        """
        Rebuild the index from insight files.

        Returns the number of insights indexed.
        """
        if insights_dir is None:
            insights_dir = Path.home() / ".auto-claude" / "extracted-insights"

        if not insights_dir.exists():
            return 0

        count = 0
        for insight_file in insights_dir.glob("*.json"):
            if insight_file.name == "extraction_state.json":
                continue

            try:
                with open(insight_file) as f:
                    insights = json.load(f)

                if not isinstance(insights, list):
                    continue

                for insight in insights:
                    if not isinstance(insight, dict):
                        continue

                    self.add_insight(
                        insight_id=insight.get("insight_id", ""),
                        session_id=insight.get("session_id", insight_file.stem),
                        insight_type=insight.get("insight_type", ""),
                        title=insight.get("title", ""),
                        content=insight.get("content", ""),
                        confidence=insight.get("confidence", 0.5),
                        tags=insight.get("tags", []),
                        related_files=insight.get("related_files", []),
                        timestamp=insight.get("timestamp", ""),
                    )
                    count += 1

            except (json.JSONDecodeError, OSError) as e:
                logger.warning(f"Failed to load insights from {insight_file}: {e}")

        self.save()
        return count

    def get_stats(self) -> dict[str, Any]:
        """Get index statistics."""
        by_type: dict[str, int] = {}
        by_session: dict[str, int] = {}

        for entry in self.entries:
            by_type[entry.insight_type] = by_type.get(entry.insight_type, 0) + 1
            by_session[entry.session_id] = by_session.get(entry.session_id, 0) + 1

        return {
            "total_entries": len(self.entries),
            "by_type": by_type,
            "sessions": len(by_session),
            "dimension": self.dimension,
            "index_path": str(self.index_path),
        }
