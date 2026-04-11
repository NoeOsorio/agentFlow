// @plan B2-PR-2
import { useState } from 'react'
import type { AgentSpec } from '@agentflow/core'
import type { AgentReference } from '@agentflow/core'

interface AgentSelectorProps {
  value: AgentReference | null
  onChange: (ref: AgentReference | null) => void
  availableAgents: (AgentSpec & { name: string })[]
}

function getBudgetLeft(agent: AgentSpec & { name: string }): number | null {
  if (!agent.budget) return null
  return agent.budget.monthly_usd
}

const ROLE_COLORS = [
  'bg-indigo-600',
  'bg-blue-600',
  'bg-purple-600',
  'bg-teal-600',
  'bg-pink-600',
]

function getRoleColor(role: string): string {
  const hash = Array.from(role).reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return ROLE_COLORS[hash % ROLE_COLORS.length] ?? 'bg-indigo-600'
}

export function AgentSelector({ value, onChange, availableAgents }: AgentSelectorProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const filtered = availableAgents.filter(
    (a) =>
      a.name.toLowerCase().includes(query.toLowerCase()) ||
      a.role.toLowerCase().includes(query.toLowerCase()),
  )

  const selectedAgent = value
    ? availableAgents.find((a) => a.name === value.name)
    : null

  return (
    <div className="relative w-full">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={[
          'flex w-full items-center justify-between rounded border px-3 py-2 text-sm',
          value
            ? 'border-gray-600 bg-gray-800 text-white'
            : 'border-orange-600 bg-orange-900/20 text-orange-400',
        ].join(' ')}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        {selectedAgent ? (
          <span className="flex items-center gap-2">
            <span
              className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold text-white ${getRoleColor(selectedAgent.role)}`}
            >
              {selectedAgent.name.charAt(0).toUpperCase()}
            </span>
            <span>
              {selectedAgent.name} — {selectedAgent.role}
              {selectedAgent.budget && (
                <span className="ml-1 text-gray-400">
                  (${getBudgetLeft(selectedAgent)?.toFixed(0)} left)
                </span>
              )}
            </span>
          </span>
        ) : (
          <span>No agent selected</span>
        )}
        <span className="text-gray-400">▾</span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full rounded border border-gray-600 bg-gray-800 shadow-xl">
          {/* Search */}
          <div className="border-b border-gray-700 p-2">
            <input
              type="text"
              placeholder="Search by name or role…"
              value={query}
              onChange={(e) => setQuery((e.target as HTMLInputElement).value)}
              className="w-full rounded bg-gray-900 px-2 py-1 text-sm text-white placeholder-gray-500 outline-none"
              autoFocus
            />
          </div>

          {/* Agent list */}
          <ul className="max-h-48 overflow-y-auto" role="listbox">
            {filtered.length === 0 && (
              <li className="px-3 py-2 text-sm text-gray-500">No agents found</li>
            )}
            {filtered.map((agent) => {
              const budgetLeft = getBudgetLeft(agent)
              return (
                <li
                  key={agent.name}
                  role="option"
                  aria-selected={value?.name === agent.name}
                  onClick={() => {
                    onChange({ name: agent.name })
                    setOpen(false)
                    setQuery('')
                  }}
                  className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm text-white hover:bg-gray-700"
                >
                  <span
                    className={`flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${getRoleColor(agent.role)}`}
                  >
                    {agent.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="flex-1 truncate">
                    {agent.name} — {agent.role}
                  </span>
                  {budgetLeft != null && (
                    <span className="flex-shrink-0 text-xs text-gray-400">
                      ${budgetLeft.toFixed(0)} left
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
