# Testing Guide — A2-PR-2: NodeExecutor Base, VariableResolver & Budget

## What's in this PR

| File | What it adds |
|------|-------------|
| `services/runtime/src/agentflow_runtime/identity.py` | `AgentIdentity`, `CompanyContext`, `AgentLifecycleConfig`, `AgentNotFoundError` |
| `services/runtime/src/agentflow_runtime/state.py` | Updated `PipelineState` with company/node fields + `NodeExecutionRecord` |
| `services/runtime/src/agentflow_runtime/nodes/base.py` | `NodeExecutor` ABC, `NodeExecutionResult`, `UnknownNodeTypeError` |
| `services/runtime/src/agentflow_runtime/nodes/__init__.py` | `NODE_EXECUTORS` registry, `get_node_executor`, `register_executor` |
| `services/runtime/src/agentflow_runtime/variables.py` | `VariableResolver`, `VariableResolutionError` |
| `services/runtime/src/agentflow_runtime/budget.py` | `MODEL_COSTS`, `BudgetExceededError`, `estimate_cost`, `check_agent_budget`, `check_pipeline_budget` |

## Requirements

- Python ≥ 3.12
- `uv` installed (`brew install uv` or `pip install uv`)

## Run the tests

```bash
cd services/runtime
uv run pytest tests/test_variables.py tests/test_budget.py -v
```

Expected output: **24 passed**.

## Quick smoke tests in a REPL

```bash
cd services/runtime
uv run python
```

### 1. VariableResolver

```python
from agentflow_runtime.state import PipelineState
from agentflow_runtime.variables import VariableResolver

state = PipelineState(
    run_id="r1",
    pipeline_name="demo",
    agent_outputs={"llm_1": {"output": {"text": "Hello world"}}},
)
resolver = VariableResolver(state)

# Dict reference
resolver.resolve({"node_id": "llm_1", "variable": "output", "path": ["text"]})
# → "Hello world"

# String interpolation
resolver.resolve("Result: {{#llm_1.output.text#}}")
# → "Result: Hello world"

# resolve_all on a nested structure
resolver.resolve_all({"prompt": "Say {{#llm_1.output.text#}}", "count": 3})
# → {"prompt": "Say Hello world", "count": 3}
```

### 2. Budget enforcement

```python
from agentflow_runtime.budget import estimate_cost, check_agent_budget, BudgetExceededError
from agentflow_runtime.identity import AgentIdentity

# Cost estimate
estimate_cost(1000, "claude-sonnet-4-6")  # → 0.003

# Agent budget — OK
agent = AgentIdentity(
    name="alice", role="engineer", persona=None,
    model_provider="anthropic", model_id="claude-sonnet-4-6",
    budget_monthly_usd=100.0,
)
check_agent_budget(agent, cost_so_far=50.0, new_cost=10.0)  # no error

# Agent budget — exceeded
check_agent_budget(agent, cost_so_far=99.0, new_cost=2.0)
# → BudgetExceededError: Agent 'alice' would exceed monthly budget...
```

### 3. NodeExecutor registry

```python
from agentflow_runtime.nodes import NODE_EXECUTORS, get_node_executor, UnknownNodeTypeError

print(NODE_EXECUTORS)  # → {} (empty until A4-PR-3)

try:
    get_node_executor("llm")
except UnknownNodeTypeError as e:
    print(e)  # → No executor registered for node type: 'llm'
```

### 4. CompanyContext from YAML

```python
from agentflow_runtime.identity import CompanyContext, AgentNotFoundError

company = {
    "metadata": {"name": "acme-corp", "namespace": "production"},
    "spec": {
        "agents": [
            {
                "name": "alice",
                "role": "Lead Engineer",
                "persona": "You are a senior Python engineer.",
                "model": {"provider": "anthropic", "id": "claude-sonnet-4-6"},
                "budget_monthly_usd": 50.0,
            }
        ]
    },
}

ctx = CompanyContext.from_company_yaml(company)
alice = ctx.resolve_agent("alice")
print(alice.persona)  # → "You are a senior Python engineer."
print(alice.budget_monthly_usd)  # → 50.0

ctx.resolve_agent("bob")  # → AgentNotFoundError: Agent 'bob' not found in company 'acme-corp'
```
