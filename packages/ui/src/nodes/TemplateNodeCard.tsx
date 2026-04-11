// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { TemplateNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = TemplateNode & { runStatus?: NodeRunStatus }
type TemplateNodeType = Node<Data, 'template'>

export function TemplateNodeCard({ data, selected }: NodeProps<TemplateNodeType>) {
  const preview = data.template.slice(0, 60)

  return (
    <BaseNodeCard
      id={data.id}
      type="template"
      label={data.label ?? 'Template'}
      icon="📄"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="px-3 py-2 text-xs text-gray-400">
        "{preview}{data.template.length > 60 ? '…' : ''}"
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
