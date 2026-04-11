"""Budget enforcement — per-agent and per-pipeline cost limits."""
from __future__ import annotations

from .identity import AgentIdentity
from .state import PipelineState

MODEL_COSTS: dict[str, float] = {
    "claude-opus-4-6": 0.000015,
    "claude-sonnet-4-6": 0.000003,
    "claude-haiku-4-5": 0.00000025,
    "gpt-4o": 0.000005,
    "gpt-4o-mini": 0.00000015,
}

# Fallback cost per token for unknown models
_DEFAULT_COST_PER_TOKEN = 0.000003


class BudgetExceededError(Exception):
    """Raised when an agent or pipeline would exceed its budget."""


def estimate_cost(tokens: int, model_id: str) -> float:
    """Return estimated cost in USD for the given token count and model."""
    cost_per_token = MODEL_COSTS.get(model_id, _DEFAULT_COST_PER_TOKEN)
    return tokens * cost_per_token


def check_agent_budget(
    agent: AgentIdentity,
    cost_so_far: float,
    new_cost: float,
) -> None:
    """Raise BudgetExceededError if cost_so_far + new_cost exceeds agent.budget_monthly_usd."""
    projected = cost_so_far + new_cost
    if projected > agent.budget_monthly_usd:
        raise BudgetExceededError(
            f"Agent '{agent.name}' would exceed monthly budget: "
            f"${projected:.6f} > ${agent.budget_monthly_usd:.2f}"
        )


def check_pipeline_budget(state: PipelineState, new_cost: float) -> None:
    """Raise BudgetExceededError if adding new_cost would exceed the pipeline's total cost_usd cap.

    The cap is read from state.global_variables['budget_usd'] when present.
    If no cap is set, this is a no-op.
    """
    budget_usd = state.global_variables.get("budget_usd")
    if budget_usd is None:
        return
    projected = state.cost_usd + new_cost
    if projected > float(budget_usd):
        raise BudgetExceededError(
            f"Pipeline '{state.pipeline_name}' would exceed budget: "
            f"${projected:.6f} > ${float(budget_usd):.2f}"
        )
