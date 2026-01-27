"""
Generic MCP Stdio Client
========================

Communicates with MCP servers via stdio JSON-RPC 2.0 protocol.
Used to bridge Auto-Claude to existing MCP servers like jira-mcp.

This allows reusing existing MCP server configurations and authentication
rather than duplicating API integrations.
"""

import asyncio
import json
import logging
import os
from dataclasses import dataclass, field
from typing import Any, Optional

logger = logging.getLogger(__name__)


@dataclass
class MCPServerConfig:
    """Configuration for an MCP server."""

    command: str  # Path to start.sh or executable
    args: list[str] = field(default_factory=list)
    env: dict[str, str] = field(default_factory=dict)
    working_dir: str | None = None

    @classmethod
    def from_claude_settings(
        cls, server_name: str, settings_path: str = None
    ) -> Optional["MCPServerConfig"]:
        """
        Load MCP server config from Claude Code settings.json.

        Args:
            server_name: Name of the MCP server (e.g., "jira-mcp")
            settings_path: Path to settings.json (defaults to ~/.claude/settings.json)

        Returns:
            MCPServerConfig or None if not found
        """
        if settings_path is None:
            settings_path = os.path.expanduser("~/.claude/settings.json")

        try:
            with open(settings_path, encoding="utf-8") as f:
                settings = json.load(f)

            servers = settings.get("mcpServers", {})
            server_config = servers.get(server_name)

            if not server_config:
                return None

            return cls(
                command=server_config.get("command", ""),
                args=server_config.get("args", []),
                env=server_config.get("env", {}),
            )
        except (OSError, json.JSONDecodeError) as e:
            logger.warning(f"Failed to load MCP config from {settings_path}: {e}")
            return None


class MCPError(Exception):
    """Error from MCP server."""

    def __init__(self, error_data: dict[str, Any]):
        self.code = error_data.get("code", -1)
        self.message = error_data.get("message", "Unknown error")
        self.data = error_data.get("data")
        super().__init__(self.message)


class MCPClient:
    """
    Async client for communicating with MCP servers via stdio.
    Uses JSON-RPC 2.0 protocol as per MCP specification.
    """

    def __init__(self, config: MCPServerConfig):
        self.config = config
        self.process: asyncio.subprocess.Process | None = None
        self._request_id = 0
        self._lock = asyncio.Lock()
        self._connected = False
        self._tools: list[dict[str, Any]] = []

    async def connect(self) -> None:
        """Start the MCP server process and initialize connection."""
        if self._connected:
            return

        # Prepare environment
        env = os.environ.copy()
        if self.config.env:
            env.update(self.config.env)

        # Expand command path
        command = os.path.expanduser(self.config.command)

        logger.info(f"Starting MCP server: {command}")

        self.process = await asyncio.create_subprocess_exec(
            command,
            *self.config.args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=env,
            cwd=self.config.working_dir,
        )

        # Initialize MCP connection per protocol spec
        init_result = await self._send_request(
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {"tools": {}},
                "clientInfo": {"name": "auto-claude-mcp-bridge", "version": "1.0.0"},
            },
        )

        logger.debug(f"MCP initialize result: {init_result}")

        # Send initialized notification
        await self._send_notification("notifications/initialized", {})

        self._connected = True
        logger.info(f"Connected to MCP server: {self.config.command}")

    async def disconnect(self) -> None:
        """Stop the MCP server process."""
        if self.process:
            try:
                self.process.terminate()
                await asyncio.wait_for(self.process.wait(), timeout=5.0)
            except asyncio.TimeoutError:
                self.process.kill()
                await self.process.wait()
            finally:
                self.process = None
                self._connected = False
                logger.info("Disconnected from MCP server")

    async def list_tools(self) -> list[dict[str, Any]]:
        """Get list of available tools from the MCP server."""
        if self._tools:
            return self._tools

        result = await self._send_request("tools/list", {})
        self._tools = result.get("tools", [])
        return self._tools

    async def call_tool(self, name: str, arguments: dict[str, Any] = None) -> Any:
        """
        Call a tool on the MCP server.

        Args:
            name: Tool name (e.g., "jira_search_issues")
            arguments: Tool arguments

        Returns:
            Parsed tool result
        """
        if arguments is None:
            arguments = {}

        result = await self._send_request(
            "tools/call", {"name": name, "arguments": arguments}
        )

        # Parse content from MCP response
        content = result.get("content", [])
        if content and len(content) > 0:
            first_content = content[0]
            if first_content.get("type") == "text":
                text = first_content.get("text", "{}")
                try:
                    return json.loads(text)
                except json.JSONDecodeError:
                    return text

        return result

    async def _send_request(
        self, method: str, params: dict[str, Any]
    ) -> dict[str, Any]:
        """Send a JSON-RPC request and wait for response."""
        if not self.process or not self.process.stdin or not self.process.stdout:
            raise MCPError({"code": -1, "message": "Not connected to MCP server"})

        async with self._lock:
            self._request_id += 1
            request = {
                "jsonrpc": "2.0",
                "id": self._request_id,
                "method": method,
                "params": params,
            }

            request_line = json.dumps(request) + "\n"
            self.process.stdin.write(request_line.encode())
            await self.process.stdin.drain()

            # Read response line
            response_line = await self.process.stdout.readline()
            if not response_line:
                raise MCPError(
                    {"code": -1, "message": "Empty response from MCP server"}
                )

            try:
                response = json.loads(response_line.decode())
            except json.JSONDecodeError as e:
                raise MCPError({"code": -1, "message": f"Invalid JSON response: {e}"})

            if "error" in response:
                raise MCPError(response["error"])

            return response.get("result", {})

    async def _send_notification(self, method: str, params: dict[str, Any]) -> None:
        """Send a JSON-RPC notification (no response expected)."""
        if not self.process or not self.process.stdin:
            return

        notification = {"jsonrpc": "2.0", "method": method, "params": params}

        notification_line = json.dumps(notification) + "\n"
        self.process.stdin.write(notification_line.encode())
        await self.process.stdin.drain()

    @property
    def is_connected(self) -> bool:
        """Check if connected to MCP server."""
        return self._connected and self.process is not None

    async def __aenter__(self) -> "MCPClient":
        await self.connect()
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> None:
        await self.disconnect()
