// @plan B3-PR-2 / B3-PR-3
import { useMemo } from 'react'
import { create } from 'zustand'
import { applyNodeChanges } from '@xyflow/react'
import type { Connection, NodeChange, Viewport } from '@xyflow/react'
import { nanoid } from 'nanoid'
import {
  parseResource,
  serializeResource,
  validateResource,
  type Pipeline,
  type PipelineNode,
  type PipelineEdge,
  type CompanyReference,
  type NodePosition,
} from '@agentflow/core'
import type {
  CanvasNode,
  CanvasEdge,
  NodeValidationError,
  NodeRunState,
  HistoryEntry,
} from './types'
import { useCompanyStore } from './companyStore'
import { computeVariableScope, type AvailableVariable } from './variableScope'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50
const AUTOSAVE_DELAY_MS = 500
const DEFAULT_NAMESPACE = 'default'
const DEFAULT_PIPELINE_NAME = 'untitled'
const API_VERSION = 'agentflow.ai/v1' as const

// ---------------------------------------------------------------------------
// Default node data by type
// ---------------------------------------------------------------------------

function buildDefaultNodeData(type: string, id: string): PipelineNode {
  const base = { id }
  switch (type) {
    case 'start':
      return { ...base, type: 'start', outputs: [] }
    case 'end':
      return { ...base, type: 'end', inputs: [] }
    case 'agent_pod':
      // agent_ref is intentionally cast — user must select one via ConfigPanel.
      // The node will show a validation error until agent_ref is filled in.
      return {
        ...base,
        type: 'agent_pod',
        agent_ref: null as unknown as PipelineNode & { type: 'agent_pod' } extends { agent_ref: infer R } ? R : never,
        instruction: '',
      } as unknown as PipelineNode
    case 'llm':
      return {
        ...base,
        type: 'llm',
        model: { provider: 'openai' as const, model_id: 'gpt-4o' },
        prompt: { user: '' },
      }
    case 'code':
      return {
        ...base,
        type: 'code',
        language: 'python' as const,
        code: '',
        inputs: [],
        outputs: [],
      }
    case 'http':
      return { ...base, type: 'http', method: 'GET' as const, url: '' }
    case 'if_else':
      return { ...base, type: 'if_else', conditions: [], default_branch: '' }
    case 'template':
      return { ...base, type: 'template', template: '', inputs: [] }
    case 'variable_assigner':
      return { ...base, type: 'variable_assigner', assignments: [] }
    case 'variable_aggregator':
      return {
        ...base,
        type: 'variable_aggregator',
        branches: [],
        output_key: 'result',
        strategy: 'first' as const,
      }
    case 'iteration':
      return {
        ...base,
        type: 'iteration',
        input_list: { node_id: '', variable: '', path: [] },
        iterator_var: 'item',
        body_nodes: [],
      }
    case 'human_input':
      return { ...base, type: 'human_input', prompt: '', fallback: 'skip' as const }
    case 'knowledge_retrieval':
      return {
        ...base,
        type: 'knowledge_retrieval',
        query: { node_id: '', variable: '', path: [] },
        knowledge_base_id: '',
      }
    case 'sub_workflow':
      return {
        ...base,
        type: 'sub_workflow',
        pipeline_ref: { name: '' },
        inputs: {},
      }
    default:
      return { ...base, type: 'start', outputs: [] }
  }
}

// ---------------------------------------------------------------------------
// Cycle detection (DFS on adjacency list)
// ---------------------------------------------------------------------------

function hasCycle(nodes: CanvasNode[], edges: CanvasEdge[]): boolean {
  const adj: Record<string, string[]> = {}
  for (const n of nodes) adj[n.id] = []
  for (const e of edges) {
    adj[e.source]?.push(e.target)
  }

  const visited = new Set<string>()
  const inStack = new Set<string>()

  function dfs(id: string): boolean {
    visited.add(id)
    inStack.add(id)
    for (const neighbor of adj[id] ?? []) {
      if (!visited.has(neighbor) && dfs(neighbor)) return true
      if (inStack.has(neighbor)) return true
    }
    inStack.delete(id)
    return false
  }

  for (const n of nodes) {
    if (!visited.has(n.id) && dfs(n.id)) return true
  }
  return false
}

// ---------------------------------------------------------------------------
// Store State + Actions interface
// ---------------------------------------------------------------------------

interface PipelineStoreState {
  pipelineId: string | null
  pipelineName: string
  namespace: string
  companyRef: CompanyReference | null
  saveStatus: 'idle' | 'saving' | 'saved' | 'error'

  nodes: CanvasNode[]
  edges: CanvasEdge[]
  selectedNodeId: string | null
  viewport: Viewport

  yamlSpec: string
  yamlValid: boolean
  yamlErrors: NodeValidationError[]
  yamlPanelOpen: boolean
  yamlPanelWidth: number

  history: HistoryEntry[]
  historyIndex: number
  canUndo: boolean
  canRedo: boolean

  activeRunId: string | null
  nodeRunStates: Record<string, NodeRunState>

  /** Internal flag to prevent sync loops */
  _isSyncing: boolean
}

interface PipelineStoreActions {
  addNode(type: string, position: NodePosition): void
  updateNodeConfig(nodeId: string, patch: Partial<PipelineNode>): void
  deleteNode(nodeId: string): void
  addEdge(connection: Connection): void
  deleteEdge(edgeId: string): void
  updateNodePositions(changes: NodeChange[]): void
  selectNode(nodeId: string): void
  deselectNode(): void
  setPipelineName(name: string): void
  setCompanyRef(ref: CompanyReference | null): void
  setYamlSpec(yaml: string): void
  toggleYamlPanel(): void
  setYamlPanelWidth(width: number): void
  setViewport(viewport: Viewport): void
  setNodePositions(positions: Record<string, NodePosition>): void
  undo(): void
  redo(): void
  savePipeline(): Promise<void>
  /** `pipelineName` is `/api/pipelines/{name}` (not UUID). */
  loadPipeline(pipelineName: string): Promise<void>
  setActiveRun(runId: string | null): void
  updateNodeRunState(nodeId: string, state: Partial<NodeRunState>): void
  clearRunStates(): void
}

type PipelineStore = PipelineStoreState & PipelineStoreActions

// ---------------------------------------------------------------------------
// Debounce helper (module-level so it survives re-renders)
// ---------------------------------------------------------------------------

let _saveTimer: ReturnType<typeof setTimeout> | null = null

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePipelineStore = create<PipelineStore>()((set, get) => {

  // ---- Internal helpers ---------------------------------------------------

  function _pushHistory(): void {
    const { nodes, edges, yamlSpec, history, historyIndex } = get()
    const entry: HistoryEntry = { nodes, edges, yamlSpec, timestamp: Date.now() }
    const truncated = history.slice(0, historyIndex + 1)
    const next = [...truncated, entry].slice(-MAX_HISTORY)
    set({
      history: next,
      historyIndex: next.length - 1,
      canUndo: next.length > 1,
      canRedo: false,
    })
  }

  function _scheduleSave(): void {
    if (_saveTimer) clearTimeout(_saveTimer)
    _saveTimer = setTimeout(() => {
      get().savePipeline()
    }, AUTOSAVE_DELAY_MS)
  }

  function _validatePipeline(nodes: CanvasNode[], edges: CanvasEdge[]): NodeValidationError[] {
    const errors: NodeValidationError[] = []

    const startNodes = nodes.filter(n => n.data.type === 'start')
    const endNodes = nodes.filter(n => n.data.type === 'end')

    if (startNodes.length !== 1) {
      errors.push({
        nodeId: '',
        field: 'nodes',
        message: `Pipeline must have exactly one start node (found ${startNodes.length})`,
      })
    }
    if (endNodes.length < 1) {
      errors.push({ nodeId: '', field: 'nodes', message: 'Pipeline must have at least one end node' })
    }

    if (hasCycle(nodes, edges)) {
      errors.push({ nodeId: '', field: 'edges', message: 'Pipeline DAG contains a cycle' })
    }

    // if_else nodes must have ≥ 2 outgoing edges
    for (const n of nodes) {
      if (n.data.type === 'if_else') {
        const outgoing = edges.filter(e => e.source === n.id).length
        if (outgoing < 2) {
          errors.push({
            nodeId: n.id,
            field: 'edges',
            message: 'if_else node must have at least 2 outgoing edges',
          })
        }
      }
    }

    // agent_ref validation against active company
    const company = useCompanyStore.getState().company
    if (company) {
      const agentNames = new Set(company.spec.agents.map(a => a.name))
      for (const n of nodes) {
        if (n.data.type === 'agent_pod') {
          const agentRef = (n.data as { agent_ref?: { name?: string } | null }).agent_ref
          if (!agentRef || !agentRef.name) {
            errors.push({ nodeId: n.id, field: 'agent_ref', message: 'agent_pod node has no agent_ref selected' })
          } else if (!agentNames.has(agentRef.name)) {
            errors.push({
              nodeId: n.id,
              field: 'agent_ref',
              message: `Agent "${agentRef.name}" not found in company "${company.metadata.name}"`,
            })
          }
        }
      }
    }

    return errors
  }

  function _syncNodesToYaml(): void {
    if (get()._isSyncing) return
    set({ _isSyncing: true })

    const { nodes, edges, companyRef, pipelineName, namespace, viewport } = get()

    const pipelineObj = {
      apiVersion: API_VERSION,
      kind: 'Pipeline',
      metadata: {
        name: pipelineName || DEFAULT_PIPELINE_NAME,
        namespace: namespace || DEFAULT_NAMESPACE,
      },
      spec: {
        ...(companyRef ? { company_ref: companyRef } : {}),
        nodes: nodes.map(n => ({ ...n.data })),
        edges: edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          ...(e.sourceHandle ? { source_handle: e.sourceHandle } : {}),
          ...(e.targetHandle ? { target_handle: e.targetHandle } : {}),
          ...(typeof e.label === 'string' ? { label: e.label } : {}),
          ...(e.data?.condition_branch ? { condition_branch: e.data.condition_branch } : {}),
        })),
        canvas_meta: {
          viewport,
          node_positions: Object.fromEntries(
            nodes.map(n => [n.id, { x: n.position.x, y: n.position.y }])
          ),
        },
      },
    }

    const yamlText = serializeResource(pipelineObj as Parameters<typeof serializeResource>[0])
    const validation = validateResource(yamlText)
    const additionalErrors = _validatePipeline(nodes, edges)

    set({
      yamlSpec: yamlText,
      yamlValid: validation.success && additionalErrors.length === 0,
      yamlErrors: additionalErrors,
      _isSyncing: false,
    })

    _scheduleSave()
  }

  // ---- Public actions -----------------------------------------------------

  return {
    // Initial state
    pipelineId: null,
    pipelineName: DEFAULT_PIPELINE_NAME,
    namespace: DEFAULT_NAMESPACE,
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

    // ---- Canvas mutations -------------------------------------------------

    addNode(type, position) {
      const id = `${type}_${nanoid(6)}`
      const data = buildDefaultNodeData(type, id)
      const newNode: CanvasNode = { id, type, position, data }
      set(s => ({ nodes: [...s.nodes, newNode] }))
      _pushHistory()
      _syncNodesToYaml()
    },

    updateNodeConfig(nodeId, patch) {
      set(s => ({
        nodes: s.nodes.map(n =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...patch } as PipelineNode } : n,
        ),
      }))
      _syncNodesToYaml()
    },

    deleteNode(nodeId) {
      set(s => ({
        nodes: s.nodes.filter(n => n.id !== nodeId),
        edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
        selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
      }))
      _pushHistory()
      _syncNodesToYaml()
    },

    addEdge(connection) {
      if (!connection.source || !connection.target) return
      const id = `edge_${nanoid(6)}`
      const newEdge: CanvasEdge = {
        id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle ?? undefined,
        targetHandle: connection.targetHandle ?? undefined,
        data: undefined,
      }
      set(s => ({ edges: [...s.edges, newEdge] }))
      _syncNodesToYaml()
    },

    deleteEdge(edgeId) {
      set(s => ({ edges: s.edges.filter(e => e.id !== edgeId) }))
      _syncNodesToYaml()
    },

    updateNodePositions(changes) {
      set(s => ({
        // applyNodeChanges expects Node<NodeBase>; cast through unknown for
        // compatibility with our strongly-typed CanvasNode generic.
        nodes: applyNodeChanges(
          changes as unknown as NodeChange[],
          s.nodes as unknown as Parameters<typeof applyNodeChanges>[1],
        ) as unknown as CanvasNode[],
      }))
    },

    selectNode(nodeId) {
      set({ selectedNodeId: nodeId })
    },

    deselectNode() {
      set({ selectedNodeId: null })
    },

    // ---- Metadata mutations -----------------------------------------------

    setPipelineName(name) {
      set({ pipelineName: name })
      _syncNodesToYaml()
    },

    setCompanyRef(ref) {
      set({ companyRef: ref })
      const { nodes, edges } = get()
      const errors = _validatePipeline(nodes, edges)
      set({ yamlErrors: errors })
      _syncNodesToYaml()
    },

    // ---- YAML ↔ Canvas sync ----------------------------------------------

    setYamlSpec(yaml) {
      if (get()._isSyncing) return

      const result = validateResource(yaml)
      if (!result.success) {
        const msg = result.error instanceof Error ? result.error.message : String(result.error)
        set({
          yamlValid: false,
          yamlErrors: [{ nodeId: '', field: 'yaml', message: msg }],
        })
        return
      }

      set({ _isSyncing: true })

      const pipeline = result.data as Pipeline
      const canvasMeta = pipeline.spec.canvas_meta as
        | { viewport?: Viewport; node_positions?: Record<string, NodePosition> }
        | undefined
      const nodePositions = canvasMeta?.node_positions ?? {}

      const rawNodes = (pipeline.spec.nodes as Record<string, unknown>[]) ?? []
      const rawEdges = (pipeline.spec.edges as Record<string, unknown>[]) ?? []

      const nodes: CanvasNode[] = rawNodes.map(n => {
        const id = String(n.id ?? '')
        const type = String(n.type ?? 'unknown')
        const pos = nodePositions[id] ?? { x: 0, y: 0 }
        return {
          id,
          type,
          position: { x: pos.x, y: pos.y },
          data: n as unknown as PipelineNode,
        }
      })

      const edges: CanvasEdge[] = rawEdges.map(e => ({
        id: String(e.id ?? `edge_${nanoid(6)}`),
        source: String(e.source ?? ''),
        target: String(e.target ?? ''),
        sourceHandle: e.source_handle ? String(e.source_handle) : undefined,
        targetHandle: e.target_handle ? String(e.target_handle) : undefined,
        label: e.label ? String(e.label) : undefined,
        data: { condition_branch: e.condition_branch } as unknown as PipelineEdge,
      }))

      const companyRef = (pipeline.spec.company_ref as CompanyReference | undefined) ?? null
      const viewport = canvasMeta?.viewport ?? get().viewport

      set({
        yamlSpec: yaml,
        yamlValid: true,
        yamlErrors: [],
        nodes,
        edges,
        companyRef,
        pipelineName: pipeline.metadata.name,
        namespace: pipeline.metadata.namespace ?? DEFAULT_NAMESPACE,
        viewport,
        _isSyncing: false,
      })

      _pushHistory()
    },

    toggleYamlPanel() {
      set(s => ({ yamlPanelOpen: !s.yamlPanelOpen }))
    },

    setYamlPanelWidth(width) {
      set({ yamlPanelWidth: width })
    },

    setViewport(viewport) {
      set({ viewport })
    },

    setNodePositions(positions) {
      set(s => ({
        nodes: s.nodes.map(n => {
          const p = positions[n.id]
          return p ? { ...n, position: p } : n
        }),
      }))
    },

    // ---- Undo / Redo ------------------------------------------------------

    undo() {
      const { historyIndex, history } = get()
      if (historyIndex <= 0) return
      const newIndex = historyIndex - 1
      const entry = history[newIndex]!
      set({
        nodes: entry.nodes,
        edges: entry.edges,
        yamlSpec: entry.yamlSpec,
        historyIndex: newIndex,
        canUndo: newIndex > 0,
        canRedo: true,
        _isSyncing: true,
      })
      set({ _isSyncing: false })
    },

    redo() {
      const { historyIndex, history } = get()
      if (historyIndex >= history.length - 1) return
      const newIndex = historyIndex + 1
      const entry = history[newIndex]!
      set({
        nodes: entry.nodes,
        edges: entry.edges,
        yamlSpec: entry.yamlSpec,
        historyIndex: newIndex,
        canUndo: true,
        canRedo: newIndex < history.length - 1,
        _isSyncing: true,
      })
      set({ _isSyncing: false })
    },

    // ---- Persistence ------------------------------------------------------

    async savePipeline() {
      const { yamlSpec } = get()
      if (!yamlSpec.trim()) return
      set({ saveStatus: 'saving' })
      try {
        const res = await fetch('/api/apply', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ yaml_content: yamlSpec }),
        })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        set({ saveStatus: 'saved' })
      } catch {
        set({ saveStatus: 'error' })
      }
    },

    async loadPipeline(pipelineName) {
      try {
        const res = await fetch(`/api/pipelines/${encodeURIComponent(pipelineName)}`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = (await res.json()) as { yaml_spec: string; id: string }
        get().setYamlSpec(data.yaml_spec)
        set({ pipelineId: data.id, saveStatus: 'idle' })
      } catch {
        set({ saveStatus: 'error', pipelineId: null })
      }
    },

    // ---- Run state --------------------------------------------------------

    setActiveRun(runId) {
      set({ activeRunId: runId })
    },

    updateNodeRunState(nodeId, state) {
      set(s => ({
        nodeRunStates: {
          ...s.nodeRunStates,
          [nodeId]: { ...s.nodeRunStates[nodeId], ...state } as NodeRunState,
        },
      }))
    },

    clearRunStates() {
      set({ activeRunId: null, nodeRunStates: {} })
    },
  }
})

// ---------------------------------------------------------------------------
// Selector hooks
// ---------------------------------------------------------------------------

export function useNodeValidationErrors(nodeId: string): NodeValidationError[] {
  return usePipelineStore(s => s.yamlErrors.filter(e => e.nodeId === nodeId))
}

export function useAgentBudget(agentName: string) {
  return useCompanyStore(s => s.agentBudgets[agentName] ?? null)
}

export function useAgentHealth(agentName: string) {
  return useCompanyStore(s => s.agentHealth[agentName] ?? null)
}

/** @plan B3-PR-3 — Returns upstream variables available at the given node. */
export function useVariableScope(nodeId: string): AvailableVariable[] {
  const nodes = usePipelineStore(s => s.nodes)
  const edges = usePipelineStore(s => s.edges)
  return useMemo(() => computeVariableScope(nodes, edges, nodeId), [nodes, edges, nodeId])
}
