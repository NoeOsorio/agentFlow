# B2-PR-2: AgentPodNodeCard + AgentSelector widget

**Commit:** `feat(ui/nodes): AgentPodNodeCard con role badge, budget bar y AgentSelector [B2-PR-2]`
**Rama:** `feat/B2-PR-2-agent-pod-node`

---

## Qué resuelve

El componente más importante del canvas: el nodo de agente que muestra identidad real (role, persona, budget) desde el Company YAML, y el widget `AgentSelector` para elegir agentes en el ConfigPanel.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `packages/ui/src/nodes/AgentPodNodeCard.tsx` | agent pod, role badge, persona snippet, budget bar |
| Crear | `packages/ui/src/forms/widgets/AgentSelector.tsx` | agent dropdown, company agents, budget badge |
| Crear | `packages/ui/src/nodes/BudgetBar.tsx` | budget progress bar, green/yellow/red thresholds |

## Símbolos exportados

- `AgentPodNodeCard` — props: `data: AgentPodNode & { agentSpec?: AgentSpec, runStatus?: NodeRunStatus }`
- `AgentSelector` — props: `value: AgentReference | null`, `onChange`, `availableAgents: AgentSpec[]`
- `BudgetBar` — props: `spent: number`, `budget: number` (reutilizado en B0 AgentCard)

## Dependencias

- **Depende de:** B2-PR-1 (`BaseNodeCard`, `NodeHandle`, `NODE_COLORS`), A0 (`AgentSpec`, `AgentReference`), A1 (`AgentPodNode`)
- **Requerido por:** B1-PR-1 (incluido en `nodeTypes` map), B0-PR-2 (`BudgetBar` reutilizado en `AgentCard`), B2-PR-4 (`AgentPodForm` usa `AgentSelector`)

## Tests

**`packages/ui/src/__tests__/AgentPodNodeCard.test.tsx`**
- [ ] Con `agentSpec` provisto: renderiza role badge "Lead Engineer", snippet de persona (60 chars), nombre de modelo
- [ ] Con `agentSpec=null`: muestra placeholder naranja "Select agent ▾"
- [ ] `BudgetBar` a 55% muestra color verde, 75% amarillo, 90% rojo
- [ ] `runStatus="running"` muestra pulsing overlay encima de la card

**`packages/ui/src/__tests__/AgentSelector.test.tsx`**
- [ ] Lista agents con formato `[avatar] Alice — Lead Engineer ($80 left)`
- [ ] Filtra agents por nombre al escribir en el search input
- [ ] `value=null` muestra "No agent selected" con estilo warning

## Definition of Done

- [ ] `pnpm --filter @agentflow/ui build` sin errores de tipo
- [ ] Tests pasan
- [ ] `AgentPodNodeCard` sin `agentSpec` no rompe el canvas (graceful degradation)
- [ ] `BudgetBar` es un componente independiente exportado (reutilizable en B0)
- [ ] Cada archivo tiene header comment con `@plan B2-PR-2`
