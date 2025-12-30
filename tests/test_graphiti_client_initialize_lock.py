import asyncio
from unittest.mock import MagicMock

import pytest

from integrations.graphiti.queries_pkg.client import GraphitiClient


class _TestClient(GraphitiClient):
    def __init__(self):
        super().__init__(config=MagicMock())
        self.unlocked_calls = 0

    async def _initialize_unlocked(self, state=None) -> bool:  # type: ignore[override]
        self.unlocked_calls += 1
        # Simulate expensive async initialization to amplify races.
        await asyncio.sleep(0.05)
        self._initialized = True
        return True


class _FailOnceClient(GraphitiClient):
    def __init__(self):
        super().__init__(config=MagicMock())
        self.unlocked_calls = 0

    async def _initialize_unlocked(self, state=None) -> bool:  # type: ignore[override]
        self.unlocked_calls += 1
        if self.unlocked_calls == 1:
            # Fail without marking initialized (should allow retry).
            return False
        self._initialized = True
        return True


@pytest.mark.asyncio
async def test_initialize_concurrent_calls_only_run_once():
    client = _TestClient()
    results = await asyncio.gather(*[client.initialize() for _ in range(25)])
    assert all(results)
    assert client.unlocked_calls == 1


@pytest.mark.asyncio
async def test_initialize_can_retry_after_failure():
    client = _FailOnceClient()

    first = await client.initialize()
    assert first is False
    assert client.is_initialized is False
    assert client.unlocked_calls == 1

    second = await client.initialize()
    assert second is True
    assert client.is_initialized is True
    assert client.unlocked_calls == 2


