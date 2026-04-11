// @plan B0-PR-3
import { useCompanyStore } from '../../store/companyStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function barColor(pct: number): string {
  if (pct > 80) return 'bg-red-500'
  if (pct > 60) return 'bg-yellow-400'
  return 'bg-green-500'
}

function fmtUsd(n: number): string {
  return `$${n.toFixed(2)}`
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BudgetOverview() {
  const company = useCompanyStore((s) => s.company)
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)
  const refreshBudgets = useCompanyStore((s) => s.refreshBudgets)

  const agents = company?.spec.agents ?? []
  const totalBudget = agents.reduce((sum, a) => sum + (a.budget?.monthly_usd ?? 0), 0)
  const totalSpent = Object.values(agentBudgets).reduce((sum, b) => sum + b.spentUsd, 0)
  const totalPct = totalBudget > 0 ? Math.min(100, (totalSpent / totalBudget) * 100) : 0

  const now = new Date()
  const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const resetStr = nextReset.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-900 p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">Budget Overview</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">Resets {resetStr}</span>
          <button
            onClick={refreshBudgets}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            title="Refresh budgets"
          >
            ↻
          </button>
        </div>
      </div>

      {/* Company-level bar */}
      <div>
        <div className="mb-1 flex justify-between text-xs text-gray-400">
          <span>Company total</span>
          <span>
            {fmtUsd(totalSpent)} / {fmtUsd(totalBudget)} ({Math.round(totalPct)}%)
          </span>
        </div>
        <div className="h-3 w-full rounded-full bg-gray-700">
          <div
            className={`h-3 rounded-full transition-all ${barColor(totalPct)}`}
            style={{ width: `${totalPct}%` }}
          />
        </div>
      </div>

      {/* Per-agent breakdown */}
      {agents.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Per agent</p>
          {agents.map((agent) => {
            const budget = agentBudgets[agent.name]
            const agentLimit = agent.budget?.monthly_usd ?? 0
            const agentSpent = budget?.spentUsd ?? 0
            const agentPct = agentLimit > 0 ? Math.min(100, (agentSpent / agentLimit) * 100) : 0
            return (
              <div key={agent.name}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="text-gray-300">{agent.name}</span>
                  <span className="text-gray-500">
                    {agentLimit > 0
                      ? `${fmtUsd(agentSpent)} / ${fmtUsd(agentLimit)} (${Math.round(agentPct)}%)`
                      : 'No budget set'}
                  </span>
                </div>
                {agentLimit > 0 && (
                  <div className="h-2 w-full rounded-full bg-gray-700">
                    <div
                      className={`h-2 rounded-full transition-all ${barColor(agentPct)}`}
                      style={{ width: `${agentPct}%` }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {agents.length === 0 && (
        <p className="text-xs text-gray-500 text-center py-4">No agents defined yet.</p>
      )}
    </div>
  )
}
