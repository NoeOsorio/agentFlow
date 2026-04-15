// @plan B1-PR-2
// Left-sidebar node palette — company-aware.
// Company Agents section shows agents from the active company as first-class draggable items.
import React, { useState, useMemo } from 'react'
import { NODE_COLORS } from '@agentflow/ui'
import { usePipelineStore } from '../../store/pipelineStore'
import { useCompanyStore } from '../../store/companyStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaletteItem {
  type: string
  label: string
}

// ---------------------------------------------------------------------------
// Static palette sections
// ---------------------------------------------------------------------------

const PALETTE_SECTIONS: { title: string; items: PaletteItem[] }[] = [
  {
    title: 'Control Flow',
    items: [
      { type: 'start', label: 'Start' },
      { type: 'end', label: 'End' },
      { type: 'if_else', label: 'IF / ELSE' },
      { type: 'iteration', label: 'Iteration' },
    ],
  },
  {
    title: 'AI & Models',
    items: [
      { type: 'llm', label: 'LLM' },
      { type: 'knowledge_retrieval', label: 'Knowledge Retrieval' },
    ],
  },
  {
    title: 'Data',
    items: [
      { type: 'code', label: 'Code' },
      { type: 'template', label: 'Template' },
      { type: 'variable_assigner', label: 'Variable Assigner' },
      { type: 'variable_aggregator', label: 'Variable Aggregator' },
      { type: 'http', label: 'HTTP Request' },
    ],
  },
  {
    title: 'Integration',
    items: [
      { type: 'sub_workflow', label: 'Sub-Workflow' },
      { type: 'human_input', label: 'Human Input' },
    ],
  },
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Simple hash to assign a stable color to a role string
const ROLE_COLORS = [
  '#6366f1', // indigo
  '#3b82f6', // blue
  '#22c55e', // green
  '#f97316', // orange
  '#ec4899', // pink
  '#eab308', // yellow
  '#14b8a6', // teal
  '#8b5cf6', // violet
]

function roleColor(role: string): string {
  let hash = 0
  for (let i = 0; i < role.length; i++) hash = (hash * 31 + role.charCodeAt(i)) | 0
  return ROLE_COLORS[Math.abs(hash) % ROLE_COLORS.length]!
}

function formatUsd(usd: number): string {
  return `$${usd.toFixed(0)}`
}

// ---------------------------------------------------------------------------
// AgentPaletteItem
// ---------------------------------------------------------------------------

interface AgentPaletteItemProps {
  name: string
  role: string
  remainingUsd?: number
  pctUsed?: number
}

const AgentPaletteItem = React.memo(function AgentPaletteItem({ name, role, remainingUsd, pctUsed }: AgentPaletteItemProps) {
  const color = roleColor(role)
  const budgetLow = pctUsed !== undefined && pctUsed > 0.8

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('node-type', 'agent_pod')
    event.dataTransfer.setData('agent-name', name)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      data-testid={`palette-agent-${name}`}
      className="flex cursor-grab items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5 active:cursor-grabbing"
    >
      {/* Role color avatar */}
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: color }}
        aria-label={role}
      >
        {role.charAt(0).toUpperCase()}
      </span>

      <span className="flex-1 truncate text-sm text-gray-200">
        <span className="font-medium">{name}</span>
        <span className="ml-1 text-xs text-gray-400">— {role}</span>
      </span>

      {remainingUsd !== undefined && (
        <span
          data-testid={`budget-badge-${name}`}
          className={`shrink-0 rounded px-1 py-0.5 text-xs font-medium ${
            budgetLow ? 'bg-red-900 text-red-300' : 'bg-gray-700 text-gray-300'
          }`}
        >
          {formatUsd(remainingUsd)} left
        </span>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// PaletteItem (static node types)
// ---------------------------------------------------------------------------

const StaticPaletteItem = React.memo(function StaticPaletteItem({ type, label }: PaletteItem) {
  const color = (NODE_COLORS as Record<string, string>)[type] ?? '#6b7280'

  const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
    event.dataTransfer.setData('node-type', type)
    event.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      draggable
      onDragStart={onDragStart}
      data-testid={`palette-item-${type}`}
      className="flex cursor-grab items-center gap-2 rounded px-2 py-1.5 hover:bg-white/5 active:cursor-grabbing"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
      />
      <span className="text-sm text-gray-300">{label}</span>
    </div>
  )
})

// ---------------------------------------------------------------------------
// NodePalette
// ---------------------------------------------------------------------------

export function NodePalette() {
  const [search, setSearch] = useState('')

  const companyRef = usePipelineStore(s => s.companyRef)
  const company = useCompanyStore(s => s.company)
  const agentBudgets = useCompanyStore(s => s.agentBudgets)

  const query = search.trim().toLowerCase()

  // Filter company agents
  const filteredAgents = useMemo(() => {
    if (!companyRef || !company) return []
    if (!query) return company.spec.agents
    return company.spec.agents.filter(
      a =>
        a.name.toLowerCase().includes(query) ||
        a.role.toLowerCase().includes(query),
    )
  }, [companyRef, company, query])

  // Filter static sections
  const filteredSections = useMemo(() => {
    if (!query) return PALETTE_SECTIONS
    return PALETTE_SECTIONS.map(section => ({
      ...section,
      items: section.items.filter(
        item =>
          item.label.toLowerCase().includes(query) ||
          item.type.toLowerCase().includes(query),
      ),
    })).filter(section => section.items.length > 0)
  }, [query])

  return (
    <aside
      className="flex h-full w-56 flex-col border-r border-gray-800 bg-gray-950"
      aria-label="Node palette"
    >
      {/* Search */}
      <div className="border-b border-gray-800 p-3">
        <input
          type="search"
          placeholder="Filter nodes…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full rounded bg-gray-800 px-2 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          aria-label="Filter nodes"
        />
      </div>

      {/* Scrollable palette body */}
      <div className="flex-1 overflow-y-auto py-2">
        {/* Company Agents section */}
        {companyRef && company && filteredAgents.length > 0 && (
          <section aria-label="Company Agents" className="mb-3">
            <h3 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Company Agents
            </h3>
            {filteredAgents.map(agent => {
              const budget = agentBudgets[agent.name]
              return (
                <AgentPaletteItem
                  key={agent.name}
                  name={agent.name}
                  role={agent.role}
                  remainingUsd={budget?.remainingUsd}
                  pctUsed={budget?.pctUsed}
                />
              )
            })}
          </section>
        )}

        {/* Static node type sections */}
        {filteredSections.map(section => (
          <section key={section.title} aria-label={section.title} className="mb-3">
            <h3 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-500">
              {section.title}
            </h3>
            {section.items.map(item => (
              <StaticPaletteItem key={item.type} {...item} />
            ))}
          </section>
        ))}

        {/* Empty state */}
        {filteredAgents.length === 0 && filteredSections.length === 0 && (
          <p className="px-3 py-4 text-center text-sm text-gray-500">No nodes match</p>
        )}
      </div>
    </aside>
  )
}
