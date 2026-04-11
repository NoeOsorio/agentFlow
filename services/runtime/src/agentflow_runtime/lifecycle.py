"""Lifecycle hooks — on_start, on_done, on_fail webhook calls + heartbeat integration."""
from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any, Awaitable

import httpx  # imported at module level so tests can patch agentflow_runtime.lifecycle.httpx

if TYPE_CHECKING:
    from .identity import AgentIdentity

logger = logging.getLogger(__name__)


async def call_lifecycle_hook(webhook_url: str | None, payload: dict) -> None:
    """
    Fire-and-forget HTTP POST to a lifecycle webhook URL.

    - Timeout: 5 seconds
    - Logs errors but does NOT raise on failure
    - No-ops if webhook_url is None or empty
    """
    if not webhook_url:
        return
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(webhook_url, json=payload)
            logger.debug(
                "Lifecycle hook %s → HTTP %s", webhook_url, response.status_code
            )
    except Exception as exc:
        logger.warning("Lifecycle hook failed (%s): %s", webhook_url, exc)


async def execute_with_lifecycle(
    agent: "AgentIdentity",
    run_id: str,
    coro: Awaitable[Any],
    redis_client: Any,
) -> Any:
    """
    Wrap a coroutine with on_start / on_done / on_fail lifecycle hooks and heartbeat monitoring.

    If the agent has no lifecycle config, the coroutine is executed directly with no wrapping.

    Args:
        agent: Agent whose lifecycle config drives hooks and heartbeat.
        run_id: Current pipeline run ID (included in all hook payloads).
        coro: The awaitable to execute (e.g. the node executor coroutine).
        redis_client: Async Redis client used by AgentHeartbeatMonitor.

    Returns:
        The return value of ``coro``.

    Raises:
        Any exception raised by ``coro`` (after calling on_fail hook).
    """
    lifecycle = agent.lifecycle
    if lifecycle is None:
        return await coro

    from .heartbeat import AgentHeartbeatMonitor

    await call_lifecycle_hook(
        lifecycle.on_start,
        {"agent": agent.name, "run_id": run_id, "event": "start"},
    )
    try:
        async with AgentHeartbeatMonitor(agent.name, lifecycle, run_id, redis_client):
            result = await coro
        await call_lifecycle_hook(
            lifecycle.on_done,
            {"agent": agent.name, "run_id": run_id, "event": "done", "result": str(result)},
        )
        return result
    except Exception as exc:
        await call_lifecycle_hook(
            lifecycle.on_fail,
            {"agent": agent.name, "run_id": run_id, "event": "fail", "error": str(exc)},
        )
        raise
