"""Tests for PipelineState and NodeExecutionRecord."""
from __future__ import annotations

from datetime import datetime

from agentflow_runtime.state import NodeExecutionRecord, PipelineState


class TestPipelineStateNewFields:
    def test_instantiates_with_defaults(self):
        state = PipelineState(run_id="run-1", pipeline_name="my-pipeline")
        assert state.company_name == ""
        assert state.company_context is None
        assert state.current_agent_name is None
        assert state.node_executions == {}
        assert state.global_variables == {}
        assert state.current_branch is None
        assert state.iteration_index == 0
        assert state.iteration_results == []
        assert state.streaming_channel is None

    def test_original_fields_still_work(self):
        state = PipelineState(run_id="run-2", pipeline_name="p")
        assert state.agent_outputs == {}
        assert state.completed == []
        assert state.failed == []
        assert state.cost_usd == 0.0
        assert state.error is None


class TestNodeExecutionRecord:
    def test_required_fields(self):
        rec = NodeExecutionRecord(
            node_id="node-1",
            node_type="agent_pod",
            agent_name="alice",
            status="pending",
        )
        assert rec.node_id == "node-1"
        assert rec.node_type == "agent_pod"
        assert rec.agent_name == "alice"
        assert rec.status == "pending"

    def test_optional_fields_default(self):
        rec = NodeExecutionRecord(
            node_id="n", node_type="llm", agent_name=None, status="completed"
        )
        assert rec.started_at is None
        assert rec.finished_at is None
        assert rec.tokens_used == 0
        assert rec.cost_usd == 0.0
        assert rec.input_snapshot is None
        assert rec.output_snapshot is None
        assert rec.error is None

    def test_all_fields(self):
        now = datetime.utcnow()
        rec = NodeExecutionRecord(
            node_id="n2",
            node_type="agent_pod",
            agent_name="bob",
            status="failed",
            started_at=now,
            finished_at=now,
            tokens_used=1000,
            cost_usd=0.003,
            input_snapshot={"prompt": "hello"},
            output_snapshot={"result": "world"},
            error="timeout",
        )
        assert rec.tokens_used == 1000
        assert rec.cost_usd == 0.003
        assert rec.error == "timeout"
