// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { IterationNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = IterationNode & { runStatus?: NodeRunStatus; progress?: { current: number; total: number } }
type IterationNodeType = Node<Data, 'iteration'>

export function IterationNodeCard({ data, selected }: NodeProps<IterationNodeType>) {
  const listRef = `${data.input_list.node_id}.${data.input_list.variable}`

  return (
    <BaseNodeCard
      id={data.id}
      type="iteration"
      label={data.label ?? 'Iteration'}
      icon="↻"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="px-3 py-2 text-xs text-gray-300">
        <span className="text-gray-400">for </span>
        <span className="font-mono text-pink-400">{data.iterator_var}</span>
        <span className="text-gray-400"> in </span>
        <span className="font-mono text-gray-300">{listRef}</span>
      </div>
      {data.runStatus === 'running' && data.progress && (
        <div className="border-t border-gray-700 px-3 py-1 text-xs text-yellow-400">
          ({data.progress.current}/{data.progress.total})
        </div>
      )}
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
