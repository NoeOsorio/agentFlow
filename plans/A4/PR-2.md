# A4-PR-2: Nodos con I/O externo (HTTP, Code, Knowledge, SubWorkflow)

**Commit:** `feat(nodes/io): HTTP, code execution, knowledge retrieval, sub-workflow [A4-PR-2]`
**Rama:** `feat/A4-PR-2-io-nodes`

---

## Qué resuelve

Nodos que llaman servicios externos con manejo de errores y timeouts. No toca LLM ni presupuesto de agente.

## Archivos

| Acción | Archivo |
|--------|---------|
| Crear | `services/runtime/src/agentflow_runtime/nodes/http_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/code_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/knowledge_retrieval_node.py` |
| Crear | `services/runtime/src/agentflow_runtime/nodes/sub_workflow_node.py` |

## Implementaciones

### `http_node.py`

```python
class HTTPNodeExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)
        url = resolver.resolve(node_config["url"])
        headers = {k: resolver.resolve(v) for k, v in node_config.get("headers", {}).items()}
        body = resolver.resolve_all(node_config.get("body"))
        timeout = node_config.get("timeout_ms", 30_000) / 1000

        try:
            async with httpx.AsyncClient() as client:
                response = await client.request(
                    method=node_config["method"],
                    url=url, headers=headers,
                    json=body if isinstance(body, dict) else None,
                    content=body if isinstance(body, str) else None,
                    timeout=timeout,
                )
            # 4xx/5xx → error result, NO raise
            if response.is_error:
                return NodeExecutionResult(
                    output={},
                    error=f"HTTP {response.status_code}: {response.text[:500]}",
                )
            return NodeExecutionResult(output={
                "status_code": response.status_code,
                "body": response.json() if "application/json" in response.headers.get("content-type", "") else response.text,
                "headers": dict(response.headers),
            })
        except httpx.TimeoutException:
            return NodeExecutionResult(output={}, error=f"HTTP timeout after {timeout}s")
        except Exception as e:
            return NodeExecutionResult(output={}, error=str(e))
```

### `code_node.py`

```python
BLOCKED_IMPORTS = ["import os", "import subprocess", "import sys", "import shutil", "__import__"]

class CodeNodeExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        code = node_config["code"]

        # Security: bloquea imports peligrosos
        for blocked in BLOCKED_IMPORTS:
            if blocked in code:
                return NodeExecutionResult(output={}, error=f"Blocked: '{blocked}' is not allowed")

        resolver = VariableResolver(state)
        inputs = {k: resolver.resolve(v) for k, v in node_config.get("inputs", {}).items()}

        # Script wrapper: inyecta inputs como variable y captura output como JSON
        script = f"inputs = {json.dumps(inputs)}\n{code}\nprint(json.dumps(output))"
        timeout = node_config.get("timeout_seconds", 30)

        try:
            proc = await asyncio.create_subprocess_exec(
                "python3", "-c", script,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)

            if proc.returncode != 0:
                return NodeExecutionResult(output={}, error=stderr.decode()[:1000])

            last_line = stdout.decode().strip().split("\n")[-1]
            return NodeExecutionResult(output=json.loads(last_line))

        except asyncio.TimeoutError:
            proc.kill()
            return NodeExecutionResult(output={}, error=f"Code execution timeout after {timeout}s")
        except json.JSONDecodeError:
            return NodeExecutionResult(output={}, error="Code did not produce valid JSON output")
```

### `knowledge_retrieval_node.py`

```python
class KnowledgeRetrievalNodeExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)
        query = resolver.resolve(node_config["query"])
        kb_id = node_config["knowledge_base_id"]
        top_k = node_config.get("top_k", 5)

        kb_url = settings.knowledge_base_url
        if not kb_url:
            return NodeExecutionResult(output={"chunks": [], "sources": []}, error=None)

        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    f"{kb_url}/api/retrieve",
                    json={"query": query, "knowledge_base_id": kb_id, "top_k": top_k},
                    timeout=10.0,
                )
            data = resp.json()
            return NodeExecutionResult(output={"chunks": data.get("chunks", []), "sources": data.get("sources", [])})
        except Exception as e:
            return NodeExecutionResult(output={"chunks": [], "sources": []}, error=str(e))
```

### `sub_workflow_node.py`

```python
class SubWorkflowNodeExecutor(NodeExecutor):
    async def execute(self, node_config, state, company_context) -> NodeExecutionResult:
        resolver = VariableResolver(state)

        # Resuelve inputs para el sub-workflow
        trigger_data = resolver.resolve_all(node_config.get("inputs", {}))

        # Fetch sub-pipeline YAML desde API
        pipeline_ref = node_config["pipeline_ref"]
        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"{settings.api_url}/api/pipelines",
                params={"name": pipeline_ref["name"], "namespace": pipeline_ref.get("namespace", "default")},
            )
        pipeline_data = resp.json()
        pipeline_yaml = pipeline_data["yaml_spec"]
        company_yaml = pipeline_data.get("company_yaml", "")  # pre-fetched by API

        # Ejecuta sub-pipeline con PipelineExecutor anidado
        from ..executor import PipelineExecutor
        import yaml
        sub_executor = PipelineExecutor(
            pipeline=yaml.safe_load(pipeline_yaml),
            company_context=CompanyContext.from_company_yaml(yaml.safe_load(company_yaml)) if company_yaml else company_context,
            redis_url=settings.redis_url,
        )
        sub_state = await sub_executor.run(trigger_data=trigger_data)

        return NodeExecutionResult(output=sub_state.agent_outputs)
```

## Dependencias

- **Depende de:** A2-PR-1, A2-PR-2 (`NodeExecutor`, `VariableResolver`)
- **Puede desarrollarse en paralelo con A3-PR-*** (solo necesita A2-PR-2)
- **Requerido por:** A4-PR-3 (registro completo en `nodes/__init__.py`)

## Tests

**`services/runtime/tests/nodes/test_http_node.py`**
- [ ] GET exitoso con `respx` mock → `status_code`, `body`, `headers` en output
- [ ] POST con body JSON → body enviado correctamente
- [ ] HTTP 500 → `NodeExecutionResult.error` con mensaje, sin exception
- [ ] HTTP timeout → `NodeExecutionResult.error` con mensaje de timeout
- [ ] Variable references en URL y headers resueltas antes del request

**`services/runtime/tests/nodes/test_code_node.py`**
- [ ] `output = {"result": inputs["x"] + inputs["y"]}` con `inputs = {"x": 3, "y": 4}` → `{"result": 7}`
- [ ] `import os` en código → error result con mensaje "Blocked"
- [ ] Script con loop infinito → error de timeout (no cuelga el test — usar timeout corto: 2s)
- [ ] Código que falla (exception) → error result con stderr

**`services/runtime/tests/nodes/test_sub_workflow.py`**
- [ ] `SubWorkflowNodeExecutor` crea `PipelineExecutor` anidado con datos del sub-pipeline
- [ ] Inputs resueltos con `VariableResolver` antes de pasar al sub-workflow

## Definition of Done

- [ ] `uv run pytest services/runtime/tests/nodes/ -v` pasa
- [ ] `httpx` y `jinja2` en `pyproject.toml` de `services/runtime`
- [ ] Ningún nodo de este PR hace `raise` — todos retornan `NodeExecutionResult(error=...)`
- [ ] `code_node.py` bloquea los 5 imports peligrosos listados en `BLOCKED_IMPORTS`
