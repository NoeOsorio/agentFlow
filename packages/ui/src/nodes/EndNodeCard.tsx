// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { EndNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = EndNode & { runStatus?: NodeRunStatus }
type EndNodeType = Node<Data, 'end'>

export function EndNodeCard({ data, selected }: NodeProps<EndNodeType>) {
  return (
    <BaseNodeCard
      id={data.id}
      type="end"
      label={data.label ?? 'End'}
      icon="⏹"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="px-3 py-2 text-xs text-gray-400">Pipeline Output</div>
      <NodeHandle type="target" />
    </BaseNodeCard>
  )
}
