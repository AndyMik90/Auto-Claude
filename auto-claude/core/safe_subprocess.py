"""
Safe Subprocess Utilities
=========================

Provides secure subprocess execution with:
- No shell injection (shell=False by default)
- Executable allowlist validation
- Automatic resource cleanup (pipes closed)
- Environment variable parsing

Usage:
    from core.safe_subprocess import safe_run, ManagedProcess, ALLOWED_EXECUTABLES

    # Simple safe execution
    result = safe_run("npm run dev", cwd=project_dir)

    # Managed process with automatic cleanup
    with ManagedProcess("npm run dev", cwd=project_dir) as proc:
        # Process runs here
        pass
    # Pipes automatically closed, process terminated
"""

from __future__ import annotations

import logging
import os
import shlex
import subprocess
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)

# Executables that are allowed to run
# This is the security allowlist - add new executables as needed
ALLOWED_EXECUTABLES = {
    # Package managers
    "npm", "npx", "yarn", "pnpm", "bun",
    "pip", "pip3", "pipx", "poetry", "uv",
    "cargo", "go", "mvn", "gradle",
    # Runtimes
    "node", "python", "python3", "ruby", "java",
    "deno", "bun",
    # Web servers/frameworks
    "uvicorn", "gunicorn", "flask", "django-admin",
    "next", "vite", "webpack",
    # Build tools
    "make", "cmake", "gcc", "g++", "rustc",
    # Common utilities
    "git", "curl", "wget", "cat", "echo", "ls", "pwd",
    "mkdir", "cp", "mv", "touch", "chmod",
    "grep", "sed", "awk", "find", "xargs",
    "tar", "zip", "unzip", "gzip",
    "sleep", "head", "tail", "sort", "uniq", "wc",
    # Testing
    "pytest", "jest", "mocha", "vitest",
    # Docker
    "docker", "docker-compose",
}


class SecurityError(Exception):
    """Raised when a command fails security validation."""
    pass


@dataclass
class CommandResult:
    """Result of a command execution."""
    returncode: int
    stdout: str
    stderr: str
    success: bool = field(init=False)

    def __post_init__(self):
        self.success = self.returncode == 0


def parse_command(command: str) -> tuple[list[str], dict[str, str]]:
    """
    Parse a command string into args list and environment variables.

    Handles patterns like:
    - "npm run dev"
    - "NODE_ENV=production npm start"
    - "PORT=3000 HOST=0.0.0.0 python app.py"

    Args:
        command: Command string to parse

    Returns:
        Tuple of (args list, env dict)
    """
    parts = shlex.split(command)
    env_vars = {}
    cmd_start = 0

    # Extract leading environment variables
    for i, part in enumerate(parts):
        if "=" in part and not part.startswith("-"):
            key, _, value = part.partition("=")
            if key.isidentifier():  # Valid env var name
                env_vars[key] = value
                cmd_start = i + 1
            else:
                break
        else:
            break

    args = parts[cmd_start:]
    return args, env_vars


def validate_executable(executable: str, allowed: set[str] | None = None) -> None:
    """
    Validate that an executable is in the allowlist.

    Args:
        executable: Name of executable (may be a path)
        allowed: Set of allowed executables (defaults to ALLOWED_EXECUTABLES)

    Raises:
        SecurityError: If executable is not allowed
    """
    allowed_set = allowed or ALLOWED_EXECUTABLES

    # Extract just the executable name from path
    exec_name = Path(executable).name

    if exec_name not in allowed_set:
        raise SecurityError(
            f"Executable '{exec_name}' is not in the security allowlist. "
            f"Allowed executables: {sorted(allowed_set)[:20]}..."
        )


def safe_run(
    command: str,
    cwd: Path | str | None = None,
    timeout: int | None = None,
    capture_output: bool = True,
    allowed_executables: set[str] | None = None,
    env: dict[str, str] | None = None,
) -> CommandResult:
    """
    Safely run a command without shell injection risk.

    Args:
        command: Command string to execute
        cwd: Working directory
        timeout: Timeout in seconds
        capture_output: Whether to capture stdout/stderr
        allowed_executables: Custom allowlist (defaults to ALLOWED_EXECUTABLES)
        env: Additional environment variables

    Returns:
        CommandResult with return code and output

    Raises:
        SecurityError: If command contains disallowed executable
        ValueError: If command is empty or invalid
    """
    if not command or not command.strip():
        raise ValueError("Empty command")

    # Parse command and extract env vars
    args, cmd_env = parse_command(command)

    if not args:
        raise ValueError(f"Could not parse command: {command}")

    # Validate executable
    validate_executable(args[0], allowed_executables)

    # Build environment
    full_env = os.environ.copy()
    full_env.update(cmd_env)
    if env:
        full_env.update(env)

    # Run command safely (no shell)
    try:
        result = subprocess.run(
            args,
            cwd=cwd,
            timeout=timeout,
            capture_output=capture_output,
            text=True,
            env=full_env,
            shell=False,  # CRITICAL: Never use shell=True
        )

        return CommandResult(
            returncode=result.returncode,
            stdout=result.stdout or "",
            stderr=result.stderr or "",
        )

    except subprocess.TimeoutExpired as e:
        return CommandResult(
            returncode=-1,
            stdout=e.stdout or "" if hasattr(e, "stdout") else "",
            stderr=f"Command timed out after {timeout}s",
        )
    except FileNotFoundError:
        return CommandResult(
            returncode=-1,
            stdout="",
            stderr=f"Executable not found: {args[0]}",
        )


class ManagedProcess:
    """
    Context manager for subprocess with automatic resource cleanup.

    Ensures:
    - No shell injection (uses safe argument parsing)
    - Pipes are always closed
    - Process is terminated on exit
    - Resources are cleaned up even on exception

    Usage:
        with ManagedProcess("npm run dev", cwd=project_dir) as proc:
            # Do something while process runs
            pass
        # Process terminated, pipes closed automatically
    """

    def __init__(
        self,
        command: str,
        cwd: Path | str | None = None,
        allowed_executables: set[str] | None = None,
        env: dict[str, str] | None = None,
        capture_output: bool = True,
    ):
        """
        Initialize managed process.

        Args:
            command: Command string to execute
            cwd: Working directory
            allowed_executables: Custom allowlist
            env: Additional environment variables
            capture_output: Whether to capture stdout/stderr
        """
        self.command = command
        self.cwd = Path(cwd) if cwd else None
        self.allowed_executables = allowed_executables
        self.env = env
        self.capture_output = capture_output
        self.proc: subprocess.Popen | None = None
        self._stdout_closed = False
        self._stderr_closed = False

    def __enter__(self) -> "ManagedProcess":
        """Start the process."""
        # Parse and validate
        args, cmd_env = parse_command(self.command)

        if not args:
            raise ValueError(f"Could not parse command: {self.command}")

        validate_executable(args[0], self.allowed_executables)

        # Build environment
        full_env = os.environ.copy()
        full_env.update(cmd_env)
        if self.env:
            full_env.update(self.env)

        # Start process
        self.proc = subprocess.Popen(
            args,
            cwd=self.cwd,
            stdout=subprocess.PIPE if self.capture_output else None,
            stderr=subprocess.PIPE if self.capture_output else None,
            text=True,
            env=full_env,
            shell=False,  # CRITICAL: Never use shell=True
        )

        return self

    def __exit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> None:
        """Terminate process and cleanup resources."""
        self.terminate()

    def terminate(self, timeout: int = 10) -> bool:
        """
        Terminate the process and clean up resources.

        Args:
            timeout: Seconds to wait for graceful termination before kill

        Returns:
            True if terminated successfully
        """
        if self.proc is None:
            return True

        try:
            # Check if already terminated
            if self.proc.poll() is not None:
                self._cleanup_pipes()
                return True

            # Try graceful termination
            self.proc.terminate()
            try:
                self.proc.wait(timeout=timeout)
            except subprocess.TimeoutExpired:
                # Force kill
                self.proc.kill()
                self.proc.wait(timeout=5)

            return True

        except Exception as e:
            logger.warning(f"Error terminating process: {e}")
            return False

        finally:
            self._cleanup_pipes()

    def _cleanup_pipes(self) -> None:
        """Close stdout/stderr pipes if open."""
        if self.proc is None:
            return

        if self.proc.stdout and not self._stdout_closed:
            try:
                self.proc.stdout.close()
                self._stdout_closed = True
            except Exception:
                pass

        if self.proc.stderr and not self._stderr_closed:
            try:
                self.proc.stderr.close()
                self._stderr_closed = True
            except Exception:
                pass

    @property
    def pid(self) -> int | None:
        """Get process ID."""
        return self.proc.pid if self.proc else None

    @property
    def returncode(self) -> int | None:
        """Get return code (None if still running)."""
        if self.proc:
            return self.proc.poll()
        return None

    def is_running(self) -> bool:
        """Check if process is still running."""
        return self.proc is not None and self.proc.poll() is None

    def wait(self, timeout: int | None = None) -> int:
        """Wait for process to complete."""
        if self.proc:
            return self.proc.wait(timeout=timeout)
        return -1

    def read_output(self) -> tuple[str, str]:
        """
        Read stdout and stderr.

        Note: This should only be called after process completes.

        Returns:
            Tuple of (stdout, stderr)
        """
        if self.proc is None:
            return "", ""

        stdout = ""
        stderr = ""

        if self.proc.stdout:
            try:
                stdout = self.proc.stdout.read()
            except Exception:
                pass

        if self.proc.stderr:
            try:
                stderr = self.proc.stderr.read()
            except Exception:
                pass

        return stdout, stderr
