#!/usr/bin/env -S uv run --script
# /// script
# dependencies = [
#   "anthropic>=0.45.2",
#   "rich>=13.7.0",
# ]
# ///

"""
Spec Query SFA - Query Auto-Claude spec files using natural language.

This single-file agent uses Claude to answer questions about spec.md files,
making it easy to extract information like acceptance criteria, constraints,
requirements, or any other details from the specification.

/// Example Usage
# Query for acceptance criteria
uv run sfa_spec_query_anthropic_v1.py \
  --spec-dir .auto-claude/specs/001-auth-feature \
  --query "What are the acceptance criteria?"

# Query for constraints
uv run sfa_spec_query_anthropic_v1.py \
  --spec-dir .auto-claude/specs/001-auth-feature \
  --query "What are the technical constraints?"

# JSON output
uv run sfa_spec_query_anthropic_v1.py \
  --spec-dir .auto-claude/specs/001-auth-feature \
  --query "List all requirements" \
  --json
///
"""

import argparse
import json
import os
import sys
from pathlib import Path
from typing import Any, Dict, Optional

from anthropic import Anthropic
from rich.console import Console
from rich.markdown import Markdown
from rich.panel import Panel
from rich.table import Table


def load_spec_files(spec_dir: Path) -> Dict[str, Any]:
    """Load spec.md, requirements.json, and context.json if available."""
    spec_data = {}

    # Load spec.md (required)
    spec_file = spec_dir / "spec.md"
    if not spec_file.exists():
        raise FileNotFoundError(f"spec.md not found in {spec_dir}")
    spec_data["spec"] = spec_file.read_text()

    # Load requirements.json (optional)
    req_file = spec_dir / "requirements.json"
    if req_file.exists():
        try:
            spec_data["requirements"] = json.loads(req_file.read_text())
        except json.JSONDecodeError:
            spec_data["requirements"] = None

    # Load context.json (optional)
    context_file = spec_dir / "context.json"
    if context_file.exists():
        try:
            spec_data["context"] = json.loads(context_file.read_text())
        except json.JSONDecodeError:
            spec_data["context"] = None

    # Load implementation_plan.json (optional)
    plan_file = spec_dir / "implementation_plan.json"
    if plan_file.exists():
        try:
            spec_data["plan"] = json.loads(plan_file.read_text())
        except json.JSONDecodeError:
            spec_data["plan"] = None

    return spec_data


def query_spec(spec_data: Dict[str, Any], query: str, api_key: str) -> str:
    """Use Claude to answer questions about the spec."""
    client = Anthropic(api_key=api_key)

    # Construct context for Claude
    context_parts = [f"# Specification\n\n{spec_data['spec']}"]

    if spec_data.get("requirements"):
        context_parts.append(
            f"\n\n# Requirements\n\n```json\n{json.dumps(spec_data['requirements'], indent=2)}\n```"
        )

    if spec_data.get("plan"):
        plan = spec_data["plan"]
        subtasks = plan.get("subtasks", [])
        context_parts.append(
            f"\n\n# Implementation Plan\n\n{len(subtasks)} subtasks defined"
        )

    context = "\n".join(context_parts)

    # Query Claude
    message = client.messages.create(
        model="claude-sonnet-4-20250514",
        max_tokens=2000,
        messages=[
            {
                "role": "user",
                "content": f"""You are analyzing an Auto-Claude feature specification. Answer the following question based on the spec content provided.

{context}

Question: {query}

Provide a clear, concise answer. If the information is not in the spec, say so.""",
            }
        ],
    )

    return message.content[0].text


def format_output(
    query: str, answer: str, spec_dir: Path, json_output: bool
) -> None:
    """Format and display the output."""
    if json_output:
        result = {"query": query, "answer": answer, "spec_dir": str(spec_dir)}
        print(json.dumps(result, indent=2))
        return

    console = Console()

    # Display spec info
    console.print(
        Panel(
            f"[cyan]Spec:[/cyan] {spec_dir.name}\n[cyan]Query:[/cyan] {query}",
            title="[bold]Spec Query",
            border_style="blue",
        )
    )

    # Display answer
    console.print("\n[bold green]Answer:[/bold green]")
    console.print(Markdown(answer))


def main():
    parser = argparse.ArgumentParser(
        description="Query Auto-Claude spec files using natural language",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Query for acceptance criteria
  %(prog)s --spec-dir .auto-claude/specs/001-auth --query "What are the acceptance criteria?"

  # Query for constraints
  %(prog)s --spec-dir .auto-claude/specs/001-auth --query "What are the constraints?"

  # JSON output
  %(prog)s --spec-dir .auto-claude/specs/001-auth --query "List requirements" --json
        """,
    )

    parser.add_argument(
        "--spec-dir",
        type=Path,
        required=True,
        help="Path to spec directory (e.g., .auto-claude/specs/001-auth)",
    )
    parser.add_argument(
        "--query",
        type=str,
        required=True,
        help='Natural language query (e.g., "What are the acceptance criteria?")',
    )
    parser.add_argument(
        "--json", action="store_true", help="Output in JSON format"
    )

    args = parser.parse_args()

    # Get API key
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        console = Console()
        console.print(
            "[red]Error:[/red] ANTHROPIC_API_KEY environment variable not set",
            style="bold",
        )
        sys.exit(1)

    # Validate spec directory
    if not args.spec_dir.exists():
        console = Console()
        console.print(
            f"[red]Error:[/red] Spec directory not found: {args.spec_dir}",
            style="bold",
        )
        sys.exit(1)

    try:
        # Load spec files
        spec_data = load_spec_files(args.spec_dir)

        # Query spec
        answer = query_spec(spec_data, args.query, api_key)

        # Display results
        format_output(args.query, answer, args.spec_dir, args.json)

    except FileNotFoundError as e:
        console = Console()
        console.print(f"[red]Error:[/red] {e}", style="bold")
        sys.exit(1)
    except Exception as e:
        console = Console()
        console.print(f"[red]Error:[/red] {e}", style="bold")
        if not args.json:
            console.print_exception()
        sys.exit(1)


if __name__ == "__main__":
    main()
