"""
Model Providers Package
========================

Central configuration for model providers (Anthropic, OpenRouter, Z.AI).
"""

from .config import (
    PROVIDER_CONFIGS,
    ModelProvider,
    ProviderConfig,
    get_provider_config,
    get_provider_for_model,
    infer_provider_from_url,
    resolve_model_id,
)

__all__ = [
    "ModelProvider",
    "ProviderConfig",
    "PROVIDER_CONFIGS",
    "get_provider_config",
    "resolve_model_id",
    "get_provider_for_model",
    "infer_provider_from_url",
]
