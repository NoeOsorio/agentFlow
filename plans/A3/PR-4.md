# A3-PR-4: Ejecución, webhooks, WebSocket y callbacks internos

**Commit:** `feat(api/execution): run control, webhooks, WebSocket, internal callbacks [A3-PR-4]`
**Rama:** `feat/A3-PR-4-execution-websocket`

---

## Qué resuelve

El plano de control en tiempo real. Es el PR que "enciende" el sistema — conecta el API con el runtime de A2. Sin este PR el sistema no ejecuta nada.

## Archivos

| Acción | Archivo |
|--------|---------|
| Ampliar | `apps/api/src/agentflow_api/routers/runs.py` |
| Ampliar | `apps/api/src/agentflow_api/routers/triggers.py` |
| Crear | `apps/api/src/agentflow_api/routers/ws.py` |
| Crear | `apps/api/src/agentflow_api/routers/internal.py` |
| Modificar | `apps/api/src/agentflow_api/main.py` |

## Endpoints nuevos/modificados

### `routers/runs.py` (ampliar)

| Endpoint | Descripción |
|----------|-------------|
| `POST /api/pipelines/{id}/execute` | Crea Run, despacha Celery. `response_mode: "streaming"\|"blocking"` |
| `POST /api/runs/{id}/pause` | Publica `"pause"` a `agentflow:control:{run_id}` |
| `POST /api/runs/{id}/resume` | Publica `"resume"` |
| `POST /api/runs/{id}/stop` | Publica `"stop"`, sets `Run.status = "cancelled"` |
| `GET /api/runs/{id}/nodes` | Lista `AgentExecution` con `agent_name`, `agent_role`, `cost_usd` |
| `GET /api/runs` | Lista con filtros `?pipeline_id=&company_id=&status=` |

**Lógica de `/execute`:**
```python
async def execute_pipeline_endpoint(pipeline_id, body, db, current_key):
    pipeline = await db.get(Pipeline, pipeline_id)
    company = await db.get(Company, pipeline.company_id)

    run = Run(pipeline_id=pipeline_id, status="pending", trigger_data=json.dumps(body.inputs))
    db.add(run)
    await db.commit()

    if body.response_mode == "streaming":
        # Despacha Celery streaming task
        execute_pipeline_streaming.delay(
            run_id=str(run.id),
            pipeline_yaml=pipeline.yaml_spec,
            company_yaml=company.yaml_spec,
            trigger_data=body.inputs,
        )
        # Retorna SSE stream desde Redis pub/sub agentflow:stream:{run_id}
        return StreamingResponse(redis_sse_stream(run.id), media_type="text/event-stream")

    else:
        # Blocking: espera resultado
        execute_pipeline.delay(...)
        return { "run_id": str(run.id), "status": "queued" }
```

### `routers/triggers.py` (ampliar)

| Endpoint | Descripción |
|----------|-------------|
| `POST /api/webhooks/{pipeline_id}/{source}` | `source`: `stripe`, `github`, `generic`. Verifica HMAC, crea Run, despacha Celery |
| `POST /api/pipelines/{id}/schedule` | Crea cron schedule (Celery Beat) |
| `DELETE /api/pipelines/{id}/schedule` | Elimina schedule |

**HMAC verification:**
```python
def verify_hmac(source: str, payload: bytes, signature: str, secret: str) -> bool:
    if source == "stripe":
        # X-Stripe-Signature con timestamp
        ...
    elif source == "github":
        # X-Hub-Signature-256: sha256=<hash>
        expected = "sha256=" + hmac.new(secret.encode(), payload, sha256).hexdigest()
        return hmac.compare_digest(expected, signature)
    else:
        # Generic: X-Signature header
        ...
```

### `routers/ws.py` (nuevo)

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/ws/runs/{run_id}` | WebSocket. Suscribe a `agentflow:stream:{run_id}`, forward `StreamEvent` JSON al cliente |
| `GET /api/ws/companies/{company_id}/agents` | WebSocket. Suscribe a `agentflow:heartbeat:*` para agentes de esta company. Emite `{ agent_name, status, last_heartbeat, current_run_id }` |

```python
@router.websocket("/ws/runs/{run_id}")
async def run_websocket(websocket: WebSocket, run_id: str):
    await websocket.accept()
    async with redis_client.subscribe(f"agentflow:stream:{run_id}") as channel:
        async for message in channel:
            await websocket.send_text(message.decode())
            if json.loads(message)["event"] in ("pipeline_complete", "pipeline_error"):
                break
    await websocket.close()
```

### `routers/internal.py` (nuevo)

| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `POST /api/internal/runs/{run_id}/events` | `X-Internal-Secret` | Upsert `AgentExecution`, actualiza `AgentBudget.spent_usd`, publica a Redis |
| `POST /api/internal/runs/{run_id}/complete` | `X-Internal-Secret` | Marca `Run.status = completed/failed`, sets `finished_at` |

**Body de `/events`:**
```json
{
  "node_id": "llm_1",
  "agent_name": "alice",
  "event_type": "node_complete",
  "status": "completed",
  "tokens_used": 1500,
  "cost_usd": 0.0045,
  "output_snapshot": { "text": "..." },
  "error": null,
  "timestamp": "2026-04-06T10:00:00Z"
}
```

## Dependencias

- **Depende de:** A3-PR-1, A3-PR-2, A3-PR-3 (pipeline + company YAMLs), A2-PR-4 (`execute_pipeline` Celery task, `StreamEvent`)
- **No requerido por nada más** — PR de cierre de A3

## Tests

**`apps/api/tests/test_pipeline_execute.py`**
- [ ] `POST /execute` con `response_mode: "blocking"` despacha Celery con `pipeline_yaml` Y `company_yaml`
- [ ] `POST /execute` sin `company_id` en pipeline retorna 422 (company requerida para ejecutar)
- [ ] `POST /runs/{id}/stop` → `Run.status = "cancelled"`

**`apps/api/tests/test_websocket.py`**
- [ ] WebSocket `/ws/runs/{run_id}` recibe eventos publicados a Redis
- [ ] Conexión se cierra automáticamente al recibir `pipeline_complete`
- [ ] WebSocket `/ws/companies/{id}/agents` recibe heartbeats de agentes de esa company

**`apps/api/tests/test_internal.py`**
- [ ] `POST /internal/runs/{id}/events` upsert `AgentExecution` row correctamente
- [ ] `AgentBudget.spent_usd` incrementa con `cost_usd` del evento
- [ ] Evento publicado a `agentflow:stream:{run_id}` tras recibir callback

## Definition of Done

- [ ] `uv run pytest apps/api/tests/ -v` pasa (todos los tests de A3)
- [ ] `execute_pipeline.delay()` pasa exactamente 4 args: `run_id`, `pipeline_yaml`, `company_yaml`, `trigger_data`
- [ ] HMAC verification usa `hmac.compare_digest` (timing-safe)
- [ ] `X-Internal-Secret` es una variable de entorno, no hardcoded
- [ ] Todos los nuevos routers registrados en `main.py`
