// @plan B1-PR-2
// Main canvas editor — integrates React Flow with PipelineStore.
// Handles drag-and-drop from NodePalette, connection validation, and node selection.
import { useCallback } from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  useReactFlow,
  type Connection,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type IsValidConnection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { usePipelineStore } from '../../store/pipelineStore'
import { nodeTypes } from './nodeTypes'
import { edgeTypes } from './edgeTypes'
import type { PipelineNode } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Connection validation (exported so it can be unit-tested in isolation)
// ---------------------------------------------------------------------------

export function validateConnection(
  connection: Connection | Edge,
  nodes: { id: string; data: { type: string } }[],
): boolean {
  const sourceNode = nodes.find(n => n.id === connection.source)
  const targetNode = nodes.find(n => n.id === connection.target)

  if (!sourceNode || !targetNode) return false

  // Start node cannot be a connection target (it has no inputs)
  if (targetNode.data.type === 'start') return false

  // End node cannot be a connection source (it has no outputs)
  if (sourceNode.data.type === 'end') return false

  // if_else source edges must carry a branch handle label
  if (sourceNode.data.type === 'if_else' && !connection.sourceHandle) return false

  return true
}

// ---------------------------------------------------------------------------
// CanvasEditorInner — must be inside ReactFlowProvider to use useReactFlow()
// ---------------------------------------------------------------------------

function CanvasEditorInner() {
  const { screenToFlowPosition } = useReactFlow()

  const nodes = usePipelineStore(s => s.nodes)
  const edges = usePipelineStore(s => s.edges)
  const viewport = usePipelineStore(s => s.viewport)
  const addNode = usePipelineStore(s => s.addNode)
  const updateNodeConfig = usePipelineStore(s => s.updateNodeConfig)
  const deleteEdge = usePipelineStore(s => s.deleteEdge)
  const updateNodePositions = usePipelineStore(s => s.updateNodePositions)
  const addEdge = usePipelineStore(s => s.addEdge)
  const selectNode = usePipelineStore(s => s.selectNode)
  const deselectNode = usePipelineStore(s => s.deselectNode)
  const setViewport = usePipelineStore(s => s.setViewport)

  // ---- Edge changes -------------------------------------------------------

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      for (const change of changes) {
        if (change.type === 'remove') {
          deleteEdge(change.id)
        }
      }
    },
    [deleteEdge],
  )

  // ---- Connection validation -----------------------------------------------

  const isValidConnection: IsValidConnection = useCallback(
    (connection: Connection | Edge) => validateConnection(connection, nodes),
    [nodes],
  )

  // ---- Node change (position updates) -------------------------------------

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      updateNodePositions(changes)
    },
    [updateNodePositions],
  )

  // ---- Node selection -----------------------------------------------------

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: { id: string }) => {
      selectNode(node.id)
    },
    [selectNode],
  )

  const onPaneClick = useCallback(() => {
    deselectNode()
  }, [deselectNode])

  // ---- Viewport -----------------------------------------------------------

  const onViewportChange = useCallback(
    (vp: { x: number; y: number; zoom: number }) => {
      setViewport(vp)
    },
    [setViewport],
  )

  // ---- Drag-and-drop from NodePalette ------------------------------------

  const onDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
  }, [])

  const onDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()

      const nodeType = event.dataTransfer.getData('node-type')
      const agentName = event.dataTransfer.getData('agent-name')

      if (!nodeType) return

      const position = screenToFlowPosition({ x: event.clientX, y: event.clientY })

      // Capture existing IDs before adding so we can find the new node
      const prevIds = new Set(usePipelineStore.getState().nodes.map(n => n.id))

      addNode(nodeType, position)

      // If an agent was dragged, patch agent_ref on the newly-created node
      if (agentName) {
        const newNode = usePipelineStore.getState().nodes.find(n => !prevIds.has(n.id))
        if (newNode) {
          updateNodeConfig(newNode.id, {
            agent_ref: { name: agentName },
          } as Partial<PipelineNode>)
        }
      }
    },
    [screenToFlowPosition, addNode, updateNodeConfig],
  )

  // ---- Connect ------------------------------------------------------------

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!validateConnection(connection as Connection | Edge, nodes)) return
      addEdge(connection)
    },
    [nodes, addEdge],
  )

  return (
    <div
      className="h-full w-full"
      onDrop={onDrop}
      onDragOver={onDragOver}
      data-testid="canvas-editor"
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onPaneClick={onPaneClick}
        onViewportChange={onViewportChange}
        isValidConnection={isValidConnection}
        defaultViewport={viewport}
        snapToGrid
        snapGrid={[16, 16]}
        fitView={nodes.length === 0}
      >
        <Background />
        <Controls />
        <MiniMap
          nodeColor="#374151"
          maskColor="rgba(0,0,0,0.3)"
        />
        {/* CanvasToolbar mounts here in B1-PR-3 */}
      </ReactFlow>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CanvasEditor — wraps inner component with ReactFlowProvider
// ---------------------------------------------------------------------------

export function CanvasEditor() {
  return (
    <ReactFlowProvider>
      <CanvasEditorInner />
    </ReactFlowProvider>
  )
}
