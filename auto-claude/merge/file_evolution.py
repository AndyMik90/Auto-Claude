"""
File Evolution Tracker
======================

Tracks the evolution of files across multiple task modifications.

This component:
1. Captures baseline file states when worktrees are created
2. Stores file content snapshots for reference
3. Records task modifications with semantic changes
4. Persists evolution data for merge analysis

The evolution data enables the merge system to understand:
- What the file looked like before any tasks started
- What each task intended to do
- The order of modifications
- Content hashes for integrity verification
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Optional

from .types import (
    FileEvolution,
    SemanticChange,
    TaskSnapshot,
    compute_content_hash,
    sanitize_path_for_storage,
)
from .semantic_analyzer import SemanticAnalyzer

# Import debug utilities
try:
    from debug import debug, debug_detailed, debug_verbose, debug_success, debug_error, debug_warning, is_debug_enabled
except ImportError:
    def debug(*args, **kwargs): pass
    def debug_detailed(*args, **kwargs): pass
    def debug_verbose(*args, **kwargs): pass
    def debug_success(*args, **kwargs): pass
    def debug_error(*args, **kwargs): pass
    def debug_warning(*args, **kwargs): pass
    def is_debug_enabled(): return False

logger = logging.getLogger(__name__)
MODULE = "merge.file_evolution"


class FileEvolutionTracker:
    """
    Tracks file evolution across task modifications.

    This class manages:
    - Baseline capture when worktrees are created
    - File content snapshots in .auto-claude/baselines/
    - Task modification tracking with semantic analysis
    - Persistence of evolution data

    Usage:
        tracker = FileEvolutionTracker(project_dir)

        # When creating a worktree for a task
        tracker.capture_baselines(task_id, files_to_track)

        # When a task modifies a file
        tracker.record_modification(task_id, file_path, old_content, new_content)

        # When preparing to merge
        evolution = tracker.get_file_evolution(file_path)
    """

    # Default extensions to track for baselines
    DEFAULT_EXTENSIONS = {
        ".py", ".js", ".ts", ".tsx", ".jsx",
        ".json", ".yaml", ".yml", ".toml",
        ".md", ".txt", ".html", ".css", ".scss",
        ".go", ".rs", ".java", ".kt", ".swift",
    }

    def __init__(
        self,
        project_dir: Path,
        storage_dir: Optional[Path] = None,
        semantic_analyzer: Optional[SemanticAnalyzer] = None,
    ):
        """
        Initialize the file evolution tracker.

        Args:
            project_dir: Root directory of the project
            storage_dir: Directory for evolution data (default: .auto-claude/)
            semantic_analyzer: Optional pre-configured analyzer
        """
        debug(MODULE, "Initializing FileEvolutionTracker",
              project_dir=str(project_dir))

        self.project_dir = Path(project_dir).resolve()
        self.storage_dir = storage_dir or (self.project_dir / ".auto-claude")
        self.baselines_dir = self.storage_dir / "baselines"
        self.evolution_file = self.storage_dir / "file_evolution.json"

        # Ensure directories exist
        self.storage_dir.mkdir(parents=True, exist_ok=True)
        self.baselines_dir.mkdir(parents=True, exist_ok=True)

        # Semantic analyzer for extracting changes
        self.analyzer = semantic_analyzer or SemanticAnalyzer()

        # Load existing evolution data
        self._evolutions: dict[str, FileEvolution] = {}
        self._load_evolutions()

        debug_success(MODULE, "FileEvolutionTracker initialized",
                     evolutions_loaded=len(self._evolutions))

    def _load_evolutions(self) -> None:
        """Load evolution data from disk."""
        if not self.evolution_file.exists():
            return

        try:
            with open(self.evolution_file) as f:
                data = json.load(f)

            for file_path, evolution_data in data.items():
                self._evolutions[file_path] = FileEvolution.from_dict(evolution_data)

            logger.debug(f"Loaded evolution data for {len(self._evolutions)} files")
        except Exception as e:
            logger.error(f"Failed to load evolution data: {e}")

    def _save_evolutions(self) -> None:
        """Persist evolution data to disk."""
        try:
            data = {
                file_path: evolution.to_dict()
                for file_path, evolution in self._evolutions.items()
            }

            with open(self.evolution_file, "w") as f:
                json.dump(data, f, indent=2)

            logger.debug(f"Saved evolution data for {len(self._evolutions)} files")
        except Exception as e:
            logger.error(f"Failed to save evolution data: {e}")

    def _get_current_commit(self) -> str:
        """Get the current git commit hash."""
        try:
            result = subprocess.run(
                ["git", "rev-parse", "HEAD"],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                check=True,
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError:
            return "unknown"

    def _get_relative_path(self, file_path: Path | str) -> str:
        """Get path relative to project root."""
        path = Path(file_path)
        if path.is_absolute():
            try:
                return str(path.relative_to(self.project_dir))
            except ValueError:
                return str(path)
        return str(path)

    def _store_baseline_content(
        self,
        file_path: str,
        content: str,
        task_id: str,
    ) -> str:
        """
        Store baseline content to disk.

        Returns:
            Path to the stored baseline file (relative to storage_dir)
        """
        safe_name = sanitize_path_for_storage(file_path)
        baseline_path = self.baselines_dir / task_id / f"{safe_name}.baseline"
        baseline_path.parent.mkdir(parents=True, exist_ok=True)

        with open(baseline_path, "w", encoding="utf-8") as f:
            f.write(content)

        return str(baseline_path.relative_to(self.storage_dir))

    def _read_file_content(self, file_path: Path | str) -> Optional[str]:
        """Read file content, returning None if not readable."""
        try:
            path = Path(file_path)
            if not path.is_absolute():
                path = self.project_dir / path
            return path.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning(f"Could not read {file_path}: {e}")
            return None

    def capture_baselines(
        self,
        task_id: str,
        files: Optional[list[Path | str]] = None,
        intent: str = "",
    ) -> dict[str, FileEvolution]:
        """
        Capture baseline state of files for a task.

        Call this when creating a worktree for a new task.

        Args:
            task_id: Unique identifier for the task
            files: List of files to capture. If None, discovers trackable files.
            intent: Description of what the task intends to do

        Returns:
            Dictionary mapping file paths to their FileEvolution objects
        """
        commit = self._get_current_commit()
        captured_at = datetime.now()
        captured: dict[str, FileEvolution] = {}

        # Discover files if not specified
        if files is None:
            files = self._discover_trackable_files()

        for file_path in files:
            rel_path = self._get_relative_path(file_path)
            content = self._read_file_content(file_path)

            if content is None:
                continue

            # Store baseline content
            baseline_path = self._store_baseline_content(rel_path, content, task_id)
            content_hash = compute_content_hash(content)

            # Create or update evolution
            if rel_path in self._evolutions:
                evolution = self._evolutions[rel_path]
                # Update baseline if this is a fresh start
                logger.debug(f"Updating existing evolution for {rel_path}")
            else:
                evolution = FileEvolution(
                    file_path=rel_path,
                    baseline_commit=commit,
                    baseline_captured_at=captured_at,
                    baseline_content_hash=content_hash,
                    baseline_snapshot_path=baseline_path,
                )
                self._evolutions[rel_path] = evolution
                logger.debug(f"Created new evolution for {rel_path}")

            # Create task snapshot
            snapshot = TaskSnapshot(
                task_id=task_id,
                task_intent=intent,
                started_at=captured_at,
                content_hash_before=content_hash,
            )
            evolution.add_task_snapshot(snapshot)
            captured[rel_path] = evolution

        self._save_evolutions()
        logger.info(f"Captured baselines for {len(captured)} files for task {task_id}")
        return captured

    def _discover_trackable_files(self) -> list[Path]:
        """
        Discover files that should be tracked for baselines.

        Uses git ls-files to get tracked files, filtering by extension.
        """
        try:
            result = subprocess.run(
                ["git", "ls-files"],
                cwd=self.project_dir,
                capture_output=True,
                text=True,
                check=True,
            )
            all_files = result.stdout.strip().split("\n")
            trackable = []

            for file_path in all_files:
                if not file_path:
                    continue
                path = Path(file_path)
                if path.suffix in self.DEFAULT_EXTENSIONS:
                    trackable.append(self.project_dir / path)

            return trackable
        except subprocess.CalledProcessError:
            logger.warning("Failed to list git files, returning empty list")
            return []

    def record_modification(
        self,
        task_id: str,
        file_path: Path | str,
        old_content: str,
        new_content: str,
        raw_diff: Optional[str] = None,
    ) -> Optional[TaskSnapshot]:
        """
        Record a file modification by a task.

        Call this after a task makes changes to a file.

        Args:
            task_id: The task that made the modification
            file_path: Path to the modified file
            old_content: File content before modification
            new_content: File content after modification
            raw_diff: Optional unified diff for reference

        Returns:
            Updated TaskSnapshot, or None if file not being tracked
        """
        rel_path = self._get_relative_path(file_path)

        # Get or create evolution
        if rel_path not in self._evolutions:
            logger.warning(f"File {rel_path} not being tracked, creating evolution")
            self.capture_baselines(task_id, [file_path])

        evolution = self._evolutions.get(rel_path)
        if not evolution:
            return None

        # Get existing snapshot or create new one
        snapshot = evolution.get_task_snapshot(task_id)
        if not snapshot:
            snapshot = TaskSnapshot(
                task_id=task_id,
                task_intent="",
                started_at=datetime.now(),
                content_hash_before=compute_content_hash(old_content),
            )

        # Analyze semantic changes
        analysis = self.analyzer.analyze_diff(
            rel_path, old_content, new_content
        )
        semantic_changes = analysis.changes

        # Update snapshot
        snapshot.completed_at = datetime.now()
        snapshot.content_hash_after = compute_content_hash(new_content)
        snapshot.semantic_changes = semantic_changes
        snapshot.raw_diff = raw_diff

        # Update evolution
        evolution.add_task_snapshot(snapshot)
        self._save_evolutions()

        logger.info(
            f"Recorded modification to {rel_path} by {task_id}: "
            f"{len(semantic_changes)} semantic changes"
        )
        return snapshot

    def get_file_evolution(self, file_path: Path | str) -> Optional[FileEvolution]:
        """
        Get the complete evolution history for a file.

        Args:
            file_path: Path to the file

        Returns:
            FileEvolution object, or None if not tracked
        """
        rel_path = self._get_relative_path(file_path)
        return self._evolutions.get(rel_path)

    def get_baseline_content(self, file_path: Path | str) -> Optional[str]:
        """
        Get the baseline content for a file.

        Args:
            file_path: Path to the file

        Returns:
            Original baseline content, or None if not available
        """
        rel_path = self._get_relative_path(file_path)
        evolution = self._evolutions.get(rel_path)

        if not evolution:
            return None

        baseline_path = self.storage_dir / evolution.baseline_snapshot_path
        if baseline_path.exists():
            return baseline_path.read_text(encoding="utf-8")
        return None

    def get_task_modifications(
        self,
        task_id: str,
    ) -> list[tuple[str, TaskSnapshot]]:
        """
        Get all file modifications made by a specific task.

        Args:
            task_id: The task identifier

        Returns:
            List of (file_path, TaskSnapshot) tuples
        """
        modifications = []
        for file_path, evolution in self._evolutions.items():
            snapshot = evolution.get_task_snapshot(task_id)
            if snapshot and snapshot.semantic_changes:
                modifications.append((file_path, snapshot))
        return modifications

    def get_files_modified_by_tasks(
        self,
        task_ids: list[str],
    ) -> dict[str, list[str]]:
        """
        Get files modified by specified tasks.

        Args:
            task_ids: List of task identifiers

        Returns:
            Dictionary mapping file paths to list of task IDs that modified them
        """
        file_tasks: dict[str, list[str]] = {}

        for file_path, evolution in self._evolutions.items():
            for snapshot in evolution.task_snapshots:
                if snapshot.task_id in task_ids and snapshot.semantic_changes:
                    if file_path not in file_tasks:
                        file_tasks[file_path] = []
                    file_tasks[file_path].append(snapshot.task_id)

        return file_tasks

    def get_conflicting_files(self, task_ids: list[str]) -> list[str]:
        """
        Get files modified by multiple tasks (potential conflicts).

        Args:
            task_ids: List of task identifiers to check

        Returns:
            List of file paths modified by 2+ tasks
        """
        file_tasks = self.get_files_modified_by_tasks(task_ids)
        return [
            file_path for file_path, tasks in file_tasks.items()
            if len(tasks) > 1
        ]

    def mark_task_completed(self, task_id: str) -> None:
        """
        Mark a task as completed (set completed_at on all snapshots).

        Args:
            task_id: The task identifier
        """
        now = datetime.now()
        for evolution in self._evolutions.values():
            snapshot = evolution.get_task_snapshot(task_id)
            if snapshot and snapshot.completed_at is None:
                snapshot.completed_at = now
        self._save_evolutions()

    def cleanup_task(
        self,
        task_id: str,
        remove_baselines: bool = True,
    ) -> None:
        """
        Clean up data for a completed/cancelled task.

        Args:
            task_id: The task identifier
            remove_baselines: Whether to remove stored baseline files
        """
        # Remove task snapshots from evolutions
        for evolution in self._evolutions.values():
            evolution.task_snapshots = [
                ts for ts in evolution.task_snapshots
                if ts.task_id != task_id
            ]

        # Remove baseline directory if requested
        if remove_baselines:
            baseline_dir = self.baselines_dir / task_id
            if baseline_dir.exists():
                shutil.rmtree(baseline_dir)
                logger.debug(f"Removed baseline directory for task {task_id}")

        # Clean up empty evolutions
        self._evolutions = {
            file_path: evolution
            for file_path, evolution in self._evolutions.items()
            if evolution.task_snapshots
        }

        self._save_evolutions()
        logger.info(f"Cleaned up data for task {task_id}")

    def get_active_tasks(self) -> set[str]:
        """
        Get set of task IDs with active (non-completed) modifications.

        Returns:
            Set of task IDs
        """
        active = set()
        for evolution in self._evolutions.values():
            for snapshot in evolution.task_snapshots:
                if snapshot.completed_at is None:
                    active.add(snapshot.task_id)
        return active

    def get_evolution_summary(self) -> dict:
        """
        Get a summary of tracked file evolutions.

        Returns:
            Dictionary with summary statistics
        """
        total_files = len(self._evolutions)
        all_tasks = set()
        files_with_multiple_tasks = 0
        total_changes = 0

        for evolution in self._evolutions.values():
            task_ids = [ts.task_id for ts in evolution.task_snapshots]
            all_tasks.update(task_ids)
            if len(task_ids) > 1:
                files_with_multiple_tasks += 1
            for snapshot in evolution.task_snapshots:
                total_changes += len(snapshot.semantic_changes)

        return {
            "total_files_tracked": total_files,
            "total_tasks": len(all_tasks),
            "files_with_potential_conflicts": files_with_multiple_tasks,
            "total_semantic_changes": total_changes,
            "active_tasks": len(self.get_active_tasks()),
        }

    def export_for_merge(
        self,
        file_path: Path | str,
        task_ids: Optional[list[str]] = None,
    ) -> Optional[dict]:
        """
        Export evolution data for a file in a format suitable for merge.

        This provides the data needed by the merge system to understand
        what each task did and in what order.

        Args:
            file_path: Path to the file
            task_ids: Optional list of tasks to include (default: all)

        Returns:
            Dictionary with merge-relevant evolution data
        """
        rel_path = self._get_relative_path(file_path)
        evolution = self._evolutions.get(rel_path)

        if not evolution:
            return None

        baseline_content = self.get_baseline_content(file_path)

        # Filter snapshots if task_ids specified
        snapshots = evolution.task_snapshots
        if task_ids:
            snapshots = [
                ts for ts in snapshots
                if ts.task_id in task_ids
            ]

        return {
            "file_path": rel_path,
            "baseline_content": baseline_content,
            "baseline_commit": evolution.baseline_commit,
            "baseline_hash": evolution.baseline_content_hash,
            "tasks": [
                {
                    "task_id": ts.task_id,
                    "intent": ts.task_intent,
                    "started_at": ts.started_at.isoformat(),
                    "completed_at": ts.completed_at.isoformat() if ts.completed_at else None,
                    "changes": [c.to_dict() for c in ts.semantic_changes],
                    "hash_before": ts.content_hash_before,
                    "hash_after": ts.content_hash_after,
                }
                for ts in snapshots
            ],
        }

    def refresh_from_git(
        self,
        task_id: str,
        worktree_path: Path,
    ) -> None:
        """
        Refresh task snapshots by analyzing git diff from worktree.

        This is useful when we didn't capture real-time modifications
        and need to retroactively analyze what a task changed.

        Args:
            task_id: The task identifier
            worktree_path: Path to the task's worktree
        """
        debug(MODULE, f"refresh_from_git() for task {task_id}",
              task_id=task_id,
              worktree_path=str(worktree_path))

        try:
            # Get list of files changed in the worktree
            result = subprocess.run(
                ["git", "diff", "--name-only", "main...HEAD"],
                cwd=worktree_path,
                capture_output=True,
                text=True,
                check=True,
            )
            changed_files = [f for f in result.stdout.strip().split("\n") if f]

            debug(MODULE, f"Found {len(changed_files)} changed files",
                  changed_files=changed_files[:10] if len(changed_files) > 10 else changed_files)

            for file_path in changed_files:
                # Get the diff for this file
                diff_result = subprocess.run(
                    ["git", "diff", "main...HEAD", "--", file_path],
                    cwd=worktree_path,
                    capture_output=True,
                    text=True,
                    check=True,
                )

                # Get content before (from main) and after (current)
                try:
                    show_result = subprocess.run(
                        ["git", "show", f"main:{file_path}"],
                        cwd=worktree_path,
                        capture_output=True,
                        text=True,
                        check=True,
                    )
                    old_content = show_result.stdout
                except subprocess.CalledProcessError:
                    # File is new
                    old_content = ""

                current_file = worktree_path / file_path
                if current_file.exists():
                    new_content = current_file.read_text(encoding="utf-8")
                else:
                    # File was deleted
                    new_content = ""

                # Record the modification
                self.record_modification(
                    task_id=task_id,
                    file_path=file_path,
                    old_content=old_content,
                    new_content=new_content,
                    raw_diff=diff_result.stdout,
                )

            logger.info(f"Refreshed {len(changed_files)} files from worktree for task {task_id}")

        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to refresh from git: {e}")
