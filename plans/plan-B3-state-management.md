# Plan B3: State Management & YAML Sync

## Overview
Implement two Zustand stores: `CompanyStore` for company/agent state and `PipelineStore` for pipeline canvas state. Both support bidirectional YAML sync, auto-save, and undo/redo. The pipeline store references agents from the active company. The company store tracks live agent budgets and heartbeat status. This is the frontend "brain" — all canvas and company editor reads/writes go through these stores.

## Tech Context
- **Primary package:** `apps/web/`
- **Key directory:** `apps/web/src/store/`
- **Depends on:** `@agentflow/core` — `parseResource`, `serializeResource`, `validateResource`, `parsePipeline`, `serializePipeline`, `Company`, `Pipeline`, `AgentSpec`, `PipelineNode`, `PipelineEdge`, `CanvasMeta`, `resolveAgent`
- **Tech:** Zustand 5.0, React 19, TypeScript 5.7

---

## Goals
- `CompanyStore`: manage company YAML, agent definitions, live budget/heartbeat state
- `PipelineStore`: manage pipeline canvas (nodes, edges), YAML sync, auto-save, undo/redo
- Pipeline store knows which company is active; validates `agent_ref` against company agents
- `useVariableScope(nodeId)` hook: returns upstream variables available at a node
- `useNodeValidationErrors(nodeId)` hook: returns validation errors for a specific node
- `useAgentBudget(agentName)` hook: returns live budget data from company store

---

## Checklist

### Phase 1: Shared Types
- [ ] **Create `apps/web/src/store/types.ts`**:
  - [ ] `CanvasNode` — extends `@xyflow/react Node<PipelineNode>` with `position: NodePosition`
  - [ ] `CanvasEdge` — extends `@xyflow/react Edge<PipelineEdge>`
  - [ ] `NodeValidationError` — `{ nodeId: string, field: string, message: string }`
  - [ ] `NodeRunStatus` — `"idle" | "running" | "completed" | "failed" | "skipped"`
  - [ ] `NodeRunState` — `{ status, startedAt?, finishedAt?, tokensUsed?, costUsd?, output?, error? }`
  - [ ] `AgentBudgetState` — `{ agentName, spentUsd, budgetUsd, remainingUsd, pctUsed, month }`
  - [ ] `AgentHealthState` — `{ agentName, healthStatus: "healthy"|"degraded"|"dead"|"unknown", lastHeartbeatAt: Date | null }`
  - [ ] `HistoryEntry` — `{ nodes: CanvasNode[], edges: CanvasEdge[], yamlSpec: string, timestamp: number }`

### Phase 2: Company Store
- [ ] **Create `apps/web/src/store/companyStore.ts`**:

  **State shape:**
  ```ts
  interface CompanyStore {
    // Company metadata
    companyId: string | null
    companyName: string
    namespace: string
    company: Company | null          // parsed Company object
    saveStatus: "idle" | "saving" | "saved" | "error"

    // YAML state
    yamlSpec: string
    yamlValid: boolean
    yamlErrors: string[]

    // Live agent state (populated from API)
    agentBudgets: Record<string, AgentBudgetState>
    agentHealth: Record<string, AgentHealthState>

    // Actions
    loadCompany(id: string): Promise<void>
    saveCompany(): Promise<void>
    setYamlSpec(yaml: string): void  // triggers visual re-render
    addAgent(agentSpec: AgentSpec): void
    updateAgent(agentName: string, patch: Partial<AgentSpec>): void
    deleteAgent(agentName: string): void
    setAgentBudget(agentName: string, budget: AgentBudgetState): void
    setAgentHealth(agentName: string, health: AgentHealthState): void
    refreshBudgets(): Promise<void>  // fetches GET /api/companies/{id}/agents
  }
  ```

  - [ ] **`setYamlSpec(yaml)`**:
    - Call `validateResource(yaml)` from `@agentflow/core`
    - If invalid: set `yamlErrors`, stop
    - If valid: parse with `parseResource(yaml)` → `Company` object
    - Update `company`, `companyName`, `namespace`
    - Re-sync agents: `company.spec.agents`

  - [ ] **`addAgent(agentSpec)`**:
    - Mutates `company.spec.agents` array (immutably)
    - Calls `serializeResource(company)` to update `yamlSpec`
    - Triggers `_scheduleSave()`

  - [ ] **`updateAgent(agentName, patch)`**:
    - Finds agent by name, merges patch
    - Re-serializes YAML

  - [ ] **`deleteAgent(agentName)`**:
    - Removes from `company.spec.agents`
    - Warns if referenced by any pipeline (via cross-store check — reads `pipelineStore.nodes`)

  - [ ] **`_scheduleSave()`**: debounced 500ms → `saveCompany()`
  - [ ] **`saveCompany()`**: `PUT /api/companies/{id}` with `yaml_spec`

### Phase 3: Pipeline Store
- [ ] **Create `apps/web/src/store/pipelineStore.ts`**:

  **State shape:**
  ```ts
  interface PipelineStore {
    // Pipeline metadata
    pipelineId: string | null
    pipelineName: string
    namespace: string
    companyRef: { name: string, namespace?: string } | null  // linked company
    saveStatus: "idle" | "saving" | "saved" | "error"

    // Canvas state
    nodes: CanvasNode[]
    edges: CanvasEdge[]
    selectedNodeId: string | null
    viewport: Viewport

    // YAML state
    yamlSpec: string
    yamlValid: boolean
    yamlErrors: NodeValidationError[]
    yamlPanelOpen: boolean

    // History
    history: HistoryEntry[]
    historyIndex: number
    canUndo: boolean
    canRedo: boolean

    // Run state
    activeRunId: string | null
    nodeRunStates: Record<string, NodeRunState>

    // Actions
    addNode(type: string, position: NodePosition): void
    updateNodeConfig(nodeId: string, patch: Partial<PipelineNode>): void
    deleteNode(nodeId: string): void
    addEdge(connection: Connection): void
    deleteEdge(edgeId: string): void
    updateNodePositions(changes: NodeChange[]): void
    selectNode(nodeId: string): void
    deselectNode(): void
    setPipelineName(name: string): void
    setCompanyRef(ref: CompanyReference | null): void
    setYamlSpec(yaml: string): void
    toggleYamlPanel(): void
    setViewport(viewport: Viewport): void
    setNodePositions(positions: Record<string, NodePosition>): void
    undo(): void
    redo(): void
    savePipeline(): Promise<void>
    loadPipeline(id: string): Promise<void>
    setActiveRun(runId: string | null): void
    updateNodeRunState(nodeId: string, state: Partial<NodeRunState>): void
    clearRunStates(): void
  }
  ```

  - [ ] **`addNode(type, position)`**:
    - Generate ID: `${type}_${nanoid(6)}`
    - For `agent_pod` type: default `agent_ref = null` (user picks agent via ConfigPanel)
    - Dispatch `_syncNodesToYaml()`
    - Push history

  - [ ] **`setCompanyRef(ref)`**:
    - Sets `companyRef` in store
    - Validates all existing `agent_pod` nodes: their `agent_ref.name` must exist in referenced company
    - Sets `yamlErrors` for nodes referencing unknown agents

### Phase 4: Bidirectional YAML Sync (Pipeline)
- [ ] **`_syncNodesToYaml()`** (canvas → YAML):
  - Build `Pipeline` object from `{ nodes, edges, companyRef, pipelineName, canvas_meta }`
  - Call `serializePipeline(pipeline)` from `@agentflow/core`
  - Validate: `validatePipeline(yamlSpec)`
  - Set `yamlSpec`, `yamlErrors`
  - Debounced `_scheduleSave()`

- [ ] **`setYamlSpec(yaml)`** (YAML → canvas):
  - `validatePipeline(yaml)` — if invalid: set errors, do NOT update canvas
  - `parsePipeline(yaml)` → `Pipeline`
  - Convert `Pipeline.spec.nodes` → `CanvasNode[]` with positions from `canvas_meta`
  - Update `companyRef` from `Pipeline.spec.company_ref`
  - Push to history

### Phase 5: Undo/Redo
- [ ] `_pushHistory()` — snapshot `{ nodes, edges, yamlSpec }`, max 50 entries
- [ ] `undo()` — decrement `historyIndex`, restore state
- [ ] `redo()` — increment `historyIndex`, restore state
- [ ] `canUndo` / `canRedo` — derived from `historyIndex` vs array bounds

### Phase 6: Variable Scope Tracking
- [ ] **Create `apps/web/src/store/variableScope.ts`**:
  - [ ] `computeVariableScope(nodes, edges, forNodeId) -> AvailableVariable[]`:
    - Topological sort → find all upstream ancestor nodes of `forNodeId`
    - For each ancestor: derive output variable schema by node type:
      - `start` → from `node.outputs` list
      - `agent_pod` → `{ response: string, agent_name: string, agent_role: string }`
      - `llm` → `{ text: string, tokens_used: number }`
      - `code` → from `node.outputs` list
      - `http` → `{ status_code: number, body: object, headers: object }`
      - `template` → `{ text: string }`
    - Returns `AvailableVariable[]`: `{ node_id, variable, path?, type, description }`
  - [ ] Detects cycles (topological sort fails on cycle → returns empty array + logs warning)

- [ ] **`useVariableScope(nodeId: string)` hook** — `useMemo`-wrapped call to `computeVariableScope`

### Phase 7: Pipeline Validation with Agent Ref Checks
- [ ] **`_validatePipeline()`** — runs after every change:
  - Calls `validatePipeline(yamlSpec)` from `@agentflow/core`
  - **Additional checks:**
    - Exactly one `start` node
    - At least one `end` node
    - No cycles in DAG
    - `if_else` nodes have ≥ 2 outgoing edges
    - **Agent ref validation**: for each `agent_pod` node, `agent_ref.name` must exist in `companyStore.company.spec.agents`
    - All `VariableReference` targets exist as upstream nodes
  - Maps errors to `NodeValidationError[]` with `nodeId` extracted from Zod error paths

- [ ] **`useNodeValidationErrors(nodeId: string)` hook** — filters `yamlErrors` for specific node
- [ ] **`useAgentBudget(agentName: string)` hook** — reads `companyStore.agentBudgets[agentName]`
- [ ] **`useAgentHealth(agentName: string)` hook** — reads `companyStore.agentHealth[agentName]`

### Phase 8: YAML Panel State (Pipeline)
- [ ] `yamlPanelOpen: boolean`, `yamlPanelWidth: number` (default 400px)
- [ ] `toggleYamlPanel()`, `setYamlPanelWidth(width)`
- [ ] **`apps/web/src/features/canvas/YamlPanel.tsx`** — Monaco YAML editor synced to `yamlSpec`

### Phase 9: Company Store Budget Polling
- [ ] **`refreshBudgets()`** — fetches `GET /api/companies/{id}/agents` and updates `agentBudgets`
- [ ] Auto-refresh: every 60 seconds when company page is open
- [ ] Subscribe to WebSocket `GET /api/ws/companies/{id}/agents` for live heartbeat updates

### Phase 10: Tests
- [ ] **`apps/web/src/store/__tests__/companyStore.test.ts`**:
  - [ ] `setYamlSpec` with valid Company YAML updates `company.spec.agents`
  - [ ] `addAgent` serializes back to valid YAML
  - [ ] `deleteAgent` removes agent and re-serializes
  - [ ] Invalid YAML sets `yamlErrors` without clearing `company`
- [ ] **`apps/web/src/store/__tests__/pipelineStore.test.ts`**:
  - [ ] `addNode("agent_pod", ...)` creates node with null `agent_ref`
  - [ ] `setCompanyRef` validates existing `agent_pod` nodes
  - [ ] `setYamlSpec` with invalid YAML → errors set, canvas unchanged
  - [ ] Undo/redo restores previous state
  - [ ] `_validatePipeline` flags `agent_pod` node with unknown `agent_ref`
- [ ] **`apps/web/src/store/__tests__/variableScope.test.ts`**:
  - [ ] `agent_pod` node outputs include `response`, `agent_name`, `agent_role`
  - [ ] Scope for node C (after A and B in parallel) includes outputs from both A and B

---

## Acceptance Criteria
- Adding an agent via Company Editor immediately reflects in YAML panel
- Editing Pipeline YAML with valid `company_ref` updates canvas `companyRef`
- `agent_pod` node with unknown `agent_ref` shows validation error
- `useVariableScope("plan_node")` returns `agent_pod` outputs correctly
- `useAgentBudget("alice")` returns current budget from company store
- Undo restores previous canvas state
- Auto-save triggers 500ms after last change
- `pnpm --filter @agentflow/web build` passes with zero type errors

---

## Deliverable

Upon completion of Plan B3, you will have:

**1. CompanyStore** — reactive state for company and agents:
- Load, edit, save Company YAML bidirectionally
- Live agent budget state (`useAgentBudget` hook)
- Live agent health state (`useAgentHealth` hook)

**2. PipelineStore** — reactive state for pipeline canvas:
- Bidirectional sync: canvas ↔ YAML
- Company reference tracking with agent validation
- Undo/redo (50-entry history stack)
- Auto-save (debounced 500ms)

**3. Hooks**:
- `useVariableScope(nodeId)` — upstream variable discovery
- `useNodeValidationErrors(nodeId)` — per-node error list
- `useAgentBudget(agentName)` — live budget data
- `useAgentHealth(agentName)` — live heartbeat status

---

## Routing

### This plan enables (must complete B3 before starting):
- **[Plan B0](plan-B0-company-editor.md)** — Company Editor reads/writes CompanyStore
- **[Plan B1](plan-B1-canvas-editor.md)** — Canvas Editor reads/writes PipelineStore
- **[Plan B4](plan-B4-execution-visualization.md)** — Execution viz reads `activeRunId`, `nodeRunStates` from PipelineStore

### This plan depends on:
- **[Plan A0](plan-A0-company-agent-schema.md)** — `Company`, `AgentSpec`, `parseResource`, `serializeResource`, `validateResource`
- **[Plan A1](plan-A1-schema-dsl.md)** — `Pipeline`, `PipelineNode`, `PipelineEdge`, `CanvasMeta`, `parsePipeline`, `serializePipeline`, `validatePipeline`
