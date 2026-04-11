// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { SubWorkflowNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = SubWorkflowNode & { runStatus?: NodeRunStatus }
type SubWorkflowNodeType = Node<Data, 'sub_workflow'>

export function SubWorkflowCard({ data, selected }: NodeProps<SubWorkflowNodeType>) {
  const pipelineName = data.pipeline_ref.namespace
    ? `${data.pipeline_ref.namespace}/${data.pipeline_ref.name}`
    : data.pipeline_ref.name

  return (
    <BaseNodeCard
      id={data.id}
      type="sub_workflow"
      label={data.label ?? 'Sub-Workflow'}
      icon="⬡"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="px-3 py-2 text-xs text-gray-300">
        <span className="truncate font-mono">{pipelineName}</span>
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
