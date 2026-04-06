# A1-PR-3: Parser y compilador de DAG

**Commit:** `feat(core/parser): compileEdges DAG + pipeline parser/serializer [A1-PR-3]`
**Rama:** `feat/A1-PR-3-parser-compileedges`

---

## Qué resuelve

La lógica que convierte YAML → grafo ejecutable. Es el contrato principal con A2: `PipelineExecutor` consume `CompiledGraph` para construir el LangGraph DAG.

## Archivos

| Acción | Archivo |
|--------|---------|
| Ampliar | `packages/core/src/parser/index.ts` |

## Símbolos nuevos a agregar

```typescript
// Tipo de retorno de compileEdges — contrato con A2
export type CompiledGraph = {
  nodes: Record<string, {
    node: PipelineNode,
    dependsOn: string[],   // IDs de nodos prerequisito
    provides: string[],    // nombres de variables que produce
  }>,
  entryPoints: string[],  // nodos sin dependsOn (START del DAG)
  exitPoints: string[],   // nodos sin salientes (END del DAG)
}

export class CyclicDependencyError extends Error {}
```

### Funciones nuevas
- `parsePipeline(yamlString: string): Pipeline` — valida contra `PipelineSpecSchema` con envelope K8s
- `serializePipeline(pipeline: Pipeline): string` — serializa a YAML con `apiVersion/kind/metadata/spec`
- `validatePipeline(yamlString: string): SafeParseResult<Pipeline>` — safe parse sin throw
- `resolveVariableRefs(pipeline: Pipeline): Pipeline` — walk todos los campos de nodo y convierte `{{#...#}}` strings a `VariableReference` objects
- `compileEdges(pipeline: Pipeline): CompiledGraph` — construye adjacency map desde `spec.edges`, detecta ciclos (Kahn's algorithm), identifica entry/exit points

### Funciones existentes (mantener sin cambios)
- `parseResource`, `parseMultiDocument`, `validateResource`, `serializeResource` — re-export desde A0
- `parseYAML`, `serializeAST`, `validateYAML` — deprecated wrappers, no eliminar

## Contrato con A2

```python
# El runtime Python deserializa el output de compileEdges así:
compiled = json.loads(compiled_graph_json)
entry_points = compiled["entryPoints"]   # nodos de inicio
for node_id, info in compiled["nodes"].items():
    depends_on = info["dependsOn"]       # build LangGraph edges
```

**El `type` del nodo en `NodeSchema` debe coincidir exactamente con la clave en el registry de A4.**

## Dependencias

- **Depende de:** A1-PR-1, A1-PR-2
- **Requerido por:** A2-PR-3 (`PipelineExecutor`), A3-PR-3 (`GET /pipelines/{id}/compiled`)
- **Desbloquea:** Todo A2

## Tests

**`packages/core/src/__tests__/pipeline.test.ts`** (ampliar)
- [ ] Pipeline de 3 nodos en secuencia produce DAG correcto (`entryPoints: ["start"]`, `exitPoints: ["end"]`)
- [ ] Pipeline con 2 nodos paralelos: ambos en `entryPoints`, `VariableAggregator` en `exitPoints`
- [ ] Detección de ciclo: `A → B → A` lanza `CyclicDependencyError` con mensaje que incluye los IDs
- [ ] `resolveVariableRefs` convierte `"{{#llm_1.output.text#}}"` → `{ node_id: "llm_1", variable: "output", path: ["text"] }`
- [ ] `parsePipeline` rechaza YAML con `kind: Company` (wrong kind)
- [ ] Round-trip: `parsePipeline → serializePipeline → parsePipeline` produce output idéntico

## Definition of Done

- [ ] `pnpm --filter @agentflow/core build` sin errores
- [ ] `CyclicDependencyError` es un export público (A2 puede importarlo)
- [ ] `parseYAML` / `validateYAML` no se eliminan (backward compat A0)
- [ ] `CompiledGraph` es un tipo TypeScript exportado (para typing en frontend)
