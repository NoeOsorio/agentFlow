"""Tests for LLMNodeExecutor."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.llm_node import LLMNodeExecutor
from agentflow_runtime.nodes.base import NodeExecutionResult
from agentflow_runtime.state import PipelineState

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

COMPANY_DICT = {
    "apiVersion": "agentflow.ai/v1",
    "kind": "Company",
    "metadata": {"name": "acme", "namespace": "default"},
    "spec": {
        "agents": [
            {
                "name": "writer",
                "role": "Content Writer",
                "persona": "Writes compelling content.",
                "model": {"provider": "anthropic", "modelId": "claude-sonnet-4-6"},
                "budgetMonthlyUsd": 50.0,
            },
        ]
    },
}


@pytest.fixture
def company_context() -> CompanyContext:
    return CompanyContext.from_company_yaml(COMPANY_DICT)


def make_state(**kwargs) -> PipelineState:
    return PipelineState(run_id="test-run", pipeline_name="test", **kwargs)


def _make_mock_response(content: str = "result", total_tokens: int = 30) -> MagicMock:
    usage = MagicMock()
    usage.total_tokens = total_tokens
    resp = MagicMock()
    resp.content = content
    resp.usage_metadata = usage
    return resp


_PATCH_BUILDER = "agentflow_runtime.nodes.llm_node._build_llm_client"


# ---------------------------------------------------------------------------
# Test 1: Basic text generation with mocked ChatAnthropic
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_basic_text_generation(company_context):
    """LLMNodeExecutor returns text output from model invocation."""
    executor = LLMNodeExecutor()
    node_config = {
        "id": "n1",
        "type": "llm",
        "model": {"provider": "anthropic", "id": "claude-sonnet-4-6"},
        "prompt": {
            "system": "You are a helpful assistant.",
            "user": "Say hello.",
        },
    }
    state = make_state()

    mock_response = _make_mock_response("Hello there!", 25)
    mock_client = MagicMock()
    mock_client.ainvoke = AsyncMock(return_value=mock_response)

    with patch(_PATCH_BUILDER, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    assert result.output["text"] == "Hello there!"
    assert result.output["tokens_used"] == 25
    assert result.output["model_id"] == "claude-sonnet-4-6"


# ---------------------------------------------------------------------------
# Test 2: Structured output with JSON schema
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_structured_output(company_context):
    """with_structured_output is used when output_schema is present."""
    executor = LLMNodeExecutor()
    output_schema = {
        "type": "object",
        "properties": {"name": {"type": "string"}, "score": {"type": "number"}},
    }
    node_config = {
        "id": "n2",
        "type": "llm",
        "model": {"provider": "anthropic", "id": "claude-sonnet-4-6"},
        "prompt": {"system": "", "user": "Evaluate."},
        "output_schema": output_schema,
    }
    state = make_state()

    structured_result = {"name": "Alice", "score": 9.5}

    # The structured client (returned by with_structured_output) returns a dict directly
    mock_structured_client = MagicMock()
    mock_structured_client.ainvoke = AsyncMock(return_value=structured_result)

    mock_client = MagicMock()
    mock_client.with_structured_output = MagicMock(return_value=mock_structured_client)

    with patch(_PATCH_BUILDER, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    assert result.output["structured"] == structured_result
    mock_client.with_structured_output.assert_called_once_with(output_schema)


# ---------------------------------------------------------------------------
# Test 3: Variable reference resolution in prompt
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_variable_resolution_in_prompt(company_context):
    """{{#...#}} references in prompt.user are resolved from state.agent_outputs."""
    executor = LLMNodeExecutor()
    node_config = {
        "id": "n3",
        "type": "llm",
        "model": {"provider": "anthropic", "id": "claude-sonnet-4-6"},
        "prompt": {
            "system": "You are helpful.",
            "user": "Summarize: {{#extractor.text#}}",
        },
    }
    state = make_state(agent_outputs={"extractor": {"text": "The quick brown fox"}})

    captured_messages: list = []
    mock_response = _make_mock_response("Summary!", 18)
    mock_client = MagicMock()

    async def fake_invoke(messages):
        captured_messages.extend(messages)
        return mock_response

    mock_client.ainvoke = AsyncMock(side_effect=fake_invoke)

    with patch(_PATCH_BUILDER, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    human_msg = captured_messages[-1]
    assert "The quick brown fox" in human_msg.content


# ---------------------------------------------------------------------------
# Test 4: Agent context merges persona into system prompt
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_agent_context_merges_persona(company_context):
    """When agentRef is set, agent persona is prepended to the system prompt."""
    executor = LLMNodeExecutor()
    node_config = {
        "id": "n4",
        "type": "llm",
        "agentRef": {"name": "writer"},
        "prompt": {
            "system": "Follow AP style.",
            "user": "Write a tagline.",
        },
    }
    state = make_state()

    captured_messages: list = []
    mock_response = _make_mock_response("Just do it.", 12)
    mock_client = MagicMock()

    async def fake_invoke(messages):
        captured_messages.extend(messages)
        return mock_response

    mock_client.ainvoke = AsyncMock(side_effect=fake_invoke)

    with patch(_PATCH_BUILDER, return_value=mock_client):
        result = await executor.execute(node_config, state, company_context)

    assert result.success, result.error
    system_msg = captured_messages[0]
    # Should contain both the agent persona and the node system text
    assert "Content Writer" in system_msg.content
    assert "acme" in system_msg.content
    assert "Writes compelling content" in system_msg.content
    assert "AP style" in system_msg.content
