"""
TLDR Code Analysis
==================

Token-efficient code summarization through multi-layer AST extraction.
Provides 95% token savings by extracting structured summaries instead of full file contents.

Layers:
- L1: AST - Functions, classes, signatures (~500 tokens)
- L2: Call Graph - Cross-file dependencies (+440 tokens)
- L3: CFG - Control flow graph (+110 tokens)
- L4: DFG - Data flow graph (+130 tokens)
- L5: PDG - Program dependency graph / slicing (+150 tokens)

Usage:
    from tldr import TLDRAnalyzer, TLDRSummary

    analyzer = TLDRAnalyzer(project_dir)
    summary = analyzer.analyze_file("src/main.py", layers=[1, 2, 3])
    print(summary.to_compact())  # Token-efficient representation
"""

from .models import (
    TLDRSummary,
    FunctionSignature,
    ClassSignature,
    ImportInfo,
    CallGraphEdge,
    ControlFlowNode,
    DataFlowEdge,
    DependencySlice,
    AnalysisLayer,
)
from .analyzer import TLDRAnalyzer
from .cache import TLDRCache

__all__ = [
    # Core
    "TLDRAnalyzer",
    "TLDRCache",
    "TLDRSummary",
    # Models
    "FunctionSignature",
    "ClassSignature",
    "ImportInfo",
    "CallGraphEdge",
    "ControlFlowNode",
    "DataFlowEdge",
    "DependencySlice",
    "AnalysisLayer",
]
