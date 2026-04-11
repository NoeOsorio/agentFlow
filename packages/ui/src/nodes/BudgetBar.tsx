// @plan B2-PR-2

interface BudgetBarProps {
  /** Amount spent so far in USD */
  spent: number
  /** Total budget in USD */
  budget: number
}

function getBudgetColor(pct: number): string {
  if (pct > 80) return 'bg-red-500'
  if (pct > 60) return 'bg-yellow-400'
  return 'bg-green-500'
}

export function BudgetBar({ spent, budget }: BudgetBarProps) {
  const pct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0
  const barColor = getBudgetColor(pct)

  return (
    <div className="space-y-1">
      <div className="h-1.5 w-full rounded-full bg-gray-600">
        <div
          className={`h-1.5 rounded-full transition-all ${barColor}`}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
      <div className="text-right text-xs text-gray-400">
        ${spent.toFixed(0)}/${budget.toFixed(0)}
      </div>
    </div>
  )
}
