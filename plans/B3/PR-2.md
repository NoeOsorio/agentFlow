# B3-PR-2: PipelineStore + bidirectional YAML sync

**Commit:** `feat(web/store): PipelineStore con YAML sync bidireccional, undo/redo y auto-save [B3-PR-2]`
**Rama:** `feat/B3-PR-2-pipeline-store`

---

## Qué resuelve

El store principal del canvas: gestiona nodos, edges, viewport, YAML bidireccional, historial de undo/redo (50 entradas) y auto-save debounced. Es el "cerebro" del Pipeline Editor.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/store/pipelineStore.ts` | PipelineStore, addNode, setYamlSpec, undo/redo, savePipeline, loadPipeline |

## Símbolos exportados

- `usePipelineStore` — hook Zustand con el estado completo
- Acciones: `addNode`, `updateNodeConfig`, `deleteNode`, `addEdge`, `deleteEdge`, `updateNodePositions`, `selectNode`, `deselectNode`, `setPipelineName`, `setCompanyRef`, `setYamlSpec`, `toggleYamlPanel`, `setViewport`, `setNodePositions`, `undo`, `redo`, `savePipeline`, `loadPipeline`, `setActiveRun`, `updateNodeRunState`, `clearRunStates`
- Computed: `canUndo`, `canRedo`

## Dependencias

- **Depende de:** B3-PR-1 (`CanvasNode`, `CanvasEdge`, `HistoryEntry`, `NodeRunStatus`, `NodeRunState`), A1 (`parsePipeline`, `serializePipeline`, `validatePipeline`, `Pipeline`, `PipelineNode`, `PipelineEdge`, `CanvasMeta`)
- **Requerido por:** B1-PR-2 (`CanvasEditor` lee `nodes`, `edges`, `viewport`), B4-PR-1 (WebSocket hook despacha `updateNodeRunState`, `setActiveRun`)

## Tests

**`apps/web/src/store/__tests__/pipelineStore.test.ts`**
- [ ] `addNode("agent_pod", { x: 100, y: 200 })` crea nodo con `agent_ref=null` y ID con prefijo `agent_pod_`
- [ ] `setYamlSpec` con YAML inválido: setea `yamlErrors`, no modifica `nodes` ni `edges`
- [ ] `undo()` después de `addNode` restaura el array `nodes` previo
- [ ] `redo()` después de `undo()` vuelve al estado posterior al `addNode`
- [ ] `setCompanyRef({ name: "acme-corp" })` corre validación de agent refs en nodos existentes
- [ ] `_validatePipeline` detecta `agent_pod` con `agent_ref.name` que no existe en `companyStore.company.spec.agents` y agrega `NodeValidationError`

## Warnings

- `_syncNodesToYaml` y `setYamlSpec` pueden causar loop infinito si no se usa un flag guard — usar `_isSyncing` interno
- `addNode` para `agent_pod` debe generar ID único con `nanoid(6)`: `agent_pod_${nanoid(6)}`
- La historia de undo/redo tiene máximo 50 entradas; al superar el límite, eliminar la más antigua

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `canUndo` es `false` en estado inicial
- [ ] `savePipeline()` llama `PUT /api/pipelines/{id}` con `yaml_spec`
- [ ] Cada archivo tiene header comment con `@plan B3-PR-2`
