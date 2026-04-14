/**
 * @module nodes/BaseNodeCard
 * @plan B2-PR-1
 * @provides BaseNodeCard
 * @depends_on nodes/types BaseNodeCardProps NodeRunStatus
 */
import type { ReactElement } from 'react'
import type { BaseNodeCardProps, NodeRunStatus } from './types'
import { NODE_COLORS } from './colors'

// ---------------------------------------------------------------------------
// Internal: run-status dot (top-right indicator)
// ---------------------------------------------------------------------------

function RunStatusDot({ status }: { status: NodeRunStatus }) {
  const dotClass: Record<NodeRunStatus, string> = {
    idle: 'bg-gray-600',
    running: 'bg-yellow-400 animate-pulse',
    completed: 'bg-green-500',
    failed: 'bg-red-500',
    skipped: 'bg-gray-500',
  }

  return (
    <span
      className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${dotClass[status]}`}
      aria-hidden="true"
    />
  )
}

// ---------------------------------------------------------------------------
// Internal: run-status icon (shown alongside the dot)
// ---------------------------------------------------------------------------

function RunStatusIcon({
  status,
  error,
}: {
  status: NodeRunStatus
  error?: string
}) {
  if (status === 'idle') return null

  const iconMap: Partial<Record<NodeRunStatus, ReactElement>> = {
    running: (
      <span className="text-yellow-400 text-xs leading-none animate-spin inline-block">
        ⟳
      </span>
    ),
    completed: (
      <span className="text-green-500 text-xs leading-none">✓</span>
    ),
    failed: (
      <span className="text-red-500 text-xs leading-none" title={error}>
        ✗
      </span>
    ),
    skipped: (
      <span className="text-gray-500 text-xs leading-none">—</span>
    ),
  }

  return <>{iconMap[status] ?? null}</>
}

// ---------------------------------------------------------------------------
// Internal: compute ring + animation classes
// ---------------------------------------------------------------------------

function containerClasses(
  runStatus: NodeRunStatus,
  selected: boolean,
): string {
  if (runStatus === 'running') return 'ring-2 ring-yellow-400 animate-pulse'
  if (runStatus === 'completed') return 'ring-2 ring-green-500'
  if (runStatus === 'failed') return 'ring-2 ring-red-500'
  if (selected) return 'ring-2 ring-blue-500'
  return ''
}

// ---------------------------------------------------------------------------
// BaseNodeCard
// ---------------------------------------------------------------------------

/**
 * Shared visual anatomy for every AgentFlow canvas node.
 *
 * Renders a fixed-width (240 px) dark card with:
 * - A left color-accent bar driven by `accentColor` (falls back to NODE_COLORS[type])
 * - An optional emoji/text icon and a truncated label
 * - A run-status dot + icon in the top-right corner
 * - An animated ring overlay that reflects execution state
 * - A `children` slot for node-type-specific content
 *
 * Run-status styles:
 * - `idle`      → no ring, muted dot
 * - `running`   → yellow ring + pulse animation + spinner
 * - `completed` → green ring + ✓
 * - `failed`    → red ring + ✗ (hover shows error message)
 * - `skipped`   → 50% opacity + grey dash
 */
export function BaseNodeCard({
  type,
  label,
  icon,
  accentColor,
  runStatus = 'idle',
  runError,
  agentName,
  agentRole,
  tokensUsed,
  selected = false,
  children,
}: BaseNodeCardProps) {
  const resolvedAccent = accentColor ?? NODE_COLORS[type] ?? '#6b7280'
  const skippedClass = runStatus === 'skipped' ? 'opacity-50' : ''
  const ring = containerClasses(runStatus, selected)

  const errorTitle = [runError, agentName ? `Agent: ${agentName}` : '']
    .filter(Boolean)
    .join(' | ')

  return (
    <div
      className={[
        'w-[240px] rounded-lg bg-gray-800 border border-gray-700 shadow-lg overflow-hidden',
        ring,
        skippedClass,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {/* Header row: accent bar + icon + label + status indicators */}
      <div
        className="flex items-center gap-2 px-3 py-2"
        style={{ borderLeft: `3px solid ${resolvedAccent}` }}
      >
        {icon && (
          <span className="text-base leading-none flex-shrink-0" aria-hidden="true">
            {icon}
          </span>
        )}

        <span className="flex-1 text-sm font-medium text-white truncate">
          {label}
        </span>

        <div className="flex items-center gap-1 flex-shrink-0">
          <RunStatusDot status={runStatus} />
          <RunStatusIcon status={runStatus} error={errorTitle || runError} />
        </div>
      </div>

      {/* Agent identity overlay — shown during/after execution */}
      {runStatus === 'running' && agentRole && (
        <div className="px-3 py-1 text-xs text-yellow-400 italic border-t border-gray-700/50">
          {agentRole} is thinking...
        </div>
      )}
      {runStatus === 'completed' && agentRole && tokensUsed != null && (
        <div className="px-3 py-1 text-xs text-green-400 border-t border-gray-700/50">
          ✓ {agentRole} — {tokensUsed.toLocaleString()} tokens
        </div>
      )}

      {/* Node-type-specific body */}
      {children && (
        <div className="px-3 py-2 border-t border-gray-700 text-xs text-gray-300">
          {children}
        </div>
      )}
    </div>
  )
}
