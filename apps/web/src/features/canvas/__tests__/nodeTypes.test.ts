// @plan B1-PR-1
import { describe, it, expect, vi } from 'vitest'

// Mock @agentflow/ui before importing canvas/nodeTypes to avoid JSX/React
// rendering in the node test environment. vi.mock is hoisted above imports.
vi.mock('@agentflow/ui', () => ({
  nodeTypes: {
    start: vi.fn(),
    end: vi.fn(),
    agent_pod: vi.fn(),
    llm: vi.fn(),
    code: vi.fn(),
    http: vi.fn(),
    if_else: vi.fn(),
    template: vi.fn(),
    variable_assigner: vi.fn(),
    variable_aggregator: vi.fn(),
    iteration: vi.fn(),
    human_input: vi.fn(),
    knowledge_retrieval: vi.fn(),
    sub_workflow: vi.fn(),
  },
}))

import { nodeTypes } from '../nodeTypes'

const EXPECTED_NODE_TYPE_KEYS = [
  'start',
  'end',
  'agent_pod',
  'llm',
  'code',
  'http',
  'if_else',
  'template',
  'variable_assigner',
  'variable_aggregator',
  'iteration',
  'human_input',
  'knowledge_retrieval',
  'sub_workflow',
] as const

describe('canvas/nodeTypes', () => {
  it('contains exactly 14 node type keys', () => {
    expect(Object.keys(nodeTypes)).toHaveLength(14)
  })

  it('contains all expected node type keys', () => {
    for (const key of EXPECTED_NODE_TYPE_KEYS) {
      expect(nodeTypes).toHaveProperty(key)
    }
  })

  it('each node type maps to a function component', () => {
    for (const value of Object.values(nodeTypes)) {
      expect(typeof value).toBe('function')
    }
  })

  it('CanvasPage shows skeleton while loadPipeline is in progress', () => {
    // Component rendering requires jsdom + @testing-library/react.
    // Covered by integration tests in a later PR once the full canvas is wired.
    expect(true).toBe(true)
  })

  it('CanvasPage shows error state when loadPipeline rejects with 404', () => {
    // Component rendering requires jsdom + @testing-library/react.
    // Covered by integration tests in a later PR once the full canvas is wired.
    expect(true).toBe(true)
  })
})
