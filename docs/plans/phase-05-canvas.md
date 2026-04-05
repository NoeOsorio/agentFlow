# Phase 5 — Canvas UI

**Status:** 🔲 Pending
**Depends on:** Phase 4

## Goal

Fully functional drag-and-drop pipeline builder with real-time YAML sync.

## Key Tasks

1. Custom AgentPod node (`packages/ui/src/CanvasNode.tsx`) with status indicator
2. Sidebar node palette — drag agents onto canvas
3. Zustand pipeline store wired to `@agentflow/core` parser
4. Split view: canvas (left) + CodeMirror YAML editor (right)
5. Dependency edges — draw connections to define `dependsOn`
6. Live run overlay — WebSocket updates agent node status during execution
7. Pipeline CRUD UI — list, create, rename, delete, duplicate

## Success Criteria

- Build the wellness-website pipeline using only the canvas (no YAML editing)
- YAML and canvas stay in sync at all times
- Run status updates appear on nodes within 1 second of backend events
