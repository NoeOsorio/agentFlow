# B0-PR-2: Company detail page + Agent cards + Org chart

**Commit:** `feat(web/company): CompanyPage con AgentGrid y OrgChart interactivo [B0-PR-2]`
**Rama:** `feat/B0-PR-2-company-detail`

---

## Qué resuelve

Entrega la pantalla principal del editor de companies: layout de tres paneles (Org Chart, Agents, YAML), el grid de AgentCards con filtros/sort, y el org chart visual con drag-and-drop de jerarquía.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/pages/CompanyPage.tsx` | three-panel layout, tabbed mobile, header, save button |
| Crear | `apps/web/src/features/company/AgentCard.tsx` | agent card, role badge, budget bar, persona snippet |
| Crear | `apps/web/src/features/company/AgentGrid.tsx` | grid, filter, sort, responsive |
| Crear | `apps/web/src/features/company/OrgChart.tsx` | d3-hierarchy, tree layout, zoom/pan |
| Crear | `apps/web/src/features/company/OrgNode.tsx` | circular avatar, status dot, budget tooltip |

## Símbolos exportados

- `CompanyPage` — page component para `/companies/:id`
- `AgentCard` — props: `agent: AgentSpec`, `budget?: AgentBudgetState`, `health?: AgentHealthState`, `onEdit`, `onDelete`
- `AgentGrid` — props: `agents: AgentSpec[]`, `onEdit`, `onDelete`
- `OrgChart` — props: `company: Company`, `onAgentClick`
- `OrgNode` — props: `agent: AgentSpec`, `health?: AgentHealthState`

## Dependencias

- **Depende de:** B0-PR-1 (rutas definidas), B3-PR-1 (`useCompanyStore`, `useAgentBudget`, `useAgentHealth`), A0 (`getOrgTree`, `AgentSpec`, `Company`), B2-PR-2 (`BudgetBar` reutilizado en `AgentCard`)
- **Requerido por:** B0-PR-3 (`AgentFormModal` se monta sobre `CompanyPage`, `OrgChart` usa `AgentFormModal`)

## Warnings

- Instalar `d3-hierarchy`: `pnpm --filter @agentflow/web add d3-hierarchy @types/d3-hierarchy`
- `OrgChart` con 0 agentes debe renderizar estado vacío, no crash
- `AgentCard` reutiliza `BudgetBar` de B2-PR-2 — importar desde `@agentflow/ui`

## Tests

**`apps/web/src/features/company/__tests__/CompanyPage.test.tsx`**
- [ ] `CompanyPage` carga company con `loadCompany(id)` en mount y renderiza nombre en header
- [ ] `AgentGrid` con filtro "engineering" muestra solo agentes con capability o role que coincide
- [ ] `AgentCard` con `budget.pctUsed > 0.8` muestra `BudgetBar` en rojo
- [ ] `OrgChart` llama `getOrgTree(company)` y renderiza un nodo por agente
- [ ] Click en `OrgNode` emite `onAgentClick(agentName)`

## Definition of Done

- [x] `pnpm --filter @agentflow/web build` sin errores de tipo
- [x] Tests pasan
- [x] `CompanyPage` renderiza sin errores con company de 10 agentes
- [x] `OrgChart` sin agentes muestra "No agents defined" en lugar de crash
- [x] Cada archivo tiene header comment con `@plan B0-PR-2`
