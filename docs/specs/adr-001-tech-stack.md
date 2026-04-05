# ADR-001 — Technology Stack Decisions

**Date:** 2026-04-02
**Status:** Accepted

## Context

AgentFlow needs to orchestrate Python-native ML libraries (LangGraph, LangChain) while providing a modern web canvas (React Flow). The stack must support a monorepo, Docker builds, and Kubernetes deployment.

## Decisions

### Backend: FastAPI (Python) over NestJS
**Decision:** FastAPI
**Rationale:** LangGraph and LangChain are Python libraries. A Python API eliminates inter-process serialization and makes agent integration trivial. FastAPI's async support matches LangGraph's async execution model.
**Trade-off:** Two languages in the monorepo (TS + Python). Mitigated by Turborepo's polyglot task runner.

### Frontend: Vite + React over Next.js
**Decision:** Vite + React SPA
**Rationale:** AgentFlow is a canvas tool — a single-page application is sufficient. SSR adds complexity with no benefit for an authenticated tool. Vite's dev server is faster than Next.js for iterative canvas development.
**Trade-off:** No built-in routing or server-side data fetching. React Router fills the routing gap.

### Job Queue: Celery + Redis over BullMQ
**Decision:** Celery
**Rationale:** BullMQ is Node.js-only. Since the runtime is Python, Celery is the natural fit — same process, same dependencies, simpler deployment.
**Trade-off:** Celery's configuration is more verbose than BullMQ. Flower provides a monitoring UI.

### Monorepo: Turborepo
**Decision:** Turborepo + pnpm workspaces
**Rationale:** Turborepo supports arbitrary shell tasks (not just JS), enabling Python build steps in the same pipeline. pnpm workspaces handle TypeScript package linking. Fast caching reduces CI times.

### Orchestration: LangGraph
**Decision:** LangGraph
**Rationale:** Native DAG support with StateGraph — maps directly to AgentFlow's `dependsOn` model. Built-in checkpointing, streaming, and multi-model support. Active development by LangChain Inc.

### Database: PostgreSQL (async) + Redis
**Decision:** Dual-store
**Rationale:** PostgreSQL stores durable state (pipelines, runs, audit log). Redis serves as job queue broker (Celery) and ephemeral checkpoint store (LangGraph/AgentPod crash recovery). Clear separation of concerns.
