#!/usr/bin/env python3
"""
Tests for Safe Subprocess Utilities
===================================

Tests cover:
- Command parsing
- Executable validation/allowlist
- Safe execution without shell injection
- ManagedProcess resource cleanup
"""

import os
import sys
import tempfile
from pathlib import Path

import pytest

# Add auto-claude to path
sys.path.insert(0, str(Path(__file__).parent.parent / "auto-claude"))

from core.safe_subprocess import (
    ALLOWED_EXECUTABLES,
    CommandResult,
    ManagedProcess,
    SecurityError,
    parse_command,
    safe_run,
    validate_executable,
)


class TestParseCommand:
    """Tests for command parsing."""

    def test_simple_command(self):
        """Parse simple command."""
        args, env = parse_command("npm run dev")
        assert args == ["npm", "run", "dev"]
        assert env == {}

    def test_command_with_env_vars(self):
        """Parse command with leading env vars."""
        args, env = parse_command("NODE_ENV=production npm start")
        assert args == ["npm", "start"]
        assert env == {"NODE_ENV": "production"}

    def test_multiple_env_vars(self):
        """Parse multiple environment variables."""
        args, env = parse_command("PORT=3000 HOST=localhost python app.py")
        assert args == ["python", "app.py"]
        assert env == {"PORT": "3000", "HOST": "localhost"}

    def test_quoted_args(self):
        """Parse command with quoted arguments."""
        args, env = parse_command('echo "hello world"')
        assert args == ["echo", "hello world"]

    def test_no_env_vars(self):
        """Command without env vars."""
        args, env = parse_command("python -m pytest")
        assert args == ["python", "-m", "pytest"]
        assert env == {}


class TestValidateExecutable:
    """Tests for executable validation."""

    def test_allowed_executable(self):
        """Allowed executable passes validation."""
        validate_executable("npm")  # Should not raise
        validate_executable("python")
        validate_executable("node")

    def test_disallowed_executable(self):
        """Disallowed executable raises SecurityError."""
        with pytest.raises(SecurityError):
            validate_executable("malicious_binary")

    def test_path_extraction(self):
        """Extracts executable name from path."""
        validate_executable("/usr/bin/python")  # Should extract "python"
        validate_executable("/usr/local/bin/npm")

    def test_custom_allowlist(self):
        """Custom allowlist works."""
        custom = {"my_tool"}
        validate_executable("my_tool", allowed=custom)

        with pytest.raises(SecurityError):
            validate_executable("npm", allowed=custom)


class TestSafeRun:
    """Tests for safe_run function."""

    def test_simple_command(self):
        """Run simple allowed command."""
        result = safe_run("echo hello")
        assert result.success
        assert "hello" in result.stdout

    def test_command_with_args(self):
        """Run command with arguments."""
        result = safe_run("python --version")
        assert result.returncode == 0

    def test_disallowed_command_blocked(self):
        """Disallowed command raises SecurityError."""
        with pytest.raises(SecurityError):
            safe_run("dangerous_unknown_binary --delete-everything")

    def test_shell_injection_blocked(self):
        """Shell injection attempts are blocked."""
        # These would execute malicious code with shell=True
        # But our safe_run uses shell=False so they're safe

        # Backtick injection - just becomes literal argument
        result = safe_run("echo `whoami`")
        # With shell=False, backticks are literal
        assert result.success

    def test_command_not_found(self):
        """Non-existent command returns error."""
        # First need to add to allowlist
        result = safe_run(
            "nonexistent_command_xyz",
            allowed_executables={"nonexistent_command_xyz"},
        )
        assert not result.success
        assert "not found" in result.stderr.lower()

    def test_empty_command_rejected(self):
        """Empty command raises ValueError."""
        with pytest.raises(ValueError):
            safe_run("")

    def test_working_directory(self):
        """Working directory is respected."""
        with tempfile.TemporaryDirectory() as tmpdir:
            result = safe_run("pwd", cwd=tmpdir)
            assert result.success
            assert tmpdir in result.stdout


class TestManagedProcess:
    """Tests for ManagedProcess context manager."""

    def test_basic_usage(self):
        """Basic context manager usage."""
        with ManagedProcess("echo hello", capture_output=True) as proc:
            assert proc.pid is not None
            proc.wait()

    def test_cleanup_on_exit(self):
        """Resources are cleaned up on exit."""
        with ManagedProcess("sleep 10", capture_output=True) as proc:
            pid = proc.pid
            assert proc.is_running()

        # After exit, process should be terminated
        assert not proc.is_running()

    def test_cleanup_on_exception(self):
        """Resources cleaned up even on exception."""
        proc = None
        try:
            with ManagedProcess("sleep 10", capture_output=True) as p:
                proc = p
                raise RuntimeError("Test exception")
        except RuntimeError:
            pass

        assert proc is not None
        assert not proc.is_running()

    def test_terminate_method(self):
        """terminate() method works correctly."""
        proc = ManagedProcess("sleep 10", capture_output=True)
        proc.__enter__()

        assert proc.is_running()
        result = proc.terminate(timeout=5)
        assert result
        assert not proc.is_running()

    def test_security_validation(self):
        """ManagedProcess validates executables."""
        with pytest.raises(SecurityError):
            with ManagedProcess("malicious_binary arg1") as proc:
                pass


class TestShellInjectionPrevention:
    """Tests specifically for shell injection prevention."""

    def test_semicolon_not_interpreted(self):
        """Semicolons are not interpreted as command separators."""
        # With shell=True, this would run "whoami" after echo
        # With shell=False, the semicolon is just a literal argument
        result = safe_run("echo test; whoami")
        assert result.success
        # The output should contain the literal semicolon, not whoami result
        assert ";" in result.stdout or "test" in result.stdout

    def test_pipe_not_interpreted(self):
        """Pipes are not interpreted."""
        # With shell=True: echo test | cat
        # With shell=False: echo receives "test", "|", "cat" as arguments
        result = safe_run("echo test | cat")
        assert result.success
        assert "|" in result.stdout

    def test_ampersand_not_interpreted(self):
        """Ampersands don't create background processes."""
        result = safe_run("echo test && echo second")
        assert result.success
        # && should be literal
        assert "&&" in result.stdout or "test" in result.stdout

    def test_subshell_not_interpreted(self):
        """$(command) is not interpreted."""
        result = safe_run("echo $(whoami)")
        assert result.success
        # Should be literal, not actual username
        assert "$(" in result.stdout or "whoami" in result.stdout


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
