# A2-PR-4 Testing Guide — Streaming & Celery Worker

## What this branch adds

| File | Description |
|------|-------------|
| `streaming.py` | `StreamEvent` dataclass, `StreamingExecutor`, `format_sse()` |
| `tasks/__init__.py` | Package init re-exporting Celery tasks |
| `tasks/pipeline_tasks.py` | `execute_pipeline` and `execute_pipeline_streaming` Celery tasks |
| `dead_letter.py` | `mark_as_dead_letter` / `retry_dead_letter` for failed runs |
| `pyproject.toml` | Added `celery>=5.4.0` and `pyyaml>=6.0.0` dependencies |

---

## Prerequisites

```bash
# From repo root
docker compose up redis -d   # Redis required for streaming pub/sub
cd services/runtime
uv sync
```

---

## Run all A2 tests

```bash
cd services/runtime
uv run pytest tests/ -v
```

Expected: **67 passed** (0 failures).

To run only PR-4 tests:

```bash
uv run pytest tests/test_streaming.py tests/test_tasks.py -v
```

Expected: **14 passed**.

---

## What each test covers

### `test_streaming.py`

| Test | What it verifies |
|------|-----------------|
| `test_starts_with_data_prefix` | `format_sse()` returns `"data: ..."` |
| `test_ends_with_double_newline` | SSE wire format ends with `\n\n` |
| `test_contains_valid_json` | JSON is valid and all fields present |
| `test_all_fields_present` | `event`, `run_id`, `agent_name`, `agent_role`, `company_name`, `data`, `timestamp` |
| `test_events_emitted_in_order` | `node_start` → `node_complete` → `pipeline_complete` |
| `test_node_start_before_node_complete` | Start precedes complete for same node |
| `test_all_events_include_agent_name_and_role` | Agent identity attached to all node events |
| `test_pipeline_error_emitted_on_failure` | `pipeline_error` yielded when graph raises |
| `test_pipeline_complete_is_final_event` | `pipeline_complete` is always the last event |

### `test_tasks.py`

| Test | What it verifies |
|------|-----------------|
| `test_parses_both_yamls_and_calls_executor` | Both YAML strings are parsed; `PipelineExecutor` receives correct types |
| `test_company_yaml_parsed_into_company_context` | Second arg is a `CompanyContext` with agent data from `company_yaml` |
| `test_result_contains_all_required_fields` | Return dict has: `run_id`, `pipeline_name`, `completed`, `failed`, `cost_usd`, `error` |
| `test_retry_with_exponential_backoff_on_failure` | `countdown = 2 ** retries` (retries=2 → countdown=4) |
| `test_accepts_exactly_four_parameters` | Signature: `run_id, pipeline_yaml, company_yaml, trigger_data` |

---

## Manual smoke test — StreamEvent format

```python
from agentflow_runtime.streaming import StreamEvent, format_sse

evt = StreamEvent(
    event="node_start",
    run_id="run-001",
    agent_name="alice",
    agent_role="Lead Engineer",
    company_name="acme-corp",
    data={"node_id": "implement"},
    timestamp="2024-01-01T00:00:00+00:00",
)
print(format_sse(evt))
# Output: data: {"event": "node_start", "run_id": "run-001", ...}\n\n
```

## Manual smoke test — Celery task import

```python
# Verify the task is importable and has the right signature
from agentflow_runtime.tasks.pipeline_tasks import execute_pipeline, execute_pipeline_streaming

print(execute_pipeline.name)
# agentflow_runtime.tasks.pipeline_tasks.execute_pipeline

print(execute_pipeline.max_retries)
# 3
```

## Manual smoke test — Dead letter queue

```python
import asyncio
import fakeredis.aioredis as fakeredis

async def demo():
    r = fakeredis.FakeRedis()
    
    from agentflow_runtime.dead_letter import mark_as_dead_letter, retry_dead_letter
    
    await mark_as_dead_letter("run-001", "executor crashed", r)
    
    items = await r.zrange("agentflow:dead_letter", 0, -1)
    print(f"Dead letter queue has {len(items)} entry")  # 1 entry

asyncio.run(demo())
```

---

## What A3 will consume from this PR

```python
# In apps/api routers/runs.py
from agentflow_runtime.tasks.pipeline_tasks import execute_pipeline

execute_pipeline.delay(
    run_id=str(run.id),
    pipeline_yaml=pipeline.yaml_spec,
    company_yaml=company.yaml_spec,
    trigger_data=inputs,
)

# For SSE streaming endpoint
from agentflow_runtime.streaming import StreamEvent, format_sse
```
