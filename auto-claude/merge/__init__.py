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
from .models import MergeStats, TaskMergeRequest, MergeReport
from .semantic_analyzer import SemanticAnalyzer
from .conflict_detector import ConflictDetector
from .auto_merger import AutoMerger
from .file_evolution import FileEvolutionTracker
from .ai_resolver import AIResolver, create_claude_resolver
from .conflict_resolver import ConflictResolver
from .merge_pipeline import MergePipeline
from .git_utils import find_worktree, get_file_from_branch
from .file_merger import (
    apply_single_task_changes,
    combine_non_conflicting_changes,
    find_import_end,
    extract_location_content,
    apply_ai_merge,
)
from .orchestrator import MergeOrchestrator
from .file_timeline import (
    FileTimelineTracker,
    FileTimeline,
    MainBranchEvent,
    BranchPoint,
    WorktreeState,
    TaskIntent,
    TaskFileView,
    MergeContext,
)
from .prompts import (
    build_timeline_merge_prompt,
    build_simple_merge_prompt,
    optimize_prompt_for_length,
)

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
    # Models
    "MergeStats",
    "TaskMergeRequest",
    "MergeReport",
    # Components
    "SemanticAnalyzer",
    "ConflictDetector",
    "AutoMerger",
    "FileEvolutionTracker",
    "AIResolver",
    "create_claude_resolver",
    "ConflictResolver",
    "MergePipeline",
    "MergeOrchestrator",
    # Utilities
    "find_worktree",
    "get_file_from_branch",
    "apply_single_task_changes",
    "combine_non_conflicting_changes",
    "find_import_end",
    "extract_location_content",
    "apply_ai_merge",
    # File Timeline (Intent-Aware Merge System)
    "FileTimelineTracker",
    "FileTimeline",
    "MainBranchEvent",
    "BranchPoint",
    "WorktreeState",
    "TaskIntent",
    "TaskFileView",
    "MergeContext",
    # Prompt Templates
    "build_timeline_merge_prompt",
    "build_simple_merge_prompt",
    "optimize_prompt_for_length",
]
