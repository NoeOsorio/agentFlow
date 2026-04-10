# B3-PR-3: Variable scope + validation hooks

**Commit:** `feat(web/store): variable scope tracker, validation hooks y agent budget hooks [B3-PR-3]`
**Rama:** `feat/B3-PR-3-scope-and-hooks`

---

## Qué resuelve

Entrega los hooks de alto nivel que el canvas y los config forms consumen: scope de variables upstream por nodo, errores de validación por nodo, budget y health de agentes en tiempo real.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/store/variableScope.ts` | topological sort, upstream variables, cycle detection |

## Símbolos exportados

### `store/variableScope.ts`
- `computeVariableScope(nodes, edges, forNodeId) -> AvailableVariable[]` — topological sort + derivación de outputs por tipo de nodo
- `AvailableVariable` — `{ node_id, variable, path?, type, description }`

### Hooks (agregados en `pipelineStore.ts` y `companyStore.ts`)
- `useVariableScope(nodeId: string): AvailableVariable[]` — useMemo sobre `computeVariableScope`
- `useNodeValidationErrors(nodeId: string): NodeValidationError[]` — filtra `yamlErrors` por `nodeId`
- `useAgentBudget(agentName: string): AgentBudgetState | undefined` — lee `companyStore.agentBudgets`
- `useAgentHealth(agentName: string): AgentHealthState | undefined` — lee `companyStore.agentHealth`

## Dependencias

- **Depende de:** B3-PR-1 (`AgentBudgetState`, `AgentHealthState`, `NodeValidationError`), B3-PR-2 (`usePipelineStore` para `nodes`, `edges`, `yamlErrors`)
- **Requerido por:** B1-PR-3 (`ConfigPanel` usa `useNodeValidationErrors`), B2-PR-4 (`VariableReferencePicker` recibe `availableVariables` como prop — el hook lo provee el canvas, no el widget)

## Tests

**`apps/web/src/store/__tests__/variableScope.test.ts`**
- [ ] `computeVariableScope` para nodo C (posterior a A y B en paralelo) incluye outputs de A y de B
- [ ] `agent_pod` outputs incluyen `response`, `agent_name`, `agent_role`
- [ ] `llm` outputs incluyen `text`, `tokens_used`
- [ ] `computeVariableScope` con ciclo en el grafo retorna array vacío y no lanza excepción
- [ ] `useNodeValidationErrors("node_1")` retorna solo errores cuyo `nodeId === "node_1"`

## Warnings

- `computeVariableScope` hace sort topológico — si el grafo tiene ciclos (caso inválido), debe retornar `[]` silenciosamente (el error de ciclo ya lo captura `_validatePipeline`)

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `computeVariableScope` es una función pura (sin side effects, testeable sin stores)
- [ ] Cada archivo tiene header comment con `@plan B3-PR-3`
