// @plan B1-PR-1
// Custom React Flow edge types.
// These components receive all callbacks via React Flow props — no store imports.
import { memo, useState } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
} from '@xyflow/react'
import type { EdgeProps } from '@xyflow/react'

// ---------------------------------------------------------------------------
// DefaultEdge — animated dashed edge with a delete button on hover
// ---------------------------------------------------------------------------

export const DefaultEdge = memo(function DefaultEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const { deleteElements } = useReactFlow()

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  function handleDelete() {
    deleteElements({ edges: [{ id }] })
  }

  return (
    <>
      {/* Wide invisible hit area for easier hover detection */}
      <path
        d={edgePath}
        fill="none"
        strokeWidth={20}
        stroke="transparent"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          strokeDasharray: '5,5',
          animation: 'dashdraw 0.5s linear infinite',
          ...style,
        }}
        markerEnd={markerEnd}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="absolute pointer-events-all nodrag nopan"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              onClick={handleDelete}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs leading-none text-white hover:bg-red-600"
              title="Delete edge"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

// ---------------------------------------------------------------------------
// ConditionalEdge — distinct color per branch, branch label tooltip
// ---------------------------------------------------------------------------

const BRANCH_COLORS: Record<string, string> = {
  true: '#22c55e',
  false: '#ef4444',
  else: '#94a3b8',
}

function getBranchColor(branch?: string): string {
  if (!branch) return '#94a3b8'
  return BRANCH_COLORS[branch] ?? '#6366f1'
}

export const ConditionalEdge = memo(function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  label,
  data,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const branch = (data as { condition_branch?: string } | undefined)
    ?.condition_branch
  const color = getBranchColor(branch)
  const displayLabel = label ?? branch

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{ stroke: color, strokeWidth: 2, ...style }}
        markerEnd={markerEnd}
      />
      {displayLabel && (
        <EdgeLabelRenderer>
          <div
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
            className="absolute nodrag nopan pointer-events-none"
            title={String(displayLabel)}
          >
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {String(displayLabel)}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
})

// ---------------------------------------------------------------------------
// edgeTypes map — plug directly into React Flow's edgeTypes prop
// ---------------------------------------------------------------------------

export const edgeTypes = {
  default: DefaultEdge,
  conditional: ConditionalEdge,
} as const
