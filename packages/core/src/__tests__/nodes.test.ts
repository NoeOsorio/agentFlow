import { describe, it, expect } from 'vitest'
import {
  StartNodeSchema,
  EndNodeSchema,
  LLMNodeSchema,
  AgentPodNodeSchema,
  CodeNodeSchema,
  HTTPNodeSchema,
  IfElseNodeSchema,
  TemplateNodeSchema,
  VariableAssignerNodeSchema,
  VariableAggregatorNodeSchema,
  IterationNodeSchema,
  HumanInputNodeSchema,
  KnowledgeRetrievalNodeSchema,
  SubWorkflowNodeSchema,
  NodeSchema,
  PipelineEdgeSchema,
} from '../schema/nodes'

// Shared test helpers
const varRef = { node_id: 'start', variable: 'input' }
const varDef = { key: 'result', type: 'string' as const }
const modelConfig = { provider: 'anthropic' as const, model_id: 'claude-3-5-sonnet-20241022' }
const agentRef = { name: 'alice' }
const conditionGroup = {
  logic: 'and' as const,
  conditions: [
    { left: varRef, operator: 'eq' as const, right: { literal: 'yes' }, branch_id: 'branch_true' },
  ],
  branch_id: 'branch_true',
}

describe('StartNodeSchema', () => {
  it('validates happy path', () => {
    const result = StartNodeSchema.safeParse({
      id: 'start',
      type: 'start',
      outputs: [varDef],
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional label', () => {
    const result = StartNodeSchema.safeParse({
      id: 'start',
      type: 'start',
      label: 'Begin',
      outputs: [],
    })
    expect(result.success).toBe(true)
  })
})

describe('EndNodeSchema', () => {
  it('validates happy path', () => {
    const result = EndNodeSchema.safeParse({
      id: 'end',
      type: 'end',
      inputs: [varRef],
    })
    expect(result.success).toBe(true)
  })
})

describe('LLMNodeSchema', () => {
  it('validates happy path', () => {
    const result = LLMNodeSchema.safeParse({
      id: 'llm_1',
      type: 'llm',
      model: modelConfig,
      prompt: { user: 'Say hello' },
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional agent_ref and output_schema', () => {
    const result = LLMNodeSchema.safeParse({
      id: 'llm_1',
      type: 'llm',
      model: modelConfig,
      prompt: { system: 'You are helpful', user: 'Hello' },
      agent_ref: agentRef,
      output_schema: { type: 'object' },
    })
    expect(result.success).toBe(true)
  })
})

describe('AgentPodNodeSchema', () => {
  it('validates happy path', () => {
    const result = AgentPodNodeSchema.safeParse({
      id: 'pod_1',
      type: 'agent_pod',
      agent_ref: agentRef,
      instruction: 'Do the work',
    })
    expect(result.success).toBe(true)
  })

  it('requires agent_ref', () => {
    const result = AgentPodNodeSchema.safeParse({
      id: 'pod_1',
      type: 'agent_pod',
      instruction: 'Do the work',
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional inputs and resource', () => {
    const result = AgentPodNodeSchema.safeParse({
      id: 'pod_1',
      type: 'agent_pod',
      agent_ref: agentRef,
      instruction: 'Process {{#start.input#}}',
      inputs: { context: varRef },
      resource: { tokens: 4096, timeout: '30s' },
    })
    expect(result.success).toBe(true)
  })
})

describe('CodeNodeSchema', () => {
  it('validates happy path', () => {
    const result = CodeNodeSchema.safeParse({
      id: 'code_1',
      type: 'code',
      language: 'python',
      code: 'print("hello")',
      inputs: [varRef],
      outputs: [varDef],
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown language', () => {
    const result = CodeNodeSchema.safeParse({
      id: 'code_1',
      type: 'code',
      language: 'ruby',
      code: 'puts "hello"',
      inputs: [],
      outputs: [],
    })
    expect(result.success).toBe(false)
  })
})

describe('HTTPNodeSchema', () => {
  it('validates happy path', () => {
    const result = HTTPNodeSchema.safeParse({
      id: 'http_1',
      type: 'http',
      method: 'GET',
      url: 'https://api.example.com/data',
    })
    expect(result.success).toBe(true)
  })

  it('accepts POST with body and headers', () => {
    const result = HTTPNodeSchema.safeParse({
      id: 'http_1',
      type: 'http',
      method: 'POST',
      url: 'https://api.example.com/submit',
      headers: { 'Content-Type': 'application/json' },
      body: { key: 'value' },
      timeout_ms: 5000,
    })
    expect(result.success).toBe(true)
  })
})

describe('IfElseNodeSchema', () => {
  it('validates happy path', () => {
    const result = IfElseNodeSchema.safeParse({
      id: 'if_1',
      type: 'if_else',
      conditions: [conditionGroup],
      default_branch: 'branch_false',
    })
    expect(result.success).toBe(true)
  })

  it('requires at least one condition group', () => {
    const result = IfElseNodeSchema.safeParse({
      id: 'if_1',
      type: 'if_else',
      conditions: [],
      default_branch: 'branch_false',
    })
    expect(result.success).toBe(false)
  })
})

describe('TemplateNodeSchema', () => {
  it('validates happy path', () => {
    const result = TemplateNodeSchema.safeParse({
      id: 'tmpl_1',
      type: 'template',
      template: 'Hello, {{#start.name#}}!',
      inputs: [varRef],
    })
    expect(result.success).toBe(true)
  })
})

describe('VariableAssignerNodeSchema', () => {
  it('validates happy path with literal value', () => {
    const result = VariableAssignerNodeSchema.safeParse({
      id: 'assign_1',
      type: 'variable_assigner',
      assignments: [{ key: 'status', value: { literal: 'active' } }],
    })
    expect(result.success).toBe(true)
  })

  it('validates with variable reference value', () => {
    const result = VariableAssignerNodeSchema.safeParse({
      id: 'assign_1',
      type: 'variable_assigner',
      assignments: [{ key: 'output', value: varRef }],
    })
    expect(result.success).toBe(true)
  })
})

describe('VariableAggregatorNodeSchema', () => {
  it('validates happy path', () => {
    const result = VariableAggregatorNodeSchema.safeParse({
      id: 'agg_1',
      type: 'variable_aggregator',
      branches: ['branch_true', 'branch_false'],
      output_key: 'result',
      strategy: 'first',
    })
    expect(result.success).toBe(true)
  })

  it('rejects unknown strategy', () => {
    const result = VariableAggregatorNodeSchema.safeParse({
      id: 'agg_1',
      type: 'variable_aggregator',
      branches: ['a'],
      output_key: 'result',
      strategy: 'concat',
    })
    expect(result.success).toBe(false)
  })
})

describe('IterationNodeSchema', () => {
  it('validates happy path', () => {
    const result = IterationNodeSchema.safeParse({
      id: 'iter_1',
      type: 'iteration',
      input_list: varRef,
      iterator_var: 'item',
      body_nodes: ['process_1'],
    })
    expect(result.success).toBe(true)
  })
})

describe('HumanInputNodeSchema', () => {
  it('validates happy path', () => {
    const result = HumanInputNodeSchema.safeParse({
      id: 'human_1',
      type: 'human_input',
      prompt: 'Please review and approve',
      fallback: 'fail',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional timeout_seconds', () => {
    const result = HumanInputNodeSchema.safeParse({
      id: 'human_1',
      type: 'human_input',
      prompt: 'Approve?',
      timeout_seconds: 3600,
      fallback: 'skip',
    })
    expect(result.success).toBe(true)
  })
})

describe('KnowledgeRetrievalNodeSchema', () => {
  it('validates happy path', () => {
    const result = KnowledgeRetrievalNodeSchema.safeParse({
      id: 'kb_1',
      type: 'knowledge_retrieval',
      query: varRef,
      knowledge_base_id: 'kb-docs-001',
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional top_k', () => {
    const result = KnowledgeRetrievalNodeSchema.safeParse({
      id: 'kb_1',
      type: 'knowledge_retrieval',
      query: varRef,
      knowledge_base_id: 'kb-docs-001',
      top_k: 5,
    })
    expect(result.success).toBe(true)
  })
})

describe('SubWorkflowNodeSchema', () => {
  it('validates happy path', () => {
    const result = SubWorkflowNodeSchema.safeParse({
      id: 'sub_1',
      type: 'sub_workflow',
      pipeline_ref: { name: 'onboarding-pipeline' },
      inputs: { user_id: varRef },
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional namespace in pipeline_ref', () => {
    const result = SubWorkflowNodeSchema.safeParse({
      id: 'sub_1',
      type: 'sub_workflow',
      pipeline_ref: { name: 'onboarding-pipeline', namespace: 'prod' },
      inputs: {},
    })
    expect(result.success).toBe(true)
  })
})

describe('NodeSchema (discriminated union)', () => {
  it('rejects unknown type', () => {
    const result = NodeSchema.safeParse({
      id: 'x',
      type: 'unknown_type',
    })
    expect(result.success).toBe(false)
  })

  it('correctly identifies start node', () => {
    const result = NodeSchema.safeParse({
      id: 'start',
      type: 'start',
      outputs: [],
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.type).toBe('start')
    }
  })

  it('correctly identifies agent_pod node', () => {
    const result = NodeSchema.safeParse({
      id: 'pod',
      type: 'agent_pod',
      agent_ref: agentRef,
      instruction: 'work',
    })
    expect(result.success).toBe(true)
  })
})

describe('PipelineEdgeSchema', () => {
  it('validates happy path', () => {
    const result = PipelineEdgeSchema.safeParse({
      id: 'e1',
      source: 'start',
      target: 'llm_1',
    })
    expect(result.success).toBe(true)
  })

  it('validates conditional edge with source_handle', () => {
    const result = PipelineEdgeSchema.safeParse({
      id: 'e2',
      source: 'if_1',
      target: 'process_a',
      source_handle: 'branch_true',
      condition_branch: 'branch_true',
    })
    expect(result.success).toBe(true)
  })

  it('requires id, source, and target', () => {
    const result = PipelineEdgeSchema.safeParse({
      source: 'start',
      target: 'end',
    })
    expect(result.success).toBe(false)
  })
})
