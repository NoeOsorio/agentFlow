# A1-PR-1: Tipos base y envelope de Pipeline

**Commit:** `feat(core/schema): pipeline envelope + variable reference system [A1-PR-1]`
**Rama:** `feat/A1-PR-1-pipeline-envelope`

---

## Qué resuelve

El contrato central del que dependen A2, A4 y el frontend. Sin esto, nada más puede compilar.

## Archivos

| Acción | Archivo |
|--------|---------|
| Reemplazar | `packages/core/src/schema/pipeline.ts` |
| Crear | `packages/core/src/schema/model.ts` |
| Crear | `packages/core/src/schema/variable.ts` |

## Símbolos exportados

### `schema/pipeline.ts` (reemplazar)
- `PipelineSpecSchema` — wrapper K8s con `apiVersion/kind/metadata/spec`
- `TriggerConfigSchema`, `PolicyConfigSchema`
- `CompanyReferenceSchema`, `AgentReferenceSchema`
- Deprecated alias `PipelineSchema` (mantener para backward compat con tests A0)

```typescript
// Canonical Pipeline YAML:
// apiVersion: agentflow.ai/v1
// kind: Pipeline
// metadata:
//   name: ship-feature
//   namespace: default
// spec:
//   company_ref: { name: acme-corp }
//   trigger: { type: webhook, source: github }
//   nodes: [...]
//   edges: [...]
```

### `schema/model.ts` (nuevo)
- `ModelProviderSchema` — `z.enum(["anthropic","openai","google","mistral","local"])`
- `ModelConfigSchema` — `{ provider, model_id, temperature?, max_tokens?, top_p?, system_prompt? }`
- `PromptSchema` — `{ system?, user }` (ambos soportan `{{#...#}}`)

### `schema/variable.ts` (nuevo)
- `VariableTypeSchema` — `z.enum(["string","number","boolean","object","array","file"])`
- `VariableDefinitionSchema` — `{ key, type, description?, required?, default? }`
- `VariableReferenceSchema` — `{ node_id, variable, path?: string[] }`
- `LiteralValueSchema` — `{ literal: string | number | boolean | null }`
- `parseVariableRef(str)` — parsea `{{#node_id.variable.path#}}`
- `serializeVariableRef(ref)` — serializa a `{{#node_id.variable.path#}}`
- `resolveVariableRefs(obj)` — walk recursivo convirtiendo strings a `VariableReference`

## Dependencias

- **Depende de:** A0 (`BaseResourceSchema`, `CompanySchema`, `AgentSchema`) — ya mergeado ✅
- **Requerido por:** A1-PR-2 (NodeSchemas referencian `VariableReference` y `ModelConfig`)

## Tests

**`packages/core/src/__tests__/pipeline.test.ts`**
- [ ] Parsea Pipeline YAML con `apiVersion/kind/metadata/spec` envelope
- [ ] Valida `company_ref` field
- [ ] Round-trip: serialize → parse produce output idéntico

**`packages/core/src/__tests__/variables.test.ts`**
- [ ] `parseVariableRef("{{#llm_1.output.text#}}")` → `{ node_id: "llm_1", variable: "output", path: ["text"] }`
- [ ] Round-trip `parseVariableRef` ↔ `serializeVariableRef`
- [ ] `parseVariableRef` con path vacío → `{ node_id: "start", variable: "feature_description", path: [] }`

## Definition of Done

- [ ] `pnpm --filter @agentflow/core build` sin errores de tipo
- [ ] Tests pasan
- [ ] `PipelineSchema` deprecated alias no rompe `resource.test.ts` existente
- [ ] No hay imports que apunten a `schema/nodes.ts` (aún no existe)
