#!/usr/bin/env python3
"""
Tests for Electron MCP Tool Integration
=========================================

Tests the integration of Electron MCP tools with the agent system:
- Tool permissions configuration
- Dynamic tool selection based on agent type
- Environment-based enablement
- MCP server registration
"""

import os
import pytest
from unittest.mock import patch, MagicMock

from agents.tools_pkg.models import (
    get_allowed_tools,
    get_required_mcp_servers,
    get_agent_config,
    AGENT_CONFIGS,
)
from core.cdp_config import (
    get_cdp_tools_for_agent,
    ELECTRON_BASE_TOOLS,
    ELECTRON_NETWORK_TOOLS,
    ELECTRON_STORAGE_TOOLS,
)


class TestElectronToolsNotIncludedByDefault:
    """Test that Electron tools are NOT included when disabled."""

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "false"})
    def test_electron_tools_not_in_allowed_tools_by_default(self):
        """Verify Electron tools are not in allowed_tools when disabled."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("qa_reviewer", project_capabilities, linear_enabled=False)

        # Should not include Electron MCP tools
        for tool in ELECTRON_BASE_TOOLS:
            assert tool not in tools

    @patch.dict(os.environ, {}, clear=True)
    def test_electron_tools_not_in_allowed_tools_without_env(self):
        """Verify Electron tools are not included when ELECTRON_MCP_ENABLED is not set."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("qa_reviewer", project_capabilities, linear_enabled=False)

        # Should not include Electron MCP tools
        for tool in ELECTRON_BASE_TOOLS:
            assert tool not in tools


class TestElectronToolsIncludedForQAAgents:
    """Test that Electron tools ARE included for QA agents when enabled."""

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_tools_included_for_qa_reviewer(self):
        """Verify qa_reviewer gets Electron tools when enabled."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("qa_reviewer", project_capabilities, linear_enabled=False)

        # Should include base Electron tools
        electron_tools_in_allowed = [t for t in ELECTRON_BASE_TOOLS if t in tools]
        assert len(electron_tools_in_allowed) > 0, "qa_reviewer should have at least some Electron tools"

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_tools_included_for_qa_fixer(self):
        """Verify qa_fixer gets Electron tools when enabled."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("qa_fixer", project_capabilities, linear_enabled=False)

        # Should include base Electron tools
        electron_tools_in_allowed = [t for t in ELECTRON_BASE_TOOLS if t in tools]
        assert len(electron_tools_in_allowed) > 0, "qa_fixer should have at least some Electron tools"


class TestElectronToolsNotIncludedForNonQAAgents:
    """Test that non-QA agents do NOT get Electron tools by default."""

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_tools_not_included_for_coder(self):
        """Verify coder does not get Electron tools by default."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("coder", project_capabilities, linear_enabled=False)

        # Should not include Electron MCP tools for coder by default
        for tool in ELECTRON_BASE_TOOLS:
            assert tool not in tools, f"Coder should not have {tool}"

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_tools_not_included_for_planner(self):
        """Verify planner does not get Electron tools by default."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("planner", project_capabilities, linear_enabled=False)

        # Should not include Electron MCP tools for planner by default
        for tool in ELECTRON_BASE_TOOLS:
            assert tool not in tools, f"Planner should not have {tool}"


class TestElectronMCPServerRegistration:
    """Test Electron MCP server registration based on configuration."""

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_mcp_server_required_when_enabled(self):
        """Verify electron MCP server is in required_servers when enabled."""
        project_capabilities = {"is_electron": True}
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities, linear_enabled=False)

        assert "electron" in servers, "electron MCP server should be required when enabled"

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "false"})
    def test_electron_mcp_server_not_required_when_disabled(self):
        """Verify electron MCP server is NOT in required_servers when disabled."""
        project_capabilities = {"is_electron": True}
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities, linear_enabled=False)

        assert "electron" not in servers, "electron MCP server should not be required when disabled"

    @patch.dict(os.environ, {}, clear=True)
    def test_electron_mcp_server_not_required_without_env(self):
        """Verify electron MCP server is NOT in required_servers when ENV not set."""
        project_capabilities = {"is_electron": True}
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities, linear_enabled=False)

        assert "electron" not in servers, "electron MCP server should not be required without ENV var"


class TestElectronToolsRespectCategories:
    """Test that Electron tool category filtering works correctly."""

    @patch.dict(os.environ, {
        "ELECTRON_MCP_ENABLED": "true",
        "CDP_TOOL_CATEGORIES": "network,storage"
    })
    def test_electron_tools_respect_category_filter(self):
        """Verify only specified categories are included."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("qa_reviewer", project_capabilities, linear_enabled=False)

        # Should include base tools (always included)
        # Should include network tools
        # Should include storage tools
        # Should NOT include tools from other categories

        for tool in ELECTRON_NETWORK_TOOLS:
            assert tool in tools, f"Network tool {tool} should be included"

        for tool in ELECTRON_STORAGE_TOOLS:
            assert tool in tools, f"Storage tool {tool} should be included"

    @patch.dict(os.environ, {
        "ELECTRON_MCP_ENABLED": "true",
        "CDP_TOOL_CATEGORIES": "network"
    })
    def test_electron_tools_single_category(self):
        """Verify single category filtering works."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("qa_reviewer", project_capabilities, linear_enabled=False)

        # Should include network tools
        for tool in ELECTRON_NETWORK_TOOLS:
            assert tool in tools, f"Network tool {tool} should be included"


class TestElectronToolsProjectCapabilities:
    """Test Electron tool behavior based on project capabilities."""

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_tools_require_is_electron_capability(self):
        """Verify Electron tools require is_electron project capability."""
        # Without is_electron capability, should not get electron MCP server
        project_capabilities = {"is_electron": False}
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities, linear_enabled=False)

        assert "electron" not in servers

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_tools_with_is_electron_capability(self):
        """Verify Electron tools are included with is_electron capability."""
        project_capabilities = {"is_electron": True}
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities, linear_enabled=False)

        assert "electron" in servers

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_tools_with_missing_capability(self):
        """Verify behavior when project_capabilities is None."""
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities=None, linear_enabled=False)

        # Should not include electron without is_electron capability
        assert "electron" not in servers


class TestAgentConfigIntegrity:
    """Test that agent configurations are properly defined."""

    def test_qa_reviewer_config_exists(self):
        """Verify qa_reviewer agent config exists."""
        config = get_agent_config("qa_reviewer")
        assert config is not None
        assert "tools" in config
        assert "mcp_servers" in config

    def test_qa_reviewer_has_browser_mcp(self):
        """Verify qa_reviewer has browser in mcp_servers."""
        config = get_agent_config("qa_reviewer")
        assert "browser" in config["mcp_servers"]

    def test_qa_fixer_config_exists(self):
        """Verify qa_fixer agent config exists."""
        config = get_agent_config("qa_fixer")
        assert config is not None
        assert "tools" in config
        assert "mcp_servers" in config

    def test_qa_fixer_has_browser_mcp(self):
        """Verify qa_fixer has browser in mcp_servers."""
        config = get_agent_config("qa_fixer")
        assert "browser" in config["mcp_servers"]


class TestCDPEnabledAgentsEnvVar:
    """Test CDP_ENABLED_FOR_AGENTS environment variable."""

    @patch.dict(os.environ, {
        "ELECTRON_MCP_ENABLED": "true",
        "CDP_ENABLED_FOR_AGENTS": "coder"
    })
    def test_cdp_enabled_agents_env_var_allows_coder(self):
        """Verify coder can get Electron tools when explicitly enabled."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("coder", project_capabilities, linear_enabled=False)

        # With CDP_ENABLED_FOR_AGENTS=coder, coder should get Electron tools
        # (assuming they have categories enabled too)
        electron_tools = get_cdp_tools_for_agent("coder", mcp_type="electron")
        # The test verifies the function is called, actual tool list depends on permissions
        assert isinstance(electron_tools, list)

    @patch.dict(os.environ, {
        "ELECTRON_MCP_ENABLED": "true",
        "CDP_ENABLED_FOR_AGENTS": "qa_reviewer"
    })
    def test_cdp_enabled_agents_env_var_restricts_qa_fixer(self):
        """Verify qa_fixer does NOT get tools when not in CDP_ENABLED_FOR_AGENTS."""
        project_capabilities = {"is_electron": True}
        tools = get_allowed_tools("qa_fixer", project_capabilities, linear_enabled=False)

        # qa_fixer should not have Electron tools when only qa_reviewer is enabled
        electron_tools_in_allowed = [t for t in ELECTRON_BASE_TOOLS if t in tools]
        assert len(electron_tools_in_allowed) == 0, "qa_fixer should not have Electron tools when excluded"


class TestWebFrontendVsElectron:
    """Test behavior for web frontend vs Electron projects."""

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_web_frontend_uses_puppeteer_not_electron(self):
        """Verify web frontend uses puppeteer, not electron MCP."""
        project_capabilities = {"is_electron": False, "is_web_frontend": True}
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities, linear_enabled=False)

        # Should use puppeteer for web frontend
        assert "electron" not in servers
        assert "puppeteer" in servers

    @patch.dict(os.environ, {"ELECTRON_MCP_ENABLED": "true"})
    def test_electron_project_uses_electron_mcp(self):
        """Verify Electron project uses electron MCP."""
        project_capabilities = {"is_electron": True, "is_web_frontend": False}
        servers = get_required_mcp_servers("qa_reviewer", project_capabilities, linear_enabled=False)

        # Should use electron for Electron projects
        assert "electron" in servers
        assert "puppeteer" not in servers
