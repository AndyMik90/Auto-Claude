"""
TLDR CLI Commands
=================

CLI commands for TLDR code analysis and token efficiency.
"""

from __future__ import annotations

from pathlib import Path

from tldr import TLDRAnalyzer, TLDRSummary
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


def handle_tldr_command(file_path: str, layers: list[int] | None = None) -> None:
    """Show TLDR summary for a file."""
    path = Path(file_path).resolve()

    if not path.exists():
        print_status(f"File not found: {file_path}", "error")
        return

    # Use parent directory as project_dir, pass absolute path to analyzer
    project_dir = path.parent if path.is_file() else path
    analyzer = TLDRAnalyzer(project_dir=project_dir)
    summary = analyzer.analyze_file(path, layers=layers)

    if summary.errors:
        print_status(f"Analysis errors: {', '.join(summary.errors)}", "warning")

    # Header
    print(bold(f"TLDR: {summary.file_path}"))
    print(divider())

    # Stats
    savings = summary.token_savings_percent()
    savings_color = success if savings > 80 else (warning if savings > 50 else error)
    print(f"Language: {summary.language}")
    print(f"Lines: {summary.total_lines}")
    print(f"Original tokens: {summary.original_tokens:,}")
    print(f"Summary tokens: {summary.summary_tokens:,}")
    print(f"Token savings: {savings_color(f'{savings:.1f}%')}")
    print(f"Analysis time: {summary.analysis_time_ms:.1f}ms")
    print()

    # Compact output
    print(bold("Compact Summary:"))
    print(divider())
    print(summary.to_compact())


def handle_tldr_index_command(directory: Path | None = None) -> None:
    """Build or rebuild the TLDR index for a project."""
    project_dir = directory or Path.cwd()

    print_status("Building TLDR index...", "info")
    print(f"Directory: {project_dir}")
    print()

    analyzer = TLDRAnalyzer(project_dir=project_dir)
    summaries = analyzer.analyze_directory(layers=[1, 2])

    # Calculate totals
    total_files = len(summaries)
    total_lines = sum(s.total_lines for s in summaries)
    original_tokens = sum(s.original_tokens for s in summaries)
    summary_tokens = sum(s.summary_tokens for s in summaries)
    errors = [s for s in summaries if s.errors]

    print(bold("Index Complete"))
    print(divider())
    print(f"Files indexed: {total_files}")
    print(f"Total lines: {total_lines:,}")
    print(f"Original tokens: {original_tokens:,}")
    print(f"Summary tokens: {summary_tokens:,}")

    if original_tokens > 0:
        savings = (1 - summary_tokens / original_tokens) * 100
        print(f"Token savings: {success(f'{savings:.1f}%')}")
    print()

    if errors:
        print(warning(f"Files with errors: {len(errors)}"))
        for s in errors[:5]:
            print(f"  {muted(s.file_path)}: {s.errors[0]}")
        if len(errors) > 5:
            print(muted(f"  ... and {len(errors) - 5} more"))


def handle_tldr_stats_command(directory: Path | None = None) -> None:
    """Show token savings statistics for a project."""
    project_dir = directory or Path.cwd()

    analyzer = TLDRAnalyzer(project_dir=project_dir)
    stats = analyzer.get_project_summary(layers=[1])

    print(bold("TLDR Token Savings Report"))
    print(divider())
    print()

    # Overall stats
    print(f"{icon(Icons.FILE)} Files analyzed: {stats['files_analyzed']}")
    print(f"{icon(Icons.INFO)} Total lines: {stats['total_lines']:,}")
    print(f"{icon(Icons.GEAR)} Functions: {stats['total_functions']}")
    print(f"{icon(Icons.FOLDER)} Classes: {stats['total_classes']}")
    print()

    # Token analysis
    print(bold("Token Analysis:"))
    print(f"  Original: {stats['original_tokens']:,} tokens")
    print(f"  Summary:  {stats['summary_tokens']:,} tokens")
    savings_pct = f"{stats['token_savings_percent']:.1f}%"
    print(f"  Savings:  {success(savings_pct)}")
    print()

    # Cost estimation (approximate)
    # Claude: ~$3/1M input tokens for Sonnet
    original_cost = (stats['original_tokens'] / 1_000_000) * 3.0
    summary_cost = (stats['summary_tokens'] / 1_000_000) * 3.0
    savings_cost = original_cost - summary_cost

    print(bold("Estimated Cost Impact:"))
    print(f"  Without TLDR: ${original_cost:.4f} per full read")
    print(f"  With TLDR:    ${summary_cost:.4f} per summary read")
    print(f"  Savings:      {success(f'${savings_cost:.4f}')} per context load")
    print()

    # Languages
    print(f"Languages: {', '.join(stats['languages'])}")

    # Entry points
    if stats['entry_points']:
        print()
        print(bold("Entry Points:"))
        for ep in stats['entry_points'][:5]:
            print(f"  {icon(Icons.PLAY)} {ep}")

    # Cache stats
    cache_stats = analyzer.get_cache_stats()
    if cache_stats.get('enabled'):
        print()
        print(bold("Cache:"))
        print(f"  Entries: {cache_stats.get('memory_entries', 0)}")
        print(f"  Hit rate: {cache_stats.get('hit_rate', 0) * 100:.1f}%")


def handle_tldr_file_command(file_path: str, output_format: str = "compact") -> None:
    """
    Analyze a single file and output in specified format.

    Args:
        file_path: Path to file to analyze
        output_format: Output format - compact, json, or full
    """
    path = Path(file_path).resolve()

    if not path.exists():
        print_status(f"File not found: {file_path}", "error")
        return

    analyzer = TLDRAnalyzer(project_dir=path.parent)
    summary = analyzer.analyze_file(path, layers=[1, 2, 3])

    if output_format == "json":
        import json
        print(json.dumps(summary.to_dict(), indent=2))
    elif output_format == "full":
        handle_tldr_command(file_path, layers=[1, 2, 3, 4, 5])
    else:
        # Compact output (default)
        print(summary.to_compact())


def handle_tldr_compare_command(file_path: str) -> None:
    """Compare original file size vs TLDR summary."""
    path = Path(file_path).resolve()

    if not path.exists():
        print_status(f"File not found: {file_path}", "error")
        return

    # Read original file
    try:
        original = path.read_text()
        original_lines = original.count('\n') + 1
        original_chars = len(original)
        original_tokens = original_chars // 4  # Rough estimate
    except Exception as e:
        print_status(f"Error reading file: {e}", "error")
        return

    # Get TLDR summary
    analyzer = TLDRAnalyzer(project_dir=path.parent, enable_cache=False)
    summary = analyzer.analyze_file(path, layers=[1, 2, 3])

    compact = summary.to_compact()
    compact_lines = compact.count('\n') + 1
    compact_chars = len(compact)

    print(bold(f"TLDR Comparison: {path.name}"))
    print(divider())
    print()

    # Side by side comparison
    print(f"{'Metric':<20} {'Original':>15} {'TLDR':>15} {'Reduction':>15}")
    print("-" * 65)
    print(f"{'Lines':<20} {original_lines:>15,} {compact_lines:>15,} {(1 - compact_lines/original_lines) * 100:>14.1f}%")
    print(f"{'Characters':<20} {original_chars:>15,} {compact_chars:>15,} {(1 - compact_chars/original_chars) * 100:>14.1f}%")
    print(f"{'Est. Tokens':<20} {original_tokens:>15,} {summary.summary_tokens:>15,} {summary.token_savings_percent():>14.1f}%")
    print()

    # Show what's preserved
    print(bold("What TLDR Preserves:"))
    print(f"  {icon(Icons.SUCCESS)} Imports: {len(summary.imports)}")
    print(f"  {icon(Icons.SUCCESS)} Classes: {len(summary.classes)}")
    print(f"  {icon(Icons.SUCCESS)} Functions: {len(summary.functions)}")
    print(f"  {icon(Icons.SUCCESS)} Call graph edges: {len(summary.call_graph)}")
    print(f"  {icon(Icons.SUCCESS)} Type signatures")
    print(f"  {icon(Icons.SUCCESS)} Docstrings (truncated)")
    print()

    print(bold("What TLDR Removes:"))
    print(f"  {icon(Icons.ERROR)} Function bodies")
    print(f"  {icon(Icons.ERROR)} Implementation details")
    print(f"  {icon(Icons.ERROR)} Comments (non-doc)")
    print(f"  {icon(Icons.ERROR)} Whitespace/formatting")


def handle_clear_tldr_cache_command() -> None:
    """Clear the TLDR cache."""
    analyzer = TLDRAnalyzer()
    analyzer.clear_cache()
    print_status("TLDR cache cleared", "success")


def handle_tldr_hooks_setup_command(directory: Path | None = None) -> None:
    """Set up TLDR hooks for Claude Code integration."""
    from tldr.hooks import setup_tldr_hooks, TLDRHookConfig

    project_dir = directory or Path.cwd()

    print_status("Setting up TLDR hooks...", "info")
    print(f"Project directory: {project_dir}")
    print()

    result = setup_tldr_hooks(project_dir)

    if result.get("hooks_created"):
        print(bold("Hooks Created:"))
        for hook_path in result["hooks_created"]:
            print(f"  {icon(Icons.SUCCESS)} {hook_path}")
        print()

    if result.get("settings_updated"):
        print(f"{icon(Icons.SUCCESS)} Claude Code settings updated")

    if result.get("config_saved"):
        print(f"{icon(Icons.SUCCESS)} TLDR configuration saved")

    print()
    print(success("TLDR hooks installed successfully!"))
    print()
    print(muted("Hooks will:"))
    print(muted("  - Suggest TLDR for large file reads (PreToolUse)"))
    print(muted("  - Update cache after file edits (PostToolUse)"))


def handle_tldr_hooks_status_command(directory: Path | None = None) -> None:
    """Show status of TLDR hooks."""
    from tldr.hooks import get_hook_status

    project_dir = directory or Path.cwd()
    status = get_hook_status(project_dir)

    print(bold("TLDR Hooks Status"))
    print(divider())
    print()

    # Config status
    config_icon = Icons.SUCCESS if status["config_exists"] else Icons.ERROR
    print(f"{icon(config_icon)} Configuration: {'Found' if status['config_exists'] else 'Not found'}")

    if status["config_exists"]:
        enabled_icon = Icons.SUCCESS if status["enabled"] else Icons.WARNING
        print(f"  {icon(enabled_icon)} Enabled: {status['enabled']}")
        print(f"  {icon(Icons.GEAR)} Mode: {status['mode']}")

    print()

    # Hook scripts status
    pretool_icon = Icons.SUCCESS if status["pretool_hook_exists"] else Icons.ERROR
    posttool_icon = Icons.SUCCESS if status["posttool_hook_exists"] else Icons.ERROR
    print(f"{icon(pretool_icon)} PreToolUse hook: {'Installed' if status['pretool_hook_exists'] else 'Not installed'}")
    print(f"{icon(posttool_icon)} PostToolUse hook: {'Installed' if status['posttool_hook_exists'] else 'Not installed'}")

    print()

    # Settings status
    settings_icon = Icons.SUCCESS if status["hooks_configured"] else Icons.WARNING
    print(f"{icon(settings_icon)} Settings configured: {status['hooks_configured']}")

    if not status["hooks_configured"] and (status["pretool_hook_exists"] or status["posttool_hook_exists"]):
        print()
        print(warning("Hooks exist but not configured in .claude/settings.json"))
        print(muted("Run 'auto-claude --tldr-hooks-setup' to configure"))


def handle_tldr_hooks_remove_command(directory: Path | None = None) -> None:
    """Remove TLDR hooks."""
    from tldr.hooks import remove_tldr_hooks

    project_dir = directory or Path.cwd()

    print_status("Removing TLDR hooks...", "info")

    result = remove_tldr_hooks(project_dir)

    if result.get("hooks_removed"):
        print(bold("Hooks Removed:"))
        for hook_path in result["hooks_removed"]:
            print(f"  {icon(Icons.SUCCESS)} {hook_path}")
    else:
        print(muted("No hook scripts found to remove"))

    if result.get("settings_updated"):
        print(f"{icon(Icons.SUCCESS)} Claude Code settings updated")

    print()
    print(success("TLDR hooks removed"))


def handle_tldr_semantic_build_command(directory: Path | None = None) -> None:
    """Build or rebuild the semantic search index."""
    from tldr.semantic.search import build_index

    project_dir = directory or Path.cwd()

    print_status("Building semantic search index...", "info")
    print(f"Directory: {project_dir}")
    print()

    index, stats = build_index(project_dir, max_files=500)

    print(bold("Index Complete"))
    print(divider())
    print(f"Files indexed: {stats['files_indexed']}")
    print(f"Files skipped (cached): {stats['files_skipped']}")
    print(f"Entries added: {stats['entries_added']}")
    print(f"Total entries: {stats['total_entries']}")
    print()

    idx_stats = index.get_stats()
    print(bold("Index Statistics:"))
    print(f"  Embedder: {idx_stats['embedder_type']}")
    print(f"  Dimensions: {idx_stats['embedder_dimensions']}")
    print(f"  Entry types: {idx_stats['entry_types']}")


def handle_tldr_semantic_search_command(
    query: str,
    directory: Path | None = None,
    limit: int = 10,
    entry_types: str | None = None,
) -> None:
    """Search the codebase with natural language."""
    from tldr.semantic.search import search_codebase

    project_dir = directory or Path.cwd()

    # Parse entry types
    type_filter = None
    if entry_types:
        type_filter = [t.strip() for t in entry_types.split(",")]

    results = search_codebase(
        query=query,
        project_dir=project_dir,
        limit=limit,
        entry_types=type_filter,
    )

    if not results:
        print(warning("No results found"))
        print(muted("Try running --tldr-semantic-build first"))
        return

    print(bold(f"Semantic Search: \"{query}\""))
    print(divider())
    print()

    for r in results:
        score_color = success if r.score > 0.5 else (highlight if r.score > 0.3 else muted)

        print(f"{r.rank}. {bold(r.name)} ({r.entry_type})")
        print(f"   {muted(r.file_path)}")
        print(f"   Score: {score_color(f'{r.score:.3f}')}")

        if r.signature:
            print(f"   {highlight(r.signature)}")

        if r.line_number:
            print(f"   Line: {r.line_number}")

        if r.related:
            print(f"   Related: {', '.join(r.related[:3])}")

        print()


def handle_tldr_semantic_stats_command(directory: Path | None = None) -> None:
    """Show semantic index statistics."""
    from tldr.semantic import SemanticIndex

    project_dir = directory or Path.cwd()
    index = SemanticIndex(index_dir=project_dir / ".auto-claude" / "tldr-index")

    stats = index.get_stats()

    print(bold("Semantic Index Statistics"))
    print(divider())
    print()

    if stats["total_entries"] == 0:
        print(warning("No index found"))
        print(muted("Run --tldr-semantic-build to create the index"))
        return

    print(f"Total entries: {stats['total_entries']}")
    print(f"Files indexed: {stats['file_count']}")
    print(f"Embedder: {stats['embedder_type']}")
    print(f"Dimensions: {stats['embedder_dimensions']}")
    print()

    print(bold("Entry Types:"))
    for entry_type, count in stats["entry_types"].items():
        print(f"  {entry_type}: {count}")

    print()
    print(f"Index location: {muted(stats['index_dir'])}")
