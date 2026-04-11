// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { HTTPNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = HTTPNode & { runStatus?: NodeRunStatus }
type HTTPNodeType = Node<Data, 'http'>

const METHOD_COLORS: Record<string, string> = {
  GET: 'text-green-400 bg-green-400/10',
  POST: 'text-blue-400 bg-blue-400/10',
  PUT: 'text-yellow-400 bg-yellow-400/10',
  DELETE: 'text-red-400 bg-red-400/10',
  PATCH: 'text-orange-400 bg-orange-400/10',
}

export function HTTPNodeCard({ data, selected }: NodeProps<HTTPNodeType>) {
  const urlPreview = data.url.slice(0, 30)
  const colorClass = METHOD_COLORS[data.method] ?? METHOD_COLORS.GET

  return (
    <BaseNodeCard
      id={data.id}
      type="http"
      label={data.label ?? 'HTTP'}
      icon="🌐"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="flex items-center gap-1.5 px-3 py-2">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-bold ${colorClass}`}>
          {data.method}
        </span>
        <span className="truncate text-xs text-gray-300">{urlPreview}</span>
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
