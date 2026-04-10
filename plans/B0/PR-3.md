# B0-PR-3: AgentFormModal + Department + YAML panel + Budget + CompanySelector

**Commit:** `feat(web/company): AgentFormModal, YAML panel, BudgetOverview y CompanySelector [B0-PR-3]`
**Rama:** `feat/B0-PR-3-company-editor-complete`

---

## Qué resuelve

Completa el Company Editor con el formulario de agente (todos los campos + YAML preview live), el panel YAML bidireccional, el panel de presupuesto, la gestión de departamentos, la página de detalle de agente y el `CompanySelector` que el Pipeline Editor consume.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/company/AgentFormModal.tsx` | react-hook-form, model selector, reports_to, live YAML preview |
| Crear | `apps/web/src/features/company/DepartmentPanel.tsx` | department list, drag agents, add/delete |
| Crear | `apps/web/src/features/company/CompanyYamlPanel.tsx` | Monaco YAML, validateResource, bidirectional sync |
| Crear | `apps/web/src/features/company/BudgetOverview.tsx` | company budget bar, per-agent breakdown, refresh |
| Crear | `apps/web/src/features/company/CompanySelector.tsx` | dropdown, company list, agent count badge |
| Crear | `apps/web/src/pages/AgentDetailPage.tsx` | agent profile, budget history, run history, heartbeat log |

## Símbolos exportados

- `AgentFormModal` — props: `agent?: AgentSpec`, `open`, `onClose`, `mode: "add" | "edit"`
- `DepartmentPanel` — props: `company: Company`, `onUpdate`
- `CompanyYamlPanel` — props: ninguna (lee de `useCompanyStore`)
- `BudgetOverview` — props: ninguna (lee de `useCompanyStore`)
- `CompanySelector` — props: `value: CompanyReference | null`, `onChange: (ref: CompanyReference | null) => void`
- `AgentDetailPage` — page component para `/companies/:id/agents/:agentName`

## Dependencias

- **Depende de:** B0-PR-2 (`CompanyPage` monta el modal), B3-PR-1 (`useCompanyStore` acciones `addAgent`, `updateAgent`, `deleteAgent`, `setYamlSpec`), A0 (`validateResource`), B2-PR-4 (`ModelSelector` widget reutilizado en form)
- **Requerido por:** B1-PR-2 (`CompanySelector` usado en `PipelineHeader`), B1-PR-3 (`ConfigPanel` de `agent_pod` importa `CompanySelector` para `AgentSelector`)

## Tests

**`apps/web/src/features/company/__tests__/AgentFormModal.test.tsx`**
- [ ] Submit con nombre duplicado dentro de la company muestra error "Agent name already exists"
- [ ] `AgentFormModal` en modo "edit" pre-llena todos los campos con los valores del agente existente
- [ ] Live YAML preview se actualiza dentro de 300ms al cambiar el campo "Role"
- [ ] "Save" en modo "add" llama `addAgent(agentSpec)` en CompanyStore

**`apps/web/src/features/company/__tests__/CompanyYamlPanel.test.tsx`**
- [ ] YAML inválido muestra marker de error; `company` en store no cambia
- [ ] YAML válido con agente nuevo: `company.spec.agents` se actualiza y `AgentGrid` re-renderiza

**`apps/web/src/features/company/__tests__/CompanySelector.test.tsx`**
- [ ] Dropdown muestra companies de `GET /api/companies/` con nombre y agent count
- [ ] Seleccionar company llama `onChange({ name, namespace })`

## Warnings

- `AgentFormModal` usa `react-hook-form` — no usar `react-hook-form` desde `@agentflow/ui` directamente; instalar en `apps/web`
- `CompanyYamlPanel` debounce de 300ms para evitar parsear en cada keystroke; usar `useDebounce`

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `CompanySelector` es importable desde `@agentflow/web` features (no desde `@agentflow/ui`)
- [ ] `AgentDetailPage` renderiza sin errores para agente con 0 runs históricos
- [ ] Cada archivo tiene header comment con `@plan B0-PR-3`
