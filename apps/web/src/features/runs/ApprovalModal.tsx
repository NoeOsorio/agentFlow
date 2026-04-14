// @plan B4-PR-3
import { useEffect, useRef, useState } from 'react'
import { create } from 'zustand'

// ---------------------------------------------------------------------------
// Approval store (global — populated by useRunWebSocket on human_input_required)
// ---------------------------------------------------------------------------

export interface PendingApproval {
  runId: string
  nodeId: string
  prompt: string
  agentName?: string
  agentRole?: string
  timeoutSeconds?: number
}

interface ApprovalStore {
  pending: PendingApproval | null
  setPending(p: PendingApproval): void
  clearPending(): void
}

export const useApprovalStore = create<ApprovalStore>()((set) => ({
  pending: null,
  setPending: (p) => set({ pending: p }),
  clearPending: () => set({ pending: null }),
}))

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

export function ApprovalModal() {
  const pending = useApprovalStore((s) => s.pending)
  const clearPending = useApprovalStore((s) => s.clearPending)

  const [response, setResponse] = useState('')
  const [countdown, setCountdown] = useState<number | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Start countdown when pending changes
  useEffect(() => {
    if (!pending) { setResponse(''); setCountdown(null); return }
    if (pending.timeoutSeconds) {
      setCountdown(pending.timeoutSeconds)
      intervalRef.current = setInterval(() => {
        setCountdown((c) => {
          if (c == null || c <= 1) {
            clearInterval(intervalRef.current!)
            handleReject()
            return 0
          }
          return c - 1
        })
      }, 1000)
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending?.runId, pending?.nodeId])

  if (!pending) return null

  async function handleApprove() {
    if (!response.trim()) return
    await fetch(`/api/runs/${pending!.runId}/approve/${pending!.nodeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response }),
    })
    clearPending()
  }

  async function handleReject() {
    await fetch(`/api/runs/${pending!.runId}/approve/${pending!.nodeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ response: null }),
    })
    clearPending()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60" onClick={handleReject} />

      {/* Modal */}
      <div className="relative bg-gray-800 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md mx-4 p-6">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-white">Human Approval Required</h2>
          {(pending.agentRole || pending.agentName) && (
            <p className="text-xs text-gray-400 mt-1">
              Requested by{' '}
              {pending.agentRole && <span className="text-yellow-400">{pending.agentRole}</span>}
              {pending.agentName && (
                <span className="text-gray-300"> — {pending.agentName}</span>
              )}
            </p>
          )}
          {countdown != null && (
            <p className="text-xs text-orange-400 mt-1">
              Auto-rejecting in {countdown}s
            </p>
          )}
        </div>

        {/* Prompt */}
        <div className="bg-gray-900 rounded p-3 mb-4 text-xs text-gray-300">
          {pending.prompt}
        </div>

        {/* Response textarea */}
        <textarea
          value={response}
          onChange={(e) => setResponse(e.target.value)}
          placeholder="Enter your response..."
          rows={4}
          className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-xs text-white resize-none focus:outline-none focus:border-blue-500 mb-4"
        />

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <button
            onClick={handleReject}
            className="text-xs px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={!response.trim()}
            className="text-xs px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
