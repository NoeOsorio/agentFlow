"""Variable aggregator node — collects outputs from multiple branches."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from agentflow_runtime.identity import CompanyContext
    from agentflow_runtime.state import PipelineState

_VALID_STRATEGIES = {"first", "merge", "list"}


class VariableAggregatorNodeExecutor(NodeExecutor):
    """
    Collects outputs from specified branch node IDs and aggregates them.

    Strategies:
        first  — returns the first non-None output found
        merge  — dict-merges all outputs (later branches override earlier)
        list   — returns a list of all outputs
    """

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        branches: list[str] = node_config.get("branches", [])
        strategy: str = node_config.get("strategy", "first")

        if strategy not in _VALID_STRATEGIES:
            return NodeExecutionResult(
                error=f"Unknown aggregation strategy '{strategy}'. "
                      f"Valid options: {sorted(_VALID_STRATEGIES)}"
            )

        outputs: list[Any] = [
            state.agent_outputs.get(node_id) for node_id in branches
        ]

        if strategy == "first":
            result: Any = next((o for o in outputs if o is not None), None)
        elif strategy == "merge":
            result = {}
            for o in outputs:
                if isinstance(o, dict):
                    result.update(o)
        else:  # list
            result = outputs

        return NodeExecutionResult(output={"aggregated": result})
