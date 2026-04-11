"""Tests for AgentHeartbeatMonitor and lifecycle hooks — A2-PR-3."""
from __future__ import annotations

import asyncio
import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentflow_runtime.heartbeat import AgentHeartbeatMonitor
from agentflow_runtime.identity import AgentIdentity, AgentLifecycleConfig
from agentflow_runtime.lifecycle import call_lifecycle_hook, execute_with_lifecycle


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def lifecycle_config() -> AgentLifecycleConfig:
    return AgentLifecycleConfig(
        on_start="https://hooks.example.com/start",
        on_done="https://hooks.example.com/done",
        on_fail="https://hooks.example.com/fail",
        heartbeat_interval_seconds=1,  # fast for tests
        heartbeat_timeout_seconds=10,
    )


@pytest.fixture
def agent_with_lifecycle(lifecycle_config: AgentLifecycleConfig) -> AgentIdentity:
    return AgentIdentity(
        name="alice",
        role="Engineer",
        persona="Senior Python engineer",
        model_provider="anthropic",
        model_id="claude-sonnet-4-6",
        lifecycle=lifecycle_config,
    )


# ---------------------------------------------------------------------------
# Test: AgentHeartbeatMonitor emits at least one heartbeat
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_heartbeat_monitor_emits(lifecycle_config: AgentLifecycleConfig) -> None:
    """AgentHeartbeatMonitor publishes at least 1 heartbeat during execution."""
    mock_redis = AsyncMock()
    published: list[str] = []

    async def capture_publish(channel: str, payload: str) -> None:
        published.append(payload)

    mock_redis.publish.side_effect = capture_publish

    async with AgentHeartbeatMonitor("alice", lifecycle_config, "run-123", mock_redis):
        # Wait slightly longer than one heartbeat interval
        await asyncio.sleep(lifecycle_config.heartbeat_interval_seconds * 1.5)

    assert len(published) >= 1
    data = json.loads(published[0])
    assert data["agent_name"] == "alice"
    assert data["run_id"] == "run-123"
    assert data["status"] == "busy"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_heartbeat_monitor_cancels_on_exit(lifecycle_config: AgentLifecycleConfig) -> None:
    """HeartbeatMonitor background task is cancelled when context exits."""
    mock_redis = AsyncMock()
    monitor = AgentHeartbeatMonitor("alice", lifecycle_config, "run-abc", mock_redis)

    async with monitor:
        assert monitor._task is not None
        assert not monitor._task.done()

    # Task should be cancelled / done after __aexit__
    assert monitor._task.done()


@pytest.mark.asyncio
async def test_heartbeat_redis_failure_does_not_raise(lifecycle_config: AgentLifecycleConfig) -> None:
    """A Redis publish failure is logged but does not propagate."""
    mock_redis = AsyncMock()
    mock_redis.publish.side_effect = ConnectionError("redis down")

    # Should not raise even though Redis is broken
    async with AgentHeartbeatMonitor("alice", lifecycle_config, "run-xyz", mock_redis):
        await asyncio.sleep(lifecycle_config.heartbeat_interval_seconds * 1.5)

    # No assertion needed — if it raises, the test fails


# ---------------------------------------------------------------------------
# Test: call_lifecycle_hook
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_call_lifecycle_hook_posts(monkeypatch: pytest.MonkeyPatch) -> None:
    """call_lifecycle_hook sends HTTP POST with correct payload."""
    posted: list[dict] = []

    async def mock_post(url: str, *, json: dict, **kwargs) -> MagicMock:
        posted.append({"url": url, "json": json})
        resp = MagicMock()
        resp.status_code = 200
        return resp

    mock_client = AsyncMock()
    mock_client.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client.__aexit__ = AsyncMock(return_value=False)
    mock_client.post = mock_post

    with patch("agentflow_runtime.lifecycle.httpx") as mock_httpx:
        mock_httpx.AsyncClient.return_value = mock_client
        await call_lifecycle_hook("https://hooks.example.com/test", {"agent": "alice"})

    assert len(posted) == 1
    assert posted[0]["url"] == "https://hooks.example.com/test"
    assert posted[0]["json"]["agent"] == "alice"


@pytest.mark.asyncio
async def test_call_lifecycle_hook_noop_on_none() -> None:
    """call_lifecycle_hook is a no-op when webhook_url is None."""
    # Should not raise or make any HTTP calls
    await call_lifecycle_hook(None, {"agent": "alice"})


@pytest.mark.asyncio
async def test_call_lifecycle_hook_logs_error_on_failure() -> None:
    """call_lifecycle_hook logs errors without raising."""
    with patch("agentflow_runtime.lifecycle.httpx") as mock_httpx:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post.side_effect = Exception("network error")
        mock_httpx.AsyncClient.return_value = mock_client

        # Should not raise
        await call_lifecycle_hook("https://hooks.example.com/fail", {})


# ---------------------------------------------------------------------------
# Test: execute_with_lifecycle
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_execute_with_lifecycle_calls_on_done(
    agent_with_lifecycle: AgentIdentity,
) -> None:
    """execute_with_lifecycle calls on_done hook after successful execution."""
    mock_redis = AsyncMock()
    hooks_called: list[str] = []

    async def record_hook(url: str | None, payload: dict) -> None:
        if url:
            hooks_called.append(payload.get("event", ""))

    async def _work() -> str:
        return "result"

    with patch("agentflow_runtime.lifecycle.call_lifecycle_hook", side_effect=record_hook):
        with patch("agentflow_runtime.heartbeat.AgentHeartbeatMonitor") as mock_monitor:
            # Make the monitor a no-op async context manager
            instance = AsyncMock()
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_monitor.return_value = instance

            result = await execute_with_lifecycle(
                agent_with_lifecycle, "run-1", _work(), mock_redis
            )

    assert result == "result"
    assert "start" in hooks_called
    assert "done" in hooks_called
    assert "fail" not in hooks_called


@pytest.mark.asyncio
async def test_execute_with_lifecycle_calls_on_fail(
    agent_with_lifecycle: AgentIdentity,
) -> None:
    """execute_with_lifecycle calls on_fail hook and re-raises the exception."""
    mock_redis = AsyncMock()
    hooks_called: list[str] = []

    async def record_hook(url: str | None, payload: dict) -> None:
        if url:
            hooks_called.append(payload.get("event", ""))

    async def _failing_work() -> str:
        raise ValueError("something went wrong")

    with patch("agentflow_runtime.lifecycle.call_lifecycle_hook", side_effect=record_hook):
        with patch("agentflow_runtime.heartbeat.AgentHeartbeatMonitor") as mock_monitor:
            instance = AsyncMock()
            instance.__aenter__ = AsyncMock(return_value=instance)
            instance.__aexit__ = AsyncMock(return_value=False)
            mock_monitor.return_value = instance

            with pytest.raises(ValueError, match="something went wrong"):
                await execute_with_lifecycle(
                    agent_with_lifecycle, "run-2", _failing_work(), mock_redis
                )

    assert "start" in hooks_called
    assert "fail" in hooks_called
    assert "done" not in hooks_called


@pytest.mark.asyncio
async def test_execute_with_lifecycle_noop_without_config() -> None:
    """execute_with_lifecycle skips hooks when agent has no lifecycle config."""
    agent = AgentIdentity(
        name="bare",
        role="Worker",
        persona=None,
        model_provider="anthropic",
        model_id="claude-haiku-4-5",
        lifecycle=None,  # no lifecycle
    )

    async def _work() -> int:
        return 99

    result = await execute_with_lifecycle(agent, "run-0", _work(), redis_client=None)
    assert result == 99
