"""Tests for CodeNodeExecutor."""
from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.code_node import CodeNodeExecutor
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
# Tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_simple_addition():
    """Code adds two inputs and returns the result."""
    executor = CodeNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "code": "output = {'result': inputs['x'] + inputs['y']}",
        "inputs": {"x": 3, "y": 7},
    }

    result = await executor.execute(node_config, state, company)

    assert result.error is None
    assert result.output == {"result": 10}


@pytest.mark.asyncio
async def test_timeout_returns_error():
    """When asyncio.wait_for raises TimeoutError, an error result is returned."""
    executor = CodeNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "code": "output = {}",
        "inputs": {},
        "timeout_seconds": 1,
    }

    with patch("agentflow_runtime.nodes.code_node.asyncio.wait_for",
               new=AsyncMock(side_effect=asyncio.TimeoutError())):
        result = await executor.execute(node_config, state, company)

    assert result.error is not None
    assert "timed out" in result.error.lower()
    assert result.output == {}


@pytest.mark.asyncio
async def test_blocked_import_os():
    """Code containing 'import os' is rejected before subprocess is launched."""
    executor = CodeNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "code": "import os\noutput = {'cwd': os.getcwd()}",
        "inputs": {},
    }

    result = await executor.execute(node_config, state, company)

    assert result.error is not None
    assert "Security violation" in result.error
    assert "os" in result.error


@pytest.mark.asyncio
async def test_blocked_import_subprocess():
    """Code containing 'import subprocess' is rejected."""
    executor = CodeNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "code": "import subprocess\noutput = {}",
        "inputs": {},
    }

    result = await executor.execute(node_config, state, company)

    assert result.error is not None
    assert "Security violation" in result.error


@pytest.mark.asyncio
async def test_variable_injection_from_state():
    """Inputs resolved from state.agent_outputs are injected into the script."""
    executor = CodeNodeExecutor()
    state = make_state(
        agent_outputs={
            "prev_node": {"value": 42}
        }
    )
    company = make_company()

    node_config = {
        "code": "output = {'doubled': inputs['num'] * 2}",
        "inputs": {
            "num": {"node_id": "prev_node", "variable": "value"},
        },
    }

    result = await executor.execute(node_config, state, company)

    assert result.error is None
    assert result.output == {"doubled": 84}
