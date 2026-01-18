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
) -> "IFlowAgentClient":
    """
    Create an iFlow agent client for use with agents.

    This is the main entry point for creating iFlow-based agent sessions.
    Use this instead of create_client() when iFlow provider is selected.

    Args:
        project_dir: Root directory for the project
        spec_dir: Directory containing the spec
        model: iFlow model to use (defaults to recommended model for agent type)
        agent_type: Agent type identifier (for model recommendation)
        system_prompt: System prompt for the agent

    Returns:
        IFlowAgentClient instance

    Raises:
        ValueError: If iFlow is not enabled or configured

    Example:
        >>> client = create_iflow_agent_client(
        ...     project_dir=Path("/project"),
        ...     spec_dir=Path("/project/.auto-claude/specs/001"),
        ...     agent_type="spec_researcher"
        ... )
        >>> response = client.create_agent_session(
        ...     name="research-session",
        ...     starting_message="Analyze the codebase"
        ... )
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
        system_prompt = (
            f"You are an expert full-stack developer building production-quality software. "
            f"Your working directory is: {project_dir.resolve()}\n"
            f"Your spec directory is: {spec_dir.resolve()}\n\n"
            f"IMPORTANT: When you need to create or modify files, use bash heredoc syntax:\n"
            f"```bash\n"
            f"cat > filename.md << 'EOF'\n"
            f"file content here\n"
            f"EOF\n"
            f"```\n\n"
            f"The system will automatically extract and write these files for you.\n"
            f"Always use single-quoted delimiters (e.g., << 'EOF' or << 'SPEC_EOF').\n\n"
            f"You follow existing code patterns, write clean maintainable code, and verify "
            f"your work through thorough testing."
        )

    logger.info(
        f"[iFlow] Creating agent client: model={model}, agent_type={agent_type}"
    )

    return IFlowAgentClient(
        config=config,
        model=model,
        system_prompt=system_prompt,
        project_dir=project_dir,
        spec_dir=spec_dir,
    )


@dataclass
class TextBlock:
    """TextBlock for iFlow responses (matches Claude SDK TextBlock type name)."""
    text: str


@dataclass
class AssistantMessage:
    """AssistantMessage for iFlow responses (matches Claude SDK AssistantMessage type name)."""
    content: list


class IFlowAgentClient:
    """
    iFlow agent client that mimics ClaudeSDKClient interface.

    This provides compatibility for agents that need to switch between
    Claude SDK and iFlow backends. Note that iFlow does not support
    the full agent capabilities (MCP servers, custom tools), so this
    wrapper provides a simplified interface for chat-based agents.

    Suitable for:
    - spec_gatherer, spec_researcher, spec_writer (with heredoc file extraction)
    - insights extraction
    - commit message generation

    The client automatically extracts file content from heredoc patterns in the
    agent's response (e.g., `cat > spec.md << 'EOF'...EOF`) and writes the files.
    This simulates tool use for chat-only agents.

    Not suitable for:
    - coder (requires interactive tool use)
    - qa_reviewer, qa_fixer (requires interactive tool use)
    """

    def __init__(
        self,
        config: IFlowConfig,
        model: str,
        system_prompt: str,
        project_dir: Path | None = None,
        spec_dir: Path | None = None,
    ):
        self.config = config
        self.model = model
        self.system_prompt = system_prompt
        self.project_dir = project_dir
        self.spec_dir = spec_dir
        self._client = None
        self._conversation_history: list[dict[str, str]] = []
        self._pending_query: str | None = None
        self._last_response: str | None = None

    @property
    def client(self):
        """Lazy initialization of OpenAI client."""
        if self._client is None:
            self._client = create_iflow_chat_client(self.config)
        return self._client

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

    async def receive_response(self):
        """
        Async generator that yields response messages (mimics ClaudeSDKClient.receive_response).

        Yields:
            IFlowAssistantMessage objects containing TextBlock with the response
        """
        if not self._pending_query:
            return

        messages = []

        # Add system prompt
        if self.system_prompt:
            messages.append({"role": "system", "content": self.system_prompt})

        # Add conversation history
        messages.extend(self._conversation_history)

        # Add user message
        messages.append({"role": "user", "content": self._pending_query})

        try:
            logger.info(f"[iFlow] Sending query to {self.model}...")

            # First, try a non-streaming call to check for model errors
            # iFlow returns error in response body, not as exception
            test_response = self.client.chat.completions.create(
                model=self.model,
                messages=messages[:1],  # Just system prompt for quick test
                max_tokens=1,
                stream=False,
            )

            # Check for iFlow-specific error response
            if hasattr(test_response, 'status') and test_response.status:
                status_code = str(test_response.status)
                error_msg = getattr(test_response, 'msg', 'Unknown error')
                if status_code != '200' and status_code != 'None':
                    error_text = f"iFlow API Error (status {status_code}): {error_msg}"
                    if 'not support' in error_msg.lower():
                        error_text += f"\n\nModel '{self.model}' is not available. Please use a valid model."
                    logger.error(f"[iFlow] {error_text}")
                    yield AssistantMessage(
                        content=[TextBlock(text=error_text)]
                    )
                    self._pending_query = None
                    return

            # Use streaming for real-time output
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                temperature=0.7,
                stream=True,
            )

            full_response = ""
            for chunk in response:
                # Check for error in streaming response
                if hasattr(chunk, 'status') and chunk.status and str(chunk.status) not in ('200', 'None'):
                    error_msg = getattr(chunk, 'msg', 'Unknown error')
                    error_text = f"iFlow API Error: {error_msg}"
                    yield AssistantMessage(
                        content=[TextBlock(text=error_text)]
                    )
                    self._pending_query = None
                    return

                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    chunk_text = chunk.choices[0].delta.content
                    full_response += chunk_text
                    # Yield each chunk as an AssistantMessage
                    yield AssistantMessage(
                        content=[TextBlock(text=chunk_text)]
                    )

            # Update conversation history
            self._conversation_history.append(
                {"role": "user", "content": self._pending_query}
            )
            self._conversation_history.append(
                {"role": "assistant", "content": full_response}
            )
            self._last_response = full_response
            self._pending_query = None

            # Post-process: Extract and write files from heredoc patterns
            # This simulates tool use for iFlow agents that can't execute commands
            files_written = self._extract_and_write_files(full_response)
            if files_written:
                logger.info(f"[iFlow] Auto-created files from response: {files_written}")

        except Exception as e:
            logger.error(f"[iFlow] Query failed: {e}")
            error_msg = f"iFlow API Error: {str(e)}"
            yield AssistantMessage(
                content=[TextBlock(text=error_msg)]
            )
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
