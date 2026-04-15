// @plan B4
import { useEffect, useRef, useState } from 'react'
import { usePipelineStore } from '../../store/pipelineStore'
import { useLogsStore } from '../../store/logsStore'

interface AgentRow {
  agentName: string
  tokens: number
  cost: number
}

export default function RunSummaryCard() {
  const logs = useLogsStore((s) => s.logs)
  const clearLogs = useLogsStore((s) => s.clearLogs)
  const nodeRunStates = usePipelineStore((s) => s.nodeRunStates)
  const clearRunStates = usePipelineStore((s) => s.clearRunStates)

  const [visible, setVisible] = useState(true)
  const dismissTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const completionLog = logs.find((l) => l.status === 'pipeline_complete')
  const hasFailed = logs.some((l) => l.status === 'failed')

  useEffect(() => {
    if (!completionLog) return
    setVisible(true)
    if (!hasFailed) {
      dismissTimer.current = setTimeout(() => setVisible(false), 10_000)
    }
    return () => {
      if (dismissTimer.current) clearTimeout(dismissTimer.current)
    }
  }, [completionLog, hasFailed])

  if (!completionLog || !visible) return null

  // Per-agent aggregation
  const agentMap: Record<string, AgentRow> = {}
  for (const state of Object.values(nodeRunStates)) {
    if (!state.agentName) continue
    const key = state.agentName
    if (!agentMap[key]) {
      agentMap[key] = { agentName: key, tokens: 0, cost: 0 }
    }
    agentMap[key]!.tokens += state.tokensUsed ?? 0
    agentMap[key]!.cost += state.costUsd ?? 0
  }
  const agents = Object.values(agentMap)
  const totalTokens = agents.reduce((s, a) => s + a.tokens, 0)
  const totalCost = agents.reduce((s, a) => s + a.cost, 0)

  // Duration
  const starts = Object.values(nodeRunStates)
    .map((s) => s.startedAt)
    .filter((t): t is number => t !== undefined)
  const ends = Object.values(nodeRunStates)
    .map((s) => s.finishedAt)
    .filter((t): t is number => t !== undefined)
  const earliestStart = starts.length ? Math.min(...starts) : null
  const latestEnd = ends.length ? Math.max(...ends) : null
  const durationMs =
    earliestStart !== null && latestEnd !== null ? latestEnd - earliestStart : null

  function formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`
    const s = Math.round(ms / 1000)
    if (s < 60) return `${s}s`
    return `${Math.floor(s / 60)}m ${s % 60}s`
  }

  function handleRunAgain() {
    clearRunStates()
    clearLogs()
  }

  function handleViewLogs() {
    const el = document.getElementById('run-log-panel')
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl bg-gray-800 shadow-xl border border-gray-700 p-4 text-sm text-white">
      <div className="flex items-center justify-between mb-3">
        <span className="font-semibold text-base">
          {hasFailed ? '✗ Pipeline Failed' : '✓ Pipeline Complete'}
        </span>
        {durationMs !== null && (
          <span className="text-gray-400 text-xs">{formatDuration(durationMs)}</span>
        )}
      </div>

      {agents.length > 0 && (
        <table className="w-full text-xs mb-3">
          <thead>
            <tr className="text-gray-400">
              <th className="text-left pb-1">Agent</th>
              <th className="text-right pb-1">Tokens</th>
              <th className="text-right pb-1">Cost</th>
            </tr>
          </thead>
          <tbody>
            {agents.map((a) => (
              <tr key={a.agentName} className="text-gray-200">
                <td className="py-0.5">{a.agentName}</td>
                <td className="text-right">{a.tokens.toLocaleString()}</td>
                <td className="text-right">${a.cost.toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-600 text-gray-100 font-medium">
              <td className="pt-1">Total</td>
              <td className="text-right pt-1">{totalTokens.toLocaleString()}</td>
              <td className="text-right pt-1">${totalCost.toFixed(4)}</td>
            </tr>
          </tfoot>
        </table>
      )}

      <div className="flex gap-2 mt-2">
        <button
          onClick={handleRunAgain}
          className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded px-3 py-1.5 text-xs font-medium transition-colors"
        >
          Run Again
        </button>
        <button
          onClick={handleViewLogs}
          className="flex-1 bg-gray-700 hover:bg-gray-600 text-white rounded px-3 py-1.5 text-xs font-medium transition-colors"
        >
          View Logs
        </button>
      </div>
    </div>
  )
}
