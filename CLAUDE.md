# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is AgentFlow

AgentFlow is a platform for building AI agent pipelines defined declaratively in YAML. A pipeline triggers on an event (e.g. a Stripe payment), orchestrates a DAG of `AgentPod` workers via LangGraph, and produces an output (deployed website, report, etc.). The YAML spec is always the source of truth — both the GUI canvas and the API reflect it.

## Monorepo Structure

This is a **pnpm + Turborepo** monorepo with mixed TypeScript and Python packages:

```
apps/web/          Vite + React + Tailwind frontend (canvas GUI)
apps/api/          FastAPI backend (pipeline CRUD, run management)
services/runtime/  LangGraph DAG engine and AgentPod base (Python)
packages/core/     YAML schema + parser, shared TS types (tsup)
packages/ui/       Shared React component library (stub)
packages/sdk/      TypeScript SDK for pipeline authoring (stub)
```

The **frontend** (`@agentflow/web`) imports `@agentflow/core` for YAML parsing/validation and `@agentflow/ui` for components. The **API** (`agentflow-api`) persists pipelines and runs in Postgres. The **runtime** (`agentflow-runtime`) is a separate Python service that reads a compiled pipeline and executes it via LangGraph with Redis checkpointing.

## Key Architecture Concepts

- **YAML spec → Zod schema**: `packages/core/src/schema/pipeline.ts` defines the full `PipelineSchema` with Zod. The parser in `packages/core/src/parser/index.ts` converts YAML text to a validated `Pipeline` object.
- **AgentPod**: Abstract base in `services/runtime/src/agentflow_runtime/pod.py`. Subclass it and implement `run(context) -> AgentResult`. Lifecycle hooks: `on_start`, `on_done`, `on_fail`.
- **DAG engine**: `services/runtime/src/agentflow_runtime/dag.py` builds a `LangGraph StateGraph` from `AgentPod` instances and their `dependsOn` relationships. Agents with no dependencies start in parallel from `START`.
- **State**: `PipelineState` in `state.py` tracks `agent_outputs`, `completed`, `failed`, `cost_usd`, and `run_id` across graph nodes.
- **Checkpoint**: Redis-backed checkpoint in `checkpoint.py` (TODO: wire into LangGraph's checkpointer interface).
- **API models**: `Pipeline` stores `yaml_spec` as text. `Run` tracks execution status. `AgentExecution` records per-agent tokens, output, and timing.

## Development Commands

### Infrastructure (required for API)
```bash
docker compose up postgres redis -d
```

### Frontend
```bash
pnpm dev          # all apps in watch mode
pnpm --filter @agentflow/web dev
pnpm build        # full monorepo build
pnpm lint         # tsc --noEmit across all packages
```

### API (Python — run from `apps/api/`)
```bash
uv run uvicorn agentflow_api.main:app --reload --port 8000
```

### Runtime (Python — run from `services/runtime/`)
```bash
uv run python -m agentflow_runtime
```

### Full stack via Docker
```bash
docker compose up
# API: http://localhost:8000
# Web: http://localhost:3000
```

### API docs
```
http://localhost:8000/docs
```

## Tech Stack Details

| Layer | Tech |
|---|---|
| Frontend | Vite, React 19, Tailwind v3, Zustand, React Router v7, `@xyflow/react` (canvas) |
| API | FastAPI, SQLAlchemy async, asyncpg, Alembic, Celery+Redis |
| Runtime | LangGraph, LangChain (Anthropic/OpenAI), Redis |
| Core/SDK | TypeScript, Zod, tsup, js-yaml |
| DB | PostgreSQL 16 |
| Queue/State | Redis 7 + BullMQ |

## Python Environment

Both Python apps (`apps/api`, `services/runtime`) use `pyproject.toml` with `hatchling`. Python ≥ 3.12 is required. Use `uv` for environment management.

## Notes

- In dev, the API auto-creates DB tables on startup (`Base.metadata.create_all`). Use Alembic for production migrations.
- The `apps/web/` frontend prefers **Vite + React + Tailwind** — do not introduce Next.js.
- The YAML spec supports `extends` for pipeline inheritance (planned; not yet implemented in parser).
- Cost estimation in `dag.py` is a rough placeholder (`tokens * 0.000003`).

## Git & PRs

- When creating a PR, always output the PR URL prominently in your response — never bury it in a summary.
- When reporting PR status, list each PR with its number and full URL.
- When asked to use a separate worktree, always use `git worktree add <path> <branch>` BEFORE making any changes. Never work directly in the main worktree when a worktree is requested.
- Always push to the remote and create the PR before declaring implementation complete.

## Planning & Scope

- When asked to implement a specific scope (e.g., B0, A1, PR-3), stay **strictly within that scope**. Do not touch adjacent work items.
- If you notice related work needed outside the requested scope, mention it but do not implement it without explicit approval.
- Confirm scope boundaries before starting any multi-PR plan.

## Build & Validation

- For TypeScript work: always run `pnpm lint` (which runs `tsc --noEmit` across all packages) before declaring work complete.
- Run the full test suite before declaring work complete. Fix all failures — do not ask the user for help with test failures, debug them yourself.
- Watch for: `noUncheckedIndexedAccess` errors, duplicate exports, incorrect generic parameters.

## Testing

- After any rebase onto main, re-run all tests and verify that example YAML files and test fixtures still match the current Zod schema requirements. Schemas may have tightened on main.
- Before implementing a feature, write a smoke test to verify the test infrastructure works (correct runner config, available libraries, mock paths). Fix any config issues before writing feature code.

## Communication Style

- When the user asks about running a specific command (e.g., a migration, a single test), answer that specific question directly. Do not explain how to run the entire project.
- Keep responses terse. Do not summarize what you just did at the end — the diff speaks for itself.
