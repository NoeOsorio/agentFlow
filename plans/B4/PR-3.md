# B4-PR-3: Budget tracker + Heartbeat sidebar + Run controls + Approval modal

**Commit:** `feat(web/runs): AgentBudgetPanel, HeartbeatSidebar, RunControlsBar y ApprovalModal [B4-PR-3]`
**Rama:** `feat/B4-PR-3-run-ui-components`

---

## Qué resuelve

Entrega los componentes de UI de ejecución: panel de budget por agente en tiempo real, sidebar de heartbeat (agentes vivos/muertos), controles de run (pause/resume/stop), barra de métricas y modal de aprobación humana.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/runs/AgentBudgetPanel.tsx` | per-agent budget, real-time deduction, exceeded row |
| Crear | `apps/web/src/features/runs/RunMetricsBar.tsx` | total tokens, cost, duration, live update |
| Crear | `apps/web/src/features/runs/HeartbeatSidebar.tsx` | agent health, BUSY badge, IDLE, DEAD, last heartbeat |
| Crear | `apps/web/src/features/runs/RunControlsBar.tsx` | pause, resume, stop, elapsed timer, current agent status |
| Crear | `apps/web/src/features/runs/ApprovalModal.tsx` | human input, agent context, response textarea, timeout countdown |

## Símbolos exportados

- `AgentBudgetPanel` — panel derecho durante run; un row por agente con budget bar en tiempo real
- `RunMetricsBar` — barra en header: tokens, cost, duration actualizados live
- `HeartbeatSidebar` — tab "Agents" con estado vivo/busy/muerto de cada agente
- `RunControlsBar` — controles de run mostrados en header cuando `activeRunId !== null`
- `ApprovalModal` — modal triggered por evento WebSocket `human_input_required`

## Dependencias

- **Depende de:** B4-PR-1 (`useCompanyAgentWebSocket` popula `agentHealth` en CompanyStore), B4-PR-2 (`logsStore` para `RunLogPanel` integrado), B3-PR-1 (`useCompanyStore.agentBudgets`, `agentHealth`), B3-PR-2 (`usePipelineStore.activeRunId`, `nodeRunStates`), A3 (`POST /api/runs/{runId}/approve/{nodeId}`, `POST /api/runs/{runId}/pause`, etc.)
- **Requerido por:** B4-PR-4 (`RunSummaryCard` usa datos de `agentBudgets` acumulados durante run)

## Tests

**`apps/web/src/features/runs/__tests__/AgentBudgetPanel.test.tsx`**
- [ ] Row para "alice" con `pctUsed=0.95` muestra clase "exceeded" con texto "$0 remaining (EXCEEDED)"
- [ ] `AgentBudgetPanel` actualiza el budget bar de "alice" cuando `agentBudgets["alice"]` cambia en store

**`apps/web/src/features/runs/__tests__/HeartbeatSidebar.test.tsx`**
- [ ] Agente con `healthStatus="dead"` muestra `✗` rojo y "DEAD"
- [ ] Agente con `healthStatus="healthy"` y `currentRunId` muestra badge "BUSY — [nodeId]"
- [ ] `lastHeartbeatAt` hace 8 minutos muestra "Last ♥ 8m ago"

**`apps/web/src/features/runs/__tests__/ApprovalModal.test.tsx`**
- [ ] Muestra nombre y role del agente que disparó el `human_input_required`
- [ ] "Approve" con respuesta vacía está disabled
- [ ] Submit llama `POST /api/runs/{runId}/approve/{nodeId}` con el texto de respuesta

## Warnings

- `ApprovalModal` se activa via evento WebSocket (desde `useRunWebSocket`) — usar un store global mínimo o Context para transportar el evento al modal
- El countdown de timeout en `ApprovalModal` usa `setInterval`; limpiar en cleanup de `useEffect`

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `RunControlsBar` solo visible cuando `activeRunId !== null`
- [ ] `ApprovalModal` cierra automáticamente cuando el timeout expira (sin acción del usuario)
- [ ] Cada archivo tiene header comment con `@plan B4-PR-3`
