# Phase 4 — API Layer

**Status:** 🔲 Pending
**Depends on:** Phase 3

## Goal

Complete REST API with authentication, real-time updates, and webhook triggers.

## Key Tasks

1. Alembic migrations for all models
2. API key authentication middleware
3. WebSocket endpoint (`/ws/runs/{run_id}`) for live status updates
4. Webhook trigger router — verify Stripe signatures, parse form payloads
5. Pipeline YAML validation on `POST /api/pipelines` (reject invalid YAML)
6. `GET /api/pipelines/{id}/runs` with pagination
7. `POST /api/runs/{id}/cancel` — cancel a running job
8. OpenAPI docs polish (`/api/docs`)

## Success Criteria

- Canvas can create + trigger + cancel a pipeline run via REST
- Stripe webhook creates a run automatically
- Run status streams via WebSocket in real time
