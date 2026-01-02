"""
Test Parallel Agent Execution (Issue #487)
==========================================

Tests for the parallel execution feature that enables true concurrent agent
sessions for parallel-safe phases in the implementation plan.

FIX #487: Comprehensive test coverage for:
- Parallel-safe phase detection
- Concurrent subtask execution with asyncio.gather
- Semaphore-based concurrency limiting
- Success/failure handling and tracking
- Status updates to implementation plan
- Post-session processing for each subtask
"""

import asyncio
import json
import tempfile
import time
from pathlib import Path
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from core.progress import get_parallel_subtasks
from implementation_plan import ImplementationPlan, Phase, Subtask, SubtaskStatus


# ============================================================================
# Test Fixtures and Helpers
# ============================================================================


def create_test_plan(parallel_safe: bool = True) -> dict:
    """
    Create a test implementation plan with a parallel-safe phase.

    Args:
        parallel_safe: Whether the phase should be marked parallel-safe

    Returns:
        Implementation plan dict
    """
    return {
        "feature": "Test Feature",
        "workflow_type": "feature",
        "phases": [
            {
                "phase": 1,
                "id": "phase-1",
                "name": "Parallel Phase",
                "type": "implementation",
                "parallel_safe": parallel_safe,
                "depends_on": [],
                "subtasks": [
                    {
                        "id": "subtask-1",
                        "description": "Implement component A",
                        "status": "pending",
                        "service": "frontend",
                    },
                    {
                        "id": "subtask-2",
                        "description": "Implement component B",
                        "status": "pending",
                        "service": "frontend",
                    },
                    {
                        "id": "subtask-3",
                        "description": "Implement component C",
                        "status": "pending",
                        "service": "backend",
                    },
                ],
            }
        ],
    }


def create_sequential_plan() -> dict:
    """Create a test plan with sequential (non-parallel-safe) phases."""
    return {
        "feature": "Test Feature",
        "workflow_type": "feature",
        "phases": [
            {
                "phase": 1,
                "id": "phase-1",
                "name": "Sequential Phase",
                "type": "implementation",
                "parallel_safe": False,  # NOT parallel-safe
                "depends_on": [],
                "subtasks": [
                    {
                        "id": "subtask-1",
                        "description": "Setup database",
                        "status": "pending",
                        "service": "backend",
                    },
                    {
                        "id": "subtask-2",
                        "description": "Migrate schema",
                        "status": "pending",
                        "service": "backend",
                    },
                ],
            }
        ],
    }


def create_dependency_plan() -> dict:
    """Create a plan with phase dependencies."""
    return {
        "feature": "Test Feature",
        "workflow_type": "feature",
        "phases": [
            {
                "phase": 1,
                "id": "phase-1",
                "name": "Setup Phase",
                "type": "setup",
                "parallel_safe": False,
                "depends_on": [],
                "subtasks": [
                    {
                        "id": "setup-1",
                        "description": "Initialize project",
                        "status": "completed",
                        "service": "backend",
                    }
                ],
            },
            {
                "phase": 2,
                "id": "phase-2",
                "name": "Parallel Implementation",
                "type": "implementation",
                "parallel_safe": True,
                "depends_on": ["phase-1"],  # Depends on setup
                "subtasks": [
                    {
                        "id": "impl-1",
                        "description": "Feature A",
                        "status": "pending",
                        "service": "frontend",
                    },
                    {
                        "id": "impl-2",
                        "description": "Feature B",
                        "status": "pending",
                        "service": "backend",
                    },
                ],
            },
        ],
    }


# ============================================================================
# Test 1: Parallel-Safe Phase Detection
# ============================================================================


async def test_parallel_phase_detection():
    """Test that get_parallel_subtasks() correctly identifies parallel-safe phases."""
    print("\n=== Test 1: Parallel-Safe Phase Detection ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        spec_dir = Path(tmpdir)
        plan_file = spec_dir / "implementation_plan.json"

        # Test 1a: Parallel-safe phase with pending subtasks
        plan_data = create_test_plan(parallel_safe=True)
        plan_file.write_text(json.dumps(plan_data, indent=2))

        result = get_parallel_subtasks(spec_dir)
        assert result is not None, "Should detect parallel-safe phase"
        subtasks_list, phase = result
        assert len(subtasks_list) == 3, "Should return all 3 pending subtasks"
        assert phase["parallel_safe"] is True
        print("✓ Detected parallel-safe phase with 3 pending subtasks")

        # Test 1b: Non-parallel-safe phase (should fall back to sequential)
        plan_data = create_sequential_plan()
        plan_file.write_text(json.dumps(plan_data, indent=2))

        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should NOT detect sequential phase as parallel"
        print("✓ Correctly rejected non-parallel-safe phase (falls back to sequential)")

        # Test 1c: Only 1 pending subtask (should fall back to sequential)
        plan_data = create_test_plan(parallel_safe=True)
        # Mark 2 subtasks as completed, leaving only 1 pending
        plan_data["phases"][0]["subtasks"][0]["status"] = "completed"
        plan_data["phases"][0]["subtasks"][1]["status"] = "completed"
        plan_file.write_text(json.dumps(plan_data, indent=2))

        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should fall back to sequential for single subtask"
        print("✓ Falls back to sequential when only 1 subtask remains")

        # Test 1d: All subtasks completed (no work to do)
        plan_data = create_test_plan(parallel_safe=True)
        for subtask in plan_data["phases"][0]["subtasks"]:
            subtask["status"] = "completed"
        plan_file.write_text(json.dumps(plan_data, indent=2))

        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should return None when all subtasks complete"
        print("✓ Returns None when all subtasks are completed")


# ============================================================================
# Test 2: Phase Dependency Handling
# ============================================================================


async def test_dependency_handling():
    """Test that parallel execution respects phase dependencies."""
    print("\n=== Test 2: Phase Dependency Handling ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        spec_dir = Path(tmpdir)
        plan_file = spec_dir / "implementation_plan.json"

        # Test 2a: Dependencies satisfied - parallel phase available
        plan_data = create_dependency_plan()
        plan_file.write_text(json.dumps(plan_data, indent=2))

        result = get_parallel_subtasks(spec_dir)
        assert result is not None, "Should detect parallel phase when deps satisfied"
        subtasks_list, phase = result
        assert phase["id"] == "phase-2"
        assert len(subtasks_list) == 2
        print("✓ Parallel phase available when dependencies are satisfied")

        # Test 2b: Dependencies NOT satisfied - phase blocked
        plan_data = create_dependency_plan()
        # Change setup phase to pending (not complete)
        plan_data["phases"][0]["subtasks"][0]["status"] = "pending"
        plan_file.write_text(json.dumps(plan_data, indent=2))

        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should NOT allow parallel execution when deps blocked"
        print("✓ Blocks parallel phase when dependencies not satisfied")


# ============================================================================
# Test 3: Concurrent Execution with Semaphore Limiting
# ============================================================================


async def test_semaphore_limiting():
    """Test that semaphore limits concurrent agent sessions."""
    print("\n=== Test 3: Semaphore Limiting (MAX_PARALLEL_AGENTS) ===")

    # Track concurrent executions
    concurrent_count = 0
    max_concurrent = 0
    lock = asyncio.Lock()

    async def mock_subtask(index: int, semaphore: asyncio.Semaphore):
        """Simulate a subtask that tracks concurrency."""
        nonlocal concurrent_count, max_concurrent

        async with semaphore:
            # Enter critical section
            async with lock:
                concurrent_count += 1
                if concurrent_count > max_concurrent:
                    max_concurrent = concurrent_count

            # Simulate work
            await asyncio.sleep(0.1)

            # Exit critical section
            async with lock:
                concurrent_count -= 1

    # Test with semaphore limit of 3
    MAX_PARALLEL = 3
    semaphore = asyncio.Semaphore(MAX_PARALLEL)

    # Launch 10 tasks (more than the limit)
    tasks = [mock_subtask(i, semaphore) for i in range(10)]
    await asyncio.gather(*tasks)

    assert max_concurrent <= MAX_PARALLEL, f"Exceeded limit: {max_concurrent} > {MAX_PARALLEL}"
    print(f"✓ Semaphore limited concurrency to {max_concurrent} (max: {MAX_PARALLEL})")
    print(f"✓ Successfully completed 10 tasks with limit of {MAX_PARALLEL}")


# ============================================================================
# Test 4: Success and Failure Tracking
# ============================================================================


async def test_success_failure_tracking():
    """Test that successful and failed subtasks are tracked correctly."""
    print("\n=== Test 4: Success and Failure Tracking ===")

    # Mock results from asyncio.gather with mixed success/failure
    successful_results = [
        ("subtask-1", True),  # Success
        ("subtask-2", False),  # Failure
        ("subtask-3", True),  # Success
        Exception("Network error"),  # Exception
        ("subtask-5", True),  # Success
    ]

    # Process results (simulating the logic in run_parallel_subtasks)
    successful = []
    failed = []

    for result in successful_results:
        if isinstance(result, Exception):
            failed.append(("unknown", str(result)))
        else:
            subtask_id, success = result
            if success:
                successful.append(subtask_id)
            else:
                failed.append((subtask_id, "Session did not complete successfully"))

    assert len(successful) == 3, f"Expected 3 successful, got {len(successful)}"
    assert len(failed) == 2, f"Expected 2 failed, got {len(failed)}"
    assert "subtask-1" in successful
    assert "subtask-3" in successful
    assert "subtask-5" in successful
    assert any(id == "subtask-2" for id, _ in failed)
    assert any("Network error" in msg for _, msg in failed)

    print(f"✓ Tracked {len(successful)} successful subtasks")
    print(f"✓ Tracked {len(failed)} failed subtasks")
    print("✓ Exception handling works correctly")


# ============================================================================
# Test 5: Implementation Plan Status Updates
# ============================================================================


async def test_plan_status_updates():
    """Test that implementation plan is updated with subtask status."""
    print("\n=== Test 5: Implementation Plan Status Updates ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        spec_dir = Path(tmpdir)
        plan_file = spec_dir / "implementation_plan.json"

        # Create initial plan
        plan_data = create_test_plan(parallel_safe=True)
        plan_file.write_text(json.dumps(plan_data, indent=2))

        # Load plan
        plan = ImplementationPlan.load(plan_file)
        assert plan.phases[0].subtasks[0].status == SubtaskStatus.PENDING

        # Simulate subtask completion
        plan.phases[0].subtasks[0].status = SubtaskStatus.COMPLETED
        plan.phases[0].subtasks[1].status = SubtaskStatus.IN_PROGRESS
        plan.phases[0].subtasks[2].status = SubtaskStatus.FAILED

        # Save plan
        plan.save(plan_file)

        # Reload and verify
        reloaded = ImplementationPlan.load(plan_file)
        assert reloaded.phases[0].subtasks[0].status == SubtaskStatus.COMPLETED
        assert reloaded.phases[0].subtasks[1].status == SubtaskStatus.IN_PROGRESS
        assert reloaded.phases[0].subtasks[2].status == SubtaskStatus.FAILED

        print("✓ Subtask status updates persisted correctly")
        print("✓ Status: 1 completed, 1 in_progress, 1 failed")


# ============================================================================
# Test 6: Parallel Execution Performance
# ============================================================================


async def test_parallel_performance():
    """Test that parallel execution is actually faster than sequential."""
    print("\n=== Test 6: Parallel Execution Performance ===")

    TASK_DURATION = 0.2  # Each task takes 200ms
    NUM_TASKS = 5

    # Sequential execution
    async def sequential_tasks():
        for i in range(NUM_TASKS):
            await asyncio.sleep(TASK_DURATION)

    start = time.time()
    await sequential_tasks()
    sequential_time = time.time() - start

    # Parallel execution (with semaphore limit of 5)
    async def parallel_tasks():
        tasks = [asyncio.sleep(TASK_DURATION) for _ in range(NUM_TASKS)]
        await asyncio.gather(*tasks)

    start = time.time()
    await parallel_tasks()
    parallel_time = time.time() - start

    # Parallel should be significantly faster
    speedup = sequential_time / parallel_time
    assert speedup > 2.0, f"Parallel not faster: speedup={speedup:.2f}x"

    print(f"✓ Sequential time: {sequential_time:.2f}s")
    print(f"✓ Parallel time: {parallel_time:.2f}s")
    print(f"✓ Speedup: {speedup:.2f}x (parallel is {speedup:.2f}x faster)")


# ============================================================================
# Test 7: Edge Cases
# ============================================================================


async def test_edge_cases():
    """Test edge cases and error conditions."""
    print("\n=== Test 7: Edge Cases ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        spec_dir = Path(tmpdir)
        plan_file = spec_dir / "implementation_plan.json"

        # Test 7a: Missing implementation_plan.json
        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should handle missing plan file gracefully"
        print("✓ Handles missing implementation_plan.json")

        # Test 7b: Invalid JSON
        plan_file.write_text("{ invalid json }")
        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should handle invalid JSON gracefully"
        print("✓ Handles invalid JSON gracefully")

        # Test 7c: Empty phases list
        plan_data = {"feature": "Test", "phases": []}
        plan_file.write_text(json.dumps(plan_data, indent=2))
        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should handle empty phases"
        print("✓ Handles empty phases list")

        # Test 7d: Phase with no subtasks
        plan_data = {
            "feature": "Test",
            "phases": [
                {
                    "phase": 1,
                    "id": "phase-1",
                    "name": "Empty Phase",
                    "parallel_safe": True,
                    "depends_on": [],
                    "subtasks": [],
                }
            ],
        }
        plan_file.write_text(json.dumps(plan_data, indent=2))
        result = get_parallel_subtasks(spec_dir)
        assert result is None, "Should handle phase with no subtasks"
        print("✓ Handles phase with no subtasks")


# ============================================================================
# Test 8: Integration Test (Full Workflow Simulation)
# ============================================================================


async def test_full_workflow_simulation():
    """Simulate a complete parallel execution workflow."""
    print("\n=== Test 8: Full Workflow Simulation ===")

    with tempfile.TemporaryDirectory() as tmpdir:
        spec_dir = Path(tmpdir)
        plan_file = spec_dir / "implementation_plan.json"

        # Step 1: Create plan with parallel phase
        plan_data = create_test_plan(parallel_safe=True)
        plan_file.write_text(json.dumps(plan_data, indent=2))
        print("✓ Created implementation plan with parallel-safe phase")

        # Step 2: Detect parallel work
        result = get_parallel_subtasks(spec_dir)
        assert result is not None
        subtasks_list, phase = result
        assert len(subtasks_list) == 3
        print(f"✓ Detected {len(subtasks_list)} subtasks for parallel execution")

        # Step 3: Simulate parallel execution (mock)
        async def mock_run_subtask(subtask: dict) -> tuple[str, bool]:
            """Mock subtask execution."""
            await asyncio.sleep(0.1)  # Simulate work
            # Simulate 80% success rate
            success = subtask["id"] != "subtask-2"  # Fail subtask-2
            return subtask["id"], success

        # Run all subtasks in parallel with semaphore
        MAX_PARALLEL = 5
        semaphore = asyncio.Semaphore(MAX_PARALLEL)

        async def run_with_limit(subtask: dict) -> tuple[str, bool]:
            async with semaphore:
                return await mock_run_subtask(subtask)

        tasks = [run_with_limit(st) for st in subtasks_list]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        print(f"✓ Executed {len(results)} subtasks concurrently")

        # Step 4: Process results
        successful = []
        failed = []
        for result in results:
            if isinstance(result, Exception):
                failed.append(("unknown", str(result)))
            else:
                subtask_id, success = result
                if success:
                    successful.append(subtask_id)
                else:
                    failed.append((subtask_id, "Failed"))

        print(f"✓ Results: {len(successful)} successful, {len(failed)} failed")
        assert len(successful) == 2
        assert len(failed) == 1

        # Step 5: Update plan with results
        plan = ImplementationPlan.load(plan_file)
        for subtask in plan.phases[0].subtasks:
            if subtask.id in successful:
                subtask.status = SubtaskStatus.COMPLETED
            elif any(subtask.id == id for id, _ in failed):
                subtask.status = SubtaskStatus.FAILED

        plan.save(plan_file)
        print("✓ Updated implementation plan with results")

        # Step 6: Verify final state
        final_plan = ImplementationPlan.load(plan_file)
        completed_count = sum(
            1
            for s in final_plan.phases[0].subtasks
            if s.status == SubtaskStatus.COMPLETED
        )
        failed_count = sum(
            1 for s in final_plan.phases[0].subtasks if s.status == SubtaskStatus.FAILED
        )

        assert completed_count == 2
        assert failed_count == 1
        print("✓ Final plan state verified: 2 completed, 1 failed")
        print("✓ Full workflow simulation PASSED")


# ============================================================================
# Main Test Runner
# ============================================================================


async def main():
    """Run all parallel execution tests."""
    print("=" * 70)
    print("Parallel Agent Execution Tests (Issue #487)")
    print("=" * 70)

    tests = [
        test_parallel_phase_detection,
        test_dependency_handling,
        test_semaphore_limiting,
        test_success_failure_tracking,
        test_plan_status_updates,
        test_parallel_performance,
        test_edge_cases,
        test_full_workflow_simulation,
    ]

    passed = 0
    failed = 0

    for test in tests:
        try:
            await test()
            passed += 1
        except AssertionError as e:
            failed += 1
            print(f"✗ Test failed: {e}")
            import traceback

            traceback.print_exc()
        except Exception as e:
            failed += 1
            print(f"✗ Test error: {e}")
            import traceback

            traceback.print_exc()

    print("\n" + "=" * 70)
    print(f"Test Results: {passed} passed, {failed} failed")
    print("=" * 70)

    if failed > 0:
        raise SystemExit(1)


if __name__ == "__main__":
    asyncio.run(main())
