#!/usr/bin/env python3
"""
Unit tests for core/client.py glob pattern matching.

Run with: pytest apps/backend/core/test_client.py -v
"""

import sys
from pathlib import Path

# Add parent directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent))

from core.client import _match_glob_pattern, _parse_rule_frontmatter


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

    # Edge cases requested by CodeRabbit review
    def test_standalone_double_star_matches_any_path(self):
        """Test ** alone matches any non-empty filepath."""
        assert _match_glob_pattern("**", "any/path/file.ts") is True
        assert _match_glob_pattern("**", "file.ts") is True
        assert _match_glob_pattern("**", "deep/nested/path/to/file.tsx") is True

    def test_standalone_double_star_matches_empty_path(self):
        """Test ** matches empty filepath (edge case)."""
        assert _match_glob_pattern("**", "") is True

    def test_double_star_no_slash_suffix(self):
        """Test **.ts (no slash after **) matches files ending in .ts."""
        # Should match .ts files at any depth
        assert _match_glob_pattern("**.ts", "file.ts") is True
        assert _match_glob_pattern("**.ts", "src/file.ts") is True
        assert _match_glob_pattern("**.ts", "deep/nested/file.ts") is True

    def test_double_star_no_slash_negative_cases(self):
        """Test **.ts does not match non-.ts files."""
        assert _match_glob_pattern("**.ts", "file.tsx") is False
        assert _match_glob_pattern("**.ts", "file.js") is False
        assert _match_glob_pattern("**.ts", "src/file.tsx") is False

    def test_empty_filepath_with_specific_pattern(self):
        """Test empty filepath does not match specific patterns."""
        assert _match_glob_pattern("src/**/*.ts", "") is False
        assert _match_glob_pattern("*.ts", "") is False

    def test_empty_pattern_edge_case(self):
        """Test empty pattern behavior."""
        assert _match_glob_pattern("", "") is True
        assert _match_glob_pattern("", "file.ts") is False


class TestParseRuleFrontmatter:
    """Tests for _parse_rule_frontmatter function covering YAML frontmatter parsing."""

    def test_simple_paths_only(self):
        """Test parsing frontmatter with only paths."""
        content = """---
paths:
  - src/app/api/**/*.ts
  - src/components/**
---

# Rule Content

Some rule text here.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert paths == ["src/app/api/**/*.ts", "src/components/**"]
        assert skills == []
        assert "# Rule Content" in rule_content
        assert "Some rule text here." in rule_content

    def test_inline_paths_array(self):
        """Test parsing inline paths array format."""
        content = """---
paths: [src/**/*.ts, tests/**/*.ts]
---

Rule content.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert "src/**/*.ts" in paths
        assert "tests/**/*.ts" in paths
        assert "Rule content." in rule_content

    def test_simple_require_skills_format(self):
        """Test parsing simple require_skills array."""
        content = """---
paths:
  - src/**
require_skills:
  - /security-audit
  - /review
---

Content here.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert paths == ["src/**"]
        assert len(skills) == 2
        assert skills[0]["skill"] == "/security-audit"
        assert skills[0]["when"] == "per_subtask"  # default
        assert skills[1]["skill"] == "/review"

    def test_structured_skill_with_when(self):
        """Test parsing structured skill format with 'when' timing."""
        content = """---
paths:
  - src/app/api/**
require_skills:
  - skill: /security-audit
    when: end_of_coding
  - skill: /review
    when: qa_phase
---

API rules.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert paths == ["src/app/api/**"]
        assert len(skills) == 2
        assert skills[0]["skill"] == "/security-audit"
        assert skills[0]["when"] == "end_of_coding"
        assert skills[1]["skill"] == "/review"
        assert skills[1]["when"] == "qa_phase"

    def test_structured_skill_with_paths(self):
        """Test parsing structured skill with nested paths filter."""
        content = """---
paths:
  - src/**
require_skills:
  - skill: /security-audit
    when: end_of_coding
    paths:
      - src/app/api/**
      - src/lib/auth/**
---

Security focused rules.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert len(skills) == 1
        assert skills[0]["skill"] == "/security-audit"
        assert skills[0]["when"] == "end_of_coding"
        assert "src/app/api/**" in skills[0]["paths"]
        assert "src/lib/auth/**" in skills[0]["paths"]

    def test_inline_require_skills_array(self):
        """Test parsing inline require_skills array format."""
        content = """---
paths: [src/**]
require_skills: [/audit, /review]
---

Content.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert len(skills) == 2
        assert skills[0]["skill"] == "/audit"
        assert skills[1]["skill"] == "/review"

    def test_invalid_when_value_uses_default(self):
        """Test that invalid 'when' values fall back to default."""
        content = """---
paths:
  - src/**
require_skills:
  - skill: /audit
    when: invalid_phase
---

Content.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert len(skills) == 1
        assert skills[0]["when"] == "per_subtask"  # Falls back to default

    def test_empty_frontmatter(self):
        """Test handling of empty frontmatter."""
        content = """---
---

Just content, no metadata.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert paths == []
        assert skills == []
        assert "Just content, no metadata." in rule_content

    def test_no_frontmatter(self):
        """Test handling of content without frontmatter."""
        content = """# Just a regular markdown file

No YAML frontmatter here.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert paths == []
        assert skills == []
        assert rule_content == ""  # No frontmatter means no valid rule

    def test_missing_closing_delimiter(self):
        """Test handling of frontmatter without closing ---."""
        content = """---
paths:
  - src/**

This content has no closing delimiter.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        # Should still parse paths but may have issues with content
        assert "src/**" in paths or paths == []

    def test_paths_before_require_skills(self):
        """Test that paths followed by require_skills parses correctly."""
        content = """---
paths:
  - src/app/api/**/*.ts
require_skills:
  - /security-audit
---

Rules here.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert paths == ["src/app/api/**/*.ts"]
        assert len(skills) == 1
        assert skills[0]["skill"] == "/security-audit"

    def test_require_skills_before_paths(self):
        """Test that require_skills followed by paths parses correctly."""
        content = """---
require_skills:
  - /security-audit
paths:
  - src/app/api/**/*.ts
---

Rules here.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert paths == ["src/app/api/**/*.ts"]
        assert len(skills) == 1
        assert skills[0]["skill"] == "/security-audit"

    def test_quoted_path_values(self):
        """Test that quoted path values are handled correctly."""
        content = """---
paths:
  - "src/app/api/**/*.ts"
  - 'src/components/**'
---

Content.
"""
        paths, skills, rule_content = _parse_rule_frontmatter(content)
        assert "src/app/api/**/*.ts" in paths
        assert "src/components/**" in paths
