"""
Rate Limit Handler
==================

Handles Claude API rate limits with intelligent pause/resume functionality
and optional Ollama fallback.
"""

import asyncio
import logging
import os
import re
import time
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Callable

logger = logging.getLogger(__name__)


class RateLimitStatus(Enum):
    """Rate limit status."""
    OK = "ok"
    RATE_LIMITED = "rate_limited"
    PAUSED = "paused"
    USING_FALLBACK = "using_fallback"


@dataclass
class RateLimitState:
    """Current rate limit state."""
    status: RateLimitStatus = RateLimitStatus.OK
    rate_limited_at: float | None = None
    retry_after_seconds: int = 60
    retry_count: int = 0
    max_retries: int = 5
    last_error: str | None = None
    using_fallback: bool = False
    fallback_model: str | None = None


@dataclass
class RateLimitConfig:
    """Configuration for rate limit handling."""
    # Pause and retry settings
    pause_on_rate_limit: bool = True
    auto_resume: bool = True
    default_wait_seconds: int = 60
    max_wait_seconds: int = 300
    backoff_multiplier: float = 1.5
    max_retries: int = 5
    
    # Fallback settings
    fallback_to_ollama: bool = True
    ollama_model: str = "llama3.1:8b"
    
    # Notification settings
    notify_on_rate_limit: bool = True
    notify_on_resume: bool = True
    
    @classmethod
    def from_env(cls) -> "RateLimitConfig":
        """Create config from environment variables."""
        return cls(
            pause_on_rate_limit=os.environ.get("RATE_LIMIT_PAUSE", "true").lower() == "true",
            auto_resume=os.environ.get("RATE_LIMIT_AUTO_RESUME", "true").lower() == "true",
            default_wait_seconds=int(os.environ.get("RATE_LIMIT_WAIT_SECONDS", "60")),
            max_wait_seconds=int(os.environ.get("RATE_LIMIT_MAX_WAIT_SECONDS", "300")),
            backoff_multiplier=float(os.environ.get("RATE_LIMIT_BACKOFF_MULTIPLIER", "1.5")),
            max_retries=int(os.environ.get("RATE_LIMIT_MAX_RETRIES", "5")),
            fallback_to_ollama=os.environ.get("RATE_LIMIT_FALLBACK_OLLAMA", "true").lower() == "true",
            ollama_model=os.environ.get("OLLAMA_MODEL", "llama3.1:8b"),
            notify_on_rate_limit=os.environ.get("RATE_LIMIT_NOTIFY", "true").lower() == "true",
            notify_on_resume=os.environ.get("RATE_LIMIT_NOTIFY_RESUME", "true").lower() == "true",
        )


class RateLimitHandler:
    """
    Handles rate limiting with pause/resume and optional Ollama fallback.
    
    Features:
    - Detects rate limit errors from Claude API
    - Pauses execution and waits for rate limit to clear
    - Optionally falls back to Ollama during rate limit
    - Exponential backoff for retries
    - Emits events for UI notification
    """
    
    def __init__(
        self,
        config: RateLimitConfig | None = None,
        on_rate_limit: Callable[[RateLimitState], None] | None = None,
        on_resume: Callable[[RateLimitState], None] | None = None,
        on_fallback: Callable[[str], None] | None = None,
    ):
        """
        Initialize rate limit handler.
        
        Args:
            config: Rate limit configuration
            on_rate_limit: Callback when rate limited
            on_resume: Callback when resuming
            on_fallback: Callback when switching to fallback
        """
        self.config = config or RateLimitConfig.from_env()
        self.state = RateLimitState()
        self._on_rate_limit = on_rate_limit
        self._on_resume = on_resume
        self._on_fallback = on_fallback
        self._pause_event = asyncio.Event()
        self._pause_event.set()  # Not paused initially
        
    def is_rate_limited(self) -> bool:
        """Check if currently rate limited."""
        return self.state.status in (RateLimitStatus.RATE_LIMITED, RateLimitStatus.PAUSED)
    
    def is_using_fallback(self) -> bool:
        """Check if using Ollama fallback."""
        return self.state.using_fallback
    
    def get_wait_time(self) -> int:
        """Get remaining wait time in seconds."""
        if not self.state.rate_limited_at:
            return 0
        
        elapsed = time.time() - self.state.rate_limited_at
        remaining = self.state.retry_after_seconds - elapsed
        return max(0, int(remaining))
    
    def parse_rate_limit_error(self, error: Exception | str) -> tuple[bool, int]:
        """
        Parse an error to determine if it's a rate limit.
        
        Args:
            error: Exception or error message
            
        Returns:
            Tuple of (is_rate_limit, retry_after_seconds)
        """
        error_str = str(error).lower()
        
        # Common rate limit indicators
        rate_limit_patterns = [
            r"rate.?limit",
            r"too.?many.?requests",
            r"429",
            r"quota.?exceeded",
            r"overloaded",
            r"capacity",
        ]
        
        is_rate_limit = any(re.search(p, error_str) for p in rate_limit_patterns)
        
        if not is_rate_limit:
            return False, 0
        
        # Try to extract retry-after from error
        retry_after = self.config.default_wait_seconds
        
        # Look for "retry after X seconds" pattern
        retry_match = re.search(r"retry.?after[:\s]+(\d+)", error_str)
        if retry_match:
            retry_after = int(retry_match.group(1))
        
        # Look for "wait X seconds" pattern
        wait_match = re.search(r"wait[:\s]+(\d+)\s*(?:seconds?)?", error_str)
        if wait_match:
            retry_after = int(wait_match.group(1))
        
        # Cap at max wait
        retry_after = min(retry_after, self.config.max_wait_seconds)
        
        return True, retry_after
    
    async def handle_rate_limit(
        self,
        error: Exception | str,
        spec_dir: Path | None = None,
    ) -> RateLimitStatus:
        """
        Handle a rate limit error.
        
        Args:
            error: The rate limit error
            spec_dir: Spec directory for status file
            
        Returns:
            New status after handling
        """
        is_rate_limit, retry_after = self.parse_rate_limit_error(error)
        
        if not is_rate_limit:
            return RateLimitStatus.OK
        
        # Update state
        self.state.status = RateLimitStatus.RATE_LIMITED
        self.state.rate_limited_at = time.time()
        self.state.retry_after_seconds = retry_after
        self.state.retry_count += 1
        self.state.last_error = str(error)
        
        logger.warning(
            f"Rate limited. Retry after {retry_after}s. "
            f"Attempt {self.state.retry_count}/{self.config.max_retries}"
        )
        
        # Notify callback
        if self._on_rate_limit and self.config.notify_on_rate_limit:
            self._on_rate_limit(self.state)
        
        # Write status file for UI
        if spec_dir:
            self._write_status_file(spec_dir)
        
        # Check if we should use fallback
        if self.config.fallback_to_ollama and await self._check_ollama_available():
            self.state.status = RateLimitStatus.USING_FALLBACK
            self.state.using_fallback = True
            self.state.fallback_model = self.config.ollama_model
            
            if self._on_fallback:
                self._on_fallback(self.config.ollama_model)
            
            logger.info(f"Switching to Ollama fallback: {self.config.ollama_model}")
            return RateLimitStatus.USING_FALLBACK
        
        # Pause if configured
        if self.config.pause_on_rate_limit:
            self.state.status = RateLimitStatus.PAUSED
            self._pause_event.clear()
            
            if self.config.auto_resume:
                # Schedule auto-resume
                asyncio.create_task(self._auto_resume(retry_after, spec_dir))
            
            return RateLimitStatus.PAUSED
        
        return RateLimitStatus.RATE_LIMITED
    
    async def wait_for_resume(self) -> None:
        """Wait until rate limit is cleared or manually resumed."""
        await self._pause_event.wait()
    
    def resume(self, spec_dir: Path | None = None) -> None:
        """
        Manually resume from rate limit pause.
        
        Args:
            spec_dir: Spec directory for status file
        """
        self.state.status = RateLimitStatus.OK
        self.state.using_fallback = False
        self.state.fallback_model = None
        self._pause_event.set()
        
        if self._on_resume and self.config.notify_on_resume:
            self._on_resume(self.state)
        
        if spec_dir:
            self._write_status_file(spec_dir)
        
        logger.info("Resumed from rate limit pause")
    
    def reset(self) -> None:
        """Reset rate limit state."""
        self.state = RateLimitState()
        self._pause_event.set()
    
    async def _auto_resume(self, wait_seconds: int, spec_dir: Path | None) -> None:
        """
        Auto-resume after wait period.
        
        Args:
            wait_seconds: Seconds to wait
            spec_dir: Spec directory for status file
        """
        logger.info(f"Auto-resume scheduled in {wait_seconds}s")
        
        # Wait with periodic status updates
        elapsed = 0
        update_interval = 10  # Update every 10 seconds
        
        while elapsed < wait_seconds:
            await asyncio.sleep(min(update_interval, wait_seconds - elapsed))
            elapsed += update_interval
            
            remaining = wait_seconds - elapsed
            if remaining > 0:
                logger.debug(f"Rate limit: {remaining}s remaining")
                if spec_dir:
                    self._write_status_file(spec_dir, remaining)
        
        # Check if Claude is available again
        if await self._check_claude_available():
            self.resume(spec_dir)
        else:
            # Apply backoff and retry
            if self.state.retry_count < self.config.max_retries:
                new_wait = int(wait_seconds * self.config.backoff_multiplier)
                new_wait = min(new_wait, self.config.max_wait_seconds)
                logger.warning(f"Claude still unavailable. Retrying in {new_wait}s")
                await self._auto_resume(new_wait, spec_dir)
            else:
                logger.error("Max retries reached. Manual intervention required.")
                self.state.status = RateLimitStatus.PAUSED
    
    async def _check_ollama_available(self) -> bool:
        """Check if Ollama is available for fallback."""
        try:
            from phase_config import is_ollama_available
            return is_ollama_available()
        except Exception:
            return False
    
    async def _check_claude_available(self) -> bool:
        """Check if Claude API is available again."""
        try:
            import httpx
            
            # Simple health check to Anthropic API
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.anthropic.com/v1/messages",
                    headers={"x-api-key": os.environ.get("ANTHROPIC_API_KEY", "")},
                    timeout=5.0,
                )
                # 401 means API is reachable (just unauthorized for this endpoint)
                # 429 means still rate limited
                return response.status_code != 429
        except Exception:
            return True  # Assume available if we can't check
    
    def _write_status_file(
        self,
        spec_dir: Path,
        remaining_seconds: int | None = None,
    ) -> None:
        """
        Write rate limit status file for UI.
        
        Args:
            spec_dir: Spec directory
            remaining_seconds: Remaining wait time
        """
        import json
        
        status_file = spec_dir / ".rate_limit_status.json"
        
        status = {
            "status": self.state.status.value,
            "rate_limited_at": self.state.rate_limited_at,
            "retry_after_seconds": self.state.retry_after_seconds,
            "remaining_seconds": remaining_seconds or self.get_wait_time(),
            "retry_count": self.state.retry_count,
            "max_retries": self.state.max_retries,
            "using_fallback": self.state.using_fallback,
            "fallback_model": self.state.fallback_model,
            "last_error": self.state.last_error,
        }
        
        try:
            with open(status_file, "w") as f:
                json.dump(status, f, indent=2)
        except Exception as e:
            logger.warning(f"Failed to write rate limit status: {e}")


def create_rate_limit_handler(
    on_rate_limit: Callable[[RateLimitState], None] | None = None,
    on_resume: Callable[[RateLimitState], None] | None = None,
    on_fallback: Callable[[str], None] | None = None,
) -> RateLimitHandler:
    """
    Create a rate limit handler with default configuration.
    
    Args:
        on_rate_limit: Callback when rate limited
        on_resume: Callback when resuming
        on_fallback: Callback when switching to fallback
        
    Returns:
        Configured RateLimitHandler
    """
    config = RateLimitConfig.from_env()
    return RateLimitHandler(
        config=config,
        on_rate_limit=on_rate_limit,
        on_resume=on_resume,
        on_fallback=on_fallback,
    )
