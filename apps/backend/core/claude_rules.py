"""
Claude Code Rules Support (.claude/rules/)

Supports Claude Code's path-based rules convention where rules in .claude/rules/
are automatically loaded based on which files are being modified.

Rule files use YAML frontmatter with 'paths' array containing glob patterns:

  ---
  paths:
    - src/app/api/**/*.ts
    - src/components/**/*.tsx
  require_skills:
    - skill: /security-audit
      when: end_of_coding
  ---

  # Rule Content Here
  ...

Note on YAML parsing:
    This module uses a custom lightweight parser for frontmatter, NOT a full YAML
    parser like PyYAML. This is intentional to avoid adding dependencies. The parser
    supports only the subset needed for rules: paths lists, require_skills with
    nested properties, and inline arrays. Complex YAML features (anchors, aliases,
    multi-line strings with | or >, etc.) are NOT supported.
"""

import fnmatch
import json
import logging
import os
import re
import time
from pathlib import Path

from core.config import should_use_claude_rules

logger = logging.getLogger(__name__)

# Valid values for the 'when' field in require_skills
VALID_WHEN_VALUES = frozenset({"planning", "per_subtask", "end_of_coding", "qa_phase"})
DEFAULT_WHEN_VALUE = "per_subtask"

# Cache for parsed rules to avoid re-reading files on every create_client() call
# Key: project_dir path string
# Value: (all_rules list, timestamp)
_RULES_CACHE: dict[str, tuple[list[tuple[Path, list[str], list[dict], str]], float]] = {}
_RULES_CACHE_TTL_SECONDS = 300  # 5 minute cache, same as project index


def _parse_inline_array(value: str) -> list[str]:
    """
    Parse an inline YAML array format: [item1, item2, item3]

    Args:
        value: String containing inline array (e.g., "[src/**, tests/**]")

    Returns:
        List of parsed items with quotes stripped
    """
    match = re.search(r"\[(.*)\]", value)
    if match:
        return [p.strip().strip("'\"") for p in match.group(1).split(",") if p.strip()]
    return []


def _parse_paths_section(
    lines: list[str], start_idx: int
) -> tuple[list[str], int]:
    """
    Parse a paths: section from frontmatter lines.

    Args:
        lines: List of frontmatter lines
        start_idx: Index of the line containing "paths:"

    Returns:
        Tuple of (parsed_paths, next_line_index)
    """
    paths = []
    line = lines[start_idx]
    stripped = line.strip()

    # Check for inline array: paths: [a, b, c]
    if "[" in stripped:
        paths = _parse_inline_array(stripped)
        return paths, start_idx + 1

    # Parse multi-line list
    i = start_idx + 1
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()

        if stripped.startswith("- "):
            paths.append(stripped[2:].strip().strip("'\""))
            i += 1
        elif stripped and not stripped.startswith("#"):
            # End of paths section
            break
        else:
            i += 1

    return paths, i


def _parse_skill_entry(
    lines: list[str], start_idx: int, base_indent: int
) -> tuple[dict | None, int]:
    """
    Parse a single skill entry from require_skills section.

    Handles both simple format ("- /review") and structured format:
        - skill: /review
          when: end_of_coding
          paths:
            - src/api/**

    Args:
        lines: List of frontmatter lines
        start_idx: Index of the line containing "- "
        base_indent: Indentation level of the list item

    Returns:
        Tuple of (skill_dict or None, next_line_index)
    """
    line = lines[start_idx]
    stripped = line.strip()
    item_content = stripped[2:].strip()  # Remove "- " prefix

    # Check if it's structured format: "- skill: /review"
    if item_content.startswith("skill:"):
        skill_name = item_content[6:].strip().strip("'\"")
        skill = {"skill": skill_name, "when": DEFAULT_WHEN_VALUE}

        # Look for nested properties (when, paths)
        i = start_idx + 1
        while i < len(lines):
            nested_line = lines[i]
            nested_stripped = nested_line.strip()
            nested_indent = len(nested_line) - len(nested_line.lstrip())

            # Stop if we hit same or lower indent (next list item or section)
            if nested_stripped and not nested_stripped.startswith("#"):
                if nested_indent <= base_indent:
                    break

            if nested_stripped.startswith("when:"):
                when_value = nested_stripped[5:].strip().strip("'\"")
                if when_value in VALID_WHEN_VALUES:
                    skill["when"] = when_value
                i += 1
            elif nested_stripped.startswith("paths:"):
                # Parse skill-level paths
                if "[" in nested_stripped:
                    skill["paths"] = _parse_inline_array(nested_stripped)
                    i += 1
                else:
                    # Multi-line paths list
                    skill_paths = []
                    i += 1
                    while i < len(lines):
                        path_line = lines[i]
                        path_stripped = path_line.strip()
                        path_indent = len(path_line) - len(path_line.lstrip())

                        if path_stripped.startswith("- ") and path_indent > base_indent:
                            skill_paths.append(path_stripped[2:].strip().strip("'\""))
                            i += 1
                        elif path_stripped and not path_stripped.startswith("#"):
                            break
                        else:
                            i += 1
                    skill["paths"] = skill_paths
            elif nested_stripped.startswith("- "):
                # Next list item
                break
            else:
                i += 1

        return skill, i
    else:
        # Simple format: "- /review"
        skill_name = item_content.strip("'\"")
        if skill_name:
            return {"skill": skill_name, "when": DEFAULT_WHEN_VALUE}, start_idx + 1
        return None, start_idx + 1


def _parse_skills_section(
    lines: list[str], start_idx: int
) -> tuple[list[dict], int]:
    """
    Parse a require_skills: section from frontmatter lines.

    Args:
        lines: List of frontmatter lines
        start_idx: Index of the line containing "require_skills:"

    Returns:
        Tuple of (parsed_skills, next_line_index)
    """
    skills = []
    line = lines[start_idx]
    stripped = line.strip()

    # Check for inline array: require_skills: [/skill1, /skill2]
    if "[" in stripped:
        for s in _parse_inline_array(stripped):
            if s:
                skills.append({"skill": s, "when": DEFAULT_WHEN_VALUE})
        return skills, start_idx + 1

    # Parse multi-line list
    i = start_idx + 1
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        indent = len(line) - len(line.lstrip())

        if stripped.startswith("- "):
            skill, i = _parse_skill_entry(lines, i, indent)
            if skill:
                skills.append(skill)
        elif stripped and not stripped.startswith("#"):
            # End of skills section (hit another top-level key)
            break
        else:
            i += 1

    return skills, i


def _parse_rule_frontmatter(content: str) -> tuple[list[str], list[dict], str]:
    """
    Parse YAML frontmatter from a rule file to extract path patterns and required skills.

    Uses focused helper functions for cleaner parsing logic.

    Args:
        content: Full content of the rule file

    Returns:
        Tuple of (path_patterns, required_skills, rule_content_without_frontmatter)

        required_skills is a list of dicts with format:
        {"skill": "/review", "when": "end_of_coding", "paths": ["src/**"]}

        Supported 'when' values:
        - "planning": Planner should include in implementation_plan.json
        - "per_subtask": Coder runs on each matching subtask (default)
        - "end_of_coding": Coder runs once after ALL subtasks complete
        - "qa_phase": QA agent runs during review
    """
    if not content.startswith("---"):
        # No frontmatter means this isn't a valid rule file
        return [], [], ""

    # Find the closing ---
    lines = content.split("\n")
    end_idx = -1
    for i, line in enumerate(lines[1:], 1):
        if line.strip() == "---":
            end_idx = i
            break

    if end_idx == -1:
        # Missing closing delimiter means malformed frontmatter
        return [], [], ""

    # Parse the frontmatter using focused helper functions
    frontmatter_lines = lines[1:end_idx]
    paths: list[str] = []
    skills: list[dict] = []

    i = 0
    while i < len(frontmatter_lines):
        line = frontmatter_lines[i]
        stripped = line.strip()

        if stripped.startswith("paths:"):
            parsed_paths, i = _parse_paths_section(frontmatter_lines, i)
            paths = parsed_paths
        elif stripped.startswith("require_skills:"):
            parsed_skills, i = _parse_skills_section(frontmatter_lines, i)
            skills = parsed_skills
        else:
            i += 1

    # Return content without frontmatter
    rule_content = "\n".join(lines[end_idx + 1 :]).strip()
    return paths, skills, rule_content


def _match_glob_pattern(pattern: str, filepath: str) -> bool:
    """
    Match a glob pattern against a file path.

    Supports:
    - ** for any directory depth (including multiple ** in a pattern)
    - * for any characters within a path segment
    - Direct path matching

    Args:
        pattern: Glob pattern (e.g., "src/app/api/**/*.ts")
        filepath: File path to check (e.g., "src/app/api/films/route.ts")

    Returns:
        True if the pattern matches the filepath
    """
    # Normalize paths
    pattern = pattern.replace("\\", "/").strip("/")
    filepath = filepath.replace("\\", "/").strip("/")

    # Handle ** patterns by converting to regex
    if "**" in pattern:
        # Convert glob pattern to regex
        regex_pattern = ""
        i = 0
        while i < len(pattern):
            if pattern[i : i + 2] == "**":
                i += 2
                # Check if ** is followed by /
                if i < len(pattern) and pattern[i] == "/":
                    # **/ matches zero or more directory segments
                    regex_pattern += "(?:.*/)?"
                    i += 1  # Skip the /
                else:
                    # ** at end or before non-/ matches remaining path
                    regex_pattern += ".*"
            elif pattern[i] == "*":
                # * matches any characters except /
                regex_pattern += "[^/]*"
                i += 1
            elif pattern[i] == "?":
                # ? matches any single character except /
                regex_pattern += "[^/]"
                i += 1
            elif pattern[i] in ".^$+{}[]|()":
                # Escape regex special characters
                regex_pattern += "\\" + pattern[i]
                i += 1
            else:
                regex_pattern += pattern[i]
                i += 1

        # Match the full path
        regex_pattern = "^" + regex_pattern + "$"
        return bool(re.match(regex_pattern, filepath))

    # Simple glob matching for patterns without **
    return fnmatch.fnmatch(filepath, pattern)


def _discover_rules_directory(project_dir: Path) -> Path | None:
    """
    Find the .claude/rules/ directory if it exists.

    Args:
        project_dir: Root directory of the project

    Returns:
        Path to rules directory if found, None otherwise
    """
    rules_dir = project_dir / ".claude" / "rules"
    if not rules_dir.exists() or not rules_dir.is_dir():
        return None

    # Security: Verify the resolved path is still under project_dir
    # This prevents symlink attacks where .claude or rules points outside
    try:
        resolved_rules = rules_dir.resolve()
        resolved_project = project_dir.resolve()
        if not resolved_rules.is_relative_to(resolved_project):
            logger.warning(
                f"Rules directory {rules_dir} resolves outside project: {resolved_rules}"
            )
            return None
    except (OSError, ValueError) as e:
        logger.warning(f"Failed to resolve rules directory path: {e}")
        return None

    return resolved_rules


def _collect_all_rules(
    rules_dir: Path,
    project_dir: Path,
) -> list[tuple[Path, list[str], list[dict], str]]:
    """
    Recursively collect all rule files from the rules directory.

    Uses a 5-minute cache to avoid re-reading files on every create_client() call.
    This is important because create_client() is called for each subtask and QA iteration,
    potentially 60+ times per task.

    Args:
        rules_dir: Path to .claude/rules/
        project_dir: Root directory of the project (used as cache key)

    Returns:
        List of tuples: (rule_path, path_patterns, required_skills, rule_content)
        where required_skills is a list of dicts with 'skill', 'when', and optional 'paths' keys
    """
    # Check cache first
    cache_key = str(project_dir)
    current_time = time.time()

    if cache_key in _RULES_CACHE:
        cached_rules, cached_time = _RULES_CACHE[cache_key]
        if current_time - cached_time < _RULES_CACHE_TTL_SECONDS:
            logger.debug(f"Using cached rules for {project_dir}")
            return cached_rules

    # Cache miss or expired - read and parse all rules
    rules = []
    rules_dir_resolved = rules_dir.resolve()

    for rule_path in rules_dir.rglob("*.md"):
        # Skip symlink files to prevent traversal outside project directory
        if rule_path.is_symlink():
            logger.warning(f"Skipping symlink rule file: {rule_path}")
            continue

        # Resolve the path and verify it stays under rules_dir
        try:
            rule_path_resolved = rule_path.resolve()
            rule_path_resolved.relative_to(rules_dir_resolved)
        except (OSError, RuntimeError, ValueError) as e:
            logger.warning(
                f"Skipping rule file that failed to resolve or escaped rules dir: {rule_path} ({e})"
            )
            continue

        try:
            content = rule_path_resolved.read_text(encoding="utf-8")
            paths, skills, rule_content = _parse_rule_frontmatter(content)
            if paths and rule_content:
                rules.append((rule_path, paths, skills, rule_content))
            elif rule_content and not paths:
                logger.debug(
                    f"Skipping rule {rule_path}: no paths defined in frontmatter"
                )
        except Exception as e:
            logger.warning(f"Failed to read rule file {rule_path}: {e}")

    # Update cache
    _RULES_CACHE[cache_key] = (rules, current_time)
    logger.debug(f"Cached {len(rules)} rules for {project_dir}")

    return rules


def load_claude_rules(
    project_dir: Path,
    files_to_check: list[str] | None = None,
) -> tuple[str, list[str], list[dict]]:
    """
    Load Claude Code rules from .claude/rules/ that match the given files.

    Rules are markdown files with YAML frontmatter containing path patterns
    and optional required skills.

    Only rules whose patterns match at least one file in files_to_check are loaded.

    Args:
        project_dir: Root directory of the project
        files_to_check: List of file paths being modified/created.
                       If None, loads ALL rules (useful for planning phases).

    Returns:
        Tuple of (combined_rules_content, list_of_matched_rule_names, list_of_required_skills)
        where required_skills is a list of dicts with 'skill', 'when', and optional 'paths' keys
    """
    rules_dir = _discover_rules_directory(project_dir)
    if not rules_dir:
        return "", [], []

    all_rules = _collect_all_rules(rules_dir, project_dir)
    if not all_rules:
        return "", [], []

    matched_rules = []
    matched_names = []
    # Track skills by (name, when, paths) to preserve different configurations
    seen_skills: set[tuple[str, str, tuple[str, ...]]] = set()
    all_required_skills: list[dict] = []

    def _add_skill(skill: dict, files_for_check: list[str] | None) -> None:
        """Add skill if not already seen with same configuration."""
        skill_name = skill.get("skill", "")
        if not skill_name:
            return

        # Check skill-level path filters
        skill_paths = skill.get("paths", [])
        if skill_paths and files_for_check is not None:
            # Skill has path filters - check if any match
            skill_matches = False
            for skill_pattern in skill_paths:
                for filepath in files_for_check:
                    if _match_glob_pattern(skill_pattern, filepath):
                        skill_matches = True
                        break
                if skill_matches:
                    break
            if not skill_matches:
                return

        when = skill.get("when", DEFAULT_WHEN_VALUE)
        paths_key = tuple(sorted(skill_paths or []))
        key = (skill_name, when, paths_key)
        if key not in seen_skills:
            seen_skills.add(key)
            all_required_skills.append(skill)

    for rule_path, patterns, skills, content in all_rules:
        rel_name = str(rule_path.relative_to(rules_dir))

        # If no files specified, load all rules
        if files_to_check is None:
            matched_rules.append((rel_name, content))
            matched_names.append(rel_name)
            for skill in skills:
                _add_skill(skill, None)
            continue

        # Check if any pattern matches any file
        for pattern in patterns:
            for filepath in files_to_check:
                if _match_glob_pattern(pattern, filepath):
                    matched_rules.append((rel_name, content))
                    matched_names.append(rel_name)
                    for skill in skills:
                        _add_skill(skill, files_to_check)
                    break
            else:
                continue
            break

    if not matched_rules:
        return "", [], []

    # Combine matched rules into a single string
    combined = []
    for name, content in matched_rules:
        combined.append(f"## Rule: {name}\n\n{content}")

    return "\n\n---\n\n".join(combined), matched_names, all_required_skills


def get_files_from_implementation_plan(spec_dir: Path) -> list[str]:
    """
    Extract all files_to_modify and files_to_create from implementation_plan.json.

    Args:
        spec_dir: Directory containing the spec

    Returns:
        List of all file paths mentioned in the plan
    """
    plan_path = spec_dir / "implementation_plan.json"
    if not plan_path.exists():
        return []

    try:
        plan = json.loads(plan_path.read_text(encoding="utf-8"))
        files = set()

        # Collect from all phases and subtasks
        for phase in plan.get("phases", []):
            for subtask in phase.get("subtasks", []):
                files.update(subtask.get("files_to_modify", []))
                files.update(subtask.get("files_to_create", []))

        # Also check top-level if present
        files.update(plan.get("files_to_modify", []))
        files.update(plan.get("files_to_create", []))

        return list(files)
    except Exception as e:
        logger.debug(f"Failed to read implementation plan: {e}")
        return []
