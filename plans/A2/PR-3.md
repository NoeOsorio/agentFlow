# A2-PR-3: Executor principal — DAG, lifecycle, heartbeat y checkpoint

**Commit:** `feat(runtime/executor): PipelineExecutor, heartbeat, lifecycle, checkpoint [A2-PR-3]`
**Rama:** `feat/A2-PR-3-pipeline-executor`

---

## Qué resuelve

El motor de ejecución end-to-end. Es el PR más denso de A2. Reemplaza los prototipos de A0 (`dag.py`, `executor.py`, `checkpoint.py`) con implementaciones de producción.

## Archivos

| Acción | Archivo |
|--------|---------|
| **Reemplazar** | `services/runtime/src/agentflow_runtime/dag.py` |
| **Reemplazar** | `services/runtime/src/agentflow_runtime/executor.py` |
| **Reemplazar** | `services/runtime/src/agentflow_runtime/checkpoint.py` |
| Crear | `services/runtime/src/agentflow_runtime/lifecycle.py` |
| Crear | `services/runtime/src/agentflow_runtime/heartbeat.py` |
| Crear | `services/runtime/src/agentflow_runtime/routing.py` |

> ⚠️ Los archivos existentes `dag.py`, `executor.py`, `checkpoint.py` son prototipos de A0. Este PR los reemplaza completamente.

## Símbolos nuevos

### `routing.py`

```python
def evaluate_condition(condition: dict, state: PipelineState) -> bool: ...
def evaluate_condition_group(group: dict, state: PipelineState) -> str:
    """Retorna el branch_id ganador."""
    ...
def build_conditional_edge_fn(
    node_id: str,
    groups: list,
    default_branch: str,
) -> Callable[[PipelineState], str]: ...
```

Soporta los 12 operadores: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`.

### `heartbeat.py`

```python
class AgentHeartbeatMonitor:
    """Async context manager que emite heartbeats a Redis durante la ejecución."""

    def __init__(self, agent_name, config: AgentLifecycleConfig, run_id, redis_client): ...

    async def __aenter__(self): ...   # inicia background task
    async def __aexit__(self, ...):   # cancela background task

    async def _emit_heartbeats(self):
        """Publica a agentflow:heartbeat:{agent_name} cada interval_seconds."""
        ...
```

### `lifecycle.py`

```python
async def call_lifecycle_hook(webhook_url: str, payload: dict) -> None:
    """Fire-and-forget HTTP POST, timeout 5s, log error sin raise."""
    ...

async def execute_with_lifecycle(
    agent: AgentIdentity,
    run_id: str,
    coro: Awaitable,
    redis_client,
) -> Any:
    """Wraps coroutine con on_start/on_done/on_fail hooks y heartbeat monitor."""
    ...
```

### `checkpoint.py` (reemplazar)

```python
class AgentFlowCheckpointer(BaseCheckpointSaver):
    """LangGraph-compatible Redis checkpointer."""

    def get(self, config) -> Checkpoint | None: ...     # HGET agentflow:checkpoint:{thread_id}
    def put(self, config, checkpoint, metadata, new_versions): ...  # HSET + 48h TTL
    def list(self, config) -> Iterator[CheckpointTuple]: ...       # KEYS pattern
```

### `dag.py` (reemplazar)

```python
def build_graph(pipeline: dict, company_context: CompanyContext) -> StateGraph:
    """
    Nueva firma. Itera pipeline["spec"]["nodes"], obtiene executor por tipo,
    añade edges regulares y condicionales (if_else).
    """
    ...
```

### `executor.py` (reemplazar)

```python
class PipelineExecutor:
    def __init__(self, pipeline: dict, company_context: CompanyContext, redis_url: str): ...

    async def run(
        self,
        run_id: str | None = None,
        trigger_data: dict | None = None,
    ) -> PipelineState: ...

    async def resume(self, run_id: str) -> PipelineState:
        """Reanuda desde el último checkpoint en Redis."""
        ...

    async def get_state(self, run_id: str) -> PipelineState | None:
        """Obtiene estado sin ejecutar."""
        ...
```

## Dependencias

- **Depende de:** A2-PR-1 (`AgentIdentity`, `CompanyContext`), A2-PR-2 (`NodeExecutor`, `VariableResolver`, `budget`)
- **Requerido por:** A2-PR-4 (`StreamingExecutor` envuelve `PipelineExecutor`), A3-PR-4 (`POST /execute`), A4 (`SubWorkflowNodeExecutor` crea `PipelineExecutor` anidado)

## Tests

**`services/runtime/tests/test_executor.py`**
- [ ] Pipeline lineal de 3 nodos con LLM mockeado (mock `NodeExecutor`) completa con estado correcto
- [ ] Ejecución paralela: 2 `AgentPod` sin dependencia entre sí — ambos se inician en el mismo "tick"
- [ ] IF/ELSE: rama `true` tomada cuando condición `eq` se cumple
- [ ] `BudgetExceededError` lanzado antes de que agente exceda budget
- [ ] Checkpoint save → simulated crash (exception después de nodo 2) → `resume(run_id)` → completa nodo 3

**`services/runtime/tests/test_heartbeat.py`**
- [ ] `AgentHeartbeatMonitor` emite al menos 1 heartbeat a Redis mock durante ejecución
- [ ] `on_done` webhook llamado tras ejecución exitosa (mock httpx)
- [ ] `on_fail` webhook llamado tras excepción

## Definition of Done

- [ ] `uv run pytest services/runtime/tests/ -v` pasa (incluyendo tests previos de A2-PR-1/2)
- [ ] `AgentFlowCheckpointer` implementa `BaseCheckpointSaver` de LangGraph
- [ ] `build_graph` acepta `company_context` (nueva firma — breaking change del prototipo A0)
- [ ] `checkpoint.py` antiguo completamente reemplazado (no hay `RedisCheckpointStore`)
