// @plan B3-PR-4
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { usePipelineStore } from '../pipelineStore'
import { useCompanyStore } from '../companyStore'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  useCompanyStore.setState(s => ({ ...s, company: null, agentBudgets: {}, agentHealth: {} }))
}

const VALID_PIPELINE_YAML = `
apiVersion: agentflow.ai/v1
kind: Pipeline
metadata:
  name: test-pipeline
  namespace: default
spec:
  nodes:
    - id: start
      type: start
      outputs: []
    - id: end-1
      type: end
      inputs: []
  edges:
    - id: e1
      source: start
      target: end-1
  canvas_meta:
    viewport:
      x: 0
      y: 0
      zoom: 1
    node_positions:
      start:
        x: 100
        y: 200
      end-1:
        x: 400
        y: 200
`.trim()

const INVALID_YAML = `this is: [not valid pipeline yaml`

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('pipelineStore', () => {
  beforeEach(() => {
    resetStore()
    vi.restoreAllMocks()
  })

  // ---------- addNode -------------------------------------------------------

  describe('addNode', () => {
    it('creates an agent_pod node with agent_ref=null and correct ID prefix', () => {
      const { addNode } = usePipelineStore.getState()
      addNode('agent_pod', { x: 100, y: 200 })

      const { nodes } = usePipelineStore.getState()
      expect(nodes).toHaveLength(1)
      const node = nodes[0]!
      expect(node.id).toMatch(/^agent_pod_/)
      expect(node.data.type).toBe('agent_pod')
      expect((node.data as { agent_ref: unknown }).agent_ref).toBeNull()
      expect(node.position).toEqual({ x: 100, y: 200 })
    })

    it('creates a start node with empty outputs', () => {
      usePipelineStore.getState().addNode('start', { x: 0, y: 0 })
      const { nodes } = usePipelineStore.getState()
      expect(nodes[0]?.data.type).toBe('start')
      expect((nodes[0]?.data as { outputs: unknown[] } | undefined)?.outputs).toEqual([])
    })

    it('pushes history after adding a node', () => {
      usePipelineStore.getState().addNode('start', { x: 0, y: 0 })
      const { historyIndex, history } = usePipelineStore.getState()
      expect(history.length).toBeGreaterThan(0)
      expect(historyIndex).toBe(history.length - 1)
    })
  })

  // ---------- setYamlSpec (YAML → canvas) -----------------------------------

  describe('setYamlSpec', () => {
    it('parses valid YAML and updates nodes and edges', () => {
      usePipelineStore.getState().setYamlSpec(VALID_PIPELINE_YAML)
      const { nodes, edges, yamlValid, pipelineName } = usePipelineStore.getState()

      expect(yamlValid).toBe(true)
      expect(pipelineName).toBe('test-pipeline')
      expect(nodes).toHaveLength(2)
      expect(edges).toHaveLength(1)
    })

    it('restores node positions from canvas_meta', () => {
      usePipelineStore.getState().setYamlSpec(VALID_PIPELINE_YAML)
      const { nodes } = usePipelineStore.getState()
      const startNode = nodes.find(n => n.id === 'start')!
      expect(startNode.position).toEqual({ x: 100, y: 200 })
    })

    it('does NOT update nodes or edges when YAML is invalid', () => {
      // First add a node so nodes is non-empty
      usePipelineStore.getState().addNode('start', { x: 0, y: 0 })
      const nodesBefore = usePipelineStore.getState().nodes

      usePipelineStore.getState().setYamlSpec(INVALID_YAML)

      const { nodes, yamlValid, yamlErrors } = usePipelineStore.getState()
      expect(yamlValid).toBe(false)
      expect(yamlErrors.length).toBeGreaterThan(0)
      // nodes unchanged
      expect(nodes).toEqual(nodesBefore)
    })

    it('sets yamlErrors without clearing nodes on schema-invalid YAML', () => {
      usePipelineStore.getState().addNode('start', { x: 10, y: 20 })
      usePipelineStore.getState().setYamlSpec('apiVersion: agentflow.ai/v1\nkind: Agent\nmetadata:\n  name: oops\nspec:\n  role: tester\n  model:\n    provider: openai\n    name: gpt-4o')
      const { yamlErrors, nodes } = usePipelineStore.getState()
      // Error because kind is Agent, not Pipeline
      expect(yamlErrors.length).toBeGreaterThan(0)
      expect(nodes.length).toBe(1) // nodes not cleared
    })
  })

  // ---------- undo / redo ---------------------------------------------------

  describe('undo / redo', () => {
    it('canUndo is false in initial state', () => {
      expect(usePipelineStore.getState().canUndo).toBe(false)
    })

    it('undo after addNode restores empty nodes', () => {
      // Start with a fresh history push for initial state
      usePipelineStore.getState().addNode('start', { x: 0, y: 0 })
      usePipelineStore.getState().addNode('end', { x: 300, y: 0 })

      expect(usePipelineStore.getState().nodes).toHaveLength(2)

      // After two addNode calls we have 2 history entries.
      // undo once → should revert to 1 node
      usePipelineStore.getState().undo()
      expect(usePipelineStore.getState().nodes).toHaveLength(1)
      expect(usePipelineStore.getState().canRedo).toBe(true)
    })

    it('redo after undo restores the reverted state', () => {
      usePipelineStore.getState().addNode('start', { x: 0, y: 0 })
      usePipelineStore.getState().addNode('end', { x: 300, y: 0 })

      usePipelineStore.getState().undo()
      usePipelineStore.getState().redo()

      expect(usePipelineStore.getState().nodes).toHaveLength(2)
      expect(usePipelineStore.getState().canRedo).toBe(false)
    })

    it('undo when historyIndex=0 does nothing', () => {
      usePipelineStore.getState().addNode('start', { x: 0, y: 0 })
      // Only one entry; historyIndex=0 — can't go further back
      usePipelineStore.getState().undo() // safe no-op: index was 0

      // Still has the node (we only pushed one history entry)
      // canUndo=false so undo is a no-op
      const { canUndo } = usePipelineStore.getState()
      // After undo from index 0 → index would be -1 which is invalid,
      // so the store should guard against it
      expect(canUndo).toBe(false)
    })
  })

  // ---------- setCompanyRef -------------------------------------------------

  describe('setCompanyRef', () => {
    it('validates existing agent_pod nodes when company ref is set', () => {
      // Add an agent_pod node with a known bad agent_ref
      usePipelineStore.getState().addNode('agent_pod', { x: 100, y: 100 })
      const nodeId = usePipelineStore.getState().nodes[0]!.id

      // Manually patch agent_ref to something
      usePipelineStore.getState().updateNodeConfig(nodeId, { agent_ref: { name: 'ghost-agent' } as unknown as never })

      // Set a real company with different agents
      useCompanyStore.setState(s => ({
        ...s,
        company: {
          apiVersion: 'agentflow.ai/v1' as const,
          kind: 'Company' as const,
          metadata: { name: 'acme', namespace: 'default' },
          spec: {
            agents: [{ name: 'alice', role: 'developer' }],
          },
        } as NonNullable<typeof s.company>,
      }))

      usePipelineStore.getState().setCompanyRef({ name: 'acme', namespace: 'default' })

      const { yamlErrors } = usePipelineStore.getState()
      const nodeErrors = yamlErrors.filter(e => e.nodeId === nodeId)
      expect(nodeErrors.length).toBeGreaterThan(0)
      expect(nodeErrors[0]?.message).toMatch(/ghost-agent/)
    })
  })

  // ---------- _validatePipeline (agent ref) ---------------------------------

  describe('agent ref validation', () => {
    it('flags agent_pod node with unknown agent_ref when company is set', () => {
      useCompanyStore.setState(s => ({
        ...s,
        company: {
          apiVersion: 'agentflow.ai/v1' as const,
          kind: 'Company' as const,
          metadata: { name: 'acme', namespace: 'default' },
          spec: {
            agents: [{ name: 'alice', role: 'developer' }],
          },
        } as NonNullable<typeof s.company>,
      }))

      usePipelineStore.getState().addNode('agent_pod', { x: 0, y: 0 })
      const nodeId = usePipelineStore.getState().nodes[0]!.id
      usePipelineStore.getState().updateNodeConfig(nodeId, { agent_ref: { name: 'bob' } as unknown as never })

      // Trigger sync by touching companyRef
      usePipelineStore.getState().setCompanyRef({ name: 'acme', namespace: 'default' })

      const { yamlErrors } = usePipelineStore.getState()
      expect(yamlErrors.some(e => e.nodeId === nodeId && e.message.includes('bob'))).toBe(true)
    })
  })

  // ---------- _validatePipeline (B3-PR-4) -----------------------------------

  describe('_validatePipeline via canvas mutations', () => {
    it('detects pipeline without a start node and adds a global error', () => {
      // Add only an end node — no start
      usePipelineStore.getState().addNode('end', { x: 300, y: 0 })
      const { yamlErrors } = usePipelineStore.getState()
      const startError = yamlErrors.find(
        e => e.field === 'nodes' && e.message.includes('start node'),
      )
      expect(startError).toBeDefined()
      expect(startError!.nodeId).toBe('')
    })

    it('detects if_else node with fewer than 2 outgoing edges and adds a node-level error', () => {
      // Add start + end + if_else but only 1 edge out of if_else
      usePipelineStore.getState().addNode('start', { x: 0, y: 0 })
      usePipelineStore.getState().addNode('end', { x: 600, y: 0 })
      usePipelineStore.getState().addNode('if_else', { x: 300, y: 0 })

      const { nodes } = usePipelineStore.getState()
      const startId = nodes.find(n => n.data.type === 'start')!.id
      const ifElseId = nodes.find(n => n.data.type === 'if_else')!.id
      const endId = nodes.find(n => n.data.type === 'end')!.id

      // Connect start → if_else → end (only 1 outgoing edge from if_else)
      usePipelineStore.getState().addEdge({ source: startId, target: ifElseId, sourceHandle: null, targetHandle: null })
      usePipelineStore.getState().addEdge({ source: ifElseId, target: endId, sourceHandle: null, targetHandle: null })

      const { yamlErrors } = usePipelineStore.getState()
      const ifElseError = yamlErrors.find(
        e => e.nodeId === ifElseId && e.field === 'edges',
      )
      expect(ifElseError).toBeDefined()
      expect(ifElseError!.message).toMatch(/2 outgoing/)
    })
  })

  // ---------- clearRunStates (B3-PR-4) --------------------------------------

  describe('clearRunStates', () => {
    it('resets nodeRunStates to empty and clears activeRunId', () => {
      usePipelineStore.setState({
        activeRunId: 'run-xyz',
        nodeRunStates: {
          'node_a': { status: 'completed' },
          'node_b': { status: 'failed', error: 'timeout' },
        },
      })

      usePipelineStore.getState().clearRunStates()

      const { activeRunId, nodeRunStates } = usePipelineStore.getState()
      expect(activeRunId).toBeNull()
      expect(Object.keys(nodeRunStates)).toHaveLength(0)
    })
  })

  // ---------- savePipeline --------------------------------------------------

  describe('savePipeline', () => {
    it('calls POST /api/apply with yaml_content', async () => {
      const mockFetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
      vi.stubGlobal('fetch', mockFetch)

      usePipelineStore.setState({ pipelineId: 'pipeline-123', yamlSpec: 'some: yaml' })
      await usePipelineStore.getState().savePipeline()

      expect(mockFetch).toHaveBeenCalledWith(
        '/api/apply',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ yaml_content: 'some: yaml' }),
        }),
      )
      expect(usePipelineStore.getState().saveStatus).toBe('saved')
    })

    it('does nothing if yamlSpec is empty', async () => {
      const mockFetch = vi.fn()
      vi.stubGlobal('fetch', mockFetch)

      usePipelineStore.setState({ pipelineId: 'pipeline-123', yamlSpec: '' })
      await usePipelineStore.getState().savePipeline()
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })
})
