"""IF/ELSE node — evaluates condition groups and selects a branch."""
from __future__ import annotations

from typing import TYPE_CHECKING

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult
from agentflow_runtime.routing import evaluate_branch_groups

if TYPE_CHECKING:
    from agentflow_runtime.identity import CompanyContext
    from agentflow_runtime.state import PipelineState


class IfElseNodeExecutor(NodeExecutor):
    """
    Evaluates a list of condition groups and returns the winning branch ID.

    Config keys:
        groups        — list of condition group dicts (each has branch_id, logical, conditions)
        defaultBranch / default_branch — fallback branch ID if no group passes
    """

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        groups: list[dict] = node_config.get("groups", [])
        default_branch: str = (
            node_config.get("defaultBranch")
            or node_config.get("default_branch")
            or ""
        )

        winner = evaluate_branch_groups(groups, state)
        selected_branch = winner if winner is not None else default_branch

        return NodeExecutionResult(output={"selected_branch": selected_branch})
