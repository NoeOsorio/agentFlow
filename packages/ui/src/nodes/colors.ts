/**
 * @module nodes/colors
 * @plan B2-PR-1
 * @provides NODE_COLORS
 * @depends_on nodes/types NodeType
 */
import type { NodeType } from './types'

export const NODE_COLORS: Record<NodeType, string> = {
  start: '#a855f7',           // purple
  end: '#a855f7',             // purple
  llm: '#3b82f6',             // blue
  agent_pod: '#6366f1',       // indigo
  code: '#f97316',            // orange
  http: '#22c55e',            // green
  if_else: '#eab308',         // yellow
  template: '#14b8a6',        // teal
  variable_assigner: '#6b7280', // gray
  variable_aggregator: '#6b7280', // gray
  iteration: '#ec4899',       // pink
  human_input: '#ef4444',     // red
  knowledge_retrieval: '#10b981', // emerald
  sub_workflow: '#8b5cf6',    // violet
}
