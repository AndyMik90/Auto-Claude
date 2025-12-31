"""
Provider Memory System
======================

Tracks provider performance metrics, stores preferences in Graphiti,
and enables intelligent provider selection based on historical data.
"""

import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
from enum import Enum
import json

from .config import ModelProvider, PROVIDER_CONFIGS


class MetricType(str, Enum):
    """Types of metrics to track."""
    RESPONSE_TIME = "response_time"
    SUCCESS_RATE = "success_rate"
    TOKEN_COST = "token_cost"
    ERROR_COUNT = "error_count"
    REQUEST_COUNT = "request_count"


@dataclass
class ProviderMetric:
    """Metric data point for a provider."""
    metric_type: MetricType
    value: float
    timestamp: datetime
    model: str
    agent_type: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class ProviderStats:
    """Aggregated statistics for a provider."""
    provider: ModelProvider
    total_requests: int = 0
    successful_requests: int = 0
    failed_requests: int = 0
    total_response_time: float = 0.0
    total_tokens: int = 0
    total_cost: float = 0.0
    last_used: Optional[datetime] = None
    last_error: Optional[datetime] = None
    last_error_message: Optional[str] = None

    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_requests == 0:
            return 0.0
        return (self.successful_requests / self.total_requests) * 100

    @property
    def avg_response_time(self) -> float:
        """Calculate average response time in seconds."""
        if self.successful_requests == 0:
            return 0.0
        return self.total_response_time / self.successful_requests

    @property
    def avg_tokens_per_request(self) -> float:
        """Calculate average tokens per request."""
        if self.successful_requests == 0:
            return 0.0
        return self.total_tokens / self.successful_requests


class ProviderMemory:
    """
    Memory system for tracking provider performance and preferences.

    Stores metrics in-memory and optionally persists to Graphiti
    for cross-session learning and optimization.
    """

    def __init__(self, retention_days: int = 30):
        """
        Initialize provider memory.

        Args:
            retention_days: How many days to keep metric data
        """
        self.retention_days = retention_days
        self.metrics: List[ProviderMetric] = []
        self.stats: Dict[ModelProvider, ProviderStats] = {
            provider: ProviderStats(provider=provider)
            for provider in ModelProvider
        }
        self.preferences: Dict[str, ModelProvider] = {}  # agent_type -> provider

    def record_request(
        self,
        provider: ModelProvider,
        model: str,
        response_time: float,
        success: bool,
        tokens: int = 0,
        cost: float = 0.0,
        agent_type: Optional[str] = None,
        error_message: Optional[str] = None,
    ) -> None:
        """
        Record a provider request with its outcome.

        Args:
            provider: The provider used
            model: Model identifier
            response_time: Time in seconds
            success: Whether the request succeeded
            tokens: Number of tokens used
            cost: Estimated cost in USD
            agent_type: Type of agent (planner, coder, qa_reviewer, etc.)
            error_message: Error message if failed
        """
        now = datetime.now()

        # Update stats
        stats = self.stats[provider]
        stats.total_requests += 1
        stats.last_used = now

        if success:
            stats.successful_requests += 1
            stats.total_response_time += response_time
            stats.total_tokens += tokens
            stats.total_cost += cost
        else:
            stats.failed_requests += 1
            stats.last_error = now
            stats.last_error_message = error_message

        # Store metric
        self.metrics.append(
            ProviderMetric(
                metric_type=MetricType.RESPONSE_TIME,
                value=response_time,
                timestamp=now,
                model=model,
                agent_type=agent_type,
                metadata={"success": success, "tokens": tokens, "cost": cost},
            )
        )

        # Clean old metrics
        self._cleanup_old_metrics()

    def record_preference(self, agent_type: str, provider: ModelProvider) -> None:
        """
        Record a provider preference for a specific agent type.

        Args:
            agent_type: Agent type (e.g., "coder", "planner")
            provider: Preferred provider
        """
        self.preferences[agent_type] = provider

    def get_provider_stats(self, provider: ModelProvider) -> ProviderStats:
        """Get statistics for a specific provider."""
        return self.stats[provider]

    def get_best_provider(
        self,
        agent_type: Optional[str] = None,
        require_extended_thinking: bool = False,
    ) -> ModelProvider:
        """
        Get the best provider based on historical performance.

        Args:
            agent_type: Optional agent type for preference lookup
            require_extended_thinking: Whether provider must support extended thinking

        Returns:
            Best ModelProvider for the criteria
        """
        # Check explicit preference first
        if agent_type and agent_type in self.preferences:
            preferred = self.preferences[agent_type]
            if not require_extended_thinking or PROVIDER_CONFIGS[
                preferred
            ].supports_extended_thinking:
                return preferred

        # Filter by requirements
        candidates = list(ModelProvider)
        if require_extended_thinking:
            candidates = [
                p
                for p in candidates
                if PROVIDER_CONFIGS[p].supports_extended_thinking
            ]

        # Score candidates (higher is better)
        def score_provider(provider: ModelProvider) -> float:
            stats = self.stats[provider]

            # If no data, give neutral score
            if stats.total_requests == 0:
                return 50.0

            # Score based on success rate (40% weight)
            success_score = stats.success_rate * 0.4

            # Score based on speed (faster is better, 30% weight)
            # Invert response time: 10s = 0 points, 0s = 30 points
            speed_score = max(0, 30 - (stats.avg_response_time * 3)) * 0.3

            # Score based on availability (recent errors reduce score, 30% weight)
            availability_score = 30.0
            if stats.last_error:
                time_since_error = (datetime.now() - stats.last_error).total_seconds()
                if time_since_error < 300:  # Last 5 minutes
                    availability_score = 0.0
                elif time_since_error < 3600:  # Last hour
                    availability_score = 10.0
                elif time_since_error < 86400:  # Last day
                    availability_score = 20.0

            return success_score + speed_score + availability_score

        # Return highest-scoring provider
        return max(candidates, key=score_provider)

    def get_recent_metrics(
        self,
        provider: Optional[ModelProvider] = None,
        hours: int = 24,
        metric_type: Optional[MetricType] = None,
    ) -> List[ProviderMetric]:
        """
        Get metrics from a recent time window.

        Args:
            provider: Filter by provider (None = all)
            hours: Number of hours to look back
            metric_type: Filter by metric type

        Returns:
            List of metrics matching criteria
        """
        cutoff = datetime.now() - timedelta(hours=hours)

        filtered = [
            m
            for m in self.metrics
            if m.timestamp >= cutoff
            and (provider is None or m.metadata.get("provider") == provider)
            and (metric_type is None or m.metric_type == metric_type)
        ]

        return filtered

    def get_cost_summary(
        self, provider: Optional[ModelProvider] = None, days: int = 7
    ) -> Dict[str, Any]:
        """
        Get cost summary for a time period.

        Args:
            provider: Filter by provider (None = all)
            days: Number of days to look back

        Returns:
            Dictionary with cost breakdown
        """
        cutoff = datetime.now() - timedelta(days=days)
        relevant_metrics = [m for m in self.metrics if m.timestamp >= cutoff]

        total_cost = 0.0
        total_tokens = 0
        provider_costs: Dict[str, float] = {}

        for metric in relevant_metrics:
            if not metric.metadata.get("success", True):
                continue

            cost = metric.metadata.get("cost", 0.0)
            tokens = metric.metadata.get("tokens", 0)

            total_cost += cost
            total_tokens += tokens

            # Track per-provider (need to infer from metric context)
            # In real implementation, would store provider in metric

        return {
            "total_cost": total_cost,
            "total_tokens": total_tokens,
            "period_days": days,
            "provider_costs": provider_costs,
        }

    def export_metrics(self) -> List[Dict[str, Any]]:
        """
        Export metrics as serializable dictionaries.

        Returns:
            List of metric data as dicts
        """
        return [
            {
                "metric_type": m.metric_type.value,
                "value": m.value,
                "timestamp": m.timestamp.isoformat(),
                "model": m.model,
                "agent_type": m.agent_type,
                "metadata": m.metadata,
            }
            for m in self.metrics
        ]

    def import_metrics(self, data: List[Dict[str, Any]]) -> None:
        """
        Import metrics from serialized format.

        Args:
            data: List of metric dictionaries
        """
        for item in data:
            metric = ProviderMetric(
                metric_type=MetricType(item["metric_type"]),
                value=item["value"],
                timestamp=datetime.fromisoformat(item["timestamp"]),
                model=item["model"],
                agent_type=item.get("agent_type"),
                metadata=item.get("metadata", {}),
            )
            self.metrics.append(metric)

            # Update stats
            provider_str = item.get("provider")
            if provider_str:
                try:
                    provider = ModelProvider(provider_str)
                    stats = self.stats[provider]

                    if item["metric_type"] == MetricType.RESPONSE_TIME:
                        stats.total_requests += 1
                        if item["metadata"].get("success", True):
                            stats.successful_requests += 1
                            stats.total_response_time += item["value"]
                        else:
                            stats.failed_requests += 1

                except ValueError:
                    pass

        self._cleanup_old_metrics()

    def _cleanup_old_metrics(self) -> None:
        """Remove metrics older than retention period."""
        cutoff = datetime.now() - timedelta(days=self.retention_days)
        self.metrics = [m for m in self.metrics if m.timestamp >= cutoff]

    def reset(self) -> None:
        """Reset all metrics and stats."""
        self.metrics.clear()
        for provider in ModelProvider:
            self.stats[provider] = ProviderStats(provider=provider)
        self.preferences.clear()


# Global memory instance
_global_memory: Optional[ProviderMemory] = None


def get_provider_memory() -> ProviderMemory:
    """Get or create the global provider memory instance."""
    global _global_memory
    if _global_memory is None:
        _global_memory = ProviderMemory()
    return _global_memory
