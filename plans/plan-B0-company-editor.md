# Plan B0: Company Editor UI

## Overview
Build the organizational layer of the AgentFlow UI: a visual editor for defining virtual companies — their agents, roles, budgets, departments, and org hierarchy. This is the counterpart to the Pipeline Editor (Plan B1): users first define their company (who the agents are), then build pipelines (what those agents do). Inspired by Paperclip's org-hierarchy dashboard combined with a YAML-first editing experience.

## Tech Context
- **Primary package:** `apps/web/`
- **New directories:**
  - `apps/web/src/features/company/` — company editor components
  - `apps/web/src/pages/CompanyPage.tsx` — company detail page
  - `apps/web/src/pages/CompaniesPage.tsx` — companies list
- **Depends on:**
  - `@agentflow/core` — `Company`, `AgentSpec`, `Department`, `CompanyReference`, `getOrgTree` from Plan A0
  - Plan B3 CompanyStore (Zustand) for state management
- **Tech:** React 19, TypeScript 5.7, Tailwind CSS 3.4, react-hook-form, Zustand 5.0

---

## Goals
- Companies list page: create, list, delete companies
- Company detail page with three panels: Visual Org Chart, Agent Cards grid, YAML editor
- Visual drag-and-drop org chart showing agent hierarchy (CEO → engineers, etc.)
- Agent card for each agent: role, persona, model, budget meter, capabilities, status
- Add/edit/delete agents with a form modal
- Department management: group agents into departments
- Live YAML sync: edit agents visually or in raw YAML — both stay in sync
- Budget overview: company-wide spend tracking

---

## Checklist

### Phase 1: Route Setup & Navigation
- [ ] **Update `apps/web/src/App.tsx`** — add routes:
  - [ ] `/companies` → `CompaniesPage`
  - [ ] `/companies/new` → `CompanyPage` (empty state)
  - [ ] `/companies/:id` → `CompanyPage` (edit existing)
  - [ ] `/companies/:id/agents/:agentName` → `AgentDetailPage`

- [ ] **Update navigation** in `apps/web/src/components/Sidebar.tsx` (or NavBar):
  - [ ] Add "Companies" nav item with building icon
  - [ ] Add "Pipelines" nav item
  - [ ] Add "Runs" nav item
  - [ ] Active state highlighting based on current route

### Phase 2: Companies List Page
- [ ] **Create `apps/web/src/pages/CompaniesPage.tsx`**:
  - [ ] Fetch companies: `GET /api/companies` on mount
  - [ ] Grid of `CompanyCard` components
  - [ ] "New Company" button → navigates to `/companies/new` with YAML template
  - [ ] Empty state: "No companies yet. Define your first virtual company."

- [ ] **Create `apps/web/src/features/company/CompanyCard.tsx`**:
  - [ ] Shows: company name, namespace, agent count, total monthly budget
  - [ ] Status badge: agents active/idle counts
  - [ ] "Open" button → `/companies/:id`
  - [ ] "Delete" button with confirmation dialog
  - [ ] Last updated timestamp

### Phase 3: Company Detail Page Layout
- [x] **Create `apps/web/src/pages/CompanyPage.tsx`**:
  - [x] Three-panel layout (tabbed on mobile, side-by-side on desktop):
    - **Tab 1:** "Org Chart" — visual hierarchy
    - **Tab 2:** "Agents" — card grid
    - **Tab 3:** "YAML" — raw editor
  - [x] Header: company name (editable), namespace badge, "Save" button, status badge
  - [x] "Add Agent" floating button (bottom right)
  - [x] Budget overview bar at top: `$240 / $500 used this month`

### Phase 4: Agent Cards Grid
- [x] **Create `apps/web/src/features/company/AgentCard.tsx`**:
  - [x] Layout: Avatar + name + role badge + model + persona snippet + capabilities chips + budget bar + actions
  - [x] Budget bar: green < 60%, yellow 60-80%, red > 80%
  - [x] Status dot: green=healthy, yellow=degraded, gray=unknown, red=dead (from heartbeat)
  - [x] Capabilities as colored chips
  - [x] "Edit" → opens `AgentFormModal` (B0-PR-3 no-op stub)
  - [x] "Delete" → confirmation dialog → removes agent from company spec

- [x] **Create `apps/web/src/features/company/AgentGrid.tsx`**:
  - [x] Responsive grid: 3 columns on desktop, 2 on tablet, 1 on mobile
  - [x] Renders `AgentCard` for each agent in company
  - [x] Filter bar: by name, role, capability
  - [x] Sort: by name, by role, by budget remaining, by status

### Phase 5: Agent Form Modal (Add/Edit)
- [ ] **Create `apps/web/src/features/company/AgentFormModal.tsx`**:
  - [ ] Uses `react-hook-form` for form state
  - [ ] Fields:
    - **Name** — text input (DNS-label format validation: lowercase, hyphens only)
    - **Role** — text input with suggestions: CEO, CTO, Lead Engineer, Developer, Designer, Analyst, PM, QA Engineer, DevOps, Data Scientist
    - **Persona** — textarea (injected as system prompt prefix; placeholder: "Senior Python engineer. Direct and pragmatic.")
    - **Model Provider** — dropdown: Anthropic, OpenAI, Google
    - **Model ID** — dropdown filtered by provider
    - **Temperature** — slider 0.0–2.0
    - **Capabilities** — multi-select chips
    - **Monthly Budget (USD)** — number input
    - **Reports To** — dropdown of existing agents in company (null = top of hierarchy)
    - **Department** — dropdown of existing departments (optional)
    - **Heartbeat Interval (seconds)** — number input, default 30
    - **Heartbeat Timeout (seconds)** — number input, default 120
    - **On Timeout** — radio: continue / fail / retry
    - **Memory Enabled** — toggle
  - [ ] Live YAML preview of the agent spec (right side of modal, updates as fields change)
  - [ ] "Save" → dispatches `addAgent()` or `updateAgent()` to CompanyStore
  - [ ] Validation: name unique within company, budget > 0

### Phase 6: Org Chart Visual
- [x] **Create `apps/web/src/features/company/OrgChart.tsx`**:
  - [x] Uses `getOrgTree(company)` from `@agentflow/core` to build tree data
  - [x] Renders using a recursive React component tree layout (no d3-hierarchy needed)
  - [x] Each org node: agent avatar + name + role
  - [x] Lines connecting manager → reports
  - [x] Click on agent node → calls `onAgentClick` (AgentFormModal wired in B0-PR-3)
  - [x] "Add report" button on each node → calls `onAddReport`
  - [x] Zoom/pan on large orgs (CSS transform + mouse drag)

- [x] **Create `apps/web/src/features/company/OrgNode.tsx`**:
  - [x] Circular avatar with role-color background
  - [x] Name below avatar
  - [x] Role badge
  - [x] Status dot (live from heartbeat store)
  - [x] Budget remaining shown on hover tooltip

### Phase 7: Department Management
- [ ] **Create `apps/web/src/features/company/DepartmentPanel.tsx`**:
  - [ ] List of departments with agent count
  - [ ] "Add Department" button → inline form (name, description)
  - [ ] Drag agents between departments (uses HTML drag-and-drop)
  - [ ] Delete department (agents are unassigned, not deleted)

### Phase 8: YAML Panel (Company)
- [ ] **Create `apps/web/src/features/company/CompanyYamlPanel.tsx`**:
  - [ ] Monaco Editor in YAML mode showing full Company YAML
  - [ ] Validates on change: calls `validateResource(yaml)` from `@agentflow/core`
  - [ ] Error underlines for invalid fields
  - [ ] On valid change (debounced 300ms): dispatches `setCompanyYaml(yaml)` to CompanyStore
  - [ ] `setCompanyYaml` triggers visual panel re-render (bidirectional sync)
  - [ ] "Copy" button, "Download .yaml" button
  - [ ] "Apply to Company" button (explicit save trigger)

### Phase 9: Budget Overview Component
- [ ] **Create `apps/web/src/features/company/BudgetOverview.tsx`**:
  - [ ] Company-level budget: `$240 / $500 spent (48%)` — big progress bar
  - [ ] Per-agent breakdown: horizontal bar chart showing each agent's spend vs. limit
  - [ ] Color coding: green / yellow / red based on consumption %
  - [ ] "Budget reset date": 1st of next month (based on server time)
  - [ ] Data from: `GET /api/companies/:id/budget` (Plan A3)
  - [ ] Updates every 30 seconds (poll) or via WebSocket events

### Phase 10: CompanyStore Integration
- [ ] **Create `apps/web/src/store/companyStore.ts`** (implemented in Plan B3, consumed here):
  - [ ] Read: `company`, `saveStatus`, `agents`
  - [ ] Dispatch: `addAgent`, `updateAgent`, `deleteAgent`, `setCompanyYaml`, `saveCompany`, `loadCompany`
  - [ ] Subscribe to: `agentBudget` updates for live budget bar

### Phase 11: Link Company to Pipeline
- [ ] **Create `apps/web/src/features/company/CompanySelector.tsx`**:
  - [ ] Dropdown/combobox for selecting a company when editing a Pipeline
  - [ ] Shows company name + agent count
  - [ ] Used in Pipeline Editor header: "Using agents from: [acme-corp ▾]"
  - [ ] On select: dispatches `setPipelineCompanyRef(ref)` to PipelineStore
  - [ ] Clears any `AgentPodNode` agent_ref that no longer exists in new company

### Phase 12: Agent Detail Page
- [ ] **Create `apps/web/src/pages/AgentDetailPage.tsx`**:
  - [ ] Shows full agent profile: role, persona, model, capabilities
  - [ ] Budget history chart: line graph of daily spend (last 30 days)
  - [ ] Run history: list of pipeline runs this agent participated in
  - [ ] Heartbeat log: last 10 heartbeat timestamps + latency
  - [ ] "Edit Agent" → opens `AgentFormModal`

---

## Acceptance Criteria
- Creating a company with 3 agents via UI and saving to API works end-to-end
- Editing an agent's role in YAML panel immediately updates the Agent Card
- Org chart renders correct hierarchy with manager → report connections
- Budget bars turn red when agent exceeds 80% of monthly budget
- Adding an agent pre-fills `reports_to` in form
- Deleting an agent shows warning if it's referenced in any pipeline
- `CompanyPage` renders without errors for a company with 10 agents
- YAML panel rejects invalid YAML and shows error markers

---

## Deliverable

Upon completion of Plan B0, you will have:

**1. Companies List Page** (`/companies`):
- Grid of company cards showing name, agent count, total budget, status
- "New Company" creates a Company YAML and navigates to editor

**2. Company Editor** (`/companies/:id`):
- Agent Cards grid: visual overview of all agents with roles, budgets, status
- Org Chart: interactive tree of the company hierarchy
- YAML Panel: live-synced raw YAML editor
- Budget Overview: company-wide and per-agent spend visualization

**3. Agent Management**:
- Full Add/Edit/Delete agent form with all fields
- Role suggestions, capability chips, budget input, model selector, org hierarchy

**4. Company ↔ Pipeline Link**:
- `CompanySelector` dropdown in Pipeline Editor
- Pipeline nodes can now select agents by name from the linked company

**5. User Flow**:
> User writes `acme-company.yaml` → uploads it (or creates via form) → sees org chart → adds agents → opens Pipeline Editor → selects "acme-corp" → drags Alice (Lead Engineer) onto canvas as AgentPod node → runs pipeline → sees Alice's node animate with her role and budget deducting in real-time.

---

## Routing

### This plan enables (must complete B0 before starting):
- **[Plan B1](plan-B1-canvas-editor.md)** — Canvas Editor needs `CompanySelector` and the concept of agents from a company to populate the AgentPod node palette
- **[Plan B4](plan-B4-execution-visualization.md)** — Execution visualization needs the Company Dashboard view and agent budget tracking components built here

### This plan depends on:
- **[Plan A0](plan-A0-company-agent-schema.md)** — requires `Company`, `AgentSpec`, `Department`, `getOrgTree`, `validateResource` types and utilities
- **[Plan B3](plan-B3-state-management.md)** — requires `CompanyStore` (Zustand) for all company state mutations
