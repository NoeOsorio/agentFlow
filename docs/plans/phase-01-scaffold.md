# Phase 1 — Monorepo Scaffold

**Status:** ✅ Complete
**Branch:** main

## Summary

Established the monorepo foundation. All packages, apps, and services have skeletons.

## What Was Built

- **Monorepo:** Turborepo + pnpm workspaces with shared `tsconfig.base.json`
- **`@agentflow/core`:** Zod schemas for the full Pipeline spec, YAML parser (parseYAML/serializeAST/validateYAML)
- **`apps/api`:** FastAPI + SQLAlchemy async — pipeline CRUD, run management, trigger endpoint, health check
- **`apps/web`:** Vite + React + Tailwind SPA — pipeline list page, React Flow canvas with initial nodes
- **`services/runtime`:** LangGraph DAG engine, AgentPod ABC with lifecycle hooks, Redis checkpoint store
- **`packages/ui`:** CanvasNode placeholder component
- **`packages/sdk`:** AgentPodConfig type + registerAgent() stub
- **Docker Compose:** local dev with postgres + redis + api + web
- **Kubernetes:** namespace, configmap, secrets, api/web/worker deployments, postgres/redis statefulsets

## Decisions Made

- FastAPI (Python) over NestJS — better for ML-heavy LangGraph integration
- Vite + React over Next.js — SPA is sufficient for a canvas tool, no SSR needed
- Celery + Redis over BullMQ — Python-native job queue aligns with the Python backend
- Turborepo — handles polyglot (TS + Python) via shell tasks

## Next Steps

See [Phase 2 plan](phase-02-core-ast.md).
