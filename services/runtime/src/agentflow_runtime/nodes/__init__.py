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


# ---------------------------------------------------------------------------
# Register built-in A4 executors
# ---------------------------------------------------------------------------

def _register_defaults() -> None:
    from agentflow_runtime.nodes.agent_pod_node import AgentPodNodeExecutor
    from agentflow_runtime.nodes.llm_node import LLMNodeExecutor
    from agentflow_runtime.nodes.code_node import CodeNodeExecutor
    from agentflow_runtime.nodes.http_node import HTTPNodeExecutor
    from agentflow_runtime.nodes.template_node import TemplateNodeExecutor
    from agentflow_runtime.nodes.variable_assigner_node import VariableAssignerNodeExecutor
    from agentflow_runtime.nodes.variable_aggregator_node import VariableAggregatorNodeExecutor
    from agentflow_runtime.nodes.if_else_node import IfElseNodeExecutor
    from agentflow_runtime.nodes.start_node import StartNodeExecutor
    from agentflow_runtime.nodes.end_node import EndNodeExecutor
    from agentflow_runtime.nodes.iteration_node import IterationNodeExecutor
    from agentflow_runtime.nodes.human_input_node import HumanInputNodeExecutor
    from agentflow_runtime.nodes.knowledge_retrieval_node import KnowledgeRetrievalNodeExecutor
    from agentflow_runtime.nodes.sub_workflow_node import SubWorkflowNodeExecutor

    register_executor("start", StartNodeExecutor())
    register_executor("end", EndNodeExecutor())
    register_executor("agent_pod", AgentPodNodeExecutor())
    register_executor("llm", LLMNodeExecutor())
    register_executor("code", CodeNodeExecutor())
    register_executor("http", HTTPNodeExecutor())
    register_executor("if_else", IfElseNodeExecutor())
    register_executor("template", TemplateNodeExecutor())
    register_executor("variable_assigner", VariableAssignerNodeExecutor())
    register_executor("variable_aggregator", VariableAggregatorNodeExecutor())
    register_executor("iteration", IterationNodeExecutor())
    register_executor("human_input", HumanInputNodeExecutor())
    register_executor("knowledge_retrieval", KnowledgeRetrievalNodeExecutor())
    register_executor("sub_workflow", SubWorkflowNodeExecutor())


_register_defaults()
