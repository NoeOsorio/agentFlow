# B2-PR-1: Base node card infrastructure

**Commit:** `feat(ui/nodes): BaseNodeCard + NodeHandle + color map [B2-PR-1]`
**Rama:** `feat/B2-PR-1-base-node-infrastructure`

---

## Qué resuelve

Establece la anatomía visual compartida de todos los nodos del canvas: el card base con run-status overlay, los handles de entrada/salida y el mapa de colores por tipo de nodo.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `packages/ui/src/nodes/BaseNodeCard.tsx` | base card, run status, overlay, animation |
| Crear | `packages/ui/src/nodes/NodeHandle.tsx` | input handle, output handle, conditional handle |
| Crear | `packages/ui/src/nodes/colors.ts` | node type colors, accent, theme |
| Crear | `packages/ui/src/nodes/types.ts` | NodeRunStatus, NodeRunState, BaseNodeCardProps |

## Símbolos exportados

- `BaseNodeCard` — componente base con props: `id`, `type`, `label`, `icon`, `accentColor`, `runStatus?`, `selected?`, `children?`
- `NodeHandle` — wrapper de `@xyflow/react Handle` para input/output/conditional
- `NODE_COLORS` — mapa `Record<NodeType, string>` de colores de acento por tipo
- `NodeRunStatus` — `"idle" | "running" | "completed" | "failed" | "skipped"`
- `BaseNodeCardProps` — interfaz TypeScript del componente

## Dependencias

- **Depende de:** `@xyflow/react` (Handle), Tailwind CSS 3.4, A1 `NodeType` enum (para `NODE_COLORS`)
- **Requerido por:** B2-PR-2, B2-PR-3 (todos los node cards heredan `BaseNodeCard`), B4-PR-2 (actualiza `BaseNodeCard` con agent identity overlay)

## Tests

**`packages/ui/src/__tests__/BaseNodeCard.test.tsx`**
- [ ] `runStatus="running"` aplica clase `animate-pulse` y `ring-yellow-400`
- [ ] `runStatus="completed"` muestra checkmark `✓` con `ring-green-500`
- [ ] `runStatus="failed"` muestra `✗` con `ring-red-500`
- [ ] `selected=true` aplica `ring-blue-500`
- [ ] `runStatus="idle"` no renderiza overlay
- [ ] `NodeHandle` con `type="source"` renderiza en lado derecho

## Definition of Done

- [ ] `pnpm --filter @agentflow/ui build` sin errores de tipo
- [ ] Tests pasan
- [ ] No hay imports que referencien node cards específicos (solo `@xyflow/react`)
- [ ] Cada archivo tiene header comment con `@module`, `@plan B2-PR-1`, `@provides`, `@depends_on`
