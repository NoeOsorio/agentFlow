# B3-PR-4: Tests completos + budget polling

**Commit:** `test(web/store): suite de tests completa y budget polling WebSocket [B3-PR-4]`
**Rama:** `feat/B3-PR-4-tests-and-polling`

---

## Qué resuelve

Completa la cobertura de tests de los tres stores/modules de B3 y agrega el polling de budgets (poll cada 60s + WebSocket de heartbeat de agentes) en `CompanyStore`.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/store/__tests__/companyStore.test.ts` | company store tests, YAML sync, agents |
| Crear | `apps/web/src/store/__tests__/pipelineStore.test.ts` | pipeline store tests, undo redo, validation |
| Crear | `apps/web/src/store/__tests__/variableScope.test.ts` | variable scope, topological sort, cycle |
| Actualizar | `apps/web/src/store/companyStore.ts` | agregar refreshBudgets(), WebSocket heartbeat subscription |

## Símbolos exportados

No agrega nuevos símbolos públicos. Agrega a `companyStore`:
- `refreshBudgets(): Promise<void>` — `GET /api/companies/{id}/agents` → actualiza `agentBudgets`
- Suscripción interna a `ws://localhost:8000/api/ws/companies/{id}/agents` (arranca en `loadCompany`)

## Dependencias

- **Depende de:** B3-PR-1, B3-PR-2, B3-PR-3 (todo el stack de B3 completo)
- **Requerido por:** nada — este es el PR hoja de B3. Puede mergearse en paralelo con B0-PR-1 si B3-PR-1/2/3 ya están mergeados.

## Tests

**`apps/web/src/store/__tests__/companyStore.test.ts`** (complementa los de B3-PR-1)
- [ ] `refreshBudgets()` llama `GET /api/companies/{id}/agents` y actualiza `agentBudgets["alice"].remainingUsd`
- [ ] `setAgentHealth("alice", { healthStatus: "dead", lastHeartbeatAt: null })` refleja en store

**`apps/web/src/store/__tests__/pipelineStore.test.ts`** (complementa los de B3-PR-2)
- [ ] `_validatePipeline` detecta pipeline sin nodo `start` y agrega error global
- [ ] `_validatePipeline` detecta `if_else` con menos de 2 edges salientes y agrega error en ese nodo
- [ ] `clearRunStates()` resetea todos los `nodeRunStates` a `{ status: "idle" }`

**`apps/web/src/store/__tests__/variableScope.test.ts`** (complementa los de B3-PR-3)
- [ ] `http` node outputs: `status_code`, `body`, `headers`
- [ ] `template` node outputs: `text`
- [ ] `start` node outputs refleja las `VariableDefinition[]` definidas en el nodo

## Warnings

- El WebSocket de heartbeat en `companyStore` debe cerrarse en cleanup cuando `companyId` cambia — usar un `ref` interno al socket

## Definition of Done

- [ ] `pnpm --filter @agentflow/web test` pasa todos los tests de `store/__tests__/`
- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Coverage de los 3 stores ≥ 80% de ramas críticas
- [ ] Cada archivo tiene header comment con `@plan B3-PR-4`
