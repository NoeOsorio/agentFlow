// @plan B3-PR-3
import { useMemo } from 'react'
import type { CanvasNode, CanvasEdge } from './types'
import { usePipelineStore } from './pipelineStore'

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type AvailableVariable = {
  node_id: string
  variable: string
  path?: string[]
  type: string
  description: string
}

// ---------------------------------------------------------------------------
// Output variable derivation by node type
// ---------------------------------------------------------------------------

function getNodeOutputs(node: CanvasNode): AvailableVariable[] {
  const nid = node.id
  const data = node.data as Record<string, unknown>

  switch (data.type) {
    case 'start': {
      const outputs = (data.outputs as Array<{ name: string; type?: string }> | undefined) ?? []
      return outputs.map(o => ({
        node_id: nid,
        variable: o.name,
        type: o.type ?? 'string',
        description: `Output from start node`,
      }))
    }

    case 'agent_pod':
      return [
        { node_id: nid, variable: 'response', type: 'string', description: 'Agent response text' },
        { node_id: nid, variable: 'agent_name', type: 'string', description: 'Name of the agent' },
        { node_id: nid, variable: 'agent_role', type: 'string', description: 'Role of the agent' },
      ]

    case 'llm':
      return [
        { node_id: nid, variable: 'text', type: 'string', description: 'LLM output text' },
        { node_id: nid, variable: 'tokens_used', type: 'number', description: 'Tokens consumed' },
      ]

    case 'code': {
      const outputs = (data.outputs as Array<{ name: string; type?: string }> | undefined) ?? []
      return outputs.map(o => ({
        node_id: nid,
        variable: o.name,
        type: o.type ?? 'string',
        description: `Code output: ${o.name}`,
      }))
    }

    case 'http':
      return [
        { node_id: nid, variable: 'status_code', type: 'number', description: 'HTTP status code' },
        { node_id: nid, variable: 'body', type: 'object', description: 'Response body' },
        { node_id: nid, variable: 'headers', type: 'object', description: 'Response headers' },
      ]

    case 'template':
      return [
        { node_id: nid, variable: 'text', type: 'string', description: 'Rendered template text' },
      ]

    default:
      return []
  }
}

// ---------------------------------------------------------------------------
// Topological sort (Kahn's algorithm)
// Returns null if a cycle is detected.
// ---------------------------------------------------------------------------

function topoSort(nodes: CanvasNode[], edges: CanvasEdge[]): CanvasNode[] | null {
  const inDegree: Record<string, number> = {}
  const adj: Record<string, string[]> = {}

  for (const n of nodes) {
    inDegree[n.id] = 0
    adj[n.id] = []
  }

  for (const e of edges) {
    if (adj[e.source] !== undefined) {
      adj[e.source]!.push(e.target)
    }
    inDegree[e.target] = (inDegree[e.target] ?? 0) + 1
  }

  const queue: string[] = Object.entries(inDegree)
    .filter(([, deg]) => deg === 0)
    .map(([id]) => id)

  const sorted: string[] = []
  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(id)
    for (const neighbor of adj[id] ?? []) {
      inDegree[neighbor]!--
      if (inDegree[neighbor] === 0) {
        queue.push(neighbor)
      }
    }
  }

  if (sorted.length !== nodes.length) return null // cycle detected

  return sorted.map(id => nodeMap.get(id)!).filter(Boolean)
}

// ---------------------------------------------------------------------------
// Ancestor discovery (BFS on reversed graph)
// ---------------------------------------------------------------------------

function getAncestors(edges: CanvasEdge[], forNodeId: string): Set<string> {
  const parents: Record<string, string[]> = {}
  for (const e of edges) {
    if (!parents[e.target]) parents[e.target] = []
    parents[e.target]!.push(e.source)
  }

  const ancestors = new Set<string>()
  const queue = [forNodeId]

  while (queue.length > 0) {
    const id = queue.shift()!
    for (const parent of parents[id] ?? []) {
      if (!ancestors.has(parent)) {
        ancestors.add(parent)
        queue.push(parent)
      }
    }
  }

  return ancestors
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all variables available at `forNodeId` from upstream nodes.
 * Returns [] silently if the graph has a cycle (cycle error is reported separately
 * by _validatePipeline in pipelineStore).
 */
export function computeVariableScope(
  nodes: CanvasNode[],
  edges: CanvasEdge[],
  forNodeId: string,
): AvailableVariable[] {
  const sorted = topoSort(nodes, edges)
  if (!sorted) return [] // cycle — return empty without throwing

  const ancestors = getAncestors(edges, forNodeId)

  const variables: AvailableVariable[] = []
  for (const node of sorted) {
    if (ancestors.has(node.id)) {
      variables.push(...getNodeOutputs(node))
    }
  }

  return variables
}

/**
 * React hook — returns upstream variables available at the given node.
 * Memoized against nodes and edges changes.
 */
export function useVariableScope(nodeId: string): AvailableVariable[] {
  const nodes = usePipelineStore(s => s.nodes)
  const edges = usePipelineStore(s => s.edges)
  return useMemo(() => computeVariableScope(nodes, edges, nodeId), [nodes, edges, nodeId])
}
