"""Tests for gh_executable module - GitHub CLI executable finding."""

import os
import subprocess
from unittest.mock import patch, MagicMock

from core.gh_executable import (
    get_gh_executable,
    invalidate_gh_cache,
    run_gh,
    _find_gh_executable,
    _verify_gh_executable,
    _run_where_command,
)


class TestVerifyGhExecutable:
    """Tests for _verify_gh_executable() function."""

    def test_returns_true_for_valid_gh(self):
        """Should return True when gh --version succeeds."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=["gh", "--version"],
                returncode=0,
                stdout="gh version 2.40.0",
                stderr=""
            )

            result = _verify_gh_executable("/usr/bin/gh")
            assert result is True

    def test_returns_false_on_non_zero_exit(self):
        """Should return False when gh --version fails."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args=["gh", "--version"],
                returncode=1,
                stdout="",
                stderr="command not found"
            )

            result = _verify_gh_executable("/usr/bin/gh")
            assert result is False

    def test_returns_false_on_timeout(self):
        """Should return False when gh --version times out."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.TimeoutExpired(cmd="gh", timeout=5)

            result = _verify_gh_executable("/usr/bin/gh")
            assert result is False

    def test_returns_false_on_os_error(self):
        """Should return False when gh command fails with OSError."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.side_effect = OSError("Permission denied")

            result = _verify_gh_executable("/usr/bin/gh")
            assert result is False


class TestRunWhereCommand:
    """Tests for _run_where_command() function (Windows-specific)."""

    def test_returns_path_on_success(self):
        """Should return the first path found by where command."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args="where gh",
                returncode=0,
                stdout="C:\\Program Files\\GitHub CLI\\gh.exe\nC:\\other\\gh.exe",
                stderr=""
            )

            with patch("os.path.isfile", return_value=True):
                with patch("core.gh_executable._verify_gh_executable", return_value=True):
                    result = _run_where_command()
                    assert result == "C:\\Program Files\\GitHub CLI\\gh.exe"

    def test_returns_none_on_failure(self):
        """Should return None when where command fails."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.return_value = subprocess.CompletedProcess(
                args="where gh",
                returncode=1,
                stdout="",
                stderr="INFO: could not find files for the given pattern"
            )

            result = _run_where_command()
            assert result is None

    def test_returns_none_on_timeout(self):
        """Should return None when where command times out."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.side_effect = subprocess.TimeoutExpired(cmd="where gh", timeout=5)

            result = _run_where_command()
            assert result is None

    def test_returns_none_on_os_error(self):
        """Should return None on OSError."""
        with patch("core.gh_executable.subprocess.run") as mock_run:
            mock_run.side_effect = OSError("Command failed")

            result = _run_where_command()
            assert result is None


class TestFindGhExecutable:
    """Tests for _find_gh_executable() function."""

    def test_checks_env_var_first(self):
        """Should check GITHUB_CLI_PATH environment variable first."""
        test_path = "/custom/path/to/gh"

        with patch.dict(os.environ, {"GITHUB_CLI_PATH": test_path}, clear=False):
            with patch("os.path.isfile", return_value=True):
                with patch("core.gh_executable._verify_gh_executable", return_value=True):
                    result = _find_gh_executable()
                    assert result == test_path

    def test_falls_back_to_shutil_which(self):
        """Should fall back to shutil.which when env var not set."""
        with patch.dict(os.environ, {}, clear=False):
            with patch("shutil.which", return_value="/usr/bin/gh"):
                with patch("os.path.isfile", return_value=True):
                    with patch("core.gh_executable._verify_gh_executable", return_value=True):
                        result = _find_gh_executable()
                        assert result == "/usr/bin/gh"

    @patch("core.platform.is_windows", return_value=False)
    def test_checks_homebrew_paths_on_unix(self, mock_is_windows):
        """Should check Homebrew paths on Unix-like systems."""
        with patch.dict(os.environ, {}, clear=False):
            with patch("shutil.which", return_value=None):
                # Mock /opt/homebrew/bin/gh to exist and be valid
                with patch("os.path.isfile") as mock_isfile:
                    mock_isfile.side_effect = lambda path: path == "/opt/homebrew/bin/gh"
                    with patch("core.gh_executable._verify_gh_executable", return_value=True):
                        result = _find_gh_executable()
                        assert result == "/opt/homebrew/bin/gh"

    @patch("core.platform.is_windows", return_value=True)
    def test_checks_windows_program_files_paths(self, mock_is_windows):
        """Should check Windows Program Files paths on Windows."""
        with patch.dict(os.environ, {}, clear=False):
            with patch("shutil.which", return_value=None):
                # Mock Windows Program Files gh.exe to exist
                with patch("os.path.isfile") as mock_isfile:
                    mock_isfile.side_effect = lambda path: "GitHub CLI" in path and path.endswith(".exe")
                    with patch("os.path.expandvars", side_effect=lambda x: x.replace("%PROGRAMFILES%", "C:\\Program Files").replace("%PROGRAMFILES(X86)%", "C:\\Program Files (x86)")):
                        with patch("core.gh_executable._verify_gh_executable", return_value=True):
                            result = _find_gh_executable()
                            # Should find the first Program Files path
                            assert "GitHub CLI" in result
                            assert result.endswith(".exe")

    @patch("core.platform.is_windows", return_value=True)
    def test_checks_windows_npm_scoop_chocolatey_paths(self, mock_is_windows):
        """Should check npm, Scoop, and Chocolatey paths on Windows."""
        with patch.dict(os.environ, {}, clear=False):
            with patch("shutil.which", return_value=None):
                with patch("os.path.expanduser", return_value="C:\\Users\\TestUser"):
                    with patch("os.path.expandvars", side_effect=lambda x: x.replace("%PROGRAMDATA%", "C:\\ProgramData")):
                        # Mock npm gh.cmd to exist
                        with patch("os.path.isfile") as mock_isfile:
                            def isfile_side_effect(path):
                                if "npm" in path and "gh.cmd" in path:
                                    return True
                                if "scoop" in path:
                                    return True
                                if "chocolatey" in path:
                                    return True
                                return False
                            mock_isfile.side_effect = isfile_side_effect
                            with patch("core.gh_executable._verify_gh_executable", return_value=True):
                                result = _find_gh_executable()
                                # Should find npm gh.cmd first (it's checked before scoop/chocolatey)
                                assert "npm" in result
                                assert "gh.cmd" in result

    @patch("core.platform.is_windows", return_value=True)
    def test_runs_where_command_on_windows(self, mock_is_windows):
        """Should run 'where gh' command as last resort on Windows."""
        with patch.dict(os.environ, {}, clear=False):
            with patch("shutil.which", return_value=None):
                with patch("os.path.isfile", return_value=False):
                    with patch("core.gh_executable._run_where_command", return_value="C:\\found\\gh.exe"):
                        result = _find_gh_executable()
                        assert result == "C:\\found\\gh.exe"

    @patch("core.platform.is_windows", return_value=False)
    def test_returns_none_on_unix_when_not_found(self, mock_is_windows):
        """Should return None on Unix when gh is not found."""
        with patch.dict(os.environ, {}, clear=False):
            with patch("shutil.which", return_value=None):
                with patch("os.path.isfile", return_value=False):
                    result = _find_gh_executable()
                    assert result is None


class TestGetGhExecutable:
    """Tests for get_gh_executable() function."""

    def test_returns_cached_result(self):
        """Should cache the result after first successful find."""
        with patch("core.gh_executable._find_gh_executable", return_value="/usr/bin/gh"):
            result1 = get_gh_executable()
            result2 = get_gh_executable()

            # Should call _find_gh_executable only once due to caching
            assert result1 == result2
            assert result1 == "/usr/bin/gh"

    def test_invalidate_cache_works(self):
        """Should invalidate cache when invalidate_gh_cache() is called."""
        with patch("core.gh_executable._find_gh_executable") as mock_find:
            mock_find.return_value = "/usr/bin/gh"

            # First call
            result1 = get_gh_executable()
            assert result1 == "/usr/bin/gh"

            # Invalidate cache
            invalidate_gh_cache()

            # Second call should trigger _find_gh_executable again
            result2 = get_gh_executable()
            assert result2 == "/usr/bin/gh"

            # Should have been called twice due to cache invalidation
            assert mock_find.call_count == 2


class TestRunGh:
    """Tests for run_gh() function."""

    def test_runs_gh_command(self):
        """Should run gh command with proper arguments."""
        with patch("core.gh_executable.get_gh_executable", return_value="/usr/bin/gh"):
            with patch("core.gh_executable.subprocess.run") as mock_run:
                mock_run.return_value = subprocess.CompletedProcess(
                    args=["/usr/bin/gh", "auth", "status"],
                    returncode=0,
                    stdout="GitHub CLI: authenticated",
                    stderr=""
                )

                result = run_gh(["auth", "status"])

                assert result.returncode == 0
                assert "authenticated" in result.stdout
                mock_run.assert_called_once()

    def test_returns_error_when_gh_not_found(self):
        """Should return error result when gh is not found."""
        with patch("core.gh_executable.get_gh_executable", return_value=None):
            result = run_gh(["auth", "status"])

            assert result.returncode == -1
            assert "not found" in result.stderr
            assert "cli.github.com" in result.stderr

    def test_handles_timeout(self):
        """Should handle timeout gracefully."""
        with patch("core.gh_executable.get_gh_executable", return_value="/usr/bin/gh"):
            with patch("core.gh_executable.subprocess.run") as mock_run:
                mock_run.side_effect = subprocess.TimeoutExpired(cmd="gh", timeout=60)

                result = run_gh(["auth", "status"], timeout=60)

                assert result.returncode == -1
                assert "timed out" in result.stderr

    def test_handles_file_not_found(self):
        """Should handle missing gh executable gracefully."""
        with patch("core.gh_executable.get_gh_executable", return_value="/usr/bin/gh"):
            with patch("core.gh_executable.subprocess.run") as mock_run:
                mock_run.side_effect = FileNotFoundError()

                result = run_gh(["auth", "status"])

                assert result.returncode == -1
                assert "not found" in result.stderr

    def test_passes_input_data(self):
        """Should pass input data to stdin."""
        with patch("core.gh_executable.get_gh_executable", return_value="/usr/bin/gh"):
            with patch("core.gh_executable.subprocess.run") as mock_run:
                mock_run.return_value = subprocess.CompletedProcess(
                    args=["/usr/bin/gh", "api", "/user"],
                    returncode=0,
                    stdout='{"login": "test"}',
                    stderr=""
                )

                result = run_gh(["api", "/user"], input_data="test input")

                assert result.returncode == 0
                # Verify input was passed
                call_kwargs = mock_run.call_args.kwargs
                assert call_kwargs["input"] == "test input"

    def test_respects_custom_working_directory(self):
        """Should run command in specified working directory."""
        with patch("core.gh_executable.get_gh_executable", return_value="/usr/bin/gh"):
            with patch("core.gh_executable.subprocess.run") as mock_run:
                mock_run.return_value = subprocess.CompletedProcess(
                    args=["/usr/bin/gh", "status"],
                    returncode=0,
                    stdout="",
                    stderr=""
                )

                result = run_gh(["status"], cwd="/custom/dir")

                assert result.returncode == 0
                # Verify cwd was passed
                call_kwargs = mock_run.call_args.kwargs
                assert call_kwargs["cwd"] == "/custom/dir"
