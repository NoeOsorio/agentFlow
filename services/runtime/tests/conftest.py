"""Shared test fixtures for A2 runtime tests."""
from __future__ import annotations

import pytest

from agentflow_runtime.identity import AgentIdentity, AgentLifecycleConfig, CompanyContext
from agentflow_runtime.nodes.base import NodeExecutionResult, NodeExecutor
from agentflow_runtime.state import PipelineState


# ---------------------------------------------------------------------------
# Company / agent fixtures
# ---------------------------------------------------------------------------

COMPANY_DICT = {
    "apiVersion": "agentflow.ai/v1",
    "kind": "Company",
    "metadata": {"name": "test-corp", "namespace": "default"},
    "spec": {
        "agents": [
            {
                "name": "alice",
                "role": "Lead Engineer",
                "persona": "Senior Python engineer. Pragmatic.",
                "model": {"provider": "anthropic", "modelId": "claude-sonnet-4-6"},
                "budgetMonthlyUsd": 10.0,
            },
            {
                "name": "bob",
                "role": "Reviewer",
                "persona": "Careful code reviewer.",
                "model": {"provider": "anthropic", "modelId": "claude-haiku-4-5"},
                "budgetMonthlyUsd": 5.0,
            },
        ]
    },
}


@pytest.fixture
def company_context() -> CompanyContext:
    return CompanyContext.from_company_yaml(COMPANY_DICT)


# ---------------------------------------------------------------------------
# Pipeline dict factories
# ---------------------------------------------------------------------------

def make_linear_pipeline(name: str = "linear-test") -> dict:
    """start → agent(alice) → end  (3 nodes, sequential)."""
    return {
        "apiVersion": "agentflow.ai/v1",
        "kind": "Pipeline",
        "metadata": {"name": name},
        "spec": {
            "companyRef": {"name": "test-corp"},
            "nodes": [
                {"id": "start", "type": "start"},
                {"id": "agent1", "type": "agent_pod", "agentRef": {"name": "alice"}},
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"source": "start", "target": "agent1"},
                {"source": "agent1", "target": "end"},
            ],
        },
    }


def make_parallel_pipeline(name: str = "parallel-test") -> dict:
    """start → [agent(alice) || agent(bob)] → end  (fan-out / fan-in)."""
    return {
        "apiVersion": "agentflow.ai/v1",
        "kind": "Pipeline",
        "metadata": {"name": name},
        "spec": {
            "companyRef": {"name": "test-corp"},
            "nodes": [
                {"id": "start", "type": "start"},
                {"id": "agent1", "type": "agent_pod", "agentRef": {"name": "alice"}},
                {"id": "agent2", "type": "agent_pod", "agentRef": {"name": "bob"}},
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"source": "start", "target": "agent1"},
                {"source": "start", "target": "agent2"},
                {"source": "agent1", "target": "end"},
                {"source": "agent2", "target": "end"},
            ],
        },
    }


def make_if_else_pipeline(name: str = "if-else-test") -> dict:
    """
    start → check(if_else) → true_node(alice) | false_node(bob) → end.

    Condition: start.output.value == "hello"  →  true_branch
    """
    return {
        "apiVersion": "agentflow.ai/v1",
        "kind": "Pipeline",
        "metadata": {"name": name},
        "spec": {
            "companyRef": {"name": "test-corp"},
            "nodes": [
                {"id": "start", "type": "start"},
                {
                    "id": "check",
                    "type": "if_else",
                    "groups": [
                        {
                            "branch_id": "true_branch",
                            "logical": "AND",
                            "conditions": [
                                {
                                    "variable": {"node_id": "start", "variable": "value"},
                                    "operator": "eq",
                                    "value": "hello",
                                }
                            ],
                        }
                    ],
                    "defaultBranch": "false_branch",
                },
                {"id": "true_node", "type": "agent_pod", "agentRef": {"name": "alice"}},
                {"id": "false_node", "type": "agent_pod", "agentRef": {"name": "bob"}},
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"source": "start", "target": "check"},
                {"source": "check", "target": "true_node", "branch": "true_branch"},
                {"source": "check", "target": "false_node", "branch": "false_branch"},
                {"source": "true_node", "target": "end"},
                {"source": "false_node", "target": "end"},
            ],
        },
    }


# ---------------------------------------------------------------------------
# Mock executor factory
# ---------------------------------------------------------------------------

def make_mock_executor(
    output: dict | None = None,
    tokens: int = 10,
    cost: float = 0.001,
) -> NodeExecutor:
    """Return a NodeExecutor stub that always succeeds with fixed output."""

    class _MockExecutor(NodeExecutor):
        async def execute(self, node_config, state, company_context):
            return NodeExecutionResult(
                output=output if output is not None else {"result": f"ok:{node_config['id']}"},
                tokens_used=tokens,
                cost_usd=cost,
            )

    return _MockExecutor()
