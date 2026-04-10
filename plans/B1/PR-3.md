# B1-PR-3: ConfigPanel + PipelineHeader + Toolbar + Keyboard shortcuts

**Commit:** `feat(web/canvas): ConfigPanel, PipelineHeader con CompanySelector, toolbar y shortcuts [B1-PR-3]`
**Rama:** `feat/B1-PR-3-canvas-panels`

---

## Qué resuelve

Completa la interactividad del canvas: el panel lateral de configuración por nodo, el header con CompanySelector y save/run/export, la toolbar de zoom/layout/undo y los keyboard shortcuts.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/canvas/ConfigPanel.tsx` | selected node form, slide in, validation errors, delete node |
| Crear | `apps/web/src/features/canvas/nodeConfigForms.ts` | node type → form component map |
| Crear | `apps/web/src/features/canvas/PipelineHeader.tsx` | pipeline name, CompanySelector, save status, run button, export/import YAML |
| Crear | `apps/web/src/features/canvas/CanvasToolbar.tsx` | zoom, fit, auto-layout Dagre, undo/redo, minimap toggle |
| Crear | `apps/web/src/features/canvas/hooks/useKeyboardShortcuts.ts` | Delete, Escape, Ctrl+Z, Ctrl+S, Space |

## Símbolos exportados

- `ConfigPanel` — panel derecho; renderiza `nodeConfigForms[node.type]` para el nodo seleccionado
- `nodeConfigForms` — mapa local (re-export de `@agentflow/ui`) para uso interno del canvas
- `PipelineHeader` — header completo con pipeline name, company selector, estados de save y run
- `CanvasToolbar` — toolbar flotante con controles de viewport y layout
- `useKeyboardShortcuts` — hook que registra listeners en `document`

## Dependencias

- **Depende de:** B1-PR-2 (`CanvasEditor` monta estos componentes), B2-PR-4 (`nodeConfigForms` de `@agentflow/ui`), B3-PR-2 (`usePipelineStore`: `selectedNodeId`, `canUndo`, `canRedo`, `undo`, `redo`, `savePipeline`), B3-PR-3 (`useNodeValidationErrors`), B0-PR-3 (`CompanySelector`)
- **Requerido por:** B1-PR-4 (`YamlPanel` se integra en `PipelineHeader` toggle)

## Warnings

- Instalar Dagre: `pnpm --filter @agentflow/web add dagre @types/dagre`
- Auto-layout asume nodo size `240×80px` con separación `60px H, 40px V` — hardcodeado en `CanvasToolbar`
- `useKeyboardShortcuts` debe hacer `event.preventDefault()` en `Ctrl+S` para evitar el save del browser
- `ConfigPanel` no debe renderizar si `selectedNodeId === null` (slide out con CSS transition)

## Tests

**`apps/web/src/features/canvas/__tests__/ConfigPanel.test.tsx`**
- [ ] Con `selectedNodeId` de un nodo `llm`: renderiza `LLMNodeForm`
- [ ] Con `selectedNodeId` de un nodo `agent_pod` sin `agent_ref`: muestra `NodeValidationError` en el panel
- [ ] "Delete Node" button muestra diálogo de confirmación antes de llamar `deleteNode`
- [ ] Sin `selectedNodeId`: panel no es visible (`display: none` o no montado)

**`apps/web/src/features/canvas/__tests__/CanvasToolbar.test.tsx`**
- [ ] Click "Auto Layout" llama `setNodePositions` con posiciones calculadas por Dagre
- [ ] Undo button está disabled cuando `canUndo === false`
- [ ] Redo button está disabled cuando `canRedo === false`

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `Ctrl+S` / `Cmd+S` ejecuta `savePipeline()` y muestra badge "saving..." → "saved"
- [ ] `Delete` key elimina nodo seleccionado (si hay confirmación, sin confirmación para edges)
- [ ] Cada archivo tiene header comment con `@plan B1-PR-3`
