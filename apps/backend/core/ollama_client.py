"""
Ollama Client for Local Model Execution
=======================================

Provides an Ollama client that can be used as an alternative to Claude
for task execution. Supports streaming responses and tool use.
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncGenerator, Callable

logger = logging.getLogger(__name__)

try:
    import ollama
    from ollama import AsyncClient
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_AVAILABLE = False
    logger.warning("Ollama package not installed. Run: pip install ollama")


@dataclass
class OllamaConfig:
    """Configuration for Ollama client."""
    base_url: str = "http://localhost:11434"
    model: str = "llama3.1:8b"
    context_window: int = 8192
    temperature: float = 0.7
    num_gpu: int = -1  # -1 = auto-detect
    num_ctx: int = 8192
    
    @classmethod
    def from_env(cls) -> "OllamaConfig":
        """Create config from environment variables."""
        return cls(
            base_url=os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434"),
            model=os.environ.get("OLLAMA_MODEL", "llama3.1:8b"),
            context_window=int(os.environ.get("OLLAMA_NUM_CTX", "8192")),
            temperature=float(os.environ.get("OLLAMA_TEMPERATURE", "0.7")),
            num_gpu=int(os.environ.get("OLLAMA_NUM_GPU", "-1")),
            num_ctx=int(os.environ.get("OLLAMA_NUM_CTX", "8192")),
        )


@dataclass
class OllamaMessage:
    """Message in Ollama format."""
    role: str  # 'user', 'assistant', 'system'
    content: str


@dataclass
class OllamaResponse:
    """Response from Ollama."""
    content: str
    model: str
    done: bool
    total_duration: int | None = None
    eval_count: int | None = None


class OllamaClient:
    """
    Async Ollama client for local model execution.
    
    Provides a similar interface to ClaudeSDKClient for easy switching.
    """
    
    def __init__(self, config: OllamaConfig | None = None):
        """
        Initialize Ollama client.
        
        Args:
            config: Ollama configuration (uses env vars if not provided)
        """
        if not OLLAMA_AVAILABLE:
            raise ImportError(
                "Ollama package not installed. Run: pip install ollama"
            )
        
        self.config = config or OllamaConfig.from_env()
        self._client = AsyncClient(host=self.config.base_url)
        self._messages: list[dict[str, str]] = []
        self._system_prompt: str | None = None
        
    def set_system_prompt(self, prompt: str) -> None:
        """Set the system prompt for the conversation."""
        self._system_prompt = prompt
        
    def clear_messages(self) -> None:
        """Clear conversation history."""
        self._messages = []
        
    async def check_health(self) -> tuple[bool, str | None]:
        """
        Check if Ollama is healthy and the model is available.
        
        Returns:
            Tuple of (is_healthy, error_message)
        """
        try:
            # Check if Ollama is running
            models = await self._client.list()
            
            # Check if our model is available
            model_names = [m.get("name", "") for m in models.get("models", [])]
            if self.config.model not in model_names:
                # Try to find a partial match (e.g., 'llama3.1:8b' in 'llama3.1:8b-instruct-q4_K_M')
                found = any(self.config.model in name for name in model_names)
                if not found:
                    return False, f"Model '{self.config.model}' not found. Available: {model_names}"
            
            return True, None
            
        except Exception as e:
            return False, str(e)
    
    async def generate(
        self,
        prompt: str,
        stream: bool = True,
    ) -> AsyncGenerator[str, None]:
        """
        Generate a response from Ollama.
        
        Args:
            prompt: User prompt
            stream: Whether to stream the response
            
        Yields:
            Response text chunks
        """
        # Build messages
        messages = []
        if self._system_prompt:
            messages.append({"role": "system", "content": self._system_prompt})
        messages.extend(self._messages)
        messages.append({"role": "user", "content": prompt})
        
        # Store user message
        self._messages.append({"role": "user", "content": prompt})
        
        try:
            if stream:
                response_text = ""
                async for chunk in await self._client.chat(
                    model=self.config.model,
                    messages=messages,
                    stream=True,
                    options={
                        "temperature": self.config.temperature,
                        "num_ctx": self.config.num_ctx,
                        "num_gpu": self.config.num_gpu,
                    },
                ):
                    content = chunk.get("message", {}).get("content", "")
                    if content:
                        response_text += content
                        yield content
                
                # Store assistant response
                self._messages.append({"role": "assistant", "content": response_text})
            else:
                response = await self._client.chat(
                    model=self.config.model,
                    messages=messages,
                    stream=False,
                    options={
                        "temperature": self.config.temperature,
                        "num_ctx": self.config.num_ctx,
                        "num_gpu": self.config.num_gpu,
                    },
                )
                content = response.get("message", {}).get("content", "")
                self._messages.append({"role": "assistant", "content": content})
                yield content
                
        except Exception as e:
            logger.error(f"Ollama generation error: {e}")
            raise
    
    async def generate_with_tools(
        self,
        prompt: str,
        tools: list[dict[str, Any]],
        tool_handler: Callable[[str, dict], Any],
    ) -> AsyncGenerator[str | dict, None]:
        """
        Generate a response with tool use support.
        
        Args:
            prompt: User prompt
            tools: List of tool definitions
            tool_handler: Function to handle tool calls
            
        Yields:
            Response text chunks or tool call results
        """
        # Build messages
        messages = []
        if self._system_prompt:
            messages.append({"role": "system", "content": self._system_prompt})
        messages.extend(self._messages)
        messages.append({"role": "user", "content": prompt})
        
        self._messages.append({"role": "user", "content": prompt})
        
        try:
            response = await self._client.chat(
                model=self.config.model,
                messages=messages,
                tools=tools,
                stream=False,
                options={
                    "temperature": self.config.temperature,
                    "num_ctx": self.config.num_ctx,
                },
            )
            
            message = response.get("message", {})
            content = message.get("content", "")
            tool_calls = message.get("tool_calls", [])
            
            # Yield text content
            if content:
                yield content
                self._messages.append({"role": "assistant", "content": content})
            
            # Handle tool calls
            for tool_call in tool_calls:
                function = tool_call.get("function", {})
                tool_name = function.get("name")
                tool_args = function.get("arguments", {})
                
                if isinstance(tool_args, str):
                    tool_args = json.loads(tool_args)
                
                # Execute tool
                result = await tool_handler(tool_name, tool_args)
                yield {"tool_call": tool_name, "args": tool_args, "result": result}
                
                # Add tool result to messages
                self._messages.append({
                    "role": "tool",
                    "content": json.dumps(result) if not isinstance(result, str) else result,
                })
                
        except Exception as e:
            logger.error(f"Ollama tool generation error: {e}")
            raise


class OllamaRateLimitHandler:
    """
    Handles rate limiting and fallback between Claude and Ollama.
    """
    
    def __init__(
        self,
        ollama_client: OllamaClient | None = None,
        fallback_enabled: bool = True,
        pause_on_rate_limit: bool = True,
        rate_limit_wait_seconds: int = 60,
    ):
        """
        Initialize rate limit handler.
        
        Args:
            ollama_client: Ollama client for fallback
            fallback_enabled: Whether to fall back to Ollama on rate limit
            pause_on_rate_limit: Whether to pause and wait on rate limit
            rate_limit_wait_seconds: How long to wait before retrying
        """
        self.ollama_client = ollama_client
        self.fallback_enabled = fallback_enabled
        self.pause_on_rate_limit = pause_on_rate_limit
        self.rate_limit_wait_seconds = rate_limit_wait_seconds
        self._rate_limited = False
        self._rate_limit_until: float | None = None
        
    def is_rate_limited(self) -> bool:
        """Check if currently rate limited."""
        if not self._rate_limited:
            return False
        
        import time
        if self._rate_limit_until and time.time() > self._rate_limit_until:
            self._rate_limited = False
            self._rate_limit_until = None
            return False
        
        return True
    
    def set_rate_limited(self, duration_seconds: int | None = None) -> None:
        """
        Mark as rate limited.
        
        Args:
            duration_seconds: How long the rate limit lasts
        """
        import time
        self._rate_limited = True
        if duration_seconds:
            self._rate_limit_until = time.time() + duration_seconds
        else:
            self._rate_limit_until = time.time() + self.rate_limit_wait_seconds
    
    def clear_rate_limit(self) -> None:
        """Clear rate limit status."""
        self._rate_limited = False
        self._rate_limit_until = None
    
    def get_wait_time(self) -> int:
        """Get remaining wait time in seconds."""
        if not self._rate_limited or not self._rate_limit_until:
            return 0
        
        import time
        remaining = int(self._rate_limit_until - time.time())
        return max(0, remaining)
    
    async def should_use_fallback(self) -> bool:
        """
        Check if we should use Ollama fallback.
        
        Returns:
            True if should use Ollama
        """
        if not self.fallback_enabled or not self.ollama_client:
            return False
        
        if not self.is_rate_limited():
            return False
        
        # Check if Ollama is available
        is_healthy, _ = await self.ollama_client.check_health()
        return is_healthy


async def create_ollama_client(
    model: str | None = None,
    config: OllamaConfig | None = None,
) -> OllamaClient:
    """
    Create an Ollama client.
    
    Args:
        model: Model to use (overrides config)
        config: Full configuration
        
    Returns:
        Configured OllamaClient
    """
    if config is None:
        config = OllamaConfig.from_env()
    
    if model:
        # Remove 'ollama:' prefix if present
        if model.startswith("ollama:"):
            model = model[7:]
        config.model = model
    
    client = OllamaClient(config)
    
    # Verify health
    is_healthy, error = await client.check_health()
    if not is_healthy:
        logger.warning(f"Ollama health check failed: {error}")
    
    return client
