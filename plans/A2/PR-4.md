# A2-PR-4: Streaming y Celery worker

**Commit:** `feat(runtime/async): StreamEvent, streaming executor, Celery tasks [A2-PR-4]`
**Rama:** `feat/A2-PR-4-streaming-celery`

---

## Qué resuelve

La capa de despacho asíncrono y eventos en tiempo real. A3-PR-4 depende directamente de `execute_pipeline` (Celery task) y `StreamEvent` (formato SSE).

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `services/runtime/src/agentflow_runtime/streaming.py` |
| Crear | `services/runtime/src/agentflow_runtime/tasks/__init__.py` |
| Crear | `services/runtime/src/agentflow_runtime/tasks/pipeline_tasks.py` |
| Crear | `services/runtime/src/agentflow_runtime/dead_letter.py` |

## Símbolos nuevos

### `streaming.py`

```python
EventType = Literal[
    "node_start", "node_complete", "node_error",
    "agent_heartbeat", "pipeline_complete", "pipeline_error"
]

@dataclass
class StreamEvent:
    event: EventType
    run_id: str
    agent_name: str         # nombre del agente que ejecutó el nodo
    agent_role: str         # rol del agente (de CompanyContext)
    company_name: str       # nombre de la compañía
    data: dict
    timestamp: str          # ISO 8601

class StreamingExecutor:
    async def stream(
        self,
        run_id: str,
        pipeline: dict,
        company_context: CompanyContext,
        trigger_data: dict,
    ) -> AsyncIterator[StreamEvent]:
        """
        Wraps PipelineExecutor, usa graph.astream_events() (LangGraph v2 events API).
        Publica cada evento a Redis agentflow:stream:{run_id}.
        """
        ...

def format_sse(event: StreamEvent) -> str:
    """Serializa a wire format SSE: 'data: {json}\\n\\n'"""
    return f"data: {json.dumps(asdict(event))}\n\n"
```

### `tasks/pipeline_tasks.py`

```python
@celery_app.task(bind=True, max_retries=3)
def execute_pipeline(
    self,
    run_id: str,
    pipeline_yaml: str,
    company_yaml: str,
    trigger_data: dict,
) -> dict:
    """
    1. Parsea ambos YAMLs
    2. Construye CompanyContext.from_company_yaml(company_dict)
    3. Llama PipelineExecutor.run(pipeline, company_context, trigger_data)
    4. Reporta status a POST /api/internal/runs/{run_id}/complete
    5. Retry con countdown=2**self.request.retries on failure
    """
    ...

@celery_app.task(bind=True, max_retries=3)
def execute_pipeline_streaming(
    self,
    run_id: str,
    pipeline_yaml: str,
    company_yaml: str,
    trigger_data: dict,
) -> None:
    """Igual pero usa StreamingExecutor, publica eventos a Redis pub/sub."""
    ...
```

### `dead_letter.py`

```python
async def mark_as_dead_letter(run_id: str, error: str, redis_client) -> None:
    """Añade a Redis sorted set agentflow:dead_letter con score=timestamp."""
    ...

async def retry_dead_letter(run_id: str, redis_client) -> None:
    """Remueve de dead_letter, reencola Celery task."""
    ...
```

## Contrato con A3

A3-PR-4 consume este PR así:

```python
# En routers/runs.py
from agentflow_runtime.tasks.pipeline_tasks import execute_pipeline

# Despacho:
execute_pipeline.delay(
    run_id=str(run.id),
    pipeline_yaml=pipeline.yaml_spec,
    company_yaml=company.yaml_spec,
    trigger_data=inputs,
)

# Para SSE streaming:
from agentflow_runtime.streaming import StreamEvent, format_sse
```

## Dependencias

- **Depende de:** A2-PR-3 (`PipelineExecutor`, `CompanyContext`)
- **Requerido por:** A3-PR-4 (`POST /pipelines/{id}/execute`, WebSocket)

## Tests

**`services/runtime/tests/test_streaming.py`**
- [ ] Eventos emitidos en orden: `node_start` → `node_complete` → `pipeline_complete`
- [ ] Todos los eventos incluyen `agent_name` y `agent_role`
- [ ] `pipeline_error` emitido cuando un nodo falla
- [ ] `format_sse(event)` produce `"data: {...}\n\n"` con JSON válido

**`services/runtime/tests/test_tasks.py`**
- [ ] `execute_pipeline` parsea ambos YAMLs y llama `PipelineExecutor.run()`
- [ ] Task pasa `company_yaml` correctamente (no solo `pipeline_yaml`)
- [ ] Retry con backoff exponencial al fallar (`2**retry_count` segundos)

## Definition of Done

- [ ] `uv run pytest services/runtime/tests/ -v` pasa (todos los tests de A2)
- [ ] `StreamEvent` incluye `company_name` (A3 lo necesita para el WebSocket)
- [ ] `execute_pipeline` acepta exactamente 4 parámetros: `run_id`, `pipeline_yaml`, `company_yaml`, `trigger_data`
- [ ] `tasks/` directorio tiene `__init__.py`
