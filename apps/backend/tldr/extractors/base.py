"""
Base Extractor Interface
========================

Abstract base class for language-specific AST extractors.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Any

from ..models import (
    TLDRSummary,
    FunctionSignature,
    ClassSignature,
    ImportInfo,
    CallGraphEdge,
    ControlFlowNode,
    DataFlowEdge,
    DependencySlice,
)


class BaseExtractor(ABC):
    """
    Abstract base class for language-specific extractors.

    Each extractor implements multi-layer analysis for a specific language.
    """

    # File extensions this extractor handles
    extensions: list[str] = []

    # Language identifier
    language: str = "unknown"

    def __init__(self, project_dir: Path | None = None):
        self.project_dir = project_dir

    @abstractmethod
    def can_handle(self, file_path: Path) -> bool:
        """Check if this extractor can handle the given file."""
        pass

    @abstractmethod
    def extract_l1_ast(self, source: str, file_path: Path) -> dict[str, Any]:
        """
        Extract L1: AST layer.

        Returns dict with:
        - imports: list[ImportInfo]
        - functions: list[FunctionSignature]
        - classes: list[ClassSignature]
        - module_docstring: str | None
        - global_variables: list[tuple[str, str | None]]
        """
        pass

    @abstractmethod
    def extract_l2_call_graph(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
        classes: list[ClassSignature],
    ) -> dict[str, Any]:
        """
        Extract L2: Call graph layer.

        Returns dict with:
        - call_graph: list[CallGraphEdge]
        - external_calls: list[str]
        """
        pass

    @abstractmethod
    def extract_l3_control_flow(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
    ) -> dict[str, list[ControlFlowNode]]:
        """
        Extract L3: Control flow graph.

        Returns dict mapping function names to their control flow nodes.
        """
        pass

    @abstractmethod
    def extract_l4_data_flow(
        self,
        source: str,
        file_path: Path,
        functions: list[FunctionSignature],
    ) -> dict[str, list[DataFlowEdge]]:
        """
        Extract L4: Data flow graph.

        Returns dict mapping function names to their data flow edges.
        """
        pass

    @abstractmethod
    def extract_l5_slices(
        self,
        source: str,
        file_path: Path,
        targets: list[tuple[str, int]] | None = None,
    ) -> list[DependencySlice]:
        """
        Extract L5: Program dependency graph / slices.

        If targets is None, auto-detect important slicing points.
        """
        pass

    def estimate_tokens(self, text: str) -> int:
        """Estimate token count (rough approximation: 4 chars per token)."""
        return len(text) // 4

    def compute_file_hash(self, content: str) -> str:
        """Compute hash for cache invalidation."""
        import hashlib

        return hashlib.sha256(content.encode()).hexdigest()[:16]
