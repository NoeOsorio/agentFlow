# Plan A4: Production Node Implementations

## Overview
Implement every node executor defined in Plan A1's schema. Key distinction from a generic workflow engine: `AgentPodNodeExecutor` resolves the agent by name from the Company YAML, auto-injects their role and persona into the LLM system prompt, and enforces their budget. Each node is fully tested with mocked external calls. Includes all Dify-equivalent node types plus AgentPod-specific nodes for the company simulation model.

## Tech Context
- **Primary package:** `services/runtime/src/agentflow_runtime/nodes/`
- **Base classes from Plan A2:** `NodeExecutor`, `NodeExecutionResult`, `CompanyContext`, `AgentIdentity`, `VariableResolver`
- **Tech:** LangChain Anthropic/OpenAI, httpx, Jinja2, sandboxed subprocess, Redis pub/sub, tenacity

---

## Goals
- Implement all 14 node types as `NodeExecutor` subclasses
- `AgentPodNodeExecutor` resolves agent from `CompanyContext`, injects persona automatically
- LLM node uses agent's model config when executed in agent context
- All nodes enforce resource limits (timeout, budget)
- All nodes handle errors gracefully, returning `NodeExecutionResult` with `error` field (not raising)
- All nodes tested with mocked external calls
- Register all executors in the node registry

---

## Checklist

### Phase 1: AgentPod Node (Core to the Company Model)
- [ ] **`services/runtime/src/agentflow_runtime/nodes/agent_pod_node.py`** — This is the most important node:
  ```python
  class AgentPodNodeExecutor(NodeExecutor):
      async def execute(self, node_config, state, company_context):
          # 1. Resolve agent from company
          agent_name = node_config["agent_ref"]["name"]
          agent = company_context.resolve_agent(agent_name)  # raises AgentNotFoundError if missing

          # 2. Build persona-injected system prompt
          persona_prefix = f"You are a {agent.role} at {company_context.name}."
          if agent.persona:
              persona_prefix += f" {agent.persona}"
          
          # 3. Resolve instruction variable references
          resolver = VariableResolver(state)
          instruction = resolver.resolve(node_config["instruction"])
          
          # 4. Build LLM client using agent's model config
          client = self._get_client(agent.model_provider, agent.model_id, agent.temperature)
          
          # 5. Execute with lifecycle hooks and heartbeat
          messages = [
              SystemMessage(content=persona_prefix),
              HumanMessage(content=instruction),
          ]
          
          async with execute_with_lifecycle(agent, state.run_id, ...):
              response = await client.ainvoke(messages, config={"max_tokens": agent.max_tokens})
          
          # 6. Track cost against agent budget
          tokens = response.usage_metadata.total_tokens
          cost = estimate_cost(tokens, agent.model_id)
          check_agent_budget(agent, state.agent_costs.get(agent_name, 0.0), cost)
          
          return NodeExecutionResult(
              output={
                  "response": response.content,
                  "agent_name": agent.name,
                  "agent_role": agent.role,
              },
              tokens_used=tokens,
              cost_usd=cost,
          )
  ```
  - [ ] Support `inputs` dict: merge resolved inputs into instruction context
  - [ ] Add retry on `RateLimitError` via `tenacity` (3 retries, exponential backoff)
  - [ ] Add `AgentNotFoundError` — returns `NodeExecutionResult(error=...)` instead of raising

- [ ] **`services/runtime/tests/nodes/test_agent_pod_node.py`**:
  - [ ] Agent resolved correctly from company context
  - [ ] System prompt contains `"{role} at {company_name}. {persona}"`
  - [ ] `AgentNotFoundError` returns error result (does not crash pipeline)
  - [ ] Budget enforcement: second call fails when agent budget exceeded
  - [ ] Agent's model config used (not a hardcoded default)
  - [ ] Variable references in `instruction` are resolved before sending to LLM

### Phase 2: LLM Node (Generic, Without Agent Identity)
- [ ] **`services/runtime/src/agentflow_runtime/nodes/llm_node.py`**:
  - [ ] `LLMNodeExecutor(NodeExecutor)`:
    - If `node_config.agent_ref` present: load agent from `company_context`, use agent's model + persona as base
    - Otherwise: use `node_config.model` config directly
    - Resolve `prompt.system` and `prompt.user` via `VariableResolver`
    - If `output_schema` defined: use `client.with_structured_output(json_schema)` for typed output
    - Returns `{ text, tokens_used, model_id }`
  - [ ] Support providers: `anthropic` → `ChatAnthropic`, `openai` → `ChatOpenAI`, `google` → `ChatGoogleGenerativeAI`
  - [ ] Retry on `RateLimitError` (3 attempts, 1s/2s/4s backoff)

- [ ] **`services/runtime/tests/nodes/test_llm_node.py`**:
  - [ ] Basic text generation with mocked `ChatAnthropic`
  - [ ] Structured output with JSON schema
  - [ ] Variable reference resolution in prompt
  - [ ] Agent context merges persona into system prompt

### Phase 3: Code Execution Node
- [ ] **`services/runtime/src/agentflow_runtime/nodes/code_node.py`**:
  - [ ] `CodeNodeExecutor`:
    - Resolve input variable references → `inputs: dict`
    - Write temp script that sets `inputs = {...}` then executes `node_config.code`
    - Run via `asyncio.create_subprocess_exec("python3", "-c", script, stdout=PIPE, stderr=PIPE)`
    - Apply timeout: `asyncio.wait_for(proc.communicate(), timeout=timeout_seconds)`
    - Parse last JSON line of stdout as `output`
    - Security: block `import os`, `import subprocess`, `import sys` (scan code string before exec)
    - Return error result on timeout or security violation (not exception)

- [ ] **`services/runtime/tests/nodes/test_code_node.py`**:
  - [ ] Simple Python: `output = {"result": inputs["x"] + inputs["y"]}`
  - [ ] Timeout enforcement (infinite loop script killed)
  - [ ] `import os` blocked
  - [ ] Variable injection from state

### Phase 4: HTTP Request Node
- [ ] **`services/runtime/src/agentflow_runtime/nodes/http_node.py`**:
  - [ ] `HTTPNodeExecutor`:
    - Resolve URL, headers, body via `VariableResolver`
    - `httpx.AsyncClient` with `timeout=node_config.timeout_ms/1000`
    - On `4xx/5xx`: return error result with `error="HTTP {status_code}: {body}"` (don't raise)
    - On `TimeoutException`: return error result
    - Returns `{ status_code, body, headers }`

- [ ] **`services/runtime/tests/nodes/test_http_node.py`**:
  - [ ] GET/POST with `respx` mocked HTTP
  - [ ] 500 response → error result, no exception
  - [ ] Timeout → error result

### Phase 5: Template Node (Jinja2)
- [ ] **`services/runtime/src/agentflow_runtime/nodes/template_node.py`**:
  - [ ] Pre-process: replace `{{#node_id.var#}}` with Jinja2 `{{ var }}`, build context dict
  - [ ] Render via `jinja2.Environment(undefined=StrictUndefined).from_string(template).render(**context)`
  - [ ] `UndefinedError` → error result with missing variable name

### Phase 6: Variable Assigner & Aggregator
- [ ] **`variable_assigner_node.py`**: Iterate assignments, set `state.global_variables[key] = resolved_value`
- [ ] **`variable_aggregator_node.py`**: Collect outputs from listed branches; strategies: `first`, `merge` (dict merge), `list` (array)
- [ ] Tests in `test_variable_nodes.py`

### Phase 7: IF/ELSE Branching Node
- [ ] **`services/runtime/src/agentflow_runtime/nodes/if_else_node.py`**:
  - [ ] Evaluates conditions using `routing.evaluate_condition_group()`
  - [ ] Sets `state.current_branch = winning_branch_id`
  - [ ] Returns `{ selected_branch: branch_id }`
  - [ ] All 12 operators: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`

- [ ] **`services/runtime/tests/nodes/test_if_else_node.py`**:
  - [ ] All 12 operators evaluated correctly
  - [ ] AND logic (all must pass), OR logic (any passes)
  - [ ] Default branch on no match

### Phase 8: Iteration Node
- [ ] **`services/runtime/src/agentflow_runtime/nodes/iteration_node.py`**:
  - [ ] Resolve `input_list` to get the array
  - [ ] For each item: create sub-state with `iterator_var = item`, run sub-graph
  - [ ] Accumulate results into `state.iteration_results`
  - [ ] Max 100 iterations guard (raises `IterationLimitError`)

### Phase 9: Human Input / Approval Node
- [ ] **`services/runtime/src/agentflow_runtime/nodes/human_input_node.py`**:
  - [ ] Publish to Redis `agentflow:human_input:{run_id}:{node_id}`
  - [ ] Subscribe to `agentflow:human_response:{run_id}:{node_id}` with timeout
  - [ ] On timeout: `fallback == "skip"` → empty output; `fallback == "fail"` → error result

### Phase 10: Knowledge Retrieval Node
- [ ] **`services/runtime/src/agentflow_runtime/nodes/knowledge_retrieval_node.py`**:
  - [ ] HTTP call to `settings.knowledge_base_url/api/retrieve`
  - [ ] Returns `{ chunks, sources }`
  - [ ] Graceful fallback if service not configured

### Phase 11: Sub-Workflow Node
- [ ] **`services/runtime/src/agentflow_runtime/nodes/sub_workflow_node.py`**:
  - [ ] Fetch sub-pipeline YAML from `GET /api/pipelines/{name}?namespace={ns}`
  - [ ] Fetch company YAML from `GET /api/companies/{company_id}`
  - [ ] Create nested `PipelineExecutor` with resolved inputs as `trigger_data`
  - [ ] Return sub-workflow's final `agent_outputs`

### Phase 12: Node Registry
- [ ] **Update `services/runtime/src/agentflow_runtime/nodes/__init__.py`**:
  - [ ] Register all 14 executors:
    ```python
    NODE_EXECUTORS = {
        "start": StartNodeExecutor(),
        "end": EndNodeExecutor(),
        "agent_pod": AgentPodNodeExecutor(),
        "llm": LLMNodeExecutor(),
        "code": CodeNodeExecutor(),
        "http": HTTPNodeExecutor(),
        "if_else": IfElseNodeExecutor(),
        "template": TemplateNodeExecutor(),
        "variable_assigner": VariableAssignerNodeExecutor(),
        "variable_aggregator": VariableAggregatorNodeExecutor(),
        "iteration": IterationNodeExecutor(),
        "human_input": HumanInputNodeExecutor(),
        "knowledge_retrieval": KnowledgeRetrievalNodeExecutor(),
        "sub_workflow": SubWorkflowNodeExecutor(),
    }
    ```

---

## Acceptance Criteria
- `uv run pytest services/runtime/tests/nodes/ -v` all green
- `AgentPodNodeExecutor` system prompt contains agent role and persona from Company YAML
- Agent resolution failure returns error result, pipeline continues if node is non-critical
- Code node blocks `import os` and kills timeout-exceeded processes
- HTTP node handles 5xx without raising exceptions
- IF/ELSE all 12 operators pass tests
- All 14 node types registered in `NODE_EXECUTORS`

---

## Deliverable

Upon completion of Plan A4, you will have:

**1. Complete Node Library** (`services/runtime/src/agentflow_runtime/nodes/`):
- 14 node executor files, all registered in `NODE_EXECUTORS`
- `AgentPodNodeExecutor` — the crown jewel: resolves company agent, injects persona, enforces budget
- All nodes tested with mocked external dependencies

**2. Working Agent Simulation**:
> Pipeline with `agent_pod` nodes referencing "alice" and "bob" from `acme-company.yaml` → Alice responds as "Lead Engineer at ACME Corp. Senior Python engineer..." → Bob responds as "CEO at ACME Corp. Strategic visionary..." → budget deducted from each agent

**3. Test Coverage**:
- 60+ unit tests across all node types
- Integration test: full pipeline with AgentPod + LLM + IF/ELSE + Code nodes end-to-end

---

## Routing

### This plan enables:
- End-to-end pipeline execution with all node types
- No other plans strictly depend on A4 (it's a leaf in the dependency graph)

### This plan depends on:
- **[Plan A0](plan-A0-company-agent-schema.md)** — `AgentSpec`, `AgentIdentity`, `CompanyContext` types
- **[Plan A1](plan-A1-schema-dsl.md)** — node type schemas: `AgentPodNode`, `LLMNode`, `CodeNode`, etc.
- **[Plan A2](plan-A2-runtime-engine.md)** — `NodeExecutor` base, `VariableResolver`, `BudgetEnforcer`, `execute_with_lifecycle`, heartbeat monitor
