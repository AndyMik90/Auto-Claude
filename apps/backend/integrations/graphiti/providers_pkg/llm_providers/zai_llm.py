"""
Z.AI LLM Provider
=================

Z.AI LLM client implementation for Graphiti.
Reuses OpenAI client since Z.AI provides an OpenAI-compatible API.
"""

from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from graphiti_config import GraphitiConfig

from ..exceptions import ProviderError, ProviderNotInstalled


def create_zai_llm_client(config: "GraphitiConfig") -> Any:
    """
    Create Z.AI LLM client (using OpenAI client).

    Args:
        config: GraphitiConfig with Z.AI settings

    Returns:
        OpenAI LLM client instance configured for Z.AI

    Raises:
        ProviderNotInstalled: If graphiti-core is not installed
        ProviderError: If API key is missing
    """
    if not config.zai_api_key:
        raise ProviderError("Z.AI provider requires ZAI_API_KEY")

    if not config.zai_base_url:
        raise ProviderError("Z.AI provider requires ZAI_BASE_URL")

    try:
        from graphiti_core.llm_client.config import LLMConfig
        from graphiti_core.llm_client.openai_client import OpenAIClient
    except ImportError as e:
        raise ProviderNotInstalled(
            f"Z.AI provider requires graphiti-core. "
            f"Install with: pip install graphiti-core\n"
            f"Error: {e}"
        )

    # Configure as specialized OpenAI client
    llm_config = LLMConfig(
        api_key=config.zai_api_key,
        model=config.zai_model,
        base_url=config.zai_base_url,
    )

    # Z.AI uses its own parameter names (e.g., 'thinking') and doesn't support
    # OpenAI's 'reasoning' or 'verbosity' parameters - disable them for compatibility
    return OpenAIClient(config=llm_config, reasoning=None, verbosity=None)
