"""
Workspace Commands
==================

CLI commands for workspace management (merge, review, discard, list, cleanup)
"""

import sys
from pathlib import Path

# Ensure parent directory is in path for imports (before other imports)
_PARENT_DIR = Path(__file__).parent.parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))

from ui import (
    Icons,
    icon,
)
from workspace import (
    cleanup_all_worktrees,
    discard_existing_build,
    list_all_worktrees,
    merge_existing_build,
    review_existing_build,
)

from .utils import print_banner

# Import debug utilities
try:
    from debug import debug, debug_detailed, debug_verbose, debug_success, debug_error, debug_section, is_debug_enabled
except ImportError:
    def debug(*args, **kwargs): pass
    def debug_detailed(*args, **kwargs): pass
    def debug_verbose(*args, **kwargs): pass
    def debug_success(*args, **kwargs): pass
    def debug_error(*args, **kwargs): pass
    def debug_section(*args, **kwargs): pass
    def is_debug_enabled(): return False

MODULE = "cli.workspace_commands"


def handle_merge_command(
    project_dir: Path, spec_name: str, no_commit: bool = False
) -> bool:
    """
    Handle the --merge command.

    Args:
        project_dir: Project root directory
        spec_name: Name of the spec
        no_commit: If True, stage changes but don't commit

    Returns:
        True if merge succeeded, False otherwise
    """
    return merge_existing_build(project_dir, spec_name, no_commit=no_commit)


def handle_review_command(project_dir: Path, spec_name: str) -> None:
    """
    Handle the --review command.

    Args:
        project_dir: Project root directory
        spec_name: Name of the spec
    """
    review_existing_build(project_dir, spec_name)


def handle_discard_command(project_dir: Path, spec_name: str) -> None:
    """
    Handle the --discard command.

    Args:
        project_dir: Project root directory
        spec_name: Name of the spec
    """
    discard_existing_build(project_dir, spec_name)


def handle_list_worktrees_command(project_dir: Path) -> None:
    """
    Handle the --list-worktrees command.

    Args:
        project_dir: Project root directory
    """
    print_banner()
    print("\n" + "=" * 70)
    print("  SPEC WORKTREES")
    print("=" * 70)
    print()

    worktrees = list_all_worktrees(project_dir)
    if not worktrees:
        print("  No worktrees found.")
        print()
        print("  Worktrees are created when you run a build in isolated mode.")
    else:
        for wt in worktrees:
            print(f"  {icon(Icons.FOLDER)} {wt.spec_name}")
            print(f"       Branch: {wt.branch}")
            print(f"       Path: {wt.path}")
            print(f"       Commits: {wt.commit_count}, Files: {wt.files_changed}")
            print()

        print("-" * 70)
        print()
        print("  To merge:   python auto-claude/run.py --spec <name> --merge")
        print("  To review:  python auto-claude/run.py --spec <name> --review")
        print("  To discard: python auto-claude/run.py --spec <name> --discard")
        print()
        print(
            "  To cleanup all worktrees: python auto-claude/run.py --cleanup-worktrees"
        )
    print()


def handle_cleanup_worktrees_command(project_dir: Path) -> None:
    """
    Handle the --cleanup-worktrees command.

    Args:
        project_dir: Project root directory
    """
    print_banner()
    cleanup_all_worktrees(project_dir, confirm=True)


def handle_merge_preview_command(project_dir: Path, spec_name: str) -> dict:
    """
    Handle the --merge-preview command.

    Returns a JSON-serializable preview of merge conflicts without
    actually performing the merge. This is used by the UI to show
    potential conflicts before the user clicks "Stage Changes".

    Args:
        project_dir: Project root directory
        spec_name: Name of the spec

    Returns:
        Dictionary with preview information
    """
    debug_section(MODULE, "Merge Preview Command")
    debug(MODULE, "handle_merge_preview_command() called",
          project_dir=str(project_dir),
          spec_name=spec_name)

    from workspace import get_existing_build_worktree
    from merge import MergeOrchestrator

    worktree_path = get_existing_build_worktree(project_dir, spec_name)
    debug(MODULE, f"Worktree lookup result",
          worktree_path=str(worktree_path) if worktree_path else None)

    if not worktree_path:
        debug_error(MODULE, f"No existing build found for '{spec_name}'")
        return {
            "success": False,
            "error": f"No existing build found for '{spec_name}'",
            "files": [],
            "conflicts": [],
            "summary": {
                "totalFiles": 0,
                "conflictFiles": 0,
                "totalConflicts": 0,
                "autoMergeable": 0,
            }
        }

    try:
        debug(MODULE, "Initializing MergeOrchestrator for preview...")

        # Initialize the orchestrator
        orchestrator = MergeOrchestrator(
            project_dir,
            enable_ai=False,  # Don't use AI for preview
            dry_run=True,  # Don't write anything
        )

        # Refresh evolution data from the worktree
        debug(MODULE, f"Refreshing evolution data from worktree: {worktree_path}")
        orchestrator.evolution_tracker.refresh_from_git(spec_name, worktree_path)

        # Get merge preview
        debug(MODULE, "Generating merge preview...")
        preview = orchestrator.preview_merge([spec_name])

        # Transform to UI-friendly format
        conflicts = []
        for c in preview.get("conflicts", []):
            debug_verbose(MODULE, f"Processing conflict",
                         file=c.get("file", ""),
                         severity=c.get("severity", "unknown"))
            conflicts.append({
                "file": c.get("file", ""),
                "location": c.get("location", ""),
                "tasks": c.get("tasks", []),
                "severity": c.get("severity", "unknown"),
                "canAutoMerge": c.get("can_auto_merge", False),
                "strategy": c.get("strategy"),
                "reason": c.get("reason", ""),
            })

        summary = preview.get("summary", {})

        result = {
            "success": True,
            "files": preview.get("files_to_merge", []),
            "conflicts": conflicts,
            "summary": {
                "totalFiles": summary.get("total_files", 0),
                "conflictFiles": summary.get("conflict_files", 0),
                "totalConflicts": summary.get("total_conflicts", 0),
                "autoMergeable": summary.get("auto_mergeable", 0),
            }
        }

        debug_success(MODULE, "Merge preview complete",
                     total_files=result["summary"]["totalFiles"],
                     total_conflicts=result["summary"]["totalConflicts"],
                     auto_mergeable=result["summary"]["autoMergeable"])

        return result

    except Exception as e:
        debug_error(MODULE, f"Merge preview failed", error=str(e))
        import traceback
        debug_verbose(MODULE, "Exception traceback", traceback=traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "files": [],
            "conflicts": [],
            "summary": {
                "totalFiles": 0,
                "conflictFiles": 0,
                "totalConflicts": 0,
                "autoMergeable": 0,
            }
        }
