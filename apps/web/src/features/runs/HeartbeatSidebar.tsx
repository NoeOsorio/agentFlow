// @plan B4-execution-viz
import { useState } from 'react'
import { useCompanyStore } from '../../store/companyStore'
import { usePipelineStore } from '../../store/pipelineStore'
import type { AgentHealthState } from '../../store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(date: Date | null): string {
  if (!date) return 'never'
  const secs = Math.floor((Date.now() - date.getTime()) / 1000)
  if (secs < 60) return `${secs}s ago`
  const mins = Math.floor(secs / 60)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return `${hrs}h ago`
}

const STATUS_DOT: Record<AgentHealthState['healthStatus'], string> = {
  healthy: 'bg-green-500',
  degraded: 'bg-yellow-400',
  dead: 'bg-red-500',
  unknown: 'bg-gray-500',
}

// ---------------------------------------------------------------------------
// AgentCard
// ---------------------------------------------------------------------------

interface AgentCardProps {
  health: AgentHealthState
  isBusy: boolean
}

function AgentCard({ health, isBusy }: AgentCardProps) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-gray-800 px-3 py-2">
      <span
        className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[health.healthStatus]}`}
        aria-label={health.healthStatus}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-medium text-gray-100">{health.agentName}</span>
          {isBusy && (
            <span className="rounded bg-yellow-500/20 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-yellow-400">
              BUSY
            </span>
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-gray-400">
          ♥ {timeAgo(health.lastHeartbeatAt)}
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeartbeatSidebar
// ---------------------------------------------------------------------------

interface HeartbeatSidebarProps {
  className?: string
}

export default function HeartbeatSidebar({ className = '' }: HeartbeatSidebarProps) {
  const [collapsed, setCollapsed] = useState(true)
  const agentHealth = useCompanyStore((s) => s.agentHealth)
  const nodeRunStates = usePipelineStore((s) => s.nodeRunStates)

  // Build set of currently-busy agent names
  const busyAgents = new Set<string>()
  for (const state of Object.values(nodeRunStates)) {
    if (state.status === 'running' && state.agentName) {
      busyAgents.add(state.agentName)
    }
  }

  const entries = Object.values(agentHealth)

  // Collapsed: show vertical tab on right edge
  if (collapsed) {
    return (
      <div className={`fixed right-0 top-1/2 z-30 -translate-y-1/2 ${className}`}>
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center justify-center rounded-l-md bg-gray-800 px-1.5 py-4 text-gray-400 shadow-lg hover:bg-gray-700 hover:text-gray-100 transition-colors"
          aria-label="Show agents panel"
        >
          <span
            className="whitespace-nowrap text-xs font-medium tracking-wider"
            style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)' }}
          >
            Agents
          </span>
        </button>
      </div>
    )
  }

  return (
    <div
      className={`fixed right-0 top-0 z-30 flex h-full w-64 flex-col bg-gray-900 shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 px-4 py-3">
        <span className="text-sm font-semibold text-gray-100">Agents</span>
        <button
          onClick={() => setCollapsed(true)}
          className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-gray-100 transition-colors"
          aria-label="Collapse agents panel"
        >
          ›
        </button>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-3">
        {entries.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500">No agent data.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {entries.map((health) => (
              <AgentCard
                key={health.agentName}
                health={health}
                isBusy={busyAgents.has(health.agentName)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
