"""SubWorkflowNodeExecutor — fetches and triggers a nested pipeline via the API."""
from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

from ..variables import VariableResolver
from .base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from ..identity import CompanyContext
    from ..state import PipelineState


class SubWorkflowNodeExecutor(NodeExecutor):
    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        api_base = node_config.get("api_base_url", "http://localhost:8000")
        pipeline_name = node_config.get("pipeline_name", "")
        namespace = node_config.get("namespace", "default")

        if not pipeline_name:
            return NodeExecutionResult(error="sub_workflow: pipeline_name is required")

        resolver = VariableResolver(state)
        inputs = {
            k: resolver.resolve(v)
            for k, v in node_config.get("inputs", {}).items()
        }

        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                # Fetch pipeline YAML (validates it exists)
                pipeline_resp = await client.get(
                    f"{api_base}/api/pipelines/{pipeline_name}",
                    params={"namespace": namespace},
                )
                if pipeline_resp.status_code >= 400:
                    return NodeExecutionResult(
                        error=(
                            f"Failed to fetch sub-pipeline '{pipeline_name}': "
                            f"HTTP {pipeline_resp.status_code}"
                        )
                    )

                # Trigger execution
                run_resp = await client.post(
                    f"{api_base}/api/pipelines/{pipeline_name}/run",
                    json={"inputs": inputs, "namespace": namespace},
                )
                if run_resp.status_code >= 400:
                    return NodeExecutionResult(
                        error=(
                            f"Failed to run sub-pipeline '{pipeline_name}': "
                            f"HTTP {run_resp.status_code}"
                        )
                    )

                run_data = run_resp.json()
                return NodeExecutionResult(
                    output={
                        "run_id": run_data.get("run_id"),
                        "outputs": run_data.get("outputs", {}),
                        "status": run_data.get("status", "started"),
                    }
                )

        except httpx.TimeoutException:
            return NodeExecutionResult(
                error=f"Sub-workflow '{pipeline_name}' timed out"
            )
        except Exception as exc:
            return NodeExecutionResult(error=f"Sub-workflow failed: {exc}")
