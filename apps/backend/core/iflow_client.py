"""
iFlow Client Configuration
==========================

Functions for creating and configuring iFlow API clients.

iFlow provides OpenAI-compatible API endpoints for various models:
- DeepSeek v3/v3.2: General tasks, cost-effective
- Kimi K2: Complex reasoning, planning (thinking model)
- Qwen3 Coder: Code generation, implementation
- GLM-4.7: Chinese language tasks
- TBStars2-200B: High-quality generation

All iFlow models are accessed via https://apis.iflow.cn/v1 (OpenAI-compatible).

Usage:
    from core.iflow_client import create_iflow_chat_client, is_iflow_enabled

    if is_iflow_enabled():
        client = create_iflow_chat_client()
        response = client.chat.completions.create(
            model="deepseek-v3",
            messages=[{"role": "user", "content": "Hello"}]
        )
"""

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Default iFlow configuration
DEFAULT_IFLOW_BASE_URL = "https://apis.iflow.cn/v1"
DEFAULT_IFLOW_MODEL = "deepseek-v3"

# Models known to have issues with tool calling
# These will automatically fallback to TOOL_FALLBACK_MODEL
MODELS_WITHOUT_TOOL_SUPPORT = {
    "kimi-k2",      # Has issues with tool_call_id
    "qwen3-max",    # Inconsistent tool support
    "glm-4.6",      # No tool support
    "glm-4.7",      # No tool support
}

# Models that have unreliable tool support (sometimes work, sometimes don't)
# These will get extra warnings but not automatic fallback
MODELS_WITH_UNRELIABLE_TOOLS = {
    "deepseek-v3.2",  # Sometimes returns empty tool arguments
}

# Fallback model when selected model doesn't support tools
TOOL_FALLBACK_MODEL = "deepseek-v3"

# Fallback chain for rate limits - try these models in order when current model hits rate limits
# After 2 rate limit retries, automatically switch to next model in chain
# NOTE: Only include models that are actually supported by iFlow API
RATE_LIMIT_FALLBACK_CHAIN = [
    "deepseek-v3",
    "qwen3-coder-plus",  # Works well with tools (verified in testing)
    # "qwen3-coder" removed - iFlow returns 435 "Model not support" error
    # "glm-4.7" removed - iFlow returns "Model not support" error
    # "deepseek-v3.2" removed - unreliable tool arguments
]

# Number of rate limit retries before switching to fallback model
RATE_LIMIT_RETRIES_BEFORE_FALLBACK = 2

# Model-specific configurations
IFLOW_MODEL_CONFIGS = {
    "deepseek-v3": {
        "name": "DeepSeek V3",
        "capabilities": ["general", "code", "reasoning"],
        "context_window": 128000,
        "recommended_for": ["spec_researcher", "insights", "commit_message"],
    },
    "deepseek-v3.2": {
        "name": "DeepSeek V3.2",
        "capabilities": ["general", "code", "reasoning"],
        "context_window": 128000,
        "recommended_for": ["spec_researcher", "insights"],
    },
    "kimi-k2": {
        "name": "Kimi K2 (Thinking)",
        "capabilities": ["reasoning", "planning", "analysis"],
        "context_window": 128000,
        "recommended_for": ["spec_writer", "planner", "spec_critic"],
    },
    "qwen3-coder": {
        "name": "Qwen3 Coder",
        "capabilities": ["code", "implementation", "debugging"],
        "context_window": 128000,
        "recommended_for": ["spec_gatherer", "coder"],
    },
    "glm-4.7": {
        "name": "GLM-4.7",
        "capabilities": ["chinese", "translation", "general"],
        "context_window": 128000,
        "recommended_for": [],
    },
    "tbstars2-200b": {
        "name": "TBStars2-200B",
        "capabilities": ["generation", "quality", "creativity"],
        "context_window": 128000,
        "recommended_for": [],
    },
}


def filter_thinking_content(text: str) -> str:
    """
    Filter out thinking content from model responses.

    Some models (e.g., qwen3-*-thinking, kimi-k2) output their internal reasoning
    process wrapped in <think>...</think> tags. This function removes that content
    to provide cleaner output to the user.

    Args:
        text: Raw model response text

    Returns:
        Text with thinking content removed
    """
    import re

    if not text:
        return text

    # Remove <think>...</think> blocks (including multiline)
    # Handle various tag formats: <think>, </think>, <thinking>, </thinking>
    filtered = re.sub(r'<think(?:ing)?[^>]*>.*?</think(?:ing)?>', '', text, flags=re.DOTALL | re.IGNORECASE)

    # Also remove orphaned closing tags (in case thinking wasn't properly closed)
    filtered = re.sub(r'</think(?:ing)?>', '', filtered, flags=re.IGNORECASE)

    # Clean up excessive whitespace that may remain
    filtered = re.sub(r'\n{3,}', '\n\n', filtered)
    filtered = filtered.strip()

    # Log if content was filtered
    if len(filtered) < len(text) * 0.5:  # More than 50% was thinking
        logger.debug(f"[iFlow] Filtered thinking content: {len(text)} -> {len(filtered)} chars")

    return filtered


@dataclass
class IFlowConfig:
    """Configuration for iFlow API client."""

    api_key: str
    base_url: str = DEFAULT_IFLOW_BASE_URL
    default_model: str = DEFAULT_IFLOW_MODEL
    timeout: float = 120.0
    max_retries: int = 3

    @classmethod
    def from_env(cls) -> "IFlowConfig":
        """Create config from environment variables."""
        api_key = os.environ.get("IFLOW_API_KEY", "")
        base_url = os.environ.get("IFLOW_BASE_URL", DEFAULT_IFLOW_BASE_URL)
        default_model = os.environ.get("IFLOW_LLM_MODEL", DEFAULT_IFLOW_MODEL)

        try:
            timeout = float(os.environ.get("IFLOW_TIMEOUT", "120"))
        except ValueError:
            timeout = 120.0

        try:
            max_retries = int(os.environ.get("IFLOW_MAX_RETRIES", "3"))
        except ValueError:
            max_retries = 3

        return cls(
            api_key=api_key,
            base_url=base_url,
            default_model=default_model,
            timeout=timeout,
            max_retries=max_retries,
        )

    def is_valid(self) -> bool:
        """Check if configuration is valid."""
        return bool(self.api_key)


def is_iflow_enabled() -> bool:
    """
    Check if iFlow integration is enabled.

    Returns True if IFLOW_ENABLED is set to 'true' and API key is configured.
    """
    enabled = os.environ.get("IFLOW_ENABLED", "").lower() in ("true", "1", "yes")
    if not enabled:
        return False

    config = IFlowConfig.from_env()
    return config.is_valid()


def get_iflow_status() -> dict:
    """
    Get the current iFlow integration status.

    Returns:
        Dict with status information:
            - enabled: bool
            - available: bool (has valid API key)
            - base_url: str
            - default_model: str
            - reason: str (why unavailable if not available)
    """
    config = IFlowConfig.from_env()
    enabled = os.environ.get("IFLOW_ENABLED", "").lower() in ("true", "1", "yes")

    status = {
        "enabled": enabled,
        "available": False,
        "base_url": config.base_url,
        "default_model": config.default_model,
        "reason": "",
    }

    if not enabled:
        status["reason"] = "IFLOW_ENABLED not set to true"
        return status

    if not config.api_key:
        status["reason"] = "IFLOW_API_KEY not configured"
        return status

    status["available"] = True
    return status


def get_available_iflow_models() -> list[dict]:
    """
    Get list of available iFlow models with their configurations.

    Returns:
        List of model configuration dicts
    """
    return [
        {"id": model_id, **config} for model_id, config in IFLOW_MODEL_CONFIGS.items()
    ]


def get_recommended_model(agent_type: str) -> str | None:
    """
    Get recommended iFlow model for a given agent type.

    Args:
        agent_type: Agent type identifier (e.g., 'spec_gatherer', 'coder')

    Returns:
        Model ID if found, None otherwise
    """
    for model_id, config in IFLOW_MODEL_CONFIGS.items():
        if agent_type in config.get("recommended_for", []):
            return model_id
    return None


def create_iflow_chat_client(
    config: IFlowConfig | None = None,
) -> Any:
    """
    Create an OpenAI-compatible client for iFlow API.

    Args:
        config: Optional IFlowConfig. If not provided, loads from environment.

    Returns:
        OpenAI client configured for iFlow API

    Raises:
        ImportError: If openai package is not installed
        ValueError: If API key is not configured

    Example:
        >>> client = create_iflow_chat_client()
        >>> response = client.chat.completions.create(
        ...     model="deepseek-v3",
        ...     messages=[{"role": "user", "content": "Hello"}]
        ... )
    """
    try:
        from openai import OpenAI
    except ImportError as e:
        raise ImportError(
            "iFlow client requires the openai package. "
            "Install with: pip install openai"
        ) from e

    if config is None:
        config = IFlowConfig.from_env()

    if not config.api_key:
        raise ValueError(
            "iFlow API key not configured. Set IFLOW_API_KEY environment variable."
        )

    logger.info(
        f"Creating iFlow client for {config.base_url} (model: {config.default_model})"
    )

    return OpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
        timeout=config.timeout,
        max_retries=config.max_retries,
    )


def create_iflow_completion(
    messages: list[dict[str, str]],
    model: str | None = None,
    config: IFlowConfig | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
    stream: bool = False,
    **kwargs,
) -> Any:
    """
    Create a chat completion using iFlow API.

    This is a convenience function for simple completions.

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model to use (defaults to config.default_model)
        config: Optional IFlowConfig
        temperature: Sampling temperature (0-2)
        max_tokens: Maximum tokens in response
        stream: Whether to stream the response
        **kwargs: Additional parameters passed to the API

    Returns:
        ChatCompletion response or stream iterator

    Example:
        >>> response = create_iflow_completion(
        ...     messages=[{"role": "user", "content": "Explain Python decorators"}],
        ...     model="qwen3-coder"
        ... )
        >>> print(response.choices[0].message.content)
    """
    if config is None:
        config = IFlowConfig.from_env()

    if model is None:
        model = config.default_model

    client = create_iflow_chat_client(config)

    completion_kwargs = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "stream": stream,
        **kwargs,
    }

    if max_tokens is not None:
        completion_kwargs["max_tokens"] = max_tokens

    return client.chat.completions.create(**completion_kwargs)


def create_iflow_simple_client(
    model: str | None = None,
    system_prompt: str | None = None,
) -> "IFlowSimpleClient":
    """
    Create a simple iFlow client wrapper for easy message-based interactions.

    Args:
        model: Model to use (defaults to environment config)
        system_prompt: Optional system prompt to prepend to all conversations

    Returns:
        IFlowSimpleClient instance

    Example:
        >>> client = create_iflow_simple_client(model="deepseek-v3")
        >>> response = client.send("What is Python?")
        >>> print(response)
    """
    config = IFlowConfig.from_env()
    if model is None:
        model = config.default_model

    return IFlowSimpleClient(config=config, model=model, system_prompt=system_prompt)


def create_iflow_agent_client(
    project_dir: Path,
    spec_dir: Path,
    model: str | None = None,
    agent_type: str = "coder",
    system_prompt: str | None = None,
    enable_tools: bool = True,
    max_turns: int = 100,
) -> "IFlowAgentClient":
    """
    Create an iFlow agent client for use with agents.

    This is the main entry point for creating iFlow-based agent sessions.
    Use this instead of create_client() when iFlow provider is selected.

    NOW SUPPORTS TOOL CALLING:
    - Read, Write, Edit, Bash, Glob, Grep tools
    - Full agent loop with automatic tool execution
    - Compatible with coder, qa_reviewer, and other tool-using agents

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the spec
        model: iFlow model to use (defaults to recommended model for agent type)
        agent_type: Agent type identifier (for model recommendation)
        system_prompt: System prompt for the agent
        enable_tools: Whether to enable tool calling (default: True)
        max_turns: Maximum number of agent turns (default: 100)

    Returns:
        IFlowAgentClient instance

    Raises:
        ValueError: If iFlow is not enabled or configured

    Example:
        >>> client = create_iflow_agent_client(
        ...     project_dir=Path("/project"),
        ...     spec_dir=Path("/project/.auto-claude/specs/001"),
        ...     agent_type="coder"
        ... )
        >>> async with client:
        ...     await client.query("Implement the feature")
        ...     async for msg in client.receive_response():
        ...         print(msg)
    """
    if not is_iflow_enabled():
        status = get_iflow_status()
        raise ValueError(f"iFlow is not available: {status.get('reason', 'Unknown')}")

    config = IFlowConfig.from_env()

    # Determine model to use
    if model is None:
        # Try to get recommended model for this agent type
        recommended = get_recommended_model(agent_type)
        model = recommended if recommended else config.default_model

    # Build default system prompt if not provided
    if system_prompt is None:
        tools_info = ""
        if enable_tools:
            tools_info = (
                "\n\nYou have access to the following tools:\n"
                "- Read: Read file contents\n"
                "- Write: Create or overwrite files\n"
                "- Edit: Find and replace in files\n"
                "- Bash: Execute shell commands\n"
                "- Glob: Find files by pattern\n"
                "- Grep: Search file contents\n\n"
                "Use these tools to complete your tasks. Call tools when needed - "
                "the system will execute them and return results.\n"
            )

        system_prompt = (
            f"You are an expert full-stack developer building production-quality software.\n"
            f"Your working directory is: {project_dir.resolve()}\n"
            f"Your spec directory is: {spec_dir.resolve()}\n"
            f"{tools_info}\n"
            f"You follow existing code patterns, write clean maintainable code, and verify "
            f"your work through thorough testing."
        )

    # Check if model supports tool calling - if not, fallback to a model that does
    original_model = None
    if enable_tools and model in MODELS_WITHOUT_TOOL_SUPPORT:
        original_model = model
        model = TOOL_FALLBACK_MODEL
        logger.warning(
            f"[iFlow] Model '{original_model}' doesn't support tool calling. "
            f"Automatically switching to '{model}' for this phase."
        )

    logger.info(
        f"[iFlow] Creating agent client: model={model}, agent_type={agent_type}, tools={enable_tools}"
        + (f" (fallback from {original_model})" if original_model else "")
    )

    return IFlowAgentClient(
        config=config,
        model=model,
        system_prompt=system_prompt,
        project_dir=project_dir,
        spec_dir=spec_dir,
        enable_tools=enable_tools,
        max_turns=max_turns,
        original_model=original_model,  # Track if there was a fallback
    )


@dataclass
class TextBlock:
    """TextBlock for iFlow responses (matches Claude SDK TextBlock type name)."""
    text: str


@dataclass
class AssistantMessage:
    """AssistantMessage for iFlow responses (matches Claude SDK AssistantMessage type name)."""
    content: list


@dataclass
class ToolUseBlock:
    """ToolUseBlock for iFlow responses (matches Claude SDK ToolUseBlock type name)."""
    id: str
    name: str
    input: dict


@dataclass
class ToolResultBlock:
    """ToolResultBlock for iFlow responses (matches Claude SDK ToolResultBlock type name)."""
    tool_use_id: str
    content: str
    is_error: bool = False


@dataclass
class UserMessage:
    """UserMessage for iFlow responses (matches Claude SDK UserMessage type name)."""
    content: list


class IFlowAgentClient:
    """
    iFlow agent client that mimics ClaudeSDKClient interface.

    This provides compatibility for agents that need to switch between
    Claude SDK and iFlow backends.

    NOW SUPPORTS TOOL CALLING for:
    - coder (Read, Write, Edit, Bash, Glob, Grep)
    - qa_reviewer, qa_fixer (with tool support)
    - spec_gatherer, spec_researcher, spec_writer

    The client implements a full agent loop with tool calling:
    1. Send prompt to model with tool definitions
    2. If model requests tool calls, execute them locally
    3. Send tool results back to model
    4. Repeat until model completes or max_turns reached

    For agents that don't need tools, heredoc file extraction is still available
    as a fallback.
    """

    def __init__(
        self,
        config: IFlowConfig,
        model: str,
        system_prompt: str,
        project_dir: Path | None = None,
        spec_dir: Path | None = None,
        enable_tools: bool = True,
        max_turns: int = 100,
        original_model: str | None = None,  # Original model if fallback occurred
    ):
        self.config = config
        self.model = model
        self.system_prompt = system_prompt
        self.project_dir = project_dir
        self.spec_dir = spec_dir
        self.enable_tools = enable_tools
        self.max_turns = max_turns
        self.original_model = original_model  # Tracks model fallback for UI display
        self._client = None
        self._conversation_history: list[dict] = []
        self._pending_query: str | None = None
        self._last_response: str | None = None
        self._tool_context = None
        self._current_turn = 0
        self._fallback_message_sent = False  # Track if we've sent the fallback notification
        self._unreliable_model_warned = False  # Track if we've warned about unreliable model
        self._consecutive_tool_errors = 0  # Track consecutive tool call errors
        self._max_consecutive_errors = 10  # Break out after this many consecutive errors
        self._total_tokens_used = 0  # Track cumulative token usage
        self._max_total_tokens = 500000  # Stop if we exceed this (500k tokens)

    @property
    def client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            self._client = create_iflow_chat_client(self.config)
        return self._client

    def _get_tool_context(self):
        """Get or create tool execution context."""
        if self._tool_context is None and self.project_dir and self.spec_dir:
            from core.iflow_tools import ToolContext
            self._tool_context = ToolContext(
                project_dir=self.project_dir,
                spec_dir=self.spec_dir,
            )
        return self._tool_context

    async def __aenter__(self):
        """Async context manager entry."""
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb):
        """Async context manager exit."""
        # No cleanup needed for iFlow client
        return False

    async def query(self, prompt: str):
        """
        Queue a query to be processed (mimics ClaudeSDKClient.query).

        Args:
            prompt: The prompt/message to send to iFlow
        """
        self._pending_query = prompt
        self._current_turn = 0
        self._consecutive_tool_errors = 0  # Reset error counter for new query
        self._total_tokens_used = 0  # Reset token counter for new query

    async def receive_response(self):
        """
        Async generator that yields response messages (mimics ClaudeSDKClient.receive_response).

        Implements a full agent loop with tool calling:
        1. Send prompt to model with tool definitions
        2. If model requests tool calls, execute them locally
        3. Send tool results back to model
        4. Repeat until model completes or max_turns reached

        Yields:
            AssistantMessage objects containing TextBlock/ToolUseBlock
            UserMessage objects containing ToolResultBlock (for tool results)
        """
        if not self._pending_query:
            return

        # Import tools
        from core.iflow_tools import TOOL_SCHEMAS, execute_tool, format_tool_result

        messages = []

        # Add system prompt
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})

        # Add conversation history
        messages.extend(self._conversation_history)

        # Add user message
        messages.append({"role": "user", "content": self._pending_query})

        # Store initial user message for history
        initial_user_message = self._pending_query

        try:
            logger.info(f"[iFlow] Starting agent loop with {self.model} (tools={'enabled' if self.enable_tools else 'disabled'})...")

            # Emit fallback notification for UI if model was switched
            if self.original_model and not self._fallback_message_sent:
                self._fallback_message_sent = True
                fallback_msg = (
                    f"⚠️ Model '{self.original_model}' doesn't support tool calling. "
                    f"Automatically switched to '{self.model}' for this phase."
                )
                logger.warning(f"[iFlow] {fallback_msg}")
                yield AssistantMessage(content=[TextBlock(text=f"[{fallback_msg}]")])

            # Warn about unreliable models
            if self.model in MODELS_WITH_UNRELIABLE_TOOLS and not self._unreliable_model_warned:
                self._unreliable_model_warned = True
                warn_msg = (
                    f"⚠️ Model '{self.model}' has unreliable tool support. "
                    f"If tool calls fail repeatedly, consider using 'deepseek-v3' instead."
                )
                logger.warning(f"[iFlow] {warn_msg}")
                yield AssistantMessage(content=[TextBlock(text=f"[{warn_msg}]")])

            while self._current_turn < self.max_turns:
                self._current_turn += 1
                logger.info(f"[iFlow] Turn {self._current_turn}/{self.max_turns}")

                # Truncate messages to avoid token explosion
                # Reduced from 30 to 15 messages for better token control
                truncated_messages = self._truncate_messages(messages, max_messages=15)

                # Estimate and log token usage for this request
                estimated_chars = sum(len(str(m.get("content", ""))) for m in truncated_messages)
                estimated_tokens = estimated_chars // 4  # Rough estimate: 4 chars per token
                logger.info(
                    f"[iFlow] Request estimate: {len(truncated_messages)} messages, "
                    f"~{estimated_chars} chars, ~{estimated_tokens} tokens"
                )

                # Build request kwargs
                request_kwargs = {
                    "model": self.model,
                    "messages": truncated_messages,
                    "temperature": 0.7,
                }

                # Add tools if enabled
                if self.enable_tools:
                    request_kwargs["tools"] = TOOL_SCHEMAS
                    request_kwargs["tool_choice"] = "auto"

                # Make API call (non-streaming for tool support)
                response = self.client.chat.completions.create(**request_kwargs)

                # Log token usage if available and track cumulative
                if hasattr(response, 'usage') and response.usage:
                    usage = response.usage
                    self._total_tokens_used += usage.total_tokens
                    logger.info(
                        f"[iFlow] Token usage - prompt: {usage.prompt_tokens}, "
                        f"completion: {usage.completion_tokens}, "
                        f"total: {usage.total_tokens}, "
                        f"cumulative: {self._total_tokens_used}"
                    )

                    # Emit token usage to UI every 5 turns or on significant usage
                    if self._current_turn % 5 == 0 or usage.total_tokens > 10000:
                        token_msg = (
                            f"📊 [{self.model}] Turn {self._current_turn}: "
                            f"+{usage.total_tokens:,} tokens "
                            f"(total: {self._total_tokens_used:,})"
                        )
                        yield AssistantMessage(content=[TextBlock(text=f"[{token_msg}]")])

                    # Check if we've exceeded token budget
                    if self._total_tokens_used > self._max_total_tokens:
                        error_msg = (
                            f"\n\n[Agent stopped: exceeded token budget "
                            f"({self._total_tokens_used:,} tokens used, limit: {self._max_total_tokens:,}). "
                            f"The task may be too complex or the model is inefficient.]"
                        )
                        logger.error(f"[iFlow] {error_msg}")
                        yield AssistantMessage(content=[TextBlock(text=error_msg)])
                        self._pending_query = None
                        return

                # Check for errors
                if hasattr(response, 'status') and response.status:
                    status_code = str(response.status)
                    error_msg = getattr(response, 'msg', 'Unknown error')
                    if status_code not in ('200', 'None', ''):
                        # Log full error details for debugging
                        logger.warning(
                            f"[iFlow] API error - status: {status_code}, msg: {error_msg}, "
                            f"full response: {response}"
                        )

                        # Handle rate limit with retry and auto-fallback to different model
                        # Note: iFlow uses 429 for "Concurrency limit reached" and 449 for other rate limits
                        if status_code in ('429', '449') or 'rate limit' in str(error_msg).lower() or 'throttling' in str(error_msg).lower():
                            import time

                            # Track rate limit retries
                            if not hasattr(self, '_rate_limit_retries'):
                                self._rate_limit_retries = 0
                            if not hasattr(self, '_tried_models'):
                                self._tried_models = {self.model}
                            self._rate_limit_retries += 1

                            # After RATE_LIMIT_RETRIES_BEFORE_FALLBACK retries, try switching to a different model
                            if self._rate_limit_retries >= RATE_LIMIT_RETRIES_BEFORE_FALLBACK:
                                # Find next available model in fallback chain
                                fallback_model = None
                                for candidate in RATE_LIMIT_FALLBACK_CHAIN:
                                    if candidate not in self._tried_models:
                                        fallback_model = candidate
                                        break

                                if fallback_model:
                                    old_model = self.model
                                    self.model = fallback_model
                                    self._tried_models.add(fallback_model)
                                    self._rate_limit_retries = 0  # Reset counter for new model

                                    fallback_msg = (
                                        f"🔄 Model '{old_model}' hit rate limit. "
                                        f"Automatically switching to '{fallback_model}'."
                                    )
                                    logger.warning(f"[iFlow] {fallback_msg}")
                                    yield AssistantMessage(content=[TextBlock(text=f"[{fallback_msg}]")])

                                    # Check if new model needs tool fallback
                                    if self.enable_tools and fallback_model in MODELS_WITHOUT_TOOL_SUPPORT:
                                        self.enable_tools = False
                                        logger.warning(f"[iFlow] Fallback model '{fallback_model}' doesn't support tools, disabling.")
                                        yield AssistantMessage(content=[
                                            TextBlock(text=f"[Note: '{fallback_model}' doesn't support tools, using heredoc mode]")
                                        ])

                                    self._current_turn -= 1
                                    continue  # Retry with new model

                            MAX_RATE_LIMIT_RETRIES = 5
                            if self._rate_limit_retries > MAX_RATE_LIMIT_RETRIES:
                                error_text = (
                                    f"Rate limit exceeded after trying {len(self._tried_models)} model(s). "
                                    f"All available models are overloaded. Please try again later."
                                )
                                logger.error(f"[iFlow] {error_text}")
                                yield AssistantMessage(content=[TextBlock(text=error_text)])
                                break

                            retry_delay = 30 * self._rate_limit_retries  # Exponential backoff
                            logger.warning(
                                f"[iFlow] Rate limit hit (attempt {self._rate_limit_retries}/{RATE_LIMIT_RETRIES_BEFORE_FALLBACK} before model switch), "
                                f"waiting {retry_delay}s before retry..."
                            )
                            yield AssistantMessage(content=[
                                TextBlock(text=f"[Rate limit hit ({self._rate_limit_retries}/{RATE_LIMIT_RETRIES_BEFORE_FALLBACK}), waiting {retry_delay}s... Will switch model if persists]")
                            ])
                            time.sleep(retry_delay)
                            self._current_turn -= 1  # Don't count this as a turn
                            continue  # Retry the same request

                        # Handle 5xx server errors with retry
                        if status_code and status_code.startswith('5'):
                            import time

                            # Track server error retries
                            if not hasattr(self, '_server_error_retries'):
                                self._server_error_retries = 0
                            self._server_error_retries += 1

                            MAX_SERVER_ERROR_RETRIES = 3
                            if self._server_error_retries > MAX_SERVER_ERROR_RETRIES:
                                error_text = (
                                    f"⚠️ iFlow server error (code {status_code}) after {MAX_SERVER_ERROR_RETRIES} retries. "
                                    f"Model '{self.model}' may be unavailable or unstable. "
                                    f"Try a different model like 'deepseek-v3'."
                                )
                                logger.error(f"[iFlow] {error_text}")
                                yield AssistantMessage(content=[TextBlock(text=error_text)])
                                break

                            retry_delay = 10 * self._server_error_retries  # 10s, 20s, 30s
                            logger.warning(
                                f"[iFlow] Server error {status_code} (attempt {self._server_error_retries}/{MAX_SERVER_ERROR_RETRIES}), "
                                f"waiting {retry_delay}s before retry..."
                            )
                            yield AssistantMessage(content=[
                                TextBlock(text=f"[⚠️ iFlow server error {status_code} ({self._server_error_retries}/{MAX_SERVER_ERROR_RETRIES}), retrying in {retry_delay}s...]")
                            ])
                            time.sleep(retry_delay)
                            self._current_turn -= 1  # Don't count this as a turn
                            continue  # Retry the same request

                        # Handle 435 "Model not support" - immediately switch to next model
                        if status_code == '435' or 'not support' in str(error_msg).lower():
                            if not hasattr(self, '_tried_models'):
                                self._tried_models = {self.model}
                            self._tried_models.add(self.model)

                            # Find next available model in fallback chain
                            fallback_model = None
                            for candidate in RATE_LIMIT_FALLBACK_CHAIN:
                                if candidate not in self._tried_models:
                                    fallback_model = candidate
                                    break

                            if fallback_model:
                                old_model = self.model
                                self.model = fallback_model
                                self._tried_models.add(fallback_model)

                                fallback_msg = (
                                    f"⚠️ Model '{old_model}' not supported (error 435). "
                                    f"Switching to '{fallback_model}'."
                                )
                                logger.warning(f"[iFlow] {fallback_msg}")
                                yield AssistantMessage(content=[TextBlock(text=f"[{fallback_msg}]")])

                                # Check if new model needs tool fallback
                                if self.enable_tools and fallback_model in MODELS_WITHOUT_TOOL_SUPPORT:
                                    self.enable_tools = False
                                    logger.warning(f"[iFlow] Fallback model '{fallback_model}' doesn't support tools.")
                                    yield AssistantMessage(content=[
                                        TextBlock(text=f"[Note: '{fallback_model}' doesn't support tools, using heredoc mode]")
                                    ])

                                self._current_turn -= 1
                                continue  # Retry with new model

                            # No more fallback models available
                            error_text = (
                                f"Model '{self.model}' not supported and no fallback models available. "
                                f"Tried models: {', '.join(self._tried_models)}"
                            )
                            logger.error(f"[iFlow] {error_text}")
                            yield AssistantMessage(content=[TextBlock(text=error_text)])
                            break

                        error_text = f"iFlow API Error (status {status_code}): {error_msg}"
                        logger.error(f"[iFlow] {error_text}")
                        yield AssistantMessage(content=[TextBlock(text=error_text)])
                        break

                # Get the response message
                choice = response.choices[0] if response.choices else None
                if not choice:
                    logger.error("[iFlow] No response from model")
                    yield AssistantMessage(content=[TextBlock(text="Error: No response from model")])
                    break

                # Reset error counters on successful response
                if hasattr(self, '_rate_limit_retries'):
                    self._rate_limit_retries = 0
                if hasattr(self, '_server_error_retries'):
                    self._server_error_retries = 0

                message = choice.message
                finish_reason = choice.finish_reason

                # Collect content blocks for AssistantMessage
                content_blocks = []

                # Handle text content
                if message.content:
                    # Filter out thinking content from "thinking" models
                    filtered_content = filter_thinking_content(message.content)
                    if filtered_content:  # Only yield if there's content after filtering
                        content_blocks.append(TextBlock(text=filtered_content))
                        # Yield text incrementally (simulate streaming)
                        yield AssistantMessage(content=[TextBlock(text=filtered_content)])

                # Handle tool calls
                tool_calls = getattr(message, 'tool_calls', None)

                if tool_calls:
                    logger.info(f"[iFlow] Model requested {len(tool_calls)} tool call(s)")

                    # Process each tool call
                    tool_results = []

                    for tool_call in tool_calls:
                        tool_name = tool_call.function.name
                        tool_id = tool_call.id

                        # Parse arguments - handle both string and dict formats
                        # iFlow models sometimes return malformed arguments:
                        # - Raw strings instead of JSON objects
                        # - Double-encoded JSON strings
                        # - JSON that decodes to non-dict types
                        # - Empty strings or null values
                        try:
                            import json
                            raw_args = tool_call.function.arguments

                            # Debug logging for tool arguments
                            logger.debug(
                                f"[iFlow] Tool '{tool_name}' raw_args: "
                                f"type={type(raw_args).__name__}, "
                                f"value={repr(raw_args)[:200] if raw_args else '<empty>'}"
                            )

                            if isinstance(raw_args, str):
                                parsed = json.loads(raw_args) if raw_args else {}
                                # Handle double-encoded JSON (string that parses to another string)
                                if isinstance(parsed, str):
                                    try:
                                        parsed = json.loads(parsed)
                                    except (json.JSONDecodeError, TypeError):
                                        # If still a string, try to extract key-value pairs
                                        logger.warning(f"[iFlow] Tool args decoded to string, not dict: {parsed[:100]}")
                                        parsed = {}
                                # Ensure result is a dict
                                tool_args = parsed if isinstance(parsed, dict) else {}
                            elif isinstance(raw_args, dict):
                                tool_args = raw_args
                            else:
                                tool_args = {}
                        except (json.JSONDecodeError, TypeError) as e:
                            logger.warning(f"[iFlow] Failed to parse tool arguments: {e}")
                            tool_args = {}

                        logger.info(f"[iFlow] Executing tool: {tool_name}")

                        # Yield ToolUseBlock to show tool is being called
                        tool_use_block = ToolUseBlock(
                            id=tool_id,
                            name=tool_name,
                            input=tool_args
                        )
                        yield AssistantMessage(content=[tool_use_block])

                        # Execute the tool
                        tool_context = self._get_tool_context()
                        if tool_context:
                            result = execute_tool(tool_name, tool_args, tool_context)
                            result_text = format_tool_result(tool_name, result)
                            is_error = not result.get("success", False)
                        else:
                            result_text = "Error: Tool context not available (no project_dir or spec_dir)"
                            is_error = True

                        # Track consecutive errors to break out of error loops
                        if is_error:
                            self._consecutive_tool_errors += 1

                            # For unreliable models, switch to fallback after 5 errors
                            if (self.model in MODELS_WITH_UNRELIABLE_TOOLS and
                                self._consecutive_tool_errors >= 5 and
                                self.model != TOOL_FALLBACK_MODEL):
                                old_model = self.model
                                self.model = TOOL_FALLBACK_MODEL
                                self._consecutive_tool_errors = 0  # Reset for new model
                                switch_msg = (
                                    f"🔄 Model '{old_model}' had 5 consecutive tool errors. "
                                    f"Switching to '{self.model}' for better reliability."
                                )
                                logger.warning(f"[iFlow] {switch_msg}")
                                yield AssistantMessage(content=[TextBlock(text=f"[{switch_msg}]")])
                                # Don't return, continue with new model

                            elif self._consecutive_tool_errors >= self._max_consecutive_errors:
                                token_info = f" ({self._total_tokens_used:,} tokens used)" if self._total_tokens_used > 0 else ""
                                error_msg = (
                                    f"\n\n[Agent stopped: {self._consecutive_tool_errors} consecutive tool call errors{token_info}. "
                                    f"The model may not be properly using the tool interface. "
                                    f"Last error: {result_text[:200]}]"
                                )
                                logger.error(f"[iFlow] Stopping due to consecutive errors: {error_msg}")
                                yield AssistantMessage(content=[TextBlock(text=error_msg)])
                                self._pending_query = None
                                return
                        else:
                            # Reset counter on successful tool call
                            self._consecutive_tool_errors = 0

                        # Yield tool result
                        tool_result_block = ToolResultBlock(
                            tool_use_id=tool_id,
                            content=result_text,
                            is_error=is_error
                        )
                        yield UserMessage(content=[tool_result_block])

                        # Truncate tool result to avoid token explosion
                        # Max 8000 chars per tool result (~2000 tokens)
                        MAX_TOOL_RESULT_CHARS = 8000
                        truncated_result = result_text
                        if len(result_text) > MAX_TOOL_RESULT_CHARS:
                            truncated_result = (
                                result_text[:MAX_TOOL_RESULT_CHARS] +
                                f"\n\n[... truncated, {len(result_text) - MAX_TOOL_RESULT_CHARS} more chars ...]"
                            )
                            logger.info(
                                f"[iFlow] Truncated tool result: {len(result_text)} -> {len(truncated_result)} chars"
                            )

                        # Store result for next API call
                        tool_results.append({
                            "tool_call_id": tool_id,
                            "role": "tool",
                            "content": truncated_result,
                        })

                    # Add assistant message with tool calls to history
                    assistant_msg = {"role": "assistant", "content": message.content or ""}
                    assistant_msg["tool_calls"] = [
                        {
                            "id": tc.id,
                            "type": "function",
                            "function": {
                                "name": tc.function.name,
                                "arguments": tc.function.arguments,
                            }
                        }
                        for tc in tool_calls
                    ]
                    messages.append(assistant_msg)

                    # Add tool results to messages
                    for tr in tool_results:
                        messages.append(tr)

                    # Continue the loop to get model's response to tool results
                    continue

                else:
                    # No tool calls - model is done
                    logger.info(f"[iFlow] Agent completed (finish_reason: {finish_reason})")

                    # Update conversation history with final exchange
                    self._conversation_history.append(
                        {"role": "user", "content": initial_user_message}
                    )
                    self._conversation_history.append(
                        {"role": "assistant", "content": message.content or ""}
                    )

                    # Filter thinking content for display and file extraction
                    filtered_response = filter_thinking_content(message.content) if message.content else ""
                    self._last_response = filtered_response
                    self._pending_query = None

                    # Post-process: Extract and write files from heredoc patterns
                    # (fallback for models that don't use tools properly)
                    if filtered_response:
                        files_written = self._extract_and_write_files(filtered_response)
                        if files_written:
                            logger.info(f"[iFlow] Auto-created files from response: {files_written}")

                    # Emit final token usage summary
                    if self._total_tokens_used > 0:
                        summary_msg = (
                            f"✅ [{self.model}] Session complete: {self._current_turn} turns, "
                            f"{self._total_tokens_used:,} tokens used"
                        )
                        yield AssistantMessage(content=[TextBlock(text=f"[{summary_msg}]")])

                    break

            else:
                # Max turns reached
                logger.warning(f"[iFlow] Max turns ({self.max_turns}) reached")

                # Emit token usage with max turns warning
                token_info = ""
                if self._total_tokens_used > 0:
                    token_info = f" ({self._total_tokens_used:,} tokens used)"

                yield AssistantMessage(
                    content=[TextBlock(text=f"\n\n[Agent stopped: max turns ({self.max_turns}) reached{token_info}]")]
                )
                self._pending_query = None

        except Exception as e:
            error_str = str(e)
            logger.error(f"[iFlow] Agent loop failed: {e}", exc_info=True)

            # Check for rate limit error in exception
            is_rate_limit = (
                'rate' in error_str.lower() and 'limit' in error_str.lower() or
                'throttling' in error_str.lower() or
                'concurrency' in error_str.lower() or
                '429' in error_str or
                '449' in error_str or
                'RateLimitError' in type(e).__name__
            )

            if is_rate_limit:
                import time

                # Track rate limit retries and tried models
                if not hasattr(self, '_rate_limit_retries'):
                    self._rate_limit_retries = 0
                if not hasattr(self, '_tried_models'):
                    self._tried_models = {self.model}
                self._rate_limit_retries += 1

                # After RATE_LIMIT_RETRIES_BEFORE_FALLBACK retries, try switching model
                if self._rate_limit_retries >= RATE_LIMIT_RETRIES_BEFORE_FALLBACK:
                    # Find next available model in fallback chain
                    fallback_model = None
                    for candidate in RATE_LIMIT_FALLBACK_CHAIN:
                        if candidate not in self._tried_models:
                            fallback_model = candidate
                            break

                    if fallback_model:
                        old_model = self.model
                        self.model = fallback_model
                        self._tried_models.add(fallback_model)
                        self._rate_limit_retries = 0

                        fallback_msg = (
                            f"🔄 Model '{old_model}' hit rate limit. "
                            f"Automatically switching to '{fallback_model}'."
                        )
                        logger.warning(f"[iFlow] {fallback_msg}")
                        yield AssistantMessage(content=[TextBlock(text=f"[{fallback_msg}]")])

                        # Check if new model needs tool fallback
                        if self.enable_tools and fallback_model in MODELS_WITHOUT_TOOL_SUPPORT:
                            self.enable_tools = False
                            logger.warning(f"[iFlow] Fallback model '{fallback_model}' doesn't support tools.")
                            yield AssistantMessage(content=[
                                TextBlock(text=f"[Note: '{fallback_model}' doesn't support tools, using heredoc mode]")
                            ])

                        # Reset and retry with new model
                        self._current_turn = 0
                        self._conversation_history = []
                        async for msg in self.receive_response():
                            yield msg
                        return

                MAX_RATE_LIMIT_RETRIES = 5
                if self._rate_limit_retries <= MAX_RATE_LIMIT_RETRIES:
                    # Retry with exponential backoff
                    retry_delay = 30 * self._rate_limit_retries
                    logger.warning(
                        f"[iFlow] Rate limit exception (attempt {self._rate_limit_retries}/{RATE_LIMIT_RETRIES_BEFORE_FALLBACK} before model switch), "
                        f"waiting {retry_delay}s before retry..."
                    )
                    yield AssistantMessage(content=[
                        TextBlock(text=f"[Rate limit hit ({self._rate_limit_retries}/{RATE_LIMIT_RETRIES_BEFORE_FALLBACK}), waiting {retry_delay}s... Will switch model if persists]")
                    ])
                    time.sleep(retry_delay)
                    # Reset turn counter and retry
                    self._current_turn = 0
                    self._conversation_history = []
                    # Re-run the query
                    async for msg in self.receive_response():
                        yield msg
                    return

                # Max retries exceeded and no more fallback models
                error_msg = (
                    f"Rate limit error after trying {len(self._tried_models)} model(s). "
                    f"All available models are overloaded. Please try again later."
                )
                logger.error(f"[iFlow] {error_msg}")
                yield AssistantMessage(content=[TextBlock(text=error_msg)])
                self._pending_query = None
                return

            # Check for connection errors (network issues, timeouts)
            is_connection_error = (
                'connection' in error_str.lower() or
                'timeout' in error_str.lower() or
                'timed out' in error_str.lower() or
                'connect' in error_str.lower() and 'error' in error_str.lower() or
                'ConnectionError' in type(e).__name__ or
                'TimeoutError' in type(e).__name__
            )

            if is_connection_error:
                import time

                # Track connection error retries
                if not hasattr(self, '_connection_error_retries'):
                    self._connection_error_retries = 0
                self._connection_error_retries += 1

                MAX_CONNECTION_RETRIES = 3
                if self._connection_error_retries <= MAX_CONNECTION_RETRIES:
                    retry_delay = 15 * self._connection_error_retries  # 15s, 30s, 45s
                    logger.warning(
                        f"[iFlow] Connection error (attempt {self._connection_error_retries}/{MAX_CONNECTION_RETRIES}), "
                        f"retrying in {retry_delay}s..."
                    )
                    yield AssistantMessage(content=[
                        TextBlock(text=f"[⚠️ Connection error ({self._connection_error_retries}/{MAX_CONNECTION_RETRIES}), retrying in {retry_delay}s...]")
                    ])
                    time.sleep(retry_delay)
                    # Reset turn counter and retry
                    self._current_turn = 0
                    # Re-run the query
                    async for msg in self.receive_response():
                        yield msg
                    return

                # Max retries exceeded
                error_msg = (
                    f"Connection error after {self._connection_error_retries} attempts. "
                    f"iFlow API may be unreachable. Check your network connection."
                )
                logger.error(f"[iFlow] {error_msg}")
                yield AssistantMessage(content=[TextBlock(text=error_msg)])
                self._pending_query = None
                return

            # Check if it's a tool_call_id error - retry without tools
            if "tool_call_id" in error_str.lower() or "400" in error_str:
                logger.warning("[iFlow] Tool calling error detected, retrying without tools...")
                yield AssistantMessage(content=[TextBlock(text="[Tool calling error, retrying without tools...]")])

                # Disable tools and retry with simple chat
                self.enable_tools = False
                self._current_turn = 0
                self._conversation_history = []

                # Re-run the query without tools
                try:
                    async for msg in self._simple_chat_fallback(initial_user_message if 'initial_user_message' in dir() else self._pending_query):
                        yield msg
                    return
                except Exception as fallback_error:
                    logger.error(f"[iFlow] Fallback also failed: {fallback_error}")
                    error_msg = f"iFlow API Error (fallback failed): {str(fallback_error)}"
                    yield AssistantMessage(content=[TextBlock(text=error_msg)])
                    self._pending_query = None
                    return

            error_msg = f"iFlow API Error: {error_str}"
            yield AssistantMessage(content=[TextBlock(text=error_msg)])
            self._pending_query = None

    def create_agent_session(
        self,
        name: str,
        starting_message: str,
        max_turns: int = 1,
        **kwargs,
    ) -> "IFlowAgentResponse":
        """
        Create an agent session (iFlow-compatible).

        Unlike Claude SDK, iFlow doesn't support multi-turn agentic sessions
        with tool use. This method provides a simplified single-turn interaction.

        Args:
            name: Session name (for logging)
            starting_message: The user message to process
            max_turns: Ignored (iFlow sessions are single-turn)
            **kwargs: Additional parameters (ignored for compatibility)

        Returns:
            IFlowAgentResponse with the model's response
        """
        logger.info(f"[iFlow] Creating session '{name}' with model {self.model}")

        messages = []

        # Add system prompt
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})

        # Add conversation history
        messages.extend(self._conversation_history)

        # Add user message
        messages.append({"role": "user", "content": starting_message})

        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
            )

            assistant_message = response.choices[0].message.content

            # Update conversation history
            self._conversation_history.append(
                {"role": "user", "content": starting_message}
            )
            self._conversation_history.append(
                {"role": "assistant", "content": assistant_message}
            )

            return IFlowAgentResponse(
                content=assistant_message,
                model=self.model,
                provider="iflow",
                usage={
                    "input_tokens": response.usage.prompt_tokens if response.usage else 0,
                    "output_tokens": response.usage.completion_tokens if response.usage else 0,
                },
            )

        except Exception as e:
            logger.error(f"[iFlow] Session '{name}' failed: {e}")
            return IFlowAgentResponse(
                content=f"Error: {str(e)}",
                model=self.model,
                provider="iflow",
                error=str(e),
            )

    def clear_history(self):
        """Clear conversation history."""
        self._conversation_history = []

    async def _simple_chat_fallback(self, prompt: str):
        """
        Simple chat fallback when tool calling fails.

        Uses streaming chat without tools, with heredoc extraction for file creation.

        Args:
            prompt: The user prompt to process

        Yields:
            AssistantMessage objects with response text
        """
        messages = []

        # Add system prompt with heredoc instructions
        fallback_system = (
            f"{self.system_prompt}\n\n"
            f"NOTE: Tool calling is not available. To create files, use heredoc syntax:\n"
            f"```bash\n"
            f"cat > filename << 'EOF'\n"
            f"file content\n"
            f"EOF\n"
            f"```\n"
            f"The system will extract and create files from your response."
        )
        messages.append({"role": "system", "content": fallback_system})
        messages.append({"role": "user", "content": prompt})

        try:
            logger.info(f"[iFlow] Running simple chat fallback (no tools)...")

            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                stream=True,
            )

            full_response = ""
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    chunk_text = chunk.choices[0].delta.content
                    full_response += chunk_text
                    yield AssistantMessage(content=[TextBlock(text=chunk_text)])

            # Extract and write files from heredoc patterns
            if full_response:
                files_written = self._extract_and_write_files(full_response)
                if files_written:
                    logger.info(f"[iFlow] Fallback created files: {files_written}")

            self._last_response = full_response

        except Exception as e:
            logger.error(f"[iFlow] Simple chat fallback failed: {e}")
            raise

    def _truncate_messages(self, messages: list, max_messages: int = 20) -> list:
        """
        Truncate conversation history to avoid token explosion.

        IMPORTANT: Never truncate in the middle of a tool call sequence!
        Tool results must always follow their corresponding assistant tool_calls.

        Keeps:
        - System prompt (first message)
        - Last N messages (ensuring tool call sequences are complete)

        Args:
            messages: Full message list
            max_messages: Max messages to keep (default 20)

        Returns:
            Truncated message list
        """
        # First, estimate total chars and truncate aggressively if needed
        # Rough estimate: 4 chars per token, target ~50k tokens max = 200k chars
        MAX_TOTAL_CHARS = 200000
        total_chars = sum(len(str(m.get("content", ""))) for m in messages)

        if total_chars > MAX_TOTAL_CHARS:
            # Need aggressive truncation - reduce max_messages
            reduction_factor = MAX_TOTAL_CHARS / total_chars
            max_messages = max(5, int(max_messages * reduction_factor))
            logger.warning(
                f"[iFlow] Content too large ({total_chars} chars), "
                f"reducing max_messages to {max_messages}"
            )

        if len(messages) <= max_messages:
            return messages

        # Separate system messages
        system_msgs = [m for m in messages if m.get("role") == "system"]
        other_msgs = [m for m in messages if m.get("role") != "system"]

        # Find safe truncation point (not in middle of tool call sequence)
        # We need to keep messages from the start of the last tool call sequence
        target_keep = max_messages - len(system_msgs)

        if len(other_msgs) <= target_keep:
            return messages

        # Start from the end and find a safe cut point
        # Safe cut points are: after user message, after assistant message without tool_calls
        cut_index = len(other_msgs) - target_keep

        # Adjust cut_index to not break tool call sequences
        while cut_index < len(other_msgs):
            msg = other_msgs[cut_index]
            role = msg.get("role", "")

            # Safe to cut before: user message or assistant without tool_calls
            if role == "user":
                break
            if role == "assistant" and not msg.get("tool_calls"):
                break

            # Not safe: tool result or assistant with tool_calls
            # Move forward to find safe point
            cut_index += 1

        # If we couldn't find a safe point, keep everything
        if cut_index >= len(other_msgs):
            return messages

        truncated = system_msgs + other_msgs[cut_index:]

        logger.info(
            f"[iFlow] Truncated conversation: {len(messages)} -> {len(truncated)} messages "
            f"(cut at index {cut_index})"
        )

        return truncated

    def _extract_and_write_files(self, response_text: str) -> list[str]:
        """
        Extract file contents from heredoc patterns and write them.

        This method parses the agent's response for bash heredoc patterns like:
        - cat > filename << 'DELIMITER'...DELIMITER
        - cat > filename << DELIMITER...DELIMITER
        - cat >> filename << 'DELIMITER'...DELIMITER (append mode)

        When found, it extracts the content and writes the file.
        This simulates tool use for iFlow agents.

        Args:
            response_text: The full response from the iFlow agent

        Returns:
            List of filenames that were created/updated
        """
        import re

        files_written = []

        # Pattern to match heredoc: cat > file << 'DELIMITER' or cat > file << DELIMITER
        # Captures:
        # 1. operator (> or >>)
        # 2. filename
        # 3. delimiter (with or without quotes)
        # 4. content until delimiter
        heredoc_pattern = re.compile(
            r"cat\s+(>|>>)\s+([^\s<]+)\s+<<\s*['\"]?(\w+)['\"]?\n(.*?)^\3$",
            re.MULTILINE | re.DOTALL
        )

        for match in heredoc_pattern.finditer(response_text):
            operator = match.group(1)
            filename = match.group(2).strip()
            content = match.group(4)

            # Determine the target directory
            if self.spec_dir:
                target_path = self.spec_dir / filename
            elif self.project_dir:
                target_path = self.project_dir / filename
            else:
                logger.warning(f"[iFlow] Cannot write file {filename}: no spec_dir or project_dir set")
                continue

            # Security check: don't allow path traversal
            try:
                # Resolve to prevent path traversal attacks
                target_path = target_path.resolve()
                base_dir = (self.spec_dir or self.project_dir).resolve()
                if not str(target_path).startswith(str(base_dir)):
                    logger.warning(f"[iFlow] Rejected file write outside allowed directory: {filename}")
                    continue
            except Exception as e:
                logger.warning(f"[iFlow] Path resolution failed for {filename}: {e}")
                continue

            try:
                # Create parent directories if needed
                target_path.parent.mkdir(parents=True, exist_ok=True)

                # Write or append based on operator
                mode = "a" if operator == ">>" else "w"
                with open(target_path, mode, encoding="utf-8") as f:
                    f.write(content)

                files_written.append(str(target_path))
                logger.info(f"[iFlow] Wrote file from heredoc: {target_path}")

            except Exception as e:
                logger.error(f"[iFlow] Failed to write file {target_path}: {e}")

        # Also try to extract markdown code blocks that look like complete files
        # Pattern: ```language:filename or just complete spec content
        if not files_written and self.spec_dir:
            # Look for spec.md content in the response
            spec_file = self.spec_dir / "spec.md"
            if not spec_file.exists():
                # Try to find a markdown spec in the response
                spec_content = self._extract_spec_from_response(response_text)
                if spec_content:
                    try:
                        with open(spec_file, "w", encoding="utf-8") as f:
                            f.write(spec_content)
                        files_written.append(str(spec_file))
                        logger.info(f"[iFlow] Extracted and wrote spec.md from response")
                    except Exception as e:
                        logger.error(f"[iFlow] Failed to write spec.md: {e}")

        return files_written

    def _extract_spec_from_response(self, response_text: str) -> str | None:
        """
        Try to extract spec.md content from the response text.

        Looks for:
        1. Heredoc-style spec content
        2. Markdown content starting with '# Specification'
        3. Content between ```markdown blocks

        Args:
            response_text: The full response from the agent

        Returns:
            Extracted spec content or None
        """
        import re

        # Try to find spec content starting with "# Specification"
        spec_pattern = re.compile(
            r"(# Specification.*?)(?=\n```\s*$|\Z)",
            re.DOTALL
        )
        match = spec_pattern.search(response_text)
        if match:
            content = match.group(1).strip()
            # Validate it has minimum content
            if len(content) > 500 and "## Overview" in content:
                return content

        # Try markdown code block
        markdown_block_pattern = re.compile(
            r"```(?:markdown)?\n(# Specification.*?)```",
            re.DOTALL
        )
        match = markdown_block_pattern.search(response_text)
        if match:
            content = match.group(1).strip()
            if len(content) > 500 and "## Overview" in content:
                return content

        # Last resort: look for substantial markdown content
        # that looks like a spec document
        lines = response_text.split("\n")
        in_spec = False
        spec_lines = []

        for line in lines:
            if line.startswith("# Specification"):
                in_spec = True
            if in_spec:
                # Stop at end markers
                if line.strip() in ("```", "SPEC_EOF", "EOF"):
                    if spec_lines:
                        break
                spec_lines.append(line)

        if spec_lines:
            content = "\n".join(spec_lines).strip()
            if len(content) > 500 and "## Overview" in content:
                return content

        return None


@dataclass
class IFlowAgentResponse:
    """Response from iFlow agent session."""

    content: str
    model: str
    provider: str = "iflow"
    usage: dict | None = None
    error: str | None = None

    @property
    def text(self) -> str:
        """Get response text (compatibility with Claude SDK)."""
        return self.content

    @property
    def is_error(self) -> bool:
        """Check if response is an error."""
        return self.error is not None


class IFlowSimpleClient:
    """
    Simple wrapper for iFlow API interactions.

    Provides a straightforward interface for sending messages and getting responses.
    """

    def __init__(
        self,
        config: IFlowConfig,
        model: str,
        system_prompt: str | None = None,
    ):
        self.config = config
        self.model = model
        self.system_prompt = system_prompt
        self._client = None

    @property
    def client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            self._client = create_iflow_chat_client(self.config)
        return self._client

    def send(
        self,
        message: str,
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> str:
        """
        Send a message and get a response.

        Args:
            message: User message to send
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response

        Returns:
            Response content as string
        """
        messages = []

        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})

        messages.append({"role": "user", "content": message})

        completion_kwargs = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
        }

        if max_tokens is not None:
            completion_kwargs["max_tokens"] = max_tokens

        response = self.client.chat.completions.create(**completion_kwargs)
        return response.choices[0].message.content

    def send_conversation(
        self,
        messages: list[dict[str, str]],
        temperature: float = 0.7,
        max_tokens: int | None = None,
    ) -> str:
        """
        Send a multi-turn conversation and get a response.

        Args:
            messages: List of message dicts with 'role' and 'content'
            temperature: Sampling temperature
            max_tokens: Maximum tokens in response

        Returns:
            Response content as string
        """
        all_messages = []

        if self.system_prompt:
            all_messages.append({"role": "system", "content": self.system_prompt})

        all_messages.extend(messages)

        completion_kwargs = {
            "model": self.model,
            "messages": all_messages,
            "temperature": temperature,
        }

        if max_tokens is not None:
            completion_kwargs["max_tokens"] = max_tokens

        response = self.client.chat.completions.create(**completion_kwargs)
        return response.choices[0].message.content
