"""
iFlow Integration
=================

iFlow platform integration for Auto Claude, providing:
- Alternative AI model backend (DeepSeek, Qwen3, Kimi K2, etc.)
- MCP server with iFlow-specific tools
- OpenAI-compatible API wrapper

Configuration:
    IFLOW_ENABLED=true
    IFLOW_API_KEY=your-api-key
    IFLOW_BASE_URL=https://apis.iflow.cn/v1
    IFLOW_LLM_MODEL=deepseek-v3
"""

from .config import IFlowConfig, get_iflow_config, is_iflow_enabled

__all__ = [
    "IFlowConfig",
    "get_iflow_config",
    "is_iflow_enabled",
]
