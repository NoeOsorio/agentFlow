// @plan B4-PR-4
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'
import { usePipelineStore } from '../../store/pipelineStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentExecution {
  agent_name: string
  tokens_used: number
  cost_usd: number
}

export interface RunSummary {
  id: string
  pipeline_id?: string
  pipeline_name?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: string
  started_at?: string
  finished_at?: string
  total_tokens?: number
  total_cost_usd?: number
  agent_executions?: AgentExecution[]
}

// ---------------------------------------------------------------------------
// RunSummary store
// ---------------------------------------------------------------------------

interface RunSummaryStore {
  summary: RunSummary | null
  show: boolean
  setSummary(s: RunSummary): void
  dismiss(): void
}

export const useRunSummaryStore = create<RunSummaryStore>()((set) => ({
  summary: null,
  show: false,
  setSummary: (s) => set({ summary: s, show: true }),
  dismiss: () => set({ show: false }),
}))

// ---------------------------------------------------------------------------
// RunSummaryCard
// ---------------------------------------------------------------------------

export function RunSummaryCard() {
  const { summary, show, dismiss } = useRunSummaryStore()
  const pipelineName = usePipelineStore((s) => s.pipelineName)
  const [isRerunning, setIsRerunning] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Auto-dismiss after 10s for completed runs
  useEffect(() => {
    if (show && summary?.status === 'completed') {
      timerRef.current = setTimeout(() => dismiss(), 10_000)
    }
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [show, summary?.id, summary?.status, dismiss])

  if (!show || !summary) return null

  const agents = summary.agent_executions ?? []
  const totalTokens = agents.reduce((s, a) => s + a.tokens_used, 0)
  const totalCost = agents.reduce((s, a) => s + a.cost_usd, 0)

  const succeeded = summary.status === 'completed'
  const duration =
    summary.started_at && summary.finished_at
      ? ((new Date(summary.finished_at).getTime() - new Date(summary.started_at).getTime()) / 1000).toFixed(1)
      : null

  async function handleRunAgain() {
    setIsRerunning(true)
    try {
      await fetch(`/api/pipelines/${encodeURIComponent(pipelineName)}/execute`, {
        method: 'POST',
      })
    } finally {
      setIsRerunning(false)
      dismiss()
    }
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 bg-gray-800 border border-gray-700 rounded-lg shadow-xl p-4">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className={`text-sm font-semibold ${succeeded ? 'text-green-400' : 'text-red-400'}`}>
            {succeeded ? 'Pipeline Completed ✓' : 'Pipeline Failed ✗'}
          </h3>
          {duration && (
            <p className="text-xs text-gray-500 mt-0.5">Duration: {duration}s</p>
          )}
        </div>
        <button
          onClick={dismiss}
          className="text-gray-500 hover:text-white text-sm leading-none ml-2"
        >
          ×
        </button>
      </div>

      {/* Agent cost table */}
      {agents.length > 0 && (
        <div className="mb-4">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-gray-700">
                <th className="text-left pb-1">Agent</th>
                <th className="text-right pb-1">Tokens</th>
                <th className="text-right pb-1">Cost</th>
              </tr>
            </thead>
            <tbody>
              {agents.map((a) => (
                <tr key={a.agent_name} className="text-gray-300">
                  <td className="py-0.5">{a.agent_name}</td>
                  <td className="text-right py-0.5">{a.tokens_used.toLocaleString()}</td>
                  <td className="text-right py-0.5">${a.cost_usd.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="text-white font-medium border-t border-gray-700">
                <td className="pt-1">Total</td>
                <td className="text-right pt-1">{totalTokens.toLocaleString()}</td>
                <td className="text-right pt-1">${totalCost.toFixed(4)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={handleRunAgain}
          disabled={isRerunning}
          className="flex-1 text-xs py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50"
        >
          {isRerunning ? 'Starting…' : 'Run Again'}
        </button>
        <button
          onClick={dismiss}
          className="flex-1 text-xs py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
        >
          View Logs
        </button>
      </div>
    </div>
  )
}
