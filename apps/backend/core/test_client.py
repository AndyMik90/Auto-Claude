#!/usr/bin/env python3
"""
Unit tests for core/client.py glob pattern matching.

Run with: pytest apps/backend/core/test_client.py -v
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.client import _match_glob_pattern


class TestMatchGlobPattern:
    """Tests for _match_glob_pattern function covering nested-path glob semantics."""

    def test_nested_directory_wildcard(self):
        """Test ** matches arbitrary nested directories."""
        assert _match_glob_pattern("src/**/*.ts", "src/a/b/c/file.ts") is True

    def test_leading_and_trailing_double_star(self):
        """Test **/dir/**/*.ext pattern matches paths with test in middle."""
        assert _match_glob_pattern("**/test/**/*.ts", "foo/test/bar/baz.ts") is True

    def test_deeply_nested_test_directory(self):
        """Test ** handles deeply nested paths with target directory."""
        assert (
            _match_glob_pattern("src/**/test/**", "src/deep/nested/test/files") is True
        )

    def test_double_star_does_not_match_partial_names(self):
        """Test ** does not incorrectly match partial directory names (contest vs test)."""
        assert _match_glob_pattern("src/**/test/*.ts", "src/contest.ts") is False
