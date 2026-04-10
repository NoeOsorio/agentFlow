# B1-PR-2: CanvasEditor core + NodePalette company-aware

**Commit:** `feat(web/canvas): CanvasEditor con React Flow y NodePalette con company agents [B1-PR-2]`
**Rama:** `feat/B1-PR-2-canvas-editor-core`

---

## Qué resuelve

El canvas principal: integra React Flow con los stores, maneja drag-and-drop de nodos, validación de conexiones, y el palette lateral que expone agentes de la company activa como items de primera clase.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/canvas/CanvasEditor.tsx` | React Flow, onConnect validation, snapToGrid, node/edge changes |
| Crear | `apps/web/src/features/canvas/NodePalette.tsx` | company agents, drag source, sections, filter search |

## Símbolos exportados

- `CanvasEditor` — componente principal con `<ReactFlow>`, `<Background>`, `<Controls>`, `<MiniMap>`
- `NodePalette` — sidebar izquierdo con secciones: Company Agents, Control Flow, AI & Models, Data, Integration

## Dependencias

- **Depende de:** B1-PR-1 (`nodeTypes`, `edgeTypes`), B3-PR-2 (`usePipelineStore`: `nodes`, `edges`, `viewport`, `onNodesChange`, `addEdge`, `selectNode`), B3-PR-1 (`useCompanyStore`: `company.spec.agents`), B0-PR-3 (`CompanySelector` en `PipelineHeader` — el header se implementa en B1-PR-3, pero el data flow se establece aquí)
- **Requerido por:** B1-PR-3 (`ConfigPanel` y `PipelineHeader` se montan como hijos de `CanvasEditor`)

## Tests

**`apps/web/src/features/canvas/__tests__/CanvasEditor.test.tsx`**
- [ ] Drop de tipo `agent_pod` con `agent-name="alice"` crea nodo con `data.agent_ref = { name: "alice" }`
- [ ] Conectar `EndNode` output → cualquier nodo es rechazado por `isValidConnection`
- [ ] Conectar `StartNode` input → cualquier nodo es rechazado por `isValidConnection`
- [ ] `onNodesChange` con tipo `position` llama `updateNodePositions(changes)` en PipelineStore

**`apps/web/src/features/canvas/__tests__/NodePalette.test.tsx`**
- [ ] Con `companyRef` seteado: sección "Company Agents" muestra un item por agent en la company
- [ ] Item de agente con `budget.pctUsed > 0.8` muestra badge de budget en rojo
- [ ] Sin `companyRef`: sección "Company Agents" no se renderiza
- [ ] Filtro de búsqueda "llm" oculta todos los items excepto LLM node

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `snapToGrid={true}` y `snapGrid={[16, 16]}` configurados en React Flow
- [ ] Drag-and-drop de `NodePalette` a canvas usa `dataTransfer` con keys `node-type` y `agent-name`
- [ ] Cada archivo tiene header comment con `@plan B1-PR-2`
