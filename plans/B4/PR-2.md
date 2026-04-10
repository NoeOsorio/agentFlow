# B4-PR-2: Node status overlay + Execution log + logsStore

**Commit:** `feat(web/runs): node overlay con agent identity, RunLogPanel y logsStore [B4-PR-2]`
**Rama:** `feat/B4-PR-2-overlay-and-logs`

---

## Qué resuelve

Actualiza `BaseNodeCard` para mostrar identidad del agente durante la ejecución (role + nombre + tokens), implementa el panel de logs de ejecución con formato agent-aware y el store de logs.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Actualizar | `packages/ui/src/nodes/BaseNodeCard.tsx` | agent role overlay, "is thinking", completed micro-badge, token count |
| Crear | `apps/web/src/features/runs/hooks/useNodeRunStatus.ts` | node run state from PipelineStore |
| Crear | `apps/web/src/features/runs/RunLogPanel.tsx` | bottom drawer, agent-aware log entries, auto-scroll, filter |
| Crear | `apps/web/src/store/logsStore.ts` | logs array, addLog, clearLogs, LogEntry |

## Símbolos exportados

- `useNodeRunStatus(nodeId: string): NodeRunState` — lee de `usePipelineStore.nodeRunStates`
- `RunLogPanel` — panel de logs en drawer inferior con tabs All/Errors/Completed
- `logsStore` (Zustand) — `{ logs, addLog, clearLogs }`
- `LogEntry` — `{ timestamp, agentName, agentRole, nodeId, status, tokensUsed?, costUsd?, message? }`

### Cambios en `BaseNodeCard` (B2-PR-1 actualizado)
- Props adicionales en `running`: muestra `"[agentRole] is thinking..."` si `data.runStatus.agentRole` presente
- Props adicionales en `completed`: micro-badge `"✓ [agentRole] — {tokens} tokens"`
- Props adicionales en `failed`: tooltip con `data.runStatus.error` + `data.runStatus.agentName`

## Dependencias

- **Depende de:** B4-PR-1 (`useRunWebSocket` emite eventos que poblan `nodeRunStates` via store), B2-PR-1 (`BaseNodeCard` se actualiza aquí), B3-PR-2 (`usePipelineStore.nodeRunStates`)
- **Requerido por:** B4-PR-3 (los componentes de run controls usan `logsStore`)

## Warnings

- Este PR **modifica `BaseNodeCard` de B2** — asegurarse de que el PR de B2 ya esté mergeado antes de hacer este cambio
- `BaseNodeCard` recibe las nuevas props como opcionales (`runStatus?: NodeRunState`) — no rompe el contrato de B2
- `RunLogPanel` hace auto-scroll al bottom en cada `addLog` — usar `useEffect` con ref al elemento scroll

## Tests

**`packages/ui/src/__tests__/BaseNodeCard.test.tsx`** (actualizar tests existentes)
- [ ] `runStatus.status="running"` con `agentRole="Lead Engineer"` renderiza "Lead Engineer is thinking..."
- [ ] `runStatus.status="completed"` con `tokensUsed=1234` renderiza "✓ Lead Engineer — 1,234 tokens"

**`apps/web/src/features/runs/__tests__/RunLogPanel.test.tsx`**
- [ ] Log entry de `node_complete` muestra formato `[HH:MM:SS.ms] 👤 Alice (Lead Engineer) — plan_node ✓ completed 1,234 tokens $0.0037`
- [ ] Filtro "Errors" oculta entries con `status !== "failed"`
- [ ] "Clear" button vacía `logs` en `logsStore`

## Definition of Done

- [ ] `pnpm --filter @agentflow/ui build` sin errores de tipo (BaseNodeCard actualizado)
- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `BaseNodeCard` sin `agentRole` en `runStatus` sigue mostrando el overlay básico (graceful degradation)
- [ ] Cada archivo tiene header comment con `@plan B4-PR-2`
