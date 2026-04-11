// @plan B2-PR-3
import { type Node, type NodeProps } from '@xyflow/react'
import type { VariableAggregatorNode } from '@agentflow/core'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import type { NodeRunStatus } from './types'

type Data = VariableAggregatorNode & { runStatus?: NodeRunStatus }
type VariableAggregatorNodeType = Node<Data, 'variable_aggregator'>

const STRATEGY_COLORS: Record<string, string> = {
  first: 'text-blue-400 bg-blue-400/10',
  merge: 'text-green-400 bg-green-400/10',
  list: 'text-purple-400 bg-purple-400/10',
}

export function VariableAggregatorCard({ data, selected }: NodeProps<VariableAggregatorNodeType>) {
  const colorClass = STRATEGY_COLORS[data.strategy] ?? STRATEGY_COLORS.list

  return (
    <BaseNodeCard
      id={data.id}
      type="variable_aggregator"
      label={data.label ?? 'Variable Aggregator'}
      icon="⊕"
      runStatus={data.runStatus}
      selected={selected}
    >
      <div className="space-y-1 px-3 py-2">
        <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${colorClass}`}>
          {data.strategy}
        </span>
        <div className="text-xs text-gray-400">{data.branches.length} inputs → {data.output_key}</div>
      </div>
      {data.branches.map(branch => (
        <NodeHandle key={branch} type="target" id={branch} label={branch} />
      ))}
      <NodeHandle type="source" />
    </BaseNodeCard>
  )
}
