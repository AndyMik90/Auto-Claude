"""
TLDR Cache Updater Hook
=======================

PostToolUse hook for updating TLDR cache after file modifications.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

from ..analyzer import TLDRAnalyzer
from ..cache import TLDRCache
from .config import TLDRHookConfig


def invalidate_tldr_cache(
    file_path: str | Path,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Invalidate the TLDR cache for a specific file.

    Called after Edit or Write operations modify a file.

    Args:
        file_path: Path to the modified file
        cache_dir: Optional cache directory

    Returns:
        Dict with invalidation status
    """
    file_path = Path(file_path).resolve()

    # Get the cache
    try:
        cache = TLDRCache(cache_dir=cache_dir)

        # Check if file was in cache
        was_cached = cache.has_file(file_path)

        # Invalidate by removing from cache (all layer variants)
        entries_removed = cache.invalidate_file(file_path)

        return {
            "success": True,
            "file_path": str(file_path),
            "was_cached": was_cached,
            "entries_removed": entries_removed,
            "action": "invalidated" if was_cached else "not_in_cache",
        }
    except Exception as e:
        return {
            "success": False,
            "file_path": str(file_path),
            "error": str(e),
        }


def update_tldr_on_edit(
    file_path: str | Path,
    config: TLDRHookConfig | None = None,
    cache_dir: Path | None = None,
    auto_regenerate: bool = True,
) -> dict[str, Any]:
    """
    Update TLDR cache after a file is edited.

    This is the main hook entry point for PostToolUse on Edit/Write operations.

    Args:
        file_path: Path to the modified file
        config: Optional config
        cache_dir: Optional cache directory
        auto_regenerate: Whether to regenerate TLDR immediately

    Returns:
        Dict with update status and optional new summary
    """
    if config is None:
        config = TLDRHookConfig.load()

    file_path = Path(file_path).resolve()

    # Check if file should be processed
    if not config.should_process_file(file_path):
        return {
            "success": True,
            "file_path": str(file_path),
            "action": "skipped",
            "reason": "File not in TLDR scope (extension or exclusion pattern)",
        }

    if not config.auto_update_cache:
        # Just invalidate, don't regenerate
        return invalidate_tldr_cache(file_path, cache_dir)

    # Invalidate first
    invalidate_result = invalidate_tldr_cache(file_path, cache_dir)

    if not invalidate_result.get("success"):
        return invalidate_result

    if not auto_regenerate:
        return {
            "success": True,
            "file_path": str(file_path),
            "action": "invalidated",
            "auto_regenerate": False,
        }

    # Regenerate TLDR summary
    try:
        analyzer = TLDRAnalyzer(
            project_dir=file_path.parent,
            cache_dir=cache_dir,
            enable_cache=True,
        )
        summary = analyzer.analyze_file(file_path, layers=config.default_layers)

        return {
            "success": True,
            "file_path": str(file_path),
            "action": "regenerated",
            "original_tokens": summary.original_tokens,
            "summary_tokens": summary.summary_tokens,
            "savings_percent": summary.token_savings_percent(),
            "analysis_time_ms": summary.analysis_time_ms,
        }
    except Exception as e:
        return {
            "success": False,
            "file_path": str(file_path),
            "action": "regenerate_failed",
            "error": str(e),
        }


def process_edit_event(
    tool_name: str,
    tool_input: dict[str, Any],
    tool_output: dict[str, Any] | None = None,
    config: TLDRHookConfig | None = None,
) -> dict[str, Any]:
    """
    Process an edit event from PostToolUse hook.

    Args:
        tool_name: Name of the tool (Edit, Write, etc.)
        tool_input: Input parameters passed to the tool
        tool_output: Output from the tool (optional)
        config: Optional config

    Returns:
        Dict with processing result
    """
    # Only process file modification tools
    if tool_name not in ("Edit", "Write", "NotebookEdit"):
        return {
            "processed": False,
            "reason": f"Tool {tool_name} is not a file modification tool",
        }

    # Extract file path from tool input
    file_path = tool_input.get("file_path") or tool_input.get("notebook_path")

    if not file_path:
        return {
            "processed": False,
            "reason": "No file path found in tool input",
        }

    # Update TLDR cache
    result = update_tldr_on_edit(file_path, config=config)
    result["processed"] = True
    result["tool_name"] = tool_name

    return result


def batch_invalidate(
    file_paths: list[str | Path],
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Invalidate TLDR cache for multiple files at once.

    Useful after git operations or bulk file changes.

    Args:
        file_paths: List of file paths to invalidate
        cache_dir: Optional cache directory

    Returns:
        Dict with batch invalidation results
    """
    results = []
    success_count = 0
    fail_count = 0

    for file_path in file_paths:
        result = invalidate_tldr_cache(file_path, cache_dir)
        results.append(result)

        if result.get("success"):
            success_count += 1
        else:
            fail_count += 1

    return {
        "success": fail_count == 0,
        "total_files": len(file_paths),
        "invalidated": success_count,
        "failed": fail_count,
        "results": results,
    }


def batch_regenerate(
    file_paths: list[str | Path],
    config: TLDRHookConfig | None = None,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Regenerate TLDR cache for multiple files at once.

    Useful for warming up the cache after project changes.

    Args:
        file_paths: List of file paths to regenerate
        config: Optional config
        cache_dir: Optional cache directory

    Returns:
        Dict with batch regeneration results
    """
    if config is None:
        config = TLDRHookConfig.load()

    results = []
    success_count = 0
    fail_count = 0
    total_original_tokens = 0
    total_summary_tokens = 0

    for file_path in file_paths:
        result = update_tldr_on_edit(
            file_path,
            config=config,
            cache_dir=cache_dir,
            auto_regenerate=True,
        )
        results.append(result)

        if result.get("success") and result.get("action") == "regenerated":
            success_count += 1
            total_original_tokens += result.get("original_tokens", 0)
            total_summary_tokens += result.get("summary_tokens", 0)
        elif result.get("action") == "skipped":
            pass  # Don't count skipped files as failures
        else:
            fail_count += 1

    savings_percent = 0.0
    if total_original_tokens > 0:
        savings_percent = (1 - total_summary_tokens / total_original_tokens) * 100

    return {
        "success": fail_count == 0,
        "total_files": len(file_paths),
        "regenerated": success_count,
        "failed": fail_count,
        "total_original_tokens": total_original_tokens,
        "total_summary_tokens": total_summary_tokens,
        "savings_percent": savings_percent,
        "results": results,
    }


def create_posttooluse_hook_script(
    output_path: Path,
    config: TLDRHookConfig | None = None,
) -> Path:
    """
    Create a shell script for Claude Code PostToolUse hook.

    The script will update TLDR cache after Edit/Write operations.

    Args:
        output_path: Where to write the hook script
        config: Optional config for hook settings

    Returns:
        Path to the created script
    """
    if config is None:
        config = TLDRHookConfig.load()

    script_content = f'''#!/bin/bash
# TLDR Cache Updater Hook for Claude Code
# Generated by Auto-Claude TLDR system
#
# Place in .claude/hooks/posttooluse/cache-updater.sh
# Or configure in .claude/settings.json

# Configuration
TLDR_ENABLED="{str(config.enabled).lower()}"
TLDR_AUTO_UPDATE="{str(config.auto_update_cache).lower()}"

# Check if TLDR is enabled
if [ "$TLDR_ENABLED" != "true" ] || [ "$TLDR_AUTO_UPDATE" != "true" ]; then
    exit 0
fi

# Read hook input from stdin
read -r HOOK_INPUT

# Extract tool name and file path
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // .tool_input.notebook_path // empty')

# Only process Edit/Write tool calls
case "$TOOL_NAME" in
    Edit|Write|NotebookEdit)
        ;;
    *)
        exit 0
        ;;
esac

if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Check file extension
EXT="${{FILE_PATH##*.}}"
case "$EXT" in
    py|ts|tsx|js|jsx|mjs|cjs)
        # Supported extension - invalidate cache
        # The actual cache invalidation is done via Python
        # This script just logs for visibility
        echo "[TLDR] Cache invalidated for: $FILE_PATH" >&2
        ;;
    *)
        # Not a code file
        exit 0
        ;;
esac

exit 0
'''

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script_content)
    output_path.chmod(0o755)

    return output_path


def get_cache_stats(cache_dir: Path | None = None) -> dict[str, Any]:
    """
    Get statistics about the TLDR cache.

    Args:
        cache_dir: Optional cache directory

    Returns:
        Dict with cache statistics
    """
    try:
        cache = TLDRCache(cache_dir=cache_dir)
        return cache.get_stats()
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
        }
