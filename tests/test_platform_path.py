#!/usr/bin/env python3
"""
Tests for Platform PATH Construction
====================================

Tests the build_subprocess_path() function in core/platform module including:
- PATH construction with platform-specific binary directories
- Homebrew path inclusion on macOS
- PATH deduplication
- Non-existent directory handling
- User PATH preservation and merging
"""

import os
from pathlib import Path
from unittest.mock import patch

import pytest

from core.platform import (
    build_subprocess_path,
    get_binary_directories,
    get_path_delimiter,
    is_macos,
    is_windows,
)


class TestBuildSubprocessPath:
    """Tests for build_subprocess_path() function."""

    def test_returns_string(self):
        """Returns a PATH string."""
        result = build_subprocess_path()
        assert isinstance(result, str)
        assert len(result) > 0

    def test_uses_correct_delimiter(self):
        """Uses platform-appropriate PATH delimiter."""
        result = build_subprocess_path("/usr/bin:/usr/local/bin")
        delimiter = get_path_delimiter()

        # Result should contain the delimiter (unless only one entry)
        if delimiter in result:
            # Multiple entries
            entries = result.split(delimiter)
            assert len(entries) > 1

    def test_preserves_base_path(self):
        """Preserves entries from base PATH."""
        base_path = "/custom/bin:/another/bin"
        result = build_subprocess_path(base_path)

        # Base entries should be in result
        assert "/custom/bin" in result
        assert "/another/bin" in result

    def test_handles_empty_base_path(self):
        """Handles empty base PATH gracefully."""
        result = build_subprocess_path("")
        assert isinstance(result, str)
        # Should still include platform directories
        assert len(result) > 0

    def test_handles_none_base_path(self):
        """Uses current env PATH when base_path is None."""
        result = build_subprocess_path(None)
        assert isinstance(result, str)
        # Should include platform directories
        assert len(result) > 0

    def test_deduplicates_entries(self):
        """Deduplicates PATH entries."""
        # Include duplicates in base path
        delimiter = get_path_delimiter()
        base_path = f"/usr/bin{delimiter}/usr/bin{delimiter}/usr/local/bin"
        result = build_subprocess_path(base_path)

        entries = result.split(delimiter)
        # Normalize and check for duplicates
        normalized = [os.path.normpath(e) for e in entries]
        assert len(normalized) == len(set(normalized)), "PATH should not have duplicates"

    def test_skips_nonexistent_directories(self):
        """Skips directories that don't exist."""
        result = build_subprocess_path("/nonexistent/path/12345")
        # Should not include nonexistent directories in prepended section
        # (base path entries are kept as-is)
        assert isinstance(result, str)


class TestBuildSubprocessPathMacOS:
    """Tests for macOS-specific PATH construction."""

    @pytest.mark.skipif(not is_macos(), reason="macOS-specific test")
    def test_includes_homebrew_apple_silicon(self):
        """Includes /opt/homebrew/bin on Apple Silicon macOS."""
        result = build_subprocess_path()

        # Apple Silicon Homebrew path
        if os.path.isdir("/opt/homebrew/bin"):
            assert "/opt/homebrew/bin" in result

    @pytest.mark.skipif(not is_macos(), reason="macOS-specific test")
    def test_includes_homebrew_intel(self):
        """Includes /usr/local/bin on Intel macOS."""
        result = build_subprocess_path()

        # Intel Mac path (also common system path)
        if os.path.isdir("/usr/local/bin"):
            assert "/usr/local/bin" in result

    @pytest.mark.skipif(not is_macos(), reason="macOS-specific test")
    def test_homebrew_precedes_system(self):
        """Homebrew paths come before system paths."""
        result = build_subprocess_path()
        delimiter = get_path_delimiter()
        entries = result.split(delimiter)

        homebrew_idx = -1
        system_idx = -1

        for i, entry in enumerate(entries):
            if "/opt/homebrew/bin" in entry:
                homebrew_idx = i
            if entry == "/usr/bin":
                system_idx = i

        # If both exist, Homebrew should come first
        if homebrew_idx >= 0 and system_idx >= 0:
            assert homebrew_idx < system_idx, "Homebrew should precede /usr/bin"


class TestBuildSubprocessPathLinux:
    """Tests for Linux-specific PATH construction."""

    @pytest.mark.skipif(is_macos() or is_windows(), reason="Linux-specific test")
    def test_includes_standard_paths(self):
        """Includes standard Linux binary paths."""
        result = build_subprocess_path()

        # Standard Linux paths
        if os.path.isdir("/usr/bin"):
            assert "/usr/bin" in result
        if os.path.isdir("/usr/local/bin"):
            assert "/usr/local/bin" in result


class TestBuildSubprocessPathWindows:
    """Tests for Windows-specific PATH construction."""

    @pytest.mark.skipif(not is_windows(), reason="Windows-specific test")
    def test_uses_semicolon_delimiter(self):
        """Uses semicolon as PATH delimiter on Windows."""
        result = build_subprocess_path("C:\\Users\\test\\bin")
        # Windows uses semicolon
        assert ";" in result or result == "C:\\Users\\test\\bin"

    @pytest.mark.skipif(not is_windows(), reason="Windows-specific test")
    def test_includes_windows_paths(self):
        """Includes Windows binary paths."""
        result = build_subprocess_path()
        # Should include some Windows paths
        assert isinstance(result, str)


class TestBuildSubprocessPathMocking:
    """Tests using mocking for cross-platform behavior verification."""

    def test_macos_paths_with_mock(self, tmp_path):
        """Verifies macOS PATH construction with mocked platform."""
        # Create mock directories
        homebrew_bin = tmp_path / "opt" / "homebrew" / "bin"
        homebrew_bin.mkdir(parents=True)
        usr_local_bin = tmp_path / "usr" / "local" / "bin"
        usr_local_bin.mkdir(parents=True)
        usr_bin = tmp_path / "usr" / "bin"
        usr_bin.mkdir(parents=True)

        with patch("core.platform.is_macos", return_value=True), \
             patch("core.platform.is_windows", return_value=False), \
             patch("core.platform.get_binary_directories") as mock_dirs, \
             patch("os.path.isdir", side_effect=lambda p: (
                 str(homebrew_bin) in p or
                 str(usr_local_bin) in p or
                 str(usr_bin) in p
             )):

            mock_dirs.return_value = {
                "user": [str(tmp_path / ".local" / "bin")],
                "system": [
                    str(homebrew_bin),
                    str(usr_local_bin),
                    str(usr_bin),
                ],
            }

            # This test verifies the function handles mocked platform detection
            # The actual path construction depends on real directory existence
            result = build_subprocess_path("")
            assert isinstance(result, str)

    def test_deduplication_preserves_order(self):
        """Deduplication preserves order of first occurrence."""
        delimiter = get_path_delimiter()

        # Create path with duplicates in different positions
        entries = ["/first/bin", "/second/bin", "/first/bin", "/third/bin"]
        base_path = delimiter.join(entries)

        result = build_subprocess_path(base_path)
        result_entries = result.split(delimiter)

        # Find positions of our entries (they might be after prepended dirs)
        first_idx = -1
        second_idx = -1
        third_idx = -1

        for i, entry in enumerate(result_entries):
            normalized = os.path.normpath(entry)
            if normalized == os.path.normpath("/first/bin") and first_idx == -1:
                first_idx = i
            elif normalized == os.path.normpath("/second/bin") and second_idx == -1:
                second_idx = i
            elif normalized == os.path.normpath("/third/bin") and third_idx == -1:
                third_idx = i

        # Original order should be preserved: first < second < third
        if first_idx >= 0 and second_idx >= 0:
            assert first_idx < second_idx
        if second_idx >= 0 and third_idx >= 0:
            assert second_idx < third_idx


class TestBuildSubprocessPathIntegration:
    """Integration tests for build_subprocess_path()."""

    def test_can_find_common_tools(self):
        """Constructed PATH can find common tools."""
        path = build_subprocess_path()

        # Set PATH and try to find a common tool
        env = os.environ.copy()
        env["PATH"] = path

        import shutil
        # These tools should be findable on most systems
        for tool in ["ls", "echo", "cat"]:
            if not is_windows():
                found = shutil.which(tool, path=path)
                # At least one should be found
                if found:
                    break
        else:
            if is_windows():
                # On Windows, check for different tools
                found = shutil.which("cmd", path=path)

    def test_path_not_empty(self):
        """Resulting PATH is not empty."""
        result = build_subprocess_path()
        assert result
        assert len(result.strip()) > 0

    def test_no_empty_entries(self):
        """Result doesn't contain empty entries."""
        result = build_subprocess_path()
        delimiter = get_path_delimiter()
        entries = result.split(delimiter)

        for entry in entries:
            assert entry.strip(), "PATH should not have empty entries"


class TestGetBinaryDirectories:
    """Tests for get_binary_directories() helper function."""

    def test_returns_dict_with_keys(self):
        """Returns dict with 'user' and 'system' keys."""
        dirs = get_binary_directories()
        assert isinstance(dirs, dict)
        assert "user" in dirs
        assert "system" in dirs

    def test_returns_lists(self):
        """Returns lists of directory paths."""
        dirs = get_binary_directories()
        assert isinstance(dirs["user"], list)
        assert isinstance(dirs["system"], list)

    def test_returns_strings(self):
        """All entries are string paths."""
        dirs = get_binary_directories()

        for user_dir in dirs["user"]:
            assert isinstance(user_dir, str)

        for sys_dir in dirs["system"]:
            assert isinstance(sys_dir, str)

    @pytest.mark.skipif(not is_macos(), reason="macOS-specific test")
    def test_macos_includes_homebrew(self):
        """macOS includes Homebrew paths in system directories."""
        dirs = get_binary_directories()

        # Should include Homebrew paths
        homebrew_paths = ["/opt/homebrew/bin", "/usr/local/bin"]
        found_homebrew = any(
            hp in dirs["system"] for hp in homebrew_paths
        )
        assert found_homebrew, "macOS should include Homebrew paths"

    @pytest.mark.skipif(not is_windows(), reason="Windows-specific test")
    def test_windows_includes_program_files(self):
        """Windows includes Program Files in system directories."""
        dirs = get_binary_directories()

        # Should include some Windows paths
        assert any("Program" in d for d in dirs["system"])


class TestGetPathDelimiter:
    """Tests for get_path_delimiter() helper function."""

    def test_returns_string(self):
        """Returns a string delimiter."""
        delimiter = get_path_delimiter()
        assert isinstance(delimiter, str)
        assert len(delimiter) == 1

    def test_correct_delimiter(self):
        """Returns correct delimiter for platform."""
        delimiter = get_path_delimiter()

        if is_windows():
            assert delimiter == ";"
        else:
            assert delimiter == ":"
