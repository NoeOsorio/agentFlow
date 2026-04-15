// @plan B4
import { useState, useEffect, useCallback } from 'react'
import { usePipelineStore } from '../../store/pipelineStore'

interface Run {
  id: string
  status: string
  started_at: string
  finished_at?: string
  cost_usd?: number
  pipeline_name: string
}

const STATUS_COLORS: Record<string, string> = {
  running: 'bg-yellow-500 text-black',
  completed: 'bg-green-600 text-white',
  failed: 'bg-red-600 text-white',
  pending: 'bg-gray-500 text-white',
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

interface Props {
  pipelineName: string
}

export default function RunHistorySidebar({ pipelineName }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [runs, setRuns] = useState<Run[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const setActiveRun = usePipelineStore((s) => s.setActiveRun)

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/runs?pipeline_id=${encodeURIComponent(pipelineName)}`,
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as Run[]
      setRuns(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load runs')
    } finally {
      setLoading(false)
    }
  }, [pipelineName])

  useEffect(() => {
    if (expanded) {
      fetchRuns()
    }
  }, [expanded, fetchRuns])

  async function handleReRun(run: Run) {
    try {
      const res = await fetch(
        `/api/pipelines/${encodeURIComponent(run.pipeline_name)}/execute`,
        { method: 'POST' },
      )
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { run_id?: string; id?: string }
      const runId = data.run_id ?? data.id ?? null
      setActiveRun(runId)
    } catch {
      // silent — user can retry
    }
  }

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-white hover:bg-gray-700 transition-colors"
      >
        <span>Run History</span>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-700">
          {loading && (
            <p className="px-4 py-3 text-xs text-gray-400">Loading...</p>
          )}
          {error && (
            <p className="px-4 py-3 text-xs text-red-400">{error}</p>
          )}
          {!loading && !error && runs.length === 0 && (
            <p className="px-4 py-3 text-xs text-gray-400">No previous runs.</p>
          )}
          {!loading && runs.map((run) => (
            <div
              key={run.id}
              className="px-4 py-3 border-b border-gray-700 last:border-b-0 flex items-start justify-between gap-2"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`inline-block px-1.5 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[run.status] ?? 'bg-gray-500 text-white'}`}
                  >
                    {run.status}
                  </span>
                  {run.cost_usd !== undefined && (
                    <span className="text-gray-400 text-xs">${run.cost_usd.toFixed(4)}</span>
                  )}
                </div>
                <p className="text-xs text-gray-300 truncate">{formatDate(run.started_at)}</p>
                <p className="text-xs text-gray-500">
                  {formatDuration(run.started_at, run.finished_at)}
                </p>
              </div>
              <button
                onClick={() => handleReRun(run)}
                className="flex-shrink-0 bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs font-medium transition-colors"
              >
                Re-run
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
