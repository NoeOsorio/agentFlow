# A3-PR-2: Autenticación y CRUD de Company + Agent

**Commit:** `feat(api/resources): auth, Company CRUD, Agent CRUD, heartbeat endpoint [A3-PR-2]`
**Rama:** `feat/A3-PR-2-company-agent-crud`

---

## Qué resuelve

La capa de recursos principales — análogo a `kubectl apply` para Company. Establece la autenticación API key que protege todos los endpoints subsecuentes.

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `apps/api/src/agentflow_api/auth.py` |
| Crear | `apps/api/src/agentflow_api/routers/api_keys.py` |
| Crear | `apps/api/src/agentflow_api/routers/companies.py` |
| Crear | `apps/api/src/agentflow_api/routers/agents.py` |
| Modificar | `apps/api/src/agentflow_api/main.py` |

## Símbolos nuevos

### `auth.py`

```python
def generate_api_key() -> tuple[str, str]:
    """Retorna (plain_key, sha256_hash). plain_key solo se muestra una vez."""
    ...

async def verify_api_key(plain_key: str, db: AsyncSession) -> APIKey | None: ...

async def get_current_key(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> APIKey:
    """FastAPI dependency. Lee Authorization: Bearer <key>. HTTP 401 si falta o inválida."""
    ...

# Scopes disponibles:
SCOPES = ["companies:read", "companies:write", "pipelines:read", "pipelines:write", "runs:write", "admin"]
```

### `routers/api_keys.py`

| Endpoint | Descripción |
|----------|-------------|
| `POST /api/keys` | Crea key. Retorna plain key **una sola vez** |
| `GET /api/keys` | Lista keys (hashed, nunca plain) |
| `DELETE /api/keys/{key_id}` | Revoca key |

### `routers/companies.py`

| Endpoint | Descripción |
|----------|-------------|
| `POST /api/companies/` | Crea desde YAML. Valida `kind: Company`, upsert Company + Agent rows |
| `GET /api/companies/` | Lista con filtro `?namespace=` |
| `GET /api/companies/{id}` | Fetch con agents y último budget |
| `PUT /api/companies/{id}` | Full update YAML — re-valida, re-sincroniza agents |
| `DELETE /api/companies/{id}` | Cascade delete agents + budgets |
| `GET /api/companies/{id}/org-structure` | Árbol org (hierarchy de `reports_to`) |
| `GET /api/companies/{id}/budget` | `{ company_name, agents: [{ name, spent_usd, budget_usd, remaining_usd }] }` |

**Sincronización de agents en update:**
- Agentes en nuevo YAML que no existen → INSERT
- Agentes que existen → UPDATE `role`, `yaml_spec`
- Agentes que ya no están en el nuevo YAML → DELETE (cascade budget)

### `routers/agents.py`

| Endpoint | Descripción |
|----------|-------------|
| `GET /api/companies/{company_id}/agents` | Lista agentes |
| `GET /api/companies/{company_id}/agents/{name}` | Detalle + budget del mes actual |
| `GET /api/companies/{company_id}/agents/{name}/budget` | `{ spent_usd, budget_monthly_usd, remaining_usd, pct_used }` |
| `GET /api/agents/{name}/status` | Health status + último heartbeat |
| `POST /api/internal/agents/{name}/heartbeat` | Auth: `X-Internal-Secret`. Actualiza `last_heartbeat_at`, publica a Redis |

**Celery Beat task:** `mark_stale_agents_unhealthy()` — cada 60s, cualquier agente con `last_heartbeat_at` > `heartbeat_timeout_seconds` → `health_status = "dead"`.

## Dependencias

- **Depende de:** A3-PR-1 (modelos `Company`, `Agent`, `AgentBudget`, `APIKey`)
- **Requerido por:** A3-PR-3 (`Pipeline.company_ref` valida contra `companies` table)

## Tests

**`apps/api/tests/test_companies.py`**
- [ ] `POST /api/companies/` crea Company + sus agents correctamente
- [ ] `PUT /api/companies/{id}` sincroniza agents: nuevo agent añadido, eliminado removido
- [ ] `GET /api/companies/{id}/org-structure` retorna jerarquía correcta
- [ ] `DELETE /api/companies/{id}` elimina agents en cascade

**`apps/api/tests/test_heartbeat.py`**
- [ ] `POST /api/internal/agents/{name}/heartbeat` actualiza `last_heartbeat_at`
- [ ] Agente marcado `"dead"` tras `heartbeat_timeout_seconds` sin heartbeat
- [ ] `GET /api/agents/{name}/status` refleja estado correcto

**`apps/api/tests/test_auth.py`**
- [ ] `POST /api/keys` retorna plain key una sola vez
- [ ] Request sin `Authorization` header → 401
- [ ] Request con key revocada → 401
- [ ] `GET /api/keys` nunca incluye plain key

## Definition of Done

- [ ] `uv run pytest apps/api/tests/test_companies.py apps/api/tests/test_auth.py -v` pasa
- [ ] Heartbeat endpoint usa `X-Internal-Secret` (no API key pública)
- [ ] `generate_api_key()` usa `secrets.token_urlsafe(32)` + SHA-256
- [ ] Routers registrados en `main.py`
