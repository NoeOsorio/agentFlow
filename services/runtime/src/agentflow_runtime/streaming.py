"""Streaming execution — emits StreamEvent objects during pipeline runs."""
from __future__ import annotations

import json
import logging
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Literal

from .checkpoint import AgentFlowCheckpointer
from .dag import build_graph
from .identity import CompanyContext
from .state import PipelineState

logger = logging.getLogger(__name__)

EventType = Literal[
    "node_start",
    "node_complete",
    "node_error",
    "agent_heartbeat",
    "pipeline_complete",
    "pipeline_error",
]


@dataclass
class StreamEvent:
    event: EventType
    run_id: str
    agent_name: str          # name of the agent that executed the node
    agent_role: str          # role from CompanyContext
    company_name: str        # company name (A3 uses this for WebSocket)
    data: dict
    timestamp: str           # ISO 8601


def format_sse(event: StreamEvent) -> str:
    """Serialize a StreamEvent to SSE wire format: ``data: {json}\\n\\n``."""
    return f"data: {json.dumps(asdict(event))}\n\n"


class StreamingExecutor:
    """
    Executes a pipeline and streams :class:`StreamEvent` objects via an async generator.

    Also publishes each event to Redis pub/sub ``agentflow:stream:{run_id}`` so that
    the API layer can forward events to connected SSE/WebSocket clients.

    Usage::

        executor = StreamingExecutor(redis_url="redis://localhost:6379")
        async for event in executor.stream(run_id, pipeline, company_context, trigger_data):
            print(format_sse(event))
    """

    def __init__(self, redis_url: str = "redis://localhost:6379") -> None:
        self._redis_url = redis_url

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat()

    @staticmethod
    def _agent_for_node(
        node_id: str,
        pipeline: dict,
        company_context: CompanyContext,
    ) -> tuple[str, str]:
        """Return ``(agent_name, agent_role)`` for a node, or ``("system", "")``."""
        for node in pipeline.get("spec", {}).get("nodes", []):
            if node.get("id") == node_id:
                name = node.get("agent_ref", {}).get("name", "")
                if name and name in company_context.agents:
                    identity = company_context.agents[name]
                    return identity.name, identity.role
        return "system", ""

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def stream(
        self,
        run_id: str,
        pipeline: dict,
        company_context: CompanyContext,
        trigger_data: dict,
    ) -> AsyncIterator[StreamEvent]:
        """
        Execute *pipeline* and yield :class:`StreamEvent` objects as execution progresses.

        Uses LangGraph's ``astream_events()`` (v2 events API) internally.
        Each event is also published to Redis pub/sub ``agentflow:stream:{run_id}``.

        Args:
            run_id: Unique run identifier.
            pipeline: Parsed pipeline YAML dict.
            company_context: Resolved company with all agent identities.
            trigger_data: Arbitrary input data for the run.

        Yields:
            :class:`StreamEvent` objects in emission order.
            The final event is always ``pipeline_complete`` or ``pipeline_error``.
        """
        pipeline_name = pipeline.get("metadata", {}).get("name", "unnamed")

        checkpointer = AgentFlowCheckpointer(self._redis_url)
        graph = build_graph(pipeline, company_context).compile(checkpointer=checkpointer)

        initial_state = PipelineState(
            run_id=run_id,
            pipeline_name=pipeline_name,
            company_name=company_context.name,
            company_context=company_context,
            client_data=trigger_data or {},
        )
        config = {"configurable": {"thread_id": run_id}}

        redis_client = await self._connect_redis()

        try:
            async for lg_event in graph.astream_events(
                initial_state, config=config, version="v2"
            ):
                evt = self._translate_event(lg_event, run_id, pipeline, company_context)
                if evt is None:
                    continue
                await self._publish(redis_client, run_id, evt)
                yield evt

        except Exception as exc:
            logger.error("Pipeline streaming failed for run %s: %s", run_id, exc)
            err_evt = StreamEvent(
                event="pipeline_error",
                run_id=run_id,
                agent_name="system",
                agent_role="",
                company_name=company_context.name,
                data={"error": str(exc)},
                timestamp=self._now(),
            )
            await self._publish(redis_client, run_id, err_evt)
            yield err_evt
            await self._close_redis(redis_client)
            return

        done_evt = StreamEvent(
            event="pipeline_complete",
            run_id=run_id,
            agent_name="system",
            agent_role="",
            company_name=company_context.name,
            data={"run_id": run_id},
            timestamp=self._now(),
        )
        await self._publish(redis_client, run_id, done_evt)
        yield done_evt
        await self._close_redis(redis_client)

    # ------------------------------------------------------------------
    # Private helpers
    # ------------------------------------------------------------------

    def _translate_event(
        self,
        lg_event: dict[str, Any],
        run_id: str,
        pipeline: dict,
        company_context: CompanyContext,
    ) -> StreamEvent | None:
        """Convert a LangGraph event dict to a :class:`StreamEvent`, or None to skip."""
        event_name: str = lg_event.get("event", "")
        node_name: str = lg_event.get("name", "")

        # Skip internal LangGraph housekeeping nodes
        if not node_name or node_name.startswith("__") or node_name == "LangGraph":
            return None

        agent_name, agent_role = self._agent_for_node(node_name, pipeline, company_context)

        if event_name == "on_chain_start":
            return StreamEvent(
                event="node_start",
                run_id=run_id,
                agent_name=agent_name,
                agent_role=agent_role,
                company_name=company_context.name,
                data={"node_id": node_name},
                timestamp=self._now(),
            )
        if event_name == "on_chain_end":
            return StreamEvent(
                event="node_complete",
                run_id=run_id,
                agent_name=agent_name,
                agent_role=agent_role,
                company_name=company_context.name,
                data={"node_id": node_name},
                timestamp=self._now(),
            )
        if event_name == "on_chain_error":
            error_msg = str(lg_event.get("data", {}).get("error", "unknown error"))
            return StreamEvent(
                event="node_error",
                run_id=run_id,
                agent_name=agent_name,
                agent_role=agent_role,
                company_name=company_context.name,
                data={"node_id": node_name, "error": error_msg},
                timestamp=self._now(),
            )
        return None

    async def _connect_redis(self) -> Any:
        try:
            import redis.asyncio as aioredis
            return aioredis.from_url(self._redis_url, decode_responses=True)
        except Exception as exc:
            logger.warning("Could not connect to Redis for streaming: %s", exc)
            return None

    @staticmethod
    async def _publish(redis_client: Any, run_id: str, event: StreamEvent) -> None:
        if redis_client is None:
            return
        try:
            await redis_client.publish(
                f"agentflow:stream:{run_id}",
                json.dumps(asdict(event)),
            )
        except Exception as exc:
            logger.warning("Failed to publish stream event: %s", exc)

    @staticmethod
    async def _close_redis(redis_client: Any) -> None:
        if redis_client is not None:
            try:
                await redis_client.aclose()
            except Exception:
                pass
