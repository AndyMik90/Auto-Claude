"""
Timeout protection for LLM API calls
Issue #79: Prevent infinite hangs when API is slow or network drops
"""

import asyncio
import logging
import os
from typing import Any, Awaitable, TypeVar

from core.exceptions import AgentTimeoutError

logger = logging.getLogger(__name__)

T = TypeVar('T')


def get_agent_timeout() -> float:
    """Get the configured agent session timeout from environment.

    Returns:
        Timeout in seconds (default: 300 = 5 minutes)
    """
    timeout_str = os.getenv('AGENT_SESSION_TIMEOUT', '300')
    try:
        timeout = float(timeout_str)
        # Enforce reasonable bounds: 30s minimum, 30min maximum
        timeout = max(30.0, min(timeout, 1800.0))
        return timeout
    except ValueError:
        logger.warning(
            f"Invalid AGENT_SESSION_TIMEOUT value: {timeout_str}. "
            "Using default 300 seconds."
        )
        return 300.0


async def with_timeout(
    coro: Awaitable[T],
    timeout: float | None = None,
    operation: str = "LLM API call"
) -> T:
    """Execute an async operation with timeout protection.

    Args:
        coro: The async coroutine to execute
        timeout: Timeout in seconds (if None, uses AGENT_SESSION_TIMEOUT env var)
        operation: Human-readable description for error messages

    Returns:
        The result of the coroutine

    Raises:
        AgentTimeoutError: If the operation exceeds the timeout

    Example:
        result = await with_timeout(
            client.create_agent_session(...),
            timeout=300.0,
            operation="agent session creation"
        )
    """
    if timeout is None:
        timeout = get_agent_timeout()

    try:
        result = await asyncio.wait_for(coro, timeout=timeout)
        return result

    except asyncio.TimeoutError:
        error_msg = (
            f"{operation} exceeded {timeout}s timeout. "
            "This usually indicates network issues or API slowness. "
            "Please check your connection and try again."
        )
        logger.error(f"Timeout error: {error_msg}")
        raise AgentTimeoutError(error_msg)


async def query_with_timeout(
    client: Any,
    message: str,
    timeout: float | None = None,
) -> None:
    """Send a query to the Claude SDK client with timeout protection.

    Args:
        client: The Claude SDK client instance
        message: The message/prompt to send
        timeout: Timeout in seconds (if None, uses AGENT_SESSION_TIMEOUT)

    Raises:
        AgentTimeoutError: If the query exceeds the timeout

    Example:
        from core.timeout import query_with_timeout

        await query_with_timeout(client, "Implement the feature", timeout=300.0)
    """
    if timeout is None:
        timeout = get_agent_timeout()

    try:
        await with_timeout(
            client.query(message),
            timeout=timeout,
            operation="Claude API query"
        )
    except AgentTimeoutError:
        logger.error(
            f"Claude API query timed out after {timeout}s. "
            f"Query length: {len(message)} characters"
        )
        raise


async def receive_with_timeout(
    client: Any,
    timeout: float | None = None,
):
    """Receive response from Claude SDK client with timeout protection.

    This wraps the entire response stream with a timeout. The timeout applies
    to the ENTIRE response stream, not individual messages.

    Args:
        client: The Claude SDK client instance
        timeout: Timeout in seconds (if None, uses AGENT_SESSION_TIMEOUT)

    Yields:
        Messages from the response stream

    Raises:
        AgentTimeoutError: If receiving the response exceeds the timeout

    Example:
        from core.timeout import query_with_timeout, receive_with_timeout

        await query_with_timeout(client, "Implement the feature")
        async for msg in receive_with_timeout(client):
            # Process message
            pass
    """
    if timeout is None:
        timeout = get_agent_timeout()

    async def _receive_all():
        """Helper to collect all responses."""
        async for msg in client.receive_response():
            yield msg

    try:
        # Create an async generator with timeout
        async for msg in with_timeout_generator(
            _receive_all(),
            timeout=timeout,
            operation="Claude API response stream"
        ):
            yield msg
    except AgentTimeoutError:
        logger.error(
            f"Claude API response stream timed out after {timeout}s"
        )
        raise


async def with_timeout_generator(
    async_gen,
    timeout: float,
    operation: str = "async operation"
):
    """Wrap an async generator with timeout protection.

    Args:
        async_gen: The async generator to wrap
        timeout: Timeout in seconds
        operation: Human-readable description for error messages

    Yields:
        Items from the async generator

    Raises:
        AgentTimeoutError: If the generator exceeds the timeout

    Note:
        The timeout applies to the ENTIRE generator execution, not per item.
        Each iteration is protected with asyncio.wait_for() to prevent hangs.
    """
    import time
    start_time = time.time()

    try:
        while True:
            # Calculate remaining timeout for this iteration
            elapsed = time.time() - start_time
            remaining = timeout - elapsed

            if remaining <= 0:
                raise asyncio.TimeoutError()

            # Wrap EACH iteration with timeout protection
            # This ensures if the generator hangs waiting for the next item,
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
