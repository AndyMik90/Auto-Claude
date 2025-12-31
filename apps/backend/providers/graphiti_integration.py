"""
Graphiti Integration for Provider Preferences
============================================

Stores and retrieves provider preferences and performance data
in Graphiti memory for cross-session learning.
"""

import json
from typing import Optional, Dict, Any, List
from datetime import datetime
from pathlib import Path

from .config import ModelProvider
from .memory import ProviderMemory, ProviderStats


class ProviderGraphitiIntegration:
    """
    Integration layer for storing provider data in Graphiti.

    Allows provider preferences and performance metrics to persist
    across sessions, enabling the system to learn which providers
    work best for different agent types and tasks.
    """

    def __init__(self, spec_dir: Optional[Path] = None):
        """
        Initialize Graphiti integration.

        Args:
            spec_dir: Directory for spec-specific graph data
        """
        self.spec_dir = spec_dir
        self.graphiti_client = None
        self._initialized = False

    def _ensure_client(self):
        """Lazy initialization of Graphiti client."""
        if self._initialized:
            return

        try:
            from integrations.graphiti.queries_pkg.graphiti import (
                GraphitiMemory,
            )
            from integrations.graphiti.memory import get_graphiti_memory

            if self.spec_dir:
                self.graphiti_client = get_graphiti_memory(
                    spec_dir=str(self.spec_dir), project_dir=str(self.spec_dir.parent)
                )
            else:
                self.graphiti_client = get_graphiti_memory()

            self._initialized = True
        except ImportError:
            # Graphiti not available, run without persistence
            self._initialized = True

    def store_provider_preference(
        self, agent_type: str, provider: ModelProvider, reason: Optional[str] = None
    ) -> bool:
        """
        Store a provider preference in Graphiti.

        Args:
            agent_type: Agent type (e.g., "coder", "planner")
            provider: Preferred provider
            reason: Optional explanation for preference

        Returns:
            True if stored successfully
        """
        self._ensure_client()

        if not self.graphiti_client:
            return False

        try:
            # Create an insight about provider preference
            insight = f"Provider preference: For {agent_type} agents, {provider.value} is preferred"
            if reason:
                insight += f" because {reason}"

            # Store as a session insight
            self.graphiti_client.add_session_insight(insight)
            return True
        except Exception:
            return False

    def store_provider_performance(
        self,
        provider: ModelProvider,
        stats: ProviderStats,
        context: Optional[str] = None,
    ) -> bool:
        """
        Store provider performance summary in Graphiti.

        Args:
            provider: Provider to report on
            stats: Provider statistics
            context: Optional context (task type, etc.)

        Returns:
            True if stored successfully
        """
        self._ensure_client()

        if not self.graphiti_client:
            return False

        try:
            insight_parts = [
                f"Provider {provider.value} performance:",
                f"- Success rate: {stats.success_rate:.1f}%",
                f"- Average response time: {stats.avg_response_time:.2f}s",
                f"- Total requests: {stats.total_requests}",
            ]

            if stats.total_cost > 0:
                insight_parts.append(f"- Total cost: ${stats.total_cost:.4f}")

            if context:
                insight_parts.append(f"- Context: {context}")

            insight = "\n".join(insight_parts)
            self.graphiti_client.add_session_insight(insight)
            return True
        except Exception:
            return False

    def store_error_pattern(
        self,
        provider: ModelProvider,
        error_type: str,
        frequency: int,
        recommendation: Optional[str] = None,
    ) -> bool:
        """
        Store an error pattern observation in Graphiti.

        Args:
            provider: Provider experiencing errors
            error_type: Type of error (rate_limit, timeout, etc.)
            frequency: How often this occurs
            recommendation: Optional recommendation

        Returns:
            True if stored successfully
        """
        self._ensure_client()

        if not self.graphiti_client:
            return False

        try:
            insight = f"Error pattern: Provider {provider.value} experiences {error_type} errors"
            if frequency > 1:
                insight += f" ({frequency} occurrences)"

            if recommendation:
                insight += f". Recommendation: {recommendation}"

            self.graphiti_client.add_session_insight(insight)
            return True
        except Exception:
            return False

    def retrieve_provider_preferences(self) -> Dict[str, ModelProvider]:
        """
        Retrieve provider preferences from Graphiti memory.

        Returns:
            Dictionary mapping agent types to preferred providers
        """
        self._ensure_client()

        if not self.graphiti_client:
            return {}

        try:
            # Search for provider preference insights
            context = self.graphiti_client.get_context_for_session(
                "What provider preferences have been established?"
            )

            # Parse preferences from context
            # This is a simplified implementation - real parsing would be more sophisticated
            preferences = {}

            # Look for patterns like "For X agents, Y is preferred"
            for line in context.split("\n"):
                if "Provider preference:" in line:
                    # Extract agent type and provider
                    # Format: "Provider preference: For X agents, Y is preferred"
                    parts = line.split("For ")
                    if len(parts) > 1:
                        agent_part = parts[1].split(" agents")[0].strip()
                        provider_part = parts[1].split(" is preferred")[0].split()[-1].strip()

                        try:
                            preferences[agent_part] = ModelProvider(provider_part)
                        except ValueError:
                            pass

            return preferences
        except Exception:
            return {}

    def retrieve_provider_insights(
        self, provider: Optional[ModelProvider] = None
    ) -> List[str]:
        """
        Retrieve insights about provider performance.

        Args:
            provider: Optional provider to filter by

        Returns:
            List of insight strings
        """
        self._ensure_client()

        if not self.graphiti_client:
            return []

        try:
            query = "What insights exist about provider performance?"
            if provider:
                query = f"What insights exist about {provider.value} provider performance?"

            context = self.graphiti_client.get_context_for_session(query)

            # Split into individual insights
            insights = [
                line.strip()
                for line in context.split("\n")
                if line.strip() and ("Provider" in line or "error" in line.lower())
            ]

            return insights
        except Exception:
            return []

    def sync_memory_to_graphiti(self, memory: ProviderMemory) -> bool:
        """
        Sync all memory data to Graphiti.

        Args:
            memory: Provider memory instance to sync

        Returns:
            True if sync successful
        """
        self._ensure_client()

        if not self.graphiti_client:
            return False

        try:
            # Sync preferences
            for agent_type, provider in memory.preferences.items():
                self.store_provider_preference(agent_type, provider)

            # Sync stats for each provider
            for provider, stats in memory.stats.items():
                if stats.total_requests > 0:
                    self.store_provider_performance(provider, stats)

            return True
        except Exception:
            return False

    def load_preferences_into_memory(self, memory: ProviderMemory) -> bool:
        """
        Load preferences from Graphiti into memory.

        Args:
            memory: Provider memory instance to update

        Returns:
            True if load successful
        """
        preferences = self.retrieve_provider_preferences()

        for agent_type, provider in preferences.items():
            memory.preferences[agent_type] = provider

        return len(preferences) > 0


def get_graphiti_integration(spec_dir: Optional[Path] = None) -> ProviderGraphitiIntegration:
    """
    Get or create the Graphiti integration instance.

    Args:
        spec_dir: Optional spec directory for Graphiti

    Returns:
        ProviderGraphitiIntegration instance
    """
    return ProviderGraphitiIntegration(spec_dir=spec_dir)


# Convenience functions for quick operations

def save_provider_preference(
    agent_type: str,
    provider: ModelProvider,
    reason: Optional[str] = None,
    spec_dir: Optional[Path] = None,
) -> bool:
    """
    Quick function to save a provider preference.

    Args:
        agent_type: Agent type
        provider: Preferred provider
        reason: Optional reason
        spec_dir: Optional spec directory

    Returns:
        True if saved successfully
    """
    integration = get_graphiti_integration(spec_dir)
    return integration.store_provider_preference(agent_type, provider, reason)


def load_provider_preferences(
    spec_dir: Optional[Path] = None,
) -> Dict[str, ModelProvider]:
    """
    Quick function to load provider preferences.

    Args:
        spec_dir: Optional spec directory

    Returns:
        Dictionary of agent types to providers
    """
    integration = get_graphiti_integration(spec_dir)
    return integration.retrieve_provider_preferences()


def record_provider_error(
    provider: ModelProvider,
    error_type: str,
    frequency: int = 1,
    recommendation: Optional[str] = None,
    spec_dir: Optional[Path] = None,
) -> bool:
    """
    Quick function to record a provider error pattern.

    Args:
        provider: Provider with errors
        error_type: Type of error
        frequency: How many occurrences
        recommendation: Optional recommendation
        spec_dir: Optional spec directory

    Returns:
        True if recorded successfully
    """
    integration = get_graphiti_integration(spec_dir)
    return integration.store_error_pattern(provider, error_type, frequency, recommendation)
