// @plan B3-PR-4
import { describe, it, expect } from 'vitest'
import { computeVariableScope } from '../variableScope'
import type { CanvasNode, CanvasEdge } from '../types'
import type { PipelineNode } from '@agentflow/core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeNode(id: string, type: string, extra?: Record<string, unknown>): CanvasNode {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { id, type, ...extra } as unknown as PipelineNode,
  }
}

function makeEdge(source: string, target: string): CanvasEdge {
  return { id: `${source}->${target}`, source, target } as CanvasEdge
}

// ---------------------------------------------------------------------------
// agent_pod outputs  (B3-PR-3)
// ---------------------------------------------------------------------------

describe('agent_pod outputs', () => {
  it('includes response, agent_name, and agent_role', () => {
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', { outputs: [] }),
      makeNode('agent1', 'agent_pod'),
      makeNode('next', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [
      makeEdge('start', 'agent1'),
      makeEdge('agent1', 'next'),
    ]

    const vars = computeVariableScope(nodes, edges, 'next')
    const agent1Vars = vars.filter(v => v.node_id === 'agent1')
    const names = agent1Vars.map(v => v.variable)

    expect(names).toContain('response')
    expect(names).toContain('agent_name')
    expect(names).toContain('agent_role')
  })
})

// ---------------------------------------------------------------------------
// llm outputs  (B3-PR-3)
// ---------------------------------------------------------------------------

describe('llm outputs', () => {
  it('includes text and tokens_used', () => {
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', { outputs: [] }),
      makeNode('llm1', 'llm'),
      makeNode('end1', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [makeEdge('start', 'llm1'), makeEdge('llm1', 'end1')]

    const vars = computeVariableScope(nodes, edges, 'end1')
    const llmVars = vars.filter(v => v.node_id === 'llm1').map(v => v.variable)

    expect(llmVars).toContain('text')
    expect(llmVars).toContain('tokens_used')
  })
})

// ---------------------------------------------------------------------------
// http outputs  (B3-PR-4)
// ---------------------------------------------------------------------------

describe('http outputs', () => {
  it('includes status_code, body, and headers', () => {
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', { outputs: [] }),
      makeNode('http1', 'http'),
      makeNode('end1', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [makeEdge('start', 'http1'), makeEdge('http1', 'end1')]

    const vars = computeVariableScope(nodes, edges, 'end1')
    const httpVars = vars.filter(v => v.node_id === 'http1').map(v => v.variable)

    expect(httpVars).toContain('status_code')
    expect(httpVars).toContain('body')
    expect(httpVars).toContain('headers')
  })
})

// ---------------------------------------------------------------------------
// template outputs  (B3-PR-4)
// ---------------------------------------------------------------------------

describe('template outputs', () => {
  it('includes text', () => {
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', { outputs: [] }),
      makeNode('tmpl1', 'template'),
      makeNode('end1', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [makeEdge('start', 'tmpl1'), makeEdge('tmpl1', 'end1')]

    const vars = computeVariableScope(nodes, edges, 'end1')
    const tmplVars = vars.filter(v => v.node_id === 'tmpl1').map(v => v.variable)

    expect(tmplVars).toContain('text')
  })
})

// ---------------------------------------------------------------------------
// start node outputs  (B3-PR-4)
// ---------------------------------------------------------------------------

describe('start node outputs', () => {
  it('reflects the VariableDefinition[] defined in node.outputs', () => {
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', {
        outputs: [
          { name: 'user_input', type: 'string' },
          { name: 'session_id', type: 'string' },
        ],
      }),
      makeNode('end1', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [makeEdge('start', 'end1')]

    const vars = computeVariableScope(nodes, edges, 'end1')
    const startVars = vars.filter(v => v.node_id === 'start').map(v => v.variable)

    expect(startVars).toContain('user_input')
    expect(startVars).toContain('session_id')
  })

  it('returns empty array when start has no outputs', () => {
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', { outputs: [] }),
      makeNode('end1', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [makeEdge('start', 'end1')]

    const vars = computeVariableScope(nodes, edges, 'end1')
    expect(vars.filter(v => v.node_id === 'start')).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// Parallel branches  (B3-PR-3)
// ---------------------------------------------------------------------------

describe('parallel branches', () => {
  it('node C (after A and B in parallel) includes outputs from both A and B', () => {
    // start → A
    //       → B
    // A, B  → C
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', { outputs: [] }),
      makeNode('A', 'agent_pod'),
      makeNode('B', 'llm'),
      makeNode('C', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [
      makeEdge('start', 'A'),
      makeEdge('start', 'B'),
      makeEdge('A', 'C'),
      makeEdge('B', 'C'),
    ]

    const vars = computeVariableScope(nodes, edges, 'C')
    const nodeIds = new Set(vars.map(v => v.node_id))

    expect(nodeIds.has('A')).toBe(true)
    expect(nodeIds.has('B')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Cycle detection  (B3-PR-3)
// ---------------------------------------------------------------------------

describe('cycle detection', () => {
  it('returns [] silently when the graph has a cycle', () => {
    const nodes: CanvasNode[] = [
      makeNode('A', 'agent_pod'),
      makeNode('B', 'agent_pod'),
      makeNode('C', 'end', { inputs: [] }),
    ]
    // A → B → A (cycle)  and B → C
    const edges: CanvasEdge[] = [
      makeEdge('A', 'B'),
      makeEdge('B', 'A'),
      makeEdge('B', 'C'),
    ]

    expect(() => computeVariableScope(nodes, edges, 'C')).not.toThrow()
    expect(computeVariableScope(nodes, edges, 'C')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// Node not reachable from start
// ---------------------------------------------------------------------------

describe('unreachable nodes', () => {
  it('does not include outputs from nodes not upstream of forNodeId', () => {
    // start → A → C
    // B is isolated
    const nodes: CanvasNode[] = [
      makeNode('start', 'start', { outputs: [] }),
      makeNode('A', 'agent_pod'),
      makeNode('B', 'llm'),
      makeNode('C', 'end', { inputs: [] }),
    ]
    const edges: CanvasEdge[] = [
      makeEdge('start', 'A'),
      makeEdge('A', 'C'),
    ]

    const vars = computeVariableScope(nodes, edges, 'C')
    const nodeIds = new Set(vars.map(v => v.node_id))
    expect(nodeIds.has('B')).toBe(false)
  })
})
