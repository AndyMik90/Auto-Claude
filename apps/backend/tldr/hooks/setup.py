"""
TLDR Hook Setup
================

Utilities for integrating TLDR hooks with Claude Code.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .config import TLDRHookConfig
from .read_enforcer import create_pretooluse_hook_script
from .cache_updater import create_posttooluse_hook_script


def setup_tldr_hooks(
    project_dir: Path | str | None = None,
    config: TLDRHookConfig | None = None,
) -> dict[str, Any]:
    """
    Set up TLDR hooks for a project.

    Creates hook scripts and updates Claude Code settings.

    Args:
        project_dir: Project directory (default: current directory)
        config: Optional TLDR configuration

    Returns:
        Dict with setup results
    """
    project_dir = Path(project_dir) if project_dir else Path.cwd()

    if config is None:
        config = TLDRHookConfig.load(project_dir)

    results = {
        "project_dir": str(project_dir),
        "hooks_created": [],
        "settings_updated": False,
        "config_saved": False,
    }

    # Create hooks directory
    hooks_dir = project_dir / ".claude" / "hooks"
    hooks_dir.mkdir(parents=True, exist_ok=True)

    # Create PreToolUse hook script
    pretool_script = hooks_dir / "tldr-read-enforcer.sh"
    create_pretooluse_hook_script(pretool_script, config)
    results["hooks_created"].append(str(pretool_script))

    # Create PostToolUse hook script
    posttool_script = hooks_dir / "tldr-cache-updater.sh"
    create_posttooluse_hook_script(posttool_script, config)
    results["hooks_created"].append(str(posttool_script))

    # Update Claude Code settings
    settings_file = project_dir / ".claude" / "settings.json"
    settings = {}
    if settings_file.exists():
        try:
            settings = json.loads(settings_file.read_text())
        except json.JSONDecodeError:
            pass

    # Add hook configurations
    if "hooks" not in settings:
        settings["hooks"] = {}

    # Configure PreToolUse hook for Read operations
    settings["hooks"]["PreToolUse"] = settings.get("hooks", {}).get("PreToolUse", [])
    tldr_pretool = {
        "matcher": "Read",
        "hooks": [str(pretool_script)],
    }
    # Check if already configured
    if not any(
        h.get("matcher") == "Read" and str(pretool_script) in h.get("hooks", [])
        for h in settings["hooks"]["PreToolUse"]
        if isinstance(h, dict)
    ):
        settings["hooks"]["PreToolUse"].append(tldr_pretool)

    # Configure PostToolUse hook for Edit/Write operations
    settings["hooks"]["PostToolUse"] = settings.get("hooks", {}).get("PostToolUse", [])
    tldr_posttool = {
        "matcher": "Edit|Write|NotebookEdit",
        "hooks": [str(posttool_script)],
    }
    if not any(
        h.get("matcher") == "Edit|Write|NotebookEdit"
        and str(posttool_script) in h.get("hooks", [])
        for h in settings["hooks"]["PostToolUse"]
        if isinstance(h, dict)
    ):
        settings["hooks"]["PostToolUse"].append(tldr_posttool)

    # Write settings
    settings_file.write_text(json.dumps(settings, indent=2))
    results["settings_updated"] = True

    # Save TLDR config
    config.save(project_dir)
    results["config_saved"] = True

    return results


def get_hook_status(
    project_dir: Path | str | None = None,
) -> dict[str, Any]:
    """
    Get the status of TLDR hooks for a project.

    Args:
        project_dir: Project directory

    Returns:
        Dict with hook status information
    """
    project_dir = Path(project_dir) if project_dir else Path.cwd()

    status = {
        "project_dir": str(project_dir),
        "config_exists": False,
        "hooks_configured": False,
        "pretool_hook_exists": False,
        "posttool_hook_exists": False,
        "enabled": False,
        "mode": None,
    }

    # Check config
    config_file = project_dir / ".auto-claude" / "tldr-config.json"
    if config_file.exists():
        status["config_exists"] = True
        try:
            config = TLDRHookConfig.load(project_dir)
            status["enabled"] = config.enabled
            status["mode"] = config.mode
        except Exception:
            pass

    # Check hook scripts
    hooks_dir = project_dir / ".claude" / "hooks"
    pretool_script = hooks_dir / "tldr-read-enforcer.sh"
    posttool_script = hooks_dir / "tldr-cache-updater.sh"

    status["pretool_hook_exists"] = pretool_script.exists()
    status["posttool_hook_exists"] = posttool_script.exists()

    # Check settings
    settings_file = project_dir / ".claude" / "settings.json"
    if settings_file.exists():
        try:
            settings = json.loads(settings_file.read_text())
            hooks = settings.get("hooks", {})

            # Check if TLDR hooks are configured
            pretool_hooks = hooks.get("PreToolUse", [])
            posttool_hooks = hooks.get("PostToolUse", [])

            for hook in pretool_hooks:
                if isinstance(hook, dict) and "tldr-read-enforcer" in str(
                    hook.get("hooks", [])
                ):
                    status["hooks_configured"] = True
                    break

            for hook in posttool_hooks:
                if isinstance(hook, dict) and "tldr-cache-updater" in str(
                    hook.get("hooks", [])
                ):
                    status["hooks_configured"] = True
                    break
        except json.JSONDecodeError:
            pass

    return status


def remove_tldr_hooks(
    project_dir: Path | str | None = None,
) -> dict[str, Any]:
    """
    Remove TLDR hooks from a project.

    Args:
        project_dir: Project directory

    Returns:
        Dict with removal results
    """
    project_dir = Path(project_dir) if project_dir else Path.cwd()

    results = {
        "project_dir": str(project_dir),
        "hooks_removed": [],
        "settings_updated": False,
    }

    # Remove hook scripts
    hooks_dir = project_dir / ".claude" / "hooks"
    for script_name in ["tldr-read-enforcer.sh", "tldr-cache-updater.sh"]:
        script_path = hooks_dir / script_name
        if script_path.exists():
            script_path.unlink()
            results["hooks_removed"].append(str(script_path))

    # Update settings
    settings_file = project_dir / ".claude" / "settings.json"
    if settings_file.exists():
        try:
            settings = json.loads(settings_file.read_text())
            hooks = settings.get("hooks", {})

            # Remove TLDR hooks from PreToolUse
            pretool_hooks = hooks.get("PreToolUse", [])
            hooks["PreToolUse"] = [
                h
                for h in pretool_hooks
                if not (
                    isinstance(h, dict)
                    and "tldr-read-enforcer" in str(h.get("hooks", []))
                )
            ]

            # Remove TLDR hooks from PostToolUse
            posttool_hooks = hooks.get("PostToolUse", [])
            hooks["PostToolUse"] = [
                h
                for h in posttool_hooks
                if not (
                    isinstance(h, dict)
                    and "tldr-cache-updater" in str(h.get("hooks", []))
                )
            ]

            settings["hooks"] = hooks
            settings_file.write_text(json.dumps(settings, indent=2))
            results["settings_updated"] = True
        except json.JSONDecodeError:
            pass

    return results


def generate_python_hook_handler() -> str:
    """
    Generate a Python hook handler script for advanced TLDR integration.

    This handler can be used instead of shell scripts for full functionality.

    Returns:
        Python script content
    """
    return '''#!/usr/bin/env python3
"""
TLDR Python Hook Handler for Claude Code
=========================================

This handler provides full TLDR functionality including:
- Token-efficient file read suggestions
- Automatic cache invalidation on edits
- Full TLDR summary replacement in enforce mode

Usage:
    Add to .claude/settings.json:
    {
        "hooks": {
            "PreToolUse": [
                {"matcher": "Read", "hooks": [".claude/hooks/tldr-handler.py pretool"]}
            ],
            "PostToolUse": [
                {"matcher": "Edit|Write", "hooks": [".claude/hooks/tldr-handler.py posttool"]}
            ]
        }
    }
"""

import json
import sys
from pathlib import Path

# Add project backend to path for TLDR imports
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "apps" / "backend"))

from tldr.hooks import (
    TLDRHookConfig,
    process_read_request,
    process_edit_event,
)


def handle_pretool():
    """Handle PreToolUse hook for Read operations."""
    hook_input = json.loads(sys.stdin.read())
    tool_name = hook_input.get("tool_name")
    tool_input = hook_input.get("tool_input", {})

    if tool_name != "Read":
        return

    file_path = tool_input.get("file_path")
    if not file_path:
        return

    config = TLDRHookConfig.load()
    result = process_read_request(file_path, config)

    # If in enforce mode and TLDR should be used, output suggestion
    if result.get("action") == "replace":
        print(result.get("message", ""), file=sys.stderr)
    elif result.get("suggestion"):
        print(result.get("suggestion"), file=sys.stderr)


def handle_posttool():
    """Handle PostToolUse hook for Edit/Write operations."""
    hook_input = json.loads(sys.stdin.read())
    tool_name = hook_input.get("tool_name")
    tool_input = hook_input.get("tool_input", {})

    result = process_edit_event(tool_name, tool_input)

    if result.get("processed") and result.get("action") == "regenerated":
        savings = result.get("savings_percent", 0)
        print(f"[TLDR] Cache updated ({savings:.1f}% token savings)", file=sys.stderr)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: tldr-handler.py [pretool|posttool]", file=sys.stderr)
        sys.exit(1)

    mode = sys.argv[1]
    if mode == "pretool":
        handle_pretool()
    elif mode == "posttool":
        handle_posttool()
    else:
        print(f"Unknown mode: {mode}", file=sys.stderr)
        sys.exit(1)
'''
