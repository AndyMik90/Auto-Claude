"""
TLDR Read Enforcer Hook
=======================

PreToolUse hook for intercepting large file reads and suggesting TLDR summaries.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from ..analyzer import TLDRAnalyzer
from ..models import TLDRSummary
from .config import TLDRHookConfig


def estimate_tokens(content: str) -> int:
    """Estimate token count from content (rough: 4 chars per token)."""
    return len(content) // 4


def should_use_tldr(
    file_path: Path,
    config: TLDRHookConfig | None = None,
) -> tuple[bool, str | None]:
    """
    Check if TLDR should be used instead of full file read.

    Args:
        file_path: Path to the file being read
        config: Optional config (loads default if not provided)

    Returns:
        Tuple of (should_use_tldr, reason)
    """
    if config is None:
        config = TLDRHookConfig.load()

    if not config.enabled:
        return False, None

    # Resolve to absolute path
    file_path = Path(file_path).resolve()

    # Check if file should be processed
    if not config.should_process_file(file_path):
        return False, None

    # Check file size
    try:
        file_size = file_path.stat().st_size
    except (OSError, FileNotFoundError):
        return False, None

    if file_size < config.min_file_size:
        return False, None

    # Estimate tokens
    try:
        content = file_path.read_text()
        token_estimate = estimate_tokens(content)
    except (OSError, UnicodeDecodeError):
        return False, None

    if token_estimate < config.max_tokens_before_tldr:
        return False, None

    # File is large enough to benefit from TLDR
    reason = (
        f"File has ~{token_estimate:,} tokens ({file_size:,} bytes). "
        f"TLDR summary available with ~85-95% token savings."
    )
    return True, reason


def get_tldr_suggestion(
    file_path: Path,
    config: TLDRHookConfig | None = None,
    cache_dir: Path | None = None,
) -> dict[str, Any]:
    """
    Get a TLDR suggestion message for a file.

    Args:
        file_path: Path to the file
        config: Optional config
        cache_dir: Optional cache directory

    Returns:
        Dict with suggestion details
    """
    if config is None:
        config = TLDRHookConfig.load()

    file_path = Path(file_path).resolve()
    should_use, reason = should_use_tldr(file_path, config)

    if not should_use:
        return {
            "suggest_tldr": False,
            "file_path": str(file_path),
        }

    # Get quick stats without full analysis
    try:
        file_size = file_path.stat().st_size
        content = file_path.read_text()
        token_estimate = estimate_tokens(content)
        line_count = content.count('\n') + 1
    except (OSError, UnicodeDecodeError):
        return {
            "suggest_tldr": False,
            "file_path": str(file_path),
            "error": "Could not read file",
        }

    # Estimate TLDR token count (typically 5-15% of original)
    estimated_tldr_tokens = int(token_estimate * 0.10)
    estimated_savings = int((1 - estimated_tldr_tokens / token_estimate) * 100)

    return {
        "suggest_tldr": True,
        "file_path": str(file_path),
        "file_size": file_size,
        "line_count": line_count,
        "original_tokens": token_estimate,
        "estimated_tldr_tokens": estimated_tldr_tokens,
        "estimated_savings_percent": estimated_savings,
        "reason": reason,
        "suggestion": (
            f"Consider using TLDR for this file:\n"
            f"  Original: ~{token_estimate:,} tokens\n"
            f"  TLDR: ~{estimated_tldr_tokens:,} tokens (~{estimated_savings}% savings)\n"
            f"\nTo get TLDR summary, use: tldr --file {file_path}"
        ),
    }


def get_tldr_summary(
    file_path: Path,
    layers: list[int] | None = None,
    cache_dir: Path | None = None,
) -> TLDRSummary | None:
    """
    Get the TLDR summary for a file.

    Args:
        file_path: Path to the file
        layers: Analysis layers to include (default: [1, 2, 3])
        cache_dir: Optional cache directory

    Returns:
        TLDRSummary or None if analysis fails
    """
    file_path = Path(file_path).resolve()

    if layers is None:
        layers = [1, 2, 3]

    try:
        analyzer = TLDRAnalyzer(
            project_dir=file_path.parent,
            cache_dir=cache_dir,
        )
        return analyzer.analyze_file(file_path, layers=layers)
    except Exception:
        return None


def process_read_request(
    file_path: str | Path,
    config: TLDRHookConfig | None = None,
    mode: str | None = None,
) -> dict[str, Any]:
    """
    Process a file read request through TLDR hook.

    This is the main hook entry point for PreToolUse on Read operations.

    Args:
        file_path: Path to the file being read
        config: Optional config
        mode: Override mode ("suggest", "enforce", or None for config default)

    Returns:
        Dict with action and optional content replacement
    """
    if config is None:
        config = TLDRHookConfig.load()

    effective_mode = mode or config.mode
    file_path = Path(file_path).resolve()

    # Check if TLDR should be used
    should_use, reason = should_use_tldr(file_path, config)

    if not should_use:
        return {
            "action": "allow",
            "file_path": str(file_path),
            "tldr_applicable": False,
        }

    # Get TLDR summary
    summary = get_tldr_summary(file_path, layers=config.default_layers)

    if summary is None:
        return {
            "action": "allow",
            "file_path": str(file_path),
            "tldr_applicable": True,
            "tldr_failed": True,
            "reason": "TLDR analysis failed, allowing full read",
        }

    compact_summary = summary.to_compact()

    if effective_mode == "enforce":
        # Replace full read with TLDR summary
        return {
            "action": "replace",
            "file_path": str(file_path),
            "tldr_applicable": True,
            "original_tokens": summary.original_tokens,
            "summary_tokens": summary.summary_tokens,
            "savings_percent": summary.token_savings_percent(),
            "replacement_content": compact_summary,
            "message": (
                f"[TLDR] File replaced with summary "
                f"({summary.summary_tokens:,} tokens vs {summary.original_tokens:,} original, "
                f"{summary.token_savings_percent():.1f}% savings)"
            ),
        }
    else:
        # Suggest mode - allow read but provide suggestion
        return {
            "action": "allow",
            "file_path": str(file_path),
            "tldr_applicable": True,
            "original_tokens": summary.original_tokens,
            "summary_tokens": summary.summary_tokens,
            "savings_percent": summary.token_savings_percent(),
            "suggestion": (
                f"Consider using TLDR for this file:\n"
                f"  Current read: ~{summary.original_tokens:,} tokens\n"
                f"  TLDR summary: ~{summary.summary_tokens:,} tokens "
                f"({summary.token_savings_percent():.1f}% savings)\n"
            ),
            "tldr_summary_available": compact_summary,
        }


def create_pretooluse_hook_script(
    output_path: Path,
    config: TLDRHookConfig | None = None,
) -> Path:
    """
    Create a shell script for Claude Code PreToolUse hook.

    The script will intercept Read tool calls and apply TLDR logic.

    Args:
        output_path: Where to write the hook script
        config: Optional config for hook settings

    Returns:
        Path to the created script
    """
    if config is None:
        config = TLDRHookConfig.load()

    script_content = f'''#!/bin/bash
# TLDR Read Enforcer Hook for Claude Code
# Generated by Auto-Claude TLDR system
#
# Place in .claude/hooks/pretooluse/read-enforcer.sh
# Or configure in .claude/settings.json

# Configuration
TLDR_ENABLED="{str(config.enabled).lower()}"
TLDR_MODE="{config.mode}"
TLDR_MIN_SIZE={config.min_file_size}
TLDR_MAX_TOKENS={config.max_tokens_before_tldr}

# Check if TLDR is enabled
if [ "$TLDR_ENABLED" != "true" ]; then
    exit 0
fi

# Read hook input from stdin
read -r HOOK_INPUT

# Extract tool name and file path
TOOL_NAME=$(echo "$HOOK_INPUT" | jq -r '.tool_name // empty')
FILE_PATH=$(echo "$HOOK_INPUT" | jq -r '.tool_input.file_path // empty')

# Only process Read tool calls
if [ "$TOOL_NAME" != "Read" ] || [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Check if file exists and get size
if [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

FILE_SIZE=$(stat -f%z "$FILE_PATH" 2>/dev/null || stat -c%s "$FILE_PATH" 2>/dev/null)

# Skip small files
if [ "$FILE_SIZE" -lt "$TLDR_MIN_SIZE" ]; then
    exit 0
fi

# Check file extension
EXT="${{FILE_PATH##*.}}"
case "$EXT" in
    py|ts|tsx|js|jsx|mjs|cjs)
        # Supported extension
        ;;
    *)
        # Not a code file
        exit 0
        ;;
esac

# Estimate tokens (rough: 4 chars per token)
TOKEN_ESTIMATE=$((FILE_SIZE / 4))

# Skip if under token threshold
if [ "$TOKEN_ESTIMATE" -lt "$TLDR_MAX_TOKENS" ]; then
    exit 0
fi

# Output suggestion message
if [ "$TLDR_MODE" = "suggest" ]; then
    echo "[TLDR Suggestion] File has ~$TOKEN_ESTIMATE tokens. Consider using TLDR for 85-95% token savings." >&2
    echo "  Run: python -m tldr --file \\"$FILE_PATH\\"" >&2
fi

# In enforce mode, we would need Python to generate the actual TLDR
# For now, just log the suggestion
exit 0
'''

    output_path = Path(output_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text(script_content)
    output_path.chmod(0o755)

    return output_path
