// @plan B4
import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'

interface Run {
  id: string
  status: string
  started_at: string
  finished_at?: string
  cost_usd?: number
  pipeline_name: string
  agent_count?: number
}

const STATUS_COLORS: Record<string, string> = {
  running: 'text-yellow-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  pending: 'text-gray-400',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDuration(startIso: string, endIso?: string): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const ms = end - start
  if (ms < 1000) return `${ms}ms`
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export default function CompanyDashboardPage() {
  const { companyName = '' } = useParams<{ companyName: string }>()

  const companyId = useCompanyStore((s) => s.companyId)
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)
  const loadCompany = useCompanyStore((s) => s.loadCompany)

  const [runs, setRuns] = useState<Run[]>([])
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)

  // Load company if not loaded
  useEffect(() => {
    if (!companyId && companyName) {
      loadCompany(companyName).catch(() => {/* silent */})
    }
  }, [companyId, companyName, loadCompany])

  // Fetch runs once companyId is available
  useEffect(() => {
    if (!companyId) return
    setRunsLoading(true)
    setRunsError(null)
    fetch(`/api/runs?company_id=${encodeURIComponent(companyId)}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<Run[]>
      })
      .then((data) => setRuns(data))
      .catch((e) => setRunsError(e instanceof Error ? e.message : 'Failed to load runs'))
      .finally(() => setRunsLoading(false))
  }, [companyId])

  const budgetEntries = Object.values(agentBudgets)

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">
        Company Dashboard — {companyName}
      </h1>

      {/* Active Runs Table */}
      <section className="mb-8">
        <h2 className="text-lg font-semibold mb-3 text-gray-200">Active Runs</h2>
        {runsLoading && <p className="text-gray-400 text-sm">Loading runs...</p>}
        {runsError && <p className="text-red-400 text-sm">{runsError}</p>}
        {!runsLoading && !runsError && runs.length === 0 && (
          <p className="text-gray-400 text-sm">No runs found.</p>
        )}
        {!runsLoading && runs.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-700">
            <table className="w-full text-sm">
              <thead className="bg-gray-800">
                <tr className="text-gray-400 text-xs uppercase tracking-wide">
                  <th className="text-left px-4 py-3">Pipeline Name</th>
                  <th className="text-left px-4 py-3">Started</th>
                  <th className="text-left px-4 py-3">Duration</th>
                  <th className="text-left px-4 py-3">Agents</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {runs.map((run) => (
                  <tr key={run.id} className="bg-gray-800 hover:bg-gray-750 transition-colors">
                    <td className="px-4 py-3 font-medium">{run.pipeline_name}</td>
                    <td className="px-4 py-3 text-gray-300">{formatDate(run.started_at)}</td>
                    <td className="px-4 py-3 text-gray-300">
                      {formatDuration(run.started_at, run.finished_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {run.agent_count ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${STATUS_COLORS[run.status] ?? 'text-gray-400'}`}>
                        {run.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        to={`/canvas/${encodeURIComponent(run.pipeline_name)}`}
                        className="text-blue-400 hover:text-blue-300 text-xs underline"
                      >
                        Open Canvas
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Monthly Budget Summary */}
      <section>
        <h2 className="text-lg font-semibold mb-3 text-gray-200">Monthly Budget</h2>
        {budgetEntries.length === 0 && (
          <p className="text-gray-400 text-sm">No budget data available.</p>
        )}
        {budgetEntries.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {budgetEntries.map((b) => (
              <div
                key={b.agentName}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-sm">{b.agentName}</span>
                  <span className="text-xs text-gray-400">{b.month}</span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-2 mb-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full"
                    style={{ width: `${Math.min(b.pctUsed, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-gray-400">
                  <span>${b.spentUsd.toFixed(2)} spent</span>
                  <span>${b.budgetUsd.toFixed(2)} budget</span>
                </div>
                {b.pctUsed >= 90 && (
                  <p className="text-red-400 text-xs mt-1">
                    {b.pctUsed.toFixed(0)}% used — budget nearly exhausted
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
