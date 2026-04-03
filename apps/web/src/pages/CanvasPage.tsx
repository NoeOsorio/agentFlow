import { useCallback } from 'react'
import { ReactFlow, Background, Controls, MiniMap, addEdge, useNodesState, useEdgesState } from '@xyflow/react'
import type { Connection } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

const initialNodes = [
  {
    id: 'trigger',
    type: 'input',
    data: { label: 'Trigger' },
    position: { x: 250, y: 50 },
  },
  {
    id: 'agent-1',
    data: { label: 'Agent: research' },
    position: { x: 250, y: 180 },
  },
]

const initialEdges = [
  { id: 'e-trigger-1', source: 'trigger', target: 'agent-1', animated: true },
]

export default function CanvasPage() {
  const [nodes, , onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onConnect = useCallback(
    (connection: Connection) => setEdges((eds) => addEdge(connection, eds)),
    [setEdges]
  )

  return (
    <div className="w-screen h-screen bg-gray-950">
      <div className="absolute top-4 left-4 z-10 text-white">
        <h1 className="text-lg font-semibold">AgentFlow Canvas</h1>
        <p className="text-xs text-gray-400">New Pipeline</p>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        fitView
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  )
}
