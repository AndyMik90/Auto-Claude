from __future__ import annotations

"""
Debug Commands
==============

CLI commands for BUGFINDER-X debugging agent
"""

import asyncio
import sys
from pathlib import Path

# Ensure parent directory is in path for imports (before other imports)
_PARENT_DIR = Path(__file__).parent.parent
if str(_PARENT_DIR) not in sys.path:
    sys.path.insert(0, str(_PARENT_DIR))

from core.client import create_client
from phase_config import get_phase_model
from prompts_pkg.prompts import get_bugfinder_prompt
from ui import (
    Icons,
    bold,
    box,
    error,
    highlight,
    icon,
    info,
    muted,
    success,
)

from .utils import print_banner, validate_environment


async def run_bugfinder_session(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    bug_description: str | None = None,
    verbose: bool = False,
) -> bool:
    """
    Run a BUGFINDER-X debugging session.

    Args:
        project_dir: Project root directory
        spec_dir: Spec directory path
        model: Model to use for debugging
        bug_description: Optional bug description (or reads from BUG_REPORT.md)
        verbose: Enable verbose output

    Returns:
        True if bug was successfully debugged and fixed
    """
    # Create or update BUG_REPORT.md with initial bug description
    bug_report_file = spec_dir / "BUG_REPORT.md"

    if bug_description:
        # User provided bug description via CLI
        bug_report_file.write_text(
            f"""# Bug Report

## Description

{bug_description}

## Environment

- Project: {project_dir.name}
- Spec: {spec_dir.name}

## Status

- [x] Reported
- [ ] Root cause identified
- [ ] Fixed
- [ ] Regression test added

---

*This report will be updated by BUGFINDER-X during the debugging session.*
"""
        )
    elif not bug_report_file.exists():
        # No bug description provided and no existing report - create template
        bug_report_file.write_text(
            f"""# Bug Report

## Description

*Describe the bug, expected behavior, and how to reproduce it*

## Environment

- Project: {project_dir.name}
- Spec: {spec_dir.name}

## Status

- [ ] Reported
- [ ] Root cause identified
- [ ] Fixed
- [ ] Regression test added

---

*Edit this file with your bug details, then run BUGFINDER-X again.*
"""
        )
        print(
            info(
                f"{icon(Icons.INFO)} Created {bug_report_file.relative_to(project_dir)}"
            )
        )
        print(
            "\nPlease edit this file with your bug details, then run BUGFINDER-X again."
        )
        return False

    # Load the BUGFINDER-X prompt
    prompt = get_bugfinder_prompt(spec_dir, project_dir)

    # Add bug report to prompt
    bug_report = bug_report_file.read_text()
    session_prompt = f"""{prompt}

## BUG REPORT

{bug_report}

---

**Your task:** Debug this issue following the BUGFINDER-X protocol. Start with the BUG DOSSIER section.
"""

    # Create client with bugfinder permissions
    client = await create_client(
        working_dir=project_dir,
        agent_type="bugfinder",
        model=model,
    )

    print()
    content = [
        bold(f"{icon(Icons.BUG)} BUGFINDER-X SESSION"),
        "",
        f"Spec: {highlight(spec_dir.name)}",
        f"Model: {highlight(model)}",
        "",
        muted("BUGFINDER-X will analyze the bug, identify root cause, and create a fix."),
    ]
    print(box(content, width=70, style="heavy"))
    print()

    try:
        # Run the debugging session
        await client.run(prompt=session_prompt, verbose=verbose)

        # Check if DEBUG_REPORT.md was created (indicates completion)
        debug_report = spec_dir / "DEBUG_REPORT.md"
        if debug_report.exists():
            print()
            print(
                success(
                    f"{icon(Icons.SUCCESS)} Debugging complete. Report saved to {debug_report.relative_to(project_dir)}"
                )
            )
            print()
            return True
        else:
            print()
            print(
                error(
                    f"{icon(Icons.ERROR)} Debugging session incomplete. No report generated."
                )
            )
            print()
            return False

    except KeyboardInterrupt:
        print("\n\nDebugging session interrupted.")
        print(
            f"Resume with: python auto-claude/run.py --spec {spec_dir.name} --debug"
        )
        return False
    except Exception as e:
        print()
        print(error(f"{icon(Icons.ERROR)} Debugging session failed: {e}"))
        print()
        if verbose:
            import traceback

            traceback.print_exc()
        return False


def handle_debug_command(
    project_dir: Path,
    spec_dir: Path,
    model: str,
    bug_description: str | None = None,
    verbose: bool = False,
) -> None:
    """
    Handle the --debug command (run BUGFINDER-X).

    Args:
        project_dir: Project root directory
        spec_dir: Spec directory path
        model: Model to use for debugging
        bug_description: Optional bug description
        verbose: Enable verbose output
    """
    print_banner()
    print(f"\nRunning BUGFINDER-X for: {spec_dir.name}")

    if not validate_environment(spec_dir):
        sys.exit(1)

    try:
        success = asyncio.run(
            run_bugfinder_session(
                project_dir=project_dir,
                spec_dir=spec_dir,
                model=model,
                bug_description=bug_description,
                verbose=verbose,
            )
        )
        if success:
            print("\n✅ Bug successfully debugged and fixed.")
        else:
            print("\n❌ Debugging incomplete. See reports for details.")
            sys.exit(1)
    except KeyboardInterrupt:
        print("\n\nDebugging session paused.")
        print(f"Resume with: python auto-claude/run.py --spec {spec_dir.name} --debug")
