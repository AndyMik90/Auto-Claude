#!/usr/bin/env python3
"""
Telegram Bot Runner
===================

Standalone script to run the Telegram bot for Auto Claude task management.

Usage:
    python telegram_bot.py [project_dir]

The bot responds to commands:
    /tasks - List all tasks
    /status <id> - Get detailed task status
    /start <id> - Start a task (not yet implemented)
    /stop <id> - Stop a task (not yet implemented)
    /help - Show help

Environment variables required:
    TELEGRAM_BOT_TOKEN - Your bot token from @BotFather
    TELEGRAM_CHAT_ID - Your chat ID (use @userinfobot to find it)
"""

import sys
from pathlib import Path

# Ensure parent directory is in path for imports
_PARENT_DIR = Path(__file__).parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))


def main():
    from integrations.telegram import run_telegram_bot, is_telegram_enabled

    if not is_telegram_enabled():
        print("Error: Telegram not configured.")
        print()
        print("Set the following environment variables:")
        print("  TELEGRAM_BOT_TOKEN - Your bot token from @BotFather")
        print("  TELEGRAM_CHAT_ID - Your chat ID (use @userinfobot to find it)")
        print()
        print("Or add them to your .env file.")
        sys.exit(1)

    project_dir = sys.argv[1] if len(sys.argv) > 1 else None

    print("=" * 50)
    print("  Auto Claude Telegram Bot")
    print("=" * 50)
    print()

    run_telegram_bot(project_dir)


if __name__ == "__main__":
    main()
