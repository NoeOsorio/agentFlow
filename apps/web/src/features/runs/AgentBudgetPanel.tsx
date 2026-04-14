// @plan B4-PR-3
import { useCompanyStore } from '../../store/companyStore'
import type { AgentBudgetState } from '../../store/types'

// ---------------------------------------------------------------------------
// Budget row
// ---------------------------------------------------------------------------

function BudgetRow({ budget }: { budget: AgentBudgetState }) {
  const exceeded = budget.pctUsed >= 1
  const pct = Math.min(100, budget.pctUsed * 100)
  const barColor = exceeded
    ? 'bg-red-500'
    : budget.pctUsed >= 0.8
      ? 'bg-yellow-400'
      : 'bg-green-500'

  return (
    <div className={`py-2 ${exceeded ? 'text-red-400' : 'text-gray-300'}`}>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="font-medium">👤 {budget.agentName}</span>
        <span>
          ${budget.spentUsd.toFixed(2)} spent · ${budget.remainingUsd.toFixed(2)} remaining
          {exceeded && <span className="ml-1 font-bold">(EXCEEDED)</span>}
        </span>
      </div>
      <div className="w-full bg-gray-700 rounded h-1.5">
        <div
          className={`h-1.5 rounded transition-all duration-300 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// AgentBudgetPanel
// ---------------------------------------------------------------------------

export function AgentBudgetPanel() {
  const agentBudgets = useCompanyStore((s) => s.agentBudgets)
  const budgets = Object.values(agentBudgets)

  if (budgets.length === 0) {
    return (
      <div className="p-4 text-xs text-gray-500">No agent budget data</div>
    )
  }

  const totalSpent = budgets.reduce((sum, b) => sum + b.spentUsd, 0)

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
        Agent Budgets
      </h3>

      <div className="divide-y divide-gray-700/50">
        {budgets.map((b) => (
          <BudgetRow key={b.agentName} budget={b} />
        ))}
      </div>

      <div className="mt-3 pt-2 border-t border-gray-700 flex justify-between text-xs text-gray-400">
        <span>Monthly total</span>
        <span className="font-medium text-white">${totalSpent.toFixed(2)}</span>
      </div>
    </div>
  )
}
