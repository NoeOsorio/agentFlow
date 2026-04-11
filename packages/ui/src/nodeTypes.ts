// @plan B2-PR-2
// Plug this into React Flow's nodeTypes prop:
//   import { nodeTypes } from '@agentflow/ui'
//   <ReactFlow nodeTypes={nodeTypes} ... />
import type { NodeTypes } from '@xyflow/react'
import { AgentPodNodeCard } from './nodes/AgentPodNodeCard'

export const nodeTypes: NodeTypes = {
  agent_pod: AgentPodNodeCard as NodeTypes[string],
}
