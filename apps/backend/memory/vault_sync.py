#!/usr/bin/env python3
"""
Vault Sync Module
=================

Synchronizes session insights and learnings to an external vault (Obsidian/markdown).
This provides persistent cross-project memory that survives beyond individual specs.

Vault Structure:
    ~/vaults/{vault}/memory/
    ├── learnings/
    │   └── {project-name}/
    │       └── {spec-name}.md      # Consolidated learnings from spec
    ├── sessions/
    │   └── {project-name}/
    │       └── {spec-name}/
    │           └── session_001.md  # Individual session insights
    └── discoveries/
        └── {project-name}/
            └── {spec-name}.md      # Codebase discoveries

Configuration:
    Set VAULT_PATH or OBSIDIAN_VAULT_PATH environment variable to enable.
    Example: VAULT_PATH=~/.auto-claude/vault
"""

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .codebase_map import load_codebase_map
from .patterns import load_gotchas, load_patterns
from .sessions import load_all_insights

logger = logging.getLogger(__name__)


def get_vault_path() -> Path | None:
    """
    Get the configured vault path from environment variables.

    Returns:
        Path to vault directory, or None if not configured
    """
    vault_path = os.environ.get("VAULT_PATH") or os.environ.get("OBSIDIAN_VAULT_PATH")
    if not vault_path:
        return None

    expanded = Path(vault_path).expanduser().resolve()
    if not expanded.exists():
        logger.warning(f"Vault path does not exist: {expanded}")
        return None

    return expanded


def is_vault_sync_enabled() -> bool:
    """Check if vault sync is enabled (vault path is configured and exists)."""
    return get_vault_path() is not None


def _get_project_name(spec_dir: Path) -> str:
    """
    Extract project name from spec directory path.

    spec_dir is typically: /path/to/project/.auto-claude/specs/001-feature/
    We want to extract the project name from the path.
    """
    # Walk up from spec_dir to find .auto-claude parent
    current = spec_dir.resolve()
    while current.parent != current:
        if current.name == ".auto-claude":
            return current.parent.name
        current = current.parent

    # Fallback to parent of spec_dir
    return spec_dir.parent.parent.parent.name


def _get_spec_name(spec_dir: Path) -> str:
    """Extract spec name from spec directory (e.g., '001-add-feature')."""
    return spec_dir.name


def _format_session_as_markdown(session: dict[str, Any]) -> str:
    """Convert a session insights dict to markdown format."""
    lines = []

    session_num = session.get("session_number", "?")
    timestamp = session.get("timestamp", "Unknown")

    lines.append(f"# Session {session_num}")
    lines.append(f"**Date:** {timestamp}")
    lines.append("")

    # Subtasks completed
    subtasks = session.get("subtasks_completed", [])
    if subtasks:
        lines.append("## Subtasks Completed")
        for task in subtasks:
            lines.append(f"- {task}")
        lines.append("")

    # Discoveries
    discoveries = session.get("discoveries", {})
    if discoveries:
        lines.append("## Discoveries")

        files_understood = discoveries.get("files_understood", {})
        if files_understood:
            lines.append("### Files Understood")
            for path, purpose in files_understood.items():
                lines.append(f"- `{path}`: {purpose}")
            lines.append("")

        patterns_found = discoveries.get("patterns_found", [])
        if patterns_found:
            lines.append("### Patterns Found")
            for pattern in patterns_found:
                lines.append(f"- {pattern}")
            lines.append("")

        gotchas = discoveries.get("gotchas_encountered", [])
        if gotchas:
            lines.append("### Gotchas Encountered")
            for gotcha in gotchas:
                lines.append(f"- {gotcha}")
            lines.append("")

    # What worked
    what_worked = session.get("what_worked", [])
    if what_worked:
        lines.append("## What Worked")
        for item in what_worked:
            lines.append(f"- {item}")
        lines.append("")

    # What failed
    what_failed = session.get("what_failed", [])
    if what_failed:
        lines.append("## What Failed")
        for item in what_failed:
            lines.append(f"- {item}")
        lines.append("")

    # Recommendations
    recommendations = session.get("recommendations_for_next_session", [])
    if recommendations:
        lines.append("## Recommendations")
        for rec in recommendations:
            lines.append(f"- {rec}")
        lines.append("")

    return "\n".join(lines)


def _format_learnings_as_markdown(
    spec_name: str,
    patterns: list[str],
    gotchas: list[str],
    sessions: list[dict[str, Any]],
) -> str:
    """Create a consolidated learnings markdown file from all session data."""
    lines = []

    lines.append(f"# Learnings: {spec_name}")
    lines.append(f"**Last Updated:** {datetime.now(timezone.utc).isoformat()}")
    lines.append("")

    # Aggregate all patterns
    all_patterns = set(patterns)
    for session in sessions:
        discoveries = session.get("discoveries", {})
        for pattern in discoveries.get("patterns_found", []):
            all_patterns.add(pattern)

    if all_patterns:
        lines.append("## Patterns")
        for pattern in sorted(all_patterns):
            lines.append(f"- {pattern}")
        lines.append("")

    # Aggregate all gotchas
    all_gotchas = set(gotchas)
    for session in sessions:
        discoveries = session.get("discoveries", {})
        for gotcha in discoveries.get("gotchas_encountered", []):
            all_gotchas.add(gotcha)

    if all_gotchas:
        lines.append("## Gotchas")
        for gotcha in sorted(all_gotchas):
            lines.append(f"- {gotcha}")
        lines.append("")

    # Aggregate what worked
    all_worked = set()
    for session in sessions:
        for item in session.get("what_worked", []):
            all_worked.add(item)

    if all_worked:
        lines.append("## What Worked")
        for item in sorted(all_worked):
            lines.append(f"- {item}")
        lines.append("")

    # Aggregate what failed
    all_failed = set()
    for session in sessions:
        for item in session.get("what_failed", []):
            all_failed.add(item)

    if all_failed:
        lines.append("## What To Avoid")
        for item in sorted(all_failed):
            lines.append(f"- {item}")
        lines.append("")

    # Latest recommendations
    if sessions:
        latest = sessions[-1]
        recommendations = latest.get("recommendations_for_next_session", [])
        if recommendations:
            lines.append("## Latest Recommendations")
            for rec in recommendations:
                lines.append(f"- {rec}")
            lines.append("")

    return "\n".join(lines)


def _format_discoveries_as_markdown(
    spec_name: str, codebase_map: dict[str, str]
) -> str:
    """Format codebase discoveries as markdown."""
    lines = []

    lines.append(f"# Codebase Discoveries: {spec_name}")
    lines.append(f"**Last Updated:** {datetime.now(timezone.utc).isoformat()}")
    lines.append("")

    if not codebase_map:
        lines.append("*No discoveries recorded yet.*")
        return "\n".join(lines)

    # Group by directory
    by_dir: dict[str, list[tuple[str, str]]] = {}
    for path, purpose in sorted(codebase_map.items()):
        if path.startswith("_"):  # Skip metadata
            continue
        dir_name = str(Path(path).parent) if "/" in path or "\\" in path else "."
        if dir_name not in by_dir:
            by_dir[dir_name] = []
        by_dir[dir_name].append((path, purpose))

    for dir_name, files in sorted(by_dir.items()):
        lines.append(f"## {dir_name}/")
        for path, purpose in files:
            filename = Path(path).name
            lines.append(f"- `{filename}`: {purpose}")
        lines.append("")

    return "\n".join(lines)


def sync_to_vault(spec_dir: Path, project_dir: Path | None = None) -> bool:
    """
    Sync all memory from a spec to the external vault.

    This creates/updates:
    - learnings/{project}/{spec}.md - Consolidated learnings
    - sessions/{project}/{spec}/session_NNN.md - Individual sessions
    - discoveries/{project}/{spec}.md - Codebase discoveries

    Args:
        spec_dir: Path to spec directory containing memory/
        project_dir: Optional project directory (for better naming)

    Returns:
        True if sync succeeded, False if vault not configured or sync failed
    """
    vault_path = get_vault_path()
    if not vault_path:
        logger.debug("Vault sync skipped - no vault path configured")
        return False

    try:
        project_name = (
            project_dir.name if project_dir else _get_project_name(spec_dir)
        )
        spec_name = _get_spec_name(spec_dir)

        logger.info(f"Syncing memory to vault: {vault_path}")
        logger.info(f"  Project: {project_name}, Spec: {spec_name}")

        # Load all memory data
        sessions = load_all_insights(spec_dir)
        patterns = load_patterns(spec_dir)
        gotchas = load_gotchas(spec_dir)
        codebase_map = load_codebase_map(spec_dir)

        # Create vault directories
        memory_root = vault_path / "memory"
        learnings_dir = memory_root / "learnings" / project_name
        sessions_dir = memory_root / "sessions" / project_name / spec_name
        discoveries_dir = memory_root / "discoveries" / project_name

        learnings_dir.mkdir(parents=True, exist_ok=True)
        sessions_dir.mkdir(parents=True, exist_ok=True)
        discoveries_dir.mkdir(parents=True, exist_ok=True)

        # Sync individual session files
        for session in sessions:
            session_num = session.get("session_number", 0)
            session_file = sessions_dir / f"session_{session_num:03d}.md"
            session_md = _format_session_as_markdown(session)
            session_file.write_text(session_md, encoding="utf-8")
            logger.debug(f"  Synced: {session_file.name}")

        # Sync consolidated learnings
        if sessions or patterns or gotchas:
            learnings_file = learnings_dir / f"{spec_name}.md"
            learnings_md = _format_learnings_as_markdown(
                spec_name, patterns, gotchas, sessions
            )
            learnings_file.write_text(learnings_md, encoding="utf-8")
            logger.debug(f"  Synced: {learnings_file}")

        # Sync codebase discoveries
        if codebase_map:
            discoveries_file = discoveries_dir / f"{spec_name}.md"
            discoveries_md = _format_discoveries_as_markdown(spec_name, codebase_map)
            discoveries_file.write_text(discoveries_md, encoding="utf-8")
            logger.debug(f"  Synced: {discoveries_file}")

        logger.info(
            f"Vault sync complete: {len(sessions)} sessions, "
            f"{len(patterns)} patterns, {len(gotchas)} gotchas"
        )
        return True

    except Exception as e:
        logger.error(f"Vault sync failed: {e}")
        return False


def sync_session_to_vault(
    spec_dir: Path, session_num: int, session_data: dict[str, Any]
) -> bool:
    """
    Sync a single session to the vault (called after each session completes).

    This is more efficient than full sync when only one session changed.

    Args:
        spec_dir: Path to spec directory
        session_num: Session number
        session_data: Session insights dictionary

    Returns:
        True if sync succeeded, False otherwise
    """
    vault_path = get_vault_path()
    if not vault_path:
        return False

    try:
        project_name = _get_project_name(spec_dir)
        spec_name = _get_spec_name(spec_dir)

        # Create session directory
        sessions_dir = (
            vault_path / "memory" / "sessions" / project_name / spec_name
        )
        sessions_dir.mkdir(parents=True, exist_ok=True)

        # Write session file
        session_file = sessions_dir / f"session_{session_num:03d}.md"
        session_md = _format_session_as_markdown(session_data)
        session_file.write_text(session_md, encoding="utf-8")

        logger.info(f"Session {session_num} synced to vault: {session_file}")
        return True

    except Exception as e:
        logger.error(f"Session vault sync failed: {e}")
        return False
