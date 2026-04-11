// @plan B1-PR-2
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { validateConnection } from '../CanvasEditor'
import { usePipelineStore } from '../../../store/pipelineStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const startNode = { id: 'start-1', data: { type: 'start' } }
const endNode = { id: 'end-1', data: { type: 'end' } }
const llmNode = { id: 'llm-1', data: { type: 'llm' } }
const agentNode = { id: 'agent-1', data: { type: 'agent_pod' } }
const ifElseNode = { id: 'if-1', data: { type: 'if_else' } }

const allNodes = [startNode, endNode, llmNode, agentNode, ifElseNode]

function resetStore() {
  usePipelineStore.setState({
    pipelineId: null,
    pipelineName: 'untitled',
    namespace: 'default',
    companyRef: null,
    saveStatus: 'idle',
    nodes: [],
    edges: [],
    selectedNodeId: null,
    viewport: { x: 0, y: 0, zoom: 1 },
    yamlSpec: '',
    yamlValid: false,
    yamlErrors: [],
    yamlPanelOpen: false,
    yamlPanelWidth: 400,
    history: [],
    historyIndex: -1,
    canUndo: false,
    canRedo: false,
    activeRunId: null,
    nodeRunStates: {},
    _isSyncing: false,
  })
}

// ---------------------------------------------------------------------------
// validateConnection
// ---------------------------------------------------------------------------

describe('validateConnection', () => {
  it('rejects connection targeting a start node (start has no inputs)', () => {
    const connection = { source: 'llm-1', target: 'start-1', sourceHandle: null, targetHandle: null }
    expect(validateConnection(connection, allNodes)).toBe(false)
  })

  it('rejects connection sourcing from an end node (end has no outputs)', () => {
    const connection = { source: 'end-1', target: 'llm-1', sourceHandle: null, targetHandle: null }
    expect(validateConnection(connection, allNodes)).toBe(false)
  })

  it('rejects if_else source connection without a sourceHandle', () => {
    const connection = { source: 'if-1', target: 'llm-1', sourceHandle: null, targetHandle: null }
    expect(validateConnection(connection, allNodes)).toBe(false)
  })

  it('allows if_else source connection with a labeled sourceHandle', () => {
    const connection = { source: 'if-1', target: 'llm-1', sourceHandle: 'true', targetHandle: null }
    expect(validateConnection(connection, allNodes)).toBe(true)
  })

  it('allows valid connection between two regular nodes', () => {
    const connection = { source: 'start-1', target: 'llm-1', sourceHandle: null, targetHandle: null }
    expect(validateConnection(connection, allNodes)).toBe(true)
  })

  it('returns false when source node is not found', () => {
    const connection = { source: 'unknown', target: 'llm-1', sourceHandle: null, targetHandle: null }
    expect(validateConnection(connection, allNodes)).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// PipelineStore integration — addNode + updateNodeConfig (agent drop flow)
// ---------------------------------------------------------------------------

describe('agent_pod drop creates node with agent_ref', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  it('adding agent_pod node then patching agent_ref stores data.agent_ref.name', () => {
    const { addNode, updateNodeConfig } = usePipelineStore.getState()

    // Simulate the drop handler: capture IDs, addNode, then patch
    const prevIds = new Set(usePipelineStore.getState().nodes.map(n => n.id))
    addNode('agent_pod', { x: 100, y: 200 })

    const newNode = usePipelineStore.getState().nodes.find(n => !prevIds.has(n.id))
    expect(newNode).toBeDefined()
    expect(newNode!.type).toBe('agent_pod')

    // Simulate the agent_ref patch
    updateNodeConfig(newNode!.id, { agent_ref: { name: 'alice' } } as Parameters<typeof updateNodeConfig>[1])

    const patched = usePipelineStore.getState().nodes.find(n => n.id === newNode!.id)
    expect((patched!.data as { agent_ref?: { name: string } }).agent_ref?.name).toBe('alice')
  })
})

// ---------------------------------------------------------------------------
// onNodesChange position — updateNodePositions called via store
// ---------------------------------------------------------------------------

describe('updateNodePositions', () => {
  beforeEach(resetStore)

  it('position change updates node coordinates in the store', () => {
    const { addNode, updateNodePositions } = usePipelineStore.getState()
    addNode('llm', { x: 0, y: 0 })

    const nodeId = usePipelineStore.getState().nodes[0]!.id

    // Simulate a position NodeChange
    updateNodePositions([
      { type: 'position', id: nodeId, position: { x: 250, y: 350 }, dragging: false },
    ])

    const updated = usePipelineStore.getState().nodes.find(n => n.id === nodeId)
    expect(updated?.position).toEqual({ x: 250, y: 350 })
  })
})
