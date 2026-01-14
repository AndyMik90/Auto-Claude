"""
TLDR Semantic Search
====================

High-level semantic search interface for codebases.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..analyzer import TLDRAnalyzer
from ..models import TLDRSummary
from .embedder import EmbedderConfig
from .index import IndexEntry, SearchResult, SemanticIndex

logger = logging.getLogger(__name__)


@dataclass
class SemanticSearchResult:
    """Rich search result with context."""

    # Basic info
    file_path: str
    name: str
    entry_type: str
    score: float
    rank: int

    # Context
    signature: str | None = None
    docstring: str | None = None
    line_number: int | None = None

    # Full text that was matched
    matched_text: str = ""

    # Related entries in same file
    related: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "file_path": self.file_path,
            "name": self.name,
            "entry_type": self.entry_type,
            "score": self.score,
            "rank": self.rank,
            "signature": self.signature,
            "docstring": self.docstring,
            "line_number": self.line_number,
            "matched_text": self.matched_text,
            "related": self.related,
        }


def index_tldr_summary(
    index: SemanticIndex,
    summary: TLDRSummary,
) -> int:
    """
    Add a TLDR summary to the semantic index.

    Args:
        index: Semantic index to add to
        summary: TLDR summary to index

    Returns:
        Number of entries added
    """
    file_path = str(Path(summary.file_path).resolve())
    file_hash = summary.file_hash
    entries_added = 0

    # Index each function
    for func in summary.functions:
        # Build searchable text
        text_parts = [func.name]

        if func.docstring:
            text_parts.append(func.docstring)

        # Add parameter names and types
        for param in func.parameters:
            text_parts.append(param.name)
            if param.type_hint:
                text_parts.append(param.type_hint)

        if func.return_type:
            text_parts.append(f"returns {func.return_type}")

        if func.decorators:
            text_parts.extend(func.decorators)

        text = " ".join(text_parts)

        index.add_entry(
            file_path=file_path,
            file_hash=file_hash,
            entry_type="function",
            name=func.name,
            text=text,
            metadata={
                "signature": func.signature_str(),
                "line_number": func.line_start,
                "is_async": func.is_async,
                "decorators": func.decorators,
            },
        )
        entries_added += 1

    # Index each class
    for cls in summary.classes:
        text_parts = [cls.name]

        if cls.docstring:
            text_parts.append(cls.docstring)

        if cls.bases:
            text_parts.extend(cls.bases)

        # Add method names
        for method in cls.methods:
            text_parts.append(method.name)
            if method.docstring:
                text_parts.append(method.docstring)

        text = " ".join(text_parts)

        index.add_entry(
            file_path=file_path,
            file_hash=file_hash,
            entry_type="class",
            name=cls.name,
            text=text,
            metadata={
                "line_number": cls.line_start,
                "bases": cls.bases,
                "method_count": len(cls.methods),
            },
        )
        entries_added += 1

    # Index file-level summary
    file_text_parts = [Path(file_path).stem]

    if summary.module_docstring:
        file_text_parts.append(summary.module_docstring)

    # Add import modules
    for imp in summary.imports:
        file_text_parts.append(imp.module)

    # Add function and class names
    file_text_parts.extend(f.name for f in summary.functions)
    file_text_parts.extend(c.name for c in summary.classes)

    file_text = " ".join(file_text_parts)

    index.add_entry(
        file_path=file_path,
        file_hash=file_hash,
        entry_type="file",
        name=Path(file_path).name,
        text=file_text,
        metadata={
            "language": summary.language,
            "total_lines": summary.total_lines,
            "function_count": len(summary.functions),
            "class_count": len(summary.classes),
        },
    )
    entries_added += 1

    return entries_added


def build_index(
    project_dir: Path | str,
    index: SemanticIndex | None = None,
    analyzer: TLDRAnalyzer | None = None,
    max_files: int = 500,
    include_patterns: list[str] | None = None,
) -> tuple[SemanticIndex, dict[str, Any]]:
    """
    Build semantic index for a project.

    Args:
        project_dir: Project directory to index
        index: Existing index to update (creates new if None)
        analyzer: TLDR analyzer (creates new if None)
        max_files: Maximum files to index
        include_patterns: Glob patterns for files to include

    Returns:
        Tuple of (SemanticIndex, stats dict)
    """
    project_dir = Path(project_dir)

    if index is None:
        index = SemanticIndex(
            index_dir=project_dir / ".auto-claude" / "tldr-index"
        )

    if analyzer is None:
        analyzer = TLDRAnalyzer(project_dir=project_dir)

    # Get TLDR summaries
    summaries = analyzer.analyze_directory(
        directory=project_dir,
        layers=[1, 2],  # Just AST and call graph
        max_files=max_files,
        include_patterns=include_patterns,
    )

    files_indexed = 0
    files_skipped = 0
    entries_added = 0

    for summary in summaries:
        file_path = str(Path(summary.file_path).resolve())

        # Check if file is already indexed with current hash
        if index.is_file_current(file_path, summary.file_hash):
            files_skipped += 1
            continue

        # Remove old entries for this file
        index.remove_file(file_path)

        # Add new entries
        count = index_tldr_summary(index, summary)
        entries_added += count
        files_indexed += 1

    # Save index
    index.save()

    return index, {
        "files_indexed": files_indexed,
        "files_skipped": files_skipped,
        "entries_added": entries_added,
        "total_entries": len(index),
    }


def search_codebase(
    query: str,
    project_dir: Path | str | None = None,
    index: SemanticIndex | None = None,
    limit: int = 10,
    entry_types: list[str] | None = None,
    include_context: bool = True,
) -> list[SemanticSearchResult]:
    """
    Search codebase with natural language query.

    Args:
        query: Natural language query (e.g., "authentication functions")
        project_dir: Project directory (for index location)
        index: Existing index to search
        limit: Maximum results
        entry_types: Filter by types ("function", "class", "file")
        include_context: Include additional context in results

    Returns:
        List of SemanticSearchResult
    """
    if index is None:
        if project_dir is None:
            project_dir = Path.cwd()
        project_dir = Path(project_dir)

        index = SemanticIndex(
            index_dir=project_dir / ".auto-claude" / "tldr-index"
        )

    # Search index
    results = index.search(
        query=query,
        limit=limit,
        entry_types=entry_types,
    )

    # Convert to rich results
    rich_results = []

    for result in results:
        entry = result.entry

        rich_result = SemanticSearchResult(
            file_path=entry.file_path,
            name=entry.name,
            entry_type=entry.entry_type,
            score=result.score,
            rank=result.rank,
            matched_text=entry.text,
            signature=entry.metadata.get("signature"),
            docstring=entry.metadata.get("docstring"),
            line_number=entry.metadata.get("line_number"),
        )

        # Add related entries from same file
        if include_context:
            file_entries = index._file_entries.get(entry.file_path, set())
            related = [
                index._entries[eid].name
                for eid in file_entries
                if eid != entry.entry_id and eid in index._entries
            ][:5]
            rich_result.related = related

        rich_results.append(rich_result)

    return rich_results


def find_similar_code(
    file_path: str,
    name: str,
    project_dir: Path | str | None = None,
    index: SemanticIndex | None = None,
    limit: int = 5,
) -> list[SemanticSearchResult]:
    """
    Find code similar to a given function or class.

    Args:
        file_path: Source file path
        name: Function or class name
        project_dir: Project directory
        index: Existing index
        limit: Maximum results

    Returns:
        List of similar code entries
    """
    if index is None:
        if project_dir is None:
            project_dir = Path.cwd()
        project_dir = Path(project_dir)

        index = SemanticIndex(
            index_dir=project_dir / ".auto-claude" / "tldr-index"
        )

    file_path = str(Path(file_path).resolve())

    # Find the source entry
    source_entry_id = None
    for entry_id, entry in index._entries.items():
        if entry.file_path == file_path and entry.name == name:
            source_entry_id = entry_id
            break

    if source_entry_id is None:
        return []

    # Find similar
    results = index.search_similar(source_entry_id, limit=limit)

    return [
        SemanticSearchResult(
            file_path=r.entry.file_path,
            name=r.entry.name,
            entry_type=r.entry.entry_type,
            score=r.score,
            rank=r.rank,
            matched_text=r.entry.text,
            signature=r.entry.metadata.get("signature"),
            line_number=r.entry.metadata.get("line_number"),
        )
        for r in results
    ]
