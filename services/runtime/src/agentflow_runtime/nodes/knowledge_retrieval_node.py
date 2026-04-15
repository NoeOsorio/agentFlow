"""KnowledgeRetrievalNodeExecutor — HTTP call to an external knowledge base service."""
from __future__ import annotations

from typing import TYPE_CHECKING

import httpx

from ..variables import VariableResolver
from .base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from ..identity import CompanyContext
    from ..state import PipelineState


class KnowledgeRetrievalNodeExecutor(NodeExecutor):
    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        kb_url = node_config.get("knowledge_base_url") or ""
        if not kb_url:
            return NodeExecutionResult(
                output={"chunks": [], "sources": [], "available": False}
            )

        resolver = VariableResolver(state)
        query = resolver.resolve(node_config.get("query", ""))
        top_k = node_config.get("top_k", 5)

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                resp = await client.post(
                    f"{kb_url}/api/retrieve",
                    json={"query": query, "top_k": top_k},
                )
                if resp.status_code >= 400:
                    return NodeExecutionResult(
                        error=f"Knowledge base error: HTTP {resp.status_code}"
                    )
                data = resp.json()
                return NodeExecutionResult(
                    output={
                        "chunks": data.get("chunks", []),
                        "sources": data.get("sources", []),
                        "available": True,
                    }
                )
        except httpx.TimeoutException:
            return NodeExecutionResult(error="Knowledge retrieval timed out")
        except Exception as exc:
            return NodeExecutionResult(error=f"Knowledge retrieval failed: {exc}")
