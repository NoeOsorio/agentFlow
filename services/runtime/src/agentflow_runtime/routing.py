"""Conditional routing — evaluate conditions and build LangGraph edge functions."""
from __future__ import annotations

from typing import TYPE_CHECKING, Any, Callable

if TYPE_CHECKING:
    from .state import PipelineState


def _resolve_lhs(condition: dict, state: "PipelineState") -> Any:
    """Extract the left-hand value from the condition, resolving from state if needed."""
    variable_ref = condition.get("variable")
    if isinstance(variable_ref, dict):
        node_id = variable_ref.get("node_id", "")
        key = variable_ref.get("variable", "output")
        path: list[str] = variable_ref.get("path", [])
        value = state.agent_outputs.get(node_id, {}).get(key)
        for part in path:
            if isinstance(value, dict):
                value = value.get(part)
            else:
                return None
        return value
    if isinstance(variable_ref, str):
        # Try global_variables first, then client_data
        if variable_ref in state.global_variables:
            return state.global_variables[variable_ref]
        return state.client_data.get(variable_ref)
    return None


def evaluate_condition(condition: dict, state: "PipelineState") -> bool:
    """
    Evaluate a single condition dict against the current pipeline state.

    Supported operators:
        eq, ne, gt, gte, lt, lte,
        contains, not_contains, starts_with, ends_with,
        is_empty, is_not_empty
    """
    op = condition.get("operator", "eq")
    lhs = _resolve_lhs(condition, state)
    rhs = condition.get("value")

    if op == "eq":
        return lhs == rhs
    elif op == "ne":
        return lhs != rhs
    elif op == "gt":
        return lhs is not None and lhs > rhs
    elif op == "gte":
        return lhs is not None and lhs >= rhs
    elif op == "lt":
        return lhs is not None and lhs < rhs
    elif op == "lte":
        return lhs is not None and lhs <= rhs
    elif op == "contains":
        if isinstance(lhs, (list, tuple)):
            return rhs in lhs
        return isinstance(lhs, str) and str(rhs) in lhs
    elif op == "not_contains":
        if isinstance(lhs, (list, tuple)):
            return rhs not in lhs
        return not (isinstance(lhs, str) and str(rhs) in lhs)
    elif op == "starts_with":
        return isinstance(lhs, str) and lhs.startswith(str(rhs))
    elif op == "ends_with":
        return isinstance(lhs, str) and lhs.endswith(str(rhs))
    elif op == "is_empty":
        return lhs is None or lhs == "" or lhs == [] or lhs == {}
    elif op == "is_not_empty":
        return lhs is not None and lhs != "" and lhs != [] and lhs != {}
    else:
        raise ValueError(f"Unknown condition operator: {op!r}")


def evaluate_condition_group(group: dict, state: "PipelineState") -> bool:
    """
    Evaluate a condition group (AND / OR logic) and return True if the group passes.

    Args:
        group: Dict with keys "logical" ("AND"|"OR"), "conditions" (list), "branch_id".
        state: Current pipeline state.
    """
    logical = (group.get("logical") or "AND").upper()
    conditions = group.get("conditions", [])

    if not conditions:
        return True

    results = [evaluate_condition(c, state) for c in conditions]
    if logical == "OR":
        return any(results)
    return all(results)  # AND (default)


def evaluate_branch_groups(groups: list[dict], state: "PipelineState") -> str | None:
    """Return the branch_id of the first passing group, or None if none pass."""
    for group in groups:
        if evaluate_condition_group(group, state):
            return group.get("branch_id")
    return None


def build_conditional_edge_fn(
    node_id: str,
    groups: list[dict],
    default_branch: str,
) -> Callable[["PipelineState"], str]:
    """
    Build a LangGraph conditional edge routing function for an if_else node.

    Args:
        node_id: The if_else node's ID (used to name the function).
        groups: List of condition groups, each with a branch_id.
        default_branch: Branch ID to use if no group passes.

    Returns:
        A function (state) -> branch_id suitable for graph.add_conditional_edges().
    """

    def route(state) -> str:
        # No type annotation on `state` — LangGraph's get_type_hints() would fail
        # trying to resolve "PipelineState" from the closure's __globals__.
        winner = evaluate_branch_groups(groups, state)
        return winner if winner is not None else default_branch

    route.__name__ = f"route_{node_id}"
    return route
