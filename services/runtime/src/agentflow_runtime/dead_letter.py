"""Dead-letter queue for failed pipeline runs."""
from __future__ import annotations

import json
import logging
import time
from typing import Any

logger = logging.getLogger(__name__)

_DLQ_KEY = "agentflow:dead_letter"


async def mark_as_dead_letter(run_id: str, error: str, redis_client: Any) -> None:
    """
    Add a failed run to the Redis sorted set dead-letter queue.

    Key: ``agentflow:dead_letter``
    Score: Unix timestamp at time of failure (enables TTL-style pruning and ordering).

    Args:
        run_id: The pipeline run ID that failed.
        error: Human-readable error description.
        redis_client: Async Redis client.
    """
    payload = json.dumps({"run_id": run_id, "error": error})
    await redis_client.zadd(_DLQ_KEY, {payload: time.time()})
    logger.info("Run %s added to dead-letter queue: %s", run_id, error)


async def retry_dead_letter(run_id: str, redis_client: Any) -> None:
    """
    Remove a run from the dead-letter queue and re-enqueue its Celery task.

    Args:
        run_id: The run ID to retry.
        redis_client: Async Redis client.
    """
    from agentflow_runtime.tasks.pipeline_tasks import execute_pipeline

    items: list[bytes] = await redis_client.zrange(_DLQ_KEY, 0, -1)
    for raw in items:
        try:
            text = raw.decode() if isinstance(raw, bytes) else raw
            data = json.loads(text)
        except (json.JSONDecodeError, AttributeError, UnicodeDecodeError):
            continue

        if data.get("run_id") == run_id:
            await redis_client.zrem(_DLQ_KEY, raw)
            logger.info("Run %s removed from dead-letter queue, requeuing", run_id)
            # Re-dispatch — caller is responsible for supplying YAML strings if needed.
            execute_pipeline.apply_async(
                kwargs={
                    "run_id": run_id,
                    "pipeline_yaml": data.get("pipeline_yaml", ""),
                    "company_yaml": data.get("company_yaml", ""),
                    "trigger_data": data.get("trigger_data", {}),
                },
            )
            return

    logger.warning("Run %s not found in dead-letter queue", run_id)
