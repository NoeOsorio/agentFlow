"""Node executor registry — populated by A4 node implementations."""
from __future__ import annotations

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult, UnknownNodeTypeError

__all__ = [
    "NodeExecutor",
    "NodeExecutionResult",
    "UnknownNodeTypeError",
    "NODE_EXECUTORS",
    "get_node_executor",
    "register_executor",
]

#: Global registry mapping node type → executor instance.
#: Populated by A4 node implementations via register_executor().
NODE_EXECUTORS: dict[str, NodeExecutor] = {}


def register_executor(node_type: str, executor: NodeExecutor) -> None:
    """Register an executor for a node type."""
    NODE_EXECUTORS[node_type] = executor


def get_node_executor(node_type: str) -> NodeExecutor:
    """
    Look up the executor for a node type.

    Raises UnknownNodeTypeError if no executor is registered.
    """
    if node_type not in NODE_EXECUTORS:
        raise UnknownNodeTypeError(
            f"No executor registered for node type '{node_type}'. "
            f"Registered types: {list(NODE_EXECUTORS)}"
        )
    return NODE_EXECUTORS[node_type]
