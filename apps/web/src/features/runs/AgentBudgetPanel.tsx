// @plan B4-execution-viz
import { useState } from 'react'
import { useCompanyStore } from '../../store/companyStore'
import { usePipelineStore } from '../../store/pipelineStore'

export default function AgentBudgetPanel() {
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)
  const activeRunId = usePipelineStore((s) => s.activeRunId)
  const [collapsed, setCollapsed] = useState(false)

  const entries = Object.entries(agentBudgets)
  const hasActivity = entries.length > 0
  const visible = activeRunId !== null || hasActivity

  if (!visible) return null

  const monthlyTotal = entries.reduce((sum, [, b]) => sum + b.spentUsd, 0)

  function barColor(pct: number): string {
    if (pct > 1) return 'bg-red-500'
    if (pct > 0.8) return 'bg-amber-400'
    return 'bg-green-500'
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-800 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-gray-100">Agent Budgets</h3>
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="text-gray-400 hover:text-gray-200 text-xs"
        >
          {collapsed ? '▼' : '▲'}
        </button>
      </div>

      {!collapsed && (
        <div className="p-4 space-y-3">
          {!hasActivity ? (
            <p className="text-sm text-gray-500 text-center py-4">No agent activity yet.</p>
          ) : (
            <>
              {entries.map(([key, budget]) => {
                const pct = budget.pctUsed
                const exceeded = budget.spentUsd > budget.budgetUsd
                const barWidth = Math.min(pct * 100, 100)

                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="shrink-0">👤</span>
                        <span className="text-gray-100 font-medium truncate">
                          {budget.agentName}
                        </span>
                        {exceeded && (
                          <span className="shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-900 text-red-300">
                            EXCEEDED
                          </span>
                        )}
                      </div>
                      <div className="text-gray-400 shrink-0 ml-2">
                        ${budget.spentUsd.toFixed(2)} / ${budget.budgetUsd.toFixed(2)}
                        <span className="ml-1 text-gray-500">({(pct * 100).toFixed(1)}%)</span>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${barColor(pct)}`}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                )
              })}

              {/* Monthly Total */}
              <div className="pt-2 mt-2 border-t border-gray-700 flex items-center justify-between text-xs">
                <span className="text-gray-400 font-medium">Monthly Total</span>
                <span className="text-gray-100 font-semibold">${monthlyTotal.toFixed(2)}</span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
