// @plan B0-PR-1
import { useNavigate } from 'react-router-dom'

export interface CompanyListItem {
  id: string
  name: string
  namespace: string
  agent_count: number
  total_budget_usd: number | null
  active_agents: number
  idle_agents: number
  updated_at: string
}

interface CompanyCardProps {
  company: CompanyListItem
  onDelete: (id: string) => void
}

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

export default function CompanyCard({ company, onDelete }: CompanyCardProps) {
  const navigate = useNavigate()

  function handleDelete() {
    if (window.confirm(`Delete "${company.name}"? This cannot be undone.`)) {
      onDelete(company.id)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-5 flex flex-col gap-4 hover:border-gray-700 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-white leading-tight">{company.name}</h3>
          <span className="text-xs text-gray-500 font-mono">{company.namespace}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {company.active_agents > 0 && (
            <span className="flex items-center gap-1 text-xs bg-green-900/40 text-green-400 border border-green-800/50 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
              {company.active_agents} active
            </span>
          )}
          {company.idle_agents > 0 && (
            <span className="text-xs bg-gray-800 text-gray-400 border border-gray-700 px-2 py-0.5 rounded-full">
              {company.idle_agents} idle
            </span>
          )}
        </div>
      </div>

      <div className="flex gap-4 text-sm text-gray-400">
        <span>
          <span className="text-white font-medium">{company.agent_count}</span>{' '}
          {company.agent_count === 1 ? 'agent' : 'agents'}
        </span>
        {company.total_budget_usd != null && (
          <span>
            <span className="text-white font-medium">${company.total_budget_usd.toFixed(0)}</span>{' '}
            budget/mo
          </span>
        )}
      </div>

      <div className="text-xs text-gray-600">Updated {formatDate(company.updated_at)}</div>

      <div className="flex gap-2 pt-1 border-t border-gray-800">
        <button
          onClick={() => navigate(`/companies/${company.id}`)}
          className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium py-1.5 rounded-lg transition-colors"
        >
          Open
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/20 rounded-lg transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
