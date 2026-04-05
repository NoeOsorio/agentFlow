# Plan C1: Infrastructure & DevOps

## Overview
Harden the infrastructure for the expanded data model (Company/Agent/AgentBudget tables), add multi-stage Docker builds, structured logging, health/readiness probes, and a `kubectl`-style CLI concept for applying YAML manifests. Runs fully in parallel with all other plans and prepares the system for production deployment.

## Tech Context
- **Affects:** `apps/api/`, `services/runtime/`, `apps/web/`, `docker-compose.yml`, `infrastructure/k8s/`, `packages/sdk/`
- **Tech:** Alembic 1.14, Docker multi-stage, structlog, pydantic-settings, GitHub Actions, Commander.js (CLI)

---

## Goals
- Alembic migrations covering all 7 tables: `companies`, `agents`, `agent_budgets`, `pipelines`, `runs`, `agent_executions`, `api_keys`
- Multi-stage Docker builds for API, runtime, web (production-ready, minimal images)
- Structured JSON logging across all services with `run_id`, `agent_name`, `company_name` in context
- Health (`/health`) and readiness (`/ready`) probes with dependency checks
- `agentflow` CLI in `packages/sdk/` with `apply`, `get`, `delete` commands (kubectl-style)
- `docker compose up` brings up all 7 services (postgres, redis, api, web, celery-worker, celery-beat, celery-flower)
- GitHub Actions CI: parallel test jobs per package

---

## Checklist

### Phase 1: Alembic Migrations (Full Data Model)
- [ ] **Initialize Alembic** in `apps/api/`:
  - [ ] `uv run alembic init migrations`
  - [ ] Configure `migrations/env.py`:
    - Import all 7 models: `Company`, `Agent`, `AgentBudget`, `Pipeline`, `Run`, `AgentExecution`, `APIKey`
    - Set `target_metadata = Base.metadata`
    - Use `settings.database_url` async-compatible
    - Add `compare_type=True`

- [ ] **Generate initial migration** with ALL tables:
  ```
  uv run alembic revision --autogenerate -m "initial_schema_with_company_agents"
  ```
  - [ ] Verify migration covers:
    - `companies (id, name, namespace, yaml_spec, description, created_at, updated_at)`
    - `agents (id, company_id FK, name, role, yaml_spec, health_status, last_heartbeat_at, created_at)`
    - `agent_budgets (id, agent_id FK, month, spent_usd, token_count, updated_at)`
    - `pipelines (id, company_id FK nullable, name, namespace, yaml_spec, webhook_secret, version, created_at, updated_at)`
    - `runs (id, pipeline_id FK, status, trigger_data, started_at, finished_at, created_at)`
    - `agent_executions (id, run_id FK, agent_name, node_id, status, tokens_used, cost_usd, input_snapshot, output_snapshot, error, started_at, finished_at)`
    - `api_keys (id, name, key_hash, scopes, created_at, last_used_at, expires_at)`

- [ ] **Remove `Base.metadata.create_all()`** from `apps/api/src/agentflow_api/main.py`

- [ ] **Create `apps/api/entrypoint.sh`**:
  ```bash
  #!/bin/sh
  set -e
  echo "Running database migrations..."
  uv run alembic upgrade head
  echo "Starting API server..."
  exec uv run uvicorn agentflow_api.main:app --host 0.0.0.0 --port 8000 --workers 4
  ```

- [ ] **Create `apps/api/Makefile`**:
  - [ ] `make migrate` — `alembic upgrade head`
  - [ ] `make migrate-new name=<name>` — generate new migration
  - [ ] `make migrate-down` — `alembic downgrade -1`
  - [ ] `make migrate-status` — `alembic current`

### Phase 2: Structured Logging
- [ ] **Install `structlog`** in `apps/api/pyproject.toml` and `services/runtime/pyproject.toml`

- [ ] **Create `apps/api/src/agentflow_api/logging_config.py`**:
  - [ ] JSON processor for production, pretty console for development
  - [ ] Standard context fields: `service=agentflow-api`, `env`, `version`
  - [ ] `RequestLoggingMiddleware`:
    - Per-request: `request_id = uuid4()`
    - Bind: `request_id`, `method`, `path`
    - Log `request_started`, `request_finished` (with `status_code`, `duration_ms`)

- [ ] **Create `services/runtime/src/agentflow_runtime/logging_config.py`**:
  - [ ] Standard context: `service=agentflow-runtime`
  - [ ] Execution context: bind `run_id`, `pipeline_name`, `company_name`, `agent_name` during execution
  - [ ] Log: `agent_started`, `agent_completed`, `agent_failed` with `tokens_used`, `cost_usd`

### Phase 3: Health & Readiness Probes
- [ ] **Update `apps/api/src/agentflow_api/main.py`**:
  - [ ] `GET /health` — liveness: always `200 OK` if process alive
  - [ ] `GET /ready` — readiness:
    - PostgreSQL: `await db.execute(text("SELECT 1"))`
    - Redis: `await redis.ping()`
    - Returns `{ "status": "ready", "database": "ok", "redis": "ok" }`
    - Returns `503` with details on first failure
  - [ ] `GET /metrics` — basic Prometheus metrics (optional: `prometheus-fastapi-instrumentator`)

- [ ] **Create `services/runtime/src/agentflow_runtime/healthcheck.py`**:
  - [ ] HTTP server on port 8001 (simple `aiohttp` or stdlib `http.server`)
  - [ ] `GET /health` → `200` if process alive
  - [ ] `GET /ready` → checks Redis connectivity

### Phase 4: Multi-Stage Docker Builds
- [ ] **`apps/api/Dockerfile`** (2-stage):
  - Stage 1: `python:3.12-slim` — install `uv`, sync deps (frozen, no dev)
  - Stage 2: `python:3.12-slim` — copy `.venv` + source + migrations + entrypoint
  - Target size: < 200MB

- [ ] **`services/runtime/Dockerfile`** (2-stage):
  - Stage 1: deps, Stage 2: runtime only
  - CMD: `python -m agentflow_runtime.worker` (Celery worker)

- [ ] **`apps/web/Dockerfile`** (2-stage):
  - Stage 1: `node:20-alpine` — install pnpm, build all workspace packages, `pnpm build`
  - Stage 2: `nginx:alpine` — copy `/dist`, add `nginx.conf`

- [ ] **`apps/web/nginx.conf`**:
  - Port 3000, `try_files $uri /index.html` for SPA routing
  - Proxy `/api/` → `http://api:8000/api/`
  - Gzip enabled, 1-year cache for static assets

### Phase 5: Docker Compose Updates
- [ ] **Update `docker-compose.yml`** (development):
  - [ ] 7 services: `postgres`, `redis`, `api`, `web`, `celery-worker`, `celery-beat`, `celery-flower`
  - [ ] `celery-worker`: `agentflow_runtime.tasks worker`, depends on redis + postgres
  - [ ] `celery-beat`: `agentflow_runtime.tasks beat`, 1 replica, for scheduled pipeline triggers
  - [ ] `celery-flower`: `mher/flower:latest`, port 5555 (dev monitoring)
  - [ ] `api` service: uses `entrypoint.sh` (runs migrations before start)
  - [ ] `healthcheck` on postgres: `pg_isready`, on redis: `redis-cli ping`
  - [ ] `api depends_on: { postgres: { condition: service_healthy }, redis: { condition: service_healthy } }`

- [ ] **Create `docker-compose.prod.yml`** (production overlay):
  - [ ] No volume mounts
  - [ ] Pre-built image refs (`image: ghcr.io/org/agentflow-api:${TAG}`)
  - [ ] `restart: unless-stopped` on all services
  - [ ] Secrets via `env_file: .env.production`
  - [ ] Remove `celery-flower`

### Phase 6: `agentflow` CLI (kubectl-style)
- [ ] **Create `packages/sdk/src/cli/`** — TypeScript CLI using Commander.js:
  - [ ] Install: `pnpm --filter @agentflow/sdk add commander`
  - [ ] `packages/sdk/src/cli/index.ts` — CLI entry point:
    ```
    agentflow apply -f company.yaml         # POST /api/apply (multi-document)
    agentflow get companies                  # GET /api/companies/
    agentflow get pipelines                  # GET /api/pipelines/
    agentflow get runs --pipeline <name>     # GET /api/runs?pipeline_id=...
    agentflow delete company <name>          # DELETE /api/companies/{id}
    agentflow run <pipeline-name>            # POST /api/pipelines/{name}/execute
    agentflow logs <run-id>                  # stream SSE logs from GET /api/runs/{id}/logs
    ```
  - [ ] `~/.agentflow/config.json` — stores `apiUrl` and `apiKey` (like `~/.kube/config`)
  - [ ] `agentflow config set-context --url http://localhost:8000 --key <api-key>` — saves config
  - [ ] Output formats: `--output table` (default), `--output json`, `--output yaml`

- [ ] **Update `packages/sdk/package.json`**:
  - [ ] Add `"bin": { "agentflow": "./dist/cli/index.js" }`
  - [ ] Add build script for CLI entry point

### Phase 7: Environment Configuration
- [ ] **Update `apps/api/src/agentflow_api/config.py`**:
  - [ ] Add `internal_secret: SecretStr`
  - [ ] Add `celery_broker_url: RedisDsn`
  - [ ] Add `knowledge_base_url: str | None = None`
  - [ ] Startup validation: required secrets fail fast in production
  - [ ] `model_config = SettingsConfigDict(env_file=".env")`

- [ ] **Create `apps/api/.env.example`** — all required variables documented
- [ ] **Create `services/runtime/.env.example`**

### Phase 8: GitHub Actions CI/CD
- [ ] **Create `.github/workflows/ci.yml`**:
  - [ ] Parallel jobs:
    - `test-core` — `pnpm --filter @agentflow/core test`
    - `test-ui` — `pnpm --filter @agentflow/ui build` (type check)
    - `test-web` — `pnpm --filter @agentflow/web build` (type check)
    - `test-api` — `uv run pytest apps/api/tests/ -v` (with postgres + redis services)
    - `test-runtime` — `uv run pytest services/runtime/tests/ -v` (with redis service)
    - `lint-ts` — `pnpm lint` (tsc --noEmit)
    - `lint-py` — `uv run ruff check apps/ services/`
  - [ ] Docker build job (push to main only): build + push to GHCR

- [ ] **Create `.github/workflows/deploy.yml`**:
  - [ ] Trigger: push to `main` after CI passes
  - [ ] Run `alembic upgrade head` via deploy job before swapping containers

### Phase 9: Kubernetes Manifests
- [ ] **Update `infrastructure/k8s/`**:
  - [ ] `api-deployment.yaml` — readiness probe → `/ready`, liveness → `/health`
  - [ ] `runtime-deployment.yaml` — liveness → port 8001 `/health`
  - [ ] `celery-deployment.yaml` — new: Celery workers (3 replicas)
  - [ ] `celery-beat-deployment.yaml` — new: 1 replica
  - [ ] `api-hpa.yaml` — HorizontalPodAutoscaler (min 2, max 10, CPU 70%)
  - [ ] `secrets.yaml` — template for API keys, DB URL, internal secret
  - [ ] `configmap.yaml` — non-secret env vars

---

## Acceptance Criteria
- `alembic upgrade head` on fresh DB creates all 7 tables with correct FK constraints
- `docker compose up` starts all 7 services, all pass healthchecks
- `GET /ready` returns `503` when Redis is stopped (tested by stopping container)
- `agentflow apply -f packages/core/examples/acme-company.yaml` creates Company + agents in API
- `agentflow get companies` lists companies in table format
- API image < 200MB, runtime image < 150MB (multi-stage builds)
- All CI jobs run in parallel and fail fast on first error

---

## Deliverable

Upon completion of Plan C1, you will have:

**1. Clean Database Migration System**:
- Alembic setup with all 7 tables
- `make migrate` / `make migrate-new` commands
- Docker entrypoint auto-migrates on startup

**2. `agentflow` CLI** (`packages/sdk/`):
```bash
# Apply a company and pipeline YAML
agentflow apply -f my-company.yaml

# List companies
agentflow get companies
# NAME         NAMESPACE  AGENTS  CREATED
# acme-corp    default    3       2026-04-04

# Run a pipeline
agentflow run feature-development --input "feature=dark mode"

# Watch logs in real-time
agentflow logs run_abc123
```

**3. Production-Ready Docker Setup**:
- Multi-stage Dockerfiles for all 3 services
- `docker-compose.yml` with all 7 services + health checks
- `docker-compose.prod.yml` for production

**4. CI/CD Pipeline**:
- 7 parallel GitHub Actions jobs
- Docker image push to GHCR on merge to main

---

## Routing

### This plan enables:
- Production deployment
- No functional plan depends on C1 (fully parallel)

### This plan depends on:
- None for most phases (starts in Wave 1)
- Coordinate Alembic migration generation with Plan A3 (after A3 finalizes all model columns — run `make migrate-new` once A3 is complete)
