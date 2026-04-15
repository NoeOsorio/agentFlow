// @plan B4-execution-viz
import { useEffect, useState } from 'react'
import { usePipelineStore } from '../../store/pipelineStore'

export default function RunMetricsBar() {
  const activeRunId = usePipelineStore((s) => s.activeRunId)
  const nodeRunStates = usePipelineStore((s) => s.nodeRunStates)
  const [now, setNow] = useState(() => Date.now())

  const states = Object.values(nodeRunStates)

  const totalTokens = states.reduce((sum, s) => sum + (s.tokensUsed ?? 0), 0)
  const totalCost = states.reduce((sum, s) => sum + (s.costUsd ?? 0), 0)

  const startedAts = states
    .map((s) => s.startedAt)
    .filter((t): t is number => t != null)
  const earliestStart = startedAts.length > 0 ? Math.min(...startedAts) : null

  const hasCompletedCosts = states.some((s) => s.status === 'completed' && s.costUsd != null)
  const visible = activeRunId !== null || hasCompletedCosts

  useEffect(() => {
    if (!visible || earliestStart == null) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [visible, earliestStart])

  if (!visible) return null

  const durationSec = earliestStart != null ? (now - earliestStart) / 1000 : 0

  function formatTokens(n: number): string {
    return n.toLocaleString()
  }

  return (
    <div className="inline-flex items-center gap-3 px-3 py-1 rounded-full bg-gray-700 text-gray-100 text-xs font-medium">
      <span>Total:</span>
      <span>{formatTokens(totalTokens)} tokens</span>
      <span className="text-gray-500">|</span>
      <span>${totalCost.toFixed(4)}</span>
      <span className="text-gray-500">|</span>
      <span>{durationSec.toFixed(1)}s</span>
    </div>
  )
}
