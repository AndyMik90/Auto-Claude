"""
Memory CLI Commands
===================

CLI commands for the memory extraction and query system.
"""

from __future__ import annotations

import json
from pathlib import Path

from ui import (
    Icons,
    bold,
    divider,
    error,
    highlight,
    icon,
    muted,
    print_status,
    success,
    warning,
)


def handle_memory_extract_command(
    directory: Path | None = None,
    output: Path | None = None,
) -> None:
    """Run memory extraction on transcript files."""
    from memory.extraction import (
        MemoryExtractionDaemon,
        DaemonConfig,
    )

    print_status("Running memory extraction...", "info")
    print()

    # Configure daemon
    config = DaemonConfig.from_env()

    if directory:
        config.transcript_dirs = [directory]

    if output:
        config.output_dir = output

    daemon = MemoryExtractionDaemon(config=config)

    # Run single extraction pass
    stats = daemon.run_once()

    print(bold("Extraction Complete"))
    print(divider())
    print(f"Transcripts found: {stats['transcripts_found']}")
    print(f"Transcripts processed: {stats['transcripts_processed']}")
    print(f"Insights extracted: {stats['insights_extracted']}")
    print()

    if stats['insights_extracted'] > 0:
        print(f"{icon(Icons.SUCCESS)} Insights saved to: {config.output_dir}")
    else:
        print(muted("No new insights found"))


def handle_memory_daemon_status_command() -> None:
    """Show memory extraction daemon status."""
    from memory.extraction import MemoryExtractionDaemon, DaemonConfig

    config = DaemonConfig.from_env()
    daemon = MemoryExtractionDaemon(config=config)
    stats = daemon.get_stats()

    print(bold("Memory Extraction Daemon Status"))
    print(divider())
    print()

    # Running status
    running_icon = Icons.SUCCESS if stats["running"] else Icons.ERROR
    print(f"{icon(running_icon)} Running: {stats['running']}")
    print()

    # Configuration
    print(bold("Configuration:"))
    print(f"  Poll interval: {stats['config']['poll_interval']}s")
    print(f"  Idle threshold: {stats['config']['idle_threshold']}s")
    print(f"  Use Graphiti: {stats['config']['use_graphiti']}")
    print(f"  Use file storage: {stats['config']['use_file_storage']}")
    print()

    # Transcript directories
    print(bold("Transcript Directories:"))
    for d in stats["config"]["transcript_dirs"]:
        exists = Path(d).exists()
        d_icon = Icons.FOLDER if exists else Icons.ERROR
        print(f"  {icon(d_icon)} {d}")
    print()

    # State
    print(bold("Processing State:"))
    print(f"  Files tracked: {stats['state']['processed_files']}")
    if stats['state']['last_check']:
        print(f"  Last check: {stats['state']['last_check']}")


def handle_memory_insights_command(
    session_id: str | None = None,
    insight_type: str | None = None,
    limit: int = 20,
    output_dir: Path | None = None,
) -> None:
    """View extracted insights."""
    from memory.extraction import DaemonConfig

    config = DaemonConfig.from_env()
    insights_dir = output_dir or config.output_dir

    if not insights_dir or not insights_dir.exists():
        print(warning("No insights directory found"))
        print(muted("Run --memory-extract first"))
        return

    # Find insight files
    if session_id:
        files = [insights_dir / f"{session_id}.json"]
    else:
        files = list(insights_dir.glob("*.json"))

    if not files:
        print(warning("No insight files found"))
        return

    all_insights = []
    for f in files:
        if not f.exists():
            continue
        # Skip state file if it somehow ended up here
        if f.name == "extraction_state.json":
            continue
        try:
            with open(f) as fp:
                insights = json.load(fp)
                # Ensure we have a list of dicts
                if isinstance(insights, list):
                    for i in insights:
                        if isinstance(i, dict):
                            i["_source_file"] = f.stem
                    all_insights.extend(insights)
        except (json.JSONDecodeError, OSError):
            continue

    # Filter by type
    if insight_type:
        all_insights = [i for i in all_insights if i.get("insight_type") == insight_type]

    # Sort by timestamp (newest first)
    all_insights.sort(key=lambda x: x.get("timestamp", ""), reverse=True)

    # Limit
    all_insights = all_insights[:limit]

    if not all_insights:
        print(warning("No matching insights found"))
        return

    print(bold(f"Extracted Insights ({len(all_insights)} shown)"))
    print(divider())
    print()

    for i, insight in enumerate(all_insights, 1):
        type_icon = _get_type_icon(insight.get("insight_type", ""))
        print(f"{i}. {icon(type_icon)} [{insight.get('insight_type', 'unknown')}] {bold(insight.get('title', 'Untitled'))}")
        print(f"   {muted(insight.get('content', '')[:100])}...")

        if insight.get("confidence"):
            conf = insight["confidence"]
            conf_color = success if conf > 0.7 else (warning if conf > 0.5 else muted)
            print(f"   Confidence: {conf_color(f'{conf:.0%}')}")

        if insight.get("related_files"):
            print(f"   Files: {', '.join(insight['related_files'][:3])}")

        if insight.get("tags"):
            print(f"   Tags: {', '.join(insight['tags'][:5])}")

        print()


def handle_memory_stats_command(output_dir: Path | None = None) -> None:
    """Show memory system statistics."""
    from memory.extraction import DaemonConfig

    config = DaemonConfig.from_env()
    insights_dir = output_dir or config.output_dir

    print(bold("Memory System Statistics"))
    print(divider())
    print()

    if not insights_dir or not insights_dir.exists():
        print(warning("No insights directory found"))
        return

    # Count insight files
    files = list(insights_dir.glob("*.json"))
    total_insights = 0
    by_type: dict[str, int] = {}
    by_session: dict[str, int] = {}

    for f in files:
        try:
            with open(f) as fp:
                insights = json.load(fp)
                session_id = f.stem
                by_session[session_id] = len(insights)
                total_insights += len(insights)

                for i in insights:
                    itype = i.get("insight_type", "unknown")
                    by_type[itype] = by_type.get(itype, 0) + 1
        except (json.JSONDecodeError, OSError):
            continue

    print(f"Total insights: {total_insights}")
    print(f"Sessions with insights: {len(by_session)}")
    print(f"Insights directory: {insights_dir}")
    print()

    # By type
    if by_type:
        print(bold("Insights by Type:"))
        for itype, count in sorted(by_type.items(), key=lambda x: -x[1]):
            type_icon = _get_type_icon(itype)
            print(f"  {icon(type_icon)} {itype}: {count}")
        print()

    # Top sessions
    if by_session:
        print(bold("Top Sessions:"))
        top_sessions = sorted(by_session.items(), key=lambda x: -x[1])[:5]
        for session_id, count in top_sessions:
            print(f"  {session_id}: {count} insights")


def handle_memory_clear_command(
    output_dir: Path | None = None,
    confirm: bool = False,
) -> None:
    """Clear extracted insights."""
    from memory.extraction import DaemonConfig

    config = DaemonConfig.from_env()
    insights_dir = output_dir or config.output_dir

    if not insights_dir or not insights_dir.exists():
        print(muted("No insights directory to clear"))
        return

    files = list(insights_dir.glob("*.json"))

    if not files:
        print(muted("No insight files to clear"))
        return

    if not confirm:
        print(warning(f"This will delete {len(files)} insight files"))
        print(muted("Use --confirm to proceed"))
        return

    for f in files:
        try:
            f.unlink()
        except OSError:
            pass

    # Also clear state file
    state_file = insights_dir.parent / "extraction_state.json"
    if state_file.exists():
        try:
            state_file.unlink()
        except OSError:
            pass

    print(success(f"Cleared {len(files)} insight files"))


def _get_type_icon(insight_type: str) -> str:
    """Get icon for insight type."""
    icons = {
        "gotcha": Icons.WARNING,
        "pattern": Icons.GEAR,
        "discovery": Icons.INFO,
        "failure": Icons.ERROR,
        "success": Icons.SUCCESS,
        "recommendation": Icons.PLAY,
        "decision": Icons.INFO,
        "workaround": Icons.WARNING,
        "reasoning": Icons.INFO,
    }
    return icons.get(insight_type, Icons.INFO)


# ============================================================================
# Memory Search Commands (Phase 7.2)
# ============================================================================


def handle_memory_index_build_command() -> None:
    """Build/rebuild the memory search index."""
    from memory.retrieval import MemorySearch

    print_status("Building memory search index...", "info")
    print()

    search = MemorySearch()
    count = search.rebuild_index()

    if count > 0:
        print(f"{icon(Icons.SUCCESS)} Indexed {count} insights")
        stats = search.get_stats()
        print(f"   Sessions: {stats['sessions']}")
        print(f"   Types: {', '.join(stats['by_type'].keys())}")
    else:
        print(muted("No insights to index. Run --memory-extract first."))


def handle_memory_search_command(
    query: str,
    limit: int = 10,
    insight_types: list[str] | None = None,
    session_id: str | None = None,
) -> None:
    """Search session memories."""
    from memory.retrieval import MemorySearch

    search = MemorySearch()
    stats = search.get_stats()

    if stats["total_entries"] == 0:
        print(warning("Memory index is empty."))
        print(muted("Run --memory-index-build to index insights."))
        return

    # Parse filters
    session_ids = [session_id] if session_id else None

    results = search.search(
        query=query,
        limit=limit,
        insight_types=insight_types,
        session_ids=session_ids,
    )

    if not results:
        print(warning("No matching insights found"))
        return

    print(bold(f"Search Results for: \"{query}\""))
    print(divider())
    print()

    for i, r in enumerate(results, 1):
        type_icon = _get_type_icon(r.insight_type)
        score_color = success if r.score > 0.7 else (highlight if r.score > 0.5 else muted)

        print(f"{i}. {icon(type_icon)} [{r.insight_type}] {bold(r.title)}")
        print(f"   {muted(r.content[:100])}...")
        print(f"   Score: {score_color(f'{r.score:.0%}')} | Session: {muted(r.session_id[:8])}...")

        if r.tags:
            print(f"   Tags: {', '.join(r.tags[:5])}")

        print()


def handle_memory_context_command(task: str) -> None:
    """Get relevant context from past sessions for a task."""
    from memory.retrieval import MemorySearch

    search = MemorySearch()
    stats = search.get_stats()

    if stats["total_entries"] == 0:
        print(warning("Memory index is empty."))
        print(muted("Run --memory-index-build to index insights."))
        return

    context = search.get_context_for_task(task)

    print(bold(f"Context for: \"{task}\""))
    print(divider())
    print()

    # Relevant insights
    if context["relevant"]:
        print(bold("Relevant Past Work:"))
        for r in context["relevant"][:3]:
            type_icon = _get_type_icon(r.insight_type)
            print(f"  {icon(type_icon)} {r.title}")
            print(f"     {muted(r.content[:80])}...")
        print()

    # Gotchas to watch out for
    if context["gotchas"]:
        print(bold("Watch Out For:"))
        for r in context["gotchas"]:
            print(f"  {icon(Icons.WARNING)} {r.title}")
            print(f"     {muted(r.content[:80])}...")
        print()

    # Patterns to follow
    if context["patterns"]:
        print(bold("Patterns to Follow:"))
        for r in context["patterns"]:
            print(f"  {icon(Icons.SUCCESS)} {r.title}")
            print(f"     {muted(r.content[:80])}...")
        print()

    if not any(context.values()):
        print(muted("No relevant context found for this task."))


def handle_memory_patterns_command(
    min_occurrences: int = 2,
) -> None:
    """Discover recurring patterns across sessions."""
    from memory.retrieval import MemorySearch

    search = MemorySearch()
    stats = search.get_stats()

    if stats["total_entries"] == 0:
        print(warning("Memory index is empty."))
        print(muted("Run --memory-index-build to index insights."))
        return

    patterns = search.discover_patterns(
        min_similarity=0.7,
        min_occurrences=min_occurrences,
    )

    if not patterns:
        print(muted("No recurring patterns found across sessions."))
        return

    print(bold(f"Recurring Patterns ({len(patterns)} found)"))
    print(divider())
    print()

    for i, p in enumerate(patterns, 1):
        type_icon = _get_type_icon(p["insight_type"])
        print(f"{i}. {icon(type_icon)} {bold(p['representative_title'])}")
        print(f"   {muted(p['representative_content'][:100])}...")
        print(f"   Occurrences: {p['occurrences']} across {len(p['sessions'])} sessions")
        print()


def handle_memory_index_stats_command() -> None:
    """Show memory search index statistics."""
    from memory.retrieval import MemorySearch

    search = MemorySearch()
    stats = search.get_stats()

    print(bold("Memory Search Index Statistics"))
    print(divider())
    print()

    print(f"Total indexed: {stats['total_entries']}")
    print(f"Sessions: {stats['sessions']}")
    print(f"Dimension: {stats['dimension']}")
    print(f"Index path: {stats['index_path']}")
    print()

    if stats["by_type"]:
        print(bold("Insights by Type:"))
        for itype, count in sorted(stats["by_type"].items(), key=lambda x: -x[1]):
            type_icon = _get_type_icon(itype)
            print(f"  {icon(type_icon)} {itype}: {count}")
