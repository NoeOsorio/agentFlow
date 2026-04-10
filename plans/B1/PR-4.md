# B1-PR-4: YAML panel + Pipelines list page

**Commit:** `feat(web/canvas): YamlPanel Monaco bidireccional y PipelinesPage [B1-PR-4]`
**Rama:** `feat/B1-PR-4-yaml-panel-and-pipelines`

---

## Qué resuelve

Completa el Pipeline Editor con el panel YAML Monaco bidireccional (toggle desde el header) y entrega la página de listado de pipelines con cards que muestran company badge y último estado de run.

## Archivos

| Acción | Archivo | Keywords |
|--------|---------|----------|
| Crear | `apps/web/src/features/canvas/YamlPanel.tsx` | Monaco YAML, debounced sync, error gutter, read-only during run |
| Actualizar | `apps/web/src/pages/PipelinesPage.tsx` | pipeline cards, company badge, last run status, new pipeline, delete |

## Símbolos exportados

- `YamlPanel` — Monaco Editor sincronizado con `usePipelineStore.yamlSpec`; read-only cuando `activeRunId !== null`
- `PipelinesPage` — página en `/pipelines` con grid de pipeline cards

## Dependencias

- **Depende de:** B1-PR-3 (`PipelineHeader` provee el toggle `yamlPanelOpen`), B3-PR-2 (`usePipelineStore`: `yamlSpec`, `yamlErrors`, `yamlPanelOpen`, `setYamlSpec`), `@monaco-editor/react`
- **Requerido por:** nada — este es el PR hoja de B1. Puede mergearse en paralelo con B4 si B1-PR-1/2/3 ya están mergeados.

## Tests

**`apps/web/src/features/canvas/__tests__/YamlPanel.test.tsx`**
- [ ] Editar YAML en Monaco con YAML inválido: `yamlErrors` se setea, canvas (`nodes`) no cambia
- [ ] Editar YAML válido con nuevo nodo: canvas se actualiza después de 300ms de debounce
- [ ] `activeRunId !== null`: Monaco en modo `readOnly`, sin cursor de edición
- [ ] Botón "Copy" copia el contenido actual de `yamlSpec` al clipboard

**`apps/web/src/pages/__tests__/PipelinesPage.test.tsx`**
- [ ] "New Pipeline" hace `POST /api/pipelines/` con YAML por defecto y navega a `/canvas/:id`
- [ ] Pipeline cards muestran company badge cuando `pipeline.company_ref` está seteado
- [ ] "Delete" con confirmación llama `DELETE /api/pipelines/:id` y remueve la card
- [ ] Filtro "Filter by company" muestra solo pipelines de esa company

## Warnings

- `@monaco-editor/react` debe estar instalado en `apps/web` (se instaló en B2-PR-4 para `@agentflow/ui` — verificar que también esté en `apps/web/package.json`)
- El YamlPanel es de `@agentflow/web` (no de `@agentflow/ui`) porque depende de los stores de la app

## Definition of Done

- [ ] `pnpm --filter @agentflow/web build` sin errores de tipo
- [ ] Tests pasan
- [ ] `YamlPanel` debounce de 300ms (no parsea en cada keystroke)
- [ ] Error markers de Monaco apuntan a las líneas correctas (mapeadas desde `yamlErrors`)
- [ ] Cada archivo tiene header comment con `@plan B1-PR-4`
