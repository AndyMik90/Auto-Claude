"""
Telegram Integration
====================

Integration with Telegram Bot API for task notifications and commands.
"""

from .config import TelegramConfig
from .client import TelegramClient
from .notifier import (
    is_telegram_enabled,
    get_telegram_bot_token,
    get_telegram_chat_id,
    send_telegram_message,
    telegram_task_created,
    telegram_task_started,
    telegram_task_completed,
    telegram_task_failed,
    telegram_qa_started,
    telegram_qa_approved,
    telegram_qa_rejected,
)

__all__ = [
    "TelegramConfig",
    "TelegramClient",
    "is_telegram_enabled",
    "get_telegram_bot_token",
    "get_telegram_chat_id",
    "send_telegram_message",
    "telegram_task_created",
    "telegram_task_started",
    "telegram_task_completed",
    "telegram_task_failed",
    "telegram_qa_started",
    "telegram_qa_approved",
    "telegram_qa_rejected",
]
