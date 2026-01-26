"""
Slack Integration Configuration
===============================

Configuration and constants for Slack webhook integration.
"""

import os
from dataclasses import dataclass


@dataclass
class SlackConfig:
    """Slack integration configuration."""

    webhook_url: str = ""
    enabled: bool = False

    @classmethod
    def from_env(cls) -> "SlackConfig":
        """Load configuration from environment variables."""
        webhook_url = os.environ.get("SLACK_WEBHOOK_URL", "")
        return cls(
            webhook_url=webhook_url,
            enabled=bool(webhook_url),
        )

    def is_valid(self) -> bool:
        """Check if configuration is valid for use."""
        return bool(self.webhook_url and self.webhook_url.startswith("https://hooks.slack.com/"))


def is_slack_enabled() -> bool:
    """Quick check if Slack integration is available."""
    config = SlackConfig.from_env()
    return config.is_valid()


# Notification colors (Slack attachment sidebar colors)
COLOR_INFO = "#2196F3"      # Blue - informational
COLOR_SUCCESS = "#4CAF50"   # Green - success
COLOR_WARNING = "#FF9800"   # Orange - warning
COLOR_ERROR = "#F44336"     # Red - error
COLOR_PURPLE = "#9C27B0"    # Purple - PR/links
