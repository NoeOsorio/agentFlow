"""Variable assigner node — resolves and returns variable assignments."""
from __future__ import annotations

from typing import TYPE_CHECKING

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult
from agentflow_runtime.variables import VariableResolver

if TYPE_CHECKING:
    from agentflow_runtime.identity import CompanyContext
    from agentflow_runtime.state import PipelineState


class VariableAssignerNodeExecutor(NodeExecutor):
    """
    Resolves a list of {key, value} assignments and returns them in output.

    The pipeline engine is responsible for applying the resolved assignments
    to global_variables — this node only returns the resolved dict so that
    LangGraph state updates remain immutable within the node.
    """

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        assignments_cfg: list[dict] = node_config.get("assignments", [])
        resolver = VariableResolver(state)

        resolved: dict = {}
        for item in assignments_cfg:
            key = item.get("key", "")
            value = item.get("value")
            if not key:
                continue
            try:
                resolved[key] = resolver.resolve(value)
            except Exception as exc:
                return NodeExecutionResult(
                    error=f"Failed to resolve assignment '{key}': {exc}"
                )

        return NodeExecutionResult(output={"assignments": resolved})
