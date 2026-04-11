"""Variable resolver — resolves VariableReference dicts and {{#...#}} syntax."""
from __future__ import annotations

import re
from typing import Any

from .state import PipelineState

# Matches {{#node_id.variable.path.parts#}}
_REF_PATTERN = re.compile(r"\{\{#([^#]+)#\}\}")


class VariableResolutionError(Exception):
    """Raised when a variable reference cannot be resolved."""


class VariableResolver:
    def __init__(self, state: PipelineState) -> None:
        self._state = state

    def resolve(self, ref: dict | str | Any) -> Any:
        """
        Resolves:
        - VariableReference dict: { node_id, variable, path? }
        - String with {{#node_id.variable.path#}} syntax (interpolates all refs)
        - Literal values: returned as-is
        """
        if isinstance(ref, dict) and "node_id" in ref and "variable" in ref:
            return self._lookup(
                ref["node_id"],
                ref["variable"],
                ref.get("path") or [],
            )
        if isinstance(ref, str):
            return self._interpolate(ref)
        return ref

    def resolve_all(self, obj: Any) -> Any:
        """Recursively resolves all variable references in any object."""
        if isinstance(obj, dict):
            if "node_id" in obj and "variable" in obj:
                return self.resolve(obj)
            return {k: self.resolve_all(v) for k, v in obj.items()}
        if isinstance(obj, list):
            return [self.resolve_all(item) for item in obj]
        if isinstance(obj, str):
            return self._interpolate(obj)
        return obj

    def _interpolate(self, text: str) -> Any:
        """Replace all {{#...#}} refs in a string.

        If the entire string is a single ref, returns the resolved value directly
        (preserving type). Otherwise returns a string with all refs substituted.
        """
        matches = _REF_PATTERN.findall(text)
        if not matches:
            return text

        # Single ref that spans the whole string → return typed value
        if len(matches) == 1 and text.strip() == "{{#" + matches[0] + "#}}":
            return self._resolve_dotted(matches[0])

        def _replace(m: re.Match) -> str:
            return str(self._resolve_dotted(m.group(1)))

        return _REF_PATTERN.sub(_replace, text)

    def _resolve_dotted(self, dotted: str) -> Any:
        """Parse 'node_id.variable.path.parts' and resolve."""
        parts = dotted.split(".")
        if len(parts) < 2:
            raise VariableResolutionError(
                f"Invalid variable reference '{dotted}': expected 'node_id.variable[.path...]'"
            )
        node_id, variable, *path = parts
        return self._lookup(node_id, variable, path)

    def _lookup(self, node_id: str, variable: str, path: list[str]) -> Any:
        """Look up value in state.agent_outputs[node_id][variable] with path traversal."""
        node_output = self._state.agent_outputs.get(node_id)
        if node_output is None:
            raise VariableResolutionError(
                f"No output found for node '{node_id}'"
            )
        value = node_output.get(variable) if isinstance(node_output, dict) else None
        if value is None and variable not in (node_output if isinstance(node_output, dict) else {}):
            raise VariableResolutionError(
                f"Variable '{variable}' not found in output of node '{node_id}'"
            )
        for key in path:
            if isinstance(value, dict):
                if key not in value:
                    raise VariableResolutionError(
                        f"Key '{key}' not found while traversing path in '{node_id}.{variable}'"
                    )
                value = value[key]
            else:
                raise VariableResolutionError(
                    f"Cannot traverse '{key}' on {type(value).__name__} "
                    f"in '{node_id}.{variable}'"
                )
        return value
