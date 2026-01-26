"""
Slack Notifier
==============

Sends notifications to Slack via Incoming Webhooks.
"""

import aiohttp
from pathlib import Path

from .config import (
    SlackConfig,
    is_slack_enabled,
    COLOR_INFO,
    COLOR_SUCCESS,
    COLOR_WARNING,
    COLOR_ERROR,
    COLOR_PURPLE,
)


async def send_slack_notification(
    message: str,
    color: str = COLOR_SUCCESS,
    title: str | None = None,
) -> bool:
    """
    Send a notification to Slack webhook.

    Args:
        message: The message text (supports Slack mrkdwn format)
        color: Sidebar color for the attachment
        title: Optional title for the attachment

    Returns:
        True if notification was sent successfully, False otherwise
    """
    if not is_slack_enabled():
        return False

    config = SlackConfig.from_env()

    attachment = {
        "color": color,
        "text": message,
        "mrkdwn_in": ["text"],
    }

    if title:
        attachment["title"] = title

    payload = {"attachments": [attachment]}

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(
                config.webhook_url,
                json=payload,
                timeout=aiohttp.ClientTimeout(total=10),
            ) as resp:
                return resp.status == 200
    except Exception:
        # Slack notification failure should not block builds
        return False


async def send_test_notification() -> bool:
    """Send a test notification to verify webhook configuration."""
    return await send_slack_notification(
        message="🔔 *Auto-Claude*: Slack連携のテスト通知です",
        color=COLOR_INFO,
        title="テスト通知",
    )


# =============================================================================
# Build Lifecycle Event Notifications
# =============================================================================


async def slack_build_started(spec_dir: Path, spec_name: str) -> bool:
    """Notify that a build has started."""
    return await send_slack_notification(
        message=f"🚀 *ビルド開始*: `{spec_name}`",
        color=COLOR_INFO,
    )


async def slack_build_complete(
    spec_dir: Path,
    spec_name: str,
    subtask_count: int,
) -> bool:
    """Notify that a build has completed successfully."""
    return await send_slack_notification(
        message=f"✅ *ビルド完了*: `{spec_name}` ({subtask_count}個のサブタスク完了)",
        color=COLOR_SUCCESS,
    )


async def slack_qa_approved(spec_dir: Path, spec_name: str) -> bool:
    """Notify that QA has approved the build."""
    return await send_slack_notification(
        message=f"✅ *QA承認*: `{spec_name}` - レビュー待ち",
        color=COLOR_SUCCESS,
    )


async def slack_qa_rejected(
    spec_dir: Path,
    spec_name: str,
    issues_count: int,
    iteration: int,
) -> bool:
    """Notify that QA has rejected the build with issues."""
    return await send_slack_notification(
        message=f"⚠️ *QA却下*: `{spec_name}` - {issues_count}件の指摘 (イテレーション {iteration})",
        color=COLOR_WARNING,
    )


async def slack_task_stuck(
    spec_dir: Path,
    subtask_id: str,
    attempt_count: int,
) -> bool:
    """Notify that a task is stuck after multiple attempts."""
    return await send_slack_notification(
        message=f"🔴 *タスクスタック*: サブタスク `{subtask_id}` ({attempt_count}回試行後) - 人間の確認が必要",
        color=COLOR_ERROR,
    )


async def slack_pr_created(
    spec_name: str,
    pr_url: str,
    pr_title: str,
) -> bool:
    """Notify that a PR has been created."""
    return await send_slack_notification(
        message=f"🔗 *PR作成*: <{pr_url}|{pr_title}>",
        color=COLOR_PURPLE,
    )


async def slack_error(
    spec_name: str,
    error_message: str,
) -> bool:
    """Notify that an error occurred during build."""
    # Truncate error message if too long
    if len(error_message) > 200:
        error_message = error_message[:197] + "..."

    return await send_slack_notification(
        message=f"❌ *エラー*: `{spec_name}`\n```{error_message}```",
        color=COLOR_ERROR,
    )
