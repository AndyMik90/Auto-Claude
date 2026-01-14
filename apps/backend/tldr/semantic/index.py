"""
TLDR Semantic Index
===================

Persistent semantic search index for TLDR code summaries.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import numpy as np

from .embedder import BaseEmbedder, EmbedderConfig, cosine_similarity, get_embedder

logger = logging.getLogger(__name__)


@dataclass
class IndexEntry:
    """A single entry in the semantic index."""

    # Unique identifier
    entry_id: str

    # Source file path
    file_path: str

    # File hash for cache invalidation
    file_hash: str

    # Entry type: "function", "class", "file", "import"
    entry_type: str

    # Name (function name, class name, etc.)
    name: str

    # Text that was embedded
    text: str

    # Embedding vector (stored as list for JSON serialization)
    embedding: list[float]

    # Additional metadata
    metadata: dict[str, Any] = field(default_factory=dict)

    # Timestamp
    created_at: float = field(default_factory=time.time)

    def to_dict(self) -> dict[str, Any]:
        return {
            "entry_id": self.entry_id,
            "file_path": self.file_path,
            "file_hash": self.file_hash,
            "entry_type": self.entry_type,
            "name": self.name,
            "text": self.text,
            "embedding": self.embedding,
            "metadata": self.metadata,
            "created_at": self.created_at,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> IndexEntry:
        return cls(
            entry_id=data["entry_id"],
            file_path=data["file_path"],
            file_hash=data["file_hash"],
            entry_type=data["entry_type"],
            name=data["name"],
            text=data["text"],
            embedding=data["embedding"],
            metadata=data.get("metadata", {}),
            created_at=data.get("created_at", time.time()),
        )


@dataclass
class SearchResult:
    """A search result from the semantic index."""

    entry: IndexEntry
    score: float
    rank: int


class SemanticIndex:
    """
    Persistent semantic search index for TLDR summaries.

    Features:
    - Embeddings for functions, classes, and file summaries
    - Natural language query support
    - File-hash based cache invalidation
    - Disk persistence with memory cache
    """

    def __init__(
        self,
        index_dir: Path | str | None = None,
        embedder_config: EmbedderConfig | None = None,
    ):
        if index_dir is None:
            index_dir = Path.home() / ".auto-claude" / "tldr-index"

        self.index_dir = Path(index_dir)
        self.index_dir.mkdir(parents=True, exist_ok=True)

        self.embedder = get_embedder(embedder_config)

        # In-memory cache
        self._entries: dict[str, IndexEntry] = {}
        self._file_entries: dict[str, set[str]] = {}  # file_path -> entry_ids

        # Load existing index
        self._load_index()

    def _get_index_file(self) -> Path:
        """Get path to index file."""
        return self.index_dir / "semantic_index.json"

    def _load_index(self) -> None:
        """Load index from disk."""
        index_file = self._get_index_file()

        if not index_file.exists():
            return

        try:
            data = json.loads(index_file.read_text())

            # Check embedder compatibility
            stored_dims = data.get("embedder_dimensions")
            if stored_dims and stored_dims != self.embedder.dimensions:
                logger.warning(
                    f"Embedder dimensions changed ({stored_dims} -> {self.embedder.dimensions}), "
                    "rebuilding index"
                )
                return

            for entry_data in data.get("entries", []):
                entry = IndexEntry.from_dict(entry_data)
                self._entries[entry.entry_id] = entry

                if entry.file_path not in self._file_entries:
                    self._file_entries[entry.file_path] = set()
                self._file_entries[entry.file_path].add(entry.entry_id)

            logger.debug(f"Loaded {len(self._entries)} entries from index")

        except (json.JSONDecodeError, KeyError) as e:
            logger.warning(f"Failed to load index: {e}")

    def _save_index(self) -> None:
        """Save index to disk."""
        index_file = self._get_index_file()

        data = {
            "embedder_dimensions": self.embedder.dimensions,
            "embedder_type": type(self.embedder).__name__,
            "entry_count": len(self._entries),
            "updated_at": time.time(),
            "entries": [entry.to_dict() for entry in self._entries.values()],
        }

        index_file.write_text(json.dumps(data))

    def _generate_entry_id(self, file_path: str, entry_type: str, name: str) -> str:
        """Generate unique entry ID."""
        content = f"{file_path}:{entry_type}:{name}"
        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def add_entry(
        self,
        file_path: str,
        file_hash: str,
        entry_type: str,
        name: str,
        text: str,
        metadata: dict[str, Any] | None = None,
    ) -> IndexEntry:
        """
        Add an entry to the index.

        Args:
            file_path: Source file path
            file_hash: File content hash for cache invalidation
            entry_type: Type (function, class, file, import)
            name: Name of the entity
            text: Text to embed (signature, docstring, etc.)
            metadata: Additional metadata

        Returns:
            Created IndexEntry
        """
        entry_id = self._generate_entry_id(file_path, entry_type, name)

        # Generate embedding
        embedding = self.embedder.embed(text)

        entry = IndexEntry(
            entry_id=entry_id,
            file_path=file_path,
            file_hash=file_hash,
            entry_type=entry_type,
            name=name,
            text=text,
            embedding=embedding.tolist(),
            metadata=metadata or {},
        )

        self._entries[entry_id] = entry

        if file_path not in self._file_entries:
            self._file_entries[file_path] = set()
        self._file_entries[file_path].add(entry_id)

        return entry

    def remove_file(self, file_path: str) -> int:
        """
        Remove all entries for a file.

        Args:
            file_path: File path to remove

        Returns:
            Number of entries removed
        """
        file_path = str(Path(file_path).resolve())

        if file_path not in self._file_entries:
            return 0

        entry_ids = self._file_entries.pop(file_path)
        for entry_id in entry_ids:
            if entry_id in self._entries:
                del self._entries[entry_id]

        return len(entry_ids)

    def is_file_current(self, file_path: str, file_hash: str) -> bool:
        """
        Check if a file's entries are current.

        Args:
            file_path: File path
            file_hash: Current file hash

        Returns:
            True if entries exist and have matching hash
        """
        file_path = str(Path(file_path).resolve())

        if file_path not in self._file_entries:
            return False

        entry_ids = self._file_entries[file_path]
        if not entry_ids:
            return False

        # Check first entry's hash
        first_id = next(iter(entry_ids))
        if first_id in self._entries:
            return self._entries[first_id].file_hash == file_hash

        return False

    def search(
        self,
        query: str,
        limit: int = 10,
        entry_types: list[str] | None = None,
        file_patterns: list[str] | None = None,
        min_score: float = 0.0,
    ) -> list[SearchResult]:
        """
        Search the index with a natural language query.

        Args:
            query: Natural language query
            limit: Maximum results to return
            entry_types: Filter by entry types (function, class, etc.)
            file_patterns: Filter by file path patterns
            min_score: Minimum similarity score (0-1)

        Returns:
            List of SearchResult sorted by score
        """
        if not self._entries:
            return []

        # Generate query embedding
        query_embedding = self.embedder.embed(query)

        results = []

        for entry in self._entries.values():
            # Filter by entry type
            if entry_types and entry.entry_type not in entry_types:
                continue

            # Filter by file pattern
            if file_patterns:
                matches = any(
                    pattern in entry.file_path for pattern in file_patterns
                )
                if not matches:
                    continue

            # Calculate similarity
            entry_embedding = np.array(entry.embedding)
            score = cosine_similarity(query_embedding, entry_embedding)

            if score >= min_score:
                results.append((entry, score))

        # Sort by score descending
        results.sort(key=lambda x: x[1], reverse=True)

        # Limit and convert to SearchResult
        return [
            SearchResult(entry=entry, score=score, rank=i + 1)
            for i, (entry, score) in enumerate(results[:limit])
        ]

    def search_similar(
        self,
        entry_id: str,
        limit: int = 10,
        min_score: float = 0.0,
    ) -> list[SearchResult]:
        """
        Find entries similar to a given entry.

        Args:
            entry_id: Entry ID to find similar entries for
            limit: Maximum results
            min_score: Minimum similarity score

        Returns:
            List of similar entries
        """
        if entry_id not in self._entries:
            return []

        source_entry = self._entries[entry_id]
        source_embedding = np.array(source_entry.embedding)

        results = []

        for entry in self._entries.values():
            if entry.entry_id == entry_id:
                continue

            entry_embedding = np.array(entry.embedding)
            score = cosine_similarity(source_embedding, entry_embedding)

            if score >= min_score:
                results.append((entry, score))

        results.sort(key=lambda x: x[1], reverse=True)

        return [
            SearchResult(entry=entry, score=score, rank=i + 1)
            for i, (entry, score) in enumerate(results[:limit])
        ]

    def save(self) -> None:
        """Save index to disk."""
        self._save_index()

    def clear(self) -> None:
        """Clear all entries."""
        self._entries.clear()
        self._file_entries.clear()
        self._save_index()

    def get_stats(self) -> dict[str, Any]:
        """Get index statistics."""
        entry_types: dict[str, int] = {}
        file_count = len(self._file_entries)

        for entry in self._entries.values():
            entry_types[entry.entry_type] = entry_types.get(entry.entry_type, 0) + 1

        return {
            "total_entries": len(self._entries),
            "file_count": file_count,
            "entry_types": entry_types,
            "embedder_type": type(self.embedder).__name__,
            "embedder_dimensions": self.embedder.dimensions,
            "index_dir": str(self.index_dir),
        }

    def __len__(self) -> int:
        return len(self._entries)
