// @plan B4-PR-4
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useCompanyStore } from '../store/companyStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ActiveRun {
  id: string
  pipeline_id: string
  pipeline_name?: string
  status: string
  created_at: string
  started_at?: string
  total_tokens?: number
  total_cost_usd?: number
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function elapsedSeconds(startedAt?: string): string {
  if (!startedAt) return '—'
  const sec = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000)
  if (sec < 60) return `${sec}s`
  return `${Math.floor(sec / 60)}m ${sec % 60}s`
}

// ---------------------------------------------------------------------------
// CompanyDashboardPage
// ---------------------------------------------------------------------------

export default function CompanyDashboardPage() {
  const { companyName = '' } = useParams<{ companyName: string }>()
  const [activeRuns, setActiveRuns] = useState<ActiveRun[]>([])
  const [loading, setLoading] = useState(true)
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)

  // Load company to populate budgets
  useEffect(() => {
    if (companyName) {
      useCompanyStore.getState().loadCompany(companyName).catch(() => {})
    }
  }, [companyName])

  // Poll active runs every 10 seconds
  useEffect(() => {
    async function fetchRuns() {
      try {
        const res = await fetch(
          `/api/runs?company_name=${encodeURIComponent(companyName)}&status=running`,
        )
        if (res.ok) {
          const data = (await res.json()) as ActiveRun[]
          setActiveRuns(Array.isArray(data) ? data : [])
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }

    fetchRuns()
    const interval = setInterval(fetchRuns, 10_000)
    return () => clearInterval(interval)
  }, [companyName])

  const budgets = Object.values(agentBudgets)

  return (
    <div className="bg-gray-900 min-h-screen text-white p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-white">
            {companyName} — Dashboard
          </h1>
          <p className="text-sm text-gray-400 mt-1">Live view of all active pipeline runs</p>
        </div>

        {/* Active Runs */}
        <section className="mb-8">
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Active Runs
          </h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : activeRuns.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center text-sm text-gray-500">
              No active runs
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-700">
                  <tr className="text-xs text-gray-400">
                    <th className="text-left p-3">Pipeline</th>
                    <th className="text-left p-3">Status</th>
                    <th className="text-left p-3">Duration</th>
                    <th className="text-right p-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRuns.map((run) => (
                    <tr key={run.id} className="border-b border-gray-700/50 last:border-0">
                      <td className="p-3 text-white">
                        {run.pipeline_name ?? run.pipeline_id}
                      </td>
                      <td className="p-3">
                        <span className="text-yellow-400 text-xs">● running</span>
                      </td>
                      <td className="p-3 text-gray-400 text-xs">
                        {elapsedSeconds(run.started_at)}
                      </td>
                      <td className="p-3 text-right">
                        <Link
                          to={`/canvas/${run.pipeline_name ?? run.pipeline_id}`}
                          className="text-xs text-blue-400 hover:text-blue-300"
                        >
                          View Pipeline →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Monthly Budget */}
        <section>
          <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Monthly Budget
          </h2>
          {budgets.length === 0 ? (
            <div className="bg-gray-800 rounded-lg p-6 text-center text-sm text-gray-500">
              No budget data
            </div>
          ) : (
            <div className="bg-gray-800 rounded-lg p-4 space-y-3">
              {budgets.map((b) => {
                const pct = Math.min(100, b.pctUsed * 100)
                const exceeded = b.pctUsed >= 1
                const barColor = exceeded ? 'bg-red-500' : b.pctUsed >= 0.8 ? 'bg-yellow-400' : 'bg-green-500'
                return (
                  <div key={b.agentName}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-medium ${exceeded ? 'text-red-400' : 'text-white'}`}>
                        👤 {b.agentName}
                      </span>
                      <span className="text-gray-400">
                        ${b.spentUsd.toFixed(2)} / ${b.budgetUsd.toFixed(2)}
                        {exceeded && <span className="text-red-400 ml-1">(EXCEEDED)</span>}
                      </span>
                    </div>
                    <div className="w-full bg-gray-700 rounded h-1.5">
                      <div
                        className={`h-1.5 rounded ${barColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
