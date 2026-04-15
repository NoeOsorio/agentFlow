// @plan B4-execution-viz
import { useEffect, useRef, useState } from 'react'
import { usePipelineStore } from '../../store/pipelineStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(ms: number): string {
  const totalSecs = Math.floor(ms / 1000)
  const mins = Math.floor(totalSecs / 60)
  const secs = totalSecs % 60
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
}

async function callRunApi(runId: string, action: 'pause' | 'resume' | 'stop'): Promise<void> {
  await fetch(`/api/runs/${encodeURIComponent(runId)}/${action}`, { method: 'POST' })
}

// ---------------------------------------------------------------------------
// RunControlsBar
// ---------------------------------------------------------------------------

export default function RunControlsBar() {
  const activeRunId = usePipelineStore((s) => s.activeRunId)
  const nodeRunStates = usePipelineStore((s) => s.nodeRunStates)
  const setActiveRun = usePipelineStore((s) => s.setActiveRun)
  const clearRunStates = usePipelineStore((s) => s.clearRunStates)

  const [elapsed, setElapsed] = useState(0)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Compute earliest startedAt among running nodes
  const runningEntries = Object.entries(nodeRunStates).filter(
    ([, state]) => state.status === 'running',
  )

  const earliestStart = runningEntries.reduce<number | null>((min, [, state]) => {
    if (state.startedAt === undefined) return min
    return min === null ? state.startedAt : Math.min(min, state.startedAt)
  }, null)

  // Derive current agent description
  const currentAgentEntry = runningEntries[0]
  const currentAgentDesc =
    currentAgentEntry !== undefined
      ? (() => {
          const [nodeId, state] = currentAgentEntry
          return state.agentName
            ? `${state.agentName} is executing ${nodeId}`
            : `executing ${nodeId}`
        })()
      : null

  // Tick elapsed time every second
  useEffect(() => {
    if (!activeRunId) {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      setElapsed(0)
      return
    }

    const startRef = earliestStart ?? Date.now()

    const tick = () => setElapsed(Date.now() - startRef)
    tick()

    intervalRef.current = setInterval(tick, 1000)

    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
    // Re-run only when activeRunId changes; earliestStart is intentionally excluded
    // to avoid resetting the timer as nodes start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRunId])

  if (!activeRunId) return null

  const handlePause = () => callRunApi(activeRunId, 'pause')
  const handleResume = () => callRunApi(activeRunId, 'resume')
  const handleStop = async () => {
    await callRunApi(activeRunId, 'stop')
    clearRunStates()
    setActiveRun(null)
  }

  return (
    <div className="flex items-center gap-3 rounded-full bg-gray-800 px-4 py-2 shadow-lg ring-1 ring-gray-700">
      {/* Status */}
      <div className="flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
        <span className="text-sm text-gray-200">
          {currentAgentDesc ? `Running… (${currentAgentDesc})` : 'Running…'}
        </span>
      </div>

      {/* Elapsed */}
      <span className="font-mono text-xs text-gray-400">{formatElapsed(elapsed)}</span>

      {/* Divider */}
      <span className="text-gray-600">|</span>

      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={handlePause}
          className="rounded px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          Pause
        </button>
        <button
          onClick={handleResume}
          className="rounded px-2 py-1 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
        >
          Resume
        </button>
        <button
          onClick={handleStop}
          className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors"
        >
          Stop
        </button>
      </div>
    </div>
  )
}
