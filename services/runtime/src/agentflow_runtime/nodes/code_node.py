"""Code execution node — runs sandboxed Python snippets via subprocess."""
from __future__ import annotations

import asyncio
import json
import re
from typing import TYPE_CHECKING

from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult
from agentflow_runtime.variables import VariableResolver

if TYPE_CHECKING:
    from agentflow_runtime.identity import CompanyContext
    from agentflow_runtime.state import PipelineState

# Blocked module names
_BLOCKED = {"os", "subprocess", "sys", "shutil", "socket", "importlib"}

# Patterns: "import <blocked>" or "from <blocked>" (word-boundary aware)
_IMPORT_RE = re.compile(
    r"(?:^|\s)(?:import|from)\s+(" + "|".join(re.escape(m) for m in _BLOCKED) + r")(?:\s|$|\.)",
    re.MULTILINE,
)

_SCRIPT_TEMPLATE = """\
import json as _json, sys as _sys
inputs = {inputs_json}
{user_code}
print(_json.dumps(output))
"""


class CodeNodeExecutor(NodeExecutor):
    """Executes arbitrary Python code in a subprocess sandbox."""

    async def execute(
        self,
        node_config: dict,
        state: "PipelineState",
        company_context: "CompanyContext",
    ) -> NodeExecutionResult:
        code: str = node_config.get("code", "")
        timeout: float = float(node_config.get("timeout_seconds", 10))

        # 1. Security check
        match = _IMPORT_RE.search(code)
        if match:
            blocked_name = match.group(1)
            return NodeExecutionResult(
                error=f"Security violation: blocked import '{blocked_name}'"
            )

        # 2. Resolve inputs
        resolver = VariableResolver(state)
        raw_inputs: dict = node_config.get("inputs", {})
        inputs = {k: resolver.resolve(v) for k, v in raw_inputs.items()}

        # 3. Build script
        script = _SCRIPT_TEMPLATE.format(
            inputs_json=json.dumps(inputs),
            user_code=code,
        )

        # 4. Run subprocess
        try:
            proc = await asyncio.create_subprocess_exec(
                "python3", "-c", script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            try:
                stdout_bytes, stderr_bytes = await asyncio.wait_for(
                    proc.communicate(), timeout=timeout
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.communicate()
                return NodeExecutionResult(
                    error=f"Code execution timed out after {timeout}s"
                )
        except Exception as exc:  # pragma: no cover
            return NodeExecutionResult(error=f"Subprocess error: {exc}")

        # 5. Check exit code
        if proc.returncode != 0:
            stderr_text = stderr_bytes.decode(errors="replace").strip()
            return NodeExecutionResult(error=f"Code execution failed: {stderr_text}")

        # 6. Parse last non-empty line of stdout
        stdout_text = stdout_bytes.decode(errors="replace")
        lines = [line for line in stdout_text.splitlines() if line.strip()]
        if not lines:
            return NodeExecutionResult(error="Code produced no output")

        try:
            parsed_output = json.loads(lines[-1])
        except json.JSONDecodeError as exc:
            return NodeExecutionResult(error=f"Failed to parse output as JSON: {exc}")

        return NodeExecutionResult(output=parsed_output)
