# A2-PR-2: Base de ejecución — NodeExecutor, VariableResolver y budget

**Commit:** `feat(runtime/base): NodeExecutor base, VariableResolver, budget enforcement [A2-PR-2]`
**Rama:** `feat/A2-PR-2-node-executor-base`

---

## Qué resuelve

Los contratos que A4 implementa y A2-PR-3 usa para orquestar. Infraestructura pura — no ejecuta ningún pipeline, solo define las interfaces.

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `services/runtime/src/agentflow_runtime/nodes/base.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/__init__.py` |
| Crear | `services/runtime/src/agentflow_runtime/variables.py` |
| Crear | `services/runtime/src/agentflow_runtime/budget.py` |

## Símbolos nuevos

### `nodes/base.py`

```python
@dataclass
class NodeExecutionResult:
    output: dict
    tokens_used: int = 0
    cost_usd: float = 0.0
    error: str | None = None

    @property
    def success(self) -> bool:
        return self.error is None

class NodeExecutor(ABC):
    @abstractmethod
    async def execute(
        self,
        node_config: dict,
        state: PipelineState,
        company_context: CompanyContext,
    ) -> NodeExecutionResult: ...

class UnknownNodeTypeError(Exception): ...
```

### `nodes/__init__.py`

```python
# Registry vacío en este PR — se llena en A4-PR-3
NODE_EXECUTORS: dict[str, "NodeExecutor"] = {}

def get_node_executor(node_type: str) -> "NodeExecutor":
    if node_type not in NODE_EXECUTORS:
        raise UnknownNodeTypeError(f"No executor registered for node type: '{node_type}'")
    return NODE_EXECUTORS[node_type]

def register_executor(node_type: str, executor: "NodeExecutor") -> None:
    NODE_EXECUTORS[node_type] = executor
```

### `variables.py`

```python
class VariableResolutionError(Exception): ...

class VariableResolver:
    def __init__(self, state: PipelineState): ...

    def resolve(self, ref: dict | str | Any) -> Any:
        """
        Resuelve:
        - VariableReference dict: { node_id, variable, path? }
        - String con {{#...#}} syntax (interpola todas las refs)
        - Literal values: retorna as-is
        """
        ...

    def resolve_all(self, obj: Any) -> Any:
        """Recursively resuelve todas las variable references en cualquier objeto."""
        ...

    def _lookup(self, node_id: str, variable: str, path: list[str]) -> Any:
        """Busca valor en state.agent_outputs[node_id][variable] con path traversal."""
        ...
```

### `budget.py`

```python
MODEL_COSTS: dict[str, float] = {
    "claude-opus-4-6":    0.000015,
    "claude-sonnet-4-6":  0.000003,
    "claude-haiku-4-5":   0.00000025,
    "gpt-4o":             0.000005,
    "gpt-4o-mini":        0.00000015,
}

class BudgetExceededError(Exception): ...

def estimate_cost(tokens: int, model_id: str) -> float: ...

def check_agent_budget(
    agent: AgentIdentity,
    cost_so_far: float,
    new_cost: float,
) -> None:
    """Raises BudgetExceededError si cost_so_far + new_cost > agent.budget_monthly_usd"""
    ...

def check_pipeline_budget(state: PipelineState, new_cost: float) -> None:
    """Raises BudgetExceededError si el pipeline excede su budget total."""
    ...
```

## Dependencias

- **Depende de:** A2-PR-1 (`AgentIdentity`, `CompanyContext`, `PipelineState`)
- **Requerido por:** A2-PR-3 (`PipelineExecutor` llama `get_node_executor`), A4-PR-1/2/3 (implementan `NodeExecutor`)
- **Desbloquea:** A4-PR-1 y A4-PR-2 (pueden desarrollarse en paralelo con A3 una vez que este PR esté mergeado)

## Tests

**`services/runtime/tests/test_variables.py`**
- [ ] `VariableResolver.resolve({"node_id": "llm_1", "variable": "output", "path": ["text"]})` retorna valor correcto del state
- [ ] `resolve("{{#llm_1.output.text#}}")` interpola correctamente
- [ ] Path traversal: `output.nested.key` navega dicts anidados
- [ ] Path inválido: `VariableResolutionError` con mensaje descriptivo
- [ ] `resolve_all` resuelve recursivamente en dicts, listas y strings

**`services/runtime/tests/test_budget.py`**
- [ ] `estimate_cost(1000, "claude-sonnet-4-6")` = 0.003
- [ ] `check_agent_budget(agent_100usd, 99.0, 2.0)` lanza `BudgetExceededError`
- [ ] `check_agent_budget(agent_100usd, 50.0, 10.0)` no lanza
- [ ] Modelo desconocido en `estimate_cost`: fallback a costo por defecto o error descriptivo

## Definition of Done

- [ ] `uv run pytest services/runtime/tests/test_variables.py services/runtime/tests/test_budget.py -v` pasa
- [ ] `NodeExecutor` es ABC — no se puede instanciar directamente
- [ ] `NODE_EXECUTORS` empieza vacío (se llena en A4-PR-3)
- [ ] `BudgetExceededError`, `UnknownNodeTypeError`, `VariableResolutionError` son imports públicos
