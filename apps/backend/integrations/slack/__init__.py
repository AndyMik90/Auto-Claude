"""
Slack Integration Package
=========================

Provides Slack webhook notifications for build lifecycle events.

Configuration:
    SLACK_WEBHOOK_URL: Slack Incoming Webhook URL

Usage:
    from integrations.slack import is_slack_enabled, slack_build_started

    if is_slack_enabled():
        await slack_build_started(spec_dir, spec_name)
"""

from .config import SlackConfig, is_slack_enabled
from .notifier import (
    send_slack_notification,
    slack_build_started,
    slack_build_complete,
    slack_qa_approved,
    slack_qa_rejected,
    slack_task_stuck,
    slack_pr_created,
)

__all__ = [
    "SlackConfig",
    "is_slack_enabled",
    "send_slack_notification",
    "slack_build_started",
    "slack_build_complete",
    "slack_qa_approved",
    "slack_qa_rejected",
    "slack_task_stuck",
    "slack_pr_created",
]
