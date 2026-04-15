"""EndNodeExecutor — collects final pipeline outputs."""
from __future__ import annotations

from typing import TYPE_CHECKING

from ..variables import VariableResolver
from .base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from ..identity import CompanyContext
    from ..state import PipelineState


class EndNodeExecutor(NodeExecutor):
    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        resolver = VariableResolver(state)
        if "outputs" in node_config:
            resolved = {k: resolver.resolve(v) for k, v in node_config["outputs"].items()}
        else:
            resolved = dict(state.agent_outputs)
        return NodeExecutionResult(output=resolved)
