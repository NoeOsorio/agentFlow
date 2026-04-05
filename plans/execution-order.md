# Execution Order — AgentFlow Implementation Plans

This document defines the recommended execution order for all 11 implementation plans, organized by dependency waves. Plans within the same wave can run **fully in parallel** across independent sub-agents.

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
| **B0: Company Editor UI** | [plan-B0-company-editor.md](plan-B0-company-editor.md) | `apps/web/src/features/company/`, `apps/web/src/pages/CompanyPage.tsx` | A0 + B3 complete |
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
