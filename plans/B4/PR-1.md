# B4-PR-1: WebSocket hooks con agent identity

**Commit:** `feat(web/runs): useRunWebSocket y useCompanyAgentWebSocket con agent identity [B4-PR-1]`
**Rama:** `feat/B4-PR-1-websocket-hooks`

---

## Qué resuelve

Implementa los dos hooks de WebSocket: el de runs (eventos de ejecución con `agent_name`, `agent_role`) y el de heartbeat de agentes de la company. Son la fuente de verdad para toda la visualización de ejecución en tiempo real.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/runs/hooks/useRunWebSocket.ts` | run events, node_start, node_complete, agent identity, reconnect backoff |
| Crear | `apps/web/src/features/runs/hooks/useCompanyAgentWebSocket.ts` | heartbeat, agent health, company agents |

## Símbolos exportados

- `useRunWebSocket(runId: string | null)` — retorna `{ connectionStatus, lastEvent }`; despacha a `usePipelineStore` y `useCompanyStore`
- `useCompanyAgentWebSocket(companyId: string | null)` — retorna `{ connectionStatus }`; despacha `setAgentHealth` a `useCompanyStore`
- `StreamEvent` — tipo del evento WebSocket: `{ type, node_id, agent_name?, agent_role?, company_name?, tokens_used?, cost_usd?, error?, timestamp }`
- `ConnectionStatus` — `"connecting" | "connected" | "disconnected" | "error"`

## Dependencias

- **Depende de:** B3-PR-2 (`usePipelineStore.updateNodeRunState`, `setActiveRun`), B3-PR-1 (`useCompanyStore.setAgentBudget`, `setAgentHealth`), A3 WebSocket endpoints (`ws://localhost:8000/api/ws/runs/{run_id}`, `ws://localhost:8000/api/ws/companies/{id}/agents`)
- **Requerido por:** B4-PR-2 (usa `lastEvent` para log panel), B4-PR-3 (`RunControlsBar` necesita `connectionStatus`)

## Tests

**`apps/web/src/features/runs/hooks/__tests__/useRunWebSocket.test.ts`**
- [ ] Evento `node_start` → llama `updateNodeRunState(nodeId, { status: "running", agentName, agentRole })`
- [ ] Evento `node_complete` → llama `updateNodeRunState(nodeId, { status: "completed", tokensUsed, costUsd })` Y `setAgentBudget(agentName, updatedBudget)`
- [ ] Evento `pipeline_complete` → llama `setActiveRun(null)`
- [ ] Desconexión: reintenta con backoff exponencial (5 intentos max)
- [ ] `runId=null` → no conecta WebSocket

## Warnings

- Los tests deben mockear `WebSocket` global (`vi.stubGlobal("WebSocket", MockWebSocket)`)
- El backoff exponencial debe tener un cap máximo de 30s para evitar delays muy largos en producción
- `useCompanyAgentWebSocket` debe auto-suscribirse cuando `companyId` cambia en `useCompanyStore` (no requiere llamada manual)

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `useRunWebSocket` cierra la conexión en cleanup (return de `useEffect`)
- [ ] `useCompanyAgentWebSocket` cierra la conexión cuando `companyId` cambia a `null`
- [ ] Cada archivo tiene header comment con `@plan B4-PR-1`
