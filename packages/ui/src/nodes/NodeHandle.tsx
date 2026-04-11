/**
 * @module nodes/NodeHandle
 * @plan B2-PR-1
 * @provides NodeHandle
 * @depends_on @xyflow/react Handle, Position
 */
import type React from 'react'
import { Handle, Position } from '@xyflow/react'

interface NodeHandleProps {
  type: 'source' | 'target'
  /** Handle id — required when a node exposes multiple handles of the same type */
  id?: string
  /** Label shown next to a conditional/named handle */
  label?: string
  /** Override default position (source→Right, target→Left) */
  position?: Position
  /** Inline style overrides (e.g. top offset for multi-handle nodes) */
  style?: React.CSSProperties
}

/**
 * Thin wrapper around @xyflow/react Handle with AgentFlow visual defaults.
 *
 * - `target` (input): left side, black dot + white border
 * - `source` (output): right side, white dot + gray border
 * - Conditional handle: same as source but renders a branch-name label
 */
export function NodeHandle({ type, id, label, position, style }: NodeHandleProps) {
  const isSource = type === 'source'
  const resolvedPosition = position ?? (isSource ? Position.Right : Position.Left)

  const handleClass = isSource
    ? 'w-3 h-3 !bg-white !border-2 !border-gray-400 rounded-full'
    : 'w-3 h-3 !bg-black !border-2 !border-white rounded-full'

  return (
    <div className="relative" style={style}>
      {label && (
        <span
          className={`absolute top-1/2 -translate-y-1/2 text-[10px] text-gray-400 whitespace-nowrap pointer-events-none ${
            isSource ? 'right-4' : 'left-4'
          }`}
        >
          {label}
        </span>
      )}
      <Handle
        type={type}
        position={resolvedPosition}
        id={id}
        className={handleClass}
      />
    </div>
  )
}
