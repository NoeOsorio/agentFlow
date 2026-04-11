"""Node executor registry — populated by A4 node implementations."""
from __future__ import annotations

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult, UnknownNodeTypeError

# Registry is empty here — filled in A4-PR-3
NODE_EXECUTORS: dict[str, NodeExecutor] = {}


def get_node_executor(node_type: str) -> NodeExecutor:
    if node_type not in NODE_EXECUTORS:
        raise UnknownNodeTypeError(f"No executor registered for node type: '{node_type}'")
    return NODE_EXECUTORS[node_type]


def register_executor(node_type: str, executor: NodeExecutor) -> None:
    NODE_EXECUTORS[node_type] = executor


__all__ = [
    "NodeExecutor",
    "NodeExecutionResult",
    "UnknownNodeTypeError",
    "NODE_EXECUTORS",
    "get_node_executor",
    "register_executor",
]
