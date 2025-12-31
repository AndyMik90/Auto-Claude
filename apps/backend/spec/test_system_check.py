#!/usr/bin/env python3
"""
Tests for System Check Module
==============================

Tests the system_check.py module functionality including:
- Platform-specific tool requirements (Windows vs macOS vs Linux)
- Tool detection (make, cmake)
- Version extraction from tool output
- Installation instructions by platform
- Error handling for missing tools and timeouts
"""

import subprocess
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Add the services directory to the path
sys.path.insert(0, str(Path(__file__).parent.parent / "services"))

from system_check import (
    PLATFORM_REQUIREMENTS,
    INSTALLATION_INSTRUCTIONS,
    ToolStatus,
    SystemCheckResult,
    SystemChecker,
)


# =============================================================================
# DATA CLASS TESTS
# =============================================================================


class TestToolStatus:
    """Tests for ToolStatus dataclass."""

    def test_default_values(self):
        """Creates with correct default values."""
        status = ToolStatus(name="cmake")
        assert status.name == "cmake"
        assert status.installed is False
        assert status.version is None
        assert status.path is None
        assert status.error is None

    def test_installed_tool(self):
        """Records installed tool with version and path."""
        status = ToolStatus(
            name="cmake",
            installed=True,
            version="3.28.0",
            path="/usr/local/bin/cmake",
        )
        assert status.installed is True
        assert status.version == "3.28.0"
        assert status.path == "/usr/local/bin/cmake"

    def test_missing_tool_with_error(self):
        """Records missing tool with error message."""
        status = ToolStatus(
            name="make",
            installed=False,
            error="'make' not found in PATH",
        )
        assert status.installed is False
        assert "not found" in status.error


class TestSystemCheckResult:
    """Tests for SystemCheckResult dataclass."""

    def test_default_values(self):
        """Creates with correct default values."""
        result = SystemCheckResult()
        assert result.success is False
        assert result.platform == ""
        assert result.tools == []
        assert result.missing_tools == []
        assert result.errors == []
        assert result.installation_instructions == ""

    def test_successful_validation(self):
        """Records successful validation."""
        result = SystemCheckResult(
            success=True,
            platform="Darwin",
            tools=[ToolStatus(name="cmake", installed=True)],
        )
        assert result.success is True
        assert result.platform == "Darwin"
        assert len(result.tools) == 1

    def test_failed_validation(self):
        """Records failed validation with missing tools."""
        result = SystemCheckResult(
            success=False,
            platform="Windows",
            missing_tools=["cmake", "make"],
            errors=["Build tool 'cmake' not found", "Build tool 'make' not found"],
            installation_instructions="Install cmake using Chocolatey...",
        )
        assert result.success is False
        assert len(result.missing_tools) == 2
        assert len(result.errors) == 2


# =============================================================================
# PLATFORM REQUIREMENTS TESTS
# =============================================================================


class TestPlatformRequirements:
    """Tests for platform-specific tool requirements."""

    def test_macos_requires_cmake_only(self):
        """macOS (Darwin) requires only cmake."""
        requirements = PLATFORM_REQUIREMENTS.get("Darwin", [])
        assert "cmake" in requirements
        assert "make" not in requirements
        assert len(requirements) == 1

    def test_windows_requires_both_make_and_cmake(self):
        """Windows requires both make and cmake."""
        requirements = PLATFORM_REQUIREMENTS.get("Windows", [])
        assert "cmake" in requirements
        assert "make" in requirements
        assert len(requirements) == 2

    def test_linux_requires_cmake_only(self):
        """Linux requires only cmake."""
        requirements = PLATFORM_REQUIREMENTS.get("Linux", [])
        assert "cmake" in requirements
        assert "make" not in requirements
        assert len(requirements) == 1


class TestInstallationInstructions:
    """Tests for platform-specific installation instructions."""

    def test_macos_cmake_instructions_use_homebrew(self):
        """macOS cmake instructions use Homebrew."""
        instructions = INSTALLATION_INSTRUCTIONS.get("Darwin", {})
        assert "cmake" in instructions
        assert "brew install cmake" in instructions["cmake"]

    def test_macos_make_instructions_use_xcode(self):
        """macOS make instructions use xcode-select."""
        instructions = INSTALLATION_INSTRUCTIONS.get("Darwin", {})
        assert "make" in instructions
        assert "xcode-select --install" in instructions["make"]

    def test_windows_cmake_instructions_use_chocolatey(self):
        """Windows cmake instructions use Chocolatey."""
        instructions = INSTALLATION_INSTRUCTIONS.get("Windows", {})
        assert "cmake" in instructions
        assert "choco install cmake" in instructions["cmake"]

    def test_windows_make_instructions_use_chocolatey(self):
        """Windows make instructions use Chocolatey."""
        instructions = INSTALLATION_INSTRUCTIONS.get("Windows", {})
        assert "make" in instructions
        assert "choco install make" in instructions["make"]

    def test_linux_cmake_instructions_include_apt(self):
        """Linux cmake instructions include apt-get."""
        instructions = INSTALLATION_INSTRUCTIONS.get("Linux", {})
        assert "cmake" in instructions
        assert "apt-get install cmake" in instructions["cmake"]


# =============================================================================
# SYSTEM CHECKER INITIALIZATION TESTS
# =============================================================================


class TestSystemCheckerInit:
    """Tests for SystemChecker initialization."""

    def test_auto_detects_platform(self):
        """Auto-detects platform when not overridden."""
        checker = SystemChecker()
        # Should be one of the valid platforms
        assert checker.platform_name in ["Darwin", "Windows", "Linux"]

    def test_platform_override(self):
        """Uses platform override when specified."""
        checker = SystemChecker(platform_override="Windows")
        assert checker.platform_name == "Windows"

    def test_additional_tools(self):
        """Includes additional tools in requirements."""
        checker = SystemChecker(additional_tools=["gcc", "g++"])
        assert checker.additional_tools == ["gcc", "g++"]

    def test_default_additional_tools_empty(self):
        """Additional tools default to empty list."""
        checker = SystemChecker()
        assert checker.additional_tools == []


# =============================================================================
# GET REQUIRED TOOLS TESTS
# =============================================================================


class TestGetRequiredTools:
    """Tests for get_required_tools method."""

    def test_macos_required_tools(self):
        """Returns cmake for macOS."""
        checker = SystemChecker(platform_override="Darwin")
        tools = checker.get_required_tools()
        assert "cmake" in tools
        assert "make" not in tools

    def test_windows_required_tools(self):
        """Returns make and cmake for Windows."""
        checker = SystemChecker(platform_override="Windows")
        tools = checker.get_required_tools()
        assert "cmake" in tools
        assert "make" in tools

    def test_linux_required_tools(self):
        """Returns cmake for Linux."""
        checker = SystemChecker(platform_override="Linux")
        tools = checker.get_required_tools()
        assert "cmake" in tools
        assert "make" not in tools

    def test_includes_additional_tools(self):
        """Includes additional tools with platform defaults."""
        checker = SystemChecker(
            platform_override="Darwin",
            additional_tools=["ninja"],
        )
        tools = checker.get_required_tools()
        assert "cmake" in tools
        assert "ninja" in tools

    def test_unknown_platform_defaults_to_cmake(self):
        """Unknown platform defaults to cmake requirement."""
        checker = SystemChecker(platform_override="UnknownOS")
        tools = checker.get_required_tools()
        assert "cmake" in tools


# =============================================================================
# TOOL CHECK TESTS
# =============================================================================


class TestToolCheck:
    """Tests for _check_tool method."""

    def test_detects_installed_tool(self):
        """Detects installed tool with version."""
        checker = SystemChecker(platform_override="Darwin")

        mock_version_result = MagicMock()
        mock_version_result.returncode = 0
        mock_version_result.stdout = "cmake version 3.28.0\n"
        mock_version_result.stderr = ""

        mock_path_result = MagicMock()
        mock_path_result.returncode = 0
        mock_path_result.stdout = "/usr/local/bin/cmake\n"

        with patch("subprocess.run", side_effect=[mock_version_result, mock_path_result]):
            status = checker._check_tool("cmake")

        assert status.installed is True
        assert status.version == "3.28.0"
        assert status.path == "/usr/local/bin/cmake"

    def test_detects_missing_tool(self):
        """Detects missing tool."""
        checker = SystemChecker(platform_override="Darwin")

        with patch("subprocess.run", side_effect=FileNotFoundError("cmake not found")):
            status = checker._check_tool("cmake")

        assert status.installed is False
        assert "not found" in status.error

    def test_handles_non_zero_exit_code(self):
        """Handles tool returning non-zero exit code."""
        checker = SystemChecker(platform_override="Darwin")

        mock_result = MagicMock()
        mock_result.returncode = 1
        mock_result.stdout = ""
        mock_result.stderr = "cmake: command not recognized"

        with patch("subprocess.run", return_value=mock_result):
            status = checker._check_tool("cmake")

        assert status.installed is False
        assert "non-zero exit code" in status.error

    def test_handles_timeout(self):
        """Handles subprocess timeout."""
        checker = SystemChecker(platform_override="Darwin")

        with patch(
            "subprocess.run",
            side_effect=subprocess.TimeoutExpired("cmake", 10),
        ):
            status = checker._check_tool("cmake")

        assert status.installed is False
        assert "Timeout" in status.error

    def test_windows_uses_where_for_path(self):
        """Windows uses 'where' command for path detection."""
        checker = SystemChecker(platform_override="Windows")

        mock_version_result = MagicMock()
        mock_version_result.returncode = 0
        mock_version_result.stdout = "cmake version 3.28.0\n"
        mock_version_result.stderr = ""

        mock_path_result = MagicMock()
        mock_path_result.returncode = 0
        mock_path_result.stdout = "C:\\Program Files\\CMake\\bin\\cmake.exe\n"

        with patch("subprocess.run", side_effect=[mock_version_result, mock_path_result]) as mock_run:
            checker._check_tool("cmake")

        # Second call should use 'where' on Windows
        calls = mock_run.call_args_list
        assert len(calls) == 2
        assert calls[1][0][0] == ["where", "cmake"]

    def test_macos_uses_which_for_path(self):
        """macOS uses 'which' command for path detection."""
        checker = SystemChecker(platform_override="Darwin")

        mock_version_result = MagicMock()
        mock_version_result.returncode = 0
        mock_version_result.stdout = "cmake version 3.28.0\n"
        mock_version_result.stderr = ""

        mock_path_result = MagicMock()
        mock_path_result.returncode = 0
        mock_path_result.stdout = "/usr/local/bin/cmake\n"

        with patch("subprocess.run", side_effect=[mock_version_result, mock_path_result]) as mock_run:
            checker._check_tool("cmake")

        # Second call should use 'which' on macOS
        calls = mock_run.call_args_list
        assert len(calls) == 2
        assert calls[1][0][0] == ["which", "cmake"]


# =============================================================================
# VERSION EXTRACTION TESTS
# =============================================================================


class TestVersionExtraction:
    """Tests for _extract_version method."""

    def test_extracts_cmake_version(self):
        """Extracts version from cmake output."""
        checker = SystemChecker()
        version = checker._extract_version("cmake version 3.28.0", "cmake")
        assert version == "3.28.0"

    def test_extracts_make_version(self):
        """Extracts version from make output."""
        checker = SystemChecker()
        version = checker._extract_version("GNU Make 4.3", "make")
        assert version == "4.3"

    def test_extracts_semantic_version(self):
        """Extracts semantic version (X.Y.Z) pattern."""
        checker = SystemChecker()
        version = checker._extract_version("Tool version: v1.2.3-beta", "tool")
        assert version == "1.2.3"

    def test_extracts_major_minor_version(self):
        """Extracts major.minor version (X.Y) pattern."""
        checker = SystemChecker()
        version = checker._extract_version("Tool 4.2 (latest)", "tool")
        assert version == "4.2"

    def test_truncates_long_output(self):
        """Truncates long output when no version found."""
        checker = SystemChecker()
        long_output = "x" * 100
        version = checker._extract_version(long_output, "tool")
        assert len(version) == 50

    def test_handles_empty_output(self):
        """Handles empty output gracefully."""
        checker = SystemChecker()
        version = checker._extract_version("", "tool")
        assert version == ""


# =============================================================================
# VALIDATE BUILD TOOLS TESTS
# =============================================================================


class TestValidateBuildTools:
    """Tests for validate_build_tools method."""

    def test_succeeds_when_all_tools_present_macos(self):
        """Succeeds on macOS when cmake is present."""
        checker = SystemChecker(platform_override="Darwin")

        mock_version_result = MagicMock()
        mock_version_result.returncode = 0
        mock_version_result.stdout = "cmake version 3.28.0\n"
        mock_version_result.stderr = ""

        mock_path_result = MagicMock()
        mock_path_result.returncode = 0
        mock_path_result.stdout = "/usr/local/bin/cmake\n"

        with patch("subprocess.run", side_effect=[mock_version_result, mock_path_result]):
            result = checker.validate_build_tools()

        assert result.success is True
        assert result.platform == "Darwin"
        assert len(result.missing_tools) == 0
        assert len(result.tools) == 1

    def test_succeeds_when_all_tools_present_windows(self):
        """Succeeds on Windows when both make and cmake are present."""
        checker = SystemChecker(platform_override="Windows")

        def mock_subprocess_run(cmd, **kwargs):
            result = MagicMock()
            result.returncode = 0
            result.stderr = ""

            if cmd[0] == "make":
                result.stdout = "GNU Make 4.3\n"
            elif cmd[0] == "cmake":
                result.stdout = "cmake version 3.28.0\n"
            elif cmd[0] == "where":
                result.stdout = "C:\\Tools\\" + cmd[1] + ".exe\n"

            return result

        with patch("subprocess.run", side_effect=mock_subprocess_run):
            result = checker.validate_build_tools()

        assert result.success is True
        assert result.platform == "Windows"
        assert len(result.missing_tools) == 0
        assert len(result.tools) == 2

    def test_fails_when_cmake_missing_macos(self):
        """Fails on macOS when cmake is missing."""
        checker = SystemChecker(platform_override="Darwin")

        with patch("subprocess.run", side_effect=FileNotFoundError("cmake not found")):
            result = checker.validate_build_tools()

        assert result.success is False
        assert "cmake" in result.missing_tools
        assert len(result.errors) == 1
        assert "cmake" in result.errors[0]

    def test_fails_when_make_missing_windows(self):
        """Fails on Windows when make is missing."""
        checker = SystemChecker(platform_override="Windows")

        def mock_subprocess_run(cmd, **kwargs):
            if cmd[0] == "make":
                raise FileNotFoundError("make not found")

            result = MagicMock()
            result.returncode = 0
            result.stdout = "cmake version 3.28.0\n"
            result.stderr = ""
            return result

        with patch("subprocess.run", side_effect=mock_subprocess_run):
            result = checker.validate_build_tools()

        assert result.success is False
        assert "make" in result.missing_tools

    def test_fails_when_both_missing_windows(self):
        """Fails on Windows when both make and cmake are missing."""
        checker = SystemChecker(platform_override="Windows")

        with patch("subprocess.run", side_effect=FileNotFoundError("tool not found")):
            result = checker.validate_build_tools()

        assert result.success is False
        assert "make" in result.missing_tools
        assert "cmake" in result.missing_tools
        assert len(result.missing_tools) == 2

    def test_provides_installation_instructions_macos(self):
        """Provides Homebrew instructions on macOS."""
        checker = SystemChecker(platform_override="Darwin")

        with patch("subprocess.run", side_effect=FileNotFoundError("cmake not found")):
            result = checker.validate_build_tools()

        assert "brew install cmake" in result.installation_instructions
        assert "Darwin" in result.installation_instructions

    def test_provides_installation_instructions_windows(self):
        """Provides Chocolatey instructions on Windows."""
        checker = SystemChecker(platform_override="Windows")

        with patch("subprocess.run", side_effect=FileNotFoundError("tool not found")):
            result = checker.validate_build_tools()

        assert "choco install" in result.installation_instructions
        assert "Windows" in result.installation_instructions


# =============================================================================
# INSTALLATION INSTRUCTIONS TESTS
# =============================================================================


class TestGetInstallationInstructions:
    """Tests for _get_installation_instructions method."""

    def test_generates_macos_instructions(self):
        """Generates Homebrew-based instructions for macOS."""
        checker = SystemChecker(platform_override="Darwin")
        instructions = checker._get_installation_instructions(["cmake"])

        assert "Darwin" in instructions
        assert "cmake" in instructions
        assert "brew" in instructions

    def test_generates_windows_instructions(self):
        """Generates Chocolatey-based instructions for Windows."""
        checker = SystemChecker(platform_override="Windows")
        instructions = checker._get_installation_instructions(["cmake", "make"])

        assert "Windows" in instructions
        assert "cmake" in instructions
        assert "make" in instructions
        assert "choco" in instructions

    def test_generates_linux_instructions(self):
        """Generates apt-based instructions for Linux."""
        checker = SystemChecker(platform_override="Linux")
        instructions = checker._get_installation_instructions(["cmake"])

        assert "Linux" in instructions
        assert "cmake" in instructions
        assert "apt-get" in instructions

    def test_handles_unknown_tool(self):
        """Provides generic message for unknown tools."""
        checker = SystemChecker(platform_override="Darwin")
        instructions = checker._get_installation_instructions(["unknown_tool"])

        assert "unknown_tool" in instructions
        assert "package manager" in instructions

    def test_returns_empty_for_no_missing_tools(self):
        """Returns empty string when no tools missing."""
        checker = SystemChecker(platform_override="Darwin")
        instructions = checker._get_installation_instructions([])

        assert instructions == ""


# =============================================================================
# EDGE CASE TESTS
# =============================================================================


class TestEdgeCases:
    """Tests for edge cases and error handling."""

    def test_handles_generic_exception(self):
        """Handles generic exceptions during tool check."""
        checker = SystemChecker(platform_override="Darwin")

        with patch("subprocess.run", side_effect=Exception("Unknown error")):
            status = checker._check_tool("cmake")

        assert status.installed is False
        assert status.error == "Unknown error"

    def test_handles_path_lookup_failure(self):
        """Handles failure in path lookup after successful version check."""
        checker = SystemChecker(platform_override="Darwin")

        mock_version_result = MagicMock()
        mock_version_result.returncode = 0
        mock_version_result.stdout = "cmake version 3.28.0\n"
        mock_version_result.stderr = ""

        def mock_subprocess(cmd, **kwargs):
            if cmd[0] == "cmake":
                return mock_version_result
            # Path lookup fails
            raise Exception("which not found")

        with patch("subprocess.run", side_effect=mock_subprocess):
            status = checker._check_tool("cmake")

        assert status.installed is True
        assert status.version == "3.28.0"
        assert status.path is None  # Path lookup failed but tool is installed

    def test_handles_stderr_version_output(self):
        """Handles version info in stderr (some tools output there)."""
        checker = SystemChecker(platform_override="Darwin")

        mock_result = MagicMock()
        mock_result.returncode = 0
        mock_result.stdout = ""
        mock_result.stderr = "cmake version 3.28.0\n"

        mock_path_result = MagicMock()
        mock_path_result.returncode = 0
        mock_path_result.stdout = "/usr/local/bin/cmake\n"

        with patch("subprocess.run", side_effect=[mock_result, mock_path_result]):
            status = checker._check_tool("cmake")

        assert status.installed is True
        assert status.version == "3.28.0"

    def test_handles_multiline_path_output(self):
        """Handles multiple paths in 'where' output (Windows)."""
        checker = SystemChecker(platform_override="Windows")

        mock_version_result = MagicMock()
        mock_version_result.returncode = 0
        mock_version_result.stdout = "cmake version 3.28.0\n"
        mock_version_result.stderr = ""

        mock_path_result = MagicMock()
        mock_path_result.returncode = 0
        mock_path_result.stdout = "C:\\CMake\\bin\\cmake.exe\nC:\\Tools\\cmake.exe\n"

        with patch("subprocess.run", side_effect=[mock_version_result, mock_path_result]):
            status = checker._check_tool("cmake")

        # Should return first path
        assert status.path == "C:\\CMake\\bin\\cmake.exe"


# =============================================================================
# FIXTURES
# =============================================================================


@pytest.fixture
def mock_cmake_installed():
    """Fixture that mocks cmake as installed."""
    mock_version_result = MagicMock()
    mock_version_result.returncode = 0
    mock_version_result.stdout = "cmake version 3.28.0\n"
    mock_version_result.stderr = ""

    mock_path_result = MagicMock()
    mock_path_result.returncode = 0
    mock_path_result.stdout = "/usr/local/bin/cmake\n"

    with patch("subprocess.run", side_effect=[mock_version_result, mock_path_result]):
        yield


@pytest.fixture
def mock_cmake_missing():
    """Fixture that mocks cmake as missing."""
    with patch("subprocess.run", side_effect=FileNotFoundError("cmake not found")):
        yield


@pytest.fixture
def mock_all_tools_installed():
    """Fixture that mocks all tools (make, cmake) as installed."""

    def mock_subprocess(cmd, **kwargs):
        result = MagicMock()
        result.returncode = 0
        result.stderr = ""

        if cmd[0] == "make":
            result.stdout = "GNU Make 4.3\n"
        elif cmd[0] == "cmake":
            result.stdout = "cmake version 3.28.0\n"
        elif cmd[0] in ["which", "where"]:
            result.stdout = f"/usr/local/bin/{cmd[1]}\n"

        return result

    with patch("subprocess.run", side_effect=mock_subprocess):
        yield
