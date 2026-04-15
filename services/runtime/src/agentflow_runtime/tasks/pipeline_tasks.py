"""Celery tasks for async pipeline execution dispatch."""
from __future__ import annotations

import asyncio
import logging

import yaml
from celery import Celery

from agentflow_runtime.executor import PipelineExecutor
from agentflow_runtime.identity import CompanyContext

logger = logging.getLogger(__name__)

celery_app = Celery(
    "agentflow_runtime",
    broker="redis://localhost:6379/0",
    backend="redis://localhost:6379/0",
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
)


@celery_app.task(bind=True, max_retries=3)
def execute_pipeline(
    self,
    run_id: str,
    pipeline_yaml: str,
    company_yaml: str,
    trigger_data: dict,
) -> dict:
    """
    Execute a pipeline asynchronously.

    1. Parse both YAMLs
    2. Build CompanyContext.from_company_yaml(company_dict)
    3. Call PipelineExecutor.run(run_id, trigger_data)
    4. Retry with countdown=2**retry_count on failure

    Args:
        run_id: Unique run identifier.
        pipeline_yaml: Raw YAML string for the Pipeline resource.
        company_yaml: Raw YAML string for the Company resource.
        trigger_data: Arbitrary input data injected as client_data.

    Returns:
        Dict with run summary fields: run_id, pipeline_name, completed, failed, cost_usd, error.
    """
    pipeline_dict = yaml.safe_load(pipeline_yaml)
    company_dict = yaml.safe_load(company_yaml)
    company_context = CompanyContext.from_company_yaml(company_dict)

    executor = PipelineExecutor(pipeline_dict, company_context)

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            result = loop.run_until_complete(
                executor.run(run_id=run_id, trigger_data=trigger_data)
            )
        finally:
            loop.close()
    except Exception as exc:
        logger.error("Pipeline execution failed (run %s): %s", run_id, exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)

    return {
        "run_id": result.run_id,
        "pipeline_name": result.pipeline_name,
        "completed": result.completed,
        "failed": result.failed,
        "cost_usd": result.cost_usd,
        "error": result.error,
    }


@celery_app.task(bind=True, max_retries=3)
def execute_pipeline_streaming(
    self,
    run_id: str,
    pipeline_yaml: str,
    company_yaml: str,
    trigger_data: dict,
) -> None:
    """
    Execute a pipeline in streaming mode, publishing StreamEvents to Redis pub/sub.

    Same as :func:`execute_pipeline` but uses :class:`StreamingExecutor` so each
    node's start/complete/error events are published to ``agentflow:stream:{run_id}``.
    """
    from agentflow_runtime.streaming import StreamingExecutor

    pipeline_dict = yaml.safe_load(pipeline_yaml)
    company_dict = yaml.safe_load(company_yaml)
    company_context = CompanyContext.from_company_yaml(company_dict)

    executor = StreamingExecutor()

    try:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            async def _consume() -> None:
                async for _ in executor.stream(
                    run_id, pipeline_dict, company_context, trigger_data
                ):
                    pass

            loop.run_until_complete(_consume())
        finally:
            loop.close()
    except Exception as exc:
        logger.error("Streaming pipeline failed (run %s): %s", run_id, exc)
        raise self.retry(exc=exc, countdown=2 ** self.request.retries)
