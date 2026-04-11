// @plan B0-PR-2
import type { InlineAgent } from '@agentflow/core'
import type { AgentHealthState } from '../../store/types'

interface OrgNodeProps {
  agent: InlineAgent
  health?: AgentHealthState
  onClick: () => void
  onAddReport: () => void
}

const ROLE_COLORS: Record<string, string> = {
  CEO: 'bg-purple-600',
  CTO: 'bg-blue-600',
  CFO: 'bg-green-600',
  COO: 'bg-orange-600',
  'Lead Engineer': 'bg-indigo-600',
  Developer: 'bg-cyan-600',
  Designer: 'bg-pink-600',
  Analyst: 'bg-yellow-600',
  PM: 'bg-rose-600',
  'QA Engineer': 'bg-emerald-600',
  DevOps: 'bg-teal-600',
  'Data Scientist': 'bg-violet-600',
}

function getRoleColor(role: string): string {
  return ROLE_COLORS[role] ?? 'bg-gray-600'
}

function getStatusDot(status: AgentHealthState['healthStatus'] | undefined): string {
  switch (status) {
    case 'healthy':
      return 'bg-green-400'
    case 'degraded':
      return 'bg-yellow-400'
    case 'dead':
      return 'bg-red-400'
    default:
      return 'bg-gray-500'
  }
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase()
}

export function OrgNode({ agent, health, onClick, onAddReport }: OrgNodeProps) {
  const avatarColor = getRoleColor(agent.role)
  const statusDot = getStatusDot(health?.healthStatus)
  const budgetPct =
    agent.budget
      ? Math.min(100, ((0 / agent.budget.monthly_usd) * 100))
      : null

  return (
    <div className="group relative flex flex-col items-center">
      {/* Node card */}
      <button
        onClick={onClick}
        className="relative flex flex-col items-center gap-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-3 text-center transition-colors hover:border-indigo-500 hover:bg-gray-750 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        style={{ minWidth: '100px' }}
      >
        {/* Avatar */}
        <div className={`relative flex h-10 w-10 items-center justify-center rounded-full ${avatarColor} text-sm font-bold text-white`}>
          {getInitials(agent.name)}
          {/* Status dot */}
          <span
            className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-gray-800 ${statusDot}`}
            title={health?.healthStatus ?? 'unknown'}
          />
        </div>

        {/* Name */}
        <span className="text-xs font-semibold text-white">{agent.name}</span>

        {/* Role badge */}
        <span className="rounded-full bg-gray-700 px-2 py-0.5 text-[10px] text-gray-300">
          {agent.role}
        </span>

        {/* Budget tooltip on hover */}
        {budgetPct !== null && (
          <div className="absolute -bottom-8 left-1/2 hidden -translate-x-1/2 whitespace-nowrap rounded bg-gray-900 px-2 py-1 text-[10px] text-gray-300 group-hover:block">
            Budget: ${agent.budget?.monthly_usd}/mo
          </div>
        )}
      </button>

      {/* Add report button */}
      <button
        onClick={(e) => { e.stopPropagation(); onAddReport() }}
        className="mt-1 rounded px-2 py-0.5 text-[10px] text-gray-500 opacity-0 transition-opacity hover:text-indigo-400 group-hover:opacity-100"
        title="Add report"
      >
        + report
      </button>
    </div>
  )
}
