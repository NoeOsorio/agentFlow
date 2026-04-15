"""Tests for KnowledgeRetrievalNodeExecutor and SubWorkflowNodeExecutor."""
from __future__ import annotations

import httpx
import pytest
import respx

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes.knowledge_retrieval_node import KnowledgeRetrievalNodeExecutor
from agentflow_runtime.nodes.sub_workflow_node import SubWorkflowNodeExecutor
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
# KnowledgeRetrievalNodeExecutor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_knowledge_retrieval_no_url():
    executor = KnowledgeRetrievalNodeExecutor()
    state = make_state()
    result = await executor.execute({}, state, make_company())

    assert result.error is None
    assert result.output["available"] is False
    assert result.output["chunks"] == []
    assert result.output["sources"] == []


@pytest.mark.asyncio
@respx.mock
async def test_knowledge_retrieval_success():
    kb_url = "https://kb.example.com"
    respx.post(f"{kb_url}/api/retrieve").mock(
        return_value=httpx.Response(
            200,
            json={"chunks": ["chunk1", "chunk2"], "sources": ["doc.pdf"]},
        )
    )

    executor = KnowledgeRetrievalNodeExecutor()
    state = make_state()
    node_config = {
        "knowledge_base_url": kb_url,
        "query": "What is AgentFlow?",
        "top_k": 2,
    }
    result = await executor.execute(node_config, state, make_company())

    assert result.error is None
    assert result.output["available"] is True
    assert result.output["chunks"] == ["chunk1", "chunk2"]
    assert result.output["sources"] == ["doc.pdf"]


@pytest.mark.asyncio
@respx.mock
async def test_knowledge_retrieval_500_error():
    kb_url = "https://kb.example.com"
    respx.post(f"{kb_url}/api/retrieve").mock(
        return_value=httpx.Response(500, text="Internal Server Error")
    )

    executor = KnowledgeRetrievalNodeExecutor()
    state = make_state()
    node_config = {"knowledge_base_url": kb_url, "query": "test"}
    result = await executor.execute(node_config, state, make_company())

    assert result.error is not None
    assert "500" in result.error


# ---------------------------------------------------------------------------
# SubWorkflowNodeExecutor
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_sub_workflow_no_pipeline_name():
    executor = SubWorkflowNodeExecutor()
    state = make_state()
    result = await executor.execute({}, state, make_company())

    assert result.error is not None
    assert "pipeline_name" in result.error


@pytest.mark.asyncio
@respx.mock
async def test_sub_workflow_success():
    api_base = "http://localhost:8000"
    pipeline_name = "my-sub-pipeline"

    respx.get(f"{api_base}/api/pipelines/{pipeline_name}").mock(
        return_value=httpx.Response(200, json={"name": pipeline_name})
    )
    respx.post(f"{api_base}/api/pipelines/{pipeline_name}/run").mock(
        return_value=httpx.Response(
            200,
            json={"run_id": "run-42", "outputs": {"result": "done"}, "status": "completed"},
        )
    )

    executor = SubWorkflowNodeExecutor()
    state = make_state()
    node_config = {
        "api_base_url": api_base,
        "pipeline_name": pipeline_name,
        "inputs": {"key": "value"},
    }
    result = await executor.execute(node_config, state, make_company())

    assert result.error is None
    assert result.output["run_id"] == "run-42"
    assert result.output["outputs"] == {"result": "done"}
    assert result.output["status"] == "completed"
