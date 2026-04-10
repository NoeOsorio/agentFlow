# B0-PR-1: Routes + navegación + Companies list page

**Commit:** `feat(web/company): routes, navegación global y Companies list page [B0-PR-1]`
**Rama:** `feat/B0-PR-1-companies-list`

---

## Qué resuelve

Conecta las páginas de Company al router de la app, actualiza el Sidebar con navegación principal (Companies / Pipelines / Runs) y entrega la lista de companies con cards y estado vacío.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Actualizar | `apps/web/src/App.tsx` | routes, companies, pipelines, runs |
| Actualizar | `apps/web/src/components/Sidebar.tsx` | nav items, building icon, active state |
| Crear | `apps/web/src/pages/CompaniesPage.tsx` | companies list, grid, empty state, fetch |
| Crear | `apps/web/src/features/company/CompanyCard.tsx` | company card, agent count, budget, delete |

## Símbolos exportados

- `CompaniesPage` — page component para `/companies`
- `CompanyCard` — props: `company: Company`, `onDelete: (id: string) => void`

## Dependencias

- **Depende de:** B3-PR-1 (`useCompanyStore`), A0 (`Company` type), React Router v7
- **Requerido por:** B0-PR-2 (rutas `/companies/:id` definidas aquí), B0-PR-3 (ruta `/companies/:id/agents/:agentName`)

## Tests

**`apps/web/src/pages/__tests__/CompaniesPage.test.tsx`**
- [ ] Muestra estado vacío "No companies yet. Define your first virtual company." cuando `GET /api/companies` retorna `[]`
- [ ] Renderiza `CompanyCard` por cada company en la respuesta
- [ ] "New Company" navega a `/companies/new`
- [ ] `CompanyCard` "Delete" button llama `DELETE /api/companies/:id` y remueve card del grid

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] Rutas `/companies`, `/companies/new`, `/companies/:id`, `/companies/:id/agents/:agentName` registradas en `App.tsx`
- [ ] Sidebar muestra items "Companies", "Pipelines", "Runs" con active state
- [ ] Cada archivo tiene header comment con `@plan B0-PR-1`
