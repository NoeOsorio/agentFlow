// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { HumanInputNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = HumanInputNode & { runStatus?: NodeRunStatus }
type HumanInputNodeType = Node<Data, 'human_input'>

export function HumanInputCard({ data, selected }: NodeProps<HumanInputNodeType>) {
  const isWaiting = data.runStatus === 'running'

  return (
    <BaseNodeCard
      id={data.id}
      type="human_input"
      label={data.label ?? 'Human Input'}
      icon="👤"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="space-y-1 px-3 py-2 text-xs">
        {isWaiting ? (
          <p className="text-yellow-400">⏳ Waiting for approval</p>
        ) : (
          <p className="truncate text-gray-400">{data.prompt.slice(0, 60)}</p>
        )}
        {data.timeout_seconds != null && !isWaiting && (
          <span className="text-gray-500">⏱ {Math.round(data.timeout_seconds / 60)} min</span>
        )}
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
