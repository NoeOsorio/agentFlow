/**
 * @plan B3-PR-1
 * Shared TypeScript types for all stores. This module has no store imports.
 */

import type { Node, Edge } from '@xyflow/react'
import type { PipelineNode, PipelineEdge } from '@agentflow/core'
import type { NodePosition } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Canvas types (React Flow wrappers)
// ---------------------------------------------------------------------------

/** A React Flow node carrying a PipelineNode as its data payload. */
export type CanvasNode = Node<PipelineNode> & { position: NodePosition }

/** A React Flow edge carrying a PipelineEdge as its data payload. */
export type CanvasEdge = Edge<PipelineEdge>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface NodeValidationError {
  nodeId: string
  field: string
  message: string
}

// ---------------------------------------------------------------------------
// Run state
// ---------------------------------------------------------------------------

export type NodeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped'

export interface NodeRunState {
  status: NodeRunStatus
  startedAt?: number
  finishedAt?: number
  tokensUsed?: number
  costUsd?: number
  output?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Live agent state
// ---------------------------------------------------------------------------

export interface AgentBudgetState {
  agentName: string
  spentUsd: number
  budgetUsd: number
  remainingUsd: number
  pctUsed: number
  month: string
}

export interface AgentHealthState {
  agentName: string
  healthStatus: 'healthy' | 'degraded' | 'dead' | 'unknown'
  lastHeartbeatAt: Date | null
}

// ---------------------------------------------------------------------------
// Undo/redo history
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  yamlSpec: string
  timestamp: number
}
