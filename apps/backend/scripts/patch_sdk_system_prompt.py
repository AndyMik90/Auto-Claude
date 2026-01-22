#!/usr/bin/env python3
"""
Runtime monkey-patch to add CLAUDE_SYSTEM_PROMPT_FILE support to claude-agent-sdk.

This module provides a runtime patch for the SDK's subprocess_cli.py to support
reading system prompt from a file specified via CLAUDE_SYSTEM_PROMPT_FILE environment
variable.

This is a workaround for the lack of --system-prompt-file support in the SDK.
See: https://github.com/AndyMik90/Auto-Claude/issues/384

Usage:
    from scripts.patch_sdk_system_prompt import apply_sdk_patch
    apply_sdk_patch()

IMPLEMENTATION NOTES:
This patch relies on the following SDK internals which may change in future versions:
- SubprocessCLITransport._stdin_stream: The async stream for writing to subprocess stdin
- SSE message format: "event: message\\ndata: <json>\\n\\n" for sending messages

If these internals change, the patch will fail with explicit errors rather than
silently ignoring the system prompt.

Tested with claude-agent-sdk versions: 0.x.x
"""

import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)


def apply_sdk_patch():
    """
    Apply a runtime monkey-patch to the SDK's SubprocessCLITransport
    to support CLAUDE_SYSTEM_PROMPT_FILE environment variable.

    This patches both _build_command to remove system_prompt from args,
    and connect() to write it to stdin, avoiding ARG_MAX limits.

    This function is idempotent - subsequent calls will skip patching
    if already applied.
    """
    try:
        from claude_agent_sdk._internal.transport.subprocess_cli import (
            SubprocessCLITransport,
        )
    except ImportError:
        # SDK not available, skip patching
        return

    # Check if already patched by looking for our marker attribute
    if hasattr(SubprocessCLITransport, "_auto_claude_patched"):
        return

    # Patch __init__ to capture the prompt file path during client creation
    original_init = SubprocessCLITransport.__init__

    def patched_init(self, prompt, options):
        """Patch __init__ to capture CLAUDE_SYSTEM_PROMPT_FILE from env var."""
        # Call original __init__
        original_init(self, prompt, options)

        # Check for CLAUDE_SYSTEM_PROMPT_FILE environment variable
        # Store directly on instance to avoid race conditions
        system_prompt_file = os.environ.get("CLAUDE_SYSTEM_PROMPT_FILE")
        if system_prompt_file and Path(system_prompt_file).exists():
            self._auto_claude_prompt_file = system_prompt_file
            # Clear the env var after capturing - prevents other clients from using it
            os.environ.pop("CLAUDE_SYSTEM_PROMPT_FILE", None)
        else:
            self._auto_claude_prompt_file = None

    # Store original methods
    original_build_command = SubprocessCLITransport._build_command
    original_connect = SubprocessCLITransport.connect

    def patched_build_command(self) -> list[str]:
        """
        Patched version of _build_command that removes --system-prompt.

        This avoids ARG_MAX limits by not passing large prompts as command-line args.
        """
        cmd = original_build_command(self)

        # Check if this transport instance has a prompt file (set in patched_init)
        if hasattr(self, "_auto_claude_prompt_file") and self._auto_claude_prompt_file:
            # Remove --system-prompt argument from command to avoid ARG_MAX
            # The prompt will be sent via stdin in patched_connect instead
            new_cmd = []
            i = 0
            while i < len(cmd):
                if cmd[i] == "--system-prompt" and i + 1 < len(cmd):
                    # Skip both the flag and its value
                    i += 2
                else:
                    new_cmd.append(cmd[i])
                    i += 1
            cmd = new_cmd

        return cmd

    async def patched_connect(self):
        """
        Patched version of connect() that handles system prompt files.

        Reads the system prompt from the file path stored on the instance
        (by patched_build_command) and writes it to subprocess stdin before
        any user messages, avoiding ARG_MAX limits.

        The instance attribute approach avoids race conditions when multiple
        clients are created concurrently.

        Raises:
            RuntimeError: If system prompt was expected but _stdin_stream is not available,
                          indicating SDK internals may have changed.
        """
        system_prompt_content = None

        # Read from instance attribute set by patched_build_command
        # This avoids race conditions with concurrent client creation
        system_prompt_file = getattr(self, "_auto_claude_prompt_file", None)

        if system_prompt_file:
            if not Path(system_prompt_file).exists():
                # TOCTOU: File was deleted between _build_command and connect
                logger.warning(
                    f"System prompt file {system_prompt_file} was expected but no longer exists. "
                    f"The agent will run without the large system prompt. "
                    f"This may indicate the temp file was cleaned up prematurely."
                )
                self._auto_claude_prompt_file = None
            else:
                try:
                    with open(system_prompt_file, encoding="utf-8") as f:
                        system_prompt_content = f.read()
                    logger.info(
                        f"Read system prompt from file ({len(system_prompt_content)} chars)"
                    )
                except OSError as e:
                    logger.error(
                        f"Failed to read system prompt file {system_prompt_file}: {e}"
                    )
                    raise
                finally:
                    # Clear the instance attribute after reading
                    self._auto_claude_prompt_file = None

        # Call original connect to start the subprocess
        await original_connect(self)

        # If we have system prompt content, write it to stdin
        # This must be done before any user messages are sent
        if system_prompt_content:
            if not hasattr(self, "_stdin_stream"):
                raise RuntimeError(
                    "System prompt file was set but SubprocessCLITransport._stdin_stream "
                    "not found after connect(). SDK internals may have changed. "
                    "This patch requires the _stdin_stream attribute to inject the system prompt. "
                    "Please report this issue at: https://github.com/AndyMik90/Auto-Claude/issues/384"
                )

            if not self._stdin_stream:
                raise RuntimeError(
                    "System prompt file was set but _stdin_stream is None/empty. "
                    "This may indicate the SDK changed its subprocess handling."
                )

            try:
                import json

                # SSE (Server-Sent Events) format used by SDK for message communication
                # Format: event: message\ndata: <json>\n\n
                # We send the system prompt with role="system" to ensure it's interpreted correctly
                # The CLI's stdin protocol should accept system-role messages
                message_data = {
                    "type": "message",
                    "message": {
                        "role": "system",
                        "content": system_prompt_content,
                    },
                }

                sse_message = f"event: message\ndata: {json.dumps(message_data)}\n\n"
                await self._stdin_stream.send(sse_message)
                logger.debug("System prompt injected via stdin successfully")
            except Exception as e:
                logger.error(
                    f"Failed to write system prompt to subprocess stdin: {e}. "
                    f"System prompt ({len(system_prompt_content)} chars) was not delivered."
                )
                raise

    # Apply the monkey-patches
    SubprocessCLITransport.__init__ = patched_init
    SubprocessCLITransport._build_command = patched_build_command
    SubprocessCLITransport.connect = patched_connect

    # Set marker attribute to indicate patch has been applied
    SubprocessCLITransport._auto_claude_patched = True


# Auto-apply patch on import
apply_sdk_patch()
