// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { IfElseNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = IfElseNode & { runStatus?: NodeRunStatus }
type IfElseNodeType = Node<Data, 'if_else'>

export function IfElseNodeCard({ data, selected }: NodeProps<IfElseNodeType>) {
  const branchCount = data.conditions.length
  const branches = [
    ...data.conditions.map((_, i) => `branch_${i + 1}`),
    data.default_branch,
  ]

  return (
    <BaseNodeCard
      id={data.id}
      type="if_else"
      label={data.label ?? 'If / Else'}
      icon="⑂"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="px-3 py-2 text-xs text-gray-400">
        {branchCount} condition{branchCount !== 1 ? 's' : ''}
      </div>
      <NodeHandle type="target" />
      {branches.map((branch) => (
        <NodeHandle key={branch} type="source" id={branch} label={branch} />
      ))}
    </BaseNodeCard>
  )
}
