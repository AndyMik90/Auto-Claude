"""
Merge Orchestrator
==================

Main coordinator for the intent-aware merge system.

This orchestrates the complete merge pipeline:
1. Load file evolution data (baselines + task changes)
2. Analyze semantic changes from each task
3. Detect conflicts between tasks
4. Apply deterministic merges where possible (AutoMerger)
5. Call AI resolver for ambiguous conflicts (AIResolver)
6. Produce final merged content and detailed report

The goal is to merge changes from multiple parallel tasks
with maximum automation and minimum AI token usage.
"""

from __future__ import annotations

import json
import logging
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Optional

from .types import (
    ChangeType,
    ConflictRegion,
    ConflictSeverity,
    FileAnalysis,
    FileEvolution,
    MergeDecision,
    MergeResult,
    MergeStrategy,
    SemanticChange,
    TaskSnapshot,
)
from .semantic_analyzer import SemanticAnalyzer
from .conflict_detector import ConflictDetector
from .auto_merger import AutoMerger, MergeContext
from .file_evolution import FileEvolutionTracker
from .ai_resolver import AIResolver, create_claude_resolver

# Import debug utilities
try:
    from debug import debug, debug_detailed, debug_verbose, debug_success, debug_error, debug_warning, debug_section, is_debug_enabled
except ImportError:
    def debug(*args, **kwargs): pass
    def debug_detailed(*args, **kwargs): pass
    def debug_verbose(*args, **kwargs): pass
    def debug_success(*args, **kwargs): pass
    def debug_error(*args, **kwargs): pass
    def debug_warning(*args, **kwargs): pass
    def debug_section(*args, **kwargs): pass
    def is_debug_enabled(): return False

logger = logging.getLogger(__name__)
MODULE = "merge.orchestrator"


@dataclass
class MergeStats:
    """Statistics from a merge operation."""

    files_processed: int = 0
    files_auto_merged: int = 0
    files_ai_merged: int = 0
    files_need_review: int = 0
    files_failed: int = 0
    conflicts_detected: int = 0
    conflicts_auto_resolved: int = 0
    conflicts_ai_resolved: int = 0
    ai_calls_made: int = 0
    estimated_tokens_used: int = 0
    duration_seconds: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "files_processed": self.files_processed,
            "files_auto_merged": self.files_auto_merged,
            "files_ai_merged": self.files_ai_merged,
            "files_need_review": self.files_need_review,
            "files_failed": self.files_failed,
            "conflicts_detected": self.conflicts_detected,
            "conflicts_auto_resolved": self.conflicts_auto_resolved,
            "conflicts_ai_resolved": self.conflicts_ai_resolved,
            "ai_calls_made": self.ai_calls_made,
            "estimated_tokens_used": self.estimated_tokens_used,
            "duration_seconds": self.duration_seconds,
        }

    @property
    def success_rate(self) -> float:
        """Calculate the success rate (auto + AI merges / total)."""
        if self.files_processed == 0:
            return 1.0
        return (self.files_auto_merged + self.files_ai_merged) / self.files_processed

    @property
    def auto_merge_rate(self) -> float:
        """Calculate percentage resolved without AI."""
        if self.conflicts_detected == 0:
            return 1.0
        return self.conflicts_auto_resolved / self.conflicts_detected


@dataclass
class TaskMergeRequest:
    """Request to merge a specific task's changes."""

    task_id: str
    worktree_path: Path
    intent: str = ""
    priority: int = 0  # Higher = merge first in case of ordering


@dataclass
class MergeReport:
    """Complete report from a merge operation."""

    started_at: datetime
    completed_at: Optional[datetime] = None
    tasks_merged: list[str] = field(default_factory=list)
    file_results: dict[str, MergeResult] = field(default_factory=dict)
    stats: MergeStats = field(default_factory=MergeStats)
    success: bool = True
    error: Optional[str] = None

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary for serialization."""
        return {
            "started_at": self.started_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "tasks_merged": self.tasks_merged,
            "file_results": {
                path: result.to_dict()
                for path, result in self.file_results.items()
            },
            "stats": self.stats.to_dict(),
            "success": self.success,
            "error": self.error,
        }

    def save(self, path: Path) -> None:
        """Save report to JSON file."""
        with open(path, "w") as f:
            json.dump(self.to_dict(), f, indent=2)


class MergeOrchestrator:
    """
    Orchestrates the complete merge pipeline.

    This is the main entry point for merging task changes.
    It coordinates all components to produce merged content
    with maximum automation and detailed reporting.

    Example:
        orchestrator = MergeOrchestrator(project_dir)

        # Merge a single task
        result = orchestrator.merge_task("task-001-feature")

        # Merge multiple tasks
        report = orchestrator.merge_tasks([
            TaskMergeRequest(task_id="task-001", worktree_path=path1),
            TaskMergeRequest(task_id="task-002", worktree_path=path2),
        ])
    """

    def __init__(
        self,
        project_dir: Path,
        storage_dir: Optional[Path] = None,
        enable_ai: bool = True,
        ai_resolver: Optional[AIResolver] = None,
        dry_run: bool = False,
    ):
        """
        Initialize the merge orchestrator.

        Args:
            project_dir: Root directory of the project
            storage_dir: Directory for merge data (default: .auto-claude/)
            enable_ai: Whether to use AI for ambiguous conflicts
            ai_resolver: Optional pre-configured AI resolver
            dry_run: If True, don't write any files
        """
        debug_section(MODULE, "Initializing MergeOrchestrator")
        debug(MODULE, "Configuration",
              project_dir=str(project_dir),
              enable_ai=enable_ai,
              dry_run=dry_run)

        self.project_dir = Path(project_dir).resolve()
        self.storage_dir = storage_dir or (self.project_dir / ".auto-claude")
        self.enable_ai = enable_ai
        self.dry_run = dry_run

        # Initialize components
        debug_detailed(MODULE, "Initializing sub-components...")
        self.analyzer = SemanticAnalyzer()
        self.conflict_detector = ConflictDetector()
        self.auto_merger = AutoMerger()
        self.evolution_tracker = FileEvolutionTracker(
            project_dir=self.project_dir,
            storage_dir=self.storage_dir,
            semantic_analyzer=self.analyzer,
        )

        # AI resolver - lazy init if not provided
        self._ai_resolver = ai_resolver
        self._ai_resolver_initialized = ai_resolver is not None

        # Merge output directory
        self.merge_output_dir = self.storage_dir / "merge_output"
        self.reports_dir = self.storage_dir / "merge_reports"

        debug_success(MODULE, "MergeOrchestrator initialized",
                     storage_dir=str(self.storage_dir))

    @property
    def ai_resolver(self) -> AIResolver:
        """Get the AI resolver, initializing if needed."""
        if not self._ai_resolver_initialized:
            if self.enable_ai:
                self._ai_resolver = create_claude_resolver()
            else:
                self._ai_resolver = AIResolver()  # No AI function
            self._ai_resolver_initialized = True
        return self._ai_resolver

    def merge_task(
        self,
        task_id: str,
        worktree_path: Optional[Path] = None,
        target_branch: str = "main",
    ) -> MergeReport:
        """
        Merge a single task's changes into the target branch.

        Args:
            task_id: The task identifier
            worktree_path: Path to the task's worktree (auto-detected if not provided)
            target_branch: Branch to merge into

        Returns:
            MergeReport with results
        """
        debug_section(MODULE, f"Merging Task: {task_id}")
        debug(MODULE, "merge_task() called",
              task_id=task_id,
              worktree_path=str(worktree_path) if worktree_path else "auto-detect",
              target_branch=target_branch)

        report = MergeReport(started_at=datetime.now(), tasks_merged=[task_id])
        start_time = datetime.now()

        try:
            # Find worktree if not provided
            if worktree_path is None:
                debug_detailed(MODULE, "Auto-detecting worktree path...")
                worktree_path = self._find_worktree(task_id)
                if not worktree_path:
                    debug_error(MODULE, f"Could not find worktree for task {task_id}")
                    report.success = False
                    report.error = f"Could not find worktree for task {task_id}"
                    return report
                debug_detailed(MODULE, f"Found worktree: {worktree_path}")

            # Ensure evolution data is up to date
            debug(MODULE, "Refreshing evolution data from git...")
            self.evolution_tracker.refresh_from_git(task_id, worktree_path)

            # Get files modified by this task
            modifications = self.evolution_tracker.get_task_modifications(task_id)
            debug(MODULE, f"Found {len(modifications) if modifications else 0} modified files")

            if not modifications:
                debug_warning(MODULE, f"No modifications found for task {task_id}")
                logger.info(f"No modifications found for task {task_id}")
                report.completed_at = datetime.now()
                return report

            # Process each modified file
            for file_path, snapshot in modifications:
                debug_detailed(MODULE, f"Processing file: {file_path}",
                              changes=len(snapshot.semantic_changes))
                result = self._merge_file(
                    file_path=file_path,
                    task_snapshots=[snapshot],
                    target_branch=target_branch,
                )
                report.file_results[file_path] = result
                self._update_stats(report.stats, result)
                debug_verbose(MODULE, f"File merge result: {result.decision.value}",
                             file=file_path)

            report.success = report.stats.files_failed == 0

        except Exception as e:
            debug_error(MODULE, f"Merge failed for task {task_id}", error=str(e))
            logger.exception(f"Merge failed for task {task_id}")
            report.success = False
            report.error = str(e)

        report.completed_at = datetime.now()
        report.stats.duration_seconds = (
            report.completed_at - start_time
        ).total_seconds()

        # Save report
        if not self.dry_run:
            self._save_report(report, task_id)

        debug_success(MODULE, f"Merge complete for {task_id}",
                     success=report.success,
                     files_processed=report.stats.files_processed,
                     files_auto_merged=report.stats.files_auto_merged,
                     conflicts_detected=report.stats.conflicts_detected,
                     duration=f"{report.stats.duration_seconds:.2f}s")

        return report

    def merge_tasks(
        self,
        requests: list[TaskMergeRequest],
        target_branch: str = "main",
    ) -> MergeReport:
        """
        Merge multiple tasks' changes.

        This is the main entry point for merging multiple parallel tasks.
        It handles conflicts between tasks and produces a combined result.

        Args:
            requests: List of merge requests (one per task)
            target_branch: Branch to merge into

        Returns:
            MergeReport with combined results
        """
        report = MergeReport(
            started_at=datetime.now(),
            tasks_merged=[r.task_id for r in requests],
        )
        start_time = datetime.now()

        try:
            # Sort by priority (higher first)
            requests = sorted(requests, key=lambda r: -r.priority)

            # Refresh evolution data for all tasks
            for request in requests:
                if request.worktree_path and request.worktree_path.exists():
                    self.evolution_tracker.refresh_from_git(
                        request.task_id, request.worktree_path
                    )

            # Find all files modified by any task
            task_ids = [r.task_id for r in requests]
            file_tasks = self.evolution_tracker.get_files_modified_by_tasks(task_ids)

            # Process each file
            for file_path, modifying_tasks in file_tasks.items():
                # Get snapshots from all tasks that modified this file
                evolution = self.evolution_tracker.get_file_evolution(file_path)
                if not evolution:
                    continue

                snapshots = [
                    evolution.get_task_snapshot(tid)
                    for tid in modifying_tasks
                    if evolution.get_task_snapshot(tid)
                ]

                if not snapshots:
                    continue

                result = self._merge_file(
                    file_path=file_path,
                    task_snapshots=snapshots,
                    target_branch=target_branch,
                )
                report.file_results[file_path] = result
                self._update_stats(report.stats, result)

            report.success = report.stats.files_failed == 0

        except Exception as e:
            logger.exception("Merge failed")
            report.success = False
            report.error = str(e)

        report.completed_at = datetime.now()
        report.stats.duration_seconds = (
            report.completed_at - start_time
        ).total_seconds()

        # Save report
        if not self.dry_run:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            self._save_report(report, f"multi_{timestamp}")

        return report

    def _merge_file(
        self,
        file_path: str,
        task_snapshots: list[TaskSnapshot],
        target_branch: str,
    ) -> MergeResult:
        """
        Merge changes from multiple tasks for a single file.

        Args:
            file_path: Path to the file
            task_snapshots: Snapshots from tasks that modified this file
            target_branch: Branch to merge into

        Returns:
            MergeResult with merged content or conflict info
        """
        task_ids = [s.task_id for s in task_snapshots]
        debug(MODULE, f"_merge_file: {file_path}",
              tasks=task_ids,
              target_branch=target_branch)
        logger.info(f"Merging {file_path} with {len(task_snapshots)} task(s)")

        # Get baseline content
        baseline_content = self.evolution_tracker.get_baseline_content(file_path)
        if baseline_content is None:
            # Try to get from target branch
            baseline_content = self._get_file_from_branch(file_path, target_branch)

        if baseline_content is None:
            # File is new - created by task(s)
            baseline_content = ""

        # If only one task modified the file, no conflict possible
        if len(task_snapshots) == 1:
            snapshot = task_snapshots[0]
            # Apply the changes from this task
            merged = self._apply_single_task_changes(
                baseline_content, snapshot, file_path
            )
            return MergeResult(
                decision=MergeDecision.AUTO_MERGED,
                file_path=file_path,
                merged_content=merged,
                explanation=f"Single task ({snapshot.task_id}) changes applied",
            )

        # Multiple tasks - need conflict detection
        task_analyses = self._build_task_analyses(file_path, task_snapshots)

        # Detect conflicts
        conflicts = self.conflict_detector.detect_conflicts(task_analyses)

        if not conflicts:
            # No conflicts - combine all changes
            merged = self._combine_non_conflicting_changes(
                baseline_content, task_snapshots, file_path
            )
            return MergeResult(
                decision=MergeDecision.AUTO_MERGED,
                file_path=file_path,
                merged_content=merged,
                explanation="All changes compatible, combined automatically",
            )

        # Handle conflicts
        return self._resolve_conflicts(
            file_path=file_path,
            baseline_content=baseline_content,
            task_snapshots=task_snapshots,
            conflicts=conflicts,
        )

    def _build_task_analyses(
        self,
        file_path: str,
        task_snapshots: list[TaskSnapshot],
    ) -> dict[str, FileAnalysis]:
        """Build FileAnalysis objects from task snapshots."""
        analyses = {}
        for snapshot in task_snapshots:
            analysis = FileAnalysis(
                file_path=file_path,
                changes=snapshot.semantic_changes,
            )

            # Populate summary fields
            for change in snapshot.semantic_changes:
                if change.change_type == ChangeType.ADD_FUNCTION:
                    analysis.functions_added.add(change.target)
                elif change.change_type == ChangeType.MODIFY_FUNCTION:
                    analysis.functions_modified.add(change.target)
                elif change.change_type == ChangeType.ADD_IMPORT:
                    analysis.imports_added.add(change.target)
                elif change.change_type == ChangeType.REMOVE_IMPORT:
                    analysis.imports_removed.add(change.target)
                analysis.total_lines_changed += change.line_end - change.line_start + 1

            analyses[snapshot.task_id] = analysis

        return analyses

    def _apply_single_task_changes(
        self,
        baseline: str,
        snapshot: TaskSnapshot,
        file_path: str,
    ) -> str:
        """Apply changes from a single task."""
        # Get the current content from the worktree
        # For now, we apply changes in order
        content = baseline

        for change in snapshot.semantic_changes:
            if change.content_before and change.content_after:
                # Modification - replace
                content = content.replace(change.content_before, change.content_after)
            elif change.content_after and not change.content_before:
                # Addition - need to determine where to add
                # This is simplified - in production, use the location info
                if change.change_type == ChangeType.ADD_IMPORT:
                    # Add import at top
                    lines = content.split("\n")
                    import_end = self._find_import_end(lines, file_path)
                    lines.insert(import_end, change.content_after)
                    content = "\n".join(lines)
                elif change.change_type == ChangeType.ADD_FUNCTION:
                    # Add function at end (before exports)
                    content += f"\n\n{change.content_after}"

        return content

    def _combine_non_conflicting_changes(
        self,
        baseline: str,
        snapshots: list[TaskSnapshot],
        file_path: str,
    ) -> str:
        """Combine changes from multiple non-conflicting tasks."""
        content = baseline

        # Group changes by type for proper ordering
        imports: list[SemanticChange] = []
        functions: list[SemanticChange] = []
        modifications: list[SemanticChange] = []
        other: list[SemanticChange] = []

        for snapshot in snapshots:
            for change in snapshot.semantic_changes:
                if change.change_type == ChangeType.ADD_IMPORT:
                    imports.append(change)
                elif change.change_type == ChangeType.ADD_FUNCTION:
                    functions.append(change)
                elif "MODIFY" in change.change_type.value:
                    modifications.append(change)
                else:
                    other.append(change)

        # Apply in order: imports, then modifications, then functions, then other
        ext = Path(file_path).suffix.lower()

        # Add imports
        if imports:
            lines = content.split("\n")
            import_end = self._find_import_end(lines, file_path)
            for imp in imports:
                if imp.content_after and imp.content_after not in content:
                    lines.insert(import_end, imp.content_after)
                    import_end += 1
            content = "\n".join(lines)

        # Apply modifications
        for mod in modifications:
            if mod.content_before and mod.content_after:
                content = content.replace(mod.content_before, mod.content_after)

        # Add functions
        for func in functions:
            if func.content_after:
                content += f"\n\n{func.content_after}"

        # Apply other changes
        for change in other:
            if change.content_after and not change.content_before:
                content += f"\n{change.content_after}"
            elif change.content_before and change.content_after:
                content = content.replace(change.content_before, change.content_after)

        return content

    def _resolve_conflicts(
        self,
        file_path: str,
        baseline_content: str,
        task_snapshots: list[TaskSnapshot],
        conflicts: list[ConflictRegion],
    ) -> MergeResult:
        """Resolve conflicts using AutoMerger and AIResolver."""
        merged_content = baseline_content
        resolved: list[ConflictRegion] = []
        remaining: list[ConflictRegion] = []
        ai_calls = 0
        tokens_used = 0

        for conflict in conflicts:
            # Try auto-merge first
            if conflict.can_auto_merge and conflict.merge_strategy:
                context = MergeContext(
                    file_path=file_path,
                    baseline_content=merged_content,
                    task_snapshots=task_snapshots,
                    conflict=conflict,
                )

                result = self.auto_merger.merge(context, conflict.merge_strategy)

                if result.success:
                    merged_content = result.merged_content or merged_content
                    resolved.append(conflict)
                    continue

            # Try AI resolver if enabled
            if self.enable_ai and conflict.severity in {
                ConflictSeverity.MEDIUM,
                ConflictSeverity.HIGH,
            }:
                # Extract baseline for conflict location
                conflict_baseline = self._extract_location_content(
                    baseline_content, conflict.location
                )

                ai_result = self.ai_resolver.resolve_conflict(
                    conflict=conflict,
                    baseline_code=conflict_baseline,
                    task_snapshots=task_snapshots,
                )

                ai_calls += ai_result.ai_calls_made
                tokens_used += ai_result.tokens_used

                if ai_result.success:
                    # Apply AI-merged content
                    merged_content = self._apply_ai_merge(
                        merged_content,
                        conflict.location,
                        ai_result.merged_content or "",
                    )
                    resolved.append(conflict)
                    continue

            # Could not resolve
            remaining.append(conflict)

        # Determine final decision
        if not remaining:
            decision = MergeDecision.AUTO_MERGED if ai_calls == 0 else MergeDecision.AI_MERGED
        elif remaining and resolved:
            decision = MergeDecision.NEEDS_HUMAN_REVIEW
        else:
            decision = MergeDecision.FAILED

        return MergeResult(
            decision=decision,
            file_path=file_path,
            merged_content=merged_content if decision != MergeDecision.FAILED else None,
            conflicts_resolved=resolved,
            conflicts_remaining=remaining,
            ai_calls_made=ai_calls,
            tokens_used=tokens_used,
            explanation=self._build_explanation(resolved, remaining),
        )

    def _extract_location_content(self, content: str, location: str) -> str:
        """Extract content at a specific location (e.g., function:App)."""
        # Parse location
        if ":" not in location:
            return content

        loc_type, loc_name = location.split(":", 1)

        if loc_type == "function":
            # Find function content using regex
            patterns = [
                rf"(function\s+{loc_name}\s*\([^)]*\)\s*\{{[\s\S]*?\n\}})",
                rf"((?:const|let|var)\s+{loc_name}\s*=[\s\S]*?\n\}};?)",
            ]
            for pattern in patterns:
                import re
                match = re.search(pattern, content)
                if match:
                    return match.group(1)

        elif loc_type == "class":
            pattern = rf"(class\s+{loc_name}\s*(?:extends\s+\w+)?\s*\{{[\s\S]*?\n\}})"
            import re
            match = re.search(pattern, content)
            if match:
                return match.group(1)

        return content

    def _apply_ai_merge(
        self,
        content: str,
        location: str,
        merged_region: str,
    ) -> str:
        """Apply AI-merged content to the full file."""
        if not merged_region:
            return content

        # Find and replace the location content
        original = self._extract_location_content(content, location)
        if original and original != content:
            return content.replace(original, merged_region)

        return content

    def _build_explanation(
        self,
        resolved: list[ConflictRegion],
        remaining: list[ConflictRegion],
    ) -> str:
        """Build a human-readable explanation of the merge."""
        parts = []

        if resolved:
            parts.append(f"Resolved {len(resolved)} conflict(s):")
            for c in resolved[:5]:  # Limit to first 5
                parts.append(f"  - {c.location}: {c.merge_strategy.value if c.merge_strategy else 'auto'}")
            if len(resolved) > 5:
                parts.append(f"  ... and {len(resolved) - 5} more")

        if remaining:
            parts.append(f"\nUnresolved {len(remaining)} conflict(s) - need human review:")
            for c in remaining[:5]:
                parts.append(f"  - {c.location}: {c.reason}")
            if len(remaining) > 5:
                parts.append(f"  ... and {len(remaining) - 5} more")

        return "\n".join(parts) if parts else "No conflicts"

    def _find_import_end(self, lines: list[str], file_path: str) -> int:
        """Find where imports end in a file."""
        ext = Path(file_path).suffix.lower()
        last_import = 0

        for i, line in enumerate(lines):
            stripped = line.strip()
            if ext == ".py":
                if stripped.startswith(("import ", "from ")):
                    last_import = i + 1
            elif ext in {".js", ".jsx", ".ts", ".tsx"}:
                if stripped.startswith("import "):
                    last_import = i + 1

        return last_import

    def _find_worktree(self, task_id: str) -> Optional[Path]:
        """Find the worktree path for a task."""
        # Check common locations
        worktrees_dir = self.project_dir / ".worktrees"
        if worktrees_dir.exists():
            # Look for worktree with task_id in name
            for entry in worktrees_dir.iterdir():
                if entry.is_dir() and task_id in entry.name:
                    return entry

        # Try git worktree list
        try:
            result = subprocess.run(
                ["git", "worktree", "list", "--porcelain"],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                check=True,
            )
            for line in result.stdout.split("\n"):
                if line.startswith("worktree ") and task_id in line:
                    return Path(line.split(" ", 1)[1])
        except subprocess.CalledProcessError:
            pass

        return None

    def _get_file_from_branch(self, file_path: str, branch: str) -> Optional[str]:
        """Get file content from a specific git branch."""
        try:
            result = subprocess.run(
                ["git", "show", f"{branch}:{file_path}"],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                check=True,
            )
            return result.stdout
        except subprocess.CalledProcessError:
            return None

    def _update_stats(self, stats: MergeStats, result: MergeResult) -> None:
        """Update stats from a merge result."""
        stats.files_processed += 1
        stats.ai_calls_made += result.ai_calls_made
        stats.estimated_tokens_used += result.tokens_used
        stats.conflicts_detected += len(result.conflicts_resolved) + len(result.conflicts_remaining)
        stats.conflicts_auto_resolved += len(result.conflicts_resolved)

        if result.decision == MergeDecision.AUTO_MERGED:
            stats.files_auto_merged += 1
        elif result.decision == MergeDecision.AI_MERGED:
            stats.files_ai_merged += 1
            stats.conflicts_ai_resolved += len(result.conflicts_resolved)
        elif result.decision == MergeDecision.NEEDS_HUMAN_REVIEW:
            stats.files_need_review += 1
        elif result.decision == MergeDecision.FAILED:
            stats.files_failed += 1

    def _save_report(self, report: MergeReport, name: str) -> None:
        """Save a merge report to disk."""
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        report_path = self.reports_dir / f"{name}_{timestamp}.json"
        report.save(report_path)
        logger.info(f"Saved merge report to {report_path}")

    def get_pending_conflicts(self) -> list[tuple[str, list[ConflictRegion]]]:
        """
        Get files with pending conflicts that need human review.

        Returns:
            List of (file_path, conflicts) tuples
        """
        pending = []
        active_tasks = list(self.evolution_tracker.get_active_tasks())

        if len(active_tasks) < 2:
            return pending

        # Check for conflicts between active tasks
        conflicting_files = self.evolution_tracker.get_conflicting_files(active_tasks)

        for file_path in conflicting_files:
            evolution = self.evolution_tracker.get_file_evolution(file_path)
            if not evolution:
                continue

            # Build analyses for conflict detection
            analyses = {}
            for snapshot in evolution.task_snapshots:
                if snapshot.task_id in active_tasks:
                    analyses[snapshot.task_id] = FileAnalysis(
                        file_path=file_path,
                        changes=snapshot.semantic_changes,
                    )

            conflicts = self.conflict_detector.detect_conflicts(analyses)
            if conflicts:
                # Filter to only non-auto-mergeable conflicts
                hard_conflicts = [c for c in conflicts if not c.can_auto_merge]
                if hard_conflicts:
                    pending.append((file_path, hard_conflicts))

        return pending

    def preview_merge(
        self,
        task_ids: list[str],
    ) -> dict[str, Any]:
        """
        Preview what a merge would look like without executing.

        Args:
            task_ids: List of task IDs to preview merging

        Returns:
            Dictionary with preview information
        """
        debug_section(MODULE, "Preview Merge")
        debug(MODULE, "preview_merge() called", task_ids=task_ids)

        file_tasks = self.evolution_tracker.get_files_modified_by_tasks(task_ids)
        conflicting = self.evolution_tracker.get_conflicting_files(task_ids)

        debug(MODULE, "Files analysis",
              files_modified=len(file_tasks),
              files_with_conflicts=len(conflicting))

        preview = {
            "tasks": task_ids,
            "files_to_merge": list(file_tasks.keys()),
            "files_with_potential_conflicts": conflicting,
            "conflicts": [],
        }

        # Analyze conflicts
        for file_path in conflicting:
            debug_detailed(MODULE, f"Analyzing conflicts for: {file_path}")
            evolution = self.evolution_tracker.get_file_evolution(file_path)
            if not evolution:
                debug_warning(MODULE, f"No evolution data for {file_path}")
                continue

            analyses = {}
            for snapshot in evolution.task_snapshots:
                if snapshot.task_id in task_ids:
                    analyses[snapshot.task_id] = FileAnalysis(
                        file_path=file_path,
                        changes=snapshot.semantic_changes,
                    )

            conflicts = self.conflict_detector.detect_conflicts(analyses)
            debug_detailed(MODULE, f"Found {len(conflicts)} conflicts in {file_path}")

            for c in conflicts:
                debug_verbose(MODULE, f"Conflict: {c.location}",
                             severity=c.severity.value,
                             can_auto_merge=c.can_auto_merge)
                preview["conflicts"].append({
                    "file": c.file_path,
                    "location": c.location,
                    "tasks": c.tasks_involved,
                    "severity": c.severity.value,
                    "can_auto_merge": c.can_auto_merge,
                    "strategy": c.merge_strategy.value if c.merge_strategy else None,
                    "reason": c.reason,
                })

        preview["summary"] = {
            "total_files": len(file_tasks),
            "conflict_files": len(conflicting),
            "total_conflicts": len(preview["conflicts"]),
            "auto_mergeable": sum(1 for c in preview["conflicts"] if c["can_auto_merge"]),
        }

        debug_success(MODULE, "Preview complete", summary=preview["summary"])

        return preview

    def write_merged_files(
        self,
        report: MergeReport,
        output_dir: Optional[Path] = None,
    ) -> list[Path]:
        """
        Write merged files to disk.

        Args:
            report: The merge report with results
            output_dir: Directory to write to (default: merge_output/)

        Returns:
            List of written file paths
        """
        if self.dry_run:
            logger.info("Dry run - not writing files")
            return []

        output_dir = output_dir or self.merge_output_dir
        output_dir.mkdir(parents=True, exist_ok=True)

        written = []
        for file_path, result in report.file_results.items():
            if result.merged_content:
                out_path = output_dir / file_path
                out_path.parent.mkdir(parents=True, exist_ok=True)
                out_path.write_text(result.merged_content, encoding="utf-8")
                written.append(out_path)
                logger.debug(f"Wrote merged file: {out_path}")

        logger.info(f"Wrote {len(written)} merged files to {output_dir}")
        return written

    def apply_to_project(
        self,
        report: MergeReport,
    ) -> bool:
        """
        Apply merged files directly to the project.

        Args:
            report: The merge report with results

        Returns:
            True if all files were applied successfully
        """
        if self.dry_run:
            logger.info("Dry run - not applying to project")
            return True

        success = True
        for file_path, result in report.file_results.items():
            if result.merged_content and result.success:
                target_path = self.project_dir / file_path
                target_path.parent.mkdir(parents=True, exist_ok=True)
                try:
                    target_path.write_text(result.merged_content, encoding="utf-8")
                    logger.debug(f"Applied merged content to: {target_path}")
                except Exception as e:
                    logger.error(f"Failed to write {target_path}: {e}")
                    success = False

        return success
