"""
Merge AI System
===============

Intent-aware merge system for multi-agent collaborative development.

This module provides semantic understanding of code changes and intelligent
conflict resolution, enabling multiple AI agents to work in parallel without
traditional merge conflicts.

Components:
- SemanticAnalyzer: Tree-sitter based semantic change extraction
- ConflictDetector: Rule-based conflict detection and compatibility analysis
- AutoMerger: Deterministic merge strategies (no AI needed)
- AIResolver: Minimal-context AI resolution for ambiguous conflicts
- FileEvolutionTracker: Baseline capture and change tracking
- MergeOrchestrator: Main pipeline coordinator

Usage:
    from merge import MergeOrchestrator

    orchestrator = MergeOrchestrator(project_dir)
    result = orchestrator.merge_task("task-001-feature")
"""

from .types import (
    ChangeType,
    SemanticChange,
    FileAnalysis,
    ConflictRegion,
    ConflictSeverity,
    MergeStrategy,
    MergeResult,
    MergeDecision,
    TaskSnapshot,
    FileEvolution,
)
from .semantic_analyzer import SemanticAnalyzer
from .conflict_detector import ConflictDetector
from .auto_merger import AutoMerger
from .file_evolution import FileEvolutionTracker
from .ai_resolver import AIResolver, create_claude_resolver
from .orchestrator import MergeOrchestrator

__all__ = [
    # Types
    "ChangeType",
    "SemanticChange",
    "FileAnalysis",
    "ConflictRegion",
    "ConflictSeverity",
    "MergeStrategy",
    "MergeResult",
    "MergeDecision",
    "TaskSnapshot",
    "FileEvolution",
    # Components
    "SemanticAnalyzer",
    "ConflictDetector",
    "AutoMerger",
    "FileEvolutionTracker",
    "AIResolver",
    "create_claude_resolver",
    "MergeOrchestrator",
]
