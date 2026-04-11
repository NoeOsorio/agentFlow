# Testing B0-PR-2: Company Detail Page

This guide covers how to manually test the Company Detail page (CompanyPage, AgentGrid, AgentCard, OrgChart) added in B0-PR-2.

## Setup

```bash
# Build core and ui packages first (required once after checkout)
pnpm --filter @agentflow/core build
pnpm --filter @agentflow/ui build

# Start the frontend
pnpm --filter @agentflow/web dev
# → http://localhost:3000
```

## Automated Tests

```bash
pnpm --filter @agentflow/web test
# Expected: 5 test files, 56 tests, all passing
```

The new test file: `src/features/company/__tests__/CompanyPage.test.ts`
- Filter logic: empty, role, capability, name queries
- Budget bar color: green < 60%, yellow 60–80%, red > 80%
- OrgChart shape: CEO root with reports as children, empty company

## Routes Added

| URL | Component |
|-----|-----------|
| `/companies/new` | `CompanyPage` (new company, no load) |
| `/companies/:id` | `CompanyPage` (loads from API) |

## Manual Test Scenarios

### 1. New Company (no API required)
Navigate to `http://localhost:3000/companies/new`

Expected:
- Header shows "New Company" with `default` namespace badge
- Three tabs: **Org Chart**, **Agents**, **YAML**
- Agents tab shows "No company loaded" empty state
- YAML tab shows "# No YAML yet"
- `+` FAB visible in bottom-right corner

### 2. AgentCard display
The card requires a loaded company. Since the API isn't wired yet in this PR, verify via the store directly in the browser console:

```javascript
// Open browser console at /companies/new
const { useCompanyStore } = await import('/src/store/companyStore.ts')
// Or paste a YAML to test the YAML tab
```

Alternatively, set up a mock API (see below).

### 3. Mock API for full flow

With the backend running (`docker compose up postgres redis -d && uv run uvicorn ...`):

1. POST a company to `/api/companies`:
```bash
curl -X POST http://localhost:8000/api/companies \
  -H 'Content-Type: application/json' \
  -d '{
    "yaml_spec": "apiVersion: agentflow.ai/v1\nkind: Company\nmetadata:\n  name: acme-corp\n  namespace: default\nspec:\n  agents:\n    - name: bob\n      role: CEO\n      model:\n        provider: anthropic\n        model_id: claude-sonnet-4-6\n      budget:\n        monthly_usd: 500\n    - name: alice\n      role: Lead Engineer\n      persona: Senior Python engineer. Direct and pragmatic.\n      model:\n        provider: anthropic\n        model_id: claude-sonnet-4-6\n      capabilities: [coding, review]\n      budget:\n        monthly_usd: 100\n      reports_to: bob\n    - name: carol\n      role: Designer\n      model:\n        provider: openai\n        model_id: gpt-4o\n      capabilities: [writing]\n      budget:\n        monthly_usd: 80\n      reports_to: bob"
  }'
# Note the returned `id`
```

2. Navigate to `http://localhost:3000/companies/<id>`

Expected:
- Header shows "acme-corp" with `default` badge and "3 agents"
- Budget overview bar shows $0 / $680 (no spend yet)
- **Agents tab**: 3 cards — bob (CEO), alice (Lead Engineer), carol (Designer)
  - alice card shows `coding` + `review` capability chips
  - alice persona is truncated with full text on hover
  - Budget bars shown (all green at 0% spend)
- **Org Chart tab**: bob at root, alice and carol as child nodes
  - Hover over bob → "bob" and role badge visible
  - Status dots are gray (no heartbeat)
  - Scroll wheel zooms in/out; drag to pan
  - Click `+` then `− ` zoom controls work
  - Clicking bob node (should open AgentFormModal in B0-PR-3 — no-op for now)
- **YAML tab**: raw YAML of the company spec

### 4. AgentCard budget bar colors

Manually trigger different budget states by calling the store actions in the console:

```javascript
// In browser console on /companies/<id>
window.__zustand?.agentflow?.companyStore?.setState({
  agentBudgets: {
    alice: { agentName: 'alice', spentUsd: 85, budgetUsd: 100, remainingUsd: 15, pctUsed: 0.85, month: '2026-04' }
  }
})
```

Expected: alice's budget bar turns **red**.

### 5. Filter and Sort (Agents tab)

With 3 agents loaded:
- Type "Lead" in the filter → only alice shown
- Type "coding" in the filter → only alice shown
- Clear filter → all 3 shown
- Click **Role** sort → agents sorted alphabetically by role
- Click **Budget** sort → agents sorted by remaining budget (descending)

### 6. OrgChart empty state

Navigate to `/companies/new` → Org Chart tab → should show "No agents defined" (not a crash).

## Definition of Done Checklist

- [ ] `pnpm --filter @agentflow/web build` exits 0
- [ ] `pnpm --filter @agentflow/web test` → 5 files, 56 tests, all pass
- [ ] `/companies/new` renders without errors
- [ ] `/companies/:id` loads company name in header
- [ ] OrgChart with 0 agents shows "No agents defined"
- [ ] AgentCard budget bar is red at >80% spend
- [ ] AgentGrid filter by role/capability works
