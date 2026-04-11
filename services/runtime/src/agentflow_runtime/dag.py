"""Build a LangGraph StateGraph from a pipeline dict + CompanyContext."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Callable

from langgraph.graph import END, START, StateGraph

from .budget import BudgetExceededError, check_agent_budget
from .identity import CompanyContext
from .nodes import UnknownNodeTypeError, get_node_executor
from .routing import build_conditional_edge_fn
from .state import NodeExecutionRecord, PipelineState
from .variables import VariableResolver

logger = logging.getLogger(__name__)


def _wrap_node_executor(
    node: dict,
    company_context: CompanyContext,
) -> Callable[[PipelineState], dict[str, Any]]:
    """
    Wrap a NodeExecutor as a LangGraph async node function.

    Handles:
    - Variable resolution in node config before execution
    - Agent identity lookup for agent_pod nodes
    - Budget enforcement (post-execution)
    - NodeExecutionRecord tracking
    - Graceful passthrough for unregistered node types
    """
    node_id: str = node["id"]
    node_type: str = node.get("type", "")

    async def run_node(state: PipelineState) -> dict[str, Any]:
        resolver = VariableResolver(state)
        resolved_config = resolver.resolve_all(node)

        record = NodeExecutionRecord(
            node_id=node_id,
            node_type=node_type,
            agent_name=None,
            status="running",
            started_at=datetime.now(timezone.utc),
        )

        # Resolve agent identity for agent_pod nodes
        agent = None
        agent_ref = node.get("agentRef") or node.get("agent_ref")
        if agent_ref:
            agent_name = agent_ref.get("name")
            if agent_name:
                agent = company_context.resolve_agent(agent_name)
                record.agent_name = agent_name

        # Look up executor — skip (passthrough) unregistered node types
        try:
            executor = get_node_executor(node_type)
        except UnknownNodeTypeError:
            logger.debug("No executor for node type %r — passthrough", node_type)
            record.status = "skipped"
            record.finished_at = datetime.now(timezone.utc)
            new_records = {**state.node_executions, node_id: record}
            return {
                "node_executions": new_records,
                "completed": state.completed + [node_id],
            }

        # Execute node
        try:
            result = await executor.execute(resolved_config, state, company_context)
        except BudgetExceededError:
            raise  # propagate budget errors immediately
        except Exception as exc:
            record.status = "failed"
            record.finished_at = datetime.now(timezone.utc)
            record.error = str(exc)
            new_records = {**state.node_executions, node_id: record}
            return {
                "node_executions": new_records,
                "failed": state.failed + [node_id],
                "error": str(exc),
            }

        # Post-execution budget enforcement
        if agent is not None and result.cost_usd > 0:
            agent_cost_so_far = sum(
                rec.cost_usd
                for rec in state.node_executions.values()
                if rec.agent_name == agent.name
            )
            check_agent_budget(agent, agent_cost_so_far, result.cost_usd)

        record.status = "completed"
        record.finished_at = datetime.now(timezone.utc)
        record.tokens_used = result.tokens_used
        record.cost_usd = result.cost_usd
        record.output_snapshot = result.output

        new_records = {**state.node_executions, node_id: record}
        new_outputs = {**state.agent_outputs, node_id: result.output}

        return {
            "agent_outputs": new_outputs,
            "node_executions": new_records,
            "completed": state.completed + [node_id],
            "cost_usd": state.cost_usd + result.cost_usd,
        }

    run_node.__name__ = f"node_{node_id}"
    return run_node


def _make_if_else_passthrough(node_id: str) -> Callable[[PipelineState], dict[str, Any]]:
    """
    If/else nodes are pure routing constructs — they don't execute logic themselves.
    LangGraph routes via the conditional edge function; this node just marks itself done.
    """

    async def passthrough(state: PipelineState) -> dict[str, Any]:
        return {"completed": state.completed + [node_id]}

    passthrough.__name__ = f"node_{node_id}"
    return passthrough


def build_graph(pipeline: dict, company_context: CompanyContext) -> StateGraph:
    """
    Build a LangGraph StateGraph from a pipeline dict and CompanyContext.

    New signature for A2-PR-3 (replaces the old agents+dependencies API).

    Args:
        pipeline: Fully parsed pipeline YAML dict (apiVersion/kind/metadata/spec).
        company_context: Resolved company with all agent identities.

    Returns:
        An uncompiled LangGraph StateGraph. Call .compile() before invoking.
    """
    spec = pipeline.get("spec", {})
    nodes: list[dict] = spec.get("nodes", [])
    edges: list[dict] = spec.get("edges", [])

    graph = StateGraph(PipelineState)

    # Identify if_else nodes for special handling
    if_else_ids = {n["id"] for n in nodes if n.get("type") == "if_else"}

    # ------------------------------------------------------------------ #
    # Add nodes
    # ------------------------------------------------------------------ #
    for node in nodes:
        node_id = node["id"]
        node_type = node.get("type", "")

        # Validate agent refs eagerly so errors surface at build time
        agent_ref = node.get("agentRef") or node.get("agent_ref")
        if node_type == "agent_pod" and agent_ref:
            company_context.resolve_agent(agent_ref.get("name", ""))

        if node_id in if_else_ids:
            graph.add_node(node_id, _make_if_else_passthrough(node_id))
        else:
            graph.add_node(node_id, _wrap_node_executor(node, company_context))

    # ------------------------------------------------------------------ #
    # Entry edges: START → start-typed nodes (or first nodes with no incoming)
    # ------------------------------------------------------------------ #
    target_ids = {e["target"] for e in edges}
    for node in nodes:
        node_id = node["id"]
        node_type = node.get("type", "")
        if node_type == "start" or node_id not in target_ids:
            graph.add_edge(START, node_id)

    # ------------------------------------------------------------------ #
    # Exit edges: end-typed nodes → END (or last nodes with no outgoing)
    # ------------------------------------------------------------------ #
    source_ids = {e["source"] for e in edges}
    for node in nodes:
        node_id = node["id"]
        node_type = node.get("type", "")
        if node_type == "end" or node_id not in source_ids:
            graph.add_edge(node_id, END)

    # ------------------------------------------------------------------ #
    # Regular edges
    # ------------------------------------------------------------------ #
    for edge in edges:
        source = edge["source"]
        target = edge["target"]
        if source in if_else_ids:
            continue  # conditional edges handled below
        graph.add_edge(source, target)

    # ------------------------------------------------------------------ #
    # Conditional edges for if_else nodes
    # ------------------------------------------------------------------ #
    if_else_nodes_map = {n["id"]: n for n in nodes if n["id"] in if_else_ids}
    for node_id, node in if_else_nodes_map.items():
        groups = node.get("groups") or node.get("conditionGroups") or []
        default_branch = node.get("defaultBranch") or node.get("default_branch") or "false_branch"

        # Collect branch → target mapping from edges that carry a "branch" key
        branch_map: dict[str, str] = {
            e["branch"]: e["target"]
            for e in edges
            if e["source"] == node_id and "branch" in e
        }

        if not branch_map:
            # No branch labels → fall back to regular edges
            for e in edges:
                if e["source"] == node_id:
                    graph.add_edge(node_id, e["target"])
            continue

        route_fn = build_conditional_edge_fn(node_id, groups, default_branch)
        graph.add_conditional_edges(node_id, route_fn, branch_map)

    return graph
