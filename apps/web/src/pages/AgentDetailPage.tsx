// @plan B0-PR-3
import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Layout from '../components/Layout'
import { AgentFormModal } from '../features/company/AgentFormModal'
import { useCompanyStore } from '../store/companyStore'

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function CapabilityChip({ cap }: { cap: string }) {
  const colors: Record<string, string> = {
    coding: 'bg-blue-900/50 text-blue-300 border-blue-700',
    research: 'bg-purple-900/50 text-purple-300 border-purple-700',
    writing: 'bg-green-900/50 text-green-300 border-green-700',
    analysis: 'bg-yellow-900/50 text-yellow-300 border-yellow-700',
    review: 'bg-pink-900/50 text-pink-300 border-pink-700',
    planning: 'bg-orange-900/50 text-orange-300 border-orange-700',
    execution: 'bg-red-900/50 text-red-300 border-red-700',
    management: 'bg-teal-900/50 text-teal-300 border-teal-700',
  }
  const cls = colors[cap] ?? 'bg-gray-800 text-gray-300 border-gray-600'
  return (
    <span className={`rounded-full border px-3 py-0.5 text-xs font-medium ${cls}`}>
      {cap}
    </span>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AgentDetailPage() {
  const { id, agentName } = useParams<{ id: string; agentName: string }>()
  const company = useCompanyStore((s) => s.company)
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)
  const agentHealth = useCompanyStore((s) => s.agentHealth)
  const [editOpen, setEditOpen] = useState(false)

  const agent = company?.spec.agents.find((a) => a.name === agentName)
  const budget = agentBudgets[agentName ?? '']
  const health = agentHealth[agentName ?? '']

  const healthColors: Record<string, string> = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-400',
    dead: 'bg-red-500',
    unknown: 'bg-gray-500',
  }

  if (!agent) {
    return (
      <Layout>
        <div className="py-16 text-center">
          <p className="text-lg font-semibold text-red-400">Agent not found</p>
          <Link
            to={id ? `/companies/${id}` : '/companies'}
            className="mt-2 inline-block text-sm text-blue-400 hover:underline"
          >
            ← Back to company
          </Link>
        </div>
      </Layout>
    )
  }

  const budgetPct = budget ? budget.pctUsed : 0
  const budgetBarColor = budgetPct > 80 ? 'bg-red-500' : budgetPct > 60 ? 'bg-yellow-400' : 'bg-green-500'

  return (
    <Layout>
      <div className="mx-auto max-w-4xl space-y-8">
        {/* Back nav */}
        <Link
          to={id ? `/companies/${id}` : '/companies'}
          className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Back to company
        </Link>

        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-700 text-2xl font-bold text-white">
              {agent.name[0]?.toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-white">{agent.name}</h1>
                {health && (
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${healthColors[health.healthStatus] ?? 'bg-gray-500'}`}
                    title={health.healthStatus}
                  />
                )}
              </div>
              <p className="text-base text-gray-400">{agent.role}</p>
            </div>
          </div>
          <button
            onClick={() => setEditOpen(true)}
            className="rounded-lg border border-gray-600 px-4 py-2 text-sm text-gray-300 hover:border-indigo-500 hover:text-white transition-colors"
          >
            Edit Agent
          </button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <StatCard label="Model" value={agent.model.model_id} />
          <StatCard label="Provider" value={agent.model.provider} />
          <StatCard label="Capabilities" value={String(agent.capabilities?.length ?? 0)} />
          <StatCard
            label="Monthly Budget"
            value={agent.budget?.monthly_usd ? `$${agent.budget.monthly_usd}` : 'Unlimited'}
          />
        </div>

        {/* Persona */}
        {agent.persona && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Persona</p>
            <p className="text-sm text-gray-300 leading-relaxed">{agent.persona}</p>
          </div>
        )}

        {/* Capabilities */}
        {agent.capabilities && agent.capabilities.length > 0 && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Capabilities</p>
            <div className="flex flex-wrap gap-2">
              {agent.capabilities.map((cap) => (
                <CapabilityChip key={cap} cap={cap} />
              ))}
            </div>
          </div>
        )}

        {/* Budget */}
        {agent.budget && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
            <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Budget This Month</p>
            {budget ? (
              <>
                <div className="mb-2 flex justify-between text-sm">
                  <span className="text-gray-300">${budget.spentUsd.toFixed(2)} spent</span>
                  <span className="text-gray-500">${budget.budgetUsd.toFixed(2)} limit ({Math.round(budgetPct)}%)</span>
                </div>
                <div className="h-3 w-full rounded-full bg-gray-700">
                  <div
                    className={`h-3 rounded-full transition-all ${budgetBarColor}`}
                    style={{ width: `${budgetPct}%` }}
                  />
                </div>
              </>
            ) : (
              <p className="text-sm text-gray-500">Budget data not available. Run the agent to see usage.</p>
            )}
          </div>
        )}

        {/* Org info */}
        {agent.reports_to && (
          <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Reports To</p>
            <p className="text-sm text-gray-300">{agent.reports_to}</p>
          </div>
        )}

        {/* Run history placeholder */}
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Run History</p>
          <p className="text-sm text-gray-600 italic">No runs recorded for this agent yet.</p>
        </div>

        {/* Heartbeat log */}
        <div className="rounded-xl border border-gray-700 bg-gray-900 p-5">
          <p className="mb-3 text-xs font-medium uppercase tracking-wide text-gray-500">Heartbeat Log</p>
          {health?.lastHeartbeatAt ? (
            <p className="text-sm text-gray-300">
              Last heartbeat: {health.lastHeartbeatAt.toLocaleString()}
            </p>
          ) : (
            <p className="text-sm text-gray-600 italic">No heartbeat data available.</p>
          )}
        </div>
      </div>

      <AgentFormModal
        agent={agent}
        open={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
      />
    </Layout>
  )
}
