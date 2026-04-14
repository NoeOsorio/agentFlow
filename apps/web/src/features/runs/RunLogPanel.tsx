// @plan B4-PR-2
import { useEffect, useRef, useState } from 'react'
import { useLogsStore } from '../../store/logsStore'
import type { LogEntry, LogEntryStatus } from '../../store/logsStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTimestamp(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  const ss = String(date.getSeconds()).padStart(2, '0')
  const ms = String(date.getMilliseconds()).padStart(3, '0')
  return `${hh}:${mm}:${ss}.${ms}`
}

const STATUS_ICON: Record<LogEntryStatus, string> = {
  running: '⟳',
  completed: '✓',
  failed: '✗',
  info: 'ℹ',
}

const STATUS_COLOR: Record<LogEntryStatus, string> = {
  running: 'text-yellow-400',
  completed: 'text-green-400',
  failed: 'text-red-400',
  info: 'text-gray-400',
}

type FilterTab = 'all' | 'errors' | 'completed'

// ---------------------------------------------------------------------------
// Log row
// ---------------------------------------------------------------------------

function LogRow({ entry }: { entry: LogEntry }) {
  const color = STATUS_COLOR[entry.status]
  const icon = STATUS_ICON[entry.status]

  const agentPart =
    entry.agentName && entry.agentRole
      ? `👤 ${entry.agentName} (${entry.agentRole}) — `
      : entry.agentName
        ? `👤 ${entry.agentName} — `
        : ''

  const tokenPart = entry.tokensUsed != null ? ` ${entry.tokensUsed.toLocaleString()} tokens` : ''
  const costPart = entry.costUsd != null ? ` $${entry.costUsd.toFixed(4)}` : ''

  return (
    <div className={`flex gap-2 py-0.5 text-xs font-mono ${color}`}>
      <span className="text-gray-500 shrink-0">[{formatTimestamp(entry.timestamp)}]</span>
      <span>
        {agentPart}
        <span className="font-semibold">{entry.nodeId}</span>
        {' '}
        <span>{icon} {entry.status}</span>
        {tokenPart}
        {costPart}
        {entry.message ? ` — ${entry.message}` : ''}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// RunLogPanel
// ---------------------------------------------------------------------------

export function RunLogPanel() {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState<FilterTab>('all')
  const logs = useLogsStore((s) => s.logs)
  const clearLogs = useLogsStore((s) => s.clearLogs)
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom (logs are prepended, so scroll to top = newest)
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0
    }
  }, [logs, open])

  const filtered = logs.filter((entry) => {
    if (filter === 'errors') return entry.status === 'failed'
    if (filter === 'completed') return entry.status === 'completed'
    return true
  })

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40">
      {/* Toggle bar */}
      <div className="flex items-center gap-3 bg-gray-900 border-t border-gray-700 px-4 py-1.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="text-xs text-gray-300 hover:text-white font-medium flex items-center gap-1"
        >
          <span>{open ? '▼' : '▲'}</span>
          <span>Logs</span>
          {logs.length > 0 && (
            <span className="ml-1 bg-gray-700 text-gray-300 rounded-full px-1.5 py-0.5 text-[10px]">
              {logs.length}
            </span>
          )}
        </button>

        {open && (
          <>
            <div className="flex gap-1">
              {(['all', 'errors', 'completed'] as FilterTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setFilter(tab)}
                  className={`text-xs px-2 py-0.5 rounded ${
                    filter === tab
                      ? 'bg-gray-600 text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </button>
              ))}
            </div>
            <button
              onClick={clearLogs}
              className="text-xs text-gray-500 hover:text-gray-300 ml-auto"
            >
              Clear
            </button>
          </>
        )}
      </div>

      {/* Log content */}
      {open && (
        <div
          ref={scrollRef}
          className="bg-gray-900 border-t border-gray-700 overflow-y-auto px-4 py-2"
          style={{ maxHeight: 300 }}
        >
          {filtered.length === 0 ? (
            <p className="text-xs text-gray-500 py-2">No log entries.</p>
          ) : (
            filtered.map((entry) => <LogRow key={entry.id} entry={entry} />)
          )}
        </div>
      )}
    </div>
  )
}
