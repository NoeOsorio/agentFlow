// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { CodeNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = CodeNode & { runStatus?: NodeRunStatus }
type CodeNodeType = Node<Data, 'code'>

const LANG_COLORS: Record<string, string> = {
  python: 'text-blue-400 bg-blue-400/10',
  javascript: 'text-yellow-400 bg-yellow-400/10',
}

export function CodeNodeCard({ data, selected }: NodeProps<CodeNodeType>) {
  const firstLine = data.code.split('\n')[0]?.trim() ?? ''
  const colorClass = LANG_COLORS[data.language] ?? LANG_COLORS.python

  return (
    <BaseNodeCard
      id={data.id}
      type="code"
      label={data.label ?? 'Code'}
      icon="⌨"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="space-y-1 px-3 py-2">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}>
          {data.language}
        </span>
        {firstLine && (
          <p className="truncate font-mono text-xs text-gray-400">{firstLine}</p>
        )}
      </div>
      <NodeHandle type="target" />
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
