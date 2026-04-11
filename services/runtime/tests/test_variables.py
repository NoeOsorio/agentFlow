"""Tests for VariableResolver."""
from __future__ import annotations

import pytest

from agentflow_runtime.state import PipelineState
from agentflow_runtime.variables import VariableResolutionError, VariableResolver


def _state(**outputs) -> PipelineState:
    return PipelineState(
        run_id="test-run",
        pipeline_name="test-pipeline",
        agent_outputs=outputs,
    )


def test_resolve_dict_ref():
    state = _state(llm_1={"output": {"text": "hello world"}})
    resolver = VariableResolver(state)
    result = resolver.resolve({"node_id": "llm_1", "variable": "output", "path": ["text"]})
    assert result == "hello world"


def test_resolve_dict_ref_no_path():
    state = _state(llm_1={"output": "direct value"})
    resolver = VariableResolver(state)
    result = resolver.resolve({"node_id": "llm_1", "variable": "output"})
    assert result == "direct value"


def test_resolve_string_interpolation():
    state = _state(llm_1={"output": {"text": "Paris"}})
    resolver = VariableResolver(state)
    result = resolver.resolve("The capital is {{#llm_1.output.text#}}.")
    assert result == "The capital is Paris."


def test_resolve_string_single_ref_returns_typed():
    state = _state(llm_1={"count": 42})
    resolver = VariableResolver(state)
    result = resolver.resolve("{{#llm_1.count#}}")
    assert result == 42


def test_resolve_literal_passthrough():
    state = _state()
    resolver = VariableResolver(state)
    assert resolver.resolve(123) == 123
    assert resolver.resolve(None) is None
    assert resolver.resolve("plain string") == "plain string"


def test_path_traversal_nested():
    state = _state(node_a={"result": {"meta": {"score": 0.95}}})
    resolver = VariableResolver(state)
    result = resolver.resolve({"node_id": "node_a", "variable": "result", "path": ["meta", "score"]})
    assert result == 0.95


def test_invalid_path_raises():
    state = _state(node_a={"result": "not a dict"})
    resolver = VariableResolver(state)
    with pytest.raises(VariableResolutionError, match="Cannot traverse"):
        resolver.resolve({"node_id": "node_a", "variable": "result", "path": ["nested"]})


def test_missing_node_raises():
    state = _state()
    resolver = VariableResolver(state)
    with pytest.raises(VariableResolutionError, match="No output found for node"):
        resolver.resolve({"node_id": "missing_node", "variable": "output"})


def test_missing_variable_raises():
    state = _state(llm_1={"output": "value"})
    resolver = VariableResolver(state)
    with pytest.raises(VariableResolutionError, match="Variable 'nonexistent' not found"):
        resolver.resolve({"node_id": "llm_1", "variable": "nonexistent"})


def test_resolve_all_dict():
    state = _state(llm_1={"text": "world"})
    resolver = VariableResolver(state)
    obj = {"greeting": "Hello {{#llm_1.text#}}", "count": 5}
    result = resolver.resolve_all(obj)
    assert result == {"greeting": "Hello world", "count": 5}


def test_resolve_all_list():
    state = _state(step_1={"val": "X"})
    resolver = VariableResolver(state)
    result = resolver.resolve_all(["prefix", "{{#step_1.val#}}", 99])
    assert result == ["prefix", "X", 99]


def test_resolve_all_nested():
    state = _state(a={"x": 1}, b={"y": 2})
    resolver = VariableResolver(state)
    obj = {"outer": {"ref_a": {"node_id": "a", "variable": "x"}, "ref_b": "{{#b.y#}}"}}
    result = resolver.resolve_all(obj)
    assert result == {"outer": {"ref_a": 1, "ref_b": 2}}
