"""Build a LangGraph StateGraph from a pipeline definition."""
from __future__ import annotations

import asyncio
from typing import Any, Callable

from langgraph.graph import StateGraph, END

from .state import PipelineState
from .pod import AgentPod, AgentContext, AgentResult


def _make_agent_node(pod: AgentPod) -> Callable[[PipelineState], dict[str, Any]]:
    """Wrap an AgentPod as a LangGraph node function."""

    async def node(state: PipelineState) -> dict[str, Any]:
        context = AgentContext(
            run_id=state.run_id,
            pipeline_name=state.pipeline_name,
            client_data=state.client_data,
            previous_outputs=state.agent_outputs,
        )

        try:
            await pod.on_start(context)
            result: AgentResult = await pod.run(context)
            await pod.on_done(result)
        except Exception as exc:
            await pod.on_fail(exc)
            return {
                "failed": state.failed + [pod.name],
                "error": str(exc),
            }

        return {
            "agent_outputs": {**state.agent_outputs, pod.name: result.output},
            "completed": state.completed + [pod.name],
            "cost_usd": state.cost_usd + (result.tokens_used * 0.000003),  # rough estimate
        }

    node.__name__ = f"agent_{pod.name}"
    return node


def build_graph(
    agents: list[AgentPod],
    dependencies: dict[str, list[str]],
) -> StateGraph:
    """
    Build a LangGraph StateGraph from a list of AgentPods and their dependencies.

    Args:
        agents: List of AgentPod instances to execute
        dependencies: Map of agent_name -> [names of agents that must complete first]

    Returns:
        A compiled LangGraph StateGraph ready to invoke
    """
    agent_map = {pod.name: pod for pod in agents}

    graph = StateGraph(PipelineState)

    # Add a node for each agent
    for pod in agents:
        graph.add_node(pod.name, _make_agent_node(pod))

    # Wire edges: START → agents with no dependencies
    from langgraph.graph import START
    for pod in agents:
        deps = dependencies.get(pod.name, [])
        if not deps:
            graph.add_edge(START, pod.name)

    # Wire edges: agent → dependents (after an agent completes, trigger its dependents)
    # Build reverse map: agent → agents that depend on it
    dependents: dict[str, list[str]] = {pod.name: [] for pod in agents}
    for agent_name, deps in dependencies.items():
        for dep in deps:
            if dep in dependents:
                dependents[dep].append(agent_name)

    for pod in agents:
        targets = dependents[pod.name]
        if targets:
            for target in targets:
                graph.add_edge(pod.name, target)
        else:
            graph.add_edge(pod.name, END)

    return graph
