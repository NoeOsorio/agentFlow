# Testing B0-PR-3: AgentFormModal, YAML Panel, Budget Overview, CompanySelector, AgentDetailPage

This guide covers how to manually test the components added in B0-PR-3.

## Setup

```bash
# Build packages (required once after checkout)
pnpm --filter @agentflow/core build
pnpm --filter @agentflow/ui build

# Start the frontend
pnpm --filter @agentflow/web dev
# → http://localhost:3000
```

## Automated Tests

```bash
pnpm --filter @agentflow/web test
# Expected: 15 test files, 116 tests, all passing
```

New test files in this PR:
- `src/features/company/__tests__/AgentFormModal.test.tsx` — 11 tests
- `src/features/company/__tests__/CompanyYamlPanel.test.tsx` — 4 tests
- `src/features/company/__tests__/CompanySelector.test.tsx` — 5 tests

## Seed Data (optional — requires API)

```bash
# Start the backend
docker compose up postgres redis -d
cd apps/api && uv run uvicorn agentflow_api.main:app --reload --port 8000

# Create a company with 3 agents
curl -X POST http://localhost:8000/api/companies \
  -H 'Content-Type: application/json' \
  -d '{
    "yaml_spec": "apiVersion: agentflow.ai/v1\nkind: Company\nmetadata:\n  name: acme-corp\n  namespace: default\nspec:\n  agents:\n    - name: bob\n      role: CEO\n      model:\n        provider: anthropic\n        model_id: claude-sonnet-4-6\n      budget:\n        monthly_usd: 500\n    - name: alice\n      role: Lead Engineer\n      persona: Senior Python engineer. Direct and pragmatic.\n      model:\n        provider: anthropic\n        model_id: claude-sonnet-4-6\n      capabilities: [coding, review]\n      budget:\n        monthly_usd: 100\n      reports_to: bob\n    - name: carol\n      role: Designer\n      model:\n        provider: openai\n        model_id: gpt-4o\n      capabilities: [writing]\n      budget:\n        monthly_usd: 80\n      reports_to: bob"
  }'
# Note the returned `id` — use it as <COMPANY_ID> below
```

---

## Manual Test Scenarios

### 1. Add Agent Modal (FAB → Add)

Navigate to `http://localhost:3000/companies/new` (or `/companies/<COMPANY_ID>`).

Click the `+` button (bottom-right corner).

Expected:
- Modal opens titled **Add Agent**
- Left side: form with all fields
- Right side (desktop): **YAML Preview** panel showing `# fill in fields above`

Fill in:
- **Name**: `dave` (lowercase, hyphens allowed)
- **Role**: type "Lead" → auto-suggest list shows "Lead Engineer"
- **Persona**: any text
- **Model**: switch provider to OpenAI → model list updates to GPT models
- **Capabilities**: click `coding`, `analysis` → chips turn indigo
- **Monthly Budget**: `50`
- **Reports To**: select an existing agent (if company has any)
- **Memory Enabled**: toggle on

Expected as you type:
- YAML Preview updates within ~300ms showing the agent spec

Click **Add Agent**.

Expected:
- Modal closes
- New agent card appears in the Agents grid
- YAML tab now includes the new agent

### 2. Add Agent — Validation

Open the Add Agent modal, leave **Name** blank, click **Add Agent**.

Expected: red error "Name is required" under Name field.

Enter `Alice` (uppercase), click **Add Agent**.

Expected: error "Name must be lowercase letters, numbers, and hyphens only".

If editing an existing company with agent named `alice`, enter `alice`, click **Add Agent**.

Expected: error "Agent name already exists".

Enter `0` for budget, click **Add Agent**.

Expected: error "Budget must be a positive number".

### 3. Edit Agent Modal

In the Agents grid, click **Edit** on an agent card.

Expected:
- Modal opens titled **Edit Agent**
- All fields pre-filled with the agent's current values
- **Name** field is disabled (can't rename existing agents)
- YAML Preview shows current spec

Change **Role** field → YAML Preview updates within 300ms.

Click **Save Changes** → modal closes, card updates in the grid.

### 4. YAML Panel (bidirectional sync)

Navigate to `/companies/<COMPANY_ID>`, click the **YAML** tab.

Expected:
- Monaco editor shows the full company YAML
- Syntax highlighting enabled

Edit the YAML — change an agent's `role` value.

Expected within 300ms:
- No error markers (if valid YAML)
- Switching to **Agents** tab shows the updated role on the agent card

Delete a required field (e.g., `role:`) from an agent.

Expected:
- Red error marker appears on that line
- Error summary at the bottom lists the validation error
- Company state is NOT changed (invalid YAML is rejected)

Click **Copy** → YAML is copied to clipboard.

Click **Download** → downloads `<company-name>.yaml` file.

Click **Apply** → triggers a save to the API.

### 5. Budget Overview

Navigate to `/companies/<COMPANY_ID>` → **Agents** tab.

In the browser console, simulate budget usage:

```javascript
// Inject mock budget data (no API needed)
document.dispatchEvent(new CustomEvent('debug'))

// Via Zustand devtools or console:
// Open Redux DevTools or paste this in console:
window.__companyStoreDebug = true
```

Or, if the API is running, budget data comes from `GET /api/companies/:id/budget`.

Expected in BudgetOverview (visible in the page header):
- Company-level progress bar: `$0.00 / $680.00 (0%)`
- Per-agent rows each with their own mini-bar
- Colors: green < 60%, yellow 60–80%, red > 80%
- **Resets [date]** shows the 1st of next month

### 6. Agent Detail Page

Navigate to `/companies/<COMPANY_ID>/agents/alice`.

Expected:
- Header: avatar with first letter, name, role, status dot
- Stats cards: model, provider, capability count, monthly budget
- Persona section (if set)
- Capabilities chips with color-coded backgrounds
- Budget bar (if data available)
- "Reports To" section (if agent has a manager)
- "Run History" section: "No runs recorded" placeholder
- "Heartbeat Log" section: "No heartbeat data" placeholder
- **Edit Agent** button → opens AgentFormModal in edit mode

Navigate to `/companies/<COMPANY_ID>/agents/nonexistent`.

Expected: "Agent not found" error with back link.

### 7. CompanySelector (in Pipeline Editor)

Navigate to `http://localhost:3000/canvas/new` (or any pipeline).

Expected in the pipeline header:
- Company selector dropdown (shown as "— No company —" when none selected)
- Clicking it fetches `/api/companies` and shows company name + agent count
- Selecting a company stores the `CompanyReference`

### 8. Department Panel

The DepartmentPanel renders inside the Company editor (if wired into a departments tab).

To test directly with a company that has departments defined in its YAML:

1. In the YAML tab, add a `departments:` section:
```yaml
spec:
  departments:
    - name: Engineering
      description: Builds the product
      agent_names: [alice]
    - name: Leadership
      agent_names: [bob]
  agents:
    ...
```
2. Expected after apply: agents appear in their department chips
3. Drag an agent chip from one department to another → it moves

---

## Definition of Done Checklist

- [x] `pnpm --filter @agentflow/web build` exits 0
- [x] `pnpm --filter @agentflow/web test` → 15 files, 116 tests, all pass
- [x] Add Agent modal opens, validates, and adds agent to the grid
- [x] Edit Agent modal pre-fills all fields
- [x] YAML preview in modal updates within 300ms
- [x] YAML panel shows Monaco editor with error markers on invalid YAML
- [x] Valid YAML edit updates the Agents tab (bidirectional sync)
- [x] CompanyYamlPanel Copy/Download/Apply buttons work
- [x] AgentDetailPage renders without errors for agent with 0 runs
- [x] CompanySelector fetches companies and calls onChange with CompanyReference
- [x] BudgetOverview shows per-agent breakdown with correct color thresholds
