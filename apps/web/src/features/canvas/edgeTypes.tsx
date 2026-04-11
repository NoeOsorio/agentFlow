// @plan B1-PR-1
// Custom edge types for the AgentFlow canvas.
// Does NOT import from stores — receives data via React Flow edge props.
import { useState, useCallback } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useReactFlow,
  type EdgeProps,
  type EdgeTypes,
} from '@xyflow/react'

// ---------------------------------------------------------------------------
// Branch color map for ConditionalEdge
// ---------------------------------------------------------------------------

const BRANCH_COLORS: Record<string, string> = {
  true: '#22c55e',
  false: '#ef4444',
  default: '#a855f7',
}

function branchColor(branch: string | undefined): string {
  if (!branch) return '#6b7280'
  return BRANCH_COLORS[branch] ?? '#6b7280'
}

// ---------------------------------------------------------------------------
// DefaultEdge — animated with delete button on hover
// ---------------------------------------------------------------------------

export function DefaultEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  markerEnd,
  style,
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

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteElements({ edges: [{ id }] })
    },
    [id, deleteElements],
  )

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          strokeWidth: 2,
          stroke: '#6b7280',
          strokeDasharray: '5 3',
          animation: 'dashdraw 0.5s linear infinite',
          ...style,
        }}
        interactionWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      {hovered && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              aria-label="Delete edge"
              onClick={handleDelete}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
            >
              ×
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// ConditionalEdge — per-branch color + label tooltip
// ---------------------------------------------------------------------------

export function ConditionalEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  markerEnd,
  style,
  label,
}: EdgeProps) {
  const [hovered, setHovered] = useState(false)
  const { deleteElements } = useReactFlow()

  const branch = (data as { condition_branch?: string } | undefined)?.condition_branch
  const color = branchColor(branch)

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const handleDelete = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      deleteElements({ edges: [{ id }] })
    },
    [id, deleteElements],
  )

  const displayLabel = label ?? branch

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{ strokeWidth: 2, stroke: color, ...style }}
        interactionWidth={20}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      />
      <EdgeLabelRenderer>
        <div
          className="nodrag nopan"
          style={{
            position: 'absolute',
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
        >
          {displayLabel && (
            <span
              className="rounded px-1.5 py-0.5 text-xs font-medium text-white"
              style={{ backgroundColor: color }}
              title={String(displayLabel)}
            >
              {String(displayLabel)}
            </span>
          )}
          {hovered && (
            <button
              aria-label="Delete edge"
              onClick={handleDelete}
              className="ml-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-xs text-white hover:bg-red-600"
            >
              ×
            </button>
          )}
        </div>
      </EdgeLabelRenderer>
    </>
  )
}

// ---------------------------------------------------------------------------
// Edge types map — plug into <ReactFlow edgeTypes={edgeTypes} />
// ---------------------------------------------------------------------------

export const edgeTypes: EdgeTypes = {
  default: DefaultEdge as EdgeTypes[string],
  conditional: ConditionalEdge as EdgeTypes[string],
}
