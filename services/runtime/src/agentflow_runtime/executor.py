"""PipelineExecutor — runs a compiled pipeline graph with checkpointing."""
from __future__ import annotations

import logging
import uuid
from typing import Any

from .checkpoint import AgentFlowCheckpointer
from .dag import build_graph
from .identity import CompanyContext
from .state import PipelineState

logger = logging.getLogger(__name__)


class PipelineExecutor:
    """
    Executes a pipeline DAG built from a pipeline dict + CompanyContext.

    Wires Redis checkpointing into LangGraph so runs can be resumed after failure.

    Usage::

        company_ctx = CompanyContext.from_company_yaml(company_dict)
        executor = PipelineExecutor(pipeline_dict, company_ctx, redis_url="redis://localhost:6379")
        result = await executor.run(trigger_data={"ticket": "PROJ-42"})

    To resume a crashed run::

        result = await executor.resume(run_id="<original-run-id>")
    """

    def __init__(
        self,
        pipeline: dict,
        company_context: CompanyContext,
        redis_url: str = "redis://localhost:6379",
    ) -> None:
        self.pipeline = pipeline
        self.company_context = company_context
        self.redis_url = redis_url
        checkpointer = AgentFlowCheckpointer(redis_url)
        self._graph = build_graph(pipeline, company_context).compile(
            checkpointer=checkpointer
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    async def run(
        self,
        run_id: str | None = None,
        trigger_data: dict[str, Any] | None = None,
    ) -> PipelineState:
        """
        Execute the pipeline from the beginning and return the final state.

        Args:
            run_id: Unique run identifier; auto-generated as a UUID if omitted.
            trigger_data: Arbitrary data injected as the pipeline's initial client_data.

        Returns:
            Final PipelineState after all nodes have executed (or the pipeline fails).
        """
        run_id = run_id or str(uuid.uuid4())
        pipeline_name = self.pipeline.get("metadata", {}).get("name", "unnamed")

        initial_state = PipelineState(
            run_id=run_id,
            pipeline_name=pipeline_name,
            company_name=self.company_context.name,
            company_context=self.company_context,
            client_data=trigger_data or {},
        )

        config = {"configurable": {"thread_id": run_id}}
        logger.info("Starting pipeline run %s (%s)", run_id, pipeline_name)

        final = await self._graph.ainvoke(initial_state, config=config)
        return self._build_state(final, run_id, pipeline_name)

    async def resume(self, run_id: str) -> PipelineState:
        """
        Resume a pipeline run from its last Redis checkpoint.

        Useful for crash recovery: re-invoke the graph with the same thread_id and
        LangGraph will replay from the last successfully checkpointed node.

        Args:
            run_id: The run ID used in the original :meth:`run` call.
        """
        pipeline_name = self.pipeline.get("metadata", {}).get("name", "unnamed")
        config = {"configurable": {"thread_id": run_id}}
        logger.info("Resuming pipeline run %s (%s)", run_id, pipeline_name)

        # Passing None causes LangGraph to re-invoke from the last checkpoint
        final = await self._graph.ainvoke(None, config=config)
        return self._build_state(final, run_id, pipeline_name)

    async def get_state(self, run_id: str) -> PipelineState | None:
        """
        Retrieve the current (checkpointed) state of a run without executing.

        Returns None if no checkpoint exists for the given run_id.
        """
        config = {"configurable": {"thread_id": run_id}}
        try:
            snapshot = await self._graph.aget_state(config)
        except Exception as exc:
            logger.warning("get_state failed for run %s: %s", run_id, exc)
            return None

        if snapshot is None or not snapshot.values:
            return None

        try:
            return PipelineState(**snapshot.values)
        except Exception as exc:
            logger.warning("State reconstruction failed for run %s: %s", run_id, exc)
            return None

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    @staticmethod
    def _build_state(
        final: dict[str, Any],
        run_id: str,
        pipeline_name: str,
    ) -> PipelineState:
        """Convert the graph's final dict output to a PipelineState."""
        try:
            return PipelineState(**final)
        except Exception as exc:
            logger.error("State reconstruction failed: %s", exc)
            return PipelineState(
                run_id=run_id,
                pipeline_name=pipeline_name,
                error=f"State reconstruction failed: {exc}",
            )
