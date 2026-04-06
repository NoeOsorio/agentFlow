# A1-PR-4: Exports públicos y YAMLs de ejemplo

**Commit:** `docs(core): public exports and example YAML files [A1-PR-4]`
**Rama:** `feat/A1-PR-4-exports-examples`

---

## Qué resuelve

La superficie pública limpia del paquete `@agentflow/core` y documentación viva en forma de YAMLs validados. No bloquea nada — es el PR de cierre de A1.

## Archivos

| Acción | Archivo |
|--------|---------|
| Actualizar | `packages/core/src/index.ts` |
| Crear | `packages/core/examples/simple-pipeline.yaml` |
| Crear | `packages/core/examples/agent-pipeline.yaml` |
| Crear | `packages/core/examples/branching-pipeline.yaml` |
| Crear | `packages/core/examples/parallel-pipeline.yaml` |
| Crear | `packages/core/examples/full-manifest.yaml` |

## Re-exports en `index.ts`

```typescript
// A0 (mantener)
export * from './schema/resource'
export * from './schema/agent'
export * from './schema/company'

// A1-PR-1
export * from './schema/pipeline'   // PipelineSpecSchema, deprecated PipelineSchema
export * from './schema/model'      // ModelConfigSchema, PromptSchema
export * from './schema/variable'   // VariableDefinitionSchema, VariableReferenceSchema, parseVariableRef, serializeVariableRef

// A1-PR-2
export * from './schema/nodes'      // NodeSchema, PipelineEdgeSchema, 14 node schemas
export * from './schema/conditions' // ConditionSchema, ConditionGroupSchema, ConditionOperatorSchema
export * from './schema/canvas'     // CanvasMetaSchema

// A1-PR-3
export * from './parser/index'      // parsePipeline, validatePipeline, compileEdges, CompiledGraph, CyclicDependencyError
```

## Contenido de los ejemplos YAML

### `simple-pipeline.yaml`
Pipeline mínimo: `start → llm → end`. Sin `company_ref`. Demuestra el envelope K8s.

### `agent-pipeline.yaml`
Pipeline con `company_ref: { name: acme-corp }` y 2 nodos `agent_pod` (alice → bob). Demuestra resolución de agentes desde Company.

### `branching-pipeline.yaml`
`start → llm → if_else → [branch_true: template_a, branch_false: template_b] → end`. Demuestra `ConditionGroup` y edges condicionales.

### `parallel-pipeline.yaml`
`start → [llm_1 ‖ llm_2 ‖ llm_3] → variable_aggregator → end`. Los 3 LLM nodes arrancan en paralelo desde `start`. Demuestra `entryPoints` múltiples en el DAG.

### `full-manifest.yaml`
Documento multi-YAML (`---` separator): `Company` (kind: Company) + `Pipeline` (kind: Pipeline) en un solo archivo. Demuestra `parseMultiDocument` y el `company_ref`.

## Dependencias

- **Depende de:** A1-PR-1, A1-PR-2, A1-PR-3
- **No requerido por nada** — capa de documentación pura

## Tests

**`packages/core/src/__tests__/examples.test.ts`** (nuevo)
- [ ] `simple-pipeline.yaml` → `validatePipeline` retorna `success: true`
- [ ] `agent-pipeline.yaml` → `validatePipeline` retorna `success: true`
- [ ] `branching-pipeline.yaml` → `validatePipeline` + `compileEdges` sin errores
- [ ] `parallel-pipeline.yaml` → `compileEdges` produce `entryPoints` con los 3 LLM node IDs
- [ ] `full-manifest.yaml` → `parseMultiDocument` retorna array de 2 recursos con `kind` correcto

## Definition of Done

- [ ] `pnpm --filter @agentflow/core build` sin errores
- [ ] Todos los YAMLs de ejemplo parsean sin errores
- [ ] `index.ts` no tiene exports duplicados ni circulares
- [ ] El ejemplo `agent-pipeline.yaml` usa `agent_ref: { name: alice }` (no string plano)
