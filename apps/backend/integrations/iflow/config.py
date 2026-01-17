"""
iFlow Integration Configuration
===============================

Configuration for iFlow API integration.

Environment Variables:
    IFLOW_ENABLED: Set to "true" to enable iFlow integration
    IFLOW_API_KEY: API key for iFlow platform
    IFLOW_BASE_URL: Base URL for iFlow API (default: https://apis.iflow.cn/v1)
    IFLOW_LLM_MODEL: Default model to use (default: deepseek-v3)
    IFLOW_TIMEOUT: Request timeout in seconds (default: 120)
    IFLOW_MAX_RETRIES: Maximum number of retries (default: 3)
"""

import os
from dataclasses import dataclass


# Default configuration values
DEFAULT_BASE_URL = "https://apis.iflow.cn/v1"
DEFAULT_MODEL = "deepseek-v3"
DEFAULT_TIMEOUT = 120.0
DEFAULT_MAX_RETRIES = 3


# Available models and their configurations
MODEL_CONFIGS = {
    "deepseek-v3": {
        "name": "DeepSeek V3",
        "capabilities": ["general", "code", "reasoning"],
        "context_window": 128000,
        "recommended_for": ["spec_researcher", "insights", "commit_message"],
        "description": "Cost-effective for general tasks and research",
    },
    "deepseek-v3.2": {
        "name": "DeepSeek V3.2",
        "capabilities": ["general", "code", "reasoning"],
        "context_window": 128000,
        "recommended_for": ["spec_researcher", "insights"],
        "description": "Updated DeepSeek model with improved capabilities",
    },
    "kimi-k2": {
        "name": "Kimi K2 (Thinking)",
        "capabilities": ["reasoning", "planning", "analysis"],
        "context_window": 128000,
        "recommended_for": ["spec_writer", "planner", "spec_critic"],
        "description": "Strong reasoning for complex planning tasks",
    },
    "qwen3-coder": {
        "name": "Qwen3 Coder",
        "capabilities": ["code", "implementation", "debugging"],
        "context_window": 128000,
        "recommended_for": ["spec_gatherer", "coder"],
        "description": "Optimized for code generation and understanding",
    },
    "glm-4.7": {
        "name": "GLM-4.7",
        "capabilities": ["chinese", "translation", "general"],
        "context_window": 128000,
        "recommended_for": [],
        "description": "Best for Chinese language tasks",
    },
    "tbstars2-200b": {
        "name": "TBStars2-200B",
        "capabilities": ["generation", "quality", "creativity"],
        "context_window": 128000,
        "recommended_for": [],
        "description": "High-quality generation for demanding tasks",
    },
}


@dataclass
class IFlowConfig:
    """Configuration for iFlow API integration."""

    enabled: bool = False
    api_key: str = ""
    base_url: str = DEFAULT_BASE_URL
    model: str = DEFAULT_MODEL
    timeout: float = DEFAULT_TIMEOUT
    max_retries: int = DEFAULT_MAX_RETRIES

    @classmethod
    def from_env(cls) -> "IFlowConfig":
        """Create config from environment variables."""
        enabled_str = os.environ.get("IFLOW_ENABLED", "").lower()
        enabled = enabled_str in ("true", "1", "yes")

        api_key = os.environ.get("IFLOW_API_KEY", "")
        base_url = os.environ.get("IFLOW_BASE_URL", DEFAULT_BASE_URL)
        model = os.environ.get("IFLOW_LLM_MODEL", DEFAULT_MODEL)

        try:
            timeout = float(os.environ.get("IFLOW_TIMEOUT", str(DEFAULT_TIMEOUT)))
        except ValueError:
            timeout = DEFAULT_TIMEOUT

        try:
            max_retries = int(
                os.environ.get("IFLOW_MAX_RETRIES", str(DEFAULT_MAX_RETRIES))
            )
        except ValueError:
            max_retries = DEFAULT_MAX_RETRIES

        return cls(
            enabled=enabled,
            api_key=api_key,
            base_url=base_url,
            model=model,
            timeout=timeout,
            max_retries=max_retries,
        )

    def is_valid(self) -> bool:
        """Check if configuration is valid for operation."""
        return self.enabled and bool(self.api_key)

    def get_validation_errors(self) -> list[str]:
        """Get list of validation errors."""
        errors = []

        if not self.enabled:
            errors.append("IFLOW_ENABLED must be set to true")
            return errors

        if not self.api_key:
            errors.append("IFLOW_API_KEY is required")

        if self.model and self.model not in MODEL_CONFIGS:
            # Warn but don't fail - might be a new model
            pass

        return errors


def is_iflow_enabled() -> bool:
    """
    Quick check if iFlow integration is enabled.

    Returns True if:
    - IFLOW_ENABLED is set to true/1/yes
    - IFLOW_API_KEY is configured
    """
    config = IFlowConfig.from_env()
    return config.is_valid()


def get_iflow_config() -> IFlowConfig:
    """Get iFlow configuration from environment."""
    return IFlowConfig.from_env()


def get_iflow_status() -> dict:
    """
    Get the current iFlow integration status.

    Returns:
        Dict with status information
    """
    config = IFlowConfig.from_env()

    status = {
        "enabled": config.enabled,
        "available": False,
        "base_url": config.base_url,
        "default_model": config.model,
        "reason": "",
        "errors": [],
    }

    if not config.enabled:
        status["reason"] = "IFLOW_ENABLED not set to true"
        return status

    errors = config.get_validation_errors()
    if errors:
        status["errors"] = errors
        status["reason"] = errors[0] if errors else "Configuration invalid"
        return status

    status["available"] = True
    return status


def get_available_models() -> list[dict]:
    """
    Get list of available iFlow models with their configurations.

    Returns:
        List of model configuration dicts
    """
    return [{"id": model_id, **config} for model_id, config in MODEL_CONFIGS.items()]


def get_recommended_model(agent_type: str) -> str | None:
    """
    Get recommended iFlow model for a given agent type.

    Args:
        agent_type: Agent type identifier (e.g., 'spec_gatherer', 'coder')

    Returns:
        Model ID if found, None otherwise
    """
    for model_id, config in MODEL_CONFIGS.items():
        if agent_type in config.get("recommended_for", []):
            return model_id
    return None
