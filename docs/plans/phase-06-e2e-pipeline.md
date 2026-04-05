# Phase 6 — First E2E Pipeline

**Status:** 🔲 Pending
**Depends on:** Phase 5

## Goal

Validate the full platform with the wellness-website pipeline from the README.

## Key Tasks

1. `pipelines/wellness-website.yaml` — define the full pipeline spec
2. Stripe webhook → trigger → Run creation → Celery dispatch
3. `ResearchAgent` — call Perplexity/Tavily API for wellness content
4. `CopywriterAgent` — Anthropic Claude to write website copy
5. `FrontendAgent` — Claude to generate React/HTML from copy + brand identity
6. `QAAgent` — score output, retry frontend if score < 0.80
7. Vercel deploy via API
8. Resend email with delivery credentials + URL
9. End-to-end test (pytest + playwright)

## Success Criteria

- Stripe payment → deployed website in < 5 minutes
- All 4 agents run sequentially per DAG
- Failed QA score triggers frontend agent retry
- Client receives email with live URL
