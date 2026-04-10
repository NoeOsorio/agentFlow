# B3-PR-1: Shared types + CompanyStore

**Commit:** `feat(web/store): tipos compartidos de store y CompanyStore con YAML sync [B3-PR-1]`
**Rama:** `feat/B3-PR-1-company-store`

---

## Qué resuelve

Define los tipos TypeScript del sistema de stores y entrega el `CompanyStore` completo: carga, edición bidireccional YAML ↔ formulario, y persistencia de agentes con auto-save.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/store/types.ts` | CanvasNode, CanvasEdge, NodeRunStatus, AgentBudgetState, HistoryEntry |
| Crear | `apps/web/src/store/companyStore.ts` | CompanyStore, loadCompany, saveCompany, addAgent, updateAgent, YAML sync |

## Símbolos exportados

### `store/types.ts`
- `CanvasNode` — `Node<PipelineNode>` de `@xyflow/react` con `position`
- `CanvasEdge` — `Edge<PipelineEdge>` de `@xyflow/react`
- `NodeValidationError` — `{ nodeId, field, message }`
- `NodeRunStatus` — `"idle" | "running" | "completed" | "failed" | "skipped"`
- `NodeRunState` — `{ status, startedAt?, finishedAt?, tokensUsed?, costUsd?, agentName?, agentRole?, output?, error? }`
- `AgentBudgetState` — `{ agentName, spentUsd, budgetUsd, remainingUsd, pctUsed, month }`
- `AgentHealthState` — `{ agentName, healthStatus, lastHeartbeatAt }`
- `HistoryEntry` — `{ nodes, edges, yamlSpec, timestamp }`

### `store/companyStore.ts`
- `useCompanyStore` — hook Zustand
- Acciones: `loadCompany`, `saveCompany`, `setYamlSpec`, `addAgent`, `updateAgent`, `deleteAgent`, `setAgentBudget`, `setAgentHealth`, `refreshBudgets`

## Dependencias

- **Depende de:** A0 (`Company`, `AgentSpec`, `parseResource`, `serializeResource`, `validateResource`), `@xyflow/react` (tipos Node/Edge), `zustand`
- **Requerido por:** B3-PR-2 (PipelineStore usa `CanvasNode`, `CanvasEdge`, `HistoryEntry`), B0-PR-1 (Company Editor usa `useCompanyStore`), B4-PR-1 (WebSocket hook despacha `setAgentBudget`, `setAgentHealth`)

## Tests

**`apps/web/src/store/__tests__/companyStore.test.ts`**
- [ ] `setYamlSpec` con Company YAML válido actualiza `company.spec.agents` con los agentes parseados
- [ ] `addAgent(agentSpec)` re-serializa YAML y el nuevo agente aparece en `yamlSpec`
- [ ] `deleteAgent("alice")` elimina el agente y re-serializa; `company.spec.agents` no contiene "alice"
- [ ] `setYamlSpec` con YAML inválido setea `yamlErrors` sin borrar el `company` previo
- [ ] `updateAgent("alice", { role: "CTO" })` actualiza solo el campo `role`, mantiene el resto

## Warnings

- `deleteAgent` debe verificar si el agente es referenciado en `pipelineStore.nodes` — si es así, agregar warning en `yamlErrors` pero no bloquear el delete
- `_scheduleSave()` usa debounce de 500ms; en tests usar `vi.useFakeTimers()` para flush

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `types.ts` no importa de stores (es el módulo más bajo del stack)
- [ ] `companyStore.ts` no importa de `pipelineStore.ts` (evitar circular)
- [ ] Cada archivo tiene header comment con `@plan B3-PR-1`
