# AgentFlow Architecture Overview

## System Layers

```
┌─────────────────────────────────────────────────────┐
│  Layer 1 — Client Surface                           │
│  apps/web: Vite SPA + React Flow canvas             │
│  External: Stripe webhooks, form submissions        │
└──────────────────────┬──────────────────────────────┘
                       │ REST / WebSocket
┌──────────────────────▼──────────────────────────────┐
│  Layer 2 — Orchestrator                             │
│  apps/api: FastAPI + SQLAlchemy                     │
│  - Pipeline CRUD                                    │
│  - Run lifecycle management                         │
│  - Trigger processing                               │
│  - Celery task dispatch                             │
└──────────────────────┬──────────────────────────────┘
                       │ Celery tasks (Redis broker)
┌──────────────────────▼──────────────────────────────┐
│  Layer 3 — Agent Runtime                            │
│  services/worker: Celery workers                    │
│  services/runtime: LangGraph DAG executor           │
│  services/agents: AgentPod implementations          │
│                                                     │
│  Execution model:                                   │
│  1. Worker receives run_id from queue               │
│  2. Load pipeline spec from PostgreSQL              │
│  3. Build LangGraph StateGraph                      │
│  4. Execute DAG (parallelizing independent agents)  │
│  5. Checkpoint state to Redis after each node       │
└──────────────────────┬──────────────────────────────┘
                       │ output artifacts
┌──────────────────────▼──────────────────────────────┐
│  Layer 4 — Output Engine                            │
│  Vercel API: deploy websites                        │
│  Resend: email delivery credentials                 │
│  Future: GitHub, S3, Figma, Notion                  │
└──────────────────────┬──────────────────────────────┘
                       │ metrics / logs
┌──────────────────────▼──────────────────────────────┐
│  Layer 5 — Observability                            │
│  PostgreSQL: run history, cost tracking             │
│  Redis: live run state, checkpoints                 │
│  Future: Grafana + Prometheus                       │
└─────────────────────────────────────────────────────┘
```

## Data Flow: Pipeline Execution

```
User/Webhook → POST /api/triggers/{pipeline_id}
  → Create Run (PostgreSQL, status=pending)
  → Enqueue Celery task execute_pipeline(run_id)
  → Worker picks up task
    → Load pipeline YAML from PostgreSQL
    → Build LangGraph StateGraph
    → Execute agents in DAG order
      → Each agent: on_start → run() → on_done
      → Save checkpoint to Redis
      → Write AgentExecution to PostgreSQL
    → On completion: update Run status=completed
    → Dispatch output (Vercel deploy, Resend email)
  → WebSocket pushes status to canvas
```

## Package Dependency Graph

```
@agentflow/core  ←──── @agentflow/ui
      ↑                      ↑
      └──────────── apps/web

@agentflow/core  ←──── @agentflow/sdk

agentflow-runtime ←─── agentflow-worker
       ↑
agentflow-api (future: for YAML parsing)
```

## Key Interfaces

### AgentPod (Python)
```python
class AgentPod(ABC):
    name: str          # must match pipeline YAML agent name
    async def run(self, context: AgentContext) -> AgentResult: ...
    async def on_start(self, context: AgentContext) -> None: ...
    async def on_done(self, result: AgentResult) -> None: ...
    async def on_fail(self, error: Exception) -> None: ...
```

### Pipeline Schema (TypeScript/Zod)
```typescript
PipelineSchema = z.object({
  apiVersion: z.string(),
  kind: z.literal('Pipeline'),
  name: z.string(),
  namespace: z.string(),
  trigger: TriggerConfigSchema,
  agents: z.array(AgentConfigSchema).min(1),
  policy: PolicyConfigSchema,
  output: OutputConfigSchema,
})
```
