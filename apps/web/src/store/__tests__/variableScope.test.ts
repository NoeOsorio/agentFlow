/**
 * @plan B3-PR-4
 * Tests for computeVariableScope — pure function, no store dependencies.
 */

import { describe, it, expect } from 'vitest'
import { computeVariableScope } from '../variableScope'
import type { AvailableVariable } from '../variableScope'
import type { PipelineNode } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

function node(id: string, data: PipelineNode) {
  return { id, data }
}

function edge(source: string, target: string) {
  return { source, target }
}

// ---------------------------------------------------------------------------
// Node fixtures
// ---------------------------------------------------------------------------

const startNode = node('start_1', {
  type: 'start',
  id: 'start_1',
  outputs: [
    { key: 'user_input', type: 'string', description: 'User input text' },
    { key: 'payload', type: 'object' },
  ],
})

const agentA = node('agent_a', {
  type: 'agent_pod',
  id: 'agent_a',
  agent_ref: { name: 'alice' },
  instruction: 'Do task A',
})

const agentB = node('agent_b', {
  type: 'agent_pod',
  id: 'agent_b',
  agent_ref: { name: 'bob' },
  instruction: 'Do task B',
})

const llmNode = node('llm_1', {
  type: 'llm',
  id: 'llm_1',
  model: { provider: 'openai', model_id: 'gpt-4o' },
  prompt: { system: 'You are helpful.', user: 'Hello' },
})

const httpNode = node('http_1', {
  type: 'http',
  id: 'http_1',
  method: 'GET',
  url: 'https://example.com/api',
})

const templateNode = node('tmpl_1', {
  type: 'template',
  id: 'tmpl_1',
  template: 'Hello {{name}}',
  inputs: [],
})

const codeNode = node('code_1', {
  type: 'code',
  id: 'code_1',
  language: 'python',
  code: 'result = x + y',
  inputs: [],
  outputs: [
    { key: 'sum', type: 'number' },
    { key: 'log', type: 'string' },
  ],
})

const endNode = node('end_1', {
  type: 'end',
  id: 'end_1',
  inputs: [],
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeVariableScope', () => {
  it('returns empty array when forNodeId is not in graph', () => {
    const result = computeVariableScope([startNode], [], 'nonexistent')
    expect(result).toEqual([])
  })

  it('returns empty array for a node with no ancestors', () => {
    const result = computeVariableScope([startNode, agentA], [edge('start_1', 'agent_a')], 'start_1')
    expect(result).toEqual([])
  })

  it('agent_pod outputs include response, agent_name, agent_role', () => {
    const nodes = [startNode, agentA, endNode]
    const edges = [edge('start_1', 'agent_a'), edge('agent_a', 'end_1')]
    const result = computeVariableScope(nodes, edges, 'end_1')

    const agentVars = result.filter((v: AvailableVariable) => v.node_id === 'agent_a')
    const variables = agentVars.map((v: AvailableVariable) => v.variable)

    expect(variables).toContain('response')
    expect(variables).toContain('agent_name')
    expect(variables).toContain('agent_role')
  })

  it('llm outputs include text and tokens_used', () => {
    const nodes = [startNode, llmNode, endNode]
    const edges = [edge('start_1', 'llm_1'), edge('llm_1', 'end_1')]
    const result = computeVariableScope(nodes, edges, 'end_1')

    const llmVars = result.filter((v: AvailableVariable) => v.node_id === 'llm_1')
    const variables = llmVars.map((v: AvailableVariable) => v.variable)

    expect(variables).toContain('text')
    expect(variables).toContain('tokens_used')
  })

  it('http outputs include status_code, body, and headers', () => {
    const nodes = [startNode, httpNode, endNode]
    const edges = [edge('start_1', 'http_1'), edge('http_1', 'end_1')]
    const result = computeVariableScope(nodes, edges, 'end_1')

    const httpVars = result.filter((v: AvailableVariable) => v.node_id === 'http_1')
    const variables = httpVars.map((v: AvailableVariable) => v.variable)

    expect(variables).toContain('status_code')
    expect(variables).toContain('body')
    expect(variables).toContain('headers')
  })

  it('template outputs include text', () => {
    const nodes = [startNode, templateNode, endNode]
    const edges = [edge('start_1', 'tmpl_1'), edge('tmpl_1', 'end_1')]
    const result = computeVariableScope(nodes, edges, 'end_1')

    const tmplVars = result.filter((v: AvailableVariable) => v.node_id === 'tmpl_1')
    expect(tmplVars.map((v: AvailableVariable) => v.variable)).toContain('text')
  })

  it('code outputs are derived from the node outputs array', () => {
    const nodes = [startNode, codeNode, endNode]
    const edges = [edge('start_1', 'code_1'), edge('code_1', 'end_1')]
    const result = computeVariableScope(nodes, edges, 'end_1')

    const codeVars = result.filter((v: AvailableVariable) => v.node_id === 'code_1')
    const variables = codeVars.map((v: AvailableVariable) => v.variable)

    expect(variables).toContain('sum')
    expect(variables).toContain('log')
  })

  it('start node outputs are derived from its declared outputs array', () => {
    const nodes = [startNode, agentA]
    const edges = [edge('start_1', 'agent_a')]
    const result = computeVariableScope(nodes, edges, 'agent_a')

    const startVars = result.filter((v: AvailableVariable) => v.node_id === 'start_1')
    const variables = startVars.map((v: AvailableVariable) => v.variable)

    expect(variables).toContain('user_input')
    expect(variables).toContain('payload')
  })

  it('node C (after A and B in parallel) includes outputs from both A and B', () => {
    const nodeC = node('agent_c', {
      type: 'agent_pod',
      id: 'agent_c',
      agent_ref: { name: 'charlie' },
      instruction: 'Do task C',
    })

    const nodes = [startNode, agentA, agentB, nodeC]
    const edges = [
      edge('start_1', 'agent_a'),
      edge('start_1', 'agent_b'),
      edge('agent_a', 'agent_c'),
      edge('agent_b', 'agent_c'),
    ]

    const result = computeVariableScope(nodes, edges, 'agent_c')

    const nodeIds = [...new Set(result.map((v: AvailableVariable) => v.node_id))]
    expect(nodeIds).toContain('start_1')
    expect(nodeIds).toContain('agent_a')
    expect(nodeIds).toContain('agent_b')
    expect(nodeIds).not.toContain('agent_c')

    // Includes all 3 agent_pod variables from A
    const aVars = result.filter((v: AvailableVariable) => v.node_id === 'agent_a')
    expect(aVars).toHaveLength(3)

    // Includes all 3 agent_pod variables from B
    const bVars = result.filter((v: AvailableVariable) => v.node_id === 'agent_b')
    expect(bVars).toHaveLength(3)
  })

  it('returns empty array (no throw) when graph has a cycle', () => {
    // A → B → A (cycle); use llm nodes to avoid agent_pod required fields
    const nodeX = node('llm_x', { type: 'llm', id: 'llm_x', model: { provider: 'openai', model_id: 'gpt-4o' }, prompt: { user: 'Hi' } })
    const nodeY = node('llm_y', { type: 'llm', id: 'llm_y', model: { provider: 'openai', model_id: 'gpt-4o' }, prompt: { user: 'Hi' } })
    const nodes = [nodeX, nodeY]
    const edges = [edge('llm_x', 'llm_y'), edge('llm_y', 'llm_x')]

    expect(() => computeVariableScope(nodes, edges, 'llm_x')).not.toThrow()
    expect(computeVariableScope(nodes, edges, 'llm_x')).toEqual([])
  })

  it('end node has no declared outputs and returns empty for its scope from itself', () => {
    const result = computeVariableScope([endNode], [], 'end_1')
    expect(result).toEqual([])
  })

  it('variables are returned in topological order (start before agent)', () => {
    const nodes = [startNode, agentA, endNode]
    const edges = [edge('start_1', 'agent_a'), edge('agent_a', 'end_1')]
    const result = computeVariableScope(nodes, edges, 'end_1')

    const nodeIdOrder = result.map((v: AvailableVariable) => v.node_id)
    const firstStartIdx = nodeIdOrder.indexOf('start_1')
    const firstAgentIdx = nodeIdOrder.indexOf('agent_a')

    // start should appear before agent_a in the output
    expect(firstStartIdx).toBeLessThan(firstAgentIdx)
  })
})
