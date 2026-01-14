"""
TLDR Hook Configuration
=======================

Configuration for TLDR hook behavior.
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class TLDRHookConfig:
    """
    Configuration for TLDR hooks.

    Can be loaded from:
    - Environment variables (TLDR_*)
    - Config file (.auto-claude/tldr-config.json)
    - Default values
    """

    # Enable/disable TLDR hooks
    enabled: bool = True

    # Minimum file size (in bytes) to suggest TLDR
    min_file_size: int = 5000  # ~1250 tokens

    # Maximum token estimate before enforcing TLDR
    max_tokens_before_tldr: int = 2000

    # File extensions to apply TLDR to
    supported_extensions: list[str] = field(
        default_factory=lambda: [
            ".py",
            ".ts",
            ".tsx",
            ".js",
            ".jsx",
            ".mjs",
            ".cjs",
        ]
    )

    # Patterns to exclude (even if extension matches)
    exclude_patterns: list[str] = field(
        default_factory=lambda: [
            "**/node_modules/**",
            "**/__pycache__/**",
            "**/venv/**",
            "**/.venv/**",
            "**/dist/**",
            "**/build/**",
            "**/.git/**",
            "**/*.min.js",
            "**/*.min.css",
        ]
    )

    # Whether to auto-update cache on file edits
    auto_update_cache: bool = True

    # Layers to include in TLDR summaries
    default_layers: list[int] = field(default_factory=lambda: [1, 2, 3])

    # Mode: "suggest" (just inform) or "enforce" (block large reads)
    mode: str = "suggest"

    # Path to TLDR cache directory
    cache_dir: Path | None = None

    def to_dict(self) -> dict[str, Any]:
        return {
            "enabled": self.enabled,
            "min_file_size": self.min_file_size,
            "max_tokens_before_tldr": self.max_tokens_before_tldr,
            "supported_extensions": self.supported_extensions,
            "exclude_patterns": self.exclude_patterns,
            "auto_update_cache": self.auto_update_cache,
            "default_layers": self.default_layers,
            "mode": self.mode,
            "cache_dir": str(self.cache_dir) if self.cache_dir else None,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> TLDRHookConfig:
        cache_dir = data.get("cache_dir")
        return cls(
            enabled=data.get("enabled", True),
            min_file_size=data.get("min_file_size", 5000),
            max_tokens_before_tldr=data.get("max_tokens_before_tldr", 2000),
            supported_extensions=data.get(
                "supported_extensions",
                [".py", ".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
            ),
            exclude_patterns=data.get("exclude_patterns", []),
            auto_update_cache=data.get("auto_update_cache", True),
            default_layers=data.get("default_layers", [1, 2, 3]),
            mode=data.get("mode", "suggest"),
            cache_dir=Path(cache_dir) if cache_dir else None,
        )

    @classmethod
    def load(cls, project_dir: Path | None = None) -> TLDRHookConfig:
        """
        Load configuration from environment and config file.

        Priority:
        1. Environment variables (TLDR_*)
        2. Config file (.auto-claude/tldr-config.json)
        3. Default values
        """
        config = cls()

        # Load from config file
        if project_dir:
            config_file = project_dir / ".auto-claude" / "tldr-config.json"
            if config_file.exists():
                try:
                    with open(config_file) as f:
                        data = json.load(f)
                    config = cls.from_dict(data)
                except (json.JSONDecodeError, OSError):
                    pass

        # Override with environment variables
        if os.environ.get("TLDR_ENABLED"):
            config.enabled = os.environ.get("TLDR_ENABLED", "true").lower() == "true"

        if os.environ.get("TLDR_MIN_FILE_SIZE"):
            try:
                config.min_file_size = int(os.environ["TLDR_MIN_FILE_SIZE"])
            except ValueError:
                pass

        if os.environ.get("TLDR_MAX_TOKENS"):
            try:
                config.max_tokens_before_tldr = int(os.environ["TLDR_MAX_TOKENS"])
            except ValueError:
                pass

        if os.environ.get("TLDR_MODE"):
            config.mode = os.environ["TLDR_MODE"]

        if os.environ.get("TLDR_CACHE_DIR"):
            config.cache_dir = Path(os.environ["TLDR_CACHE_DIR"])

        return config

    def save(self, project_dir: Path) -> None:
        """Save configuration to project config file."""
        config_file = project_dir / ".auto-claude" / "tldr-config.json"
        config_file.parent.mkdir(parents=True, exist_ok=True)

        with open(config_file, "w") as f:
            json.dump(self.to_dict(), f, indent=2)

    def should_process_file(self, file_path: Path) -> bool:
        """Check if a file should be processed by TLDR hooks."""
        if not self.enabled:
            return False

        # Check extension
        if file_path.suffix not in self.supported_extensions:
            return False

        # Check exclusions
        for pattern in self.exclude_patterns:
            if file_path.match(pattern):
                return False

        return True
