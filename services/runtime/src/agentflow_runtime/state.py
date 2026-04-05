"""LangGraph state definition for pipeline execution."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class PipelineState(BaseModel):
    """Mutable state that flows through the LangGraph execution graph."""

    run_id: str
    pipeline_name: str
    client_data: dict[str, Any] = Field(default_factory=dict)
    # Results keyed by agent name
    agent_outputs: dict[str, Any] = Field(default_factory=dict)
    # Set of completed agent names
    completed: list[str] = Field(default_factory=list)
    # Set of failed agent names
    failed: list[str] = Field(default_factory=list)
    # Running cost in USD
    cost_usd: float = 0.0
    # Error message if pipeline failed
    error: str | None = None
