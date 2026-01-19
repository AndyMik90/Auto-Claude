"""
Platform Module Tests

Tests the platform abstraction layer using mocks to simulate
different operating systems.
"""

import os
import sys
from pathlib import Path
from unittest.mock import patch

# Add backend to path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'backend'))

from core.platform import (
    get_current_os,
    is_windows,
    is_macos,
    is_linux,
    is_unix,
    get_path_delimiter,
    get_executable_extension,
    with_executable_extension,
    get_binary_directories,
    get_homebrew_path,
    get_claude_detection_paths,
    get_claude_detection_paths_structured,
    get_python_commands,
    find_executable,
    validate_cli_path,
    requires_shell,
    build_windows_command,
    get_env_var,
    get_platform_description,
    OS
)


# ============================================================================
# Platform Detection Tests
# ============================================================================

class TestPlatformDetection:
    """Tests for platform detection functions."""

    @patch('core.platform.platform.system', return_value='Windows')
    def test_detects_windows(self, mock_system):
        assert get_current_os() == OS.WINDOWS
        assert is_windows() is True
        assert is_macos() is False
        assert is_linux() is False
        assert is_unix() is False

    @patch('core.platform.platform.system', return_value='Darwin')
    def test_detects_macos(self, mock_system):
        assert get_current_os() == OS.MACOS
        assert is_windows() is False
        assert is_macos() is True
        assert is_linux() is False
        assert is_unix() is True

    @patch('core.platform.platform.system', return_value='Linux')
    def test_detects_linux(self, mock_system):
        assert get_current_os() == OS.LINUX
        assert is_windows() is False
        assert is_macos() is False
        assert is_linux() is True
        assert is_unix() is True


# ============================================================================
# Path Configuration Tests
# ============================================================================

class TestPathConfiguration:
    """Tests for path-related configuration."""

    @patch('core.platform.is_windows', return_value=True)
    def test_windows_path_delimiter(self, mock_is_windows):
        assert get_path_delimiter() == ';'

    @patch('core.platform.is_windows', return_value=False)
    def test_unix_path_delimiter(self, mock_is_windows):
        assert get_path_delimiter() == ':'

    @patch('core.platform.is_windows', return_value=True)
    def test_windows_executable_extension(self, mock_is_windows):
        assert get_executable_extension() == '.exe'

    @patch('core.platform.is_windows', return_value=False)
    def test_unix_executable_extension(self, mock_is_windows):
        assert get_executable_extension() == ''


class TestWithExecutableExtension:
    """Tests for adding executable extensions."""

    @patch('core.platform.is_windows', return_value=True)
    def test_adds_extension_on_windows(self, mock_is_windows):
        assert with_executable_extension('claude') == 'claude.exe'
        assert with_executable_extension('node') == 'node.exe'

    @patch('core.platform.is_windows', return_value=True)
    def test_preserves_existing_extension(self, mock_is_windows):
        assert with_executable_extension('claude.exe') == 'claude.exe'
        assert with_executable_extension('npm.cmd') == 'npm.cmd'

    @patch('core.platform.is_windows', return_value=False)
    def test_no_extension_on_unix(self, mock_is_windows):
        assert with_executable_extension('claude') == 'claude'
        assert with_executable_extension('node') == 'node'


# ============================================================================
# Binary Directories Tests
# ============================================================================

class TestBinaryDirectories:
    """Tests for binary directory detection."""

    @patch('core.platform.is_windows', return_value=True)
    @patch('pathlib.Path.home', return_value=Path('/home/user'))
    @patch.dict(os.environ, {'ProgramFiles': 'C:\\Program Files'})
    def test_windows_binary_directories(self, mock_home, mock_is_windows):
        dirs = get_binary_directories()

        assert 'user' in dirs
        assert 'system' in dirs
        assert any('AppData' in d for d in dirs['user'])
        assert any('Program Files' in d for d in dirs['system'])

    @patch('core.platform.is_windows', return_value=False)
    @patch('core.platform.is_macos', return_value=True)
    def test_macos_binary_directories(self, mock_is_macos, mock_is_windows):
        dirs = get_binary_directories()

        assert '/opt/homebrew/bin' in dirs['system']
        assert '/usr/local/bin' in dirs['system']

    @patch('core.platform.is_windows', return_value=False)
    @patch('core.platform.is_macos', return_value=False)
    def test_linux_binary_directories(self, mock_is_macos, mock_is_windows):
        dirs = get_binary_directories()

        assert '/usr/bin' in dirs['system']
        assert '/snap/bin' in dirs['system']


# ============================================================================
# Homebrew Path Tests
# ============================================================================

class TestHomebrewPath:
    """Tests for Homebrew path detection."""

    @patch('core.platform.is_macos', return_value=False)
    def test_returns_null_on_non_macos(self, mock_is_macos):
        assert get_homebrew_path() is None

    @patch('core.platform.is_macos', return_value=True)
    @patch('os.path.exists', return_value=False)
    def test_returns_default_on_macos(self, mock_exists, mock_is_macos):
        # Should return default Apple Silicon path
        result = get_homebrew_path()
        assert result in ['/opt/homebrew/bin', '/usr/local/bin']


# ============================================================================
# Tool Detection Tests
# ============================================================================

class TestClaudeDetectionPaths:
    """Tests for Claude CLI path detection."""

    @patch('core.platform.is_macos', return_value=False)
    @patch('core.platform.is_windows', return_value=True)
    @patch('pathlib.Path.home', return_value=Path('/home/user'))
    def test_windows_claude_paths(self, mock_home, mock_is_windows, mock_is_macos):
        paths = get_claude_detection_paths()

        assert any('AppData' in p for p in paths)
        assert any('Program Files' in p for p in paths)
        assert any(p.endswith('.exe') for p in paths)

    @patch('core.platform.is_macos', return_value=False)
    @patch('core.platform.is_windows', return_value=False)
    @patch('pathlib.Path.home', return_value=Path('/home/user'))
    def test_unix_claude_paths(self, mock_home, mock_is_windows, mock_is_macos):
        paths = get_claude_detection_paths()

        assert any('.local' in p for p in paths)
        assert not any(p.endswith('.exe') for p in paths)

    @patch('core.platform.is_macos', return_value=True)
    @patch('core.platform.is_windows', return_value=False)
    @patch('core.platform.get_homebrew_path', return_value='/opt/homebrew/bin')
    @patch('pathlib.Path.home', return_value=Path('/Users/testuser'))
    def test_macos_claude_detection_paths_include_homebrew(self, mock_home, mock_brew, mock_is_windows, mock_is_macos):
        """macOS Claude detection should include Homebrew paths."""
        paths = get_claude_detection_paths()

        assert any('/opt/homebrew/bin/claude' in p for p in paths)
        assert any('.local' in p for p in paths)
        assert not any(p.endswith('.exe') for p in paths)

    @patch('core.platform.is_macos', return_value=False)
    @patch('core.platform.is_windows', return_value=False)
    @patch('pathlib.Path.home', return_value=Path('/home/linuxuser'))
    def test_linux_claude_detection_paths(self, mock_home, mock_is_windows, mock_is_macos):
        """Linux Claude detection should use standard Unix paths."""
        paths = get_claude_detection_paths()

        assert any('.local/bin/claude' in p for p in paths)
        assert any('/home/linuxuser/bin/claude' in p for p in paths)
        # Homebrew path should NOT be in Linux paths (only macOS)
        assert not any('/opt/homebrew' in p for p in paths)


class TestPythonCommands:
    """Tests for Python command variations."""

    @patch('core.platform.is_windows', return_value=True)
    def test_windows_python_commands(self, mock_is_windows):
        commands = get_python_commands()
        # Commands are now returned as argument sequences
        assert ["py", "-3"] in commands
        assert ["python"] in commands

    @patch('core.platform.is_windows', return_value=False)
    def test_unix_python_commands(self, mock_is_windows):
        commands = get_python_commands()
        # Commands are now returned as argument sequences
        assert commands[0] == ["python3"]


# ============================================================================
# CLI Detection Tests - Cross-Platform
# ============================================================================

class TestClaudeDetectionPathsStructured:
    """Tests for structured Claude CLI path detection."""

    @patch('core.platform.is_windows', return_value=True)
    @patch('pathlib.Path.home', return_value=Path('/home/user'))
    def test_windows_structured_claude_detection(self, mock_home, mock_is_windows):
        """Windows should return .exe paths in platform key."""
        result = get_claude_detection_paths_structured()

        assert 'homebrew' in result
        assert 'platform' in result
        assert 'nvm_versions_dir' in result

        # Platform paths should include Windows-specific locations
        platform_paths = result['platform']
        assert any('AppData' in p for p in platform_paths)
        assert any('.exe' in p for p in platform_paths)

    @patch('core.platform.is_windows', return_value=False)
    @patch('pathlib.Path.home', return_value=Path('/home/user'))
    def test_unix_structured_claude_detection(self, mock_home, mock_is_windows):
        """Unix should return non-.exe paths and Homebrew paths."""
        result = get_claude_detection_paths_structured()

        assert 'homebrew' in result
        assert 'platform' in result
        assert 'nvm_versions_dir' in result

        # Homebrew paths should be present for macOS compatibility
        homebrew_paths = result['homebrew']
        assert '/opt/homebrew/bin/claude' in homebrew_paths
        assert '/usr/local/bin/claude' in homebrew_paths

        # Platform paths should not include .exe
        platform_paths = result['platform']
        assert not any('.exe' in p for p in platform_paths)

    @patch('core.platform.is_windows', return_value=False)
    @patch('pathlib.Path.home', return_value=Path('/home/testuser'))
    def test_nvm_versions_directory_path(self, mock_home, mock_is_windows):
        """NVM versions directory should be in user home."""
        result = get_claude_detection_paths_structured()

        nvm_dir = result['nvm_versions_dir']
        assert '.nvm/versions/node' in nvm_dir
        assert 'testuser' in nvm_dir


class TestFindExecutableCli:
    """Tests for find_executable function across platforms."""

    @patch('core.platform.is_windows', return_value=True)
    @patch('shutil.which', return_value=None)
    @patch('os.path.isdir', return_value=True)
    @patch('os.path.isfile')
    @patch('pathlib.Path.home', return_value=Path('C:/Users/testuser'))
    def test_windows_cli_detection_checks_exe_extensions(
        self, mock_home, mock_isfile, mock_isdir, mock_which, mock_is_windows
    ):
        """Windows should check for .exe, .cmd, .bat extensions."""
        # Simulate finding node.exe in system directory
        def isfile_side_effect(path):
            return 'node.exe' in path and 'Program Files' in path

        mock_isfile.side_effect = isfile_side_effect

        result = find_executable('node')

        # Should have tried to find with extension
        assert mock_isfile.called

    @patch('core.platform.is_windows', return_value=False)
    @patch('shutil.which', return_value='/usr/bin/node')
    def test_unix_cli_detection_uses_which(self, mock_which, mock_is_windows):
        """Unix should use shutil.which first."""
        result = find_executable('node')

        assert result == '/usr/bin/node'
        mock_which.assert_called_with('node')

    @patch('core.platform.is_windows', return_value=False)
    @patch('shutil.which', return_value=None)
    @patch('core.platform.is_macos', return_value=True)
    @patch('os.path.isdir', return_value=True)
    @patch('os.path.isfile')
    @patch('pathlib.Path.home', return_value=Path('/Users/testuser'))
    def test_macos_cli_detection_searches_homebrew(
        self, mock_home, mock_isfile, mock_isdir, mock_is_macos, mock_which, mock_is_windows
    ):
        """macOS should search Homebrew directories."""
        def isfile_side_effect(path):
            return path == '/opt/homebrew/bin/python3'

        mock_isfile.side_effect = isfile_side_effect

        result = find_executable('python3')

        # Should find in Homebrew path
        assert result == '/opt/homebrew/bin/python3'

    @patch('core.platform.is_windows', return_value=False)
    @patch('shutil.which', return_value=None)
    @patch('core.platform.is_macos', return_value=False)
    @patch('os.path.isdir', return_value=True)
    @patch('os.path.isfile')
    @patch('pathlib.Path.home', return_value=Path('/home/testuser'))
    def test_linux_cli_detection_searches_standard_paths(
        self, mock_home, mock_isfile, mock_isdir, mock_is_macos, mock_which, mock_is_windows
    ):
        """Linux should search standard Unix paths."""
        def isfile_side_effect(path):
            return path == '/usr/bin/python3'

        mock_isfile.side_effect = isfile_side_effect

        result = find_executable('python3')

        assert result == '/usr/bin/python3'

    @patch('core.platform.is_windows', return_value=False)
    @patch('shutil.which', return_value=None)
    @patch('core.platform.is_macos', return_value=False)
    @patch('os.path.isdir', return_value=False)
    @patch('os.path.isfile', return_value=False)
    @patch('pathlib.Path.home', return_value=Path('/home/testuser'))
    def test_cli_detection_returns_none_when_not_found(
        self, mock_home, mock_isfile, mock_isdir, mock_is_macos, mock_which, mock_is_windows
    ):
        """Should return None when executable not found anywhere."""
        result = find_executable('nonexistent-cli')

        assert result is None

    @patch('core.platform.is_windows', return_value=False)
    @patch('shutil.which', return_value=None)
    @patch('core.platform.is_macos', return_value=False)
    @patch('os.path.isdir', return_value=True)
    @patch('os.path.isfile')
    @patch('pathlib.Path.home', return_value=Path('/home/testuser'))
    def test_cli_detection_uses_additional_paths(
        self, mock_home, mock_isfile, mock_isdir, mock_is_macos, mock_which, mock_is_windows
    ):
        """Should search in additional_paths when provided."""
        def isfile_side_effect(path):
            return path == '/custom/path/mycli'

        mock_isfile.side_effect = isfile_side_effect

        result = find_executable('mycli', additional_paths=['/custom/path'])

        assert result == '/custom/path/mycli'


class TestNodeCliDetection:
    """Tests for Node.js CLI detection patterns across platforms."""

    @patch('core.platform.is_windows', return_value=True)
    @patch('shutil.which', return_value='C:\\Program Files\\nodejs\\node.exe')
    def test_windows_node_detection_via_which(self, mock_which, mock_is_windows):
        """Windows Node detection should work via PATH."""
        result = find_executable('node')

        assert result == 'C:\\Program Files\\nodejs\\node.exe'

    @patch('core.platform.is_windows', return_value=False)
    @patch('shutil.which', return_value='/usr/local/bin/node')
    def test_macos_node_detection_via_which(self, mock_which, mock_is_windows):
        """macOS Node detection should work via PATH."""
        result = find_executable('node')

        assert result == '/usr/local/bin/node'

    @patch('core.platform.is_windows', return_value=False)
    @patch('shutil.which', return_value='/usr/bin/node')
    def test_linux_node_detection_via_which(self, mock_which, mock_is_windows):
        """Linux Node detection should work via PATH."""
        result = find_executable('node')

        assert result == '/usr/bin/node'


class TestPythonCliDetection:
    """Tests for Python CLI detection patterns across platforms."""

    @patch('core.platform.is_windows', return_value=True)
    def test_windows_python_detection_prefers_py_launcher(self, mock_is_windows):
        """Windows should prefer py launcher."""
        commands = get_python_commands()

        # First command should be py launcher
        assert commands[0] == ["py", "-3"]

    @patch('core.platform.is_windows', return_value=False)
    def test_unix_python_detection_prefers_python3(self, mock_is_windows):
        """Unix should prefer python3."""
        commands = get_python_commands()

        assert commands[0] == ["python3"]
        assert ["python"] in commands

    @patch('core.platform.is_windows', return_value=True)
    def test_windows_python_detection_includes_fallbacks(self, mock_is_windows):
        """Windows should have fallback commands."""
        commands = get_python_commands()

        # Should have multiple options
        assert len(commands) >= 3
        assert ["python3"] in commands
        assert ["py"] in commands


class TestClaudeCliDetectionCrossPlatform:
    """Tests for Claude CLI detection specifically across all platforms."""

    @patch('core.platform.is_macos', return_value=False)
    @patch('core.platform.is_windows', return_value=True)
    @patch('pathlib.Path.home', return_value=Path('C:/Users/testuser'))
    def test_windows_claude_cli_detection_paths(self, mock_home, mock_is_windows, mock_is_macos):
        """Windows Claude paths should include standard installation locations."""
        paths = get_claude_detection_paths()

        # Should include AppData location (npm global)
        assert any('AppData\\Roaming\\npm\\claude.cmd' in p.replace('/', '\\') for p in paths)
        # Should include Program Files
        assert any('Program Files' in p for p in paths)
        # All Windows paths should use .exe or .cmd
        windows_executables = [p for p in paths if 'Program Files' in p or 'AppData' in p]
        assert all(p.endswith('.exe') or p.endswith('.cmd') for p in windows_executables if p)

    @patch('core.platform.is_macos', return_value=True)
    @patch('core.platform.is_windows', return_value=False)
    @patch('core.platform.get_homebrew_path', return_value='/opt/homebrew/bin')
    @patch('pathlib.Path.home', return_value=Path('/Users/testuser'))
    def test_macos_claude_cli_detection_paths(self, mock_home, mock_brew, mock_is_windows, mock_is_macos):
        """macOS Claude paths should include Homebrew."""
        paths = get_claude_detection_paths()

        # Should include Homebrew path
        assert '/opt/homebrew/bin/claude' in paths
        # Should include user local bin
        assert any('.local/bin/claude' in p for p in paths)
        # No .exe extensions
        assert not any(p.endswith('.exe') for p in paths)

    @patch('core.platform.is_macos', return_value=False)
    @patch('core.platform.is_windows', return_value=False)
    @patch('pathlib.Path.home', return_value=Path('/home/testuser'))
    def test_linux_claude_cli_detection_paths(self, mock_home, mock_is_windows, mock_is_macos):
        """Linux Claude paths should use standard Unix locations."""
        paths = get_claude_detection_paths()

        # Should include local bin
        assert any('.local/bin/claude' in p for p in paths)
        # Should include user bin
        assert any('/home/testuser/bin/claude' in p for p in paths)
        # No Homebrew paths (only macOS)
        assert not any('/opt/homebrew' in p for p in paths)
        # No .exe extensions
        assert not any(p.endswith('.exe') for p in paths)


# ============================================================================
# Path Validation Tests
# ============================================================================

class TestPathValidation:
    """Tests for CLI path validation."""

    def test_rejects_path_traversal(self):
        assert validate_cli_path('../etc/passwd') is False
        assert validate_cli_path('..\\Windows\\System32') is False

    def test_rejects_empty_path(self):
        assert validate_cli_path('') is False
        assert validate_cli_path(None) is False

    def test_rejects_shell_metacharacters(self):
        """Shell metacharacters should be rejected to prevent command injection."""
        assert validate_cli_path('cmd;rm -rf /') is False
        assert validate_cli_path('cmd|cat /etc/passwd') is False
        assert validate_cli_path('cmd&background') is False
        assert validate_cli_path('cmd`whoami`') is False
        assert validate_cli_path('cmd$(whoami)') is False
        assert validate_cli_path('cmd{test}') is False
        assert validate_cli_path('cmd<input') is False
        assert validate_cli_path('cmd>output') is False

    def test_rejects_windows_env_expansion(self):
        """Windows environment variable expansion should be rejected."""
        assert validate_cli_path('%PROGRAMFILES%\\cmd.exe') is False
        assert validate_cli_path('%SystemRoot%\\System32\\cmd.exe') is False

    def test_rejects_newline_injection(self):
        """Newlines in paths should be rejected to prevent command injection."""
        assert validate_cli_path('cmd\n/bin/sh') is False
        assert validate_cli_path('cmd\r\n/bin/sh') is False

    @patch('core.platform.is_windows', return_value=True)
    def test_validates_windows_names(self, mock_is_windows):
        assert validate_cli_path('claude.exe') is True
        assert validate_cli_path('my-script.cmd') is True
        assert validate_cli_path('dangerous;command.exe') is False

    @patch('core.platform.os.path.isfile', return_value=True)
    @patch('core.platform.is_windows', return_value=False)
    def test_allows_unix_paths(self, mock_is_windows, mock_isfile):
        assert validate_cli_path('/usr/bin/node') is True
        assert validate_cli_path('/opt/homebrew/bin/python3') is True


# ============================================================================
# Shell Execution Tests
# ============================================================================

class TestShellExecution:
    """Tests for shell execution requirements."""

    @patch('core.platform.is_windows', return_value=True)
    def test_requires_shell_for_cmd_files(self, mock_is_windows):
        assert requires_shell('npm.cmd') is True
        assert requires_shell('script.bat') is True
        assert requires_shell('node.exe') is False

    @patch('core.platform.is_windows', return_value=False)
    def test_never_requires_shell_on_unix(self, mock_is_windows):
        assert requires_shell('npm') is False
        assert requires_shell('node') is False


class TestWindowsCommandBuilder:
    """Tests for Windows command array building."""

    @patch('core.platform.is_windows', return_value=True)
    @patch.dict(os.environ, {'SystemRoot': 'C:\\Windows', 'ComSpec': 'C:\\Windows\\System32\\cmd.exe'})
    def test_wraps_cmd_files_in_cmd_exe(self, mock_is_windows):
        result = build_windows_command('npm.cmd', ['install', 'package'])

        assert result[0].endswith('cmd.exe')
        assert '/d' in result
        assert '/s' in result
        assert '/c' in result
        assert any('npm.cmd' in arg for arg in result)

    @patch('core.platform.is_windows', return_value=True)
    def test_passes_exe_directly(self, mock_is_windows):
        result = build_windows_command('node.exe', ['script.js'])

        assert result[0] == 'node.exe'
        assert result[1] == 'script.js'

    @patch('core.platform.is_windows', return_value=False)
    def test_unix_command_simple(self, mock_is_windows):
        result = build_windows_command('/usr/bin/node', ['script.js'])

        assert result == ['/usr/bin/node', 'script.js']


# ============================================================================
# Environment Variable Tests
# ============================================================================

class TestEnvironmentVariables:
    """Tests for environment variable access."""

    @patch.dict(os.environ, {'TEST_VAR': 'value'})
    @patch('core.platform.is_windows', return_value=False)
    def test_gets_env_var_on_unix(self, mock_is_windows):
        assert get_env_var('TEST_VAR') == 'value'
        assert get_env_var('NONEXISTENT', 'default') == 'default'

    @patch('core.platform.is_windows', return_value=True)
    @patch.dict(os.environ, {'TEST_VAR': 'value', 'test_var': 'other'})
    def test_case_insensitive_on_windows(self, mock_is_windows):
        # Windows should be case-insensitive
        result = get_env_var('TEST_VAR')
        assert result in ['value', 'other']


# ============================================================================
# Platform Description Tests
# ============================================================================

class TestPlatformDescription:
    """Tests for platform description."""

    @patch('platform.system', return_value='Windows')
    @patch('platform.machine', return_value='AMD64')
    def test_windows_description(self, mock_machine, mock_system):
        desc = get_platform_description()
        assert 'Windows' in desc
        assert 'AMD64' in desc

    @patch('core.platform.platform.system', return_value='Darwin')
    @patch('platform.machine', return_value='arm64')
    def test_macos_description(self, mock_machine, mock_system):
        desc = get_platform_description()
        assert 'macOS' in desc
        assert 'arm64' in desc
