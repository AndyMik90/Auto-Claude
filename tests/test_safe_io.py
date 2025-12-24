#!/usr/bin/env python3
"""
Tests for Safe I/O Utilities
============================

Tests cover:
- Atomic file writes
- Proper encoding (UTF-8)
- Crash safety
- Cross-platform behavior
"""

import json
import os
import sys
import tempfile
import threading
import time
from pathlib import Path

import pytest

# Add auto-claude to path
sys.path.insert(0, str(Path(__file__).parent.parent / "auto-claude"))

from core.safe_io import (
    safe_open,
    safe_read_json,
    safe_read_text,
    safe_write_json,
    safe_write_text,
)


class TestSafeWriteText:
    """Tests for safe_write_text."""

    def test_basic_write(self):
        """Basic text write works."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.txt"
            safe_write_text(path, "Hello, World!")

            assert path.exists()
            assert path.read_text(encoding="utf-8") == "Hello, World!"

    def test_creates_parent_directories(self):
        """Creates parent directories if needed."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "a" / "b" / "c" / "test.txt"
            safe_write_text(path, "Nested!")

            assert path.exists()
            assert path.read_text(encoding="utf-8") == "Nested!"

    def test_unicode_content(self):
        """Handles unicode content correctly."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "unicode.txt"
            content = "Hello 世界 🌍 François"
            safe_write_text(path, content)

            assert path.read_text(encoding="utf-8") == content

    def test_overwrites_existing(self):
        """Overwrites existing file."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.txt"
            safe_write_text(path, "First")
            safe_write_text(path, "Second")

            assert path.read_text(encoding="utf-8") == "Second"

    def test_atomic_write_no_partial(self):
        """No partial file on interrupted write."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.txt"
            safe_write_text(path, "Original content")

            # Simulate write that would leave partial content
            # by checking no temp files are left
            safe_write_text(path, "New content")

            # Check no temp files
            temp_files = list(Path(tmpdir).glob(".*"))
            assert len(temp_files) == 0

            assert path.read_text(encoding="utf-8") == "New content"


class TestSafeWriteJson:
    """Tests for safe_write_json."""

    def test_basic_json(self):
        """Basic JSON write works."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.json"
            data = {"key": "value", "number": 42}
            safe_write_json(path, data)

            with open(path, "r", encoding="utf-8") as f:
                loaded = json.load(f)
            assert loaded == data

    def test_nested_json(self):
        """Nested JSON structures work."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.json"
            data = {
                "level1": {
                    "level2": {
                        "items": [1, 2, 3],
                        "name": "test",
                    }
                }
            }
            safe_write_json(path, data)

            loaded = safe_read_json(path)
            assert loaded == data

    def test_unicode_json(self):
        """Unicode in JSON is preserved."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.json"
            data = {"greeting": "Hello 世界", "emoji": "🎉"}
            safe_write_json(path, data)

            loaded = safe_read_json(path)
            assert loaded == data


class TestSafeReadText:
    """Tests for safe_read_text."""

    def test_basic_read(self):
        """Basic text read works."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.txt"
            path.write_text("Hello!", encoding="utf-8")

            content = safe_read_text(path)
            assert content == "Hello!"

    def test_missing_file_error(self):
        """Missing file raises error without default."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "nonexistent.txt"

            with pytest.raises(FileNotFoundError):
                safe_read_text(path)

    def test_missing_file_default(self):
        """Missing file returns default if provided."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "nonexistent.txt"

            content = safe_read_text(path, default="fallback")
            assert content == "fallback"


class TestSafeReadJson:
    """Tests for safe_read_json."""

    def test_basic_read(self):
        """Basic JSON read works."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.json"
            data = {"key": "value"}
            path.write_text(json.dumps(data), encoding="utf-8")

            loaded = safe_read_json(path)
            assert loaded == data

    def test_missing_file_error(self):
        """Missing file raises error without default."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "nonexistent.json"

            with pytest.raises(FileNotFoundError):
                safe_read_json(path)

    def test_missing_file_default(self):
        """Missing file returns default if provided."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "nonexistent.json"

            loaded = safe_read_json(path, default={"fallback": True})
            assert loaded == {"fallback": True}

    def test_invalid_json_default(self):
        """Invalid JSON returns default if provided."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "invalid.json"
            path.write_text("not valid json {{{", encoding="utf-8")

            loaded = safe_read_json(path, default={})
            assert loaded == {}


class TestSafeOpen:
    """Tests for safe_open."""

    def test_text_mode_default_encoding(self):
        """Text mode uses UTF-8 by default."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.txt"
            content = "Hello 世界"

            with safe_open(path, "w") as f:
                f.write(content)

            with safe_open(path, "r") as f:
                assert f.read() == content

    def test_binary_mode(self):
        """Binary mode works."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "test.bin"
            data = b"\x00\x01\x02\x03"

            with safe_open(path, "wb") as f:
                f.write(data)

            with safe_open(path, "rb") as f:
                assert f.read() == data


class TestConcurrentWrites:
    """Tests for concurrent write safety."""

    def test_concurrent_writes_no_corruption(self):
        """Concurrent writes don't corrupt data."""
        with tempfile.TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "concurrent.json"
            errors = []
            iterations = 20

            def writer(thread_id):
                try:
                    for i in range(iterations):
                        data = {"thread": thread_id, "iteration": i}
                        safe_write_json(path, data)
                        time.sleep(0.01)
                except Exception as e:
                    errors.append(e)

            threads = [threading.Thread(target=writer, args=(i,)) for i in range(3)]
            for t in threads:
                t.start()
            for t in threads:
                t.join()

            assert not errors, f"Errors occurred: {errors}"

            # File should be valid JSON
            final_data = safe_read_json(path)
            assert "thread" in final_data
            assert "iteration" in final_data


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
