# Execution Order — AgentFlow Implementation Plans

This document defines the recommended execution order for all 11 implementation plans, organized by dependency waves. Plans within the same wave can run **fully in parallel** across independent sub-agents.

---

## Execution Tracker

> **Legend:** `[x]` = done · `[ ]` = pending · Each sub-PR maps to one Claude Code agent invocation.

---

### Wave 1 — Absolute Foundation

#### ✅ A0: Company & Agent Schema — `packages/core/src/schema/`
- [x] **A0-PR-1** — Resource envelope + Agent schema
  - `packages/core/src/schema/resource.ts` (new)
  - `packages/core/src/schema/agent.ts` (new)
- [x] **A0-PR-2** — Company schema + Parser
  - `packages/core/src/schema/company.ts` (new)
  - `packages/core/src/parser/index.ts` (update)
- [x] **A0-PR-3** — Exports + Tests + Examples
  - `packages/core/src/index.ts` (update)
  - `packages/core/src/__tests__/company.test.ts` (new)
  - `packages/core/src/__tests__/resource.test.ts` (new)
  - `packages/core/examples/acme-company.yaml` (new)
  - `packages/core/examples/full-manifest.yaml` (new)

#### ✅ C1: Infrastructure & DevOps
- [x] **C1-PR-1** — Alembic migrations + structured logging
  - `apps/api/migrations/` (new)
  - `apps/api/src/agentflow_api/logging_config.py` (new)
  - `services/runtime/src/agentflow_runtime/logging_config.py` (new)
- [x] **C1-PR-2** — Health probes + Multi-stage Docker builds
  - `apps/api/Dockerfile` (update)
  - `services/runtime/Dockerfile` (update)
  - `apps/web/Dockerfile` (update)
  - `apps/web/nginx.conf` (new)
- [x] **C1-PR-3** — Docker Compose + `agentflow` CLI + env config + CI + K8s
  - `docker-compose.yml` (update)
  - `docker-compose.prod.yml` (new)
  - `packages/sdk/src/cli/index.ts` (new)
  - `.github/workflows/ci.yml` (new)
  - `.github/workflows/deploy.yml` (new)
  - `infrastructure/k8s/` (update)

---

### Wave 2 — Core Building Blocks

#### ✅ A1: Pipeline Schema & DSL — `packages/core/src/schema/`
- [x] **A1-PR-1** — Pipeline resource wrapper + Node type schemas
  - `packages/core/src/schema/pipeline.ts` (update — K8s envelope)
  - `packages/core/src/schema/nodes.ts` (new — all 14 node types)
- [x] **A1-PR-2** — Variable system + Conditions + Canvas + Model schemas
  - `packages/core/src/schema/variable.ts` (new)
  - `packages/core/src/schema/conditions.ts` (new)
  - `packages/core/src/schema/canvas.ts` (new)
  - `packages/core/src/schema/model.ts` (new)
- [x] **A1-PR-3** — Parser update + TypeScript exports
  - `packages/core/src/parser/index.ts` (update — `parsePipeline`, `compileEdges`, `resolveVariableRefs`)
  - `packages/core/src/index.ts` (update)
- [x] **A1-PR-4** — Tests + Pipeline example YAMLs
  - `packages/core/src/__tests__/pipeline.test.ts` (new)
  - `packages/core/src/__tests__/nodes.test.ts` (new)
  - `packages/core/src/__tests__/variables.test.ts` (new)
  - `packages/core/examples/simple-pipeline.yaml` (new)
  - `packages/core/examples/agent-pipeline.yaml` (new)
  - `packages/core/examples/branching-pipeline.yaml` (new)

#### ✅ B2: Node UI Components — `packages/ui/src/`
- [x] **B2-PR-1** — BaseNodeCard + NodeHandle + color map
  - `packages/ui/src/nodes/BaseNodeCard.tsx` (new)
  - `packages/ui/src/nodes/NodeHandle.tsx` (new)
  - `packages/ui/src/nodes/colors.ts` (new)
- [x] **B2-PR-2** — AgentPodNodeCard + BudgetBar + AgentSelector widget
  - `packages/ui/src/nodes/AgentPodNodeCard.tsx` (new)
  - `packages/ui/src/forms/widgets/AgentSelector.tsx` (new)
- [x] **B2-PR-3** — 13 remaining node cards (Start, End, LLM, Code, HTTP, IfElse, Template, VariableAssigner, VariableAggregator, Iteration, HumanInput, KnowledgeRetrieval, SubWorkflow)
  - `packages/ui/src/nodes/` (all remaining card components)
- [x] **B2-PR-4** — Shared form widgets + all config forms + package exports
  - `packages/ui/src/forms/widgets/` (VariableReferencePicker, ModelSelector, PromptEditor, ConditionBuilder, CodeEditor)
  - `packages/ui/src/forms/` (all node config forms)
  - `packages/ui/src/index.ts` (update — exports `nodeTypes`, `nodeConfigForms`)

#### ✅ B3: State Management & YAML Sync — `apps/web/src/store/`
- [x] **B3-PR-1** — Shared types + CompanyStore
  - `apps/web/src/store/types.ts` (new — CanvasNode, NodeRunStatus, AgentBudgetState, etc.)
  - `apps/web/src/store/companyStore.ts` (new)
- [x] **B3-PR-2** — PipelineStore + bidirectional YAML sync
  - `apps/web/src/store/pipelineStore.ts` (new)
- [x] **B3-PR-3** — Undo/redo + variable scope + pipeline validation hooks
  - `apps/web/src/store/variableScope.ts` (new — `computeVariableScope`, `useVariableScope`)
  - hooks: `useNodeValidationErrors`, `useAgentBudget`, `useAgentHealth`
- [x] **B3-PR-4** — YAML panel + budget polling + tests
  - `apps/web/src/features/canvas/YamlPanel.tsx` (new)
  - `apps/web/src/store/__tests__/companyStore.test.ts` (new)
  - `apps/web/src/store/__tests__/pipelineStore.test.ts` (new)
  - `apps/web/src/store/__tests__/variableScope.test.ts` (new)

---

### Wave 3 — Feature Implementations

#### A2: Runtime Engine Enhancement — `services/runtime/`
- [ ] **A2-PR-1** — Agent identity model + State redesign + Variable resolver
  - `services/runtime/src/agentflow_runtime/identity.py` (new — `AgentIdentity`, `CompanyContext`)
  - `services/runtime/src/agentflow_runtime/state.py` (update — `NodeExecutionRecord`, company fields)
  - `services/runtime/src/agentflow_runtime/pod.py` (update — `AgentContext` with identity)
  - `services/runtime/src/agentflow_runtime/variables.py` (new — `VariableResolver`)
- [ ] **A2-PR-2** — Node executor base + DAG builder with agent resolution
  - `services/runtime/src/agentflow_runtime/nodes/base.py` (new — `NodeExecutor`, `NodeExecutionResult`)
  - `services/runtime/src/agentflow_runtime/nodes/__init__.py` (new — registry)
  - `services/runtime/src/agentflow_runtime/dag.py` (update — `build_graph(pipeline, company_context)`)
  - `services/runtime/src/agentflow_runtime/routing.py` (new — conditional edge functions)
- [x] **A2-PR-3** — Heartbeat + Lifecycle hooks + Budget enforcement
  - `services/runtime/src/agentflow_runtime/heartbeat.py` (new — `AgentHeartbeatMonitor`)
  - `services/runtime/src/agentflow_runtime/lifecycle.py` (new — `execute_with_lifecycle`)
  - `services/runtime/src/agentflow_runtime/budget.py` (new — `BudgetExceededError`, cost table)
- [x] **A2-PR-4** — Redis checkpoint + Streaming + Celery tasks + Tests
  - `services/runtime/src/agentflow_runtime/checkpoint.py` (update — `AgentFlowCheckpointer`)
  - `services/runtime/src/agentflow_runtime/executor.py` (update — checkpointer wired)
  - `services/runtime/src/agentflow_runtime/streaming.py` (new — `StreamEvent`, `StreamingExecutor`)
  - `services/runtime/src/agentflow_runtime/tasks/pipeline_tasks.py` (new — Celery tasks)
  - `services/runtime/src/agentflow_runtime/dead_letter.py` (new)
  - `services/runtime/tests/` (new — company_context, executor, heartbeat, streaming tests)

#### B0: Company Editor UI — `apps/web/src/features/company/`
- [ ] **B0-PR-1** — Routes + Companies list page
  - `apps/web/src/App.tsx` (update — routes `/companies`, `/companies/:id`, `/companies/:id/agents/:name`)
  - `apps/web/src/pages/CompaniesPage.tsx` (new)
  - `apps/web/src/features/company/CompanyCard.tsx` (new)
- [ ] **B0-PR-2** — Company detail page layout + Agent cards grid
  - `apps/web/src/pages/CompanyPage.tsx` (new — 3-panel: OrgChart / Agents / YAML)
  - `apps/web/src/features/company/AgentCard.tsx` (new)
  - `apps/web/src/features/company/AgentGrid.tsx` (new — filter/sort)
- [x] **B0-PR-3** — Agent form modal + Org chart visualization
  - `apps/web/src/features/company/AgentFormModal.tsx` (new — full agent form with react-hook-form)
  - `apps/web/src/features/company/OrgChart.tsx` (new — d3-hierarchy tree)
  - `apps/web/src/features/company/OrgNode.tsx` (new)
- [x] **B0-PR-4** — Departments + YAML panel + Budget overview + Pipeline link + Agent detail page
  - `apps/web/src/features/company/DepartmentPanel.tsx` (new)
  - `apps/web/src/features/company/CompanyYamlPanel.tsx` (new — Monaco YAML)
  - `apps/web/src/features/company/BudgetOverview.tsx` (new)
  - `apps/web/src/features/company/CompanySelector.tsx` (new — used in Pipeline Editor header)
  - `apps/web/src/pages/AgentDetailPage.tsx` (new — route `/companies/:id/agents/:agentName`)

#### B1: Canvas Editor UI — `apps/web/src/features/canvas/`
- [ ] **B1-PR-1** — Feature folder structure + Company-aware Node palette
  - `apps/web/src/features/canvas/index.ts` (new)
  - `apps/web/src/features/canvas/NodePalette.tsx` (new — company agents section + node sections)
  - `apps/web/src/pages/CanvasPage.tsx` (update — load pipeline + company)
- [ ] **B1-PR-2** — Node type registration + Canvas editor core
  - `apps/web/src/features/canvas/nodeTypes.ts` (new — 14 node type → component map)
  - `apps/web/src/features/canvas/edgeTypes.ts` (new — DefaultEdge, ConditionalEdge)
  - `apps/web/src/features/canvas/CanvasEditor.tsx` (new — React Flow core with connection validation)
- [ ] **B1-PR-3** — Config panel + Pipeline header with company selector
  - `apps/web/src/features/canvas/ConfigPanel.tsx` (new — slides in on node select)
  - `apps/web/src/features/canvas/nodeConfigForms.ts` (new — node type → form map)
  - `apps/web/src/features/canvas/PipelineHeader.tsx` (new — name, CompanySelector, save/run/export)
- [ ] **B1-PR-4** — Canvas toolbar + Keyboard shortcuts + YAML panel + Pipelines list
  - `apps/web/src/features/canvas/CanvasToolbar.tsx` (new — zoom, fit, dagre layout, undo/redo)
  - `apps/web/src/features/canvas/hooks/useKeyboardShortcuts.ts` (new)
  - `apps/web/src/features/canvas/YamlPanel.tsx` (new — Monaco, live-synced)
  - `apps/web/src/pages/PipelinesPage.tsx` (update — pipeline cards, new pipeline, filter by company)

---

### Wave 4 — Integration Layer

#### A3: API Layer — `apps/api/src/agentflow_api/`
- [ ] **A3-PR-1** — Expanded data models + Auth + API key management
  - `apps/api/src/agentflow_api/models.py` (update — Company, Agent, AgentBudget, APIKey models)
  - `apps/api/src/agentflow_api/auth.py` (new — `generate_api_key`, `verify_api_key`, scopes)
  - `apps/api/src/agentflow_api/routers/api_keys.py` (new — `POST/GET/DELETE /api/keys`)
- [ ] **A3-PR-2** — Company + Agent CRUD + Heartbeat endpoints
  - `apps/api/src/agentflow_api/routers/companies.py` (new — `POST/GET/PUT/DELETE /api/companies`, `/org-structure`)
  - `apps/api/src/agentflow_api/routers/agents.py` (new — `/api/companies/:id/agents`, heartbeat `POST /api/internal/agents/:name/heartbeat`)
- [ ] **A3-PR-3** — Pipeline CRUD + Multi-resource apply + Run controls
  - `apps/api/src/agentflow_api/routers/pipelines.py` (update — company_ref validation, `/compiled`)
  - `apps/api/src/agentflow_api/routers/resources.py` (new — `POST /api/apply`, `GET /api/resources`)
  - `apps/api/src/agentflow_api/routers/runs.py` (update — execute, pause/resume/stop, node list)
- [ ] **A3-PR-4** — Webhooks + WebSocket + Internal callbacks + Alembic + Tests
  - `apps/api/src/agentflow_api/routers/triggers.py` (update — HMAC verification, schedule)
  - `apps/api/src/agentflow_api/routers/ws.py` (new — `GET /api/ws/runs/:id`, `/api/ws/companies/:id/agents`)
  - `apps/api/src/agentflow_api/routers/internal.py` (new — `POST /api/internal/runs/:id/events`)
  - `apps/api/migrations/` (new — Alembic initial migration, 7 tables)
  - `apps/api/tests/` (new)

#### A4: Production Node Implementations — `services/runtime/src/agentflow_runtime/nodes/`
- [ ] **A4-PR-1** — AgentPod node + LLM node
  - `services/runtime/src/agentflow_runtime/nodes/agent_pod_node.py` (new — persona injection, budget, lifecycle)
  - `services/runtime/src/agentflow_runtime/nodes/llm_node.py` (new — multi-provider, structured output)
  - `services/runtime/tests/nodes/test_agent_pod_node.py` (new)
  - `services/runtime/tests/nodes/test_llm_node.py` (new)
- [ ] **A4-PR-2** — Code + HTTP + Template nodes
  - `services/runtime/src/agentflow_runtime/nodes/code_node.py` (new — sandboxed subprocess, timeout)
  - `services/runtime/src/agentflow_runtime/nodes/http_node.py` (new — httpx, error result on 4xx/5xx)
  - `services/runtime/src/agentflow_runtime/nodes/template_node.py` (new — Jinja2)
  - `services/runtime/tests/nodes/` (new)
- [ ] **A4-PR-3** — Variable nodes + IF/ELSE + Iteration
  - `services/runtime/src/agentflow_runtime/nodes/variable_assigner_node.py` (new)
  - `services/runtime/src/agentflow_runtime/nodes/variable_aggregator_node.py` (new)
  - `services/runtime/src/agentflow_runtime/nodes/if_else_node.py` (new — all 12 operators)
  - `services/runtime/src/agentflow_runtime/nodes/iteration_node.py` (new — max 100 iterations)
  - `services/runtime/tests/nodes/` (new)
- [ ] **A4-PR-4** — Human input + Knowledge retrieval + Sub-workflow + Node registry
  - `services/runtime/src/agentflow_runtime/nodes/human_input_node.py` (new — Redis pub/sub approval)
  - `services/runtime/src/agentflow_runtime/nodes/knowledge_retrieval_node.py` (new)
  - `services/runtime/src/agentflow_runtime/nodes/sub_workflow_node.py` (new — nested executor)
  - `services/runtime/src/agentflow_runtime/nodes/__init__.py` (update — register all 14 executors)

---

### Wave 5 — Execution Visualization

#### B4: Execution Visualization & Run UI — `apps/web/src/features/runs/`
- [ ] **B4-PR-1** — WebSocket hooks + Agent-aware node status overlay
  - `apps/web/src/features/runs/hooks/useRunWebSocket.ts` (new — connects to `/api/ws/runs/:id`)
  - `apps/web/src/features/runs/hooks/useCompanyAgentWebSocket.ts` (new — heartbeat stream)
  - `packages/ui/src/nodes/BaseNodeCard.tsx` (update — `"[role] is thinking..."` during run)
  - `apps/web/src/features/canvas/hooks/useNodeRunStatus.ts` (new)
- [ ] **B4-PR-2** — Execution log panel + Per-agent budget tracker + Run metrics bar
  - `apps/web/src/features/runs/RunLogPanel.tsx` (new — bottom drawer with agent-identity entries)
  - `apps/web/src/store/logsStore.ts` (new)
  - `apps/web/src/features/runs/AgentBudgetPanel.tsx` (new — live budget deduction per agent)
  - `apps/web/src/features/runs/RunMetricsBar.tsx` (new — tokens / cost / duration)
- [ ] **B4-PR-3** — Heartbeat sidebar + Run controls + Human approval modal
  - `apps/web/src/features/runs/HeartbeatSidebar.tsx` (new — BUSY/IDLE/DEAD per agent)
  - `apps/web/src/features/runs/RunControlsBar.tsx` (new — pause/resume/stop)
  - `apps/web/src/features/runs/ApprovalModal.tsx` (new — human_input approval with agent context)
- [ ] **B4-PR-4** — Run summary card + Company dashboard + Run history sidebar
  - `apps/web/src/features/runs/RunSummaryCard.tsx` (new — per-agent cost breakdown toast)
  - `apps/web/src/pages/CompanyDashboardPage.tsx` (new — route `/companies/:id/dashboard`)
  - `apps/web/src/features/runs/RunHistorySidebar.tsx` (new — `GET /api/runs?pipeline_id=`)

---

### Wave 6 — End-to-End Integration

- [ ] **E2E-1** — CLI smoke test: `agentflow apply -f acme-company.yaml` → `agentflow run feature-dev` → `agentflow logs <run_id>`
- [ ] **E2E-2** — Alembic final migration: `make migrate-new name=final_schema` (after A3 confirms all columns)
- [ ] **E2E-3** — Full pipeline test: Start → AgentPod(alice) → IF/ELSE → AgentPod(bob) → Template → End (real LLM calls)
- [ ] **E2E-4** — Budget enforcement test: alice budget=$0.001, run pipeline, verify `BudgetExceededError`
- [ ] **E2E-5** — Heartbeat integration test: runtime emits → API receives → UI reflects

---

---

## Project Vision (Context for Sub-Agents)

AgentFlow is a **Kubernetes-inspired YAML platform for simulating virtual companies with AI agents**. You write YAML files declaring companies (with agents that have roles, budgets, and personas) and pipelines (workflows that orchestrate those agents). The runtime executes pipelines using the agents' identities — injecting their roles into LLM prompts automatically.

```yaml
# kubectl-style: apply a company
apiVersion: agentflow.ai/v1
kind: Company
metadata:
  name: acme-corp
spec:
  agents:
    - name: alice
      role: Lead Engineer
      persona: "Senior Python engineer. Pragmatic."
      model: { provider: anthropic, model_id: claude-sonnet-4-6 }
      budget: { monthly_usd: 100 }
---
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: ship-feature
spec:
  company_ref: { name: acme-corp }
  nodes:
    - id: implement
      type: agent_pod
      agent_ref: { name: alice }
      instruction: "Build the feature: {{#start.description#}}"
```

Sources of inspiration:
- **Paperclip**: agent identity, roles, budgets, heartbeat/lifecycle, org hierarchy
- **Dify**: visual node-based workflow editor, 14+ node types, streaming execution
- **Kubernetes**: YAML-first declarative resource model, `apiVersion/kind/metadata/spec`

---

## Dependency Graph

```
                    ┌────────────────────────────────────┐
                    │          WAVE 1 (Parallel)         │
                    │        A0 (Company Schema)         │
                    │         + C1 (Infrastructure)      │
                    └────────────┬───────────────────────┘
                                 │
      ┌──────────────────────────▼──────────────────────────────────┐
      │                    WAVE 2 (Parallel)                        │
      │     A1 (Pipeline Schema)  +  B3 (Store)  +  B2 (Node UI)  │
      └──────┬──────────────────────────────────────────────────────┘
             │
  ┌──────────▼────────────────────────────────────────────────────────┐
  │                      WAVE 3 (Parallel)                           │
  │   A2 (Runtime Engine)  +  B0 (Company Editor)  +  B1 (Canvas)   │
  └──────┬────────────────────────────────────────────────────────────┘
         │
  ┌──────▼──────────────────────────────┐
  │          WAVE 4 (Parallel)          │
  │   A3 (API Layer)  +  A4 (Nodes)    │
  └──────┬──────────────────────────────┘
         │
  ┌──────▼──────────────────┐
  │        WAVE 5           │
  │  B4 (Execution Viz)     │
  └──────┬──────────────────┘
         │
  ┌──────▼──────────────────┐
  │        WAVE 6           │
  │   E2E Integration       │
  └─────────────────────────┘
```

---

## Wave 1 — Absolute Foundation (Start Immediately, Parallel)

| Plan | File | Scope | Why First |
|------|------|-------|-----------|
| **A0: Company & Agent Schema** | [plan-A0-company-agent-schema.md](plan-A0-company-agent-schema.md) | `packages/core/src/schema/` (new: `resource.ts`, `company.ts`, `agent.ts`) | Defines `Company`, `Agent`, `AgentSpec` types used by every other plan. The K8s resource envelope. |
| **C1: Infrastructure & DevOps** | [plan-C1-infrastructure.md](plan-C1-infrastructure.md) | `docker-compose.yml`, `Dockerfiles`, `.github/`, `packages/sdk/cli/` | Fully independent. Sets up deployment foundation and the `agentflow` CLI. |

**Sub-agent isolation:** A0 touches `packages/core/src/` (TypeScript). C1 touches Docker/CI/CD config files. Zero overlap.

---

## Wave 2 — Core Building Blocks (After A0)

All three depend only on A0. Can run fully in parallel.

| Plan | File | Scope | Why This Wave |
|------|------|-------|---------------|
| **A1: Pipeline Schema & DSL** | [plan-A1-schema-dsl.md](plan-A1-schema-dsl.md) | `packages/core/src/schema/` (pipeline, nodes, variables, conditions, canvas) | Extends A0's resource envelope with Pipeline kind and all 14 node types. |
| **B3: State Management** | [plan-B3-state-management.md](plan-B3-state-management.md) | `apps/web/src/store/` | Creates `CompanyStore` + `PipelineStore` — needs A0 types for Company, AgentSpec. |
| **B2: Node UI Components** | [plan-B2-node-components.md](plan-B2-node-components.md) | `packages/ui/src/` | Builds node cards and config forms — needs A0's `AgentSpec` for `AgentPodNodeCard`. |

**Sub-agent isolation:** A1 → `packages/core/`. B3 → `apps/web/src/store/`. B2 → `packages/ui/src/`. Zero overlap.

**Note:** B2 and B3 also depend on A1 types (Pipeline node types). Either: (a) start them after A1 completes, or (b) start them in parallel with A1 and have them use stub types initially. For simplicity, start all 3 together after A0 — B2 and B3 should wait for A1's TypeScript exports to stabilize before finalizing forms.

---

## Wave 3 — Feature Implementations (After Wave 2)

Three plans that depend on Wave 2 but are mutually independent.

| Plan | File | Scope | Prerequisites |
|------|------|-------|---------------|
| **A2: Runtime Engine** | [plan-A2-runtime-engine.md](plan-A2-runtime-engine.md) | `services/runtime/src/` | A0 + A1 complete |
| **B0: Company Editor UI** | [plan-B0-company-editor.md](plan-B0-company-editor.md) | `apps/web/src/features/company/`, `apps/web/src/pages/CompanyPage.tsx` | A0 + B3 complete | <!-- PR-2 ✅ [#36](https://github.com/NoeOsorio/agentFlow/pull/36) --> |
| **B1: Canvas Editor UI** | [plan-B1-canvas-editor.md](plan-B1-canvas-editor.md) | `apps/web/src/features/canvas/`, `apps/web/src/pages/CanvasPage.tsx` | A1 + B2 + B3 complete |

**Sub-agent isolation:** A2 → Python files in `services/runtime/`. B0 → `apps/web/src/features/company/`. B1 → `apps/web/src/features/canvas/`. Zero overlap.

---

## Wave 4 — Integration Layer (After Wave 3)

| Plan | File | Scope | Prerequisites |
|------|------|-------|---------------|
| **A3: API Layer** | [plan-A3-api-layer.md](plan-A3-api-layer.md) | `apps/api/src/` | A0 + A1 + A2 complete |
| **A4: Node Implementations** | [plan-A4-node-implementations.md](plan-A4-node-implementations.md) | `services/runtime/src/agentflow_runtime/nodes/` | A0 + A1 + A2 complete |

**Sub-agent isolation:** A3 → `apps/api/` (Python FastAPI). A4 → `services/runtime/nodes/` (Python). Zero overlap.

---

## Wave 5 — Execution Visualization (After Wave 4)

| Plan | File | Scope | Prerequisites |
|------|------|-------|---------------|
| **B4: Execution Visualization** | [plan-B4-execution-visualization.md](plan-B4-execution-visualization.md) | `apps/web/src/features/runs/` + minor `packages/ui/` updates | A3 + B3 complete |

B4 needs A3's WebSocket endpoints and B3's stores. It also updates `BaseNodeCard.tsx` from B2 — ensure B2 is complete first (guaranteed by wave order).

---

## Wave 6 — End-to-End Integration

Manual and automated integration work connecting all layers.

| Task | Description | Prerequisites |
|------|-------------|---------------|
| **CLI Smoke Test** | `agentflow apply -f acme-company.yaml` → `agentflow run feature-dev` → `agentflow logs <run_id>` end-to-end | All waves + C1 |
| **Alembic Final Migration** | `make migrate-new name=final_schema` after A3 confirms all model columns | A3 + C1 |
| **Full E2E Test** | Pipeline: Start → AgentPod(alice) → IF/ELSE → AgentPod(bob) → Template → End — with real LLM calls | All waves |
| **Budget Enforcement Test** | Set alice's budget to $0.001, run pipeline, verify `BudgetExceededError` | All waves |
| **Heartbeat Integration Test** | Verify heartbeat emitted from runtime, received by API, reflected in UI | A3 + B4 |

---

## Parallel Execution Summary

| Wave | Plans Running in Parallel | Max Sub-Agents |
|------|--------------------------|----------------|
| Wave 1 | A0, C1 | 2 |
| Wave 2 | A1, B2, B3 | 3 |
| Wave 3 | A2, B0, B1 | 3 |
| Wave 4 | A3, A4 | 2 |
| Wave 5 | B4 | 1 |
| Wave 6 | E2E tasks | 1-2 |

---

## Critical Path

The longest sequential chain:
```
A0 → A1 → A2 → A3 → B4
```
5 sequential steps. Everything else fills in around this spine.

Second critical path (frontend):
```
A0 → B3 → B0 (Company Editor)
A0 → A1 → B2 + B3 → B1 (Canvas)
```

---

## Sub-Agent Assignment Strategy

Assign by technical domain to minimize context-switching:

| Agent | Plans (in order) | Domain |
|-------|-----------------|--------|
| **Schema Agent** | A0 → A1 | TypeScript + Zod schemas |
| **Backend Agent** | (waits for A0+A1) → A2 → A3 → A4 | Python runtime + API |
| **Frontend Agent** | (waits for A0) → B2 + B3 → B0 + B1 → B4 | TypeScript + React |
| **Infra Agent** | C1 (parallel from Wave 1) | Docker + CI/CD + CLI |

---

## File Change Map (No Conflicts Between Simultaneous Plans)

| Plan | Files Modified |
|------|----------------|
| A0 | `packages/core/src/schema/resource.ts` (new), `packages/core/src/schema/company.ts` (new), `packages/core/src/index.ts` |
| A1 | `packages/core/src/schema/pipeline.ts`, `packages/core/src/schema/nodes.ts` (new), `packages/core/src/schema/variable.ts` (new), `packages/core/src/schema/conditions.ts` (new), `packages/core/src/schema/canvas.ts` (new), `packages/core/src/parser/index.ts` |
| A2 | `services/runtime/src/agentflow_runtime/` (all files) |
| A3 | `apps/api/src/agentflow_api/` (all files), `apps/api/migrations/` |
| A4 | `services/runtime/src/agentflow_runtime/nodes/` (new directory) |
| B0 | `apps/web/src/features/company/` (new), `apps/web/src/pages/CompanyPage.tsx` (new) |
| B1 | `apps/web/src/features/canvas/` (new), `apps/web/src/pages/CanvasPage.tsx` |
| B2 | `packages/ui/src/` (all files) |
| B3 | `apps/web/src/store/` (new directory) |
| B4 | `apps/web/src/features/runs/` (new), minor update to `packages/ui/src/nodes/BaseNodeCard.tsx` |
| C1 | `docker-compose.yml`, `infrastructure/k8s/`, `.github/workflows/`, `apps/api/Dockerfile`, `services/runtime/Dockerfile`, `apps/web/Dockerfile`, `packages/sdk/src/cli/` |

**Conflict alert:** B4 modifies `packages/ui/src/nodes/BaseNodeCard.tsx` (run status overlay). B2 creates this file. B2 is Wave 2, B4 is Wave 5 — no conflict possible by design.

---

## Plan Files Index

| Plan | File | Wave |
|------|------|------|
| A0: Company & Agent Schema | [plan-A0-company-agent-schema.md](plan-A0-company-agent-schema.md) | 1 |
| A1: Pipeline Schema & DSL | [plan-A1-schema-dsl.md](plan-A1-schema-dsl.md) | 2 |
| A2: Runtime Engine Enhancement | [plan-A2-runtime-engine.md](plan-A2-runtime-engine.md) | 3 |
| A3: API Layer | [plan-A3-api-layer.md](plan-A3-api-layer.md) | 4 |
| A4: Production Node Implementations | [plan-A4-node-implementations.md](plan-A4-node-implementations.md) | 4 |
| B0: Company Editor UI | [plan-B0-company-editor.md](plan-B0-company-editor.md) | 3 |
| B1: Canvas Editor UI | [plan-B1-canvas-editor.md](plan-B1-canvas-editor.md) | 3 |
| B2: Node UI Components | [plan-B2-node-components.md](plan-B2-node-components.md) | 2 |
| B3: State Management & YAML Sync | [plan-B3-state-management.md](plan-B3-state-management.md) | 2 |
| B4: Execution Visualization | [plan-B4-execution-visualization.md](plan-B4-execution-visualization.md) | 5 |
| C1: Infrastructure & DevOps | [plan-C1-infrastructure.md](plan-C1-infrastructure.md) | 1 |
