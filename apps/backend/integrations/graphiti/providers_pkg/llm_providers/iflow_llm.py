"""
iFlow LLM Provider
==================

iFlow LLM client implementation for Graphiti.
Uses OpenAI-compatible API (https://apis.iflow.cn/v1).

Available models:
- deepseek-v3, deepseek-v3.2: General tasks, cost-effective
- kimi-k2: Complex reasoning, planning (thinking model)
- qwen3-coder: Code generation, implementation
- glm-4.7: Chinese language tasks
- tbstars2-200b: High-quality generation
"""

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from ...config import GraphitiConfig

from ..exceptions import ProviderError, ProviderNotInstalled


def create_iflow_llm_client(config: "GraphitiConfig") -> Any:
    """
    Create iFlow LLM client.

    iFlow uses OpenAI-compatible API, so we use the OpenAI client
    with custom base URL.

    Args:
        config: GraphitiConfig with iFlow settings

    Returns:
        OpenAI-compatible LLM client instance

    Raises:
        ProviderNotInstalled: If graphiti-core is not installed
        ProviderError: If API key is missing

    Example:
        >>> from integrations.graphiti.config import GraphitiConfig
        >>> config = GraphitiConfig(
        ...     iflow_api_key="your-api-key",
        ...     iflow_llm_model="deepseek-v3"
        ... )
        >>> client = create_iflow_llm_client(config)
    """
    try:
        from graphiti_core.llm_client.config import LLMConfig
        from graphiti_core.llm_client.openai_client import OpenAIClient
    except ImportError as e:
        raise ProviderNotInstalled(
            f"iFlow provider requires graphiti-core. "
            f"Install with: pip install graphiti-core\n"
            f"Error: {e}"
        )

    if not config.iflow_api_key:
        raise ProviderError("iFlow provider requires IFLOW_API_KEY")

    llm_config = LLMConfig(
        api_key=config.iflow_api_key,
        model=config.iflow_llm_model,
        base_url=config.iflow_base_url,
    )

    # iFlow uses OpenAI-compatible API
    # Disable reasoning/verbosity for compatibility
    return OpenAIClient(config=llm_config, reasoning=None, verbosity=None)
