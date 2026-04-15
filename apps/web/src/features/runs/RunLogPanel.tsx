// @plan B4-execution-viz
import { useEffect, useRef, useState } from 'react'
import { useLogsStore } from '../../store/logsStore'

type FilterTab = 'All' | 'Errors' | 'Completed'

type StatusColors = {
  running: string
  completed: string
  failed: string
  pipeline_complete: string
  info: string
  approval_required: string
}

const STATUS_COLOR: StatusColors = {
  running: 'text-yellow-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  pipeline_complete: 'text-gray-400',
  info: 'text-gray-400',
  approval_required: 'text-amber-400',
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatTokens(n: number): string {
  return n.toLocaleString()
}

export default function RunLogPanel() {
  const logs = useLogsStore((s) => s.logs)
  const clearLogs = useLogsStore((s) => s.clearLogs)
  const [open, setOpen] = useState(true)
  const [filter, setFilter] = useState<FilterTab>('All')
  const bottomRef = useRef<HTMLDivElement>(null)

  const filtered = logs.filter((entry) => {
    if (filter === 'Errors') return entry.status === 'failed'
    if (filter === 'Completed') return entry.status === 'completed' || entry.status === 'pipeline_complete'
    return true
  })

  useEffect(() => {
    if (open && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [filtered.length, open])

  const tabs: FilterTab[] = ['All', 'Errors', 'Completed']

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 border-t border-gray-700 shadow-2xl">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800 border-b border-gray-700">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setOpen((v) => !v)}
            className="text-gray-300 hover:text-white text-sm font-medium"
          >
            Logs {open ? '▲' : '▼'}
          </button>
          {open && (
            <div className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`px-3 py-0.5 rounded text-xs font-medium transition-colors ${
                    filter === tab
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-gray-200'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}
        </div>
        {open && (
          <button
            onClick={clearLogs}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Log entries */}
      {open && (
        <div className="h-[220px] overflow-y-auto px-4 py-2 space-y-1 font-mono text-xs">
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              No execution events yet.
            </div>
          ) : (
            filtered.map((entry) => {
              const colorClass = STATUS_COLOR[entry.status] ?? 'text-gray-400'
              const isAgent = entry.agentName != null
              const isPipelineComplete = entry.status === 'pipeline_complete'

              return (
                <div key={entry.id} className="flex items-baseline gap-2 leading-5">
                  <span className="text-gray-500 shrink-0">
                    [{formatTime(entry.timestamp)}]
                  </span>

                  {isPipelineComplete ? (
                    <span className={colorClass}>
                      🏁 {entry.message}
                      {entry.costUsd != null && (
                        <span className="ml-2">${entry.costUsd.toFixed(4)}</span>
                      )}
                      {entry.tokensUsed != null && (
                        <span className="ml-2">{formatTokens(entry.tokensUsed)} tokens</span>
                      )}
                    </span>
                  ) : isAgent ? (
                    <span className={colorClass}>
                      👤 {entry.agentName}
                      {entry.agentRole && (
                        <span className="text-gray-400"> ({entry.agentRole})</span>
                      )}
                      {entry.nodeId && (
                        <span className="text-gray-500 ml-2">{entry.nodeId}</span>
                      )}
                      <span className="ml-2">
                        {entry.status === 'completed' ? '✓ completed' : entry.status}
                      </span>
                      {entry.tokensUsed != null && (
                        <span className="ml-2 text-gray-400">
                          {formatTokens(entry.tokensUsed)} tokens
                        </span>
                      )}
                      {entry.costUsd != null && (
                        <span className="ml-2 text-gray-400">${entry.costUsd.toFixed(4)}</span>
                      )}
                      {entry.error && (
                        <span className="ml-2 text-red-400">{entry.error}</span>
                      )}
                    </span>
                  ) : (
                    <span className={colorClass}>{entry.message}</span>
                  )}
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>
      )}
    </div>
  )
}
