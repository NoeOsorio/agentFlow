## 4. Orden de Merge Validado

```
A1-PR-1 (pipeline envelope + variable types)
  └─→ A1-PR-2 (14 node schemas)
        └─→ A1-PR-3 (parser + compileEdges)   ← desbloquea todo A2
              └─→ A1-PR-4 (exports + examples) ← independiente, último

A2-PR-1 (AgentIdentity, CompanyContext, PipelineState)
  └─→ A2-PR-2 (NodeExecutor ABC, VariableResolver, budget) ← desbloquea A4-PR-1/2
        └─→ A2-PR-3 (PipelineExecutor, DAG, lifecycle, checkpoint)
              └─→ A2-PR-4 (streaming, Celery tasks) ← desbloquea A3-PR-4

A3-PR-1 (7 modelos SQLAlchemy + Alembic)
  └─→ A3-PR-2 (auth + Company/Agent CRUD)
        └─→ A3-PR-3 (Pipeline CRUD + /api/apply)
              └─→ A3-PR-4 (execute, webhooks, WS, internal) ← necesita A2-PR-4

A4-PR-1 (nodos control: template, variable, if_else, start/end)  ← paralelo con A3-PR-*
  └─→ A4-PR-2 (nodos I/O: http, code, knowledge, sub_workflow)   ← paralelo con A3-PR-*
        └─→ A4-PR-3 (nodos LLM: llm, agent_pod, iteration, human_input + registro)
```

**Paralelismo posible**: A3-PR-1 y A4-PR-1 pueden iniciarse en paralelo una vez mergeado A2-PR-2.

---

## 5. Advertencias y Ajustes al Plan Original

1. **`schema/pipeline.ts` debe reemplazarse, no solo extenderse** — el `PipelineSchema` actual (A0) tiene `agents[]` en lugar de `nodes[]`. La migración es breaking change para el parser legacy. Mantener `parseYAML` / `serializeAST` como deprecated wrappers en A1-PR-3 para no romper tests de A0.

2. **`checkpoint.py` tiene un TODO explícito** — el `RedisCheckpointStore` actual no está wired al executor. A2-PR-3 debe reemplazarlo por `AgentFlowCheckpointer` con la interfaz de LangGraph.

3. **`dag.py` actual es demasiado simple para A2** — `build_graph()` actual solo hace edges lineales sin condicionales. A2-PR-3 lo reemplaza completamente; el `dag.py` actual es solo el prototipo de A0.

4. **API: `create_all()` en `main.py`** — debe eliminarse en A3-PR-1 al introducir Alembic. Agregar guarda `if settings.env == "development"` o moverlo a `entrypoint.sh`.

5. **`apps/api/src/` no tiene tests aún** — A3-PR-1 debe ser el primer PR que establezca la configuración de pytest + fixtures de DB.

6. **`services/runtime` no tiene `tasks/` ni `nodes/`** — crear esos subdirectorios con sus `__init__.py` en A2-PR-4 y A4-PR-1 respectivamente.