/**
 * @module nodes/types
 * @plan B2-PR-1
 * @provides NodeRunStatus, NodeRunState, BaseNodeCardProps
 * @depends_on @agentflow/core PipelineNode
 */
import type { ReactNode } from 'react'
import type { PipelineNode } from '@agentflow/core'

export type NodeRunStatus = 'idle' | 'running' | 'completed' | 'failed' | 'skipped'

export type NodeType = PipelineNode['type']

export interface NodeRunState {
  status: NodeRunStatus
  error?: string
}

export interface BaseNodeCardProps {
  id: string
  type: NodeType
  label: string
  icon?: string
  accentColor: string
  runStatus?: NodeRunStatus
  runError?: string
  selected?: boolean
  children?: ReactNode
}
