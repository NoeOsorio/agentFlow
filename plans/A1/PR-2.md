# A1-PR-2: Schemas de los 14 tipos de nodos

**Commit:** `feat(core/schema): 14 node type schemas as discriminated union [A1-PR-2]`
**Rama:** `feat/A1-PR-2-node-schemas`

---

## Qué resuelve

El catálogo completo de nodos como discriminated union. Define qué es válido en un pipeline antes de que el parser o el runtime lo toquen.

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `packages/core/src/schema/nodes.ts` |
| Crear | `packages/core/src/schema/conditions.ts` |
| Crear | `packages/core/src/schema/canvas.ts` |

## Símbolos exportados

### `schema/nodes.ts`
Los 14 schemas de nodo (cada uno con `id: string` y `label?: string` via intersección):

| Schema | `type` | Campos clave |
|--------|--------|-------------|
| `StartNodeSchema` | `"start"` | `outputs: VariableDefinition[]` |
| `EndNodeSchema` | `"end"` | `inputs: VariableReference[]` |
| `LLMNodeSchema` | `"llm"` | `model: ModelConfig, prompt: Prompt, output_schema?, agent_ref?` |
| `AgentPodNodeSchema` | `"agent_pod"` | `agent_ref: AgentReference, instruction: string, inputs?, resource?` |
| `CodeNodeSchema` | `"code"` | `language, code, inputs, outputs, timeout_seconds?` |
| `HTTPNodeSchema` | `"http"` | `method, url, headers?, body?, timeout_ms?` |
| `IfElseNodeSchema` | `"if_else"` | `conditions: ConditionGroup[], default_branch: string` |
| `TemplateNodeSchema` | `"template"` | `template: string, inputs: VariableReference[]` |
| `VariableAssignerNodeSchema` | `"variable_assigner"` | `assignments: { key, value }[]` |
| `VariableAggregatorNodeSchema` | `"variable_aggregator"` | `branches, output_key, strategy: "first"\|"merge"\|"list"` |
| `IterationNodeSchema` | `"iteration"` | `input_list, iterator_var, body_nodes` |
| `HumanInputNodeSchema` | `"human_input"` | `prompt, timeout_seconds?, fallback: "skip"\|"fail"` |
| `KnowledgeRetrievalNodeSchema` | `"knowledge_retrieval"` | `query, knowledge_base_id, top_k?` |
| `SubWorkflowNodeSchema` | `"sub_workflow"` | `pipeline_ref, inputs` |

- `NodeSchema` — `z.discriminatedUnion("type", [...14 schemas])`
- `PipelineEdgeSchema` — `{ id, source, target, source_handle?, target_handle?, label?, condition_branch? }`

### `schema/conditions.ts`
- `ConditionOperatorSchema` — 12 operadores: `eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`
- `ConditionSchema` — `{ left: VariableReference, operator, right?: VariableReference | LiteralValue, branch_id }`
- `ConditionGroupSchema` — `{ logic: "and"|"or", conditions: Condition[], branch_id }`

### `schema/canvas.ts`
- `NodePositionSchema` — `{ x: number, y: number }`
- `ViewportSchema` — `{ x: number, y: number, zoom: number }`
- `CanvasMetaSchema` — `{ viewport: Viewport, node_positions: Record<string, NodePosition> }`

## Dependencias

- **Depende de:** A1-PR-1 (`VariableReference`, `LiteralValue`, `ModelConfig`, `VariableDefinition`)
- **Requerido por:** A1-PR-3 (`compileEdges` itera sobre `NodeSchema`), A4 (ejecutores implementan por `type`)

## Tests

**`packages/core/src/__tests__/nodes.test.ts`**
- [ ] Cada tipo valida su happy path (14 casos)
- [ ] `AgentPodNodeSchema` requiere `agent_ref` (sin él: error de validación)
- [ ] `IfElseNodeSchema` requiere al menos un `ConditionGroup`
- [ ] `NodeSchema` (discriminated union) rechaza `type: "unknown_type"` con error claro
- [ ] `PipelineEdgeSchema` valida `source_handle` para ramas condicionales

## Definition of Done

- [ ] `pnpm --filter @agentflow/core build` sin errores
- [ ] 14 node types en la union — ni uno más, ni menos
- [ ] No hay imports que apunten a `parser/index.ts` (circular)
- [ ] Los 12 operadores de condición cubren todos los casos del plan A4
