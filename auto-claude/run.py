#!/usr/bin/env python3
"""
Auto Claude Framework
=====================

A multi-session autonomous coding framework for building features and applications.
Uses subtask-based implementation plans with phase dependencies.

Key Features:
- Safe workspace isolation (builds in separate workspace by default)
- Parallel execution with Git worktrees
- Smart recovery from interruptions
- Linear integration for project management

Usage:
    python auto-claude/run.py --spec 001-initial-app
    python auto-claude/run.py --spec 001
    python auto-claude/run.py --list

    # Workspace management
    python auto-claude/run.py --spec 001 --merge     # Add completed build to project
    python auto-claude/run.py --spec 001 --review    # See what was built
    python auto-claude/run.py --spec 001 --discard   # Delete build (requires confirmation)

Prerequisites:
    - CLAUDE_CODE_OAUTH_TOKEN environment variable set (run: claude setup-token)
    - Spec created via: claude /spec
    - Claude Code CLI installed
"""

from cli import main

if __name__ == "__main__":
    main()
