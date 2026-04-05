# Plan A2: Runtime Engine Enhancement

## Overview
Evolve the LangGraph execution engine to load agent identities from Company YAML, support all node types from Plan A1, implement the Paperclip heartbeat/lifecycle model, wire Redis checkpointing, support streaming execution, and dispatch via Celery. The runtime receives both a `Pipeline` and a `Company` resource — it resolves agents by name, injects their roles/personas/budgets into the execution context, and enforces per-agent cost limits.

## Tech Context
- **Primary package:** `services/runtime/`
- **Key files:**
  - `services/runtime/src/agentflow_runtime/dag.py`
  - `services/runtime/src/agentflow_runtime/executor.py`
  - `services/runtime/src/agentflow_runtime/pod.py`
  - `services/runtime/src/agentflow_runtime/state.py`
  - `services/runtime/src/agentflow_runtime/checkpoint.py`
- **Tech:** LangGraph 0.2, LangChain Core 0.3, Redis 5.2, Celery 5.4, Python 3.12+, Pydantic 2.10

---

## Goals
- Load agent identities (role, model, budget, persona) from Company YAML at runtime
- Inject agent persona as system prompt prefix automatically when agent executes LLM node
- Implement Paperclip-style heartbeat monitoring and lifecycle hooks (on_start, on_done, on_fail)
- Wire Redis checkpoint into LangGraph's checkpointer interface
- Implement streaming execution with per-node `StreamEvent` emission
- Implement conditional routing (IF/ELSE edges)
- Enforce per-agent token budget and monthly cost limits
- Implement retry with exponential backoff and dead-letter queue
- Expose Celery tasks for async dispatch from the API

---

## Checklist

### Phase 1: Agent Identity Model
- [ ] **Create `services/runtime/src/agentflow_runtime/identity.py`**:
  - [ ] `AgentIdentity` dataclass:
    ```python
    @dataclass
    class AgentIdentity:
        name: str
        role: str
        persona: str | None          # injected as system prompt prefix
        model_provider: str          # "anthropic", "openai", "google"
        model_id: str
        temperature: float = 0.7
        max_tokens: int = 4096
        budget_monthly_usd: float = 100.0
        capabilities: list[str] = field(default_factory=list)
        reports_to: str | None = None
        lifecycle: AgentLifecycleConfig | None = None

    @dataclass
    class AgentLifecycleConfig:
        on_start: str | None = None   # webhook URL
        on_done: str | None = None
        on_fail: str | None = None
        heartbeat_interval_seconds: int = 30
        heartbeat_timeout_seconds: int = 120
        on_timeout: str = "fail"      # "continue" | "fail" | "retry"

    @classmethod
    def from_company_spec(cls, agent_spec: dict) -> "AgentIdentity":
        """Parse AgentIdentity from Company.spec.agents[] entry."""
        ...
    ```

  - [ ] `CompanyContext` dataclass:
    ```python
    @dataclass
    class CompanyContext:
        name: str
        namespace: str
        agents: dict[str, AgentIdentity]   # keyed by agent name

    @classmethod
    def from_company_yaml(cls, company_dict: dict) -> "CompanyContext":
        """Build CompanyContext from parsed Company YAML dict."""
        agents = {
            a["name"]: AgentIdentity.from_company_spec(a)
            for a in company_dict.get("spec", {}).get("agents", [])
        }
        return cls(
            name=company_dict["metadata"]["name"],
            namespace=company_dict["metadata"].get("namespace", "default"),
            agents=agents,
        )

    def resolve_agent(self, agent_name: str) -> AgentIdentity:
        """Lookup agent by name; raise AgentNotFoundError if missing."""
        if agent_name not in self.agents:
            raise AgentNotFoundError(f"Agent '{agent_name}' not found in company '{self.name}'")
        return self.agents[agent_name]
    ```

### Phase 2: State Redesign with Agent Context
- [ ] **Update `services/runtime/src/agentflow_runtime/state.py`**:
  - [ ] Add to `PipelineState`:
    ```python
    company_name: str
    company_context: CompanyContext           # loaded from Company YAML
    current_agent_name: str | None            # which agent is currently executing
    node_executions: dict[str, NodeExecutionRecord]  # per-node metadata
    global_variables: dict[str, Any]          # from VariableAssigner nodes
    current_branch: str | None                # active branch in IF/ELSE
    iteration_index: int                      # current loop index
    iteration_results: list[Any]              # accumulated loop outputs
    streaming_channel: str | None             # Redis pub/sub key for SSE
    ```
  - [ ] Define `NodeExecutionRecord`:
    ```python
    @dataclass
    class NodeExecutionRecord:
        node_id: str
        node_type: str
        agent_name: str | None          # which agent ran this node
        status: str                     # "pending" | "running" | "completed" | "failed" | "skipped"
        started_at: datetime | None
        finished_at: datetime | None
        tokens_used: int = 0
        cost_usd: float = 0.0
        input_snapshot: dict | None = None
        output_snapshot: dict | None = None
        error: str | None = None
    ```

- [ ] **Update `AgentContext` in `pod.py`**:
  - [ ] Add `agent_identity: AgentIdentity` — the identity of the currently executing agent
  - [ ] Add `variable_resolver: VariableResolver` — resolves `{{#...#}}` refs
  - [ ] Add `node_id: str` — current node being executed
  - [ ] Add `company_context: CompanyContext` — full company for agent cross-references

### Phase 3: Variable Resolver
- [ ] **Create `services/runtime/src/agentflow_runtime/variables.py`**:
  - [ ] `VariableResolver` class:
    ```python
    class VariableResolver:
        def __init__(self, state: PipelineState):
            self._state = state

        def resolve(self, ref: dict | str | Any) -> Any:
            """
            Resolves:
            - VariableReference dict: { node_id, variable, path? }
            - String with {{#...#}} syntax (interpolates all refs)
            - Literal values: returned as-is
            """
            ...

        def resolve_all(self, obj: Any) -> Any:
            """Recursively resolves all variable references in any object."""
            ...

        def _lookup(self, node_id: str, variable: str, path: list[str]) -> Any:
            """Look up value in state.agent_outputs[node_id][variable] with path traversal."""
            output = self._state.agent_outputs.get(node_id, {})
            value = output.get(variable)
            for key in (path or []):
                if isinstance(value, dict):
                    value = value.get(key)
                else:
                    raise VariableResolutionError(f"Cannot traverse {key} on {type(value)}")
            return value
    ```

### Phase 4: Node Executor Base & Registry
- [ ] **Create `services/runtime/src/agentflow_runtime/nodes/base.py`**:
  ```python
  class NodeExecutor(ABC):
      @abstractmethod
      async def execute(
          self,
          node_config: dict,
          state: PipelineState,
          company_context: CompanyContext,
      ) -> NodeExecutionResult:
          ...

  @dataclass
  class NodeExecutionResult:
      output: dict
      tokens_used: int = 0
      cost_usd: float = 0.0
      error: str | None = None

      @property
      def success(self) -> bool:
          return self.error is None
  ```

- [ ] **Create `services/runtime/src/agentflow_runtime/nodes/__init__.py`**:
  - [ ] Registry: `NODE_EXECUTORS: dict[str, NodeExecutor]`
  - [ ] `get_node_executor(node_type: str) -> NodeExecutor` — raises `UnknownNodeTypeError` for unregistered types

### Phase 5: DAG Builder with Agent Resolution
- [ ] **Update `services/runtime/src/agentflow_runtime/dag.py`**:
  - [ ] New signature: `build_graph(pipeline: dict, company_context: CompanyContext) -> StateGraph`
  - [ ] For each node in `pipeline["spec"]["nodes"]`:
    - Get executor: `executor = get_node_executor(node["type"])`
    - For `agent_pod` nodes: validate agent_ref exists in company_context
    - Wrap in `_wrap_node_executor(node, executor, company_context)`
    - Add to StateGraph
  - [ ] Add regular edges from `pipeline["spec"]["edges"]`
  - [ ] Add conditional edges for `if_else` nodes using routing functions from `routing.py`
  - [ ] Handle iteration nodes via sub-graph wrapping

- [ ] **Create `services/runtime/src/agentflow_runtime/routing.py`**:
  - [ ] `evaluate_condition(condition: dict, state: PipelineState) -> bool`
  - [ ] `evaluate_condition_group(group: dict, state: PipelineState) -> str` — returns winning `branch_id`
  - [ ] `build_conditional_edge_fn(node_id: str, groups: list, default_branch: str) -> Callable`
  - [ ] Support all 12 operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`

### Phase 6: Paperclip-Style Heartbeat & Lifecycle
- [ ] **Create `services/runtime/src/agentflow_runtime/heartbeat.py`**:
  - [ ] `AgentHeartbeatMonitor` async context manager:
    ```python
    class AgentHeartbeatMonitor:
        def __init__(self, agent_name: str, config: AgentLifecycleConfig, run_id: str, redis_client):
            ...

        async def __aenter__(self):
            """Start background heartbeat reporting task."""
            self._task = asyncio.create_task(self._emit_heartbeats())
            return self

        async def __aexit__(self, exc_type, ...):
            """Cancel heartbeat task on exit."""
            self._task.cancel()

        async def _emit_heartbeats(self):
            """Periodically publish heartbeat to Redis pub/sub."""
            while True:
                await asyncio.sleep(self.config.heartbeat_interval_seconds)
                await self._redis.publish(
                    f"agentflow:heartbeat:{self.agent_name}",
                    json.dumps({
                        "agent_name": self.agent_name,
                        "run_id": self.run_id,
                        "status": "busy",
                        "timestamp": datetime.utcnow().isoformat(),
                    })
                )
    ```

- [ ] **Create `services/runtime/src/agentflow_runtime/lifecycle.py`**:
  - [ ] `call_lifecycle_hook(webhook_url: str, payload: dict) -> None`:
    - Fire-and-forget HTTP POST to webhook_url with payload
    - Timeout: 5 seconds
    - Log error but don't raise on failure

  - [ ] `execute_with_lifecycle(agent: AgentIdentity, run_id: str, coro: Awaitable) -> Any`:
    ```python
    async def execute_with_lifecycle(agent, run_id, coro, redis_client):
        await call_lifecycle_hook(agent.lifecycle.on_start, {"agent": agent.name, "run_id": run_id})
        try:
            async with AgentHeartbeatMonitor(agent.name, agent.lifecycle, run_id, redis_client):
                result = await coro
            await call_lifecycle_hook(agent.lifecycle.on_done, {"agent": agent.name, "result": str(result)})
            return result
        except Exception as e:
            await call_lifecycle_hook(agent.lifecycle.on_fail, {"agent": agent.name, "error": str(e)})
            raise
    ```

### Phase 7: Budget Enforcement
- [ ] **Create `services/runtime/src/agentflow_runtime/budget.py`**:
  - [ ] Cost table per model:
    ```python
    MODEL_COSTS: dict[str, float] = {
        "claude-opus-4-6":    0.000015,   # per token
        "claude-sonnet-4-6":  0.000003,
        "claude-haiku-4-5":   0.00000025,
        "gpt-4o":             0.000005,
        "gpt-4o-mini":        0.00000015,
    }
    ```
  - [ ] `estimate_cost(tokens: int, model_id: str) -> float`
  - [ ] `check_agent_budget(agent: AgentIdentity, cost_so_far: float, new_cost: float) -> None` — raises `BudgetExceededError` if `cost_so_far + new_cost > agent.budget_monthly_usd`
  - [ ] `check_pipeline_budget(state: PipelineState, new_cost: float) -> None` — raises if exceeds `policy.budget_usd`
  - [ ] Called before each node execution in `_wrap_node_executor`

### Phase 8: Redis Checkpoint Integration
- [ ] **Update `services/runtime/src/agentflow_runtime/checkpoint.py`**:
  - [ ] Implement `AgentFlowCheckpointer(BaseCheckpointSaver)`:
    - [ ] `get(config)` → Redis `HGET agentflow:checkpoint:{thread_id}:{checkpoint_ns}`
    - [ ] `put(config, checkpoint, metadata, new_versions)` → Redis `HSET` with 48h TTL
    - [ ] `list(config)` → Redis `KEYS agentflow:checkpoint:{thread_id}:*`

- [ ] **Update `executor.py`**:
  - [ ] `graph.compile(checkpointer=AgentFlowCheckpointer(redis_url))`
  - [ ] Pass `config={"configurable": {"thread_id": run_id}}`
  - [ ] `resume(run_id)` method — reinvokes graph from last checkpoint
  - [ ] `get_state(run_id)` — retrieves without executing

### Phase 9: Streaming Execution
- [ ] **Create `services/runtime/src/agentflow_runtime/streaming.py`**:
  - [ ] `StreamEvent` dataclass with types: `node_start`, `node_complete`, `node_error`, `agent_heartbeat`, `pipeline_complete`, `pipeline_error`
  - [ ] `StreamingExecutor.stream(run_id, pipeline, company_context, trigger_data) -> AsyncIterator[StreamEvent]`
    - Publishes events to Redis `agentflow:stream:{run_id}` pub/sub
    - Uses `graph.astream_events()` (LangGraph v2 events API)
  - [ ] `format_sse(event: StreamEvent) -> str` — SSE wire format `data: {json}\n\n`
  - [ ] Include `agent_name`, `agent_role`, `company_name` in every `StreamEvent` that has a node context

### Phase 10: Celery Worker Integration
- [ ] **Create `services/runtime/src/agentflow_runtime/tasks/pipeline_tasks.py`**:
  - [ ] `@celery_app.task(bind=True, max_retries=3) execute_pipeline(self, run_id, pipeline_yaml, company_yaml, trigger_data)`:
    - Parses both YAMLs
    - Builds `CompanyContext.from_company_yaml(company_dict)`
    - Calls `PipelineExecutor.run(pipeline, company_context, trigger_data)`
    - Reports status to `POST /api/internal/runs/{run_id}/events`
    - Retries with `countdown=2**self.request.retries` on failure
  - [ ] `execute_pipeline_streaming(run_id, pipeline_yaml, company_yaml, trigger_data)`:
    - Same but uses `StreamingExecutor` and publishes to Redis pub/sub

- [ ] **Create `services/runtime/src/agentflow_runtime/dead_letter.py`**:
  - [ ] `mark_as_dead_letter(run_id, error)` → Redis sorted set `agentflow:dead_letter`
  - [ ] `retry_dead_letter(run_id)` → requeues Celery task

### Phase 11: Tests
- [ ] **`services/runtime/tests/test_company_context.py`**:
  - [ ] `CompanyContext.from_company_yaml()` builds correct `AgentIdentity` objects
  - [ ] `resolve_agent("alice")` returns correct identity
  - [ ] `resolve_agent("unknown")` raises `AgentNotFoundError`

- [ ] **`services/runtime/tests/test_executor.py`**:
  - [ ] 3-node linear pipeline with mock company + mock LLM calls
  - [ ] Agent persona injected into LLM system prompt
  - [ ] Parallel execution: 2 AgentPod nodes with no dependency start simultaneously
  - [ ] IF/ELSE routing: `true` branch taken when condition met
  - [ ] `BudgetExceededError` raised when agent overspends
  - [ ] Checkpoint save → simulated crash → resume → pipeline completes

- [ ] **`services/runtime/tests/test_heartbeat.py`**:
  - [ ] `AgentHeartbeatMonitor` emits heartbeat events to Redis
  - [ ] Lifecycle `on_done` webhook called after successful execution (mock httpx)
  - [ ] Lifecycle `on_fail` webhook called after exception

- [ ] **`services/runtime/tests/test_streaming.py`**:
  - [ ] `node_start` then `node_complete` events emitted in order
  - [ ] `pipeline_complete` is final event
  - [ ] All events include `agent_name` and `agent_role` fields

---

## Acceptance Criteria
- `uv run pytest services/runtime/tests/ -v` all green
- Agent persona from Company YAML appears in LLM system prompt during execution
- Redis checkpoint saves/loads correctly for run resume
- IF/ELSE routing takes correct branch based on condition
- `BudgetExceededError` triggers before agent exceeds monthly limit
- Heartbeat events emitted to Redis every `interval_seconds`
- Celery task passes both `pipeline_yaml` and `company_yaml`

---

## Deliverable

Upon completion of Plan A2, you will have:

**1. Executable Multi-Agent Runtime**:
- `PipelineExecutor.run(pipeline, company_context, trigger_data)` — executes any pipeline DAG
- Agents loaded from Company YAML with role, model, persona, budget
- Agent persona auto-injected into LLM system prompts (no manual configuration needed)

**2. Paperclip-Style Agent Lifecycle**:
- `AgentHeartbeatMonitor` — agents emit heartbeats during execution
- `on_start`, `on_done`, `on_fail` webhook hooks fire at each lifecycle stage
- Budget enforcement with per-agent monthly limits

**3. Production-Grade Execution**:
- Redis checkpoint for pause/resume on failure
- Streaming `StreamEvent` objects with agent identity in each event
- Celery tasks for async dispatch from API
- Dead-letter queue for failed runs
- Retry with exponential backoff (3 attempts)

**4. Running Example**:
> Load `acme-company.yaml` + `feature-pipeline.yaml` → Alice (Lead Engineer) executes with `"You are a Lead Engineer at acme-corp. Senior Python engineer..."` system prompt → heartbeats emitted → on_done webhook fires → run cost deducted from Alice's budget.

---

## Routing

### This plan enables (must complete A2 before starting):
- **[Plan A3](plan-A3-api-layer.md)** — API needs Celery tasks and `StreamEvent` format from here
- **[Plan A4](plan-A4-node-implementations.md)** — Node implementations build on `NodeExecutor` base, `VariableResolver`, `CompanyContext`, `AgentIdentity`

### This plan depends on:
- **[Plan A0](plan-A0-company-agent-schema.md)** — requires `Company`, `AgentSpec`, `AgentLifecycle`, `HeartbeatConfig`
- **[Plan A1](plan-A1-schema-dsl.md)** — requires `Pipeline`, `NodeSchema`, `EdgeSchema`, `compileEdges()`, `VariableReference`
