# Plan B4: Execution Visualization & Run UI

## Overview
Build real-time execution visualization: WebSocket-driven node status overlays showing which **company agent** is executing, an agent-aware event log, per-agent budget deduction in real time, heartbeat status sidebar, human approval modal, and run controls. Users see the pipeline execute live with agent identities — "Alice (Lead Engineer) is thinking..." — not just abstract node IDs.

## Tech Context
- **Primary package:** `apps/web/`
- **New directories:** `apps/web/src/features/runs/`, `apps/web/src/store/`
- **Depends on:**
  - Plan A3 WebSocket: `ws://localhost:8000/api/ws/runs/{run_id}` (events include `agent_name`, `agent_role`)
  - Plan A3 company agent WebSocket: `ws://localhost:8000/api/ws/companies/{id}/agents`
  - Plan A3 approval endpoint: `POST /api/runs/{run_id}/approve/{node_id}`
  - Plan B3 `PipelineStore`: `activeRunId`, `nodeRunStates`, `updateNodeRunState`, `setActiveRun`
  - Plan B3 `CompanyStore`: `agentBudgets`, `agentHealth`, `setAgentBudget`, `setAgentHealth`
- **Tech:** React 19, Zustand 5.0, Tailwind CSS 3.4, native WebSocket API

---

## Goals
- Live animated overlays on canvas nodes showing executing agent name and role
- Company Dashboard: all agents' status across all active pipelines
- Per-agent real-time budget deduction (balance updates as each node completes)
- Heartbeat status sidebar: which agents are alive/busy/idle
- Agent-aware execution log: `[Alice/Lead Engineer] plan_node completed — 1,234 tokens — $0.0037`
- Human approval modal with agent context
- Run controls: pause, resume, stop
- Run summary card showing per-agent cost breakdown

---

## Checklist

### Phase 1: WebSocket Hook with Agent Identity
- [ ] **Create `apps/web/src/features/runs/hooks/useRunWebSocket.ts`**:
  - [ ] Connects to `ws://localhost:8000/api/ws/runs/{runId}`
  - [ ] Parses `StreamEvent` — now includes `agent_name`, `agent_role`, `company_name`
  - [ ] Dispatches to PipelineStore:
    - `node_start` → `updateNodeRunState(nodeId, { status: "running", startedAt, agentName, agentRole })`
    - `node_complete` → `updateNodeRunState(nodeId, { status: "completed", finishedAt, tokensUsed, costUsd, agentName })`
    - `node_error` → `updateNodeRunState(nodeId, { status: "failed", error, agentName })`
    - `pipeline_complete` → `setActiveRun(null)`, dispatch summary
  - [ ] Dispatches to CompanyStore on `node_complete`:
    - `setAgentBudget(agentName, updatedBudget)` — deduct `costUsd` from agent's remaining budget
  - [ ] Reconnects with exponential backoff (5 attempts)
  - [ ] Returns `{ connectionStatus, lastEvent }`

### Phase 2: Company Agent Heartbeat WebSocket
- [ ] **Create `apps/web/src/features/runs/hooks/useCompanyAgentWebSocket.ts`**:
  - [ ] Connects to `ws://localhost:8000/api/ws/companies/{companyId}/agents`
  - [ ] Parses `{ agent_name, status, last_heartbeat, current_run_id }` events
  - [ ] Dispatches `setAgentHealth(agentName, { healthStatus, lastHeartbeatAt })` to CompanyStore
  - [ ] Auto-subscribes when CompanyStore `companyId` is set

### Phase 3: Node Run Status Overlay (Agent-Aware)
- [ ] **Update `packages/ui/src/nodes/BaseNodeCard.tsx`** — add agent identity display during run:
  - [ ] `running` state: show `"[agent role] is thinking..."` below node label (reads from `data.runStatus.agentName` + `data.runStatus.agentRole`)
  - [ ] `completed` state: show `"✓ [agent role] — {tokens} tokens"` micro-badge
  - [ ] `failed` state: red ring + tooltip with error + agent name

- [ ] **`apps/web/src/features/canvas/hooks/useNodeRunStatus.ts`**:
  - [ ] Returns `NodeRunState` for a given `nodeId` from PipelineStore

### Phase 4: Execution Log Panel (Agent-Aware)
- [ ] **Create `apps/web/src/features/runs/RunLogPanel.tsx`**:
  - [ ] Bottom drawer (toggle with "Logs" tab)
  - [ ] Log entries format:
    ```
    [14:23:05.120] 👤 Alice (Lead Engineer) — plan_node  running
    [14:23:08.440] 👤 Alice (Lead Engineer) — plan_node  ✓ completed  1,234 tokens  $0.0037
    [14:23:08.442] 👤 Bob (CEO) — review_node  running
    [14:23:11.200] 👤 Bob (CEO) — review_node  ✓ completed  890 tokens  $0.0134
    [14:23:11.201] 🏁 Pipeline completed  $0.0171  2,124 tokens  3.1s
    ```
  - [ ] Color: yellow=running, green=completed, red=failed, gray=info
  - [ ] Auto-scroll, filter (All/Errors/Completed), clear button

- [ ] **Create `apps/web/src/store/logsStore.ts`**:
  - [ ] `logs: LogEntry[]`
  - [ ] `addLog(entry)`, `clearLogs()`
  - [ ] `LogEntry` includes `agentName`, `agentRole`, `nodeId`, `status`, `tokensUsed`, `costUsd`

### Phase 5: Per-Agent Real-Time Budget Tracker
- [ ] **Create `apps/web/src/features/runs/AgentBudgetPanel.tsx`**:
  - [ ] Shows during active run (and after completion)
  - [ ] One row per agent that participated:
    ```
    👤 Alice (Lead Engineer)   ████████░░  $4.50 spent  $95.50 remaining
    👤 Bob (CEO)               ██████████  $150.00 spent  $0 remaining (EXCEEDED)
    ```
  - [ ] Updates in real-time as `node_complete` events arrive
  - [ ] Red row when budget exceeded
  - [ ] "Monthly total" row at bottom

- [ ] **Create `apps/web/src/features/runs/RunMetricsBar.tsx`**:
  - [ ] Shown in pipeline header during/after run
  - [ ] `Total Tokens: 3,240 | Est. Cost: $0.0097 | Duration: 12.4s`
  - [ ] Updates live

### Phase 6: Heartbeat Status Sidebar
- [ ] **Create `apps/web/src/features/runs/HeartbeatSidebar.tsx`**:
  - [ ] Toggle panel (right side, "Agents" tab)
  - [ ] One card per company agent:
    ```
    ● Alice  Lead Engineer  [BUSY — plan_node]   Last ♥ 5s ago
    ○ Bob    CEO            [IDLE]               Last ♥ 12s ago
    ✗ Carol  Designer       [DEAD]               Last ♥ 8m ago
    ```
  - [ ] Green dot=healthy, yellow=degraded, red=dead, gray=unknown
  - [ ] "BUSY" badge shows which node they're executing
  - [ ] Pulls from `companyStore.agentHealth`
  - [ ] Updated by `useCompanyAgentWebSocket`

### Phase 7: Run Controls
- [ ] **Create `apps/web/src/features/runs/RunControlsBar.tsx`**:
  - [ ] Shown in header when `activeRunId` set
  - [ ] Pause / Resume / Stop buttons
  - [ ] Current status: `Running... (Alice is executing plan_node)`
  - [ ] Elapsed time counter

- [ ] **Run trigger flow** in `PipelineHeader.tsx`:
  - [ ] "Run" button → `RunTriggerModal`:
    - Fill in `start` node variables
    - Shows: "Agents that will execute: Alice (Lead Engineer), Bob (CEO)"
    - Shows: "Estimated max cost: $0.25 (within budgets ✓)"
    - "Execute" → `POST /api/pipelines/{id}/execute` → `setActiveRun(run_id)`

### Phase 8: Human Approval Modal (Agent-Aware)
- [ ] **Create `apps/web/src/features/runs/ApprovalModal.tsx`**:
  - [ ] Triggered by `human_input_required` WebSocket event
  - [ ] Shows: agent who triggered the approval request (their role + name)
  - [ ] Shows: prompt text, pipeline context
  - [ ] Response textarea + "Approve" + "Reject" buttons
  - [ ] Timeout countdown with fallback indicator
  - [ ] `POST /api/runs/{runId}/approve/{nodeId}`

### Phase 9: Run Summary Card (Per-Agent Breakdown)
- [ ] **Create `apps/web/src/features/runs/RunSummaryCard.tsx`**:
  - [ ] Shows on pipeline completion (bottom-right toast)
  - [ ] Per-agent cost breakdown table:
    ```
    Agent          Tokens    Cost
    Alice          2,341     $0.0070
    Bob            890       $0.0134
    ─────────────────────────────
    Total          3,231     $0.0204
    ```
  - [ ] Duration + "Run Again" + "View Logs" buttons
  - [ ] Auto-dismiss after 10s (stays if failure)

### Phase 10: Company Dashboard (Multi-Pipeline View)
- [ ] **Create `apps/web/src/pages/CompanyDashboardPage.tsx`**:
  - [ ] Route: `/companies/:id/dashboard`
  - [ ] Shows all ACTIVE runs for this company's pipelines
  - [ ] Agent status table: who's running, on what pipeline, since when
  - [ ] Monthly budget summary: per-agent spend vs. limits
  - [ ] Quick links to active pipeline canvases

### Phase 11: Run History in Pipeline
- [ ] **Create `apps/web/src/features/runs/RunHistorySidebar.tsx`**:
  - [ ] Fetches `GET /api/runs?pipeline_id={id}` on open
  - [ ] Run cards: status, timestamp, duration, total cost, agents involved
  - [ ] Click → populates log panel with historical events
  - [ ] "Re-run" button

---

## Acceptance Criteria
- Running a pipeline shows "Alice (Lead Engineer) is thinking..." on agent_pod nodes
- Budget bar for Alice in `AgentBudgetPanel` decreases live as she executes
- Heartbeat sidebar shows Alice as "BUSY" during execution, "IDLE" after
- Log entries show agent name and role in every line
- Approval modal shows which agent triggered it
- Run summary shows per-agent cost table
- Company Dashboard shows all active runs across all pipelines

---

## Deliverable

Upon completion of Plan B4, you will have:

**1. Agent-Identity Execution View**:
> Canvas shows "Alice (Lead Engineer) is thinking..." with pulsing yellow ring → node turns green with "✓ Alice — 1,234 tokens" → Bob's node starts pulsing → pipeline completes → summary shows "Alice: $0.007, Bob: $0.013"

**2. Company Dashboard** (`/companies/:id/dashboard`):
- All active runs across all company pipelines in one view
- Per-agent monthly budget consumption

**3. Heartbeat Sidebar**:
- Live view of which agents are alive/busy/dead
- Powered by WebSocket heartbeat stream from API

**4. Full Execution Control**:
- Pause / Resume / Stop any running pipeline
- Human approval modal for `human_input` nodes
- Run history with re-run capability

---

## Routing

### This plan enables:
- End-to-end integration testing with full visual execution feedback
- No other plans depend on B4

### This plan depends on:
- **[Plan A3](plan-A3-api-layer.md)** — WebSocket endpoints, heartbeat endpoint, approval endpoint, pause/resume/stop
- **[Plan B3](plan-B3-state-management.md)** — `PipelineStore` (run states), `CompanyStore` (agent budgets/health)
- **[Plan B2](plan-B2-node-components.md)** — `BaseNodeCard` run status overlay (Phase 3 updates this component)
