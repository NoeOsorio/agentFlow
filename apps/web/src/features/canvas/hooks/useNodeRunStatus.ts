// @plan B4
import { usePipelineStore } from '../../../store/pipelineStore'
import type { NodeRunState } from '../../../store/types'

export function useNodeRunStatus(nodeId: string): NodeRunState {
  return usePipelineStore(
    (s) => s.nodeRunStates[nodeId] ?? { status: 'idle' },
  )
}
