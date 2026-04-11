// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { VariableAssignerNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = VariableAssignerNode & { runStatus?: NodeRunStatus }
type VariableAssignerNodeType = Node<Data, 'variable_assigner'>

export function VariableAssignerCard({ data, selected }: NodeProps<VariableAssignerNodeType>) {
  return (
    <BaseNodeCard
      id={data.id}
      type="variable_assigner"
      label={data.label ?? 'Variable Assigner'}
      icon="="
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="flex flex-wrap gap-1 px-3 py-2">
        {data.assignments.map(a => (
          <span key={a.key} className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300">
            {a.key}
          </span>
        ))}
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
