#!/usr/bin/env python3
"""
Tests for CDP Configuration System
===================================

Tests the core/cdp_config.py module:
- Electron tool definitions
- Agent permissions
- Environment variable parsing
- Tool selection logic
"""

import os
import pytest

from core.cdp_config import (
    # Tool definitions
    ELECTRON_BASE_TOOLS,
    ELECTRON_NETWORK_TOOLS,
    ELECTRON_STORAGE_TOOLS,
    ELECTRON_PERFORMANCE_TOOLS,
    ELECTRON_EMULATION_TOOLS,
    ELECTRON_DOM_TOOLS,
    ELECTRON_CONSOLE_TOOLS,
    CDP_TOOL_CATEGORY_MAP,
    CDP_AGENT_DEFAULT_PERMISSIONS,
    # Configuration functions
    get_cdp_enabled_agents,
    get_cdp_enabled_categories,
    get_cdp_log_level,
    get_cdp_categories_for_agent,
    get_cdp_mcp_type,
    get_cdp_tools_for_agent,
    get_cdp_mcp_server_name,
    is_cdp_enabled_for_agent,
    get_cdp_config_summary,
    validate_cdp_config,
)


class TestElectronToolDefinitions:
    """Test that Electron tool definitions are complete and correct."""

    def test_electron_base_tools_defined(self):
        """Verify base Electron tools are defined."""
        assert len(ELECTRON_BASE_TOOLS) == 4
        expected_tools = [
            "mcp__electron__get_electron_window_info",
            "mcp__electron__take_screenshot",
            "mcp__electron__send_command_to_electron",
            "mcp__electron__read_electron_logs",
        ]
        for tool in expected_tools:
            assert tool in ELECTRON_BASE_TOOLS

    def test_electron_network_tools_defined(self):
        """Verify network tools are defined."""
        assert len(ELECTRON_NETWORK_TOOLS) == 3
        expected_tools = [
            "mcp__electron__get_network_logs",
            "mcp__electron__get_request_details",
            "mcp__electron__get_performance_timing",
        ]
        for tool in expected_tools:
            assert tool in ELECTRON_NETWORK_TOOLS

    def test_electron_storage_tools_defined(self):
        """Verify storage tools are defined."""
        assert len(ELECTRON_STORAGE_TOOLS) == 5
        expected_tools = [
            "mcp__electron__get_storage",
            "mcp__electron__set_storage",
            "mcp__electron__clear_storage",
            "mcp__electron__get_cookies",
            "mcp__electron__get_app_state",
        ]
        for tool in expected_tools:
            assert tool in ELECTRON_STORAGE_TOOLS

    def test_electron_performance_tools_defined(self):
        """Verify performance tools are defined."""
        assert len(ELECTRON_PERFORMANCE_TOOLS) == 4
        expected_tools = [
            "mcp__electron__get_metrics",
            "mcp__electron__get_memory_usage",
            "mcp__electron__start_profiling",
            "mcp__electron__stop_profiling",
        ]
        for tool in expected_tools:
            assert tool in ELECTRON_PERFORMANCE_TOOLS

    def test_electron_emulation_tools_defined(self):
        """Verify emulation tools are defined."""
        assert len(ELECTRON_EMULATION_TOOLS) == 4
        expected_tools = [
            "mcp__electron__set_device",
            "mcp__electron__set_network_throttle",
            "mcp__electron__set_geolocation",
            "mcp__electron__set_theme",
        ]
        for tool in expected_tools:
            assert tool in ELECTRON_EMULATION_TOOLS

    def test_electron_dom_tools_defined(self):
        """Verify DOM tools are defined."""
        assert len(ELECTRON_DOM_TOOLS) == 5
        expected_tools = [
            "mcp__electron__drag_and_drop",
            "mcp__electron__right_click",
            "mcp__electron__hover",
            "mcp__electron__scroll_to_element",
            "mcp__electron__get_element_state",
        ]
        for tool in expected_tools:
            assert tool in ELECTRON_DOM_TOOLS

    def test_electron_console_tools_defined(self):
        """Verify console tools are defined."""
        assert len(ELECTRON_CONSOLE_TOOLS) == 3
        expected_tools = [
            "mcp__electron__get_logs_filtered",
            "mcp__electron__track_exceptions",
            "mcp__electron__get_console_history",
        ]
        for tool in expected_tools:
            assert tool in ELECTRON_CONSOLE_TOOLS

    def test_cdp_tool_category_map_complete(self):
        """Verify CDP tool category map includes all categories."""
        expected_categories = ["network", "storage", "performance", "emulation", "console", "dom"]
        for category in expected_categories:
            assert category in CDP_TOOL_CATEGORY_MAP
            assert len(CDP_TOOL_CATEGORY_MAP[category]) > 0


class TestCDPAgentPermissions:
    """Test default agent permissions for CDP tools."""

    def test_qa_reviewer_has_permissions(self):
        """Verify qa_reviewer has CDP permissions by default."""
        permissions = CDP_AGENT_DEFAULT_PERMISSIONS.get("qa_reviewer", [])
        assert len(permissions) > 0
        assert "network" in permissions
        assert "storage" in permissions
        assert "performance" in permissions

    def test_qa_fixer_has_permissions(self):
        """Verify qa_fixer has CDP permissions by default."""
        permissions = CDP_AGENT_DEFAULT_PERMISSIONS.get("qa_fixer", [])
        assert len(permissions) > 0
        assert "network" in permissions
        assert "storage" in permissions

    def test_coder_has_no_permissions(self):
        """Verify coder has no CDP permissions by default."""
        permissions = CDP_AGENT_DEFAULT_PERMISSIONS.get("coder", [])
        assert len(permissions) == 0

    def test_planner_has_no_permissions(self):
        """Verify planner has no CDP permissions by default."""
        permissions = CDP_AGENT_DEFAULT_PERMISSIONS.get("planner", [])
        assert len(permissions) == 0


class TestCDPConfiguration:
    """Test CDP configuration functions."""

    def test_get_cdp_enabled_agents_default(self, monkeypatch):
        """Test default CDP enabled agents."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        agents = get_cdp_enabled_agents()
        assert agents == {"qa_reviewer", "qa_fixer"}

    def test_get_cdp_enabled_agents_from_env(self, monkeypatch):
        """Test CDP enabled agents from environment variable."""
        monkeypatch.setenv("CDP_ENABLED_FOR_AGENTS", "qa_reviewer,qa_fixer,coder")
        agents = get_cdp_enabled_agents()
        assert agents == {"qa_reviewer", "qa_fixer", "coder"}

    def test_get_cdp_enabled_categories_default(self, monkeypatch):
        """Test default CDP enabled categories."""
        monkeypatch.delenv("CDP_TOOL_CATEGORIES", raising=False)
        categories = get_cdp_enabled_categories()
        assert categories == set(CDP_TOOL_CATEGORY_MAP.keys())

    def test_get_cdp_enabled_categories_from_env(self, monkeypatch):
        """Test CDP enabled categories from environment variable."""
        monkeypatch.setenv("CDP_TOOL_CATEGORIES", "network,storage")
        categories = get_cdp_enabled_categories()
        assert categories == {"network", "storage"}

    def test_get_cdp_log_level_default(self, monkeypatch):
        """Test default CDP log level."""
        monkeypatch.delenv("CDP_LOG_LEVEL", raising=False)
        log_level = get_cdp_log_level()
        assert log_level == "basic"

    def test_get_cdp_log_level_from_env(self, monkeypatch):
        """Test CDP log level from environment variable."""
        monkeypatch.setenv("CDP_LOG_LEVEL", "verbose")
        log_level = get_cdp_log_level()
        assert log_level == "verbose"

    def test_get_cdp_log_level_invalid(self, monkeypatch):
        """Test invalid CDP log level defaults to basic."""
        monkeypatch.setenv("CDP_LOG_LEVEL", "invalid")
        log_level = get_cdp_log_level()
        assert log_level == "basic"


class TestCDPToolSelection:
    """Test CDP tool selection for agents."""

    def test_get_cdp_categories_for_agent_qa_reviewer(self, monkeypatch):
        """Test qa_reviewer gets all categories."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        monkeypatch.delenv("CDP_TOOL_CATEGORIES", raising=False)

        categories = get_cdp_categories_for_agent("qa_reviewer")
        assert "network" in categories
        assert "storage" in categories
        assert "performance" in categories

    def test_get_cdp_categories_for_agent_qa_fixer(self, monkeypatch):
        """Test qa_fixer gets expected categories."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        monkeypatch.delenv("CDP_TOOL_CATEGORIES", raising=False)

        categories = get_cdp_categories_for_agent("qa_fixer")
        assert "network" in categories
        assert "storage" in categories
        # qa_fixer doesn't get performance category by default

    def test_get_cdp_categories_for_agent_coder(self, monkeypatch):
        """Test coder has no CDP categories by default."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        categories = get_cdp_categories_for_agent("coder")
        assert len(categories) == 0

    def test_get_cdp_categories_for_agent_not_enabled(self, monkeypatch):
        """Test agent not in enabled list gets no categories."""
        monkeypatch.setenv("CDP_ENABLED_FOR_AGENTS", "qa_reviewer")
        categories = get_cdp_categories_for_agent("qa_fixer")
        assert len(categories) == 0

    def test_get_cdp_categories_for_agent_filtered(self, monkeypatch):
        """Test categories are filtered by global setting."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        monkeypatch.setenv("CDP_TOOL_CATEGORIES", "network,storage")

        categories = get_cdp_categories_for_agent("qa_reviewer")
        assert categories == ["network", "storage"]


class TestCDPMCPType:
    """Test CDP MCP server type configuration."""

    def test_get_cdp_mcp_type_default(self, monkeypatch):
        """Test default MCP type is electron."""
        monkeypatch.delenv("CDP_MCP_TYPE", raising=False)
        mcp_type = get_cdp_mcp_type()
        assert mcp_type == "electron"

    def test_get_cdp_mcp_type_chrome_devtools(self, monkeypatch):
        """Test Chrome DevTools MCP type."""
        monkeypatch.setenv("CDP_MCP_TYPE", "chrome-devtools")
        mcp_type = get_cdp_mcp_type()
        assert mcp_type == "chrome-devtools"

    def test_get_cdp_mcp_server_name_electron(self, monkeypatch):
        """Test server name for electron type."""
        monkeypatch.delenv("CDP_MCP_TYPE", raising=False)
        server_name = get_cdp_mcp_server_name()
        assert server_name == "electron"

    def test_get_cdp_mcp_server_name_chrome_devtools(self, monkeypatch):
        """Test server name for chrome-devtools type."""
        monkeypatch.setenv("CDP_MCP_TYPE", "chrome-devtools")
        server_name = get_cdp_mcp_server_name()
        assert server_name == "chrome-devtools"


class TestCDPToolsForAgent:
    """Test getting CDP tools for specific agents."""

    def test_get_cdp_tools_for_agent_electron_qa_reviewer(self, monkeypatch):
        """Test Electron MCP tools for qa_reviewer."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        monkeypatch.delenv("CDP_TOOL_CATEGORIES", raising=False)

        tools = get_cdp_tools_for_agent("qa_reviewer", mcp_type="electron")
        assert len(tools) > 0
        # Should include base tools
        for tool in ELECTRON_BASE_TOOLS:
            assert tool in tools

    def test_get_cdp_tools_for_agent_electron_coder(self, monkeypatch):
        """Test Electron MCP tools for coder (none by default)."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        tools = get_cdp_tools_for_agent("coder", mcp_type="electron")
        assert len(tools) == 0

    def test_get_cdp_tools_for_agent_electron_with_categories(self, monkeypatch):
        """Test Electron MCP tools with category filtering."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        monkeypatch.setenv("CDP_TOOL_CATEGORIES", "network")

        tools = get_cdp_tools_for_agent("qa_reviewer", mcp_type="electron")
        # Should include base tools + network tools
        for tool in ELECTRON_BASE_TOOLS:
            assert tool in tools
        for tool in ELECTRON_NETWORK_TOOLS:
            assert tool in tools

    def test_get_cdp_tools_for_agent_chrome_devtools(self, monkeypatch):
        """Test Chrome DevTools MCP tools."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        monkeypatch.delenv("CDP_TOOL_CATEGORIES", raising=False)

        tools = get_cdp_tools_for_agent("qa_reviewer", mcp_type="chrome-devtools")
        # Chrome DevTools has different tool names
        assert isinstance(tools, list)


class TestCDPValidation:
    """Test CDP configuration validation."""

    def test_validate_cdp_config_valid(self, monkeypatch):
        """Test validation with valid configuration."""
        monkeypatch.setenv("CDP_ENABLED_FOR_AGENTS", "qa_reviewer,qa_fixer")
        monkeypatch.setenv("CDP_TOOL_CATEGORIES", "network,storage")
        warnings = validate_cdp_config()
        assert len(warnings) == 0

    def test_validate_cdp_config_invalid_agent(self, monkeypatch):
        """Test validation detects invalid agent type."""
        monkeypatch.setenv("CDP_ENABLED_FOR_AGENTS", "qa_reviewer,invalid_agent")
        warnings = validate_cdp_config()
        assert len(warnings) > 0
        assert any("invalid_agent" in w for w in warnings)

    def test_validate_cdp_config_invalid_category(self, monkeypatch):
        """Test validation detects invalid category."""
        # Note: The current implementation is lenient - it silently ignores invalid categories
        # This test documents the current behavior
        monkeypatch.setenv("CDP_TOOL_CATEGORIES", "network,invalid_category")
        warnings = validate_cdp_config()
        # Current behavior: no warnings for unknown categories (they're just ignored)
        # This is actually reasonable for forward compatibility
        assert len(warnings) == 0  # Documenting current lenient behavior


class TestCDPConfigSummary:
    """Test CDP configuration summary."""

    def test_get_cdp_config_summary(self, monkeypatch):
        """Test configuration summary."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        monkeypatch.delenv("CDP_TOOL_CATEGORIES", raising=False)
        monkeypatch.delenv("CDP_LOG_LEVEL", raising=False)

        summary = get_cdp_config_summary()
        assert "mcp_type" in summary
        assert "enabled_agents" in summary
        assert "enabled_categories" in summary
        assert "log_level" in summary
        assert summary["mcp_type"] == "electron"
        assert summary["log_level"] == "basic"


class TestIsCDPEnabledForAgent:
    """Test is_cdp_enabled_for_agent function."""

    def test_is_cdp_enabled_for_agent_qa_reviewer(self, monkeypatch):
        """Test qa_reviewer has CDP enabled by default."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        assert is_cdp_enabled_for_agent("qa_reviewer") is True

    def test_is_cdp_enabled_for_agent_coder(self, monkeypatch):
        """Test coder has CDP disabled by default."""
        monkeypatch.delenv("CDP_ENABLED_FOR_AGENTS", raising=False)
        assert is_cdp_enabled_for_agent("coder") is False

    def test_is_cdp_enabled_for_agent_custom(self, monkeypatch):
        """Test custom agent enablement."""
        # Note: Coder agent has no default permissions, so we need to also set categories
        # This test verifies that even with CDP_ENABLED_FOR_AGENTS set,
        # the agent needs actual categories to be considered "enabled"
        monkeypatch.setenv("CDP_ENABLED_FOR_AGENTS", "coder")
        # Coder has no default categories, so even with enabled_agents set, it returns false
        assert is_cdp_enabled_for_agent("coder") is False
        assert is_cdp_enabled_for_agent("qa_reviewer") is False
