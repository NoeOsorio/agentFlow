// @plan B4-PR-3
import { useState } from 'react'
import { useCompanyStore } from '../../store/companyStore'
import { usePipelineStore } from '../../store/pipelineStore'
import type { AgentHealthState } from '../../store/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(date: Date | null): string {
  if (!date) return 'unknown'
  const diffMs = Date.now() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  if (diffSec < 60) return `${diffSec}s ago`
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin}m ago`
  return `${Math.floor(diffMin / 60)}h ago`
}

const STATUS_DOT: Record<AgentHealthState['healthStatus'], { icon: string; color: string }> = {
  healthy:  { icon: '●', color: 'text-green-400' },
  degraded: { icon: '●', color: 'text-yellow-400' },
  dead:     { icon: '✗', color: 'text-red-400' },
  unknown:  { icon: '○', color: 'text-gray-500' },
}

// ---------------------------------------------------------------------------
// Agent card
// ---------------------------------------------------------------------------

function AgentCard({ health }: { health: AgentHealthState }) {
  const nodeRunStates = usePipelineStore((s) => s.nodeRunStates)
  const dot = STATUS_DOT[health.healthStatus]

  // Find any node currently running for this agent
  const busyNode = Object.entries(nodeRunStates).find(
    ([, state]) => state.status === 'running' && state.agentName === health.agentName,
  )

  return (
    <div className="flex items-start gap-2 py-2 border-b border-gray-700/50 last:border-0">
      <span className={`text-sm mt-0.5 shrink-0 ${dot.color}`}>{dot.icon}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-white truncate">{health.agentName}</span>
          {busyNode ? (
            <span className="text-[10px] bg-yellow-500/20 text-yellow-400 px-1.5 py-0.5 rounded">
              BUSY — {busyNode[0]}
            </span>
          ) : health.healthStatus === 'healthy' ? (
            <span className="text-[10px] text-gray-500">IDLE</span>
          ) : (
            <span className={`text-[10px] ${dot.color} uppercase`}>{health.healthStatus}</span>
          )}
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          Last ♥ {relativeTime(health.lastHeartbeatAt)}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// HeartbeatSidebar
// ---------------------------------------------------------------------------

export function HeartbeatSidebar() {
  const [open, setOpen] = useState(false)
  const agentHealth = useCompanyStore((s) => s.agentHealth)
  const agents = Object.values(agentHealth)

  return (
    <div className="fixed right-0 top-1/2 -translate-y-1/2 z-40 flex">
      {/* Toggle tab */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="bg-gray-800 border border-gray-700 border-r-0 rounded-l-lg px-2 py-4 text-xs text-gray-400 hover:text-white writing-mode-vertical flex flex-col items-center gap-1"
        style={{ writingMode: 'vertical-rl' }}
      >
        Agents
        {agents.length > 0 && (
          <span className="bg-gray-600 text-white rounded-full px-1 text-[10px]">
            {agents.length}
          </span>
        )}
      </button>

      {/* Panel */}
      {open && (
        <div className="bg-gray-800 border border-gray-700 border-r-0 w-56 shadow-xl overflow-y-auto"
          style={{ maxHeight: 400 }}>
          <div className="px-3 py-2 border-b border-gray-700">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
              Agent Health
            </h3>
          </div>
          <div className="px-3 py-1">
            {agents.length === 0 ? (
              <p className="text-xs text-gray-500 py-2">No agent health data</p>
            ) : (
              agents.map((h) => <AgentCard key={h.agentName} health={h} />)
            )}
          </div>
        </div>
      )}
    </div>
  )
}
