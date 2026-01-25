"""
Telegram Configuration
======================

Configuration for Telegram Bot integration.
"""

import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class TelegramConfig:
    """Configuration for Telegram integration."""

    bot_token: str
    chat_id: str
    enabled: bool = True
    parse_mode: str = "HTML"  # HTML or Markdown
    disable_notification: bool = False  # Silent messages

    @classmethod
    def from_env(cls) -> Optional["TelegramConfig"]:
        """Create config from environment variables."""
        bot_token = os.environ.get("TELEGRAM_BOT_TOKEN", "")
        chat_id = os.environ.get("TELEGRAM_CHAT_ID", "")

        if not bot_token or not chat_id:
            return None

        return cls(
            bot_token=bot_token,
            chat_id=chat_id,
            enabled=os.environ.get("TELEGRAM_ENABLED", "true").lower() == "true",
            parse_mode=os.environ.get("TELEGRAM_PARSE_MODE", "HTML"),
            disable_notification=os.environ.get("TELEGRAM_SILENT", "false").lower() == "true",
        )

    def to_dict(self) -> dict:
        return {
            "bot_token": self.bot_token[:10] + "..." if self.bot_token else "",  # Redacted
            "chat_id": self.chat_id,
            "enabled": self.enabled,
            "parse_mode": self.parse_mode,
            "disable_notification": self.disable_notification,
        }
