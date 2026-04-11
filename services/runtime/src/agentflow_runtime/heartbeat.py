"""Paperclip-style heartbeat monitoring — emits periodic signals during agent execution."""
from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .identity import AgentLifecycleConfig

logger = logging.getLogger(__name__)


class AgentHeartbeatMonitor:
    """
    Async context manager that emits heartbeats to Redis during agent execution.

    Publishes to Redis pub/sub channel ``agentflow:heartbeat:{agent_name}`` every
    ``config.heartbeat_interval_seconds`` seconds while the context is active.

    Usage::

        async with AgentHeartbeatMonitor(agent.name, agent.lifecycle, run_id, redis):
            result = await do_long_running_work()
    """

    def __init__(
        self,
        agent_name: str,
        config: "AgentLifecycleConfig",
        run_id: str,
        redis_client: Any,
    ) -> None:
        self.agent_name = agent_name
        self.config = config
        self.run_id = run_id
        self._redis = redis_client
        self._task: asyncio.Task | None = None

    async def __aenter__(self) -> "AgentHeartbeatMonitor":
        self._task = asyncio.create_task(self._emit_heartbeats())
        return self

    async def __aexit__(self, exc_type: type | None, exc_val: Any, exc_tb: Any) -> None:
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass

    async def _emit_heartbeats(self) -> None:
        """Periodically publish a heartbeat payload to Redis pub/sub."""
        while True:
            await asyncio.sleep(self.config.heartbeat_interval_seconds)
            payload = json.dumps({
                "agent_name": self.agent_name,
                "run_id": self.run_id,
                "status": "busy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
            channel = f"agentflow:heartbeat:{self.agent_name}"
            try:
                await self._redis.publish(channel, payload)
                logger.debug("Heartbeat emitted for agent %s (run %s)", self.agent_name, self.run_id)
            except Exception as exc:
                logger.warning(
                    "Failed to emit heartbeat for agent %s: %s",
                    self.agent_name,
                    exc,
                )
