"""LangGraph state definition for pipeline execution."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field

from .identity import CompanyContext


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
    # Results keyed by node_id
    agent_outputs: dict[str, Any] = Field(default_factory=dict)
    # Set of completed agent names
    completed: list[str] = Field(default_factory=list)
    # Set of failed agent names
    failed: list[str] = Field(default_factory=list)
    # Running cost in USD
    cost_usd: float = 0.0
    # Error message if pipeline failed
    error: str | None = None

    # --- A2-PR-1: Agent identity & company context ---
    company_name: str = ""
    company_context: CompanyContext | None = Field(default=None)
    current_agent_name: str | None = None
    node_executions: dict[str, NodeExecutionRecord] = Field(default_factory=dict)
    global_variables: dict[str, Any] = Field(default_factory=dict)
    current_branch: str | None = None
    iteration_index: int = 0
    iteration_results: list[Any] = Field(default_factory=list)
    streaming_channel: str | None = None

    model_config = {"arbitrary_types_allowed": True}
