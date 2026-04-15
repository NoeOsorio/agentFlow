"""Tests for AgentPodNodeExecutor."""
from __future__ import annotations

import sys
import types
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.agent_pod_node import AgentPodNodeExecutor
from agentflow_runtime.nodes.base import NodeExecutionResult
from agentflow_runtime.state import PipelineState

# ---------------------------------------------------------------------------
# Helpers
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
                "model": {"provider": "openai", "id": "gpt-4o"},
                "budgetMonthlyUsd": 0.0,  # zero budget to test budget enforcement
            },
        ]
    },
}


@pytest.fixture
def company_context() -> CompanyContext:
    return CompanyContext.from_company_yaml(COMPANY_DICT)


def make_state(**kwargs) -> PipelineState:
    return PipelineState(run_id="test-run", pipeline_name="test", **kwargs)


def _make_mock_response(content: str = "Hello!", total_tokens: int = 42) -> MagicMock:
    """Build a mock LangChain AIMessage-like response."""
    usage = MagicMock()
    usage.total_tokens = total_tokens
    resp = MagicMock()
    resp.content = content
    resp.usage_metadata = usage
    return resp


# ---------------------------------------------------------------------------
# Shared patch target
# ---------------------------------------------------------------------------

_PATCH_ANTHROPIC = "agentflow_runtime.nodes.agent_pod_node._build_llm_client"


# ---------------------------------------------------------------------------
# Test 1: agent resolved, system prompt contains role + persona
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_system_prompt_contains_role_and_persona(company_context):
    """System prompt must embed the agent role and persona."""
    executor = AgentPodNodeExecutor()
    node_config = {
        "id": "n1",
        "type": "agent_pod",
        "agentRef": {"name": "alice"},
        "instruction": "Write a hello world script.",
    }
    state = make_state()

    mock_response = _make_mock_response("print('hello')", 50)
    mock_client = MagicMock()
    mock_client.ainvoke = AsyncMock(return_value=mock_response)

    captured_messages: list = []

    async def fake_invoke(messages):
        captured_messages.extend(messages)
        return mock_response

    mock_client.ainvoke = AsyncMock(side_effect=fake_invoke)

    with patch(_PATCH_ANTHROPIC, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    assert result.output["agent_name"] == "alice"
    assert result.output["agent_role"] == "Lead Engineer"

    system_msg = captured_messages[0]
    assert "Lead Engineer" in system_msg.content
    assert "test-corp" in system_msg.content
    assert "Senior Python engineer" in system_msg.content


# ---------------------------------------------------------------------------
# Test 2: AgentNotFoundError returns error result (no crash)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_not_found_returns_error_result(company_context):
    """Missing agent → NodeExecutionResult with error, no exception raised."""
    executor = AgentPodNodeExecutor()
    node_config = {
        "id": "n1",
        "type": "agent_pod",
        "agentRef": {"name": "unknown-agent"},
        "instruction": "Do something.",
    }
    state = make_state()

    result = await executor.execute(node_config, state, company_context)

    assert not result.success
    assert "unknown-agent" in result.error


# ---------------------------------------------------------------------------
# Test 3: Budget enforcement — zero-budget agent returns error
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_budget_exceeded_returns_error(company_context):
    """Agent with 0 budget should return BudgetExceededError result."""
    executor = AgentPodNodeExecutor()
    node_config = {
        "id": "n2",
        "type": "agent_pod",
        "agentRef": {"name": "bob"},
        "instruction": "Review this code.",
    }
    # bob has budgetMonthlyUsd=0.0, so any non-zero cost will exceed budget
    state = make_state()

    mock_response = _make_mock_response("LGTM", total_tokens=100)
    mock_client = MagicMock()
    mock_client.ainvoke = AsyncMock(return_value=mock_response)

    with patch(_PATCH_ANTHROPIC, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert not result.success
    assert "budget" in result.error.lower()


# ---------------------------------------------------------------------------
# Test 4: Agent's model config is used (provider + model_id passed to builder)
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_model_config_used(company_context):
    """_build_llm_client is called with the agent's provider and model_id."""
    executor = AgentPodNodeExecutor()
    node_config = {
        "id": "n1",
        "type": "agent_pod",
        "agentRef": {"name": "alice"},
        "instruction": "Hello.",
    }
    state = make_state()

    mock_response = _make_mock_response("Hi!", 10)
    mock_client = MagicMock()
    mock_client.ainvoke = AsyncMock(return_value=mock_response)

    with patch(_PATCH_ANTHROPIC, return_value=mock_client) as mock_builder:
        result = await executor.execute(node_config, state, company_context)

    mock_builder.assert_called_once()
    call_kwargs = mock_builder.call_args
    # _build_llm_client is called with keyword arguments
    assert call_kwargs.kwargs["provider"] == "anthropic"
    assert call_kwargs.kwargs["model_id"] == "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# Test 5: Variable references in instruction are resolved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_instruction_variable_resolution(company_context):
    """{{#prev_node.result#}} in instruction is resolved from state.agent_outputs."""
    executor = AgentPodNodeExecutor()
    node_config = {
        "id": "n2",
        "type": "agent_pod",
        "agentRef": {"name": "alice"},
        "instruction": "Review this: {{#prev_node.result#}}",
    }
    state = make_state(agent_outputs={"prev_node": {"result": "some code here"}})

    captured_messages: list = []

    mock_response = _make_mock_response("Looks good", 20)
    mock_client = MagicMock()

    async def fake_invoke(messages):
        captured_messages.extend(messages)
        return mock_response

    mock_client.ainvoke = AsyncMock(side_effect=fake_invoke)

    with patch(_PATCH_ANTHROPIC, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    human_msg = captured_messages[1]
    assert "some code here" in human_msg.content


# ---------------------------------------------------------------------------
# Test 6: inputs dict in node_config is resolved
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_inputs_dict_resolved(company_context):
    """inputs dict values are resolved from state and appear in result output."""
    executor = AgentPodNodeExecutor()
    node_config = {
        "id": "n3",
        "type": "agent_pod",
        "agentRef": {"name": "alice"},
        "instruction": "Do task.",
        "inputs": {
            "code": {"node_id": "generator", "variable": "code"},
        },
    }
    state = make_state(agent_outputs={"generator": {"code": "x = 1 + 1"}})

    mock_response = _make_mock_response("Done", 15)
    mock_client = MagicMock()
    mock_client.ainvoke = AsyncMock(return_value=mock_response)

    with patch(_PATCH_ANTHROPIC, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    assert result.output["inputs"]["code"] == "x = 1 + 1"


# ---------------------------------------------------------------------------
# Test 7: snake_case agent_ref also accepted
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_snake_case_agent_ref(company_context):
    """agent_ref (snake_case) is accepted in addition to agentRef (camelCase)."""
    executor = AgentPodNodeExecutor()
    node_config = {
        "id": "n1",
        "type": "agent_pod",
        "agent_ref": {"name": "alice"},
        "instruction": "Hello.",
    }
    state = make_state()

    mock_response = _make_mock_response("Hi!", 10)
    mock_client = MagicMock()
    mock_client.ainvoke = AsyncMock(return_value=mock_response)

    with patch(_PATCH_ANTHROPIC, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    assert result.output["agent_name"] == "alice"
