# Merge Order — B0 to B4 Sub-PRs

Complementa el [execution-order.md](execution-order.md) con el desglose granular de sub-PRs dentro de cada plan B.

---

## Diagrama de merge order

```mermaid
graph LR
  B2PR1["B2-PR-1: Base node infrastructure"]
  B2PR2["B2-PR-2: AgentPodNodeCard + AgentSelector"]
  B2PR3["B2-PR-3: 13 node cards restantes"]
  B2PR4["B2-PR-4: Form widgets + exports"]

  B3PR1["B3-PR-1: Shared types + CompanyStore"]
  B3PR2["B3-PR-2: PipelineStore + YAML sync"]
  B3PR3["B3-PR-3: Variable scope + hooks"]
  B3PR4["B3-PR-4: Tests + budget polling"]

  B0PR1["B0-PR-1: Routes + Companies list"]
  B0PR2["B0-PR-2: Company detail + Agent cards + OrgChart"]
  B0PR3["B0-PR-3: AgentFormModal + CompanySelector + completos"]

  B1PR1["B1-PR-1: Canvas structure + nodeTypes"]
  B1PR2["B1-PR-2: CanvasEditor core + NodePalette"]
  B1PR3["B1-PR-3: ConfigPanel + PipelineHeader + Toolbar"]
  B1PR4["B1-PR-4: YamlPanel + PipelinesPage"]

  B4PR1["B4-PR-1: WebSocket hooks"]
  B4PR2["B4-PR-2: Node overlay + logs"]
  B4PR3["B4-PR-3: Budget + Heartbeat + Controls + Approval"]
  B4PR4["B4-PR-4: Run summary + Dashboard + History"]

  %% B2 chain
  B2PR1 --> B2PR2
  B2PR1 --> B2PR3
  B2PR2 --> B2PR4
  B2PR3 --> B2PR4

  %% B3 chain
  B3PR1 --> B3PR2
  B3PR2 --> B3PR3
  B3PR3 --> B3PR4

  %% B2 and B3 run in parallel (both Wave 2)

  %% B0 chain (Wave 3, needs B3PR1)
  B3PR1 --> B0PR1
  B0PR1 --> B0PR2
  B2PR2 --> B0PR2
  B0PR2 --> B0PR3
  B3PR1 --> B0PR3

  %% B1 chain (Wave 3, needs B2PR4 + B3PR2 + B0PR3)
  B2PR4 --> B1PR1
  B2PR3 --> B1PR1
  B3PR2 --> B1PR2
  B3PR1 --> B1PR2
  B1PR1 --> B1PR2
  B0PR3 --> B1PR2
  B1PR2 --> B1PR3
  B2PR4 --> B1PR3
  B3PR3 --> B1PR3
  B1PR3 --> B1PR4
  B3PR2 --> B1PR4

  %% B4 chain (Wave 5, needs A3 + B3PR2 + B2PR1)
  B3PR2 --> B4PR1
  B3PR1 --> B4PR1
  B4PR1 --> B4PR2
  B2PR1 --> B4PR2
  B4PR2 --> B4PR3
  B3PR1 --> B4PR3
  B4PR3 --> B4PR4
```

**Leyenda:** `A --> B` significa B no puede mergearse hasta que A esté mergeado.
Parallel = los PRs sin flecha entre ellos pueden mergearse independientemente.

---

## Secuencia recomendada de merge

### Fase 1 — Foundations (paralelo máximo)
Estos pueden trabajarse simultáneamente en ramas independientes:

| PR | Rama | Prerequisito externo |
|----|------|----------------------|
| B2-PR-1 | `feat/B2-PR-1-base-node-infrastructure` | A0 + A1 mergeados |
| B3-PR-1 | `feat/B3-PR-1-company-store` | A0 mergeado |

### Fase 2 — Core components (dos chains paralelas)

**Chain B2:**
1. B2-PR-2 (depende de B2-PR-1)
2. B2-PR-3 (depende de B2-PR-1, paralelo con B2-PR-2)
3. B2-PR-4 (depende de B2-PR-2 + B2-PR-3)

**Chain B3:**
1. B3-PR-2 (depende de B3-PR-1 + A1)
2. B3-PR-3 (depende de B3-PR-2)
3. B3-PR-4 (depende de B3-PR-3, leaf)

### Fase 3 — Feature editors (dos chains paralelas)

**Chain B0 (Company Editor):**
1. B0-PR-1 (depende de B3-PR-1)
2. B0-PR-2 (depende de B0-PR-1 + B2-PR-2)
3. B0-PR-3 (depende de B0-PR-2 + B3-PR-1)

**Chain B1 (Canvas Editor) — empieza cuando B2-PR-4 + B3-PR-2 + B0-PR-3 listos:**
1. B1-PR-1 (depende de B2-PR-3 + B2-PR-4)
2. B1-PR-2 (depende de B1-PR-1 + B3-PR-2 + B3-PR-1 + B0-PR-3)
3. B1-PR-3 (depende de B1-PR-2 + B2-PR-4 + B3-PR-3)
4. B1-PR-4 (depende de B1-PR-3 + B3-PR-2, leaf)

### Fase 4 — Execution visualization (Wave 5)

Empieza cuando A3 + B3-PR-2 + B2-PR-1 están mergeados:

1. B4-PR-1 (depende de B3-PR-2 + B3-PR-1 + A3)
2. B4-PR-2 (depende de B4-PR-1 + B2-PR-1)
3. B4-PR-3 (depende de B4-PR-2 + B3-PR-1)
4. B4-PR-4 (depende de B4-PR-3, leaf)

---

## Tabla de commit messages

| PR | Commit |
|----|--------|
| B2-PR-1 | `feat(ui/nodes): BaseNodeCard + NodeHandle + color map [B2-PR-1]` |
| B2-PR-2 | `feat(ui/nodes): AgentPodNodeCard con role badge, budget bar y AgentSelector [B2-PR-2]` |
| B2-PR-3 | `feat(ui/nodes): 13 node cards para control flow, AI, data e integración [B2-PR-3]` |
| B2-PR-4 | `feat(ui/forms): widgets compartidos, config forms y exports del paquete [B2-PR-4]` |
| B3-PR-1 | `feat(web/store): tipos compartidos de store y CompanyStore con YAML sync [B3-PR-1]` |
| B3-PR-2 | `feat(web/store): PipelineStore con YAML sync bidireccional, undo/redo y auto-save [B3-PR-2]` |
| B3-PR-3 | `feat(web/store): variable scope tracker, validation hooks y agent budget hooks [B3-PR-3]` |
| B3-PR-4 | `test(web/store): suite de tests completa y budget polling WebSocket [B3-PR-4]` |
| B0-PR-1 | `feat(web/company): routes, navegación global y Companies list page [B0-PR-1]` |
| B0-PR-2 | `feat(web/company): CompanyPage con AgentGrid y OrgChart interactivo [B0-PR-2]` |
| B0-PR-3 | `feat(web/company): AgentFormModal, YAML panel, BudgetOverview y CompanySelector [B0-PR-3]` |
| B1-PR-1 | `feat(web/canvas): estructura canvas feature, nodeTypes/edgeTypes y CanvasPage [B1-PR-1]` |
| B1-PR-2 | `feat(web/canvas): CanvasEditor con React Flow y NodePalette con company agents [B1-PR-2]` |
| B1-PR-3 | `feat(web/canvas): ConfigPanel, PipelineHeader con CompanySelector, toolbar y shortcuts [B1-PR-3]` |
| B1-PR-4 | `feat(web/canvas): YamlPanel Monaco bidireccional y PipelinesPage [B1-PR-4]` |
| B4-PR-1 | `feat(web/runs): useRunWebSocket y useCompanyAgentWebSocket con agent identity [B4-PR-1]` |
| B4-PR-2 | `feat(web/runs): node overlay con agent identity, RunLogPanel y logsStore [B4-PR-2]` |
| B4-PR-3 | `feat(web/runs): AgentBudgetPanel, HeartbeatSidebar, RunControlsBar y ApprovalModal [B4-PR-3]` |
| B4-PR-4 | `feat(web/runs): RunSummaryCard, CompanyDashboardPage y RunHistorySidebar [B4-PR-4]` |

---

## PRs hoja (sin dependencias downstream dentro de B)

Estos pueden mergearse en cualquier momento una vez que sus prerequisitos estén listos:

- B3-PR-4 — tests y polling (leaf de B3)
- B1-PR-4 — YAML panel y pipelines list (leaf de B1)
- B4-PR-4 — run summary y dashboard (leaf de B4, y de todo el proyecto frontend)

---

## Critical path (frontend B)

```
A0 → B3-PR-1 → B3-PR-2 → B4-PR-1 → B4-PR-2 → B4-PR-3 → B4-PR-4
```

Segunda cadena crítica (canvas completo):
```
A0+A1 → B2-PR-1 → B2-PR-2 → B2-PR-4 → B1-PR-1 → B1-PR-2 → B1-PR-3 → B1-PR-4
```
