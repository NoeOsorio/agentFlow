// @plan B2-PR-2
import type { NodeProps } from '@xyflow/react'
import type { AgentPodNode } from '@agentflow/core'
import type { AgentSpec } from '@agentflow/core'
import type { NodeRunStatus } from './types'
import { BaseNodeCard } from './BaseNodeCard'
import { NodeHandle } from './NodeHandle'
import { NODE_COLORS } from './colors'
import { BudgetBar } from './BudgetBar'

export interface AgentPodNodeData extends AgentPodNode {
  agentSpec?: AgentSpec
  runStatus?: NodeRunStatus
  /** Budget spent so far in USD (comes from runtime/store) */
  budgetSpent?: number
}

export function AgentPodNodeCard({ id, data: rawData, selected }: NodeProps) {
  const data = rawData as unknown as AgentPodNodeData
  const { agentSpec, runStatus = 'idle', budgetSpent = 0 } = data
  const agentName = data.agent_ref?.name ?? 'unknown'
  const label = data.label ?? agentName

  return (
    <div className="relative">
      <NodeHandle type="target" />
      <BaseNodeCard
        id={id}
        type="agent_pod"
        label={label}
        icon="👤"
        accentColor={NODE_COLORS['agent_pod']}
        runStatus={runStatus}
        selected={selected}
      >
        {agentSpec ? (
          <div className="space-y-2">
            {/* Role badge */}
            <span className="inline-block rounded bg-indigo-900 px-1.5 py-0.5 text-xs font-medium text-indigo-300">
              {agentSpec.role}
            </span>

            {/* Persona snippet */}
            {agentSpec.persona && (
              <div className="border-t border-gray-700 pt-2 italic text-gray-400">
                &ldquo;{agentSpec.persona.slice(0, 60)}
                {agentSpec.persona.length > 60 ? '…' : ''}&rdquo;
              </div>
            )}

            {/* Model */}
            <div className="border-t border-gray-700 pt-2">
              <span className="text-gray-500">Model: </span>
              {agentSpec.model.model_id}
            </div>

            {/* Budget bar */}
            {agentSpec.budget && (
              <div className="border-t border-gray-700 pt-2">
                <BudgetBar
                  spent={budgetSpent}
                  budget={agentSpec.budget.monthly_usd}
                />
              </div>
            )}
          </div>
        ) : (
          /* No agent selected — graceful degradation */
          <button
            type="button"
            className="w-full rounded border border-orange-600 bg-orange-900/20 px-2 py-1 text-xs text-orange-400 hover:bg-orange-900/40"
          >
            Select agent ▾
          </button>
        )}
      </BaseNodeCard>
      <NodeHandle type="source" />
    </div>
  )
}
