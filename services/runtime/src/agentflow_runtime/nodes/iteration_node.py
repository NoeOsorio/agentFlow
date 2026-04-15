"""IterationNodeExecutor — iterates over a list, collecting per-item results."""
from __future__ import annotations

from typing import TYPE_CHECKING

from ..variables import VariableResolver
from .base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from ..identity import CompanyContext
    from ..state import PipelineState


class IterationLimitError(Exception):
    """Raised when iteration exceeds the 100-item guard."""


class IterationNodeExecutor(NodeExecutor):
    MAX_ITERATIONS = 100

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        resolver = VariableResolver(state)

        input_list = resolver.resolve(node_config.get("input_list", []))
        if not isinstance(input_list, list):
            return NodeExecutionResult(
                error=f"input_list must be a list, got {type(input_list).__name__}"
            )

        if len(input_list) > self.MAX_ITERATIONS:
            return NodeExecutionResult(
                error=f"Iteration limit exceeded: {len(input_list)} > {self.MAX_ITERATIONS}"
            )

        iterator_var = node_config.get("iterator_var", "item")
        results = []
        for i, item in enumerate(input_list):
            # Full sub-graph execution deferred (requires PipelineExecutor — circular dep).
            results.append({"index": i, iterator_var: item})

        return NodeExecutionResult(output={"results": results, "count": len(results)})
