// @plan B1-PR-3
import { useCallback, useState } from 'react'
import { useReactFlow } from '@xyflow/react'
import dagre from 'dagre'
import { usePipelineStore } from '../../store/pipelineStore'

// Dagre layout constants
const NODE_WIDTH = 240
const NODE_HEIGHT = 80
const RANK_SEP = 60
const NODE_SEP = 40

function runDagreLayout(
  nodes: { id: string; position: { x: number; y: number } }[],
  edges: { source: string; target: string }[],
): Record<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({ rankdir: 'LR', ranksep: RANK_SEP, nodesep: NODE_SEP })

  for (const node of nodes) {
    g.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target)
  }

  dagre.layout(g)

  const positions: Record<string, { x: number; y: number }> = {}
  for (const node of nodes) {
    const { x, y } = g.node(node.id)
    positions[node.id] = { x: x - NODE_WIDTH / 2, y: y - NODE_HEIGHT / 2 }
  }
  return positions
}

export function CanvasToolbar() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()
  const [minimapVisible, setMinimapVisible] = useState(true)

  const nodes = usePipelineStore(s => s.nodes)
  const edges = usePipelineStore(s => s.edges)
  const canUndo = usePipelineStore(s => s.canUndo)
  const canRedo = usePipelineStore(s => s.canRedo)
  const undo = usePipelineStore(s => s.undo)
  const redo = usePipelineStore(s => s.redo)
  const setNodePositions = usePipelineStore(s => s.setNodePositions)

  const handleAutoLayout = useCallback(() => {
    const positions = runDagreLayout(nodes, edges)
    setNodePositions(positions)
    setTimeout(() => fitView({ duration: 400 }), 50)
  }, [nodes, edges, setNodePositions, fitView])

  const btnBase =
    'flex items-center justify-center w-8 h-8 rounded text-gray-300 hover:bg-gray-700 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed'

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 bg-gray-900 border border-gray-700 rounded-lg px-2 py-1 shadow-xl">
      {/* Zoom out */}
      <button
        className={btnBase}
        onClick={() => zoomOut({ duration: 200 })}
        title="Zoom out"
        aria-label="Zoom out"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      {/* Fit view */}
      <button
        className={btnBase}
        onClick={() => fitView({ duration: 300 })}
        title="Fit view (Space)"
        aria-label="Fit view"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 3 21 3 21 9" />
          <polyline points="9 21 3 21 3 15" />
          <line x1="21" y1="3" x2="14" y2="10" />
          <line x1="3" y1="21" x2="10" y2="14" />
        </svg>
      </button>

      {/* Zoom in */}
      <button
        className={btnBase}
        onClick={() => zoomIn({ duration: 200 })}
        title="Zoom in"
        aria-label="Zoom in"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Auto layout */}
      <button
        className={btnBase}
        onClick={handleAutoLayout}
        title="Auto layout (Dagre LR)"
        aria-label="Auto layout"
        disabled={nodes.length === 0}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="5" height="5" rx="1" />
          <rect x="3" y="16" width="5" height="5" rx="1" />
          <rect x="16" y="9" width="5" height="5" rx="1" />
          <line x1="8" y1="5.5" x2="16" y2="11.5" />
          <line x1="8" y1="18.5" x2="16" y2="13.5" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Undo */}
      <button
        className={btnBase}
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Cmd+Z)"
        aria-label="Undo"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="9 14 4 9 9 4" />
          <path d="M20 20v-7a4 4 0 0 0-4-4H4" />
        </svg>
      </button>

      {/* Redo */}
      <button
        className={btnBase}
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Cmd+Shift+Z)"
        aria-label="Redo"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="15 14 20 9 15 4" />
          <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
        </svg>
      </button>

      <div className="w-px h-6 bg-gray-700 mx-1" />

      {/* Toggle minimap */}
      <button
        className={`${btnBase} ${minimapVisible ? 'text-indigo-400' : ''}`}
        onClick={() => setMinimapVisible(v => !v)}
        title="Toggle minimap"
        aria-label="Toggle minimap"
        aria-pressed={minimapVisible}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <rect x="7" y="7" width="4" height="4" fill="currentColor" stroke="none" />
        </svg>
      </button>

      {/* Export minimap visibility via data attr so CanvasEditor can read it */}
      <span data-minimap-visible={minimapVisible ? 'true' : 'false'} className="hidden" />
    </div>
  )
}
