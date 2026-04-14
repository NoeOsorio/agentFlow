// @plan B4-PR-3
import { useEffect, useRef, useState } from 'react'
import { usePipelineStore } from '../../store/pipelineStore'

// ---------------------------------------------------------------------------
// RunMetricsBar
// ---------------------------------------------------------------------------

export function RunMetricsBar() {
  const activeRunId = usePipelineStore((s) => s.activeRunId)
  const nodeRunStates = usePipelineStore((s) => s.nodeRunStates)

  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const startTimeRef = useRef<number | null>(null)

  // Track start time when run becomes active
  useEffect(() => {
    if (activeRunId) {
      startTimeRef.current = Date.now()
      setElapsedSeconds(0)
    } else {
      startTimeRef.current = null
    }
  }, [activeRunId])

  // Update elapsed every second while running
  useEffect(() => {
    if (!activeRunId) return
    const interval = setInterval(() => {
      if (startTimeRef.current) {
        setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000))
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [activeRunId])

  const states = Object.values(nodeRunStates)
  const hasData = states.some((s) => s.tokensUsed != null || s.costUsd != null)

  if (!activeRunId && !hasData) return null

  const totalTokens = states.reduce((sum, s) => sum + (s.tokensUsed ?? 0), 0)
  const totalCost = states.reduce((sum, s) => sum + (s.costUsd ?? 0), 0)

  return (
    <div className="flex items-center gap-4 text-xs text-gray-400 px-3 py-1 bg-gray-800/50 rounded">
      <span>
        <span className="text-gray-300 font-medium">Total Tokens:</span>{' '}
        {totalTokens.toLocaleString()}
      </span>
      <span>
        <span className="text-gray-300 font-medium">Est. Cost:</span>{' '}
        ${totalCost.toFixed(4)}
      </span>
      {activeRunId && (
        <span>
          <span className="text-gray-300 font-medium">Duration:</span>{' '}
          {elapsedSeconds}s
        </span>
      )}
    </div>
  )
}
