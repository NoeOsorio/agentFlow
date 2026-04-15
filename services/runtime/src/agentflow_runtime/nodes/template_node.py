"""Template node — renders a Jinja2 template with variables from pipeline state."""
from __future__ import annotations

import re
from typing import TYPE_CHECKING

from jinja2 import Environment, StrictUndefined, UndefinedError

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult

if TYPE_CHECKING:
    from agentflow_runtime.identity import CompanyContext
    from agentflow_runtime.state import PipelineState

# Matches {{#node_id.variable.path.parts#}}
_REF_PATTERN = re.compile(r"\{\{#([^#]+)#\}\}")


def _preprocess_template(template_str: str, state: "PipelineState") -> tuple[str, dict]:
    """
    Convert {{#node_id.variable.path#}} syntax to Jinja2-safe vars.

    Returns:
        (processed_template_str, context_dict)
    """
    context: dict = {}
    matches = _REF_PATTERN.findall(template_str)

    for dotted in matches:
        parts = dotted.split(".")
        if len(parts) < 2:
            continue
        node_id = parts[0]
        rest = parts[1:]

        # Build a Jinja2-safe variable name: all parts joined with __
        jinja_var = node_id + "__" + "__".join(rest)

        # Resolve value from state — track whether the full path exists so
        # that missing nodes/keys cause StrictUndefined to raise UndefinedError.
        node_output = state.agent_outputs.get(node_id)
        found = node_output is not None
        value = node_output
        for key in rest:
            if found and isinstance(value, dict) and key in value:
                value = value[key]
            else:
                found = False
                break

        if found:
            context[jinja_var] = value
        # If not found, the var is absent from context → StrictUndefined raises
        # Replace in template string
        template_str = template_str.replace("{{#" + dotted + "#}}", "{{ " + jinja_var + " }}")

    return template_str, context


class TemplateNodeExecutor(NodeExecutor):
    """Renders a Jinja2 template using variables resolved from pipeline state."""

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        template_str: str = node_config.get("template", "")

        # Pre-process {{#...#}} references into Jinja2 vars
        processed, context = _preprocess_template(template_str, state)

        # Render
        env = Environment(undefined=StrictUndefined)
        try:
            tmpl = env.from_string(processed)
            rendered = tmpl.render(**context)
        except UndefinedError as exc:
            return NodeExecutionResult(error=f"Template variable not found: {exc}")
        except Exception as exc:
            return NodeExecutionResult(error=f"Template rendering error: {exc}")

        return NodeExecutionResult(output={"text": rendered})
