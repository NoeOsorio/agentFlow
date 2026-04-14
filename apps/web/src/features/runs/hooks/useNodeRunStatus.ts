// @plan B4-PR-2
import { usePipelineStore } from '../../../store/pipelineStore'
import type { NodeRunState } from '../../../store/types'

/**
 * Returns the current run state for a given node from PipelineStore,
 * or null if no run state exists for that node.
 */
export function useNodeRunStatus(nodeId: string): NodeRunState | null {
  return usePipelineStore((s) => s.nodeRunStates[nodeId] ?? null)
}
