# Phase 2 — Core AST + YAML Compiler

**Status:** 🔲 Pending
**Depends on:** Phase 1

## Goal

Production-ready pipeline YAML schema with bidirectional sync to the canvas state.

## Key Tasks

1. Complete Zod schema edge cases (template strings like `"{{ client.domain }}"`, `extends` inheritance)
2. YAML diff/merge for `extends` keyword
3. Zustand store in `apps/web` — `usePipelineStore()` backed by `@agentflow/core` parser
4. Bidirectional sync: any store change → YAML string, any YAML paste → store update
5. Schema versioning (`apiVersion: florai/v1`)
6. Full unit test suite for `packages/core` (vitest)

## Success Criteria

- Parse the example YAML from the README without errors
- Canvas renders the parsed pipeline correctly
- Edit a node label → YAML updates in real time
- Paste YAML → canvas re-renders with correct topology
