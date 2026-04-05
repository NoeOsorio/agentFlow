# Phase 3 — Runtime Engine

**Status:** 🔲 Pending
**Depends on:** Phase 2

## Goal

Production-ready pipeline executor with Celery workers, token budgeting, and crash recovery.

## Key Tasks

1. `services/worker` — Celery app + `execute_pipeline(run_id)` task
2. Wire `RedisCheckpointStore` into `PipelineExecutor` (save state after each node)
3. Token budget enforcement — sum `result.tokens_used` against `policy.budget`
4. Retry logic — catch `AgentResult.success=False`, retry up to `policy.retries`
5. `services/agents` — implement `ResearchAgent`, `CopywriterAgent`, `QAAgent`
6. Cost tracking — write `AgentExecution.tokens_used` to PostgreSQL after each run
7. Dead letter queue — send failed runs to Redis list `agentflow:dlq`

## Success Criteria

- Pipeline with 3 agents completes end-to-end
- Crash mid-run → resume from last checkpoint
- Run exceeding budget → killed with `RunStatus.failed` and error message
