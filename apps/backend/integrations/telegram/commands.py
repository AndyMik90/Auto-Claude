"""
Telegram Bot Commands
=====================

Handler for Telegram bot commands to control tasks remotely.
Supports commands: /tasks, /status, /start, /stop, /help
"""

import json
import os
import re
from pathlib import Path
from typing import Optional, Callable, Awaitable

from .config import TelegramConfig
from .client import TelegramClient, AsyncTelegramClient


# Command handlers registry
_command_handlers: dict[str, Callable] = {}


def command(name: str):
    """Decorator to register a command handler."""
    def decorator(func):
        _command_handlers[name] = func
        return func
    return decorator


class TelegramCommandHandler:
    """
    Handles incoming Telegram bot commands.

    Usage:
        handler = TelegramCommandHandler(project_dir="/path/to/project")
        handler.start_polling()  # Blocking

        # Or async:
        await handler.process_updates()
    """

    def __init__(
        self,
        project_dir: Optional[str] = None,
        config: Optional[TelegramConfig] = None,
    ):
        self.config = config or TelegramConfig.from_env()
        if not self.config:
            raise ValueError("Telegram not configured. Set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID")

        self.client = TelegramClient(self.config)
        self.async_client = AsyncTelegramClient(self.config)
        self.project_dir = Path(project_dir) if project_dir else Path.cwd()
        self.last_update_id: Optional[int] = None
        self._running = False

    def _get_specs_dir(self) -> Path:
        """Get the specs directory for the project."""
        auto_claude_dir = self.project_dir / ".auto-claude" / "specs"
        if auto_claude_dir.exists():
            return auto_claude_dir
        return self.project_dir

    def _list_specs(self) -> list[dict]:
        """List all specs with their status."""
        specs_dir = self._get_specs_dir()
        specs = []

        if not specs_dir.exists():
            return specs

        for spec_path in sorted(specs_dir.iterdir()):
            if not spec_path.is_dir():
                continue

            spec_info = {
                "id": spec_path.name,
                "path": str(spec_path),
                "status": "unknown",
                "title": spec_path.name,
            }

            # Try to read spec.md for title
            spec_md = spec_path / "spec.md"
            if spec_md.exists():
                try:
                    content = spec_md.read_text(encoding="utf-8")
                    # Extract first heading as title
                    match = re.search(r'^#\s+(.+)$', content, re.MULTILINE)
                    if match:
                        spec_info["title"] = match.group(1).strip()
                except Exception:
                    pass

            # Try to read implementation plan for status
            plan_file = spec_path / "implementation_plan.json"
            if plan_file.exists():
                try:
                    plan = json.loads(plan_file.read_text(encoding="utf-8"))
                    subtasks = plan.get("subtasks", [])
                    completed = sum(1 for s in subtasks if s.get("status") == "completed")
                    total = len(subtasks)

                    if total == 0:
                        spec_info["status"] = "pending"
                    elif completed == total:
                        spec_info["status"] = "completed"
                    elif completed > 0:
                        spec_info["status"] = f"in_progress ({completed}/{total})"
                    else:
                        spec_info["status"] = "pending"
                except Exception:
                    pass

            specs.append(spec_info)

        return specs

    def _format_tasks_message(self) -> str:
        """Format the tasks list for Telegram."""
        specs = self._list_specs()

        if not specs:
            return "📋 <b>No tasks found</b>\n\nCreate a spec to get started."

        lines = ["📋 <b>Tasks</b>\n"]

        for spec in specs:
            status_emoji = {
                "completed": "✅",
                "pending": "⏳",
                "unknown": "❓",
            }.get(spec["status"].split()[0], "🔄")

            lines.append(f"{status_emoji} <b>{spec['id']}</b>")
            if spec["title"] != spec["id"]:
                lines.append(f"   {spec['title']}")
            lines.append(f"   Status: {spec['status']}")
            lines.append("")

        lines.append("\n<i>Commands: /start &lt;id&gt;, /stop &lt;id&gt;, /status &lt;id&gt;</i>")

        return "\n".join(lines)

    def _format_status_message(self, spec_id: str) -> str:
        """Format detailed status for a specific spec."""
        specs_dir = self._get_specs_dir()
        spec_path = None

        # Find spec by ID (partial match)
        for path in specs_dir.iterdir():
            if spec_id in path.name:
                spec_path = path
                break

        if not spec_path or not spec_path.exists():
            return f"❌ Spec '{spec_id}' not found"

        lines = [f"📊 <b>Status: {spec_path.name}</b>\n"]

        # Read implementation plan
        plan_file = spec_path / "implementation_plan.json"
        if plan_file.exists():
            try:
                plan = json.loads(plan_file.read_text(encoding="utf-8"))
                subtasks = plan.get("subtasks", [])

                for subtask in subtasks:
                    status = subtask.get("status", "pending")
                    status_emoji = {
                        "completed": "✅",
                        "in_progress": "🔄",
                        "pending": "⏳",
                        "failed": "❌",
                    }.get(status, "❓")

                    lines.append(f"{status_emoji} {subtask.get('id', '?')}: {subtask.get('description', '')[:50]}")

                completed = sum(1 for s in subtasks if s.get("status") == "completed")
                lines.append(f"\n<b>Progress:</b> {completed}/{len(subtasks)} subtasks")
            except Exception as e:
                lines.append(f"<i>Error reading plan: {e}</i>")
        else:
            lines.append("<i>No implementation plan found</i>")

        return "\n".join(lines)

    def _format_help_message(self) -> str:
        """Format help message."""
        return """🤖 <b>Auto Claude Bot</b>

<b>Commands:</b>
/tasks - List all tasks
/status &lt;id&gt; - Get detailed status of a task
/start &lt;id&gt; - Start a task (coming soon)
/stop &lt;id&gt; - Stop a running task (coming soon)
/help - Show this help message

<i>Note: Start/stop commands require the backend to be running.</i>"""

    def handle_command(self, command: str, args: str = "") -> str:
        """
        Handle a command and return the response message.

        Args:
            command: Command name (without /)
            args: Command arguments

        Returns:
            Response message to send
        """
        command = command.lower().strip()
        args = args.strip()

        if command == "tasks" or command == "list":
            return self._format_tasks_message()

        elif command == "status":
            if not args:
                return "Usage: /status <spec_id>"
            return self._format_status_message(args)

        elif command == "start":
            if not args:
                return "Usage: /start <spec_id>"
            # TODO: Implement actual task starting via IPC
            return f"⚠️ Starting tasks via Telegram is not yet implemented.\n\nTo start '{args}', run:\n<code>python run.py --spec {args}</code>"

        elif command == "stop":
            if not args:
                return "Usage: /stop <spec_id>"
            # TODO: Implement actual task stopping via IPC
            return f"⚠️ Stopping tasks via Telegram is not yet implemented.\n\nTo stop a running task, press Ctrl+C in the terminal."

        elif command == "help" or command == "start":
            return self._format_help_message()

        else:
            return f"Unknown command: /{command}\n\nUse /help for available commands."

    def process_message(self, message: dict) -> Optional[str]:
        """
        Process an incoming message and return a response.

        Args:
            message: Telegram message object

        Returns:
            Response message or None if not a command
        """
        text = message.get("text", "")

        if not text.startswith("/"):
            return None

        # Parse command and args
        parts = text[1:].split(maxsplit=1)
        command = parts[0].split("@")[0]  # Remove @botname suffix
        args = parts[1] if len(parts) > 1 else ""

        return self.handle_command(command, args)

    def poll_once(self) -> list[dict]:
        """
        Poll for updates once and process them.

        Returns:
            List of responses sent
        """
        responses = []

        updates = self.client.get_updates(
            offset=self.last_update_id + 1 if self.last_update_id else None,
            timeout=30,
        )

        for update in updates:
            self.last_update_id = update.get("update_id")

            message = update.get("message")
            if not message:
                continue

            chat_id = message.get("chat", {}).get("id")
            if not chat_id:
                continue

            response = self.process_message(message)
            if response:
                result = self.client.send_message(
                    text=response,
                    chat_id=str(chat_id),
                )
                if result:
                    responses.append(result)

        return responses

    def start_polling(self):
        """
        Start polling for updates (blocking).

        Press Ctrl+C to stop.
        """
        print(f"Starting Telegram bot polling for project: {self.project_dir}")
        print("Press Ctrl+C to stop.\n")

        self._running = True

        try:
            while self._running:
                try:
                    self.poll_once()
                except Exception as e:
                    print(f"Polling error: {e}")
        except KeyboardInterrupt:
            print("\nStopping bot...")
            self._running = False

    def stop(self):
        """Stop the polling loop."""
        self._running = False


def run_telegram_bot(project_dir: Optional[str] = None):
    """
    Run the Telegram bot for a project.

    Args:
        project_dir: Project directory path (default: current directory)
    """
    handler = TelegramCommandHandler(project_dir=project_dir)
    handler.start_polling()


if __name__ == "__main__":
    import sys

    project_dir = sys.argv[1] if len(sys.argv) > 1 else None
    run_telegram_bot(project_dir)
