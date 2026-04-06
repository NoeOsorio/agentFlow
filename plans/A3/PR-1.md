# A3-PR-1: Modelos de base de datos y migraciones Alembic

**Commit:** `feat(api/db): SQLAlchemy models + Alembic migrations (7 tables) [A3-PR-1]`
**Rama:** `feat/A3-PR-1-db-models-alembic`

---

## Qué resuelve

El esquema de datos. Todo lo demás de A3 depende de esto. No expone ningún endpoint — solo define la capa de persistencia.

## Archivos

| Acción | Archivo |
|--------|---------|
| Ampliar | `apps/api/src/agentflow_api/models.py` |
| Modificar | `apps/api/src/agentflow_api/main.py` |
| Crear | `apps/api/migrations/` (Alembic init) |
| Crear | `apps/api/entrypoint.sh` |
| Crear | `apps/api/Makefile` |

## Modelos SQLAlchemy (7 tablas)

### Nuevos (agregar a `models.py`)

```python
class Company(Base):
    __tablename__ = "companies"
    id: UUID (PK, default uuid4)
    name: str (unique within namespace)
    namespace: str (default "default")
    yaml_spec: str (Text — full Company YAML)
    description: str | None
    created_at: datetime
    updated_at: datetime
    # relationships: agents (cascade delete)

class Agent(Base):
    __tablename__ = "agents"
    id: UUID (PK)
    company_id: UUID (FK → companies.id, ON DELETE CASCADE)
    name: str (unique within company)
    role: str
    yaml_spec: str (Text)
    health_status: str  # "healthy" | "degraded" | "dead" | "unknown"
    last_heartbeat_at: datetime | None
    created_at: datetime
    # relationships: budgets (cascade delete)

class AgentBudget(Base):
    __tablename__ = "agent_budgets"
    id: UUID (PK)
    agent_id: UUID (FK → agents.id, ON DELETE CASCADE)
    month: date  # primer día del mes, e.g. 2026-04-01
    spent_usd: float (default 0.0)
    token_count: int (default 0)
    updated_at: datetime

class APIKey(Base):
    __tablename__ = "api_keys"
    id: UUID (PK)
    name: str
    key_hash: str (SHA-256 del plain key)
    scopes: str (comma-separated, e.g. "pipelines:write,runs:write")
    created_at: datetime
    last_used_at: datetime | None
    revoked: bool (default False)
```

### Modificar existentes

```python
class Pipeline(Base):
    # Agregar:
    company_id: UUID | None (FK → companies.id, nullable)
    webhook_secret: str | None
    version: int (default 1)  # optimistic locking

class Run(Base):
    # Agregar:
    started_at: datetime | None
    finished_at: datetime | None

class AgentExecution(Base):
    # Agregar:
    input_snapshot: dict | None (JSON column)
    output_snapshot: dict | None (JSON column)
```

## Alembic

```bash
# Comandos a ejecutar durante el PR:
cd apps/api
uv run alembic init migrations
# Configurar migrations/env.py con todos los modelos
uv run alembic revision --autogenerate -m "initial_schema"
```

### `entrypoint.sh`
```bash
#!/bin/bash
set -e
uv run alembic upgrade head
exec uv run uvicorn agentflow_api.main:app --host 0.0.0.0 --port 8000
```

### `Makefile`
```makefile
migrate:        uv run alembic upgrade head
migrate-new:    uv run alembic revision --autogenerate -m "$(name)"
migrate-down:   uv run alembic downgrade -1
migrate-status: uv run alembic current
```

### `main.py` — eliminar `create_all()`

```python
# ELIMINAR del lifespan:
async with engine.begin() as conn:
    await conn.run_sync(Base.metadata.create_all)  # ← REMOVER
```

## Dependencias

- **Depende de:** A0 (modelos `Pipeline`, `Run`, `AgentExecution` ya existen) ✅
- **Requerido por:** A3-PR-2, A3-PR-3, A3-PR-4 (todos los routers usan estos modelos)

## Tests

**`apps/api/tests/conftest.py`** (crear fixtures base)
- [ ] Fixture `db_session` — PostgreSQL de test con `alembic upgrade head`
- [ ] Fixture `app_client` — `httpx.AsyncClient` apuntando a la FastAPI app

**`apps/api/tests/test_migrations.py`**
- [ ] `alembic upgrade head` en DB vacía crea exactamente 7 tablas
- [ ] `alembic downgrade -1` + `upgrade head` es idempotente
- [ ] FK `Agent.company_id → companies.id` cascade delete funciona
- [ ] FK `AgentBudget.agent_id → agents.id` cascade delete funciona

## Definition of Done

- [ ] `uv run alembic upgrade head` en DB vacía crea las 7 tablas sin error
- [ ] `create_all()` eliminado de `main.py`
- [ ] `entrypoint.sh` es ejecutable (`chmod +x`)
- [ ] Los 4 modelos nuevos están en `models.py` — no en archivos separados
- [ ] No se tocan los routers existentes en este PR
