// @plan B4-PR-3
import { useEffect, useRef, useState } from 'react'
import { usePipelineStore } from '../../store/pipelineStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatElapsed(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, '0')
  const s = String(seconds % 60).padStart(2, '0')
  return `${m}:${s}`
}

// ---------------------------------------------------------------------------
// RunControlsBar
// ---------------------------------------------------------------------------

export function RunControlsBar() {
  const activeRunId = usePipelineStore((s) => s.activeRunId)
  const nodeRunStates = usePipelineStore((s) => s.nodeRunStates)

  const [elapsed, setElapsed] = useState(0)
  const startTimeRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!activeRunId) { setElapsed(0); return }
    startTimeRef.current = Date.now()
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [activeRunId])

  if (!activeRunId) return null

  // Find the currently running node for status display
  const runningEntry = Object.entries(nodeRunStates).find(
    ([, s]) => s.status === 'running',
  )
  const runningNodeId = runningEntry?.[0]
  const runningAgent = runningEntry?.[1]?.agentName

  async function callRunApi(action: 'pause' | 'resume' | 'stop') {
    await fetch(`/api/runs/${activeRunId}/${action}`, { method: 'POST' })
  }

  return (
    <div className="flex items-center gap-3 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2">
      {/* Current status */}
      <div className="text-xs text-gray-300 flex-1 truncate">
        {runningNodeId ? (
          <>
            <span className="text-yellow-400 animate-pulse">●</span>
            {' '}Running…{' '}
            {runningAgent && (
              <span className="text-gray-400">
                ({runningAgent} is executing <span className="font-mono">{runningNodeId}</span>)
              </span>
            )}
          </>
        ) : (
          <span className="text-gray-400">Running… {formatElapsed(elapsed)}</span>
        )}
      </div>

      {/* Elapsed */}
      <span className="text-xs text-gray-500 font-mono shrink-0">{formatElapsed(elapsed)}</span>

      {/* Controls */}
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => callRunApi('pause')}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          title="Pause"
        >
          ⏸
        </button>
        <button
          onClick={() => callRunApi('resume')}
          className="text-xs px-2 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          title="Resume"
        >
          ▶
        </button>
        <button
          onClick={() => callRunApi('stop')}
          className="text-xs px-2 py-1 bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
          title="Stop"
        >
          ⏹
        </button>
      </div>
    </div>
  )
}
