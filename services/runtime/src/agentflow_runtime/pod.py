"""
AgentPod — the fundamental unit of AgentFlow.

Every agent in the system implements this interface. The runtime manages
lifecycle, retries, token budgeting, and state persistence.
"""
from __future__ import annotations

import abc
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentContext:
    """Shared context injected into every agent execution."""
    run_id: str
    pipeline_name: str
    client_data: dict[str, Any] = field(default_factory=dict)
    previous_outputs: dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentResult:
    """The output of a single agent execution."""
    agent_name: str
    success: bool
    output: Any = None
    error: str | None = None
    tokens_used: int = 0
    metadata: dict[str, Any] = field(default_factory=dict)


class AgentPod(abc.ABC):
    """
    Abstract base class for all AgentFlow agents.

    Subclasses implement `run()` to define agent behavior.
    The runtime handles retries, budgeting, and checkpointing.

    Example:
        class ResearchAgent(AgentPod):
            name = "research"

            async def run(self, context: AgentContext) -> AgentResult:
                # call LLM, do research, return result
                return AgentResult(agent_name=self.name, success=True, output={"summary": "..."})
    """

    #: Must be overridden — unique identifier for this agent in the pipeline
    name: str = ""

    def __init_subclass__(cls, **kwargs: Any) -> None:
        super().__init_subclass__(**kwargs)
        if not getattr(cls, "name", ""):
            raise TypeError(f"{cls.__name__} must define a `name` class attribute")

    @abc.abstractmethod
    async def run(self, context: AgentContext) -> AgentResult:
        """Execute the agent logic and return a result."""
        ...

    async def on_start(self, context: AgentContext) -> None:
        """Called before run(). Override for setup logic."""

    async def on_done(self, result: AgentResult) -> None:
        """Called after a successful run(). Override for post-processing."""

    async def on_fail(self, error: Exception) -> None:
        """Called after a failed run(). Override for cleanup."""
