"""Redis-backed checkpoint store for pipeline state recovery."""
from __future__ import annotations

import json
from typing import Any

import redis.asyncio as aioredis


class RedisCheckpointStore:
    """
    Persists pipeline state to Redis for crash recovery.

    Keys: agentflow:checkpoint:{run_id}
    TTL: 24 hours by default
    """

    TTL_SECONDS = 86_400  # 24 hours

    def __init__(self, redis_url: str = "redis://localhost:6379/0") -> None:
        self._client = aioredis.from_url(redis_url, decode_responses=True)

    async def save(self, run_id: str, state: dict[str, Any]) -> None:
        key = f"agentflow:checkpoint:{run_id}"
        await self._client.setex(key, self.TTL_SECONDS, json.dumps(state))

    async def load(self, run_id: str) -> dict[str, Any] | None:
        key = f"agentflow:checkpoint:{run_id}"
        raw = await self._client.get(key)
        return json.loads(raw) if raw else None

    async def delete(self, run_id: str) -> None:
        key = f"agentflow:checkpoint:{run_id}"
        await self._client.delete(key)

    async def close(self) -> None:
        await self._client.aclose()
