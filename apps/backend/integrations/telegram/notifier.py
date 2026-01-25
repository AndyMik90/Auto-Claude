"""
Telegram Notifier
=================

High-level notification functions for Auto Claude task events.
"""

import os
from pathlib import Path
from typing import Optional

from .config import TelegramConfig
from .client import TelegramClient, AsyncTelegramClient


# Emoji constants for status
EMOJI_START = "\U0001F680"      # rocket
EMOJI_PROGRESS = "\U0001F504"   # arrows
EMOJI_SUCCESS = "\u2705"        # check mark
EMOJI_FAILED = "\u274C"         # cross mark
EMOJI_WARNING = "\u26A0\uFE0F"  # warning
EMOJI_QA = "\U0001F50D"         # magnifying glass
EMOJI_REVIEW = "\U0001F440"     # eyes
EMOJI_TASK = "\U0001F4CB"       # clipboard


def is_telegram_enabled() -> bool:
    """Check if Telegram integration is available."""
    return bool(
        os.environ.get("TELEGRAM_BOT_TOKEN")
        and os.environ.get("TELEGRAM_CHAT_ID")
        and os.environ.get("TELEGRAM_ENABLED", "true").lower() == "true"
    )


def get_telegram_bot_token() -> str:
    """Get the Telegram bot token from environment."""
    return os.environ.get("TELEGRAM_BOT_TOKEN", "")


def get_telegram_chat_id() -> str:
    """Get the Telegram chat ID from environment."""
    return os.environ.get("TELEGRAM_CHAT_ID", "")


def _get_client() -> Optional[TelegramClient]:
    """Get a configured Telegram client."""
    config = TelegramConfig.from_env()
    if not config or not config.enabled:
        return None
    return TelegramClient(config)


def _get_async_client() -> Optional[AsyncTelegramClient]:
    """Get a configured async Telegram client."""
    config = TelegramConfig.from_env()
    if not config or not config.enabled:
        return None
    return AsyncTelegramClient(config)


def send_telegram_message(
    text: str,
    chat_id: Optional[str] = None,
    parse_mode: str = "HTML",
) -> bool:
    """
    Send a message via Telegram.

    Args:
        text: Message text (HTML format supported)
        chat_id: Target chat ID (uses env default if not provided)
        parse_mode: 'HTML' or 'Markdown'

    Returns:
        True if sent successfully
    """
    client = _get_client()
    if not client:
        return False

    result = client.send_message(text, chat_id, parse_mode=parse_mode)
    return result is not None


async def send_telegram_message_async(
    text: str,
    chat_id: Optional[str] = None,
    parse_mode: str = "HTML",
) -> bool:
    """Async version of send_telegram_message."""
    client = _get_async_client()
    if not client:
        return False

    result = await client.send_message_async(text, chat_id, parse_mode=parse_mode)
    return result is not None


# === Task lifecycle notifications ===


def telegram_task_created(
    task_title: str,
    spec_id: str,
    description: Optional[str] = None,
) -> bool:
    """
    Notify when a new task is created.

    Args:
        task_title: Task title
        spec_id: Spec identifier (e.g., "001-feature-name")
        description: Optional task description
    """
    if not is_telegram_enabled():
        return False

    desc_part = f"\n<i>{description[:200]}...</i>" if description and len(description) > 200 else ""
    desc_part = f"\n<i>{description}</i>" if description and len(description) <= 200 else desc_part

    message = f"""{EMOJI_TASK} <b>New Task Created</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>{desc_part}"""

    return send_telegram_message(message)


async def telegram_task_created_async(
    task_title: str,
    spec_id: str,
    description: Optional[str] = None,
) -> bool:
    """Async version of telegram_task_created."""
    if not is_telegram_enabled():
        return False

    desc_part = f"\n<i>{description[:200]}...</i>" if description and len(description) > 200 else ""
    desc_part = f"\n<i>{description}</i>" if description and len(description) <= 200 else desc_part

    message = f"""{EMOJI_TASK} <b>New Task Created</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>{desc_part}"""

    return await send_telegram_message_async(message)


def telegram_task_started(
    task_title: str,
    spec_id: str,
) -> bool:
    """Notify when a task starts building."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_START} <b>Task Started</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Planning phase initiated..."""

    return send_telegram_message(message)


async def telegram_task_started_async(
    task_title: str,
    spec_id: str,
) -> bool:
    """Async version of telegram_task_started."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_START} <b>Task Started</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Planning phase initiated..."""

    return await send_telegram_message_async(message)


def telegram_subtask_progress(
    task_title: str,
    spec_id: str,
    completed: int,
    total: int,
    current_subtask: Optional[str] = None,
) -> bool:
    """Notify subtask progress."""
    if not is_telegram_enabled():
        return False

    progress_bar = _progress_bar(completed, total)
    current_part = f"\n<i>Current: {current_subtask}</i>" if current_subtask else ""

    message = f"""{EMOJI_PROGRESS} <b>Progress Update</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

{progress_bar} {completed}/{total} subtasks{current_part}"""

    return send_telegram_message(message)


def telegram_task_completed(
    task_title: str,
    spec_id: str,
    subtask_count: int,
) -> bool:
    """Notify when a task completes successfully."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_SUCCESS} <b>Task Completed</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

All {subtask_count} subtasks completed successfully!
Awaiting human review for merge."""

    return send_telegram_message(message)


async def telegram_task_completed_async(
    task_title: str,
    spec_id: str,
    subtask_count: int,
) -> bool:
    """Async version of telegram_task_completed."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_SUCCESS} <b>Task Completed</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

All {subtask_count} subtasks completed successfully!
Awaiting human review for merge."""

    return await send_telegram_message_async(message)


def telegram_task_failed(
    task_title: str,
    spec_id: str,
    error_summary: str,
    subtask_id: Optional[str] = None,
) -> bool:
    """Notify when a task fails."""
    if not is_telegram_enabled():
        return False

    subtask_part = f"\n<b>Failed Subtask:</b> {subtask_id}" if subtask_id else ""
    error_truncated = error_summary[:300] + "..." if len(error_summary) > 300 else error_summary

    message = f"""{EMOJI_FAILED} <b>Task Failed</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>{subtask_part}

<b>Error:</b>
<code>{error_truncated}</code>

Human intervention required."""

    return send_telegram_message(message)


async def telegram_task_failed_async(
    task_title: str,
    spec_id: str,
    error_summary: str,
    subtask_id: Optional[str] = None,
) -> bool:
    """Async version of telegram_task_failed."""
    if not is_telegram_enabled():
        return False

    subtask_part = f"\n<b>Failed Subtask:</b> {subtask_id}" if subtask_id else ""
    error_truncated = error_summary[:300] + "..." if len(error_summary) > 300 else error_summary

    message = f"""{EMOJI_FAILED} <b>Task Failed</b>

<b>Title:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>{subtask_part}

<b>Error:</b>
<code>{error_truncated}</code>

Human intervention required."""

    return await send_telegram_message_async(message)


# === QA lifecycle notifications ===


def telegram_qa_started(
    task_title: str,
    spec_id: str,
) -> bool:
    """Notify when QA validation starts."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_QA} <b>QA Started</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Running automated QA validation..."""

    return send_telegram_message(message)


async def telegram_qa_started_async(
    task_title: str,
    spec_id: str,
) -> bool:
    """Async version of telegram_qa_started."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_QA} <b>QA Started</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Running automated QA validation..."""

    return await send_telegram_message_async(message)


def telegram_qa_approved(
    task_title: str,
    spec_id: str,
) -> bool:
    """Notify when QA approves the build."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_SUCCESS} <b>QA Approved</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Build passed QA validation!
Ready for human review and merge."""

    return send_telegram_message(message)


async def telegram_qa_approved_async(
    task_title: str,
    spec_id: str,
) -> bool:
    """Async version of telegram_qa_approved."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_SUCCESS} <b>QA Approved</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Build passed QA validation!
Ready for human review and merge."""

    return await send_telegram_message_async(message)


def telegram_qa_rejected(
    task_title: str,
    spec_id: str,
    issues_count: int,
    iteration: int,
) -> bool:
    """Notify when QA rejects the build."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_WARNING} <b>QA Rejected</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Found {issues_count} issue(s) in iteration {iteration}.
Applying fixes..."""

    return send_telegram_message(message)


async def telegram_qa_rejected_async(
    task_title: str,
    spec_id: str,
    issues_count: int,
    iteration: int,
) -> bool:
    """Async version of telegram_qa_rejected."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_WARNING} <b>QA Rejected</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

Found {issues_count} issue(s) in iteration {iteration}.
Applying fixes..."""

    return await send_telegram_message_async(message)


def telegram_human_review_needed(
    task_title: str,
    spec_id: str,
    reason: str,
) -> bool:
    """Notify when human review is needed."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_REVIEW} <b>Human Review Needed</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

<b>Reason:</b> {reason}

Please review the changes in the worktree."""

    return send_telegram_message(message)


async def telegram_human_review_needed_async(
    task_title: str,
    spec_id: str,
    reason: str,
) -> bool:
    """Async version of telegram_human_review_needed."""
    if not is_telegram_enabled():
        return False

    message = f"""{EMOJI_REVIEW} <b>Human Review Needed</b>

<b>Task:</b> {task_title}
<b>Spec:</b> <code>{spec_id}</code>

<b>Reason:</b> {reason}

Please review the changes in the worktree."""

    return await send_telegram_message_async(message)


# === Utility functions ===


def _progress_bar(completed: int, total: int, width: int = 10) -> str:
    """Generate a text progress bar."""
    if total == 0:
        return "[" + "-" * width + "]"

    filled = int(width * completed / total)
    empty = width - filled

    return "[" + "=" * filled + "-" * empty + "]"
