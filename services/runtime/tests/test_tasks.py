"""Tests for Celery pipeline tasks — A2-PR-4."""
from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.state import PipelineState
from agentflow_runtime.tasks.pipeline_tasks import celery_app, execute_pipeline

# ---------------------------------------------------------------------------
# Sample YAML fixtures
# ---------------------------------------------------------------------------

COMPANY_YAML = """\
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
  namespace: default
spec:
  agents:
    - name: alice
      role: Lead Engineer
      model:
        provider: anthropic
        model_id: claude-sonnet-4-6
      budget:
        monthly_usd: 100.0
"""

PIPELINE_YAML = """\
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: test-pipeline
spec:
  company_ref:
    name: acme-corp
  nodes:
    - id: start
      type: start
    - id: end
      type: end
  edges:
    - from: start
      to: end
"""


# Run Celery tasks synchronously during tests (no broker needed)
celery_app.conf.task_always_eager = True
celery_app.conf.task_eager_propagates = True


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _mock_executor(state: PipelineState) -> MagicMock:
    """Return a PipelineExecutor mock whose run() returns the given state."""
    mock = MagicMock()
    mock.run = AsyncMock(return_value=state)
    return mock


def _run_state(run_id: str = "run-123") -> PipelineState:
    return PipelineState(
        run_id=run_id,
        pipeline_name="test-pipeline",
        company_name="acme-corp",
    )


# ---------------------------------------------------------------------------
# execute_pipeline
# ---------------------------------------------------------------------------


class TestExecutePipeline:
    def test_parses_both_yamls_and_calls_executor(self) -> None:
        """execute_pipeline must parse both YAMLs and call PipelineExecutor.run."""
        with patch("agentflow_runtime.tasks.pipeline_tasks.PipelineExecutor") as MockExec:
            MockExec.return_value = _mock_executor(_run_state())

            result = execute_pipeline.apply(kwargs=dict(
                run_id="run-123",
                pipeline_yaml=PIPELINE_YAML,
                company_yaml=COMPANY_YAML,
                trigger_data={"key": "value"},
            )).get()

        assert result["run_id"] == "run-123"
        assert result["pipeline_name"] == "test-pipeline"

        # PipelineExecutor must be called with parsed dict + CompanyContext
        call_args = MockExec.call_args[0]
        pipeline_dict, company_context = call_args[0], call_args[1]
        assert isinstance(pipeline_dict, dict)
        assert pipeline_dict["metadata"]["name"] == "test-pipeline"
        assert isinstance(company_context, CompanyContext)
        assert company_context.name == "acme-corp"

    def test_company_yaml_parsed_into_company_context(self) -> None:
        """The second PipelineExecutor constructor arg must come from company_yaml."""
        with patch("agentflow_runtime.tasks.pipeline_tasks.PipelineExecutor") as MockExec:
            MockExec.return_value = _mock_executor(_run_state("run-456"))

            execute_pipeline.apply(kwargs=dict(
                run_id="run-456",
                pipeline_yaml=PIPELINE_YAML,
                company_yaml=COMPANY_YAML,
                trigger_data={},
            )).get()

        company_context: CompanyContext = MockExec.call_args[0][1]
        assert isinstance(company_context, CompanyContext)
        assert "alice" in company_context.agents
        assert company_context.agents["alice"].role == "Lead Engineer"

    def test_result_contains_all_required_fields(self) -> None:
        """Returned dict must include run_id, pipeline_name, completed, failed, cost_usd, error."""
        with patch("agentflow_runtime.tasks.pipeline_tasks.PipelineExecutor") as MockExec:
            MockExec.return_value = _mock_executor(_run_state())

            result = execute_pipeline.apply(kwargs=dict(
                run_id="run-789",
                pipeline_yaml=PIPELINE_YAML,
                company_yaml=COMPANY_YAML,
                trigger_data={},
            )).get()

        for field in ("run_id", "pipeline_name", "completed", "failed", "cost_usd", "error"):
            assert field in result, f"Missing field in result: {field}"

    def test_retry_with_exponential_backoff_on_failure(self) -> None:
        """On executor failure, retry countdown must be 2**retry_count."""
        captured: dict = {}

        def _capture_retry(exc=None, countdown=None, **kwargs):
            captured["countdown"] = countdown
            raise RuntimeError("retry triggered")

        # push_request sets up request.retries without touching the property setter
        execute_pipeline.push_request(retries=2, id="test-backoff-run")
        try:
            with patch("agentflow_runtime.tasks.pipeline_tasks.PipelineExecutor") as MockExec, \
                 patch.object(execute_pipeline, "retry", side_effect=_capture_retry):
                mock_exec = MagicMock()
                mock_exec.run = AsyncMock(side_effect=RuntimeError("executor crashed"))
                MockExec.return_value = mock_exec

                with pytest.raises(RuntimeError, match="retry triggered"):
                    execute_pipeline.run(
                        run_id="fail-run",
                        pipeline_yaml=PIPELINE_YAML,
                        company_yaml=COMPANY_YAML,
                        trigger_data={},
                    )
        finally:
            execute_pipeline.pop_request()

        # countdown must be 2**2 = 4
        assert captured["countdown"] == 4

    def test_accepts_exactly_four_parameters(self) -> None:
        """execute_pipeline must accept exactly: run_id, pipeline_yaml, company_yaml, trigger_data."""
        import inspect
        sig = inspect.signature(execute_pipeline.__wrapped__)
        params = [p for p in sig.parameters if p != "self"]
        assert set(params) == {"run_id", "pipeline_yaml", "company_yaml", "trigger_data"}
