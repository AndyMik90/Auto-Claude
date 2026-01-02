#!/usr/bin/env python3
"""
Batch update script for issue #79 timeout protection.
Adds timeout wrappers to all remaining files that use client.query/client.receive_response.
"""

import re
from pathlib import Path

# Files to update (excluding already completed ones)
FILES_TO_UPDATE = [
    "runners/roadmap/executor.py",
    "runners/insights_runner.py",
    "runners/gitlab/services/mr_review_engine.py",
    "runners/github/testing.py",
    "runners/github/services/triage_engine.py",
    "runners/github/services/review_tools.py",
    "runners/github/services/pr_review_engine.py",
    "runners/github/services/parallel_followup_reviewer.py",
    "runners/github/services/parallel_orchestrator_reviewer.py",
    "runners/github/batch_validator.py",
    "runners/github/batch_issues.py",
    "runners/ai_analyzer/claude_client.py",
    "merge/ai_resolver/claude_client.py",
    "integrations/linear/updater.py",
    "ideation/generator.py",
    "core/workspace.py",
    "commit_message.py",
    "analysis/insight_extractor.py",
]

BACKEND_DIR = Path(__file__).parent
IMPORT_LINE = "\n# FIX #79: Timeout protection for LLM API calls\nfrom core.timeout import query_with_timeout, receive_with_timeout\n"


def add_import(content: str) -> str:
    """Add the timeout import after ClaudeSDKClient import if not present."""
    if "from core.timeout import" in content:
        return content  # Already has the import

    # Find the ClaudeSDKClient import line
    sdk_import_pattern = r"(from claude_agent_sdk import ClaudeSDKClient)"
    match = re.search(sdk_import_pattern, content)

    if match:
        # Insert after the ClaudeSDKClient import
        insert_pos = match.end()
        return content[:insert_pos] + IMPORT_LINE + content[insert_pos:]

    # Fallback: insert after all imports (before first class/function definition)
    import_end_pattern = r"\n\n(?:class |def |async def |@)"
    match = re.search(import_end_pattern, content)

    if match:
        insert_pos = match.start() + 2  # After the double newline
        return content[:insert_pos] + IMPORT_LINE + content[insert_pos:]

    # Last resort: add at the top after docstring
    docstring_end_pattern = r'"""\n\n'
    match = re.search(docstring_end_pattern, content)

    if match:
        insert_pos = match.end()
        return content[:insert_pos] + IMPORT_LINE + content[insert_pos:]

    return content  # Can't find a good place, return unchanged


def replace_query_calls(content: str) -> str:
    """Replace client.query() with query_with_timeout()."""
    # Pattern: await client.query(...)
    pattern = r"await client\.query\((.*?)\)"
    replacement = r"await query_with_timeout(client, \1)"
    return re.sub(pattern, replacement, content)


def replace_receive_calls(content: str) -> str:
    """Replace client.receive_response() with receive_with_timeout()."""
    # Pattern: async for ... in client.receive_response():
    pattern = r"async for (.*?) in client\.receive_response\(\):"
    replacement = r"async for \1 in receive_with_timeout(client):"
    return re.sub(pattern, replacement, content)


def update_file(file_path: Path) -> tuple[bool, str]:
    """Update a single file with timeout protection."""
    if not file_path.exists():
        return False, f"File not found: {file_path}"

    try:
        # Read file
        content = file_path.read_text(encoding="utf-8")
        original_content = content

        # Check if file uses client.query or client.receive_response
        if "client.query(" not in content and "client.receive_response()" not in content:
            return False, f"File does not use client.query/receive_response: {file_path}"

        # Apply transformations
        content = add_import(content)
        content = replace_query_calls(content)
        content = replace_receive_calls(content)

        # Check if any changes were made
        if content == original_content:
            return False, f"No changes needed: {file_path}"

        # Write updated content
        file_path.write_text(content, encoding="utf-8")
        return True, f"[OK] Updated: {file_path}"

    except Exception as e:
        return False, f"[ERROR] Updating {file_path}: {e}"


def main():
    """Update all files in batch."""
    print("=" * 70)
    print("FIX #79: Batch Update Script - Adding Timeout Protection")
    print("=" * 70)
    print()

    updated_count = 0
    error_count = 0

    for file_rel_path in FILES_TO_UPDATE:
        file_path = BACKEND_DIR / file_rel_path
        success, message = update_file(file_path)

        print(message)

        if success:
            updated_count += 1
        else:
            error_count += 1

    print()
    print("=" * 70)
    print(f"Summary: {updated_count} updated, {error_count} skipped/errors")
    print("=" * 70)


if __name__ == "__main__":
    main()
