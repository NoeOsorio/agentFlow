"""Tests for VariableAssignerNodeExecutor and VariableAggregatorNodeExecutor."""
from __future__ import annotations

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.variable_assigner_node import VariableAssignerNodeExecutor
from agentflow_runtime.nodes.variable_aggregator_node import VariableAggregatorNodeExecutor
from agentflow_runtime.state import PipelineState


def make_state(**kwargs) -> PipelineState:
    return PipelineState(run_id="test-run", pipeline_name="test", **kwargs)


def make_company() -> CompanyContext:
    return CompanyContext.from_company_yaml({
        "apiVersion": "agentflow.ai/v1",
        "kind": "Company",
        "metadata": {"name": "test-corp", "namespace": "default"},
        "spec": {"agents": []},
    })


# ---------------------------------------------------------------------------
# VariableAssignerNodeExecutor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_assigner_literal_values():
    """Literal (non-reference) values are returned unchanged."""
    executor = VariableAssignerNodeExecutor()
    state = make_state()
    result = await executor.execute(
        {
            "assignments": [
                {"key": "foo", "value": 42},
                {"key": "bar", "value": "hello"},
            ]
        },
        state,
        make_company(),
    )
    assert result.success
    assert result.output["assignments"] == {"foo": 42, "bar": "hello"}


@pytest.mark.asyncio
async def test_assigner_resolves_variable_references():
    """VariableReference dicts are resolved from state.agent_outputs."""
    executor = VariableAssignerNodeExecutor()
    state = make_state(agent_outputs={"node1": {"score": 99}})
    result = await executor.execute(
        {
            "assignments": [
                {
                    "key": "my_score",
                    "value": {"node_id": "node1", "variable": "score"},
                }
            ]
        },
        state,
        make_company(),
    )
    assert result.success
    assert result.output["assignments"]["my_score"] == 99


@pytest.mark.asyncio
async def test_assigner_resolves_string_refs():
    """String {{#...#}} syntax is resolved via VariableResolver."""
    executor = VariableAssignerNodeExecutor()
    state = make_state(agent_outputs={"n1": {"msg": "world"}})
    result = await executor.execute(
        {
            "assignments": [
                {"key": "greeting", "value": "{{#n1.msg#}}"},
            ]
        },
        state,
        make_company(),
    )
    assert result.success
    assert result.output["assignments"]["greeting"] == "world"


@pytest.mark.asyncio
async def test_assigner_empty_assignments():
    """No assignments → empty dict."""
    executor = VariableAssignerNodeExecutor()
    state = make_state()
    result = await executor.execute({"assignments": []}, state, make_company())
    assert result.success
    assert result.output["assignments"] == {}


# ---------------------------------------------------------------------------
# VariableAggregatorNodeExecutor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_aggregator_strategy_first():
    """'first' strategy returns the first non-None branch output."""
    executor = VariableAggregatorNodeExecutor()
    state = make_state(agent_outputs={
        "branch_a": None,
        "branch_b": {"value": "found"},
        "branch_c": {"value": "ignored"},
    })
    result = await executor.execute(
        {"branches": ["branch_a", "branch_b", "branch_c"], "strategy": "first"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["aggregated"] == {"value": "found"}


@pytest.mark.asyncio
async def test_aggregator_strategy_first_all_none():
    """'first' with all-None outputs returns None."""
    executor = VariableAggregatorNodeExecutor()
    state = make_state(agent_outputs={})
    result = await executor.execute(
        {"branches": ["x", "y"], "strategy": "first"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["aggregated"] is None


@pytest.mark.asyncio
async def test_aggregator_strategy_merge():
    """'merge' combines all dict outputs; later branches override earlier."""
    executor = VariableAggregatorNodeExecutor()
    state = make_state(agent_outputs={
        "b1": {"a": 1, "b": 10},
        "b2": {"b": 20, "c": 30},
    })
    result = await executor.execute(
        {"branches": ["b1", "b2"], "strategy": "merge"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["aggregated"] == {"a": 1, "b": 20, "c": 30}


@pytest.mark.asyncio
async def test_aggregator_strategy_list():
    """'list' returns all branch outputs in order."""
    executor = VariableAggregatorNodeExecutor()
    state = make_state(agent_outputs={
        "b1": {"x": 1},
        "b2": {"x": 2},
    })
    result = await executor.execute(
        {"branches": ["b1", "b2"], "strategy": "list"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["aggregated"] == [{"x": 1}, {"x": 2}]


@pytest.mark.asyncio
async def test_aggregator_invalid_strategy():
    """Unknown strategy returns an error result."""
    executor = VariableAggregatorNodeExecutor()
    state = make_state()
    result = await executor.execute(
        {"branches": [], "strategy": "invalid"},
        state,
        make_company(),
    )
    assert not result.success
    assert "invalid" in result.error.lower() or "strategy" in result.error.lower()
