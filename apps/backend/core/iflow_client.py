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
# These will use heredoc-based file creation instead
MODELS_WITHOUT_TOOL_SUPPORT = {
    "kimi-k2",      # Has issues with tool_call_id
    "qwen3-max",    # Inconsistent tool support
    "glm-4.6",      # No tool support
    "glm-4.7",      # No tool support
}

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

    # Check if model supports tool calling
    if enable_tools and model in MODELS_WITHOUT_TOOL_SUPPORT:
        logger.warning(
            f"[iFlow] Model '{model}' doesn't support tool calling well. "
            f"Disabling tools and using heredoc-based file creation."
        )
        enable_tools = False

    logger.info(
        f"[iFlow] Creating agent client: model={model}, agent_type={agent_type}, tools={enable_tools}"
    )

    return IFlowAgentClient(
        config=config,
        model=model,
        system_prompt=system_prompt,
        project_dir=project_dir,
        spec_dir=spec_dir,
        enable_tools=enable_tools,
        max_turns=max_turns,
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
    ):
        self.config = config
        self.model = model
        self.system_prompt = system_prompt
        self.project_dir = project_dir
        self.spec_dir = spec_dir
        self.enable_tools = enable_tools
        self.max_turns = max_turns
        self._client = None
        self._conversation_history: list[dict] = []
        self._pending_query: str | None = None
        self._last_response: str | None = None
        self._tool_context = None
        self._current_turn = 0

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

            while self._current_turn < self.max_turns:
                self._current_turn += 1
                logger.info(f"[iFlow] Turn {self._current_turn}/{self.max_turns}")

                # Truncate messages to avoid token explosion
                truncated_messages = self._truncate_messages(messages, max_messages=30)

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

                # Log token usage if available
                if hasattr(response, 'usage') and response.usage:
                    usage = response.usage
                    logger.info(
                        f"[iFlow] Token usage - prompt: {usage.prompt_tokens}, "
                        f"completion: {usage.completion_tokens}, "
                        f"total: {usage.total_tokens}"
                    )

                # Check for errors
                if hasattr(response, 'status') and response.status:
                    status_code = str(response.status)
                    error_msg = getattr(response, 'msg', 'Unknown error')
                    if status_code not in ('200', 'None', ''):
                        # Handle rate limit with retry
                        if status_code == '449' or 'rate limit' in str(error_msg).lower():
                            import time
                            retry_delay = 30  # seconds
                            logger.warning(f"[iFlow] Rate limit hit, waiting {retry_delay}s before retry...")
                            yield AssistantMessage(content=[TextBlock(text=f"[Rate limit hit, waiting {retry_delay}s...]")])
                            time.sleep(retry_delay)
                            self._current_turn -= 1  # Don't count this as a turn
                            continue  # Retry the same request

                        error_text = f"iFlow API Error (status {status_code}): {error_msg}"
                        if 'not support' in str(error_msg).lower():
                            error_text += f"\n\nModel '{self.model}' may not support function calling."
                        logger.error(f"[iFlow] {error_text}")
                        yield AssistantMessage(content=[TextBlock(text=error_text)])
                        break

                # Get the response message
                choice = response.choices[0] if response.choices else None
                if not choice:
                    logger.error("[iFlow] No response from model")
                    yield AssistantMessage(content=[TextBlock(text="Error: No response from model")])
                    break

                message = choice.message
                finish_reason = choice.finish_reason

                # Collect content blocks for AssistantMessage
                content_blocks = []

                # Handle text content
                if message.content:
                    content_blocks.append(TextBlock(text=message.content))
                    # Yield text incrementally (simulate streaming)
                    yield AssistantMessage(content=[TextBlock(text=message.content)])

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
                        try:
                            import json
                            raw_args = tool_call.function.arguments
                            if isinstance(raw_args, str):
                                tool_args = json.loads(raw_args) if raw_args else {}
                            elif isinstance(raw_args, dict):
                                tool_args = raw_args
                            else:
                                tool_args = {}
                        except (json.JSONDecodeError, TypeError):
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

                        # Yield tool result
                        tool_result_block = ToolResultBlock(
                            tool_use_id=tool_id,
                            content=result_text,
                            is_error=is_error
                        )
                        yield UserMessage(content=[tool_result_block])

                        # Store result for next API call
                        tool_results.append({
                            "tool_call_id": tool_id,
                            "role": "tool",
                            "content": result_text,
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

                    self._last_response = message.content
                    self._pending_query = None

                    # Post-process: Extract and write files from heredoc patterns
                    # (fallback for models that don't use tools properly)
                    if message.content:
                        files_written = self._extract_and_write_files(message.content)
                        if files_written:
                            logger.info(f"[iFlow] Auto-created files from response: {files_written}")

                    break

            else:
                # Max turns reached
                logger.warning(f"[iFlow] Max turns ({self.max_turns}) reached")
                yield AssistantMessage(
                    content=[TextBlock(text=f"\n\n[Agent stopped: max turns ({self.max_turns}) reached]")]
                )
                self._pending_query = None

        except Exception as e:
            error_str = str(e)
            logger.error(f"[iFlow] Agent loop failed: {e}", exc_info=True)

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
