"""HTTP request node — performs outbound HTTP calls via httpx."""
from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult
from agentflow_runtime.variables import VariableResolver

if TYPE_CHECKING:
    from agentflow_runtime.identity import CompanyContext
    from agentflow_runtime.state import PipelineState


class HTTPNodeExecutor(NodeExecutor):
    """Executes an outbound HTTP request and returns status, body, and headers."""

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        resolver = VariableResolver(state)

        method: str = node_config.get("method", "GET").upper()
        url: str = resolver.resolve(node_config["url"])
        headers: dict[str, str] = {
            k: str(resolver.resolve(v))
            for k, v in node_config.get("headers", {}).items()
        }
        body = resolver.resolve(node_config["body"]) if node_config.get("body") else None
        timeout_ms: int = node_config.get("timeout_ms", 30000)
        timeout_s: float = timeout_ms / 1000

        try:
            async with httpx.AsyncClient(timeout=timeout_s) as client:
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    content=body if isinstance(body, (bytes, str)) else None,
                    json=body if isinstance(body, dict) else None,
                )
        except httpx.TimeoutException as exc:
            return NodeExecutionResult(
                error=f"HTTP request timed out: {exc}"
            )
        except Exception as exc:
            return NodeExecutionResult(error=f"HTTP request failed: {exc}")

        response_body = response.text
        if response.is_error:
            return NodeExecutionResult(
                error=f"HTTP {response.status_code}: {response_body}"
            )

        return NodeExecutionResult(
            output={
                "status_code": response.status_code,
                "body": response_body,
                "headers": dict(response.headers),
            }
        )
