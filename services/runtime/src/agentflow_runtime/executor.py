"""PipelineExecutor — runs a compiled pipeline graph."""
from __future__ import annotations

import uuid
from typing import Any

from .dag import build_graph
from .pod import AgentPod
from .state import PipelineState


class PipelineExecutor:
    """
    Executes a pipeline by building and running its LangGraph DAG.

    Usage:
        executor = PipelineExecutor(agents=[research, copywriter], dependencies={"copywriter": ["research"]})
        result = await executor.run(run_id="...", pipeline_name="...", client_data={})
    """

    def __init__(
        self,
        agents: list[AgentPod],
        dependencies: dict[str, list[str]] | None = None,
    ) -> None:
        self.agents = agents
        self.dependencies = dependencies or {}
        self._graph = build_graph(agents, self.dependencies).compile()

    async def run(
        self,
        run_id: str | None = None,
        pipeline_name: str = "unnamed",
        client_data: dict[str, Any] | None = None,
    ) -> PipelineState:
        """Execute the pipeline and return the final state."""
        initial_state = PipelineState(
            run_id=run_id or str(uuid.uuid4()),
            pipeline_name=pipeline_name,
            client_data=client_data or {},
        )
        final_state = await self._graph.ainvoke(initial_state)
        return PipelineState(**final_state)
