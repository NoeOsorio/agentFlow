# Plan A3: API Layer

## Overview
Build a production-grade REST API that treats `Company`, `Agent`, and `Pipeline` as first-class Kubernetes-style resources — each with full CRUD via YAML. Adds API key auth, heartbeat endpoints (Paperclip-style), WebSocket streaming, webhook triggers with HMAC verification, Alembic migrations, and run controls (pause/resume/stop). The API is the control plane: it persists resources, dispatches execution via Celery, and serves real-time events.

## Tech Context
- **Primary package:** `apps/api/`
- **Key files:**
  - `apps/api/src/agentflow_api/main.py`
  - `apps/api/src/agentflow_api/models.py`
  - `apps/api/src/agentflow_api/routers/`
- **Tech:** FastAPI 0.115, SQLAlchemy 2.0 async, asyncpg, Alembic 1.14, Celery 5.4, Redis 5.2, Pydantic 2.10

---

## Goals
- Company and Agent CRUD: persist as `yaml_spec` + extracted metadata
- Pipeline CRUD with `company_id` foreign key
- API key authentication on all protected routes
- YAML validation routing by `kind:` field (Company, Agent, Pipeline)
- Heartbeat endpoint: agents report liveness, API tracks health status
- WebSocket for real-time run events (node-level streaming with agent identity)
- SSE streaming endpoint for pipeline execution
- Webhook triggers with Stripe/GitHub HMAC verification
- Alembic migrations (replace `create_all`)
- Run pause/resume/stop controls
- Budget tracking endpoints: current monthly spend per agent

---

## Checklist

### Phase 0: Expanded Data Models
- [ ] **Update `apps/api/src/agentflow_api/models.py`** — add new tables:
  - [ ] `Company` model:
    ```python
    class Company(Base):
        __tablename__ = "companies"
        id: UUID (primary key)
        name: str (unique within namespace)
        namespace: str (default "default")
        yaml_spec: str  # full Company YAML
        description: str | None
        created_at: datetime
        updated_at: datetime
    ```
  - [ ] `Agent` model:
    ```python
    class Agent(Base):
        __tablename__ = "agents"
        id: UUID (primary key)
        company_id: UUID (FK → companies.id, cascade delete)
        name: str (unique within company)
        role: str
        yaml_spec: str  # full AgentSpec YAML
        health_status: str  # "healthy" | "degraded" | "dead" | "unknown"
        last_heartbeat_at: datetime | None
        created_at: datetime
    ```
  - [ ] `AgentBudget` model:
    ```python
    class AgentBudget(Base):
        __tablename__ = "agent_budgets"
        id: UUID (primary key)
        agent_id: UUID (FK → agents.id, cascade delete)
        month: date  # first day of month (e.g., 2026-04-01)
        spent_usd: float (default 0.0)
        token_count: int (default 0)
        updated_at: datetime
    ```
  - [ ] Update `Pipeline` model:
    ```python
    class Pipeline(Base):
        company_id: UUID | None  # FK → companies.id (nullable for standalone pipelines)
        webhook_secret: str | None
        version: int  # optimistic locking
    ```
  - [ ] Update `Run` model: add `started_at`, `finished_at`
  - [ ] Update `AgentExecution` model: add `input_snapshot: JSON`, `output_snapshot: JSON`, `agent_name: str | None`
  - [ ] Add `APIKey` model (from original plan)

### Phase 1: Authentication & API Keys
- [ ] **Create `apps/api/src/agentflow_api/auth.py`**:
  - [ ] `generate_api_key() -> tuple[str, str]` — `(plain_key, sha256_hash)`
  - [ ] `verify_api_key(plain_key, db) -> APIKey | None`
  - [ ] `get_current_key(request, db) -> APIKey` — FastAPI dependency, reads `Authorization: Bearer <key>`, `HTTP 401` if missing
  - [ ] Scopes: `"companies:read"`, `"companies:write"`, `"pipelines:read"`, `"pipelines:write"`, `"runs:write"`, `"admin"`

- [ ] **Create `apps/api/src/agentflow_api/routers/api_keys.py`**:
  - [ ] `POST /api/keys` — create key (returns plain key once only)
  - [ ] `GET /api/keys` — list keys (hashed, never plain)
  - [ ] `DELETE /api/keys/{key_id}` — revoke

### Phase 2: Company & Agent CRUD
- [ ] **Create `apps/api/src/agentflow_api/routers/companies.py`**:
  - [ ] `POST /api/companies/` — create from YAML:
    - Validate YAML has `kind: Company`
    - Parse with `validateResource(yaml_spec)` → validate against `CompanySchema`
    - Extract `name`, `namespace`, `description` from metadata/spec
    - Upsert `Company` row + `Agent` rows for each agent in `spec.agents`
    - Return `{ id, name, namespace, agents: [...] }`
  - [ ] `GET /api/companies/` — list (with `namespace` filter)
  - [ ] `GET /api/companies/{id}` — fetch with agents and latest budget
  - [ ] `PUT /api/companies/{id}` — full YAML update (re-validates, re-syncs agents)
  - [ ] `DELETE /api/companies/{id}` — cascade deletes agents, budget records
  - [ ] `GET /api/companies/{id}/org-structure` — returns org tree (uses `getOrgTree()`)

- [ ] **Create `apps/api/src/agentflow_api/routers/agents.py`**:
  - [ ] `GET /api/companies/{company_id}/agents` — list agents
  - [ ] `GET /api/companies/{company_id}/agents/{agent_name}` — get agent detail + budget
  - [ ] `GET /api/companies/{company_id}/agents/{agent_name}/budget` — current month spend:
    - Returns `{ agent_name, month, spent_usd, budget_monthly_usd, remaining_usd, pct_used }`
  - [ ] `GET /api/companies/{company_id}/agents/{agent_name}/runs` — runs this agent participated in

### Phase 3: Heartbeat Endpoints (Paperclip-Style)
- [ ] **Add to `apps/api/src/agentflow_api/routers/agents.py`**:
  - [ ] `POST /api/internal/agents/{agent_name}/heartbeat` — runtime reports agent alive:
    - Auth: `X-Internal-Secret` header
    - Body: `{ company_name, run_id, status: "idle"|"busy", current_node_id?, timestamp }`
    - Updates `Agent.last_heartbeat_at`, `Agent.health_status = "healthy"`
    - Publishes `agentflow:heartbeat:{agent_name}` to Redis pub/sub
  - [ ] Background task: `mark_stale_agents_unhealthy()`:
    - Runs every 60s via Celery Beat
    - Any agent with `last_heartbeat_at > heartbeat_timeout_seconds ago` → set `health_status = "dead"`
  - [ ] `GET /api/agents/{agent_name}/status` — returns health status + last heartbeat

### Phase 4: Pipeline CRUD with Company Reference
- [ ] **Update `apps/api/src/agentflow_api/routers/pipelines.py`**:
  - [ ] `POST /api/pipelines/` — create:
    - Validate YAML has `kind: Pipeline`
    - Validate against `PipelineSchema`
    - If `spec.company_ref` present: look up `Company` by name/namespace, set `company_id` FK
    - Validate all `agent_ref` names exist in the referenced company
    - Return `{ id, name, company_id, ... }`
  - [ ] `GET /api/pipelines/?company_id=<id>` — filter by company
  - [ ] `PUT /api/pipelines/{id}` — full update with re-validation
  - [ ] `GET /api/pipelines/{id}/validate` — validates YAML + agent refs without saving
  - [ ] `GET /api/pipelines/{id}/compiled` — returns `compileEdges()` adjacency map

### Phase 5: YAML Multi-Resource Upload
- [ ] **Create `apps/api/src/agentflow_api/routers/resources.py`**:
  - [ ] `POST /api/apply` — apply multi-document YAML (like `kubectl apply`):
    - Body: raw YAML text (Content-Type: text/yaml)
    - Splits by `---`, validates each document's `kind`
    - Dispatches each document to correct handler (Company → create/update, Pipeline → create/update)
    - Returns `{ applied: [{ kind, name, action: "created"|"updated" }], errors: [...] }`
  - [ ] `GET /api/resources?kind=Company&namespace=default` — list resources by kind

### Phase 6: Run Control Endpoints
- [ ] **Update `apps/api/src/agentflow_api/routers/runs.py`**:
  - [ ] `POST /api/pipelines/{id}/execute` — trigger run:
    - Body: `{ response_mode: "streaming"|"blocking", inputs: Record<string, any> }`
    - Fetches pipeline + company YAML
    - Creates `Run` record
    - Dispatches `execute_pipeline.delay(run_id, pipeline_yaml, company_yaml, trigger_data)`
    - For streaming: returns SSE stream from Redis pub/sub `agentflow:stream:{run_id}`
  - [ ] `POST /api/runs/{id}/pause` — publishes `pause` to `agentflow:control:{run_id}`
  - [ ] `POST /api/runs/{id}/resume` — publishes `resume`
  - [ ] `POST /api/runs/{id}/stop` — publishes `stop`, sets `Run.status = "cancelled"`
  - [ ] `GET /api/runs/{id}/nodes` — list `AgentExecution` records with agent_name, role
  - [ ] `GET /api/runs?pipeline_id=&company_id=` — filtered run list

### Phase 7: Webhook Triggers
- [ ] **Update `apps/api/src/agentflow_api/routers/triggers.py`**:
  - [ ] `POST /api/webhooks/{pipeline_id}/{source}` (source: `stripe`, `github`, `generic`):
    - Verify HMAC signature per source
    - Create Run, dispatch Celery task with `pipeline_yaml` + `company_yaml`
    - Return `{ run_id, status: "queued" }`
  - [ ] `POST /api/pipelines/{id}/schedule` — create cron schedule
  - [ ] `DELETE /api/pipelines/{id}/schedule` — remove schedule

### Phase 8: WebSocket for Real-Time Events
- [ ] **Create `apps/api/src/agentflow_api/routers/ws.py`**:
  - [ ] `GET /api/ws/runs/{run_id}` — WebSocket:
    - Subscribe to `agentflow:stream:{run_id}` Redis pub/sub
    - Forward `StreamEvent` JSON to WebSocket client
    - Events include: `node_id`, `node_type`, `agent_name`, `agent_role`, `company_name`
  - [ ] `GET /api/ws/companies/{company_id}/agents` — WebSocket for company-wide agent status:
    - Subscribes to `agentflow:heartbeat:*` for agents in this company
    - Emits `{ agent_name, status, last_heartbeat, current_run_id }`

### Phase 9: Internal Runtime Callback Endpoint
- [ ] **Create `apps/api/src/agentflow_api/routers/internal.py`**:
  - [ ] `POST /api/internal/runs/{run_id}/events` — runtime reports node completion:
    - Auth: `X-Internal-Secret` header
    - Body: `{ node_id, agent_name, event_type, status, tokens_used, cost_usd, output_snapshot, error, timestamp }`
    - Upserts `AgentExecution` row
    - Updates `AgentBudget.spent_usd += cost_usd`
    - Publishes event to `agentflow:stream:{run_id}`
  - [ ] `POST /api/internal/runs/{run_id}/complete` — marks run as completed/failed

### Phase 10: Alembic Migrations
- [ ] Initialize Alembic: `uv run alembic init migrations`
- [ ] Configure `migrations/env.py` with all models
- [ ] Generate initial migration: `alembic revision --autogenerate -m "initial_schema"` — covers Company, Agent, AgentBudget, Pipeline, Run, AgentExecution, APIKey
- [ ] Remove `Base.metadata.create_all()` from `main.py`
- [ ] Add `entrypoint.sh`: `alembic upgrade head && uvicorn ...`
- [ ] Create `apps/api/Makefile` with `migrate`, `migrate-new`, `migrate-down`, `migrate-status`

### Phase 11: Tests
- [ ] **`apps/api/tests/test_companies.py`**: Company CRUD, agent sync on update, `GET /org-structure`
- [ ] **`apps/api/tests/test_heartbeat.py`**: Heartbeat updates `last_heartbeat_at`, stale agent marked dead
- [ ] **`apps/api/tests/test_apply.py`**: Multi-document YAML `POST /api/apply` creates Company + Pipeline
- [ ] **`apps/api/tests/test_pipeline_execute.py`**: Execute triggers Celery task with `company_yaml`
- [ ] **`apps/api/tests/test_budget.py`**: Budget endpoint returns correct remaining after run
- [ ] **`apps/api/tests/test_websocket.py`**: WebSocket receives heartbeat events for company agents

---

## Acceptance Criteria
- `POST /api/apply` with multi-document YAML creates both Company and Pipeline
- `GET /api/companies/{id}/org-structure` returns correct hierarchy
- Heartbeat `POST` updates `Agent.last_heartbeat_at`; agent shows "dead" after timeout
- `POST /api/pipelines/{id}/execute` dispatches Celery with `company_yaml` and `pipeline_yaml`
- `GET /api/ws/companies/{id}/agents` streams live agent health events
- Alembic `upgrade head` creates all 7 tables on a fresh database
- All tests pass: `uv run pytest apps/api/tests/ -v`

---

## Deliverable

Upon completion of Plan A3, you will have:

**1. Full Resource API** (REST, Kubernetes-style):
- `POST /api/apply` — applies any Company or Pipeline YAML (like `kubectl apply`)
- Company CRUD: create, read, update, delete with agent sync
- Agent budget tracking: monthly spend per agent, alerts at threshold
- Pipeline CRUD with company reference validation

**2. Agent Lifecycle API**:
- Heartbeat endpoint: agents report alive every N seconds
- Health status tracking: healthy / degraded / dead
- Company-wide agent status WebSocket stream

**3. Execution Control**:
- Trigger runs via webhook (Stripe, GitHub, generic) with HMAC verification
- WebSocket real-time streaming with agent identity in every event
- Pause / Resume / Stop controls for running pipelines

**4. Database**:
- 7 tables: `companies`, `agents`, `agent_budgets`, `pipelines`, `runs`, `agent_executions`, `api_keys`
- Alembic migrations running cleanly from fresh DB

**5. Deployed API**:
> `kubectl apply -f acme-company.yaml` → `POST /api/apply` → Company + Alice + Bob agents in DB → `POST /api/pipelines/ship-feature/execute` → Celery dispatches with company YAML → Alice runs with her persona and budget.

---

## Routing

### This plan enables (must complete A3 before starting):
- **[Plan B4](plan-B4-execution-visualization.md)** — needs WebSocket `/api/ws/runs/{run_id}` and company agent status stream
- **[Plan C1](plan-C1-infrastructure.md)** — Alembic migrations and Docker entrypoint coordinate with this plan's model changes

### This plan depends on:
- **[Plan A0](plan-A0-company-agent-schema.md)** — Company, Agent Zod schemas for validation
- **[Plan A1](plan-A1-schema-dsl.md)** — Pipeline Zod schema, `compileEdges()`, `validatePipeline()`
- **[Plan A2](plan-A2-runtime-engine.md)** — Celery `execute_pipeline` task signature, `StreamEvent` format
