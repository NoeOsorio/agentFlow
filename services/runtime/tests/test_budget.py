"""Tests for budget enforcement."""
from __future__ import annotations

import pytest

from agentflow_runtime.budget import (
    BudgetExceededError,
    MODEL_COSTS,
    check_agent_budget,
    check_pipeline_budget,
    estimate_cost,
)
from agentflow_runtime.identity import AgentIdentity
from agentflow_runtime.state import PipelineState


def _agent(budget: float = 100.0, model_id: str = "claude-sonnet-4-6") -> AgentIdentity:
    return AgentIdentity(
        name="test-agent",
        role="engineer",
        persona=None,
        model_provider="anthropic",
        model_id=model_id,
        budget_monthly_usd=budget,
    )


def _state(cost_usd: float = 0.0, budget_usd: float | None = None) -> PipelineState:
    global_vars = {}
    if budget_usd is not None:
        global_vars["budget_usd"] = budget_usd
    return PipelineState(
        run_id="test-run",
        pipeline_name="test-pipeline",
        cost_usd=cost_usd,
        global_variables=global_vars,
    )


def test_estimate_cost_known_model():
    cost = estimate_cost(1000, "claude-sonnet-4-6")
    assert cost == pytest.approx(0.003)


def test_estimate_cost_claude_opus():
    cost = estimate_cost(1000, "claude-opus-4-6")
    assert cost == pytest.approx(0.015)


def test_estimate_cost_unknown_model_uses_default():
    cost = estimate_cost(1000, "unknown-model-xyz")
    assert cost > 0  # uses fallback, doesn't raise


def test_estimate_cost_gpt4o():
    cost = estimate_cost(2000, "gpt-4o")
    assert cost == pytest.approx(0.01)


def test_check_agent_budget_exceeds():
    agent = _agent(budget=100.0)
    with pytest.raises(BudgetExceededError, match="test-agent"):
        check_agent_budget(agent, cost_so_far=99.0, new_cost=2.0)


def test_check_agent_budget_passes():
    agent = _agent(budget=100.0)
    check_agent_budget(agent, cost_so_far=50.0, new_cost=10.0)  # no exception


def test_check_agent_budget_exact_limit_passes():
    agent = _agent(budget=100.0)
    check_agent_budget(agent, cost_so_far=90.0, new_cost=10.0)  # exactly at limit, no exception


def test_check_agent_budget_just_over_raises():
    agent = _agent(budget=100.0)
    with pytest.raises(BudgetExceededError):
        check_agent_budget(agent, cost_so_far=90.0, new_cost=10.001)


def test_check_pipeline_budget_no_cap_is_noop():
    state = _state(cost_usd=999.0, budget_usd=None)
    check_pipeline_budget(state, new_cost=9999.0)  # no exception


def test_check_pipeline_budget_exceeds():
    state = _state(cost_usd=8.0, budget_usd=10.0)
    with pytest.raises(BudgetExceededError, match="test-pipeline"):
        check_pipeline_budget(state, new_cost=3.0)


def test_check_pipeline_budget_passes():
    state = _state(cost_usd=5.0, budget_usd=10.0)
    check_pipeline_budget(state, new_cost=4.0)  # no exception


def test_model_costs_has_expected_keys():
    required = {"claude-opus-4-6", "claude-sonnet-4-6", "claude-haiku-4-5", "gpt-4o", "gpt-4o-mini"}
    assert required.issubset(MODEL_COSTS.keys())
