# A4-PR-1: Nodos de datos y control de flujo (sin LLM)

**Commit:** `feat(nodes/control): template, variable, if-else, start/end nodes [A4-PR-1]`
**Rama:** `feat/A4-PR-1-control-nodes`

---

## Qué resuelve

Los nodos que no llaman a servicios externos — base limpia para testear lógica pura. Sin dependencias de red ni presupuesto de LLM.

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `services/runtime/src/agentflow_runtime/nodes/start_end_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/template_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/variable_assigner_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/variable_aggregator_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/if_else_node.py` |

## Implementaciones

### `start_end_node.py`

```python
class StartNodeExecutor(NodeExecutor):
    """Copia trigger_data a agent_outputs["start"] como punto de entrada."""
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        outputs = {}
        for var_def in node_config.get("outputs", []):
            outputs[var_def["key"]] = state.client_data.get(var_def["key"])
        return NodeExecutionResult(output=outputs)

class EndNodeExecutor(NodeExecutor):
    """Recoge inputs finales y marca el pipeline como listo para terminar."""
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)
        final = {ref["variable"]: resolver.resolve(ref) for ref in node_config.get("inputs", [])}
        return NodeExecutionResult(output={"final_outputs": final})
```

### `template_node.py`

```python
class TemplateNodeExecutor(NodeExecutor):
    """Renderiza template Jinja2 con variables del state."""
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)
        # Pre-process: convierte {{#node_id.var#}} → {{ var }} y construye context dict
        context = {ref["variable"]: resolver.resolve(ref) for ref in node_config["inputs"]}
        template_str = _preprocess_template(node_config["template"])
        try:
            rendered = jinja2.Environment(undefined=StrictUndefined) \
                .from_string(template_str).render(**context)
            return NodeExecutionResult(output={"text": rendered})
        except jinja2.UndefinedError as e:
            return NodeExecutionResult(output={}, error=f"Undefined variable: {e}")
```

### `variable_assigner_node.py`

```python
class VariableAssignerNodeExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)
        assigned = {}
        for assignment in node_config["assignments"]:
            value = resolver.resolve(assignment["value"])
            assigned[assignment["key"]] = value
            # También actualiza state.global_variables para acceso cross-node
            state.global_variables[assignment["key"]] = value
        return NodeExecutionResult(output=assigned)
```

### `variable_aggregator_node.py`

```python
class VariableAggregatorNodeExecutor(NodeExecutor):
    """Agrega outputs de múltiples ramas paralelas."""
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        strategy = node_config.get("strategy", "first")
        branch_outputs = [
            state.agent_outputs.get(branch_id, {})
            for branch_id in node_config["branches"]
        ]

        if strategy == "first":
            result = next((o for o in branch_outputs if o), {})
        elif strategy == "merge":
            result = {}
            for o in branch_outputs:
                result.update(o)
        elif strategy == "list":
            result = branch_outputs

        return NodeExecutionResult(output={node_config["output_key"]: result})
```

### `if_else_node.py`

```python
class IfElseNodeExecutor(NodeExecutor):
    """Evalúa grupos de condiciones y establece la rama activa."""
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        from ..routing import evaluate_condition_group
        for group in node_config["conditions"]:
            branch_id = evaluate_condition_group(group, state)
            if branch_id:
                state.current_branch = branch_id
                return NodeExecutionResult(output={"selected_branch": branch_id})
        # Default branch
        default = node_config["default_branch"]
        state.current_branch = default
        return NodeExecutionResult(output={"selected_branch": default})
```

**Los 12 operadores que debe soportar `routing.evaluate_condition`:**
`eq`, `ne`, `gt`, `gte`, `lt`, `lte`, `contains`, `not_contains`, `starts_with`, `ends_with`, `is_empty`, `is_not_empty`

## Dependencias

- **Depende de:** A2-PR-1 (`PipelineState`), A2-PR-2 (`NodeExecutor`, `VariableResolver`)
- **No depende de:** LLM, Redis, HTTP — cero dependencias externas
- **Requerido por:** A4-PR-3 (`nodes/__init__.py` importa estos ejecutores para el registro)

## Tests

**`services/runtime/tests/nodes/test_control_nodes.py`**
- [ ] `StartNodeExecutor` copia `trigger_data` a outputs correctamente
- [ ] `EndNodeExecutor` resuelve todos los `inputs` VariableReferences
- [ ] `TemplateNodeExecutor` renderiza Jinja2 con variables del state
- [ ] `TemplateNodeExecutor` con variable undefined → `NodeExecutionResult.error` (no exception)
- [ ] `VariableAssignerNodeExecutor` actualiza `state.global_variables`
- [ ] `VariableAggregatorNodeExecutor` estrategia `first` retorna el primer output no vacío
- [ ] `VariableAggregatorNodeExecutor` estrategia `merge` hace dict merge
- [ ] `VariableAggregatorNodeExecutor` estrategia `list` retorna array

**`services/runtime/tests/nodes/test_if_else_node.py`**
- [ ] Los 12 operadores evaluados correctamente (un test por operador)
- [ ] Lógica AND: todas las condiciones deben cumplirse
- [ ] Lógica OR: basta que una condición se cumpla
- [ ] Default branch tomada cuando ninguna condición coincide
- [ ] Primer grupo que matchea gana (no evalúa los demás)

## Definition of Done

- [ ] `uv run pytest services/runtime/tests/nodes/ -v` pasa
- [ ] Ningún test usa mocks de código propio del repo — solo mocks de deps externas
- [ ] Jinja2 está en `pyproject.toml` de `services/runtime`
- [ ] Los 5 archivos no importan de `llm_node.py`, `http_node.py` ni `agent_pod_node.py`
