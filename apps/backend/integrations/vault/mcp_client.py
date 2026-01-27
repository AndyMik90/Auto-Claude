"""
Vault MCP Client

Client for interacting with vault via MCP (Model Context Protocol).
Uses the Obsidian MCP server for file operations.
"""

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .config import VaultConfig

logger = logging.getLogger(__name__)


@dataclass
class VaultFile:
    """Represents a file in the vault."""

    name: str
    path: str
    is_directory: bool
    size: int | None
    modified_at: str
    children: list["VaultFile"] | None = None


@dataclass
class VaultContext:
    """Context loaded from vault."""

    claude_md: str | None
    preferences: str | None
    agents: list[dict[str, Any]]
    recent_learnings: list[dict[str, Any]]


class VaultMCPClient:
    """
    Client for vault operations using MCP.

    This client reuses the Obsidian MCP server for file operations,
    providing a higher-level interface for vault-specific operations.
    """

    def __init__(self, config: VaultConfig):
        """
        Initialize vault MCP client.

        Args:
            config: Vault configuration
        """
        self.config = config
        self._validated = False

    def validate_connection(self) -> tuple[bool, str | None]:
        """
        Validate vault connection.

        Returns:
            Tuple of (success, error_message)
        """
        is_valid, error = self.config.validate()
        if not is_valid:
            return False, error

        self._validated = True
        return True, None

    def get_vault_structure(self) -> dict[str, Any]:
        """
        Get vault structure summary.

        Returns:
            Dictionary with vault structure info
        """
        path = self.config.expanded_path

        return {
            "vault_path": str(path),
            "has_claude_md": self.config.claude_md_path.exists(),
            "has_memory_dir": (path / "memory").exists(),
            "has_agents_dir": self.config.agents_dir.exists(),
            "has_sessions_dir": self.config.sessions_dir.exists(),
        }

    def load_context(self) -> VaultContext:
        """
        Load vault context (CLAUDE.md, preferences, agents, learnings).

        Returns:
            VaultContext with loaded data
        """
        # Load CLAUDE.md
        claude_md = None
        if self.config.claude_md_path.exists():
            try:
                claude_md = self.config.claude_md_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"Failed to read CLAUDE.md: {e}")

        # Load preferences
        preferences = None
        if self.config.preferences_path.exists():
            try:
                preferences = self.config.preferences_path.read_text(encoding="utf-8")
            except Exception as e:
                logger.warning(f"Failed to read preferences.md: {e}")

        # Load agents
        agents = []
        if self.config.agents_dir.exists():
            for agent_file in self.config.agents_dir.glob("*.md"):
                try:
                    content = agent_file.read_text(encoding="utf-8")
                    frontmatter = self._parse_frontmatter(content)
                    agents.append(
                        {
                            "id": agent_file.stem,
                            "name": frontmatter.get("name", agent_file.stem),
                            "description": frontmatter.get("description"),
                            "path": str(
                                agent_file.relative_to(self.config.expanded_path)
                            ),
                        }
                    )
                except Exception as e:
                    logger.warning(f"Failed to read agent file {agent_file}: {e}")

        # Load recent learnings
        recent_learnings = []
        if self.config.learnings_dir.exists():
            learning_files = sorted(
                self.config.learnings_dir.glob("*.md"),
                key=lambda f: f.stat().st_mtime,
                reverse=True,
            )[:10]

            for learning_file in learning_files:
                try:
                    content = learning_file.read_text(encoding="utf-8")
                    stat = learning_file.stat()

                    # Extract topic from first heading or filename
                    topic = learning_file.stem.replace("-", " ").title()
                    for line in content.split("\n"):
                        if line.startswith("# "):
                            topic = line[2:].strip()
                            break

                    recent_learnings.append(
                        {
                            "id": learning_file.stem,
                            "topic": topic,
                            "content": content,
                            "modified_at": stat.st_mtime,
                            "path": str(
                                learning_file.relative_to(self.config.expanded_path)
                            ),
                        }
                    )
                except Exception as e:
                    logger.warning(f"Failed to read learning file {learning_file}: {e}")

        return VaultContext(
            claude_md=claude_md,
            preferences=preferences,
            agents=agents,
            recent_learnings=recent_learnings,
        )

    def read_file(self, relative_path: str) -> str | None:
        """
        Read a file from the vault.

        Args:
            relative_path: Path relative to vault root

        Returns:
            File content or None if not found
        """
        file_path = self.config.expanded_path / relative_path

        # Security: Ensure path is within vault
        try:
            file_path = file_path.resolve()
            if not str(file_path).startswith(str(self.config.expanded_path.resolve())):
                logger.warning(f"Access denied: path outside vault: {relative_path}")
                return None
        except Exception:
            return None

        if not file_path.exists():
            return None

        try:
            return file_path.read_text(encoding="utf-8")
        except Exception as e:
            logger.warning(f"Failed to read file {relative_path}: {e}")
            return None

    def write_file(self, relative_path: str, content: str) -> tuple[bool, str | None]:
        """
        Write a file to the vault (restricted paths only).

        Args:
            relative_path: Path relative to vault root
            content: File content

        Returns:
            Tuple of (success, error_message)
        """
        if not self.config.is_write_allowed(relative_path):
            return False, f"Write not allowed to path: {relative_path}"

        file_path = self.config.expanded_path / relative_path

        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            file_path.write_text(content, encoding="utf-8")
            return True, None
        except Exception as e:
            return False, str(e)

    def sync_learning(self, topic: str, content: str) -> tuple[bool, str | None, bool]:
        """
        Sync a learning to the vault.

        Args:
            topic: Learning topic
            content: Learning content

        Returns:
            Tuple of (success, path_or_error, was_appended)
        """
        if not self.config.sync_learnings:
            return False, "Learning sync is disabled", False

        if not self.config.write_enabled:
            return False, "Write access is disabled", False

        # Sanitize topic for filename
        filename = topic.lower()
        filename = "".join(c if c.isalnum() or c in " -_" else "" for c in filename)
        filename = filename.replace(" ", "-") + ".md"

        relative_path = f"memory/learnings/{filename}"
        file_path = self.config.expanded_path / relative_path

        try:
            # Ensure directory exists
            file_path.parent.mkdir(parents=True, exist_ok=True)

            appended = file_path.exists()
            if appended:
                # Append to existing file
                existing = file_path.read_text(encoding="utf-8")
                from datetime import datetime

                timestamp = datetime.now().isoformat()
                new_content = (
                    f"{existing}\n\n---\n\n## Update ({timestamp})\n\n{content}"
                )
                file_path.write_text(new_content, encoding="utf-8")
            else:
                # Create new file
                from datetime import datetime

                timestamp = datetime.now().isoformat()
                new_content = f"# {topic}\n\n*Created: {timestamp}*\n\n{content}"
                file_path.write_text(new_content, encoding="utf-8")

            return True, relative_path, appended
        except Exception as e:
            return False, str(e), False

    def search(self, query: str, max_results: int = 50) -> list[dict[str, Any]]:
        """
        Search vault content.

        Args:
            query: Search query
            max_results: Maximum number of results

        Returns:
            List of search results
        """
        results = []
        query_lower = query.lower()

        for file_path in self.config.expanded_path.rglob("*.md"):
            # Skip hidden files except .claude
            relative_path = file_path.relative_to(self.config.expanded_path)
            parts = str(relative_path).split(os.sep)
            if any(p.startswith(".") and p != ".claude" for p in parts):
                continue

            try:
                content = file_path.read_text(encoding="utf-8")
                lines = content.split("\n")
                matches = []

                for i, line in enumerate(lines):
                    if query_lower in line.lower():
                        idx = line.lower().find(query_lower)
                        matches.append(
                            {
                                "line_number": i + 1,
                                "line": line.strip(),
                                "match_start": idx,
                                "match_end": idx + len(query),
                            }
                        )

                if matches:
                    stat = file_path.stat()
                    results.append(
                        {
                            "file": {
                                "name": file_path.name,
                                "path": str(relative_path),
                                "is_directory": False,
                                "size": stat.st_size,
                                "modified_at": stat.st_mtime,
                            },
                            "matches": matches,
                        }
                    )

                    if len(results) >= max_results:
                        break
            except Exception as e:
                logger.warning(f"Error searching file {file_path}: {e}")
                continue

        # Sort by number of matches
        results.sort(key=lambda r: len(r["matches"]), reverse=True)
        return results[:max_results]

    def list_files(self, sub_path: str = "") -> list[VaultFile]:
        """
        List files in vault directory.

        Args:
            sub_path: Optional subdirectory path

        Returns:
            List of VaultFile objects
        """
        base_path = self.config.expanded_path
        if sub_path:
            base_path = base_path / sub_path

        if not base_path.exists() or not base_path.is_dir():
            return []

        return self._list_files_recursive(base_path, sub_path)

    def _list_files_recursive(
        self, dir_path: Path, relative_base: str = ""
    ) -> list[VaultFile]:
        """Recursively list files in directory."""
        files = []

        try:
            for entry in sorted(
                dir_path.iterdir(), key=lambda p: (not p.is_dir(), p.name.lower())
            ):
                # Skip hidden files except .claude
                if entry.name.startswith(".") and entry.name != ".claude":
                    continue

                relative_path = (
                    f"{relative_base}/{entry.name}" if relative_base else entry.name
                )
                stat = entry.stat()

                children = None
                if entry.is_dir():
                    children = self._list_files_recursive(entry, relative_path)

                files.append(
                    VaultFile(
                        name=entry.name,
                        path=relative_path,
                        is_directory=entry.is_dir(),
                        size=stat.st_size if not entry.is_dir() else None,
                        modified_at=str(stat.st_mtime),
                        children=children,
                    )
                )
        except Exception as e:
            logger.warning(f"Error listing directory {dir_path}: {e}")

        return files

    def _parse_frontmatter(self, content: str) -> dict[str, str]:
        """Parse YAML frontmatter from markdown content."""
        frontmatter = {}

        if content.startswith("---"):
            end_index = content.find("---", 3)
            if end_index > 3:
                yaml_content = content[3:end_index].strip()
                for line in yaml_content.split("\n"):
                    colon_idx = line.find(":")
                    if colon_idx > 0:
                        key = line[:colon_idx].strip()
                        value = line[colon_idx + 1 :].strip()
                        # Remove quotes
                        if value.startswith('"') and value.endswith('"'):
                            value = value[1:-1]
                        elif value.startswith("'") and value.endswith("'"):
                            value = value[1:-1]
                        frontmatter[key] = value

        return frontmatter
