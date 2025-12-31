"""
Fallback Provider Manager
=========================

Manages automatic fallback between providers when failures occur.
"""

from typing import List, Optional
from .config import ModelProvider, PROVIDER_CONFIGS
from .errors import CircuitBreaker, ProviderError


class FallbackManager:
    """Manages provider fallback with circuit breakers."""

    def __init__(self, fallback_chain: List[ModelProvider]):
        self.fallback_chain = fallback_chain
        self.circuit_breakers: dict = {
            provider.value: CircuitBreaker()
            for provider in fallback_chain
        }
        self.current_index = 0

    def get_available_provider(self) -> Optional[ModelProvider]:
        """Get next available provider from fallback chain."""
        for i, provider in enumerate(self.fallback_chain):
            cb = self.circuit_breakers.get(provider.value)
            if cb and cb.can_attempt():
                self.current_index = i
                return provider
        return None

    def record_success(self, provider: ModelProvider):
        """Record successful request."""
        cb = self.circuit_breakers.get(provider.value)
        if cb:
            cb.record_success()

    def record_failure(self, provider: ModelProvider, error: ProviderError):
        """Record failed request."""
        cb = self.circuit_breakers.get(provider.value)
        if cb:
            cb.record_failure()

    def get_fallback_chain_status(self) -> dict:
        """Get status of all providers in fallback chain."""
        return {
            provider.value: {
                "state": cb.state,
                "failures": cb.failures,
                "can_attempt": cb.can_attempt()
            }
            for provider, cb in self.circuit_breakers.items()
        }

    def reset(self):
        """Reset all circuit breakers to closed state."""
        for cb in self.circuit_breakers.values():
            cb.state = "closed"
            cb.failures = 0
            cb.last_failure_time = None


# Default fallback chains
DEFAULT_FALLBACK_CHAINS = {
    "anthropic_primary": [
        ModelProvider.ANTHROPIC,
        ModelProvider.OPENROUTER,
    ],
    "cost_optimized": [
        ModelProvider.ZAI,
        ModelProvider.OPENROUTER,
        ModelProvider.ANTHROPIC,
    ],
}


def get_fallback_manager(chain_name: str = "anthropic_primary") -> FallbackManager:
    """Get a fallback manager by chain name."""
    if chain_name not in DEFAULT_FALLBACK_CHAINS:
        chain_name = "anthropic_primary"
    return FallbackManager(DEFAULT_FALLBACK_CHAINS[chain_name])
