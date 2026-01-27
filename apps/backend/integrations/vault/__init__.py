"""
Vault Integration Module

Provides access to external Obsidian-compatible vaults for context,
learnings, and agent definitions.
"""

from .config import VaultConfig, get_vault_config
from .mcp_client import VaultMCPClient
from .memory_sync import MemorySyncService

__all__ = [
    "VaultConfig",
    "get_vault_config",
    "VaultMCPClient",
    "MemorySyncService",
]
