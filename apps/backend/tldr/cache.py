"""
TLDR Cache
==========

File-hash based caching for TLDR summaries.
"""

from __future__ import annotations

import json
import logging
import time
from pathlib import Path
from typing import Any

from .models import TLDRSummary

logger = logging.getLogger(__name__)


class TLDRCache:
    """
    Persistent cache for TLDR summaries.

    Uses file hash as cache key to invalidate on file changes.
    Storage: JSON files in cache directory.
    """

    def __init__(
        self,
        cache_dir: Path | str | None = None,
        max_age_seconds: float = 86400,  # 24 hours
        max_entries: int = 1000,
    ):
        if cache_dir is None:
            cache_dir = Path.home() / ".auto-claude" / "tldr-cache"

        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.max_age_seconds = max_age_seconds
        self.max_entries = max_entries

        # In-memory LRU cache
        self._memory_cache: dict[str, tuple[str, TLDRSummary, float]] = {}
        self._access_order: list[str] = []

        # Stats
        self._hits = 0
        self._misses = 0

    def get(self, key: str, file_hash: str) -> TLDRSummary | None:
        """
        Get cached summary if valid.

        Args:
            key: Cache key (typically file_path:layers)
            file_hash: Current file hash for validation

        Returns:
            TLDRSummary if cache hit and hash matches, None otherwise
        """
        # Check memory cache first
        if key in self._memory_cache:
            cached_hash, summary, timestamp = self._memory_cache[key]
            if cached_hash == file_hash and not self._is_expired(timestamp):
                self._hits += 1
                self._update_access(key)
                return summary

        # Check disk cache
        cache_file = self._get_cache_file(key)
        if cache_file.exists():
            try:
                data = json.loads(cache_file.read_text())
                if data.get("file_hash") == file_hash:
                    timestamp = data.get("timestamp", 0)
                    if not self._is_expired(timestamp):
                        summary = TLDRSummary.from_dict(data["summary"])
                        # Promote to memory cache
                        self._memory_cache[key] = (file_hash, summary, timestamp)
                        self._update_access(key)
                        self._hits += 1
                        return summary
            except (json.JSONDecodeError, KeyError, OSError) as e:
                logger.debug(f"Cache read error for {key}: {e}")

        self._misses += 1
        return None

    def set(self, key: str, file_hash: str, summary: TLDRSummary) -> None:
        """
        Cache a summary.

        Args:
            key: Cache key
            file_hash: File hash for validation
            summary: Summary to cache
        """
        timestamp = time.time()

        # Store in memory cache
        self._memory_cache[key] = (file_hash, summary, timestamp)
        self._update_access(key)
        self._evict_if_needed()

        # Store on disk
        cache_file = self._get_cache_file(key)
        try:
            data = {
                "file_hash": file_hash,
                "timestamp": timestamp,
                "summary": summary.to_dict(),
            }
            cache_file.write_text(json.dumps(data))
        except OSError as e:
            logger.debug(f"Cache write error for {key}: {e}")

    def invalidate(self, key: str) -> None:
        """Invalidate a specific cache entry."""
        if key in self._memory_cache:
            del self._memory_cache[key]
            if key in self._access_order:
                self._access_order.remove(key)

        cache_file = self._get_cache_file(key)
        if cache_file.exists():
            try:
                cache_file.unlink()
            except OSError:
                pass

    def invalidate_file(self, file_path: str | Path) -> int:
        """
        Invalidate all cache entries for a given file path.

        This removes entries for all layer combinations of the file.

        Args:
            file_path: Path to the file

        Returns:
            Number of entries invalidated
        """
        file_path = str(Path(file_path).resolve())
        removed = 0

        # Find and remove from memory cache
        keys_to_remove = [
            key for key in self._memory_cache
            if key.startswith(f"{file_path}:")
        ]
        for key in keys_to_remove:
            del self._memory_cache[key]
            if key in self._access_order:
                self._access_order.remove(key)
            removed += 1

        # Also invalidate disk cache files
        # We need to check each file's contents since we hash the key
        for cache_file in self.cache_dir.glob("*.json"):
            try:
                data = json.loads(cache_file.read_text())
                # Check if the cached summary is for this file
                if data.get("summary", {}).get("file_path") == file_path:
                    cache_file.unlink()
                    removed += 1
            except (json.JSONDecodeError, OSError, KeyError):
                pass

        return removed

    def has_file(self, file_path: str | Path) -> bool:
        """Check if any cache entries exist for a file."""
        file_path = str(Path(file_path).resolve())

        # Check memory cache
        for key in self._memory_cache:
            if key.startswith(f"{file_path}:"):
                return True

        return False

    def clear(self) -> None:
        """Clear all cache entries."""
        self._memory_cache.clear()
        self._access_order.clear()

        for cache_file in self.cache_dir.glob("*.json"):
            try:
                cache_file.unlink()
            except OSError:
                pass

        self._hits = 0
        self._misses = 0

    def get_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        total = self._hits + self._misses
        hit_rate = self._hits / total if total > 0 else 0

        return {
            "enabled": True,
            "memory_entries": len(self._memory_cache),
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": hit_rate,
            "cache_dir": str(self.cache_dir),
        }

    def cleanup_expired(self) -> int:
        """Remove expired entries. Returns count of removed entries."""
        removed = 0
        current_time = time.time()

        # Clean memory cache
        expired_keys = [
            key
            for key, (_, _, timestamp) in self._memory_cache.items()
            if self._is_expired(timestamp, current_time)
        ]
        for key in expired_keys:
            del self._memory_cache[key]
            if key in self._access_order:
                self._access_order.remove(key)
            removed += 1

        # Clean disk cache
        for cache_file in self.cache_dir.glob("*.json"):
            try:
                data = json.loads(cache_file.read_text())
                if self._is_expired(data.get("timestamp", 0), current_time):
                    cache_file.unlink()
                    removed += 1
            except (json.JSONDecodeError, OSError):
                # Remove corrupted files
                try:
                    cache_file.unlink()
                    removed += 1
                except OSError:
                    pass

        return removed

    def _get_cache_file(self, key: str) -> Path:
        """Get cache file path for a key."""
        import hashlib

        key_hash = hashlib.sha256(key.encode()).hexdigest()[:32]
        return self.cache_dir / f"{key_hash}.json"

    def _is_expired(
        self, timestamp: float, current_time: float | None = None
    ) -> bool:
        """Check if a timestamp is expired."""
        if current_time is None:
            current_time = time.time()
        return current_time - timestamp > self.max_age_seconds

    def _update_access(self, key: str) -> None:
        """Update access order for LRU eviction."""
        if key in self._access_order:
            self._access_order.remove(key)
        self._access_order.append(key)

    def _evict_if_needed(self) -> None:
        """Evict oldest entries if over capacity."""
        while len(self._memory_cache) > self.max_entries:
            if not self._access_order:
                break
            oldest_key = self._access_order.pop(0)
            if oldest_key in self._memory_cache:
                del self._memory_cache[oldest_key]
