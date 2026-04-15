"""Tests for HTTPNodeExecutor."""
from __future__ import annotations

import json
from unittest.mock import AsyncMock, patch

import httpx
import pytest
import respx

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.http_node import HTTPNodeExecutor
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
@respx.mock
async def test_get_request_success():
    """GET request returns status_code, body, and headers."""
    respx.get("https://example.com/api").mock(
        return_value=httpx.Response(200, json={"ok": True}, headers={"x-custom": "val"})
    )

    executor = HTTPNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "method": "GET",
        "url": "https://example.com/api",
    }

    result = await executor.execute(node_config, state, company)

    assert result.error is None
    assert result.output["status_code"] == 200
    assert json.loads(result.output["body"]) == {"ok": True}
    assert "x-custom" in result.output["headers"]


@pytest.mark.asyncio
@respx.mock
async def test_post_request_with_body_and_headers():
    """POST request sends custom headers and JSON body, returns success."""
    route = respx.post("https://api.example.com/data").mock(
        return_value=httpx.Response(201, json={"created": True})
    )

    executor = HTTPNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "method": "POST",
        "url": "https://api.example.com/data",
        "headers": {"Authorization": "Bearer token123", "Content-Type": "application/json"},
        "body": {"name": "test"},
    }

    result = await executor.execute(node_config, state, company)

    assert result.error is None
    assert result.output["status_code"] == 201
    assert route.called


@pytest.mark.asyncio
@respx.mock
async def test_5xx_response_returns_error():
    """500 response results in an error, not an exception."""
    respx.get("https://example.com/fail").mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    executor = HTTPNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "method": "GET",
        "url": "https://example.com/fail",
    }

    result = await executor.execute(node_config, state, company)

    assert result.error is not None
    assert "500" in result.error
    assert result.output == {}


@pytest.mark.asyncio
async def test_timeout_returns_error():
    """TimeoutException results in an error result."""
    executor = HTTPNodeExecutor()
    state = make_state()
    company = make_company()

    node_config = {
        "method": "GET",
        "url": "https://slow.example.com/",
        "timeout_ms": 100,
    }

    with patch("httpx.AsyncClient.request",
               new=AsyncMock(side_effect=httpx.TimeoutException("timed out"))):
        result = await executor.execute(node_config, state, company)

    assert result.error is not None
    assert "timed out" in result.error.lower()
    assert result.output == {}
