// @plan B2-PR-4
// Plug into ConfigPanel:
//   import { nodeConfigForms } from '@agentflow/ui'
//   const Form = nodeConfigForms[selectedNode.type]
//   if (Form) <Form value={nodeData} onChange={update} ... />
import type { ComponentType } from 'react'
import { AgentPodForm } from './forms/AgentPodForm'
import { LLMNodeForm } from './forms/LLMNodeForm'
import { CodeNodeForm } from './forms/CodeNodeForm'
import { HTTPNodeForm } from './forms/HTTPNodeForm'
import { IfElseNodeForm } from './forms/IfElseNodeForm'
import { TemplateNodeForm } from './forms/TemplateNodeForm'
import { VariableAssignerForm } from './forms/VariableAssignerForm'
import { VariableAggregatorForm } from './forms/VariableAggregatorForm'
import { IterationNodeForm } from './forms/IterationNodeForm'
import { HumanInputForm } from './forms/HumanInputForm'
import { StartNodeForm } from './forms/StartNodeForm'
import { SubWorkflowForm } from './forms/SubWorkflowForm'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const nodeConfigForms: Record<string, ComponentType<any>> = {
  agent_pod: AgentPodForm,
  llm: LLMNodeForm,
  code: CodeNodeForm,
  http: HTTPNodeForm,
  if_else: IfElseNodeForm,
  template: TemplateNodeForm,
  variable_assigner: VariableAssignerForm,
  variable_aggregator: VariableAggregatorForm,
  iteration: IterationNodeForm,
  human_input: HumanInputForm,
  start: StartNodeForm,
  sub_workflow: SubWorkflowForm,
}
