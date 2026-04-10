# B1-PR-1: Project structure + node/edge type registration + CanvasPage

**Commit:** `feat(web/canvas): estructura canvas feature, nodeTypes/edgeTypes y CanvasPage [B1-PR-1]`
**Rama:** `feat/B1-PR-1-canvas-structure`

---

## Qué resuelve

Crea la estructura del feature `canvas`, registra los 14 tipos de nodo y los 2 tipos de edge en React Flow, y actualiza `CanvasPage` para cargar el pipeline desde la API con skeleton de carga y estado de error.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/canvas/index.ts` | re-exports del feature |
| Crear | `apps/web/src/features/canvas/nodeTypes.ts` | React Flow nodeTypes map, 14 tipos |
| Crear | `apps/web/src/features/canvas/edgeTypes.ts` | DefaultEdge, ConditionalEdge, delete button |
| Actualizar | `apps/web/src/pages/CanvasPage.tsx` | loadPipeline, loading skeleton, error state |

## Símbolos exportados

- `nodeTypes` — `Record<string, ComponentType>` con los 14 tipos → componentes de B2-PR-3/PR-2
- `edgeTypes` — `{ default: DefaultEdge, conditional: ConditionalEdge }`
- `DefaultEdge` — edge animado con delete button en hover
- `ConditionalEdge` — edge con color por branch y label tooltip

## Dependencias

- **Depende de:** B2-PR-2 (`AgentPodNodeCard`), B2-PR-3 (13 node cards), B3-PR-2 (`usePipelineStore.loadPipeline`)
- **Requerido por:** B1-PR-2 (`CanvasEditor` consume `nodeTypes` y `edgeTypes`)

## Tests

**`apps/web/src/features/canvas/__tests__/nodeTypes.test.ts`**
- [ ] `nodeTypes` contiene exactamente 14 keys (`start`, `end`, `agent_pod`, `llm`, `code`, `http`, `if_else`, `template`, `variable_assigner`, `variable_aggregator`, `iteration`, `human_input`, `knowledge_retrieval`, `sub_workflow`)
- [ ] `CanvasPage` muestra skeleton mientras `loadPipeline` está en curso
- [ ] `CanvasPage` muestra mensaje de error si `loadPipeline` rechaza con 404

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `nodeTypes` importa desde `@agentflow/ui` (no re-implementa los componentes)
- [ ] `edgeTypes.ts` no importa de los stores (recibe callbacks via props de React Flow)
- [ ] Cada archivo tiene header comment con `@plan B1-PR-1`
