export { CanvasNode } from './CanvasNode'

// B2-PR-1: Base node card infrastructure
export { BaseNodeCard } from './nodes/BaseNodeCard'
export { NodeHandle } from './nodes/NodeHandle'
export { NODE_COLORS } from './nodes/colors'
export type { NodeRunStatus, NodeRunState, NodeType, BaseNodeCardProps } from './nodes/types'

// B2-PR-2: AgentPod node + BudgetBar
export { AgentPodNodeCard } from './nodes/AgentPodNodeCard'
export type { AgentPodNodeData } from './nodes/AgentPodNodeCard'
export { BudgetBar } from './nodes/BudgetBar'

// B2-PR-2: AgentSelector widget
export { AgentSelector } from './forms/widgets/AgentSelector'

// nodeTypes map — plug directly into React Flow's nodeTypes prop
export { nodeTypes } from './nodeTypes'
