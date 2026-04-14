// @plan B4-PR-4
import { useEffect, useState } from 'react'
import { usePipelineStore } from '../../store/pipelineStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HistoricalRun {
  id: string
  pipeline_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  created_at: string
  started_at?: string
  finished_at?: string
  total_tokens?: number
  total_cost_usd?: number
  agent_executions?: Array<{ agent_name: string }>
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_COLOR: Record<string, string> = {
  completed: 'text-green-400',
  failed: 'text-red-400',
  running: 'text-yellow-400',
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

function formatDuration(run: HistoricalRun): string {
  if (!run.started_at || !run.finished_at) return '—'
  const sec = (new Date(run.finished_at).getTime() - new Date(run.started_at).getTime()) / 1000
  return sec < 60 ? `${sec.toFixed(1)}s` : `${Math.floor(sec / 60)}m ${Math.floor(sec % 60)}s`
}

// ---------------------------------------------------------------------------
// RunHistorySidebar
// ---------------------------------------------------------------------------

export function RunHistorySidebar() {
  const [open, setOpen] = useState(false)
  const [runs, setRuns] = useState<HistoricalRun[]>([])
  const [loading, setLoading] = useState(false)
  const pipelineId = usePipelineStore((s) => s.pipelineId)
  const pipelineName = usePipelineStore((s) => s.pipelineName)

  useEffect(() => {
    if (!open || !pipelineId) return
    setLoading(true)
    fetch(`/api/runs?pipeline_id=${encodeURIComponent(pipelineId)}`)
      .then((r) => r.json())
      .then((data: HistoricalRun[]) => setRuns(Array.isArray(data) ? data : []))
      .catch(() => setRuns([]))
      .finally(() => setLoading(false))
  }, [open, pipelineId])

  async function handleRerun(run: HistoricalRun) {
    await fetch(`/api/pipelines/${encodeURIComponent(pipelineName)}/execute`, {
      method: 'POST',
    })
    void run
  }

  return (
    <div className="flex h-full">
      {/* Content panel */}
      {open && (
        <div className="w-64 bg-gray-800 border-r border-gray-700 flex flex-col overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-700 flex items-center justify-between">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Run History
            </h3>
            <button
              onClick={() => setOpen(false)}
              className="text-gray-500 hover:text-white text-sm"
            >
              ×
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {loading && (
              <p className="text-xs text-gray-500 py-2 text-center">Loading…</p>
            )}
            {!loading && runs.length === 0 && (
              <p className="text-xs text-gray-500 py-2 text-center">No runs yet</p>
            )}
            {runs.map((run) => {
              const agents = run.agent_executions?.map((a) => a.agent_name).join(', ') ?? '—'
              return (
                <div
                  key={run.id}
                  className="bg-gray-900 rounded p-2 text-xs space-y-1"
                >
                  <div className="flex items-center justify-between">
                    <span className={`font-medium ${STATUS_COLOR[run.status] ?? 'text-gray-400'}`}>
                      {run.status}
                    </span>
                    <span className="text-gray-500">{formatDate(run.created_at)}</span>
                  </div>
                  <div className="text-gray-400 flex gap-2">
                    <span>{formatDuration(run)}</span>
                    {run.total_cost_usd != null && (
                      <span>${run.total_cost_usd.toFixed(4)}</span>
                    )}
                  </div>
                  <div className="text-gray-500 truncate">Agents: {agents}</div>
                  <button
                    onClick={() => handleRerun(run)}
                    className="text-[10px] text-blue-400 hover:text-blue-300 mt-1"
                  >
                    Re-run →
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Toggle tab */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-gray-800 border-r border-gray-700 px-2 py-4 text-xs text-gray-400 hover:text-white flex flex-col items-center gap-1"
        style={{ writingMode: 'vertical-rl' }}
      >
        History
      </button>
    </div>
  )
}
