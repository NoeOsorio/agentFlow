# A4-PR-3: Nodos LLM, AgentPod, Iteration, HumanInput y registro final

**Commit:** `feat(nodes/llm): LLM, AgentPod, iteration, human-input + node registry [A4-PR-3]`
**Rama:** `feat/A4-PR-3-llm-nodes-registry`

---

## Qué resuelve

Los nodos de mayor valor y complejidad, más el cierre del registro completo de los 14 nodos. Con este PR el sistema puede ejecutar pipelines reales de producción.

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `services/runtime/src/agentflow_runtime/nodes/llm_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/agent_pod_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/iteration_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/human_input_node.py` |
| Completar | `services/runtime/src/agentflow_runtime/nodes/__init__.py` |

## Implementaciones

### `llm_node.py`

```python
class LLMNodeExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)

        # Si tiene agent_ref, usa el modelo y persona del agente
        if "agent_ref" in node_config:
            agent = company_context.resolve_agent(node_config["agent_ref"]["name"])
            model_config = {"provider": agent.model_provider, "model_id": agent.model_id,
                            "temperature": agent.temperature, "max_tokens": agent.max_tokens}
            persona_prefix = f"You are a {agent.role} at {company_context.name}."
            if agent.persona:
                persona_prefix += f" {agent.persona}"
        else:
            model_config = node_config["model"]
            persona_prefix = model_config.get("system_prompt", "")

        system_prompt = persona_prefix + "\n" + resolver.resolve(node_config["prompt"].get("system", ""))
        user_prompt = resolver.resolve(node_config["prompt"]["user"])

        client = _get_llm_client(model_config)

        # Structured output si se define output_schema
        if "output_schema" in node_config:
            client = client.with_structured_output(node_config["output_schema"])

        @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8),
               retry=retry_if_exception_type(RateLimitError))
        async def _invoke():
            return await client.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_prompt),
            ])

        response = await _invoke()
        tokens = getattr(response, "usage_metadata", {}).get("total_tokens", 0) if hasattr(response, "usage_metadata") else 0

        return NodeExecutionResult(
            output={"text": response.content if hasattr(response, "content") else response,
                    "tokens_used": tokens, "model_id": model_config["model_id"]},
            tokens_used=tokens,
            cost_usd=estimate_cost(tokens, model_config["model_id"]),
        )
```

### `agent_pod_node.py`

```python
class AgentPodNodeExecutor(NodeExecutor):
    """
    El nodo más importante. Resuelve agente desde CompanyContext,
    inyecta persona como system prompt, enforce budget.
    """
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        agent_name = node_config["agent_ref"]["name"]

        try:
            agent = company_context.resolve_agent(agent_name)
        except AgentNotFoundError as e:
            # NO crashea el pipeline — retorna error result
            return NodeExecutionResult(output={}, error=str(e))

        # System prompt: "{role} at {company}. {persona}"
        system_prompt = f"You are a {agent.role} at {company_context.name}."
        if agent.persona:
            system_prompt += f" {agent.persona}"

        resolver = VariableResolver(state)
        instruction = resolver.resolve(node_config["instruction"])

        # Merge de inputs opcionales al instruction context
        if "inputs" in node_config:
            extra = resolver.resolve_all(node_config["inputs"])
            instruction = f"{instruction}\n\nContext:\n{json.dumps(extra, indent=2)}"

        client = _get_llm_client({
            "provider": agent.model_provider,
            "model_id": agent.model_id,
            "temperature": agent.temperature,
        })

        @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8),
               retry=retry_if_exception_type(RateLimitError))
        async def _invoke():
            return await client.ainvoke([
                SystemMessage(content=system_prompt),
                HumanMessage(content=instruction),
            ])

        async with execute_with_lifecycle(agent, state.run_id, _invoke(), redis_client=None):
            response = await _invoke()

        tokens = response.usage_metadata.total_tokens if hasattr(response, "usage_metadata") else 0
        cost = estimate_cost(tokens, agent.model_id)

        # Budget enforcement
        agent_cost_so_far = sum(
            rec.cost_usd for rec in state.node_executions.values()
            if rec.agent_name == agent_name
        )
        check_agent_budget(agent, agent_cost_so_far, cost)

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

### `iteration_node.py`

```python
class IterationNodeExecutor(NodeExecutor):
    MAX_ITERATIONS = 100

    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)
        input_list = resolver.resolve(node_config["input_list"])

        if not isinstance(input_list, list):
            return NodeExecutionResult(output={}, error="input_list must be a list")
        if len(input_list) > self.MAX_ITERATIONS:
            return NodeExecutionResult(output={}, error=f"Iteration limit: max {self.MAX_ITERATIONS} items")

        results = []
        for i, item in enumerate(input_list):
            # Inyecta iterator_var en state para que body_nodes lo puedan leer
            state.global_variables[node_config["iterator_var"]] = item
            state.iteration_index = i
            results.append(item)  # sub-graph execution placeholder — A2-PR-3 lo amplía

        state.iteration_results = results
        return NodeExecutionResult(output={"results": results, "count": len(results)})
```

### `human_input_node.py`

```python
class HumanInputNodeExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        node_id = node_config["id"]
        timeout = node_config.get("timeout_seconds", 300)
        fallback = node_config.get("fallback", "skip")

        # Publica prompt para que el frontend lo muestre
        await redis_client.publish(
            f"agentflow:human_input:{state.run_id}:{node_id}",
            json.dumps({"prompt": node_config["prompt"], "run_id": state.run_id, "node_id": node_id}),
        )

        # Espera respuesta del humano con timeout
        try:
            response = await asyncio.wait_for(
                _wait_for_human_response(state.run_id, node_id),
                timeout=timeout,
            )
            return NodeExecutionResult(output={"response": response, "skipped": False})
        except asyncio.TimeoutError:
            if fallback == "skip":
                return NodeExecutionResult(output={"response": None, "skipped": True})
            else:
                return NodeExecutionResult(output={}, error=f"Human input timeout after {timeout}s")
```

### `nodes/__init__.py` (registro completo)

```python
from .start_end_node import StartNodeExecutor, EndNodeExecutor
from .template_node import TemplateNodeExecutor
from .variable_assigner_node import VariableAssignerNodeExecutor
from .variable_aggregator_node import VariableAggregatorNodeExecutor
from .if_else_node import IfElseNodeExecutor
from .http_node import HTTPNodeExecutor
from .code_node import CodeNodeExecutor
from .knowledge_retrieval_node import KnowledgeRetrievalNodeExecutor
from .sub_workflow_node import SubWorkflowNodeExecutor
from .llm_node import LLMNodeExecutor
from .agent_pod_node import AgentPodNodeExecutor
from .iteration_node import IterationNodeExecutor
from .human_input_node import HumanInputNodeExecutor

NODE_EXECUTORS: dict[str, NodeExecutor] = {
    "start":                StartNodeExecutor(),
    "end":                  EndNodeExecutor(),
    "template":             TemplateNodeExecutor(),
    "variable_assigner":    VariableAssignerNodeExecutor(),
    "variable_aggregator":  VariableAggregatorNodeExecutor(),
    "if_else":              IfElseNodeExecutor(),
    "http":                 HTTPNodeExecutor(),
    "code":                 CodeNodeExecutor(),
    "knowledge_retrieval":  KnowledgeRetrievalNodeExecutor(),
    "sub_workflow":         SubWorkflowNodeExecutor(),
    "llm":                  LLMNodeExecutor(),
    "agent_pod":            AgentPodNodeExecutor(),
    "iteration":            IterationNodeExecutor(),
    "human_input":          HumanInputNodeExecutor(),
}
```

## Dependencias

- **Depende de:** A2-PR-1, A2-PR-2, A4-PR-1, A4-PR-2
- **No requerido por nada** — PR de cierre de A4 (leaf del grafo)

## Tests

**`services/runtime/tests/nodes/test_agent_pod_node.py`**
- [ ] System prompt contiene `"You are a {role} at {company}. {persona}"` exactamente
- [ ] `AgentNotFoundError` → `NodeExecutionResult.error` (pipeline no crashea)
- [ ] Budget enforcement: segundo call excede budget → `BudgetExceededError`
- [ ] Variable references en `instruction` resueltas antes de enviar al LLM
- [ ] `RateLimitError` → retry 3 veces con backoff exponencial

**`services/runtime/tests/nodes/test_llm_node.py`**
- [ ] Generación básica con `ChatAnthropic` mockeado
- [ ] `output_schema` activa `with_structured_output`
- [ ] `agent_ref` presente → usa modelo + persona del agente
- [ ] Variable references en `prompt.user` resueltas

**`services/runtime/tests/nodes/test_iteration_node.py`**
- [ ] Lista de 5 items → 5 resultados
- [ ] Lista de 101 items → `NodeExecutionResult.error` (límite excedido)
- [ ] `iterator_var` disponible en `state.global_variables` durante iteración

**`services/runtime/tests/nodes/test_human_input_node.py`**
- [ ] Timeout con `fallback: "skip"` → `{ response: null, skipped: true }`
- [ ] Timeout con `fallback: "fail"` → `NodeExecutionResult.error`
- [ ] Respuesta recibida antes del timeout → output correcto

**`services/runtime/tests/test_registry.py`**
- [ ] `get_node_executor("agent_pod")` retorna `AgentPodNodeExecutor`
- [ ] `get_node_executor("unknown_type")` lanza `UnknownNodeTypeError`
- [ ] `NODE_EXECUTORS` contiene exactamente 14 entradas

## Definition of Done

- [ ] `uv run pytest services/runtime/tests/ -v` pasa (todos los tests de A4)
- [ ] `NODE_EXECUTORS` tiene exactamente 14 claves — sin duplicados
- [ ] `langchain-anthropic` y `langchain-openai` en `pyproject.toml`
- [ ] `tenacity` en `pyproject.toml` (para retry)
- [ ] `AgentPodNodeExecutor` nunca hace `raise` — siempre retorna `NodeExecutionResult`
