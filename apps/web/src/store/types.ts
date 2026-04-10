// @plan B3-PR-1 (shared types — required by pipelineStore and companyStore)
import type { Node, Edge } from '@xyflow/react'
import type { NodePosition } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Canvas Node / Edge — XYFlow wrappers over pipeline data
// ---------------------------------------------------------------------------

// The data field holds the raw pipeline node spec (typed as a generic record
// so that draft nodes with incomplete fields can live in the canvas before
// validation forces them to be complete PipelineNode objects).
export type CanvasNodeData = Record<string, unknown> & { type: string }
export type CanvasNode = Node<CanvasNodeData> & { position: NodePosition }
export type CanvasEdge = Edge<Record<string, unknown>>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export interface NodeValidationError {
  nodeId: string
  field: string
  message: string
}

// ---------------------------------------------------------------------------
// Node Run State
// ---------------------------------------------------------------------------

export type NodeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped'

export interface NodeRunState {
  status: NodeRunStatus
  startedAt?: Date
  finishedAt?: Date
  tokensUsed?: number
  costUsd?: number
  output?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Agent Budget / Health (populated from API in CompanyStore)
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
// Undo / Redo History Entry
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  yamlSpec: string
  timestamp: number
}
