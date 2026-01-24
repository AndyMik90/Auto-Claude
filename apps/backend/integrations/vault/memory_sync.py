"""
Memory Sync Service

Handles syncing learnings and session data to the vault.
"""

import os
import logging
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, List
from dataclasses import dataclass

from .config import VaultConfig
from .mcp_client import VaultMCPClient


logger = logging.getLogger(__name__)


@dataclass
class SyncResult:
    """Result of a sync operation."""
    success: bool
    path: Optional[str] = None
    error: Optional[str] = None
    appended: bool = False


class MemorySyncService:
    """
    Service for syncing learnings and session data to vault.

    This service handles:
    - Syncing individual learnings to markdown files
    - Creating backups before modifications
    - Session logging (if enabled)
    """

    def __init__(self, config: VaultConfig):
        """
        Initialize memory sync service.

        Args:
            config: Vault configuration
        """
        self.config = config
        self.client = VaultMCPClient(config)
        self._backup_created = False

    def sync_learning(self, topic: str, content: str, tags: Optional[List[str]] = None) -> SyncResult:
        """
        Sync a learning to the vault.

        Args:
            topic: Learning topic/title
            content: Learning content (markdown)
            tags: Optional tags for the learning

        Returns:
            SyncResult with operation outcome
        """
        if not self.config.sync_learnings:
            return SyncResult(success=False, error="Learning sync is disabled")

        if not self.config.write_enabled:
            return SyncResult(success=False, error="Write access is disabled")

        # Create backup on first sync
        if not self._backup_created:
            self._create_backup()
            self._backup_created = True

        # Sanitize topic for filename
        filename = self._sanitize_filename(topic) + ".md"
        relative_path = f"memory/learnings/{filename}"
        file_path = self.config.expanded_path / relative_path

        try:
            # Ensure directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)

            timestamp = datetime.now().isoformat()

            # Check if file exists (append mode)
            appended = file_path.exists()
            if appended:
                existing = file_path.read_text(encoding="utf-8")

                # Append new content with separator
                separator = "\n\n---\n\n"
                update_header = f"## Update ({timestamp})\n\n"
                tag_line = f"\n\n*Tags: {', '.join(tags)}*" if tags else ""

                new_content = f"{existing}{separator}{update_header}{content}{tag_line}"
                file_path.write_text(new_content, encoding="utf-8")
            else:
                # Create new file with frontmatter
                frontmatter = f"---\ntopic: {topic}\ncreated: {timestamp}\n"
                if tags:
                    frontmatter += f"tags: [{', '.join(tags)}]\n"
                frontmatter += "---\n\n"

                header = f"# {topic}\n\n"
                new_content = f"{frontmatter}{header}{content}"
                file_path.write_text(new_content, encoding="utf-8")

            logger.info(f"Synced learning to {relative_path} (appended: {appended})")
            return SyncResult(success=True, path=relative_path, appended=appended)

        except Exception as e:
            logger.error(f"Failed to sync learning: {e}")
            return SyncResult(success=False, error=str(e))

    def log_session(self, session_id: str, content: str) -> SyncResult:
        """
        Log session content to vault.

        Args:
            session_id: Session identifier
            content: Session content/transcript

        Returns:
            SyncResult with operation outcome
        """
        if not self.config.write_enabled:
            return SyncResult(success=False, error="Write access is disabled")

        # Create session log path
        date_str = datetime.now().strftime("%Y-%m-%d")
        relative_path = f"sessions/{date_str}/{session_id}.md"
        file_path = self.config.expanded_path / relative_path

        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)

            # Create session log with timestamp
            timestamp = datetime.now().isoformat()
            header = f"# Session: {session_id}\n\n*Started: {timestamp}*\n\n"
            file_path.write_text(f"{header}{content}", encoding="utf-8")

            logger.info(f"Logged session to {relative_path}")
            return SyncResult(success=True, path=relative_path)

        except Exception as e:
            logger.error(f"Failed to log session: {e}")
            return SyncResult(success=False, error=str(e))

    def append_to_session(self, session_id: str, content: str) -> SyncResult:
        """
        Append content to existing session log.

        Args:
            session_id: Session identifier
            content: Content to append

        Returns:
            SyncResult with operation outcome
        """
        if not self.config.write_enabled:
            return SyncResult(success=False, error="Write access is disabled")

        date_str = datetime.now().strftime("%Y-%m-%d")
        relative_path = f"sessions/{date_str}/{session_id}.md"
        file_path = self.config.expanded_path / relative_path

        if not file_path.exists():
            return self.log_session(session_id, content)

        try:
            existing = file_path.read_text(encoding="utf-8")
            timestamp = datetime.now().strftime("%H:%M:%S")
            separator = f"\n\n---\n\n*[{timestamp}]*\n\n"
            file_path.write_text(f"{existing}{separator}{content}", encoding="utf-8")

            logger.info(f"Appended to session {relative_path}")
            return SyncResult(success=True, path=relative_path, appended=True)

        except Exception as e:
            logger.error(f"Failed to append to session: {e}")
            return SyncResult(success=False, error=str(e))

    def get_context_for_prompt(self) -> Dict[str, Any]:
        """
        Get vault context for inclusion in prompts.

        Returns:
            Dictionary with context data for prompts
        """
        context = self.client.load_context()

        return {
            "claude_md": context.claude_md,
            "preferences": context.preferences,
            "agents": context.agents,
            "recent_learnings": [
                {
                    "topic": l["topic"],
                    "path": l["path"],
                }
                for l in context.recent_learnings
            ],
        }

    def _create_backup(self) -> None:
        """Create backup of learnings directory before first sync."""
        learnings_dir = self.config.learnings_dir
        if not learnings_dir.exists():
            return

        backup_dir = self.config.expanded_path / ".backup" / "learnings"
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_path = backup_dir / timestamp

        try:
            backup_path.mkdir(parents=True, exist_ok=True)

            # Copy all learning files
            import shutil
            for file in learnings_dir.glob("*.md"):
                shutil.copy2(file, backup_path / file.name)

            # Keep only last 5 backups
            backups = sorted(backup_dir.iterdir(), reverse=True)
            for old_backup in backups[5:]:
                if old_backup.is_dir():
                    shutil.rmtree(old_backup)

            logger.info(f"Created backup at {backup_path}")

        except Exception as e:
            logger.warning(f"Failed to create backup: {e}")

    def _sanitize_filename(self, name: str) -> str:
        """Sanitize string for use as filename."""
        # Remove/replace problematic characters
        sanitized = name.lower()
        sanitized = "".join(c if c.isalnum() or c in " -_" else "" for c in sanitized)
        sanitized = sanitized.replace(" ", "-")
        sanitized = "-".join(filter(None, sanitized.split("-")))  # Remove duplicate dashes
        return sanitized[:100]  # Limit length
