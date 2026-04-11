// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { StartNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = StartNode & { runStatus?: NodeRunStatus }
type StartNodeType = Node<Data, 'start'>

export function StartNodeCard({ data, selected }: NodeProps<StartNodeType>) {
  return (
    <BaseNodeCard
      id={data.id}
      type="start"
      label={data.label ?? 'Start'}
      icon="▶"
      runStatus={data.runStatus}
      selected={selected}
    >
      {data.outputs.length > 0 && (
        <div className="flex flex-wrap gap-1 px-3 py-2">
          {data.outputs.map(v => (
            <span key={v.key} className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300">
              {v.key}
            </span>
          ))}
        </div>
      )}
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
