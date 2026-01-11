#!/usr/bin/env python3
"""
Regression tests for issue #884.

The planner may generate a non-standard implementation_plan.json schema
(`not_started`, `phase_id`, `subtask_id`, `title`, etc.) which can cause
execution to get stuck because no "pending" subtasks are detected.
"""

import json
from pathlib import Path

from core.progress import get_next_subtask
from prompt_generator import generate_planner_prompt
from spec.validate_pkg import SpecValidator, auto_fix_plan


def _write_plan(path: Path, data: dict) -> None:
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")


def test_generate_planner_prompt_loads_repo_planner_md(spec_dir: Path):
    prompt = generate_planner_prompt(spec_dir, project_dir=spec_dir.parent)
    # A unique marker that should only exist in the real prompt file
    assert "PHASE 3: CREATE implementation_plan.json" in prompt


def test_get_next_subtask_accepts_not_started_and_alias_fields(spec_dir: Path):
    plan = {
        "spec_id": "002-add-upstream-connection-test",
        "phases": [
            {
                "phase_id": "1",
                "title": "Research & Design",
                "status": "not_started",
                "subtasks": [
                    {
                        "subtask_id": "1.1",
                        "title": "Research provider-specific test endpoints",
                        "status": "not_started",
                    }
                ],
            }
        ],
    }
    _write_plan(spec_dir / "implementation_plan.json", plan)

    next_task = get_next_subtask(spec_dir)
    assert next_task is not None
    assert next_task.get("id") == "1.1"
    assert next_task.get("description") == "Research provider-specific test endpoints"
    assert next_task.get("status") == "pending"


def test_auto_fix_plan_normalizes_nonstandard_schema_and_validates(spec_dir: Path):
    plan = {
        "spec_id": "002-add-upstream-connection-test",
        "phases": [
            {
                "phase_id": "1",
                "title": "Research & Design",
                "status": "not_started",
                "subtasks": [
                    {
                        "subtask_id": "1.1",
                        "title": "Research provider-specific test endpoints",
                        "description": "Research lightweight API endpoints for each provider",
                        "status": "not_started",
                        "files_to_modify": [],
                        "notes": "",
                    }
                ],
            }
        ],
    }
    plan_path = spec_dir / "implementation_plan.json"
    _write_plan(plan_path, plan)

    fixed = auto_fix_plan(spec_dir)
    assert fixed is True

    loaded = json.loads(plan_path.read_text(encoding="utf-8"))
    assert loaded.get("feature")
    assert loaded.get("workflow_type")
    assert loaded.get("phases")
    assert loaded["phases"][0].get("name") == "Research & Design"

    subtask = loaded["phases"][0]["subtasks"][0]
    assert subtask.get("id") == "1.1"
    assert subtask.get("description")
    assert subtask.get("status") == "pending"

    result = SpecValidator(spec_dir).validate_implementation_plan()
    assert result.valid is True

