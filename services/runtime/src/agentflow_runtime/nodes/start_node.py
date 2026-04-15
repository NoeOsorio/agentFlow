"""StartNodeExecutor — passthrough that copies client_data to output."""
from __future__ import annotations

from typing import TYPE_CHECKING

from .base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from ..identity import CompanyContext
    from ..state import PipelineState


class StartNodeExecutor(NodeExecutor):
    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        return NodeExecutionResult(output=dict(state.client_data))
