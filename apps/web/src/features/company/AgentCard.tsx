// @plan B0-PR-2
import type { InlineAgent } from '@agentflow/core'
import { BudgetBar } from '@agentflow/ui'
import type { AgentBudgetState, AgentHealthState } from '../../store/types'

interface AgentCardProps {
  agent: InlineAgent
  budget?: AgentBudgetState
  health?: AgentHealthState
  onEdit: (agent: InlineAgent) => void
  onDelete: (agentName: string) => void
}

const CAPABILITY_COLORS: Record<string, string> = {
  coding: 'bg-blue-900 text-blue-300',
  research: 'bg-purple-900 text-purple-300',
  writing: 'bg-green-900 text-green-300',
  analysis: 'bg-yellow-900 text-yellow-300',
  review: 'bg-orange-900 text-orange-300',
  planning: 'bg-teal-900 text-teal-300',
  execution: 'bg-red-900 text-red-300',
  management: 'bg-pink-900 text-pink-300',
}

function getCapabilityColor(cap: string): string {
  return CAPABILITY_COLORS[cap] ?? 'bg-gray-700 text-gray-300'
}

function getStatusDot(status: AgentHealthState['healthStatus'] | undefined): {
  color: string
  label: string
} {
  switch (status) {
    case 'healthy':
      return { color: 'bg-green-400', label: 'Healthy' }
    case 'degraded':
      return { color: 'bg-yellow-400', label: 'Degraded' }
    case 'dead':
      return { color: 'bg-red-400', label: 'Dead' }
    default:
      return { color: 'bg-gray-500', label: 'Unknown' }
  }
}

export function AgentCard({ agent, budget, health, onEdit, onDelete }: AgentCardProps) {
  const { color: statusColor, label: statusLabel } = getStatusDot(health?.healthStatus)
  const modelLabel = `${agent.model.model_id} (${agent.model.provider})`

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-gray-700 bg-gray-800 p-4 transition-colors hover:border-gray-600">
      {/* Header: Avatar + Name + Role */}
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-700 text-sm font-bold text-white">
          {agent.name.slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate font-semibold text-white">{agent.name}</h3>
            <span
              className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ${statusColor.replace('bg-', 'text-').replace('-400', '-300')} bg-gray-700`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
              {statusLabel}
            </span>
          </div>
          <p className="text-sm text-indigo-400">{agent.role}</p>
        </div>
      </div>

      {/* Model */}
      <div className="text-xs text-gray-400">
        <span className="text-gray-500">Model: </span>
        {modelLabel}
      </div>

      {/* Persona */}
      {agent.persona && (
        <p
          className="line-clamp-2 text-xs text-gray-400"
          title={agent.persona}
        >
          {agent.persona}
        </p>
      )}

      {/* Capabilities */}
      {agent.capabilities && agent.capabilities.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {agent.capabilities.map((cap) => (
            <span
              key={cap}
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${getCapabilityColor(cap)}`}
            >
              {cap}
            </span>
          ))}
        </div>
      )}

      {/* Budget bar */}
      {agent.budget && (
        <div className="space-y-1">
          <BudgetBar
            spent={budget?.spentUsd ?? 0}
            budget={agent.budget.monthly_usd}
          />
          {agent.reports_to && (
            <p className="text-[10px] text-gray-500">
              Reports to: <span className="text-gray-400">{agent.reports_to}</span>
            </p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={() => onEdit(agent)}
          className="flex-1 rounded-lg bg-gray-700 py-1.5 text-xs font-medium text-gray-200 transition-colors hover:bg-gray-600"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(agent.name)}
          className="flex-1 rounded-lg bg-gray-700 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-900/40"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
