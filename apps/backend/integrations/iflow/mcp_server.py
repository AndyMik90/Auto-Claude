"""
iFlow MCP Server
================

MCP server implementation for iFlow integration.

This server provides iFlow-specific tools to Claude Agent SDK sessions,
enabling hybrid model usage where iFlow models are more suitable.

Usage:
    python -m integrations.iflow.mcp_server

Or via MCP server configuration:
    {
        "type": "command",
        "command": "python",
        "args": ["-m", "integrations.iflow.mcp_server"]
    }
"""

import asyncio
import json
import logging
import sys
from typing import Any

from .config import get_iflow_config, is_iflow_enabled
from .tools import get_tool_definitions, handle_tool_call

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    stream=sys.stderr,
)
logger = logging.getLogger(__name__)


class IFlowMCPServer:
    """MCP server for iFlow integration."""

    def __init__(self):
        self.tools = get_tool_definitions()

    async def handle_request(self, request: dict) -> dict:
        """
        Handle an MCP request.

        Args:
            request: MCP request dict

        Returns:
            MCP response dict
        """
        method = request.get("method", "")
        request_id = request.get("id")

        if method == "initialize":
            return self._handle_initialize(request_id)
        elif method == "tools/list":
            return self._handle_tools_list(request_id)
        elif method == "tools/call":
            return await self._handle_tools_call(request_id, request.get("params", {}))
        else:
            return self._error_response(request_id, f"Unknown method: {method}")

    def _handle_initialize(self, request_id: Any) -> dict:
        """Handle initialize request."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "serverInfo": {
                    "name": "iflow-mcp-server",
                    "version": "1.0.0",
                },
                "capabilities": {
                    "tools": {},
                },
            },
        }

    def _handle_tools_list(self, request_id: Any) -> dict:
        """Handle tools/list request."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "result": {"tools": self.tools},
        }

    async def _handle_tools_call(self, request_id: Any, params: dict) -> dict:
        """Handle tools/call request."""
        tool_name = params.get("name", "")
        arguments = params.get("arguments", {})

        if not is_iflow_enabled():
            return self._error_response(
                request_id,
                "iFlow is not enabled. Set IFLOW_ENABLED=true and IFLOW_API_KEY.",
            )

        result = await handle_tool_call(tool_name, arguments)

        if result.get("success", False):
            return {
                "jsonrpc": "2.0",
                "id": request_id,
                "result": {"content": [{"type": "text", "text": json.dumps(result)}]},
            }
        else:
            return self._error_response(
                request_id, result.get("error", "Unknown error")
            )

    def _error_response(self, request_id: Any, message: str) -> dict:
        """Create an error response."""
        return {
            "jsonrpc": "2.0",
            "id": request_id,
            "error": {"code": -32603, "message": message},
        }


async def run_server():
    """Run the MCP server using stdio transport."""
    server = IFlowMCPServer()

    logger.info("iFlow MCP server starting...")

    # Check if iFlow is enabled
    if not is_iflow_enabled():
        config = get_iflow_config()
        if not config.enabled:
            logger.warning("iFlow is not enabled (IFLOW_ENABLED != true)")
        elif not config.api_key:
            logger.warning("iFlow API key not configured (IFLOW_API_KEY not set)")

    # Read from stdin, write to stdout
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)

    loop = asyncio.get_event_loop()
    await loop.connect_read_pipe(lambda: protocol, sys.stdin)

    # Process requests
    buffer = ""
    while True:
        try:
            # Read a line from stdin
            line = await reader.readline()
            if not line:
                break

            line = line.decode("utf-8").strip()
            if not line:
                continue

            # Parse JSON-RPC request
            try:
                request = json.loads(line)
            except json.JSONDecodeError as e:
                logger.error(f"Invalid JSON: {e}")
                continue

            # Handle request
            response = await server.handle_request(request)

            # Write response to stdout
            response_json = json.dumps(response)
            sys.stdout.write(response_json + "\n")
            sys.stdout.flush()

        except Exception as e:
            logger.error(f"Error processing request: {e}")


def main():
    """Main entry point."""
    try:
        asyncio.run(run_server())
    except KeyboardInterrupt:
        logger.info("Server stopped by user")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
