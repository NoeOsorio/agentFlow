// @plan B4-execution-viz
import { useState, useRef } from 'react'
import { useLogsStore } from '../../store/logsStore'
import type { LogEntry } from '../../store/logsStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function postApproval(
  runId: string,
  nodeId: string,
  approved: boolean,
  response: string,
): Promise<void> {
  await fetch(`/api/runs/${encodeURIComponent(runId)}/approve/${encodeURIComponent(nodeId)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ approved, response: response || undefined }),
  })
}

// ---------------------------------------------------------------------------
// ApprovalModal
// ---------------------------------------------------------------------------

export default function ApprovalModal() {
  const logs = useLogsStore((s) => s.logs)

  // Local set of handled log IDs — never mutates the store
  const handledRef = useRef<Set<string>>(new Set())
  const [, forceUpdate] = useState(0)

  const [responseText, setResponseText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Find latest unhandled approval_required entry
  const pending: LogEntry | undefined = [...logs]
    .reverse()
    .find(
      (l) =>
        l.status === 'approval_required' &&
        l.approvalRunId &&
        l.approvalNodeId &&
        !handledRef.current.has(l.id),
    )

  if (!pending) return null

  const { approvalRunId, approvalNodeId, agentName, agentRole, approvalPrompt } = pending

  const markHandled = () => {
    handledRef.current.add(pending.id)
    setResponseText('')
    setSubmitting(false)
    forceUpdate((n) => n + 1)
  }

  const handleApprove = async () => {
    if (!approvalRunId || !approvalNodeId) return
    setSubmitting(true)
    try {
      await postApproval(approvalRunId, approvalNodeId, true, responseText)
    } finally {
      markHandled()
    }
  }

  const handleReject = async () => {
    if (!approvalRunId || !approvalNodeId) return
    setSubmitting(true)
    try {
      await postApproval(approvalRunId, approvalNodeId, false, responseText)
    } finally {
      markHandled()
    }
  }

  return (
    /* Full-screen backdrop */
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* Modal card */}
      <div className="w-full max-w-lg rounded-xl bg-gray-900 p-6 shadow-2xl ring-1 ring-gray-700">
        {/* Header */}
        <div className="mb-4 flex items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-amber-500/20 text-amber-400">
            ⚠
          </span>
          <div>
            <h2 className="text-base font-semibold text-gray-100">Approval Required</h2>
            {(agentName ?? agentRole) && (
              <p className="mt-0.5 text-sm text-gray-400">
                {agentName && <span className="font-medium text-gray-300">{agentName}</span>}
                {agentRole && (
                  <span className="ml-1 text-gray-500">({agentRole})</span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Prompt */}
        {approvalPrompt && (
          <div className="mb-4 rounded-lg bg-gray-800 px-4 py-3 text-sm text-gray-200">
            {approvalPrompt}
          </div>
        )}

        {/* Timeout notice (informational — actual timeout managed server-side) */}
        <p className="mb-4 text-xs text-gray-500">
          Respond to unblock the pipeline. Leaving this unanswered may stall execution.
        </p>

        {/* Response textarea */}
        <textarea
          className="mb-4 w-full resize-none rounded-lg bg-gray-800 px-3 py-2 text-sm text-gray-100 placeholder-gray-500 ring-1 ring-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          rows={4}
          placeholder="Optional response or instructions…"
          value={responseText}
          onChange={(e) => setResponseText(e.target.value)}
          disabled={submitting}
        />

        {/* Action buttons */}
        <div className="flex justify-end gap-3">
          <button
            onClick={handleReject}
            disabled={submitting}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 transition-colors"
          >
            Reject
          </button>
          <button
            onClick={handleApprove}
            disabled={submitting}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-500 disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  )
}
