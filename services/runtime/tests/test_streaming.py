"""Tests for StreamEvent, StreamingExecutor, and format_sse — A2-PR-4."""
from __future__ import annotations

import json
from dataclasses import asdict
from unittest.mock import MagicMock, patch

import pytest

from agentflow_runtime.identity import AgentIdentity, CompanyContext
from agentflow_runtime.streaming import StreamEvent, StreamingExecutor, format_sse


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
def company_context() -> CompanyContext:
    return CompanyContext(
        name="acme-corp",
        namespace="default",
        agents={
            "alice": AgentIdentity(
                name="alice",
                role="Lead Engineer",
                persona=None,
                model_provider="anthropic",
                model_id="claude-sonnet-4-6",
            )
        },
    )


@pytest.fixture
def pipeline(company_context: CompanyContext) -> dict:
    return {
        "apiVersion": "agentflow.ai/v1",
        "kind": "Pipeline",
        "metadata": {"name": "test-pipeline"},
        "spec": {
            "company_ref": {"name": company_context.name},
            "nodes": [
                {"id": "start", "type": "start"},
                {
                    "id": "agent1",
                    "type": "agent_pod",
                    "agent_ref": {"name": "alice"},
                },
                {"id": "end", "type": "end"},
            ],
            "edges": [
                {"from": "start", "to": "agent1"},
                {"from": "agent1", "to": "end"},
            ],
        },
    }


@pytest.fixture
def sample_event() -> StreamEvent:
    return StreamEvent(
        event="node_start",
        run_id="run-123",
        agent_name="alice",
        agent_role="Lead Engineer",
        company_name="acme-corp",
        data={"node_id": "agent1"},
        timestamp="2024-01-01T00:00:00+00:00",
    )


# ---------------------------------------------------------------------------
# format_sse
# ---------------------------------------------------------------------------


class TestFormatSse:
    def test_starts_with_data_prefix(self, sample_event: StreamEvent) -> None:
        result = format_sse(sample_event)
        assert result.startswith("data: ")

    def test_ends_with_double_newline(self, sample_event: StreamEvent) -> None:
        result = format_sse(sample_event)
        assert result.endswith("\n\n")

    def test_contains_valid_json(self, sample_event: StreamEvent) -> None:
        result = format_sse(sample_event)
        json_part = result[len("data: "):].strip()
        parsed = json.loads(json_part)
        assert parsed["event"] == "node_start"
        assert parsed["run_id"] == "run-123"
        assert parsed["agent_name"] == "alice"
        assert parsed["agent_role"] == "Lead Engineer"
        assert parsed["company_name"] == "acme-corp"

    def test_all_fields_present(self, sample_event: StreamEvent) -> None:
        result = format_sse(sample_event)
        json_part = result[len("data: "):].strip()
        parsed = json.loads(json_part)
        for field in ("event", "run_id", "agent_name", "agent_role", "company_name", "data", "timestamp"):
            assert field in parsed, f"Missing field: {field}"


# ---------------------------------------------------------------------------
# StreamingExecutor.stream
# ---------------------------------------------------------------------------


def _make_lg_events(*pairs: tuple[str, str]) -> list[dict]:
    """Build minimal LangGraph event dicts from (event_type, node_name) pairs."""
    return [{"event": evt, "name": name, "data": {}, "metadata": {}} for evt, name in pairs]


def _fake_astream_events(events: list[dict]):
    """Return an async generator that yields the given events."""
    async def _gen(state, config=None, version="v2"):
        for evt in events:
            yield evt
    return _gen


class TestStreamingExecutorStream:
    @pytest.mark.asyncio
    async def test_events_emitted_in_order(
        self, pipeline: dict, company_context: CompanyContext
    ) -> None:
        """node_start → node_complete → pipeline_complete must appear in that order."""
        lg_events = _make_lg_events(
            ("on_chain_start", "agent1"),
            ("on_chain_end", "agent1"),
        )
        executor = StreamingExecutor()

        with patch("agentflow_runtime.streaming.build_graph") as mock_build, \
             patch("agentflow_runtime.streaming.AgentFlowCheckpointer"), \
             patch("redis.asyncio.from_url", return_value=MagicMock(
                 publish=MagicMock(return_value=_noop()),
                 aclose=MagicMock(return_value=_noop()),
             )):
            mock_compiled = MagicMock()
            mock_compiled.astream_events = _fake_astream_events(lg_events)
            mock_build.return_value.compile.return_value = mock_compiled

            collected = [e async for e in executor.stream("run-1", pipeline, company_context, {})]

        event_types = [e.event for e in collected]
        assert "pipeline_complete" in event_types
        # pipeline_complete must be the final event
        assert event_types[-1] == "pipeline_complete"

    @pytest.mark.asyncio
    async def test_node_start_before_node_complete(
        self, pipeline: dict, company_context: CompanyContext
    ) -> None:
        """node_start must appear before node_complete for the same node."""
        lg_events = _make_lg_events(
            ("on_chain_start", "agent1"),
            ("on_chain_end", "agent1"),
        )
        executor = StreamingExecutor()

        with patch("agentflow_runtime.streaming.build_graph") as mock_build, \
             patch("agentflow_runtime.streaming.AgentFlowCheckpointer"), \
             patch("redis.asyncio.from_url", return_value=MagicMock(
                 publish=MagicMock(return_value=_noop()),
                 aclose=MagicMock(return_value=_noop()),
             )):
            mock_compiled = MagicMock()
            mock_compiled.astream_events = _fake_astream_events(lg_events)
            mock_build.return_value.compile.return_value = mock_compiled

            collected = [e async for e in executor.stream("run-2", pipeline, company_context, {})]

        event_types = [e.event for e in collected]
        assert "node_start" in event_types
        assert "node_complete" in event_types
        assert event_types.index("node_start") < event_types.index("node_complete")

    @pytest.mark.asyncio
    async def test_all_events_include_agent_name_and_role(
        self, pipeline: dict, company_context: CompanyContext
    ) -> None:
        """Events for agent nodes must carry agent_name and agent_role."""
        lg_events = _make_lg_events(
            ("on_chain_start", "agent1"),
            ("on_chain_end", "agent1"),
        )
        executor = StreamingExecutor()

        with patch("agentflow_runtime.streaming.build_graph") as mock_build, \
             patch("agentflow_runtime.streaming.AgentFlowCheckpointer"), \
             patch("redis.asyncio.from_url", return_value=MagicMock(
                 publish=MagicMock(return_value=_noop()),
                 aclose=MagicMock(return_value=_noop()),
             )):
            mock_compiled = MagicMock()
            mock_compiled.astream_events = _fake_astream_events(lg_events)
            mock_build.return_value.compile.return_value = mock_compiled

            collected = [e async for e in executor.stream("run-3", pipeline, company_context, {})]

        agent_events = [e for e in collected if e.event in ("node_start", "node_complete")]
        assert len(agent_events) > 0
        for evt in agent_events:
            assert evt.agent_name == "alice"
            assert evt.agent_role == "Lead Engineer"
            assert evt.company_name == "acme-corp"

    @pytest.mark.asyncio
    async def test_pipeline_error_emitted_on_failure(
        self, pipeline: dict, company_context: CompanyContext
    ) -> None:
        """When graph.astream_events raises, pipeline_error must be the final event."""

        async def _exploding(state, config=None, version="v2"):
            raise RuntimeError("simulated failure")
            yield  # make it an async generator

        executor = StreamingExecutor()

        with patch("agentflow_runtime.streaming.build_graph") as mock_build, \
             patch("agentflow_runtime.streaming.AgentFlowCheckpointer"), \
             patch("redis.asyncio.from_url", return_value=MagicMock(
                 publish=MagicMock(return_value=_noop()),
                 aclose=MagicMock(return_value=_noop()),
             )):
            mock_compiled = MagicMock()
            mock_compiled.astream_events = _exploding
            mock_build.return_value.compile.return_value = mock_compiled

            collected = [e async for e in executor.stream("run-4", pipeline, company_context, {})]

        assert len(collected) == 1
        assert collected[0].event == "pipeline_error"
        assert "simulated failure" in collected[0].data["error"]

    @pytest.mark.asyncio
    async def test_pipeline_complete_is_final_event(
        self, pipeline: dict, company_context: CompanyContext
    ) -> None:
        """pipeline_complete must always be the last emitted event on success."""
        lg_events = _make_lg_events(
            ("on_chain_start", "agent1"),
            ("on_chain_end", "agent1"),
        )
        executor = StreamingExecutor()

        with patch("agentflow_runtime.streaming.build_graph") as mock_build, \
             patch("agentflow_runtime.streaming.AgentFlowCheckpointer"), \
             patch("redis.asyncio.from_url", return_value=MagicMock(
                 publish=MagicMock(return_value=_noop()),
                 aclose=MagicMock(return_value=_noop()),
             )):
            mock_compiled = MagicMock()
            mock_compiled.astream_events = _fake_astream_events(lg_events)
            mock_build.return_value.compile.return_value = mock_compiled

            collected = [e async for e in executor.stream("run-5", pipeline, company_context, {})]

        assert collected[-1].event == "pipeline_complete"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _noop(*args, **kwargs):
    """No-op coroutine for mocking async Redis methods."""
    return None
