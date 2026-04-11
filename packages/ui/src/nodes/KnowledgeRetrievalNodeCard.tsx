// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { KnowledgeRetrievalNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = KnowledgeRetrievalNode & { runStatus?: NodeRunStatus }
type KnowledgeRetrievalNodeType = Node<Data, 'knowledge_retrieval'>

export function KnowledgeRetrievalNodeCard({ data, selected }: NodeProps<KnowledgeRetrievalNodeType>) {
  return (
    <BaseNodeCard
      id={data.id}
      type="knowledge_retrieval"
      label={data.label ?? 'Knowledge Retrieval'}
      icon="📚"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="space-y-1 px-3 py-2 text-xs text-gray-300">
        <div className="truncate font-mono">{data.knowledge_base_id}</div>
        <div className="text-gray-400">top_k: {data.top_k ?? 5}</div>
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
