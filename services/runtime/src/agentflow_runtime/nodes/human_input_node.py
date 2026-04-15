"""HumanInputNodeExecutor — publishes prompt to Redis and waits for human response."""
from __future__ import annotations

import asyncio
import json
import logging
from typing import TYPE_CHECKING

from .base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from ..identity import CompanyContext
    from ..state import PipelineState

logger = logging.getLogger(__name__)


class HumanInputNodeExecutor(NodeExecutor):
    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        node_id = node_config.get("id", "human_input")
        prompt_text = node_config.get("prompt", "Please provide input:")
        timeout_seconds = node_config.get("timeout_seconds", 300)
        fallback = node_config.get("fallback", "skip")  # "skip" | "fail"

        redis_client = node_config.get("_redis_client")  # injected by engine

        if redis_client is None:
            if fallback == "fail":
                return NodeExecutionResult(error="Human input node: Redis not available")
            return NodeExecutionResult(output={"response": None, "skipped": True})

        publish_channel = f"agentflow:human_input:{state.run_id}:{node_id}"
        response_channel = f"agentflow:human_response:{state.run_id}:{node_id}"

        await redis_client.publish(
            publish_channel,
            json.dumps({
                "run_id": state.run_id,
                "node_id": node_id,
                "prompt": prompt_text,
            }),
        )

        pubsub = redis_client.pubsub()
        await pubsub.subscribe(response_channel)

        async def _wait_for_response() -> dict:
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"]
                    if isinstance(data, bytes):
                        data = data.decode()
                    return json.loads(data)
            return {}  # unreachable, but satisfies type checker

        try:
            response_data = await asyncio.wait_for(
                _wait_for_response(), timeout=timeout_seconds
            )
            await pubsub.unsubscribe(response_channel)
            return NodeExecutionResult(
                output={"response": response_data.get("response"), "skipped": False}
            )

        except asyncio.TimeoutError:
            await pubsub.unsubscribe(response_channel)
            if fallback == "fail":
                return NodeExecutionResult(
                    error=f"Human input timed out after {timeout_seconds}s"
                )
            return NodeExecutionResult(
                output={"response": None, "skipped": True, "timeout": True}
            )
