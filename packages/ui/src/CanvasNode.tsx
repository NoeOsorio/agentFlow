import type { NodeProps } from '@xyflow/react'

/**
 * CanvasNode — placeholder AgentFlow canvas node.
 * Will be replaced with full implementation in Phase 5 (canvas UI).
 */
export function CanvasNode({ data }: NodeProps) {
  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white shadow-md">
      {String(data?.label ?? 'Agent')}
    </div>
  )
}
