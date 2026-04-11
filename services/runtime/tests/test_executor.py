"""Tests for PipelineExecutor, DAG builder, routing, and budget enforcement — A2-PR-3."""
from __future__ import annotations

import uuid
from unittest.mock import patch

import pytest
from langgraph.checkpoint.memory import MemorySaver

from agentflow_runtime.budget import BudgetExceededError
from agentflow_runtime.dag import build_graph
from agentflow_runtime.identity import AgentIdentity, CompanyContext
from agentflow_runtime.nodes.base import NodeExecutionResult, NodeExecutor
from agentflow_runtime.state import PipelineState

from .conftest import (
    make_if_else_pipeline,
    make_linear_pipeline,
    make_mock_executor,
    make_parallel_pipeline,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _run_graph(pipeline: dict, company_context: CompanyContext, executors: dict) -> PipelineState:
    """Build, compile (with MemorySaver), and ainvoke a graph — returns final PipelineState."""
    import asyncio

    async def _run():
        memory = MemorySaver()
        with patch.dict("agentflow_runtime.nodes.NODE_EXECUTORS", executors):
            graph = build_graph(pipeline, company_context).compile(checkpointer=memory)
            run_id = str(uuid.uuid4())
            initial = PipelineState(
                run_id=run_id,
                pipeline_name=pipeline["metadata"]["name"],
                company_name=company_context.name,
                company_context=company_context,
            )
            config = {"configurable": {"thread_id": run_id}}
            final = await graph.ainvoke(initial, config=config)
            return PipelineState(**final)

    return asyncio.get_event_loop().run_until_complete(_run())


# ---------------------------------------------------------------------------
# Test: linear pipeline
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_linear_pipeline_completes(company_context: CompanyContext) -> None:
    """3-node linear pipeline completes with output recorded for agent1."""
    pipeline = make_linear_pipeline()
    mock_exec = make_mock_executor(output={"answer": "42"}, tokens=100, cost=0.0003)
    executors = {
        "start": mock_exec,
        "agent_pod": mock_exec,
        "end": mock_exec,
    }

    memory = MemorySaver()
    with patch.dict("agentflow_runtime.nodes.NODE_EXECUTORS", executors):
        graph = build_graph(pipeline, company_context).compile(checkpointer=memory)
        run_id = str(uuid.uuid4())
        initial = PipelineState(
            run_id=run_id,
            pipeline_name="linear-test",
            company_name=company_context.name,
            company_context=company_context,
        )
        config = {"configurable": {"thread_id": run_id}}
        final = await graph.ainvoke(initial, config=config)
        state = PipelineState(**final)

    assert "agent1" in state.completed
    assert state.agent_outputs["agent1"] == {"answer": "42"}
    assert state.error is None
    assert state.cost_usd > 0


# ---------------------------------------------------------------------------
# Test: parallel execution
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_parallel_execution_both_complete(company_context: CompanyContext) -> None:
    """Two AgentPod nodes with no dependency between them both complete."""
    pipeline = make_parallel_pipeline()
    mock_exec = make_mock_executor()
    executors = {
        "start": mock_exec,
        "agent_pod": mock_exec,
        "end": mock_exec,
    }

    memory = MemorySaver()
    with patch.dict("agentflow_runtime.nodes.NODE_EXECUTORS", executors):
        graph = build_graph(pipeline, company_context).compile(checkpointer=memory)
        run_id = str(uuid.uuid4())
        initial = PipelineState(
            run_id=run_id,
            pipeline_name="parallel-test",
            company_name=company_context.name,
            company_context=company_context,
        )
        config = {"configurable": {"thread_id": run_id}}
        final = await graph.ainvoke(initial, config=config)
        state = PipelineState(**final)

    # Both agent nodes must appear in outputs
    assert "agent1" in state.agent_outputs
    assert "agent2" in state.agent_outputs
    assert state.error is None


# ---------------------------------------------------------------------------
# Test: IF/ELSE routing — true branch taken
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_if_else_true_branch_taken(company_context: CompanyContext) -> None:
    """IF/ELSE routes to true_node when condition eq is met."""
    pipeline = make_if_else_pipeline()
    mock_exec = make_mock_executor()

    # Pre-seed start output so condition can reference it
    executors = {
        "start": make_mock_executor(output={"value": "hello"}),
        "agent_pod": mock_exec,
        "end": mock_exec,
    }

    memory = MemorySaver()
    with patch.dict("agentflow_runtime.nodes.NODE_EXECUTORS", executors):
        graph = build_graph(pipeline, company_context).compile(checkpointer=memory)
        run_id = str(uuid.uuid4())
        initial = PipelineState(
            run_id=run_id,
            pipeline_name="if-else-test",
            company_name=company_context.name,
            company_context=company_context,
            # Seed agent_outputs so condition can resolve start.value
            agent_outputs={"start": {"value": "hello"}},
        )
        config = {"configurable": {"thread_id": run_id}}
        final = await graph.ainvoke(initial, config=config)
        state = PipelineState(**final)

    assert "true_node" in state.completed
    assert "false_node" not in state.completed
    assert state.error is None


@pytest.mark.asyncio
async def test_if_else_false_branch_taken(company_context: CompanyContext) -> None:
    """IF/ELSE routes to false_node when condition is not met."""
    pipeline = make_if_else_pipeline()
    mock_exec = make_mock_executor()
    executors = {
        "start": make_mock_executor(output={"value": "world"}),
        "agent_pod": mock_exec,
        "end": mock_exec,
    }

    memory = MemorySaver()
    with patch.dict("agentflow_runtime.nodes.NODE_EXECUTORS", executors):
        graph = build_graph(pipeline, company_context).compile(checkpointer=memory)
        run_id = str(uuid.uuid4())
        initial = PipelineState(
            run_id=run_id,
            pipeline_name="if-else-test",
            company_name=company_context.name,
            company_context=company_context,
            agent_outputs={"start": {"value": "world"}},  # "world" != "hello"
        )
        config = {"configurable": {"thread_id": run_id}}
        final = await graph.ainvoke(initial, config=config)
        state = PipelineState(**final)

    assert "false_node" in state.completed
    assert "true_node" not in state.completed
    assert state.error is None


# ---------------------------------------------------------------------------
# Test: BudgetExceededError
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_exceeded_raises(company_context: CompanyContext) -> None:
    """BudgetExceededError is raised when agent cost exceeds monthly budget."""

    # Give alice a tiny budget ($0.001) and have the executor return a cost above it
    tiny_budget_company = CompanyContext(
        name="test-corp",
        namespace="default",
        agents={
            "alice": AgentIdentity(
                name="alice",
                role="Engineer",
                persona=None,
                model_provider="anthropic",
                model_id="claude-sonnet-4-6",
                budget_monthly_usd=0.001,
            ),
            "bob": company_context.agents["bob"],
        },
    )

    pipeline = make_linear_pipeline()
    expensive_exec = make_mock_executor(cost=0.005)  # 5x the budget
    executors = {
        "start": make_mock_executor(cost=0.0),
        "agent_pod": expensive_exec,
        "end": make_mock_executor(cost=0.0),
    }

    memory = MemorySaver()
    with patch.dict("agentflow_runtime.nodes.NODE_EXECUTORS", executors):
        graph = build_graph(pipeline, tiny_budget_company).compile(checkpointer=memory)
        run_id = str(uuid.uuid4())
        initial = PipelineState(
            run_id=run_id,
            pipeline_name="linear-test",
            company_name=tiny_budget_company.name,
            company_context=tiny_budget_company,
        )
        config = {"configurable": {"thread_id": run_id}}
        with pytest.raises(BudgetExceededError):
            await graph.ainvoke(initial, config=config)


# ---------------------------------------------------------------------------
# Test: Checkpoint save → state retrieval
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_checkpoint_saves_state(company_context: CompanyContext) -> None:
    """After a successful run, the checkpointed state can be retrieved via get_state."""
    from agentflow_runtime.executor import PipelineExecutor

    pipeline = make_linear_pipeline()
    mock_exec = make_mock_executor(output={"result": "done"})
    executors = {
        "start": mock_exec,
        "agent_pod": mock_exec,
        "end": mock_exec,
    }

    with patch.dict("agentflow_runtime.nodes.NODE_EXECUTORS", executors):
        # Use a MemorySaver-backed executor for the checkpoint test
        memory = MemorySaver()
        graph = build_graph(pipeline, company_context).compile(checkpointer=memory)
        run_id = str(uuid.uuid4())
        initial = PipelineState(
            run_id=run_id,
            pipeline_name="linear-test",
            company_name=company_context.name,
            company_context=company_context,
        )
        config = {"configurable": {"thread_id": run_id}}
        await graph.ainvoke(initial, config=config)

        # Retrieve saved state from the in-memory checkpointer
        snapshot = await graph.aget_state(config)
        assert snapshot is not None
        saved_state = PipelineState(**snapshot.values)
        assert "agent1" in saved_state.completed
