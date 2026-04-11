// @plan B2-PR-4
// Plug this into React Flow's nodeTypes prop:
//   import { nodeTypes } from '@agentflow/ui'
//   <ReactFlow nodeTypes={nodeTypes} ... />
import type { NodeTypes } from '@xyflow/react'
import { AgentPodNodeCard } from './nodes/AgentPodNodeCard'
import { StartNodeCard } from './nodes/StartNodeCard'
import { EndNodeCard } from './nodes/EndNodeCard'
import { LLMNodeCard } from './nodes/LLMNodeCard'
import { CodeNodeCard } from './nodes/CodeNodeCard'
import { HTTPNodeCard } from './nodes/HTTPNodeCard'
import { IfElseNodeCard } from './nodes/IfElseNodeCard'
import { TemplateNodeCard } from './nodes/TemplateNodeCard'
import { VariableAssignerCard } from './nodes/VariableAssignerCard'
import { VariableAggregatorCard } from './nodes/VariableAggregatorCard'
import { IterationNodeCard } from './nodes/IterationNodeCard'
import { HumanInputCard } from './nodes/HumanInputCard'
import { KnowledgeRetrievalNodeCard } from './nodes/KnowledgeRetrievalNodeCard'
import { SubWorkflowCard } from './nodes/SubWorkflowCard'

// All 14 node types
export const nodeTypes: NodeTypes = {
  start: StartNodeCard as NodeTypes[string],
  end: EndNodeCard as NodeTypes[string],
  llm: LLMNodeCard as NodeTypes[string],
  agent_pod: AgentPodNodeCard as NodeTypes[string],
  code: CodeNodeCard as NodeTypes[string],
  http: HTTPNodeCard as NodeTypes[string],
  if_else: IfElseNodeCard as NodeTypes[string],
  template: TemplateNodeCard as NodeTypes[string],
  variable_assigner: VariableAssignerCard as NodeTypes[string],
  variable_aggregator: VariableAggregatorCard as NodeTypes[string],
  iteration: IterationNodeCard as NodeTypes[string],
  human_input: HumanInputCard as NodeTypes[string],
  knowledge_retrieval: KnowledgeRetrievalNodeCard as NodeTypes[string],
  sub_workflow: SubWorkflowCard as NodeTypes[string],
}
