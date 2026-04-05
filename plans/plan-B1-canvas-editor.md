# Plan B1: Canvas Editor UI

## Overview
Build the full visual Pipeline Editor: drag-and-drop canvas with a company-agent-aware node palette, configurable side panel, custom edge types, auto-layout, and run overlay. The canvas knows which company is active and populates the AgentPod palette from the company's agents. Users see agents as first-class palette items — drag "Alice (Lead Engineer)" from the company section onto the canvas.

## Tech Context
- **Primary package:** `apps/web/`
- **New directory:** `apps/web/src/features/canvas/`
- **Depends on:**
  - `@agentflow/core` — node types, `CanvasMeta`, `Viewport`, `AgentSpec`
  - `@agentflow/ui` — node card components and config forms from Plan B2
  - `PipelineStore` and `CompanyStore` from Plan B3
- **Tech:** React 19, @xyflow/react 12.3, Zustand 5.0, Tailwind CSS 3.4, React Router v7, dagre

---

## Goals
- Full drag-and-drop node palette with company agents as first-class palette items
- Custom node components per type (delegates rendering to Plan B2)
- Side panel for node configuration (opens on node click)
- Company selector in pipeline header: "Using agents from: [acme-corp ▾]"
- Auto-layout (Dagre, left-to-right)
- Canvas toolbar: zoom, fit, layout, undo/redo, save
- Run overlay: animated node status from WebSocket (Plan B4 wires the events)
- Export/Import YAML (full Pipeline manifest)

---

## Checklist

### Phase 1: Project Structure
- [ ] **Create `apps/web/src/features/canvas/` feature folder**:
  - [ ] `index.ts` — re-exports
  - [ ] `CanvasEditor.tsx` — main canvas
  - [ ] `NodePalette.tsx` — left sidebar (company-aware)
  - [ ] `ConfigPanel.tsx` — right sidebar (node config)
  - [ ] `CanvasToolbar.tsx` — top toolbar
  - [ ] `PipelineHeader.tsx` — header with name, company selector, save, run
  - [ ] `YamlPanel.tsx` — right or bottom YAML editor
  - [ ] `hooks/` — canvas-specific hooks

- [ ] **Update `apps/web/src/pages/CanvasPage.tsx`**:
  - [ ] Load pipeline: `loadPipeline(id)` from PipelineStore on mount
  - [ ] Load company if `pipeline.company_ref` set
  - [ ] Show loading skeleton while fetching
  - [ ] Show error state if not found

### Phase 2: Company-Aware Node Palette
- [ ] **`apps/web/src/features/canvas/NodePalette.tsx`**:
  - [ ] **Section: Company Agents** (shown only when `pipelineStore.companyRef` is set):
    - Fetches agents from `companyStore.company.spec.agents`
    - One draggable item per agent: `[role-color avatar] Alice — Lead Engineer`
    - Drag creates `agent_pod` node with `agent_ref: { name: "alice" }` pre-filled
    - Shows agent's remaining budget as small badge: `$80 left`
    - Badge turns red if budget < 20% remaining
  - [ ] **Section: Control Flow**: Start, End, IF/ELSE, Iteration
  - [ ] **Section: AI & Models**: LLM (generic), Knowledge Retrieval
  - [ ] **Section: Data**: Code, Template, Variable Assigner, Variable Aggregator, HTTP Request
  - [ ] **Section: Integration**: Sub-Workflow, Human Input

  - [ ] Drag behavior: `onDragStart` sets `event.dataTransfer.setData("node-type", type)` + `event.dataTransfer.setData("agent-name", name)` for agent nodes
  - [ ] Filter search box at top of palette

- [ ] **Handle agent-type drop in `CanvasEditor.tsx`**:
  - [ ] Read `node-type` + `agent-name` from `dataTransfer`
  - [ ] If `agent-name` present: `addNode("agent_pod", position, { agent_ref: { name: agentName } })`
  - [ ] Else: `addNode(nodeType, position)`

### Phase 3: Custom Node Types Registration
- [ ] **`apps/web/src/features/canvas/nodeTypes.ts`**:
  - [ ] Export `nodeTypes` for React Flow — all 14 node types mapped to components from Plan B2

- [ ] **`apps/web/src/features/canvas/edgeTypes.ts`**:
  - [ ] `DefaultEdge` — animated, with delete button on hover
  - [ ] `ConditionalEdge` — distinct color per branch, branch label tooltip

### Phase 4: Canvas Editor Core
- [ ] **`apps/web/src/features/canvas/CanvasEditor.tsx`**:
  - [ ] Reads `nodes`, `edges`, `viewport` from PipelineStore
  - [ ] `onNodesChange` → `updateNodePositions(changes)`
  - [ ] `onEdgesChange` → `updateEdges(changes)`
  - [ ] `onConnect(connection)` → validate connection → `addEdge(connection)`
  - [ ] `onNodeClick` → `selectNode(node.id)`
  - [ ] `onPaneClick` → `deselectNode()`
  - [ ] `snapToGrid`, `snapGrid={[16, 16]}`
  - [ ] React Flow children: `<Background />`, `<Controls />`, `<MiniMap />`, `<CanvasToolbar />`

- [ ] **Connection Validation in `onConnect`**:
  - [ ] Start node has no inputs
  - [ ] End node has no outputs
  - [ ] IF/ELSE nodes must have labeled `source_handle` (branch ID)
  - [ ] Show visual X on invalid drop target handles (React Flow `isValidConnection`)

### Phase 5: Configuration Side Panel
- [ ] **`apps/web/src/features/canvas/ConfigPanel.tsx`**:
  - [ ] Reads `selectedNodeId` from PipelineStore
  - [ ] Slides in from right when node selected
  - [ ] Header: node type icon + editable label + node ID (read-only small text)
  - [ ] Body: renders `nodeConfigForms[node.type]` component (from Plan B2)
  - [ ] For `agent_pod` nodes: shows `AgentSelector` dropdown (lists company agents)
  - [ ] Validation errors for this node shown at top (from `useNodeValidationErrors(nodeId)`)
  - [ ] Footer: "Delete Node" button with confirmation

- [ ] **`apps/web/src/features/canvas/nodeConfigForms.ts`**:
  - [ ] Maps each node type to its config form from Plan B2

### Phase 6: Pipeline Header with Company Selector
- [ ] **`apps/web/src/features/canvas/PipelineHeader.tsx`**:
  - [ ] Pipeline name: inline editable `<input>` (on blur: `setPipelineName`)
  - [ ] **Company Selector**: `CompanySelector` component:
    - Dropdown fetching `GET /api/companies/`
    - Shows: "Using agents from: [acme-corp ▾]"
    - On select: `setCompanyRef({ name, namespace })`
    - "No company" option: disables Agent section in palette, removes agent validation
  - [ ] Save status badge: `draft` / `saving...` / `saved` / `error`
  - [ ] "Save" button → `savePipeline()`
  - [ ] "Run" button → opens `RunTriggerModal` (Plan B4)
  - [ ] "Export YAML" → downloads `pipeline.yaml`
  - [ ] "Import YAML" → file picker → `setYamlSpec(content)`
  - [ ] "Open YAML Panel" toggle → `toggleYamlPanel()`
  - [ ] Back arrow → `/pipelines`

### Phase 7: Canvas Toolbar
- [ ] **`apps/web/src/features/canvas/CanvasToolbar.tsx`**:
  - [ ] Zoom in / out / fit view
  - [ ] Auto-layout (Dagre LR): `pnpm --filter @agentflow/web add dagre @types/dagre`
    - Node size: 240×80px, separation: 60px H, 40px V
    - Dispatches `setNodePositions(computed)`
  - [ ] Undo / Redo (reads `canUndo`, `canRedo` from PipelineStore)
  - [ ] Toggle minimap

### Phase 8: Keyboard Shortcuts
- [ ] **`apps/web/src/features/canvas/hooks/useKeyboardShortcuts.ts`**:
  - [ ] `Delete` / `Backspace` → delete selected nodes/edges
  - [ ] `Escape` → deselect all
  - [ ] `Ctrl+Z` / `Cmd+Z` → undo
  - [ ] `Ctrl+Shift+Z` / `Cmd+Shift+Z` → redo
  - [ ] `Ctrl+S` / `Cmd+S` → save pipeline
  - [ ] `Space` → fit view

### Phase 9: YAML Panel
- [ ] **`apps/web/src/features/canvas/YamlPanel.tsx`**:
  - [ ] Monaco Editor in YAML mode showing live `yamlSpec`
  - [ ] On user edit (debounced 300ms): `setYamlSpec(newYaml)`
  - [ ] Error gutter markers from `yamlErrors`
  - [ ] Read-only when run active
  - [ ] Copy, download, format buttons

### Phase 10: Pipelines List Page
- [ ] **Update `apps/web/src/pages/PipelinesPage.tsx`**:
  - [ ] Fetch pipelines from API on mount
  - [ ] Pipeline cards: name, company badge, last run status, agent count
  - [ ] "New Pipeline" → `POST /api/pipelines/` with default YAML → `/canvas/{id}`
  - [ ] Delete pipeline (confirmation)
  - [ ] Filter by company

---

## Acceptance Criteria
- Dragging "Alice (Lead Engineer)" from company palette creates `agent_pod` node with `agent_ref: { name: "alice" }` pre-filled
- Company Selector dropdown shows all companies; selecting one populates company palette section
- `agent_pod` node with `agent_ref` pointing to non-existent agent shows red validation error
- Auto-layout rearranges nodes cleanly
- Save persists to API and shows "saved" badge
- Export YAML downloads valid `apiVersion: agentflow.ai/v1` Pipeline manifest
- Keyboard shortcuts work

---

## Deliverable

Upon completion of Plan B1, you will have:

**1. Full Pipeline Editor** (`/pipelines/:id`):
- Drag-and-drop canvas with company agents as first-class palette items
- Company selector in header — switch which company's agents are available
- Right panel config forms for all 14 node types
- Live YAML panel synced bidirectionally

**2. Company-Aware Agent Nodes**:
> User selects "acme-corp" in Company Selector → Palette shows Alice (Lead Engineer, $80 left), Bob (CEO, $120 left), Carol (Designer, $60 left) → Drag Alice → canvas creates `AgentPod[alice]` node → click it → Config panel shows alice's role, model, persona (read-only from company)

**3. Pipelines List** (`/pipelines`):
- Pipeline cards showing company badge and last run status

---

## Routing

### This plan enables:
- **[Plan B4](plan-B4-execution-visualization.md)** — execution overlay mounts inside CanvasEditor

### This plan depends on:
- **[Plan B2](plan-B2-node-components.md)** — all node card components and config forms
- **[Plan B3](plan-B3-state-management.md)** — PipelineStore and CompanyStore
