/**
 * @plan B3-PR-2
 * PipelineStore — Zustand store for pipeline canvas state.
 * Hooks useVariableScope and useNodeValidationErrors are part of B3-PR-3.
 */

import { useMemo } from 'react'
import { create } from 'zustand'
import type { CanvasNode, CanvasEdge, NodeValidationError } from './types'
import { computeVariableScope, type AvailableVariable } from './variableScope'

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface PipelineStoreState {
  pipelineId: string | null
  pipelineName: string
  namespace: string
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeId: string | null
  yamlSpec: string
  yamlValid: boolean
  yamlErrors: NodeValidationError[]
  yamlPanelOpen: boolean
  canUndo: boolean
  canRedo: boolean
  activeRunId: string | null
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePipelineStore = create<PipelineStoreState>(() => ({
  pipelineId: null,
  pipelineName: '',
  namespace: 'default',
  saveStatus: 'idle',
  nodes: [],
  edges: [],
  selectedNodeId: null,
  yamlSpec: '',
  yamlValid: true,
  yamlErrors: [],
  yamlPanelOpen: false,
  canUndo: false,
  canRedo: false,
  activeRunId: null,
}))

// ---------------------------------------------------------------------------
// Hooks (B3-PR-3)
// ---------------------------------------------------------------------------

/**
 * Returns the upstream variables available at the given node.
 * Memoized: only recomputes when nodes, edges, or nodeId change.
 */
export function useVariableScope(nodeId: string): AvailableVariable[] {
  const nodes = usePipelineStore((s) => s.nodes)
  const edges = usePipelineStore((s) => s.edges)
  return useMemo(() => computeVariableScope(nodes, edges, nodeId), [nodes, edges, nodeId])
}

/**
 * Returns only the validation errors for a specific node.
 * Memoized: filters the full error list by nodeId.
 */
export function useNodeValidationErrors(nodeId: string): NodeValidationError[] {
  const errors = usePipelineStore((s) => s.yamlErrors)
  return useMemo(() => errors.filter((e) => e.nodeId === nodeId), [errors, nodeId])
}
