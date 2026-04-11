"""Redis-backed LangGraph checkpoint saver."""
from __future__ import annotations

import logging
import pickle
import time
from typing import Any, AsyncIterator, Iterator, Optional, Sequence, Tuple

from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.base import (
    BaseCheckpointSaver,
    Checkpoint,
    CheckpointMetadata,
    CheckpointTuple,
)

logger = logging.getLogger(__name__)

_TTL_SECONDS = 48 * 3600  # 48 hours


def _serialize(obj: Any) -> bytes:
    return pickle.dumps(obj, protocol=pickle.HIGHEST_PROTOCOL)


def _deserialize(data: bytes) -> Any:
    return pickle.loads(data)  # noqa: S301


class AgentFlowCheckpointer(BaseCheckpointSaver):
    """
    LangGraph-compatible Redis checkpoint saver (replaces RedisCheckpointStore).

    Storage layout:
      - Checkpoint data : ``agentflow:checkpoint:{thread_id}:{ns}:{checkpoint_id}``  (bytes, pickle)
      - Pending writes  : ``agentflow:writes:{thread_id}:{ns}:{checkpoint_id}``       (list of bytes)
      - Ordered index   : ``agentflow:checkpoint:index:{thread_id}:{ns}``             (sorted set, score=unix ts)

    All keys expire after 48 hours.
    """

    def __init__(self, redis_url: str = "redis://localhost:6379") -> None:
        super().__init__()
        self._redis_url = redis_url
        self._sync_client: Any = None
        self._async_client: Any = None

    # ------------------------------------------------------------------
    # Client accessors
    # ------------------------------------------------------------------

    def _sync(self) -> Any:
        if self._sync_client is None:
            import redis

            self._sync_client = redis.from_url(self._redis_url, decode_responses=False)
        return self._sync_client

    async def _async(self) -> Any:
        if self._async_client is None:
            import redis.asyncio as aioredis

            self._async_client = aioredis.from_url(self._redis_url, decode_responses=False)
        return self._async_client

    # ------------------------------------------------------------------
    # Key helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _ck(thread_id: str, ns: str, checkpoint_id: str) -> str:
        return f"agentflow:checkpoint:{thread_id}:{ns}:{checkpoint_id}"

    @staticmethod
    def _idx(thread_id: str, ns: str) -> str:
        return f"agentflow:checkpoint:index:{thread_id}:{ns}"

    @staticmethod
    def _wk(thread_id: str, ns: str, checkpoint_id: str) -> str:
        return f"agentflow:writes:{thread_id}:{ns}:{checkpoint_id}"

    @staticmethod
    def _extract(config: RunnableConfig) -> tuple[str, str, str | None]:
        cfg = config.get("configurable", {})
        return (
            cfg.get("thread_id", ""),
            cfg.get("checkpoint_ns", ""),
            cfg.get("checkpoint_id"),
        )

    @staticmethod
    def _make_config(base: RunnableConfig, checkpoint_id: str) -> RunnableConfig:
        return {
            "configurable": {
                **base.get("configurable", {}),
                "checkpoint_id": checkpoint_id,
            }
        }

    # ------------------------------------------------------------------
    # Sync interface (required by BaseCheckpointSaver)
    # ------------------------------------------------------------------

    def get_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        thread_id, ns, checkpoint_id = self._extract(config)
        r = self._sync()

        if not checkpoint_id:
            items = r.zrevrange(self._idx(thread_id, ns), 0, 0)
            if not items:
                return None
            raw = items[0]
            checkpoint_id = raw.decode() if isinstance(raw, bytes) else raw

        blob = r.get(self._ck(thread_id, ns, checkpoint_id))
        if blob is None:
            return None

        data = _deserialize(blob)
        this_cfg = self._make_config(config, checkpoint_id)
        parent_id = data.get("parent_checkpoint_id")
        parent_cfg = self._make_config(config, parent_id) if parent_id else None

        writes_raw = r.lrange(self._wk(thread_id, ns, checkpoint_id), 0, -1)
        pending_writes = [_deserialize(w) for w in writes_raw]

        return CheckpointTuple(
            config=this_cfg,
            checkpoint=data["checkpoint"],
            metadata=data.get("metadata", {}),
            parent_config=parent_cfg,
            pending_writes=pending_writes,
        )

    def list(
        self,
        config: Optional[RunnableConfig],
        *,
        filter: Optional[dict] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> Iterator[CheckpointTuple]:
        if not config:
            return
        thread_id, ns, _ = self._extract(config)
        r = self._sync()
        end = (limit - 1) if limit else -1
        items = r.zrevrange(self._idx(thread_id, ns), 0, end)

        for raw_id in items:
            checkpoint_id = raw_id.decode() if isinstance(raw_id, bytes) else raw_id
            blob = r.get(self._ck(thread_id, ns, checkpoint_id))
            if blob is None:
                continue
            data = _deserialize(blob)
            this_cfg = self._make_config(config, checkpoint_id)
            parent_id = data.get("parent_checkpoint_id")
            yield CheckpointTuple(
                config=this_cfg,
                checkpoint=data["checkpoint"],
                metadata=data.get("metadata", {}),
                parent_config=self._make_config(config, parent_id) if parent_id else None,
            )

    def put(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: Any,
    ) -> RunnableConfig:
        thread_id, ns, parent_id = self._extract(config)
        checkpoint_id = checkpoint.get("id", "")

        blob = _serialize({
            "checkpoint": checkpoint,
            "metadata": metadata,
            "parent_checkpoint_id": parent_id,
        })

        r = self._sync()
        pipe = r.pipeline()
        pipe.set(self._ck(thread_id, ns, checkpoint_id), blob, ex=_TTL_SECONDS)
        pipe.zadd(self._idx(thread_id, ns), {checkpoint_id: time.time()})
        pipe.expire(self._idx(thread_id, ns), _TTL_SECONDS)
        pipe.execute()

        logger.debug("Checkpoint saved: thread=%s ns=%s id=%s", thread_id, ns, checkpoint_id)
        return self._make_config(config, checkpoint_id)

    def put_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[Tuple[str, Any]],
        task_id: str,
    ) -> None:
        if not writes:
            return
        thread_id, ns, checkpoint_id = self._extract(config)
        r = self._sync()
        key = self._wk(thread_id, ns, checkpoint_id or "")
        pipe = r.pipeline()
        for channel, value in writes:
            pipe.rpush(key, _serialize((task_id, channel, value)))
        pipe.expire(key, _TTL_SECONDS)
        pipe.execute()

    # ------------------------------------------------------------------
    # Async interface (used by graph.ainvoke / graph.astream)
    # ------------------------------------------------------------------

    async def aget_tuple(self, config: RunnableConfig) -> Optional[CheckpointTuple]:
        thread_id, ns, checkpoint_id = self._extract(config)
        r = await self._async()

        if not checkpoint_id:
            items = await r.zrevrange(self._idx(thread_id, ns), 0, 0)
            if not items:
                return None
            raw = items[0]
            checkpoint_id = raw.decode() if isinstance(raw, bytes) else raw

        blob = await r.get(self._ck(thread_id, ns, checkpoint_id))
        if blob is None:
            return None

        data = _deserialize(blob)
        this_cfg = self._make_config(config, checkpoint_id)
        parent_id = data.get("parent_checkpoint_id")
        parent_cfg = self._make_config(config, parent_id) if parent_id else None

        writes_raw = await r.lrange(self._wk(thread_id, ns, checkpoint_id), 0, -1)
        pending_writes = [_deserialize(w) for w in writes_raw]

        return CheckpointTuple(
            config=this_cfg,
            checkpoint=data["checkpoint"],
            metadata=data.get("metadata", {}),
            parent_config=parent_cfg,
            pending_writes=pending_writes,
        )

    async def aput(
        self,
        config: RunnableConfig,
        checkpoint: Checkpoint,
        metadata: CheckpointMetadata,
        new_versions: Any,
    ) -> RunnableConfig:
        thread_id, ns, parent_id = self._extract(config)
        checkpoint_id = checkpoint.get("id", "")

        blob = _serialize({
            "checkpoint": checkpoint,
            "metadata": metadata,
            "parent_checkpoint_id": parent_id,
        })

        r = await self._async()
        pipe = r.pipeline()
        pipe.set(self._ck(thread_id, ns, checkpoint_id), blob, ex=_TTL_SECONDS)
        pipe.zadd(self._idx(thread_id, ns), {checkpoint_id: time.time()})
        pipe.expire(self._idx(thread_id, ns), _TTL_SECONDS)
        await pipe.execute()

        logger.debug("Checkpoint saved (async): thread=%s ns=%s id=%s", thread_id, ns, checkpoint_id)
        return self._make_config(config, checkpoint_id)

    async def aput_writes(
        self,
        config: RunnableConfig,
        writes: Sequence[Tuple[str, Any]],
        task_id: str,
    ) -> None:
        if not writes:
            return
        thread_id, ns, checkpoint_id = self._extract(config)
        r = await self._async()
        key = self._wk(thread_id, ns, checkpoint_id or "")
        pipe = r.pipeline()
        for channel, value in writes:
            pipe.rpush(key, _serialize((task_id, channel, value)))
        pipe.expire(key, _TTL_SECONDS)
        await pipe.execute()

    async def alist(
        self,
        config: Optional[RunnableConfig],
        *,
        filter: Optional[dict] = None,
        before: Optional[RunnableConfig] = None,
        limit: Optional[int] = None,
    ) -> AsyncIterator[CheckpointTuple]:
        if not config:
            return
        thread_id, ns, _ = self._extract(config)
        r = await self._async()
        end = (limit - 1) if limit else -1
        items = await r.zrevrange(self._idx(thread_id, ns), 0, end)

        for raw_id in items:
            checkpoint_id = raw_id.decode() if isinstance(raw_id, bytes) else raw_id
            blob = await r.get(self._ck(thread_id, ns, checkpoint_id))
            if blob is None:
                continue
            data = _deserialize(blob)
            this_cfg = self._make_config(config, checkpoint_id)
            parent_id = data.get("parent_checkpoint_id")
            yield CheckpointTuple(
                config=this_cfg,
                checkpoint=data["checkpoint"],
                metadata=data.get("metadata", {}),
                parent_config=self._make_config(config, parent_id) if parent_id else None,
            )
