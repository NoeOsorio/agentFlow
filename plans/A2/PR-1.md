# A2-PR-1: Identidad de agente y contexto de compañía

**Commit:** `feat(runtime/identity): AgentIdentity, CompanyContext, PipelineState [A2-PR-1]`
**Rama:** `feat/A2-PR-1-agent-identity`

---

## Qué resuelve

El modelo de datos central del runtime. A4 necesita `AgentIdentity` y `CompanyContext` para inyectar personas en LLM. No cambia ningún comportamiento de ejecución — solo define tipos y parseo de YAML.

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `services/runtime/src/agentflow_runtime/identity.py` |
| Ampliar | `services/runtime/src/agentflow_runtime/state.py` |
| Ampliar | `services/runtime/src/agentflow_runtime/pod.py` |

## Símbolos nuevos

### `identity.py`

```python
@dataclass
class AgentLifecycleConfig:
    on_start: str | None = None          # webhook URL
    on_done: str | None = None
    on_fail: str | None = None
    heartbeat_interval_seconds: int = 30
    heartbeat_timeout_seconds: int = 120
    on_timeout: str = "fail"             # "continue" | "fail" | "retry"

@dataclass
class AgentIdentity:
    name: str
    role: str
    persona: str | None
    model_provider: str                  # "anthropic", "openai", "google"
    model_id: str
    temperature: float = 0.7
    max_tokens: int = 4096
    budget_monthly_usd: float = 100.0
    capabilities: list[str] = field(default_factory=list)
    reports_to: str | None = None
    lifecycle: AgentLifecycleConfig | None = None

    @classmethod
    def from_company_spec(cls, agent_spec: dict) -> "AgentIdentity": ...

@dataclass
class CompanyContext:
    name: str
    namespace: str
    agents: dict[str, AgentIdentity]     # keyed by agent name

    @classmethod
    def from_company_yaml(cls, company_dict: dict) -> "CompanyContext": ...

    def resolve_agent(self, agent_name: str) -> AgentIdentity:
        """Raises AgentNotFoundError if agent_name not in agents."""
        ...

class AgentNotFoundError(Exception): ...
```

### `state.py` (ampliar `PipelineState`)

```python
# Campos nuevos a agregar a PipelineState:
company_name: str = ""
company_context: CompanyContext | None = None
current_agent_name: str | None = None
node_executions: dict[str, NodeExecutionRecord] = Field(default_factory=dict)
global_variables: dict[str, Any] = Field(default_factory=dict)
current_branch: str | None = None
iteration_index: int = 0
iteration_results: list[Any] = Field(default_factory=list)
streaming_channel: str | None = None

@dataclass
class NodeExecutionRecord:
    node_id: str
    node_type: str
    agent_name: str | None
    status: str     # "pending" | "running" | "completed" | "failed" | "skipped"
    started_at: datetime | None = None
    finished_at: datetime | None = None
    tokens_used: int = 0
    cost_usd: float = 0.0
    input_snapshot: dict | None = None
    output_snapshot: dict | None = None
    error: str | None = None
```

### `pod.py` (ampliar `AgentContext`)

```python
# Campos nuevos en AgentContext:
agent_identity: AgentIdentity | None = None
node_id: str = ""
company_context: CompanyContext | None = None
# variable_resolver se agrega en A2-PR-2 (depende de VariableResolver)
```

## Dependencias

- **Depende de:** A1-PR-1 (formato YAML de Company para `from_company_yaml`) — A0 mergeado ✅
- **Requerido por:** A2-PR-2 (`NodeExecutor` firma usa `CompanyContext`), A4 (todos los nodos con agent context)

## Tests

**`services/runtime/tests/test_identity.py`**
- [ ] `CompanyContext.from_company_yaml(company_dict)` construye `AgentIdentity` correctamente para cada agente
- [ ] `resolve_agent("alice")` retorna la identidad correcta
- [ ] `resolve_agent("unknown")` lanza `AgentNotFoundError` con mensaje que incluye el nombre
- [ ] `AgentLifecycleConfig` defaults son correctos (interval=30, timeout=120, on_timeout="fail")
- [ ] `from_company_spec` con campos opcionales ausentes usa defaults correctos

**`services/runtime/tests/test_state.py`**
- [ ] `PipelineState` instancia con todos los nuevos campos
- [ ] `NodeExecutionRecord` contiene todos los campos requeridos

## Definition of Done

- [ ] `uv run pytest services/runtime/tests/test_identity.py -v` pasa
- [ ] No hay imports de `variables.py`, `budget.py`, ni `nodes/` (aún no existen)
- [ ] `AgentNotFoundError` es importable desde `agentflow_runtime`
- [ ] Los campos nuevos en `PipelineState` tienen defaults — no rompen el executor existente (A0)
