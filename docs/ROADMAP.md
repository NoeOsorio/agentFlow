# AgentFlow — Master Roadmap

> AI agent pipeline orchestration. Like Kubernetes, but for intelligent pipelines.

## Vision

AgentFlow lets developers define end-to-end AI agent workflows in a declarative YAML file. The platform compiles this into a DAG, executes agents autonomously, and delivers outputs (websites, emails, documents) without manual intervention.

## Phases

### Phase 1 — Monorepo Scaffold ✅
**Status:** Complete
**Goal:** Establish the foundation — repository structure, build tooling, skeleton services, and documentation.

**Deliverables:**
- Turborepo + pnpm workspace
- `@agentflow/core` — Pipeline AST + YAML parser + Zod schemas
- `apps/api` — FastAPI backend skeleton (pipeline CRUD, runs, triggers)
- `apps/web` — Vite + React + Tailwind canvas SPA
- `services/runtime` — LangGraph DAG engine + AgentPod base class
- `packages/ui`, `packages/sdk` — shared component and TypeScript SDK stubs
- Docker Compose local dev environment
- Kubernetes manifests skeleton

---

### Phase 2 — Core AST + YAML Compiler
**Status:** 🔲 Pending
**Goal:** Production-ready YAML schema, validation, and bidirectional sync between the canvas and the YAML spec.

**Deliverables:**
- Complete Zod schema with all edge cases and validation messages
- Round-trip YAML ↔ AST ↔ Canvas state (Zustand store)
- YAML diff/merge utility for pipeline inheritance (`extends` keyword)
- Schema versioning support (`apiVersion`)
- Unit tests for parser + schema (100% coverage on core)

**Success criteria:** Given any valid `agentflow.yaml`, the canvas renders it correctly. Any canvas change produces a valid YAML.

---

### Phase 3 — Runtime Engine
**Status:** 🔲 Pending
**Goal:** A production-ready LangGraph execution engine that can run a pipeline end-to-end.

**Deliverables:**
- Full `PipelineExecutor` wired to Redis checkpoints (crash recovery)
- Celery worker service (`services/worker`) dispatching pipeline runs
- Token budget enforcement — kill jobs that exceed `policy.budget`
- Retry logic with exponential backoff per `policy.retries`
- Dead letter queue for failed runs
- `services/agents` — first three AgentPods: `ResearchAgent`, `CopywriterAgent`, `QAAgent`
- Cost tracking (token counts → USD estimate) stored in PostgreSQL

**Success criteria:** A pipeline with 3 agents runs to completion, with costs tracked and state persisted in Redis.

---

### Phase 4 — API Layer
**Status:** 🔲 Pending
**Goal:** A complete REST API that the canvas UI and external clients can use to manage and trigger pipelines.

**Deliverables:**
- Pipeline CRUD with YAML validation on write
- Run lifecycle management (create, poll status, cancel)
- Webhook trigger endpoint (Stripe, form submissions, Linear)
- WebSocket endpoint for real-time run progress
- Alembic migrations for all models
- API authentication (API key header)
- OpenAPI docs at `/api/docs`

**Success criteria:** The canvas UI can create a pipeline, trigger a run, and poll status in real time.

---

### Phase 5 — Canvas UI
**Status:** 🔲 Pending
**Goal:** A fully functional drag-and-drop pipeline builder synchronized with YAML.

**Deliverables:**
- React Flow canvas with custom AgentPod nodes
- YAML editor (CodeMirror) in split view
- Bidirectional sync: canvas ↔ YAML (real-time, no save button)
- Node palette — drag agents from sidebar onto canvas
- Dependency edge drawing — connect agents to define `dependsOn`
- Pipeline run status overlay — live agent execution status on nodes
- Pipeline list, create, delete, duplicate

**Success criteria:** A non-technical user can build a 3-agent pipeline using only the canvas and trigger a run.

---

### Phase 6 — First E2E Pipeline
**Status:** 🔲 Pending
**Goal:** Demonstrate the full platform value with a real-world use case.

**Deliverables:**
- `pipelines/wellness-website.yaml` — the example from the README
- Stripe webhook integration → pipeline trigger
- `ResearchAgent` → `CopywriterAgent` → `FrontendAgent` → `QAAgent`
- Vercel deploy output (website deployed automatically)
- Email notification via Resend with delivery credentials
- End-to-end test: payment → deployed website in < 5 minutes

**Success criteria:** A Stripe payment triggers a pipeline that autonomously produces and deploys a wellness website.

---

## Architecture

```
┌─────────────────────────────────────┐
│  Layer 1 — Client Surface           │
│  apps/web (canvas) · intake forms   │
└──────────────┬──────────────────────┘
               │ API calls / webhooks
┌──────────────▼──────────────────────┐
│  Layer 2 — Orchestrator             │
│  apps/api (FastAPI) · Celery queue  │
└──────────────┬──────────────────────┘
               │ dispatch runs
┌──────────────▼──────────────────────┐
│  Layer 3 — AgentPods                │
│  services/runtime · services/agents │
└──────────────┬──────────────────────┘
               │ assembled output
┌──────────────▼──────────────────────┐
│  Layer 4 — Output Engine            │
│  Vercel deploy · Resend email       │
└──────────────┬──────────────────────┘
               │ observability
┌──────────────▼──────────────────────┐
│  Layer 5 — Observability            │
│  PostgreSQL logs · Redis state      │
└─────────────────────────────────────┘
```

## Key Files

| File | Purpose |
|------|---------|
| `packages/core/src/schema/pipeline.ts` | Pipeline Zod schema — source of truth |
| `packages/core/src/parser/index.ts` | YAML ↔ AST parser |
| `apps/api/src/agentflow_api/main.py` | FastAPI entry point |
| `apps/web/src/pages/CanvasPage.tsx` | React Flow canvas |
| `services/runtime/src/agentflow_runtime/pod.py` | AgentPod base class |
| `services/runtime/src/agentflow_runtime/dag.py` | LangGraph DAG builder |
| `docker-compose.yml` | Local dev environment |
| `infrastructure/k8s/` | Production Kubernetes manifests |
