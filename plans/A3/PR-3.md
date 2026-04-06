# A3-PR-3: CRUD de Pipeline y endpoint `/api/apply`

**Commit:** `feat(api/pipelines): Pipeline CRUD + /api/apply multi-document [A3-PR-3]`
**Rama:** `feat/A3-PR-3-pipeline-apply`

---

## Qué resuelve

La ingesta de recursos de tipo Pipeline y el apply multi-documento (análogo a `kubectl apply -f`). Es el punto de entrada principal del sistema para el frontend y el CLI.

## Archivos

| Acción | Archivo |
|--------|---------|
| Ampliar | `apps/api/src/agentflow_api/routers/pipelines.py` |
| Crear | `apps/api/src/agentflow_api/routers/resources.py` |
| Modificar | `apps/api/src/agentflow_api/main.py` |

## Endpoints nuevos/modificados

### `routers/pipelines.py` (ampliar)

| Endpoint | Descripción |
|----------|-------------|
| `POST /api/pipelines/` | Crea pipeline. Valida `kind: Pipeline`, resuelve `company_ref` → FK, valida que todos los `agent_ref` existan en la company |
| `GET /api/pipelines/` | Lista con filtros `?company_id=&namespace=` |
| `GET /api/pipelines/{id}` | Fetch con `company_id` populado |
| `PUT /api/pipelines/{id}` | Full update YAML — re-valida, re-verifica agent_refs |
| `DELETE /api/pipelines/{id}` | Soft delete |
| `GET /api/pipelines/{id}/validate` | Valida YAML + agent_refs sin persistir. Retorna `{ valid: bool, errors: [...] }` |
| `GET /api/pipelines/{id}/compiled` | Llama `compileEdges()` y retorna el adjacency map `CompiledGraph` |

**Lógica de validación de `company_ref`:**
```python
if spec.company_ref:
    company = await db.get_company_by_name(spec.company_ref.name, spec.company_ref.namespace)
    if not company:
        raise HTTPException(422, f"Company '{spec.company_ref.name}' not found")
    for node in spec.nodes:
        if node.type == "agent_pod":
            agent_name = node.agent_ref.name
            if not await db.agent_exists_in_company(agent_name, company.id):
                raise HTTPException(422, f"Agent '{agent_name}' not found in company")
```

### `routers/resources.py` (nuevo)

#### `POST /api/apply`
- Content-Type: `text/yaml`
- Acepta YAML multi-documento (separado por `---`)
- Para cada documento:
  - `kind: Company` → crea/actualiza Company (upsert por `metadata.name + namespace`)
  - `kind: Pipeline` → crea/actualiza Pipeline
  - `kind` desconocido → error en ese documento, continúa con los demás

```json
// Response:
{
  "applied": [
    { "kind": "Company", "name": "acme-corp", "action": "created" },
    { "kind": "Pipeline", "name": "ship-feature", "action": "updated" }
  ],
  "errors": [
    { "kind": "Unknown", "name": null, "error": "Unknown resource kind: Deployment" }
  ]
}
```

#### `GET /api/resources`
- Query params: `?kind=Company&namespace=default`
- Lista recursos de un kind y namespace específicos

## Dependencias

- **Depende de:** A3-PR-1 (modelos), A3-PR-2 (company lookup, `get_current_key` dependency)
- **Requerido por:** A3-PR-4 (`POST /execute` necesita el `company_yaml` de la pipeline)

## Tests

**`apps/api/tests/test_apply.py`**
- [ ] `POST /api/apply` con YAML multi-documento (`---`) crea Company + Pipeline en una sola request
- [ ] `POST /api/apply` es idempotente: segunda aplicación del mismo YAML retorna `action: "updated"`
- [ ] `agent_ref` inexistente en `company_ref` → `422` con mensaje descriptivo
- [ ] `company_ref` inexistente → `422`
- [ ] Documento con `kind` desconocido → error en `errors[]` pero el resto se aplica

**`apps/api/tests/test_pipelines.py`**
- [ ] `GET /api/pipelines/{id}/compiled` retorna `CompiledGraph` con `entryPoints` y `exitPoints`
- [ ] `GET /api/pipelines/{id}/validate` con YAML inválido retorna `{ valid: false, errors: [...] }`
- [ ] Pipeline sin `company_ref` se crea sin FK (company_id = null)

## Definition of Done

- [ ] `uv run pytest apps/api/tests/test_apply.py apps/api/tests/test_pipelines.py -v` pasa
- [ ] `POST /api/apply` usa `parseMultiDocument` de `@agentflow/core` (o equivalente Python)
- [ ] `GET /compiled` llama `compileEdges()` del core TS via subprocess o endpoint interno
- [ ] Router `resources` registrado en `main.py`
