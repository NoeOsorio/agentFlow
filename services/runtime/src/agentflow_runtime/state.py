"""LangGraph state definition for pipeline execution."""
from __future__ import annotations

from typing import Annotated, Any

from langgraph.graph.message import add_messages
from pydantic import BaseModel


class PipelineState(BaseModel):
    """Mutable state that flows through the LangGraph execution graph."""

    run_id: str
    pipeline_name: str
    client_data: dict[str, Any] = {}
    # Results keyed by agent name
    agent_outputs: dict[str, Any] = {}
    # Set of completed agent names
    completed: list[str] = []
    # Set of failed agent names
    failed: list[str] = []
    # Running cost in USD
    cost_usd: float = 0.0
    # Error message if pipeline failed
    error: str | None = None
