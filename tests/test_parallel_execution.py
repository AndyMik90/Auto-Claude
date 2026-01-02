#!/usr/bin/env python3
"""
Tests for Parallel Agent Execution (Issue #487)
================================================

Tests the parallel execution functionality in agents/coder.py including:
- Parallel-safe phase detection
- Concurrent subtask execution with asyncio.gather
- Semaphore-based concurrency limiting (MAX_PARALLEL_AGENTS=5)
- Result aggregation and error handling
"""

import asyncio
import json
import pytest
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

from agents.coder import MAX_PARALLEL_AGENTS, run_parallel_subtasks
from progress import get_parallel_subtasks


class TestParallelSubtaskDetection:
    """Tests for detecting parallel-safe phases."""

    @pytest.fixture
    def temp_spec_dir(self, tmp_path):
        """Create a temporary spec directory with implementation_plan.json."""
        spec_dir = tmp_path / "spec"
        spec_dir.mkdir()
        return spec_dir

    def test_get_parallel_subtasks_returns_none_for_non_parallel_phase(
        self, temp_spec_dir
    ):
        """Non-parallel-safe phases should return None (fall back to sequential)."""
        plan_data = {
            "workflow_type": "feature",
            "phases": [
                {
                    "id": "phase-1",
                    "name": "Setup",
                    "parallel_safe": False,  # Not parallel-safe
                    "depends_on": [],
                    "subtasks": [
                        {"id": "task-1", "status": "pending", "description": "Task 1"},
                        {"id": "task-2", "status": "pending", "description": "Task 2"},
                    ],
                }
            ],
        }

        plan_file = temp_spec_dir / "implementation_plan.json"
        plan_file.write_text(json.dumps(plan_data))

        result = get_parallel_subtasks(temp_spec_dir)
        assert result is None  # Should fall back to sequential

    def test_get_parallel_subtasks_returns_none_for_single_subtask(self, temp_spec_dir):
        """Parallel-safe phase with only 1 subtask should return None."""
        plan_data = {
            "workflow_type": "feature",
            "phases": [
                {
                    "id": "phase-1",
                    "name": "Implementation",
                    "parallel_safe": True,
                    "depends_on": [],
                    "subtasks": [
                        {"id": "task-1", "status": "pending", "description": "Task 1"}
                    ],
                }
            ],
        }

        plan_file = temp_spec_dir / "implementation_plan.json"
        plan_file.write_text(json.dumps(plan_data))

        result = get_parallel_subtasks(temp_spec_dir)
        assert result is None  # Only 1 subtask, not worth parallelizing

    def test_get_parallel_subtasks_returns_subtasks_for_parallel_phase(
        self, temp_spec_dir
    ):
        """Parallel-safe phase with 2+ pending subtasks should return them."""
        plan_data = {
            "workflow_type": "feature",
            "phases": [
                {
                    "id": "phase-1",
                    "name": "Implementation",
                    "phase": 1,
                    "parallel_safe": True,
                    "depends_on": [],
                    "subtasks": [
                        {"id": "task-1", "status": "pending", "description": "Task 1"},
                        {"id": "task-2", "status": "pending", "description": "Task 2"},
                        {"id": "task-3", "status": "pending", "description": "Task 3"},
                    ],
                }
            ],
        }

        plan_file = temp_spec_dir / "implementation_plan.json"
        plan_file.write_text(json.dumps(plan_data))

        result = get_parallel_subtasks(temp_spec_dir)
        assert result is not None
        subtasks_list, phase = result
        assert len(subtasks_list) == 3
        assert phase["id"] == "phase-1"
        assert all(s["phase_id"] == "phase-1" for s in subtasks_list)

    def test_get_parallel_subtasks_respects_dependencies(self, temp_spec_dir):
        """Should only return subtasks if phase dependencies are satisfied."""
        plan_data = {
            "workflow_type": "feature",
            "phases": [
                {
                    "id": "phase-1",
                    "name": "Setup",
                    "parallel_safe": True,
                    "depends_on": [],
                    "subtasks": [
                        {
                            "id": "task-1",
                            "status": "completed",
                            "description": "Task 1",
                        }
                    ],
                },
                {
                    "id": "phase-2",
                    "name": "Implementation",
                    "parallel_safe": True,
                    "depends_on": ["phase-1"],  # Depends on phase-1
                    "subtasks": [
                        {"id": "task-2", "status": "pending", "description": "Task 2"},
                        {"id": "task-3", "status": "pending", "description": "Task 3"},
                    ],
                },
            ],
        }

        plan_file = temp_spec_dir / "implementation_plan.json"
        plan_file.write_text(json.dumps(plan_data))

        result = get_parallel_subtasks(temp_spec_dir)
        assert result is not None
        subtasks_list, phase = result
        assert phase["id"] == "phase-2"  # Should return phase-2 since phase-1 complete
        assert len(subtasks_list) == 2


class TestParallelExecution:
    """Tests for parallel execution with asyncio.gather and semaphore."""

    @pytest.fixture
    def mock_dependencies(self):
        """Mock all external dependencies for run_parallel_subtasks."""
        with patch("agents.coder.create_client"), patch(
            "agents.coder.generate_subtask_prompt"
        ), patch("agents.coder.load_subtask_context"), patch(
            "agents.coder.get_graphiti_context"
        ), patch(
            "agents.coder.run_agent_session"
        ), patch(
            "agents.coder.post_session_processing"
        ), patch(
            "agents.coder.get_latest_commit"
        ), patch(
            "agents.coder.get_commit_count"
        ), patch(
            "agents.coder.load_implementation_plan"
        ), patch(
            "agents.coder.find_phase_for_subtask"
        ), patch(
            "agents.coder.get_phase_model"
        ), patch(
            "agents.coder.get_phase_thinking_budget"
        ), patch(
            "agents.coder.print_session_header"
        ), patch(
            "agents.coder.print_status"
        ):
            yield

    @pytest.mark.asyncio
    async def test_run_parallel_subtasks_executes_concurrently(
        self, tmp_path, mock_dependencies
    ):
        """Test that subtasks are executed in parallel using asyncio.gather."""
        spec_dir = tmp_path / "spec"
        spec_dir.mkdir()
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        # Create mock subtasks
        subtasks = [
            {"id": f"task-{i}", "description": f"Task {i}", "phase_id": "phase-1"}
            for i in range(3)
        ]

        phase = {"id": "phase-1", "name": "Test Phase", "phase": 1}

        # Mock dependencies
        mock_status_manager = MagicMock()
        mock_recovery_manager = MagicMock()
        mock_recovery_manager.get_attempt_count.return_value = 0

        # Track execution times to verify parallel execution
        execution_times = []

        async def mock_session(*args, **kwargs):
            start_time = asyncio.get_event_loop().time()
            await asyncio.sleep(0.1)  # Simulate work
            execution_times.append((start_time, asyncio.get_event_loop().time()))
            return ("success", {})

        mock_subtask_counts = {"completed": 0, "in_progress": 0, "pending": 3, "failed": 0, "total": 3}
        with patch("agents.coder.run_agent_session", side_effect=mock_session), patch(
            "agents.coder.post_session_processing", return_value=True
        ), patch("agents.coder.count_subtasks_detailed", return_value=mock_subtask_counts):
            await run_parallel_subtasks(
                subtasks_list=subtasks,
                phase=phase,
                spec_dir=spec_dir,
                project_dir=project_dir,
                model="claude-sonnet-4-5-20250929",
                verbose=False,
                iteration=1,
                status_manager=mock_status_manager,
                recovery_manager=mock_recovery_manager,
                task_logger=None,
                linear_task=None,
                source_spec_dir=None,
            )

        # Verify all tasks started (roughly) at the same time (parallel execution)
        assert len(execution_times) == 3
        start_times = [t[0] for t in execution_times]
        # All tasks should start within 50ms of each other (allowing for overhead)
        time_spread = max(start_times) - min(start_times)
        assert time_spread < 0.05  # 50ms threshold

    @pytest.mark.asyncio
    async def test_semaphore_limits_concurrent_execution(
        self, tmp_path, mock_dependencies
    ):
        """Test that semaphore limits concurrent sessions to MAX_PARALLEL_AGENTS."""
        spec_dir = tmp_path / "spec"
        spec_dir.mkdir()
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        # Create MORE subtasks than MAX_PARALLEL_AGENTS
        num_subtasks = MAX_PARALLEL_AGENTS + 3
        subtasks = [
            {"id": f"task-{i}", "description": f"Task {i}", "phase_id": "phase-1"}
            for i in range(num_subtasks)
        ]

        phase = {"id": "phase-1", "name": "Test Phase", "phase": 1}

        # Track maximum concurrent executions
        current_concurrent = 0
        max_concurrent = 0
        lock = asyncio.Lock()

        async def mock_session(*args, **kwargs):
            nonlocal current_concurrent, max_concurrent
            async with lock:
                current_concurrent += 1
                if current_concurrent > max_concurrent:
                    max_concurrent = current_concurrent

            await asyncio.sleep(0.1)  # Simulate work

            async with lock:
                current_concurrent -= 1

            return ("success", {})

        mock_status_manager = MagicMock()
        mock_recovery_manager = MagicMock()
        mock_recovery_manager.get_attempt_count.return_value = 0

        mock_subtask_counts = {"completed": 0, "in_progress": 0, "pending": num_subtasks, "failed": 0, "total": num_subtasks}
        with patch("agents.coder.run_agent_session", side_effect=mock_session), patch(
            "agents.coder.post_session_processing", return_value=True
        ), patch("agents.coder.count_subtasks_detailed", return_value=mock_subtask_counts):
            await run_parallel_subtasks(
                subtasks_list=subtasks,
                phase=phase,
                spec_dir=spec_dir,
                project_dir=project_dir,
                model="claude-sonnet-4-5-20250929",
                verbose=False,
                iteration=1,
                status_manager=mock_status_manager,
                recovery_manager=mock_recovery_manager,
                task_logger=None,
                linear_task=None,
                source_spec_dir=None,
            )

        # Verify that max concurrent never exceeded MAX_PARALLEL_AGENTS
        assert max_concurrent <= MAX_PARALLEL_AGENTS
        # Verify that we actually used the semaphore (hit the limit)
        assert max_concurrent == MAX_PARALLEL_AGENTS

    @pytest.mark.asyncio
    async def test_parallel_execution_handles_failures(
        self, tmp_path, mock_dependencies
    ):
        """Test that parallel execution handles individual task failures."""
        spec_dir = tmp_path / "spec"
        spec_dir.mkdir()
        project_dir = tmp_path / "project"
        project_dir.mkdir()

        subtasks = [
            {"id": "task-1", "description": "Task 1", "phase_id": "phase-1"},
            {"id": "task-2", "description": "Task 2", "phase_id": "phase-1"},
            {"id": "task-3", "description": "Task 3", "phase_id": "phase-1"},
        ]

        phase = {"id": "phase-1", "name": "Test Phase", "phase": 1}

        # Make task-2 fail
        async def mock_post_processing(*args, **kwargs):
            subtask_id = kwargs.get("subtask_id")
            return subtask_id != "task-2"  # task-2 fails

        mock_status_manager = MagicMock()
        mock_recovery_manager = MagicMock()
        mock_recovery_manager.get_attempt_count.return_value = 0

        mock_subtask_counts = {"completed": 0, "in_progress": 0, "pending": 3, "failed": 0, "total": 3}
        with patch("agents.coder.run_agent_session", return_value=("success", {})), patch(
            "agents.coder.post_session_processing", side_effect=mock_post_processing
        ), patch("agents.coder.count_subtasks_detailed", return_value=mock_subtask_counts):
            await run_parallel_subtasks(
                subtasks_list=subtasks,
                phase=phase,
                spec_dir=spec_dir,
                project_dir=project_dir,
                model="claude-sonnet-4-5-20250929",
                verbose=False,
                iteration=1,
                status_manager=mock_status_manager,
                recovery_manager=mock_recovery_manager,
                task_logger=None,
                linear_task=None,
                source_spec_dir=None,
            )

        # Verify execution completed despite failure (no exception raised)
        # The function should handle failures gracefully
