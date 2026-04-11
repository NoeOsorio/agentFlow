"""LangGraph state definition for pipeline execution."""
from __future__ import annotations

import operator
from dataclasses import dataclass
from datetime import datetime
from typing import Annotated, Any

from pydantic import BaseModel, Field

from .identity import CompanyContext


def _merge_dicts(left: dict, right: dict) -> dict:
    """Reducer for dict fields updated by parallel nodes."""
    return {**left, **right}


@dataclass
class NodeExecutionRecord:
    """Per-node execution metadata tracked in PipelineState."""
    node_id: str
    node_type: str
    agent_name: str | None
    status: str                          # "pending" | "running" | "completed" | "failed" | "skipped"
    started_at: datetime | None = None
    finished_at: datetime | None = None
    tokens_used: int = 0
    cost_usd: float = 0.0
    input_snapshot: dict | None = None
    output_snapshot: dict | None = None
    error: str | None = None


class PipelineState(BaseModel):
    """Mutable state that flows through the LangGraph execution graph."""

    run_id: str
    pipeline_name: str
    client_data: dict[str, Any] = Field(default_factory=dict)
    # Results keyed by node_id — Annotated reducer allows parallel node updates
    agent_outputs: Annotated[dict[str, Any], _merge_dicts] = Field(default_factory=dict)
    # Completed node IDs — operator.add appends during parallel fan-out
    completed: Annotated[list[str], operator.add] = Field(default_factory=list)
    # Failed node IDs
    failed: Annotated[list[str], operator.add] = Field(default_factory=list)
    # Running cost in USD — summed across parallel nodes
    cost_usd: Annotated[float, operator.add] = 0.0
    # Error message if pipeline failed
    error: str | None = None

    # --- A2-PR-1: Agent identity & company context ---
    company_name: str = ""
    company_context: CompanyContext | None = Field(default=None)
    current_agent_name: str | None = None
    node_executions: Annotated[dict[str, Any], _merge_dicts] = Field(default_factory=dict)
    global_variables: Annotated[dict[str, Any], _merge_dicts] = Field(default_factory=dict)
    current_branch: str | None = None
    iteration_index: int = 0
    iteration_results: Annotated[list[Any], operator.add] = Field(default_factory=list)
    streaming_channel: str | None = None

    model_config = {"arbitrary_types_allowed": True}
