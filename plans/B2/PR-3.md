# B2-PR-3: Remaining 13 node cards

**Commit:** `feat(ui/nodes): 13 node cards para control flow, AI, data e integración [B2-PR-3]`
**Rama:** `feat/B2-PR-3-node-cards`

---

## Qué resuelve

Implementa todos los node cards restantes que completan la biblioteca visual del canvas: control flow (Start, End, IfElse, Iteration), AI (LLM, KnowledgeRetrieval), data processing (Code, HTTP, Template, VariableAssigner, VariableAggregator) e integración (HumanInput, SubWorkflow).

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `packages/ui/src/nodes/StartNodeCard.tsx` | start node, output variables, no input handle |
| Crear | `packages/ui/src/nodes/EndNodeCard.tsx` | end node, pipeline output, no output handle |
| Crear | `packages/ui/src/nodes/IfElseNodeCard.tsx` | conditional, branches, labeled handles |
| Crear | `packages/ui/src/nodes/IterationNodeCard.tsx` | for loop, iterator var, progress counter |
| Crear | `packages/ui/src/nodes/LLMNodeCard.tsx` | provider badge, model name, prompt preview |
| Crear | `packages/ui/src/nodes/KnowledgeRetrievalNodeCard.tsx` | knowledge base, top_k |
| Crear | `packages/ui/src/nodes/CodeNodeCard.tsx` | language badge, code preview |
| Crear | `packages/ui/src/nodes/HTTPNodeCard.tsx` | method badge, URL preview |
| Crear | `packages/ui/src/nodes/TemplateNodeCard.tsx` | template preview |
| Crear | `packages/ui/src/nodes/VariableAssignerCard.tsx` | variable chips |
| Crear | `packages/ui/src/nodes/VariableAggregatorCard.tsx` | aggregation strategy, multiple inputs |
| Crear | `packages/ui/src/nodes/HumanInputCard.tsx` | approval prompt, timeout, waiting state |
| Crear | `packages/ui/src/nodes/SubWorkflowCard.tsx` | nested pipeline, pipeline reference |

## Símbolos exportados

`StartNodeCard`, `EndNodeCard`, `IfElseNodeCard`, `IterationNodeCard`, `LLMNodeCard`, `KnowledgeRetrievalNodeCard`, `CodeNodeCard`, `HTTPNodeCard`, `TemplateNodeCard`, `VariableAssignerCard`, `VariableAggregatorCard`, `HumanInputCard`, `SubWorkflowCard`

## Dependencias

- **Depende de:** B2-PR-1 (`BaseNodeCard`, `NodeHandle`, `NODE_COLORS`), A1 tipos de nodo correspondientes (`LLMNode`, `CodeNode`, `IfElseNode`, etc.)
- **Requerido por:** B2-PR-4 (incluidos en `nodeTypes` map), B1-PR-1 (registro en React Flow)

## Tests

**`packages/ui/src/__tests__/nodeCards.test.tsx`**
- [ ] `StartNodeCard` no renderiza handle de input (type="target")
- [ ] `EndNodeCard` no renderiza handle de output (type="source")
- [ ] `IfElseNodeCard` con 3 branches renderiza 3 labeled source handles
- [ ] `IterationNodeCard` con `runStatus="running"` muestra contador `(2/10)` si `progress` prop provisto
- [ ] `LLMNodeCard` trunca prompt preview a 60 caracteres con ellipsis
- [ ] `HumanInputCard` con `runStatus="running"` muestra "⏳ Waiting for approval"

## Definition of Done

- [ ] `pnpm --filter @agentflow/ui build` sin errores de tipo
- [ ] Tests pasan
- [ ] Todos los cards tienen width fijo `240px` y tema oscuro `bg-gray-800`
- [ ] `IfElseNodeCard` soporta handles dinámicos (número de branches variable)
- [ ] Cada archivo tiene header comment con `@plan B2-PR-3`
