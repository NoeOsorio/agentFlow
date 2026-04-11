// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { LLMNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = LLMNode & { runStatus?: NodeRunStatus; tokenCount?: number }
type LLMNodeType = Node<Data, 'llm'>

const PROVIDER_COLORS: Record<string, string> = {
  anthropic: 'text-orange-400 bg-orange-400/10',
  openai: 'text-green-400 bg-green-400/10',
  google: 'text-blue-400 bg-blue-400/10',
  mistral: 'text-purple-400 bg-purple-400/10',
  local: 'text-gray-400 bg-gray-400/10',
}

export function LLMNodeCard({ data, selected }: NodeProps<LLMNodeType>) {
  const promptPreview = (data.prompt.user ?? data.prompt.system ?? '').slice(0, 60)
  const colorClass = PROVIDER_COLORS[data.model.provider] ?? PROVIDER_COLORS.local

  return (
    <BaseNodeCard
      id={data.id}
      type="llm"
      label={data.label ?? 'LLM'}
      icon="🤖"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="space-y-1 px-3 py-2">
        <div className="flex items-center gap-1.5">
          <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}>
            {data.model.provider}
          </span>
          <span className="truncate text-xs text-gray-300">{data.model.model_id}</span>
        </div>
        {promptPreview && (
          <p className="truncate text-xs text-gray-400">"{promptPreview}…"</p>
        )}
        {data.tokenCount != null && (
          <span className="rounded bg-gray-700 px-1.5 py-0.5 text-xs text-gray-300">
            {data.tokenCount} tokens
          </span>
        )}
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
