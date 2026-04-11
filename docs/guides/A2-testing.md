# A2-PR-3 Testing Guide

## What this branch adds

| File | Description |
|------|-------------|
| `routing.py` | Conditional edge evaluation — 12 operators, `build_conditional_edge_fn` |
| `heartbeat.py` | `AgentHeartbeatMonitor` — emits heartbeats to Redis during execution |
| `lifecycle.py` | `execute_with_lifecycle` — on_start / on_done / on_fail webhook hooks |
| `checkpoint.py` | `AgentFlowCheckpointer` — Redis-backed LangGraph checkpoint saver |
| `dag.py` | `build_graph(pipeline, company_context)` — new pipeline-dict–based API |
| `executor.py` | `PipelineExecutor(pipeline, company_context, redis_url)` — run / resume / get_state |
| `variables.py` | `VariableResolver` — resolves `{{#node.output.key#}}` references |
| `budget.py` | `BudgetExceededError`, `check_agent_budget`, `estimate_cost` |
| `nodes/base.py` | `NodeExecutor` ABC + `NodeExecutionResult` |
| `nodes/__init__.py` | `NODE_EXECUTORS` registry + `get_node_executor` |

---

## Quick start — run the tests

```bash
cd services/runtime
uv run pytest tests/ -v
```

Expected output: **29 passed**.

---

## Manual testing

### 1. Install dependencies

```bash
cd services/runtime
uv sync --all-extras
```

### 2. Verify imports

```bash
uv run python -c "
from agentflow_runtime.executor import PipelineExecutor
from agentflow_runtime.checkpoint import AgentFlowCheckpointer
from agentflow_runtime.routing import build_conditional_edge_fn, evaluate_condition
from agentflow_runtime.heartbeat import AgentHeartbeatMonitor
from agentflow_runtime.lifecycle import execute_with_lifecycle
from agentflow_runtime.budget import BudgetExceededError, estimate_cost
from agentflow_runtime.variables import VariableResolver
from agentflow_runtime.nodes import get_node_executor, NODE_EXECUTORS
print('All imports OK')
"
```

### 3. Run specific test groups

```bash
# Executor, routing, budget, checkpoint
uv run pytest tests/test_executor.py -v

# Heartbeat and lifecycle hooks
uv run pytest tests/test_heartbeat.py -v

# All A2 tests (identity, state, executor, heartbeat)
uv run pytest tests/ -v
```

### 4. Test conditional routing manually

```bash
uv run python -c "
from agentflow_runtime.routing import evaluate_condition, build_conditional_edge_fn
from agentflow_runtime.state import PipelineState
from agentflow_runtime.identity import CompanyContext

state = PipelineState(
    run_id='test',
    pipeline_name='test',
    agent_outputs={'step1': {'score': 90}},
)

# Test: score >= 80
cond = {'variable': {'node_id': 'step1', 'variable': 'score'}, 'operator': 'gte', 'value': 80}
print('score >= 80:', evaluate_condition(cond, state))   # True

# Test: score == 'hello'
cond2 = {'variable': {'node_id': 'step1', 'variable': 'score'}, 'operator': 'eq', 'value': 'hello'}
print('score == hello:', evaluate_condition(cond2, state))  # False
"
```

### 5. Test budget enforcement

```bash
uv run python -c "
from agentflow_runtime.budget import estimate_cost, check_agent_budget, BudgetExceededError
from agentflow_runtime.identity import AgentIdentity

alice = AgentIdentity(
    name='alice', role='Engineer', persona=None,
    model_provider='anthropic', model_id='claude-sonnet-4-6',
    budget_monthly_usd=0.01,
)

cost = estimate_cost(1000, 'claude-sonnet-4-6')
print(f'1000 tokens = \${cost:.6f}')

# OK: under budget
check_agent_budget(alice, 0.0, 0.005)
print('Budget check passed (under limit)')

# Fail: over budget
try:
    check_agent_budget(alice, 0.008, 0.005)
except BudgetExceededError as e:
    print(f'Budget exceeded (expected): {e}')
"
```

### 6. Test variable resolver

```bash
uv run python -c "
from agentflow_runtime.variables import VariableResolver
from agentflow_runtime.state import PipelineState

state = PipelineState(
    run_id='r1',
    pipeline_name='test',
    agent_outputs={'node1': {'message': 'Hello, world!', 'count': 42}},
)

resolver = VariableResolver(state)

# Resolve a reference dict
ref = {'node_id': 'node1', 'variable': 'message'}
print(resolver.resolve(ref))  # Hello, world!

# Resolve a template string
template = 'Count is {{#node1.count#}} items'
print(resolver.resolve(template))  # Count is 42 items
"
```

### 7. Test with a real pipeline (requires Redis)

Start Redis first:

```bash
docker compose up redis -d
```

Then:

```bash
uv run python -c "
import asyncio
from agentflow_runtime.executor import PipelineExecutor
from agentflow_runtime.identity import CompanyContext
from agentflow_runtime.nodes import register_executor
from agentflow_runtime.nodes.base import NodeExecutor, NodeExecutionResult

# Register a passthrough executor for all node types
class PassthroughExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context):
        return NodeExecutionResult(output={'result': f'done:{node_config[\"id\"]}'})

for t in ['start', 'agent_pod', 'end']:
    register_executor(t, PassthroughExecutor())

company = CompanyContext.from_company_yaml({
    'metadata': {'name': 'acme', 'namespace': 'default'},
    'spec': {'agents': [{'name': 'alice', 'role': 'Engineer', 'persona': 'Senior dev',
                         'model': {'provider': 'anthropic', 'modelId': 'claude-sonnet-4-6'}}]},
})

pipeline = {
    'metadata': {'name': 'demo'},
    'spec': {
        'nodes': [
            {'id': 'start', 'type': 'start'},
            {'id': 'agent1', 'type': 'agent_pod', 'agentRef': {'name': 'alice'}},
            {'id': 'end', 'type': 'end'},
        ],
        'edges': [
            {'source': 'start', 'target': 'agent1'},
            {'source': 'agent1', 'target': 'end'},
        ],
    },
}

async def main():
    executor = PipelineExecutor(pipeline, company, redis_url='redis://localhost:6379')
    result = await executor.run(trigger_data={'ticket': 'PROJ-1'})
    print('Completed nodes:', result.completed)
    print('Outputs:', result.agent_outputs)
    print('Cost:', result.cost_usd)

asyncio.run(main())
"
```

---

## Key interfaces

### `PipelineExecutor`

```python
from agentflow_runtime.executor import PipelineExecutor

executor = PipelineExecutor(pipeline_dict, company_context, redis_url="redis://...")

state = await executor.run(trigger_data={...})       # fresh run
state = await executor.resume("run-id")              # resume from checkpoint
state = await executor.get_state("run-id")           # read state without executing
```

### `AgentFlowCheckpointer`

```python
from agentflow_runtime.checkpoint import AgentFlowCheckpointer
from langgraph.checkpoint.memory import MemorySaver  # for tests

# Production: Redis
checkpointer = AgentFlowCheckpointer("redis://localhost:6379")

# Tests: in-memory (no Redis needed)
checkpointer = MemorySaver()
```

### `AgentHeartbeatMonitor`

```python
from agentflow_runtime.heartbeat import AgentHeartbeatMonitor

async with AgentHeartbeatMonitor(agent.name, agent.lifecycle, run_id, redis_client):
    result = await do_work()
# Publishes to: agentflow:heartbeat:{agent_name} every interval_seconds
```

### `execute_with_lifecycle`

```python
from agentflow_runtime.lifecycle import execute_with_lifecycle

result = await execute_with_lifecycle(agent, run_id, coro, redis_client)
# Fires on_start → [heartbeat loop] → work() → on_done  (or on_fail)
```
