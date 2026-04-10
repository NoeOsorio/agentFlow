# B4-PR-4: Run summary + Company Dashboard + Run history

**Commit:** `feat(web/runs): RunSummaryCard, CompanyDashboardPage y RunHistorySidebar [B4-PR-4]`
**Rama:** `feat/B4-PR-4-run-summary-and-dashboard`

---

## Qué resuelve

Completa la visualización de ejecución con el resumen post-run (toast con breakdown por agente), la dashboard de la company (todos los runs activos), y el sidebar de historial de runs del pipeline.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/runs/RunSummaryCard.tsx` | per-agent cost table, duration, run again, auto-dismiss |
| Crear | `apps/web/src/pages/CompanyDashboardPage.tsx` | active runs, agent status table, monthly budget summary |
| Crear | `apps/web/src/features/runs/RunHistorySidebar.tsx` | run list, timestamp, cost, agents involved, re-run |
| Actualizar | `apps/web/src/App.tsx` | agregar ruta `/companies/:id/dashboard` |

## Símbolos exportados

- `RunSummaryCard` — toast bottom-right; tabla de tokens y costo por agente; auto-dismiss 10s (persiste si hay error)
- `CompanyDashboardPage` — página en `/companies/:id/dashboard` con runs activos y budget mensual
- `RunHistorySidebar` — sidebar derecho del canvas; lista de runs pasados del pipeline

## Dependencias

- **Depende de:** B4-PR-3 (datos de budget acumulados), B3-PR-1 (`useCompanyStore.agentBudgets`), A3 (`GET /api/runs?pipeline_id={id}`)
- **Requerido por:** nada — este es el PR hoja de B4. No hay planes que dependan de B4.

## Tests

**`apps/web/src/features/runs/__tests__/RunSummaryCard.test.tsx`**
- [ ] Tabla renderiza una fila por agente con `tokens` y `cost` formateados
- [ ] Fila "Total" suma correctamente tokens y costos de todos los agentes
- [ ] Card se auto-dismiss después de 10 segundos en run exitoso
- [ ] Card NO se auto-dismiss si `run.status === "failed"` (persiste para revisión)

**`apps/web/src/pages/__tests__/CompanyDashboardPage.test.tsx`**
- [ ] Con 2 runs activos: muestra 2 filas en tabla de runs activos con pipeline name y duration
- [ ] Budget mensual: fila de "alice" con `pctUsed=0.9` muestra barra roja
- [ ] "View Pipeline" link navega a `/canvas/{pipelineId}` del run

**`apps/web/src/features/runs/__tests__/RunHistorySidebar.test.tsx`**
- [ ] Fetches `GET /api/runs?pipeline_id={id}` al abrir
- [ ] Click en run histórico popula `logsStore` con los eventos históricos
- [ ] "Re-run" button llama `POST /api/pipelines/{id}/execute` con los mismos inputs

## Warnings

- `CompanyDashboardPage` hace polling de runs activos cada 10s (no hay WebSocket dedicado para esto) — usar `setInterval` con cleanup
- `RunSummaryCard` se monta siempre en `CanvasPage`; se hace visible via estado local cuando `activeRunId` pasa a `null` y hay datos de resumen

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] Ruta `/companies/:id/dashboard` registrada en `App.tsx`
- [ ] `RunSummaryCard` con datos de 0 agentes (run sin agentes) no crashea
- [ ] Cada archivo tiene header comment con `@plan B4-PR-4`
