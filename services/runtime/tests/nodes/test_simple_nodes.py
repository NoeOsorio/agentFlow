"""Tests for StartNodeExecutor, EndNodeExecutor, and IterationNodeExecutor."""
from __future__ import annotations

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.end_node import EndNodeExecutor
from agentflow_runtime.nodes.iteration_node import IterationNodeExecutor
from agentflow_runtime.nodes.start_node import StartNodeExecutor
from agentflow_runtime.state import PipelineState


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

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
# StartNodeExecutor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_start_node_copies_client_data():
    executor = StartNodeExecutor()
    state = make_state(client_data={"user": "alice", "value": 42})
    result = await executor.execute({}, state, make_company())

    assert result.error is None
    assert result.output == {"user": "alice", "value": 42}


@pytest.mark.asyncio
async def test_start_node_empty_client_data():
    executor = StartNodeExecutor()
    state = make_state()
    result = await executor.execute({}, state, make_company())

    assert result.error is None
    assert result.output == {}


# ---------------------------------------------------------------------------
# EndNodeExecutor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_end_node_with_explicit_outputs():
    executor = EndNodeExecutor()
    state = make_state(agent_outputs={"node1": {"answer": "hello"}})
    node_config = {
        "outputs": {
            "final_answer": {"node_id": "node1", "variable": "answer"},
        }
    }
    result = await executor.execute(node_config, state, make_company())

    assert result.error is None
    assert result.output == {"final_answer": "hello"}


@pytest.mark.asyncio
async def test_end_node_without_outputs_returns_all_agent_outputs():
    executor = EndNodeExecutor()
    agent_outputs = {"node1": {"x": 1}, "node2": {"y": 2}}
    state = make_state(agent_outputs=agent_outputs)
    result = await executor.execute({}, state, make_company())

    assert result.error is None
    assert result.output == agent_outputs


# ---------------------------------------------------------------------------
# IterationNodeExecutor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_iteration_node_processes_list():
    executor = IterationNodeExecutor()
    state = make_state()
    node_config = {
        "input_list": ["a", "b", "c"],
        "iterator_var": "item",
    }
    result = await executor.execute(node_config, state, make_company())

    assert result.error is None
    assert result.output["count"] == 3
    assert result.output["results"] == [
        {"index": 0, "item": "a"},
        {"index": 1, "item": "b"},
        {"index": 2, "item": "c"},
    ]


@pytest.mark.asyncio
async def test_iteration_node_exceeds_limit():
    executor = IterationNodeExecutor()
    state = make_state()
    node_config = {"input_list": list(range(101))}
    result = await executor.execute(node_config, state, make_company())

    assert result.error is not None
    assert "101" in result.error
    assert "100" in result.error


@pytest.mark.asyncio
async def test_iteration_node_non_list_input():
    executor = IterationNodeExecutor()
    state = make_state()
    node_config = {"input_list": "not-a-list"}
    result = await executor.execute(node_config, state, make_company())

    assert result.error is not None
    assert "str" in result.error
