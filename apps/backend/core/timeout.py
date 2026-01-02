"""
Timeout Protection for LLM API Calls
====================================

Provides async timeout wrappers for Claude SDK client operations to prevent
infinite hangs when network issues occur or the API is slow/unresponsive.

Issue #79: Add timeout protection to all LLM API calls

Usage:
    from core.timeout import query_with_timeout, receive_with_timeout
    
    # Query with timeout
    await query_with_timeout(client, message, timeout=300.0)
    
    # Receive response stream with timeout
    async for msg in receive_with_timeout(client, timeout=300.0):
        # Process message
        pass
"""

import asyncio
import logging
import os
import time
from typing import AsyncGenerator, TypeVar

from claude_agent_sdk import ClaudeSDKClient

from .exceptions import AgentTimeoutError

logger = logging.getLogger(__name__)

# Type variable for generic async generator
T = TypeVar("T")

# =============================================================================
# TIMEOUT CONFIGURATION
# =============================================================================

# Default timeout in seconds (5 minutes)
DEFAULT_TIMEOUT = 300.0

# Minimum allowed timeout (30 seconds)
MIN_TIMEOUT = 30.0

# Maximum allowed timeout (30 minutes)
MAX_TIMEOUT = 1800.0


def get_agent_timeout() -> float:
    """
    Get the configured agent session timeout from environment.
    
    Returns:
        Timeout in seconds, bounded by MIN_TIMEOUT and MAX_TIMEOUT
    """
    try:
        timeout = float(os.getenv("AGENT_SESSION_TIMEOUT", str(DEFAULT_TIMEOUT)))
        
        # Enforce bounds
        if timeout < MIN_TIMEOUT:
            logger.warning(
                f"AGENT_SESSION_TIMEOUT ({timeout}s) is below minimum ({MIN_TIMEOUT}s). "
                f"Using {MIN_TIMEOUT}s instead."
            )
            timeout = MIN_TIMEOUT
        elif timeout > MAX_TIMEOUT:
            logger.warning(
                f"AGENT_SESSION_TIMEOUT ({timeout}s) exceeds maximum ({MAX_TIMEOUT}s). "
                f"Using {MAX_TIMEOUT}s instead."
            )
            timeout = MAX_TIMEOUT
            
        return timeout
    except (ValueError, TypeError):
        logger.warning(
            f"Invalid AGENT_SESSION_TIMEOUT value. Using default {DEFAULT_TIMEOUT}s."
        )
        return DEFAULT_TIMEOUT


# =============================================================================
# TIMEOUT WRAPPER FUNCTIONS
# =============================================================================


async def query_with_timeout(
    client: ClaudeSDKClient,
    message: str,
    timeout: float | None = None,
) -> None:
    """
    Send a query to the Claude SDK client with timeout protection.
    
    Args:
        client: Claude SDK client instance
        message: Message to send to the agent
        timeout: Timeout in seconds (default: from AGENT_SESSION_TIMEOUT env var)
        
    Raises:
        AgentTimeoutError: If the query exceeds the timeout
    """
    if timeout is None:
        timeout = get_agent_timeout()
    
    try:
        await asyncio.wait_for(
            client.query(message),
            timeout=timeout
        )
    except asyncio.TimeoutError:
        error_msg = (
            f"LLM API query exceeded {timeout}s timeout. "
            "This usually indicates network issues or API slowness. "
            "Please check your connection and try again."
        )
        logger.error(f"Query timeout: {error_msg}")
        raise AgentTimeoutError(error_msg)


async def receive_with_timeout(
    client: ClaudeSDKClient,
    timeout: float | None = None,
) -> AsyncGenerator:
    """
    Receive response stream from Claude SDK client with timeout protection.
    
    This wraps the client.receive_response() async generator to ensure it
    doesn't hang indefinitely. The timeout applies to the ENTIRE stream,
    not individual messages.
    
    Args:
        client: Claude SDK client instance
        timeout: Timeout in seconds (default: from AGENT_SESSION_TIMEOUT env var)
        
    Yields:
        Messages from the response stream
        
    Raises:
        AgentTimeoutError: If receiving the response stream exceeds the timeout
    """
    if timeout is None:
        timeout = get_agent_timeout()
    
    async for msg in with_timeout_generator(
        client.receive_response(),
        timeout=timeout,
        operation="LLM API response stream"
    ):
        yield msg


async def with_timeout_generator(
    async_gen: AsyncGenerator[T, None],
    timeout: float,
    operation: str = "Operation"
) -> AsyncGenerator[T, None]:
    """
    Generic async generator wrapper with timeout protection.
    
    This ensures that if the generator hangs waiting for the next item,
    we timeout correctly. The timeout is cumulative across the entire
    generator lifetime.
    
    **CRITICAL FIX**: Wraps each __anext__() call with asyncio.wait_for()
    to ensure timeouts fire even if the generator hangs waiting for a message.
    The original implementation only checked elapsed time AFTER receiving
    each message, which meant if the generator hung waiting, the timeout
    would never trigger.
    
    Args:
        async_gen: Async generator to wrap
        timeout: Timeout in seconds for the entire generator
        operation: Description of the operation (for error messages)
        
    Yields:
        Items from the async generator
        
    Raises:
        AgentTimeoutError: If the generator exceeds the timeout
    """
    import time
    start_time = time.time()
    
    try:
        while True:
            # Calculate remaining timeout for THIS iteration
            elapsed = time.time() - start_time
            remaining = timeout - elapsed
            
            if remaining <= 0:
                raise asyncio.TimeoutError()
            
            # ✅ Wrap EACH iteration with timeout protection
            # This ensures if the generator hangs waiting for next item,
            # we timeout correctly (fixes issue #79)
            try:
                item = await asyncio.wait_for(
                    async_gen.__anext__(),
                    timeout=remaining
                )
                yield item
            except StopAsyncIteration:
                # Generator finished normally
                return
                
    except asyncio.TimeoutError:
        error_msg = (
            f"{operation} exceeded {timeout}s timeout. "
            "This usually indicates network issues or API slowness. "
            "Please check your connection and try again."
        )
        logger.error(f"Timeout error: {error_msg}")
        raise AgentTimeoutError(error_msg)
