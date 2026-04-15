"""Tests for IfElseNodeExecutor — covers all 12 operators, AND/OR logic, and default branch."""
from __future__ import annotations

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.if_else_node import IfElseNodeExecutor
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


def _node_ref(node_id: str, variable: str) -> dict:
    return {"node_id": node_id, "variable": variable}


def _single_group(operator: str, value, branch_id: str = "branch_a", lhs_node: str = "n1", lhs_var: str = "val") -> dict:
    return {
        "branch_id": branch_id,
        "logical": "AND",
        "conditions": [
            {"variable": _node_ref(lhs_node, lhs_var), "operator": operator, "value": value}
        ],
    }


async def _run(groups, default_branch="default") -> str:
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": None}})
    result = await executor.execute(
        {"groups": groups, "defaultBranch": default_branch},
        state,
        make_company(),
    )
    assert result.success
    return result.output["selected_branch"]


# ---------------------------------------------------------------------------
# All 12 operators
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_op_eq():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    result = await executor.execute(
        {"groups": [_single_group("eq", 5)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_ne():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    result = await executor.execute(
        {"groups": [_single_group("ne", 99)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_gt():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 10}})
    result = await executor.execute(
        {"groups": [_single_group("gt", 5)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_gte():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    result = await executor.execute(
        {"groups": [_single_group("gte", 5)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_lt():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 3}})
    result = await executor.execute(
        {"groups": [_single_group("lt", 5)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_lte():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    result = await executor.execute(
        {"groups": [_single_group("lte", 5)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_contains():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": "hello world"}})
    result = await executor.execute(
        {"groups": [_single_group("contains", "world")], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_not_contains():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": "hello world"}})
    result = await executor.execute(
        {"groups": [_single_group("not_contains", "foo")], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_starts_with():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": "hello world"}})
    result = await executor.execute(
        {"groups": [_single_group("starts_with", "hello")], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_ends_with():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": "hello world"}})
    result = await executor.execute(
        {"groups": [_single_group("ends_with", "world")], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_is_empty():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": ""}})
    result = await executor.execute(
        {"groups": [_single_group("is_empty", None)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_op_is_not_empty():
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": "something"}})
    result = await executor.execute(
        {"groups": [_single_group("is_not_empty", None)], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


# ---------------------------------------------------------------------------
# AND / OR logic
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_and_logic_all_pass():
    """AND group passes only when all conditions pass."""
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    group = {
        "branch_id": "branch_a",
        "logical": "AND",
        "conditions": [
            {"variable": _node_ref("n1", "val"), "operator": "gt", "value": 3},
            {"variable": _node_ref("n1", "val"), "operator": "lt", "value": 10},
        ],
    }
    result = await executor.execute(
        {"groups": [group], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_and_logic_partial_fail():
    """AND group fails when any condition fails → falls back to default."""
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    group = {
        "branch_id": "branch_a",
        "logical": "AND",
        "conditions": [
            {"variable": _node_ref("n1", "val"), "operator": "gt", "value": 3},
            {"variable": _node_ref("n1", "val"), "operator": "gt", "value": 100},
        ],
    }
    result = await executor.execute(
        {"groups": [group], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "default"


@pytest.mark.asyncio
async def test_or_logic_one_passes():
    """OR group passes when at least one condition passes."""
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    group = {
        "branch_id": "branch_a",
        "logical": "OR",
        "conditions": [
            {"variable": _node_ref("n1", "val"), "operator": "gt", "value": 100},  # fails
            {"variable": _node_ref("n1", "val"), "operator": "eq", "value": 5},    # passes
        ],
    }
    result = await executor.execute(
        {"groups": [group], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "branch_a"


@pytest.mark.asyncio
async def test_or_logic_all_fail():
    """OR group fails when all conditions fail → default branch."""
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 5}})
    group = {
        "branch_id": "branch_a",
        "logical": "OR",
        "conditions": [
            {"variable": _node_ref("n1", "val"), "operator": "gt", "value": 100},
            {"variable": _node_ref("n1", "val"), "operator": "eq", "value": 999},
        ],
    }
    result = await executor.execute(
        {"groups": [group], "defaultBranch": "default"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "default"


# ---------------------------------------------------------------------------
# Default branch
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_default_branch_on_no_match():
    """When no group passes, the default branch is returned."""
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 0}})
    groups = [
        {"branch_id": "branch_a", "logical": "AND", "conditions": [
            {"variable": _node_ref("n1", "val"), "operator": "gt", "value": 100}
        ]},
        {"branch_id": "branch_b", "logical": "AND", "conditions": [
            {"variable": _node_ref("n1", "val"), "operator": "eq", "value": 999}
        ]},
    ]
    result = await executor.execute(
        {"groups": groups, "defaultBranch": "fallback"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "fallback"


@pytest.mark.asyncio
async def test_snake_case_default_branch_key():
    """default_branch (snake_case) is accepted as an alias for defaultBranch."""
    executor = IfElseNodeExecutor()
    state = make_state(agent_outputs={"n1": {"val": 0}})
    result = await executor.execute(
        {"groups": [], "default_branch": "snake_fallback"},
        state, make_company(),
    )
    assert result.output["selected_branch"] == "snake_fallback"
