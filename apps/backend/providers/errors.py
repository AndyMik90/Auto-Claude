"""
Provider Error Handling Module
==============================

Defines provider-specific error types, recovery strategies,
and circuit breaker patterns for model provider failures.
"""

from enum import Enum
from dataclasses import dataclass
from typing import Optional, Callable
import time


class ProviderErrorType(str, Enum):
    """Types of provider errors."""
    RATE_LIMIT = "rate_limit"
    API_ERROR = "api_error"
    TIMEOUT = "timeout"
    AUTHENTICATION = "authentication"
    SERVICE_UNAVAILABLE = "service_unavailable"
    UNKNOWN = "unknown"


@dataclass
class ProviderError:
    """Structured error information from provider."""
    provider: str
    error_type: ProviderErrorType
    message: str
    status_code: Optional[int] = None
    retry_after: Optional[float] = None
    is_retriable: bool = True


class CircuitBreaker:
    """Circuit breaker for failing providers."""

    def __init__(
        self,
        failure_threshold: int = 5,
        timeout: float = 60.0,
        half_open_attempts: int = 3
    ):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.half_open_attempts = half_open_attempts
        self.failures = 0
        self.last_failure_time: Optional[float] = None
        self.state = "closed"  # closed, open, half_open
        self.half_open_success_count = 0

    def record_success(self):
        """Record a successful request."""
        self.failures = 0
        if self.state == "half_open":
            self.half_open_success_count += 1
            if self.half_open_success_count >= self.half_open_attempts:
                self.state = "closed"
                self.half_open_success_count = 0

    def record_failure(self):
        """Record a failed request."""
        self.failures += 1
        self.last_failure_time = time.time()
        if self.failures >= self.failure_threshold:
            self.state = "open"

    def can_attempt(self) -> bool:
        """Check if request can be attempted."""
        if self.state == "closed":
            return True
        if self.state == "open":
            if self.last_failure_time and time.time() - self.last_failure_time > self.timeout:
                self.state = "half_open"
                return True
            return False
        if self.state == "half_open":
            return True
        return False


class RetryStrategy:
    """Exponential backoff retry strategy."""

    def __init__(
        self,
        max_retries: int = 3,
        initial_delay: float = 1.0,
        max_delay: float = 60.0,
        backoff_multiplier: float = 2.0
    ):
        self.max_retries = max_retries
        self.initial_delay = initial_delay
        self.max_delay = max_delay
        self.backoff_multiplier = backoff_multiplier

    def get_delay(self, attempt: int) -> float:
        """Calculate delay for retry attempt."""
        delay = self.initial_delay * (self.backoff_multiplier ** attempt)
        return min(delay, self.max_delay)

    def should_retry(self, error: ProviderError, attempt: int) -> bool:
        """Determine if error should be retried."""
        if not error.is_retriable:
            return False
        if attempt >= self.max_retries:
            return False
        return True


# Provider-specific error mapping
PROVIDER_ERROR_PATTERNS = {
    "anthropic": {
        ProviderErrorType.RATE_LIMIT: [429, 529],
        ProviderErrorType.AUTHENTICATION: [401, 403],
        ProviderErrorType.SERVICE_UNAVAILABLE: [503, 502],
    },
    "openrouter": {
        ProviderErrorType.RATE_LIMIT: [429],
        ProviderErrorType.AUTHENTICATION: [401],
        ProviderErrorType.SERVICE_UNAVAILABLE: [503],
    },
    "zai": {
        ProviderErrorType.RATE_LIMIT: [429],
        ProviderErrorType.AUTHENTICATION: [401],
        ProviderErrorType.SERVICE_UNAVAILABLE: [503],
    },
}


def classify_error(provider: str, status_code: int, message: str) -> ProviderError:
    """Classify an error from provider response."""
    patterns = PROVIDER_ERROR_PATTERNS.get(provider, {})

    for error_type, codes in patterns.items():
        if status_code in codes:
            return ProviderError(
                provider=provider,
                error_type=error_type,
                message=message,
                status_code=status_code
            )

    # Check message for rate limit indicators
    if "rate limit" in message.lower():
        return ProviderError(
            provider=provider,
            error_type=ProviderErrorType.RATE_LIMIT,
            message=message,
            status_code=status_code
        )

    return ProviderError(
        provider=provider,
        error_type=ProviderErrorType.UNKNOWN,
        message=message,
        status_code=status_code
    )
