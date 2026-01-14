"""
TLDR Analyzer
=============

Main coordinator for multi-layer code analysis.
"""

from __future__ import annotations

import logging
import time
from pathlib import Path
from typing import Any

from .models import TLDRSummary, AnalysisLayer
from .extractors.base import BaseExtractor
from .extractors.python_extractor import PythonExtractor
from .extractors.typescript_extractor import TypeScriptExtractor
from .cache import TLDRCache

logger = logging.getLogger(__name__)


class TLDRAnalyzer:
    """
    Main TLDR analyzer that coordinates multi-layer extraction.

    Usage:
        analyzer = TLDRAnalyzer(project_dir)
        summary = analyzer.analyze_file("src/main.py", layers=[1, 2, 3])
        print(summary.to_compact())
    """

    # Registered extractors
    _extractors: list[type[BaseExtractor]] = [
        PythonExtractor,
        TypeScriptExtractor,
    ]

    def __init__(
        self,
        project_dir: Path | str | None = None,
        cache_dir: Path | str | None = None,
        enable_cache: bool = True,
    ):
        self.project_dir = Path(project_dir) if project_dir else Path.cwd()
        self.cache = TLDRCache(cache_dir) if enable_cache else None

        # Initialize extractors
        self.extractors = [
            extractor_class(self.project_dir)
            for extractor_class in self._extractors
        ]

    def get_extractor(self, file_path: Path) -> BaseExtractor | None:
        """Get the appropriate extractor for a file."""
        for extractor in self.extractors:
            if extractor.can_handle(file_path):
                return extractor
        return None

    def analyze_file(
        self,
        file_path: str | Path,
        layers: list[int] | None = None,
        use_cache: bool = True,
    ) -> TLDRSummary:
        """
        Analyze a single file and return TLDR summary.

        Args:
            file_path: Path to the file to analyze
            layers: Which layers to include (1-5). Default: [1, 2, 3]
            use_cache: Whether to use cached results

        Returns:
            TLDRSummary with extracted information
        """
        file_path = Path(file_path)
        if not file_path.is_absolute():
            file_path = self.project_dir / file_path

        if not file_path.exists():
            return self._error_summary(file_path, "File not found")

        # Default layers
        if layers is None:
            layers = [1, 2, 3]

        # Read file content
        try:
            content = file_path.read_text(encoding="utf-8", errors="replace")
        except Exception as e:
            return self._error_summary(file_path, f"Read error: {e}")

        # Check cache
        file_hash = self._compute_hash(content)
        cache_key = f"{file_path}:{','.join(map(str, sorted(layers)))}"

        if use_cache and self.cache:
            cached = self.cache.get(cache_key, file_hash)
            if cached:
                logger.debug(f"Cache hit for {file_path}")
                return cached

        # Get extractor
        extractor = self.get_extractor(file_path)
        if not extractor:
            return self._error_summary(
                file_path, f"No extractor for {file_path.suffix}"
            )

        # Perform analysis
        start_time = time.perf_counter()
        summary = self._extract_layers(
            extractor, content, file_path, file_hash, layers
        )
        summary.analysis_time_ms = (time.perf_counter() - start_time) * 1000

        # Cache result
        if self.cache:
            self.cache.set(cache_key, file_hash, summary)

        return summary

    def analyze_directory(
        self,
        directory: str | Path | None = None,
        layers: list[int] | None = None,
        include_patterns: list[str] | None = None,
        exclude_patterns: list[str] | None = None,
        max_files: int = 100,
    ) -> list[TLDRSummary]:
        """
        Analyze all supported files in a directory.

        Args:
            directory: Directory to analyze (default: project_dir)
            layers: Which layers to include
            include_patterns: Glob patterns to include (e.g., ["*.py", "*.ts"])
            exclude_patterns: Glob patterns to exclude (e.g., ["**/node_modules/**"])
            max_files: Maximum number of files to analyze

        Returns:
            List of TLDRSummary objects
        """
        directory = Path(directory) if directory else self.project_dir

        # Default patterns
        if include_patterns is None:
            include_patterns = ["**/*.py", "**/*.ts", "**/*.tsx", "**/*.js"]

        if exclude_patterns is None:
            exclude_patterns = [
                "**/node_modules/**",
                "**/__pycache__/**",
                "**/venv/**",
                "**/.venv/**",
                "**/dist/**",
                "**/build/**",
                "**/.git/**",
            ]

        # Collect files
        files = []
        for pattern in include_patterns:
            for file_path in directory.glob(pattern):
                if file_path.is_file():
                    # Check exclusions
                    excluded = any(
                        file_path.match(excl) for excl in exclude_patterns
                    )
                    if not excluded:
                        files.append(file_path)

        # Limit files
        files = files[:max_files]

        # Analyze each file
        summaries = []
        for file_path in files:
            try:
                summary = self.analyze_file(file_path, layers=layers)
                summaries.append(summary)
            except Exception as e:
                logger.warning(f"Error analyzing {file_path}: {e}")
                summaries.append(self._error_summary(file_path, str(e)))

        return summaries

    def get_project_summary(
        self,
        directory: str | Path | None = None,
        layers: list[int] | None = None,
    ) -> dict[str, Any]:
        """
        Get a high-level summary of the entire project.

        Returns aggregate statistics and key entry points.
        """
        summaries = self.analyze_directory(directory, layers=layers or [1])

        total_lines = sum(s.total_lines for s in summaries)
        total_functions = sum(len(s.functions) for s in summaries)
        total_classes = sum(len(s.classes) for s in summaries)
        original_tokens = sum(s.original_tokens for s in summaries)
        summary_tokens = sum(s.summary_tokens for s in summaries)

        # Find entry points (files with main or __main__)
        entry_points = []
        for s in summaries:
            for func in s.functions:
                if func.name in ("main", "__main__"):
                    entry_points.append(s.file_path)
                    break

        # Find most connected files (by call graph)
        file_connections: dict[str, int] = {}
        for s in summaries:
            file_connections[s.file_path] = len(s.external_calls)

        top_connected = sorted(
            file_connections.items(), key=lambda x: x[1], reverse=True
        )[:10]

        return {
            "files_analyzed": len(summaries),
            "total_lines": total_lines,
            "total_functions": total_functions,
            "total_classes": total_classes,
            "original_tokens": original_tokens,
            "summary_tokens": summary_tokens,
            "token_savings_percent": (
                (1 - summary_tokens / original_tokens) * 100
                if original_tokens > 0
                else 0
            ),
            "entry_points": entry_points,
            "most_connected_files": top_connected,
            "languages": list(set(s.language for s in summaries)),
            "errors": [s.file_path for s in summaries if s.errors],
        }

    def _extract_layers(
        self,
        extractor: BaseExtractor,
        content: str,
        file_path: Path,
        file_hash: str,
        layers: list[int],
    ) -> TLDRSummary:
        """Extract requested layers from the file."""
        total_lines = content.count("\n") + 1
        original_tokens = extractor.estimate_tokens(content)

        summary = TLDRSummary(
            file_path=str(file_path),
            language=extractor.language,
            file_hash=file_hash,
            total_lines=total_lines,
            original_tokens=original_tokens,
            summary_tokens=0,
            layers_included=sorted(layers),
        )

        try:
            # L1: AST Layer (always extracted as base)
            if 1 in layers:
                l1_result = extractor.extract_l1_ast(content, file_path)
                summary.imports = l1_result.get("imports", [])
                summary.functions = l1_result.get("functions", [])
                summary.classes = l1_result.get("classes", [])
                summary.module_docstring = l1_result.get("module_docstring")
                summary.global_variables = l1_result.get("global_variables", [])

                if "error" in l1_result:
                    summary.errors.append(l1_result["error"])

            # L2: Call Graph
            if 2 in layers and 1 in layers:
                l2_result = extractor.extract_l2_call_graph(
                    content, file_path, summary.functions, summary.classes
                )
                summary.call_graph = l2_result.get("call_graph", [])
                summary.external_calls = l2_result.get("external_calls", [])

            # L3: Control Flow
            if 3 in layers and 1 in layers:
                summary.control_flow = extractor.extract_l3_control_flow(
                    content, file_path, summary.functions
                )

            # L4: Data Flow
            if 4 in layers and 1 in layers:
                summary.data_flow = extractor.extract_l4_data_flow(
                    content, file_path, summary.functions
                )

            # L5: Program Slices
            if 5 in layers:
                summary.slices = extractor.extract_l5_slices(
                    content, file_path
                )

        except Exception as e:
            summary.errors.append(f"Extraction error: {e}")
            logger.exception(f"Error extracting from {file_path}")

        # Estimate summary tokens
        summary.summary_tokens = extractor.estimate_tokens(summary.to_compact())

        return summary

    def _error_summary(self, file_path: Path, error: str) -> TLDRSummary:
        """Create an error summary."""
        return TLDRSummary(
            file_path=str(file_path),
            language="unknown",
            file_hash="",
            total_lines=0,
            original_tokens=0,
            summary_tokens=0,
            errors=[error],
        )

    def _compute_hash(self, content: str) -> str:
        """Compute content hash for cache invalidation."""
        import hashlib

        return hashlib.sha256(content.encode()).hexdigest()[:16]

    def clear_cache(self) -> None:
        """Clear the TLDR cache."""
        if self.cache:
            self.cache.clear()

    def get_cache_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        if self.cache:
            return self.cache.get_stats()
        return {"enabled": False}
