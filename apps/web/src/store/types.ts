// @plan B3-PR-1
import type { Node, Edge } from '@xyflow/react'
import type { PipelineNode, PipelineEdge } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Canvas Node / Edge (React Flow wrappers around core types)
// ---------------------------------------------------------------------------

export type CanvasNode = Node<PipelineNode>
export type CanvasEdge = Edge<PipelineEdge>

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type NodeValidationError = {
  nodeId: string
  field: string
  message: string
}

// ---------------------------------------------------------------------------
// Node Run State
// ---------------------------------------------------------------------------

export type NodeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped'

export type NodeRunState = {
  status: NodeRunStatus
  startedAt?: number
  finishedAt?: number
  tokensUsed?: number
  costUsd?: number
  agentName?: string
  agentRole?: string
  output?: unknown
  error?: string
}

// ---------------------------------------------------------------------------
// Agent Live State (populated from API / WebSocket)
// ---------------------------------------------------------------------------

export type AgentBudgetState = {
  agentName: string
  spentUsd: number
  budgetUsd: number
  remainingUsd: number
  pctUsed: number
  month: string
}

export type AgentHealthState = {
  agentName: string
  healthStatus: 'healthy' | 'degraded' | 'dead' | 'unknown'
  lastHeartbeatAt: Date | null
}

// ---------------------------------------------------------------------------
// Undo/Redo History Entry (pipeline store)
// ---------------------------------------------------------------------------

export type HistoryEntry = {
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  yamlSpec: string
  timestamp: number
}
