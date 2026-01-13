#!/usr/bin/env python3
"""
Tests for spec pipeline AgentRunner fallback handling.
"""

from __future__ import annotations

import sys
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from spec.pipeline import agent_runner
from spec.pipeline.agent_runner import AgentRunner


class _StubBackend:
    def __init__(self, responses: list[tuple[str, str]]) -> None:
        self._responses = responses

    async def __aenter__(self) -> "_StubBackend":
        return self

    async def __aexit__(self, exc_type, exc, tb) -> None:
        return None

    async def run(self, prompt, spec_dir, verbose, phase):
        return self._responses.pop(0)


@pytest.mark.asyncio
async def test_agent_runner_retries_on_provider_budget_exhausted(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path
) -> None:
    project_dir = tmp_path / "project"
    spec_dir = project_dir / ".auto-claude" / "specs" / "001-test"
    spec_dir.mkdir(parents=True)

    responses = [
        ("provider_budget_exhausted", "budget"),
        ("continue", "ok"),
    ]

    def _factory(*args, **kwargs):
        return _StubBackend(responses)

    monkeypatch.setattr(agent_runner, "create_agent_backend", _factory)

    runner = AgentRunner(project_dir, spec_dir, None)
    success, response = await runner.run_agent("planner.md")

    assert success is True
    assert response == "ok"
    assert responses == []
