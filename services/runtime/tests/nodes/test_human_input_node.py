"""Tests for HumanInputNodeExecutor using fakeredis."""
from __future__ import annotations

import asyncio
import json

import fakeredis.aioredis
import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.human_input_node import HumanInputNodeExecutor
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
# Tests: no Redis
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_no_redis_fallback_skip():
    executor = HumanInputNodeExecutor()
    state = make_state()
    node_config = {"id": "hi1", "fallback": "skip"}
    result = await executor.execute(node_config, state, make_company())

    assert result.error is None
    assert result.output["skipped"] is True
    assert result.output["response"] is None


@pytest.mark.asyncio
async def test_no_redis_fallback_fail():
    executor = HumanInputNodeExecutor()
    state = make_state()
    node_config = {"id": "hi1", "fallback": "fail"}
    result = await executor.execute(node_config, state, make_company())

    assert result.error is not None
    assert "Redis" in result.error


# ---------------------------------------------------------------------------
# Tests: with fakeredis
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_with_redis_receives_response():
    redis = fakeredis.aioredis.FakeRedis()
    executor = HumanInputNodeExecutor()
    state = make_state()
    node_id = "hi2"
    response_channel = f"agentflow:human_response:{state.run_id}:{node_id}"
    node_config = {
        "id": node_id,
        "prompt": "What is your name?",
        "timeout_seconds": 5,
        "fallback": "fail",
        "_redis_client": redis,
    }

    async def _publish_response():
        # Small delay to ensure the executor has subscribed
        await asyncio.sleep(0.05)
        await redis.publish(response_channel, json.dumps({"response": "Alice"}))

    result, _ = await asyncio.gather(
        executor.execute(node_config, state, make_company()),
        _publish_response(),
    )

    assert result.error is None
    assert result.output["response"] == "Alice"
    assert result.output["skipped"] is False


@pytest.mark.asyncio
async def test_timeout_fallback_skip():
    redis = fakeredis.aioredis.FakeRedis()
    executor = HumanInputNodeExecutor()
    state = make_state()
    node_config = {
        "id": "hi3",
        "timeout_seconds": 0.05,
        "fallback": "skip",
        "_redis_client": redis,
    }
    result = await executor.execute(node_config, state, make_company())

    assert result.error is None
    assert result.output["skipped"] is True
    assert result.output.get("timeout") is True


@pytest.mark.asyncio
async def test_timeout_fallback_fail():
    redis = fakeredis.aioredis.FakeRedis()
    executor = HumanInputNodeExecutor()
    state = make_state()
    node_config = {
        "id": "hi4",
        "timeout_seconds": 0.05,
        "fallback": "fail",
        "_redis_client": redis,
    }
    result = await executor.execute(node_config, state, make_company())

    assert result.error is not None
    assert "timed out" in result.error.lower()
