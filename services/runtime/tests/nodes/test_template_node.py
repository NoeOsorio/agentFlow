"""Tests for TemplateNodeExecutor."""
from __future__ import annotations

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.template_node import TemplateNodeExecutor
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


@pytest.mark.asyncio
async def test_simple_variable_interpolation():
    """{{#node1.text#}} is replaced by the node1 output value."""
    executor = TemplateNodeExecutor()
    state = make_state(agent_outputs={"node1": {"text": "hello"}})
    result = await executor.execute(
        {"template": "Say: {{#node1.text#}}"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["text"] == "Say: hello"


@pytest.mark.asyncio
async def test_multiple_variables():
    """Multiple distinct refs in one template all get resolved."""
    executor = TemplateNodeExecutor()
    state = make_state(agent_outputs={
        "node1": {"greeting": "Hi"},
        "node2": {"name": "World"},
    })
    result = await executor.execute(
        {"template": "{{#node1.greeting#}}, {{#node2.name#}}!"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["text"] == "Hi, World!"


@pytest.mark.asyncio
async def test_undefined_variable_returns_error():
    """Referencing an undefined variable produces an error result, not an exception."""
    executor = TemplateNodeExecutor()
    state = make_state(agent_outputs={})
    result = await executor.execute(
        {"template": "Value: {{#missing_node.val#}}"},
        state,
        make_company(),
    )
    assert not result.success
    assert result.error is not None
    assert "missing_node__val" in result.error or "not defined" in result.error or "variable" in result.error.lower()


@pytest.mark.asyncio
async def test_literal_jinja2_template_no_refs():
    """A plain Jinja2 template with no {{#...#}} refs renders as-is."""
    executor = TemplateNodeExecutor()
    state = make_state()
    result = await executor.execute(
        {"template": "Hello, World!"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["text"] == "Hello, World!"


@pytest.mark.asyncio
async def test_deeper_path_interpolation():
    """{{#node1.output.key#}} resolves nested dict path."""
    executor = TemplateNodeExecutor()
    state = make_state(agent_outputs={"node1": {"output": {"key": "deep_value"}}})
    result = await executor.execute(
        {"template": "Result: {{#node1.output.key#}}"},
        state,
        make_company(),
    )
    assert result.success
    assert result.output["text"] == "Result: deep_value"


@pytest.mark.asyncio
async def test_empty_template():
    """An empty template string renders to an empty string."""
    executor = TemplateNodeExecutor()
    state = make_state()
    result = await executor.execute({"template": ""}, state, make_company())
    assert result.success
    assert result.output["text"] == ""
