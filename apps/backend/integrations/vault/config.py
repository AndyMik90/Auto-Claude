"""
Vault Configuration

Handles vault configuration from environment variables and settings.
"""

import os
from pathlib import Path
from dataclasses import dataclass, field
from typing import Optional, List


# Paths that are allowed for write operations (safety)
WRITE_ALLOWED_PATHS = [
    "memory/learnings/",
    "memory/auto-claude/",
    "sessions/",
]


@dataclass
class VaultConfig:
    """Configuration for vault integration."""

    # Vault path (e.g., ~/.auto-claude/vault/)
    vault_path: str

    # Whether vault is enabled
    enabled: bool = True

    # Whether to auto-load context on session start
    auto_load: bool = True

    # Whether to sync learnings to vault
    sync_learnings: bool = False

    # Whether write operations are enabled
    write_enabled: bool = False

    # Paths allowed for write operations
    write_allowed_paths: List[str] = field(default_factory=lambda: WRITE_ALLOWED_PATHS.copy())

    def __post_init__(self):
        """Expand tilde in vault path."""
        if self.vault_path.startswith("~"):
            self.vault_path = str(Path(self.vault_path).expanduser())

    @property
    def expanded_path(self) -> Path:
        """Get expanded vault path as Path object."""
        return Path(self.vault_path).expanduser()

    @property
    def claude_md_path(self) -> Path:
        """Path to CLAUDE.md file."""
        return self.expanded_path / ".claude" / "CLAUDE.md"

    @property
    def preferences_path(self) -> Path:
        """Path to preferences.md file."""
        return self.expanded_path / "memory" / "context" / "preferences.md"

    @property
    def learnings_dir(self) -> Path:
        """Path to learnings directory."""
        return self.expanded_path / "memory" / "learnings"

    @property
    def agents_dir(self) -> Path:
        """Path to agents directory."""
        return self.expanded_path / "agents"

    @property
    def sessions_dir(self) -> Path:
        """Path to sessions directory."""
        return self.expanded_path / "sessions"

    def is_write_allowed(self, relative_path: str) -> bool:
        """Check if a path is allowed for write operations."""
        if not self.write_enabled:
            return False
        return any(relative_path.startswith(p) for p in self.write_allowed_paths)

    def validate(self) -> tuple[bool, Optional[str]]:
        """
        Validate vault configuration.

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not self.vault_path:
            return False, "Vault path is required"

        path = self.expanded_path
        if not path.exists():
            return False, f"Vault path does not exist: {path}"

        if not path.is_dir():
            return False, f"Vault path is not a directory: {path}"

        return True, None


def get_vault_config() -> Optional[VaultConfig]:
    """
    Get vault configuration from environment variables.

    Environment variables:
    - VAULT_PATH: Path to vault directory
    - VAULT_ENABLED: Whether vault is enabled (default: true if VAULT_PATH is set)
    - VAULT_AUTO_LOAD: Whether to auto-load context (default: true)
    - VAULT_SYNC_LEARNINGS: Whether to sync learnings (default: false)
    - VAULT_WRITE_ENABLED: Whether write operations are enabled (default: false)

    Returns:
        VaultConfig if vault is configured, None otherwise.
    """
    vault_path = os.environ.get("VAULT_PATH")

    if not vault_path:
        return None

    enabled = os.environ.get("VAULT_ENABLED", "true").lower() in ("true", "1", "yes")
    auto_load = os.environ.get("VAULT_AUTO_LOAD", "true").lower() in ("true", "1", "yes")
    sync_learnings = os.environ.get("VAULT_SYNC_LEARNINGS", "false").lower() in ("true", "1", "yes")
    write_enabled = os.environ.get("VAULT_WRITE_ENABLED", "false").lower() in ("true", "1", "yes")

    return VaultConfig(
        vault_path=vault_path,
        enabled=enabled,
        auto_load=auto_load,
        sync_learnings=sync_learnings,
        write_enabled=write_enabled,
    )


def get_vault_config_from_settings(settings: dict) -> Optional[VaultConfig]:
    """
    Get vault configuration from settings dictionary.

    Args:
        settings: Settings dictionary with vault configuration

    Returns:
        VaultConfig if vault is configured, None otherwise.
    """
    vault_path = settings.get("globalVaultPath")

    if not vault_path:
        return None

    return VaultConfig(
        vault_path=vault_path,
        enabled=settings.get("vaultEnabled", True),
        auto_load=settings.get("vaultAutoLoad", True),
        sync_learnings=settings.get("vaultSyncLearnings", False),
        write_enabled=settings.get("vaultWriteEnabled", False),
    )
