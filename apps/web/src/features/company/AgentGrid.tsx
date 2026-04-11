// @plan B0-PR-2
import { useState, useMemo } from 'react'
import type { InlineAgent } from '@agentflow/core'
import type { AgentBudgetState, AgentHealthState } from '../../store/types'
import { AgentCard } from './AgentCard'

interface AgentGridProps {
  agents: InlineAgent[]
  agentBudgets?: Record<string, AgentBudgetState>
  agentHealth?: Record<string, AgentHealthState>
  onEdit: (agent: InlineAgent) => void
  onDelete: (agentName: string) => void
}

type SortKey = 'name' | 'role' | 'budget' | 'status'

const STATUS_ORDER: Record<string, number> = {
  healthy: 0,
  degraded: 1,
  dead: 2,
  unknown: 3,
}

export function AgentGrid({ agents, agentBudgets = {}, agentHealth = {}, onEdit, onDelete }: AgentGridProps) {
  const [filterText, setFilterText] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('name')

  const filtered = useMemo(() => {
    const q = filterText.toLowerCase()
    return agents.filter((a) => {
      if (!q) return true
      return (
        a.name.toLowerCase().includes(q) ||
        a.role.toLowerCase().includes(q) ||
        a.capabilities?.some((c) => c.toLowerCase().includes(q))
      )
    })
  }, [agents, filterText])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case 'name':
          return a.name.localeCompare(b.name)
        case 'role':
          return a.role.localeCompare(b.role)
        case 'budget': {
          const aRemaining = (agentBudgets[a.name]?.remainingUsd ?? a.budget?.monthly_usd ?? 0)
          const bRemaining = (agentBudgets[b.name]?.remainingUsd ?? b.budget?.monthly_usd ?? 0)
          return bRemaining - aRemaining
        }
        case 'status': {
          const aStatus = agentHealth[a.name]?.healthStatus ?? 'unknown'
          const bStatus = agentHealth[b.name]?.healthStatus ?? 'unknown'
          return (STATUS_ORDER[aStatus] ?? 3) - (STATUS_ORDER[bStatus] ?? 3)
        }
        default:
          return 0
      }
    })
  }, [filtered, sortKey, agentBudgets, agentHealth])

  return (
    <div className="flex flex-col gap-4">
      {/* Filter + Sort bar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          type="text"
          placeholder="Filter by name, role, capability..."
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none"
        />
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500">Sort:</span>
          {(['name', 'role', 'budget', 'status'] as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                sortKey === key
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
              }`}
            >
              {key.charAt(0).toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-gray-700 p-12 text-center text-gray-500">
          {filterText ? 'No agents match the filter.' : 'No agents defined yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((agent) => (
            <AgentCard
              key={agent.name}
              agent={agent}
              budget={agentBudgets[agent.name]}
              health={agentHealth[agent.name]}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
