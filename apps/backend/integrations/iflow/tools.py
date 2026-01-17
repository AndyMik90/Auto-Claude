"""
iFlow MCP Tools
===============

Tool implementations for iFlow MCP server.

These tools provide access to iFlow models within Claude Agent SDK sessions,
enabling hybrid model usage where appropriate.
"""

import logging
from typing import Any

from .config import MODEL_CONFIGS, get_iflow_config, is_iflow_enabled

logger = logging.getLogger(__name__)


def create_iflow_client():
    """Create OpenAI client for iFlow API."""
    try:
        from openai import OpenAI
    except ImportError:
        raise ImportError("iFlow tools require the openai package. pip install openai")

    config = get_iflow_config()
    if not config.is_valid():
        raise ValueError("iFlow is not configured properly. Check IFLOW_API_KEY.")

    return OpenAI(
        api_key=config.api_key,
        base_url=config.base_url,
        timeout=config.timeout,
        max_retries=config.max_retries,
    )


async def tool_chat(
    messages: list[dict[str, str]],
    model: str | None = None,
    temperature: float = 0.7,
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """
    Chat with iFlow model.

    Args:
        messages: List of message dicts with 'role' and 'content'
        model: Model to use (default: from config)
        temperature: Sampling temperature (0-2)
        max_tokens: Maximum tokens in response

    Returns:
        Dict with response content and metadata
    """
    if not is_iflow_enabled():
        return {"error": "iFlow is not enabled", "success": False}

    config = get_iflow_config()
    model = model or config.model

    try:
        client = create_iflow_client()

        kwargs = {
            "model": model,
            "messages": messages,
            "temperature": temperature,
        }
        if max_tokens:
            kwargs["max_tokens"] = max_tokens

        response = client.chat.completions.create(**kwargs)

        return {
            "success": True,
            "content": response.choices[0].message.content,
            "model": model,
            "usage": {
                "prompt_tokens": response.usage.prompt_tokens,
                "completion_tokens": response.usage.completion_tokens,
                "total_tokens": response.usage.total_tokens,
            },
        }
    except Exception as e:
        logger.error(f"iFlow chat error: {e}")
        return {"success": False, "error": str(e)}


async def tool_code_complete(
    code: str,
    language: str = "python",
    instruction: str | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """
    Code completion using iFlow model.

    Args:
        code: Code context/prefix
        language: Programming language
        instruction: Optional instruction for completion
        model: Model to use (default: qwen3-coder)

    Returns:
        Dict with completion result
    """
    if not is_iflow_enabled():
        return {"error": "iFlow is not enabled", "success": False}

    config = get_iflow_config()
    model = model or "qwen3-coder"  # Prefer code-specialized model

    instruction_text = instruction or "Complete the following code"

    messages = [
        {
            "role": "system",
            "content": f"You are an expert {language} developer. {instruction_text}. "
            f"Only output the code, no explanations.",
        },
        {"role": "user", "content": f"```{language}\n{code}\n```"},
    ]

    try:
        client = create_iflow_client()

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.2,  # Lower temperature for code
        )

        return {
            "success": True,
            "completion": response.choices[0].message.content,
            "model": model,
            "language": language,
        }
    except Exception as e:
        logger.error(f"iFlow code completion error: {e}")
        return {"success": False, "error": str(e)}


async def tool_translate(
    text: str,
    source_lang: str = "auto",
    target_lang: str = "en",
    model: str | None = None,
) -> dict[str, Any]:
    """
    Translate text using iFlow model.

    Args:
        text: Text to translate
        source_lang: Source language (default: auto-detect)
        target_lang: Target language (default: English)
        model: Model to use (default: glm-4.7 for Chinese, deepseek-v3 otherwise)

    Returns:
        Dict with translation result
    """
    if not is_iflow_enabled():
        return {"error": "iFlow is not enabled", "success": False}

    # Use GLM for Chinese tasks, otherwise DeepSeek
    if target_lang.lower() in ("zh", "chinese", "cn") or source_lang.lower() in (
        "zh",
        "chinese",
        "cn",
    ):
        model = model or "glm-4.7"
    else:
        model = model or "deepseek-v3"

    source_desc = "auto-detected language" if source_lang == "auto" else source_lang

    messages = [
        {
            "role": "system",
            "content": f"You are a professional translator. "
            f"Translate the following text from {source_desc} to {target_lang}. "
            f"Only output the translation, no explanations or notes.",
        },
        {"role": "user", "content": text},
    ]

    try:
        client = create_iflow_client()

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
        )

        return {
            "success": True,
            "translation": response.choices[0].message.content,
            "source_lang": source_lang,
            "target_lang": target_lang,
            "model": model,
        }
    except Exception as e:
        logger.error(f"iFlow translation error: {e}")
        return {"success": False, "error": str(e)}


async def tool_summarize(
    text: str,
    style: str = "concise",
    max_length: int | None = None,
    model: str | None = None,
) -> dict[str, Any]:
    """
    Summarize text using iFlow model.

    Args:
        text: Text to summarize
        style: Summary style (concise, detailed, bullet_points)
        max_length: Maximum summary length in words
        model: Model to use (default: deepseek-v3)

    Returns:
        Dict with summary result
    """
    if not is_iflow_enabled():
        return {"error": "iFlow is not enabled", "success": False}

    config = get_iflow_config()
    model = model or config.model

    style_instructions = {
        "concise": "Provide a brief, concise summary in 2-3 sentences.",
        "detailed": "Provide a comprehensive summary covering all key points.",
        "bullet_points": "Summarize using bullet points for key takeaways.",
    }

    instruction = style_instructions.get(style, style_instructions["concise"])
    if max_length:
        instruction += f" Keep the summary under {max_length} words."

    messages = [
        {
            "role": "system",
            "content": f"You are an expert at summarizing content. {instruction}",
        },
        {"role": "user", "content": f"Summarize the following:\n\n{text}"},
    ]

    try:
        client = create_iflow_client()

        response = client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.3,
        )

        return {
            "success": True,
            "summary": response.choices[0].message.content,
            "style": style,
            "model": model,
        }
    except Exception as e:
        logger.error(f"iFlow summarization error: {e}")
        return {"success": False, "error": str(e)}


# Tool registry for MCP server
IFLOW_TOOLS = {
    "chat": {
        "name": "mcp__iflow__chat",
        "description": "Chat with iFlow models (DeepSeek, Qwen3, Kimi K2, etc.)",
        "handler": tool_chat,
        "parameters": {
            "type": "object",
            "properties": {
                "messages": {
                    "type": "array",
                    "items": {
                        "type": "object",
                        "properties": {
                            "role": {"type": "string", "enum": ["user", "assistant", "system"]},
                            "content": {"type": "string"},
                        },
                        "required": ["role", "content"],
                    },
                    "description": "Chat messages",
                },
                "model": {
                    "type": "string",
                    "description": f"Model to use. Available: {', '.join(MODEL_CONFIGS.keys())}",
                },
                "temperature": {
                    "type": "number",
                    "description": "Sampling temperature (0-2)",
                    "default": 0.7,
                },
                "max_tokens": {
                    "type": "integer",
                    "description": "Maximum tokens in response",
                },
            },
            "required": ["messages"],
        },
    },
    "code_complete": {
        "name": "mcp__iflow__code_complete",
        "description": "Code completion using iFlow models",
        "handler": tool_code_complete,
        "parameters": {
            "type": "object",
            "properties": {
                "code": {
                    "type": "string",
                    "description": "Code context/prefix to complete",
                },
                "language": {
                    "type": "string",
                    "description": "Programming language",
                    "default": "python",
                },
                "instruction": {
                    "type": "string",
                    "description": "Optional instruction for completion",
                },
                "model": {
                    "type": "string",
                    "description": "Model to use (default: qwen3-coder)",
                },
            },
            "required": ["code"],
        },
    },
    "translate": {
        "name": "mcp__iflow__translate",
        "description": "Translate text using iFlow models (especially good for Chinese)",
        "handler": tool_translate,
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Text to translate",
                },
                "source_lang": {
                    "type": "string",
                    "description": "Source language (default: auto-detect)",
                    "default": "auto",
                },
                "target_lang": {
                    "type": "string",
                    "description": "Target language",
                    "default": "en",
                },
                "model": {
                    "type": "string",
                    "description": "Model to use",
                },
            },
            "required": ["text"],
        },
    },
    "summarize": {
        "name": "mcp__iflow__summarize",
        "description": "Summarize text using iFlow models",
        "handler": tool_summarize,
        "parameters": {
            "type": "object",
            "properties": {
                "text": {
                    "type": "string",
                    "description": "Text to summarize",
                },
                "style": {
                    "type": "string",
                    "enum": ["concise", "detailed", "bullet_points"],
                    "description": "Summary style",
                    "default": "concise",
                },
                "max_length": {
                    "type": "integer",
                    "description": "Maximum summary length in words",
                },
                "model": {
                    "type": "string",
                    "description": "Model to use",
                },
            },
            "required": ["text"],
        },
    },
}


def get_tool_definitions() -> list[dict]:
    """Get tool definitions for MCP server registration."""
    return [
        {
            "name": tool["name"],
            "description": tool["description"],
            "inputSchema": tool["parameters"],
        }
        for tool in IFLOW_TOOLS.values()
    ]


async def handle_tool_call(tool_name: str, arguments: dict) -> dict:
    """
    Handle a tool call from MCP server.

    Args:
        tool_name: Name of the tool (e.g., "mcp__iflow__chat")
        arguments: Tool arguments

    Returns:
        Tool execution result
    """
    # Strip MCP prefix if present
    short_name = tool_name.replace("mcp__iflow__", "")

    if short_name not in IFLOW_TOOLS:
        return {"success": False, "error": f"Unknown tool: {tool_name}"}

    tool = IFLOW_TOOLS[short_name]
    handler = tool["handler"]

    try:
        result = await handler(**arguments)
        return result
    except Exception as e:
        logger.error(f"Error executing {tool_name}: {e}")
        return {"success": False, "error": str(e)}
