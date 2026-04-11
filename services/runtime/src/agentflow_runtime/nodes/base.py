"""Base NodeExecutor interface — all node implementations inherit from this."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from ..identity import CompanyContext
from ..state import PipelineState


class UnknownNodeTypeError(Exception):
    """Raised when a node type has no registered executor."""


@dataclass
class NodeExecutionResult:
    output: dict = field(default_factory=dict)
    tokens_used: int = 0
    cost_usd: float = 0.0
    error: str | None = None

    @property
    def success(self) -> bool:
        return self.error is None


class NodeExecutor(ABC):
    @abstractmethod
    async def execute(
        self,
        node_config: dict,
        state: PipelineState,
        company_context: CompanyContext,
    ) -> NodeExecutionResult: ...
